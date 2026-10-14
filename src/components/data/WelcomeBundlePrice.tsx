import React from 'react';
import { formatGhs } from '../../../shared/money';
import type { WelcomePrice } from '../../utils/welcomeOfferPresentation';

export function WelcomeBundlePrice({ price }: { price: WelcomePrice }) {
  return <div className="text-right" aria-label={price.description}>
    <div className="flex flex-wrap justify-end items-baseline gap-x-1.5 text-[10px] leading-snug text-slate-400"><span>Welcome Price</span><del>{formatGhs(price.regularMinor)}</del></div>
    <strong className="block text-xl font-extrabold text-emerald-300 tabular-nums tracking-tight">{formatGhs(price.totalMinor)}</strong>
    <span className="block text-[10px] leading-snug text-emerald-200">You save {formatGhs(price.discountMinor)}</span>
  </div>;
}
