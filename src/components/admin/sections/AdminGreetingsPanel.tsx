import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Mail, ShieldAlert, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../../../services/apiClient';
import { BUSINESS_CONFIG } from '../../../config/business';
import { GREETING_SHARE_ID } from '../../../../shared/mysteryExperiences';
import { AdminButton, AdminEmpty, AdminNotice, AdminPanel, AdminStat, ConfirmAction, DefinitionList, RefreshButton, StatusPill, adminField, adminLabel } from '../ui/AdminUi';

interface Readiness {
  gates: { links: boolean; creation: boolean; seasonal: boolean }; abuseSecret: boolean; storage: 'installed' | 'not_installed' | 'unavailable';
  retentionDue: boolean | null; lastMaintenance: { at: string; counts: unknown } | null; blockers: string[]; checkedAt: string;
  /** What actually works (switches plus the database), from the server; absent from an older server. */
  available?: { links: boolean; creation: boolean }; status?: 'live' | 'links-only' | 'off' | 'not-working';
}

/** One plain verdict at the top, so "switched on" is never mistaken for "working". */
const VERDICT: Record<NonNullable<Readiness['status']>, { tone: 'success' | 'info' | 'warning'; title: string; body: string }> = {
  live: { tone: 'success', title: 'Live', body: 'Shared links open and new greetings are being accepted (checked against the database just now).' },
  'links-only': { tone: 'info', title: 'Links only', body: 'Greetings already shared still open, but new greetings cannot be created right now. The homepages and /greetings say so.' },
  off: { tone: 'info', title: 'Off', body: 'Greeting links and creation are both switched off. Nothing is offered to customers.' },
  'not-working': { tone: 'warning', title: 'Switched on, but not working', body: 'A greetings switch is on, but the checks below are not all passing, so customers are not offered what is switched on. Fix the items listed below.' },
};
interface Metrics { days: number; created: number; remix_context: number; valid: number; events: { event_name: string; observations: number; estimated_browsers: number }[]; limitations: string[] }
interface Report { share_id: string; reports: number; first_report: string; last_report: string }

const EVENT_LABELS: Record<string, string> = {
  experience_greeting_open: 'Greeting opened', experience_greeting_reveal: 'Gift unwrapped', experience_greeting_remix_started: '“Create your own” tapped',
  experience_countdown_open: 'New Year countdown seen', experience_platform_navigation: 'Went on to Mystery Hub', experience_discovery_open: 'Discovery opened',
  experience_greeting_created: 'Greeting created (best effort)',
};
/** A pasted greeting link or bare ID → the share ID, or null. Only this site's /g/ links are accepted. */
export function greetingIdFrom(input: string): string | null {
  const text = input.trim();
  if (GREETING_SHARE_ID.test(text)) return text;
  const host = BUSINESS_CONFIG.domain.replace(/\./g, '\\.');
  const match = text.match(new RegExp(`^(?:https?://(?:www\\.)?${host})?/g/([A-Za-z0-9_-]{24})/?(?:[?#].*)?$`));
  return match ? match[1] : null;
}
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' });

/**
 * Mystery Greetings for staff: readiness (gates, secret present, storage), totals, abuse reports and removal, and
 * retention clean-up. Read-mostly: switching greetings on is a server setting that needs the founder's approval, and
 * nothing here shows a personal message (open a reported link to review it, as the recipient would).
 */
