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
    <legend className="mb-2 text-slate-300">Pay with</legend>
    <div className="grid sm:grid-cols-2 gap-2">
      <label className={`flex items-center gap-3 min-h-14 rounded-xl px-3 py-3 border ${value==='wallet'?'border-emerald-500/60 bg-emerald-500/10':'border-slate-700 bg-slate-900/40'}`}>
        <input type="radio" name="payment-method" checked={value==='wallet'} disabled={preferred!=='wallet'} onChange={()=>choose('wallet')}/>
        <span>Mystery Wallet<span className="block text-xs text-slate-400">{balance===null?balanceFailed?'Balance unavailable · use Mobile Money':'Checking balance…':formatGhs(balance)+' available'}</span></span>
      </label>
      <label className={`flex items-center gap-3 min-h-14 rounded-xl px-3 py-3 border ${value==='paystack'?'border-emerald-500/60 bg-emerald-500/10':'border-slate-700 bg-slate-900/40'}`}>
        <input type="radio" name="payment-method" checked={value==='paystack'} onChange={()=>choose('paystack')}/>
        <span>Mobile Money<span className="block text-xs text-slate-400">Or card at secure checkout</span></span>
      </label>
    </div>
    {balance!==null&&Number.isFinite(amountMinor)&&amountMinor>0&&preferred!=='wallet'&&<p className="text-slate-400 leading-relaxed">{restricted?'Wallet payments are temporarily unavailable.':`You need ${formatGhs(Math.max(0,amountMinor-balance))} more to pay with Wallet.`} <button type="button" className="min-h-11 text-emerald-400 underline" onClick={()=>{closeCheckout();setActivePage('wallet');}}>Top Up Wallet</button></p>}
  </fieldset>;
};
