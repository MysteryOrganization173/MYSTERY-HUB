import React, {useEffect, useState} from 'react';
import {useApp} from '../../context/AppContext';
import {financeRequest} from '../../services/financeApi';
import {formatGhs} from '../../../shared/money';

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
  return <section aria-label="Mystery Wallet summary" className={compact?"min-w-0 space-y-3":"mh-surface flex flex-wrap items-center justify-between gap-5"}>
    <div><p className="text-sm text-slate-300">Mystery Wallet</p>{error?<p className="mt-2 text-sm text-amber-300">Balance unavailable. <button className="underline min-h-11" onClick={()=>setRetry(x=>x+1)}>Retry</button></p>:<p className="mt-2 text-3xl sm:text-4xl font-semibold tabular-nums" role="status">{balance===null?'Loading balance…':formatGhs(balance)}</p>}<p className="mt-2 text-xs text-slate-400">For purchases on Mystery Hub. Wallet funds cannot be withdrawn.</p></div>
    <div className="flex flex-wrap gap-2"><button className="mh-button" onClick={()=>{setActivePage('wallet');window.history.replaceState({page:'wallet'},'', '/wallet?topup=1');}}>Top Up</button><button className="mh-button-secondary" onClick={()=>setActivePage('wallet')}>Wallet activity</button></div>
  </section>;
}
