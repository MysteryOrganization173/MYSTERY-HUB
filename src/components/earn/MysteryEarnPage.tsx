import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Gift, MessageCircle, RefreshCw, ShieldCheck, UserPlus, Wallet } from 'lucide-react';
import { BrandMark } from '../common/BrandLogo';
import { formatGhs } from '../../../shared/money';
import { useApp } from '../../context/AppContext';
import { FinancialPanel } from '../finance/FinancialPanel';
import { getActiveRewardRules, getMyReferralSummary, getMyRewardLedger, type PublicRewardRule, type RewardLedgerItem } from '../../services/apiClient';
import { createEarnDashboardRefresh } from '../../utils/earnDashboardRefresh';
import { activeEarnRules, earnNextStep, earnShareTopics, type EarnSummary } from '../../utils/earnExperience';
import { earnHeroImage } from '../../utils/earnHero';
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
      <div className="earn-heading earn-area-heading"><div><p className="earn-eyebrow">{name}’s Mystery Earn</p><h1>Share with friends. Earn rewards.</h1><p className="earn-heading-lede">Invite friends to Mystery Hub. When they make a qualifying purchase, you earn a referral reward.</p><p className="earn-next" role="status">{loadingSummary ? 'Checking your latest activity…' : earnNextStep(summary, finance.achievements, finance.stale, finance.restricted)}</p></div><button className="earn-secondary earn-refresh" disabled={state.refreshing} onClick={() => void refresh.current?.()} aria-label="Refresh activity"><RefreshCw size={16} aria-hidden="true" /><span>{state.refreshing ? 'Refreshing…' : 'Refresh'}</span></button></div>
      {state.error && <div className="earn-alert earn-area-alert" role="alert">Some activity could not refresh. {summary || ledger ? 'Last available activity is shown below.' : 'Referral figures and reward activity have not been confirmed.'} <button className="earn-text-button" onClick={() => void refresh.current?.()}>Retry activity</button></div>}
      <div className="earn-area-summary"><EarnMoneyStrip availableMinor={finance.availableMinor} financeError={finance.financeError} summary={summary} loading={loadingSummary} /></div>
      <div className="earn-area-share"><EarnSharing summary={summary} unavailable={state.summaryError} loading={loadingSummary} /></div>
      <div className="earn-area-milestones">{finance.milestones}</div>
      <div className="earn-area-snapshot"><EarnMetrics summary={summary} loading={loadingSummary} stale={state.summaryError} /></div>
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

/** Real money first, in one line: the financial account's available balance and recorded pending rewards. Never summed. */
function EarnMoneyStrip({ availableMinor, financeError, summary, loading }: { availableMinor: number | null; financeError: boolean; summary: EarnSummary | null; loading: boolean }) {
  const pending = summary && Number.isSafeInteger(summary.pendingRewardsMinor) ? summary.pendingRewardsMinor : null;
  return <section className="earn-money-strip" aria-label="Your earnings at a glance">
    <div><span>Available Earnings</span><strong className={availableMinor === null ? 'earn-metric-unknown' : undefined}>{availableMinor !== null ? formatGhs(availableMinor) : financeError ? 'Unavailable' : 'Checking…'}</strong>{financeError && availableMinor !== null && <small>Last available</small>}</div>
    <div><span>Pending</span><strong className={pending === null ? 'earn-metric-unknown' : undefined}>{pending !== null ? formatGhs(pending) : loading ? 'Checking…' : 'Unavailable'}</strong><small>Not usable yet</small></div>
    <a href="#earn-available" className="earn-money-link">Withdraw or move to Wallet <ArrowRight size={15} aria-hidden="true" /></a>
  </section>;
}

function EarnHelp() {
  return <section className="earn-section" aria-labelledby="earn-help"><h2 id="earn-help">Questions people ask</h2><div className="earn-faq">
    <details><summary>Do I earn when someone opens my link or signs up?</summary><p>No. Visits and sign-ups are a good start, but a reward comes only when someone you referred makes a qualifying purchase.</p></details>
    <details><summary>Does my own purchase earn a referral reward?</summary><p>No. Referral rewards come from purchases by people you referred, not from your own orders.</p></details>
    <details><summary>Do later purchases by the same friend count?</summary><p>They can. Your friend stays linked to you, and later purchases earn a reward when the active rules cover them.</p></details>
    <details><summary>How do I get my money?</summary><p>Approved rewards add to your Available Earnings. You can withdraw to Mobile Money once you reach the minimum, or move earnings to Mystery Wallet. Moving to Wallet is irreversible, and Wallet funds pay for Mystery Hub purchases and cannot be withdrawn back to Mobile Money.</p></details>
    <details><summary>Are badges worth money?</summary><p>No. A milestone pays only when it shows a Wallet credit amount before you claim it, and each one can be claimed once. Badges on their own have no cash value.</p></details>
    <details><summary>Is this a way to make a living?</summary><p>No. Mystery Earn rewards genuine recommendations. Income is not guaranteed, and people in your network do not earn you anything unless they make qualifying purchases.</p></details>
  </div></section>;
}

