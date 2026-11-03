import { ExampleTag } from '../ExampleTag';
import { SiteFooterContact, websiteContactTarget } from '../SiteContactDetails';
import {useVisualEditMarkers, useIsVisualEditing, useTemplateCopy} from '../editor/VisualEditMarkers';
import { PublishedCatalogEmpty } from '../PublishedCatalogEmpty.js';
import { BusinessEnquiry } from '../BusinessEnquiry.js';
import { SafeImage } from '../SafeImage.js';
import { HoursList } from '../storefront/BusinessInfo.js';
import { ItemDetailSheet, ORDER_LIST_CSS, OrderBar, OrderListSheet, useOrderList } from '../storefront/OrderList';
import { websiteActionText } from '../../../utils/websiteBrand';
import React, { useState } from 'react';
import type { TemplateItem, WebsiteTemplate } from '../../../types';
import {
  Utensils,
  Clock,
  MapPin,
  Calendar,
  Users,
  MessageSquare,
  Check,
  Star,
  Phone,
  Flame,
  Plus,
} from 'lucide-react';

/** Table enquiries stay separate from food orders: these become the WhatsApp message, nothing is reserved. */
const DINING_TOPICS = ['a table', 'a group or event', 'catering'];
/** Classic Kitchen keeps its serif headings; the order sheets read in the page's sans for prices and buttons. */
const CK_CSS = `
.ck .ol-sheet{font-family:ui-sans-serif,system-ui,sans-serif}
.ck .ol-sheet .site-display{font-family:Georgia,'Noto Serif',serif}
.ck-add:active{transform:scale(.97)}
.ck-dish-main:focus-visible,.ck-add:focus-visible{outline:2px solid currentColor;outline-offset:3px;border-radius:12px}
`;

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
}

