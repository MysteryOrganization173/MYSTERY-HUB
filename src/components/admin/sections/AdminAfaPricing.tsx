import React,{useEffect,useState} from 'react';
import {commercialCash as cash} from '../../../utils/adminCommercialRefresh';
import {parseGhs} from '../../../../shared/money';

const field='min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 p-2';
const button='min-h-11 rounded-lg px-4 py-2 disabled:opacity-50';
const STATE:Record<string,string>={disabled:'Off',incomplete:'Enabled but incomplete',scheduled:'Scheduled',active:'Within its dates',ended:'Ended'};

/**
 * AFA Registration pricing inside Commercial Pricing. The standard price is the server setting; the December price only
 * applies when enabled here, within its dates, with a confirmed contractual supplier cost it covers. The server
 * validates and audits everything; this panel only collects drafts and typed confirmations.
 */
export function AdminAfaPricing({afa,busy,submit}:{afa:any;busy:boolean;submit:(create:()=>any)=>void}) {
 const c=afa.config;
 const [start,setStart]=useState(''),[end,setEnd]=useState(''),[price,setPrice]=useState(''),[typed,setTyped]=useState('');
 const [cost,setCost]=useState(''),[evidence,setEvidence]=useState(''),[costTyped,setCostTyped]=useState('');
 useEffect(()=>{setStart(c.startDate||'');setEnd(c.endDate||'');setPrice((c.campaignMinor/100).toFixed(2));setTyped('');setCost('');setEvidence('');setCostTyped('');},[c.version]);
 const campaign=(enabled:boolean)=>({kind:'afa-campaign',expectedVersion:c.version,enabled,startDate:start||null,endDate:end||null,campaignMinor:parseGhs(price),...(enabled?{activation:typed.trim()}:{})});
 const customerPays=afa.promotionApplies?c.campaignMinor:afa.standardMinor;
 return <section aria-labelledby="afa-pricing" className="space-y-3 rounded-xl border border-slate-700 p-4">
  <h3 id="afa-pricing" className="font-bold">AFA Registration pricing</h3>
  <p role="status" className={afa.promotionApplies?'text-amber-200 font-semibold':'text-slate-300'}>
   {afa.promotionApplies?`December price applies now: customers pay ${cash(c.campaignMinor)}.`:`Customers pay the standard price${afa.standardMinor===null?' (not configured)':` of ${cash(afa.standardMinor)}`}.`} Promotion: {STATE[afa.state]||afa.state}{c.enabled?' (enabled)':''}. Today in Accra: {afa.today}.
  </p>
  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
   <dt className="text-slate-400">Standard price (server setting)</dt><dd className="tabular-nums">{cash(afa.standardMinor)}{afa.standardMinor!==null&&afa.standardMinor!==afa.approved.standardMinor?` · approved ${cash(afa.approved.standardMinor)}`:''}</dd>
   <dt className="text-slate-400">December price</dt><dd className="tabular-nums">{cash(c.campaignMinor)}{afa.discountPercent!==null?` (${afa.discountPercent}% off)`:''}</dd>
   <dt className="text-slate-400">Customer pays now</dt><dd className="tabular-nums">{cash(customerPays)}</dd>
   <dt className="text-slate-400">Dates (Accra)</dt><dd>{c.startDate||'not set'} to {c.endDate||'not set'}{afa.endsAt?` · normal price from ${afa.endsAt.slice(0,10)}`:''}</dd>
   <dt className="text-slate-400">Supplier availability</dt><dd>{afa.available?'Available':`Unavailable (${String(afa.supplierStatus).replaceAll('_',' ')})`}</dd>
   <dt className="text-slate-400">Supplier cost</dt><dd>{c.cost?`${cash(c.cost.costMinor)} · confirmed ${c.cost.confirmedAt.slice(0,10)} by Admin ${c.cost.actorId} (${afa.costAgeDays} days ago)`:`Not confirmed. Historical ${cash(afa.approved.historicalCostMinor)} is a reference only.`}</dd>
   {c.cost&&<><dt className="text-slate-400">Cost evidence</dt><dd className="break-words">{c.cost.evidence}</dd></>}
   <dt className="text-slate-400">December contribution (est.)</dt><dd className="tabular-nums">{cash(afa.promotionContributionMinor)}</dd>
   <dt className="text-slate-400">Standard contribution (est.)</dt><dd className="tabular-nums">{cash(afa.standardContributionMinor)}</dd>
  </dl>
  {(c.enabled?afa.blockers:afa.enableProblems).length>0&&<div role="status" className="rounded-lg border border-amber-700 bg-amber-950/30 p-3 text-sm"><p className="font-semibold text-amber-200">{c.enabled?'Why the December price does not apply:':'Before it can be enabled:'}</p><ul className="list-disc pl-5">{(c.enabled?afa.blockers:afa.enableProblems).map((b:string)=><li key={b}>{b}</li>)}</ul></div>}
  <p className="text-xs text-slate-400">The data welcome benefit never applies to AFA. "Up to 33% off" is advertised only while the AFA December price applies and AFA can be bought.</p>
  <form className="space-y-2 rounded-lg border border-slate-700 p-3" onSubmit={e=>{e.preventDefault();submit(()=>({kind:'afa-cost',expectedVersion:c.version,costMinor:parseGhs(cost),evidence,confirmation:costTyped.trim()}));}}>
   <h4 className="font-semibold">Record the contractual supplier cost</h4>
   <p className="text-xs text-slate-400">Only from a current agreement, written quote or invoice from the AFA supplier, not from past orders or screenshots. Recorded with your name and time; confirmations older than 30 days cannot be used to enable.</p>
   <label className="block">Cost per registration (GH₵)<input className={field} value={cost} onChange={e=>setCost(e.target.value)} inputMode="decimal"/></label>
   <label className="block">Evidence (what, from whom, dated)<textarea className={field} value={evidence} onChange={e=>setEvidence(e.target.value)} maxLength={300} rows={2}/></label>
   <label className="block text-sm">Type <code>{afa.costConfirmation}</code><input className={field} value={costTyped} onChange={e=>setCostTyped(e.target.value)} autoComplete="off"/></label>
   <button disabled={busy||costTyped.trim()!==afa.costConfirmation||!cost||evidence.trim().length<10} className={`${button} bg-slate-700`}>Record supplier cost</button>
  </form>
  <form className="space-y-2" onSubmit={e=>{e.preventDefault();submit(()=>campaign(false));}}>
   <div className="grid gap-3 sm:grid-cols-3"><label>First day<input type="date" className={field} value={start} onChange={e=>setStart(e.target.value)}/></label><label>Last day<input type="date" className={field} value={end} onChange={e=>setEnd(e.target.value)}/></label><label>December price (GH₵)<input className={field} value={price} onChange={e=>setPrice(e.target.value)} inputMode="decimal"/></label></div>
   <button disabled={busy} className={`${button} bg-slate-700`}>{c.enabled?'Turn off the AFA December price':'Save as draft (price stays standard)'}</button>
  </form>
  <form className="space-y-2 rounded-lg border border-amber-800/60 p-3" onSubmit={e=>{e.preventDefault();submit(()=>campaign(true));}}>
   <label className="block text-sm">To enable the AFA December price, type <code>{afa.activation}</code><input className={field} value={typed} onChange={e=>setTyped(e.target.value)} autoComplete="off"/></label>
   <button disabled={busy||typed.trim()!==afa.activation} className={`${button} bg-amber-700`}>{c.enabled?'Save enabled AFA promotion':'Enable AFA December price'}</button>
  </form>
  <p className="text-xs text-slate-400">Last changed: {c.updatedAt?`${c.updatedAt} by Admin ${c.actorId}`:'Not changed yet (shipped off)'}</p>
 </section>;
}
