import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react';
import {
  DELIVERY_STATES, NOTIFICATIONS_UNAVAILABLE, httpAdminNotificationsClient,
  type AdminNotificationsClient, type NotificationOverview, type NotificationSendDetail, type NotificationSendSummary, type NotificationTemplate,
} from '../../../services/adminNotifications';
import { httpAiDraftingClient, type AdminAiDraftingClient } from '../../../services/adminAiDrafting';
import { CATEGORY_LABELS, DEFAULT_LIMITS, DELIVERY_LABELS, SEND_STATUS_LABELS, STARTER_TEMPLATES, lengthGuidance, unfilledBlanks } from '../../../utils/notificationComposer';
import {
  AdminButton, AdminEmpty, AdminError, AdminLoading, AdminNotice, AdminPageHeader, AdminPanel, AdminSheet, AdminStat, AdminTabs, Freshness, RefreshButton, StatusPill, adminField, adminLabel,
} from '../ui/AdminUi';
import { AdminNotificationComposer, type ComposerData } from './AdminNotificationComposer';

type View = 'compose' | 'history' | 'templates';
const VIEWS: View[] = ['compose', 'history', 'templates'];
const when = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const settle = <T,>(promise: Promise<T>) => promise.then(value => value, () => null);

/**
 * Admin Notification Center: overview, composer, delivery history and reusable templates. Every count and status
 * is the server's. The production client uses the reviewed HTTP contract. Configuration and operational pause
 * are shown separately from template/history availability; neither browser permission nor preview proves delivery.
 */
export function AdminNotificationsSection({ sessionToken, initialView = '', client = httpAdminNotificationsClient, ai = httpAiDraftingClient, onNavigate }: {
  sessionToken: string; initialView?: string; client?: AdminNotificationsClient; ai?: AdminAiDraftingClient; onNavigate?: (view: string) => void;
}) {
  const [view, setView] = useState<View>(VIEWS.includes(initialView as View) ? initialView as View : 'compose');
  const [overview, setOverview] = useState<NotificationOverview | null>(null);
  const [data, setData] = useState<ComposerData>({ audiences: null, placeholders: null, destinations: null, limits: DEFAULT_LIMITS, templates: null });
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(client.available);
  const [seed, setSeed] = useState<{ template: NotificationTemplate; at: number } | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const live = useRef(0);

  const load = useCallback(async () => {
    if (!client.available) return;
    const id = ++live.current;
    setLoading(true);
    const [o, audiences, placeholders, destinations, limits, templates] = await Promise.all([
      settle(client.overview(sessionToken)), settle(client.audiences(sessionToken)), settle(client.placeholders(sessionToken)),
      settle(client.destinations(sessionToken)), settle(client.limits(sessionToken)), settle(client.templates(sessionToken)),
    ]);
    if (id !== live.current) return;
    setOverview(o);
    setData({ audiences, placeholders, destinations, limits: limits ?? DEFAULT_LIMITS, templates });
    setLoadedAt(Date.now()); setLoading(false);
  }, [client, sessionToken]);
  useEffect(() => { void load(); return () => { live.current++; }; }, [load]);

  const go = (next: View) => { setView(next); onNavigate?.(next === 'compose' ? '' : next); };

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Notifications" description="Send clear order updates and, with consent, occasional news to customers' phones. Results show what the push service reported."
        actions={client.available ? <><Freshness at={loadedAt} /><RefreshButton onClick={() => { void load(); setHistoryVersion(v => v + 1); }} busy={loading} /></> : undefined} />

      {client.available ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminStat compact label="Registered devices" value={overview?.subscribedDevices ?? '—'} hint="Registration is separate from delivery" />
          <AdminStat compact label="Agreed to promotions" value={overview?.marketingConsented ?? '—'} hint="Separate consent" />
          <AdminStat compact label="Account updates, 7 days" value={overview?.sendsLast7Days ?? '—'} />
          <AdminStat compact label="Failed deliveries, 7 days" value={overview?.failedLast7Days ?? '—'} tone={overview?.failedLast7Days ? 'warning' : 'neutral'} />
          <AdminStat compact label="Saved events" value={overview?.savedEvents ?? '—'} hint="Recording an event does not send it" />
          <AdminStat compact label="Queued deliveries" value={overview?.queuedDeliveries ?? '—'} />
          <AdminStat compact label="Delivery attempts" value={overview?.deliveryAttempts ?? '—'} />
          <AdminStat compact label="Provider accepted" value={overview?.providerAccepted ?? '—'} hint="Phone display and receipt are unconfirmed" />
        </div>
      ) : (
        <AdminNotice tone="info" title="Waiting for the notification server">{NOTIFICATIONS_UNAVAILABLE} Customer phones are not registered for alerts yet, so there is no audience to count.</AdminNotice>
      )}
      {overview&&(!overview.sendingEnabled||overview.paused)&&<AdminNotice tone="info" title={overview.paused?'Real sending is paused':'Real sending is disabled'}>Templates, preferences and history are connected. Push credentials and consenting-device acceptance must be verified before delivery is enabled. Permission alone does not prove delivery.</AdminNotice>}
      {overview?.worker&&<p className="text-sm text-slate-400">Worker: {overview.worker.running?'started':'not started'}. Last completed check: {overview.worker.lastCompletedAt?when(overview.worker.lastCompletedAt):'not observed'}{overview.worker.lastResult==='paused_or_disabled'?' (sending paused or disabled)':''}. This is process health, not proof of phone receipt. Recent saved events may become eligible on resume; review them before activation.</p>}

      <AdminTabs label="Notification area" value={view} onChange={go} tabs={[{ id: 'compose', label: 'Compose' }, { id: 'history', label: 'History' }, { id: 'templates', label: 'Templates' }]} />

      {view === 'compose' && <AdminNotificationComposer token={sessionToken} client={client} ai={ai} data={data} seed={seed}
        onTemplateSaved={template=>setData(d=>({...d,templates:[template,...(d.templates||[]).filter(t=>t.id!==template.id)]}))}
        onSent={() => { setHistoryVersion(v => v + 1); void settle(client.overview(sessionToken)).then(o => o && setOverview(o)); }}
        onViewHistory={() => go('history')} />}
      {view === 'history' && <NotificationHistory token={sessionToken} client={client} version={historyVersion} />}
      {view === 'templates' && <NotificationTemplates token={sessionToken} client={client} templates={data.templates} limits={data.limits}
        onSaved={saved => setData(d => ({ ...d, templates: [saved, ...(d.templates ?? []).filter(t => t.id !== saved.id)] }))}
        onUse={template => { setSeed({ template, at: Date.now() }); go('compose'); }} />}
    </div>
  );
}

