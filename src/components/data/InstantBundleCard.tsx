import React, { useState, useRef } from 'react';
import { PublicInstantBundle } from '../../services/apiClient';
import { GHANA_NETWORKS } from '../../data/bundles';
import { ArrowRight, Zap, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

interface InstantBundleCardProps {
  product: PublicInstantBundle;
  recipientPhone: string;
  onPhoneChange: (phone: string) => void;
  onBuy: (product: PublicInstantBundle, options?: { recipientPhone?: string; flexiAmount?: number }) => void;
}

export const InstantBundleCard: React.FC<InstantBundleCardProps> = ({
  product,
  recipientPhone,
  onPhoneChange,
  onBuy,
}) => {
  const network = GHANA_NETWORKS[product.network] || GHANA_NETWORKS.mtn;
  const inputRef = useRef<HTMLInputElement>(null);
  const [flexiAmount, setFlexiAmount] = useState<string>(
    product.isFlexi && product.minAmountGhc ? String(product.minAmountGhc) : '10'
  );
  const [flexiError, setFlexiError] = useState<string>('');

  const isOutOfStock = product.availability === 'out_of_stock';

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking on non-interactive elements, focus the recipient phone input
    const target = e.target as HTMLElement;
    if (!target.closest('input') && !target.closest('button')) {
      inputRef.current?.focus();
    }
  };

  const handleBuyClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (product.isFlexi) {
      const numAmount = parseFloat(flexiAmount);
      const min = product.minAmountGhc || 1;
      const max = product.maxAmountGhc || 500;

      if (isNaN(numAmount) || numAmount <= 0) {
        setFlexiError('Please enter a valid amount.');
        return;
      }
      if (numAmount < min) {
        setFlexiError(`Minimum amount is GH₵${min}.`);
        return;
      }
      if (numAmount > max) {
        setFlexiError(`Maximum amount is GH₵${max}.`);
        return;
      }
      setFlexiError('');
      onBuy(product, { recipientPhone: recipientPhone.trim(), flexiAmount: numAmount });
    } else {
      onBuy(product, { recipientPhone: recipientPhone.trim() });
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative rounded-2xl bg-[#0f151b] border transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between text-left cursor-pointer shadow-sm hover:shadow-md ${
        isOutOfStock
          ? 'opacity-60 border-slate-800 pointer-events-none'
          : 'border-slate-800 hover:border-amber-500/50 hover:bg-[#111822]'
      }`}
    >
      {/* Top Row: Network & Instant Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm"
            style={{
              backgroundColor: network.brandColor,
              color: product.network === 'mtn' ? '#000' : '#fff',
            }}
          >
            {product.network === 'mtn' ? 'MTN' : product.network === 'telecel' ? 'Telecel' : 'AT'}
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-slate-300 block truncate">
              {network.name}
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              {product.validity || 'Instant Direct'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full shadow-sm">
            <Zap className="w-3 h-3 fill-amber-400" />
            <span>Instant</span>
          </span>
        </div>
      </div>

      {/* Main Bundle Size & Product Title */}
      <div className="my-3 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-none group-hover:text-amber-400 transition-colors">
            {product.dataAmount || product.name}
          </span>
          {product.isFlexi && (
            <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded">
              Flexi
            </span>
          )}
        </div>
        <p className="text-[11px] sm:text-xs text-slate-400 leading-snug line-clamp-2">
          {product.description || product.name}
        </p>
      </div>

      {/* Flexi Amount Input (If applicable) */}
      {product.isFlexi && (
        <div className="mb-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Amount (GH₵)</span>
            <span className="text-[10px] text-slate-500">
              Min {product.minAmountGhc || 1} · Max {product.maxAmountGhc || 500}
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              GH₵
            </span>
            <input
              type="number"
              value={flexiAmount}
              onChange={(e) => {
                setFlexiAmount(e.target.value);
                if (flexiError) setFlexiError('');
              }}
              min={product.minAmountGhc || 1}
              max={product.maxAmountGhc || 500}
              step="1"
              placeholder="10"
              className="w-full bg-[#080d11] border border-slate-700/80 focus:border-amber-500/80 rounded-xl pl-10 pr-3 py-1.5 text-sm font-semibold text-white focus:outline-none transition-colors"
            />
          </div>
          {flexiError && (
            <p className="text-[10px] text-rose-400 flex items-center gap-1 mt-0.5">
              <AlertCircle className="w-3 h-3" />
              <span>{flexiError}</span>
            </p>
          )}
        </div>
      )}

      {/* Recipient Phone Input */}
      <div className="space-y-1.5 mb-3.5">
        <label className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
          <span>Recipient number</span>
          <span className="text-[10px] text-slate-500">Ghana SIM</span>
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            value={recipientPhone}
            onChange={(e) => {
              const clean = e.target.value.replace(/[^\d\s]/g, '');
              onPhoneChange(clean);
            }}
            placeholder="024 XXX XXXX"
            className="w-full bg-[#080d11] border border-slate-700/80 focus:border-amber-500/80 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-white placeholder-slate-600 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Footer: Price & Review Order Button */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
            {product.isFlexi ? 'Estimated' : 'Price'}
          </div>
          <div className="text-base sm:text-lg font-extrabold text-[#00c365] tabular-nums leading-none mt-0.5">
            GH₵{product.retailPriceGhc.toFixed(2)}
          </div>
        </div>

        <button
          type="button"
          onClick={handleBuyClick}
          disabled={isOutOfStock}
          className="py-2 px-3.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] active:bg-[#00b05b] text-black font-bold text-xs tracking-wide transition-all shadow-[0_0_15px_rgba(0,195,101,0.2)] active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>Review Order</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
