import React, { useState, useEffect } from 'react';
import { MarketplaceProduct, MarketplacePickupLocation, MarketplaceProductVariant } from '../../types';
import { useApp } from '../../context/AppContext';
import { API_BASE_URL } from '../../services/apiClient';
import {
  X,
  ShoppingBag,
  MapPin,
  Truck,
  CreditCard,
  Gift,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface MarketplaceCheckoutModalProps {
  product: MarketplaceProduct;
  referralCode?: string;
  onClose: () => void;
}

const DEFAULT_PICKUP_LOCATION: MarketplacePickupLocation = {
  id: 'accra_madina_default',
  name: 'Accra — Madina Pickup Hub',
  city: 'Accra',
  area: 'Madina',
  addressOrLandmark: 'Madina Zongo Junction, Accra · Details confirmed upon payment.',
  phone: '059 206 6298',
  active: true,
};

export const MarketplaceCheckoutModal: React.FC<MarketplaceCheckoutModalProps> = ({
  product,
  referralCode,
  onClose,
}) => {
  const { user, showToast } = useApp();

  // Variant State
  const activeVariants = (product.variants || []).filter((v) => v.active !== false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    activeVariants.length > 0 ? activeVariants[0].id : undefined
  );

  const selectedVariant: MarketplaceProductVariant | undefined = activeVariants.find(
    (v) => v.id === selectedVariantId
  );

  // Price Calculation
  const unitPriceGhc = selectedVariant
    ? selectedVariant.priceGhc
    : product.priceGhc ?? (product.priceMinor ? product.priceMinor / 100 : 0);

  // Fulfilment Mode State
  const allowedFulfilment = product.fulfilmentMode || 'both';
  const initialFulfilmentMethod =
    allowedFulfilment === 'pickup' ? 'pickup' : allowedFulfilment === 'delivery' ? 'delivery' : 'pickup';

  const [fulfilmentMethod, setFulfilmentMethod] = useState<'pickup' | 'delivery'>(initialFulfilmentMethod);

  // Pickup Location Selection
  const activePickupLocations = (product.pickupLocations || []).filter((loc) => loc.active !== false);
  const availablePickupLocations =
    activePickupLocations.length > 0 ? activePickupLocations : [DEFAULT_PICKUP_LOCATION];

  const [selectedPickupId, setSelectedPickupId] = useState<string>(
    availablePickupLocations[0]?.id || DEFAULT_PICKUP_LOCATION.id
  );

  const selectedPickupLocation = availablePickupLocations.find((loc) => loc.id === selectedPickupId) || availablePickupLocations[0];

  // Delivery Address Form
  const [deliveryCity, setDeliveryCity] = useState('Accra');
  const [deliveryArea, setDeliveryArea] = useState('');
  const [deliveryLandmark, setDeliveryLandmark] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  // Customer Contact Form
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ghanaian Phone Number Format Validation (e.g., 024XXXXXXX, 059XXXXXXX, 020XXXXXXX)
  const validatePhone = (val: string): boolean => {
    const clean = val.replace(/[^\d+]/g, '');
    if (clean.startsWith('+233')) {
      return clean.length === 13;
    }
    const numbersOnly = clean.replace(/\D/g, '');
    return numbersOnly.length === 10 && numbersOnly.startsWith('0');
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!customerName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!phone.trim() || !validatePhone(phone.trim())) {
      setErrorMessage('Please enter a valid 10-digit Ghanaian phone number (e.g. 0592066298 or 024XXXXXXX).');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address for your payment receipt.');
      return;
    }

    if (fulfilmentMethod === 'pickup' && !selectedPickupLocation) {
      setErrorMessage('Please choose a valid pickup location.');
      return;
    }

    if (fulfilmentMethod === 'delivery') {
      if (!deliveryCity.trim()) {
        setErrorMessage('Please specify your delivery city.');
        return;
      }
      if (!deliveryArea.trim()) {
        setErrorMessage('Please specify your delivery area / neighborhood.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = {
        serviceType: 'marketplace',
        productId: product.id,
        productSlug: product.slug,
        variantId: selectedVariantId,
        fulfilmentMethod,
        pickupLocationId: fulfilmentMethod === 'pickup' ? selectedPickupLocation.id : undefined,
        deliveryCity: fulfilmentMethod === 'delivery' ? deliveryCity.trim() : undefined,
        deliveryArea: fulfilmentMethod === 'delivery' ? deliveryArea.trim() : undefined,
        deliveryLandmark: fulfilmentMethod === 'delivery' ? deliveryLandmark.trim() : undefined,
        deliveryNote: fulfilmentMethod === 'delivery' ? deliveryNote.trim() : undefined,
        customerName: customerName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        referralCode: referralCode || undefined,
      };

      const res = await fetch(`${API_BASE_URL}/api/payments/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize Paystack payment.');
      }

      if (data.authorizationUrl) {
        showToast('Redirecting to Paystack Secure Checkout...', 'info');
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error('Paystack authorization link not generated.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to complete checkout at this time.';
      setErrorMessage(msg);
      showToast(msg, 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-[#0e141a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketplace-checkout-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#090d11] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00c365]/15 border border-[#00c365]/30 flex items-center justify-center text-[#00c365]">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-[#00c365] font-bold uppercase tracking-wider block">
                Direct Purchase · Paystack Secure
              </span>
              <h3 id="marketplace-checkout-title" className="text-sm sm:text-base font-bold text-white">
                Marketplace Checkout
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close checkout modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleCheckoutSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Checkout Error</span>
              </div>
              <p className="text-xs leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* Referral Banner */}
          {referralCode && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-[#00c365]/15 to-amber-500/15 border border-amber-500/30 text-slate-200 flex items-center gap-2.5">
              <Gift className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-[11px] leading-tight">
                <span className="font-bold text-amber-300 block">Mystery Earn Referral Attached</span>
                <span className="text-slate-300">
                  Referral code <span className="font-mono text-white font-bold">{referralCode}</span> is linked to this order for lifetime reward attribution.
                </span>
              </div>
            </div>
          )}

          {/* Product Summary Card */}
          <div className="p-4 rounded-xl bg-[#121921] border border-slate-800 flex items-start gap-3.5">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.imageAlt || product.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border border-slate-700/60 shrink-0 bg-black"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-400">
                <ShoppingBag className="w-8 h-8" />
              </div>
            )}

            <div className="flex-1 min-w-0 space-y-1">
              <span className="text-[10px] font-semibold text-[#00c365] bg-[#00c365]/10 px-2 py-0.5 rounded border border-[#00c365]/20 inline-block">
                {product.categoryLabel}
              </span>
              <h4 className="font-bold text-sm sm:text-base text-white truncate">{product.name}</h4>
              {product.tagline && <p className="text-xs text-slate-400 line-clamp-1">{product.tagline}</p>}
              <div className="pt-1 flex items-baseline justify-between">
                <span className="text-[11px] text-slate-400">Unit Price</span>
                <span className="text-base sm:text-lg font-extrabold text-emerald-400 tabular-nums">
                  GH₵{unitPriceGhc.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Variant Selector (if applicable) */}
          {activeVariants.length > 0 && (
            <div className="space-y-2">
              <label className="font-bold text-slate-200 block text-xs">
                Select Option / Configuration:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeVariants.map((variant) => {
                  const isSelected = variant.id === selectedVariantId;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#00c365]/15 border-[#00c365] text-white font-bold'
                          : 'bg-[#090d10] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className="truncate">{variant.name}</span>
                      <span className="font-bold text-emerald-400 font-mono text-xs shrink-0">
                        GH₵{variant.priceGhc.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fulfilment Method Choice */}
          <div className="space-y-2.5">
            <label className="font-bold text-slate-200 block text-xs">
              Fulfilment Method:
            </label>

            {allowedFulfilment === 'both' && (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setFulfilmentMethod('pickup')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                    fulfilmentMethod === 'pickup'
                      ? 'bg-[#00c365]/20 border-[#00c365] text-white shadow-sm'
                      : 'bg-[#090d10] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-[#00c365]" />
                  <span>Pickup Hub (Free)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFulfilmentMethod('delivery')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                    fulfilmentMethod === 'delivery'
                      ? 'bg-[#00c365]/20 border-[#00c365] text-white shadow-sm'
                      : 'bg-[#090d10] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Truck className="w-4 h-4 text-[#00c365]" />
                  <span>Doorstep Delivery</span>
                </button>
              </div>
            )}

            {/* Pickup Location Details */}
            {fulfilmentMethod === 'pickup' && (
              <div className="p-3.5 rounded-xl bg-[#090d10] border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <MapPin className="w-4 h-4" />
                    <span>Select Pickup Point:</span>
                  </span>
                  <span className="text-[10px] text-slate-400">No pickup fee</span>
                </div>

                <div className="space-y-2">
                  {availablePickupLocations.map((loc) => {
                    const isSelected = loc.id === selectedPickupId;
                    return (
                      <div
                        key={loc.id}
                        onClick={() => setSelectedPickupId(loc.id)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#00c365]/10 border-[#00c365] text-white'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>{loc.name}</span>
                          <span className="text-[10px] text-[#00c365] uppercase">{loc.city} — {loc.area}</span>
                        </div>
                        {loc.addressOrLandmark && (
                          <p className="text-[11px] text-slate-400 mt-1 leading-snug">{loc.addressOrLandmark}</p>
                        )}
                        {loc.phone && (
                          <p className="text-[10px] text-slate-400 mt-0.5">Pickup Phone: {loc.phone}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Delivery Details Form */}
            {fulfilmentMethod === 'delivery' && (
              <div className="p-3.5 rounded-xl bg-[#090d10] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4" />
                    <span>Delivery Address Details:</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Local dispatch</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold block text-[11px]">
                      City / Region <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={deliveryCity}
                      onChange={(e) => setDeliveryCity(e.target.value)}
                      placeholder="e.g. Accra, Kumasi, Cape Coast"
                      className="w-full bg-[#0e141a] border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#00c365]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold block text-[11px]">
                      Area / Neighborhood <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={deliveryArea}
                      onChange={(e) => setDeliveryArea(e.target.value)}
                      placeholder="e.g. East Legon, Spintex, Adum"
                      className="w-full bg-[#0e141a] border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#00c365]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block text-[11px]">
                    Landmark / Address <span className="text-slate-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryLandmark}
                    onChange={(e) => setDeliveryLandmark(e.target.value)}
                    placeholder="e.g. Near Shell filling station, House No. 24"
                    className="w-full bg-[#0e141a] border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#00c365]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block text-[11px]">
                    Delivery Instructions / Note <span className="text-slate-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    placeholder="e.g. Call before coming"
                    className="w-full bg-[#0e141a] border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#00c365]"
                  />
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  Note: Standard local dispatch delivery fee calculated or confirmed prior to dispatch.
                </p>
              </div>
            )}
          </div>

          {/* Purchase Note Banner */}
          {product.purchaseNote && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{product.purchaseNote}</p>
            </div>
          )}

          {/* Customer Details Form */}
          <div className="space-y-3 pt-1 border-t border-slate-800">
            <span className="font-bold text-slate-200 block text-xs">Customer Contact Information:</span>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300 block text-[11px]">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Kwame Asante"
                className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-[#00c365]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 block text-[11px]">
                  Ghanaian Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 059 206 6298"
                  className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-[#00c365]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 block text-[11px]">
                  Email Address (Receipt) <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. kwame@example.com"
                  className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-[#00c365]"
                />
              </div>
            </div>
          </div>

          {/* Order Summary Breakdown */}
          <div className="p-4 rounded-xl bg-[#090d10] border border-slate-800 space-y-2 text-xs">
            <span className="font-bold text-white block">Order Summary:</span>
            <div className="flex justify-between text-slate-300">
              <span>
                {product.name} {selectedVariant ? `(${selectedVariant.name})` : ''}
              </span>
              <span className="font-mono text-white font-bold">
                GH₵{unitPriceGhc.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between text-slate-300">
              <span>Fulfilment ({fulfilmentMethod === 'pickup' ? 'Pickup' : 'Delivery'})</span>
              <span className="font-mono text-emerald-400">
                {fulfilmentMethod === 'pickup' ? 'Free Pickup' : 'Local Dispatch'}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between font-extrabold text-sm text-white">
              <span>Total Amount Payable</span>
              <span className="text-emerald-400 font-mono text-base">
                GH₵{unitPriceGhc.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* CTA Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,195,101,0.25)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50"
          >
            <CreditCard className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Initializing Payment...'
                : `Proceed to Payment — GH₵${unitPriceGhc.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}`}
            </span>
          </button>

          <p className="text-[10px] text-center text-slate-500">
            Powered by Paystack · Accepts Mobile Money (MTN, Telecel, AT), Cards, Visa &amp; Bank Transfer.
          </p>
        </form>
      </div>
    </div>
  );
};
