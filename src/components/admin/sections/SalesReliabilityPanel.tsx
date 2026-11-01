import React,{useState,useEffect} from 'react';
import {AdminPanel,AdminNotice,StatusPill,type AdminTone} from '../ui/AdminUi';
import {salesCategoryLabel,salesServiceLabel,incidentState,type SalesReliabilityView,type SalesState} from '../../../../shared/salesReliability';

const stateLabel:Record<SalesState,string>={active:'Supplier-backed checkout checks failing',recovering:'Recovery observed · confirmation pending',recovered:'Recent recovery confirmed',healthy:'Recent fresh preflight checks passed',insufficient_evidence:'Checkout health uncertain'};
const tone=(state:SalesState):AdminTone=>state==='active'?'danger':state==='recovering'?'warning':state==='healthy'||state==='recovered'?'success':'neutral';
const time=(value:number|null)=>value===null?'Not observed':new Date(value).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const stages={services:'Service discovery',catalog:'Supplier catalogue',wallet:'Supplier wallet',beneficiary:'Beneficiary check',application:'Application'};

export function SalesReliabilityPanel({data,error,loading}:{data:SalesReliabilityView|null;error:boolean;loading:boolean}){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30_000);return()=>clearInterval(timer);},[]);
  const stale=Boolean(data&&now-data.checkedAt>60_000);
  const uncertain=error||stale||data?.storage==='unavailable';
  const state=uncertain?'insufficient_evidence':data?.state??'insufficient_evidence';
  return <AdminPanel title="Sales reliability" description="Observed supplier-backed checkout checks. Separate from individual Orders → Needs attention.">
    {!data?<p role="status" className="text-sm text-slate-400">{loading?'Loading checkout evidence…':error?'Checkout evidence could not be loaded. Health is unknown.':'No checkout evidence available yet. Health is unknown.'}</p>:<div className="min-w-0 space-y-4">
      <AdminNotice tone={tone(state)} title={stateLabel[state]}>
        {data.recent.failures>0?`${data.recent.failures} qualifying server-side check failure${data.recent.failures===1?'':'s'} recorded in the last ten minutes. ${state==='recovered'?'Earlier failures remain in the window after recovery.':'Review the incident evidence below; some purchases may be affected.'}`:state==='healthy'||state==='recovered'?'Recent purchasing preflight checks passed with fresh discovery evidence. This does not prove payment or delivery.':'No sufficient fresh evidence to confirm purchasing health. A quiet website is not proof of recovery.'}
      </AdminNotice>
      {uncertain&&<p role="status" className="text-xs text-amber-300">{error||stale?'Refresh failed or this snapshot is stale. Showing the last available evidence.':'Monitoring storage is unavailable. Purchasing remains independent of monitoring.'}</p>}
      {(data.collector.writeFailed||data.collector.dropped>0)&&<p className="text-xs text-amber-300">Observation collection is degraded. Counts may be incomplete. {data.collector.dropped>0?`${data.collector.dropped} observations discarded since this process started.`:''}</p>}
      {data.recent.attempts>=5000&&<p className="text-xs text-amber-300">The recent observation limit was reached. Counts may be incomplete; health is uncertain.</p>}
      <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        {[[data.recent.attempts,'Recorded attempts'],[data.recent.passed,'Passed preflights'],[data.recent.validation,'Customer / package rejections'],[data.recent.unverified,'Unverified checks']].map(([count,label])=><div key={label} className="min-w-0 rounded-lg bg-slate-950/50 p-3"><dt className="break-words text-slate-400">{label}</dt><dd className="mt-1 text-lg font-semibold text-white">{count}</dd></div>)}
      </dl>
      <p className="text-xs text-slate-400">{data.recent.blocked} recorded preflight rejection{data.recent.blocked===1?'':'s'} occurred before payment initialization. Other observations carry no payment guarantee.</p>
      <div className="space-y-1 text-xs text-slate-500"><p>Last checkout evidence: {time(data.recent.lastObservedAt)}</p><p>Last passed preflight with fresh discovery: {time(data.recent.lastFreshPassAt)}</p><p>Snapshot: {time(data.checkedAt)} · refreshes every 30 seconds · {data.collector.pending} observations awaiting persistence in this process</p></div>
      <ul className="space-y-1 text-xs text-slate-400">{data.recent.byService.map(s=><li key={s.service} className="break-words">{salesServiceLabel[s.service]}: {s.attempts} recorded attempts · fresh discovery with passed preflight: {time(s.lastFreshPassAt)}</li>)}</ul>
      {data.recent.categories.filter(c=>!['passed','validation','unverified'].includes(c.category)).map(c=><p key={c.category} className="break-words text-xs text-amber-200">{salesCategoryLabel[c.category]}: {c.count}</p>)}
      <div className="border-t border-slate-800 pt-3"><h3 className="mb-2 text-sm font-semibold text-white">Incident history</h3>
        {data.incidents.length===0?<p className="text-xs text-slate-500">No incident recorded in retained history. Three related failures within ten minutes open an incident; one transient failure does not establish an outage.</p>:<ol className="space-y-3">{data.incidents.map(i=>{
          const current=incidentState(i,now);
          return <li key={i.id} className="min-w-0 rounded-xl border border-slate-800 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="break-words font-semibold text-white">{salesServiceLabel[i.service]} · {stages[i.stage]}</h4><StatusPill tone={tone(current)}>{current==='active'?'Active':current==='recovering'?'Recovering':current==='recovered'?'Recovered':'Recovery unconfirmed'}</StatusPill></div>
            <p className="mt-2 break-words text-slate-300">Latest: {salesCategoryLabel[i.category]} · {i.affectedAttempts} affected attempts · {i.blockedAttempts} rejected before payment initialization</p>
            <p className="mt-1 text-slate-500">First failure: {time(i.firstFailureAt)}<br/>Latest failure: {time(i.lastFailureAt)}<br/>Fresh recovery evidence: {time(i.lastRecoveryAt)}{i.recoveredAt!==null&&<><br/>Recovery confirmed: {time(i.recoveredAt)}</>}</p>
          </li>;
        })}</ol>}
      </div>
      <p className="text-xs text-slate-500">Recovery requires two successful preflights with fresh checks for the affected stage, at least one minute apart. Cached responses and wallet-only checks cannot clear discovery failures. History retains up to 100 incidents for 90 days; this panel shows unresolved and recent incidents, up to 30. Evidence is observed, not a complete sales census.</p>
      <p className="text-xs text-amber-200">Alerts are visible in Admin only. External push/email incident delivery is not enabled.</p>
    </div>}
  </AdminPanel>;
}
