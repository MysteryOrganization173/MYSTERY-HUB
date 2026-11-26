import React, { useCallback, useEffect, useRef, useState } from 'react';
import { commercialRequest } from '../../../services/commercialApi';
import { AdminPanel, AdminButton, AdminNotice, AdminSheet, StatusPill, RefreshButton, adminField, adminLabel, type AdminTone } from '../ui/AdminUi';
import { NetworkBrandBadge } from '../../common/NetworkBrandBadge';
import { AnnouncementBarView, ServiceInlineNotice, ServiceMaintenanceState, stateChip } from '../../service/ServiceUpdate';
import {
  CONTROL_LIMITS, CONTROL_NETWORKS, OPERATING_STATES, blocksPurchases, namesSupplier, restorationLine,
  type OperatingState, type PublicServiceControl, type ScopeId, type ServiceControl, type ServiceScope,
} from '../../../../shared/serviceControls';
import {
  ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_CTAS, ANNOUNCEMENT_LIMITS, ANNOUNCEMENT_PAGES, ANNOUNCEMENT_PLACEMENTS, ANNOUNCEMENT_SEVERITIES,
  announcementProblems, isLiveAnnouncement, type Announcement, type PublicAnnouncement,
} from '../../../../shared/announcements';
import type { NetworkId } from '../../../types';

/**
 * Mystery Hub 3.6.3 Release B · Admin Service Control Center.
 * Pause or reopen NEW purchases by service and network, and manage what customers are told. Every change is checked,
 * versioned and audited on the server; this screen shows success only after the server confirms it, and a change
 * made meanwhile in another session is refused (refresh and review). Existing orders, payments, recovery and refunds
 * are never affected. "Operational" here never claims a supplier is working: all other checks still apply.
 */
interface ScopeView extends ServiceScope { control: ServiceControl; blocksPurchases: boolean; products: { enabled: number; total: number } | null; paymentPermitted: boolean; route: 'configured' | 'unavailable' }
interface AdminView { serverDate: string; controls: { version: string; source: 'saved' | 'shipped-default'; unreadable?: boolean }; announcements: { version: string; source: 'saved' | 'shipped-default'; items: Announcement[] }; scopes: ScopeView[]; audit: { id: string; admin_user_id: string; action: string; entity_id: string; metadata_safe_json: string | null; created_at: string }[] }

const NETWORK_NAME: Record<string, string> = { mtn: 'MTN', telecel: 'Telecel', airteltigo: 'AirtelTigo' };
const SERVICE_NAME: Record<string, string> = { data: 'Data', instant_bundle: 'Instant Bundles', airtime: 'Airtime' };
const STATE_TEXT: Record<OperatingState, { label: string; tone: AdminTone; effect: string }> = {
  operational: { label: 'Operational', tone: 'success', effect: 'Open for new purchases, subject to supplier, product and payment checks.' },
  delayed: { label: 'Experiencing delays', tone: 'info', effect: 'Open for new purchases, with a delay notice for customers.' },
  maintenance: { label: 'Maintenance', tone: 'warning', effect: 'New purchases refused. Existing orders stay trackable.' },
  suspended: { label: 'Suspended', tone: 'danger', effect: 'New purchases refused. Existing orders stay trackable.' },
};
const toPublic = (c: Pick<ServiceControl, 'scope' | 'state' | 'title' | 'message' | 'existingOrders' | 'expectedRestoration' | 'revision'>): PublicServiceControl | null => {
  if (c.state === 'operational') return null;
  const [service, network] = c.scope.split(':') as [PublicServiceControl['service'], PublicServiceControl['network']];
  return { scope: c.scope as ScopeId, service, network, state: c.state, blocksPurchases: blocksPurchases(c.state), title: c.title || `${NETWORK_NAME[network]} ${SERVICE_NAME[service]} service update`, message: c.message, existingOrders: c.existingOrders, expectedRestoration: c.expectedRestoration, revision: c.revision };
};
// A refused write says why; a write that never got an answer may or may not have been saved, and says so.
const errorText = (e: any) => e?.status === 409 ? `${e.message} Your edits are still here; refresh to see the latest state first.`
  : e?.status === 403 || e?.status === 401 ? 'Your session cannot change service controls. Sign in again as an administrator.'
  : typeof e?.status === 'number' ? e.message || 'Nothing was changed. Try again in a moment.'
  : 'We could not get an answer from the server, so this may or may not have been saved. Refresh to check before trying again.';
