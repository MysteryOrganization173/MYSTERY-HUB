import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, ArchiveRestore, History, Trash2 } from 'lucide-react';
import type { OrderRecordAuditEntry, OrderRecordClient, OrderRecordState, RecordActionFailure } from '../../../services/orderRecordKeeping';
import { RECORD_KEEPING_UNAVAILABLE } from '../../../services/orderRecordKeeping';
import { auditActionLabel, freshnessCheck, recordActionsFor, type RecordAction } from '../../../utils/orderRecordActions';
import { AdminButton, AdminNotice, AdminPanel, ConfirmAction, StatusPill } from '../ui/AdminUi';

const when = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Archive, restore and restricted test deletion for one order, shown in the order drawer. Every button and reason
 * comes from the server's eligibility answer, every action re-reads the record and sends the reviewed version, and
 * the drawer only changes after the server confirms. Without a verified backend contract it explains that and
 * offers nothing.
 */
export function AdminOrderRecordKeeping({ token, reference, client, paused = false, onArchivedChange, onDeleted }: {
  token: string; reference: string; client: OrderRecordClient;
  /** True while the drawer's own details are loading, stale or another action runs. */
  paused?: boolean;
  onArchivedChange: (state: OrderRecordState) => void; onDeleted: (reference: string) => void;
}) {
  const [state, setState] = useState<OrderRecordState | null>(null);
  const [history, setHistory] = useState<OrderRecordAuditEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<RecordAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const live = useRef(0);

  const load = useCallback(async () => {
    if (!client.available) return null;
    const id = ++live.current;
    setLoadError(null);
    try {
      const [fresh, entries] = await Promise.all([client.getState(token, reference), client.history(token, reference).catch(() => null)]);
      if (id !== live.current) return null;
      setState(fresh); setHistory(entries);
      return fresh;
    } catch (error) {
      if (id === live.current) setLoadError(error instanceof Error ? error.message : 'Record-keeping details could not be loaded.');
      return null;
    }
  }, [client, token, reference]);
  useEffect(() => { void load(); return () => { live.current++; }; }, [load]);

  if (!client.available) {
    return (
      <AdminPanel title="Archive and test records">
        <AdminNotice tone="info" title="Waiting for the server">{RECORD_KEEPING_UNAVAILABLE} When the server's eligibility checks are live, this panel will show whether this order can be archived, restored or deleted, and why.</AdminNotice>
      </AdminPanel>
    );
  }

  const actions = state ? recordActionsFor(state) : null;
  const failureText = (failure: RecordActionFailure) => failure.code === 'version_conflict'
    ? 'Someone else changed this order first. The latest details are now shown; review them before trying again.'
    : failure.message;

  const run = async (action: RecordAction, values: Record<string, string>) => {
    if (!state || busy) return;
    setBusy(true); setActionError(null); setNotice(null);
    try {
      // Re-read the authoritative record and stop if anything moved since the operator reviewed it.
      const fresh = await client.getState(token, reference);
      const check = freshnessCheck(action, state, fresh);
      if (!check.proceed) { setState(fresh); setConfirm(null); setActionError(check.message); return; }
      if (action === 'delete') {
        const result = await client.deleteTest(token, reference, { expectedVersion: fresh.version, confirmReference: reference, reason: values.reason });
        if (!result.ok) { setActionError(failureText(result)); if (result.code === 'version_conflict') { setConfirm(null); await load(); } return; }
        setConfirm(null);
        onDeleted(reference);
        return;
      }
      const result = action === 'archive'
        ? await client.archive(token, reference, { expectedVersion: fresh.version, reason: values.reason })
        : await client.restore(token, reference, { expectedVersion: fresh.version, reason: values.reason });
      if (!result.ok) { setActionError(failureText(result)); if (result.code === 'version_conflict') { setConfirm(null); await load(); } return; }
      setState(result.state);
      setConfirm(null);
      setNotice(action === 'archive' ? 'Order archived. It stays searchable in Archived records.' : 'Order restored to the main order list.');
      onArchivedChange(result.state);
      void client.history(token, reference).then(setHistory, () => {});
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The server did not confirm this action. Nothing was changed here.');
    } finally { setBusy(false); }
  };

  return (
    <AdminPanel title="Archive and test records" description="Archiving hides an order from the working lists without changing it. Paid customer purchases are never deleted.">
      {loadError && <AdminNotice tone="warning" title="Could not check this order">{loadError} <button type="button" className="font-semibold text-[#00c365] underline" onClick={() => void load()}>Try again</button></AdminNotice>}
      {!state && !loadError && <p role="status" className="text-sm text-slate-400">Checking what the server allows for this order…</p>}
      {state && actions && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {state.archived ? <StatusPill tone="neutral">Archived</StatusPill> : <StatusPill tone="success">In the main list</StatusPill>}
            {state.paidCustomerPurchase && <StatusPill tone="info">Paid customer purchase</StatusPill>}
          </div>
          {state.archived && (
            <p className="text-sm text-slate-300">Archived {when(state.archivedAt)}{state.archivedBy ? ` by ${state.archivedBy}` : ''}{state.archiveReason ? `: “${state.archiveReason}”` : '.'}</p>
          )}
          {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
          <div className="flex flex-wrap gap-2">
            {actions.archive && <AdminButton disabled={paused} onClick={() => { setActionError(null); setConfirm('archive'); }}><Archive className="h-4 w-4" />Archive order</AdminButton>}
            {actions.restore && <AdminButton disabled={paused} onClick={() => { setActionError(null); setConfirm('restore'); }}><ArchiveRestore className="h-4 w-4" />Restore to main list</AdminButton>}
            {actions.delete && <AdminButton variant="danger" disabled={paused} onClick={() => { setActionError(null); setConfirm('delete'); }}><Trash2 className="h-4 w-4" />Delete test record</AdminButton>}
          </div>
          <ul className="space-y-1 text-xs text-slate-400">
            {actions.archiveNote && <li>Archive unavailable: {actions.archiveNote}</li>}
            {actions.restoreNote && <li>Restore unavailable: {actions.restoreNote}</li>}
            {actions.deleteNote && <li>Permanent deletion unavailable: {actions.deleteNote}</li>}
          </ul>
          {actionError && !confirm && <p role="alert" className="text-sm text-rose-300">{actionError}</p>}
          <details className="rounded-xl border border-slate-800 px-3 py-2">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-300"><History className="h-4 w-4" />Record history</summary>
            {history === null ? <p className="pb-2 text-sm text-slate-500">The server does not provide history for this order.</p>
              : history.length === 0 ? <p className="pb-2 text-sm text-slate-500">No archive or deletion actions yet.</p>
              : <ol className="space-y-2 pb-2">{history.map(entry => (
                  <li key={entry.id} className="text-sm text-slate-300"><span className="font-semibold text-white">{auditActionLabel(entry.action)}</span> · {when(entry.at)}{entry.actor ? ` · ${entry.actor}` : ''}{entry.reason && <span className="block text-xs text-slate-500">“{entry.reason}”</span>}</li>
                ))}</ol>}
          </details>
        </div>
      )}

      {confirm === 'archive' && state && <ConfirmAction
        title="Archive this order?"
        summary={<span><strong className="font-mono">{reference}</strong> leaves the working order lists. Its payment, delivery and customer history are unchanged, and you can restore it at any time.</span>}
        fields={[{ key: 'reason', label: 'Reason (recorded in the audit log)', placeholder: 'e.g. Pre-launch record, no payment received', minLength: 5, maxLength: 300 }]}
        confirmLabel="Archive order" busy={busy} error={actionError}
        onClose={() => { if (!busy) { setConfirm(null); setActionError(null); } }}
        onConfirm={values => void run('archive', values)} />}
      {confirm === 'restore' && state && <ConfirmAction
        title="Restore this order?"
        summary={<span><strong className="font-mono">{reference}</strong> returns to the main order lists exactly as it was.</span>}
        fields={[{ key: 'reason', label: 'Reason (recorded in the audit log)', minLength: 5, maxLength: 300 }]}
        confirmLabel="Restore order" busy={busy} error={actionError}
        onClose={() => { if (!busy) { setConfirm(null); setActionError(null); } }}
        onConfirm={values => void run('restore', values)} />}
      {confirm === 'delete' && state && <ConfirmAction
        title="Permanently delete this test record?"
        tone="danger"
        summary={<span>The server has confirmed <strong className="font-mono">{reference}</strong> as a test record with no customer payment. Deleting removes it for good.</span>}
        warning="This cannot be undone. Archive instead if you might need this record later."
        fields={[{ key: 'reason', label: 'Reason (recorded in the audit log)', minLength: 5, maxLength: 300 }]}
        typedWord={reference}
        acknowledgement="I understand this permanently deletes this test record and cannot be undone."
        confirmLabel="Delete permanently" busy={busy} error={actionError}
        onClose={() => { if (!busy) { setConfirm(null); setActionError(null); } }}
        onConfirm={values => void run('delete', values)} />}
    </AdminPanel>
  );
}
