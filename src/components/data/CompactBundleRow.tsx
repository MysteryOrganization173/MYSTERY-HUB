import { dataValidityLabel } from '../../utils/dataPurchasePresentation';
import React from 'react';
import { DataBundle } from '../../types';
import { GHANA_NETWORKS } from '../../data/bundles';
import { NetworkBrandBadge } from '../common/NetworkBrandBadge';
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
        <NetworkBrandBadge network={bundle.network} size="sm" />

        <div className="min-w-0 flex-1">
          {/* Top Line: Size + Single Dominant Badge */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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

          <p className="text-xs text-slate-300 mt-0.5">{network.name}{dataValidityLabel(bundle.validity) && ` · ${dataValidityLabel(bundle.validity)}`}</p>
        </div>
      </div>

      {/* Right: Price & Visual Buy Indicator (Not a nested button) */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="text-right">
          <div className="text-[10px] text-slate-400 font-medium hidden xs:block">Price</div>
          <div className="text-lg sm:text-xl font-extrabold text-white tabular-nums tracking-tight">
            GH₵{bundle.priceGhc.toFixed(2)}
          </div>
        </div>

        <span
          aria-hidden="true"
          className="min-h-11 px-3 sm:px-4 rounded-xl bg-[#00c365] group-hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1 shrink-0"
        >
          <span>Buy</span>
          <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </div>
  );
};