const loadErrorText = (e: any) => typeof e?.status === 'number' ? errorText(e) : 'We could not reach the server. Check the connection, then refresh.';

export function AdminServiceControlCenter({ token }: { token: string }) {
  const [view, setView] = useState<AdminView | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [sheet, setSheet] = useState<{ kind: 'control'; scope: ScopeView } | { kind: 'announcement'; item: Announcement | null } | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const mine = ++generation.current; setLoading(true); setError('');
    try {
      const next = await commercialRequest('admin/service-control', token);
      if (generation.current !== mine) return;
      if (!next || !Array.isArray(next.scopes) || !next.controls || !next.announcements) throw Error('Invalid response');
      setView(next);
    } catch (e) { if (generation.current === mine) setError(loadErrorText(e)); } // the last confirmed view stays; every save is version-checked
    finally { if (generation.current === mine) setLoading(false); }
  }, [token]);
  // A different session never sees the previous one's view, and a late answer for it is dropped.
  useEffect(() => { setView(null); setSheet(null); setNotice(''); void refresh(); return () => { generation.current++; }; }, [refresh]);

  const save = async (path: 'control' | 'announcement', body: Record<string, unknown>, done: string) => {
    const result = await commercialRequest(`admin/service-control/${path}`, token, { ...body, confirmed: true });
    // The server committed the change; if it could not also send the new view, load it rather than guess.
    if (result?.view) setView(result.view); else void refresh();
    setNotice(result?.view ? done : `${done} Refreshing to show the latest state.`);
    return result;
  };

  const paused = view?.scopes.filter((s) => s.blocksPurchases).length ?? 0, delayed = view?.scopes.filter((s) => s.control.state === 'delayed').length ?? 0;
  return (
    <AdminPanel id="service-control-center" title="Service Control Center" description="Pause or reopen new purchases by service and network, and tell customers. Existing orders, payments, recovery and refunds are never affected." actions={<RefreshButton onClick={() => void refresh()} busy={loading} />}>
      <div className="space-y-5">
        {error && <AdminNotice tone="danger" title={view ? 'Could not refresh; showing the last confirmed state' : 'The Service Control Center could not load'}>{error}</AdminNotice>}
        {notice && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</p>}
        {loading && !view && <p role="status" className="text-sm text-slate-300">Loading service controls…</p>}
        {view && <>
          {view.controls.unreadable && (
            <AdminNotice tone="danger" title="The saved service controls could not be read">Every service is refusing new purchases until this is fixed. Nothing has been reopened. Review each service below and save the states you want; saving replaces the unreadable record.</AdminNotice>
          )}
          {view.controls.source === 'shipped-default' && (
            <AdminNotice tone="info" title="Running on the emergency record">The MTN Data maintenance pause from the emergency release is in force. Your first saved change here makes these settings yours; nothing changes until then.</AdminNotice>
          )}
          <p className="text-sm text-slate-300"><strong className="text-white">{paused}</strong> {paused === 1 ? 'service is' : 'services are'} refusing new purchases · <strong className="text-white">{delayed}</strong> with a delay notice · Server date {view.serverDate}</p>
          <div className="grid gap-4 lg:grid-cols-3">
            {CONTROL_NETWORKS.map((network) => (
              <section key={network} aria-label={`${NETWORK_NAME[network]} services`} className="min-w-0 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-3 sm:p-4">
                <h3 className="flex items-center gap-2 font-semibold text-white"><NetworkBrandBadge network={network as NetworkId} size="xs" />{NETWORK_NAME[network]}</h3>
                {view.scopes.filter((s) => s.network === network).map((scope) => {
                  const t = STATE_TEXT[scope.control.state];
                  const restoration = scope.control.state === 'operational' ? null : restorationLine(scope.control.expectedRestoration, view.serverDate, scope.blocksPurchases);
                  const linked = view.announcements.items.filter((a) => a.scope === scope.id && isLiveAnnouncement(a)).length;
                  return (
                    <article key={scope.id} className="space-y-2 rounded-xl border border-slate-800 p-3" data-scope={scope.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-slate-100">{SERVICE_NAME[scope.service]}</h4><StatusPill tone={t.tone}>{t.label}</StatusPill></div>
                      <p className="text-sm text-slate-300">{t.effect}</p>
                      <ul className="space-y-1 text-xs text-slate-400">
                        {scope.products && <li>Products available for sale: {scope.products.enabled} of {scope.products.total} (Commercial pricing)</li>}
                        <li>Supplier route: {scope.route === 'configured' ? 'configured (readiness is checked on demand below)' : 'unavailable, so purchases are refused anyway'}</li>
                        <li>Online payment: {scope.paymentPermitted ? 'permitted' : 'restricted'}</li>
                        {restoration && <li className={restoration.overdue ? 'text-amber-200' : ''}>{restoration.label}</li>}
                        <li className={linked && scope.control.state === 'operational' ? 'text-amber-200' : ''}>Live announcements: {linked}{linked && scope.control.state === 'operational' ? ' (check they no longer say it is paused)' : ''}</li>
                        {scope.control.updatedAt && <li>Changed {new Date(scope.control.updatedAt).toLocaleString()}{scope.control.actorId ? ` by ${scope.control.actorId}` : ' (emergency release)'}</li>}
                      </ul>
                      <AdminButton onClick={() => { setNotice(''); setSheet({ kind: 'control', scope }); }}>Manage {NETWORK_NAME[network]} {SERVICE_NAME[scope.service]}</AdminButton>
                    </article>
                  );
                })}
              </section>
            ))}
          </div>

          <section aria-labelledby="scc-announcements" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="scc-announcements" className="font-semibold text-white">Announcements</h3><AdminButton variant="primary" onClick={() => { setNotice(''); setSheet({ kind: 'announcement', item: null }); }}>New announcement</AdminButton></div>
            {view.announcements.source === 'shipped-default' && <p className="text-xs text-slate-400">Showing the emergency announcement. Editing or publishing anything saves the list as yours.</p>}
            {view.announcements.items.length === 0 && <p className="text-sm text-slate-400">No announcements yet.</p>}
            <ul className="space-y-2">
              {view.announcements.items.map((a) => (
                <li key={a.id} className="space-y-2 rounded-xl border border-slate-800 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 font-semibold text-slate-100">{a.name}</p>
                    <StatusPill tone={a.status === 'published' ? (isLiveAnnouncement(a) ? 'success' : 'warning') : a.status === 'archived' ? 'neutral' : 'info'}>{a.status === 'published' ? (isLiveAnnouncement(a) ? 'Live' : 'Published, outside its time window') : a.status === 'archived' ? 'Archived' : 'Draft'}</StatusPill>
                  </div>
                  <p className="text-sm text-slate-300">{a.title} · {a.summary}</p>
                  <p className="text-xs text-slate-400">{a.scope === 'global' ? 'Everywhere it is placed' : `About ${NETWORK_NAME[a.scope.split(':')[1]]} ${SERVICE_NAME[a.scope.split(':')[0]]}`} · {a.placement === 'modal' ? 'Important pop-up (once per change)' : 'Bar'} on {a.pages.join(', ')} · {a.audience} · {a.dismissible ? 'customers can hide it' : 'stays visible'} · revision {a.revision}</p>
                  {a.status !== 'archived' && <div className="flex flex-wrap gap-2">
                    <AdminButton onClick={() => { setNotice(''); setSheet({ kind: 'announcement', item: a }); }}>Edit and preview</AdminButton>
                    <AnnouncementAction label={a.status === 'published' ? 'Unpublish' : 'Publish'} confirmText={a.status === 'published' ? 'Customers stop seeing it. Service pauses are not affected.' : 'Customers will see it on the pages it names, within its time window. It does not pause or reopen any service.'}
                      onConfirm={() => save('announcement', { action: a.status === 'published' ? 'unpublish' : 'publish', id: a.id, expectedVersion: view.announcements.version }, a.status === 'published' ? 'Announcement unpublished.' : 'Announcement published.')} />
                    <AnnouncementAction label="Archive" confirmText="It leaves every page and can no longer be edited. Service pauses are not affected."
                      onConfirm={() => save('announcement', { action: 'archive', id: a.id, expectedVersion: view.announcements.version }, 'Announcement archived.')} />
                  </div>}
                </li>
              ))}
            </ul>
          </section>

          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-2 text-emerald-300">Change history ({view.audit.length})</summary>
            {view.audit.length === 0 ? <p className="text-slate-400">No changes recorded yet.</p> : <ul className="space-y-2">{view.audit.map((a) => <li key={a.id} className="break-words rounded-lg border border-slate-800 p-2"><span className="block text-slate-200">{a.action.replace('service_control_changed', 'Service control changed').replace(/^service_announcement_/, 'Announcement ')} · {a.entity_id}</span><span className="block text-xs text-slate-400">{new Date(a.created_at).toLocaleString()} · Admin {a.admin_user_id}</span>{auditLine(a.metadata_safe_json) && <span className="block text-xs text-slate-300">{auditLine(a.metadata_safe_json)}</span>}</li>)}</ul>}
          </details>
        </>}
      </div>
      {view && sheet?.kind === 'control' && <ControlSheet scope={sheet.scope} liveAnnouncements={view.announcements.items.filter((a) => a.scope === sheet.scope.id && isLiveAnnouncement(a)).map((a) => a.name)} version={view.controls.version} serverDate={view.serverDate} onClose={() => setSheet(null)} onSave={(body, done) => save('control', body, done).then(() => setSheet(null))} />}
      {view && sheet?.kind === 'announcement' && <AnnouncementSheet item={sheet.item} version={view.announcements.version} serverDate={view.serverDate} scopes={view.scopes} onClose={() => setSheet(null)} onSave={(body, done) => save('announcement', body, done).then(() => setSheet(null))} />}
    </AdminPanel>
  );
}

