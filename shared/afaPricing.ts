import { campaignState, isCampaignDate, DECEMBER_2026_CAMPAIGN_ID, type CampaignState } from './directCampaign.js';

/**
 * AFA Registration pricing: one commercial quote over the existing AFA service.
 *
 * - The standard registration price stays the server setting `AFA_RETAIL_PRICE_MINOR` (no second standard price).
 * - An approved promotional price (December Specials: GH₵19.99) only ever lowers it, and only when ALL hold:
 *   the AFA campaign is enabled by an Admin, today's Accra date is inside its dates, the price is below the standard
 *   price, and an Admin-confirmed contractual supplier cost exists that the price covers.
 * - Shipped disabled. Deploying, a date passing, or a cost being recorded never enables it.
 * - The data welcome benefit never applies to AFA.
 */
export const AFA_CAMPAIGN_ACTIVATION = 'afa-december-specials-2026';
export const AFA_COST_CONFIRMATION = 'confirm-afa-cost';
/** Contractual cost confirmations older than this cannot be used to enable the promotion. */
export const AFA_COST_MAX_AGE_DAYS = 30;

export interface AfaCostConfirmation { costMinor: number; evidence: string; confirmedAt: string; actorId: string }
export interface AfaPricingConfig {
  version: string;
  campaignId: string;
  label: string;
  enabled: boolean;
  startDate: string | null;
  endDate: string | null;
  campaignMinor: number;
  /** Admin-confirmed contractual supplier cost. Never inferred from history, screenshots or a past order. */
  cost: AfaCostConfirmation | null;
  updatedAt?: string;
  actorId?: string;
}

/** Founder-approved figures (13 November 2026). The historical cost is a reference only: it is never "confirmed". */
export const AFA_APPROVED = { standardMinor: 2999, campaignMinor: 1999, historicalCostMinor: 1200 } as const;

export const AFA_PRICING_DEFAULT: AfaPricingConfig = {
  version: 'afa-pricing-inactive-v1',
  campaignId: DECEMBER_2026_CAMPAIGN_ID,
  label: 'December Special',
  enabled: false,
  startDate: '2026-12-01',
  endDate: '2027-01-04',
  campaignMinor: AFA_APPROVED.campaignMinor,
  cost: null,
};

const positiveMinor = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0 && (v as number) <= 100_000_000;

function normalizeCost(value: unknown): AfaCostConfirmation | null {
  const c = value && typeof value === 'object' ? value as Partial<AfaCostConfirmation> : null;
  if (!c || !positiveMinor(c.costMinor) || typeof c.evidence !== 'string' || c.evidence.trim().length < 10 || typeof c.confirmedAt !== 'string' || Number.isNaN(Date.parse(c.confirmedAt)) || typeof c.actorId !== 'string' || !c.actorId) return null;
  return { costMinor: c.costMinor, evidence: c.evidence.trim().slice(0, 300), confirmedAt: c.confirmedAt, actorId: c.actorId };
}

/** Saved settings over the shipped default; anything malformed disables the promotion or drops the cost. */
export function normalizeAfaPricing(stored: unknown): AfaPricingConfig {
  const s = stored && typeof stored === 'object' ? stored as Partial<AfaPricingConfig> : {};
  return {
    ...AFA_PRICING_DEFAULT,
    ...(typeof s.version === 'string' && s.version ? { version: s.version } : {}),
    ...(typeof s.updatedAt === 'string' ? { updatedAt: s.updatedAt } : {}),
    ...(typeof s.actorId === 'string' ? { actorId: s.actorId } : {}),
    enabled: s.enabled === true,
    startDate: s.startDate === undefined ? AFA_PRICING_DEFAULT.startDate : isCampaignDate(s.startDate) ? s.startDate : null,
    endDate: s.endDate === undefined ? AFA_PRICING_DEFAULT.endDate : isCampaignDate(s.endDate) ? s.endDate : null,
    campaignMinor: s.campaignMinor === undefined ? AFA_PRICING_DEFAULT.campaignMinor : positiveMinor(s.campaignMinor) ? s.campaignMinor : 0,
    cost: normalizeCost(s.cost),
  };
}

export const afaCampaignState = (config: AfaPricingConfig, now: Date = new Date()): CampaignState => campaignState(config, now);

/** Why the promotional price would not apply right now (empty when it applies). */
export function afaPromotionBlockers(config: AfaPricingConfig, standardMinor: number | null, now: Date = new Date()): string[] {
  const out: string[] = [];
  const state = afaCampaignState(config, now);
  if (state !== 'active') out.push(state === 'disabled' ? 'The AFA promotion is not enabled.' : state === 'scheduled' ? 'The AFA promotion has not started.' : state === 'ended' ? 'The AFA promotion has ended.' : 'The AFA promotion dates are incomplete.');
  if (standardMinor === null) out.push('The standard AFA price is not configured.');
  if (!positiveMinor(config.campaignMinor) || (standardMinor !== null && config.campaignMinor >= standardMinor)) out.push('The promotional price is not below the standard price.');
  if (!config.cost) out.push('No Admin-confirmed contractual supplier cost.');
  else if (positiveMinor(config.campaignMinor) && config.campaignMinor < config.cost.costMinor) out.push('The promotional price is below the confirmed supplier cost.');
  return out;
}

/** The AFA price right now: the promotional price only when nothing blocks it, otherwise the standard price. */
export function afaPriceFor(config: AfaPricingConfig, standardMinor: number | null, now: Date = new Date()) {
  if (standardMinor === null) return null;
  const promo = afaPromotionBlockers(config, standardMinor, now).length === 0;
  const totalMinor = promo ? config.campaignMinor : standardMinor;
  return {
    standardMinor, totalMinor,
    // The standard price is part of the revision, so a changed server price is a changed quote too.
    pricingRevision: promo ? `afa:${standardMinor}~${config.version}` : `afa:${standardMinor}`,
    ...(promo ? { campaign: { id: config.campaignId, label: config.label, endDate: config.endDate, revision: config.version }, savingMinor: standardMinor - totalMinor } : {}),
  };
}

/** Whole-number saving that never rounds up (GH₵10 off GH₵29.99 is 33.34% → 33). */
export const savingPercent = (standardMinor: number, totalMinor: number) => standardMinor > totalMinor ? Math.floor(((standardMinor - totalMinor) * 100) / standardMinor) : 0;

/**
 * Whether a payment request matches the quote the customer reviewed. A request that names a total or revision must
 * match it exactly. A request naming neither (a page from before quotes existed) is accepted only at the standard
 * price; a promotional price must always have been reviewed.
 */
export function afaRequestMatchesQuote(quote: { totalMinor: number; pricingRevision: string; campaign?: unknown }, input: { expectedTotalMinor?: unknown; pricingRevision?: unknown }): boolean {
  const total = input.expectedTotalMinor, revision = input.pricingRevision;
  if (total !== undefined && total !== quote.totalMinor) return false;
  if (revision !== undefined && revision !== quote.pricingRevision) return false;
  if (quote.campaign && (total === undefined || revision === undefined)) return false;
  return true;
}