export const RestaurantTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick }) => {
  const edit = useVisualEditMarkers();
  const editing = useIsVisualEditing();
  const copy = useTemplateCopy(template);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const content = template.siteContent;
  const owner = !!content;
  const order = useOrderList();
  const [detail, setDetail] = useState<TemplateItem | null>(null);
  const [listOpen, setListOpen] = useState(false);
  // The gallery demo writes example messages only; a published site sends them to the owner's WhatsApp.
  const link = owner && !editing && typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : undefined;
  const contact = { businessName: template.demoBusinessName, whatsapp: owner ? content?.whatsapp : '', link, demo: !owner, onContact: () => { if (onCtaClick) onCtaClick(); else window.location.assign(websiteContactTarget(content)); } };
  // A tap opens the dish; the owner's editor keeps taps for editing.
  const open = (item: TemplateItem) => { if (!editing) setDetail(item); };
  const add = (item: TemplateItem) => { if (editing) return; if (item.options?.length) setDetail(item); else order.add(item); };
  const primary = template.colorScheme?.primary || '#7a1c28';

  const categories = template.siteContent ? ['All', ...new Set((template.items || []).map(item=>item.category).filter((category):category is string=>Boolean(category) && category!=='All'))] : ['All', 'Main Grills', 'Soups & Swallows', 'Beverages'];
  const menuItems = template.items || [];

  const filteredItems = menuItems.filter((item) => {
    if (activeCategory === 'All') return true;
    return item.category === activeCategory;
  });


  return (
    <div className="ck bg-[var(--website-background,#fcf9f5)] text-[#1c1917] font-serif min-h-full" style={{ '--ol-bg': '#fcf9f5', '--ol-text': '#1c1917', '--ol-muted': '#6b625c', '--ol-line': '#eadfce', '--ol-accent': primary, '--ol-on-accent': websiteActionText(primary), '--ol-radius': '20px' } as React.CSSProperties}>
      <style>{ORDER_LIST_CSS + CK_CSS}</style>
      {/* A slim location ribbon; published sites omit it until the owner adds a location. */}
      {(template.location || editing) && (
        <div className="bg-[var(--website-primary,#7a1c28)] text-[var(--website-background,#fcf9f5)] px-4 py-2 text-center text-xs tracking-wider uppercase font-sans flex items-center justify-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-[var(--website-accent,#c99a45)]" aria-hidden="true" />
          <span {...edit("content:location")}>{template.location}</span>
        </div>
      )}

      {/* Restaurant Navigation */}
      <nav className="bg-[var(--website-background,#fcf9f5)]/95 backdrop-blur-md border-b border-[#f3ece2] px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-30 font-sans">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--website-primary,#7a1c28)] text-[var(--website-accent,#c99a45)] flex items-center justify-center font-serif text-lg font-bold">
            {template.siteContent?.logoUrl ? <SafeImage {...edit("content:logoUrl")} src={template.siteContent.logoUrl} alt={`${template.demoBusinessName} logo`} className="w-9 h-9 shrink-0 rounded-lg" style={{objectFit:'contain'}} /> : template.demoBusinessName.slice(0,1)}
          </div>
          <div>
            <span className="font-bold text-base sm:text-lg tracking-wide text-[var(--website-primary,#7a1c28)] font-serif block leading-none" {...edit("content:businessName")}>
              {template.demoBusinessName}
            </span>
            <span className="text-[10px] text-[#78716c] uppercase tracking-widest block mt-0.5" {...edit("content:location")}>
              {template.location}
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs font-semibold uppercase tracking-wider text-[#78716c]">
          <a href="#menu" className="hover:text-[var(--website-primary,#7a1c28)] transition-colors">
            Our Menu
          </a>
          <a href="#reserve" className="hover:text-[var(--website-primary,#7a1c28)] transition-colors">
            {template.siteContent ? 'Enquire' : 'Table enquiry'}
          </a>
          <a href="#location" className="hover:text-[var(--website-primary,#7a1c28)] transition-colors">
            Find Us
          </a>
        </div>

        <button {...edit("content:ctaLabel")}
          onClick={onCtaClick}
          className="px-4 py-2 rounded-full bg-[var(--website-primary,#7a1c28)] hover:bg-[#5d151e] text-[var(--website-background,#fcf9f5)] text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer font-sans"
        >
          <Calendar className="w-3.5 h-3.5 text-[var(--website-accent,#c99a45)]" />
          <span>{template.siteContent?.ctaLabel || (template.siteContent ? 'Contact us' : 'Ask for a table')}</span>
        </button>
      </nav>

      {/* Hero Section */}
      <div className="relative py-14 sm:py-20 px-6 sm:px-12 bg-gradient-to-br from-[#2a0e14] via-[#3b151d] to-[#1c090d] text-white overflow-hidden">
        <SafeImage {...edit("content:heroImage")}  className="absolute inset-0 opacity-45   " src={template.heroImage || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5'} alt={template.demoBusinessName} loading="eager" fetchPriority="high" />
        <div className="relative max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--website-accent,#c99a45)]/20 border border-[var(--website-accent,#c99a45)]/40 text-[var(--website-accent,#c99a45)] text-xs font-sans font-semibold tracking-wider uppercase">
            <Utensils className="w-3.5 h-3.5" />
            <span {...copy.edit('eyebrow')}>{copy.text('eyebrow')}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-normal tracking-tight leading-[1.15] text-white" {...edit("content:tagline")}>
            {template.demoHeroTagline}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 font-sans max-w-xl leading-relaxed" {...edit("content:aboutText")}>
            {template.demoSubtext}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 font-sans">
            <a
              href="#reserve"
              className="px-6 py-3 rounded-full bg-[var(--website-accent,#c99a45)] hover:bg-[#b58735] text-[#1c1917] font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
            >
              <span {...copy.edit('primary')}>{copy.text('primary')}</span>
            </a>
            <a
              href="#menu"
              className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs uppercase tracking-wider border border-white/20 transition-all flex items-center gap-2"
            >
              <span {...copy.edit('secondary')}>{copy.text('secondary')}</span>
            </a>
          </div>

          {/* Key Restaurant Statistics */}
          {!!template.stats?.length && <div className="pt-6 grid grid-cols-3 gap-4 border-t border-white/15 max-w-md font-sans">
            {template.stats?.map((stat, i) => (
              <div key={i}>
                <div className="text-xl font-bold text-[var(--website-accent,#c99a45)] font-serif">{stat.value}</div>
                <div className="text-[11px] text-slate-300 uppercase tracking-wider mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>}
        </div>
      </div>

      {/* Interactive Food Menu Section */}
      <div id="menu" className="py-14 px-4 sm:px-12 max-w-5xl mx-auto space-y-8 font-sans">
        <div className="text-center max-w-lg mx-auto space-y-2">
          <span className="text-xs uppercase tracking-widest text-[var(--website-accent,#c99a45)] font-bold" {...copy.edit('itemsEyebrow')}>{copy.text('itemsEyebrow')}</span>
          <h2 className="text-2xl sm:text-3xl font-serif text-[var(--website-primary,#7a1c28)]" {...copy.edit('itemsHeading')}>{copy.text('itemsHeading')}</h2>
          <p className="text-xs text-[#78716c]" {...copy.edit('itemsIntro')}>{copy.text('itemsIntro')}</p>
        </div>

        {/* Menu Category Filter Pills */}
        {categories.length > 1 && <div className="flex items-center justify-center gap-2 flex-wrap" role="group" aria-label="Menu categories">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              className={`min-h-10 px-4 rounded-full text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-[var(--website-primary,#7a1c28)] text-white shadow-sm'
                  : 'bg-white border border-[#eadfce] text-[#6b625c] hover:border-[var(--website-primary,#7a1c28)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>}

        {/* Menu: tap a dish for its photos, options and price; Add builds one WhatsApp order. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {template.siteContent && !filteredItems.length && <PublishedCatalogEmpty onContact={onCtaClick}/>}
          {filteredItems.map((item) => (
            <div {...edit(`item:${item.id}`)}
              key={item.id || item.name}
              className="ck-dish relative bg-white p-4 rounded-2xl border border-[#f3ece2] shadow-sm hover:shadow-md transition-shadow flex gap-4 items-start"
            >
              <ExampleTag item={item} corner="left"/>
              {item.image && (
                <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => open(item)} className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100 p-0 border-0">
                  <SafeImage
                    src={item.image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <button type="button" onClick={() => open(item)} aria-label={`${item.name}, ${item.price || "price on request"}, details`} className="ck-dish-main block w-full min-h-11 text-left bg-transparent border-0 p-0 text-inherit">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-bold text-[15px] leading-snug text-[#1c1917] font-serif min-w-0 [overflow-wrap:anywhere]">{item.name}</span>
                    <span className="font-bold text-sm text-[var(--website-primary,#7a1c28)] shrink-0 font-sans">
                      {item.price || 'Ask'}
                    </span>
                  </span>
                  {item.desc && <span className="block text-xs text-[#6b625c] leading-relaxed line-clamp-2 mt-1">
                    {item.desc}
                  </span>}
                </button>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="flex flex-wrap items-center gap-1.5 min-w-0">
                    {(item.label || item.tag) && (
                      <span className="inline-block text-[10px] font-bold text-[#8a5a12] bg-[var(--website-accent,#c99a45)]/15 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {item.label || item.tag}
                      </span>
                    )}
                    {!!item.options?.length && <span className="text-[11px] text-[#6b625c]">{item.options.length} choices</span>}
                  </span>
                  <button type="button" onClick={() => add(item)} aria-label={`Add ${item.name} to your order`} className="ck-add min-h-10 min-w-[76px] px-3 rounded-full border border-[var(--website-primary,#7a1c28)] text-[var(--website-primary,#7a1c28)] font-bold text-xs inline-flex items-center justify-center gap-1 shrink-0">
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-[#6b625c] max-w-md mx-auto">{owner ? `Add dishes to your list and send them to ${template.demoBusinessName} on WhatsApp. They confirm availability, delivery and payment with you.` : 'Example menu. Customers add dishes to a list and send it to the restaurant on WhatsApp; nothing is paid here.'}</p>
      </div>

      {/* Interactive Table Reservation Card */}
      <div id="reserve" className="py-12 px-4 sm:px-12 bg-[#f3ece2]/60 border-y border-[#e7ded1] font-sans">
        <div className="max-w-3xl mx-auto bg-white rounded-3xl p-6 sm:p-10 shadow-lg border border-[#e2d5c3] space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold text-[var(--website-primary,#7a1c28)] uppercase tracking-widest" {...copy.edit('enquiryEyebrow')}>{copy.text('enquiryEyebrow')}</span>
            <h3 className="text-2xl font-serif text-[#1c1917]" {...copy.edit('enquiryHeading')}>{copy.text('enquiryHeading')}</h3>
            <p className="text-xs text-[#78716c]" {...copy.edit('enquiryIntro')}>{copy.text('enquiryIntro')}</p>
          </div>

          <BusinessEnquiry onContact={onCtaClick} template={template} askLabel="Ask about" dateLabel="Date of your visit" guestsLabel="Number of guests" topics={DINING_TOPICS}/>
        </div>
      </div>

      {/* Location & Contact Footer */}
      <footer id="location" className="bg-[#1c1917] text-white py-7 sm:py-10 px-6 sm:px-12 font-sans text-xs">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="space-y-2">
            <h4 className="font-serif font-bold text-base text-[var(--website-accent,#c99a45)]" {...edit("content:businessName")}>
              {template.demoBusinessName}
            </h4>
            <p className="text-slate-400 text-xs leading-relaxed" {...edit("content:aboutText")}>
              {template.demoSubtext}
            </p>
          </div>
          {(template.location || editing || template.siteContent?.hours) && <div className="space-y-2">
            <h5 className="font-bold text-white uppercase tracking-wider text-[11px]">
              {template.siteContent?.hours ? 'Location & Hours' : 'Location'}
            </h5>
            <p className="text-slate-400 text-xs" {...edit("content:location")}>
              {template.location}
            </p>
            {template.siteContent?.hours && <HoursList hours={template.siteContent.hours} className="text-slate-400 text-xs" />}
          </div>}
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase tracking-wider text-[11px]">
              Contact
            </h5>
            <SiteFooterContact template={template} className="text-slate-400 text-xs" />
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                <Check className="w-3.5 h-3.5" />
                <span>Contact for payment arrangements</span>
              </span>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 mt-5 sm:mt-8 pt-4 text-center text-slate-500 text-[10px]">
          © {new Date().getFullYear()} {template.demoBusinessName}.
        </div>
      </footer>

      <OrderBar lines={order.lines} onOpen={() => setListOpen(true)} />
      {detail && <ItemDetailSheet item={detail} contact={contact} onAdd={order.add} onClose={() => setDetail(null)} />}
      {listOpen && <OrderListSheet lines={order.lines} contact={contact} onQuantity={order.setQuantity} onClear={() => { order.clear(); setListOpen(false); }} onClose={() => setListOpen(false)} noun="dishes" />}
    </div>
  );
};
