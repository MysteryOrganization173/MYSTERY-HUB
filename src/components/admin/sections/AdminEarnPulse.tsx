import React,{useEffect,useState} from 'react';
import {adminEarnRequest,type EarnOverview} from '../../../services/apiClient';
import {earnMoney,earnButton} from './AdminEarnUi';
export const AdminEarnPulse:React.FC<{sessionToken:string;onOpen:()=>void}>=({sessionToken,onOpen})=>{
  const [data,setData]=useState<EarnOverview|null>(null);const [error,setError]=useState('');const [refresh,setRefresh]=useState(0);
  useEffect(()=>{let active=true;setError('');adminEarnRequest<{overview:EarnOverview}>(sessionToken,'overview',{period:'30d'})
    .then(r=>{if(active)setData(r.overview);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[sessionToken,refresh]);
  return <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800 space-y-3"><div className="flex flex-wrap justify-between gap-3"><h3 className="font-bold">Mystery Earn business pulse</h3><button className={earnButton} onClick={onOpen}>Open Mystery Earn</button></div>
    {error?<div className="text-xs text-red-400"><p>{error}</p><button className={earnButton} onClick={()=>setRefresh(n=>n+1)}>Retry Earn metrics</button></div>:data?<div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
      <div>Enabled referrers (lifetime)<strong className="block text-lg">{data.lifetimeEnabledProfiles}</strong></div><div>Conversions (30d)<strong className="block text-lg">{data.metrics.qualifyingOrders}</strong></div>
      <div>Delivered revenue (30d)<strong className="block text-lg">{earnMoney(data.metrics.deliveredRevenueMinor)}</strong></div><div>Approved rewards (30d)<strong className="block text-lg">{earnMoney(data.metrics.approvedRewardsMinor)}</strong></div>
    </div>:<p className="text-xs text-slate-400">Loading Earn metrics…</p>}
  </div>;
};
