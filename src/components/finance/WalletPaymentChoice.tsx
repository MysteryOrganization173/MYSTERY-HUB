import React,{useState,useEffect} from 'react';
import {useApp} from '../../context/AppContext';
import {financeRequest} from '../../services/financeApi';
import {formatGhs} from '../../../shared/money';
export const WalletPaymentChoice:React.FC<{amountMinor:number;value:'paystack'|'wallet';onChange:(value:'paystack'|'wallet')=>void}>=({amountMinor,value,onChange})=>{
  const {sessionToken,setActivePage,closeCheckout}=useApp();const [balance,setBalance]=useState<number|null>(null),[restricted,setRestricted]=useState(false);
  useEffect(()=>{let live=true;setBalance(null);setRestricted(false);if(sessionToken)financeRequest(sessionToken).then(data=>{if(live){setBalance(data.walletMinor);setRestricted(data.restricted);}}).catch(()=>{});return()=>{live=false;};},[sessionToken]);
  if(!sessionToken)return null;
  const sufficient=balance!==null&&balance>=amountMinor&&!restricted;
  return <fieldset className="rounded-xl border border-slate-700 p-3 text-sm space-y-3"><legend className="px-1 text-slate-300">Payment method</legend>
    <label className="flex gap-2"><input type="radio" name="payment-method" checked={value==='paystack'} onChange={()=>onChange('paystack')}/>Paystack · existing external payment methods</label>
    <label className="flex gap-2"><input type="radio" name="payment-method" checked={value==='wallet'} disabled={!sufficient} onChange={()=>onChange('wallet')}/>Mystery Wallet · {balance===null?'Balance unavailable':`Balance ${formatGhs(balance)}`} {sufficient?'· Pay instantly':''}</label>
    {balance!==null&&!sufficient&&<p className="text-slate-400">{restricted?'Wallet needs reconciliation.':`You need ${formatGhs(Math.max(0,amountMinor-balance))} more. No split payments.`} <button type="button" className="text-[#00c365]" onClick={()=>{closeCheckout();setActivePage('wallet');}}>Add Money</button> or use Paystack.</p>}
  </fieldset>;
};
