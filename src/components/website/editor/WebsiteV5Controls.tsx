import React, { useEffect, useRef, useState } from 'react';
import { websiteBusinessRequest } from '../../../services/websiteBusinessApi';
import { formatGhs } from '../../../../shared/money';
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Plus, Star, X } from 'lucide-react';
import type { SiteSettings, TemplateItem } from '../../../types';
import { SafeImage } from '../SafeImage';
import { WebsiteImageField } from './WebsiteImageField';
import {
  WEBSITE_DAYS, WEBSITE_POLICY_KEYS, WEBSITE_POLICY_LABELS, WEBSITE_SECTION_REGISTRY, WEBSITE_V5_LIMITS, defaultWebsiteHours, focalPosition, isWebsiteTime,
  resolveWebsiteSections, websiteHoursRows, containedPhotoBounds, containedPhotoFocal, type WebsiteFocal, type WebsiteHours, type WebsitePolicies, type WebsiteSectionLayout,
} from '../../../config/websiteContentV5';

/* ------------------------------------------------------------------ Page sections */

/** Show, hide and reorder a design's optional sections. Essentials stay put; hidden content is kept. */
export function WebsitePageSectionsControl({ layout, value, onChange }: { layout: string; value?: WebsiteSectionLayout; onChange: (next: WebsiteSectionLayout) => void }) {
  const defs = WEBSITE_SECTION_REGISTRY[layout];
  if (!defs) return null;
  const resolved = resolveWebsiteSections(layout, value);
  const movable = resolved.filter(s => !s.essential).map(s => s.id);
  const hidden = new Set(resolved.filter(s => !s.visible).map(s => s.id));
  const commit = (order: string[], nextHidden: Set<string>) => onChange({ order, hidden: [...nextHidden] });
  const move = (id: string, delta: number) => {
    const order = [...movable], i = order.indexOf(id), j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]]; commit(order, hidden);
  };
  const toggle = (id: string) => { const next = new Set(hidden); if (next.has(id)) next.delete(id); else next.add(id); commit(movable, next); };
  return <section className="space-y-3" aria-labelledby="page-sections-title" data-page-sections>
    <div><h3 id="page-sections-title" className="font-bold text-sm text-white">Page sections</h3>
      <p className="text-xs text-slate-400 mt-1">Hide what you don’t need or change the order. Hidden sections keep their content, so you can bring them back any time.</p></div>
    <ol className="space-y-2">{resolved.map(s => {
      const index = movable.indexOf(s.id);
      return <li key={s.id} className={`flex items-center gap-2 rounded-xl border px-3 min-h-14 ${s.visible ? 'border-slate-700 bg-[#0d151b]' : 'border-slate-800 bg-transparent'}`}>
        <span className={`flex-1 min-w-0 text-sm font-semibold ${s.visible ? 'text-white' : 'text-slate-500 line-through'}`}>{s.label}</span>
        {s.essential ? <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Lock size={13} aria-hidden="true" />Always shown</span> : <>
          <button type="button" className="visual-icon-button" aria-label={`Move ${s.label} up`} disabled={index === 0} onClick={() => move(s.id, -1)}><ArrowUp size={17} /></button>
          <button type="button" className="visual-icon-button" aria-label={`Move ${s.label} down`} disabled={index === movable.length - 1} onClick={() => move(s.id, 1)}><ArrowDown size={17} /></button>
          <button type="button" className="visual-icon-button" aria-pressed={!s.visible} aria-label={s.visible ? `Hide ${s.label}` : `Show ${s.label}`} onClick={() => toggle(s.id)}>{s.visible ? <Eye size={17} /> : <EyeOff size={17} />}</button>
        </>}
      </li>;
    })}</ol>
    <p className="text-xs text-slate-500">Some sections only appear once they have content, such as opening hours or gallery photos.</p>
  </section>;
}

/* ------------------------------------------------------------------ Hours */

