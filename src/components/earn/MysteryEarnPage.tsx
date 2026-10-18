import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, CircleDollarSign, Link2, MessageCircle, MousePointerClick, RefreshCw, ShieldCheck, TrendingUp, UserPlus, UserRoundCheck, Users, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FinancialPanel } from '../finance/FinancialPanel';
import { getActiveRewardRules, getMyReferralSummary, getMyRewardLedger, type PublicRewardRule, type RewardLedgerItem } from '../../services/apiClient';
import { createEarnDashboardRefresh } from '../../utils/earnDashboardRefresh';
import { activeEarnRules, earnNextStep, type EarnSummary } from '../../utils/earnExperience';
import { EarnSharing } from './EarnSharing';
import { EarnMetrics, EarnNetwork, EarnRewardActivity, EarnRules } from './EarnDetails';
import './earn.css';

export interface MysteryEarnPageProps { highestActiveReferralRewardMinor?: number | null }

function useEarnRules() {
  const [rules, setRules] = useState<PublicRewardRule[] | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let active = true;
    setError(false);
    getActiveRewardRules().then(result => {
      if (!result.success || !Array.isArray(result.rules)) throw new Error('Unavailable');
      if (active) { setRules(result.rules); setNow(Date.now()); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    // Update rule visibility at local date boundaries, without polling the API.
    const boundaries = rules?.flatMap(rule => [rule.starts_at, rule.ends_at].filter(Boolean).map(date => Date.parse(date!) + 1)).filter(time => time > now) || [];
    if (!boundaries.length) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(2_147_483_647, Math.min(...boundaries) - now));
    return () => window.clearTimeout(timer);
  }, [rules, now]);
  return { rules: rules ? activeEarnRules(rules, now) : null, error, retry: () => setRevision(value => value + 1) };
}

function MemberEarn({ token, name }: { token: string; name: string }) {
  const [summary, setSummary] = useState<EarnSummary | null>(null);
  const [ledger, setLedger] = useState<RewardLedgerItem[] | null>(null);
  const [state, setState] = useState({ refreshing: true, error: null as string | null, summaryError: false, ledgerError: false });
  const refresh = useRef<(() => Promise<void>) | null>(null);
  const rules = useEarnRules();
  useEffect(() => {
    const controller = createEarnDashboardRefresh({
      loadSummary: () => getMyReferralSummary(token), loadLedger: () => getMyRewardLedger(token, 50),
      onSummary: setSummary, onLedger: setLedger, onState: setState, window, document,
    });
    refresh.current = controller.refresh;
    void controller.refresh();
    return () => { controller.dispose(); refresh.current = null; };
  }, [token]);
  const loadingSummary = state.refreshing && !summary;
  return <main className="earn-page earn-member-page" aria-label="Mystery Earn dashboard">
    <FinancialPanel mode="earn" earnLayout={finance => <>
      <div className="earn-heading earn-area-heading"><div><p className="earn-eyebrow">{name}’s Mystery Earn</p><h1>Share what helps. See what it leads to.</h1><p role="status">{loadingSummary ? 'Checking your latest activity…' : earnNextStep(summary, finance.achievements, finance.stale, finance.restricted)}</p></div><button className="earn-secondary" disabled={state.refreshing} onClick={() => void refresh.current?.()}><RefreshCw size={16} aria-hidden="true" />{state.refreshing ? 'Refreshing…' : 'Refresh activity'}</button></div>
      {state.error && <div className="earn-alert earn-area-alert" role="alert">Some activity could not refresh. {summary || ledger ? 'Last available activity is shown below.' : 'Referral figures and reward activity have not been confirmed.'} <button className="earn-text-button" onClick={() => void refresh.current?.()}>Retry activity</button></div>}
      <div className="earn-area-share"><EarnSharing summary={summary} unavailable={state.summaryError} loading={loadingSummary} /></div>
      <div className="earn-area-snapshot"><EarnMetrics summary={summary} loading={loadingSummary} stale={state.summaryError} /></div>
      <div className="earn-area-milestones">{finance.milestones}</div>
      <div className="earn-area-balance earn-finance">{finance.balance}{finance.form}</div>
      <div className="earn-area-rules"><EarnRules {...rules} compact /></div>
      <section className="earn-section earn-area-records" aria-labelledby="earn-records"><h2 id="earn-records" className="sr-only">Activity and records</h2>
        <EarnRewardActivity ledger={ledger} loading={state.refreshing && !ledger} stale={state.ledgerError} />
        <EarnNetwork summary={summary} loading={loadingSummary} />
        {finance.history}
      </section>
      <div className="earn-area-help"><EarnHelp /></div>
    </>} />
  </main>;
}

