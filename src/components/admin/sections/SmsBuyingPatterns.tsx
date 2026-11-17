import React,{useEffect,useState} from 'react';
import {AdminPanel,AdminButton,adminField} from '../ui/AdminUi';
import {smsRequest} from '../../../services/smsCommunications';
import {SMS_BUYING_GROUPS} from '../../../../shared/smsStudio';
import {DEFAULT_CONTACT_FILTERS} from '../../../../shared/contactHub';

export function SmsBuyingPatterns({token,onPrepare}:{token:string;onPrepare:(seed:any)=>void}) {
  const [data,setData]=useState<any>(null),[error,setError]=useState(''),[group,setGroup]=useState('due'),[cadence,setCadence]=useState('weekly');
  useEffect(()=>{const c=new AbortController();void smsRequest(token,'buying-patterns',undefined,'GET',c.signal).then(r=>{if(!c.signal.aborted)setData(r);},e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[token]);
  const customers=data?.customers?.filter((c:any)=>c.group===group)||[];
  return <AdminPanel title="Buying patterns & campaign planning"><div className="space-y-4">
    <p className="text-sm text-slate-300">A weekly data buyer and a monthly buyer need different timing. These suggestions use each customer's completed direct purchases. They do not grant marketing permission or schedule sending.</p>
    {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
    {!data&&!error&&<p role="status">Loading buying patterns...</p>}
    {data&&<><div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Object.entries(SMS_BUYING_GROUPS).map(([id,label])=><button key={id} type="button" aria-pressed={group===id} onClick={()=>setGroup(id)} className={`rounded-xl border p-3 text-left min-h-20 ${group===id?'border-emerald-400 bg-emerald-950/40':'border-slate-700'}`}><span className="block text-xs text-slate-300">{label}</span><strong className="text-xl">{data.counts[id]||0}</strong></button>)}</div>
      <div className="flex flex-wrap items-end gap-3"><label className="text-sm">Planning rhythm<select className={adminField+' mt-1 block'} value={cadence} onChange={e=>setCadence(e.target.value)}><option value="weekly">Weekly review</option><option value="fortnightly">Fortnightly review</option></select></label><p className="text-xs text-amber-200 pb-3">Planning only. Recurring reminders are off.</p></div>
      <p className="text-sm">{SMS_BUYING_GROUPS[group]}: {customers.length} accounts. Review permissions and recipients before any campaign.</p>
      <AdminButton disabled={!customers.length} onClick={()=>onPrepare({filters:{...DEFAULT_CONTACT_FILTERS,source:'registered'},selected:customers.slice(0,100).map((c:any)=>({id:c.id,source:'registered'})),buyingGroup:group,suggestedBody:"It's been a while! Need data again? Check current digital services at https://mysterybundlehub.com",planningCadence:cadence})}>Prepare {Math.min(customers.length,100)} accounts for review</AdminButton>
      {customers.length>100&&<p className="text-xs text-slate-400">This reviewed batch contains the first100 accounts only. Use Contact Hub for a narrower selection.</p>}
      <div className="space-y-2">{customers.slice(0,10).map((c:any)=><article key={c.id} className="rounded-xl border border-slate-800 p-3 text-sm"><strong>{c.name||'Direct customer'}</strong><p className="text-slate-300">{c.cycleDays?`Usual interval: ${c.cycleDays} days. `:''}{c.daysSinceLast===null?'No completed purchase yet.':`${c.daysSinceLast} days since last purchase.`}</p><p className="text-xs text-slate-400 mt-1">{c.reason}</p></article>)}</div>
      <details className="text-xs text-slate-400"><summary className="min-h-10 cursor-pointer">How these suggestions are calculated</summary><p>{data.basis}</p><p>Weekly/fortnightly choices are planning aids only; no reminder service is activated.</p></details>
    </>}
  </div></AdminPanel>;
}
