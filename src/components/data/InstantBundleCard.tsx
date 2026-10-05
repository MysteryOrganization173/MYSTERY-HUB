import React, { useState, useRef } from 'react';
import { PublicInstantBundle } from '../../services/apiClient';
import { GHANA_NETWORKS } from '../../data/bundles';
import { NetworkBrandBadge } from '../common/NetworkBrandBadge';
import { getInstantBundlePresentation } from '../../utils/instantBundleUtils';
import { ArrowRight, Zap, AlertCircle, ShieldAlert } from 'lucide-react';

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
  const info = getInstantBundlePresentation(product);
  const cardKey = product.productKey || product.packageId;

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

  // Card theme adjustments based on category
  const cardBorderClass = info.isMidnight
    ? 'border-amber-500/30 hover:border-amber-400 bg-gradient-to-b from-[#13131f] to-[#0d0f14]'
    : info.isVideo
    ? 'border-indigo-500/25 hover:border-indigo-400 bg-gradient-to-b from-[#0f141f] to-[#0d1015]'
    : info.isIdd
    ? 'border-emerald-500/25 hover:border-emerald-400 bg-gradient-to-b from-[#0e1715] to-[#0d1015]'
    : 'border-slate-800 hover:border-amber-500/50 hover:bg-[#111822] bg-[#0f151b]';

  return (
    <div
      onClick={handleCardClick}
      className={`group relative rounded-2xl border transition-all duration-200 p-3.5 sm:p-4.5 flex flex-col justify-between text-left cursor-pointer shadow-sm hover:shadow-md ${cardBorderClass} ${
        isOutOfStock ? 'opacity-60 pointer-events-none' : ''
      }`}
    >
      {/* 1. Header: Network & Instant Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <NetworkBrandBadge network={product.network} size="sm" />
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-200 block truncate">
              {network.name}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span
                className={`text-[11px] font-semibold flex items-center gap-1 truncate ${
                  info.isMidnight
                    ? 'text-amber-300'
                    : info.isVideo
                    ? 'text-indigo-300'
                    : info.isSocial
                    ? 'text-sky-300'
                    : info.isIdd
                    ? 'text-emerald-300'
                    : 'text-slate-400'
                }`}
              >
                {info.badgeEmoji && <span>{info.badgeEmoji}</span>}
                <span>{info.categoryLabel}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 sm:px-2 py-0.5 rounded-full shadow-sm">
            <Zap className="w-3 h-3 fill-amber-400" />
            <span>Instant</span>
          </span>
        </div>
      </div>

      {/* 2. Main Product Amount / Minutes & Restriction Badge */}
      <div className="my-2.5 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none group-hover:text-amber-400 transition-colors">
            {info.formattedAmount}
          </span>
          {product.isFlexi && (
            <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded shrink-0">
              Flexi
            </span>
          )}
        </div>

        {/* Safety restriction / category info badge */}
        {info.restrictionNote && (
          <div
            className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-md border leading-tight ${
              info.isMidnight
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : info.isVideo
                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                : info.isSocial
                ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                : info.isIdd
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {info.isMidnight ? (
              <ShieldAlert className="w-3 h-3 shrink-0 text-amber-400" />
            ) : null}
            <span>{info.restrictionNote}</span>
          </div>
        )}

        {/* Validity */}
        <div className="text-[11px] text-slate-400 font-medium">
          {product.validity ? `Validity: ${product.validity}` : 'Immediate Automated SIM Credit'}
        </div>
      </div>

      {/* 3. Flexi Custom Amount Input or Fixed Details */}
      {product.isFlexi ? (
        <div className="space-y-1 pt-1.5 border-t border-slate-800/60" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between text-[11px]">
            <label htmlFor={`flexi-amt-${cardKey}`} className="font-semibold text-slate-300">
              Custom Amount (GH₵)
            </label>
            <span className="text-slate-400 text-[10px]">
              Min: {product.minAmountGhc || 1} - Max: {product.maxAmountGhc || 500}
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
              GH₵
            </span>
            <input
              id={`flexi-amt-${cardKey}`}
              type="number"
              min={product.minAmountGhc || 1}
              max={product.maxAmountGhc || 500}
              value={flexiAmount}
              onChange={(e) => {
                setFlexiAmount(e.target.value);
                setFlexiError('');
              }}
              placeholder="10"
              className="w-full bg-[#0a0e12] border border-slate-700/80 rounded-xl pl-10 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
          </div>
          {flexiError && (
            <p className="text-[10px] text-rose-400 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{flexiError}</span>
            </p>
          )}
        </div>
      ) : null}

      {/* 4. Quick Recipient Number */}
      <div className="pt-1.5 border-t border-slate-800/60" onClick={(e) => e.stopPropagation()}>
        <label
          htmlFor={`instant-phone-${cardKey}`}
          className="text-[10px] sm:text-[11px] font-semibold text-slate-300 block mb-0.5"
        >
          Recipient number
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            id={`instant-phone-${cardKey}`}
            type="tel"
            value={recipientPhone}
            onChange={(e) => {
              const val = e.target.value.replace(/[^\d\s]/g, '');
              onPhoneChange(val);
            }}
            placeholder="024 XXX XXXX"
            className="w-full bg-[#0a0e12] border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
          />
        </div>
      </div>

      {/* 5. Pricing & Action CTA */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <div className="flex flex-col text-left">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium">
              {product.isFlexi ? 'Selected Value' : 'Bundle Price'}
            </span>
            {Boolean(product.savingsOnProductGhc && product.savingsOnProductGhc > 0) && product.networkReferencePriceGhc && (
              <span className="text-[10px] text-slate-500 line-through">
                MTN: GH₵{product.networkReferencePriceGhc.toFixed(2)}
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-lg sm:text-xl font-extrabold text-white tabular-nums tracking-tight">
              {product.isFlexi
                ? `GH₵${(parseFloat(flexiAmount) || 0).toFixed(2)}`
                : `GH₵${product.retailPriceGhc.toFixed(2)}`}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleBuyClick}
          disabled={isOutOfStock}
          className={`w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] ${
            isOutOfStock
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : info.isMidnight
              ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-[0_0_15px_rgba(251,191,36,0.25)] hover:shadow-[0_0_20px_rgba(251,191,36,0.35)]'
              : 'bg-[#00c365] hover:bg-[#00e575] text-black shadow-[0_0_15px_rgba(0,195,101,0.25)] hover:shadow-[0_0_20px_rgba(0,195,101,0.35)]'
          }`}
        >
          <span>{isOutOfStock ? 'Out of Stock' : 'Review Order'}</span>
          {!isOutOfStock && <ArrowRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