function EarnHelp() {
  return <section className="earn-section" aria-labelledby="earn-help"><h2 id="earn-help">A few things worth knowing</h2><div className="earn-faq">
    <details><summary>Does every visit earn a reward?</summary><p>No. A visit can lead to a registration, but rewards require eligible qualifying activity under the active reward rules. Registrations and network members are not confirmed paying customers.</p></details>
    <details><summary>Does my own purchase earn me a referral reward?</summary><p>No. Referral rewards come from qualifying purchases by people you referred, not from your own orders.</p></details>
    <details><summary>Can future purchases earn rewards?</summary><p>A valid referral can remain linked without reopening your link. Future purchases qualify only when the service, account and active reward rules allow it.</p></details>
    <details><summary>Are achievements worth money?</summary><p>Most achievements are badges with no cash value. If an achievement carries a Wallet credit, the amount is shown before you claim it, and each achievement can be claimed once.</p></details>
    <details><summary>Why are approved rewards different from available earnings?</summary><p>Approved referral totals describe recorded rewards. Available Earnings comes from your financial account and accounts for transfers, reservations, withdrawals and other adjustments.</p></details>
    <details><summary>Can I withdraw money moved to Wallet?</summary><p>No. Moving earnings to Mystery Wallet is irreversible. Wallet funds pay for eligible Mystery Hub purchases and cannot be withdrawn back to Mobile Money.</p></details>
    <details><summary>Is Mystery Earn a way to make a living?</summary><p>No. Mystery Earn rewards genuine recommendations. Income is not guaranteed, and linked accounts in your network do not earn commissions on their own.</p></details>
  </div></section>;
}

/** Labelled sample of the member dashboard: no balances, counts or identities, only the shape of the experience. */
function EarnPreview() {
  return <figure className="earn-preview" aria-label="Example of the Mystery Earn dashboard">
    <figcaption><span>Example preview</span> Not real account data</figcaption>
    <div className="earn-preview-link"><Link2 size={15} aria-hidden="true" /><span>mysterybundlehub.com/?ref=<b>YOUR-CODE</b></span></div>
    <div className="earn-preview-actions"><span className="is-primary"><MessageCircle size={14} aria-hidden="true" />WhatsApp</span><span>Copy link</span></div>
    <div className="earn-preview-next"><span className="earn-medal earn-medal-sm" data-state="in-progress" data-tier="2" aria-hidden="true"><span className="earn-medal-face"><UserRoundCheck size={16} /></span></span><div><p>Next achievement · example</p><strong>Community Starter</strong><span className="earn-preview-bar"><i /></span><small>2 of 3 rewarded referrals</small></div></div>
    <div className="earn-preview-shelf" aria-hidden="true">{[UserRoundCheck, Users, Link2, TrendingUp].map((Icon, index) => <span key={index} className="earn-medal earn-medal-sm" data-state={index < 2 ? 'claimed' : 'not-started'} data-tier={index + 1}><span className="earn-medal-face"><Icon size={15} /></span></span>)}<em>Badges you collect</em></div>
  </figure>;
}

