import React, { useLayoutEffect, useRef } from 'react';
import { Award, Check, CircleCheck, Gift, Link2, LockKeyhole, Sparkles, TrendingUp, Users, UserRoundCheck } from 'lucide-react';
import { formatGhs } from '../../../shared/money';
import { featuredMilestone, milestoneMetricNotes, milestoneProgress, milestoneRemaining, milestoneState, milestoneValue, type EarnAchievement } from '../../utils/earnMilestones';

const metricIcons = { successful_referrals: UserRoundCheck, qualified_visitors: Users, afa_referrals: Link2, lifetime_earnings: TrendingUp };
export function EarnProgressBar({ percentage, label, valueText }: { percentage: number | null; label: string; valueText: string }) {
  const previous = useRef(percentage);
  const fill = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (fill.current) {
      const increased = percentage !== null && previous.current !== null && percentage > previous.current;
      fill.current.style.transitionDuration = increased ? '550ms' : '0ms';
      fill.current.style.transform = `scaleX(${(percentage ?? 0) / 100})`;
      fill.current.parentElement?.setAttribute('data-completed', String(increased && percentage === 100));
    }
    previous.current = percentage;
  }, [percentage]);
  // Initial paint is the true confirmed value; subsequent confirmed increases transition.
  return <div className="earn-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100}
    aria-valuenow={percentage ?? undefined} aria-valuetext={percentage === null ? 'Progress unavailable' : valueText}>
    <span ref={fill} className="earn-progress-fill" style={{ transform: `scaleX(${(percentage ?? 0) / 100})` }} />
  </div>;
}
export function EarnMilestoneCard({ row, featured = false, restricted, stale, busy, claimingId, onClaim }: {
  row: EarnAchievement; featured?: boolean; restricted: boolean; stale: boolean; busy: boolean;
  claimingId: string | null; onClaim: (row: EarnAchievement) => void;
}) {
  const progress = milestoneProgress(row);
  const state = milestoneState(row, { restricted, stale, claimingId });
  const Icon = metricIcons[row.metric] || Award;
  const labels = { unavailable: 'Unavailable', claimed: 'Claimed', restricted: 'Restricted', claiming: 'Claiming…', ready: 'Ready to claim', 'not-started': 'Not started', 'in-progress': 'In progress' };
  const titleId = React.useId();
  const configuredReward = Number.isSafeInteger(row.rewardMinor) && row.rewardMinor > 0;
  const rewardKnown = Number.isSafeInteger(row.rewardMinor) && row.rewardMinor >= 0;
  const percentage = progress ? Math.floor(progress.percentage) : null;
  const showClaim = state === 'ready' || state === 'claiming';
  return <article className={`earn-milestone earn-milestone-${state} ${featured ? 'earn-milestone-featured' : ''}`} aria-labelledby={titleId} data-milestone-id={row.id} data-state={state}>
    <div className="earn-milestone-top"><span className="earn-metric-icon"><Icon size={23} aria-hidden="true" /></span><div>
      {featured && <p className="earn-milestone-kicker">Your next milestone</p>}
      <h3 id={titleId}>{row.name}</h3></div><span className="earn-milestone-state">{state === 'claimed' && <Check size={13} aria-hidden="true" />}{labels[state]}</span></div>
    <div className="earn-milestone-progress"><div className="earn-milestone-count">{progress ? <><strong>{milestoneValue(row.progress, row.metric)}</strong><span> / {milestoneValue(row.threshold, row.metric)}</span></> : <strong>Unconfirmed</strong>}</div><span className="earn-percentage">{percentage === null ? 'Unavailable' : `${percentage}%`}<small>{percentage !== null && 'complete'}</small></span></div>
    <EarnProgressBar percentage={stale ? null : progress?.percentage ?? null} label={`${row.name} progress`} valueText={progress ? `${milestoneValue(row.progress, row.metric)} of ${milestoneValue(row.threshold, row.metric)}; ${percentage}% complete` : 'Progress unavailable'} />
    <p className="earn-milestone-remaining">{stale ? 'Last confirmed progress. Refresh to check eligibility.' : progress ? milestoneRemaining(row) : 'Refresh to confirm this milestone’s progress.'}</p>
    <div className="earn-milestone-bottom"><span className="earn-reward-type">{configuredReward ? <Gift size={16} aria-hidden="true" /> : <Award size={16} aria-hidden="true" />}<span>{configuredReward ? <><strong>{formatGhs(row.rewardMinor)}</strong> Wallet credit</> : rewardKnown ? 'Badge only · no cash value' : 'Reward unavailable'}</span></span>
      {showClaim ? <button className="earn-primary earn-claim" disabled={busy || state === 'claiming'} aria-busy={state === 'claiming'} onClick={() => onClaim(row)}>{state === 'claiming' ? 'Claiming…' : configuredReward ? 'Claim Reward' : 'Claim Badge'}{state === 'ready' && <CircleCheck size={17} aria-hidden="true" />}</button>
      : state === 'claimed' ? <span className="earn-claimed"><CircleCheck size={17} aria-hidden="true" />{configuredReward ? 'Reward collected' : 'Badge collected'}</span>
      : (state === 'restricted' || state === 'unavailable') && <span className="earn-unavailable"><LockKeyhole size={14} aria-hidden="true" />Claim unavailable</span>}</div>
    <details className="earn-metric-explainer"><summary>What counts?</summary><p>{milestoneMetricNotes[row.metric] || 'Progress cannot be confirmed for this metric.'}{configuredReward && ' Claimed credit goes to Wallet, not withdrawable Earn cash.'}{restricted && ' Your account needs review before claiming.'}</p></details>
  </article>;
}
export function EarnMilestones({ achievements, restricted, stale, busy, claimingId, onClaim, retry }: {
  achievements: EarnAchievement[] | null; restricted: boolean; stale: boolean; busy: boolean;
  claimingId: string | null; onClaim: (row: EarnAchievement) => void; retry: () => void;
}) {
  const enabled = achievements?.filter(row => row.enabled) ?? [];
  const featured = featuredMilestone(enabled);
  const remaining = enabled.filter(row => row.id !== featured?.id);
  const claimed = enabled.filter(row => row.claimed).length;
  return <section className="earn-milestones" id="earn-milestones" aria-labelledby="earn-milestones-title">
    <div className="earn-section-heading"><div><p className="earn-eyebrow">Every step counts</p><h2 id="earn-milestones-title">Milestones worth reaching</h2></div><span className="earn-milestone-tally"><Award size={17} aria-hidden="true" />{achievements ? `${claimed} / ${enabled.length} collected` : 'Awaiting progress'}</span></div>
    {!achievements ? <div className="earn-milestone-empty"><Sparkles size={28} aria-hidden="true" /><h3>{stale ? 'Your progress is unavailable' : 'Loading your milestones…'}</h3><p>{stale ? 'We could not confirm your milestones. No reward eligibility is assumed.' : 'Checking your real achievement progress.'}</p>{stale && <button className="earn-secondary" onClick={retry}>Retry milestones</button>}</div>
      : !enabled.length ? <div className="earn-milestone-empty"><Award size={28} aria-hidden="true" /><h3>No milestones are enabled right now</h3><p>Your referral link and financial account remain available. New milestones appear here when configured.</p></div>
      : <>{!featured && <div className="earn-milestone-completion"><CircleCheck size={26} aria-hidden="true" /><div><h3>{claimed === enabled.length ? 'Every available milestone collected' : 'Progress needs confirmation'}</h3><p>{claimed === enabled.length ? 'Your confirmed achievements are below. No additional reward is promised.' : 'Refresh to check your next milestone.'}</p></div></div>}
        {featured && <EarnMilestoneCard key={featured.id} row={featured} featured restricted={restricted} stale={stale} busy={busy} claimingId={claimingId} onClaim={onClaim} />}
        {remaining.length > 0 && <div className="earn-milestone-grid">{remaining.map(row => <EarnMilestoneCard key={row.id} row={row} restricted={restricted} stale={stale} busy={busy} claimingId={claimingId} onClaim={onClaim} />)}</div>}
      </>}
  </section>;
}
