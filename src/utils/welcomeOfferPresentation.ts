import type { DataBundle } from '../types';
import { formatGhs } from '../../shared/money';

export interface WelcomeOffer { enabled: boolean; state: string; discountMinor: number }
/**
 * regularMinor is the price shown crossed out: the bundle's price, or its standard price while a campaign lowers it.
 * savingMinor is regularMinor - totalMinor (the campaign saving plus the one-time welcome benefit).
 */
export interface WelcomePrice { regularMinor: number; discountMinor: number; totalMinor: number; savingMinor: number; campaignLabel: string | null; description: string }
export interface CampaignPrice { standardMinor: number; priceMinor: number; savingMinor: number; label: string; description: string }

/** Keep only public promotion fields; a malformed quote cannot establish eligibility. */
export function welcomeOfferFromQuote(quote: any): WelcomeOffer | null {
  const offer = quote?.offer;
  if (typeof offer?.enabled !== 'boolean' || typeof offer.state !== 'string' || !Number.isSafeInteger(offer.discountMinor) || offer.discountMinor <= 0) return null;
  if (offer.state === 'eligible' && (!offer.enabled || quote.discountMinor !== offer.discountMinor || !Number.isSafeInteger(quote.regularMinor) || !Number.isSafeInteger(quote.totalMinor) || quote.totalMinor <= 0 || quote.regularMinor - quote.discountMinor !== quote.totalMinor)) return null;
  return { enabled: offer.enabled, state: offer.state, discountMinor: offer.discountMinor };
}

const directData = (bundle: DataBundle) => !(bundle.serviceType && bundle.serviceType !== 'data') && !/^(instant|airtime)-/.test(bundle.id);

/** A server campaign price (e.g. December Special) with its genuine standard price, or null. Display only. */
export function campaignPriceForBundle(bundle: DataBundle): CampaignPrice | null {
  if (!bundle.priceCampaign || !directData(bundle) || typeof bundle.standardPriceGhc !== 'number') return null;
  const priceMinor = Math.round(bundle.priceGhc * 100), standardMinor = Math.round(bundle.standardPriceGhc * 100);
  if (!Number.isSafeInteger(priceMinor) || !Number.isSafeInteger(standardMinor) || priceMinor <= 0 || standardMinor <= priceMinor) return null;
  const label = bundle.priceCampaign.label;
  return { standardMinor, priceMinor, savingMinor: standardMinor - priceMinor, label, description: `${label} ${formatGhs(priceMinor)}; regular price ${formatGhs(standardMinor)}. You save ${formatGhs(standardMinor - priceMinor)}.` };
}

/** Display projection only. Callers must explicitly opt in from direct Data views. */
export function welcomePriceForBundle(bundle: DataBundle, offer?: WelcomeOffer | null): WelcomePrice | null {
  if (!offer?.enabled || offer.state !== 'eligible' || !Number.isSafeInteger(offer.discountMinor) || offer.discountMinor <= 0 || !directData(bundle)) return null;
  // A campaign that does not stack with the welcome benefit never shows a welcome price.
  if (bundle.priceCampaign && !bundle.priceCampaign.stacksWithWelcome) return null;
  const sellingMinor = Math.round(bundle.priceGhc * 100), totalMinor = sellingMinor - offer.discountMinor;
  if (!Number.isSafeInteger(sellingMinor) || sellingMinor <= 0 || totalMinor <= 0) return null;
  const campaign = campaignPriceForBundle(bundle);
  if (!campaign) return { regularMinor: sellingMinor, discountMinor: offer.discountMinor, totalMinor, savingMinor: offer.discountMinor, campaignLabel: null, description: `Welcome Price ${formatGhs(totalMinor)}; regular price ${formatGhs(sellingMinor)}. You save ${formatGhs(offer.discountMinor)} on one qualifying purchase only.` };
  const savingMinor = campaign.standardMinor - totalMinor;
  return { regularMinor: campaign.standardMinor, discountMinor: offer.discountMinor, totalMinor, savingMinor, campaignLabel: campaign.label,
    description: `Welcome Price ${formatGhs(totalMinor)}; regular price ${formatGhs(campaign.standardMinor)}, ${campaign.label} ${formatGhs(sellingMinor)}, less your ${formatGhs(offer.discountMinor)} welcome benefit. You save ${formatGhs(savingMinor)} on one qualifying purchase only.` };
}
