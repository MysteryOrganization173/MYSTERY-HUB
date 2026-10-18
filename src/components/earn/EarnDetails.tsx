import React from 'react';
import { Users, MousePointerClick, ArrowRight, BadgeCheck } from 'lucide-react';
import type { PublicRewardRule, RewardLedgerItem } from '../../services/apiClient';
import { formatGhs } from '../../../shared/money';
import { describeReferralReward } from '../../utils/referralRewardCopy';
import { earnCount, earnServiceLabel, rewardStatuses, type EarnSummary } from '../../utils/earnExperience';

/** Progress snapshot: three distinct funnel stages, never summed and never presented as spendable money. */
export function EarnMetrics({ summary, loading, stale }: { summary: EarnSummary | null; loading: boolean; stale: boolean }) {
  const count = (value: number | undefined) => loading ? 'Loading…' : earnCount(value);
  const money = (value: number | undefined) => summary && Number.isSafeInteger(value) ? formatGhs(value!) : loading ? 'Loading…' : 'Unavailable';
  const unknown = (value: number | undefined) => loading || !Number.isSafeInteger(value) ? 'earn-metric-unknown' : undefined;
  return <section className="earn-snapshot" aria-labelledby="earn-referrals"><div className="earn-section-heading"><h2 id="earn-referrals">Your referral progress</h2>{stale && <span className="earn-stale">Last available figures</span>}</div>
    <ol className="earn-funnel">
      <li><span className="earn-funnel-step"><MousePointerClick size={15} aria-hidden="true" /> Link visits</span><strong className={unknown(summary?.rawClicksCount)}>{count(summary?.rawClicksCount)}</strong><span className="earn-funnel-note">{summary && Number.isSafeInteger(summary.uniqueVisitorsCount) ? `${earnCount(summary.uniqueVisitorsCount)} distinct browsers` : 'Distinct browsers unavailable'}</span></li>
      <li><span className="earn-funnel-step"><Users size={15} aria-hidden="true" /> People who joined</span><strong className={unknown(summary?.referredCustomersCount)}>{count(summary?.referredCustomersCount)}</strong><span className="earn-funnel-note">Registered with your link</span></li>
      <li><span className="earn-funnel-step"><BadgeCheck size={15} aria-hidden="true" /> Approved rewards</span><strong className={unknown(summary?.approvedRewardsMinor)}>{money(summary?.approvedRewardsMinor)}</strong><span className="earn-funnel-note">{summary && Number.isSafeInteger(summary.pendingRewardsMinor) && summary.pendingRewardsMinor > 0 ? `${formatGhs(summary.pendingRewardsMinor)} pending approval` : 'From qualifying purchases'}</span></li>
    </ol>
    <p className="earn-fine">Visits and sign-ups are signs of interest. Only qualifying purchases can earn rewards.</p>
    <details className="earn-metrics-explainer"><summary>About these figures</summary><p>Link visits: Recorded link visits, including return visits.</p><p>Distinct browsers: Distinct stored visitor keys. Not verified individual people.</p><p>People who joined: Registered accounts linked directly to you. A purchase is not implied.</p><p>Pending Rewards: Recorded referral rewards awaiting approval ({money(summary?.pendingRewardsMinor)}).</p><p>Total approved rewards: Approved referral records ({money(summary?.approvedRewardsMinor)}). This is not your available balance; see Available Earnings.</p></details>
  </section>;
}

export function EarnNetwork({ summary, loading }: { summary: EarnSummary | null; loading: boolean }) {
  const count = (value: number | undefined) => loading ? 'Loading…' : earnCount(value);
  return <details className="earn-network"><summary>Your referral network <span>{count(summary?.networkTotalCount)} linked accounts across three levels</span></summary><p>Direct referrals and the next two levels of linked accounts. Membership alone does not earn a commission.</p><dl>{[
    ['Level 1 · Direct', summary?.networkLevel1Count, 'Members referred by you.'],
    ['Level 2 · Indirect', summary?.networkLevel2Count, 'Members referred by your direct referrals.'],
    ['Level 3 · Indirect', summary?.networkLevel3Count, 'Members referred by Level 2.'],
  ].map(([label, value, description]) => <div key={String(label)}><dt>{label}</dt><dd>{count(value as number | undefined)}</dd><p>{description}</p></div>)}</dl></details>;
}

