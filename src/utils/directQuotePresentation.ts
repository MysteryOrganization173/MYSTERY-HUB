import { formatGhs } from '../../shared/money';

/**
 * How checkout explains a direct Data price. Every amount comes from the server quote; nothing here computes a charge.
 * - standardMinor: the price before a campaign (equal to sellingMinor when no campaign applies).
 * - sellingMinor: the server's regularMinor, the price the product sells for now, before the welcome benefit.
 * - discountMinor: the one-time welcome benefit, when the server confirmed it for this account.
 * - totalMinor: what Pay charges.
 * A quote whose arithmetic does not hold is treated as not confirmed.
 */
export interface DirectQuoteView {
  standardMinor: number; sellingMinor: number; discountMinor: number; totalMinor: number;
  campaignLabel: string | null; savingMinor: number;
  welcomeNote: string | null; stateNote: string | null; description: string;
}

const money = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
/** "GH₵1" for whole cedis, otherwise "GH₵1.50": for short sentences. */
export const formatGhsShort = (minor: number) => minor % 100 === 0 ? `GH₵${minor / 100}` : formatGhs(minor);

export function directQuoteView(quote: any): DirectQuoteView | null {
  if (!quote || !money(quote.regularMinor) || !money(quote.discountMinor) || !money(quote.totalMinor) || quote.totalMinor <= 0) return null;
  if (quote.regularMinor - quote.discountMinor !== quote.totalMinor) return null;
  const campaign = quote.standardMinor !== undefined;
  if (campaign && (!money(quote.standardMinor) || quote.standardMinor <= quote.regularMinor || typeof quote.campaign?.label !== 'string')) return null;
  const standardMinor = campaign ? quote.standardMinor : quote.regularMinor, discountMinor = quote.discountMinor;
  const campaignLabel = campaign ? quote.campaign.label as string : null, savingMinor = standardMinor - quote.totalMinor;
  const state = quote.offer?.state;
  const welcomeNote = discountMinor > 0 ? `Your ${formatGhsShort(discountMinor)} welcome benefit applies to your first qualifying purchase only.` : null;
  const stateNote = discountMinor === 0 && state === 'reserved' && quote.offer?.enabled ? 'Your welcome benefit is held by a payment that is still being confirmed, so it is not applied here.' : null;
  const parts = [campaignLabel ? `Regular price ${formatGhs(standardMinor)}, ${campaignLabel} ${formatGhs(quote.regularMinor)}` : discountMinor ? `Regular price ${formatGhs(standardMinor)}` : null,
    discountMinor ? `first-order welcome benefit minus ${formatGhs(discountMinor)}` : null, `total ${formatGhs(quote.totalMinor)}`, savingMinor > 0 ? `you save ${formatGhs(savingMinor)}` : null].filter(Boolean);
  return { standardMinor, sellingMinor: quote.regularMinor, discountMinor, totalMinor: quote.totalMinor, campaignLabel, savingMinor, welcomeNote, stateNote, description: parts.join('; ') + '.' };
}
