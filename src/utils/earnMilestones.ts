import { formatGhs } from '../../shared/money';

export type AchievementMetric = 'successful_referrals' | 'qualified_visitors' | 'afa_referrals' | 'lifetime_earnings';
export interface EarnAchievement {
  id: string; name: string; metric: AchievementMetric; threshold: number; progress: number;
  enabled: boolean; rewardMinor: number; claimed: boolean;
}
export type MilestoneState = 'unavailable' | 'claimed' | 'restricted' | 'claiming' | 'ready' | 'not-started' | 'in-progress';
export function milestoneProgress(row: EarnAchievement) {
  const valid = ['successful_referrals', 'qualified_visitors', 'afa_referrals', 'lifetime_earnings'].includes(row.metric)
    && Number.isSafeInteger(row.threshold) && row.threshold > 0
    && Number.isSafeInteger(row.progress) && row.progress >= 0
    && Number.isSafeInteger(row.rewardMinor) && row.rewardMinor >= 0
    && typeof row.claimed === 'boolean';
  if (!valid) return null;
  return { percentage: Math.min(row.progress / row.threshold, 1) * 100,
    remaining: Math.max(0, row.threshold - row.progress), complete: row.progress >= row.threshold };
}
export function milestoneState(row: EarnAchievement, options: { restricted?: boolean; stale?: boolean; claimingId?: string | null } = {}): MilestoneState {
  const progress = milestoneProgress(row);
  if (!progress || options.stale || !row.enabled) return 'unavailable';
  if (row.claimed) return 'claimed';
  if (options.restricted) return 'restricted';
  if (options.claimingId === row.id) return 'claiming';
  return progress.complete ? 'ready' : row.progress === 0 ? 'not-started' : 'in-progress';
}
export function featuredMilestone(rows: EarnAchievement[]) {
  return rows.filter(row => row.enabled && !row.claimed && milestoneProgress(row))
    .sort((a, b) => Number(milestoneProgress(b)!.complete) - Number(milestoneProgress(a)!.complete)
      || milestoneProgress(b)!.percentage - milestoneProgress(a)!.percentage
      || a.id.localeCompare(b.id, 'en'))[0] ?? null;
}
export function milestoneValue(value: number, metric: AchievementMetric) {
  return metric === 'lifetime_earnings' ? formatGhs(value) : value.toLocaleString('en-GH');
}
export function milestoneRemaining(row: EarnAchievement) {
  const progress = milestoneProgress(row); if (!progress) return 'Progress is unavailable.';
  if (progress.complete) return 'Milestone reached';
  const amount = milestoneValue(progress.remaining, row.metric);
  switch (row.metric) {
    case 'qualified_visitors': return `${amount} more qualifying visitor ${progress.remaining === 1 ? 'key' : 'keys'}`;
    case 'successful_referrals': return `${amount} more successful ${progress.remaining === 1 ? 'referral' : 'referrals'}`;
    case 'afa_referrals': return `${amount} more qualifying AFA ${progress.remaining === 1 ? 'referral' : 'referrals'}`;
    case 'lifetime_earnings': return `${amount} more approved referral earnings`;
  }
}
export const milestoneMetricNotes: Record<AchievementMetric, string> = {
  successful_referrals: 'Successful referrals from approved qualifying reward activity.',
  qualified_visitors: 'Distinct stored visitor keys, not verified individual people.',
  afa_referrals: 'Approved qualifying AFA referral activity.',
  lifetime_earnings: 'Approved referral earnings. Progress is stored in pesewas and displayed in Ghana cedis.',
};
