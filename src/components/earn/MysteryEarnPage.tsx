import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, RefreshCw, Share2, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FinancialPanel } from '../finance/FinancialPanel';
import { getActiveRewardRules, getMyReferralSummary, getMyRewardLedger, type PublicRewardRule, type RewardLedgerItem } from '../../services/apiClient';
import { createEarnDashboardRefresh } from '../../utils/earnDashboardRefresh';
import { activeEarnRules, type EarnSummary } from '../../utils/earnExperience';
import { getCloudinaryUrl } from '../../utils/cloudinary';
import { EarnSharing } from './EarnSharing';
import { EarnMetrics, EarnRewardActivity, EarnRules, EarnHowItWorks } from './EarnDetails';
import './earn.css';

const artwork = 'https://res.cloudinary.com/da6oeat7m/image/upload/v1790940221/Neon_Rewards_Network_with_Gift_Box_ueitrt.png';
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
  return <main className="earn-page earn-member-page" aria-label="Mystery Earn dashboard">
    <div className="earn-heading"><div><p className="earn-eyebrow">{name}’s rewards</p><h1>Your Mystery Earn</h1><p>Share something useful. See your progress.</p></div><button className="earn-secondary" disabled={state.refreshing} onClick={() => void refresh.current?.()}><RefreshCw size={16} aria-hidden="true" />{state.refreshing ? 'Refreshing…' : 'Refresh activity'}</button></div>
    {state.error && <div className="earn-alert" role="alert">Some activity could not refresh. {summary || ledger ? 'Last available activity is shown below.' : 'Referral figures and reward activity have not been confirmed.'} <button className="earn-text-button" onClick={() => void refresh.current?.()}>Retry activity</button></div>}
    <div className="earn-top-grid"><EarnSharing summary={summary} unavailable={state.summaryError} loading={state.refreshing && !summary} /><FinancialPanel mode="earn" /></div>
    <EarnMetrics summary={summary} loading={state.refreshing && !summary} stale={state.summaryError} />
    <EarnRewardActivity ledger={ledger} loading={state.refreshing && !ledger} stale={state.ledgerError} />
    <div className="earn-info-grid"><EarnRules {...rules} /><EarnHowItWorks /></div>
    <EarnSharing summary={summary} unavailable={state.summaryError} loading={state.refreshing && !summary} servicesOnly />
    <EarnHelp />
  </main>;
}

function EarnHelp() {
  return <section className="earn-section" aria-labelledby="earn-help"><h2 id="earn-help">A few things worth knowing</h2><div className="earn-faq">
    <details><summary>Does every visit earn a reward?</summary><p>No. A visit can lead to a registration, but rewards require eligible qualifying activity under the active reward rules. Registrations and network members are not confirmed paying customers.</p></details>
    <details><summary>Can future purchases earn rewards?</summary><p>A valid referral can remain linked without reopening your link. Future purchases qualify only when the service, account and active reward rules allow it.</p></details>
    <details><summary>Why are approved rewards different from available earnings?</summary><p>Approved referral totals describe recorded rewards. Available Earnings comes from your financial account and accounts for transfers, reservations, withdrawals and other adjustments.</p></details>
    <details><summary>Can I withdraw money moved to Wallet?</summary><p>No. Moving earnings to Mystery Wallet is irreversible. Wallet funds pay for eligible Mystery Hub purchases and cannot be withdrawn back to Mobile Money.</p></details>
  </div></section>;
}

function GuestEarn() {
  const { openAuth } = useApp();
  const rules = useEarnRules();
  return <main className="earn-page" aria-label="About Mystery Earn">
    <section className="earn-guest-hero"><div><p className="earn-eyebrow">Mystery Earn</p><h1>Good things are<br /><span>better shared.</span></h1><p>Introduce someone to Mystery Hub. When they complete an eligible purchase, you could earn a referral reward.</p><div className="earn-actions"><button className="earn-primary" onClick={() => openAuth('signup')}>Create a Free Account <ArrowRight size={18} aria-hidden="true" /></button><a className="earn-secondary" href="#how-it-works-section">How It Works <ArrowDown size={16} aria-hidden="true" /></a></div><p className="earn-fine"><ShieldCheck size={16} aria-hidden="true" /> Free to join. No reward for clicks alone. Eligibility applies.</p></div><img src={getCloudinaryUrl(artwork, { width: 640, quality: 'auto', format: 'auto' })} alt="" aria-hidden="true" width="640" height="480" /></section>
    <EarnHowItWorks /><EarnRules {...rules} />
    <section className="earn-section earn-discover"><Share2 size={24} aria-hidden="true" /><div><h2>One link. Useful services to explore.</h2><p>Data bundles, digital services, Marketplace discovery and the Free Website Builder. Sharing a service does not automatically make it reward-eligible. Marketplace enquiries and free websites are not paid qualifying purchases.</p></div><a className="earn-secondary" href="/">Explore Mystery Hub <ArrowRight size={16} aria-hidden="true" /></a></section>
    <EarnHelp />
  </main>;
}

export const MysteryEarnPage: React.FC<MysteryEarnPageProps> = () => {
  const { user, sessionToken, isAuthChecking } = useApp();
  if (isAuthChecking) return <main className="earn-page" aria-busy="true"><p role="status">Loading Mystery Earn…</p><div className="earn-loading-block" /></main>;
  // Remount account-owned state before rendering another session, including late requests/forms.
  if (user && sessionToken) return <MemberEarn key={`${user.id}:${sessionToken}`} token={sessionToken} name={user.name?.trim().split(' ')[0] || 'friend'} />;
  return <GuestEarn />;
};