function DeliveryCounts({ send }: { send: NotificationSendSummary }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums" aria-label="Delivery results">
      {DELIVERY_STATES.filter(s => send.counts[s] > 0).map(s => (
        <li key={s} className={s === 'failed' ? 'text-rose-300' : s === 'retrying' ? 'text-amber-200' : s === 'accepted' ? 'text-emerald-300' : 'text-slate-300'}>{DELIVERY_LABELS[s].label} {send.counts[s].toLocaleString()}</li>
      ))}
    </ul>
  );
}

function NotificationHistory({ token, client, version }: { token: string; client: AdminNotificationsClient; version: number }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ items: NotificationSendSummary[]; page: number; totalPages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (!client.available) return;
    let active = true; setError(null);
    client.sends(token, { page, limit: 20 }).then(r => { if (active) setResult(r); }, e => { if (active) setError(e instanceof Error ? e.message : 'History could not be loaded.'); });
    return () => { active = false; };
  }, [client, token, page, version, attempt]);

  if (!client.available) return <AdminEmpty title="No history yet">Sent messages and their delivery results will appear here once the notification server is connected.</AdminEmpty>;
  if (error) return <AdminError message={error} onRetry={() => setAttempt(n => n + 1)} />;
  if (!result) return <AdminLoading label="Loading sent messages…" />;
  if (!result.items.length) return <AdminEmpty title="Nothing sent yet">Messages you send appear here with what the push service reported for each device.</AdminEmpty>;
  return (
    <div className="space-y-3">
      <AdminNotice tone="neutral">“Accepted” means the push service took the message for that phone. It does not show whether the person saw or read it.</AdminNotice>
      <ul className="space-y-2">
        {result.items.map(s => (
          <li key={s.id}>
            <button type="button" onClick={() => setOpenId(s.id)} className="w-full space-y-1.5 rounded-2xl border border-slate-800 bg-[#0d151b] p-3.5 text-left hover:border-slate-700">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 truncate font-semibold text-white">{s.title}</span>
                <StatusPill tone={SEND_STATUS_LABELS[s.status].tone}>{SEND_STATUS_LABELS[s.status].label}</StatusPill>
              </span>
              <span className="block text-xs text-slate-400">{when(s.createdAt)} · {s.audienceLabel} · {s.recipients.toLocaleString()} {s.recipients === 1 ? 'device' : 'devices'} · {CATEGORY_LABELS[s.category]}</span>
              <DeliveryCounts send={s} />
            </button>
          </li>
        ))}
      </ul>
      {result.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <AdminButton disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" />Newer</AdminButton>
          <span className="text-xs text-slate-400">Page {result.page} of {result.totalPages}</span>
          <AdminButton disabled={page >= result.totalPages} onClick={() => setPage(p => p + 1)}>Older<ChevronRight className="h-4 w-4" /></AdminButton>
        </div>
      )}
      {openId && <SendDetail token={token} client={client} id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function SendDetail({ token, client, id, onClose }: { token: string; client: AdminNotificationsClient; id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<NotificationSendDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; setError(null); client.send(token, id).then(d => { if (active) setDetail(d); }, e => { if (active) setError(e instanceof Error ? e.message : 'Details could not be loaded.'); }); return () => { active = false; }; }, [client, token, id, attempt]);
  return (
    <AdminSheet title={detail?.title ?? 'Sent message'} subtitle={detail ? `${when(detail.createdAt)}${detail.createdBy ? ` · ${detail.createdBy}` : ''}` : undefined} onClose={onClose}
      footer={<div className="flex justify-between gap-2"><AdminButton onClick={() => setAttempt(n => n + 1)}>Refresh results</AdminButton><AdminButton variant="primary" onClick={onClose}>Done</AdminButton></div>}>
      {error ? <AdminError message={error} onRetry={() => setAttempt(n => n + 1)} /> : !detail ? <AdminLoading /> : (
        <div className="space-y-4 text-sm">
          <div className="rounded-2xl border border-slate-800 p-3"><p className="font-semibold text-white">{detail.title}</p><p className="mt-1 whitespace-pre-line text-slate-300">{detail.body}</p><p className="mt-2 text-xs text-slate-500">Opens: {detail.destination ?? 'Mystery Hub home'} · {detail.audienceLabel} · {CATEGORY_LABELS[detail.category]}</p></div>
          <div className="flex items-center gap-2"><StatusPill tone={SEND_STATUS_LABELS[detail.status].tone}>{SEND_STATUS_LABELS[detail.status].label}</StatusPill><span className="text-xs text-slate-400">{detail.recipients.toLocaleString()} {detail.recipients === 1 ? 'device' : 'devices'} targeted</span></div>
          <dl className="divide-y divide-slate-800 rounded-2xl border border-slate-800">
            {DELIVERY_STATES.map(s => (
              <div key={s} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <dt><span className="font-medium text-white">{DELIVERY_LABELS[s].label}</span><span className="block text-xs text-slate-500">{DELIVERY_LABELS[s].help}</span></dt>
                <dd className="font-semibold tabular-nums text-white">{detail.counts[s].toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          {detail.errors.length > 0 && (
            <AdminPanel tone="danger" title="Errors reported">
              <ul className="space-y-2">{detail.errors.map(e => <li key={e.code} className="flex justify-between gap-3"><span><span className="font-mono text-xs text-rose-200">{e.code}</span><span className="block text-slate-300">{e.message}</span></span><span className="tabular-nums text-white">{e.count.toLocaleString()}</span></li>)}</ul>
            </AdminPanel>
          )}
        </div>
      )}
    </AdminSheet>
  );
}

function NotificationTemplates({ token, client, templates, limits, onSaved, onUse }: {
  token: string; client: AdminNotificationsClient; templates: NotificationTemplate[] | null; limits: ComposerData['limits'];
  onSaved: (t: NotificationTemplate) => void; onUse: (t: NotificationTemplate) => void;
}) {
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const starters: NotificationTemplate[] = STARTER_TEMPLATES.map(t => ({ ...t, destination: null, updatedAt: null, version: null }));
  const blank: NotificationTemplate = { id: '', name: '', category: 'marketing', title: '', body: '', destination: '/app', updatedAt: null, version: null,enabled:true };
  const row = (t: NotificationTemplate, saved: boolean) => (
    <li key={t.id} className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-[#0d151b] p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-white">{t.name}<StatusPill tone={t.category === 'marketing' ? 'accent' : 'neutral'} dot={false}>{CATEGORY_LABELS[t.category]}</StatusPill></p>
        <p className="truncate text-sm text-slate-300">{t.title}</p>
        <p className="line-clamp-2 text-xs text-slate-500">{t.body}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <AdminButton onClick={() => onUse(t)}>Use</AdminButton>
        {t.locked&&<StatusPill tone="neutral">Automatic · locked</StatusPill>}
        {client.available&&!t.locked&&t.category==='marketing' && <AdminButton onClick={() => setEditing(saved ? t : { ...t, id: '', name: `${t.name} (copy)`, version: null })}><Pencil className="h-4 w-4" />{saved ? 'Edit' : 'Copy & edit'}</AdminButton>}
      </div>
    </li>
  );
  return (
    <div className="space-y-5">
      <AdminPanel title="Saved templates" actions={client.available ? <AdminButton variant="primary" onClick={() => setEditing(blank)}><Plus className="h-4 w-4" />New template</AdminButton> : undefined}>
        {!client.available ? <p className="text-sm text-slate-400">Saving templates needs the notification server. Until then, start from the templates below.</p>
          : templates === null ? <p role="alert" className="text-sm text-amber-200">Saved templates could not be loaded.</p>
          : templates.length === 0 ? <p className="text-sm text-slate-400">No saved templates yet. Copy a starter below or create one.</p>
          : <ul className="space-y-2">{templates.map(t => row(t, true))}</ul>}
      </AdminPanel>
      {starters.length>0&&<AdminPanel title="Starter templates" description="Only server-approved generic wording may be used.">
        <ul className="space-y-2">{starters.map(t => row(t, false))}</ul>
      </AdminPanel>}
      {editing && <TemplateEditor token={token} client={client} template={editing} limits={limits} onClose={() => setEditing(null)} onSaved={t => { onSaved(t); setEditing(null); }} />}
    </div>
  );
}

function TemplateEditor({ token, client, template, limits, onClose, onSaved }: { token: string; client: AdminNotificationsClient; template: NotificationTemplate; limits: ComposerData['limits']; onClose: () => void; onSaved: (t: NotificationTemplate) => void }) {
  const [value, setValue] = useState(template);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = lengthGuidance('title', value.title, limits), body = lengthGuidance('body', value.body, limits);
  const valid = value.title.trim().length>=3 && value.body.trim().length>=5 && title.tone !== 'over' && body.tone !== 'over';
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await client.saveTemplate(token, { id: value.id || null, expectedVersion: value.version, name: value.name.trim(), category: 'marketing', title: value.title.trim(), body: value.body.trim(), destination: '/app',enabled:value.enabled!==false });
      if (res.ok) onSaved(res.template);
      else setError(res.code === 'version_conflict' ? 'Someone else saved this template first. Close and reopen it to see their version.' : res.message);
    } catch (e) { setError(e instanceof Error ? e.message : 'The template was not saved.'); } finally { setBusy(false); }
  };
  const blanks = unfilledBlanks(`${value.title} ${value.body}`);
  return (
    <AdminSheet title={template.id ? 'Edit template' : 'New template'} onClose={onClose} busy={busy}
      footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><AdminButton onClick={onClose} disabled={busy}>Cancel</AdminButton><AdminButton variant="primary" busy={busy} disabled={!valid} onClick={() => void save()}>Save template</AdminButton></div>}>
      <div className="space-y-4">
        <p className="text-xs text-slate-400">The saved template is listed by its title. Only marketing wording can be edited.</p>
        <label className={adminLabel}><span>Message type</span>
          <select className={adminField} value="marketing" disabled><option value="marketing">News and offers · explicit opt-in required</option></select></label>
        <label className={adminLabel}><span>Enabled</span><input type="checkbox" checked={value.enabled!==false} onChange={e=>setValue({...value,enabled:e.target.checked})}/></label>
        <label className={adminLabel}><span>Title</span><input className={adminField} value={value.title} aria-describedby="tpl-title-count" onChange={e => setValue({ ...value, title: e.target.value })} /><span id="tpl-title-count" aria-hidden="true" className={`block text-xs ${title.tone === 'over' ? 'text-rose-300' : title.tone === 'long' ? 'text-amber-200' : 'text-slate-500'}`}>{title.count}/{title.max} · {title.message}</span></label>
        <label className={adminLabel}><span>Message</span><textarea className={`${adminField} min-h-28`} value={value.body} aria-describedby="tpl-body-count" onChange={e => setValue({ ...value, body: e.target.value })} /><span id="tpl-body-count" aria-hidden="true" className={`block text-xs ${body.tone === 'over' ? 'text-rose-300' : body.tone === 'long' ? 'text-amber-200' : 'text-slate-500'}`}>{body.count}/{body.max} · {body.message}</span></label>
        {blanks.length > 0 && <p className="text-xs text-slate-400">Blanks like {blanks.join(', ')} can stay in a template; they must be replaced before sending.</p>}
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      </div>
    </AdminSheet>
  );
}
