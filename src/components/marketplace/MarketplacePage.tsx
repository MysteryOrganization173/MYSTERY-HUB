import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import { marketplaceControlRequest, ManagedCategory } from '../../services/marketplaceControls';
import { MarketplaceProduct } from '../../types';
import { getPublicMarketplaceProducts, getPublicMarketplaceProductBySlug, getMyReferralSummary } from '../../services/apiClient';
import { buildReferralUrl } from '../../utils/referralUrl';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';
import { MarketplaceCheckoutModal } from './MarketplaceCheckoutModal';
import { MarketplaceProductDetailModal } from './MarketplaceProductDetailModal';
import { MarketplaceCategoryTiles } from './MarketplaceCategoryTiles';
import { ProductPhoto } from './MarketplaceMedia';
import { MarketplaceProductCard } from './MarketplaceProductCard';
import { MarketplaceRefineSheet, refineAvailability } from './MarketplaceRefineSheet';
import { useMarketplaceDialog } from './useMarketplaceDialog';
import {
  DEFAULT_BROWSE_STATE, KIND_LABELS, PRICE_BANDS, SORT_OPTIONS, MarketplaceBrowseState, MarketplaceSort,
  activeRefinementCount, applyRefinements, categoryIconKey, categoryLabel, parseBrowseState, serializeBrowseState, sortProducts, summariseCategories, summariseBrands, brandLabel,
} from '../../utils/marketplaceBrowse';
import {
  Search,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  ExternalLink,
  Radio,
  Phone,
  Box,
  RotateCcw,
  Gift,
  Share2,
  Copy,
  Check,
  X,
  MessageCircle,
  SlidersHorizontal,
  ArrowUpDown,
} from 'lucide-react';

type HistoryState = { page?: string; mhProduct?: string; mhScroll?: number } & Record<string, unknown>;
const historyState = (): HistoryState => (typeof window !== 'undefined' && window.history.state && typeof window.history.state === 'object' ? window.history.state : {});
const productParamFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('product') || params.get('item') || params.get('id');
  if (fromQuery) return fromQuery.toLowerCase().trim();
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts.length >= 2 && parts[0] === 'marketplace' ? parts[1].toLowerCase().trim() : null;
};
const findProduct = (list: MarketplaceProduct[], slug: string) => list.find(p => p.slug?.toLowerCase() === slug || p.id.toLowerCase() === slug);

