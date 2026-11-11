import type { DataBundle } from '../../../types';
import type { WelcomeOffer } from '../../../utils/welcomeOfferPresentation';

const NETWORK_LABEL: Record<string, string> = { mtn: 'MTN', telecel: 'Telecel', airteltigo: 'AirtelTigo' };

/**
 * The headline percentage the founder approved for the welcome offer ("up to 18% off", 9 November 2026). It is a
 * ceiling for the headline only: the figure shown is always worked out from the live offer and catalogue, and never
 * exceeds this.
 */
export const WELCOME_HEADLINE_CEILING = 18;

export interface WelcomeFigure { percent: number; regularMinor: number; label: string }

/**
 * The welcome offer as a headline figure, worked out from the real offer and the real catalogue, never typed in.
 * The saving is a fixed amount off one qualifying data purchase (the server's welcome offer), so as a share of a
 * bundle's price it is largest on the cheapest bundles. The headline is the largest whole-number share any
 * qualifying bundle actually gets, capped at the approved ceiling: a bundle whose real share is above the ceiling
 * still supports "up to <ceiling>%" (it understates, never overstates). Shares are of the price the bundle sells for
 * now, so a December Special price (GH₵1 off GH₵4.99 is 20%) keeps the headline at the ceiling instead of dropping
 * it to a smaller bundle's figure. `label` names a bundle that reaches the figure, preferring one whose share is
 * exactly the figure. Returns nothing until the catalogue on screen is the server's own, so a stale fallback price
 * can never inflate it.
 */
export function welcomeFigure(offer: WelcomeOffer | null, bundles: DataBundle[], catalogConfirmed: boolean, ceiling = WELCOME_HEADLINE_CEILING): WelcomeFigure | null {
  if (!offer?.enabled || !Number.isSafeInteger(offer.discountMinor) || offer.discountMinor <= 0 || !catalogConfirmed) return null;
  // The same qualifying rule as the checkout's welcome price: direct data bundles only (not airtime or instant).
  const qualifying = bundles.filter(b => (!b.serviceType || b.serviceType === 'data') && !/^(instant|airtime)-/.test(b.id) && b.priceGhc > 0);
  let best: { percent: number; exact: boolean; regularMinor: number; bundle: DataBundle } | null = null;
  for (const bundle of qualifying) {
    // A campaign that does not stack with the welcome benefit gives it no share on that bundle.
    if (bundle.priceCampaign && !bundle.priceCampaign.stacksWithWelcome) continue;
    const regularMinor = Math.round(bundle.priceGhc * 100);
    if (!Number.isSafeInteger(regularMinor) || offer.discountMinor >= regularMinor) continue;
    const share = Math.floor((offer.discountMinor * 100) / regularMinor);
    if (share < 1) continue;
    const percent = Math.min(share, ceiling), exact = share === percent;
    if (!best || percent > best.percent || (percent === best.percent && (exact && !best.exact || exact === best.exact && regularMinor < best.regularMinor))) best = { percent, exact, regularMinor, bundle };
  }
  if (!best) return null;
  return { percent: best.percent, regularMinor: best.regularMinor, label: `${NETWORK_LABEL[best.bundle.network] || best.bundle.network} ${best.bundle.dataAmount}` };
}
