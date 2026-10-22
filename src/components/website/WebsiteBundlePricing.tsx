import React,{useEffect,useRef,useState} from 'react';
import {websiteBusinessRequest} from '../../services/websiteBusinessApi';
import {formatGhs,parseGhs} from '../../../shared/money';
import {storeReserve} from '../../../shared/storeEconomics';
import {pricingReviewLines} from '../../utils/websiteOwnerOrders';
import {bundleSaveRows,canPrice,isSellableDraft,planBundleSetup,sellableCount,sellerDrafts,sellerPriceError,type BundleSetupChoice,type BundleSetupPlan,type SellerBundle,type SellerDraft} from '../../utils/websitePricing';
const button='min-h-11 px-3 rounded-lg border border-slate-700 text-sm disabled:opacity-50';
const field='min-h-11 rounded-lg px-3 bg-slate-950 border border-slate-700 min-w-0';
const NETWORKS=[['mtn','MTN'],['telecel','Telecel'],['airteltigo','AirtelTigo']] as const;
const count=(n:number,one:string,many=`${one}s`)=>`${n} ${n===1?one:many}`;

/**
 * One task: set up the bundles you want to sell. Quick setup chooses networks, a price rule and whether
 * bundles go on sale; one review shows the real outcome and one save sends it to the existing versioned
 * endpoint. The per-bundle list stays for owners who price some bundles differently. The server validates
 * every row (minimum price, configured bundles) and its refreshed catalogue confirms what is on sale.
 */
