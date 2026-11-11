import { accraDate } from './seasonal.js';

/**
 * December Specials: a dated, server-authoritative selling price for selected direct Data products.
 *
 * It is one small layer on the existing commercial pricing, not a promotion engine:
 * - The standard price stays the Admin "direct-pricing" retail. The campaign only lowers it, and only while the
 *   campaign is enabled and today's Accra date is inside its first..last day (inclusive). Nothing else can turn it on:
 *   no client field, URL, seasonal preview or device clock is read.
 * - Until the founder enables it, the effective price of every product is exactly the standard price.
 * - Malformed or incomplete stored settings fail closed: no campaign price applies.
 * - The one-time welcome benefit stacks on the campaign price only when `stacksWithWelcome` is true. A future campaign
 *   (for example a limited Christmas Day deal) can set it to false instead of stacking automatically.
 */
export const DECEMBER_2026_CAMPAIGN_ID = 'december-specials-2026';

export interface DirectCampaignProduct { campaignMinor: number }
export interface DirectCampaignConfig {
  id: string;
  /** Per-product label ("December Special") and the campaign's headline name ("December Specials"). */
  label: string;
  title: string;
  version: string;
  enabled: boolean;
  /** First day the campaign price applies, Accra calendar date (YYYY-MM-DD), from 00:00. */
  startDate: string | null;
  /** Last day the campaign price applies, Accra calendar date, through 23:59:59. Required before enabling. */
  endDate: string | null;
  stacksWithWelcome: boolean;
  products: Record<string, DirectCampaignProduct>;
  updatedAt?: string;
  actorId?: string;
}

/**
 * Shipped disabled. The two founder-approved December targets are prepared here; provisional prices (for example
 * MTN 3GB and 5GB) are deliberately absent until approved. The end date must be confirmed before enabling.
 */
export const DIRECT_CAMPAIGN_DEFAULT: DirectCampaignConfig = {
  id: DECEMBER_2026_CAMPAIGN_ID,
  label: 'December Special',
  title: 'December Specials',
  version: 'december-2026-inactive-v1',
  enabled: false,
  startDate: '2026-12-01',
  endDate: null,
  stacksWithWelcome: true,
  products: { 'mtn-1gb': { campaignMinor: 499 }, 'mtn-2gb': { campaignMinor: 899 } },
};

/**
 * AFA Registration December proposal, prepared but NOT applied anywhere: AFA checkout prices from its own
 * configuration, has no pre-purchase authoritative supplier cost and no quote-review step, so a discount cannot be
 * made purchasable or advertised from this campaign. See docs/december-specials-2026.md.
 */
export const AFA_DECEMBER_PROPOSAL = { proposedMinor: 1999, historicalRetailMinor: 2999, historicalCostMinor: 1200 } as const;

export type CampaignState = 'disabled' | 'incomplete' | 'scheduled' | 'active' | 'ended';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const isCampaignDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const day = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
};
const positiveMinor = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= 100_000_000;

/** Stored settings over the shipped default. Anything malformed is dropped or disables the campaign. */
export function normalizeCampaign(stored: unknown): DirectCampaignConfig {
  const s = stored && typeof stored === 'object' ? stored as Partial<DirectCampaignConfig> : {};
  const products: Record<string, DirectCampaignProduct> = Object.create(null);
  // Shipped products only when nothing was ever saved; a saved but malformed list applies nothing.
  const source = s.products === undefined ? DIRECT_CAMPAIGN_DEFAULT.products : s.products && typeof s.products === 'object' && !Array.isArray(s.products) ? s.products : {};
  for (const [id, item] of Object.entries(source)) if (/^[a-z0-9-]{1,40}$/.test(id) && positiveMinor((item as DirectCampaignProduct)?.campaignMinor)) products[id] = { campaignMinor: (item as DirectCampaignProduct).campaignMinor };
  const startDate = s.startDate === undefined ? DIRECT_CAMPAIGN_DEFAULT.startDate : isCampaignDate(s.startDate) ? s.startDate : null;
  const endDate = s.endDate === undefined ? DIRECT_CAMPAIGN_DEFAULT.endDate : isCampaignDate(s.endDate) ? s.endDate : null;
  return {
    ...DIRECT_CAMPAIGN_DEFAULT,
    ...(typeof s.version === 'string' && s.version ? { version: s.version } : {}),
    ...(typeof s.updatedAt === 'string' ? { updatedAt: s.updatedAt } : {}),
    ...(typeof s.actorId === 'string' ? { actorId: s.actorId } : {}),
    enabled: s.enabled === true,
    startDate, endDate,
    stacksWithWelcome: s.stacksWithWelcome === undefined ? DIRECT_CAMPAIGN_DEFAULT.stacksWithWelcome : s.stacksWithWelcome === true,
    products,
  };
}

/** Where the campaign stands on the server's clock, by Accra calendar date. */
export function campaignState(config: DirectCampaignConfig, now: Date = new Date()): CampaignState {
  if (!config.enabled) return 'disabled';
  if (!config.startDate || !config.endDate || config.endDate < config.startDate) return 'incomplete';
  const today = accraDate(now);
  if (today < config.startDate) return 'scheduled';
  if (today > config.endDate) return 'ended';
  return 'active';
}

/** The campaign selling price for one product right now, or null for the standard price. Never raises a price. */
export function campaignPriceFor(config: DirectCampaignConfig, productId: string, standardMinor: number, now: Date = new Date()): number | null {
  if (campaignState(config, now) !== 'active') return null;
  const price = config.products[productId]?.campaignMinor;
  return positiveMinor(price) && price < standardMinor ? price : null;
}

/** Whole-number headline saving ("up to N% off") across products whose campaign price applies; never rounds up. */
export function campaignHeadlinePercent(products: { amountPesewas: number; standardPesewas?: number }[]): number | null {
  let best = 0;
  for (const p of products) if (p.standardPesewas && p.standardPesewas > p.amountPesewas) best = Math.max(best, Math.floor(((p.standardPesewas - p.amountPesewas) * 100) / p.standardPesewas));
  return best > 0 ? best : null;
}