export function AdminGreetingsPanel({ sessionToken }: { sessionToken: string }) {
  const [ready, setReady] = useState<Readiness | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: 'remove'; shareId: string } | { kind: 'maintenance' } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [notice, setNotice] = useState('');
  const [lookup, setLookup] = useState('');
  const call = useCallback(async (path: string, body?: unknown) => {
    const res = await fetch(`${API_BASE_URL}/api/admin/experiences${path}`, { method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
      headers: { Authorization: `Bearer ${sessionToken}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error?.code ? `The server answered ${res.status} (${data.error.code}).` : `The server answered ${res.status}.`);
    return data;
  }, [sessionToken]);
  const load = useCallback(async (range = days) => {
    setBusy(true); setError('');
    try {
      const r: Readiness = await call('/readiness');
      setReady(r);
      if (r.storage === 'installed') {
        setMetrics(await call(`/metrics?days=${range}`)); setReports(await call('/reports'));
      } else { setMetrics(null); setReports(null); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read Mystery Greetings.'); }
    finally { setBusy(false); }
  }, [call, days]);
  useEffect(() => { void load(); }, [load]);

  const run = async () => {
    if (!confirm) return;
    setActing(true); setActionError(null);
    try {
      if (confirm.kind === 'remove') { await call(`/greetings/${confirm.shareId}/revoke`, { confirmed: true }); setNotice(`Greeting ${confirm.shareId} was removed. Its link no longer opens.`); setLookup(''); }
      else { const { greetings: removed, budgets, events } = await call('/maintenance', { confirmed: true }); setNotice(`Clean-up finished: ${removed} greetings, ${budgets} quota rows and ${events} old events removed.`); }
      setConfirm(null); await load();
    } catch (e) { setActionError(e instanceof Error && /404/.test(e.message) ? 'No greeting with that link exists (it may already be gone).' : e instanceof Error ? e.message : 'That did not work.'); }
    finally { setActing(false); }
  };
  const lookupId = greetingIdFrom(lookup);
  const installed = ready?.storage === 'installed';
  const pill = (on: boolean, yes = 'On', no = 'Off') => <StatusPill tone={on ? 'success' : 'neutral'}>{on ? yes : no}</StatusPill>;

  return (
    <AdminPanel title={<span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-[#e9b949]" />Mystery Greetings</span>}
      description="Anonymous greeting links (creator at /greetings, recipients at /g/…). Status, totals, abuse reports and removal. Switching it on is a server setting that needs the founder’s approval; this panel never changes it."
      actions={<RefreshButton onClick={() => void load()} busy={busy} />}>
      <div className="space-y-4">
        {error && <AdminNotice tone="warning" title="Status not available">{error}</AdminNotice>}
        {notice && <AdminNotice tone="success">{notice}</AdminNotice>}
        {ready?.status && <AdminNotice tone={VERDICT[ready.status].tone} title={`Status: ${VERDICT[ready.status].title}`}>{VERDICT[ready.status].body}</AdminNotice>}
        {ready && (
          <DefinitionList items={[
            ['Links switch (MYSTERY_GREETING_LINKS_ENABLED)', pill(ready.gates.links)],
            ['Creation switch (MYSTERY_GREETINGS_ENABLED)', pill(ready.gates.creation)],
            ...(ready.available ? [
              ['Shared links working now', pill(ready.available.links, 'Yes', 'No')],
              ['New greetings accepted now', pill(ready.available.creation, 'Yes', 'No')],
            ] as [string, React.ReactNode][] : []),
            ['Abuse protection secret', pill(ready.abuseSecret, 'Configured', 'Missing')],
            ['Storage (optional schema)', <StatusPill tone={installed ? 'success' : ready.storage === 'unavailable' ? 'warning' : 'neutral'}>{installed ? 'Installed' : ready.storage === 'unavailable' ? 'Could not check' : 'Not installed'}</StatusPill>],
            ['Retention clean-up', !installed ? '—' : <span className="inline-flex flex-wrap items-center gap-2">{ready.retentionDue ? <StatusPill tone="danger">Due now</StatusPill> : <StatusPill tone="success">Up to date</StatusPill>}<span className="text-xs text-slate-400">{ready.lastMaintenance ? `Last run ${when(ready.lastMaintenance.at)}` : 'Never run'}</span></span>],
          ]} />
        )}
        {ready && ready.blockers.length > 0 && (
          <AdminNotice tone={ready.retentionDue ? 'danger' : 'info'} title={ready.gates.creation ? 'Needs attention' : 'Not live: what is off'}>
            <ul className="list-disc space-y-1 pl-5">{ready.blockers.map(b => <li key={b}>{b}</li>)}</ul>
          </AdminNotice>
        )}
        {installed && metrics && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">Last {metrics.days} days</p>
              <div className="flex gap-1" role="group" aria-label="Period">
                {([7, 30, 90] as const).map(d => <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}
                  className={`min-h-10 rounded-lg border px-3 text-xs font-semibold ${days === d ? 'border-[#e9b949] bg-[#2a1d0c] text-[#f7dc8f]' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>{d} days</button>)}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <AdminStat label="Greetings created" value={metrics.created} hint="Confirmed by the database." />
              <AdminStat label="Still open" value={metrics.valid} hint="Not removed and not expired." />
              <AdminStat label="From a received greeting" value={metrics.remix_context} hint="Self-reported “Create your own” context." />
            </div>
            {metrics.events.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="text-xs text-slate-400"><tr><th className="px-3 py-2 font-medium">Interaction</th><th className="px-3 py-2 text-right font-medium">Times</th><th className="px-3 py-2 text-right font-medium">Browsers (est.)</th></tr></thead>
                  <tbody>{metrics.events.map(e => <tr key={e.event_name} className="border-t border-slate-800"><td className="px-3 py-2 text-slate-200">{EVENT_LABELS[e.event_name] || e.event_name}</td><td className="px-3 py-2 text-right tabular-nums">{e.observations}</td><td className="px-3 py-2 text-right tabular-nums">{e.estimated_browsers}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="text-sm text-slate-400">No interactions recorded in this period.</p>}
            <p className="text-xs leading-relaxed text-slate-500">{metrics.limitations.join(' ')} WhatsApp delivery and who received a link are never known.</p>
          </div>
        )}
        {installed && (
          <div className="space-y-3 rounded-xl border border-slate-800 bg-[#0b1116] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldAlert className="h-4 w-4 text-amber-300" />Reports</p>
            <p className="text-xs text-slate-400">Reports never remove a greeting by themselves. Open a reported link to review it as the recipient sees it, then remove it if it breaks the rules.</p>
            {reports && reports.length === 0 && <AdminEmpty title="No open reports">Reported greetings that are still live appear here.</AdminEmpty>}
            {reports && reports.length > 0 && (
              <ul className="divide-y divide-slate-800">
                {reports.map(r => (
                  <li key={r.share_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0"><span className="block font-mono text-sm text-slate-200 break-all">{r.share_id}</span><span className="text-xs text-slate-400">{r.reports} report{r.reports === 1 ? '' : 's'} · first {when(r.first_report)} · latest {when(r.last_report)}</span></span>
                    <span className="flex gap-2">
                      <a className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:border-slate-500" href={`/g/${r.share_id}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Review</a>
                      <AdminButton variant="danger" onClick={() => { setActionError(null); setConfirm({ kind: 'remove', shareId: r.share_id }); }}><Trash2 className="h-4 w-4" />Remove</AdminButton>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <label className={adminLabel}><span>Remove a greeting by its link</span>
                <input className={adminField} value={lookup} onChange={e => setLookup(e.target.value)} placeholder="https://mysterybundlehub.com/g/…" autoComplete="off" spellCheck={false} />
              </label>
              {lookup && !lookupId && <p className="text-xs text-amber-300">Paste a full greeting link from this site, or its 24-character ID.</p>}
              <AdminButton variant="danger" disabled={!lookupId} onClick={() => { setActionError(null); if (lookupId) setConfirm({ kind: 'remove', shareId: lookupId }); }}><Trash2 className="h-4 w-4" />Remove this greeting</AdminButton>
            </div>
          </div>
        )}
        {installed && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 p-4">
            <p className="max-w-xl text-xs text-slate-400">Retention clean-up permanently deletes greetings that expired or were removed more than 30 days ago (up to 500 at a time), old quota rows and greeting events older than 90 days. While anything is due, new greetings are refused.</p>
            <AdminButton onClick={() => { setActionError(null); setConfirm({ kind: 'maintenance' }); }}>Run clean-up</AdminButton>
          </div>
        )}
      </div>
      {confirm && (
        <ConfirmAction
          title={confirm.kind === 'remove' ? 'Remove this greeting?' : 'Run retention clean-up?'}
          summary={confirm.kind === 'remove' ? <span>Greeting <span className="font-mono">{confirm.shareId}</span>. Its link stops opening for everyone straight away. This is recorded in the audit trail.</span>
            : 'Deletes expired or removed greetings older than 30 days, old quota rows and old greeting events. Recorded in the audit trail.'}
          acknowledgement={confirm.kind === 'remove' ? 'I reviewed this greeting and it should be removed.' : 'I understand this permanently deletes old records.'}
          confirmLabel={confirm.kind === 'remove' ? 'Remove greeting' : 'Run clean-up'} tone={confirm.kind === 'remove' ? 'danger' : 'primary'}
          busy={acting} error={actionError} onConfirm={() => void run()} onClose={() => setConfirm(null)} />
      )}
    </AdminPanel>
  );
}
