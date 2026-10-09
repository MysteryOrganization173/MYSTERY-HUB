import type { PublicRewardRule, ReferralSummaryResponse, RewardLedgerItem } from '../services/apiClient';
import { buildReferralUrl } from './referralUrl';
import { ROUTE_PATH_MAP } from './routing';
export type EarnSummary = ReferralSummaryResponse['summary'];

/** Receives only the current session's authorized summary, never cached profile data. */
export function personalReferralLink(summary: EarnSummary | null, path = '/', base?: string): string | null {
  if (!summary || summary.isEnabled !== true) return null;
  let code = summary.code?.trim().toUpperCase();
  if (!code && summary.shareUrl) {
    try { code = new URL(summary.shareUrl).searchParams.get('ref')?.trim().toUpperCase() || ''; } catch { return null; }
  }
  if (!code || !/^MH-[A-Z0-9]{6,32}$/.test(code)) return null;
  if (!Object.values(ROUTE_PATH_MAP).includes(path)) return null;
  return buildReferralUrl(path, code, base);
}
export function activeEarnRules(rules: PublicRewardRule[], now = Date.now()): PublicRewardRule[] {
  return rules.filter(rule => rule.enabled === true && (!rule.starts_at || Date.parse(rule.starts_at) <= now) && (!rule.ends_at || Date.parse(rule.ends_at) >= now));
}
export async function copyReferralLink(url: string | null, clipboard?: Pick<Clipboard, 'writeText'>): Promise<boolean> {
  if (!url || !clipboard?.writeText) return false;
  try { await clipboard.writeText(url); return true; } catch { return false; }
}
export async function shareReferralLink(url: string | null, share?: (data: ShareData) => Promise<void>): Promise<'shared' | 'cancelled' | 'fallback'> {
  if (!url || !share) return 'fallback';
  try {
    await share({ title: 'Mystery Hub', text: 'Data, websites and digital services in one place. Explore with my referral link.', url });
    return 'shared';
  } catch (error) { return (error as Error)?.name === 'AbortError' ? 'cancelled' : 'fallback'; }
}
export const rewardStatuses: Record<RewardLedgerItem['status'], { label: string; className: string; explanation: string }> = {
  pending: { label: 'Pending', className: 'text-amber-300 bg-amber-400/10', explanation: 'Not available to spend or withdraw yet.' },
  approved: { label: 'Approved', className: 'text-emerald-300 bg-emerald-400/10', explanation: 'Recorded reward. See Available Earnings for funds you can use.' },
  rejected: { label: 'Rejected', className: 'text-slate-300 bg-slate-800', explanation: 'Not earned. This amount is not available.' },
  reversed: { label: 'Reversed', className: 'text-rose-300 bg-rose-400/10', explanation: 'Reward removed. This amount is not available.' },
};
export const earnServiceLabel = (service: string) => ({ data: 'Data', airtime: 'Airtime', afa: 'AFA registration', instant_bundle: 'Instant Bundle', marketplace: 'Marketplace', website_builder: 'Website Builder', manual_adjustment: 'Reward adjustment', all: 'Eligible services' }[service] || 'Eligible purchase');
export const earnCount = (value: number | undefined) => Number.isSafeInteger(value) && value! >= 0 ? value!.toLocaleString('en-GH') : 'Unavailable';