function auditLine(json: string | null): string {
  try {
    const m = JSON.parse(json || '{}');
    if (m.previous && m.next) return `${m.previous.state} → ${m.next.state}${m.next.expectedRestoration ? ` · expected ${m.next.expectedRestoration}` : ''}${m.effect === 'new_purchases_refused' ? ' · new purchases refused' : m.effect === 'manual_pause_lifted' ? ' · manual pause lifted' : ''}`;
    if (m.title) return `${m.title} · ${m.status} · revision ${m.revision}`;
  } catch { /* nothing to show */ }
  return '';
}

/** A small confirmed action: nothing is sent until the founder confirms, and success shows only after the server. */
function AnnouncementAction({ label, confirmText, onConfirm }: { label: string; confirmText: string; onConfirm: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!open) return <AdminButton onClick={() => { setError(''); setOpen(true); }}>{label}</AdminButton>;
  return (
    <span className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-slate-700 p-2 text-sm">
      <span className="min-w-0 flex-1 text-slate-300">{confirmText}</span>
      <AdminButton variant="primary" busy={busy} onClick={async () => { setBusy(true); setError(''); try { await onConfirm(); setOpen(false); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } }}>Confirm {label.toLowerCase()}</AdminButton>
      <AdminButton disabled={busy} onClick={() => setOpen(false)}>Cancel</AdminButton>
      {error && <span role="alert" className="w-full text-rose-300">{error}</span>}
    </span>
  );
}

