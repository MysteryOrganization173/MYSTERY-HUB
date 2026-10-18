import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Award, Check, CircleCheck, Gift, Link2, LockKeyhole, Sparkles, TrendingUp, Users, UserRoundCheck } from 'lucide-react';
import { formatGhs } from '../../../shared/money';
import { groupMilestones, milestoneLevel, milestoneMetricLabels, milestoneMetricNotes, milestoneProgress, milestoneRemaining, milestoneState, milestoneValue, type AchievementMetric, type EarnAchievement, type MilestoneState } from '../../utils/earnMilestones';

const metricIcons = { successful_referrals: UserRoundCheck, qualified_visitors: Users, afa_referrals: Link2, lifetime_earnings: TrendingUp };
const stateLabels: Record<MilestoneState, string> = { unavailable: 'Unavailable', claimed: 'Claimed', restricted: 'Restricted', claiming: 'Claiming…', ready: 'Ready to claim', 'not-started': 'Not started', 'in-progress': 'In progress' };
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
/** Collectible badge face. Tier colour follows the level within a metric family; it carries no monetary meaning. */
export function EarnMedal({ metric, state, level, size = 'md', fresh = false }: { metric: AchievementMetric; state: MilestoneState; level: { level: number; of: number } | null; size?: 'sm' | 'md' | 'lg'; fresh?: boolean }) {
  const Icon = metricIcons[metric] || Award;
  return <span className={`earn-medal earn-medal-${size}${fresh ? ' earn-medal-fresh' : ''}`} data-state={state} data-tier={Math.min(level?.level ?? 1, 4)} aria-hidden="true">
    <span className="earn-medal-face"><Icon size={size === 'lg' ? 26 : size === 'sm' ? 16 : 21} /></span>
    {level && level.of > 1 && <span className="earn-medal-level">{level.level}</span>}
  </span>;
}
export function EarnMilestoneCard({ row, rows, featured = false, restricted, stale, busy, claimingId, onClaim }: {
  row: EarnAchievement; rows?: EarnAchievement[]; featured?: boolean; restricted: boolean; stale: boolean; busy: boolean;
  claimingId: string | null; onClaim: (row: EarnAchievement) => void;
}) {
  const progress = milestoneProgress(row);
  const state = milestoneState(row, { restricted, stale, claimingId });
  const titleId = React.useId();
  const configuredReward = Number.isSafeInteger(row.rewardMinor) && row.rewardMinor > 0;
  const rewardKnown = Number.isSafeInteger(row.rewardMinor) && row.rewardMinor >= 0;
  const percentage = progress ? Math.floor(progress.percentage) : null;
  const showClaim = state === 'ready' || state === 'claiming';
  const level = milestoneLevel(row, rows || [row]);
  return <article className={`earn-milestone earn-milestone-${state} ${featured ? 'earn-milestone-featured' : ''}`} aria-labelledby={titleId} data-milestone-id={row.id} data-state={state}>
    <div className="earn-milestone-top"><EarnMedal metric={row.metric} state={state} level={level} size={featured ? 'lg' : 'md'} /><div>
      <p className="earn-milestone-kicker">{featured ? (state === 'ready' || state === 'claiming' ? 'Ready to collect' : 'Your next achievement') : milestoneMetricLabels[row.metric]}{level && level.of > 1 ? ` · Level ${level.level} of ${level.of}` : ''}</p>
      <h3 id={titleId}>{row.name}</h3></div><span className="earn-milestone-state">{state === 'claimed' && <Check size={13} aria-hidden="true" />}{stateLabels[state]}</span></div>
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
/** Compact in-progress row: enough to see the gap, without a full card per achievement. */
function EarnMilestoneRow({ row, rows, restricted, stale }: { row: EarnAchievement; rows: EarnAchievement[]; restricted: boolean; stale: boolean }) {
  const progress = milestoneProgress(row);
  const state = milestoneState(row, { restricted, stale });
  const configuredReward = Number.isSafeInteger(row.rewardMinor) && row.rewardMinor > 0;
  const level = milestoneLevel(row, rows);
  const percentage = progress ? Math.floor(progress.percentage) : null;
  return <li className="earn-milestone-row" data-milestone-id={row.id} data-state={state}>
    <EarnMedal metric={row.metric} state={state} level={level} size="sm" />
    <div className="earn-milestone-row-body">
      <div className="earn-milestone-row-head"><h4>{row.name}</h4><span className="earn-milestone-row-count">{progress ? <>{milestoneValue(row.progress, row.metric)}<span> / {milestoneValue(row.threshold, row.metric)}</span></> : 'Unconfirmed'}</span></div>
      <EarnProgressBar percentage={stale ? null : progress?.percentage ?? null} label={`${row.name} progress`} valueText={progress ? `${milestoneValue(row.progress, row.metric)} of ${milestoneValue(row.threshold, row.metric)}; ${percentage}% complete` : 'Progress unavailable'} />
      <p>{milestoneMetricLabels[row.metric]} · {stale ? 'Last confirmed progress' : progress ? milestoneRemaining(row) : 'Progress unavailable'} · {configuredReward ? `${formatGhs(row.rewardMinor)} Wallet credit` : 'Badge only'}</p>
    </div>
  </li>;
}
export function EarnMilestones({ achievements, restricted, stale, busy, claimingId, onClaim, retry }: {
  achievements: EarnAchievement[] | null; restricted: boolean; stale: boolean; busy: boolean;
  claimingId: string | null; onClaim: (row: EarnAchievement) => void; retry: () => void;
}) {
  const { enabled, featured, ready, active, collected } = groupMilestones(achievements ?? []);
  const claimed = enabled.filter(row => row.claimed).length;
  // Celebrate only a claim confirmed during this visit; a reload shows the collection without replaying it.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  useEffect(() => {
    if (!achievements) return;
    const ids = new Set(achievements.filter(row => row.claimed).map(row => row.id));
    if (seen.current) { const added = [...ids].filter(id => !seen.current!.has(id)); if (added.length) setFresh(added); }
    seen.current = ids;
  }, [achievements]);
  const shownActive = active.slice(0, 3), moreActive = active.slice(3);
  const metrics = [...new Set(enabled.map(row => row.metric))];
  return <section className="earn-milestones" id="earn-milestones" aria-labelledby="earn-milestones-title">
    <div className="earn-section-heading"><div><p className="earn-eyebrow">Achievements</p><h2 id="earn-milestones-title">Progress worth collecting</h2></div><span className="earn-milestone-tally"><Award size={17} aria-hidden="true" />{achievements ? `${claimed} / ${enabled.length} collected` : 'Awaiting progress'}</span></div>
    {!achievements ? <div className="earn-milestone-empty"><Sparkles size={28} aria-hidden="true" /><h3>{stale ? 'Your progress is unavailable' : 'Loading your milestones…'}</h3><p>{stale ? 'We could not confirm your milestones. No reward eligibility is assumed.' : 'Checking your real achievement progress.'}</p>{stale && <button className="earn-secondary" onClick={retry}>Retry milestones</button>}</div>
      : !enabled.length ? <div className="earn-milestone-empty"><Award size={28} aria-hidden="true" /><h3>No milestones are enabled right now</h3><p>Your referral link and financial account remain available. New milestones appear here when configured.</p></div>
      : <>{!featured && <div className="earn-milestone-completion"><CircleCheck size={26} aria-hidden="true" /><div><h3>{claimed === enabled.length ? 'Every available milestone collected' : 'Progress needs confirmation'}</h3><p>{claimed === enabled.length ? 'Your confirmed achievements are below. No additional reward is promised.' : 'Refresh to check your next milestone.'}</p></div></div>}
        {featured && <EarnMilestoneCard key={featured.id} row={featured} rows={enabled} featured restricted={restricted} stale={stale} busy={busy} claimingId={claimingId} onClaim={onClaim} />}
        {ready.length > 0 && <div className="earn-milestone-group"><h3 className="earn-group-title">Also ready to claim</h3><div className="earn-milestone-grid">{ready.map(row => <EarnMilestoneCard key={row.id} row={row} rows={enabled} restricted={restricted} stale={stale} busy={busy} claimingId={claimingId} onClaim={onClaim} />)}</div></div>}
        {active.length > 0 && <div className="earn-milestone-group"><h3 className="earn-group-title">In progress</h3><ul className="earn-milestone-rows">{shownActive.map(row => <EarnMilestoneRow key={row.id} row={row} rows={enabled} restricted={restricted} stale={stale} />)}</ul>
          {moreActive.length > 0 && <details className="earn-more"><summary>Show {moreActive.length} more {moreActive.length === 1 ? 'achievement' : 'achievements'}</summary><ul className="earn-milestone-rows">{moreActive.map(row => <EarnMilestoneRow key={row.id} row={row} rows={enabled} restricted={restricted} stale={stale} />)}</ul></details>}</div>}
        {collected.length > 0 && <div className="earn-milestone-group"><h3 className="earn-group-title">Collected</h3><ul className="earn-collection" aria-label="Collected achievements">{collected.map(row => {
          const configuredReward = Number.isSafeInteger(row.rewardMinor) && row.rewardMinor > 0;
          return <li key={row.id} data-milestone-id={row.id} data-state="claimed"><EarnMedal metric={row.metric} state="claimed" level={milestoneLevel(row, enabled)} size="md" fresh={fresh.includes(row.id)} /><span className="earn-collection-name">{row.name}</span><span className="earn-collection-meta">{configuredReward ? `${formatGhs(row.rewardMinor)} Wallet credit · Reward collected` : 'Badge collected'}</span></li>;
        })}</ul></div>}
        <details className="earn-metric-explainer earn-metrics-legend"><summary>How achievement progress is counted</summary><dl>{metrics.map(metric => <div key={metric}><dt>{milestoneMetricLabels[metric]}</dt><dd>{milestoneMetricNotes[metric]}</dd></div>)}</dl><p>Progress comes from the server. Badges recognise progress and have no cash value unless a Wallet credit is shown before you claim.</p></details>
      </>}
  </section>;
}
