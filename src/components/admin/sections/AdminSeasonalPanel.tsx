import React, { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Gift } from 'lucide-react';
import { API_BASE_URL } from '../../../services/apiClient';
import type { SeasonStatus } from '../../../../shared/seasonal';
import { AdminButton, AdminNotice, AdminPanel, DefinitionList, RefreshButton, StatusPill } from '../ui/AdminUi';

/** The approved calendar, so the founder can review every phase before it happens. */
const PREVIEW_DAYS: { date: string; label: string }[] = [
  { date: '2026-12-10', label: 'Christmas season' },
  { date: '2026-12-24', label: 'Christmas Eve' },
  { date: '2026-12-25', label: 'Christmas Day' },
  { date: '2026-12-26', label: 'Boxing Day' },
  { date: '2026-12-29', label: 'Toward New Year' },
  { date: '2026-12-31', label: 'New Year’s Eve' },
  { date: '2027-01-01', label: 'New Year’s Day' },
  { date: '2027-01-03', label: 'New Year celebration' },
];

const previewUrl = (date: string) => `${window.location.origin}/?season-preview=christmas-2026&season-date=${date}`;

/**
 * Seasonal Experience: honest status and a founder preview. Production activation is the API service's
 * SEASONAL_EXPERIENCE setting; this panel reads it and never changes it. Previews affect only the browser tab that
 * opens them: a private window shows the signed-out site, a signed-in tab shows the customer's seasonal homepage.
 */
export function AdminSeasonalPanel() {
  const [status, setStatus] = useState<SeasonStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(PREVIEW_DAYS[0].date);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/seasonal/status`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`The server answered ${res.status}.`);
      setStatus(await res.json());
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read the seasonal status.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(previewUrl(date)); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }
    catch { setError('Copying is blocked in this browser. Use “Open preview” instead.'); }
  };
  const live = Boolean(status?.active);

  return (
    <AdminPanel title={<span className="inline-flex items-center gap-2"><Gift className="h-4 w-4 text-[#e9b949]" />Seasonal experience</span>}
      description="Christmas to New Year presentation for the customer site: the signed-out pages and the signed-in homepage. Presentation only: prices, products, orders and payments are never changed by it."
      actions={<RefreshButton onClick={() => void load()} busy={busy} />}>
      <div className="space-y-4">
        {error && <AdminNotice tone="warning" title="Status not available">{error}</AdminNotice>}
        <DefinitionList items={[
          ['For customers now', status ? <StatusPill tone={live ? 'success' : 'neutral'}>{live ? `On · ${status.pack}` : 'Off'}</StatusPill> : '…'],
          ['Calendar today (Accra)', status ? `${status.date} · ${status.phase.replace(/-/g, ' ')}` : '…'],
          ['Who it shows to', 'Everyone gets the seasonal header, phone menu and footer. Signed-out visitors get every guest page; signed-in customers get the seasonal homepage, and their other account pages stay as they are.'],
          ['Where it never shows', 'Admin, the website editor, My Business and published customer websites.'],
        ]} />
        <AdminNotice tone="info" title="How it is switched on and off">
          It is controlled by one setting on the API service: <code className="text-slate-200">SEASONAL_EXPERIENCE=christmas-2026</code> turns it on for
          everyone from 1 December 2026 to 5 January 2027 (Accra). Removing the setting turns it off within about five minutes. This panel only reads
          the setting; changing it needs the founder’s approval and a Render environment change.
        </AdminNotice>
        <div className="rounded-xl border border-slate-800 bg-[#0b1116] p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Preview a day</p>
          <p className="text-xs text-slate-400">The preview shows only in the browser tab that opens it, with a “Christmas preview” ribbon. Open it in a private window to see the signed-out site, or in a tab where you are signed in to see the customer homepage; nobody else is affected.</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Preview day">
            {PREVIEW_DAYS.map(day => (
              <button key={day.date} type="button" onClick={() => setDate(day.date)} aria-pressed={date === day.date}
                className={`min-h-10 rounded-lg border px-3 text-xs font-semibold ${date === day.date ? 'border-[#e9b949] bg-[#2a1d0c] text-[#f7dc8f]' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>
                {day.label}<span className="ml-1 text-slate-500">{day.date.slice(5)}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="primary" onClick={() => window.open(previewUrl(date), '_blank', 'noopener')}><ExternalLink className="h-4 w-4" />Open preview</AdminButton>
            <AdminButton onClick={() => void copy()}><Copy className="h-4 w-4" />{copied ? 'Link copied' : 'Copy preview link'}</AdminButton>
          </div>
        </div>
      </div>
    </AdminPanel>
  );
}
