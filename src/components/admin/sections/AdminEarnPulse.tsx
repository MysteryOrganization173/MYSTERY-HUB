import React,{useEffect,useState} from 'react';
import {adminEarnRequest,type EarnOverview} from '../../../services/apiClient';
import {earnMoney} from './AdminEarnUi';
import {AdminPanel,AdminButton} from '../ui/AdminUi';
export const AdminEarnPulse:React.FC<{sessionToken:string;onOpen:()=>void}>=({sessionToken,onOpen})=>{
  const [data,setData]=useState<EarnOverview|null>(null);const [error,setError]=useState('');const [refresh,setRefresh]=useState(0);
  useEffect(()=>{let active=true;setError('');adminEarnRequest<{overview:EarnOverview}>(sessionToken,'overview',{period:'30d'})
    .then(r=>{if(active)setData(r.overview);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[sessionToken,refresh]);
  const items:Array<[string,React.ReactNode]>=data?[['Enabled referrers · lifetime',data.lifetimeEnabledProfiles],['Conversions · 30 days',data.metrics.qualifyingOrders],['Delivered revenue · 30 days',earnMoney(data.metrics.deliveredRevenueMinor)],['Approved rewards · 30 days',earnMoney(data.metrics.approvedRewardsMinor)]]:[];
  return <AdminPanel title="Mystery Earn" description="Referral activity over the last 30 days." actions={<AdminButton variant="ghost" onClick={onOpen}>Open Mystery Earn</AdminButton>}>
    {error?<div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-rose-300">{error}</p><AdminButton onClick={()=>setRefresh(n=>n+1)}>Retry</AdminButton></div>
      :data?<dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">{items.map(([label,value])=><div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums text-white">{value}</dd></div>)}</dl>
      :<p className="text-sm text-slate-400" role="status">Loading Earn metrics…</p>}
  </AdminPanel>;
};
