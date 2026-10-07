import React,{useEffect,useRef,useState} from 'react';
import {websiteBusinessRequest} from '../../services/websiteBusinessApi';
import {formatGhs,parseGhs} from '../../../shared/money';
import {storeReserve} from '../../../shared/storeEconomics';
import {bulkSellerPrices,canPrice,sellerDrafts,sellerPriceError,type SellerBundle,type SellerDraft} from '../../utils/websitePricing';
const button='min-h-11 px-3 rounded-lg border border-slate-700 text-sm disabled:opacity-50';
const field='min-h-11 rounded-lg px-3 bg-slate-950 border border-slate-700 min-w-0';
export function WebsiteBundlePricing({siteId,token,onDirty}:{siteId:string;token:string;onDirty?:(dirty:boolean)=>void}) {
 const [catalog,setCatalog]=useState<any>(null),[drafts,setDrafts]=useState<Record<string,SellerDraft>>({}),[network,setNetwork]=useState('mtn');
 const [scope,setScope]=useState('all'),[kind,setKind]=useState<'percent'|'flat'>('percent'),[markup,setMarkup]=useState('10');
 const [preview,setPreview]=useState<ReturnType<typeof bulkSellerPrices>|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const alive=useRef(true),saving=useRef(false),identity=useRef('');
 identity.current=`${siteId}:${token}`;
 const load=async()=>{const expected=identity.current;const result=await websiteBusinessRequest(`websites/${siteId}/bundles`,token);if(alive.current&&identity.current===expected){setCatalog(result);setDrafts(sellerDrafts(result.products));}};
 useEffect(()=>{alive.current=true;void load().catch(e=>{if(alive.current)setError(e.message);});return()=>{alive.current=false;};},[siteId,token]);
 const products:SellerBundle[]=catalog?.products||[];
 const original=sellerDrafts(products);
 const changed=products.filter(p=>drafts[p.id]&&(drafts[p.id].price!==original[p.id].price||drafts[p.id].enabled!==original[p.id].enabled));
 useEffect(()=>{onDirty?.(changed.length>0);},[changed.length,onDirty]);
 useEffect(()=>{if(!changed.length)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[changed.length]);
 const update=(id:string,patch:Partial<SellerDraft>)=>{setDrafts(prev=>({...prev,[id]:{...prev[id],...patch}}));setNotice('');setPreview(null);};
 const save=async()=>{if(saving.current||!catalog)return;const invalid=changed.find(p=>sellerPriceError(p,drafts[p.id]));if(invalid){setError(`${invalid.networkName} ${invalid.dataAmount}: ${sellerPriceError(invalid,drafts[invalid.id])}`);return;}
   saving.current=true;setBusy(true);setError('');setNotice('');try{const result=await websiteBusinessRequest(`websites/${siteId}/bundles`,token,{expectedVersion:catalog.version,products:changed.map(p=>({productId:p.id,enabled:drafts[p.id].enabled,retailMinor:drafts[p.id].price?parseGhs(drafts[p.id].price):0}))},'PUT');
   if(alive.current){const savedProducts=products.map(p=>result.products[p.id]?{...p,...result.products[p.id]}:p);setCatalog({...catalog,version:result.version,products:savedProducts});setDrafts(sellerDrafts(savedProducts));setPreview(null);setNotice('Saved ✓');}
   }catch(e:any){if(alive.current)setError(e.message);}finally{saving.current=false;if(alive.current)setBusy(false);}};
 if(!catalog)return <div role="status">{error?<><p role="alert">{error}</p><button className={button} onClick={()=>{setError('');void load().catch(e=>setError(e.message));}}>Try again</button></>:'Loading bundles & prices…'}</div>;
 const unconfigured=products.some(p=>!canPrice(p));
 return <section aria-label="Bundles & Pricing" className="space-y-4">
 <p className="text-sm text-slate-400">Set your store prices. Estimated earnings allow for bundle costs and payment processing.</p>
 {unconfigured&&<p role="status" className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-3 text-sm text-amber-200">Pricing is not ready yet for some bundles. Mystery Hub must configure wholesale pricing before these bundles can be sold. Configured bundles remain editable.</p>}
 <fieldset disabled={busy} className="min-w-0 rounded-xl border border-slate-700 p-3 space-y-3"><legend className="px-1 font-semibold">Quick pricing</legend>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 <label className="text-xs text-slate-300 col-span-2 sm:col-span-1">Apply to<select className={`${field} w-full mt-1`} value={scope} onChange={e=>{setScope(e.target.value);setPreview(null);}}>{[['all','All Networks'],['mtn','MTN'],['telecel','Telecel'],['airteltigo','AirtelTigo']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
 <label className="text-xs text-slate-300">Markup<input aria-label="Markup amount" inputMode="decimal" className={`${field} w-full mt-1`} value={markup} onChange={e=>{setMarkup(e.target.value);setPreview(null);}}/></label>
 <label className="text-xs text-slate-300">Type<select aria-label="Markup type" className={`${field} w-full mt-1`} value={kind} onChange={e=>{setKind(e.target.value as 'percent'|'flat');setPreview(null);}}><option value="percent">%</option><option value="flat">GH₵</option></select></label>
 <button type="button" className={`${button} col-span-2 sm:col-span-1 self-end text-emerald-300`} disabled={!products.some(canPrice)} onClick={()=>{try{const next=bulkSellerPrices(products,scope,kind,markup);if(!next.length)throw new Error('No configured bundles in this selection.');setPreview(next);setError('');}catch(e:any){setError(e.message);}}}>Preview Changes</button>
 </div><p className="text-xs text-slate-400">Markup starts from each bundle’s minimum safe selling price. Only configured bundles are included.</p>
 {preview&&<div aria-label="Bulk pricing preview" className="rounded-lg bg-slate-950 p-3 space-y-2"><h3 className="font-semibold">{preview.length} bundles will change</h3><div className="max-h-48 overflow-y-auto">{preview.map(next=>{const p=products.find(p=>p.id===next.id)!;return <p key={p.id} className="flex flex-wrap justify-between gap-2 text-sm border-b border-slate-800 py-2"><span>{p.networkName} {p.dataAmount}</span><span>{drafts[p.id].price?`GH₵${drafts[p.id].price}`:'No price'} → {formatGhs(next.retailMinor)}</span></p>;})}</div><div className="flex flex-wrap gap-2"><button className={button} onClick={()=>setPreview(null)}>Cancel preview</button><button className={`${button} bg-emerald-500 text-black font-semibold`} onClick={()=>{setDrafts(prev=>{const next={...prev};for(const row of preview)next[row.id]={...next[row.id],price:(row.retailMinor/100).toFixed(2)};return next;});setPreview(null);setNotice('Prices applied locally. Review and Save Changes.');}}>Apply to {preview.length} Bundles</button></div></div>}
 </fieldset>
 <nav aria-label="Bundle pricing networks" className="flex flex-wrap gap-2">{[['mtn','MTN'],['telecel','Telecel'],['airteltigo','AirtelTigo']].map(([id,label])=><button className={`${button} ${network===id?'border-emerald-500 text-emerald-300 bg-emerald-500/10':''}`} aria-pressed={network===id} key={id} onClick={()=>setNetwork(id)}>{label}</button>)}</nav>
 <fieldset disabled={busy} className="space-y-2 min-w-0">{products.filter(p=>p.network===network).map(p=>{const draft=drafts[p.id],message=sellerPriceError(p,draft);let earn='—';if(canPrice(p)&&!message&&draft.price){const retail=parseGhs(draft.price);earn=formatGhs(retail-p.wholesaleMinor!-storeReserve(retail,catalog.policy));}
 return <article key={p.id} className="rounded-xl border border-slate-800 p-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_8rem_8rem_6rem] gap-x-3 gap-y-1 items-center">
 <div><h3 className="font-semibold text-sm">{p.networkName} {p.dataAmount}</h3><p className="text-xs text-slate-400">Min {canPrice(p)?formatGhs(p.minimumMinor!):'—'}</p></div>
 <label className="text-xs text-slate-400">Sell (GH₵)<input aria-label={`${p.networkName} ${p.dataAmount} selling price`} inputMode="decimal" className={`${field} w-full mt-1 text-white`} value={draft.price} disabled={!canPrice(p)} aria-invalid={!!message} aria-describedby={message?`price-error-${p.id}`:undefined} onChange={e=>update(p.id,{price:e.target.value})}/></label>
 <p className="text-xs text-slate-400">Earn <strong className="text-slate-200">{earn}</strong></p><label className="flex items-center gap-2 min-h-11 text-xs"><input aria-label={`${p.networkName} ${p.dataAmount} enabled`} type="checkbox" checked={draft.enabled} disabled={!canPrice(p)} onChange={e=>update(p.id,{enabled:e.target.checked})}/>Enabled</label>
 {message&&<p id={`price-error-${p.id}`} className="col-span-full text-xs text-rose-300">{message}</p>}
 </article>;})}{!products.some(p=>p.network===network)&&<p className="text-sm text-slate-400">No bundles on this network yet.</p>}</fieldset>
 {error&&<div className="space-y-2"><p role="alert" className="text-sm text-rose-300">{error}</p><button className={button} disabled={busy} onClick={()=>{if(changed.length&&!window.confirm('Reload current prices and discard your unsaved pricing edits?'))return;setPreview(null);void load().then(()=>setError('')).catch(e=>setError(e.message));}}>Reload prices</button></div>}
 <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-[#0b131a] p-3 shadow-xl"><span role="status" className="text-xs text-slate-300">{changed.length?`${changed.length} unsaved changes`:notice||'Prices are up to date'}</span><button className={`${button} bg-emerald-500 text-black font-bold`} disabled={busy||!changed.length||changed.some(p=>!!sellerPriceError(p,drafts[p.id]))} onClick={()=>void save()}>{busy?'Saving…':'Save Changes'}</button></div>
 {notice&&changed.length>0&&<p role="status" className="text-xs text-emerald-300">{notice}</p>}
 </section>;
}
