import React from 'react';
import { ShoppingBag, MessageCircle, Clock, Gift, ChevronRight } from 'lucide-react';
import type { MarketplaceProduct } from '../../types';
import { ProductPhoto } from './MarketplaceMedia';
import { purchasableOptions } from '../../../shared/marketplaceVariants';
import {
  PATH_LABELS, cardSpecLine, categoryIconKey, fulfilmentHint, productPath, productPriceText, referralRewardGhc, marketplaceHref,
} from '../../utils/marketplaceBrowse';

// The purchase method is the card's most important fact after price, so each path has a distinct, consistent chip.
const PATH_CHIP = {
  buy: { icon: ShoppingBag, className: 'bg-[#00c365] text-black' },
  enquire: { icon: MessageCircle, className: 'bg-sky-400/12 text-sky-200 ring-1 ring-inset ring-sky-400/35' },
  coming_soon: { icon: Clock, className: 'bg-slate-700/40 text-slate-300 ring-1 ring-inset ring-slate-600' },
} as const;
const SHORT_PATH = { buy: 'Buy online', enquire: 'Enquire', coming_soon: 'Coming soon' } as const;

/** Admin badge copy is free text; only short labels fit a card. */
export function compactBadge(badge: string | undefined): string | null {
  const trimmed = badge?.trim();
  return trimmed && trimmed.length <= 18 ? trimmed : null;
}

interface Props {
  product: MarketplaceProduct;
  highlighted?: boolean;
  priority?: boolean;
  onOpen: (product: MarketplaceProduct) => void;
  onShareEarn: (product: MarketplaceProduct) => void;
  formatGhc: (value: number) => string;
}

export const MarketplaceProductCard: React.FC<Props> = ({ product: p, highlighted, priority, onOpen, onShareEarn, formatGhc }) => {
  const path = productPath(p);
  const chip = PATH_CHIP[path];
  const ChipIcon = chip.icon;
  const spec = cardSpecLine(p);
  const hint = fulfilmentHint(p);
  const reward = referralRewardGhc(p);
  const optionCount = purchasableOptions(p.variants).length;
  const badge = compactBadge(p.badge) || (p.featured ? 'Featured' : null);
  // Only non-default availability earns an image label; "Available" on every card is noise.
  const status = p.availability === 'available' ? null : p.availabilityLabel;
  const titleId = `marketplace-product-title-${p.id}`;

  return (
    <article
      id={`marketplace-product-${p.id}`}
      aria-labelledby={titleId}
      className={`group relative flex flex-col rounded-2xl bg-[#0f151b] border overflow-hidden transition-[border-color,transform,box-shadow] duration-200 motion-safe:has-[a:active]:scale-[0.985] hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] ${
        highlighted ? 'border-[#00c365] ring-2 ring-[#00c365]/50 ring-offset-2 ring-offset-[#070b0e]' : 'border-slate-800 hover:border-slate-600'
      }`}
    >
      <div className={`relative w-full aspect-[4/5] ${path === 'coming_soon' ? 'opacity-75 saturate-50' : ''}`}>
        <ProductPhoto
          src={p.imageUrl}
          alt={p.imageAlt || p.name}
          iconKey={categoryIconKey(p.category, p.categoryLabel)}
          framing={p.imageFraming}
          widths={[240, 360, 480, 640]}
          sizes="(min-width: 1280px) 290px, (min-width: 768px) 30vw, 48vw"
          priority={priority}
          className="transition-transform duration-300 motion-safe:group-hover:scale-[1.02]"
        />
        {status && (
          <span className="absolute bottom-2 left-2 text-[10px] sm:text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-[#0b1116]/85 text-slate-100 backdrop-blur-sm">
            {status}
          </span>
        )}
        {badge && (
          <span className="absolute top-2 left-2 max-w-[70%] truncate text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-[#0b1116]/85 text-[#00e575] backdrop-blur-sm">
            {badge}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col px-2.5 pt-2.5 pb-2.5 sm:px-3.5 sm:pt-3 sm:pb-3 text-left">
        <h3 id={titleId} className="font-semibold text-[13px] sm:text-[15px] text-white leading-snug line-clamp-2">
          {/* Stretched link: the whole card opens the product, and long-press offers the real URL. */}
          <a
            href={marketplaceHref({ product: p.slug || p.id })}
            onClick={e => { e.preventDefault(); onOpen(p); }}
            className="after:absolute after:inset-0 after:content-[''] after:rounded-2xl focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[#00c365]"
          >
            {p.name}
          </a>
        </h3>
        {spec && <p className="mt-0.5 text-[11px] sm:text-xs text-slate-400 line-clamp-1">{spec}</p>}

        <div className="pt-2">
          <p className={`tabular-nums tracking-tight leading-tight ${p.priceType === 'quote' ? 'text-[13px] sm:text-sm font-semibold text-slate-200' : 'text-[15px] sm:text-lg font-extrabold text-white'}`}>
            {productPriceText(p)}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] sm:text-[11px] font-bold shrink-0 ${chip.className}`} title={PATH_LABELS[path]}>
              <ChipIcon className="w-3 h-3" aria-hidden="true" />
              {SHORT_PATH[path]}
            </span>
            {optionCount > 1 ? (
              <span className="text-[10.5px] sm:text-[11px] text-slate-400 truncate">{optionCount} options</span>
            ) : hint && path !== 'coming_soon' && <span className="hidden sm:inline text-[11px] text-slate-400 truncate">{hint}</span>}
            <ChevronRight className="ml-auto w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0 hidden sm:block" aria-hidden="true" />
          </div>
        </div>
      </div>

      {reward !== null && (
        <button
          type="button"
          data-mh-share-earn
          onClick={() => onShareEarn(p)}
          className="relative z-10 flex items-center justify-center gap-1.5 min-h-[38px] px-2 border-t border-slate-800 bg-amber-400/[0.06] hover:bg-amber-400/[0.12] text-amber-300 text-[11px] sm:text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
          aria-label={`Share ${p.name} and earn GH₵${formatGhc(reward)}`}
        >
          <Gift className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Share &amp; earn GH₵{formatGhc(reward)}</span>
        </button>
      )}
    </article>
  );
};