function EarnHeroArt() {
  const [failed, setFailed] = useState(false);
  // Decorative only: every word and action in the hero is real HTML. On failure the dark branded backdrop remains.
  return <div className="earn-hero-art" aria-hidden="true" data-failed={failed || undefined}>
    {!failed && <picture>
      <source media="(max-width: 767px)" srcSet={earnHeroImage.mobile} sizes="100vw" />
      <img src={earnHeroImage.fallback} srcSet={earnHeroImage.desktop} sizes="(min-width: 1180px) 1180px, 100vw" alt="" width={1672} height={941}
        fetchPriority="high" loading="eager" decoding="async" onError={() => setFailed(true)} />
    </picture>}
  </div>;
}

/** Working demonstration of the sharing studio for guests: the service chips really switch the message; sharing asks them to join. */
function EarnShareDemo() {
  const { openAuth } = useApp();
  const [topicId, setTopicId] = useState<string>('data');
  const topic = earnShareTopics.find(item => item.id === topicId) || earnShareTopics[0];
  return <figure className="earn-demo" aria-labelledby="earn-demo-title">
    <figcaption className="earn-demo-head"><span id="earn-demo-title">Try it: pick what to share</span><span className="earn-demo-tag">Demo</span></figcaption>
    <fieldset className="earn-topics"><legend className="sr-only">Choose a service for the example message</legend><div role="radiogroup" aria-label="Choose a service for the example message">{earnShareTopics.map(item => <label key={item.id} className={item.id === topic.id ? 'is-active' : undefined}><input type="radio" name="earn-demo-topic" value={item.id} checked={item.id === topic.id} onChange={() => setTopicId(item.id)} /><span>{item.short}</span></label>)}</div></fieldset>
    <div className="earn-demo-bubble" aria-live="polite"><p>{topic.message} Here’s my link:</p>
      <div className="earn-demo-link"><span className="earn-demo-link-mark"><BrandMark size="sm" ariaHidden /></span><div><strong>Mystery Hub</strong><span>mysterybundlehub.com{topic.path === '/' ? '' : topic.path}?ref=<b>YOUR-CODE</b></span></div></div></div>
    <div className="earn-demo-actions"><button className="earn-primary" onClick={() => openAuth('signup')}><MessageCircle size={17} aria-hidden="true" />Create account to share</button><button className="earn-text-button" onClick={() => openAuth('login')}>I have an account</button></div>
    <p className="earn-demo-note">Example only. Your real link and code are created with your free account.</p>
  </figure>;
}

function GuestEarn() {
  const { openAuth } = useApp();
  const rules = useEarnRules();
  const steps = [
    { icon: UserPlus, title: 'Join free', detail: 'Create an account and get your personal link.' },
    { icon: MessageCircle, title: 'Share', detail: 'Send it on WhatsApp to friends who need data, AFA or a website.' },
    { icon: Wallet, title: 'Earn when purchases qualify', detail: 'Withdraw approved rewards to Mobile Money or use them in Mystery Wallet.' },
  ];
  return <main className="earn-page earn-guest-page" aria-label="About Mystery Earn">
    <section className="earn-guest-hero" aria-labelledby="earn-guest-title"><EarnHeroArt />
      <div className="earn-guest-copy"><p className="earn-hero-pill"><Gift size={14} aria-hidden="true" />Mystery Earn · Free to join</p>
        <h1 id="earn-guest-title">Share Mystery Hub.<br /><span>Earn real rewards.</span></h1>
        <p className="earn-hero-lede">Invite friends to useful digital services. Earn a referral reward when their purchases qualify, then withdraw it or spend it.</p>
        <div className="earn-actions"><button className="earn-primary earn-hero-cta" onClick={() => openAuth('signup')}>Create a Free Account <ArrowRight size={18} aria-hidden="true" /></button><a className="earn-secondary earn-hero-secondary" href="#earn-how">How It Works</a></div>
        <p className="earn-fine"><ShieldCheck size={16} aria-hidden="true" /> Free to join. No reward for clicks alone. Rewards come from an eligible purchase.</p></div>
    </section>
    <section className="earn-how" id="earn-how" aria-labelledby="earn-steps-title"><div className="earn-how-copy"><p className="earn-eyebrow">How it works</p><h2 id="earn-steps-title">Three steps. Your friends get something useful.</h2>
      <ol className="earn-steps">{steps.map((step, index) => <li key={step.title}><span className="earn-step-icon"><step.icon size={18} aria-hidden="true" /></span><div><h3><span className="earn-step-number">{index + 1}</span>{step.title}</h3><p>{step.detail}</p></div></li>)}</ol></div>
      <EarnShareDemo /></section>
    <EarnRules {...rules} />
    <EarnHelp />
    <section className="earn-guest-cta"><div><h2>Get your link in a minute.</h2><p>Free to join. Your referral code is created with your account.</p></div><button className="earn-primary" onClick={() => openAuth('signup')}>Create a Free Account <ArrowRight size={18} aria-hidden="true" /></button></section>
  </main>;
}

export const MysteryEarnPage: React.FC<MysteryEarnPageProps> = () => {
  const { user, sessionToken, isAuthChecking } = useApp();
  if (isAuthChecking) return <main className="earn-page" aria-busy="true"><p role="status">Loading Mystery Earn…</p><div className="earn-loading-block" /></main>;
  // Remount account-owned state before rendering another session, including late requests/forms.
  if (user && sessionToken) return <MemberEarn key={`${user.id}:${sessionToken}`} token={sessionToken} name={user.name?.trim().split(' ')[0] || 'friend'} />;
  return <GuestEarn />;
};
