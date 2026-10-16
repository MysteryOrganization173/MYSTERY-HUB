import React from 'react';
import { ShoppingBag, MessageSquare, Clock, Gift, Star } from 'lucide-react';
import type { MarketplaceProduct } from '../../types';
import { OptimizedImage } from '../common/OptimizedImage';
import { CategoryArt } from './MarketplaceCategoryTiles';
import {
  PATH_LABELS, cardSpecLine, categoryIconKey, fulfilmentHint, productPath, productPriceText, referralRewardGhc, marketplaceHref,
} from '../../utils/marketplaceBrowse';

const PATH_STYLE = {
  buy: { icon: ShoppingBag, className: 'text-[#00e575]' },
  enquire: { icon: MessageSquare, className: 'text-sky-300' },
  coming_soon: { icon: Clock, className: 'text-slate-400' },
} as const;

/** Admin badge copy is free text; only short labels fit a card. */
export function compactBadge(badge: string | undefined): string | null {
  const trimmed = badge?.trim();
  return trimmed && trimmed.length <= 18 ? trimmed : null;
}

interface Props {
  product: MarketplaceProduct;
  highlighted?: boolean;
  onOpen: (product: MarketplaceProduct) => void;
  onShareEarn: (product: MarketplaceProduct) => void;
  formatGhc: (value: number) => string;
}

export const MarketplaceProductCard: React.FC<Props> = ({ product: p, highlighted, onOpen, onShareEarn, formatGhc }) => {
  const path = productPath(p);
  const PathIcon = PATH_STYLE[path].icon;
  const spec = cardSpecLine(p);
  const hint = fulfilmentHint(p);
  const reward = referralRewardGhc(p);
  const badge = compactBadge(p.badge) || (p.featured ? 'Featured' : null);
  // Only non-default availability earns an image label; "Available" on every card is noise.
  const status = p.availability === 'available' ? null : p.availabilityLabel;
  const titleId = `marketplace-product-title-${p.id}`;

  return (
    <article
      id={`marketplace-product-${p.id}`}
      aria-labelledby={titleId}
      className={`group relative flex flex-col rounded-2xl bg-[#0f151b] border overflow-hidden transition-[border-color,transform,background-color] duration-200 has-[a:active]:scale-[0.98] ${
        highlighted ? 'border-[#00c365] ring-2 ring-[#00c365]/50 ring-offset-2 ring-offset-[#070b0e]' : 'border-slate-800 hover:border-slate-600 hover:bg-[#121921]'
      }`}
    >
      <div className={`relative w-full aspect-square sm:aspect-[4/3] bg-[#0a0f14] overflow-hidden ${path === 'coming_soon' ? 'opacity-70' : ''}`}>
        <OptimizedImage
          src={p.imageUrl}
          alt={p.imageAlt || p.name}
          objectFit="cover"
          objectPosition="center center"
          responsiveWidths={[240, 360, 480, 640]}
          sizes="(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw"
          fallbackIcon={<CategoryArt iconKey={categoryIconKey(p.category, p.categoryLabel)} />}
          className="transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
        />
        {status && (
          <span className="absolute top-2 left-2 text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md bg-black/75 text-white border border-white/10 backdrop-blur-sm">
            {status}
          </span>
        )}
        {badge && (
          <span className="absolute top-2 right-2 max-w-[55%] truncate inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md bg-[#00c365] text-black">
            {badge === 'Featured' && <Star className="w-2.5 h-2.5 fill-current shrink-0" aria-hidden="true" />}
            <span className="truncate">{badge}</span>
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col p-2.5 sm:p-3.5 gap-1 text-left">
        <h3 id={titleId} className="font-semibold text-[13px] sm:text-sm text-white leading-snug line-clamp-2 min-h-[2.4em]">
          {/* Stretched link: the whole card opens the product, and long-press offers the real URL. */}
          <a
            href={marketplaceHref({ product: p.slug || p.id })}
            onClick={e => { e.preventDefault(); onOpen(p); }}
            className="after:absolute after:inset-0 after:content-[''] after:rounded-2xl focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[#00c365] group-hover:text-[#00e575] transition-colors"
          >
            {p.name}
          </a>
        </h3>
        {spec && <p className="text-[11px] sm:text-xs text-slate-400 truncate">{spec}</p>}
        <p className={`mt-auto pt-1 text-sm sm:text-base font-extrabold tabular-nums tracking-tight truncate ${p.priceType === 'quote' ? 'text-slate-200 text-[13px] sm:text-sm font-bold' : 'text-white'}`}>
          {productPriceText(p)}
        </p>
        <p className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold min-w-0">
          <PathIcon className={`w-3 h-3 shrink-0 ${PATH_STYLE[path].className}`} aria-hidden="true" />
          <span className={`${PATH_STYLE[path].className} shrink-0`}>{PATH_LABELS[path]}</span>
          {hint && path !== 'coming_soon' && <span className="text-slate-500 font-medium truncate hidden min-[400px]:inline">· {hint}</span>}
        </p>
        {reward !== null && (
          <button
            type="button"
            data-mh-share-earn
            onClick={() => onShareEarn(p)}
            className="relative z-10 mt-1.5 w-full px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-colors active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            aria-label={`Share ${p.name} and earn GH₵${formatGhc(reward)}`}
          >
            <Gift className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="truncate">Share &amp; earn GH₵{formatGhc(reward)}</span>
          </button>
        )}
      </div>
    </article>
  );
};
