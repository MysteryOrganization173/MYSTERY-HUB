import React, { useState } from 'react';
import type { SiteContent } from '../../../types/index.js';
import { SECTION_REGISTRY, createWebsiteComposition, type WebsiteSectionType, type WebsiteComposition } from '../../../config/websiteBuilder.js';
export function WebsiteSectionsControl({ content, onChange }: { content: SiteContent; onChange: (content: SiteContent) => void }) {
  const [adding, setAdding] = useState<WebsiteSectionType>('about');
  const config = content.composition;
  const save = (composition: WebsiteComposition) => onChange({ ...content, composition: { ...composition, sections: composition.sections.map((s, order) => ({ ...s, order })) } });
  return <details className="rounded-xl border border-slate-700 p-3 mb-4"><summary className="font-bold cursor-pointer">Sections</summary>
    {!config ? <div className="mt-3 space-y-3 text-xs"><p>Your current template layout is preserved. Switching to sections uses a simpler layout with your saved business content. Review before publishing.</p><button type="button" className="p-2 rounded bg-slate-700" onClick={() => save(createWebsiteComposition())}>Use sections layout</button></div> : <div className="mt-3 space-y-3">
      {[...config.sections].sort((a,b) => a.order - b.order).map((s, index) => {
        const required = SECTION_REGISTRY[s.type].required;
        const change = (patch: Partial<typeof s>) => save({ ...config, sections: config.sections.map(x => x.id === s.id ? { ...x, ...patch } : x) });
        const move = (delta: number) => { const sections = [...config.sections]; [sections[index], sections[index + delta]] = [sections[index + delta], sections[index]]; save({ ...config, sections }); };
        return <div key={s.id} className="border border-slate-700 rounded-lg p-2 space-y-2 text-xs">
          <label className="flex gap-2"><input type="checkbox" checked={s.enabled} disabled={required} onChange={e => change({ enabled: e.target.checked })} />{SECTION_REGISTRY[s.type].label}{required && ' (required)'}</label>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={required || index <= 1} onClick={() => move(-1)}>↑ Up</button><button type="button" disabled={required || index >= config.sections.length - 2} onClick={() => move(1)}>↓ Down</button><button type="button" disabled={required} onClick={() => save({ ...config, sections: config.sections.filter(x => x.id !== s.id) })}>Remove</button></div>
          <select aria-label={`${s.id} variant`} className="bg-slate-900 w-full p-2" value={s.variant} onChange={e => change({ variant: e.target.value })}>{SECTION_REGISTRY[s.type].variants.map(v => <option key={v}>{v}</option>)}</select>
          {!required && <><input aria-label={`${s.id} heading`} className="bg-slate-900 w-full p-2" placeholder="Heading (optional)" maxLength={150} value={s.data.heading || ''} onChange={e => change({ data: { ...s.data, heading: e.target.value } })} /><textarea aria-label={`${s.id} text`} className="bg-slate-900 w-full p-2" placeholder="Text (optional)" maxLength={2000} value={s.data.body || ''} onChange={e => change({ data: { ...s.data, body: e.target.value } })} />
          <label className="block">Image URL<input className="bg-slate-900 w-full p-2" maxLength={500} value={s.data.image || ''} onChange={e => change({ data: { ...s.data, image: e.target.value } })} /></label>
          <label className="block">Image description<input className="bg-slate-900 w-full p-2" maxLength={150} value={s.data.alt || ''} onChange={e => change({ data: { ...s.data, alt: e.target.value } })} /></label>
          <p>Items</p>{(s.data.items || []).map((item, itemIndex) => <div key={itemIndex} className="border border-slate-700 p-2 space-y-2">{(['title','text','price','image'] as const).map(field => <label key={field} className="block">{field}<input className="bg-slate-900 w-full p-2" maxLength={field === 'text' ? 1000 : field === 'image' ? 500 : field === 'price' ? 40 : 150} value={item[field] || ''} onChange={e => change({ data: { ...s.data, items: (s.data.items || []).map((x, n) => n === itemIndex ? { ...x, [field]: e.target.value } : x) } })} /></label>)}<button type="button" onClick={() => change({ data: { ...s.data, items: (s.data.items || []).filter((_, n) => n !== itemIndex) } })}>Remove item</button></div>)}
          <button type="button" disabled={(s.data.items?.length || 0) >= 30} onClick={() => change({ data: { ...s.data, items: [...(s.data.items || []), { title: 'New item' }] } })}>Add item</button></>}
        </div>;
      })}
      <select aria-label="Section to add" className="bg-slate-900 w-full p-2" value={adding} onChange={e => setAdding(e.target.value as WebsiteSectionType)}>{(Object.keys(SECTION_REGISTRY) as WebsiteSectionType[]).filter(t => !SECTION_REGISTRY[t].required).map(t => <option value={t} key={t}>{SECTION_REGISTRY[t].label}</option>)}</select>
      <button type="button" disabled={config.sections.length >= 25} className="p-2 rounded bg-slate-700" onClick={() => { const sections = [...config.sections]; sections.splice(sections.length - 1, 0, { id: `${adding}-${crypto.randomUUID()}`, type: adding, enabled: true, variant: SECTION_REGISTRY[adding].variants[0], order: 0, data: {} }); save({ ...config, sections }); }}>Add section</button>
    </div>}
  </details>;
}
