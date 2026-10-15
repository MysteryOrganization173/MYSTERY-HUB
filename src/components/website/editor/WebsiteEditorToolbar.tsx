import React, {useEffect, useRef, useState} from 'react';
import {ArrowLeft, Copy, ExternalLink, Eye, Maximize2, Monitor, MoreHorizontal, Palette, PenLine, Save, SlidersHorizontal, Smartphone, Tablet, X, EyeOff} from 'lucide-react';

type Device = 'desktop'|'tablet'|'mobile';
const DEVICES = [['mobile',Smartphone,'Phone'],['tablet',Tablet,'Tablet'],['desktop',Monitor,'Desktop']] as const;

/** Canvas First chrome: one slim top bar everywhere, plus a bottom dock on phones. */
export function WebsiteEditorToolbar(p: {
  name:string; mode:'edit'|'preview'; device:Device; status:string; published:boolean; saving:boolean; publishing:boolean;
  settingsOpen?:boolean; colorsOpen?:boolean;
  onExit:()=>void; onMode:(v:'edit'|'preview')=>void; onDevice:(v:Device)=>void; onSave:()=>void; onPublish:()=>void; onUnpublish:()=>void; onSettings:()=>void; onBrand:()=>void; onCopy:()=>void; onFullPreview?:()=>void; liveUrl:string;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null), opener = useRef<HTMLElement | null>(null);
  const status = p.status==='saving' ? 'Saving…' : p.status==='saved' ? (p.published ? 'Draft saved · live site unchanged until you update' : 'Draft saved') : 'Unsaved changes';
  const shortStatus = p.status==='saving' ? 'Saving…' : p.status==='saved' ? 'Draft saved' : 'Unsaved changes';
  const active = p.settingsOpen ? 'settings' : p.colorsOpen ? 'colors' : p.mode;
  const openMore = (event: React.MouseEvent<HTMLElement>) => {opener.current = event.currentTarget; setMoreOpen(open => !open);};
  const closeMore = () => {setMoreOpen(false); opener.current?.focus();};
  const run = (action: () => void) => () => {setMoreOpen(false); action();};
  const colors = () => {if (p.mode!=='edit') p.onMode('edit'); p.onBrand();};
  const settings = () => p.settingsOpen ? p.onMode(p.mode) : p.onSettings();
  useEffect(() => {
    if (!moreOpen) return;
    moreRef.current?.querySelector<HTMLElement>('button,a')?.focus();
    const away = (event: PointerEvent) => {if (!moreRef.current?.contains(event.target as Node) && !opener.current?.contains(event.target as Node)) setMoreOpen(false);};
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [moreOpen]);

  return <>
    <header className="visual-editor-toolbar">
      <button type="button" aria-label="Back to Dashboard" onClick={p.onExit} className="visual-icon-button"><ArrowLeft size={19}/></button>
      <div className="visual-editor-identity">
        <h2>{p.name}</h2>
        <p role="status" aria-live="polite" data-state={p.status}><span className="visual-status-dot" aria-hidden="true"/><span className="visual-status-long">{status}</span><span className="visual-status-short">{shortStatus}</span></p>
      </div>
      <div className="visual-editor-center">
        <div className="visual-segment" role="group" aria-label="Editor mode">{(['edit','preview'] as const).map(mode=><button type="button" key={mode} aria-pressed={p.mode===mode} onClick={()=>p.onMode(mode)}>{mode==='edit'?<PenLine size={15}/>:<Eye size={15}/>}{mode==='edit'?'Edit':'Preview'}</button>)}</div>
        <div className="visual-segment" role="group" aria-label="Preview size">{DEVICES.map(([device,Icon,label])=><button type="button" key={device} title={label} aria-label={`${label} size`} aria-pressed={p.device===device} onClick={()=>p.onDevice(device)}><Icon size={16}/></button>)}</div>
      </div>
      <div className="visual-editor-actions">
        <button type="button" onClick={colors} aria-pressed={!!p.colorsOpen} className="visual-text-button visual-wide-only"><Palette size={16}/>Colors</button>
        <button type="button" onClick={settings} aria-pressed={!!p.settingsOpen} className="visual-text-button visual-wide-only"><SlidersHorizontal size={16}/>All Settings</button>
        <button type="button" onClick={openMore} aria-expanded={moreOpen} aria-haspopup="menu" aria-label="More options" className="visual-icon-button visual-wide-only"><MoreHorizontal size={19}/></button>
        <button type="button" onClick={p.onPublish} disabled={p.publishing} className="visual-publish-button">{p.publishing?'Publishing…':p.published?'Update Live':'Publish'}</button>
      </div>
    </header>

    <nav className="visual-editor-dock" aria-label="Editor tools">
      <button type="button" aria-pressed={active==='edit'} onClick={()=>p.onMode('edit')}><PenLine size={20}/>Edit</button>
      <button type="button" aria-pressed={active==='colors'} onClick={colors}><Palette size={20}/>Colors</button>
      <button type="button" aria-pressed={active==='preview'} onClick={()=>p.onMode('preview')}><Eye size={20}/>Preview</button>
      <button type="button" aria-pressed={active==='settings'} onClick={settings}><SlidersHorizontal size={20}/>Settings</button>
      <button type="button" aria-expanded={moreOpen} aria-haspopup="menu" onClick={openMore}><MoreHorizontal size={20}/>More</button>
    </nav>

    {moreOpen && <div ref={moreRef} className="visual-more" role="menu" aria-label="More options" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();closeMore();}}}>
      <div className="visual-more-head"><strong>More options</strong><button type="button" aria-label="Close more options" onClick={closeMore} className="visual-icon-button"><X size={18}/></button></div>
      <button type="button" role="menuitem" onClick={run(p.onSave)} disabled={p.saving || p.publishing}><Save size={18}/>Save draft now</button>
      {p.onFullPreview && <button type="button" role="menuitem" onClick={run(p.onFullPreview)}><Maximize2 size={18}/>Full preview</button>}
      {p.published && <a role="menuitem" href={p.liveUrl} target="_blank" rel="noopener noreferrer" onClick={()=>setMoreOpen(false)}><ExternalLink size={18}/>View live site</a>}
      {p.published && <button type="button" role="menuitem" onClick={run(p.onCopy)}><Copy size={18}/>Copy link</button>}
      {p.published && <button type="button" role="menuitem" onClick={run(p.onUnpublish)} disabled={p.publishing} className="visual-more-danger"><EyeOff size={18}/>Unpublish</button>}
      <div className="visual-more-devices"><span>Preview size</span><div className="visual-segment" role="group" aria-label="Preview size">{DEVICES.map(([device,Icon,label])=><button type="button" key={device} aria-pressed={p.device===device} onClick={()=>p.onDevice(device)}><Icon size={15}/>{label}</button>)}</div></div>
    </div>}
  </>;
}