export function WebsiteHoursControl({ hours, onChange }: { hours?: WebsiteHours; onChange: (next: WebsiteHours | null) => void }) {
  if (!hours) return <section className="space-y-3" aria-labelledby="hours-title">
    <div><h3 id="hours-title" className="font-bold text-sm text-white">Opening hours</h3><p className="text-xs text-slate-400 mt-1">Add your hours and designs that show them display an “Open now” badge worked out in Ghana time.</p></div>
    <button type="button" className="visual-secondary-button" onClick={() => onChange(defaultWebsiteHours())}><Plus size={16} />Add opening hours</button>
  </section>;
  const setDay = (i: number, patch: Partial<WebsiteHours['days'][number]>) => {
    const days = hours.days.map((d, n) => n === i ? { ...d, ...patch } : d);
    onChange({ ...hours, days: days.map(d => d.closed ? { closed: true } : { closed: false, open: d.open || '09:00', close: d.close || '18:00' }) });
  };
  const copyToAll = (i: number) => onChange({ ...hours, days: hours.days.map(() => ({ ...hours.days[i] })) });
  const preview = websiteHoursRows(hours);
  return <section className="space-y-3" aria-labelledby="hours-title" data-hours-editor>
    <div><h3 id="hours-title" className="font-bold text-sm text-white">Opening hours</h3><p className="text-xs text-slate-400 mt-1">Times are Ghana time. A closing time earlier than the opening time runs past midnight.</p></div>
    <div className="space-y-2">{hours.days.map((d, i) => <fieldset key={WEBSITE_DAYS[i]} className="rounded-xl border border-slate-800 p-3 space-y-2">
      <legend className="sr-only">{WEBSITE_DAYS[i]}</legend>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white">{WEBSITE_DAYS[i]}</span>
        <label className="inline-flex items-center gap-2 text-sm text-slate-300 min-h-11"><input type="checkbox" checked={d.closed} onChange={e => setDay(i, { closed: e.target.checked })} className="w-5 h-5 accent-emerald-500" />Closed</label>
      </div>
      {!d.closed && <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-400">Opens<input type="time" value={d.open || ''} onChange={e => isWebsiteTime(e.target.value) && setDay(i, { open: e.target.value })} className="visual-input mt-1" /></label>
        <label className="text-xs text-slate-400">Closes<input type="time" value={d.close || ''} onChange={e => isWebsiteTime(e.target.value) && setDay(i, { close: e.target.value })} className="visual-input mt-1" /></label>
      </div>}
      {i === 0 && <button type="button" className="visual-link-button" onClick={() => copyToAll(0)}>Use Monday’s hours for every day</button>}
    </fieldset>)}</div>
    <div className="visual-field"><div className="visual-field-label"><label htmlFor="hours-note">Note (optional)</label><span>{(hours.note || '').length}/{WEBSITE_V5_LIMITS.hoursNote}</span></div>
      <input id="hours-note" className="visual-input" maxLength={WEBSITE_V5_LIMITS.hoursNote} value={hours.note || ''} placeholder="e.g. Kitchen closes 30 minutes earlier" onChange={e => onChange({ ...hours, note: e.target.value.replace(/[<>]/g, '') || undefined })} /></div>
    {preview.length > 0 && <div className="rounded-xl bg-[#0d151b] p-3 text-sm text-slate-300"><p className="text-xs text-slate-500 mb-1">Customers see</p>{preview.map(r => <p key={r.days} className="flex justify-between gap-3"><span>{r.days}</span><span>{r.time}</span></p>)}</div>}
    <button type="button" className="visual-link-button is-danger" onClick={() => onChange(null)}>Remove opening hours</button>
  </section>;
}

/* ------------------------------------------------------------------ Policies */

export function WebsitePoliciesControl({ policies, onChange }: { policies?: WebsitePolicies; onChange: (next: WebsitePolicies) => void }) {
  return <section className="space-y-3" aria-labelledby="policies-title">
    <div><h3 id="policies-title" className="font-bold text-sm text-white">Delivery, payment &amp; returns</h3><p className="text-xs text-slate-400 mt-1">Write only what you really offer. Empty boxes are not shown on your website.</p></div>
    {WEBSITE_POLICY_KEYS.map(key => <div key={key} className="visual-field">
      <div className="visual-field-label"><label htmlFor={`policy-${key}`}>{WEBSITE_POLICY_LABELS[key]}</label><span>{(policies?.[key] || '').length}/{WEBSITE_V5_LIMITS.policy}</span></div>
      <textarea id={`policy-${key}`} rows={3} className="visual-input" maxLength={WEBSITE_V5_LIMITS.policy} value={policies?.[key] || ''}
        placeholder={key === 'delivery' ? 'e.g. Delivery in Accra in 1–2 days. Pickup from the shop.' : key === 'payment' ? 'e.g. Mobile Money or cash on delivery.' : 'e.g. Exchanges within 3 days if unused.'}
        onChange={e => onChange({ ...(policies || {}), [key]: e.target.value.replace(/[<>]/g, '') })} />
    </div>)}
  </section>;
}

/* ------------------------------------------------------------------ Gallery */

