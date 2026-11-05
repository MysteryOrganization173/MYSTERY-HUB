import React, { useEffect, useState } from 'react';
import type { ShieldAdminView } from '../../../../shared/mysteryShield';
import { API_BASE_URL } from '../../../services/apiClient';

const money = (amount: number | null) => amount === null ? 'Unconfigured' : 'GH₵' + (amount / 100).toFixed(2);

export function ShieldAdminReport({ report }: { report: ShieldAdminView }) {
  return (
    <div className="space-y-3 break-words text-sm text-slate-300">
      <p>Live fulfillment held pending verification of an MTN 400MB package and its current cost.</p>
      <p>Storage {report.storageReady ? 'installed' : 'awaiting separate installation'} · intake {report.paused ? 'paused' : 'unpaused'}</p>
      <p>Visibility {report.visible ? 'on' : 'off'} · intake setting {report.intakeRequested ? 'on' : 'off'} · fulfillment setting {report.fulfillmentRequested ? 'on' : 'off'} · alerts setting {report.notificationsRequested ? 'on' : 'off'}</p>
      <p>Programme start {report.startsAt ?? 'unconfigured'} · end {report.endsAt ?? 'unconfigured'}</p>
      <p>Limits per claim {money(report.perClaimLimitMinor)} · daily {money(report.dailyLimitMinor)} · total {money(report.totalLimitMinor)}</p>
      <p>Reserved today {money(report.reservedTodayMinor)} · total {money(report.reservedMinor)} · confirmed reward cost {money(report.confirmedSpendMinor)}</p>
      {report.totalLimitMinor !== null && <p>Remaining total allocation {money(Math.max(0, report.totalLimitMinor - report.reservedMinor))}</p>}
      <p>Submitted {report.counts.submitted ?? 0} · delivered {report.counts.delivered ?? 0} · uncertain {report.counts.uncertain ?? 0} · failed {report.counts.failed ?? 0}</p>
      {report.claims.length ? (
        <ul className="space-y-2" aria-label="Recent Shield claims">
          {report.claims.map(claim => <li className="rounded-lg bg-slate-900 p-2" key={claim.reference}>
            {claim.reference} · {claim.state} · {money(claim.reservedMinor)} reserved
          </li>)}
        </ul>
      ) : <p>No claim records.</p>}
    </div>
  );
}

export function AdminShield({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<ShieldAdminView | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [pausing, setPausing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setError('');
    fetch(API_BASE_URL + '/api/admin/shield', {
      headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: controller.signal,
    }).then(response => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then(value => {
      if (!controller.signal.aborted) setReport(value);
    }).catch(() => {
      if (!controller.signal.aborted) setError('Shield diagnostics could not be loaded.');
    });
    return () => controller.abort();
  }, [open, token, refresh]);

  async function pause() {
    setPausing(true);
    setError('');
    try {
      const response = await fetch(API_BASE_URL + '/api/admin/shield/pause', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token },
      });
      if (!response.ok) throw new Error();
      setRefresh(previous => previous + 1);
    } catch {
      setError('Pause could not be confirmed. Refresh the report before relying on the control.');
    } finally {
      setPausing(false);
    }
  }

  return <details className="mb-4 rounded-2xl border border-slate-800 bg-[#0f151b] p-4" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="min-h-11 cursor-pointer py-2 font-semibold text-white">Mystery Shield operations</summary>
    {open && <div className="space-y-3">
      {error && <p role="alert" className="text-amber-200">{error}</p>}
      {report ? <ShieldAdminReport report={report} /> : !error && <p role="status">Loading Shield diagnostics…</p>}
      <div className="flex flex-wrap gap-2">
        <button className="mh-button-secondary" onClick={() => setRefresh(previous => previous + 1)}>Refresh Shield report</button>
        {report?.storageReady && !report.paused && <button className="mh-button-secondary" disabled={pausing} onClick={() => void pause()}>Pause Shield intake</button>}
      </div>
    </div>}
  </details>;
}
