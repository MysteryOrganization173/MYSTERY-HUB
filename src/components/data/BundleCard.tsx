import React, { useRef } from 'react';
import { DataBundle } from '../../types';
import { GHANA_NETWORKS } from '../../data/bundles';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

interface BundleCardProps {
  bundle: DataBundle;
  recipientPhone?: string;
  onPhoneChange?: (phone: string) => void;
  onBuy: (bundle: DataBundle, options?: { recipientPhone?: string }) => void;
  featured?: boolean;
}

export const BundleCard: React.FC<BundleCardProps> = ({
  bundle,
  recipientPhone = '',
  onPhoneChange,
  onBuy,
  featured = false,
}) => {
  const network = GHANA_NETWORKS[bundle.network];
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const handleCardClick = () => {
    phoneInputRef.current?.focus();
  };

  const handleReviewOrder = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBuy(bundle, { recipientPhone: recipientPhone.trim() ? recipientPhone.trim() : undefined });
  };

  return (
    <div
      onClick={handleCardClick}
      className={`relative rounded-2xl bg-[#0f151b] border transition-all duration-200 p-3.5 sm:p-4.5 flex flex-col justify-between group hover:-translate-y-0.5 hover:shadow-xl cursor-pointer ${
        featured || bundle.isBestValue
          ? 'border-[#00c365]/60 shadow-[0_0_20px_rgba(0,195,101,0.12)]'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Top badges */}
      <div className="flex items-center justify-between gap-2 mb-2">
        {/* Network indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: network.brandColor }}
          />
          <span className="text-xs font-semibold text-slate-300">
            {bundle.network === 'mtn' ? 'MTN' : bundle.network === 'telecel' ? 'Telecel' : 'AT'}
          </span>
        </div>

        {/* Promo tag */}
        <div className="flex items-center gap-1">
          {bundle.isBestValue && (
            <span className="text-[10px] font-bold text-[#00c365] bg-[#00c365]/10 border border-[#00c365]/30 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
              Best Value
            </span>
          )}
          {!bundle.isBestValue && bundle.isPopular && (
            <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
              Popular
            </span>
          )}
        </div>
      </div>

      {/* Main Bundle Details */}
      <div className="space-y-1.5">
        <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight group-hover:text-[#00c365] transition-colors leading-tight">
          {bundle.dataAmount}
        </h3>

        {bundle.network === 'airteltigo' ? (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded-md">
              ⚡ Instant Delivery
            </span>
            <span className="text-[11px] text-slate-400">· In Stock</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
            <span className="truncate">In Stock · Direct SIM Credit</span>
          </div>
        )}

        <p className="text-[11px] text-slate-400 leading-snug line-clamp-1">
          {bundle.network === 'airteltigo'
            ? 'Instant direct delivery to your AT number.'
            : (bundle.description || 'Fast direct SIM delivery')}
        </p>

        {/* Quick Buy: Compact Ghana Recipient-Number Field */}
        <div className="pt-1.5">
          <label
            htmlFor={`card-phone-${bundle.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] sm:text-[11px] font-semibold text-slate-300 block mb-0.5"
          >
            Recipient number
          </label>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <input
              ref={phoneInputRef}
              id={`card-phone-${bundle.id}`}
              type="tel"
              value={recipientPhone}
              onChange={(e) => {
                const val = e.target.value.replace(/[^\d\s]/g, '');
                onPhoneChange?.(val);
              }}
              placeholder="024 XXX XXXX"
              className="w-full bg-[#0a0e12] border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365] focus:ring-1 focus:ring-[#00c365] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Pricing and Review Order Action */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-400 font-medium">Price</span>
          <span className="text-lg sm:text-xl font-extrabold text-white tabular-nums tracking-tight">
            GH₵{bundle.priceGhc.toFixed(2)}
          </span>
        </div>

        <button
          type="button"
          onClick={handleReviewOrder}
          className="w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,195,101,0.25)] hover:shadow-[0_0_20px_rgba(0,195,101,0.35)] active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>Review Order</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
