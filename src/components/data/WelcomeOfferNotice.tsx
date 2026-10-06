import React,{useEffect,useState} from 'react';
import {useApp} from '../../context/AppContext';
import {commercialRequest} from '../../services/commercialApi';
import {formatGhs} from '../../../shared/money';
export function WelcomeOfferNotice(){
 const {sessionToken,user,openAuth,openAccount}=useApp();const [offer,setOffer]=useState<any>(null);
 useEffect(()=>{let active=true;commercialRequest('commercial/quote/mtn-1gb',sessionToken).then(r=>{if(active)setOffer(r.offer);}).catch(()=>{if(active)setOffer(null);});return()=>{active=false;};},[sessionToken,user?.phone]);
 if(!offer?.enabled||!['guest','eligible','phone_required','reserved'].includes(offer.state))return null;
 return <div className="rounded-xl border border-emerald-800 bg-emerald-950/20 p-3 text-sm text-slate-200">
  {offer.state==='guest'?<>{formatGhs(offer.discountMinor)} off your first qualifying direct Data order. <button className="underline text-emerald-400" onClick={()=>openAuth('signup')}>Create a free account</button>. Guest purchases stay at regular price.</>:offer.state==='eligible'?<>Your {formatGhs(offer.discountMinor)} welcome offer is ready. Applied automatically at checkout.</>:offer.state==='phone_required'?<>Add a unique Ghana phone to use your welcome offer. <button className="underline text-emerald-400" onClick={openAccount}>My Account</button></>:<>Your welcome offer is reserved for an existing order. Check Orders before starting another payment.</>}
 </div>;
}
