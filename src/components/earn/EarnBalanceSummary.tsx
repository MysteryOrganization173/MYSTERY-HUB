import React from 'react';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { formatGhs } from '../../../shared/money';
export interface EarnFinanceSummary {
  restricted: boolean;
  earn: { availableMinor: number; pendingMinor: number; reservedMinor: number; lifetimeMinor: number; withdrawnMinor: number };
  settings: { withdrawalMinimumMinor: number; withdrawalFeeBps: number };
}
export function EarnBalanceSummary({ data, error, notice, busy, refresh, withdraw, transfer }: {
  data: EarnFinanceSummary | null; error: string; notice: string; busy: boolean;
  refresh: () => void; withdraw: () => void; transfer: () => void;
}) {
  const unavailable = !data || !!error;
  const restricted = !!data?.restricted;
  return <section className="earn-balance-summary" id="earn-available" aria-labelledby="earn-balance-title">
    <div className="earn-balance-heading"><span className="earn-eyebrow"><ShieldCheck size={15} aria-hidden="true" /> Your financial account</span><button className="earn-refresh-icon" onClick={refresh} disabled={busy} aria-label="Refresh earnings"><RefreshCw size={17} aria-hidden="true" /><span className="sr-only">Refresh</span></button></div>
    <h2 id="earn-balance-title">Available Earnings</h2><p className="earn-balance-value">{data ? formatGhs(data.earn.availableMinor) : error ? 'Unavailable' : 'Checking…'}</p>
    {error && <p role="alert" className="earn-finance-error">{error}{data ? ' Last available financial values. Refresh successfully before requesting a withdrawal or transfer.' : ' Balance unavailable. Refresh to try again.'}</p>}
    {notice && <p role="status" className="earn-finance-notice">{notice}</p>}
    {restricted && <p className="earn-finance-error">Your account needs a review by our team. Payments and cash-out may be temporarily unavailable.</p>}
    {data && <><div className="earn-balance-actions"><button className="earn-secondary" disabled={busy || restricted || unavailable || data.earn.availableMinor < data.settings.withdrawalMinimumMinor} onClick={withdraw} aria-label="Withdraw Earnings"><ArrowUpRight size={16} aria-hidden="true" />Withdraw</button><button className="earn-secondary" disabled={busy || restricted || unavailable || data.earn.availableMinor <= 0} onClick={transfer}><ArrowDownLeft size={16} aria-hidden="true" />Move to Wallet</button></div>
      {data.earn.availableMinor === 0 ? <p className="earn-balance-hint">Qualifying activity can earn rewards. Visits alone do not.</p> : data.earn.availableMinor < data.settings.withdrawalMinimumMinor ? <p className="earn-balance-hint">{formatGhs(data.settings.withdrawalMinimumMinor - data.earn.availableMinor)} more to reach the {formatGhs(data.settings.withdrawalMinimumMinor)} cash-out minimum.</p> : <p className="earn-balance-hint">Cash-out minimum {formatGhs(data.settings.withdrawalMinimumMinor)} · {data.settings.withdrawalFeeBps / 100}% processing fee</p>}
      <details className="earn-balance-breakdown"><summary>Earnings breakdown</summary><dl>{[['Pending', data.earn.pendingMinor], ['Reserved', data.earn.reservedMinor], ['Lifetime Earned', data.earn.lifetimeMinor], ['Total Withdrawn', data.earn.withdrawnMinor]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatGhs(Number(value))}</dd></div>)}</dl><p>Referral totals are records; this available balance accounts for transfers, reservations and withdrawals.</p></details></>}
  </section>;
}
