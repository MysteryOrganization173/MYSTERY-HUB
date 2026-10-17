import React, { useEffect, useRef, useState } from 'react';
import type { WebsiteSiteRecord } from '../../types';
import { orderedWebsiteTemplates } from '../../data/templates';
import { changeWebsiteTemplate, deleteWebsiteOnServer } from '../../services/apiClient';
import { migrateWebsiteTemplate, websiteMigrationSummary } from '../../utils/websiteTemplateMigration';
import { getTemplateById, mergeSiteWithTemplate, renderTemplateLayout } from '../../utils/templateRendererUtils';
import { SafeImage } from './SafeImage';
import { trackWebsiteEvent } from '../../utils/websiteAnalytics';
import { X } from 'lucide-react';
import { getWebsiteTemplatePlan, restoreWebsiteDraft } from '../../services/websiteB1Api';
import { historyDate } from './editor/WebsiteLayoutAndHistory';
import './websiteBuilder.css';

export function WebsiteSettingsControls({site,token,onUpdated,onDeleted,requestedTemplateId,selectionOnly,onClosed}:{site:WebsiteSiteRecord;token:string;onUpdated:(site:WebsiteSiteRecord)=>void;onDeleted:()=>void;requestedTemplateId?:string;selectionOnly?:boolean;onClosed?:()=>void}) {
  const [mode,setMode]=useState<'template'|'delete'|null>(null),[target,setTarget]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  // The server's plan is authoritative: the exact resulting draft, the live design and history room.
  const [plan,setPlan]=useState<Awaited<ReturnType<typeof getWebsiteTemplatePlan>>|null>(null);
  useEffect(()=>{
    setPlan(null);if(!target)return;let live=true;
    getWebsiteTemplatePlan(token,site.id,target).then(p=>{if(live)setPlan(p);}).catch(e=>{if(live)setError(e.message);});
    return ()=>{live=false;};
  },[target,site.id,site.updated_at,token]);
  useEffect(()=>{if(requestedTemplateId){setTarget(requestedTemplateId);setMode('template');}},[requestedTemplateId]);
  useEffect(()=>{if(mode)dialog.current?.showModal();},[mode]);
  const close=()=>{if(!busy){setMode(null);setTarget('');setConfirmation('');setError('');onClosed?.();}};
  const choose=(id:string)=>{setTarget(id);trackWebsiteEvent('website_template_previewed',{templateId:id,siteId:site.id,source:'settings'},token);};
  const summary=target ? plan?.summary || websiteMigrationSummary(site.template_id,target) : null;
  const preview=target ? mergeSiteWithTemplate(getTemplateById(target),plan?.content || migrateWebsiteTemplate(site.content_json,site.template_id,target),plan?.settings || site.settings_json) : null;
  const earlier=plan?.recoverable?.[0];
  const historyFull=plan?.checkpointSlotsRemaining===0;
  const liveTitle=plan?.publishedTemplateId ? getTemplateById(plan.publishedTemplateId).title : '';
  return <div className="sm:col-span-2 space-y-4 pt-3 border-t border-slate-800">
    {!selectionOnly&&<>
    <button type="button" onClick={()=>setMode('template')} className="px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold">Change your design</button>
    <div className="border border-rose-500/30 rounded-xl p-3 space-y-2"><strong className="text-rose-300">Danger Zone</strong><p className="text-slate-400 text-xs">Delete this website and free your one-site slot. Your Mystery Hub account, orders and Mystery Earn remain intact.</p><button type="button" onClick={()=>setMode('delete')} className="text-rose-300 underline py-2">Delete Website</button></div>
    </>}
    {mode && <dialog ref={dialog} onCancel={event=>{event.preventDefault();close();}} aria-labelledby="website-settings-action" className="website-sheet">
      <div className="website-sheet-head">
        <div className="min-w-0 flex-1"><h2 id="website-settings-action">{mode==='template' ? summary ? `Switch to ${summary.target.title}?` : 'Choose a new design' : 'Delete website'}</h2>
          {mode==='template'&&<p>{summary ? 'Only your draft changes. Your live website stays the same until you publish.' : 'Your name, contact details, colours and photo library come with you.'}</p>}</div>
        <button type="button" disabled={busy} onClick={close} aria-label="Close" className="website-sheet-close"><X size={20}/></button>
      </div>
      <div className="website-sheet-body">
      {mode==='template' ? <>
        {!target&&<div className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-label="Choose a website design">
          {orderedWebsiteTemplates().map(t=><button type="button" key={t.id} disabled={busy||t.id===site.template_id} onClick={()=>choose(t.id)} aria-pressed={target===t.id} className={`text-left rounded-xl overflow-hidden border ${target===t.id?'border-emerald-500 bg-emerald-500/10':'border-slate-700 bg-slate-900'} disabled:opacity-60`}>
            <SafeImage src={t.heroImage} alt={`${t.title} design`} className="w-full aspect-[4/3]"/>
            <span className="block p-3"><strong className="block text-sm">{t.title}</strong><span className="block mt-1 text-xs text-slate-400">{t.id===site.template_id?'Current design':t.industry}</span></span>
          </button>)}
        </div>}
        {preview && <figure className="m-0 flex flex-col gap-2"><figcaption className="website-sheet-note">Your details in this design. Scroll inside to see more.</figcaption><div className="website-sheet-preview"><div className="website-sheet-preview-scroll" onClickCapture={event=>{if((event.target as HTMLElement).closest('a,button')){event.preventDefault();event.stopPropagation();}}} onSubmitCapture={event=>event.preventDefault()}>{renderTemplateLayout(preview,{onCtaClick:()=>{}})}</div></div></figure>}
        {earlier&&<div className="website-sheet-restore"><span>You used this design before. Bring back your saved draft from {historyDate(earlier.createdAt)} (“{earlier.name}”) instead of starting it fresh?</span><button type="button" disabled={busy||historyFull} onClick={async()=>{setBusy(true);setError('');try{const {site:updated}=await restoreWebsiteDraft(token,site.id,site.updated_at,earlier.id);onUpdated(updated);setMode(null);setTarget('');onClosed?.();}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>Restore that draft</button></div>}
        {summary&&<div className="website-sheet-changes">
          <div><strong className="text-emerald-300">Comes with you</strong><p>{summary.kept.join(' · ')}</p></div>
          <div><strong className="text-amber-200">Starts fresh</strong><p>{summary.reset.join(' · ')}</p></div>
        </div>}
        {target&&<p className="website-sheet-note">{liveTitle ? `Your live website keeps the ${liveTitle} design until you publish. ` : ''}A copy of your current draft is saved in History, so you can switch back.</p>}
        {historyFull&&<p role="alert" className="text-amber-200 text-sm">Your history is full. Open the editor, go to All Settings → History and remove an old version, then switch design.</p>}
        {target&&<button type="button" disabled={busy} onClick={()=>setTarget('')} className="self-start min-h-11 px-1 text-sm font-semibold text-emerald-300">Change selection</button>}
      </> : <>
        <p className="text-sm text-slate-300">This permanently deletes this website and removes its public address. Site images will be queued for cleanup. This cannot be undone.</p>
        <label className="block text-sm">Type <strong className="break-all">{site.slug}</strong> to confirm<input autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy} className="block w-full min-h-12 bg-slate-900 border border-slate-700 p-3 rounded-xl mt-2 text-base" /></label>
      </>}
      {error && <p role="alert" className="text-rose-300 text-sm">{error}</p>}
      </div>
      <div className="website-sheet-foot">
        <button type="button" disabled={busy} onClick={close} className="website-sheet-cancel">Cancel</button>
        {mode==='template'
          ? <button type="button" disabled={!target || busy || historyFull} className="website-sheet-confirm" onClick={async()=>{setBusy(true);setError('');try{const {site:updated}=await changeWebsiteTemplate(token,site.id,target,site.updated_at);onUpdated(updated);setMode(null);setTarget('');onClosed?.();}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>{busy?'Switching…':target?'Switch design':'Choose a design'}</button>
          : <button type="button" disabled={busy || confirmation!==site.slug} className="website-sheet-danger" onClick={async()=>{setBusy(true);setError('');try{await deleteWebsiteOnServer(token,site.id,confirmation);setMode(null);onDeleted();}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>{busy?'Deleting…':'Delete permanently'}</button>}
      </div>
    </dialog>}
  </div>;
}
