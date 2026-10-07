import React,{useEffect,useState} from 'react';
import {useApp} from '../../context/AppContext';
import {commercialRequest} from '../../services/commercialApi';
import {formatGhs} from '../../../shared/money';
export function WelcomeOfferNotice(){
 const {sessionToken,user,openAuth}=useApp();const [offer,setOffer]=useState<any>(null);
 useEffect(()=>{let active=true;commercialRequest('commercial/quote/mtn-1gb',sessionToken).then(r=>{if(active)setOffer(r.offer);}).catch(()=>{if(active)setOffer(null);});return()=>{active=false;};},[sessionToken,user?.phone]);
 if(!offer?.enabled||!['guest','eligible'].includes(offer.state))return null;
 return <div className="flex flex-wrap items-center gap-x-3 rounded-xl border border-emerald-800/50 px-3 py-2 text-xs text-slate-300">
  <span><strong className="text-emerald-300">Welcome Offer</strong> · {formatGhs(offer.discountMinor)} off your first qualifying Data order</span>
  {offer.state==='guest'&&<button className="min-h-11 px-2 text-emerald-400 font-semibold" onClick={()=>openAuth('signup')}>Create account</button>}
 </div>;
}
