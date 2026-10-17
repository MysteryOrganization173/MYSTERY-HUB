import React,{useState,useEffect,useRef} from 'react';
import {financeRequest} from '../../../services/financeApi';
import {DATA_MARGIN_POLICY} from '../../../../shared/dataReferralPolicy';
import {formatGhs,parseGhs} from '../../../../shared/money';
import {AdminButton,AdminEmpty,AdminError,AdminLoading,AdminNotice,AdminPageHeader,AdminPanel,AdminStat,AdminTabs,ConfirmAction,DefinitionList,Freshness,RefreshButton,StatusPill,adminField as field,adminLabel,type AdminTone,type ConfirmField} from '../ui/AdminUi';

type FinanceView='summary'|'requests'|'customers'|'settings';
const VIEWS:FinanceView[]=['summary','requests','customers','settings'];

/** Human meaning of every server metric. Grouped so obligations are never read as income. */
const METRIC_GROUPS:Array<{title:string;description:string;tone:AdminTone;items:Array<[string,string,string]>}>=[
 {title:'What Mystery Hub currently owes customers',description:'Balances customers can spend or withdraw. These are obligations, not revenue.',tone:'warning',items:[
  ['walletLiabilityMinor','Customer wallet balances','Sum of every Mystery Wallet balance.'],
  ['availableEarnLiabilityMinor','Mystery Earn available to withdraw','Approved rewards not yet withdrawn, reserved or moved to a wallet.'],
  ['storeEarningsLiabilityMinor','Store earnings available','Positive seller balances from the Store Earnings ledger, excluding reservations.'],
  ['earnReconciliationShortfallMinor','Earn reversal shortfall','Separate reconciliation exposure. Never deducted from another customer’s available balance.'],
  ['storeReconciliationShortfallMinor','Store reconciliation shortfall','Negative seller balances requiring review. Separate from positive liabilities.'],
  ['reservedWithdrawalsMinor','Reserved by open withdrawal requests','Waiting for review or approved and not yet marked paid.'],
 ]},
 {title:'Wallet money movement (all time)',description:'Ledger totals recorded by Mystery Hub.',tone:'neutral',items:[
  ['walletDepositsMinor','Wallet top-ups credited','Includes top-ups that were later reversed or are under reversal review.'],
  ['walletSpendingMinor','Spent from wallets','Purchases paid with Mystery Wallet.'],
  ['walletRefundsMinor','Refunded to wallets','Failed wallet purchases returned to the wallet.'],
  ['paidWithdrawalsMinor','Withdrawals paid out (net)','Amounts marked as sent by MoMo, after fees.'],
  ['withdrawalFeesMinor','Withdrawal fees kept','Fees on withdrawals marked paid.'],
 ]},
 {title:'Rewards (all time)',description:'Mystery Earn and achievement credits.',tone:'neutral',items:[
  ['referralCreditsMinor','Referral rewards approved','Approved, unreversed referral rewards.'],
  ['earnTransfersMinor','Earn moved into wallets','Customers who moved earnings into their wallet.'],
  ['achievementCreditsMinor','Achievement rewards credited','Monetary achievement claims.'],
  ['rewardReversalsMinor','Rewards reversed','Reversals of previously approved rewards.'],
 ]},
];
const knownMetrics=new Set(METRIC_GROUPS.flatMap(group=>group.items.map(([key])=>key)));
const humanise=(key:string)=>key.replace(/Minor$/,'').replace(/([A-Z])/g,' $1').replace(/^./,letter=>letter.toUpperCase());

const WITHDRAWAL_STATES:Record<string,{label:string;tone:AdminTone}>={pending_review:{label:'Waiting for review',tone:'warning'},approved:{label:'Approved · pay manually',tone:'info'},paid:{label:'Paid',tone:'success'},rejected:{label:'Rejected · released',tone:'neutral'}};
const REQUEST_FILTERS=[{id:'open',label:'Needs action'},{id:'paid',label:'Paid'},{id:'rejected',label:'Rejected'},{id:'all',label:'All'}] as const;
type RequestFilter=typeof REQUEST_FILTERS[number]['id'];

