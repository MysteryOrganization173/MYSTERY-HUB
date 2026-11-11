import React,{useEffect,useState} from 'react';
import {commercialCash as cash} from '../../../utils/adminCommercialRefresh';
import {parseGhs} from '../../../../shared/money';
import {DECEMBER_2026_CAMPAIGN_ID} from '../../../../shared/directCampaign';

const field='min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 p-2';
const button='min-h-11 rounded-lg px-4 py-2 disabled:opacity-50';
const STATE:Record<string,string>={
 disabled:'Off. Every customer pays the standard price.',
 incomplete:'Enabled but incomplete, so standard prices apply. Set both days.',
 scheduled:'Scheduled. Standard prices apply until the first day (Accra).',
 active:'Active. December prices apply now.',
 ended:'Ended. Standard prices apply again.',
};

/**
 * December Specials inside Commercial Pricing. The server validates and audits every change; this panel only collects
 * a draft. Enabling needs the campaign name typed, complete dates and prices that cover a known supplier cost.
 */
export function AdminDecemberCampaign({data,busy,submit}:{data:any;busy:boolean;submit:(create:()=>any)=>void}) {
 const c=data.campaign;
 const [start,setStart]=useState(''),[end,setEnd]=useState(''),[typed,setTyped]=useState('');
 const [prices,setPrices]=useState<Record<string,string>>({}),[adding,setAdding]=useState('');
 useEffect(()=>{setStart(c.startDate||'');setEnd(c.endDate||'');setTyped('');setPrices(Object.fromEntries(Object.entries(c.products||{}).map(([id,p]:[string,any])=>[id,(p.campaignMinor/100).toFixed(2)])));},[c.version]);
 const rows=data.products.filter((p:any)=>p.campaignMinor!==null),available=data.products.filter((p:any)=>!(p.id in prices));
 const body=(enabled:boolean)=>({kind:'campaign',expectedVersion:c.version,enabled,startDate:start||null,endDate:end||null,stacksWithWelcome:c.stacksWithWelcome,
  products:Object.entries(prices).map(([productId,value])=>({productId,campaignMinor:parseGhs(value)})),...(enabled?{activation:typed.trim()}:{})});
 return <section aria-labelledby="december-campaign" className="space-y-3 rounded-xl border border-amber-800/60 p-4">
  <h3 id="december-campaign" className="font-bold">December Specials</h3>
  <p role="status" className={c.state==='active'?'text-amber-200 font-semibold':'text-slate-300'}>{STATE[c.state]||c.state} Today in Accra: {c.today}.</p>
  <p className="text-sm text-slate-400">Customers see the standard price crossed out and the December price. An eligible first purchase also gets the welcome benefit ({cash(data.offer.discountMinor)}){c.stacksWithWelcome?'':' — not on this campaign'}. Paid orders keep the prices they were paid at.</p>
  <div className="grid gap-3 lg:grid-cols-2">{rows.map((p:any)=><div key={p.id} className="rounded-lg border border-slate-700 p-3 text-sm space-y-1">
   <h4 className="font-semibold">{p.networkName} {p.dataAmount} {p.campaignApplies&&<span className="text-amber-200">· selling at December price</span>}</h4>
   <dl className="grid grid-cols-2 gap-x-3 gap-y-1">{([['Standard price',p.retailMinor],['December price',p.campaignMinor],['First purchase (with welcome)',p.campaignWelcomeTotalMinor],['Customer pays now',p.effectiveMinor],['Supplier cost',p.supplierCostMinor],['December contribution',p.campaignContributionMinor],['First-purchase contribution',p.campaignWelcomeContributionMinor]] as [string,number|null][]).map(([k,v])=><React.Fragment key={k}><dt className="text-slate-400">{k}</dt><dd className="tabular-nums">{cash(v)}</dd></React.Fragment>)}
    <dt className="text-slate-400">December per GB</dt><dd className="tabular-nums">GH₵{p.campaignPricePerGb.toFixed(2)}</dd></dl>
   {p.campaignIssues.map((issue:string)=><p key={issue} role="alert" className="text-amber-300">{issue}</p>)}
   {p.campaignWelcomeContributionMinor!==null&&p.campaignWelcomeContributionMinor<0&&<p className="text-amber-300">First purchase is an acquisition subsidy of {cash(-p.campaignWelcomeContributionMinor)} before any referral reward.</p>}
  </div>)}</div>
  <div className="rounded-lg border border-slate-700 p-3 text-sm"><h4 className="font-semibold">AFA Registration: prepared, not purchasable at a December price</h4>
   <p>Current {cash(data.afa.currentMinor)} · proposed {cash(data.afa.proposedMinor)} ({data.afa.discountPercent}% off {cash(data.afa.historicalRetailMinor)}) · historical cost {cash(data.afa.historicalCostMinor)}, unverified.</p>
   <ul className="list-disc pl-5 text-slate-400">{data.afa.reasons.map((r:string)=><li key={r}>{r}</li>)}</ul></div>
  <form className="space-y-3" onSubmit={e=>{e.preventDefault();submit(()=>body(false));}}>
   <div className="grid gap-3 sm:grid-cols-2"><label>First day (Accra)<input type="date" className={field} value={start} onChange={e=>setStart(e.target.value)}/></label><label>Last day (Accra), required to enable<input type="date" className={field} value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
   {Object.entries(prices).map(([id,value])=>{const p=data.products.find((x:any)=>x.id===id);return <div key={id} className="flex items-end gap-2"><label className="flex-1">{p?`${p.networkName} ${p.dataAmount}`:id} December price (GH₵; standard {cash(p?.retailMinor)})<input className={field} value={value} onChange={e=>setPrices({...prices,[id]:e.target.value})}/></label><button type="button" className={`${button} border border-slate-600`} onClick={()=>{const next={...prices};delete next[id];setPrices(next);}}>Remove</button></div>;})}
   {available.length>0&&<div className="flex items-end gap-2"><label className="flex-1">Add a standard Data product<select className={field} value={adding} onChange={e=>setAdding(e.target.value)}><option value="">Choose…</option>{available.map((p:any)=><option key={p.id} value={p.id}>{p.networkName} {p.dataAmount} · standard {cash(p.retailMinor)}</option>)}</select></label><button type="button" disabled={!adding} className={`${button} border border-slate-600`} onClick={()=>{const p=data.products.find((x:any)=>x.id===adding);setPrices({...prices,[adding]:((p.retailMinor-1)/100).toFixed(2)});setAdding('');}}>Add</button></div>}
   <button disabled={busy} className={`${button} bg-slate-700`}>{c.enabled?'Turn off December prices':'Save as draft (prices stay standard)'}</button>
  </form>
  <form className="space-y-2 rounded-lg border border-amber-800/60 p-3" onSubmit={e=>{e.preventDefault();submit(()=>body(true));}}>
   <label className="block text-sm">To {c.enabled?'save these December prices while enabled':'enable December prices from the first day'}, type <code>{DECEMBER_2026_CAMPAIGN_ID}</code><input className={field} value={typed} onChange={e=>setTyped(e.target.value)} autoComplete="off"/></label>
   <button disabled={busy||typed.trim()!==DECEMBER_2026_CAMPAIGN_ID} className={`${button} bg-amber-700`}>{c.enabled?'Save enabled campaign':'Enable December prices'}</button>
  </form>
  <p className="text-xs text-slate-400">Last changed: {c.updatedAt?`${c.updatedAt} by Admin ${c.actorId}`:'Not changed yet (shipped draft, off)'}</p>
 </section>;
}