export const MarketplacePage: React.FC = () => {
  const { openMarketplaceInquiry, marketplaceOverlay, openMarketplaceOverlay, closeMarketplaceOverlay, dismissMarketplaceOverlay, user, sessionToken, openAuth, showToast } = useApp();
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  // Settled (loaded or failed) so scroll restoration waits for the tile row, which sits above the grid.
  const [categoriesSettled, setCategoriesSettled] = useState(false);
  useEffect(() => { let active = true; marketplaceControlRequest('categories').then(data => { if (active) setCategories(data.categories || []); }).catch(() => {}).finally(() => { if (active) setCategoriesSettled(true); }); return () => { active = false; }; }, []);

  // Browsing state lives in the URL so refresh, sharing and Back all keep the customer's place.
  const [browse, setBrowse] = useState<MarketplaceBrowseState>(() => typeof window === 'undefined' ? DEFAULT_BROWSE_STATE : parseBrowseState(window.location.search));
  const updateBrowse = useCallback((patch: Partial<MarketplaceBrowseState>) => setBrowse(prev => ({ ...prev, ...patch })), []);
  const [refineOpen, setRefineOpen] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Live Backend Data States (whole published catalogue; categories filter client-side for instant switching and counts)
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const productsRef = useRef<MarketplaceProduct[]>([]);
  productsRef.current = products;

  // Selected Product for Rich Product Detail View (Drill-down experience)
  const selectedProduct = marketplaceOverlay.kind === 'detail' ? marketplaceOverlay.product : null;
  const setSelectedProduct = (product: MarketplaceProduct | null) => product ? openMarketplaceOverlay('detail', product) : dismissMarketplaceOverlay();
  useEffect(() => () => dismissMarketplaceOverlay(), [dismissMarketplaceOverlay]);

  // Hero image load & error states for smooth reveal
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  // Share & Earn States
  const [referralCode, setReferralCode] = useState<string>('');
  const shareModalProduct = marketplaceOverlay.kind === 'share' ? marketplaceOverlay.product : null;
  const shareDialogRef = useMarketplaceDialog(!!shareModalProduct, closeMarketplaceOverlay);
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
      const res = await getPublicMarketplaceProducts();
      if (res.success) {
        setProducts(res.products || []);
      } else {
        setError(res.error || 'We couldn’t load the Marketplace. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t load the Marketplace. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Keep the address bar in step with browsing (replace, not push: filters should not flood Back).
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = serializeBrowseState(browse, window.location.search);
      if (next !== window.location.search) window.history.replaceState(historyState(), '', window.location.pathname + next + window.location.hash);
    }, 250);
    return () => clearTimeout(timer);
  }, [browse]);

  // Product sheets get their own history entry so Android Back closes the sheet, not the Marketplace.
  const overlaySlug = marketplaceOverlay.kind !== 'none' ? (marketplaceOverlay.product.slug || marketplaceOverlay.product.id) : null;
  const previousOverlaySlug = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousOverlaySlug.current;
    previousOverlaySlug.current = overlaySlug;
    if (!overlaySlug && !previous) return; // nothing opened or closed (e.g. a deep link still loading)
    const params = new URLSearchParams(window.location.search);
    const urlSlug = params.get('product');
    if (overlaySlug) {
      if (urlSlug === overlaySlug) return;
      params.set('product', overlaySlug);
      const url = `/marketplace?${params.toString()}`;
      if (historyState().mhProduct) window.history.replaceState({ ...historyState(), mhProduct: overlaySlug }, '', url);
      else window.history.pushState({ page: 'marketplace', mhProduct: overlaySlug }, '', url);
    } else if (urlSlug) {
      if (historyState().mhProduct) window.history.back();
      else {
        params.delete('product');
        const qs = params.toString();
        window.history.replaceState(historyState(), '', `/marketplace${qs ? `?${qs}` : ''}`);
      }
    }
  }, [overlaySlug]);

  useEffect(() => {
    const onPop = () => {
      setBrowse(parseBrowseState(window.location.search));
      const slug = new URLSearchParams(window.location.search).get('product');
      const target = slug ? findProduct(productsRef.current, slug.toLowerCase()) : undefined;
      if (target) openMarketplaceOverlay('detail', target); else dismissMarketplaceOverlay();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [openMarketplaceOverlay, dismissMarketplaceOverlay]);

  // Remember the scroll position on this history entry; Back from another page restores it.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (document.body.style.overflow === 'hidden') return; // a sheet is open
        window.history.replaceState({ ...historyState(), mhScroll: Math.round(window.scrollY) }, '', window.location.href);
      }, 300);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (timer) clearTimeout(timer); };
  }, []);
  const restoredScroll = useRef(false);
  useEffect(() => {
    if (loading || !categoriesSettled || restoredScroll.current) return;
    restoredScroll.current = true;
    const y = historyState().mhScroll;
    if (typeof y === 'number' && y > 0 && !productParamFromUrl()) requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }));
  }, [loading, categoriesSettled]);

  const openedDeepLink = useRef<string | null>(null);
  // Deep-link landing & spotlight behavior (also auto-opens product detail modal if link points to product)
  useEffect(() => {
    if (loading) return;
    let slug: string | null = null;
    try { slug = productParamFromUrl(); } catch { return; }
    if (!slug || openedDeepLink.current === slug) return;
    openedDeepLink.current = slug;
    // Canonicalise legacy /marketplace/<slug> and ?item= / ?id= links to ?product=.
    const params = new URLSearchParams(window.location.search);
    ['item', 'id'].forEach(k => params.delete(k));
    params.set('product', slug);
    window.history.replaceState(historyState(), '', `/marketplace?${params.toString()}`);

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const land = (targetProduct: MarketplaceProduct) => {
      if (cancelled) return;
      setHighlightedProductId(targetProduct.id);
      setSelectedProduct(targetProduct);
      timers.push(setTimeout(() => document.getElementById(`marketplace-product-${targetProduct.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150));
      timers.push(setTimeout(() => setHighlightedProductId(null), 5000));
    };
    const local = findProduct(products, slug);
    if (local) land(local);
    else getPublicMarketplaceProductBySlug(slug).then(res => { if (res.success && res.product) land(res.product); }).catch(() => {});
    return () => { cancelled = true; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, products]);

  const categoryTiles = useMemo(() => summariseCategories(categories, products), [categories, products]);
  const brandTiles = useMemo(() => summariseBrands(products), [products]);
  const activeCategoryLabel = categoryLabel(browse.category, categories, products);
  const filteredProducts = useMemo(() => sortProducts(applyRefinements(products, browse), browse.sort), [products, browse]);
  const refinementCount = activeRefinementCount(browse);
  const canRefine = refinementCount > 0 || (() => { const o = refineAvailability(applyRefinements(products, browse, ['buy', 'kind', 'price'])); return o.buy || o.kinds.length > 0 || o.bands.length > 0; })();
  const isFiltered = browse.category !== 'all' || !!browse.brand || !!browse.q.trim() || refinementCount > 0;
  const resetAll = () => setBrowse(prev => ({ ...DEFAULT_BROWSE_STATE, sort: prev.sort }));

  const selectBrand = (id: string) => {
    updateBrowse({ brand: id });
    requestAnimationFrame(() => {
      const top = resultsRef.current?.getBoundingClientRect().top;
      if (top !== undefined && top > window.innerHeight * 0.65) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const selectCategory = (slug: string) => {
    updateBrowse({ category: slug });
    // Bring results into view when the grid starts below the fold on a phone.
    requestAnimationFrame(() => {
      const top = resultsRef.current?.getBoundingClientRect().top;
      if (top !== undefined && top > window.innerHeight * 0.65) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const formatGhcReward = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return '0';
    return val.toLocaleString('en-US', {
      minimumFractionDigits: val % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
  };

  const handleOpenShareModal = (p: MarketplaceProduct) => {
    openMarketplaceOverlay('share',p);
    setCopiedLink(false);
  };

  const handleCloseShareModal = () => {
    closeMarketplaceOverlay();
    setCopiedLink(false);
  };

  const handleCopyLink = (url: string, message = 'Product referral link copied to clipboard!') => {
    try {
      navigator.clipboard.writeText(url).then(
        () => { setCopiedLink(true); showToast(message, 'success'); setTimeout(() => setCopiedLink(false), 2500); },
        () => showToast('Failed to copy link. Please select and copy manually.', 'warning'),
      );
    } catch {
      showToast('Failed to copy link. Please select and copy manually.', 'warning');
    }
  };

  const handleNativeShare = (p: MarketplaceProduct, url: string, copiedMessage?: string) => {
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
      handleCopyLink(url, copiedMessage);
    }
  };

  // Plain product link (no referral code): for any product, rewarded or not.
  const shareProductLink = (p: MarketplaceProduct) => {
    const url = `${window.location.origin}/marketplace?product=${encodeURIComponent(p.slug || p.id)}`;
    handleNativeShare(p, url, 'Product link copied.');
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

  const sourcingMessage = browse.q.trim()
    ? `Hello Mystery Hub, I'm looking for "${browse.q.trim()}"${browse.category !== 'all' ? ` (${activeCategoryLabel})` : ''}. Can you help me source it?`
    : browse.category !== 'all'
    ? `Hello Mystery Hub, I'm looking for something in ${activeCategoryLabel}. Can you help me source it?`
    : 'Hello Mystery Hub team, I have a specific hardware or software sourcing request.';

  const activeChips: { key: string; label: string; clear: () => void }[] = [
    ...(browse.category !== 'all' ? [{ key: 'category', label: activeCategoryLabel, clear: () => updateBrowse({ category: 'all' }) }] : []),
    ...(browse.brand ? [{ key: 'brand', label: brandLabel(browse.brand), clear: () => updateBrowse({ brand: '' }) }] : []),
    ...(browse.q.trim() ? [{ key: 'q', label: `“${browse.q.trim()}”`, clear: () => updateBrowse({ q: '' }) }] : []),
    ...(browse.buyOnline ? [{ key: 'buy', label: 'Buy online', clear: () => updateBrowse({ buyOnline: false }) }] : []),
    ...(browse.kind ? [{ key: 'kind', label: KIND_LABELS[browse.kind], clear: () => updateBrowse({ kind: '' }) }] : []),
    ...(browse.price ? [{ key: 'price', label: PRICE_BANDS.find(b => b.id === browse.price)!.label, clear: () => updateBrowse({ price: '' }) }] : []),
  ];

  return (
    <div className="py-4 sm:py-6 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 sm:space-y-7">

        {/* =========================================================
            1. COMPACT MARKETPLACE HERO WITH SEARCH
               - Full-bleed artwork behind a left-to-right dark gradient
               - Search sits inside the hero so it is the first thing a customer can use
            ========================================================= */}
        <div className="relative rounded-2xl sm:rounded-3xl bg-[#070b0e] border border-slate-800/80 overflow-hidden shadow-xl sm:shadow-2xl">
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2 w-80 h-80 bg-[#00c365]/10 rounded-full blur-[100px] pointer-events-none z-0" />

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
                  heroImageLoaded ? 'opacity-60 sm:opacity-90' : 'opacity-0'
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#070b0e] via-[#070b0e]/85 via-50% to-[#070b0e]/30 to-100% sm:from-[#070b0e] sm:via-[#070b0e]/90 sm:via-45% sm:to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070b0e]/70 via-transparent to-[#070b0e]/20" />
            </div>
          )}

          <div className="relative z-10 w-full px-4 pt-4 pb-4 sm:p-7 lg:p-9 space-y-3 sm:space-y-4 text-left">
            <div className="max-w-xl lg:max-w-2xl space-y-1.5 sm:space-y-3">
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#111e18]/90 border border-[#00c365]/30 text-xs font-semibold text-[#00c365] backdrop-blur-sm">
                <Sparkles className="w-3 h-3" />
                <span>Tech &amp; Digital Marketplace</span>
              </div>
              <h1 className="text-[19px] sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-[1.2]">
                Technology, Creator Gear &amp;{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#38bdf8]">
                  Business Essentials
                </span>
              </h1>
              <p className="hidden sm:block text-slate-300 text-sm leading-relaxed max-w-md sm:max-w-xl">
                Buy online where it says so, or send an enquiry and we&apos;ll confirm price and availability in Ghana.
              </p>
            </div>

            {!loading && !error && products.length > 0 && (
              <form role="search" className="relative max-w-xl" onSubmit={e => { e.preventDefault(); searchRef.current?.blur(); resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                <label htmlFor="mh-marketplace-search" className="sr-only">Search the Marketplace</label>
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  id="mh-marketplace-search"
                  ref={searchRef}
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  value={browse.q}
                  onChange={(e) => updateBrowse({ q: e.target.value.slice(0, 80) })}
                  placeholder="Search laptops, phones, mics…"
                  className="w-full bg-[#0b1116]/95 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 sm:py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365] focus:ring-2 focus:ring-[#00c365]/25 [&::-webkit-search-cancel-button]:hidden"
                />
                {browse.q && (
                  <button
                    type="button"
                    onClick={() => { updateBrowse({ q: '' }); searchRef.current?.focus(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1.5 rounded-lg"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </form>
            )}

            <div className="hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 font-medium">
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00c365]" />
                <span>Clear price or enquiry on every item</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-[#00c365]" />
                <span>Direct WhatsApp support</span>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            2. VISUAL CATEGORY DISCOVERY (admin categories, live counts, real product photos)
            ========================================================= */}
        {!loading && !error && products.length > 0 && (
          <MarketplaceCategoryTiles tiles={categoryTiles} total={products.length} selected={browse.category} onSelect={selectCategory} brands={brandTiles} selectedBrand={browse.brand} onSelectBrand={selectBrand} />
        )}

        {/* =========================================================
            3. RESULTS: heading, sort, refine and active filters, then the grid
            ========================================================= */}
        <div ref={resultsRef} className="space-y-3 sm:space-y-4 scroll-mt-20">
        {!loading && !error && products.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-end justify-between gap-2 sm:gap-3">
              <div className="min-w-0">
                <h2 className="text-base sm:text-xl font-bold text-white tracking-tight truncate">{browse.brand ? `${brandLabel(browse.brand)}${browse.category !== 'all' ? ` · ${activeCategoryLabel}` : ''}` : activeCategoryLabel}</h2>
                <p className="text-xs text-slate-400" aria-live="polite">
                  <span className="font-semibold text-slate-200 tabular-nums">{filteredProducts.length}</span> {filteredProducts.length === 1 ? 'product' : 'products'}
                  {browse.q.trim() && <> for <span className="text-slate-200">“{browse.q.trim()}”</span></>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <label className="relative">
                  <span className="sr-only">Sort products</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2 sm:left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                  <select
                    value={browse.sort}
                    onChange={e => updateBrowse({ sort: e.target.value as MarketplaceSort })}
                    data-mh-sort
                    className="appearance-none bg-[#0e141a] border border-slate-700 rounded-xl pl-7 sm:pl-8 pr-2 sm:pr-3 h-10 text-xs sm:text-sm font-semibold text-slate-100 focus:outline-none focus:border-[#00c365] min-w-[7.5rem]"
                  >
                    {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
                {canRefine && (
                  <button
                    type="button"
                    data-mh-refine-open
                    onClick={() => setRefineOpen(true)}
                    className={`relative inline-flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 h-10 text-xs sm:text-sm font-semibold transition-colors active:scale-95 ${refinementCount ? 'border-[#00c365] text-white bg-[#00c365]/10' : 'border-slate-700 text-slate-100 bg-[#0e141a] hover:border-slate-500'}`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Refine</span>
                    {refinementCount > 0 && <span className="ml-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-[#00c365] text-black text-[10px] font-extrabold flex items-center justify-center" aria-label={`${refinementCount} active`}>{refinementCount}</span>}
                  </button>
                )}
              </div>
            </div>

            {activeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
                {activeChips.map(chip => (
                  <button key={chip.key} type="button" onClick={chip.clear} className="inline-flex items-center gap-1 max-w-full rounded-full border border-slate-700 bg-[#0e141a] pl-3 pr-2 min-h-[32px] text-xs text-slate-200 hover:border-slate-500" aria-label={`Remove filter ${chip.label}`}>
                    <span className="truncate">{chip.label}</span>
                    <X className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                  </button>
                ))}
                {activeChips.length > 1 && (
                  <button type="button" onClick={resetAll} className="text-xs font-semibold text-[#00c365] hover:underline px-1.5 py-1">Clear all</button>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          /* Loading Skeleton State */
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5" role="status" aria-label="Loading products">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="rounded-2xl bg-[#0f151b] border border-slate-800 overflow-hidden animate-pulse"
              >
                <div className="w-full aspect-square bg-slate-800/50" />
                <div className="p-2.5 sm:p-3.5 space-y-2">
                  <div className="h-3.5 bg-slate-800 rounded w-4/5" />
                  <div className="h-3 bg-slate-800/70 rounded w-1/2" />
                  <div className="h-4 bg-slate-800 rounded w-1/3 mt-3" />
                  <div className="h-5 bg-slate-800/70 rounded-full w-20" />
                </div>
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
                Try Again
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
          /* FILTERED-ZERO STATE: explain why, offer the nearest useful step */
          <div className="text-center py-8 px-4 bg-[#0f151b] rounded-2xl border border-slate-800 space-y-3 max-w-lg mx-auto">
            <Search className="w-7 h-7 text-slate-400 mx-auto" />
            <h3 className="text-sm sm:text-base font-bold text-white">
              {browse.q.trim() ? `No results for “${browse.q.trim()}”` : browse.category !== 'all' && !products.some(p => p.category === browse.category) ? `No products in ${activeCategoryLabel} yet` : 'No products match these filters'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {browse.q.trim() && browse.category !== 'all' && applyRefinements(products, browse, ['category']).length > 0
                ? `There ${applyRefinements(products, browse, ['category']).length === 1 ? 'is 1 match' : `are ${applyRefinements(products, browse, ['category']).length} matches`} in other categories.`
                : 'We can still help. Tell us what you need and we’ll check options available in Ghana.'}
            </p>
            <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2">
              {browse.q.trim() && browse.category !== 'all' && applyRefinements(products, browse, ['category']).length > 0 ? (
                <button type="button" onClick={() => updateBrowse({ category: 'all' })} className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#00c365] text-black font-bold text-xs inline-flex items-center justify-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  <span>Search all categories</span>
                </button>
              ) : (
                <a href={BUSINESS_CONFIG.getGeneralWhatsAppUrl(sourcingMessage)} target="_blank" rel="noreferrer" className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#00c365] text-black font-bold text-xs inline-flex items-center justify-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Ask us to source it</span>
                </a>
              )}
              <button
                onClick={resetAll}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>
          </div>
        ) : (
          /* LIVE PRODUCTS GRID (2 columns on phones) */
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
            {filteredProducts.map((p, index) => (
              <MarketplaceProductCard
                key={p.id}
                product={p}
                priority={index < 2}
                highlighted={highlightedProductId === p.id}
                onOpen={setSelectedProduct}
                onShareEarn={handleOpenShareModal}
                formatGhc={formatGhcReward}
              />
            ))}
          </div>
        )}
        </div>

        {/* =========================================================
            4. CUSTOM TECH SOURCING SERVICE BANNER
            ========================================================= */}
        {!loading && !error && products.length > 0 && (
          <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0e161c] via-[#091014] to-[#070b0e] border border-slate-800 p-4 sm:p-6 space-y-3">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="space-y-1 max-w-2xl text-left">
                <span className="text-xs sm:text-xs font-bold text-[#00c365] uppercase tracking-wider">
                  Find an Item for Your Business
                </span>
                <h3 className="text-base sm:text-xl font-bold text-white tracking-tight">
                  Need Specific Hardware or Software Not Listed Above?
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Tell us the item, specifications and budget you have in mind. We’ll check available options and discuss pricing with you.
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
                  <span>Ask on WhatsApp</span>
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

        {/* =========================================================
            5. COMPACT WHATSAPP CHANNEL PROMOTION
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
      </div>

      {refineOpen && (
        <MarketplaceRefineSheet products={products} state={browse} onChange={updateBrowse} onClose={() => setRefineOpen(false)} />
      )}

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
          onShareLink={shareProductLink}
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
                <div className="w-14 h-14 rounded-lg border border-slate-800 shrink-0 overflow-hidden">
                  <ProductPhoto
                    src={shareModalProduct.imageUrl}
                    alt={shareModalProduct.imageAlt || shareModalProduct.name}
                    iconKey={categoryIconKey(shareModalProduct.category, shareModalProduct.categoryLabel)}
                    fit="cover"
                    widths={[112, 168]}
                    sizes="56px"
                    iconSize="sm"
                  />
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
                    Rewards appear in Mystery Earn when an eligible referred order is delivered.
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
                      when an eligible referred purchase of this product is delivered.
                    </p>
                  </div>

                  {/* Key Highlights */}
                  <div className="p-3.5 rounded-xl bg-[#090e13] border border-slate-800 space-y-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Your own referral link after sign-up</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Eligible future purchases may also earn rewards under the active rules</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Reward History shows your rewards and their status</span>
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