export function EarnRewardActivity({ ledger, loading, stale }: { ledger: RewardLedgerItem[] | null; loading: boolean; stale: boolean }) {
  return <section className="earn-section" aria-labelledby="earn-reward-activity"><div className="earn-section-heading"><h2 id="earn-reward-activity">Reward activity</h2><span className="earn-fine">Latest 50 records{stale ? ' · Last available activity' : ''}</span></div><p>Pending rewards are not spendable. Approved rewards are recorded earnings, not completed withdrawals.</p>
    {loading ? <p role="status">Loading reward activity…</p> : !ledger ? <p role="status">Reward activity is unavailable. Retry activity above.</p> : !ledger.length ? <div className="earn-empty"><h3>No rewards recorded yet</h3><p>Start by sharing your personal link. Eligible purchases can appear here once recorded. Visits alone do not earn money.</p><a className="earn-text-button" href="#earn-share">Go to your referral link <ArrowRight size={16} aria-hidden="true" /></a></div> : <div className="earn-reward-list" tabIndex={0} role="region" aria-label="Latest reward records">{ledger.map(item => {
      const status = rewardStatuses[item.status];
      return <article key={item.id}><div className="earn-reward-main"><h3>{earnServiceLabel(item.service_type)}</h3><span className={`earn-status ${status.className}`}>{status.label}</span><strong className={item.status === 'approved' ? 'text-emerald-300' : item.status === 'pending' ? 'text-amber-300' : 'text-slate-400'}>{item.status === 'reversed' ? '−' : ''}{formatGhs(item.amount_minor)}</strong></div><p>{item.reason || status.explanation}</p><p className="earn-fine">{status.explanation}</p><div className="earn-reward-meta"><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</time>{item.reward_stage && item.reward_stage !== 'standard' && <span>{item.reward_stage === 'acquisition' ? 'First qualifying purchase' : 'Repeat qualifying purchase'}</span>}{item.network_level && <span>Level {item.network_level}</span>}</div></article>;
    })}</div>}
  </section>;
}

const ruleAmount = (rule: PublicRewardRule) => rule.reward_type === 'fixed_minor' ? formatGhs(rule.reward_minor || 0) : `${((rule.reward_percent_bps || 0) / 100).toLocaleString('en-GH', { maximumFractionDigits: 2 })}%`;
const ruleStage = (rule: PublicRewardRule) => rule.purchase_stage === 'acquisition' ? 'Friend’s first purchase' : rule.purchase_stage === 'recurring' ? 'Later purchases' : 'Each qualifying purchase';
export function EarnRules({ rules, error, retry, compact = false }: { rules: PublicRewardRule[] | null; error: boolean; retry: () => void; compact?: boolean }) {
  return <section className={`earn-section earn-rules${compact ? ' earn-rules-compact' : ''}`} aria-labelledby="earn-rules"><div className="earn-section-heading"><h2 id="earn-rules">Current reward opportunities</h2>{rules && rules.length > 0 && !error && <span className="earn-live-tag">Live rules</span>}</div>{error ? <p role="alert">Reward rules are unavailable. Eligibility cannot be confirmed. <button className="earn-text-button" onClick={retry}>Retry reward rules</button></p> : !rules ? <p role="status">Checking current reward rules…</p> : !rules.length ? <p>No reward rules are currently enabled for qualifying purchases. You can explore and share services, but a reward is not promised.</p> : <><p>These are the active reward rules. Eligible orders and account conditions still apply.</p><ul className="earn-rules-list">{rules.map(rule => <li key={rule.id}><span className="earn-rule-service">{earnServiceLabel(rule.service_type)}{rule.network ? ` · ${rule.network === 'airteltigo' ? 'AirtelTigo' : rule.network.toUpperCase()}` : ''}</span><strong className="earn-rule-amount">{ruleAmount(rule)}</strong><span className="earn-rule-stage">{ruleStage(rule)}</span><h3 className="sr-only">{earnServiceLabel(rule.service_type)}</h3><p>{describeReferralReward(rule)}</p>{rule.product_key && <p className="earn-fine">Selected products only.</p>}{rule.ends_at && <p className="earn-fine">Until {new Date(rule.ends_at).toLocaleDateString('en-GH')}</p>}</li>)}</ul><p className="earn-fine">Final rewards also depend on the service’s current reward policy and eligible order. Data rewards may use a separate margin-based policy rather than the published amount above. Your reward activity confirms the amount actually recorded.</p></> }</section>;
}
