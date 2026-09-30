import React from 'react';
import { DataBundle } from '../../types';
import { GHANA_NETWORKS } from '../../data/bundles';
import { ArrowRight, Check } from 'lucide-react';

interface CompactBundleRowProps {
  bundle: DataBundle;
  isSelected?: boolean;
  onSelect?: (bundle: DataBundle) => void;
  onBuy: (bundle: DataBundle) => void;
}

export const CompactBundleRow: React.FC<CompactBundleRowProps> = ({
  bundle,
  isSelected = false,
  onSelect,
  onBuy,
}) => {
  const network = GHANA_NETWORKS[bundle.network];

  return (
    <div
      onClick={() => onSelect?.(bundle)}
      className={`group relative rounded-xl border transition-all duration-150 p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer ${
        isSelected
          ? 'bg-[#121c17] border-[#00c365] shadow-[0_0_15px_rgba(0,195,101,0.15)] ring-1 ring-[#00c365]'
          : 'bg-[#0e141a] border-slate-800 hover:border-slate-700 hover:bg-[#111820]'
      }`}
    >
      {/* Left: Network dot & Data Amount */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 shadow-sm"
          style={{
            backgroundColor: network.brandColor,
            color: bundle.network === 'mtn' ? '#000' : '#fff',
          }}
        >
          {bundle.network === 'mtn' ? 'MTN' : bundle.network === 'telecel' ? 't' : 'AT'}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base sm:text-lg text-white tracking-tight group-hover:text-[#00c365] transition-colors">
              {bundle.dataAmount}
            </span>
            {bundle.isBestValue && (
              <span className="text-[10px] font-bold text-[#00c365] bg-[#00c365]/10 border border-[#00c365]/30 px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">
                Best Value
              </span>
            )}
            {!bundle.isBestValue && bundle.isPopular && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">
                Popular
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {bundle.description || 'Direct SIM credit'}
          </p>
        </div>
      </div>

      {/* Right: Price & Buy Button */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="text-xs text-slate-400 hidden xs:block">Price</div>
          <div className="text-base sm:text-lg font-extrabold text-white tabular-nums tracking-tight">
            GH₵{bundle.priceGhc.toFixed(2)}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBuy(bundle);
          }}
          className="h-9 px-3.5 sm:px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_12px_rgba(0,195,101,0.2)] active:scale-95 flex items-center justify-center gap-1 cursor-pointer shrink-0"
        >
          <span>Buy</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
