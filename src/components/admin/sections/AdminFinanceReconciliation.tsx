import React,{useEffect,useState} from 'react';
import {getFinanceReconciliation} from '../../../services/financeReconciliationApi';
import {RECONCILIATION_GROUPS,type ReconciliationReport,type ReconciliationGroup} from '../../../../shared/financeReconciliation';
import {formatGhs} from '../../../../shared/money';
import {AdminPanel,AdminNotice,AdminStat,AdminButton,AdminLoading,AdminError,AdminEmpty,Freshness,RefreshButton,StatusPill,adminField,adminLabel,adminButton,type AdminTone} from '../ui/AdminUi';

const time=(value:string|null)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString():'Not recorded';
const tones:Record<ReconciliationGroup,AdminTone>={completed:'success',awaiting_confirmation:'neutral',unpaid_closed:'neutral',monitoring:'info',needs_review:'warning',evidence_unavailable:'warning',resolved:'info',not_applicable:'neutral'};
export function AdminFinanceReconciliation({token,onOpenFinanceHistory}:{token:string;onOpenFinanceHistory:(id:string)=>void}){
 const [query,setQuery]=useState({filter:'attention',reference:'',offset:0}),[reference,setReference]=useState(''),[revision,setRevision]=useState(0);
 const key=JSON.stringify([token,query,revision]);
 const [loaded,setLoaded]=useState<{key:string;report:ReconciliationReport}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const report=loaded?.key===key?loaded.report:null;
 useEffect(()=>{
  let current=true;const controller=new AbortController();setLoading(true);setError('');
  void getFinanceReconciliation(token,query,controller.signal).then(report=>{if(current){
   if(report.offset>0&&report.offset>=report.filteredTotal){setQuery(q=>({...q,offset:0}));return;}
   setLoaded({key,report});
  }}).catch(e=>{if(current&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(current)setLoading(false);});
  return()=>{current=false;controller.abort();};
 },[key]);
 const filter=(filter:string)=>setQuery(q=>({...q,filter,offset:0}));
 return <AdminPanel title="Financial reconciliation" description="Stored evidence, read only. Counts are records, not balances, profit or amounts owed." actions={<><Freshness at={report?Date.parse(report.generatedAt):null}/><RefreshButton busy={loading} onClick={()=>setRevision(n=>n+1)}/></>}>
  <div className="space-y-4">
   <AdminNotice tone="info" title="Initialization is not settlement">A checkout operation can remain pending after a successful purchase. This view follows the linked order, payment, ledger and resolution evidence. It never verifies, dispatches, refunds or changes a balance.</AdminNotice>
   <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();setQuery(q=>({...q,reference:reference.trim(),filter:'all',offset:0}));}}>
    <label className={`${adminLabel} min-w-0 flex-1 basis-56`}><span>Exact order reference or finance ID</span><input className={adminField} placeholder="MH-… or fin_…" value={reference} maxLength={80} autoComplete="off" onChange={e=>setReference(e.target.value)}/></label>
    <AdminButton type="submit" disabled={loading}>Find record</AdminButton>
    <AdminButton disabled={loading||!query.reference&&!reference} onClick={()=>{setReference('');setQuery(q=>({...q,reference:'',offset:0}));}}>Clear search</AdminButton>
    <label className={`${adminLabel} max-w-full`}><span>Reconciliation view</span><select className={`${adminField} max-w-full`} value={query.filter} onChange={e=>filter(e.target.value)}><option value="all">All records</option><option value="attention">Needs attention / missing evidence</option>{Object.entries(RECONCILIATION_GROUPS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   </form>
   {error&&<AdminError title="Evidence report unavailable" message={error} onRetry={()=>setRevision(n=>n+1)}/>}
   {loading&&<AdminLoading label="Reading stored financial evidence…"/>}
   {report&&!error&&<>
    <p className="break-words text-xs text-slate-400">{report.scope} Snapshot: {time(report.generatedAt)}. No live provider verification. Original archived history is retained.</p>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">{(['completed','awaiting_confirmation','unpaid_closed','needs_review','evidence_unavailable'] as ReconciliationGroup[]).map(group=><AdminStat key={group} label={RECONCILIATION_GROUPS[group]} value={report.counts[group]} tone={tones[group]}/>)}</div>
    <p className="text-xs text-slate-400">{report.total} records in scope · {report.counts.monitoring} progressing · {report.counts.resolved} resolved/other recorded outcomes · {report.counts.not_applicable} non-purchase records. Counters cover this scope; the view filter applies to the list.</p>
    <p className="text-xs text-slate-400">48 hours is a review recommendation only for regular MTN Data, based on the current exceptional processing notice. No universal deadline is inferred for other services. An unresolved record does not automatically mean customer money is owed.</p>
    <div aria-label="Reconciliation records" role="region" className="space-y-3">
     <p role="status" className="text-sm text-slate-300">{report.filteredTotal} matching records</p>
     {!report.rows.length?<AdminEmpty title="No records match this view">Try All records, clear the exact-reference search, or refresh for newer evidence. An empty view does not establish external provider health.</AdminEmpty>:report.rows.map(row=><article key={row.key} className="min-w-0 space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-all font-semibold text-white">{row.orderReference||row.operationId}</h3><p className="text-xs text-slate-400">{row.service.replaceAll('_',' ')} · {row.currency==='GHS'?formatGhs(row.amountMinor):`${row.amountMinor} minor units; currency not established`}{row.recordType!=='order'?' · operation amount; not purchase revenue':''}{row.archived?' · Archived history':''}</p></div><StatusPill tone={tones[row.group]}>{row.label}</StatusPill></div>
      <p className="text-slate-300">{row.explanation}</p>
      <dl className="grid gap-2 text-xs sm:grid-cols-2"><div><dt className="text-slate-500">Recorded payment / fulfillment</dt><dd>{row.paymentStatus||'Not an order'} / {row.fulfillmentStatus||'Not an order'}{row.marketplaceStatus?` · Marketplace: ${row.marketplaceStatus}`:''}{row.operationState?` · Finance state: ${row.operationState}`:''}</dd></div><div><dt className="text-slate-500">Created / last updated</dt><dd>{time(row.createdAt)} / {time(row.updatedAt)}</dd></div>{row.recordType==='order'&&<><div><dt className="text-slate-500">Payment / delivery recorded at</dt><dd>{time(row.paidAt)} / {time(row.deliveredAt)}</dd></div>{row.resolutionAt&&<div><dt className="text-slate-500">Resolution updated</dt><dd>{time(row.resolutionAt)}</dd></div>}</>}</dl>
      <div className="flex flex-wrap gap-2">{row.orderReference&&<a className={adminButton('secondary','text-xs')} href={`#orders/ref/${encodeURIComponent(row.orderReference)}`}>Open existing order details</a>}{row.financeUserId&&<AdminButton className="text-xs" onClick={()=>onOpenFinanceHistory(row.financeUserId!)}>Open customer finance history</AdminButton>}<span className="self-center text-xs text-slate-500">{row.requiresInvestigation?'Investigate evidence; no automatic remedy.':'No action inferred from this classification.'}</span></div>
     </article>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><AdminButton disabled={loading||!query.offset} onClick={()=>setQuery(q=>({...q,offset:Math.max(0,q.offset-report.limit)}))}>Previous records</AdminButton><span className="text-xs text-slate-400">{report.filteredTotal?`${report.offset+1}–${Math.min(report.offset+report.limit,report.filteredTotal)} of ${report.filteredTotal}`:'0 records'}</span><AdminButton disabled={loading||query.offset+report.limit>=report.filteredTotal} onClick={()=>setQuery(q=>({...q,offset:q.offset+report.limit}))}>Next records</AdminButton></div>
   </>}
  </div>
 </AdminPanel>;
}
