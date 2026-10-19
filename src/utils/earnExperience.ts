import type { PublicRewardRule, ReferralSummaryResponse, RewardLedgerItem } from '../services/apiClient';
import { buildReferralUrl } from './referralUrl';
import { ROUTE_PATH_MAP } from './routing';
import { formatGhs } from '../../shared/money';
import { groupMilestones, milestoneRemaining, type EarnAchievement } from './earnMilestones';
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
export async function shareReferralLink(url: string | null, share?: (data: ShareData) => Promise<void>, text = 'Data, websites and digital services in one place. Explore with my referral link.'): Promise<'shared' | 'cancelled' | 'fallback'> {
  if (!url || !share) return 'fallback';
  try {
    await share({ title: 'Mystery Hub', text, url });
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

/** Share topics only point at canonical first-party routes; the link itself still comes from personalReferralLink. */
export const earnShareTopics = [
  { id: 'general', path: '/', label: 'Mystery Hub', short: 'Mystery Hub', message: 'I buy my data and other digital services on Mystery Hub. Have a look.', note: 'A good first link for anyone.' },
  { id: 'data', path: '/data', label: 'Data Bundles', short: 'Data', message: 'I buy my data on Mystery Hub. MTN, Telecel and AirtelTigo bundles, paid with Mobile Money, and you can track your order until it arrives. Have a look.', note: 'Most referral rewards today come from Data purchases.' },
  { id: 'afa', path: '/afa', label: 'MTN AFA Registration', short: 'AFA', message: 'Thought you might need this: you can register for MTN AFA on Mystery Hub and check your status online.', note: 'AFA earns a reward only while an AFA rule is active.' },
  { id: 'website', path: '/website-builder', label: 'Free Website Builder', short: 'Websites', message: 'Thought of your business: Mystery Hub has a free Website Builder you can set up from your phone. Have a look.', note: 'Free websites help friends but do not earn rewards.' },
  { id: 'marketplace', path: '/marketplace', label: 'Marketplace', short: 'Marketplace', message: 'Saw this and thought of you: the Mystery Hub Marketplace has gadgets and other products in Ghana.', note: 'Enquiries alone do not earn rewards.' },
] as const;
export type EarnShareTopic = (typeof earnShareTopics)[number];
/** User-initiated, first-person message text; never promises savings or rewards to the recipient. The sharer can edit it in WhatsApp. */
export function referralShareMessage(topic: Pick<EarnShareTopic, 'message'>, link: string) {
  return `${topic.message} Here's my link: ${link}`;
}
export function referralWhatsAppUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** One honest next step, derived only from confirmed server data. */
export function earnNextStep(summary: EarnSummary | null, achievements: EarnAchievement[] | null, stale: boolean, restricted = false): string {
  if (summary?.isEnabled === false) return 'Referral sharing is paused for your account. Your earnings and history are still here.';
  if (restricted) return 'Your account is being reviewed. Sharing and history stay available; claims and cash-out may pause.';
  if (achievements && !stale) {
    const { featured, ready } = groupMilestones(achievements);
    const readyRows = [...ready, ...(featured && !featured.claimed && featured.progress >= featured.threshold ? [featured] : [])];
    const readyCredit = readyRows.reduce((total, row) => total + (Number.isSafeInteger(row.rewardMinor) && row.rewardMinor > 0 ? row.rewardMinor : 0), 0);
    if (readyCredit > 0) return `You have ${formatGhs(readyCredit)} in Wallet credit ready to claim.`;
    if (readyRows.length) return `You have ${readyRows.length} ${readyRows.length === 1 ? 'badge' : 'badges'} ready to collect.`;
    if (featured) return `Next: ${featured.name}, ${milestoneRemaining(featured)} to go.`;
  }
  if (summary && summary.referredCustomersCount === 0) return 'Start with one friend who needs data. Your link takes them straight there.';
  return 'Pick a service below and share it with someone who needs it.';
}