function GuestEarn() {
  const { openAuth, setActivePage } = useApp();
  const rules = useEarnRules();
  const stages = [
    { icon: Link2, title: 'You get a free personal link', detail: 'Created with your account. No fee to join.', earns: false },
    { icon: MousePointerClick, title: 'A friend opens your link', detail: 'Tracked as a visit. No reward.', earns: false },
    { icon: UserPlus, title: 'They create an account', detail: 'Linked to you. No reward on its own.', earns: false },
    { icon: BadgeCheck, title: 'They complete a qualifying purchase', detail: 'A reward can be recorded under the active rules.', earns: true },
    { icon: Wallet, title: 'Approved rewards become usable', detail: 'Withdraw to Mobile Money or move to Wallet, subject to limits.', earns: true },
  ];
  const achievementTypes = [
    { icon: UserRoundCheck, title: 'Rewarded referrals', detail: 'Purchases by people you referred that earned an approved reward.' },
    { icon: Link2, title: 'AFA referrals', detail: 'Approved rewards from MTN AFA registrations you introduced.' },
    { icon: Users, title: 'Link reach', detail: 'Distinct browsers that opened your link. Not verified people, and never paid.' },
    { icon: CircleDollarSign, title: 'Approved rewards', detail: 'Milestones in the total of your approved referral rewards.' },
  ];
  return <main className="earn-page earn-guest-page" aria-label="About Mystery Earn">
    <section className="earn-guest-hero"><div className="earn-guest-copy"><p className="earn-eyebrow">Mystery Earn · Free to join</p><h1>Share what’s useful.<br /><span>Get rewarded when it counts.</span></h1><p>Send friends your personal Mystery Hub link for data, AFA registration and more. When someone you referred completes an eligible purchase, you could earn a referral reward and collect achievements along the way.</p><div className="earn-actions"><button className="earn-primary" onClick={() => openAuth('signup')}>Create a Free Account <ArrowRight size={18} aria-hidden="true" /></button><button className="earn-secondary" onClick={() => openAuth('login')}>I already have an account</button></div><p className="earn-fine"><ShieldCheck size={16} aria-hidden="true" /> Free to join. No reward for clicks alone. Eligibility applies.</p></div><EarnPreview /></section>
    <section className="earn-section earn-stages" aria-labelledby="earn-stages-title"><p className="earn-eyebrow">How it works</p><h2 id="earn-stages-title">From a shared link to a real reward</h2><ol className="earn-stage-list">{stages.map((stage, index) => <li key={stage.title} data-earns={stage.earns}><span className="earn-stage-icon"><stage.icon size={18} aria-hidden="true" /></span><div><h3><span className="sr-only">Step {index + 1}: </span>{stage.title}</h3><p>{stage.detail}</p></div></li>)}</ol></section>
    <div className="earn-guest-grid"><EarnRules {...rules} /><section className="earn-section earn-friend-value" aria-labelledby="earn-friend-title"><p className="earn-eyebrow">Why friends say thanks</p><h2 id="earn-friend-title">You’re sharing something they can use</h2><ul><li>Data bundles for MTN, Telecel and AirtelTigo, paid with Mobile Money.</li><li>Orders they can track until delivery, with WhatsApp support.</li><li>MTN AFA registration with status updates.</li><li>A free Website Builder for their business.</li></ul><button className="earn-text-button" onClick={() => setActivePage('home')}>Explore Mystery Hub <ArrowRight size={16} aria-hidden="true" /></button></section></div>
    <section className="earn-section earn-achievement-types" aria-labelledby="earn-types-title"><p className="earn-eyebrow">Achievements</p><h2 id="earn-types-title">Progress you can collect</h2><p>Members see real achievements based on server-confirmed activity. Each one shows whether it is a badge or carries a Wallet credit before it is claimed.</p><ul>{achievementTypes.map((type, index) => <li key={type.title}><span className="earn-medal earn-medal-md" data-state="in-progress" data-tier={index + 1} aria-hidden="true"><span className="earn-medal-face"><type.icon size={20} /></span></span><div><h3>{type.title}</h3><p>{type.detail}</p></div></li>)}</ul></section>
    <EarnHelp />
    <section className="earn-guest-cta"><div><h2>Your link is one sign-up away.</h2><p>Free to join. Your referral code is created with your account.</p></div><button className="earn-primary" onClick={() => openAuth('signup')}>Create a Free Account <ArrowRight size={18} aria-hidden="true" /></button></section>
  </main>;
}

export const MysteryEarnPage: React.FC<MysteryEarnPageProps> = () => {
  const { user, sessionToken, isAuthChecking } = useApp();
  if (isAuthChecking) return <main className="earn-page" aria-busy="true"><p role="status">Loading Mystery Earn…</p><div className="earn-loading-block" /></main>;
  // Remount account-owned state before rendering another session, including late requests/forms.
  if (user && sessionToken) return <MemberEarn key={`${user.id}:${sessionToken}`} token={sessionToken} name={user.name?.trim().split(' ')[0] || 'friend'} />;
  return <GuestEarn />;
};