function ControlSheet({ scope, liveAnnouncements, version, serverDate, onClose, onSave }: { scope: ScopeView; liveAnnouncements: string[]; version: string; serverDate: string; onClose: () => void; onSave: (body: Record<string, unknown>, done: string) => Promise<unknown> }) {
  const c = scope.control;
  const name = `${NETWORK_NAME[scope.network]} ${SERVICE_NAME[scope.service]}`;
  const [state, setState] = useState<OperatingState>(c.state);
  const [title, setTitle] = useState(c.title || `${name} service update`), [message, setMessage] = useState(c.message), [existingOrders, setExistingOrders] = useState(c.existingOrders || 'Existing orders remain trackable.');
  const [expected, setExpected] = useState(c.expectedRestoration || '');
  const [ack, setAck] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pausing = blocksPurchases(state), wasPaused = blocksPurchases(c.state);
  const draft = toPublic({ scope: scope.id, state, title, message, existingOrders, expectedRestoration: expected || null, revision: c.revision + 1 });
  const needWords = state !== 'operational' && (!title.trim() || !message.trim());
  const supplierNamed = state !== 'operational' && [title, message, existingOrders].some(namesSupplier);
  const effect = pausing && !wasPaused ? `New ${name} purchases will be refused as soon as this is saved${scope.service === 'data' ? ', including admin-assisted Data orders' : ''}. Existing orders, payments, recovery and refunds are not affected.`
    : !pausing && wasPaused ? `This lifts the manual pause. Customers may buy ${name} again only if every other check passes: supplier preflight, product availability, payment rules and eligibility still apply. It does not prove the supplier is working.`
    : pausing ? `${name} stays paused; this updates what customers are told.${scope.service === 'data' ? ' Admin-assisted Data orders on this network are refused too.' : ''}` : state === 'delayed' ? `${name} stays open for purchases, with a delay notice.` : `${name} stays open for purchases, subject to every other check.`;
  return (
    <AdminSheet title={`Manage ${name}`} subtitle="Changes apply to new purchases only." onClose={onClose} busy={busy} wide
      footer={<div className="space-y-2">
        <label className="flex min-h-11 items-start gap-3 text-sm text-slate-300"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#00c365]" checked={ack} disabled={busy} onChange={(e) => setAck(e.target.checked)} /><span>{effect}</span></label>
        {!pausing && wasPaused && liveAnnouncements.length > 0 && <p className="text-sm text-amber-200">Still live for customers: {liveAnnouncements.join(', ')}. After saving, unpublish or update {liveAnnouncements.length === 1 ? 'it' : 'them'} in Announcements so nobody is told {name} is still paused.</p>}
        {supplierNamed && <p className="text-sm text-amber-200">Customer words must not name a supplier or reseller arrangement.</p>}
        {error && <p role="alert" className="break-words text-sm text-rose-300">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><AdminButton onClick={onClose} disabled={busy}>Cancel</AdminButton>
          <AdminButton variant={pausing && !wasPaused ? 'danger' : 'primary'} busy={busy} disabled={!ack || needWords || supplierNamed || busy} onClick={async () => {
            setBusy(true); setError('');
            try { await onSave({ scope: scope.id, state, title, message, existingOrders, expectedRestoration: state === 'operational' ? null : expected || null, expectedVersion: version }, `${name}: ${STATE_TEXT[state].label}. Saved and confirmed by the server.`); }
            catch (e) { setError(errorText(e)); } finally { setBusy(false); }
          }}>Save {STATE_TEXT[state].label.toLowerCase()}</AdminButton></div>
      </div>}>
      <div className="space-y-4">
        <fieldset className="space-y-2"><legend className="text-sm font-semibold text-slate-200">Operating state</legend>
          {OPERATING_STATES.map((s) => (
            <label key={s} className="flex min-h-11 items-start gap-3 rounded-xl border border-slate-800 p-3 text-sm"><input type="radio" name="scc-state" className="mt-1 h-4 w-4 accent-[#00c365]" checked={state === s} disabled={busy} onChange={() => { setState(s); setAck(false); }} /><span><strong className="block text-slate-100">{STATE_TEXT[s].label}</strong><span className="text-slate-400">{STATE_TEXT[s].effect}</span></span></label>
          ))}
        </fieldset>
        {state !== 'operational' && <>
          <label className={adminLabel}><span>Customer title</span><input className={adminField} value={title} maxLength={CONTROL_LIMITS.title} disabled={busy} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className={adminLabel}><span>Customer message</span><textarea className={`${adminField} min-h-24`} value={message} maxLength={CONTROL_LIMITS.message} disabled={busy} onChange={(e) => setMessage(e.target.value)} /><span className="block text-xs text-slate-400">Plain text. Do not name suppliers or promise refunds or dates.</span></label>
          <label className={adminLabel}><span>For customers with existing orders</span><input className={adminField} value={existingOrders} maxLength={CONTROL_LIMITS.existingOrders} disabled={busy} onChange={(e) => setExistingOrders(e.target.value)} /></label>
          <label className={adminLabel}><span>Expected restoration date (optional)</span><input type="date" className={adminField} value={expected} disabled={busy} onChange={(e) => setExpected(e.target.value)} /><span className="block text-xs text-slate-400">Shown as an expectation. It never reopens the service; when it passes, customers see that restoration is awaiting confirmation.</span></label>
        </>}
        <section aria-label="Customer preview" className="space-y-2"><h3 className="text-sm font-semibold text-slate-200">What customers will see</h3>
          <div inert className="pointer-events-none space-y-3 rounded-2xl border border-dashed border-slate-700 p-3">
            {!draft ? <p className="text-sm text-slate-400">Nothing: {name} shows normally, subject to every other check.</p>
              : draft.blocksPurchases ? <ServiceMaintenanceState control={draft} onNetwork={() => undefined} /> : <ServiceInlineNotice control={draft} />}
          </div>
          {draft && <p className="text-xs text-slate-400">Restoration line uses the server date {serverDate}. Chip: {stateChip(draft.state)}.</p>}
        </section>
      </div>
    </AdminSheet>
  );
}

const blankAnnouncement = (): Omit<Announcement, 'id' | 'status' | 'revision' | 'updatedAt' | 'actorId'> => ({ name: '', title: '', summary: '', details: '', severity: 'info', scope: 'global', placement: 'bar', pages: ['home'], audience: 'everyone', dismissible: true, startsAt: null, endsAt: null, expectedRestoration: null, cta: null });
const localInput = (iso: string | null) => iso ? new Date(Date.parse(iso) - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '';
const toIso = (local: string) => local ? new Date(local).toISOString() : null;

function AnnouncementSheet({ item, version, serverDate, scopes, onClose, onSave }: { item: Announcement | null; version: string; serverDate: string; scopes: ScopeView[]; onClose: () => void; onSave: (body: Record<string, unknown>, done: string) => Promise<unknown> }) {
  const [a, setA] = useState(() => (item ? { ...item, pages: [...item.pages] } : blankAnnouncement()));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const set = (patch: Partial<typeof a>) => setA((prev) => ({ ...prev, ...patch }));
  const problems = announcementProblems(a as Partial<Announcement>);
  const controls = scopes.map((s) => toPublic(s.control)).filter(Boolean) as PublicServiceControl[];
  const preview: PublicAnnouncement = { id: item?.id || 'preview', revision: item?.revision || 1, title: a.title || 'Title', summary: a.summary || 'Short public line', details: a.details, severity: a.severity, scope: a.scope, placement: a.placement, pages: a.pages, audience: a.audience, dismissible: a.dismissible, expectedRestoration: a.expectedRestoration, cta: a.cta };
  return (
    <AdminSheet title={item ? 'Edit announcement' : 'New announcement'} subtitle={item ? `${item.status === 'published' ? 'Published' : 'Draft'} · revision ${item.revision}. A change to its words or placement shows it again to customers who hid it.` : 'Saved as a draft. Publish it from the list when ready.'} onClose={onClose} busy={busy} wide
      footer={<div className="space-y-2">{error && <p role="alert" className="break-words text-sm text-rose-300">{error}</p>}{problems.length > 0 && <p className="text-xs text-amber-200">{problems[0]}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><AdminButton onClick={onClose} disabled={busy}>Cancel</AdminButton>
          <AdminButton variant="primary" busy={busy} disabled={busy || problems.length > 0} onClick={async () => {
            setBusy(true); setError('');
            try { await onSave({ action: item ? 'update' : 'create', id: item?.id, announcement: a, expectedVersion: version }, item ? 'Announcement saved.' : 'Draft saved. Publish it from the list when ready.'); }
            catch (e) { setError(errorText(e)); } finally { setBusy(false); }
          }}>{item ? 'Save changes' : 'Save draft'}</AdminButton></div></div>}>
      <div className="space-y-4">
        <section aria-label="Customer preview" className="space-y-2"><h3 className="text-sm font-semibold text-slate-200">Preview</h3>
          <div inert className="pointer-events-none overflow-hidden rounded-2xl border border-dashed border-slate-700">
            {a.placement === 'bar' ? <AnnouncementBarView announcement={preview} controls={controls} serverDate={serverDate} preview onDismiss={() => undefined} /> : <div className="p-3"><AnnouncementBarView announcement={{ ...preview, dismissible: false }} controls={controls} serverDate={serverDate} preview /><p className="px-1 pt-2 text-xs text-slate-400">Shown as a pop-up once per change on the chosen pages (never over checkout or a receipt).</p></div>}
          </div>
        </section>
        <label className={adminLabel}><span>Internal name (never shown to customers)</span><input className={adminField} value={a.name} maxLength={ANNOUNCEMENT_LIMITS.name} disabled={busy} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className={adminLabel}><span>Public title</span><input className={adminField} value={a.title} maxLength={ANNOUNCEMENT_LIMITS.title} disabled={busy} onChange={(e) => set({ title: e.target.value })} /></label>
        <label className={adminLabel}><span>Short public line</span><input className={adminField} value={a.summary} maxLength={ANNOUNCEMENT_LIMITS.summary} disabled={busy} onChange={(e) => set({ summary: e.target.value })} /></label>
        <label className={adminLabel}><span>Details (optional, shown on “Details”)</span><textarea className={`${adminField} min-h-24`} value={a.details} maxLength={ANNOUNCEMENT_LIMITS.details} disabled={busy} onChange={(e) => set({ details: e.target.value })} /><span className="block text-xs text-slate-400">Plain text only. Do not name suppliers or promise refunds or dates.</span></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={adminLabel}><span>Severity</span><select className={adminField} value={a.severity} disabled={busy} onChange={(e) => set({ severity: e.target.value as Announcement['severity'] })}>{ANNOUNCEMENT_SEVERITIES.map((s) => <option key={s} value={s}>{s === 'info' ? 'Information' : s === 'warning' ? 'Warning' : 'Critical'}</option>)}</select></label>
          <label className={adminLabel}><span>About</span><select className={adminField} value={a.scope} disabled={busy} onChange={(e) => set({ scope: e.target.value as Announcement['scope'] })}><option value="global">Everything (global)</option>{scopes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <label className={adminLabel}><span>Placement</span><select className={adminField} value={a.placement} disabled={busy} onChange={(e) => set({ placement: e.target.value as Announcement['placement'] })}>{ANNOUNCEMENT_PLACEMENTS.map((p) => <option key={p} value={p}>{p === 'bar' ? 'Bar under the header' : 'Important pop-up (exceptional)'}</option>)}</select></label>
          <label className={adminLabel}><span>Who sees it</span><select className={adminField} value={a.audience} disabled={busy} onChange={(e) => set({ audience: e.target.value as Announcement['audience'] })}>{ANNOUNCEMENT_AUDIENCES.map((p) => <option key={p} value={p}>{p === 'everyone' ? 'Everyone' : p === 'guests' ? 'Signed-out visitors' : 'Signed-in customers'}</option>)}</select></label>
          <label className={adminLabel}><span>Action button</span><select className={adminField} value={a.cta || ''} disabled={busy} onChange={(e) => set({ cta: (e.target.value || null) as Announcement['cta'] })}><option value="">None</option>{Object.entries(ANNOUNCEMENT_CTAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <label className={adminLabel}><span>Expected restoration (optional)</span><input type="date" className={adminField} value={a.expectedRestoration || ''} disabled={busy} onChange={(e) => set({ expectedRestoration: e.target.value || null })} /></label>
          <label className={adminLabel}><span>Starts (optional)</span><input type="datetime-local" className={adminField} value={localInput(a.startsAt)} disabled={busy} onChange={(e) => set({ startsAt: toIso(e.target.value) })} /></label>
          <label className={adminLabel}><span>Ends (optional)</span><input type="datetime-local" className={adminField} value={localInput(a.endsAt)} disabled={busy} onChange={(e) => set({ endsAt: toIso(e.target.value) })} /><span className="block text-xs text-slate-400">Ending only hides the announcement. It never reopens a paused service.</span></label>
        </div>
        <fieldset className="space-y-2"><legend className="text-sm font-semibold text-slate-200">Pages</legend><div className="flex flex-wrap gap-2">
          {ANNOUNCEMENT_PAGES.map((p) => <label key={p} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-800 px-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#00c365]" checked={a.pages.includes(p)} disabled={busy} onChange={(e) => set({ pages: e.target.checked ? [...a.pages, p] : a.pages.filter((x) => x !== p) })} />{p === 'all' ? 'Every customer page' : p[0].toUpperCase() + p.slice(1)}</label>)}
        </div></fieldset>
        <label className="flex min-h-11 items-center gap-3 text-sm text-slate-300"><input type="checkbox" className="h-4 w-4 accent-[#00c365]" checked={a.dismissible} disabled={busy} onChange={(e) => set({ dismissible: e.target.checked })} />Customers can hide it (it shows again after a material change)</label>
      </div>
    </AdminSheet>
  );
}
