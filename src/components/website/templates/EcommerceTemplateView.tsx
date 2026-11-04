import { ExampleTag } from '../ExampleTag';
import { SiteFooterContact, websiteContactTarget } from '../SiteContactDetails';
import {useVisualEditMarkers, useIsVisualEditing, useTemplateCopy} from '../editor/VisualEditMarkers';
import { PublishedCatalogEmpty } from '../PublishedCatalogEmpty.js';
import { SafeImage } from '../SafeImage.js';
import { ItemDetailSheet, ORDER_LIST_CSS, OrderBar, OrderListSheet, useOrderList } from '../storefront/OrderList';
import { orderCount } from '../../../utils/websiteOrderList';
import { websiteActionText } from '../../../utils/websiteBrand';
import { focalPosition } from '../../../config/websiteContentV5';
import React, { useState } from 'react';
import type { TemplateItem, WebsiteTemplate } from '../../../types';
import {
  ShoppingBag,
  Truck,
  ShieldCheck,
  Check,
  ArrowRight,
  Info,
  Phone,
  Plus,
  RotateCcw,
} from 'lucide-react';

/** Classic Shop's product cards: the whole card opens the product; one clear action adds it or asks for an option. */
const CS_CSS = `
.cs-add{min-height:44px;border-radius:12px;font-weight:700;font-size:13px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 14px}
.cs-add:active{transform:scale(.98)}
.cs-card :is(button):focus-visible{outline:2px solid var(--website-accent,#2563eb);outline-offset:2px}
`;

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
}