export function WebsiteGalleryControl({ gallery, siteId, token, onChange }: { gallery?: string[]; siteId: string; token: string; onChange: (next: string[]) => void }) {
  const photos = gallery || [];
  const [adding, setAdding] = useState(false);
  return <section className="space-y-3" aria-labelledby="gallery-title">
    <div><h3 id="gallery-title" className="font-bold text-sm text-white">Gallery photos</h3><p className="text-xs text-slate-400 mt-1">Up to {WEBSITE_V5_LIMITS.gallery} photos of your space, team or work. The gallery is hidden while it is empty.</p></div>
    {photos.length > 0 && <div className="grid grid-cols-3 gap-2">{photos.map((src, i) => <div key={src + i} className="relative">
      <SafeImage src={src} alt={`Gallery photo ${i + 1}`} className="aspect-square rounded-lg" />
      <button type="button" aria-label={`Remove gallery photo ${i + 1}`} onClick={() => onChange(photos.filter((_, n) => n !== i))} className="absolute top-1 right-1 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center"><X size={16} /></button>
    </div>)}</div>}
    {photos.length < WEBSITE_V5_LIMITS.gallery && (adding
      ? <WebsiteImageField label="Add a gallery photo" value="" siteId={siteId} token={token} onChange={url => { if (url) onChange([...photos, url]); setAdding(false); }} />
      : <button type="button" className="visual-secondary-button" onClick={() => setAdding(true)}><Plus size={16} />Add a photo</button>)}
  </section>;
}

/* ------------------------------------------------------------------ Featured bundles (Signal) */

/**
 * Owner's picks for a Data store: shown first under "Featured" on the store. Only bundles the server says are
 * on sale can be picked, and the store drops any pick that stops being on sale, so a pick never shows a stale price.
 */
export function WebsiteFeaturedBundlesControl({ siteId, token, value, onChange }: { siteId: string; token: string; value?: string[]; onChange: (next: string[]) => void }) {
  const [products, setProducts] = useState<any[] | null>(null), [error, setError] = useState('');
  useEffect(() => { let live = true; websiteBusinessRequest(`websites/${siteId}/bundles`, token).then((r: any) => { if (live) setProducts((r?.products || []).filter((p: any) => p.eligible)); }).catch((e: Error) => { if (live) setError(e.message); }); return () => { live = false; }; }, [siteId, token]);
  const picks = (value || []).filter(id => !products || products.some(p => p.id === id));
  const toggle = (id: string) => onChange(picks.includes(id) ? picks.filter(x => x !== id) : [...picks, id].slice(0, WEBSITE_V5_LIMITS.pinnedBundles));
  return <section className="space-y-3" aria-labelledby="featured-bundles-title" data-featured-bundles>
    <div><h3 id="featured-bundles-title" className="font-bold text-sm text-white">Featured bundles</h3><p className="text-xs text-slate-400 mt-1">Pick up to {WEBSITE_V5_LIMITS.pinnedBundles} bundles to show first under "Featured". Only bundles on sale can be featured. {picks.length} of {WEBSITE_V5_LIMITS.pinnedBundles} picked.</p></div>
    {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : !products ? <p role="status" className="text-sm text-slate-400">Loading your bundles…</p> : !products.length ? <p className="text-sm text-slate-400">No bundles are on sale yet. Set prices in Bundles &amp; pricing first.</p> :
      <ul className="grid gap-2">{products.map(p => { const on = picks.includes(p.id), full = !on && picks.length >= WEBSITE_V5_LIMITS.pinnedBundles; return <li key={p.id}>
        <button type="button" aria-pressed={on} disabled={full} onClick={() => toggle(p.id)} className={`w-full min-h-11 flex items-center gap-3 px-3 py-2 rounded-xl border text-left text-sm disabled:opacity-40 ${on ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'border-slate-700 text-slate-200'}`}>
          <Star size={16} aria-hidden="true" className={on ? 'text-emerald-300 fill-emerald-300' : 'text-slate-500'} />
          <span className="flex-1 min-w-0">{p.networkName} {p.dataAmount}</span><span className="text-slate-400">{formatGhs(p.retailMinor)}</span>
        </button></li>; })}</ul>}
  </section>;
}

/* ------------------------------------------------------------------ Image details: focal point, crop preview, description */

/**
 * Tap the most important part of the photo. Every design crops around that point, so a face or a dish stays
 * in view on a phone (tall crop) and on a computer (wide crop). The description is read aloud to people
 * who cannot see the photo and used if the photo fails to load.
 */
