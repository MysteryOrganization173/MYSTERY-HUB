import React,{useState,useEffect} from 'react';
import { MessageCircle, Mail, Phone } from 'lucide-react';
import { marketplaceControlRequest,ManagedCategory,MarketplaceInquiry } from '../../../services/marketplaceControls';
import { whatsappLink } from '../../../../shared/marketplacePolicy';
import { MarketplaceProduct } from '../../../types';
import { AdminButton,AdminEmpty,AdminLoading,AdminNotice,AdminPanel,ConfirmAction,StatusPill,adminField as field,adminLabel,type AdminTone } from '../ui/AdminUi';

const INQUIRY_STATUS:Record<string,{label:string;tone:AdminTone}>={new:{label:'New',tone:'warning'},contacted:{label:'Contacted',tone:'info'},resolved:{label:'Resolved',tone:'success'},closed:{label:'Closed',tone:'neutral'}};
const STATUS_FILTERS=[{id:'new',label:'New'},{id:'contacted',label:'Contacted'},{id:'resolved',label:'Resolved'},{id:'closed',label:'Closed'},{id:'',label:'All'}];

/** Inquiries inbox and category manager. `view` is controlled by the Marketplace tabs. */
export function MarketplaceControlPanels({token,view,categories,onCategoriesChanged,products,onChanged}:{token:string;view:'categories'|'inquiries';categories:ManagedCategory[];onCategoriesChanged:()=>void;products:MarketplaceProduct[];onChanged:()=>void}) {
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [slug,setSlug]=useState(''),[label,setLabel]=useState('');
 const [rows,setRows]=useState<MarketplaceInquiry[]>([]),[status,setStatus]=useState('new'),[search,setSearch]=useState(''),[searchDraft,setSearchDraft]=useState(''),[product,setProduct]=useState(''),[page,setPage]=useState(1),[total,setTotal]=useState(0);
 const [inquiryProducts,setInquiryProducts]=useState(products);
 async function run(action:()=>Promise<void>){setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Operation failed.');}finally{setBusy(false);}}
 async function load(){const params=new URLSearchParams({page:String(page),pageSize:'10'});if(status)params.set('status',status);if(search)params.set('search',search);if(product)params.set('productId',product);const data=await marketplaceControlRequest(`inquiries?${params}`,token);setRows(data.inquiries);setTotal(data.total);}
 useEffect(()=>{if(view!=='inquiries')return;setLoading(true);run(load).finally(()=>setLoading(false));},[view,status,search,product,page,token]);
 useEffect(()=>{const timer=setTimeout(()=>{if(searchDraft!==search){setSearch(searchDraft);setPage(1);}},350);return()=>clearTimeout(timer);},[searchDraft]);
 useEffect(()=>{let active=true;if(view==='inquiries')marketplaceControlRequest('products',token).then(data=>{if(active)setInquiryProducts(data.products);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load products.');});return()=>{active=false;};},[view,token]);
 async function categorySave(c:ManagedCategory,body:unknown){await marketplaceControlRequest(`categories/${encodeURIComponent(c.slug)}`,token,'PATCH',body);onCategoriesChanged();onChanged();}

 if(view==='categories')return <AdminPanel title="Categories" description="Deactivating a category hides its customer filter. Existing products and links remain; drafts need an active category before publishing.">
  {error&&<p role="alert" className="mb-3 text-sm text-rose-300">{error}</p>}
  <form className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-800 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={e=>{e.preventDefault();run(async()=>{await marketplaceControlRequest('categories',token,'POST',{slug,label});setSlug('');setLabel('');onCategoriesChanged();});}}>
   <label className={adminLabel}><span>Display label</span><input className={field} value={label} maxLength={100} required placeholder="e.g. Phone accessories" onChange={e=>{setLabel(e.target.value);if(!slug||slug===toSlug(label))setSlug(toSlug(e.target.value));}} /></label>
   <label className={adminLabel}><span>Stable slug</span><input className={`${field} font-mono`} value={slug} maxLength={64} required pattern="[a-z][a-z0-9_]+" title="Lowercase letters, numbers and underscores, starting with a letter" onChange={e=>setSlug(e.target.value)} /></label>
   <AdminButton variant="primary" disabled={busy}>Create Category</AdminButton>
  </form>
  <p className="mt-2 text-xs text-slate-500">The slug is permanent and used in links; you can rename the display label later.</p>
  <div className="mt-4 space-y-2">{categories.map(c=><CategoryRow key={`${c.slug}-${c.label}-${c.sort_order}-${c.active}`} category={c} busy={busy} save={body=>run(()=>categorySave(c,body))} />)}</div>
 </AdminPanel>;

 return <AdminPanel title="Customer inquiries" description="Questions and quote requests from product pages. Contact the customer, then mark where the conversation stands." actions={<AdminButton disabled={busy} onClick={()=>run(load)}>Refresh inquiries</AdminButton>}>
  <div role="group" aria-label="Filter inquiries by status" className="mb-3 flex flex-wrap gap-1.5">{STATUS_FILTERS.map(f=><button key={f.id||'all'} type="button" aria-pressed={status===f.id} onClick={()=>{setStatus(f.id);setPage(1);}} className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${status===f.id?'border-[#00c365]/60 bg-[#00c365]/10 text-[#7dffbf]':'border-slate-700 text-slate-300 hover:border-slate-500'}`}>{f.label}</button>)}</div>
  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
   <label className={adminLabel}><span className="text-xs">Search inquiries</span><input type="search" className={field} maxLength={200} value={searchDraft} placeholder="Name, phone, product or message" onChange={e=>setSearchDraft(e.target.value)} /></label>
   <label className={adminLabel}><span className="text-xs">Product</span><select className={field} value={product} onChange={e=>{setProduct(e.target.value);setPage(1);}}><option value="">All products</option>{inquiryProducts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  </div>
  {error&&<p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
  <div className="mt-4 space-y-3">
   {loading&&!rows.length?<AdminLoading label="Loading inquiries…"/>:!rows.length?<AdminEmpty title={status==='new'?'No new inquiries':'No inquiries match these filters'}>{status==='new'?'You are up to date. New questions from product pages land here.':'Try another status or clear the search.'}</AdminEmpty>:
   rows.map(row=><InquiryRow key={`${row.id}-${row.updated_at}`} row={row} busy={busy} save={body=>run(async()=>{await marketplaceControlRequest(`inquiries/${row.id}`,token,'PATCH',body);await load();onChanged();})} />)}
  </div>
  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400"><AdminButton disabled={page===1||busy} onClick={()=>setPage(page-1)}>Previous</AdminButton><span>Page {page} · {total} inquir{total===1?'y':'ies'}</span><AdminButton disabled={page*10>=total||busy} onClick={()=>setPage(page+1)}>Next</AdminButton></div>
 </AdminPanel>;
}
const toSlug=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^[^a-z]+/,'').replace(/_+$/,'').slice(0,64);

function CategoryRow({category:c,busy,save}:{category:ManagedCategory;busy:boolean;save:(body:unknown)=>void}) {
 const [label,setLabel]=useState(c.label),[position,setPosition]=useState(c.sort_order),[confirm,setConfirm]=useState(false);
 return <form className="grid grid-cols-[1fr_5rem] gap-2 rounded-2xl border border-slate-800 p-3 sm:grid-cols-[1fr_6rem_auto_auto] sm:items-end" onSubmit={e=>{e.preventDefault();save({label,sortOrder:position});}}>
  <label className={`${adminLabel} min-w-0`}><span className="flex items-center gap-2 text-xs"><span className="font-mono text-slate-400">{c.slug}</span>{!c.active&&<StatusPill tone="neutral" dot={false}>Hidden</StatusPill>}</span><input aria-label={`Label for ${c.slug}`} className={field} maxLength={100} required value={label} onChange={e=>setLabel(e.target.value)} /></label>
  <label className={adminLabel}><span className="text-xs">Position</span><input className={field} type="number" min={0} max={1000000} value={position} onChange={e=>setPosition(Number(e.target.value))} /></label>
  <AdminButton disabled={busy}>Save</AdminButton><AdminButton type="button" variant={c.active?'ghost':'secondary'} disabled={busy} onClick={()=>{if(c.active)setConfirm(true);else save({active:true});}}>{c.active?'Deactivate':'Activate'}</AdminButton>
  {confirm&&<ConfirmAction title={`Hide "${c.label}"?`} summary="Hide this category filter? Live products retain their category and stay accessible." confirmLabel="Deactivate category" busy={busy} onClose={()=>setConfirm(false)} onConfirm={()=>{setConfirm(false);save({active:false});}}/>}
 </form>;
}
function InquiryRow({row,busy,save}:{row:MarketplaceInquiry;busy:boolean;save:(body:unknown)=>void}) {
 const [note,setNote]=useState(row.admin_note||'');const link=whatsappLink(row.customer_phone);const state=INQUIRY_STATUS[row.status]||{label:row.status,tone:'neutral' as AdminTone};
 const transitions=row.status==='new'?['contacted','resolved','closed']:row.status==='contacted'?['resolved','closed']:['new'];
 return <article className={`min-w-0 space-y-3 break-words rounded-2xl border p-4 text-sm ${row.status==='new'?'border-amber-500/30 bg-amber-500/[0.04]':'border-slate-800 bg-[#0b1116]'}`}>
  <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold text-white">{row.customer_name||'Name not supplied'}</p><p className="text-xs text-slate-400">About <span className="text-slate-200">{row.product_name}</span> · {row.inquiry_type.replace(/_/g,' ')}{row.budget?` · Budget ${row.budget}`:''}</p></div><StatusPill tone={state.tone}>{state.label}</StatusPill></div>
  {row.message?<p className="whitespace-pre-wrap rounded-xl bg-slate-900/60 p-3 text-slate-200">{row.message}</p>:<p className="text-xs text-slate-500">No message</p>}
  <div className="flex flex-wrap gap-2">
   {link&&<a className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#00c365] px-4 text-sm font-semibold text-black hover:bg-[#00e575]" href={link} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4"/>Open WhatsApp</a>}
   {row.customer_phone&&<a className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 px-3 text-sm text-slate-200 hover:border-slate-500" href={`tel:${row.customer_phone}`}><Phone className="h-4 w-4"/>{row.customer_phone}</a>}
   {row.customer_email&&<a className="inline-flex min-h-11 min-w-0 items-center gap-2 break-all rounded-xl border border-slate-700 px-3 text-sm text-slate-200 hover:border-slate-500" href={`mailto:${row.customer_email}`}><Mail className="h-4 w-4 shrink-0"/>{row.customer_email}</a>}
   {!row.customer_phone&&!row.customer_email&&<AdminNotice tone="warning">No phone or email was supplied, so this customer cannot be contacted from here.</AdminNotice>}
  </div>
  <p className="text-xs text-slate-500">Received {new Date(row.created_at).toLocaleString()} · Updated {new Date(row.updated_at).toLocaleString()}{row.contacted_at&&` · First contacted ${new Date(row.contacted_at).toLocaleString()}`}</p>
  <details className="group" open={Boolean(row.admin_note)}><summary className="cursor-pointer text-xs font-semibold text-slate-300">Internal note</summary><label className="mt-2 block"><span className="sr-only">Internal note</span><textarea className={`${field} min-h-20`} maxLength={1000} value={note} placeholder="What was agreed, price quoted, next follow-up…" onChange={e=>setNote(e.target.value)} /></label><AdminButton className="mt-2" disabled={busy||note===(row.admin_note||'')} onClick={()=>save({adminNote:note})}>Save note</AdminButton></details>
  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">{transitions.map(s=><AdminButton key={s} variant={s==='contacted'||s==='resolved'?'secondary':'ghost'} disabled={busy} onClick={()=>save({status:s,adminNote:note})}>{s==='new'?'Reopen':s==='closed'?'Close':s==='contacted'?'Mark contacted':'Mark resolved'}</AdminButton>)}</div>
 </article>;
}

export function MarketplacePreviewAction({product,onDraftPreview}:{product:MarketplaceProduct;onDraftPreview:()=>void}) {
 const className='px-3 py-2 rounded-lg bg-slate-900 text-xs';
 return product.published&&!product.archived
  ? <a className={className} href={'/marketplace?product='+encodeURIComponent(product.slug || product.id)} target="_blank" rel="noopener noreferrer">Preview</a>
  : <button type="button" className={className} onClick={onDraftPreview}>Preview</button>;
}
