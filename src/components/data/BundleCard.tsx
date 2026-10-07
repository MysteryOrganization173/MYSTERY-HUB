import { dataValidityLabel } from '../../utils/dataPurchasePresentation';
import React, { useRef } from 'react';
import { websiteActionText } from '../../utils/websiteBrand';
import { DataBundle, WebsiteTemplate } from '../../types';
import { GHANA_NETWORKS } from '../../data/bundles';
import { NetworkBrandBadge } from '../common/NetworkBrandBadge';
import { ArrowRight } from 'lucide-react';

interface BundleCardProps {
  bundle: DataBundle;
  recipientPhone?: string;
  onPhoneChange?: (phone: string) => void;
  onBuy: (bundle: DataBundle, options?: { recipientPhone?: string }) => void;
  featured?: boolean;
  colorScheme?: WebsiteTemplate['colorScheme'];
}

export const BundleCard: React.FC<BundleCardProps> = ({
  bundle,
  recipientPhone = '',
  onPhoneChange,
  onBuy,
  featured = false,
  colorScheme,
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
      style={colorScheme ? {backgroundColor:colorScheme.surface,borderColor:colorScheme.border,color:colorScheme.text,'--website-accent':colorScheme.accent} as React.CSSProperties : undefined}
      className={`relative rounded-2xl bg-[#0f151b] border transition-all duration-200 p-3 sm:p-4 flex flex-col justify-between group cursor-pointer ${colorScheme ? 'hover:brightness-110' : 'hover:border-[#00c365]/40'} ${
        colorScheme ? '' : featured || bundle.isBestValue
          ? 'border-[#00c365]/60'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* ROW 1: Network badge + Data Amount + Promo Tag + Price */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
          <NetworkBrandBadge network={bundle.network} size="xs" />

          {/* Amount */}
          <span style={colorScheme?{color:colorScheme.text}:undefined} className={`text-base sm:text-lg font-black tracking-tight transition-colors shrink-0 ${colorScheme?'':'text-white group-hover:text-[#00c365]'}`}>
            {bundle.dataAmount}
          </span>

          {/* Promo badge */}
          {bundle.isBestValue && (
            <span style={colorScheme?{color:colorScheme.accent,borderColor:colorScheme.accent}:undefined} className={`text-[9px] font-bold border px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${colorScheme?'':'text-[#00c365] bg-[#00c365]/10 border-[#00c365]/30'}`}>
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
          <span style={colorScheme?{color:colorScheme.text}:undefined} className="text-xl font-extrabold text-white tabular-nums tracking-tight">
            GH₵{bundle.priceGhc.toFixed(2)}
          </span>
        </div>
      </div>

      {/* ROW 2: Existing validity and centrally configured delivery information */}
      <div className="my-2 text-xs leading-relaxed">
        <p style={colorScheme?{color:colorScheme.mutedText}:undefined} className="text-slate-300">{network.name}{dataValidityLabel(bundle.validity) && ` · ${dataValidityLabel(bundle.validity)}`}</p>
      </div>

      {/* ROW 3: Compact Recipient Input + Action CTA in one unified row */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <input
            ref={phoneInputRef}
            id={`card-phone-${bundle.id}`}
            type="tel"
            inputMode="tel"
            value={recipientPhone}
            aria-label="Recipient phone number"
            onChange={(e) => {
              const val = e.target.value.replace(/[^\d\s]/g, '');
              onPhoneChange?.(val);
            }}
            placeholder="024 XXX XXXX"
            style={colorScheme?{backgroundColor:colorScheme.background,borderColor:colorScheme.border,color:colorScheme.text}:undefined} className={`w-full border border-slate-700/80 rounded-xl px-2.5 min-h-11 py-2 text-xs placeholder-slate-500 transition-colors ${colorScheme?'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--website-accent)]':'bg-[#0a0e12] text-white focus:outline-none focus:border-[#00c365] focus:ring-1 focus:ring-[#00c365]'}`}
          />
        </div>

        <button
          type="button"
          onClick={handleReviewOrder}
          aria-label={`Review order for ${bundle.dataAmount} ${bundle.network.toUpperCase()} bundle`}
          style={colorScheme?{backgroundColor:colorScheme.accent,color:websiteActionText(colorScheme.accent)}:undefined} className={`shrink-0 min-h-11 py-2 px-2.5 sm:px-3.5 rounded-xl font-bold text-xs tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-1 cursor-pointer ${colorScheme?'hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--website-accent)]':'bg-[#00c365] hover:bg-[#00e575] text-black'}`}
        >
          <span>Buy</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    </div>
  );
};
