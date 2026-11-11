import React from 'react';
import { formatGhs } from '../../../shared/money';
import type { CampaignPrice, WelcomePrice } from '../../utils/welcomeOfferPresentation';

export function WelcomeBundlePrice({ price }: { price: WelcomePrice }) {
  return <div className="text-right" aria-label={price.description}>
    <div className="flex flex-wrap justify-end items-baseline gap-x-1.5 text-[10px] leading-snug text-slate-400"><span>Welcome Price</span><del>{formatGhs(price.regularMinor)}</del></div>
    <strong className="block text-xl font-extrabold text-emerald-300 tabular-nums tracking-tight">{formatGhs(price.totalMinor)}</strong>
    <span className="block text-[10px] leading-snug text-emerald-200">You save {formatGhs(price.savingMinor)}</span>
  </div>;
}

/** A server campaign price (December Special): the label and crossed-out standard price say it, not colour alone. */
export function CampaignBundlePrice({ price }: { price: CampaignPrice }) {
  return <div className="text-right" aria-label={price.description}>
    <div className="flex flex-wrap justify-end items-baseline gap-x-1.5 text-[10px] leading-snug text-slate-400"><span className="font-semibold text-amber-200">{price.label}</span><del>{formatGhs(price.standardMinor)}</del></div>
    <strong className="block text-xl font-extrabold text-white tabular-nums tracking-tight">{formatGhs(price.priceMinor)}</strong>
    <span className="block text-[10px] leading-snug text-amber-100">You save {formatGhs(price.savingMinor)}</span>
  </div>;
}
