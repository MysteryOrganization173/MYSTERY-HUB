import type { DataBundle } from '../types';
import { formatGhs } from '../../shared/money';

export interface WelcomeOffer { enabled: boolean; state: string; discountMinor: number }
export interface WelcomePrice { regularMinor: number; discountMinor: number; totalMinor: number; description: string }

/** Keep only public promotion fields; a malformed quote cannot establish eligibility. */
export function welcomeOfferFromQuote(quote: any): WelcomeOffer | null {
  const offer = quote?.offer;
  if (typeof offer?.enabled !== 'boolean' || typeof offer.state !== 'string' || !Number.isSafeInteger(offer.discountMinor) || offer.discountMinor <= 0) return null;
  if (offer.state === 'eligible' && (!offer.enabled || quote.discountMinor !== offer.discountMinor || !Number.isSafeInteger(quote.regularMinor) || !Number.isSafeInteger(quote.totalMinor) || quote.totalMinor <= 0 || quote.regularMinor - quote.discountMinor !== quote.totalMinor)) return null;
  return { enabled: offer.enabled, state: offer.state, discountMinor: offer.discountMinor };
}

/** Display projection only. Callers must explicitly opt in from direct Data views. */
export function welcomePriceForBundle(bundle: DataBundle, offer?: WelcomeOffer | null): WelcomePrice | null {
  if (!offer?.enabled || offer.state !== 'eligible' || !Number.isSafeInteger(offer.discountMinor) || offer.discountMinor <= 0 || (bundle.serviceType && bundle.serviceType !== 'data') || /^(instant|airtime)-/.test(bundle.id)) return null;
  const regularMinor = Math.round(bundle.priceGhc * 100), totalMinor = regularMinor - offer.discountMinor;
  if (!Number.isSafeInteger(regularMinor) || regularMinor <= 0 || totalMinor <= 0) return null;
  return { regularMinor, discountMinor: offer.discountMinor, totalMinor, description: `Welcome Price ${formatGhs(totalMinor)}; regular price ${formatGhs(regularMinor)}. You save ${formatGhs(offer.discountMinor)} on one qualifying purchase only.` };
}