export const EcommerceTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick }) => {
  const edit = useVisualEditMarkers();
  const copy = useTemplateCopy(template);
  const editing = useIsVisualEditing();
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const content = template.siteContent;
  const owner = !!content;
  const order = useOrderList();
  const [detail, setDetail] = useState<TemplateItem | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const products = template.items || [];
  const filteredProducts = products.filter((p) => {
    if (activeCategory === 'All') return true;
    return p.category === activeCategory;
  });
  const categories = ['All', ...new Set(products.map(item => item.category).filter((category): category is string => Boolean(category) && category !== 'All'))];
  const count = orderCount(order.lines);
  const accent = template.colorScheme?.accent || '#2563eb';
  // The gallery demo writes example messages only; a published shop sends them to the owner's WhatsApp.
  const link = owner && !editing && typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : undefined;
  const contact = { businessName: template.demoBusinessName, whatsapp: owner ? content?.whatsapp : '', link, demo: !owner, onContact: () => { if (onCtaClick) onCtaClick(); else window.location.assign(websiteContactTarget(content)); } };
  // A tap opens the product; the owner's editor keeps taps for editing. Products with options open first.
  const open = (item: TemplateItem) => { if (!editing) setDetail(item); };
  const add = (item: TemplateItem) => { if (editing) return; if (item.options?.length) setDetail(item); else order.add(item); };

  return (
    <div className="bg-[#f8fafc] text-slate-900 font-sans min-h-full" style={{ '--ol-bg': '#ffffff', '--ol-text': '#0f172a', '--ol-muted': '#475569', '--ol-line': '#e2e8f0', '--ol-accent': accent, '--ol-on-accent': websiteActionText(accent), '--ol-radius': '18px' } as React.CSSProperties}>
      <style>{ORDER_LIST_CSS + CS_CSS}</style>
      {/* Top E-Commerce Announcement Bar */}
      <div className="bg-slate-900 text-slate-100 text-xs px-4 py-2 text-center font-semibold flex items-center justify-center gap-2">
        <Info className="w-3.5 h-3.5 shrink-0 text-slate-300" aria-hidden="true" />
        <span>Contact the business to confirm stock, delivery and payment arrangements.</span>
      </div>

      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--website-accent,#2563eb)] text-white flex items-center justify-center font-black">
            {template.siteContent?.logoUrl ? <SafeImage {...edit("content:logoUrl")} src={template.siteContent.logoUrl} alt={`${template.demoBusinessName} logo`} className="w-9 h-9 shrink-0 rounded-lg" style={{objectFit:'contain'}} /> : template.demoBusinessName.slice(0,1)}
          </div>
          <div>
            <span className="font-black text-base sm:text-lg tracking-tight text-slate-900 block leading-none" {...edit("content:businessName")}>
              {template.demoBusinessName}
            </span>
            <span className="text-[10px] text-slate-500 block font-semibold mt-0.5" {...edit("content:location")}>
              {template.location}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { if (!editing) setListOpen(true); }}
            className="relative w-11 h-11 inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer"
            aria-label={count ? `Your order list, ${count} item${count === 1 ? '' : 's'}` : 'Your order list'}
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            {count > 0 && <span aria-hidden="true" className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-[#ef4444] text-white text-[11px] font-bold rounded-full flex items-center justify-center">
              {count}
            </span>}
          </button>

          <button {...edit("content:ctaLabel")}
            onClick={onCtaClick}
            className="min-h-11 px-3.5 rounded-xl bg-[var(--website-accent,#2563eb)] hover:bg-[#1d4ed8] text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <span>{template.siteContent?.ctaLabel || 'Contact'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* Hero Showcase */}
      <div className="relative py-12 sm:py-16 px-6 sm:px-12 bg-slate-900 text-white overflow-hidden">
        <SafeImage {...edit("content:heroImage")}  className="absolute inset-0" src={template.heroImage || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e'} alt={template.siteContent?.imageMeta?.heroImage?.alt || ''} loading="eager" fetchPriority="high" style={{ objectPosition: template.siteContent?.imageMeta?.heroImage ? focalPosition(template.siteContent.imageMeta.heroImage) : '75% 50%' }} />
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgba(15,23,42,.94)_0%,rgba(15,23,42,.78)_50%,rgba(15,23,42,.25)_100%)]" aria-hidden="true" />
        <div className="relative max-w-2xl space-y-4">
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30" {...copy.edit('eyebrow')}>{copy.text('eyebrow')}</span>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white" {...edit("content:tagline")}>
            {template.demoHeroTagline}
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-lg" {...edit("content:aboutText")}>
            {template.demoSubtext}
          </p>

          <div className="pt-2 flex flex-wrap gap-2.5">
            <a
              href="#products"
              className="px-5 py-2.5 rounded-xl bg-[var(--website-accent,#2563eb)] hover:bg-[#1d4ed8] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2"
            >
              <span {...copy.edit('primary')}>{copy.text('primary')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onCtaClick}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs uppercase tracking-wider border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span {...copy.edit('secondary')}>{copy.text('secondary')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Trust Badges Bar */}
      <div className="bg-white border-b border-slate-200 py-4 px-6 sm:px-12">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-[var(--website-accent,#2563eb)] shrink-0" />
            <div>
              <div className="font-bold text-slate-800">Delivery options</div>
              <div className="text-[10px] text-slate-500">Confirm with the business</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <div className="font-bold text-slate-800">Product information</div>
              <div className="text-[10px] text-slate-500">Ask before ordering</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Check className="w-5 h-5 text-[var(--website-accent,#2563eb)] shrink-0" />
            <div>
              <div className="font-bold text-slate-800">Payment arrangements</div>
              <div className="text-[10px] text-slate-500">Confirm with the business</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <RotateCcw className="w-5 h-5 text-slate-700 shrink-0" />
            <div>
              <div className="font-bold text-slate-800">Returns policy</div>
              <div className="text-[10px] text-slate-500">Ask before ordering</div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Catalog Grid */}
      <div id="products" className="py-12 px-4 sm:px-12 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight" {...copy.edit('itemsHeading')}>{copy.text('itemsHeading')}</h2>
            <p className="text-xs text-slate-500 mt-0.5" {...copy.edit('itemsIntro')}>{copy.text('itemsIntro')}</p>
          </div>

          {categories.length > 1 && <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Product categories">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 min-h-10 px-3.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-[var(--website-accent,#2563eb)] text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>}
        </div>

        {/* Two products per row on phones, like a shop shelf; tap a product for photos, options and quantity. */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {template.siteContent && !filteredProducts.length && <div className="col-span-full"><PublishedCatalogEmpty onContact={onCtaClick}/></div>}
          {filteredProducts.map((p) => (
            <div {...edit(`item:${p.id}`)}
              key={p.id || p.name}
              className="cs-card relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col group min-w-0"
            >
              <ExampleTag item={p} corner="right" flow={!p.image}/>
              <button type="button" onClick={() => open(p)} aria-label={`${p.name}${p.price ? `, ${p.price}` : ''}, details`} className="block w-full text-left bg-transparent border-0 p-0 text-inherit flex-1">
                {p.image && (
                  <span className="block aspect-square overflow-hidden relative bg-slate-50 p-3">
                    <SafeImage
                      src={p.image}
                      alt=""
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                      style={{ objectPosition: focalPosition(p.focal) }}
                    />
                    {(p.label || p.tag) && (
                      <span className="absolute top-2 left-2 bg-[#b91c1c] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase max-w-[80%] truncate">
                        {p.label || p.tag}
                      </span>
                    )}
                  </span>
                )}
                <span className="block p-3 sm:p-4 space-y-1">
                  <span className="block font-bold text-[13.5px] sm:text-sm leading-snug text-slate-900 line-clamp-2 [overflow-wrap:anywhere] group-hover:text-[var(--website-accent,#2563eb)] transition-colors">
                    {p.name}
                  </span>
                  <span className="block font-extrabold text-[15px] sm:text-base text-slate-900">
                    {p.price || <span className="text-sm font-semibold text-slate-500">Price on request</span>}
                  </span>
                  {!!p.options?.length && <span className="block text-[11.5px] text-slate-500 truncate">{p.options.join(' · ')}</span>}
                  {p.desc && <span className="hidden sm:block text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {p.desc}
                  </span>}
                </span>
              </button>

              <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                <button
                  type="button"
                  onClick={() => add(p)}
                  aria-label={p.options?.length ? `Choose an option for ${p.name}` : `Add ${p.name} to your order list`}
                  className="cs-add w-full bg-[var(--website-accent,#2563eb)] hover:brightness-110 text-white transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>{p.options?.length ? 'Choose' : 'Add'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 max-w-xl">{owner ? `Add products to your list and send it to ${template.demoBusinessName} on WhatsApp. They confirm stock, delivery and payment with you; nothing is paid on this website.` : 'Example products. Customers build an order list and send it to the shop on WhatsApp; nothing is paid here.'}</p>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-7 sm:py-10 px-6 sm:px-12 text-xs">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="space-y-2">
            <h4 className="font-bold text-white text-base" {...edit("content:businessName")}>
              {template.demoBusinessName}
            </h4>
            <p className="text-slate-400 text-xs leading-relaxed" {...edit("content:aboutText")}>
              {template.demoSubtext}
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Visit the shop</h5>
            <p className="text-xs" {...edit("content:location")}>{template.location}</p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase text-xs">Order or ask</h5>
            <SiteFooterContact template={template} className="text-xs" />
          </div>
        </div>
        <div className="border-t border-slate-800 mt-5 sm:mt-8 pt-4 text-center text-slate-500 text-[10px]">
          © {new Date().getFullYear()} {template.demoBusinessName}.
        </div>
      </footer>

      <OrderBar lines={order.lines} onOpen={() => setListOpen(true)} />
      {detail && <ItemDetailSheet item={detail} contact={contact} onAdd={order.add} onClose={() => setDetail(null)} />}
      {listOpen && <OrderListSheet lines={order.lines} contact={contact} onQuantity={order.setQuantity} onClear={() => { order.clear(); setListOpen(false); }} onClose={() => setListOpen(false)} noun="products" />}
    </div>
  );
};
