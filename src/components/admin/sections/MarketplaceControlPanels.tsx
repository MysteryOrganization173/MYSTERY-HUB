import React,{useState,useEffect,useRef} from 'react';
import { MessageCircle, Mail, Phone } from 'lucide-react';
import { marketplaceControlRequest,ManagedCategory,MarketplaceInquiry } from '../../../services/marketplaceControls';
import { whatsappLink } from '../../../../shared/marketplacePolicy';
import {LeadWorkflowEditor} from './LeadWorkflowEditor';
import {readLeadWorkflow} from '../../../../shared/leadOperations';
import { MarketplaceProduct } from '../../../types';
import { categoryMismatches } from '../../../utils/marketplaceCategoryCheck';
import { AdminButton,AdminEmpty,AdminLoading,AdminNotice,AdminPanel,ConfirmAction,StatusPill,adminField as field,adminLabel,type AdminTone } from '../ui/AdminUi';

const INQUIRY_STATUS:Record<string,{label:string;tone:AdminTone}>={new:{label:'New',tone:'warning'},contacted:{label:'Contacted',tone:'info'},resolved:{label:'Resolved',tone:'success'},closed:{label:'Closed',tone:'neutral'}};
const STATUS_FILTERS=[{id:'new',label:'New'},{id:'contacted',label:'Contacted'},{id:'resolved',label:'Resolved'},{id:'closed',label:'Closed'},{id:'',label:'All'}];

