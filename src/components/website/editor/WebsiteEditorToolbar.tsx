import React from 'react';
import {ArrowLeft, Monitor, Smartphone, Tablet} from 'lucide-react';

export function WebsiteEditorToolbar(p: {
  name:string; mode:'edit'|'preview'; device:'desktop'|'tablet'|'mobile'; status:string; published:boolean; saving:boolean; publishing:boolean;
  onExit:()=>void; onMode:(v:'edit'|'preview')=>void; onDevice:(v:'desktop'|'tablet'|'mobile')=>void; onSave:()=>void; onPublish:()=>void; onUnpublish:()=>void; onSettings:()=>void; onBrand:()=>void; onCopy:()=>void; liveUrl:string;
}) {
  return <header className="visual-editor-toolbar">
    <div className="visual-editor-identity"><button type="button" aria-label="Back to Dashboard" onClick={p.onExit} className="visual-tool-button"><ArrowLeft size={18}/></button><div className="min-w-0"><h2 className="font-bold truncate text-sm max-w-56">{p.name}</h2><p role="status" aria-live="polite" className="text-xs text-slate-300">{p.status==='saving'?'Saving…':p.status==='saved'?'Draft saved':'Unsaved changes'}</p></div></div>
    <div className="visual-editor-actions">
      <div className="flex bg-slate-900 rounded-xl border border-slate-700" aria-label="Editor mode">{(['edit','preview'] as const).map(mode=><button type="button" key={mode} aria-pressed={p.mode===mode} onClick={()=>p.onMode(mode)} className={`visual-tool-button ${p.mode===mode?'bg-emerald-500 text-black font-bold':''}`}>{mode==='edit'?'Edit':'Preview'}</button>)}</div>
      <button type="button" onClick={p.onSave} disabled={p.saving || p.publishing} className="visual-tool-button border border-slate-600">Save Draft</button>
      <button type="button" onClick={p.onPublish} disabled={p.publishing} className="visual-tool-button bg-emerald-500 text-black font-bold">{p.publishing?'Publishing…':p.published?'Update Live':'Publish'}</button>
    </div>
    <div className="visual-editor-options">
      <div className="flex" aria-label="Device preview">{([['mobile',Smartphone,'Mobile (375px)'],['tablet',Tablet,'Tablet (768px)'],['desktop',Monitor,'Desktop (1280px)']] as const).map(([device,Icon,label])=><button type="button" key={device} title={label} aria-label={label} aria-pressed={p.device===device} onClick={()=>p.onDevice(device)} className={`visual-tool-button ${p.device===device?'bg-slate-700 text-emerald-300':''}`}><Icon size={17}/></button>)}</div>
      <button type="button" onClick={p.onSettings} className="visual-tool-button">All Settings</button>
      {p.mode==='edit' && <button type="button" onClick={p.onBrand} className="visual-tool-button">Colors</button>}
      {p.published && <><a href={p.liveUrl} target="_blank" rel="noopener noreferrer" className="visual-tool-button">View Live</a><button type="button" onClick={p.onCopy} className="visual-tool-button">Copy Link</button></>}
      {p.published && <button type="button" onClick={p.onUnpublish} disabled={p.publishing} className="visual-tool-button text-slate-300">Unpublish</button>}
    </div>
  </header>;
}
