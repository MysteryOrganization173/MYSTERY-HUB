import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import { MARKETPLACE_CATEGORIES } from '../../data/marketplace';
import { MarketplaceCategory, MarketplaceProduct } from '../../types';
import { getPublicMarketplaceProducts } from '../../services/apiClient';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';
import { OptimizedImage } from '../common/OptimizedImage';
import {
  Laptop,
  Smartphone,
  Cpu,
  Mic,
  Printer,
  Search,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  ExternalLink,
  Radio,
  FileQuestion,
  Phone,
  Box,
  RotateCcw,
} from 'lucide-react';

export const MarketplacePage: React.FC = () => {
  const { openMarketplaceInquiry } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Live Backend Data States
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hero image load & error states for smooth reveal
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPublicMarketplaceProducts({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
      });
      if (res.success) {
        setProducts(res.products || []);
      } else {
        setError(res.error || 'Unable to connect to Marketplace sourcing catalogue.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to Marketplace service.');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchesName = p.name.toLowerCase().includes(q);
      const matchesDesc = (p.description || '').toLowerCase().includes(q);
      const matchesTagline = (p.tagline || '').toLowerCase().includes(q);
      const matchesCategory = (p.categoryLabel || '').toLowerCase().includes(q);
      return matchesName || matchesDesc || matchesTagline || matchesCategory;
    });
  }, [products, searchQuery]);

  const getCategoryFallbackIcon = (category: string) => {
    switch (category) {
      case 'laptops_computers':
        return <Laptop className="w-8 h-8 text-sky-400 opacity-80" />;
      case 'phones_accessories':
        return <Smartphone className="w-8 h-8 text-emerald-400 opacity-80" />;
      case 'creator_tools':
        return <Mic className="w-8 h-8 text-pink-400 opacity-80" />;
      case 'ai_productivity':
      case 'business_software':
        return <Cpu className="w-8 h-8 text-[#00c365] opacity-80" />;
      case 'business_essentials':
        return <Printer className="w-8 h-8 text-amber-400 opacity-80" />;
      default:
        return <Box className="w-8 h-8 text-slate-400 opacity-80" />;
    }
  };

  const heroBannerUrl = BUSINESS_CONFIG.marketplaceHeroImageUrl;
  const heroSrc = getCloudinaryUrl(heroBannerUrl, { format: 'auto', quality: 'auto' });
  const heroSrcSet = getCloudinarySrcSet(heroBannerUrl, [640, 960, 1280, 1600]);

  return (
    <div className="min-h-screen py-5 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5 sm:space-y-8">
        
        {/* 1. Official Marketplace Hero Header with Cloudinary Artwork Background */}
        <div className="relative rounded-3xl bg-[#070b0e] border border-slate-800/80 overflow-hidden shadow-2xl min-h-[220px] sm:min-h-[280px] lg:min-h-[320px] flex items-center">
          {/* Ambient Glows */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#00c365]/10 rounded-full blur-[100px] pointer-events-none z-0" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-500/5 rounded-full blur-[80px] pointer-events-none z-0" />

          {/* Official Visual Artwork Layer (Above-the-Fold Critical Fetch with Eager Loading) */}
          {heroBannerUrl && !heroImageFailed && (
            <div className="absolute inset-0 z-0 select-none overflow-hidden bg-[#070b0e]">
              <img
                src={heroSrc}
                srcSet={heroSrcSet}
                sizes="(max-width: 1024px) 100vw, 1280px"
                alt="Mystery Hub Technology Marketplace Sourcing"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onLoad={() => setHeroImageLoaded(true)}
                onError={() => setHeroImageFailed(true)}
                className={`w-full h-full object-cover object-right lg:object-[85%_center] transition-opacity duration-300 ease-out motion-reduce:transition-none ${
                  heroImageLoaded ? 'opacity-90 sm:opacity-95' : 'opacity-0'
                }`}
              />
            </div>
          )}

          {/* Readability Gradient Overlays: Dark solid negative space on the left for crisp text contrast */}
          <div className="hidden lg:block absolute inset-0 z-10 bg-gradient-to-r from-[#070b0e] via-[#070b0e]/90 via-45% to-transparent pointer-events-none" />
          <div className="lg:hidden absolute inset-0 z-10 bg-gradient-to-r from-[#070b0e]/95 via-[#070b0e]/80 to-[#070b0e]/45 pointer-events-none" />
          <div className="lg:hidden absolute inset-0 z-10 bg-gradient-to-b from-[#070b0e]/30 via-transparent to-[#070b0e] pointer-events-none" />

          {/* Hero Foreground Content */}
          <div className="relative z-20 w-full max-w-xl lg:max-w-2xl p-5 sm:p-8 lg:p-10 space-y-3 sm:space-y-4 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111e18]/90 border border-[#00c365]/30 text-xs font-semibold text-[#00c365] backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tech & Digital Marketplace</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Quality Technology, Creator Gear & <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#38bdf8]">
                Business Essentials Sourced on Request
              </span>
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-xl">
              Browse technology, creator tools and business essentials sourced on request for customers in Ghana. Tell us what you need and we&apos;ll help you find suitable options.
            </p>

            {/* Truthful Trust Signals */}
            <div className="pt-1 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-300 font-medium">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00c365]" />
                <span>Sourced on Request</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#00c365]" />
                <span>Transparent Enquiries</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#00c365]" />
                <span>Direct WhatsApp Support</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Refined WhatsApp Channel Spotlight Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#091813] via-[#091512] to-[#0a1b14] border border-[#00c365]/30 shadow-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#00c365]/15 border border-[#00c365]/40 flex items-center justify-center text-[#00c365] shrink-0 mt-0.5 sm:mt-0 shadow-inner">
                <Radio className="w-5 h-5 text-[#00c365] animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                    Stay in the Mystery Hub Loop
                  </h4>
                  <span className="text-[10px] uppercase font-bold text-[#00c365] bg-[#00c365]/15 border border-[#00c365]/30 px-2 py-0.5 rounded-full">
                    Official Channel
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Price drops, new services, marketplace finds and launch updates, straight from our WhatsApp Channel.
                </p>
                <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded-md">
                    Product Drops
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded-md">
                    Price Updates
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded-md">
                    New Services
                  </span>
                </div>
              </div>
            </div>

            <a
              href={BUSINESS_CONFIG.contact.whatsappChannelUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-[#00c365]/20 shrink-0 cursor-pointer active:scale-95"
            >
              <span>Follow Channel</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* 3. Search Bar and Category Tabs (Shown ONLY when published products exist in catalog) */}
        {!loading && !error && products.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search laptops, microphones, tools, software..."
                  className="w-full bg-[#0e141a] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                />
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-2 self-start sm:self-auto">
                <span>
                  Showing <span className="font-bold text-white">{filteredProducts.length}</span> sourced items
                </span>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="w-full flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {MARKETPLACE_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
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
        )}

        {/* 4. Products Grid / Loading / Error / Honest States */}
        {loading ? (
          /* Loading Skeleton State */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-2xl bg-[#0f151b] border border-slate-800 p-4 sm:p-5 space-y-4 animate-pulse"
              >
                <div className="w-full aspect-[4/3] rounded-xl bg-slate-800/50" />
                <div className="h-4 bg-slate-800 rounded w-1/3" />
                <div className="h-6 bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-800 rounded w-full" />
                <div className="h-8 bg-slate-800 rounded w-full mt-4" />
              </div>
            ))}
          </div>
        ) : error ? (
          /* Honest Error State */
          <div className="text-center py-10 px-4 bg-[#0f151b] rounded-2xl border border-red-500/30 space-y-3">
            <HelpCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Marketplace Service Unavailable</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={fetchCatalog}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Retry Sourcing Catalogue
              </button>
              <a
                href={BUSINESS_CONFIG.getGeneralWhatsAppUrl('Hello Mystery Hub, I am inquiring about marketplace sourcing.')}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-[#00c365] text-black text-xs font-bold transition-colors cursor-pointer"
              >
                WhatsApp Us Directly
              </a>
            </div>
          </div>
        ) : products.length === 0 ? (
          /* ZERO PUBLISHED PRODUCTS EXIST: One Compact Intentional State */
          <div className="text-center py-10 sm:py-12 px-5 bg-[#0f151b] rounded-3xl border border-slate-800/90 space-y-4 max-w-2xl mx-auto shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365] mx-auto shadow-inner">
              <Box className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <span className="inline-block text-[11px] font-bold text-[#00c365] bg-[#00c365]/10 border border-[#00c365]/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                New products are being added
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                We&apos;re building the Marketplace with real products we can actually source.
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-lg mx-auto">
                Looking for something now? Tell us what you need and we&apos;ll help you find suitable options available in Ghana.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={BUSINESS_CONFIG.getGeneralWhatsAppUrl(
                  'Hello Mystery Hub team, I have a specific hardware or software sourcing request.'
                )}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Send Sourcing Request</span>
              </a>

              <a
                href={BUSINESS_CONFIG.contact.supportWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>WhatsApp Mystery Hub</span>
              </a>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          /* FILTERED-ZERO STATE: Search or category filter returned 0 results */
          <div className="text-center py-10 px-4 bg-[#0f151b] rounded-2xl border border-slate-800 space-y-3 max-w-md mx-auto">
            <Search className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-base font-bold text-white">No matching products</h3>
            <p className="text-xs text-slate-400">Try another category or reset your search query.</p>
            <div className="pt-2">
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-[#00c365] text-black font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>
          </div>
        ) : (
          /* LIVE PRODUCTS GRID */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredProducts.map((p) => {
              const availabilityBadgeMap: Record<string, { label: string; style: string }> = {
                in_stock: {
                  label: 'In Stock',
                  style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                },
                sourcing_on_demand: {
                  label: 'Sourced on Request',
                  style: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
                },
                preorder: {
                  label: 'Pre-Order',
                  style: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                },
                out_of_stock: {
                  label: 'Out of Stock',
                  style: 'bg-slate-800 text-slate-400 border-slate-700',
                },
                available: {
                  label: 'In Stock',
                  style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                },
                check_availability: {
                  label: 'Sourced on Request',
                  style: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
                },
              };

              const availabilityBadge = availabilityBadgeMap[p.availability] || {
                label: 'Sourced on Request',
                style: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
              };

              const directWhatsAppLink = BUSINESS_CONFIG.getMarketplaceInquiryWhatsAppUrl(p.name);

              return (
                <div
                  key={p.id}
                  className="rounded-2xl bg-[#0f151b] border border-slate-800 hover:border-slate-700/80 transition-all duration-200 flex flex-col justify-between overflow-hidden group shadow-md hover:shadow-xl"
                >
                  <div>
                    {/* Product Image Container (4:3 Aspect Ratio, object-contain) */}
                    <div className="relative w-full aspect-[4/3] bg-gradient-to-b from-[#090e13] to-[#0f151b] border-b border-slate-800/80 overflow-hidden">
                      <OptimizedImage
                        src={p.imageUrl}
                        alt={p.imageAlt || p.name}
                        aspectRatio="4/3"
                        objectFit="contain"
                        fallbackIcon={getCategoryFallbackIcon(p.category)}
                        containerClassName="p-3"
                        className="transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Promo Badge if present */}
                      {p.badge && (
                        <span className="absolute top-3 right-3 text-[10px] font-bold text-white bg-black/70 backdrop-blur-md border border-slate-700 px-2 py-0.5 rounded-md shadow-sm">
                          {p.badge}
                        </span>
                      )}
                    </div>

                    {/* Product Meta & Details */}
                    <div className="p-4 sm:p-5 space-y-2.5">
                      {/* Category & Availability Pill */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-400">
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
                        <h3 className="font-extrabold text-base sm:text-lg text-white group-hover:text-[#00c365] transition-colors line-clamp-2">
                          {p.name}
                        </h3>
                        {p.tagline && (
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                            {p.tagline}
                          </p>
                        )}
                      </div>

                      {/* Prominent Price */}
                      <div className="pt-1 flex items-baseline justify-between">
                        <span className="text-xs text-slate-400 font-medium">Estimated Pricing</span>
                        <span className="text-base sm:text-lg font-extrabold text-white tabular-nums tracking-tight">
                          {p.priceDisplay}
                        </span>
                      </div>

                      {/* 2-3 Bullet Highlights */}
                      {p.highlights && p.highlights.length > 0 && (
                        <div className="space-y-1 pt-2 border-t border-slate-800/80 text-[11px] text-slate-300">
                          {p.highlights.slice(0, 3).map((h, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                              <span className="truncate">{h}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Inquire & WhatsApp CTAs */}
                  <div className="p-4 sm:p-5 pt-0">
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => openMarketplaceInquiry(p)}
                        className="w-full py-2 px-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer active:scale-95"
                      >
                        <FileQuestion className="w-3.5 h-3.5" />
                        <span>Inquire</span>
                      </button>

                      <a
                        href={directWhatsAppLink}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 transition-colors flex items-center justify-center gap-1 text-xs font-semibold cursor-pointer"
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
        )}

        {/* 5. Custom Tech Sourcing Service Footer Banner (Rendered ONLY when published products exist) */}
        {!loading && !error && products.length > 0 && (
          <div className="rounded-3xl bg-gradient-to-br from-[#0e161c] via-[#091014] to-[#070b0e] border border-slate-800 p-5 sm:p-7 space-y-3.5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
              <div className="space-y-1.5 max-w-2xl">
                <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">
                  Custom Tech Sourcing Service
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Need Specific Hardware or Software Not Listed Above?
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Whether you need specialized developer workstations, studio podcast microphones, or business software setups, Mystery Hub&apos;s sourcing desk will locate genuine models for you at competitive local rates.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto shrink-0">
                <a
                  href={BUSINESS_CONFIG.getGeneralWhatsAppUrl(
                    'Hello Mystery Hub team, I have a custom hardware or software sourcing request.'
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp Sourcing Desk</span>
                </a>

                <a
                  href={BUSINESS_CONFIG.contact.phoneLink}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Phone className="w-4 h-4 text-amber-400" />
                  <span>Call: 0592066298</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
