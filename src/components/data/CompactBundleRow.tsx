import React from 'react';
import { DataBundle } from '../../types';
import { GHANA_NETWORKS } from '../../data/bundles';
import { ArrowRight } from 'lucide-react';

interface CompactBundleRowProps {
  bundle: DataBundle;
  onBuy: (bundle: DataBundle) => void;
}

export const CompactBundleRow: React.FC<CompactBundleRowProps> = ({
  bundle,
  onBuy,
}) => {
  const network = GHANA_NETWORKS[bundle.network];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onBuy(bundle);
    }
  };

  // Determine single dominant badge for clean hierarchy on narrow viewports (360px-430px)
  const isAirtelTigo = bundle.network === 'airteltigo';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onBuy(bundle)}
      onKeyDown={handleKeyDown}
      aria-label={`Buy ${bundle.dataAmount} ${network.name} data for GH₵${bundle.priceGhc.toFixed(2)}`}
      className="group relative rounded-xl border border-slate-800/90 hover:border-[#00c365]/60 bg-[#0e141a] hover:bg-[#111922] transition-all duration-150 p-3 sm:p-3.5 flex items-center justify-between gap-2.5 sm:gap-3 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365] active:scale-[0.99]"
    >
      {/* Left: Network logo & Data Details */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 shadow-sm"
          style={{
            backgroundColor: network.brandColor,
            color: bundle.network === 'mtn' ? '#000' : '#fff',
          }}
        >
          {bundle.network === 'mtn' ? 'MTN' : bundle.network === 'telecel' ? 't' : 'AT'}
        </div>

        <div className="min-w-0 flex-1">
          {/* Top Line: Size + Single Dominant Badge */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-extrabold text-base sm:text-lg text-white tracking-tight group-hover:text-[#00c365] transition-colors shrink-0">
              {bundle.dataAmount}
            </span>

            {/* Dominant Promotional Badge: responsive text to prevent narrow-screen collision */}
            {isAirtelTigo ? (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded shrink-0">
                ⚡ Instant<span className="hidden sm:inline"> Delivery</span>
              </span>
            ) : bundle.isBestValue ? (
              <span className="text-[10px] font-bold text-[#00c365] bg-[#00c365]/10 border border-[#00c365]/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                Best Value
              </span>
            ) : bundle.isPopular ? (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                Popular
              </span>
            ) : null}
          </div>

          {/* Description line: secondary info gracefully truncated */}
          <p className="text-[11px] text-slate-400 truncate mt-0.5">
            {isAirtelTigo
              ? bundle.isBestValue
                ? 'Best Value · Instant direct delivery to AT'
                : 'Instant direct delivery to your AT number'
              : bundle.description || 'Direct SIM credit'}
          </p>
        </div>
      </div>

      {/* Right: Price & Visual Buy Indicator (Not a nested button) */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="text-right">
          <div className="text-[10px] text-slate-400 font-medium hidden xs:block">Price</div>
          <div className="text-sm sm:text-base md:text-lg font-extrabold text-white tabular-nums tracking-tight">
            GH₵{bundle.priceGhc.toFixed(2)}
          </div>
        </div>

        <span
          aria-hidden="true"
          className="h-9 px-3 sm:px-4 rounded-xl bg-[#00c365] group-hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_12px_rgba(0,195,101,0.2)] group-hover:shadow-[0_0_16px_rgba(0,195,101,0.35)] flex items-center justify-center gap-1 shrink-0"
        >
          <span>Buy</span>
          <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </div>
  );
};