interface PendingConfirm{title:string;summary?:React.ReactNode;warning?:React.ReactNode;fields?:ConfirmField[];typedWord?:string;acknowledgement?:string;confirmLabel:string;tone?:'primary'|'danger';run:(values:Record<string,string>)=>Promise<boolean>}

export const AdminFinanceSection:React.FC<{sessionToken:string;initialView?:string;onOpenCustomer?:(id:string)=>void;onChanged?:()=>void}>=({sessionToken,initialView,onOpenCustomer,onChanged})=>{
 const [view,setView]=useState<FinanceView>(VIEWS.includes(initialView as FinanceView)?initialView as FinanceView:'summary');
 const [control,setControl]=useState<any>(null),[queue,setQueue]=useState<any[]>([]),[operations,setOperations]=useState<any[]>([]),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[busy,setBusy]=useState(false),[loadedAt,setLoadedAt]=useState<number|null>(null),[customerId,setCustomerId]=useState(''),[customer,setCustomer]=useState<any>(null);
 const [amount,setAmount]=useState(''),[reason,setReason]=useState(''),[direction,setDirection]=useState('credit'),[settings,setSettings]=useState<any>(null),[policy,setPolicy]=useState<any>({service:'data',enabled:false,mode:'fixed',marginBps:0,reserveMinor:0,reserveBps:0,supplierCostMinor:null,acquisitionBps:DATA_MARGIN_POLICY.acquisitionBps,recurringBps:DATA_MARGIN_POLICY.recurringBps,reserveConfigured:false}),[definitions,setDefinitions]=useState<any[]>([]);
 const [queueOffset,setQueueOffset]=useState(0),[operationsOffset,setOperationsOffset]=useState(0),[customerOffset,setCustomerOffset]=useState(0);
 const [requestFilter,setRequestFilter]=useState<RequestFilter>('open');
 const [pending,setPending]=useState<PendingConfirm|null>(null),[confirmError,setConfirmError]=useState<string|null>(null);
 const customerRequest=useRef(0);
 const adjustmentRequest=useRef<{fingerprint:string;id:string}|null>(null);
 const load=async()=>{setLoadError('');try{const [c,q,o]=await Promise.all([financeRequest(sessionToken,'/control',undefined,true),financeRequest(sessionToken,`/withdrawals?offset=${queueOffset}`,undefined,true),financeRequest(sessionToken,`/operations?offset=${operationsOffset}`,undefined,true)]);setControl(c);setPolicy((current:any)=>({...current,...c.economics.find((x:any)=>x.service===current.service)}));setSettings(c.settings);setDefinitions(c.definitions);setQueue(q);setOperations(o);setLoadedAt(Date.now());}catch(e){setLoadError((e as Error).message);}};
 useEffect(()=>{void load();},[sessionToken,queueOffset,operationsOffset]);
 const loadCustomer=async(id:string,offset:number)=>{const ticket=++customerRequest.current;try{const result=await financeRequest(sessionToken,`/customers/${encodeURIComponent(id)}?offset=${offset}`,undefined,true);if(ticket===customerRequest.current){setCustomer(result);setError('');}}catch(e){if(ticket===customerRequest.current)setError((e as Error).message);}};
 /** Every write goes through the existing finance endpoints, which re-check auth, state and confirmation. */
 const mutate=async(path:string,body:any)=>{if(busy)return false;setBusy(true);setError('');setConfirmError(null);try{await financeRequest(sessionToken,path,body,true);await load();if(customerId&&customer)await loadCustomer(customerId,customerOffset);onChanged?.();return true;}catch(e){const message=(e as Error).message;setError(message);setConfirmError(message);return false;}finally{setBusy(false);}};
 const ask=(next:PendingConfirm)=>{setConfirmError(null);setPending(next);};
 const confirmPending=async(values:Record<string,string>)=>{if(!pending)return;const ok=await pending.run(values);if(ok)setPending(null);};

 const withdrawalSummary=(row:any)=><DefinitionList items={[['Customer',row.customer_name||row.user_id],['Requested',formatGhs(row.amount_minor)],[`Fee (${row.payload.feeBps/100}%)`,formatGhs(row.payload.feeMinor)],['Send by MoMo',<strong key="net" className="text-white">{formatGhs(row.payload.netMinor)}</strong>],['Recipient',`${row.payload.recipientName} · ${row.payload.network}`],['Phone',<span key="phone" className="font-mono">{row.payload.phone}</span>]]}/>;
 const act=(row:any,action:'approve'|'reject'|'paid')=>{
  const path=`/withdrawals/${encodeURIComponent(row.id)}`,base={action,expectedState:row.state,confirmed:true};
  if(action==='approve')ask({title:'Approve withdrawal request',summary:withdrawalSummary(row),warning:'Approving does not send money. It only marks the request as approved. Send the MoMo transfer yourself, then use "Mark as paid" with the transfer reference.',typedWord:'APPROVE',confirmLabel:'Approve request',run:()=>mutate(path,base)});
  if(action==='reject')ask({title:'Reject withdrawal request',summary:withdrawalSummary(row),warning:'Rejecting releases the reserved amount back to the customer’s available balance.',fields:[{key:'reason',label:'Reason the customer can understand',multiline:true,maxLength:160,minLength:3}],confirmLabel:'Reject request',tone:'danger',run:values=>mutate(path,{...base,reason:values.reason})});
  if(action==='paid')ask({title:'Record manual payout',summary:withdrawalSummary(row),fields:[{key:'reference',label:'MoMo transaction reference',maxLength:100,minLength:3,help:'Copy it from the MoMo confirmation message so the payout can be traced.'}],acknowledgement:`I have already sent ${formatGhs(row.payload.netMinor)} to ${row.payload.phone} and the transfer succeeded.`,confirmLabel:'Mark as paid',run:values=>mutate(path,{...base,reference:values.reference})});
 };
 const openCustomerHistory=(id:string)=>{setCustomerId(id);setCustomer(null);setCustomerOffset(0);setView('customers');void loadCustomer(id,0);};

 const openRequests=queue.filter(row=>['pending_review','approved'].includes(row.state));
 const visibleRequests=queue.filter(row=>requestFilter==='all'||(requestFilter==='open'?['pending_review','approved'].includes(row.state):row.state===requestFilter));
 const fundingRows=operations.filter(row=>row.kind==='topup'||row.state==='manual_review');
 const fundingActionable=fundingRows.filter(row=>(row.kind==='review'&&row.state==='manual_review'&&row.payload.rewardId)||(row.kind==='topup'&&['pending','initializing','initialization_uncertain','failed','reversal_review'].includes(row.state))).length;

 if(!control&&loadError)return <section className="min-w-0 space-y-5 text-slate-100"><AdminPageHeader title="Financial Control Room"/><AdminError message={loadError} onRetry={()=>void load()}/></section>;
 if(!control)return <section className="min-w-0 space-y-5 text-slate-100"><AdminPageHeader title="Financial Control Room"/><AdminLoading label="Loading wallet and earnings records…"/></section>;

 return <section className="min-w-0 space-y-5 text-slate-100">
  <AdminPageHeader title="Financial Control Room" description="Customer wallets, Mystery Earn, manual withdrawals and reward settings. Nothing on this page sends money by itself." actions={<><Freshness at={loadedAt}/><RefreshButton busy={busy} onClick={()=>void load()}/></>}/>
  <AdminTabs label="Finance views" value={view} onChange={setView} tabs={[{id:'summary',label:'Summary'},{id:'requests',label:'Requests',count:openRequests.length+fundingActionable||null,tone:openRequests.length?'warning':'neutral'},{id:'customers',label:'Customer history'},{id:'settings',label:'Settings'}]}/>
  {loadError&&<AdminNotice tone="warning" title="Showing the last loaded figures">{loadError}</AdminNotice>}
  {error&&!pending&&<p role="alert" className="break-words text-sm text-amber-300">{error}</p>}

  {view==='summary'&&<div className="space-y-5">
   {openRequests.length>0&&<AdminNotice tone="warning" title={`${openRequests.length} withdrawal request${openRequests.length===1?'':'s'} need action`} action={<AdminButton onClick={()=>setView('requests')}>Review requests</AdminButton>}>Approve or reject, then pay approved requests manually by MoMo and record the reference.</AdminNotice>}
   {METRIC_GROUPS.map(group=><AdminPanel key={group.title} title={group.title} description={group.description}>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.items.filter(([key])=>key in control.metrics).map(([key,label,hint])=><AdminStat key={key} label={label} value={formatGhs(Number(control.metrics[key]))} hint={hint} tone={group.tone==='warning'&&Number(control.metrics[key])>0?'warning':'neutral'}/>)}</div>
   </AdminPanel>)}
   {Object.keys(control.metrics).some(key=>!knownMetrics.has(key))&&<AdminPanel title="Other recorded totals"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(control.metrics).filter(([key])=>!knownMetrics.has(key)).map(([key,value])=><AdminStat key={key} label={humanise(key)} value={formatGhs(Number(value))}/>)}</div></AdminPanel>}
   <p className="text-xs text-slate-500">These are Mystery Hub ledger totals. They are not bank or MoMo balances, and they do not include order revenue (see Overview for customer payments).</p>
  </div>}

  {view==='requests'&&<div className="space-y-5">
   <AdminPanel title="Withdrawal requests" description="Full MoMo destination is shown only here, for manual payout. Approval does not send money." actions={<div role="group" aria-label="Filter withdrawal requests" className="flex flex-wrap gap-1.5">{REQUEST_FILTERS.map(f=><button key={f.id} type="button" aria-pressed={requestFilter===f.id} onClick={()=>setRequestFilter(f.id)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${requestFilter===f.id?'border-[#00c365]/60 bg-[#00c365]/10 text-[#7dffbf]':'border-slate-700 text-slate-300 hover:border-slate-500'}`}>{f.label}</button>)}</div>}>
    {!visibleRequests.length?<AdminEmpty title={requestFilter==='open'?'No withdrawal requests need action':'No requests in this view'}>{queueOffset?'This is a later page of requests.':'New requests appear here as customers withdraw Mystery Earn or store earnings.'}</AdminEmpty>:
    <div className="space-y-3">{visibleRequests.map(row=>{const state=WITHDRAWAL_STATES[row.state]||{label:row.state.replaceAll('_',' '),tone:'neutral' as AdminTone};return <article key={row.id} className="min-w-0 space-y-3 rounded-2xl border border-slate-800 bg-[#0b1116] p-4 text-sm">
     <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words font-semibold text-white">{row.customer_name||row.user_id}</p><p className="text-xs text-slate-400">{row.source==='store'?'Store earnings':'Mystery Earn'} · requested {new Date(row.created_at).toLocaleString()}</p></div><StatusPill tone={state.tone}>{state.label}</StatusPill></div>
     <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-900/60 p-3"><div><p className="text-xs text-slate-400">Requested</p><p className="font-semibold">{formatGhs(row.amount_minor)}</p></div><div><p className="text-xs text-slate-400">Fee {row.payload.feeBps/100}%</p><p className="font-semibold">{formatGhs(row.payload.feeMinor)}</p></div><div><p className="text-xs text-slate-400">Send</p><p className="font-semibold text-[#7dffbf]">{formatGhs(row.payload.netMinor)}</p></div></div>
     <p className="break-words">{row.payload.recipientName} · {row.payload.network} · <span className="font-mono">{row.payload.phone}</span></p>
     <p className="text-xs text-slate-400">Prior requests {row.priorWithdrawals} · Available {row.source==='store'?'store earnings':'Mystery Earn'} {formatGhs(row.earn.availableMinor)}{row.payload.payoutReference?` · MoMo ref ${row.payload.payoutReference}`:''}{row.payload.rejectionReason?` · Reason: ${row.payload.rejectionReason}`:''}</p>
     {(row.earn.reconciliationRequired||row.restricted)&&<AdminNotice tone="danger" title="Review required">This account is restricted or its earnings need reconciliation. The server will refuse approval or payout until that is cleared.</AdminNotice>}
     <div className="flex flex-wrap gap-2">
      {row.state==='pending_review'&&<AdminButton variant="primary" disabled={busy} onClick={()=>act(row,'approve')}>Approve</AdminButton>}
      {row.state==='approved'&&<AdminButton variant="primary" disabled={busy} onClick={()=>act(row,'paid')}>Mark as Paid</AdminButton>}
      {['pending_review','approved'].includes(row.state)&&<AdminButton variant="danger" disabled={busy} onClick={()=>act(row,'reject')}>Reject</AdminButton>}
      <AdminButton variant="ghost" onClick={()=>openCustomerHistory(row.user_id)}>Finance history</AdminButton>
      {onOpenCustomer&&<AdminButton variant="ghost" onClick={()=>onOpenCustomer(row.user_id)}>Customer profile</AdminButton>}
     </div>
    </article>;})}</div>}
    <div className="mt-4 flex flex-wrap gap-2"><AdminButton disabled={busy||!queueOffset} onClick={()=>setQueueOffset(Math.max(0,queueOffset-50))}>Previous withdrawals</AdminButton><AdminButton disabled={busy||queue.length<50} onClick={()=>setQueueOffset(queueOffset+50)}>More withdrawals</AdminButton></div>
   </AdminPanel>

   <AdminPanel title="Wallet funding & review" description="Top-ups that did not complete cleanly and reversed rewards waiting for reconciliation. Verification asks Paystack directly and credits at most once.">
    {!fundingRows.length?<AdminEmpty title="Nothing to review">Uncertain top-ups and reward reversals appear here.</AdminEmpty>:<div className="space-y-2">{fundingRows.map(row=><div key={row.id} className="min-w-0 space-y-2 rounded-xl border border-slate-800 p-3 text-sm">
     <div className="flex flex-wrap items-center justify-between gap-2"><p className="break-words">{row.kind==='topup'?'Wallet top-up':'Reward review'} · {formatGhs(row.amount_minor)} · <span className="text-slate-400">{row.state.replaceAll('_',' ')}</span></p><p className="text-xs text-slate-500">{row.created_at?new Date(row.created_at).toLocaleString():''}</p></div>
     <p className="break-all text-xs text-slate-500">Customer {row.user_id}</p>
     <div className="flex flex-wrap gap-2">
      {row.kind==='review'&&row.state==='manual_review'&&row.payload.rewardId&&<AdminButton disabled={busy} onClick={()=>ask({title:'Reconcile reversed reward',warning:'Resolve only if the customer’s available Earn covers the entire reward. This reverses the original reward.',fields:[{key:'reason',label:'Reason',multiline:true,maxLength:160}],confirmLabel:'Reconcile reward',run:values=>mutate(`/reviews/${encodeURIComponent(row.id)}/reconcile`,{confirmed:true,reason:values.reason})})}>Reconcile recovered Earn reward</AdminButton>}
      {row.kind==='topup'&&['pending','initializing','initialization_uncertain','failed'].includes(row.state)&&<AdminButton disabled={busy} onClick={()=>ask({title:'Verify wallet funding',summary:`Ask Paystack whether ${formatGhs(row.amount_minor)} was paid for this top-up. The wallet is credited once, only if Paystack confirms the exact amount, reference and customer.`,confirmLabel:'Verify with Paystack',run:()=>mutate(`/topups/${encodeURIComponent(row.id)}/verify`,{confirmed:true})})}>Verify funding</AdminButton>}
      {['credited','reversal_review'].includes(row.state)&&<AdminButton variant="danger" disabled={busy} onClick={()=>ask({title:'Reconcile external reversal',summary:`Remove ${formatGhs(row.amount_minor)} from this wallet because the payment was reversed outside Mystery Hub.`,warning:'Check the reversal in the Paystack dashboard first. This debits the customer wallet.',fields:[{key:'reason',label:'Reason and evidence of the reversal',multiline:true,maxLength:160}],confirmLabel:'Reconcile reversal',tone:'danger',run:values=>mutate(`/topups/${encodeURIComponent(row.id)}/reversal`,{reason:values.reason,confirmed:true})})}>Reconcile verified external reversal</AdminButton>}
     </div>
    </div>)}</div>}
    <div className="mt-4 flex flex-wrap gap-2"><AdminButton disabled={busy||!operationsOffset} onClick={()=>setOperationsOffset(Math.max(0,operationsOffset-50))}>Previous financial records</AdminButton><AdminButton disabled={busy||operations.length<50} onClick={()=>setOperationsOffset(operationsOffset+50)}>More financial records</AdminButton></div>
   </AdminPanel>
  </div>}

  {view==='customers'&&<AdminPanel title="Customer finance history" description="Wallet, Earn and withdrawal records for one customer. Paste a customer ID, or open it from a withdrawal request or the Customers page.">
   <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={e=>{e.preventDefault();if(customerId.trim()){setCustomerOffset(0);void loadCustomer(customerId.trim(),0);}}}><label className={`${adminLabel} flex-1`}><span>Customer ID</span><input className={field} value={customerId} autoComplete="off" onChange={e=>{customerRequest.current++;setCustomerId(e.target.value);setCustomer(null);setCustomerOffset(0);}}/></label><AdminButton variant="primary" type="submit" disabled={!customerId.trim()}>Inspect</AdminButton></form>
   {customer&&<div className="mt-4 space-y-4">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><AdminStat label="Wallet balance" value={formatGhs(customer.walletMinor)}/><AdminStat label="Mystery Earn available" value={formatGhs(customer.earn.availableMinor)}/><AdminStat label="Reserved for withdrawals" value={formatGhs(customer.earn.reservedMinor)} tone={customer.restricted?'danger':'neutral'} hint={customer.restricted?'Account restricted':undefined}/></div>
    <div className="grid gap-4 lg:grid-cols-3">
     <HistoryList title="Wallet ledger" rows={customer.ledger} render={(row:any)=><><span className="min-w-0 break-words">{row.description}</span><span className={row.delta_minor<0?'text-rose-300':'text-emerald-300'}>{formatGhs(row.delta_minor)}</span><span className="col-span-2 text-slate-500">{new Date(row.created_at).toLocaleString()}</span></>}/>
     <HistoryList title="Earn Ledger" rows={customer.earnLedger||[]} render={(row:any)=><><span className="min-w-0 break-words">{row.service_type} · {row.status}</span><span>{formatGhs(row.amount_minor)}</span><span className="col-span-2 text-slate-500">{new Date(row.created_at).toLocaleString()}</span></>}/>
     <HistoryList title="Withdrawals" rows={customer.withdrawals} render={(row:any)=><><span className="min-w-0 break-words">{(WITHDRAWAL_STATES[row.state]?.label)||row.state} · {row.payload.maskedPhone}</span><span>{formatGhs(row.amount_minor)}</span></>}/>
    </div>
    <div className="flex flex-wrap gap-2"><AdminButton disabled={busy||!customerOffset} onClick={()=>{const offset=Math.max(0,customerOffset-25);setCustomerOffset(offset);void loadCustomer(customerId,offset);}}>Previous customer history</AdminButton><AdminButton disabled={busy||customer.ledger.length<25&&customer.withdrawals.length<25} onClick={()=>{const offset=customerOffset+25;setCustomerOffset(offset);void loadCustomer(customerId,offset);}}>More customer history</AdminButton>{onOpenCustomer&&<AdminButton variant="ghost" onClick={()=>onOpenCustomer(customerId)}>Open customer profile</AdminButton>}</div>
    <div className="space-y-3 rounded-2xl border border-slate-800 p-4">
     <div><h3 className="font-semibold text-white">Audited wallet adjustment</h3><p className="text-xs text-slate-400">Credits or debits this customer’s Mystery Wallet with a recorded reason. It does not move money in MoMo or Paystack.</p></div>
     <div className="grid gap-3 sm:grid-cols-3"><label className={adminLabel}><span>Adjustment</span><select className={field} value={direction} onChange={e=>setDirection(e.target.value)}><option value="credit">Credit Wallet</option><option value="debit">Debit Wallet</option></select></label><label className={adminLabel}><span>Amount (GH₵)</span><input className={field} value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal"/></label><label className={adminLabel}><span>Reason</span><input className={field} value={reason} onChange={e=>setReason(e.target.value)} maxLength={160}/></label></div>
     <AdminButton variant={direction==='debit'?'danger':'primary'} disabled={busy||!reason.trim()||!amount} onClick={()=>{try{const amountMinor=parseGhs(amount),fingerprint=JSON.stringify({customerId,amountMinor,reason,direction});if(adjustmentRequest.current?.fingerprint!==fingerprint)adjustmentRequest.current={fingerprint,id:crypto.randomUUID()};const requestId=adjustmentRequest.current.id;ask({title:direction==='credit'?'Credit customer wallet':'Debit customer wallet',summary:<DefinitionList items={[['Customer',customerId],['Change',`${direction==='credit'?'+':'−'}${formatGhs(amountMinor)}`],['Current wallet',formatGhs(customer.walletMinor)],['Reason',reason]]}/>,warning:'This is recorded in the audit log with your admin account.',confirmLabel:'Confirm Adjustment',tone:direction==='debit'?'danger':'primary',run:async()=>{const ok=await mutate(`/customers/${encodeURIComponent(customerId)}/adjustment`,{amountMinor,reason,direction,requestId,confirmed:true});if(ok){adjustmentRequest.current=null;setAmount('');setReason('');}return ok;}});}catch(e){setError((e as Error).message);}}}>Review adjustment</AdminButton>
    </div>
   </div>}
  </AdminPanel>}

  {view==='settings'&&<div className="space-y-5">
   <AdminNotice tone="info">Settings apply to future requests and qualifications only. Existing requests and claimed rewards keep the values they were created with.</AdminNotice>
   {settings&&<form onSubmit={e=>{e.preventDefault();ask({title:'Save financial settings',summary:'Apply these limits and fees to future withdrawal and top-up requests?',confirmLabel:'Save Settings',run:()=>mutate('/settings',{...settings,confirmed:true})});}}><AdminPanel title="Financial Settings" description="Withdrawal and wallet top-up limits." actions={<AdminButton type="submit" variant="primary" disabled={busy}>Save Settings</AdminButton>}><div className="grid gap-3 sm:grid-cols-2">{[['withdrawalMinimumMinor','Minimum withdrawal (GH₵)'],['withdrawalFeeBps','Withdrawal fee (%)'],['topupMinimumMinor','Minimum Wallet top-up (GH₵)'],['topupMaximumMinor','Maximum Wallet top-up (GH₵)']].map(([key,label])=><label key={key} className={adminLabel}><span>{label}</span><input className={field} type="number" min="0" step="0.01" value={settings[key]/100} onChange={e=>setSettings({...settings,[key]:Math.round(Number(e.target.value)*100)})}/></label>)}</div></AdminPanel></form>}
   <form onSubmit={e=>{e.preventDefault();ask({title:'Save reward economics',summary:`Save the ${policy.service} reward economics for future qualifications?`,confirmLabel:'Save Economics',run:()=>mutate('/reward-economics',{...policy,confirmed:true})});}}><AdminPanel title="Referral Reward Settings" description="Existing referral rule amounts and first/recurring stages remain in Mystery Earn controls. Choose a service policy to calculate or cap rewards using its contribution. AFA requires its own enabled policy and reward rule." actions={<AdminButton type="submit" variant="primary" disabled={busy}>Save Economics</AdminButton>}>
    <div className="grid gap-3 sm:grid-cols-2"><label className={adminLabel}><span>Service</span><select className={field} value={policy.service} onChange={e=>{const saved=control?.economics.find((x:any)=>x.service===e.target.value);setPolicy({service:e.target.value,enabled:false,mode:'fixed',marginBps:0,reserveMinor:0,reserveBps:0,supplierCostMinor:null,acquisitionBps:DATA_MARGIN_POLICY.acquisitionBps,recurringBps:DATA_MARGIN_POLICY.recurringBps,reserveConfigured:false,...saved});}}>{['data','airtime','afa'].map(s=><option key={s} value={s}>{s==='afa'?'AFA':s[0].toUpperCase()+s.slice(1)}</option>)}</select></label><label className={adminLabel}><span>Calculation</span><select className={field} value={policy.mode} onChange={e=>setPolicy({...policy,mode:e.target.value})}><option value="fixed">Existing fixed rule, capped to margin</option><option value="margin_percent">Percentage of rewardable margin</option>{policy.service==='data'&&<option value={DATA_MARGIN_POLICY.mode}>Data: first normal margin / recurring actual margin</option>}</select></label>
    {policy.mode===DATA_MARGIN_POLICY.mode&&<><p className="text-sm text-slate-300 sm:col-span-2">First qualifying Data purchase: {policy.acquisitionBps/100}% of normal contribution before Welcome discount. Recurring: {policy.recurringBps/100}% of actual contribution.</p>{[['acquisitionBps','First qualifying reward (%)'],['recurringBps','Recurring reward (%)']].map(([key,label])=><label key={key} className={adminLabel}><span>{label}</span><input className={field} type="number" min="0" max="100" step="0.01" value={policy[key]/100} onChange={e=>setPolicy({...policy,[key]:Math.round(Number(e.target.value)*100)})}/></label>)}<label className="flex min-h-11 items-start gap-3 text-sm text-slate-300 sm:col-span-2"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#00c365]" checked={policy.reserveConfigured} onChange={e=>setPolicy({...policy,reserveConfigured:e.target.checked})}/><span>Confirm this fallback reserve is explicitly approved (including deliberate zero).</span></label><p className="text-xs text-slate-400 sm:col-span-2">Commercial direct reserve takes precedence. If neither reserve is configured, dynamic rewards fail closed; purchases remain available.</p></>}
    {[['marginBps','Rewardable margin share (%)'],['reserveMinor','Fixed processing reserve (GH₵)'],['reserveBps','Processing reserve (%)']].map(([key,label])=><label key={key} className={adminLabel}><span>{label}</span><input type="number" min="0" step="0.01" className={field} value={policy[key]/100} onChange={e=>setPolicy({...policy,[key]:Math.round(Number(e.target.value)*100)})}/></label>)}
    {policy.service==='afa'&&<label className={adminLabel}><span>Verified AFA supplier cost (GH₵; leave blank if unknown)</span><input className={field} type="number" min="0" step="0.01" value={policy.supplierCostMinor==null?'':policy.supplierCostMinor/100} onChange={e=>setPolicy({...policy,supplierCostMinor:e.target.value===''?null:Math.round(Number(e.target.value)*100)})}/></label>}</div>
    <label className="mt-3 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#00c365]" checked={policy.enabled} onChange={e=>setPolicy({...policy,enabled:e.target.checked})}/>Enable margin policy for this service</label>
   </AdminPanel></form>
   <AdminPanel title="Achievement Configuration" description="Unconfigured monetary rewards are badges. Claims preserve their original reward snapshot." actions={<AdminButton variant="primary" disabled={busy} onClick={()=>ask({title:'Save achievements',summary:'Save achievement thresholds and rewards for future claims?',confirmLabel:'Save Achievements',run:()=>mutate('/achievements',{definitions,confirmed:true})})}>Save Achievements</AdminButton>}>
    <div className="space-y-3">{definitions.map((d,index)=><div key={d.id} className="grid gap-3 rounded-xl border border-slate-800 p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end"><div><p className="text-sm font-semibold text-white">{d.name}</p><p className="text-xs text-slate-400">{d.metric.replaceAll('_',' ')}</p></div><label className={adminLabel}><span>Threshold</span><input className={field} type="number" value={d.threshold} onChange={e=>setDefinitions(definitions.map((x,n)=>n===index?{...x,threshold:Number(e.target.value)}:x))}/></label><label className={adminLabel}><span>Wallet reward (GH₵)</span><input className={field} type="number" min="0" step="0.01" value={d.rewardMinor/100} onChange={e=>setDefinitions(definitions.map((x,n)=>n===index?{...x,rewardMinor:Math.round(Number(e.target.value)*100)}:x))}/></label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#00c365]" checked={d.enabled} onChange={e=>setDefinitions(definitions.map((x,n)=>n===index?{...x,enabled:e.target.checked}:x))}/>Enabled</label></div>)}</div>
   </AdminPanel>
  </div>}

  {pending&&<ConfirmAction key={pending.title+pending.confirmLabel} title={pending.title} summary={pending.summary} warning={pending.warning} fields={pending.fields} typedWord={pending.typedWord} acknowledgement={pending.acknowledgement} confirmLabel={pending.confirmLabel} tone={pending.tone} busy={busy} error={confirmError} onConfirm={values=>void confirmPending(values)} onClose={()=>{if(!busy){setPending(null);setConfirmError(null);}}}/>}
 </section>;
};

function HistoryList({title,rows,render}:{title:string;rows:any[];render:(row:any)=>React.ReactNode}){
 return <div className="min-w-0 rounded-2xl border border-slate-800 p-3"><h3 className="mb-2 text-sm font-semibold text-white">{title}</h3>{!rows.length?<p className="text-xs text-slate-500">No records on this page.</p>:<ul className="space-y-2 text-xs">{rows.map(row=><li key={row.id} className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 border-b border-slate-800/70 pb-2 last:border-0">{render(row)}</li>)}</ul>}</div>;
}
