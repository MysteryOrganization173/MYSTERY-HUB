import React, { useEffect, useRef, useState } from 'react';
import type { WebsiteSiteRecord } from '../../types';
import { orderedWebsiteTemplates } from '../../data/templates';
import { changeWebsiteTemplate, deleteWebsiteOnServer } from '../../services/apiClient';
import { migrateWebsiteTemplate } from '../../utils/websiteTemplateMigration';
import { getTemplateById, mergeSiteWithTemplate, renderTemplateLayout } from '../../utils/templateRendererUtils';
import { SafeImage } from './SafeImage';
import { trackWebsiteEvent } from '../../utils/websiteAnalytics';

export function WebsiteSettingsControls({site,token,onUpdated,onDeleted,requestedTemplateId,selectionOnly,onClosed}:{site:WebsiteSiteRecord;token:string;onUpdated:(site:WebsiteSiteRecord)=>void;onDeleted:()=>void;requestedTemplateId?:string;selectionOnly?:boolean;onClosed?:()=>void}) {
  const [mode,setMode]=useState<'template'|'delete'|null>(null),[target,setTarget]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(requestedTemplateId){setTarget(requestedTemplateId);setMode('template');}},[requestedTemplateId]);
  useEffect(()=>{if(mode)dialog.current?.showModal();},[mode]);
  const close=()=>{if(!busy){setMode(null);setTarget('');setConfirmation('');setError('');onClosed?.();}};
  const choose=(id:string)=>{setTarget(id);trackWebsiteEvent('website_template_previewed',{templateId:id,siteId:site.id,source:'settings'},token);};
  const preview=target ? mergeSiteWithTemplate(getTemplateById(target),migrateWebsiteTemplate(site.content_json,site.template_id,target),site.settings_json) : null;
  return <div className="sm:col-span-2 space-y-4 pt-3 border-t border-slate-800">
    {!selectionOnly&&<>
    <button type="button" onClick={()=>setMode('template')} className="px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold">Change your design</button>
    <div className="border border-rose-500/30 rounded-xl p-3 space-y-2"><strong className="text-rose-300">Danger Zone</strong><p className="text-slate-400 text-xs">Delete this website and free your one-site slot. Your Mystery Hub account, orders and Mystery Earn remain intact.</p><button type="button" onClick={()=>setMode('delete')} className="text-rose-300 underline py-2">Delete Website</button></div>
    </>}
    {mode && <dialog ref={dialog} onCancel={event=>{event.preventDefault();close();}} aria-labelledby="website-settings-action" className="fixed inset-0 m-auto w-[calc(100vw-1.5rem)] max-w-3xl max-h-[92dvh] overflow-auto p-5 bg-[#0b131a] text-white rounded-2xl border border-slate-700 backdrop:bg-black/70">
      <div className="flex items-center justify-between gap-3"><h2 id="website-settings-action" className="font-bold text-lg">{mode==='template' ? 'Change your design' : 'Delete Website'}</h2><button type="button" disabled={busy} onClick={close} className="p-2 bg-slate-800 rounded-lg">Close</button></div>
      {mode==='template' ? <>
        <p className="text-sm text-slate-300 my-4">Your site address, business details, logo and image library stay with you. Choose a design to preview it before switching.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-label="Choose a website design">
          {orderedWebsiteTemplates().map(t=><button type="button" key={t.id} disabled={busy||t.id===site.template_id} onClick={()=>choose(t.id)} aria-pressed={target===t.id} className={`text-left rounded-xl overflow-hidden border ${target===t.id?'border-emerald-500 bg-emerald-500/10':'border-slate-700 bg-slate-900'} disabled:opacity-60`}>
            <SafeImage src={t.heroImage} alt={`${t.title} design`} className="w-full aspect-[4/3]"/>
            <span className="block p-3"><strong className="block text-sm">{t.title}</strong><span className="block mt-1 text-xs text-slate-400">{t.id===site.template_id?'Current design':t.industry}</span></span>
          </button>)}
        </div>
        {target&&<div className="my-4 grid sm:grid-cols-2 gap-3 text-sm"><p><strong className="block text-white">Stays with you</strong><span className="text-slate-400">Site address, business and contact details, logo, image library and compatible content.</span></p><p><strong className="block text-white">May change</strong><span className="text-slate-400">Page layout and design-specific sections or item lists.</span></p></div>}
        {preview && <div onClickCapture={event=>{if((event.target as HTMLElement).closest('a,button'))event.preventDefault();}} className="border border-slate-700 rounded-xl overflow-hidden max-h-[45dvh] overflow-y-auto my-4">{renderTemplateLayout(preview,{onCtaClick:()=>{}})}</div>}
        <p className="text-amber-200 text-sm mb-3">Changing the template updates a published site immediately. Review this preview before confirming.</p>
        <button type="button" disabled={!target || busy} className="px-4 py-3 rounded-xl bg-emerald-500 text-black font-bold disabled:opacity-40" onClick={async()=>{setBusy(true);setError('');try{const {site:updated}=await changeWebsiteTemplate(token,site.id,target,site.updated_at);onUpdated(updated);setMode(null);setTarget('');onClosed?.();}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>{busy?'Changing…':'Use this template'}</button>
      </> : <>
        <p className="text-sm text-slate-300 my-4">This permanently deletes this website and removes its public address. Site images will be queued for cleanup. This cannot be undone.</p>
        <label className="block text-sm mb-4">Type <strong className="break-all">{site.slug}</strong> to confirm<input autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy} className="block w-full bg-slate-900 border border-slate-700 p-3 rounded-xl mt-2" /></label>
        <button type="button" disabled={busy || confirmation!==site.slug} className="px-4 py-3 rounded-xl bg-rose-600 text-white font-bold disabled:opacity-40" onClick={async()=>{setBusy(true);setError('');try{await deleteWebsiteOnServer(token,site.id,confirmation);setMode(null);onDeleted();}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>{busy?'Deleting…':'Permanently Delete Website'}</button>
      </>}
      {error && <p role="alert" className="text-rose-300 text-sm my-3">{error}</p>}
    </dialog>}
  </div>;
}
