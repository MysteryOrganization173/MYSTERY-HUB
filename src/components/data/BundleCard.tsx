import React, { useRef } from 'react';
import { DataBundle } from '../../types';
import { GHANA_NETWORKS } from '../../data/bundles';
import { NetworkBrandBadge } from '../common/NetworkBrandBadge';
import { ArrowRight, CheckCircle2, Zap } from 'lucide-react';

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
  const network = GHANA_NETWORKS[bundle.network] || GHANA_NETWORKS.mtn;
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('input') && !target.closest('button')) {
      phoneInputRef.current?.focus();
    }
  };

  const handleReviewOrder = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBuy(bundle, { recipientPhone: recipientPhone.trim() ? recipientPhone.trim() : undefined });
  };

  return (
    <div
      onClick={handleCardClick}
      className={`relative rounded-2xl bg-[#0f151b] border transition-all duration-200 p-3 sm:p-4 flex flex-col justify-between group hover:-translate-y-0.5 hover:shadow-xl cursor-pointer ${
        featured || bundle.isBestValue
          ? 'border-[#00c365]/60 shadow-[0_0_20px_rgba(0,195,101,0.12)]'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* ROW 1: Network badge + Data Amount + Promo Tag + Price */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
          <NetworkBrandBadge network={bundle.network} size="xs" />

          {/* Amount */}
          <span className="text-base sm:text-lg font-black text-white tracking-tight group-hover:text-[#00c365] transition-colors shrink-0">
            {bundle.dataAmount}
          </span>

          {/* Promo badge */}
          {bundle.isBestValue && (
            <span className="text-[9px] font-bold text-[#00c365] bg-[#00c365]/10 border border-[#00c365]/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
              Value
            </span>
          )}
          {!bundle.isBestValue && bundle.isPopular && (
            <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
              Popular
            </span>
          )}
        </div>

        {/* Price prominently at top right */}
        <div className="text-right shrink-0">
          <span className="text-base sm:text-lg font-extrabold text-white tabular-nums tracking-tight">
            GH₵{bundle.priceGhc.toFixed(2)}
          </span>
        </div>
      </div>

      {/* ROW 2: Short delivery & status line */}
      <div className="my-2">
        {bundle.network === 'airteltigo' ? (
          <div className="flex items-center gap-1 text-[11px] text-amber-300 font-medium">
            <Zap className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
            <span className="truncate">Instant Delivery · Direct SIM Credit</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <CheckCircle2 className="w-3 h-3 text-[#00c365] shrink-0" />
            <span className="truncate">In Stock · Direct SIM Credit</span>
          </div>
        )}
      </div>

      {/* ROW 3: Compact Recipient Input + Action CTA in one unified row */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <input
            ref={phoneInputRef}
            id={`card-phone-${bundle.id}`}
            type="tel"
            value={recipientPhone}
            aria-label="Recipient phone number"
            onChange={(e) => {
              const val = e.target.value.replace(/[^\d\s]/g, '');
              onPhoneChange?.(val);
            }}
            placeholder="024 XXX XXXX"
            className="w-full bg-[#0a0e12] border border-slate-700/80 rounded-xl px-2.5 py-1.5 sm:py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365] focus:ring-1 focus:ring-[#00c365] transition-colors"
          />
        </div>

        <button
          type="button"
          onClick={handleReviewOrder}
          aria-label={`Review order for ${bundle.dataAmount} ${bundle.network.toUpperCase()} bundle`}
          className="shrink-0 py-1.5 sm:py-2 px-2.5 sm:px-3.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs tracking-wider transition-all shadow-[0_0_12px_rgba(0,195,101,0.2)] active:scale-[0.98] flex items-center justify-center gap-1 cursor-pointer"
        >
          <span className="inline min-[360px]:hidden">Buy</span>
          <span className="hidden min-[360px]:inline min-[480px]:hidden">Review</span>
          <span className="hidden min-[480px]:inline">Review Order</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    </div>
  );
};
