import React, {useEffect, useState} from 'react';
import {useApp} from '../../context/AppContext';
import {financeRequest} from '../../services/financeApi';
import {formatGhs} from '../../../shared/money';
import {Wallet} from 'lucide-react';

export function HomeWalletSummary({compact=false}:{compact?:boolean}) {
  const {sessionToken, setActivePage} = useApp();
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setBalance(null); setError(false);
    if (sessionToken) financeRequest(sessionToken).then(data=>{if(active){if(!Number.isSafeInteger(data.walletMinor)||data.walletMinor<0)throw Error('Balance unavailable');setBalance(data.walletMinor);}}).catch(()=>{if(active)setError(true);});
    return ()=>{active=false;};
  }, [sessionToken,retry]);
  if(compact)return <section aria-label="Mystery Wallet summary" className="member-wallet">
    <div className="member-wallet-main"><p className="member-wallet-label"><Wallet className="size-4" aria-hidden="true"/>Mystery Wallet</p>
      {error?<p className="member-wallet-error">Balance unavailable. <button className="underline min-h-11" onClick={()=>setRetry(x=>x+1)}>Retry</button></p>:<p className="member-wallet-balance" role="status">{balance===null?<span className="member-wallet-loading">Loading balance…</span>:formatGhs(balance)}</p>}</div>
    <div className="member-wallet-actions"><button className="mh-button" onClick={()=>setActivePage('wallet')}>Wallet activity</button></div>
    <p className="member-wallet-note">For eligible Data and Airtime purchases. Online top-ups are unavailable. Wallet funds cannot be withdrawn.</p>
  </section>;
  return <section aria-label="Mystery Wallet summary" className="mh-surface flex flex-wrap items-center justify-between gap-5">
    <div><p className="text-sm text-slate-300">Mystery Wallet</p>{error?<p className="mt-2 text-sm text-amber-300">Balance unavailable. <button className="underline min-h-11" onClick={()=>setRetry(x=>x+1)}>Retry</button></p>:<p className="mt-2 text-3xl sm:text-4xl font-semibold tabular-nums" role="status">{balance===null?'Loading balance…':formatGhs(balance)}</p>}<p className="mt-2 text-xs text-slate-400">For eligible Data and Airtime purchases. Online top-ups are unavailable. Wallet funds cannot be withdrawn.</p></div>
    <div className="flex flex-wrap gap-2"><button className="mh-button-secondary" onClick={()=>setActivePage('wallet')}>Wallet activity</button></div>
  </section>;
}
