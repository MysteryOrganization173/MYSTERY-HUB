import React,{useState,useEffect,useRef} from 'react';
import { useApp } from '../../context/AppContext';
import { financeRequest } from '../../services/financeApi';
import { parseGhs,percentMinor,formatGhs } from '../../../shared/money';

const inputClass='w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white';
const buttonClass='rounded-xl bg-[#00c365] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50';
export const FinancialPanel:React.FC<{mode:'wallet'|'earn'}>=({mode})=>{
  const {sessionToken,user,openAuth,setActivePage}=useApp();
  const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [action,setAction]=useState(''),[amount,setAmount]=useState(''),[phone,setPhone]=useState(''),[network,setNetwork]=useState('mtn'),[recipientName,setName]=useState('');
  const [confirmed,setConfirmed]=useState(false),[offset,setOffset]=useState(0);
  const pending=useRef<{fingerprint:string;id:string}|null>(null);
  const activeToken=useRef(sessionToken);activeToken.current=sessionToken;
  const refresh=async()=>{if(!sessionToken)return;try{const result=await financeRequest(sessionToken,`?offset=${offset}`);if(activeToken.current!==sessionToken)return;setData(result);setError('');}catch(e){if(activeToken.current===sessionToken)setError((e as Error).message);}};
  useEffect(()=>{setData(null);setAction('');setAmount('');setPhone('');setName('');setConfirmed(false);setOffset(0);setNotice('');setError('');pending.current=null;},[sessionToken]);
  useEffect(()=>{void refresh();},[sessionToken,offset]);
  useEffect(()=>{
    if(mode!=='wallet'||!sessionToken)return;
    const params=new URLSearchParams(window.location.search),reference=params.get('reference')||params.get('trxref');
    if(!reference||!reference.startsWith('MH-WALLET-'))return;
    let active=true;
    setBusy(true);financeRequest(sessionToken,`/topups/${encodeURIComponent(reference)}/verify`,{}).then(result=>{if(!active)return;setNotice(result.state==='credited'?'Wallet funding verified and credited.':result.state==='failed'?'Funding failed. No funds were credited. Verify funding if you subsequently completed payment.':'Funding is still being verified. Use Verify funding below to check again.');void refresh();}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[mode,sessionToken]);
  if(!user||!sessionToken)return <section className="rounded-2xl border border-slate-800 bg-[#0b1116] p-5"><h1 className="text-xl font-bold text-white">Mystery {mode==='wallet'?'Wallet':'Earn'}</h1><p className="my-3 text-slate-400">Sign in to view your balances and history.</p><button className={buttonClass} onClick={()=>openAuth('login')}>Sign in</button></section>;
  let minor=0;try{minor=parseGhs(amount);}catch{}
  const fee=minor&&data?percentMinor(minor,data.settings.withdrawalFeeBps):0;
  const perform=async(e:React.FormEvent)=>{
    e.preventDefault();if(busy||!sessionToken)return;setBusy(true);setError('');setNotice('');
    try {
      const amountMinor=parseGhs(amount),fingerprint=JSON.stringify({action,amountMinor,phone,network,recipientName});
      if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,id:crypto.randomUUID()};
      const body={amountMinor,requestId:pending.current!.id,confirmed,phone,network,recipientName};
      const result=await financeRequest(sessionToken,action==='topup'?'/topups':action==='transfer'?'/transfer':'/withdrawals',body);
      if(activeToken.current!==sessionToken)return;
      if(action==='topup'){
        if(!result.authorizationUrl){setNotice(`Funding request ${result.state}. Use Verify funding below before starting another.`);await refresh();return;}
        const url=new URL(result.authorizationUrl);if(url.protocol!=='https:'||url.hostname!=='checkout.paystack.com')throw new Error('Payment link unavailable. Reconcile this request.');window.location.assign(url.href);return;
      }
      setNotice(action==='transfer'?'Transfer completed. Funds are now spendable in Wallet.':'Withdrawal requested. Funds are reserved for manual review.');pending.current=null;setAction('');setAmount('');setConfirmed(false);await refresh();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  return <section className="min-w-0 rounded-2xl border border-slate-800 bg-[#0b1116] p-4 sm:p-6 text-left text-slate-100 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Mystery {mode==='wallet'?'Wallet':'Earn'}</h2><p className="text-sm text-slate-400">{mode==='wallet'?'Spend instantly across eligible Mystery Hub services.':'Your referral earnings and cash rewards.'}</p></div><button onClick={()=>void refresh()} className="text-sm text-[#00c365]" disabled={busy}>Refresh</button></div>
    {error&&<p role="alert" className="break-words text-sm text-amber-300">{error}</p>}{notice&&<p role="status" className="break-words text-sm text-emerald-300">{notice}</p>}
    {!data?<p>Loading verified balances…</p>:<>
      {data.restricted&&<p className="text-amber-300">Account needs Admin reconciliation. Spending and cash-out may be restricted.</p>}
      <p className="text-sm text-slate-400">{mode==='wallet'?'Wallet Balance':'Available Earnings'}</p><p className="text-3xl font-extrabold">{formatGhs(mode==='wallet'?data.walletMinor:data.earn.availableMinor)}</p>
      {mode==='earn'&&<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">{[['Pending',data.earn.pendingMinor],['Reserved',data.earn.reservedMinor],['Lifetime Earned',data.earn.lifetimeMinor],['Total Withdrawn',data.earn.withdrawnMinor]].map(([label,value])=><div key={label}><p className="text-slate-400">{label}</p><p>{formatGhs(Number(value))}</p></div>)}</div>}
      <div className="flex flex-wrap gap-3">{mode==='wallet'?<><button className={buttonClass} onClick={()=>{setAction('topup');setConfirmed(false);}}>Add Money</button><button className="rounded-xl border border-slate-700 px-4 py-3 text-sm" onClick={()=>setActivePage('earn')}>Transfer from Mystery Earn</button></>:<><button className={buttonClass} onClick={()=>{setAction('withdrawal');setConfirmed(false);}}>Withdraw Earnings</button><button className="rounded-xl border border-slate-700 px-4 py-3 text-sm" onClick={()=>{setAction('transfer');setConfirmed(false);}}>Transfer to Wallet</button></>}</div>
      {mode==='wallet'&&data.walletMinor===0&&<p className="text-sm text-slate-400">Your wallet is empty. Add money to make future Mystery Hub purchases faster.</p>}
      {mode==='earn'&&data.earn.lifetimeMinor===0&&<p className="text-sm text-slate-400">No earnings yet. Share your referral link to start earning from qualifying activity.</p>}
      {mode==='earn'&&data.earn.availableMinor<data.settings.withdrawalMinimumMinor&&<p className="text-sm text-slate-400">Earn {formatGhs(data.settings.withdrawalMinimumMinor-data.earn.availableMinor)} more to unlock cash-out. Minimum: {formatGhs(data.settings.withdrawalMinimumMinor)}.</p>}
      {action&&<form onSubmit={perform} className="rounded-xl border border-slate-700 p-4 space-y-3">
        <h3 className="font-bold">{action==='topup'?'Add Money':action==='transfer'?'Transfer to Mystery Wallet':'Withdraw Earnings'}</h3>
        <label className="block text-sm">Amount (GH₵)<input className={inputClass} inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);setConfirmed(false);}} required/></label>
        {action==='topup'&&<p className="text-sm text-slate-400">0% customer fee. Funding limits: {formatGhs(data.settings.topupMinimumMinor)}–{formatGhs(data.settings.topupMaximumMinor)}. Mobile Money through Paystack.</p>}
        {action==='withdrawal'&&<>
          <label className="block text-sm">MoMo network<select className={inputClass} value={network} onChange={e=>{setNetwork(e.target.value);setConfirmed(false);}}><option value="mtn">MTN</option><option value="telecel">Telecel</option><option value="airteltigo">AirtelTigo</option></select></label>
          <label className="block text-sm">MoMo number<input className={inputClass} value={phone} onChange={e=>{setPhone(e.target.value);setConfirmed(false);}} inputMode="tel" required maxLength={20}/></label>
          <label className="block text-sm">Recipient name<input className={inputClass} value={recipientName} onChange={e=>{setName(e.target.value);setConfirmed(false);}} required maxLength={128}/></label>
          <div className="space-y-1 text-sm break-words"><p>Withdrawal: {formatGhs(minor)}</p><p>Processing fee ({data.settings.withdrawalFeeBps/100}%): {formatGhs(fee)}</p><p>You receive: {formatGhs(minor-fee)}</p><p>Destination: {phone} · {network}</p></div>
        </>}
        {action==='transfer'&&<p className="text-sm text-amber-200">0% fee. Funds transferred to Mystery Wallet can be used for eligible Mystery Hub services and cannot be withdrawn back to Mobile Money. This transfer is irreversible.</p>}
        {action!=='topup'&&<label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm the amount and {action==='transfer'?'irreversible transfer':'payout destination and fee'}.</label>}
        <div className="flex flex-wrap gap-3"><button className={buttonClass} disabled={busy||minor===0||action!=='topup'&&!confirmed}>{busy?'Processing…':'Confirm'}</button><button type="button" className="text-slate-400" onClick={()=>setAction('')} disabled={busy}>Cancel</button></div>
      </form>}
      {mode==='wallet'&&<><h3 className="font-bold">Transaction History</h3>{!data.ledger.length&&<p className="text-sm text-slate-400">No Wallet transactions yet.</p>}{data.ledger.map((row:any)=><div key={row.id} className="flex flex-wrap justify-between gap-2 border-t border-slate-800 pt-3 text-sm"><div><p>{row.description}</p><p className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString()} · Completed</p></div><div className="text-right"><p className={row.delta_minor>0?'text-emerald-300':'text-slate-200'}>{row.delta_minor>0?'+':'−'}{formatGhs(Math.abs(row.delta_minor))}</p><p className="text-xs text-slate-500">Balance {formatGhs(row.balance_after_minor)}</p></div></div>)}
      {data.topups.filter((r:any)=>!['credited','reversed'].includes(r.state)).map((row:any)=><div key={row.id} className="text-sm space-y-2"><p>Funding {formatGhs(row.amountMinor)} · {row.state.replaceAll('_',' ')}</p><button disabled={busy} className="text-[#00c365]" onClick={async()=>{setBusy(true);try{const result=await financeRequest(sessionToken,`/topups/${encodeURIComponent(row.reference)}/verify`,{});setNotice(`Funding: ${result.state}`);await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Verify funding</button></div>)}</>}
      {mode==='earn'&&<><h3 className="font-bold">Withdrawal History</h3>{!data.withdrawals.length&&<p className="text-sm text-slate-400">No withdrawal requests yet.</p>}{data.withdrawals.map((row:any)=><div key={row.id} className="rounded-xl border border-slate-800 p-3 text-sm space-y-1"><p>{formatGhs(row.amount_minor)} · {row.state.replaceAll('_',' ')}</p><p className="text-slate-400">Fee {formatGhs(row.payload.feeMinor)} · Net {formatGhs(row.payload.netMinor)}</p><p>{row.payload.maskedPhone} · {row.payload.network} · {new Date(row.created_at).toLocaleDateString()}</p>{row.payload.rejectionReason&&<p>{row.payload.rejectionReason}</p>}{row.payload.paidAt&&<p>Paid {new Date(row.payload.paidAt).toLocaleDateString()}</p>}</div>)}
      <h3 className="font-bold">Achievements & Rewards</h3><p className="text-sm text-slate-400">Progress uses qualified visitors and verified qualifying referral rewards. Badges carry no cash value unless a Wallet reward is configured.</p><div className="grid sm:grid-cols-2 gap-3">{data.achievements.map((row:any)=><div key={row.id} className="rounded-xl border border-slate-800 p-3 space-y-2 text-sm"><p className="font-semibold">{row.name}</p><p>{Math.min(row.progress,row.threshold)} / {row.threshold} · {row.rewardMinor?`${formatGhs(row.rewardMinor)} Wallet credit`:'Badge'}</p><button className="text-[#00c365] disabled:text-slate-500" disabled={busy||row.claimed||row.progress<row.threshold} onClick={async()=>{setBusy(true);try{await financeRequest(sessionToken,`/achievements/${encodeURIComponent(row.id)}/claim`,{});await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{row.claimed?'Claimed':row.progress>=row.threshold?'Claim Reward':'In progress'}</button></div>)}</div></>}
      <div className="flex gap-4 text-sm"><button disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous</button><button disabled={(mode==='wallet'?data.ledger:data.withdrawals).length<25} onClick={()=>setOffset(offset+25)}>More history</button></div>
    </>}
  </section>;
};
export const WalletPage=()=> <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10"><FinancialPanel mode="wallet"/></div>;
