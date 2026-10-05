import { WebsiteImageField } from './WebsiteImageField';
import { WebsiteTemplateItemsControl } from './WebsiteTemplateItemsControl';
import React, { useState } from 'react';
import type { SiteContent } from '../../../types/index.js';
import {
  SECTION_REGISTRY,
  createWebsiteComposition,
  type WebsiteSectionType,
  type WebsiteComposition,
} from '../../../config/websiteBuilder.js';
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Layers,
  CheckCircle2,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

export function WebsiteSectionsControl({
  content,
  onChange,
  siteId,
  token,
  templateId,
}: {
  content: SiteContent;
  siteId: string;
  token: string;
  templateId: string;
  onChange: (content: SiteContent) => void;
}) {
  const [adding, setAdding] = useState<WebsiteSectionType>('about');
  const config = content.composition;

  const save = (composition: WebsiteComposition) =>
    onChange({
      ...content,
      composition: {
        ...composition,
        sections: composition.sections.map((s, order) => ({ ...s, order })),
      },
    });

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#00c365]" />
            <span>Page Sections</span>
          </h3>
          <p className="text-xs text-slate-400">
            Reorder, toggle, and customize the layout blocks on your website.
          </p>
        </div>
      </div>

      {!config ? (
        <div className="p-4 rounded-2xl bg-[#0e1620] border border-slate-800 space-y-3 text-xs">
          <p className="text-slate-300 leading-relaxed">
            Your current template layout is active with your customized business content. You can enable custom sections management to reorder, add, and remove specific content blocks.
          </p>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs cursor-pointer transition-all shadow-sm active:scale-95"
            onClick={() => save(createWebsiteComposition())}
          >
            Enable Custom Sections Layout
          </button>
          {templateId !== 'tmpl-data-reseller' && <WebsiteTemplateItemsControl items={content.items || []} onChange={items=>onChange({...content,items})} siteId={siteId} token={token} templateId={templateId} />}
        </div>
      ) : (
        <div className="space-y-3">
          {[...config.sections]
            .sort((a, b) => a.order - b.order)
            .map((s, index) => {
              const required = SECTION_REGISTRY[s.type].required;
              const change = (patch: Partial<typeof s>) =>
                save({
                  ...config,
                  sections: config.sections.map((x) => (x.id === s.id ? { ...x, ...patch } : x)),
                });
              const move = (delta: number) => {
                const sections = [...config.sections];
                [sections[index], sections[index + delta]] = [
                  sections[index + delta],
                  sections[index],
                ];
                save({ ...config, sections });
              };

              return (
                <div
                  key={s.id}
                  className={`border rounded-2xl p-3.5 space-y-3 text-xs transition-all ${
                    s.enabled
                      ? 'border-slate-800 bg-[#0d151c]'
                      : 'border-slate-800/50 bg-[#080d12]/60 opacity-75'
                  }`}
                >
                  {/* Section Title & Status Bar */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-800/80">
                    <label className="flex items-center gap-2 font-semibold text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        disabled={required}
                        onChange={(e) => change({ enabled: e.target.checked })}
                        className="w-4 h-4 rounded text-[#00c365] focus:ring-[#00c365] focus:ring-offset-0 bg-slate-900 border-slate-700 cursor-pointer disabled:opacity-50"
                      />
                      <span className="text-xs sm:text-sm font-bold">
                        {SECTION_REGISTRY[s.type].label}
                      </span>
                      {required && (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          Required
                        </span>
                      )}
                    </label>

                    {/* Move and Remove Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={required || index <= 1}
                        onClick={() => move(-1)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold border border-slate-700/80 transition-colors flex items-center gap-1 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3 h-3" />
                        <span>Up</span>
                      </button>
                      <button
                        type="button"
                        disabled={required || index >= config.sections.length - 2}
                        onClick={() => move(1)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold border border-slate-700/80 transition-colors flex items-center gap-1 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3 h-3" />
                        <span>Down</span>
                      </button>
                      {!required && (
                        <button
                          type="button"
                          onClick={() =>
                            save({
                              ...config,
                              sections: config.sections.filter((x) => x.id !== s.id),
                            })
                          }
                          className="px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-[11px] font-semibold border border-rose-900/50 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Remove Section"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Section Variant Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 block">
                      Layout Style
                    </label>
                    <select
                      aria-label={`${s.id} variant`}
                      className="bg-[#111922] border border-slate-800 rounded-xl w-full p-2 text-xs text-white focus:outline-none focus:border-[#00c365]"
                      value={s.variant}
                      onChange={(e) => change({ variant: e.target.value })}
                    >
                      {SECTION_REGISTRY[s.type].variants.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Section Content Fields (for non-required customizable sections) */}
                  {!required && (
                    <div className="space-y-2.5 pt-1">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-400 block">
                          Section Heading (Optional)
                        </label>
                        <input
                          aria-label={`${s.id} heading`}
                          className="bg-[#111922] border border-slate-800 rounded-xl w-full px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00c365]"
                          placeholder="e.g. Our Specialities, Why Choose Us"
                          maxLength={150}
                          value={s.data.heading || ''}
                          onChange={(e) =>
                            change({ data: { ...s.data, heading: e.target.value } })
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-400 block">
                          Section Description / Body (Optional)
                        </label>
                        <textarea
                          aria-label={`${s.id} text`}
                          className="bg-[#111922] border border-slate-800 rounded-xl w-full p-2.5 text-xs text-white focus:outline-none focus:border-[#00c365] leading-relaxed resize-none"
                          rows={3}
                          placeholder="Section text or description..."
                          maxLength={2000}
                          value={s.data.body || ''}
                          onChange={(e) => change({ data: { ...s.data, body: e.target.value } })}
                        />
                      </div>

                      {/* Image fields */}
                      <div className="space-y-1.5 p-3 rounded-xl bg-[#090f14] border border-slate-800/80">
                        <WebsiteImageField label={SECTION_REGISTRY[s.type].label + ' image'} value={s.data.image || ''} siteId={siteId} token={token} onChange={url=>change({data:{...s.data,image:url}})} />

                        <label className="text-[11px] font-semibold text-slate-400 block pt-1">
                          Image Alt Description
                        </label>
                        <input
                          className="bg-[#111922] border border-slate-800 rounded-xl w-full px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00c365]"
                          placeholder="e.g. Modern kitchen workspace"
                          maxLength={150}
                          value={s.data.alt || ''}
                          onChange={(e) => change({ data: { ...s.data, alt: e.target.value } })}
                        />
                      </div>

                      <div className="grid gap-2">
                        <label className="text-xs text-slate-400">Section CTA label<input maxLength={150} value={s.data.ctaLabel || ''} onChange={e=>change({data:{...s.data,ctaLabel:e.target.value}})} className="block w-full bg-slate-900 border border-slate-800 p-2 rounded-lg text-white" /></label>
                        <label className="text-xs text-slate-400">Section CTA destination<input maxLength={500} value={s.data.ctaUrl || ''} onChange={e=>change({data:{...s.data,ctaUrl:e.target.value}})} placeholder="https://… or #section" className="block w-full bg-slate-900 border border-slate-800 p-2 rounded-lg text-white" /></label>
                      </div>

                      {/* Section Items / Cards (for lists, menu items, gallery entries) */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-300">
                            Section Items ({s.data.items?.length || 0})
                          </label>
                          <button
                            type="button"
                            disabled={(s.data.items?.length || 0) >= 30}
                            onClick={() =>
                              change({
                                data: {
                                  ...s.data,
                                  items: [...(s.data.items || []), { title: 'New item' }],
                                },
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-[#00c365]/15 hover:bg-[#00c365]/25 text-[#00c365] text-[11px] font-bold border border-[#00c365]/30 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Item</span>
                          </button>
                        </div>

                        {(s.data.items || []).map((item, itemIndex) => (
                          <div
                            key={itemIndex}
                            className="border border-slate-800 rounded-xl p-3 bg-[#080d12] space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                              <span className="font-bold text-slate-300">
                                Item #{itemIndex + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  change({
                                    data: {
                                      ...s.data,
                                      items: (s.data.items || []).filter(
                                        (_, n) => n !== itemIndex
                                      ),
                                    },
                                  })
                                }
                                className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remove</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(['title', 'price'] as const).filter(field=>s.type!=='faq' || field==='title').map((field) => (
                                <label key={field} className="space-y-1 block">
                                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                                    {field === 'title' ? 'Item Title' : 'Price (GH₵)'}
                                  </span>
                                  <input
                                    className="bg-[#111922] border border-slate-800 rounded-lg w-full px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00c365]"
                                    maxLength={field === 'price' ? 40 : 150}
                                    placeholder={field === 'price' ? 'e.g. 45.00' : 'Item name'}
                                    value={item[field] || ''}
                                    onChange={(e) =>
                                      change({
                                        data: {
                                          ...s.data,
                                          items: (s.data.items || []).map((x, n) =>
                                            n === itemIndex ? { ...x, [field]: e.target.value } : x
                                          ),
                                        },
                                      })
                                    }
                                  />
                                </label>
                              ))}
                            </div>

                            <label className="space-y-1 block">
                              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                                Description
                              </span>
                              <input
                                className="bg-[#111922] border border-slate-800 rounded-lg w-full px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00c365]"
                                maxLength={1000}
                                placeholder="Short description..."
                                value={item.text || ''}
                                onChange={(e) =>
                                  change({
                                    data: {
                                      ...s.data,
                                      items: (s.data.items || []).map((x, n) =>
                                        n === itemIndex ? { ...x, text: e.target.value } : x
                                      ),
                                    },
                                  })
                                }
                              />
                            </label>

                            {s.type!=='faq' && <WebsiteImageField label={'Item ' + (itemIndex + 1) + ' image'} value={item.image || ''} siteId={siteId} token={token} onChange={url=>change({data:{...s.data,items:(s.data.items || []).map((x,n)=>n===itemIndex?{...x,image:url}:x)}})} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          {/* Add Section Controller */}
          <div className="p-3.5 rounded-2xl bg-[#090e13] border border-slate-800 space-y-2.5">
            <label className="text-xs font-bold text-slate-300 block">Add New Section</label>
            <div className="flex gap-2">
              <select
                aria-label="Section to add"
                className="bg-[#111922] border border-slate-800 rounded-xl flex-1 p-2 text-xs text-white focus:outline-none focus:border-[#00c365]"
                value={adding}
                onChange={(e) => setAdding(e.target.value as WebsiteSectionType)}
              >
                {(Object.keys(SECTION_REGISTRY) as WebsiteSectionType[])
                  .filter((t) => !SECTION_REGISTRY[t].required)
                  .map((t) => (
                    <option value={t} key={t}>
                      {SECTION_REGISTRY[t].label}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={config.sections.length >= 25}
                className="px-4 py-2 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 shadow-sm active:scale-95"
                onClick={() => {
                  const sections = [...config.sections];
                  sections.splice(sections.length - 1, 0, {
                    id: `${adding}-${crypto.randomUUID()}`,
                    type: adding,
                    enabled: true,
                    variant: SECTION_REGISTRY[adding].variants[0],
                    order: 0,
                    data: {},
                  });
                  save({ ...config, sections });
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
