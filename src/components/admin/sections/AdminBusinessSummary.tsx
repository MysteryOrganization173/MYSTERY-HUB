import React,{useEffect,useState} from 'react';
import type {AdminFinancialReport,AdminPeriodName,ReportMetric} from '../../../../shared/adminOperations';
import type {AdminOrderDetails} from '../../../../server/types/orders';
import {operationsRequest} from '../../../services/adminOperationsApi';
import {describeOrderCase} from '../../../utils/adminOrderCase';
import {AdminPanel,AdminButton,AdminError,AdminLoading,AdminSheet,StatusPill,adminField,ghs} from '../ui/AdminUi';
import {ArrowUpRight,ChevronDown} from 'lucide-react';

const PERIODS:Array<[AdminPeriodName,string]>=[['today','Today'],['last7','Last 7 days'],['week','This week'],['previous_week','Previous week'],['month','This month'],['all','All time'],['custom','Custom dates']];
export function AdminPeriodControls({period,setPeriod,from,setFrom,to,setTo}:{period:AdminPeriodName;setPeriod:(p:AdminPeriodName)=>void;from:string;setFrom:(v:string)=>void;to:string;setTo:(v:string)=>void}){
 return <div className="flex flex-wrap items-end gap-2"><label className="text-xs text-slate-400">Period<select aria-label="Business reporting period" className={adminField} value={period} onChange={e=>setPeriod(e.target.value as AdminPeriodName)}>{PERIODS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>{period==='custom'&&<><label className="text-xs text-slate-400">From<input type="date" className={adminField} value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-xs text-slate-400">Through<input type="date" className={adminField} value={to} onChange={e=>setTo(e.target.value)}/></label></>}<span className="text-xs text-slate-500">Ghana time · Monday–Sunday weeks</span></div>;
}

/** Plain-language name for each server metric, used as the supporting-orders title. */
export const REPORT_METRIC_LABELS:Record<ReportMetric,string>={external_receipts:'Paystack order receipts',wallet_redemptions:'Wallet redemptions',completed_sales:'Completed platform sales',known_cost:'Sales with documented cost',unknown_cost:'Sales with unknown cost',customer_refunds:'Confirmed customer refunds',assisted_external:'Assisted external collections',complimentary:'Complimentary orders'};

/** Orders behind one report metric, using the same server definition and cutoff as the figure that opened it. */
export function ReportOrdersSheet({token,metric,query,cutoff,periodLabel,onClose,onOpenOrder}:{token:string;metric:ReportMetric;query:string;cutoff:string;periodLabel?:string;onClose:()=>void;onOpenOrder?:(ref:string)=>void}){
 const [page,setPage]=useState(1),[rows,setRows]=useState<{orders:AdminOrderDetails[];total:number;totalPages:number}|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;setRows(null);setError('');operationsRequest(token,`report/orders?${query}&metric=${metric}&page=${page}&cutoff=${encodeURIComponent(cutoff)}`).then(x=>{if(active)setRows(x);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[token,metric,page,query,cutoff]);
 return <AdminSheet title={REPORT_METRIC_LABELS[metric]} subtitle={`Supporting orders${periodLabel?` · ${periodLabel}`:''}`} onClose={onClose}>
  {error?<AdminError message={error}/>:!rows?<AdminLoading/>:<>
   <p className="mb-3 text-sm text-slate-400">{rows.total} matching order{rows.total===1?'':'s'}. Same definition and cutoff as the figure you opened.</p>
   <ul className="space-y-2">{rows.orders.map(o=>{const kase=describeOrderCase(o);return <li key={o.id}><button type="button" className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-800 p-3 text-left text-sm hover:border-slate-600" onClick={()=>onOpenOrder?.(o.public_reference)}><span className="min-w-0 space-y-1"><span className="block font-mono text-[13px] font-semibold text-white">{o.public_reference}</span><StatusPill tone={kase.tone}>{kase.label}</StatusPill></span><span className="shrink-0 font-semibold tabular-nums text-white">{ghs(o.amount)}</span></button></li>;})}</ul>
   {rows.totalPages>1&&<div className="mt-3 flex items-center justify-between"><AdminButton disabled={page===1} onClick={()=>setPage(v=>v-1)}>Previous</AdminButton><span className="text-sm text-slate-400">{page} / {rows.totalPages}</span><AdminButton disabled={page>=rows.totalPages} onClick={()=>setPage(v=>v+1)}>Next</AdminButton></div>}
  </>}
 </AdminSheet>;
}

/** One headline figure. The basis line stays visible at every width because it carries the accounting meaning. */
function Figure({label,value,basis,onOpen,emphasis=false}:{label:string;value:string;basis:React.ReactNode;onOpen?:()=>void;emphasis?:boolean}){
 const body=<><span className="block text-[13px] text-slate-400">{label}</span><span className={`mt-1 block font-bold tabular-nums tracking-tight text-white ${emphasis?'text-2xl sm:text-[1.7rem]':'text-xl'}`}>{value}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{basis}</span>{onOpen&&<span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#00c365]">Supporting orders<ArrowUpRight className="h-3.5 w-3.5" aria-hidden/></span>}</>;
 const cls='min-w-0 px-4 py-4 text-left sm:px-5';
 return onOpen?<button type="button" onClick={onOpen} className={`${cls} transition-colors hover:bg-slate-900/60 focus-visible:bg-slate-900/60`}>{body}</button>:<div className={cls}>{body}</div>;
}

/**
 * Business performance, compact. The three headline figures answer "how is the business doing";
 * every other Admin Operations V3 figure sits one tap away in the full breakdown. All values are
 * server-calculated; this component formats them and never derives new money figures.
 */
export function AdminBusinessSummary({token,onOpenOrder,onOpenFinance,revision=0}:{token:string;onOpenOrder?:(ref:string)=>void;onOpenFinance?:()=>void;revision?:number}){
 const [period,setPeriod]=useState<AdminPeriodName>('month'),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const [report,setReport]=useState<AdminFinancialReport|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [metric,setMetric]=useState<ReportMetric|null>(null),[expanded,setExpanded]=useState(false);
 const query=new URLSearchParams({period,...(period==='custom'?{from,to}:{})}).toString();
 useEffect(()=>{let active=true;setReport(null);setError('');if(period==='custom'&&(!from||!to))return;operationsRequest(token,`report?${query}`).then(x=>{if(active)setReport(x.report);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[token,query,revision,retry]);
 const periodLabel=PERIODS.find(([v])=>v===period)?.[1];
 return <AdminPanel title="Business performance" description="Verified receipts, completed sales and documented direct costs. Wallet money is kept separate from new cash."
   actions={onOpenFinance&&<AdminButton onClick={onOpenFinance}>Open Finance</AdminButton>}>
  <div className="space-y-3">
   <div role="radiogroup" aria-label="Business reporting period" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
    {PERIODS.map(([v,l])=><button key={v} type="button" role="radio" aria-checked={period===v} onClick={()=>setPeriod(v)} className={`min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-colors ${period===v?'border-[#00c365]/50 bg-[#00c365]/12 text-white':'border-slate-800 text-slate-400 hover:text-white'}`}>{l}</button>)}
   </div>
   {period==='custom'&&<div className="flex flex-wrap gap-2"><label className="text-xs text-slate-400">From<input type="date" className={adminField} value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-xs text-slate-400">Through<input type="date" className={adminField} value={to} onChange={e=>setTo(e.target.value)}/></label></div>}
   <p className="text-xs text-slate-500">Ghana time · Monday–Sunday weeks · each figure uses its own event date</p>
  </div>
  {error?<div className="mt-4"><AdminError message={error} onRetry={()=>setRetry(v=>v+1)}/></div>:!report?<div className="mt-4"><AdminLoading label={period==='custom'&&(!from||!to)?'Choose both dates.':'Loading business figures…'}/></div>:<>
   <div className="mt-4 grid divide-y divide-slate-800/80 overflow-hidden rounded-2xl border border-slate-800 md:grid-cols-3 md:divide-x md:divide-y-0">
    <Figure emphasis label="Paystack order receipts" value={ghs(report.externalReceiptsMinor)} basis="Verified payments by payment date, before customer refunds." onOpen={()=>setMetric('external_receipts')}/>
    <Figure emphasis label="Completed platform sales" value={ghs(report.completedSalesMinor)} basis={`${report.completedCount} delivered paid purchase${report.completedCount===1?'':'s'}, by delivery date. Managed stores count at wholesale.`} onOpen={()=>setMetric('completed_sales')}/>
    <Figure emphasis label="Gross margin · cost known" value={ghs(report.grossMarginMinor)} basis={`${ghs(report.costKnownSalesMinor)} sales less ${ghs(report.completedKnownCostMinor)} documented cost. Not net profit.`} onOpen={()=>setMetric('known_cost')}/>
   </div>
   <button type="button" aria-expanded={expanded} aria-controls="business-breakdown" onClick={()=>setExpanded(v=>!v)} className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-semibold text-slate-200 hover:text-white">
    <ChevronDown className={`h-4 w-4 transition-transform motion-reduce:transition-none ${expanded?'rotate-180':''}`} aria-hidden/>{expanded?'Hide full breakdown':'Full breakdown: costs, refunds, wallet and assisted orders'}
   </button>
   {expanded&&<div id="business-breakdown" className="mt-2 space-y-3">
    <div className="grid divide-y divide-slate-800/80 overflow-hidden rounded-2xl border border-slate-800 md:grid-cols-3 md:divide-x md:divide-y-0">
     <Figure label="Supplier cost recorded" value={ghs(report.recordedSupplierCostMinor)} basis="Actual recorded cost on submitted orders, by submission date. Supplier reimbursements are separate."/>
     <Figure label="Unknown cost exposure" value={ghs(report.unknownCostSalesMinor)} basis={`${report.unknownCostCount} completed order${report.unknownCostCount===1?'':'s'} excluded from gross margin.`} onOpen={()=>setMetric('unknown_cost')}/>
     <Figure label="Confirmed customer refunds" value={ghs(report.confirmedRefundsMinor)} basis="Order-linked verified refunds, by confirmation date. Provider processing does not prove arrival in the customer's account." onOpen={()=>setMetric('customer_refunds')}/>
    </div>
    <dl className="grid gap-x-6 text-sm sm:grid-cols-2">
     {([
      ['Completed customer spending',ghs(report.completedCustomerSpendingMinor),null],
      ['Wallet redemptions',ghs(report.walletRedemptionsMinor),'wallet_redemptions'],
      ['Paid orders with unresolved remedies',ghs(report.pendingRemedyMinor),null],
      ['Assisted external collections (operator recorded)',ghs(report.externalRecordedMinor),'assisted_external'],
      ['Complimentary orders',`${report.complimentaryCount} · cost ${ghs(report.complimentaryCostMinor)}`,'complimentary'],
     ] as Array<[string,string,ReportMetric|null]>).map(([term,value,m])=><div key={term} className="flex items-baseline justify-between gap-4 border-b border-slate-800/80 py-2.5">
      <dt className="text-slate-400">{term}</dt>
      <dd className="shrink-0 text-right font-medium tabular-nums text-slate-100">{m?<button type="button" className="underline decoration-slate-600 underline-offset-4 hover:text-[#00c365]" onClick={()=>setMetric(m)}>{value}</button>:value}</dd>
     </div>)}
    </dl>
    <p className="text-xs leading-relaxed text-slate-500">Wallet redemptions, unresolved remedies, operator-recorded collections and complimentary orders are not new external cash or provider-verified sales.</p>
    <details className="text-xs text-slate-400"><summary className="cursor-pointer py-1 font-semibold text-slate-300">Accounting basis and limitations</summary>{report.basis.map(line=><p className="mt-2" key={line}>{line}</p>)}<p className="mt-2">Cutoff {new Date(report.period.to).toLocaleString('en-GH',{timeZone:'Africa/Accra'})}. Fees, taxes, rewards and overhead are not deducted.</p></details>
   </div>}
  </>}
  {metric&&report&&<ReportOrdersSheet token={token} metric={metric} query={query} cutoff={report.period.to} periodLabel={periodLabel} onClose={()=>setMetric(null)} onOpenOrder={onOpenOrder}/>}
 </AdminPanel>;
}
