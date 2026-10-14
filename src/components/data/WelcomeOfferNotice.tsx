import React from 'react';
import {useApp} from '../../context/AppContext';
import type {WelcomeOffer} from '../../utils/welcomeOfferPresentation';
import {formatGhs} from '../../../shared/money';
export function WelcomeOfferNotice({offer}:{offer:WelcomeOffer|null}){
 const {openAuth}=useApp();
 if(!offer?.enabled||!['guest','eligible'].includes(offer.state))return null;
 return <div className="flex flex-wrap items-center gap-x-3 rounded-xl border border-emerald-800/50 px-3 py-2 text-xs text-slate-300">
  <span><strong className="text-emerald-300">Welcome Offer</strong> · {formatGhs(offer.discountMinor)} off one qualifying Data purchase.{offer.state==='eligible'&&' Choose any qualifying bundle below; the saving applies once, not to every bundle.'}</span>
  {offer.state==='guest'&&<button className="min-h-11 px-2 text-emerald-400 font-semibold" onClick={()=>openAuth('signup')}>Create account</button>}
 </div>;
}
