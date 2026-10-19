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
  return <section className="earn-snapshot" aria-labelledby="earn-referrals"><div className="earn-section-heading"><h2 id="earn-referrals">How your link is doing</h2>{stale && <span className="earn-stale">Last available figures</span>}</div>
    <ol className="earn-funnel">
      <li><span className="earn-funnel-step"><MousePointerClick size={15} aria-hidden="true" /> Visits</span><strong className={unknown(summary?.rawClicksCount)}>{count(summary?.rawClicksCount)}</strong><span className="earn-funnel-note">{summary && Number.isSafeInteger(summary.uniqueVisitorsCount) ? `${earnCount(summary.uniqueVisitorsCount)} different browsers` : 'Browsers unavailable'}</span></li>
      <li><span className="earn-funnel-step"><Users size={15} aria-hidden="true" /> Joined</span><strong className={unknown(summary?.referredCustomersCount)}>{count(summary?.referredCustomersCount)}</strong><span className="earn-funnel-note">Signed up with your link</span></li>
      <li><span className="earn-funnel-step"><BadgeCheck size={15} aria-hidden="true" /> Rewards</span><strong className={unknown(summary?.approvedRewardsMinor)}>{money(summary?.approvedRewardsMinor)}</strong><span className="earn-funnel-note">{summary && Number.isSafeInteger(summary.pendingRewardsMinor) && summary.pendingRewardsMinor > 0 ? `${formatGhs(summary.pendingRewardsMinor)} pending` : 'Approved so far'}</span></li>
    </ol>
    <details className="earn-metrics-explainer"><summary>What these numbers mean</summary><p>Visits and sign-ups never earn money on their own. Only qualifying purchases by people you referred can.</p><p>Visits: every time your link was opened, including repeat visits. Distinct browsers counts stored visitor keys, not people.</p><p>Joined: Registered accounts created with your link. It does not mean they bought anything.</p><p>Pending Rewards: waiting for approval and not usable yet ({money(summary?.pendingRewardsMinor)}).</p><p>Total approved rewards: everything approved so far ({money(summary?.approvedRewardsMinor)}). This is not your available balance; some may already be withdrawn or moved to Wallet. See Available Earnings.</p></details>
  </section>;
}

export function EarnNetwork({ summary, loading }: { summary: EarnSummary | null; loading: boolean }) {
  const count = (value: number | undefined) => loading ? 'Loading…' : earnCount(value);
  return <details className="earn-network"><summary>Your network <span>{count(summary?.networkTotalCount)} linked accounts across three levels</span></summary><p>Direct referrals and the next two levels of linked accounts. Membership alone does not earn a commission.</p><dl>{[
    ['Level 1 · Direct', summary?.networkLevel1Count, 'Members referred by you.'],
    ['Level 2 · Indirect', summary?.networkLevel2Count, 'Members referred by your direct referrals.'],
    ['Level 3 · Indirect', summary?.networkLevel3Count, 'Members referred by Level 2.'],
  ].map(([label, value, description]) => <div key={String(label)}><dt>{label}</dt><dd>{count(value as number | undefined)}</dd><p>{description}</p></div>)}</dl></details>;
}

export function EarnRewardActivity({ ledger, loading, stale }: { ledger: RewardLedgerItem[] | null; loading: boolean; stale: boolean }) {
  return <section className="earn-section" aria-labelledby="earn-reward-activity"><div className="earn-section-heading"><h2 id="earn-reward-activity">Rewards history</h2><span className="earn-fine">Latest 50 records{stale ? ' · Last available activity' : ''}</span></div><p>Pending rewards can’t be used yet. Approved rewards are recorded earnings, not completed withdrawals.</p>
    {loading ? <p role="status">Loading reward activity…</p> : !ledger ? <p role="status">Reward activity is unavailable. Retry activity above.</p> : !ledger.length ? <div className="earn-empty"><h3>No rewards recorded yet</h3><p>When someone you referred makes a qualifying purchase, the reward appears here.</p><a className="earn-text-button" href="#earn-share">Share your link <ArrowRight size={16} aria-hidden="true" /></a></div> : <div className="earn-reward-list" tabIndex={0} role="region" aria-label="Latest reward records">{ledger.map(item => {
      const status = rewardStatuses[item.status];
      return <article key={item.id}><div className="earn-reward-main"><h3>{earnServiceLabel(item.service_type)}</h3><span className={`earn-status ${status.className}`}>{status.label}</span><strong className={item.status === 'approved' ? 'text-emerald-300' : item.status === 'pending' ? 'text-amber-300' : 'text-slate-400'}>{item.status === 'reversed' ? '−' : ''}{formatGhs(item.amount_minor)}</strong></div><p>{item.reason || status.explanation}</p><p className="earn-fine">{status.explanation}</p><div className="earn-reward-meta"><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</time>{item.reward_stage && item.reward_stage !== 'standard' && <span>{item.reward_stage === 'acquisition' ? 'First qualifying purchase' : 'Repeat qualifying purchase'}</span>}{item.network_level && <span>Level {item.network_level}</span>}</div></article>;
    })}</div>}
  </section>;
}

const ruleAmount = (rule: PublicRewardRule) => rule.reward_type === 'fixed_minor' ? formatGhs(rule.reward_minor || 0) : `${((rule.reward_percent_bps || 0) / 100).toLocaleString('en-GH', { maximumFractionDigits: 2 })}%`;
const ruleStage = (rule: PublicRewardRule) => rule.purchase_stage === 'acquisition' ? 'Friend’s first purchase' : rule.purchase_stage === 'recurring' ? 'Their later purchases' : 'Each qualifying purchase';
export function EarnRules({ rules, error, retry, compact = false }: { rules: PublicRewardRule[] | null; error: boolean; retry: () => void; compact?: boolean }) {
  return <section className={`earn-section earn-rules${compact ? ' earn-rules-compact' : ''}`} aria-labelledby="earn-rules"><div className="earn-section-heading"><h2 id="earn-rules">What you can earn now</h2>{rules && rules.length > 0 && !error && <span className="earn-live-tag">Live rules</span>}</div>{error ? <p role="alert">Reward rules are unavailable. Eligibility cannot be confirmed. <button className="earn-text-button" onClick={retry}>Retry reward rules</button></p> : !rules ? <p role="status">Checking current reward rules…</p> : !rules.length ? <p>No reward rules are enabled right now. You can still share, but no reward is promised.</p> : <><p>Paid under the active reward rules when someone you referred makes a qualifying purchase.</p><ul className="earn-rules-list">{rules.map(rule => <li key={rule.id}><span className="earn-rule-service">{earnServiceLabel(rule.service_type)}{rule.network ? ` · ${rule.network === 'airteltigo' ? 'AirtelTigo' : rule.network.toUpperCase()}` : ''}</span><strong className="earn-rule-amount">{ruleAmount(rule)}</strong><span className="earn-rule-stage">{ruleStage(rule)}</span><h3 className="sr-only">{earnServiceLabel(rule.service_type)}</h3><p>{describeReferralReward(rule)}</p>{rule.product_key && <p className="earn-fine">Selected products only.</p>}{rule.ends_at && <p className="earn-fine">Until {new Date(rule.ends_at).toLocaleDateString('en-GH')}</p>}</li>)}</ul><p className="earn-fine">Data rewards can follow a separate margin-based policy, so the amount in your rewards history is final.</p></> }</section>;
}
