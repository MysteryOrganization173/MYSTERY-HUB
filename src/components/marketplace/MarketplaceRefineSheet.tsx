import React from 'react';
import { X, Check } from 'lucide-react';
import type { MarketplaceProduct } from '../../types';
import { useMarketplaceDialog } from './useMarketplaceDialog';
import {
  KIND_LABELS, PRICE_BANDS, MarketplaceBrowseState, MarketplaceKindFilter, applyRefinements, productKind, productPath, productPriceMinor,
} from '../../utils/marketplaceBrowse';

interface Props {
  products: MarketplaceProduct[]; // whole catalogue
  state: MarketplaceBrowseState;
  onChange: (patch: Partial<MarketplaceBrowseState>) => void;
  onClose: () => void;
}

const Option: React.FC<{ selected: boolean; disabled?: boolean; onClick: () => void; label: string; count: number }> = ({ selected, disabled, onClick, label, count }) => (
  <button
    type="button"
    aria-pressed={selected}
    disabled={disabled}
    onClick={onClick}
    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${
      selected ? 'border-[#00c365] bg-[#00c365]/12 text-white' : 'border-slate-700 bg-[#0b1116] text-slate-200 hover:border-slate-500'
    }`}
  >
    <span className="flex items-center gap-2 min-w-0">
      <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${selected ? 'bg-[#00c365] border-[#00c365] text-black' : 'border-slate-600'}`}>
        {selected && <Check className="w-3 h-3" aria-hidden="true" />}
      </span>
      <span className="truncate">{label}</span>
    </span>
    <span className="text-xs text-slate-400 tabular-nums shrink-0">{count}</span>
  </button>
);

/**
 * One calm place for every refinement. Options only appear when they would
 * actually split the catalogue, so a small catalogue gets a short sheet.
 */
export function refineAvailability(products: MarketplaceProduct[]) {
  const buyable = products.filter(p => productPath(p) === 'buy').length;
  const kinds = (Object.keys(KIND_LABELS) as MarketplaceKindFilter[]).filter(k => products.some(p => productKind(p) === k));
  const bands = PRICE_BANDS.filter(b => products.some(p => { const price = productPriceMinor(p); return price !== null && price >= b.min && price < b.max; }));
  return { buy: buyable > 0 && buyable < products.length, kinds: kinds.length > 1 ? kinds : [], bands: bands.length > 1 ? bands : [] };
}

export const MarketplaceRefineSheet: React.FC<Props> = ({ products, state, onChange, onClose }) => {
  const ref = useMarketplaceDialog(true, onClose);
  // Offer only what splits the current category/search, so options never lead to dead ends.
  const offered = refineAvailability(applyRefinements(products, state, ['buy', 'kind', 'price']));
  const results = applyRefinements(products, state).length;
  const count = (patch: Partial<MarketplaceBrowseState>, skip: 'buy' | 'kind' | 'price') => applyRefinements(products, { ...state, ...patch }, [skip]).length;

  return (
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mh-refine-title"
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[85vh] flex flex-col bg-[#0c1218] border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-3xl shadow-2xl text-slate-100"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <h2 id="mh-refine-title" className="text-base font-bold text-white">Refine products</h2>
          <button type="button" onClick={onClose} aria-label="Close refine options" className="p-2 -mr-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {offered.buy && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">How to get it</legend>
              <Option selected={state.buyOnline} onClick={() => onChange({ buyOnline: !state.buyOnline })} label="Buy online now" count={count({ buyOnline: true }, 'buy')} />
              <p className="text-xs text-slate-500 leading-relaxed">Other items are ordered by enquiry: we confirm price and availability with you first.</p>
            </fieldset>
          )}
          {offered.kinds.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Product type</legend>
              <div className="grid gap-2">
                {offered.kinds.map(kind => {
                  const n = count({ kind }, 'kind');
                  return <Option key={kind} selected={state.kind === kind} disabled={!n && state.kind !== kind} onClick={() => onChange({ kind: state.kind === kind ? '' : kind })} label={KIND_LABELS[kind]} count={n} />;
                })}
              </div>
            </fieldset>
          )}
          {offered.bands.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Price</legend>
              <div className="grid grid-cols-2 gap-2">
                {offered.bands.map(band => {
                  const n = count({ price: band.id }, 'price');
                  return <Option key={band.id} selected={state.price === band.id} disabled={!n && state.price !== band.id} onClick={() => onChange({ price: state.price === band.id ? '' : band.id })} label={band.label} count={n} />;
                })}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">Uses the lowest listed price. Price-on-request items are hidden while a price range is on.</p>
            </fieldset>
          )}
          {!offered.buy && !offered.kinds.length && !offered.bands.length && (
            <p className="text-sm text-slate-400">The catalogue is small right now, so there is nothing more to narrow. Try a category or search instead.</p>
          )}
        </div>
        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-800 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0">
          <button type="button" onClick={() => onChange({ buyOnline: false, kind: '', price: '' })} className="px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 hover:text-white">
            Reset
          </button>
          <button type="button" data-marketplace-primary onClick={onClose} className="flex-1 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black text-sm font-extrabold transition-colors active:scale-[0.98]">
            Show {results} {results === 1 ? 'product' : 'products'}
          </button>
        </div>
      </div>
    </div>
  );
};
