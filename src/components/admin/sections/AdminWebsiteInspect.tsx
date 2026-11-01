import React,{useEffect,useRef,useState} from 'react';
import {getAdminWebsiteInspection,forceUnpublishWebsite} from '../../../services/apiClient';
import type {AdminWebsiteInspection} from '../../../config/websiteAnalytics';
import {WEBSITE_TEMPLATES} from '../../../data/templates';
import {createAdminRequestScope} from '../../../utils/adminRequestScope';
import {adminWhatsAppUrl,adminMailtoUrl,adminPublishedWebsiteUrl} from '../../../utils/adminWebsiteContacts';
import {AdminSheet,AdminButton,AdminLoading,AdminError,AdminNotice,StatusPill,adminButton,adminField} from '../ui/AdminUi';
import {AdminResellerControls} from './AdminResellerControls';

const date=(value:string|null)=>value?new Date(value).toLocaleString():'Not published';
export function AdminWebsiteInspect({token,siteId,onClose,onUnpublished}:{token:string;siteId:string;onClose:()=>void;onUnpublished:()=>void}){
  const [loaded,setLoaded]=useState<{token:string;revision:number;site:AdminWebsiteInspection}|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[confirmation,setConfirmation]=useState(''),[notice,setNotice]=useState('');
  const [copyFailed,setCopyFailed]=useState(false);
  const scope=useRef(createAdminRequestScope()).current,mutation=useRef(false),copying=useRef(false);
  scope.setContext(token+':'+siteId);
  const site=loaded?.token===token&&loaded.revision===revision&&loaded.site.id===siteId?loaded.site:null;
  useEffect(()=>()=>scope.invalidate(),[scope,token,siteId]);
  useEffect(()=>{
    const current=scope.begin('inspect'),controller=new AbortController();setLoading(true);setError('');setConfirmation('');setNotice('');
    void getAdminWebsiteInspection(token,siteId,controller.signal).then(site=>{if(current())setLoaded({token,revision,site});}).catch(e=>{if(current()&&e.name!=='AbortError')setError('Website details could not be loaded. Please retry.');}).finally(()=>{if(current())setLoading(false);});
    return()=>{controller.abort();scope.invalidate('inspect');};
  },[token,siteId,revision]);
  const copy=async(value:string,label:string)=>{
    if(copying.current)return;copying.current=true;const current=scope.begin('copy');setNotice('');setCopyFailed(false);
    try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(value);if(current())setNotice(`${label} copied.`);}
    catch{if(current()){setCopyFailed(true);setNotice('Copy failed. Select the saved value and copy it manually.');}}finally{copying.current=false;}
  };
  const contact=(label:string,value:string|null,kind:'phone'|'email'|'whatsapp',owner=false)=>{
    const whatsApp=kind==='email'?null:adminWhatsAppUrl(value),mail=kind==='email'?adminMailtoUrl(value):null;
    return <div className="min-w-0 space-y-2"><dt className="text-xs text-slate-400">{label}</dt><dd className="select-text break-all text-sm">{value||'Not provided'}</dd>{value&&<div className="flex flex-wrap gap-2">
      <AdminButton className="px-3 text-xs" disabled={busy||loading} onClick={()=>void copy(value,label)}>Copy {label.toLowerCase()}</AdminButton>
      {whatsApp&&(kind==='whatsapp'||owner)&&<a className={adminButton('secondary','px-3 text-xs')} href={whatsApp} target="_blank" rel="noopener noreferrer">{owner?'Try owner phone on WhatsApp':'Open business WhatsApp'}</a>}
      {mail&&<a className={adminButton('secondary','px-3 text-xs')} href={mail}>Email {owner?'owner':'business'}</a>}
    </div>}</div>;
  };
  const unpublish=async()=>{
    if(!site||loading||mutation.current||confirmation!==site.slug)return;
    mutation.current=true;setBusy(true);setError('');const current=scope.begin('unpublish');
    try{await forceUnpublishWebsite(token,site.id,confirmation);if(current())onUnpublished();}
    catch(e:any){if(current())setError(e.message||'Unpublish failed. Please retry.');}
    finally{mutation.current=false;if(current())setBusy(false);}
  };
  const publicUrl=site?adminPublishedWebsiteUrl(site):null;
  return <AdminSheet title="Inspect Site" subtitle={site?.businessName||site?.name||'Loading saved project details'} onClose={onClose} busy={busy}>
    <div className="space-y-5 min-w-0">
      {loading&&<AdminLoading label="Loading current website and owner details…"/>}
      {error&&<AdminError title="Website action unavailable" message={error} onRetry={()=>setRevision(n=>n+1)}/>}
      {notice&&<p role={copyFailed?'alert':'status'} aria-live="polite" className={`text-sm ${copyFailed?'text-rose-300':'text-emerald-300'}`}>{notice}</p>}
      {site&&<>
        <div className="flex flex-wrap items-center justify-between gap-2"><StatusPill tone={site.status==='published'?'success':'neutral'}>{site.status==='published'?'Published':site.status==='draft'?'Draft':'Archived'}</StatusPill><AdminButton busy={loading} disabled={busy} onClick={()=>setRevision(n=>n+1)}>Refresh details</AdminButton></div>
        <section aria-label="Website project" className="space-y-3"><h3 className="font-semibold">Website project</h3><dl className="grid gap-3 sm:grid-cols-2 text-sm">
          {([['Website name',site.name],['Business name',site.businessName||'Not provided'],['Template',WEBSITE_TEMPLATES.find(t=>t.id===site.template_id)?.title||site.template_id],['Site ID',site.id],['Created',date(site.created_at)],['Updated',date(site.updated_at)],['Published',date(site.published_at)],['Ready images',String(site.assetCount)]] as const).map(([label,value])=><div key={label} className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className="break-words select-text">{value}</dd></div>)}
        </dl>{publicUrl?<a className={adminButton('primary','mt-2 text-xs')} href={publicUrl} target="_blank" rel="noopener noreferrer">Open Public Site</a>:<p className="text-sm text-slate-400">{site.status==='draft'?'Draft is private; no public URL.':'No published public website.'}</p>}</section>
        <section aria-label="Business contact" className="border-t border-slate-800 pt-4 space-y-3"><h3 className="font-semibold">Business contact</h3><p className="text-xs text-slate-400">Saved project settings. Unpublished edits may differ from the live website. Use the configured business WhatsApp for business enquiries.</p><dl className="space-y-4">{contact('Business WhatsApp',site.businessContact.whatsapp,'whatsapp')}{contact('Business phone',site.businessContact.phone,'phone')}{contact('Business email',site.businessContact.email,'email')}</dl></section>
        <section aria-label="Registered owner account" className="border-t border-slate-800 pt-4 space-y-3"><h3 className="font-semibold">Registered owner account</h3><p className="text-xs text-slate-400">Private account details, separate from business contacts. WhatsApp availability for the account phone has not been verified.</p><dl className="space-y-4"><div><dt className="text-xs text-slate-400">Owner name</dt><dd className="break-words">{site.owner.name||'Not provided'}</dd></div>{contact('Owner phone',site.owner.phone,'phone',true)}{contact('Owner email',site.owner.email,'email',true)}</dl></section>
        {site.template_id==='tmpl-data-reseller'&&<AdminResellerControls token={token} siteId={site.id}/>}
        {site.status==='published'&&<section className="border-t border-slate-800 pt-4 space-y-3"><AdminNotice tone="warning" title="Force Unpublish">Hides the public site without editing the owner’s content. This action is audited.</AdminNotice><label className="block space-y-2 text-sm"><span>Type {site.slug} to confirm</span><input autoComplete="off" spellCheck={false} value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy||loading} className={adminField}/></label><AdminButton variant="danger" busy={busy} disabled={loading||confirmation!==site.slug} onClick={()=>void unpublish()}>Confirm Force Unpublish</AdminButton></section>}
      </>}
    </div>
  </AdminSheet>;
}
