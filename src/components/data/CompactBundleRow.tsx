import { dataValidityLabel } from '../../utils/dataPurchasePresentation';
import React from 'react';
import { DataBundle } from '../../types';
import { GHANA_NETWORKS } from '../../data/bundles';
import { NetworkBrandBadge } from '../common/NetworkBrandBadge';
import { ArrowRight } from 'lucide-react';
import { welcomePriceForBundle, type WelcomeOffer } from '../../utils/welcomeOfferPresentation';
import { WelcomeBundlePrice } from './WelcomeBundlePrice';

interface CompactBundleRowProps {
  bundle: DataBundle;
  onBuy: (bundle: DataBundle) => void;
  directWelcomeOffer?: WelcomeOffer | null;
}

export const CompactBundleRow: React.FC<CompactBundleRowProps> = ({
  bundle,
  onBuy,
  directWelcomeOffer,
}) => {
  const welcomePrice = welcomePriceForBundle(bundle, directWelcomeOffer);
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
      aria-label={`Buy ${bundle.dataAmount} ${network.name} data${welcomePrice ? '. '+welcomePrice.description : ` for GH₵${bundle.priceGhc.toFixed(2)}`}`}
      className="group relative rounded-2xl border border-slate-800/90 hover:border-[#00c365]/50 bg-[#0e141a] hover:bg-[#111922] transition-colors duration-150 p-3 sm:p-3.5 flex items-center justify-between gap-2.5 sm:gap-3 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365] active:bg-[#131d26]"
    >
      {/* Left: Network logo & Data Details */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <NetworkBrandBadge network={bundle.network} size="sm" />

        <div className="min-w-0 flex-1">
          {/* Top Line: Size + Single Dominant Badge */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="font-extrabold text-lg text-white tracking-tight shrink-0">
              {bundle.dataAmount}
            </span>

            {/* Dominant Promotional Badge: responsive text to prevent narrow-screen collision */}
            {welcomePrice ? null : isAirtelTigo ? (
              <span className="hidden min-[360px]:inline-flex text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded shrink-0">
                AT<span className="hidden sm:inline"> Data</span>
              </span>
            ) : bundle.isBestValue ? (
              <span className="hidden min-[360px]:inline-flex text-[10px] font-bold text-[#00c365] bg-[#00c365]/10 border border-[#00c365]/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                Best Value
              </span>
            ) : bundle.isPopular ? (
              <span className="hidden min-[360px]:inline-flex text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                Popular
              </span>
            ) : null}
          </div>

          <p className="text-xs text-slate-300 mt-0.5">{network.name}{dataValidityLabel(bundle.validity) && ` · ${dataValidityLabel(bundle.validity)}`}</p>
        </div>
      </div>

      {/* Right: Price & Visual Buy Indicator (Not a nested button) */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {welcomePrice ? <WelcomeBundlePrice price={welcomePrice} /> : <div className="text-right">
          <div className="text-base min-[360px]:text-lg sm:text-xl font-extrabold text-white tabular-nums tracking-tight">
            GH₵{bundle.priceGhc.toFixed(2)}
          </div>
        </div>}

        <span
          aria-hidden="true"
          className="min-h-11 px-2.5 min-[360px]:px-3.5 rounded-xl border border-[#00c365]/40 bg-[#00c365]/10 text-[#44df95] group-hover:bg-[#00c365] group-hover:border-[#00c365] group-hover:text-[#03160c] group-focus-visible:bg-[#00c365] group-focus-visible:text-[#03160c] font-bold text-sm transition-colors flex items-center justify-center gap-1 shrink-0"
        >
          <span>Buy</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
};
