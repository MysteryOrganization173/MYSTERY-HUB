import { purchasableOptions, initialMarketplaceOption } from '../../../shared/marketplaceVariants';
import { useMarketplaceDialog } from './useMarketplaceDialog';
import { FULFILMENT_LABELS } from '../../../shared/marketplacePolicy';
import React, { useState } from 'react';
import { MarketplaceProduct, MarketplacePickupLocation } from '../../types';
import { OptimizedImage } from '../common/OptimizedImage';
import { BUSINESS_CONFIG } from '../../config/business';
import {
  X,
  ShoppingBag,
  FileQuestion,
  Gift,
  Share2,
  CheckCircle,
  MapPin,
  Truck,
  Info,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Clock,
  Box,
  Laptop,
  Smartphone,
  Mic,
  Cpu,
  Printer,
} from 'lucide-react';

interface MarketplaceProductDetailModalProps {
  product: MarketplaceProduct;
  onClose: () => void;
  initialVariantId?: string;
  onVariantChange?: (id: string) => void;
  onBuyNow: (product: MarketplaceProduct, variantId?: string) => void;
  onInquire: (product: MarketplaceProduct) => void;
  onShare: (product: MarketplaceProduct) => void;
  formatGhcReward: (val: number | null | undefined) => string;
}

export const MarketplaceProductDetailModal: React.FC<MarketplaceProductDetailModalProps> = ({
  product,
  onClose,
  onBuyNow, initialVariantId, onVariantChange,
  onInquire,
  onShare,
  formatGhcReward,
}) => {
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  const dialogRef = useMarketplaceDialog(true,onClose);
  const options = purchasableOptions(product.variants);
  const [selectedVariantId,setSelectedVariantId] = useState(() => initialMarketplaceOption(product.variants || [],initialVariantId));
  const selectedVariant = options.find(v => v.id === selectedVariantId);
  const needsOption = options.length > 0 && !selectedVariant;
  const displayedPrice = selectedVariant ? 'GH₵' + (selectedVariant.priceMinor / 100).toLocaleString('en-US',{maximumFractionDigits:2}) : product.priceDisplay;
  const getCategoryFallbackIcon = (category: string) => {
    switch (category) {
      case 'laptops_computers':
        return <Laptop className="w-12 h-12 text-sky-400 opacity-80" />;
      case 'phones_accessories':
        return <Smartphone className="w-12 h-12 text-emerald-400 opacity-80" />;
      case 'creator_tools':
        return <Mic className="w-12 h-12 text-pink-400 opacity-80" />;
      case 'ai_productivity':
      case 'business_software':
        return <Cpu className="w-12 h-12 text-[#00c365] opacity-80" />;
      case 'business_essentials':
        return <Printer className="w-12 h-12 text-amber-400 opacity-80" />;
      default:
        return <Box className="w-12 h-12 text-slate-400 opacity-80" />;
    }
  };

  const availabilityBadgeMap: Record<string, { label: string; style: string }> = {
    in_stock: {
      label: 'In Stock',
      style: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    },
    sourcing_on_demand: {
      label: 'Sourced on Request',
      style: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    },
    preorder: {
      label: 'Pre-Order',
      style: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    },
    out_of_stock: {
      label: 'Out of Stock',
      style: 'bg-slate-800 text-slate-400 border-slate-700',
    },
    available: {
      label: 'In Stock',
      style: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    },
    check_availability: {
      label: 'Sourced on Request',
      style: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    },
  };

  const availabilityBadge = availabilityBadgeMap[product.availability] || {
    label: 'Sourced on Request',
    style: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  };

  const isEligibleForShare =
    product.published !== false &&
    !product.archived &&
    product.availability !== 'coming_soon' &&
    typeof product.referralRewardGhc === 'number' &&
    product.referralRewardGhc > 0;

  const rewardGhcFormatted = isEligibleForShare
    ? formatGhcReward(product.referralRewardGhc)
    : null;

  const activePickupLocations: MarketplacePickupLocation[] = (
    product.pickupLocations || []
  ).filter((loc) => loc.active !== false);

  const allowedFulfilment = product.fulfilmentMode || 'both';
  const isPhysical = (product.productKind || 'physical') === 'physical';
  const hasPickup =
    allowedFulfilment !== 'delivery' && activePickupLocations.length > 0;
  const hasDelivery =
    allowedFulfilment !== 'pickup' && product.deliveryAvailable !== false;

  const isPurchaseSupported =
    product.purchaseEnabled !== false && product.priceType !== 'quote' && product.availability !== 'coming_soon' && (!(product.variants?.length) || options.length > 0) && allowedFulfilment !== 'inquiry_only';

  const isLongDescription = (product.description || '').length > 320;
  const displayedDescription =
    isLongDescription && !isDescExpanded
      ? `${product.description.slice(0, 320)}...`
      : product.description;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      ref={dialogRef} tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-detail-title"
    >
      <div
        className="relative w-full max-w-full sm:max-w-2xl lg:max-w-3xl h-[92vh] sm:h-auto sm:max-h-[90vh] bg-[#0c1218] border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header / Close Action */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-[#090e13]/90 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-bold text-[#00c365] bg-[#00c365]/10 border border-[#00c365]/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider truncate">
              {product.categoryLabel}
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              · Sourced on Request
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors cursor-pointer active:scale-95"
            aria-label="Close product details"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Scrollable Product Details Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 space-y-6 text-left">
          {/* 1. Large High-Quality Product Image */}
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-gradient-to-b from-[#080d12] to-[#0f1620] rounded-2xl border border-slate-800/90 overflow-hidden shadow-inner flex items-center justify-center">
            <OptimizedImage
              src={product.imageUrl}
              alt={product.imageAlt || product.name}
              aspectRatio="16/10"
              objectFit="cover"
              objectPosition="center center"
              fallbackIcon={getCategoryFallbackIcon(product.category)}
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-102"
            />

            {/* Promo Badge */}
            {product.badge && (
              <span className="absolute top-3 right-3 text-xs font-bold text-white bg-black/80 backdrop-blur-md border border-slate-700 px-3 py-1 rounded-lg shadow-md">
                {product.badge}
              </span>
            )}

            {/* Availability Pill on Image */}
            <span
              className={`absolute bottom-3 left-3 text-xs font-bold px-3 py-1 rounded-lg backdrop-blur-md border shadow-md ${availabilityBadge.style}`}
            >
              {product.availabilityLabel || availabilityBadge.label}
            </span>
          </div>

          {/* 2. Product Title, Tagline & Price */}
          <div className="space-y-2 border-b border-slate-800/80 pb-5">
            <h2
              id="product-detail-title"
              className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight"
            >
              {product.name}
            </h2>

            {product.tagline && (
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                {product.tagline}
              </p>
            )}

            <div className="pt-2 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">
                  {selectedVariant ? 'Selected Option Price' : product.priceType === 'starting_at'
                    ? 'Starting Price'
                    : product.priceType === 'quote'
                    ? 'Pricing'
                    : 'Ghana Cedis Price'}
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight tabular-nums">
                  {displayedPrice}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-xl">
                <ShieldCheck className="w-4 h-4 text-[#00c365]" />
                <span>Mystery Hub Marketplace</span>
              </div>
            </div>
          </div>

          {options.length > 0 && <fieldset className="space-y-2"><legend className="font-bold text-sm">Choose an option</legend><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{options.map(option => <button key={option.id} type="button" aria-pressed={selectedVariantId === option.id} onClick={() => {setSelectedVariantId(option.id);onVariantChange?.(option.id);}} className={`rounded-xl border p-3 text-left text-sm ${selectedVariantId === option.id ? 'border-emerald-400 bg-emerald-500/15' : 'border-slate-700 bg-slate-900'}`}><span className="block">{option.name}</span><strong>GH₵{(option.priceMinor/100).toLocaleString()}</strong></button>)}</div>{needsOption && <p className="text-sm text-amber-300">Choose an option before continuing to payment.</p>}</fieldset>}

          {/* 3. Share & Earn Opportunity Section (If eligible) */}
          {isEligibleForShare && rewardGhcFormatted && (
            <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-[#00c365]/10 to-amber-500/10 border border-amber-500/35 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                  <Gift className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                      Mystery Earn Referral
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm sm:text-base text-white">
                    Earn{' '}
                    <span className="text-amber-400 font-mono font-black">
                      GH₵{rewardGhcFormatted}
                    </span>{' '}
                    On Qualifying Orders
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Share your tracked personal product link with customers or
                    friends and earn upon order completion.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onShare(product)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-md active:scale-95 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share &amp; Earn GH₵{rewardGhcFormatted}</span>
              </button>
            </div>
          )}

          {/* 4. Product Description */}
          {product.description && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#00c365]" />
                <span>About This Product</span>
              </h3>
              <div className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-[#0f151b] p-4 rounded-2xl border border-slate-800/80 whitespace-pre-line">
                {displayedDescription}
                {isLongDescription && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsDescExpanded((prev) => !prev)}
                      className="text-xs font-bold text-[#00c365] hover:text-[#00e575] inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>{isDescExpanded ? 'Show less' : 'Read full description'}</span>
                      {isDescExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. Key Highlights / Specifications */}
          {((product.highlights && product.highlights.length > 0) ||
            (product.specs && product.specs.length > 0)) && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#00c365]" />
                <span>Specifications &amp; Features</span>
              </h3>

              {/* Highlights List */}
              {product.highlights && product.highlights.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {product.highlights.map((h, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-[#0f151b] border border-slate-800 flex items-start gap-2 text-xs text-slate-200"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-[#00c365] shrink-0 mt-0.5" />
                      <span className="leading-snug">{h}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Specs Table if defined */}
              {product.specs && product.specs.length > 0 && (
                <div className="rounded-2xl border border-slate-800/90 overflow-hidden bg-[#0f151b]">
                  <div className="divide-y divide-slate-800">
                    {product.specs.map((s, i) => (
                      <div
                        key={i}
                        className="px-4 py-2.5 flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-400 font-medium">
                          {s.label}
                        </span>
                        <span className="text-white font-semibold text-right">
                          {s.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. Fulfilment & Delivery Information (Truthful, only configured data) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-[#00c365]" />
              <span>Fulfilment &amp; Availability</span>
            </h3>

            {isPhysical ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Delivery info */}
              <div className="p-3.5 rounded-xl bg-[#0f151b] border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Truck className="w-4 h-4 text-sky-400" />
                  <span>
                    {hasDelivery ? 'Delivery Options' : 'Delivery Status'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {hasDelivery
                    ? product.deliveryNote ||
                      'Confirm delivery availability and charges before ordering.'
                    : 'Direct pickup only or inquiry required.'}
                </p>
              </div>

              {/* Pickup location info */}
              <div className="p-3.5 rounded-xl bg-[#0f151b] border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>
                    {hasPickup ? 'Pickup Location' : 'Pickup Availability'}
                  </span>
                </div>
                {hasPickup && activePickupLocations.length > 0 ? (
                  <div className="space-y-1 text-xs text-slate-300">
                    {activePickupLocations.map((loc) => (
                      <p key={loc.id} className="leading-snug">
                        <strong className="text-white">{loc.name}</strong>
                        {loc.city && ` · ${loc.city}`}
                        {loc.addressOrLandmark && (
                          <span className="block text-[11px] text-slate-400">
                            {loc.addressOrLandmark}
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sourced on demand; location coordinated upon inquiry.
                  </p>
                )}
              </div>
            </div>
            ) : <div className="rounded-xl border border-slate-800 p-3 text-xs space-y-2"><strong>{FULFILMENT_LABELS[allowedFulfilment]}</strong>{product.fulfilmentNote&&<p>{product.fulfilmentNote}</p>}{product.fulfilmentIdentifierLabel&&<p>{product.fulfilmentIdentifierRequired?'Required':'Optional'}: {product.fulfilmentIdentifierLabel}</p>}</div>}

            {/* Purchase Note if configured */}
            {product.purchaseNote && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{product.purchaseNote}</span>
              </div>
            )}
          </div>


          {/* Spacing safeguard so bottom content is never hidden behind sticky bar */}
          <div className="h-16 sm:h-20" />
        </div>

        {/* 7. Sticky Bottom Action Bar (Reachable at all scroll positions) */}
        <div className="sticky bottom-0 left-0 right-0 z-20 bg-[#090e13]/95 backdrop-blur-md border-t border-slate-800/90 p-3 sm:p-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] shadow-2xl">
          <div className="flex items-center gap-2 sm:gap-2.5 max-w-2xl mx-auto">
            {isPurchaseSupported ? (
              <>
                <button
                  type="button"
                  disabled={needsOption}
                  data-marketplace-primary
                  onClick={() => onBuyNow(product,selectedVariant?.id)}
                  className="flex-1 py-3 px-3 sm:px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 sm:gap-2 shadow-[0_0_20px_rgba(0,195,101,0.3)] active:scale-[0.98] cursor-pointer min-w-0"
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span className="truncate">{needsOption ? 'Choose an option' : `Buy Now (${displayedPrice})`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onInquire(product)}
                  className="py-3 px-3 sm:px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/90 font-bold text-xs sm:text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] shrink-0"
                >
                  <FileQuestion className="w-4 h-4 text-slate-400" />
                  <span>Ask Us</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onInquire(product)}
                className="w-full py-3.5 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,195,101,0.3)] cursor-pointer active:scale-[0.98]"
              >
                <FileQuestion className="w-4 h-4 shrink-0" />
                <span className="truncate">Ask About This Item</span>
              </button>
            )}

            {isEligibleForShare && rewardGhcFormatted && (
              <button
                type="button"
                onClick={() => onShare(product)}
                className="p-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-400 transition-colors flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
                title={`Share and earn GH₵${rewardGhcFormatted}`}
                aria-label={`Share and earn GH₵${rewardGhcFormatted}`}
              >
                <Gift className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
