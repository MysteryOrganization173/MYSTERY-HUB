import React,{useState,useEffect} from 'react';
import { marketplaceControlRequest,ManagedCategory,MarketplaceInquiry } from '../../../services/marketplaceControls';
import { whatsappLink } from '../../../../shared/marketplacePolicy';
import { MarketplaceProduct } from '../../../types';
const field='min-w-0 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-white';
const button='rounded-lg border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800';
export function MarketplaceControlPanels({token,categories,onCategoriesChanged,products,onChanged}:{token:string;categories:ManagedCategory[];onCategoriesChanged:()=>void;products:MarketplaceProduct[];onChanged:()=>void}) {
 const [tab,setTab]=useState<'categories'|'inquiries'|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [slug,setSlug]=useState(''),[label,setLabel]=useState('');
 const [rows,setRows]=useState<MarketplaceInquiry[]>([]),[status,setStatus]=useState(''),[search,setSearch]=useState(''),[product,setProduct]=useState(''),[page,setPage]=useState(1),[total,setTotal]=useState(0);
 const [inquiryProducts,setInquiryProducts]=useState(products);
 async function run(action:()=>Promise<void>){setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Operation failed.');}finally{setBusy(false);}}
 async function load(){const params=new URLSearchParams({page:String(page),pageSize:'10'});if(status)params.set('status',status);if(search)params.set('search',search);if(product)params.set('productId',product);const data=await marketplaceControlRequest(`inquiries?${params}`,token);setRows(data.inquiries);setTotal(data.total);}
 useEffect(()=>{if(tab==='inquiries')run(load);},[tab,status,search,product,page,token]);
 useEffect(()=>{let active=true;if(tab==='inquiries')marketplaceControlRequest('products',token).then(data=>{if(active)setInquiryProducts(data.products);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load products.');});return()=>{active=false;};},[tab,token]);
 async function categorySave(c:ManagedCategory,body:unknown){await marketplaceControlRequest(`categories/${encodeURIComponent(c.slug)}`,token,'PATCH',body);onCategoriesChanged();onChanged();}
 return <section className="min-w-0 space-y-3 rounded-xl border border-slate-800 p-3">
  <div className="flex flex-wrap gap-2">{(['categories','inquiries'] as const).map(t=><button key={t} className={button} aria-expanded={tab===t} onClick={()=>{setError('');setTab(tab===t?null:t);}}>{t==='categories'?'Categories':'Inquiries'}</button>)}</div>
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
  {tab==='categories'&&<div className="space-y-3">
   <p className="text-xs text-slate-400">Deactivating a category hides its customer filter. Existing products and links remain; drafts need an active category before publishing.</p>
   <form className="grid grid-cols-1 sm:grid-cols-3 gap-2" onSubmit={e=>{e.preventDefault();run(async()=>{await marketplaceControlRequest('categories',token,'POST',{slug,label});setSlug('');setLabel('');onCategoriesChanged();});}}>
    <label>Stable slug<input className={field} value={slug} maxLength={64} required pattern="[a-z][a-z0-9_]+" onChange={e=>setSlug(e.target.value)} /></label>
    <label>Display label<input className={field} value={label} maxLength={100} required onChange={e=>setLabel(e.target.value)} /></label>
    <button className={button} disabled={busy}>Create Category</button>
   </form>
   {categories.map(c=><CategoryRow key={`${c.slug}-${c.label}-${c.sort_order}-${c.active}`} category={c} busy={busy} save={body=>run(()=>categorySave(c,body))} />)}
  </div>}
  {tab==='inquiries'&&<div className="space-y-3">
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
    <label>Search inquiries<input className={field} maxLength={200} value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} /></label>
    <label>Status<select className={field} value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">All</option>{['new','contacted','resolved','closed'].map(s=><option key={s}>{s}</option>)}</select></label>
    <label>Product<select className={field} value={product} onChange={e=>{setProduct(e.target.value);setPage(1);}}><option value="">All products</option>{inquiryProducts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   </div>
   <button className={button} disabled={busy} onClick={()=>run(load)}>Refresh inquiries</button>
   {!rows.length&&<p className="text-sm text-slate-400">No inquiries match these filters.</p>}
   {rows.map(row=><InquiryRow key={`${row.id}-${row.updated_at}`} row={row} busy={busy} save={body=>run(async()=>{await marketplaceControlRequest(`inquiries/${row.id}`,token,'PATCH',body);await load();onChanged();})} />)}
   <div className="flex flex-wrap items-center gap-3 text-xs"><button className={button} disabled={page===1||busy} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page} · {total} inquiries</span><button className={button} disabled={page*10>=total||busy} onClick={()=>setPage(page+1)}>Next</button></div>
  </div>}
 </section>;
}
function CategoryRow({category:c,busy,save}:{category:ManagedCategory;busy:boolean;save:(body:unknown)=>void}) {
 const [label,setLabel]=useState(c.label),[position,setPosition]=useState(c.sort_order);
 return <form className="grid grid-cols-1 sm:grid-cols-[1fr_5rem_auto_auto] gap-2 items-end border-t border-slate-800 pt-3" onSubmit={e=>{e.preventDefault();save({label,sortOrder:position});}}>
  <label className="min-w-0 text-xs">{c.slug}<input aria-label={`Label for ${c.slug}`} className={field} maxLength={100} required value={label} onChange={e=>setLabel(e.target.value)} /></label>
  <label className="text-xs">Position<input className={field} type="number" min={0} max={1000000} value={position} onChange={e=>setPosition(Number(e.target.value))} /></label>
  <button className={button} disabled={busy}>Save</button><button type="button" className={button} disabled={busy} onClick={()=>{if(!c.active||window.confirm('Hide this category filter? Live products retain their category and stay accessible.'))save({active:!c.active});}}>{c.active?'Deactivate':'Activate'}</button>
 </form>;
}
function InquiryRow({row,busy,save}:{row:MarketplaceInquiry;busy:boolean;save:(body:unknown)=>void}) {
 const [note,setNote]=useState(row.admin_note||'');const link=whatsappLink(row.customer_phone);
 return <article className="min-w-0 rounded-xl border border-slate-700 p-3 space-y-2 text-sm break-words">
  <div className="flex flex-wrap justify-between gap-2"><strong>{row.product_name}</strong><span>{row.status}</span></div>
  <p>{row.customer_name||'Name not supplied'} · {row.customer_phone||'Phone not supplied'} · {row.customer_email||'Email not supplied'}</p>
  <p>{row.inquiry_type} · Budget: {row.budget||'Not specified'}</p><p className="whitespace-pre-wrap">{row.message||'No message'}</p>
  <p className="text-xs text-slate-400">Created {new Date(row.created_at).toLocaleString()} · Updated {new Date(row.updated_at).toLocaleString()}{row.contacted_at&&` · Contacted ${new Date(row.contacted_at).toLocaleString()}`}</p>
  <label className="block">Internal note<textarea className={field} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} /></label>
  <div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={()=>save({adminNote:note})}>Save note</button>{['contacted','resolved','closed','new'].filter(s=>s!==row.status).map(s=><button key={s} className={button} disabled={busy} onClick={()=>save({status:s,adminNote:note})}>{s==='new'?'Reopen':s==='closed'?'Close':`Mark ${s}`}</button>)}{link&&<a className={button} href={link} target="_blank" rel="noopener noreferrer">Open WhatsApp</a>}</div>
 </article>;
}

export function MarketplacePreviewAction({product,onDraftPreview}:{product:MarketplaceProduct;onDraftPreview:()=>void}) {
 const className='px-3 py-2 rounded-lg bg-slate-900 text-xs';
 return product.published&&!product.archived
  ? <a className={className} href={'/marketplace?product='+encodeURIComponent(product.slug || product.id)} target="_blank" rel="noopener noreferrer">Preview</a>
  : <button type="button" className={className} onClick={onDraftPreview}>Preview</button>;
}