/** Inquiries inbox and category manager. `view` is controlled by the Marketplace tabs. */
export function MarketplaceControlPanels({token,view,categories,onCategoriesChanged,products,onChanged,onEditProduct,initialFilter=''}:{initialFilter?:string;token:string;view:'categories'|'inquiries';categories:ManagedCategory[];onCategoriesChanged:()=>void;products:MarketplaceProduct[];onChanged:()=>void;onEditProduct?:(product:MarketplaceProduct)=>void}) {
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [slug,setSlug]=useState(''),[label,setLabel]=useState('');
 const [rows,setRows]=useState<MarketplaceInquiry[]>([]),[status,setStatus]=useState(['','new','contacted','resolved','closed'].includes(initialFilter)?initialFilter:''),[search,setSearch]=useState(''),[searchDraft,setSearchDraft]=useState(''),[product,setProduct]=useState(''),[page,setPage]=useState(1),[total,setTotal]=useState(0);
 const [inquiryProducts,setInquiryProducts]=useState(products),[notice,setNotice]=useState('');
 const [followUp,setFollowUp]=useState(['due','overdue','recent'].includes(initialFilter)?initialFilter:''),[inquiryId,setInquiryId]=useState(initialFilter.startsWith('inq_')?initialFilter:'');
 const sequence=useRef(0),context=useRef(token);context.current=token;
 useEffect(()=>()=>{sequence.current++;},[token]);
 async function run(action:()=>Promise<void>){const owner=token;setBusy(true);setError('');try{await action();}catch(e){if(context.current===owner)setError(e instanceof Error?e.message:'Operation failed.');}finally{if(context.current===owner)setBusy(false);}}
 async function load(){const ticket=++sequence.current;const params=new URLSearchParams({page:String(page),pageSize:'10'});if(status)params.set('status',status);if(followUp)params.set('followUp',followUp);if(inquiryId)params.set('inquiryId',inquiryId);if(search)params.set('search',search);if(product)params.set('productId',product);try{const data=await marketplaceControlRequest(`inquiries?${params}`,token);if(ticket===sequence.current){if(page>1&&(page-1)*10>=data.total){setPage(1);return;}setRows(data.inquiries);setTotal(data.total);}}catch(e){if(ticket===sequence.current)throw e;}}
 useEffect(()=>{if(view!=='inquiries')return;let active=true;setRows([]);setLoading(true);run(load).finally(()=>{if(active)setLoading(false);});return()=>{active=false;sequence.current++;};},[view,status,search,product,page,token,followUp,inquiryId]);
 useEffect(()=>{const timer=setTimeout(()=>{if(searchDraft!==search){setSearch(searchDraft);setPage(1);}},350);return()=>clearTimeout(timer);},[searchDraft]);
 useEffect(()=>{let active=true;if(view==='inquiries'||view==='categories')marketplaceControlRequest('products',token).then(data=>{if(active)setInquiryProducts(data.products);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load products.');});return()=>{active=false;};},[view,token,products]);
 async function categorySave(c:ManagedCategory,body:unknown){await marketplaceControlRequest(`categories/${encodeURIComponent(c.slug)}`,token,'PATCH',body);onCategoriesChanged();onChanged();}

 if(view==='categories')return <AdminPanel title="Categories" description="Deactivating a category hides its customer filter. Existing products and links remain; drafts need an active category before publishing.">
  {error&&<p role="alert" className="mb-3 text-sm text-rose-300">{error}</p>}
  <form className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-800 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={e=>{e.preventDefault();run(async()=>{await marketplaceControlRequest('categories',token,'POST',{slug,label});setSlug('');setLabel('');onCategoriesChanged();});}}>
   <label className={adminLabel}><span>Display label</span><input className={field} value={label} maxLength={100} required placeholder="e.g. Phone accessories" onChange={e=>{setLabel(e.target.value);if(!slug||slug===toSlug(label))setSlug(toSlug(e.target.value));}} /></label>
   <label className={adminLabel}><span>Stable slug</span><input className={`${field} font-mono`} value={slug} maxLength={64} required pattern="[a-z][a-z0-9_]+" title="Lowercase letters, numbers and underscores, starting with a letter" onChange={e=>setSlug(e.target.value)} /></label>
   <AdminButton variant="primary" disabled={busy}>Create Category</AdminButton>
  </form>
  <p className="mt-2 text-xs text-slate-500">The slug is permanent and used in links; you can rename the display label later.</p>
  <CategoryCheck products={inquiryProducts} categories={categories} onEdit={onEditProduct} />
  <div className="mt-4 space-y-2">{categories.map(c=><CategoryRow key={`${c.slug}-${c.label}-${c.sort_order}-${c.active}`} category={c} live={inquiryProducts.filter(p=>p.category===c.slug&&p.published&&!p.archived).length} busy={busy} save={body=>run(()=>categorySave(c,body))} />)}</div>
 </AdminPanel>;

 return <AdminPanel title="Customer inquiries" description="Questions and quote requests from product pages. Contact the customer, then mark where the conversation stands." actions={<AdminButton disabled={busy} onClick={()=>run(load)}>Refresh inquiries</AdminButton>}>
  <div role="group" aria-label="Filter inquiries by status" className="mb-3 flex flex-wrap gap-1.5">{STATUS_FILTERS.map(f=><button key={f.id||'all'} type="button" aria-pressed={status===f.id} onClick={()=>{setStatus(f.id);setFollowUp('');setInquiryId('');setPage(1);}} className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${status===f.id?'border-[#00c365]/60 bg-[#00c365]/10 text-[#7dffbf]':'border-slate-700 text-slate-300 hover:border-slate-500'}`}>{f.label}</button>)}</div>
  {notice&&<p role="status" className="my-2 text-sm text-emerald-300">{notice}</p>}
  <label className={adminLabel}>Follow-up view<select aria-label="Marketplace follow-up filter" className={field} value={followUp} onChange={e=>{setFollowUp(e.target.value);setStatus('');setInquiryId('');setPage(1);}}><option value="">All dates</option><option value="due">Due today</option><option value="overdue">Overdue</option><option value="recent">Updated in last 7 days</option></select></label>
  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
   <label className={adminLabel}><span className="text-xs">Search inquiries</span><input type="search" className={field} maxLength={200} value={searchDraft} placeholder="Name, phone, product or message" onChange={e=>setSearchDraft(e.target.value)} /></label>
   <label className={adminLabel}><span className="text-xs">Product</span><select className={field} value={product} onChange={e=>{setProduct(e.target.value);setPage(1);}}><option value="">All products</option>{inquiryProducts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  </div>
  {error&&<p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
  <div className="mt-4 space-y-3">
   {loading&&!rows.length?<AdminLoading label="Loading inquiries…"/>:!rows.length?<AdminEmpty title={status==='new'?'No new inquiries':'No inquiries match these filters'}>{status==='new'?'You are up to date. New questions from product pages land here.':'Try another status or clear the search.'}</AdminEmpty>:
   rows.map(row=><InquiryRow key={`${token}-${row.id}-${row.workflow_version||0}`} row={row} token={token} onReload={()=>run(load)} onSaved={()=>{setNotice('Follow-up saved.');void run(load);onChanged();}} />)}
  </div>
  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400"><AdminButton disabled={page===1||busy} onClick={()=>setPage(page-1)}>Previous</AdminButton><span>Page {page} · {total} inquir{total===1?'y':'ies'}</span><AdminButton disabled={page*10>=total||busy} onClick={()=>setPage(page+1)}>Next</AdminButton></div>
 </AdminPanel>;
}
const toSlug=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^[^a-z]+/,'').replace(/_+$/,'').slice(0,64);

/** Flags products whose own name points at another category; the admin decides in the editor. */
function CategoryCheck({products,categories,onEdit}:{products:MarketplaceProduct[];categories:ManagedCategory[];onEdit?:(product:MarketplaceProduct)=>void}) {
 const rows=categoryMismatches(products,categories);const label=(slug:string)=>categories.find(c=>c.slug===slug)?.label||slug;
 const live=new Set(products.filter(p=>p.published&&!p.archived).map(p=>p.category)).size;
 return <section aria-label="Category check" className="mt-4 rounded-2xl border border-slate-800 bg-[#0b1116] p-3 text-sm">
  <p className="font-semibold text-white">Category check</p>
  <p className="mt-0.5 text-xs text-slate-400">Customers see category tiles once live products sit in at least two categories. Live products now use {live} {live===1?'category':'categories'}.</p>
  {!rows.length?<p className="mt-2 text-xs text-slate-300">No product names point at a different category.</p>:<ul className="mt-3 space-y-2">{rows.map(r=>{const product=products.find(p=>p.id===r.productId)!;return <li key={r.productId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-2.5">
   <div className="min-w-0"><p className="truncate font-medium text-slate-100">{r.productName}</p><p className="text-xs text-slate-400">{label(r.current)} → suggested <span className="text-amber-200">{r.suggestedLabel}</span> · {r.reason}</p></div>
   {onEdit&&<AdminButton onClick={()=>onEdit(product)}>Review</AdminButton>}
  </li>;})}</ul>}
 </section>;
}

function CategoryRow({category:c,live,busy,save}:{category:ManagedCategory;live:number;busy:boolean;save:(body:unknown)=>void}) {
 const [label,setLabel]=useState(c.label),[position,setPosition]=useState(c.sort_order),[confirm,setConfirm]=useState(false);
 return <form className="grid grid-cols-[1fr_5rem] gap-2 rounded-2xl border border-slate-800 p-3 sm:grid-cols-[1fr_6rem_auto_auto] sm:items-end" onSubmit={e=>{e.preventDefault();save({label,sortOrder:position});}}>
  <label className={`${adminLabel} min-w-0`}><span className="flex items-center gap-2 text-xs"><span className="font-mono text-slate-400">{c.slug}</span><span className="text-slate-500">{live} live</span>{!c.active&&<StatusPill tone="neutral" dot={false}>Hidden</StatusPill>}</span><input aria-label={`Label for ${c.slug}`} className={field} maxLength={100} required value={label} onChange={e=>setLabel(e.target.value)} /></label>
  <label className={adminLabel}><span className="text-xs">Position</span><input className={field} type="number" min={0} max={1000000} value={position} onChange={e=>setPosition(Number(e.target.value))} /></label>
  <AdminButton disabled={busy}>Save</AdminButton><AdminButton type="button" variant={c.active?'ghost':'secondary'} disabled={busy} onClick={()=>{if(c.active)setConfirm(true);else save({active:true});}}>{c.active?'Deactivate':'Activate'}</AdminButton>
  {confirm&&<ConfirmAction title={`Hide "${c.label}"?`} summary="Hide this category filter? Live products retain their category and stay accessible." confirmLabel="Deactivate category" busy={busy} onClose={()=>setConfirm(false)} onConfirm={()=>{setConfirm(false);save({active:false});}}/>}
 </form>;
}
function InquiryRow({row,token,onSaved,onReload}:{row:MarketplaceInquiry;token:string;onSaved:()=>void;onReload:()=>void}) {
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
  <LeadWorkflowEditor token={token} source="marketplace" id={row.id} auditId={row.id} value={readLeadWorkflow('marketplace',row)} onSaved={onSaved} onReload={onReload}/>
 </article>;
}

export function MarketplacePreviewAction({product,onDraftPreview}:{product:MarketplaceProduct;onDraftPreview:()=>void}) {
 const className='px-3 py-2 rounded-lg bg-slate-900 text-xs';
 return product.published&&!product.archived
  ? <a className={className} href={'/marketplace?product='+encodeURIComponent(product.slug || product.id)} target="_blank" rel="noopener noreferrer">Preview</a>
  : <button type="button" className={className} onClick={onDraftPreview}>Preview</button>;
}
