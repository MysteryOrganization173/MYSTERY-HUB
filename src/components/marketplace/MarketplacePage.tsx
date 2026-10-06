import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import { marketplaceControlRequest, ManagedCategory } from '../../services/marketplaceControls';
import { MarketplaceCategory, MarketplaceProduct } from '../../types';
import { getPublicMarketplaceProducts, getMyReferralSummary } from '../../services/apiClient';
import { buildReferralUrl } from '../../utils/referralUrl';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';
import { OptimizedImage } from '../common/OptimizedImage';
import { MarketplaceCheckoutModal } from './MarketplaceCheckoutModal';
import { MarketplaceProductDetailModal } from './MarketplaceProductDetailModal';
import { useMarketplaceDialog } from './useMarketplaceDialog';
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
  Gift,
  Share2,
  Copy,
  Check,
  X,
  MessageCircle,
  ArrowRight,
  Info,
  ShoppingBag,
} from 'lucide-react';

export const MarketplacePage: React.FC = () => {
  const { openMarketplaceInquiry, marketplaceOverlay, openMarketplaceOverlay, closeMarketplaceOverlay, dismissMarketplaceOverlay, user, sessionToken, openAuth, showToast } = useApp();
  const [categories,setCategories]=useState<ManagedCategory[]>([]);
  useEffect(()=>{let active=true;marketplaceControlRequest('categories').then(data=>{if(active)setCategories(data.categories);}).catch(()=>{});return()=>{active=false;};},[]);
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Live Backend Data States
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Product for Rich Product Detail View (Drill-down experience)
  const selectedProduct = marketplaceOverlay.kind === 'detail' ? marketplaceOverlay.product : null;
  const setSelectedProduct = (product:MarketplaceProduct|null) => product ? openMarketplaceOverlay('detail',product) : dismissMarketplaceOverlay();
  useEffect(() => () => dismissMarketplaceOverlay(),[dismissMarketplaceOverlay]);

  // Hero image load & error states for smooth reveal
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  // Share & Earn States
  const [referralCode, setReferralCode] = useState<string>('');
  const shareModalProduct = marketplaceOverlay.kind === 'share' ? marketplaceOverlay.product : null;
  const shareDialogRef = useMarketplaceDialog(!!shareModalProduct,closeMarketplaceOverlay);
  const checkoutProduct = marketplaceOverlay.kind === 'checkout' ? marketplaceOverlay.product : null;
  const [copiedLink, setCopiedLink] = useState(false);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);

  // Load authenticated referral code if user is logged in
  useEffect(() => {
    let isMounted = true;
    if (user && sessionToken) {
      getMyReferralSummary(sessionToken)
        .then((res) => {
          if (isMounted && res?.summary?.code) {
            setReferralCode(res.summary.code);
          }
        })
        .catch(() => {
          // Graceful fallback
        });
    } else {
      setReferralCode('');
    }
    return () => {
      isMounted = false;
    };
  }, [user, sessionToken]);

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

  const openedDeepLink = useRef<string | null>(null);
  // Deep-link landing & spotlight behavior (also auto-opens product detail modal if link points to product)
  useEffect(() => {
    if (loading || products.length === 0) return;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const targetParam =
        searchParams.get('product') || searchParams.get('item') || searchParams.get('id');

      let targetProduct: MarketplaceProduct | undefined;
      if (targetParam) {
        const cleanParam = targetParam.toLowerCase().trim();
        targetProduct = products.find(
          (p) => p.slug?.toLowerCase() === cleanParam || p.id.toLowerCase() === cleanParam
        );
      } else {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2 && pathParts[0] === 'marketplace') {
          const slugPart = pathParts[1].toLowerCase().trim();
          targetProduct = products.find(
            (p) => p.slug?.toLowerCase() === slugPart || p.id.toLowerCase() === slugPart
          );
        }
      }

      if (targetProduct && openedDeepLink.current !== targetProduct.id) {
        openedDeepLink.current = targetProduct.id;
        setHighlightedProductId(targetProduct.id);
        setSelectedProduct(targetProduct);
        const timerScroll = setTimeout(() => {
          const el = document.getElementById(`marketplace-product-${targetProduct!.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);

        const timerHighlight = setTimeout(() => {
          setHighlightedProductId(null);
        }, 5000);

        return () => {
          clearTimeout(timerScroll);
          clearTimeout(timerHighlight);
        };
      }
    } catch {
      // Non-invasive url check
    }
  }, [loading, products]);

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

  const formatGhcReward = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return '0';
    return val.toLocaleString('en-US', {
      minimumFractionDigits: val % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
  };

  /**
   * Helper to ensure card overlays are strictly concise 1-line badges.
   * Long promotional / tagline copy is omitted from the compact feed card
   * and displayed within the rich Product Details modal.
   */
  const getCompactCardBadge = (badge: string | undefined): string | null => {
    if (!badge) return null;
    const trimmed = badge.trim();
    if (!trimmed) return null;
    if (trimmed.length > 18) {
      if (/business|office|work/i.test(trimmed)) return 'Business Pick';
      if (/student|school|study/i.test(trimmed)) return 'Student Choice';
      if (/creator|graphics|design|mic/i.test(trimmed)) return 'Creator Pick';
      if (/popular|best|top/i.test(trimmed)) return 'Popular';
      return null;
    }
    return trimmed;
  };

  const handleOpenShareModal = (p: MarketplaceProduct) => {
    openMarketplaceOverlay('share',p);
    setCopiedLink(false);
  };

  const handleCloseShareModal = () => {
    closeMarketplaceOverlay();
    setCopiedLink(false);
  };

  const handleCopyLink = (url: string) => {
    try {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      showToast('Product referral link copied to clipboard!', 'success');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast('Failed to copy link. Please select and copy manually.', 'warning');
    }
  };

  const handleNativeShare = (p: MarketplaceProduct, url: string) => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({
          title: `${p.name} · Mystery Hub`,
          text: `Check out ${p.name} on Mystery Hub (${p.priceDisplay}):`,
          url: url,
        })
        .catch(() => {
          // Ignore aborted share dialogs
        });
    } else {
      handleCopyLink(url);
    }
  };

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

  // Active product referral link builder
  const activeProductShareUrl = useMemo(() => {
    if (!shareModalProduct) return '';
    const route = `/marketplace?product=${encodeURIComponent(
      shareModalProduct.slug || shareModalProduct.id
    )}`;
    return buildReferralUrl(route, referralCode || 'MYSTERY');
  }, [shareModalProduct, referralCode]);

  return (
    <div className="py-4 sm:py-6 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
        
        {/* =========================================================
            1. CONTINUOUS BLENDED MARKETPLACE HERO HEADER
               - Full-bleed background artwork with smooth left-to-right dark gradient
               - No vertical seam; text is crisp on left; tech gear pops on right
            ========================================================= */}
        <div className="relative rounded-2xl sm:rounded-3xl bg-[#070b0e] border border-slate-800/80 overflow-hidden shadow-xl sm:shadow-2xl min-h-[140px] sm:min-h-[260px] lg:min-h-[300px] flex items-center">
          {/* Subtle Ambient Eco Glow */}
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2 w-80 h-80 bg-[#00c365]/10 rounded-full blur-[100px] pointer-events-none z-0" />

          {/* Continuous Full-Bleed Artwork Layer Covering Entire Hero Background */}
          {heroBannerUrl && !heroImageFailed && (
            <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden bg-[#070b0e]">
              <img
                src={heroSrc}
                srcSet={heroSrcSet}
                sizes="100vw"
                alt=""
                aria-hidden="true"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onLoad={() => setHeroImageLoaded(true)}
                onError={() => setHeroImageFailed(true)}
                className={`w-full h-full object-cover object-[85%_center] sm:object-[80%_center] transition-opacity duration-300 ease-out ${
                  heroImageLoaded ? 'opacity-85 sm:opacity-90' : 'opacity-0'
                }`}
              />
              {/* Left-to-Right Continuous Dark Gradient Overlay:
                  Left: Strong dark green/black overlay behind text for 100% crisp readability
                  Center: Smooth medium overlay with zero hard transition/seam
                  Right: Subtle light overlay so tech gear visually pops and remains attractive
              */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#070b0e] via-[#070b0e]/85 via-50% to-[#070b0e]/20 to-100% sm:from-[#070b0e] sm:via-[#070b0e]/90 sm:via-45% sm:to-transparent" />
              {/* Gentle top/bottom integration vignette */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#070b0e]/60 via-transparent to-[#070b0e]/20" />
            </div>
          )}

          {/* Hero Foreground Content */}
          <div className="relative z-10 w-full max-w-xl lg:max-w-2xl p-4 sm:p-7 lg:p-9 space-y-2 sm:space-y-3.5 text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#111e18]/90 border border-[#00c365]/30 text-xs sm:text-xs font-semibold text-[#00c365] backdrop-blur-sm">
              <Sparkles className="w-3 h-3" />
              <span>Tech &amp; Digital Marketplace</span>
            </div>

            <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Quality Technology, Creator Gear &amp; <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#38bdf8]">
                Business Essentials
              </span>
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-md sm:max-w-xl">
              Browse laptops, smartphones and creator gear sourced on request for customers in Ghana.
            </p>

            {/* Compact Trust Row */}
            <div className="pt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-slate-300 font-medium">
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00c365]" />
                <span>Sourced on Request</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-[#00c365]" />
                <span>Direct WhatsApp</span>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            2. SEARCH BAR & CATEGORY TABS
               (Placed right under the compressed hero for instant discovery)
            ========================================================= */}
        {!loading && !error && products.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Compact Responsive Search Input */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search laptops, microphones, tools, software..."
                  className="w-full bg-[#0e141a] border border-slate-700/80 rounded-xl pl-10 pr-9 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 text-xs"
                    aria-label="Clear search query"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-400 flex items-center justify-between sm:justify-start gap-2">
                <span>
                  Showing <span className="font-bold text-white">{filteredProducts.length}</span> sourced items
                </span>
                {selectedCategory !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className="text-[#00c365] hover:underline cursor-pointer sm:ml-2"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>

            {/* Category Tabs (Smooth mobile horizontal scroll, hidden native scrollbars) */}
            <div className="w-full flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden scroll-smooth">
              {[{slug:'all',label:'All Sourced Products'},...categories].map((cat) => {
                const isSelected = selectedCategory === cat.slug;
                return (
                  <button
                    key={cat.slug}
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 active:scale-95 ${
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

        {/* =========================================================
            3. PRODUCTS FEED GRID
               (Reaches visible 2-column cards immediately on mobile)
            ========================================================= */}
        {loading ? (
          /* Loading Skeleton State */
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="rounded-2xl bg-[#0f151b] border border-slate-800 p-2.5 sm:p-4 space-y-2.5 animate-pulse"
              >
                <div className="w-full aspect-square rounded-xl bg-slate-800/50" />
                <div className="h-3 bg-slate-800 rounded w-1/2" />
                <div className="h-4 bg-slate-800 rounded w-3/4" />
                <div className="h-4 bg-slate-800 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          /* Honest Error State */
          <div className="text-center py-8 px-4 bg-[#0f151b] rounded-2xl border border-red-500/30 space-y-3">
            <HelpCircle className="w-9 h-9 text-red-400 mx-auto" />
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
          /* ZERO PUBLISHED PRODUCTS EXIST: Compact Intentional State */
          <div className="text-center py-8 sm:py-10 px-4 bg-[#0f151b] rounded-3xl border border-slate-800/90 space-y-3 max-w-2xl mx-auto shadow-xl">
            <div className="w-11 h-11 rounded-2xl bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365] mx-auto shadow-inner">
              <Box className="w-5 h-5" />
            </div>

            <div className="space-y-1.5">
              <span className="inline-block text-xs font-bold text-[#00c365] bg-[#00c365]/10 border border-[#00c365]/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                New products are being added
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                We&apos;re building the Marketplace with real products we can actually source.
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-lg mx-auto">
                Looking for something now? Tell us what you need and we&apos;ll help you find suitable options available in Ghana.
              </p>
            </div>

            <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <a
                href={BUSINESS_CONFIG.getGeneralWhatsAppUrl(
                  'Hello Mystery Hub team, I have a specific hardware or software sourcing request.'
                )}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Send Sourcing Request</span>
              </a>

              <a
                href={BUSINESS_CONFIG.contact.supportWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>WhatsApp Mystery Hub</span>
              </a>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          /* FILTERED-ZERO STATE: Search or category filter returned 0 results */
          <div className="text-center py-8 px-4 bg-[#0f151b] rounded-2xl border border-slate-800 space-y-3 max-w-md mx-auto">
            <Search className="w-7 h-7 text-slate-500 mx-auto" />
            <h3 className="text-sm font-bold text-white">No matching products</h3>
            <p className="text-xs text-slate-400">Try another category or reset your search query.</p>
            <div className="pt-1">
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
          /* LIVE PRODUCTS GRID (COMPACT COMMERCE FEED: 2-COL ON MOBILE) */
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
            {filteredProducts.map((p) => {
              const availabilityBadgeMap: Record<string, { label: string; style: string }> = {
                in_stock: {
                  label: 'In Stock',
                  style: 'bg-emerald-500/85 text-white border-emerald-400/40',
                },
                sourcing_on_demand: {
                  label: 'Sourced on Request',
                  style: 'bg-sky-500/85 text-white border-sky-400/40',
                },
                preorder: {
                  label: 'Pre-Order',
                  style: 'bg-amber-500/85 text-white border-amber-400/40',
                },
                out_of_stock: {
                  label: 'Out of Stock',
                  style: 'bg-slate-800 text-slate-300 border-slate-700',
                },
                available: {
                  label: 'In Stock',
                  style: 'bg-emerald-500/85 text-white border-emerald-400/40',
                },
                check_availability: {
                  label: 'Sourced on Request',
                  style: 'bg-sky-500/85 text-white border-sky-400/40',
                },
              };

              const availabilityBadge = availabilityBadgeMap[p.availability] || {
                label: 'Sourced on Request',
                style: 'bg-sky-500/85 text-white border-sky-400/40',
              };

              const isEligibleForShare =
                p.published !== false &&
                !p.archived &&
                p.availability !== 'coming_soon' &&
                typeof p.referralRewardGhc === 'number' &&
                p.referralRewardGhc > 0;

              const rewardGhcFormatted = isEligibleForShare ? formatGhcReward(p.referralRewardGhc) : null;
              const isHighlighted = highlightedProductId === p.id;
              const compactBadge = getCompactCardBadge(p.badge);

              return (
                <article
                  id={`marketplace-product-${p.id}`}
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View details for ${p.name}`}
                  onClick={() => setSelectedProduct(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedProduct(p);
                    }
                  }}
                  className={`group relative rounded-2xl bg-[#0f151b] border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-xl cursor-pointer active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#00c365] ${
                    isHighlighted
                      ? 'border-[#00c365] ring-2 ring-[#00c365]/50 ring-offset-2 ring-offset-[#070b0e]'
                      : 'border-slate-800 hover:border-slate-700 hover:bg-[#121921]'
                  }`}
                >
                  <div className="flex flex-col">
                    {/* Commerce Product Image (square on mobile, 4:3 on desktop) */}
                    <div className="relative w-full aspect-square sm:aspect-[4/3] bg-gradient-to-b from-[#090e13] to-[#0f151b] border-b border-slate-800/80 overflow-hidden">
                      <OptimizedImage
                        src={p.imageUrl}
                        alt={p.imageAlt || p.name}
                        aspectRatio="square"
                        objectFit="cover"
                        objectPosition="center center"
                        fallbackIcon={getCategoryFallbackIcon(p.category)}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Small Status Badge on Image */}
                      <span
                        className={`absolute top-2 left-2 text-[9px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-md backdrop-blur-md border shadow-sm ${availabilityBadge.style}`}
                      >
                        {p.availabilityLabel || availabilityBadge.label}
                      </span>

                      {/* Clean 1-Line Compact Promo Badge (No multiline marketing overlays on cards) */}
                      {compactBadge && (
                        <span className="absolute top-2 right-2 text-[9px] sm:text-xs font-bold text-white bg-black/85 backdrop-blur-md border border-slate-700/80 px-1.5 sm:px-2 py-0.5 rounded-md shadow-sm truncate max-w-[55%]">
                          {compactBadge}
                        </span>
                      )}
                    </div>

                    {/* Compact Card Content */}
                    <div className="p-2.5 sm:p-3.5 space-y-1 text-left flex-1 flex flex-col justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs sm:text-[11px] font-semibold text-slate-400 truncate">
                          {p.categoryLabel}
                        </div>

                        <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-[#00c365] transition-colors line-clamp-2 leading-snug min-h-[2.2rem] sm:min-h-[2.6rem]">
                          {p.name}
                        </h3>
                      </div>

                      <div className="pt-0.5">
                        <span className="text-xs sm:text-base font-black text-white font-mono tracking-tight tabular-nums block truncate">
                          {p.priceDisplay}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom: Compact Share & Earn Reward Badge if eligible, else Clean Arrow */}
                  <div className="p-2.5 sm:p-3.5 pt-0 text-left">
                    {isEligibleForShare && rewardGhcFormatted ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenShareModal(p);
                        }}
                        className="w-full px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:text-amber-300 text-[9px] sm:text-xs font-bold transition-all flex items-center justify-between group/badge cursor-pointer"
                        aria-label={`Share and earn GH₵${rewardGhcFormatted} on ${p.name}`}
                      >
                        <span className="flex items-center gap-1 truncate">
                          <Gift className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 shrink-0" />
                          <span>Earn GH₵{rewardGhcFormatted}</span>
                        </span>
                        <Share2 className="w-2.5 h-2.5 text-amber-400/80 group-hover/badge:translate-x-0.5 transition-transform shrink-0" />
                      </button>
                    ) : (
                      <div className="text-xs sm:text-[11px] text-slate-500 flex items-center justify-between font-medium group-hover:text-slate-400 transition-colors pt-0.5 border-t border-slate-800/60">
                        <span>Details</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* =========================================================
            4. COMPACT WHATSAPP CHANNEL PROMOTION
               (Demoted after products so it does not block discovery)
            ========================================================= */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#091813] via-[#091512] to-[#0a1b14] border border-[#00c365]/30 shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-left">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#00c365]/15 border border-[#00c365]/40 flex items-center justify-center text-[#00c365] shrink-0 shadow-inner">
                <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-[#00c365] animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-xs sm:text-base text-white tracking-tight">
                    Stay in the Mystery Hub Loop
                  </h4>
                  <span className="text-[9px] uppercase font-bold text-[#00c365] bg-[#00c365]/15 border border-[#00c365]/30 px-1.5 py-0.2 rounded-full hidden sm:inline">
                    Official Channel
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-300 leading-snug">
                  Ask about available products and sourcing on WhatsApp.
                </p>
              </div>
            </div>

            <a
              href={BUSINESS_CONFIG.contact.whatsappChannelUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-[#00c365]/20 shrink-0 cursor-pointer active:scale-95"
            >
              <span>Follow Channel</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* =========================================================
            5. CUSTOM TECH SOURCING SERVICE FOOTER BANNER
            ========================================================= */}
        {!loading && !error && products.length > 0 && (
          <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0e161c] via-[#091014] to-[#070b0e] border border-slate-800 p-4 sm:p-6 space-y-3">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="space-y-1 max-w-2xl text-left">
                <span className="text-xs sm:text-xs font-bold text-[#00c365] uppercase tracking-wider">
                  Custom Tech Sourcing Service
                </span>
                <h3 className="text-base sm:text-xl font-bold text-white tracking-tight">
                  Need Specific Hardware or Software Not Listed Above?
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Whether you need developer laptops, studio microphones, or software licenses, Mystery Hub&apos;s sourcing desk will locate genuine models for you at competitive local rates.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0">
                <a
                  href={BUSINESS_CONFIG.getGeneralWhatsAppUrl(
                    'Hello Mystery Hub team, I have a custom hardware or software sourcing request.'
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp Sourcing Desk</span>
                </a>

                <a
                  href={BUSINESS_CONFIG.contact.phoneLink}
                  className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Phone className="w-4 h-4 text-amber-400" />
                  <span>Call: 0592066298</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          6. PRODUCT DETAIL MODAL / SHEET (DRILL-DOWN EXPERIENCE)
          ========================================================= */}
      {selectedProduct && (
        <MarketplaceProductDetailModal
          key={selectedProduct.id}
          product={selectedProduct}
          onClose={dismissMarketplaceOverlay}
          initialVariantId={marketplaceOverlay.kind !== 'none' ? marketplaceOverlay.variantId : undefined}
          onVariantChange={id => openMarketplaceOverlay('detail',selectedProduct,id)}
          onBuyNow={(prod,variantId) => openMarketplaceOverlay('checkout',prod,variantId)}
          onInquire={openMarketplaceInquiry}
          onShare={(prod) => {
            handleOpenShareModal(prod);
          }}
          formatGhcReward={formatGhcReward}
        />
      )}

      {/* =========================================================
          7. SHARE & EARN MODAL (GUEST OR AUTHENTICATED)
          ========================================================= */}
      {shareModalProduct && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={handleCloseShareModal}
        >
          <div
            className="relative w-full max-w-lg bg-[#0e141a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
            ref={shareDialogRef} tabIndex={-1}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#090d11] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs text-[#00c365] uppercase tracking-wider font-bold block">
                    Mystery Earn · Share &amp; Earn
                  </span>
                  <h3 id="share-modal-title" className="text-sm sm:text-base font-bold text-white">
                    {user ? 'Product Referral Link' : 'Earn with Mystery Hub'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseShareModal}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-left">
              {/* Product Preview Card */}
              <div className="p-3.5 rounded-xl bg-[#121921] border border-slate-800 flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg bg-[#080d11] border border-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
                  {shareModalProduct.imageUrl ? (
                    <img
                      src={shareModalProduct.imageUrl}
                      alt={shareModalProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getCategoryFallbackIcon(shareModalProduct.category)
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
                    {shareModalProduct.categoryLabel}
                  </span>
                  <h4 className="font-bold text-sm text-white truncate">{shareModalProduct.name}</h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-bold">{shareModalProduct.priceDisplay}</span>
                    <span className="font-extrabold text-amber-400 font-mono">
                      Earn GH₵{formatGhcReward(shareModalProduct.referralRewardGhc)}
                    </span>
                  </div>
                </div>
              </div>

              {/* AUTHENTICATED USER EXPERIENCE */}
              {user ? (
                <div className="space-y-4">
                  {/* Reward Callout */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-[#00c365]/10 to-amber-500/10 border border-amber-500/30 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Reward Value</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Earn <span className="font-mono font-extrabold text-amber-400">GH₵{formatGhcReward(shareModalProduct.referralRewardGhc)}</span> when a buyer completes a qualifying purchase through your link.
                    </p>
                  </div>

                  {/* Share Link Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Your Tracked Product Link
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={activeProductShareUrl}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="w-full bg-[#080d11] border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 select-all focus:outline-none focus:border-[#00c365]"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyLink(activeProductShareUrl)}
                        className="px-3.5 py-2 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Instant Sharing Actions */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Check out ${shareModalProduct.name} on Mystery Hub (${shareModalProduct.priceDisplay}):\n${activeProductShareUrl}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2.5 px-4 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Share on WhatsApp</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleNativeShare(shareModalProduct, activeProductShareUrl)}
                      className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>More Share Options</span>
                    </button>
                  </div>

                  {/* Trust note */}
                  <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                    Rewards are credited to your Mystery Earn ledger automatically when the order reaches terminal delivery.
                  </p>
                </div>
              ) : (
                /* GUEST USER EXPERIENCE */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-lg font-extrabold text-white tracking-tight">
                      Create your free account to earn
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      Get your personal Mystery Hub referral link and earn{' '}
                      <span className="font-mono font-extrabold text-amber-400">
                        GH₵{formatGhcReward(shareModalProduct.referralRewardGhc)}
                      </span>{' '}
                      when a qualifying purchase of this product is confirmed.
                    </p>
                  </div>

                  {/* Key Highlights */}
                  <div className="p-3.5 rounded-xl bg-[#090e13] border border-slate-800 space-y-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Instant permanent referral code generated upon registration</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Tracked lifetime attribution for future orders</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Transparent ledger dashboard to monitor rewards</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleCloseShareModal();
                        openAuth('signup');
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Create Free Account &amp; Start Earning</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleCloseShareModal();
                        openAuth('login');
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>I Already Have an Account</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          8. BUY NOW CHECKOUT MODAL
          ========================================================= */}
      {checkoutProduct && (
        <MarketplaceCheckoutModal
          key={checkoutProduct.id}
          product={checkoutProduct}
          referralCode={referralCode}
          initialVariantId={marketplaceOverlay.kind !== 'none' ? marketplaceOverlay.variantId : undefined}
          onClose={closeMarketplaceOverlay}
          onInquire={openMarketplaceInquiry}
          onVariantChange={id => openMarketplaceOverlay('checkout',checkoutProduct,id)}
        />
      )}
    </div>
  );
};
