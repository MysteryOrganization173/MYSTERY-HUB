import React from 'react';
import type {useLeadAlerts} from '../leadAlerts';
import {leadDestination} from '../../../../shared/leadOperations';
import {AdminButton,AdminPanel} from '../ui/AdminUi';
export function AdminLeadSummary({state,navigate}:{state:ReturnType<typeof useLeadAlerts>;navigate:(tab:any,param:string)=>void}){
 const open=(source:'ultra'|'marketplace',filter:string)=>{const d=leadDestination(source,filter);navigate(d.tab,d.param);};
 return <AdminPanel title="Enquiries & follow-ups" description="Private sales follow-up, separate from payments. Updates every minute while Admin is visible; no phone push is sent." actions={<AdminButton onClick={state.refresh}>Refresh lead counts</AdminButton>}>
  {state.loading&&<p role="status">Loading lead counts…</p>}{state.error&&<p role="alert" className="text-amber-200">{state.error}</p>}
  <div className="grid gap-3 md:grid-cols-2">{(['ultra','marketplace'] as const).map(source=><div key={source} className="min-w-0 space-y-3 rounded-xl border border-slate-800 p-3"><h3 className="font-semibold">{source==='ultra'?'Ultra custom websites':'Marketplace enquiries'}</h3><div className="flex flex-wrap gap-2">{(['new','due','overdue'] as const).map(filter=><AdminButton key={filter} disabled={!state.data} onClick={()=>open(source,filter)}>{filter==='due'?'Due today':filter==='overdue'?'Overdue':'New'}: {state.data?state.data[source][filter]:state.loading?'Loading…':'Unavailable'}</AdminButton>)}</div><button className="min-h-11 text-sm text-emerald-300" onClick={()=>open(source,'recent')}>Recently updated · last 7 days</button>{state.data?.[source].recent.map(row=><button key={row.id} className="block min-h-11 max-w-full break-all text-left text-xs text-slate-300" onClick={()=>open(source,row.reference)}>{row.reference} · {row.status} · {new Date(row.updatedAt).toLocaleDateString('en-GH',{timeZone:'Africa/Accra'})}</button>)}</div>)}</div>
  {state.data&&<p className="mt-3 text-xs text-slate-500">Checked {new Date(state.data.checkedAt).toLocaleTimeString('en-GB',{timeZone:'Africa/Accra'})} GMT · due dates use Ghana calendar days. New counts are outstanding records, not fresh-submission claims.</p>}
 </AdminPanel>;
}
