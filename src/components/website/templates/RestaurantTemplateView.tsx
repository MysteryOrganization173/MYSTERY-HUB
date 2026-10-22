import { ExampleTag } from '../ExampleTag';
import { SiteFooterContact } from '../SiteContactDetails';
import {useVisualEditMarkers, useIsVisualEditing, useTemplateCopy} from '../editor/VisualEditMarkers';
import { PublishedCatalogEmpty } from '../PublishedCatalogEmpty.js';
import { BusinessEnquiry } from '../BusinessEnquiry.js';
import { SafeImage } from '../SafeImage.js';
import { HoursList } from '../storefront/BusinessInfo.js';
import React, { useState } from 'react';
import { WebsiteTemplate } from '../../../types';
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
} from 'lucide-react';

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
}

export const RestaurantTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick }) => {
  const edit = useVisualEditMarkers();
  const editing = useIsVisualEditing();
  const copy = useTemplateCopy(template);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = template.siteContent ? ['All', ...new Set((template.items || []).map(item=>item.category).filter((category):category is string=>Boolean(category) && category!=='All'))] : ['All', 'Main Grills', 'Soups & Swallows', 'Beverages'];
  const menuItems = template.items || [];

  const filteredItems = menuItems.filter((item) => {
    if (activeCategory === 'All') return true;
    return item.category === activeCategory;
  });


  return (
    <div className="bg-[var(--website-background,#fcf9f5)] text-[#1c1917] font-serif min-h-full">
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
            {template.siteContent ? 'Enquire' : 'Reservations'}
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
          <span>{template.siteContent?.ctaLabel || (template.siteContent ? 'Contact us' : 'Reserve Table')}</span>
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
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-[var(--website-primary,#7a1c28)] text-white shadow-sm'
                  : 'bg-white border border-[#f3ece2] text-[#78716c] hover:border-[var(--website-primary,#7a1c28)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {template.siteContent && !filteredItems.length && <PublishedCatalogEmpty onContact={onCtaClick}/>}
          {filteredItems.map((item) => (
            <div {...edit(`item:${item.id}`)}
              key={item.id}
              className="relative bg-white p-4 rounded-2xl border border-[#f3ece2] shadow-sm hover:shadow-md transition-shadow flex gap-4 items-start"
            >
              <ExampleTag item={item} corner="left"/>
              {item.image && (
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                  <SafeImage
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-[#1c1917] font-serif">{item.name}</h3>
                  <span className="font-bold text-xs text-[var(--website-primary,#7a1c28)] shrink-0 font-sans">
                    {item.price}
                  </span>
                </div>
                <p className="text-xs text-[#78716c] leading-relaxed line-clamp-2">
                  {item.desc}
                </p>
                {item.tag && (
                  <span className="inline-block text-[10px] font-bold text-[var(--website-accent,#c99a45)] bg-[var(--website-accent,#c99a45)]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {item.tag}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Table Reservation Card */}
      <div id="reserve" className="py-12 px-4 sm:px-12 bg-[#f3ece2]/60 border-y border-[#e7ded1] font-sans">
        <div className="max-w-3xl mx-auto bg-white rounded-3xl p-6 sm:p-10 shadow-lg border border-[#e2d5c3] space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold text-[var(--website-primary,#7a1c28)] uppercase tracking-widest" {...copy.edit('enquiryEyebrow')}>{copy.text('enquiryEyebrow')}</span>
            <h3 className="text-2xl font-serif text-[#1c1917]" {...copy.edit('enquiryHeading')}>{copy.text('enquiryHeading')}</h3>
            <p className="text-xs text-[#78716c]" {...copy.edit('enquiryIntro')}>{copy.text('enquiryIntro')}</p>
          </div>

          <BusinessEnquiry onContact={onCtaClick} template={template} askLabel="Ask about" dateLabel="Date of your visit"/>
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
              {template.siteContent ? 'Contact' : 'Reservations'}
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
    </div>
  );
};