export function WebsiteBundlePricing({siteId,token,onDirty,published=true,onSaved,variant='dashboard'}:{siteId:string;token:string;onDirty?:(dirty:boolean)=>void;published?:boolean;onSaved?:(sellable:number)=>void;variant?:'dashboard'|'sheet'}) {
 const [catalog,setCatalog]=useState<any>(null),[drafts,setDrafts]=useState<Record<string,SellerDraft>>({}),[network,setNetwork]=useState('mtn');
 const [choice,setChoice]=useState<BundleSetupChoice>({networks:['mtn','telecel','airteltigo'],priceMode:'markup',kind:'percent',value:'10',activation:'enable'});
 const [plan,setPlan]=useState<BundleSetupPlan|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[reviewing,setReviewing]=useState(false),[conflict,setConflict]=useState(false);
 const alive=useRef(true),saving=useRef(false),identity=useRef(''),catalogIdentity=useRef(''),reviewRef=useRef<HTMLDivElement>(null),listRef=useRef<HTMLDivElement>(null);
 identity.current=`${siteId}:${token}`;
 const load=async()=>{const expected=identity.current;const result=await websiteBusinessRequest(`websites/${siteId}/bundles`,token);if(alive.current&&identity.current===expected){catalogIdentity.current=expected;setCatalog(result);setDrafts(sellerDrafts(result.products));setConflict(false);}return alive.current&&identity.current===expected?result:null;};
 useEffect(()=>{alive.current=true;setBusy(false);setCatalog(null);setDrafts({});setError('');setNotice('');setPlan(null);setReviewing(false);const expected=identity.current;void load().catch(e=>{if(alive.current&&identity.current===expected)setError(e.message);});return()=>{alive.current=false;};},[siteId,token]);
 const products:SellerBundle[]=catalog?.products||[];
 const original=sellerDrafts(products);
 const changed=products.filter(p=>drafts[p.id]&&(drafts[p.id].price!==original[p.id].price||drafts[p.id].enabled!==original[p.id].enabled));
 useEffect(()=>{onDirty?.(changed.length>0);},[changed.length,onDirty]);
 useEffect(()=>{if(!changed.length)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[changed.length]);
 useEffect(()=>{if(reviewing)reviewRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[reviewing]);
 const update=(id:string,patch:Partial<SellerDraft>)=>{setDrafts(prev=>({...prev,[id]:{...prev[id],...patch}}));setNotice('');setPlan(null);setReviewing(false);};
 const choose=(patch:Partial<BundleSetupChoice>)=>{setChoice(prev=>({...prev,...patch}));setPlan(null);setError('');};
 const toggleNetwork=(id:string)=>choose({networks:choice.networks.includes(id)?choice.networks.filter(n=>n!==id):[...choice.networks,id]});
 // Quick setup: a preview only. Nothing changes in the list or on the store until the owner applies or saves it.
 // Networks with nothing Mystery Hub can sell yet are shown but never chosen.
 const previewSetup=()=>{try{const ready=new Set(products.filter(canPrice).map(p=>p.network));const next=planBundleSetup(products,drafts,{...choice,networks:choice.networks.filter(n=>ready.has(n))});setPlan(next);setReviewing(false);setError('');setNotice('');}catch(e:any){setPlan(null);setError(e.message);}};
 const applyPlan=(current:BundleSetupPlan)=>{const next={...drafts};for(const row of current.rows)next[row.id]=row.after;return next;};
 const save=async(next=drafts)=>{if(saving.current||!catalog||catalogIdentity.current!==identity.current)return;const rows=bundleSaveRows(products,original,next);
   const invalid=products.find(p=>rows.some(r=>r.productId===p.id)&&sellerPriceError(p,next[p.id]));if(invalid){setError(`${invalid.networkName} ${invalid.dataAmount}: ${sellerPriceError(invalid,next[invalid.id])}`);return;}
   if(!rows.length){setNotice('Nothing to save. Your bundles already match this setup.');setPlan(null);setReviewing(false);return;}
   const expected=identity.current;let committed=false;
   saving.current=true;setBusy(true);setError('');setNotice('');setDrafts(next);
   try{await websiteBusinessRequest(`websites/${siteId}/bundles`,token,{expectedVersion:catalog.version,products:rows},'PUT');committed=true;
     if(!alive.current||identity.current!==expected)return;
     // The refreshed catalogue, not this screen, says how many bundles customers can buy now.
     const fresh=await load();const live=(fresh?.products||[]).filter((p:any)=>p.eligible).length;
     if(fresh&&alive.current&&identity.current===expected){setPlan(null);setReviewing(false);setNotice(`Your bundle setup is saved. ${live===1?'1 bundle meets':`${live} bundles meet`} the current catalogue rules.${published?' Live checkout still depends on current service availability.':' Publish your Data website before customers can buy.'}`);onSaved?.(live);}
   }catch(e:any){if(alive.current&&identity.current===expected){const stale=e.status===409;setConflict(true);setError(committed?'Your settings were saved, but the latest catalogue could not be loaded. Reload prices to confirm the saved state.':stale?'Your prices changed in another tab or device. This update was not applied. Reload the latest prices, then review again.':e.status>=400&&e.status<500?`${e.message} This update was not applied.`:'The save result could not be confirmed. Reload prices before trying again.');}}
   finally{saving.current=false;if(alive.current&&identity.current===expected)setBusy(false);}};
 if(!catalog)return <div role="status" className="text-sm">{error?<><p role="alert">{error}</p><button className={button} onClick={()=>{setError('');void load().catch(e=>setError(e.message));}}>Try again</button></>:'Loading your bundles…'}</div>;
 const configurable=products.filter(canPrice);
 const sellableNow=sellableCount(products,original);
 const byNetwork=NETWORKS.map(([id,label])=>({id,label,total:products.filter(p=>p.network===id).length,ready:products.filter(p=>p.network===id&&canPrice(p)).length,onSale:products.filter(p=>p.network===id&&isSellableDraft(p,original[p.id])).length}));
 const s=plan?.summary;
 return <section aria-label="Bundles & Pricing" className="website-bundles space-y-4" data-bundle-setup={variant}>
 <div className="website-bundles-status" data-sellable={sellableNow}>
  <strong>{sellableNow?`${count(sellableNow,'bundle')} configured`:'No eligible bundles are configured yet'}</strong>
  <span>{byNetwork.filter(n=>n.total).map(n=>`${n.label} ${n.onSale}/${n.ready||n.total}`).join(' · ')}</span>
 </div>
 <p className="text-sm text-slate-400">Configure bundles and selling prices. Eligible means enabled under the current pricing policy; customers also need a published Data store, available checkout and supplier availability. Estimated earnings per sale allow for bundle costs and payment processing.</p>
 {!catalog.policy?.enabled?<p role="status" className="text-sm text-amber-200">Online checkout is not enabled for reseller stores yet. Contact Mystery Hub before offering online purchases.</p>:!sellableNow&&!changed.length&&<p role="status" className="text-sm text-amber-200">Customers can’t buy from your store until you price and switch on some bundles. Quick setup below does it in one go.</p>}
 {configurable.length<products.length&&<p role="status" className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-3 text-sm text-amber-200">{count(products.length-configurable.length,'bundle')} {products.length-configurable.length===1?'is':'are'} not available from Mystery Hub right now, so {products.length-configurable.length===1?'it':'they'} can’t go on sale. The rest can.</p>}

 {notice.startsWith('Your bundle setup is saved')&&!changed.length&&<p role="status" className="website-bundles-saved" data-bundle-saved>{notice}</p>}
 <fieldset disabled={busy||!configurable.length} className="website-bundles-setup min-w-0 rounded-xl border border-emerald-800/60 bg-emerald-950/10 p-3 space-y-4">
  <legend className="px-1 font-semibold">Quick setup</legend>
  <div><p className="text-xs font-semibold text-slate-300 mb-2" id={`bundle-networks-${variant}`}>1. Networks</p>
   <div role="group" aria-labelledby={`bundle-networks-${variant}`} className="flex flex-wrap gap-2">{byNetwork.map(n=><button key={n.id} type="button" aria-pressed={!!n.ready&&choice.networks.includes(n.id)} disabled={!n.ready} onClick={()=>toggleNetwork(n.id)} className={`${button} disabled:opacity-60 ${n.ready&&choice.networks.includes(n.id)?'border-emerald-500 text-emerald-200 bg-emerald-500/10':''}`}>{n.label}{!n.ready&&n.total?<span className="text-[11px] text-slate-400"> · not available</span>:null}</button>)}</div></div>
  <div><p className="text-xs font-semibold text-slate-300 mb-2" id={`bundle-price-${variant}`}>2. Selling price</p>
   <div role="radiogroup" aria-labelledby={`bundle-price-${variant}`} className="grid gap-2">
    <label className="website-bundles-option"><input type="radio" name={`price-${variant}`} checked={choice.priceMode==='markup'} onChange={()=>choose({priceMode:'markup'})}/><span><strong>Add my profit to the minimum price</strong><small>Each bundle starts from its minimum selling price.</small></span></label>
    {choice.priceMode==='markup'&&<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 pl-7">
     <label className="text-xs text-slate-300">Amount<input aria-label="Markup amount" inputMode="decimal" enterKeyHint="done" className={`${field} w-full mt-1 text-white`} value={choice.value} onChange={e=>choose({value:e.target.value})}/></label>
     <div className="text-xs text-slate-300">Type<div role="group" aria-label="Markup type" className="website-bundles-segment mt-1">{([['percent','%'],['flat','GH₵']] as const).map(([id,label])=><button key={id} type="button" aria-pressed={choice.kind===id} onClick={()=>choose({kind:id})}>{label}</button>)}</div></div>
    </div>}
    <label className="website-bundles-option"><input type="radio" name={`price-${variant}`} checked={choice.priceMode==='keep'} onChange={()=>choose({priceMode:'keep'})}/><span><strong>Keep my current prices</strong><small>Only change which bundles are on sale.</small></span></label>
   </div></div>
  <div><p className="text-xs font-semibold text-slate-300 mb-2" id={`bundle-sale-${variant}`}>3. On sale</p>
   <div role="radiogroup" aria-labelledby={`bundle-sale-${variant}`} className="grid gap-2">
    <label className="website-bundles-option"><input type="radio" name={`sale-${variant}`} checked={choice.activation==='enable'} onChange={()=>choose({activation:'enable'})}/><span><strong>Put every available bundle on sale</strong><small>In the networks you chose.</small></span></label>
    <label className="website-bundles-option"><input type="radio" name={`sale-${variant}`} checked={choice.activation==='keep'} onChange={()=>choose({activation:'keep'})}/><span><strong>Keep on/off as they are</strong><small>Only prices change.</small></span></label>
    <label className="website-bundles-option"><input type="radio" name={`sale-${variant}`} checked={choice.activation==='disable'} onChange={()=>choose({activation:'disable'})}/><span><strong>Take these networks off sale</strong><small>Customers stop seeing them. You can turn them on again later.</small></span></label>
   </div></div>
  <button type="button" className={`${button} w-full bg-emerald-500 text-black font-bold border-emerald-500`} onClick={previewSetup}>Preview setup</button>
  {plan&&s&&<div ref={reviewRef} className="website-bundles-review rounded-lg bg-slate-950 p-3 space-y-3" aria-label="Bundle setup preview" data-bundle-plan data-pricing-review>
   <h3 className="font-semibold">Preview · nothing saved yet</h3>
   <ul className="website-bundles-facts">
    <li><strong>{s.priceChanges}</strong> {s.priceChanges===1?'price changes':'prices change'}</li>
    <li><strong>{s.newlyEnabled}</strong> go on sale</li>
    <li><strong>{s.newlyDisabled}</strong> come off sale</li>
    <li><strong>{s.unchanged}</strong> stay the same</li>
    {s.ineligible>0&&<li><strong>{s.ineligible}</strong> not available from Mystery Hub</li>}
    {s.needsPrice>0&&<li data-tone="warn"><strong>{s.needsPrice}</strong> need a price first</li>}
   </ul>
   <p className="text-sm">After saving: <strong>{count(s.sellableAfter,'bundle')} on sale</strong>{s.sellableAfter!==s.sellableBefore?` (now ${s.sellableBefore})`:''}.</p>
   {s.needsPrice>0&&<p className="text-xs text-amber-200">Bundles without a valid price stay off sale. Choose “Add my profit” or set their prices in the list below.</p>}
   {s.liveRemoved>0&&published&&<p role="alert" className="text-sm text-amber-200">{count(s.liveRemoved,'bundle')} customers can buy right now will be removed from your store.</p>}
   {(s.priceChanges+s.newlyEnabled+s.newlyDisabled)>0&&<details className="text-sm"><summary className="cursor-pointer min-h-11 flex items-center text-slate-300">See each change</summary><ul className="max-h-48 overflow-y-auto">{pricingReviewLines(plan.rows.filter(r=>r.priceChanged||r.enabledChanged).map(r=>{const p=products.find(x=>x.id===r.id)!;return {id:r.id,networkName:p.networkName,dataAmount:p.dataAmount,before:r.before,after:r.after};})).map((line,i)=><li key={i} className="border-b border-slate-800 py-2">{line}</li>)}</ul></details>}
   <p className="text-xs text-slate-400">New prices show on your store as soon as you save. Orders already paid keep the price the customer paid.</p>
   <div className="flex flex-wrap gap-2">
    <button type="button" className={button} onClick={()=>setPlan(null)}>Cancel</button>
    <button type="button" className={button} disabled={!(s.priceChanges+s.newlyEnabled+s.newlyDisabled)} onClick={()=>{setDrafts(applyPlan(plan));setPlan(null);setNotice('Applied to your list below. Not saved yet: adjust any bundle, then save.');requestAnimationFrame(()=>listRef.current?.scrollIntoView({block:'start',behavior:'smooth'}));}}>Apply to list and adjust</button>
    <button type="button" className={`${button} flex-1 bg-emerald-500 text-black font-bold border-emerald-500`} disabled={busy||!(s.priceChanges+s.newlyEnabled+s.newlyDisabled)} onClick={()=>void save(applyPlan(plan))}>{busy?'Saving…':s.liveRemoved>0&&published?`Remove ${s.liveRemoved} and save`:'Confirm and save'}</button>
   </div>
  </div>}
 </fieldset>

 <div ref={listRef} className="scroll-mt-24 space-y-3">
 <h3 className="font-semibold">Each bundle</h3>
 <nav aria-label="Bundle pricing networks" className="flex flex-wrap gap-2">{NETWORKS.map(([id,label])=><button className={`${button} ${network===id?'border-emerald-500 text-emerald-300 bg-emerald-500/10':''}`} aria-pressed={network===id} key={id} onClick={()=>setNetwork(id)}>{label}</button>)}</nav>
 <fieldset disabled={busy} className="space-y-2 min-w-0">{products.filter(p=>p.network===network).map(p=>{const draft=drafts[p.id],message=sellerPriceError(p,draft);let earn='—';if(canPrice(p)&&!message&&draft.price){const retail=parseGhs(draft.price);earn=formatGhs(retail-p.wholesaleMinor!-storeReserve(retail,catalog.policy));}
 return <article key={p.id} data-bundle-row={p.id} data-on-sale={isSellableDraft(p,draft)?'yes':'no'} className="rounded-xl border border-slate-800 p-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_8rem_8rem_7rem] gap-x-3 gap-y-1 items-center">
 <div><h4 className="font-semibold text-sm">{p.networkName} {p.dataAmount}</h4><p className="text-xs text-slate-400">{canPrice(p)?`Min ${formatGhs(p.minimumMinor!)}`:'Not available yet'}</p></div>
 <label className="text-xs text-slate-400">Your price (GH₵)<input aria-label={`${p.networkName} ${p.dataAmount} selling price`} inputMode="decimal" enterKeyHint="done" className={`${field} w-full mt-1 text-white`} value={draft.price} disabled={!canPrice(p)} aria-invalid={!!message} aria-describedby={message?`price-error-${p.id}`:undefined} onChange={e=>update(p.id,{price:e.target.value})}/></label>
 <p className="text-xs text-slate-400">You earn about <strong className="text-slate-200">{earn}</strong></p><label className="flex items-center gap-2 min-h-11 text-xs"><input aria-label={`${p.networkName} ${p.dataAmount} on sale`} type="checkbox" checked={draft.enabled} disabled={!canPrice(p)} onChange={e=>update(p.id,{enabled:e.target.checked})}/>On sale</label>
 {message&&<p id={`price-error-${p.id}`} className="col-span-full text-xs text-rose-300">{message}</p>}
 </article>;})}{!products.some(p=>p.network===network)&&<p className="text-sm text-slate-400">No bundles on this network yet.</p>}</fieldset>
 </div>
 {error&&<div className="space-y-2"><p role="alert" className="text-sm text-rose-300">{error}</p><button className={button} disabled={busy} onClick={()=>{if(changed.length&&!conflict&&!window.confirm('Reload current prices and discard your unsaved pricing edits?'))return;setPlan(null);void load().then(()=>setError('')).catch(e=>setError(e.message));}}>Reload prices</button></div>}
 {reviewing&&changed.length>0&&<div ref={reviewRef} className="website-pricing-review rounded-xl border border-emerald-700/50 bg-[#0b131a] p-3" aria-label="Review price changes" data-pricing-review><h3 className="font-semibold">Check {changed.length===1?'this change':`these ${changed.length} changes`} before saving</h3><p className="text-sm my-2">After saving: <strong>{count(sellableCount(products,drafts),'bundle')} on sale</strong>.</p><ul>{pricingReviewLines(changed.map(p=>({id:p.id,networkName:p.networkName,dataAmount:p.dataAmount,before:original[p.id],after:drafts[p.id]}))).map((line,i)=><li key={changed[i].id}>{line}</li>)}</ul><p className="text-xs text-slate-400 mb-3">New prices show on your store as soon as you save. Orders already paid keep the price the customer paid.</p><div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>setReviewing(false)}>Back to prices</button><button type="button" className={`${button} flex-1 bg-emerald-500 text-black font-bold`} disabled={busy} onClick={()=>void save()}>Confirm and save</button></div></div>}
 {changed.length>0&&<div className="website-bundles-bar"><span role="status" className="text-xs text-slate-300">{busy?'Saving…':changed.length?`${count(changed.length,'unsaved change')}`:notice||'Everything is saved'}</span><button className={`${button} bg-emerald-500 text-black font-bold`} disabled={busy||!changed.length||changed.some(p=>!!sellerPriceError(p,drafts[p.id]))} onClick={()=>{const invalid=changed.find(p=>sellerPriceError(p,drafts[p.id]));if(invalid){setError(`${invalid.networkName} ${invalid.dataAmount}: ${sellerPriceError(invalid,drafts[invalid.id])}`);return;}setError('');setPlan(null);setReviewing(true);}}>{`Review ${changed.length===1?'1 change':`${changed.length||''} changes`.trim()}`}</button></div>}
 {notice&&changed.length>0&&<p role="status" className="text-xs text-emerald-300">{notice}</p>}
 </section>;
}
