import React from 'react';
import { DataBundle } from '../../types';
import { GHANA_NETWORKS } from '../../data/bundles';
import { Zap, Check, ArrowRight } from 'lucide-react';

interface BundleCardProps {
  bundle: DataBundle;
  onBuy: (bundle: DataBundle) => void;
  featured?: boolean;
}

export const BundleCard: React.FC<BundleCardProps> = ({ bundle, onBuy, featured = false }) => {
  const network = GHANA_NETWORKS[bundle.network];

  return (
    <div
      className={`relative rounded-2xl bg-[#0f151b] border transition-all duration-200 p-5 flex flex-col justify-between group hover:-translate-y-1 hover:shadow-xl ${
        featured || bundle.isBestValue
          ? 'border-[#00c365]/60 shadow-[0_0_20px_rgba(0,195,101,0.12)]'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Top badges */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {/* Network miniature pill */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: network.brandColor }}
          />
          <span className="text-xs font-semibold text-slate-300">
            {bundle.network === 'mtn' ? 'MTN' : bundle.network === 'telecel' ? 'Telecel' : 'AT'}
          </span>
        </div>

        {bundle.isBestValue && (
          <span className="text-[10px] font-bold text-[#00c365] bg-[#00c365]/10 border border-[#00c365]/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Best Value
          </span>
        )}
        {!bundle.isBestValue && bundle.isPopular && (
          <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Popular
          </span>
        )}
      </div>

      {/* Main Bundle Details */}
      <div className="space-y-1">
        <h3 className="text-2xl font-extrabold text-white tracking-tight group-hover:text-[#00c365] transition-colors">
          {bundle.dataAmount}
        </h3>
        <p className="text-xs text-slate-400 font-medium">
          {bundle.validity}
        </p>
      </div>

      {/* Pricing and Action */}
      <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-400">Price</span>
          <span className="text-xl font-extrabold text-white tabular-nums tracking-tight">
            GH₵{bundle.priceGhc.toFixed(2)}
          </span>
        </div>

        <button
          onClick={() => onBuy(bundle)}
          className="w-full py-2.5 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,195,101,0.25)] active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>Buy Now</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
          <Zap className="w-3 h-3 text-[#00c365]" />
          <span>Instant MoMo Delivery</span>
        </div>
      </div>
    </div>
  );
};