export function WebsiteImageDetails({ src, focal, alt, onChange, altLabel = 'Describe the photo' }: { src?: string; focal?: Partial<WebsiteFocal>; alt?: string; onChange: (patch: { x?: number; y?: number; alt?: string }) => void; altLabel?: string }) {
  const box = useRef<HTMLButtonElement>(null);
  const [natural,setNatural]=useState({src:'',width:0,height:0}),[size,setSize]=useState({width:0,height:0});
  useEffect(()=>{const el=box.current;if(!el)return;const observer=new ResizeObserver(()=>setSize({width:el.clientWidth,height:el.clientHeight}));observer.observe(el);return()=>observer.disconnect();},[src]);
  if (!src) return null;
  const position = focalPosition(focal) || '50% 50%';
  const [fx, fy] = position.split(' ').map(v => parseFloat(v));
  const image=natural.src===src?natural:{width:0,height:0};
  const bounds=containedPhotoBounds(size.width,size.height,image.width,image.height);
  const pick = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = box.current!.getBoundingClientRect();
    onChange(containedPhotoFocal((event.clientX-rect.left)/rect.width*100,(event.clientY-rect.top)/rect.height*100,containedPhotoBounds(rect.width,rect.height,image.width,image.height)));
  };
  const nudge = (event: React.KeyboardEvent) => {
    const step = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[event.key];
    if (!step) return; event.preventDefault();
    onChange({ x: Math.min(100, Math.max(0, fx + step[0])), y: Math.min(100, Math.max(0, fy + step[1])) });
  };
  return <div className="space-y-3" data-image-details>
    <div className="visual-field">
      <div className="visual-field-label"><label>Focus point</label><span>{focal ? `${fx}% · ${fy}%` : 'Centre'}</span></div>
      <button ref={box} type="button" onPointerDown={pick} onKeyDown={nudge} aria-label="Choose the focus point. Tap the photo, or use the arrow keys." className="relative block w-full rounded-xl overflow-hidden border border-slate-700 cursor-crosshair" style={{ aspectRatio: '3 / 2', touchAction: 'none' }}>
        <SafeImage src={src} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: 'contain', background: '#05090c' }} onLoad={event=>setNatural({src:src||'',width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} />
        <span aria-hidden="true" className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-[3px] border-white shadow-[0_0_0_2px_rgba(0,0,0,.6)]" style={{ left: `${bounds.left+fx*bounds.width/100}%`, top: `${bounds.top+fy*bounds.height/100}%` }} />
      </button>
      <div className="grid grid-cols-[2fr_3fr] gap-2" aria-label="How the photo is cropped">
        <figure className="m-0"><SafeImage src={src} alt="" className="rounded-lg w-full" style={{ aspectRatio: '4 / 5', objectPosition: position }} /><figcaption className="text-[11px] text-slate-400 mt-1">Phone</figcaption></figure>
        <figure className="m-0"><SafeImage src={src} alt="" className="rounded-lg w-full" style={{ aspectRatio: '16 / 9', objectPosition: position }} /><figcaption className="text-[11px] text-slate-400 mt-1">Computer</figcaption></figure>
      </div>
      {focal && <button type="button" className="visual-link-button" onClick={() => onChange({ x: 50, y: 50 })}>Back to the centre</button>}
    </div>
    <div className="visual-field">
      <div className="visual-field-label"><label htmlFor={`alt-${altLabel}`}>{altLabel} (optional)</label><span>{(alt || '').length}/{WEBSITE_V5_LIMITS.alt}</span></div>
      <input id={`alt-${altLabel}`} className="visual-input" maxLength={WEBSITE_V5_LIMITS.alt} value={alt || ''} placeholder="e.g. Jollof rice with grilled chicken on a white plate" onChange={e => onChange({ alt: e.target.value.replace(/[<>]/g, '') })} />
      <p className="visual-field-hint">Read aloud to visitors who use a screen reader, and shown if the photo cannot load.</p>
    </div>
  </div>;
}

/* ------------------------------------------------------------------ Palettes */

import { WEBSITE_PALETTES, type WebsitePalette } from '../../../utils/websitePalettes';
export { WEBSITE_PALETTES, paletteIsReadable, type WebsitePalette } from '../../../utils/websitePalettes';

export function WebsitePaletteControl({ settings, onApply }: { settings: SiteSettings; onApply: (palette: WebsitePalette) => void }) {
  const same = (p: WebsitePalette) => [p.backgroundColor, p.primaryColor, p.accentColor].join() === [settings.backgroundColor, settings.primaryColor, settings.accentColor].map(c => (c || '').toLowerCase()).join();
  return <section className="space-y-2" aria-labelledby="palettes-title" data-palettes>
    <h3 id="palettes-title" className="text-xs font-bold text-white">Colour sets</h3>
    <p className="text-[11px] text-slate-400">Tap one to try it. You can still fine-tune each colour below, and Undo brings back your previous colours.</p>
    <div className="grid grid-cols-2 gap-2">{WEBSITE_PALETTES.map(p => <button key={p.name} type="button" aria-pressed={same(p)} onClick={() => onApply(p)} className={`flex items-center gap-2 rounded-xl border p-2 min-h-12 text-left ${same(p) ? 'border-emerald-400' : 'border-slate-700'}`}>
      <span aria-hidden="true" className="flex shrink-0 rounded-lg overflow-hidden border border-slate-600">{[p.backgroundColor, p.primaryColor, p.accentColor].map(c => <span key={c} className="w-5 h-8" style={{ background: c }} />)}</span>
      <span className="text-xs font-semibold text-slate-200">{p.name}</span>
    </button>)}</div>
  </section>;
}


/* ------------------------------------------------------------------ Item extras (V5 designs) */

/** Options, extra photos and Owner's picks, for the designs that show them. */
export function WebsiteItemExtras({ item, layout, siteId, token, pinnedCount, onChange }: { item: TemplateItem; layout: string; siteId: string; token: string; pinnedCount: number; onChange: (patch: Partial<TemplateItem>) => void }) {
  const [optionsText, setOptionsText] = useState((item.options || []).join(', '));
  const [lastId, setLastId] = useState(item.id);
  if (lastId !== item.id) { setLastId(item.id); setOptionsText((item.options || []).join(', ')); }
  const extra = item.images || [];
  const parseOptions = (text: string) => [...new Set(text.split(',').map(o => o.trim().replace(/[<>]/g, '').slice(0, WEBSITE_V5_LIMITS.option)).filter(Boolean))].slice(0, WEBSITE_V5_LIMITS.options);
  const canPin = item.pinned || pinnedCount < 4;
  return <div className="space-y-4" data-item-extras>
    {item.image && <details className="rounded-xl border border-slate-800 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-200 min-h-8">Photo focus and description</summary>
      <div className="mt-3"><WebsiteImageDetails src={item.image} focal={item.focal} alt={item.alt} onChange={patch => onChange({ ...(patch.alt !== undefined ? { alt: patch.alt || undefined } : {}), ...(patch.x !== undefined ? { focal: { x: patch.x, y: patch.y! } } : {}) })} /></div>
    </details>}
    {item.image && <div className="visual-field">
      <div className="visual-field-label"><label>More photos</label><span>{extra.length}/{WEBSITE_V5_LIMITS.itemImages}</span></div>
      {extra.length > 0 && <div className="flex gap-2">{extra.map((src, i) => <div key={src + i} className="relative w-20"><SafeImage src={src} alt={`Extra photo ${i + 1}`} className="w-20 h-20 rounded-lg" />
        <button type="button" aria-label={`Remove extra photo ${i + 1}`} onClick={() => onChange({ images: extra.filter((_, n) => n !== i) })} className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-black text-white border border-slate-600 flex items-center justify-center"><X size={14} /></button></div>)}</div>}
      {extra.length < WEBSITE_V5_LIMITS.itemImages && <WebsiteImageField label="Add another photo" value="" siteId={siteId} token={token} onChange={url => { if (url) onChange({ images: [...extra, url] }); }} />}
      <p className="visual-field-hint">Customers swipe through them when they open this {layout === 'nightkitchen' ? 'dish' : 'product'}.</p>
    </div>}
    <div className="visual-field">
      <div className="visual-field-label"><label htmlFor="item-options">Options (optional)</label><span>{parseOptions(optionsText).length}/{WEBSITE_V5_LIMITS.options}</span></div>
      <input id="item-options" className="visual-input" value={optionsText} placeholder={layout === 'nightkitchen' ? 'e.g. Regular, Large' : 'e.g. Small, Medium, Large'}
        onChange={e => { setOptionsText(e.target.value); onChange({ options: parseOptions(e.target.value) }); }} />
      <p className="visual-field-hint">Separate with commas. The customer picks one and it goes into their WhatsApp message.</p>
    </div>
    {layout === 'nightkitchen' && <label className="flex items-start gap-3 rounded-xl border border-slate-800 p-3 min-h-12">
      <input type="checkbox" className="w-5 h-5 mt-0.5 accent-emerald-500" checked={!!item.pinned} disabled={!canPin} onChange={e => onChange({ pinned: e.target.checked || undefined })} />
      <span className="text-sm text-slate-200">Show in “Owner’s picks”<span className="block text-xs text-slate-400">{canPin ? 'Up to 4 dishes, shown large near the top.' : 'You already have 4 picks. Remove one first.'}</span></span>
    </label>}
  </div>;
}
