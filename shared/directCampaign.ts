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
 * The founder-approved December plan (13 November 2026): 1 December 2026 to 4 January 2027 inclusive (normal prices
 * from 5 January), five MTN prices, welcome benefit stacking. No other product is part of it.
 */
export const DECEMBER_2026_APPROVED_PLAN = {
  startDate: '2026-12-01',
  endDate: '2027-01-04',
  stacksWithWelcome: true,
  products: {
    'mtn-1gb': { campaignMinor: 499 }, 'mtn-2gb': { campaignMinor: 899 }, 'mtn-3gb': { campaignMinor: 1339 },
    'mtn-4gb': { campaignMinor: 1779 }, 'mtn-5gb': { campaignMinor: 2199 },
  } as Record<string, DirectCampaignProduct>,
} as const;

/**
 * Shipped disabled, with the approved plan as its draft. This is only the default: once an Admin has saved the
 * campaign, the saved settings are authoritative and a deploy never changes them (Admin shows any difference from the
 * approved plan and can load it into a draft). Deploying never enables it, whatever today's date.
 */
export const DIRECT_CAMPAIGN_DEFAULT: DirectCampaignConfig = {
  id: DECEMBER_2026_CAMPAIGN_ID,
  label: 'December Special',
  title: 'December Specials',
  version: 'december-2026-inactive-v2',
  enabled: false,
  startDate: DECEMBER_2026_APPROVED_PLAN.startDate,
  endDate: DECEMBER_2026_APPROVED_PLAN.endDate,
  stacksWithWelcome: DECEMBER_2026_APPROVED_PLAN.stacksWithWelcome,
  products: { ...DECEMBER_2026_APPROVED_PLAN.products },
};

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
export function campaignState(config: Pick<DirectCampaignConfig, 'enabled' | 'startDate' | 'endDate'>, now: Date = new Date()): CampaignState {
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

/** Ways a campaign's dates, stacking or products differ from the approved plan (empty when identical). */
export function campaignPlanDifferences(config: DirectCampaignConfig, plan = DECEMBER_2026_APPROVED_PLAN): string[] {
  const out: string[] = [];
  if (config.startDate !== plan.startDate) out.push(`First day is ${config.startDate ?? 'not set'}; approved ${plan.startDate}.`);
  if (config.endDate !== plan.endDate) out.push(`Last day is ${config.endDate ?? 'not set'}; approved ${plan.endDate}.`);
  if (config.stacksWithWelcome !== plan.stacksWithWelcome) out.push('Welcome benefit stacking differs from the approved plan.');
  for (const [id, { campaignMinor }] of Object.entries(plan.products)) {
    const saved = config.products[id]?.campaignMinor;
    if (saved === undefined) out.push(`${id} is missing; approved ${campaignMinor} pesewas.`);
    else if (saved !== campaignMinor) out.push(`${id} is ${saved} pesewas; approved ${campaignMinor}.`);
  }
  for (const id of Object.keys(config.products)) if (!(id in plan.products)) out.push(`${id} is not in the approved plan.`);
  return out;
}

/**
 * When the campaign stops applying: 00:00 Accra on the day after its last day. Accra keeps GMT all year (no daylight
 * saving), so this is that date at 00:00Z. Lets an open page refresh its prices at the boundary.
 */
export function campaignEndsAt(config: Pick<DirectCampaignConfig, 'endDate'>): string | null {
  if (!isCampaignDate(config.endDate)) return null;
  const next = new Date(config.endDate + 'T00:00:00Z');
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

/** ["MTN 5GB","MTN 5GB","MTN 3GB"] → ["MTN 3GB","2 × MTN 5GB"]. */
function groupLabels(labels: string[]): string[] {
  const counts = new Map<string, number>();
  for (const l of [...labels].sort()) counts.set(l, (counts.get(l) || 0) + 1);
  return [...counts].map(([l, n]) => n > 1 ? `${n} × ${l}` : l);
}
export interface LadderItem { id: string; label: string; gb: number; minor: number }
/**
 * Products whose own price is higher than buying the same amount of data as several smaller bundles at the prices
 * given (pass the December effective prices). Whole-GB sizes only; returns the cheapest combination found.
 */
export function campaignValueWarnings(items: LadderItem[]): { id: string; label: string; minor: number; combinationMinor: number; combination: string[] }[] {
  const usable = items.filter(i => Number.isInteger(i.gb) && i.gb > 0 && i.gb <= 200 && Number.isSafeInteger(i.minor) && i.minor > 0);
  const max = Math.max(0, ...usable.map(i => i.gb));
  const best: { cost: number; parts: LadderItem[] }[] = [{ cost: 0, parts: [] }];
  for (let gb = 1; gb <= max; gb++) {
    let choice: { cost: number; parts: LadderItem[] } | null = null;
    for (const i of usable) if (i.gb <= gb && best[gb - i.gb]) {
      const cost = best[gb - i.gb].cost + i.minor;
      if (!choice || cost < choice.cost) choice = { cost, parts: [...best[gb - i.gb].parts, i] };
    }
    best[gb] = choice!;
  }
  return usable.flatMap(i => {
    const combo = best[i.gb];
    return combo && combo.parts.length > 1 && combo.cost < i.minor
      ? [{ id: i.id, label: i.label, minor: i.minor, combinationMinor: combo.cost, combination: groupLabels(combo.parts.map(p => p.label)) }] : [];
  });
}
