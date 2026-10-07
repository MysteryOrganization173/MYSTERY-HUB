import React, {useEffect, useRef, useState} from 'react';
import {useApp} from '../../context/AppContext';
import {financeRequest} from '../../services/financeApi';
import {formatGhs} from '../../../shared/money';
import {preferredPaymentMethod} from '../../utils/checkoutPresentation';

export const WalletPaymentChoice: React.FC<{
  amountMinor: number; value: 'paystack' | 'wallet'; onChange: (value: 'paystack' | 'wallet') => void;
}> = ({amountMinor, value, onChange}) => {
  const {sessionToken, setActivePage, closeCheckout} = useApp();
  const [balance, setBalance] = useState<number | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [balanceFailed,setBalanceFailed]=useState(false);
  const touched = useRef(false);
  useEffect(() => {
    let live = true;
    touched.current = false; setBalance(null); setRestricted(false); setBalanceFailed(false);
    if (sessionToken) financeRequest(sessionToken).then(data => {
      if (live) { setBalance(data.walletMinor); setRestricted(data.restricted); }
    }).catch(() => {if(live)setBalanceFailed(true);});
    return () => { live = false; };
  }, [sessionToken]);
  const preferred = preferredPaymentMethod(Boolean(sessionToken), balance, amountMinor, restricted);
  useEffect(() => {
    if (!touched.current || value === 'wallet' && preferred !== 'wallet') onChange(preferred);
  }, [preferred, value, onChange]);
  if (!sessionToken) return null;
  const choose = (next: 'wallet' | 'paystack') => { touched.current = true; onChange(next); };
  return <fieldset className="space-y-2 text-sm">
    <legend className="mb-1 text-xs font-semibold text-slate-300">Pay with</legend>
    <div className="grid grid-cols-2 gap-2">
      <label className={`flex items-center gap-2 min-h-14 rounded-xl px-2.5 py-2 border ${value==='wallet'?'border-emerald-500/60 bg-emerald-500/10':'border-slate-700 bg-slate-900/40'}`}>
        <input className="shrink-0 accent-emerald-400" type="radio" name="payment-method" checked={value==='wallet'} disabled={preferred!=='wallet'} onChange={()=>choose('wallet')}/>
        <span className="min-w-0 text-xs font-semibold">Mystery Wallet<span className="block text-[11px] font-normal text-slate-400">{balance===null?balanceFailed?'Balance unavailable':'Checking balance…':formatGhs(balance)+' available'}</span></span>
      </label>
      <label className={`flex items-center gap-2 min-h-14 rounded-xl px-2.5 py-2 border ${value==='paystack'?'border-emerald-500/60 bg-emerald-500/10':'border-slate-700 bg-slate-900/40'}`}>
        <input className="shrink-0 accent-emerald-400" type="radio" name="payment-method" checked={value==='paystack'} onChange={()=>choose('paystack')}/>
        <span className="min-w-0 text-xs font-semibold">Mobile Money<span className="block text-[11px] font-normal text-slate-400">Secure checkout</span></span>
      </label>
    </div>
    {balance!==null&&Number.isFinite(amountMinor)&&amountMinor>0&&preferred!=='wallet'&&<div className="flex items-center justify-between gap-2 text-xs text-slate-400"><span>{restricted?'Wallet payments are temporarily unavailable.':`Short by ${formatGhs(Math.max(0,amountMinor-balance))}.`}</span><button type="button" className="shrink-0 min-h-11 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 text-emerald-300 font-semibold" onClick={()=>{closeCheckout();setActivePage('wallet');}}>Top Up</button></div>}
  </fieldset>;
};
