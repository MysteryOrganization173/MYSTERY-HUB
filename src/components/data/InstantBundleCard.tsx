import React, { useId, useState } from 'react';
import { PublicInstantBundle } from '../../services/apiClient';
import { GHANA_NETWORKS } from '../../data/bundles';
import { NetworkBrandBadge } from '../common/NetworkBrandBadge';
import { getInstantBundlePresentation, type InstantBundleCategoryType } from '../../utils/instantBundleUtils';
import { estimateInstantCheckoutFeeGhc } from '../../utils/instantFee';
import { Money } from '../purchase/Money';
import { useTapFeedback } from '../../hooks/useTapFeedback';
import { ArrowRight, AlertCircle, Moon, Clapperboard, MessageCircle, Globe2, Zap, X } from 'lucide-react';

interface InstantBundleCardProps {
  product: PublicInstantBundle;
  onBuy: (product: PublicInstantBundle, options?: { flexiAmount?: number }) => void;
}

/** Category colour and icon; text always carries the meaning as well. */
export const INSTANT_CATEGORY_TONE: Record<InstantBundleCategoryType, { chip: string; icon: React.ElementType }> = {
  data: { chip: 'text-slate-300 bg-slate-800/80 border-slate-700', icon: Zap },
  video: { chip: 'text-indigo-200 bg-indigo-500/15 border-indigo-400/30', icon: Clapperboard },
  social: { chip: 'text-sky-200 bg-sky-500/15 border-sky-400/30', icon: MessageCircle },
  midnight: { chip: 'text-amber-200 bg-amber-400/15 border-amber-400/35', icon: Moon },
  idd: { chip: 'text-emerald-200 bg-emerald-500/15 border-emerald-400/30', icon: Globe2 },
};

const ghs = (value: number) => `GH₵${value.toFixed(2)}`;

/**
 * Instant Bundles are network packages with their own conditions and a checkout fee on top of the
 * package price. The card states both before the tap; the number is entered once, in checkout.
 */
