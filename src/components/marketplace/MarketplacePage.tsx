import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import {
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_PRODUCTS,
} from '../../data/marketplace';
import { MarketplaceCategory, MarketplaceProduct } from '../../types';
import {
  Laptop,
  Smartphone,
  Cpu,
  Video,
  Database,
  Printer,
  Search,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  ExternalLink,
  Radio,
  FileQuestion,
  Phone,
  Tag,
} from 'lucide-react';

export const MarketplacePage: React.FC = () => {
  const { openMarketplaceInquiry, setActivePage } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = useMemo(() => {
    return MARKETPLACE_PRODUCTS.filter((product) => {
      if (selectedCategory !== 'all' && product.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(q);
        const matchesDesc = product.description.toLowerCase().includes(q);
        const matchesTagline = product.tagline.toLowerCase().includes(q);
        const matchesCategory = product.categoryLabel.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesTagline && !matchesCategory) {
          return false;
        }
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen py-6 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {/* Page Hero Header */}
        <div className="relative rounded-3xl bg-gradient-to-br from-[#0c1613] via-[#091012] to-[#070b0e] border border-slate-800/80 p-6 sm:p-10 lg:p-12 overflow-hidden shadow-2xl">
          {/* Ambient Glows */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#00c365]/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-500/5 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111e18] border border-[#00c365]/30 text-xs font-semibold text-[#00c365]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tech & Digital Marketplace</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Quality Technology, Digital Tools & <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#38bdf8]">
                Business Essentials Sourced for You
              </span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
              Mystery Hub sources genuine technology hardware, productivity suites, and creator equipment through verified distributor channels in Accra. Simple inquiries, transparent rates, and reliable Ghana dispatch.
            </p>

            {/* Trust Signals */}
            <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#00c365]" />
                <span>Verified Local Sourcing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#00c365]" />
                <span>No Fake Inventories</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#00c365]" />
                <span>Direct WhatsApp Inquiries</span>
              </div>
            </div>
          </div>
        </div>

        {/* WhatsApp Channel Spotlight Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#091512] border border-[#00c365]/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#00c365]/15 border border-[#00c365]/30 flex items-center justify-center text-[#00c365] shrink-0 mt-0.5 sm:mt-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm sm:text-base text-white">
                  Follow Mystery Hub on WhatsApp
                </h4>
                <span className="text-[10px] uppercase font-bold text-[#00c365] bg-[#00c365]/10 px-2 py-0.5 rounded">
                  Official Channel
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Get product drops, price updates, new template releases, and service announcements directly in your WhatsApp updates tab.
              </p>
            </div>
          </div>

          <a
            href={BUSINESS_CONFIG.contact.whatsappChannelUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm shrink-0 cursor-pointer"
          >
            <span>Follow WhatsApp Channel</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Filter and Search Bar */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search laptops, mics, software, accessories..."
                className="w-full bg-[#0e141a] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
              />
            </div>

            <div className="text-xs text-slate-400">
              Showing <span className="font-bold text-white">{filteredProducts.length}</span> sourced items
            </div>
          </div>

          {/* Category Tabs: Scrollable on mobile with smooth touch handling */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800 -mx-4 px-4 sm:mx-0 sm:px-0">
            {MARKETPLACE_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-[#00c365] text-black shadow-md font-bold'
                      : 'bg-[#0e141a] text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProducts.map((p) => {
              const availabilityBadge = {
                available: {
                  label: 'Available',
                  style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                },
                check_availability: {
                  label: 'Check Availability',
                  style: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
                },
                limited: {
                  label: 'Limited Sourcing',
                  style: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                },
                coming_soon: {
                  label: 'Coming Soon',
                  style: 'bg-slate-800 text-slate-400 border-slate-700',
                },
              }[p.availability];

              const directWhatsAppLink = BUSINESS_CONFIG.getMarketplaceInquiryWhatsAppUrl(p.name);

              return (
                <div
                  key={p.id}
                  className="rounded-2xl bg-[#0f151b] border border-slate-800 hover:border-slate-700/80 transition-all duration-200 flex flex-col justify-between overflow-hidden group shadow-md hover:shadow-xl"
                >
                  {/* Card Content */}
                  <div className="p-5 sm:p-6 space-y-4">
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-slate-400">
                        {p.categoryLabel}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${availabilityBadge.style}`}
                      >
                        {p.availabilityLabel || availabilityBadge.label}
                      </span>
                    </div>

                    {/* Product Name & Tagline */}
                    <div>
                      <h3 className="font-extrabold text-base sm:text-lg text-white group-hover:text-[#00c365] transition-colors">
                        {p.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {p.tagline}
                      </p>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3">
                      {p.description}
                    </p>

                    {/* Highlight Pills */}
                    {p.highlights && p.highlights.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {p.highlights.map((h, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px] text-slate-300">
                            <CheckCircle className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                            <span>{h}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Specs if available */}
                    {p.specs && p.specs.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-[#080d11] border border-slate-800/90 grid grid-cols-2 gap-2 text-[10px]">
                        {p.specs.map((s, i) => (
                          <div key={i}>
                            <span className="text-slate-500 block">{s.label}:</span>
                            <span className="text-slate-200 font-semibold">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Pricing and Inquire CTAs */}
                  <div className="p-5 sm:p-6 pt-0 space-y-3">
                    <div className="pt-3 border-t border-slate-800 flex items-baseline justify-between">
                      <span className="text-xs text-slate-400">Benchmark Price</span>
                      <span className="text-base sm:text-lg font-extrabold text-white tabular-nums">
                        {p.priceDisplay}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={() => openMarketplaceInquiry(p)}
                        className="w-full py-2.5 px-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-[0.98]"
                      >
                        <FileQuestion className="w-3.5 h-3.5" />
                        <span>Inquire Now</span>
                      </button>

                      <a
                        href={directWhatsAppLink}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#00c365]" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-[#0f151b] rounded-2xl border border-slate-800 space-y-3">
            <Tag className="w-10 h-10 text-slate-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">No products found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              We couldn&apos;t find any sourced items matching your query. Contact our sourcing desk directly for custom requests.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Custom Hardware & Software Sourcing Banner */}
        <div className="rounded-3xl bg-gradient-to-br from-[#0e161c] via-[#091014] to-[#070b0e] border border-slate-800 p-6 sm:p-10 space-y-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">
                Custom Tech Sourcing Service
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Need Specific Hardware or Software Not Listed Above?
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Whether you need specialized developer laptops for an engineering team, studio microphones for a campus podcast, or business software setups, Mystery Hub’s Accra sourcing team will locate genuine models from verified partners at competitive local rates.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
              <a
                href={BUSINESS_CONFIG.getGeneralWhatsAppUrl(
                  'Hello Mystery Hub team, I have a custom hardware/software sourcing request.'
                )}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp Sourcing Desk</span>
              </a>

              <a
                href={BUSINESS_CONFIG.contact.phoneLink}
                className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Phone className="w-4 h-4 text-amber-400" />
                <span>Call: 0592066298</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