export const InstantBundleCard: React.FC<InstantBundleCardProps> = ({ product, onBuy }) => {
  const network = GHANA_NETWORKS[product.network] || GHANA_NETWORKS.mtn;
  const info = getInstantBundlePresentation(product);
  const tone = INSTANT_CATEGORY_TONE[info.categoryKey];
  const CategoryIcon = tone.icon;
  const isOutOfStock = product.availability === 'out_of_stock';
  const [tapped, confirmTap] = useTapFeedback();
  const amountId = useId();
  const min = product.minAmountGhc || 1;
  const max = product.maxAmountGhc || 500;
  const [flexiOpen, setFlexiOpen] = useState(false);
  const [flexiAmount, setFlexiAmount] = useState('');
  const [flexiError, setFlexiError] = useState('');
  const fee = product.paymentProcessingFeeGhc;
  const hasReferencePrice = Boolean(product.savingsOnProductGhc && product.savingsOnProductGhc > 0 && product.networkReferencePriceGhc);

  const flexiValue = parseFloat(flexiAmount);
  const flexiValid = Number.isFinite(flexiValue) && flexiValue >= min && flexiValue <= max;
  const flexiFee = flexiValid ? estimateInstantCheckoutFeeGhc(flexiValue) : 0;

  const buyFixed = () => { confirmTap(); onBuy(product); };
  const continueFlexi = () => {
    if (!Number.isFinite(flexiValue) || flexiValue <= 0) return setFlexiError('Enter an amount in cedis.');
    if (flexiValue < min) return setFlexiError(`Minimum amount is GH₵${min}.`);
    if (flexiValue > max) return setFlexiError(`Maximum amount is GH₵${max}.`);
    setFlexiError('');
    confirmTap();
    onBuy(product, { flexiAmount: Number(flexiValue.toFixed(2)) });
  };

  const conditions = (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}>
        <CategoryIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
        {info.restrictionNote || info.categoryLabel}
      </span>
      {product.validity && <span className="text-xs text-slate-400">{product.validity}</span>}
    </div>
  );

  if (product.isFlexi) {
    const presets = [5, 10, 20, 50].filter(value => value >= min && value <= max);
    return (
      <div data-tapped={tapped} className={`rounded-2xl border bg-[#0e141a] p-3.5 sm:p-4 transition-colors ${flexiOpen ? 'border-[#00c365]/50' : 'border-slate-800/90'} ${isOutOfStock ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-3">
          <NetworkBrandBadge network={product.network} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-lg text-white leading-tight">You choose the amount</p>
            <p className="text-xs text-slate-300 mt-0.5">{network.name}</p>
            {conditions}
          </div>
        </div>
        {!flexiOpen ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">From <span className="text-white font-semibold tabular-nums">GH₵{min}</span> to <span className="text-white font-semibold tabular-nums">GH₵{max}</span></p>
            <button type="button" disabled={isOutOfStock} onClick={() => setFlexiOpen(true)}
              aria-label={isOutOfStock ? `Flexi ${network.name} bundle unavailable` : `Choose an amount for Flexi ${network.name} bundle`}
              className="mh-buy min-h-11 px-3.5 rounded-xl border border-[#00c365]/40 bg-[#00c365]/10 text-[#44df95] hover:bg-[#00c365] hover:text-[#03160c] font-bold text-sm inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00c365]">
              {isOutOfStock ? 'Unavailable' : <>Choose amount<ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2.5 border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between">
              <label htmlFor={amountId} className="text-xs font-semibold text-slate-200">Amount <span className="font-normal text-slate-400">(GH₵{min}–GH₵{max})</span></label>
              <button type="button" onClick={() => { setFlexiOpen(false); setFlexiError(''); }} aria-label="Close amount" className="min-w-9 min-h-9 -mr-1.5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400" aria-hidden="true">GH₵</span>
              <input id={amountId} type="text" inputMode="decimal" autoComplete="off" autoFocus value={flexiAmount}
                aria-invalid={Boolean(flexiError)} aria-describedby={`${amountId}-note`}
                onChange={(e) => { setFlexiAmount(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 7)); setFlexiError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); continueFlexi(); } }}
                placeholder="0.00"
                className={`w-full min-h-12 rounded-xl bg-[#090d11] border pl-14 pr-3 text-lg font-bold text-white tabular-nums placeholder-slate-600 focus:outline-none ${flexiError ? 'border-rose-500/80' : 'border-slate-700 focus:border-[#00c365]'}`} />
            </div>
            {presets.length > 0 && <div className="flex gap-1.5" role="group" aria-label="Quick amounts">
              {presets.map(value => <button key={value} type="button" onClick={() => { setFlexiAmount(String(value)); setFlexiError(''); }}
                aria-pressed={flexiValue === value}
                className={`mh-press flex-1 min-h-10 rounded-lg border text-xs font-bold cursor-pointer ${flexiValue === value ? 'border-white bg-white text-[#0b1015]' : 'border-slate-700 text-slate-300 hover:text-white'}`}>GH₵{value}</button>)}
            </div>}
            <p id={`${amountId}-note`} role={flexiError ? 'alert' : undefined} className={`text-xs ${flexiError ? 'text-rose-300 flex items-center gap-1' : 'text-slate-400'}`}>
              {flexiError ? <><AlertCircle className="w-3.5 h-3.5 shrink-0" />{flexiError}</>
                : flexiValid ? <>Bundle {ghs(flexiValue)} + checkout fee about {ghs(flexiFee)}. You see the final total before paying.</>
                : 'The network sets what this amount buys. You see the total before paying.'}
            </p>
            <button type="button" onClick={continueFlexi}
              className="mh-buy w-full min-h-12 rounded-xl bg-[#00c365] hover:bg-[#00e070] text-[#03160c] font-bold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Continue with {flexiValid ? ghs(flexiValue) : 'GH₵ amount'}<ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button type="button" onClick={buyFixed} disabled={isOutOfStock} data-tapped={tapped}
      aria-label={isOutOfStock
        ? `${info.formattedAmount} ${network.name} ${info.categoryLabel} unavailable`
        : `Buy ${info.formattedAmount} ${network.name} ${info.categoryLabel} for ${ghs(product.retailPriceGhc)}${fee ? ` plus ${ghs(fee)} checkout fee` : ''}`}
      className={`mh-press group w-full text-left rounded-2xl border bg-[#0e141a] p-3.5 sm:p-4 flex items-center gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365] disabled:cursor-not-allowed ${
        isOutOfStock ? 'border-slate-800/70 opacity-60' : 'border-slate-800/90 hover:border-[#00c365]/50 hover:bg-[#111922]'}`}>
      <span className="self-start mt-0.5 shrink-0"><NetworkBrandBadge network={product.network} size="sm" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold text-lg text-white tracking-tight leading-tight">{info.formattedAmount}</span>
        <span className="block text-xs text-slate-300 mt-0.5 truncate">{network.name}{info.restrictionNote ? ` · ${info.categoryLabel}` : ''}</span>
        {conditions}
      </span>
      <span className="shrink-0 flex flex-col items-end gap-1.5">
        <span className="text-right">
          <Money ghc={product.retailPriceGhc} text="text-lg min-[360px]:text-xl" />
          {fee ? <span className="block text-[11px] text-slate-400 mt-0.5 tabular-nums">+ {ghs(fee)} fee</span> : null}
          {hasReferencePrice && <span className="block text-[11px] text-slate-500 tabular-nums">Network price {ghs(product.networkReferencePriceGhc!)}</span>}
        </span>
        <span aria-hidden="true" className={`mh-buy min-h-10 px-3 rounded-xl border font-bold text-sm flex items-center gap-1 ${isOutOfStock
          ? 'border-slate-700 bg-slate-800 text-slate-500'
          : 'border-[#00c365]/40 bg-[#00c365]/10 text-[#44df95] group-hover:bg-[#00c365] group-hover:border-[#00c365] group-hover:text-[#03160c] group-focus-visible:bg-[#00c365] group-focus-visible:text-[#03160c]'}`}>
          {isOutOfStock ? 'Unavailable' : <>Buy<ArrowRight className="w-3.5 h-3.5" /></>}
        </span>
      </span>
    </button>
  );
};
