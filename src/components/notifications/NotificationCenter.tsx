import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BellOff, Loader2, Megaphone, ReceiptText, Settings2, ShieldCheck, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SecurityDialog } from '../auth/SecurityDialog';
import { NotificationAllowCard } from './NotificationAllowCard';
import { getAccountOrdersOnServer } from '../../services/apiClient';
import { httpCustomerNotificationsClient, type CustomerNotificationsClient, type NotificationInboxEntry, type NotificationPreferences } from '../../services/customerNotifications';
import { pushSupported, readServerDeviceState } from '../../pwa/push';
import { notificationPermissionState } from '../../pwa/notifications';
import { recordDismissal, STORAGE_KEYS } from '../../pwa/launchPolicy';
import { memberTrackingOrder } from '../../utils/memberHomePresentation';
import { afterOverlayHistory, useOverlayHistory } from '../../utils/overlayHistory';
import { CATEGORY_LABEL, INBOX_PAGE, mergeInboxPage, notificationTarget, notificationTime } from '../../utils/notificationCenterPresentation';

// One Notification Center for the whole app, opened from the header bell (members only).
const listeners = new Set<() => void>();
let open = false;
const emit = () => listeners.forEach(listener => listener());
export const openNotificationCenter = () => { open = true; emit(); };
export const closeNotificationCenter = () => { open = false; emit(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useNotificationCenterOpen = () => useSyncExternalStore(subscribe, () => open, () => false);

export function NotificationCenterHost() {
  const isOpen = useNotificationCenterOpen();
  const { user, sessionToken } = useApp();
  // Signing out or switching account never leaves the previous account's notifications on screen.
  useEffect(() => { closeNotificationCenter(); }, [user?.id]);
  return isOpen && user && sessionToken ? <NotificationCenter key={user.id} token={sessionToken} accountId={user.id} /> : null;
}

const ICONS = { orders: ReceiptText, announcements: Megaphone, account: ShieldCheck } as const;

/**
 * The account's own notifications, newest first: real records from the server, with no counts and no read marks
 * (nothing here knows whether a phone showed a message or anyone read it). Order updates open that order; an
 * announcement opens its approved page. While this device is not registered, the same "Allow Notifications" card as
 * everywhere else is offered at the top.
 */
export function NotificationCenter({ token, accountId, client = httpCustomerNotificationsClient }: { token: string; accountId: string; client?: CustomerNotificationsClient }) {
  const { setActivePage, openOrderStatus, openAccount, showToast } = useApp();
  useOverlayHistory('mhNotifications', closeNotificationCenter);
  const [items, setItems] = useState<NotificationInboxEntry[] | null>(null);
  const [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  const [more, setMore] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [opening, setOpening] = useState<string | null>(null);
  const alive = useRef(new AbortController());
  useEffect(() => () => alive.current.abort(), []);

  useEffect(() => {
    if (!client.inbox) { setItems([]); setMore('done'); return; }
    const controller = new AbortController();
    setItems(null); setError(false);
    client.inbox(token, 0, controller.signal).then(list => {
      if (controller.signal.aborted) return;
      setItems(list); setMore(list.length >= INBOX_PAGE ? 'idle' : 'done');
    }, () => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [client, token, attempt]);

  const loadMore = async () => {
    if (!items || !client.inbox || more === 'loading') return;
    setMore('loading');
    try {
      const next = await client.inbox(token, items.length, alive.current.signal);
      if (alive.current.signal.aborted) return;
      focusRow.current = items.length; // the first older row takes focus from Show older
      setItems(current => mergeInboxPage(current ?? [], next)); setMore(next.length >= INBOX_PAGE ? 'idle' : 'done');
    } catch { if (!alive.current.signal.aborted) setMore('error'); }
  };

  // This device: offer the shared Allow card only where it can work and the device is not registered yet.
  const [device, setDevice] = useState<{ show: boolean; paused: boolean; preferences: NotificationPreferences | null; blocked: boolean }>({ show: false, paused: false, preferences: null, blocked: false });
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      if (!client.available || !pushSupported()) return;
      const permission = notificationPermissionState();
      if (permission === 'denied') { setDevice(d => ({ ...d, blocked: true })); return; }
      if (permission !== 'default' && permission !== 'granted') return;
      const config = client.configuration ? await client.configuration().catch(() => null) : { enabled: true, paused: false };
      if (controller.signal.aborted || !config?.enabled) return;
      const server = permission === 'granted' ? await readServerDeviceState(client, token) : 'not_subscribed';
      if (controller.signal.aborted || server !== 'not_subscribed') return;
      const preferences = await client.preferences(token).catch(() => null);
      if (!controller.signal.aborted) setDevice({ show: true, paused: config.paused === true, preferences, blocked: false });
    })();
    return () => controller.abort();
  }, [client, token]);

  // Focus never drops to the page when the control that had it goes away.
  const listArea = useRef<HTMLDivElement>(null), focusRow = useRef<number | null>(null);
  useEffect(() => {
    if (focusRow.current === null || !items) return;
    const row = listArea.current?.querySelectorAll('li')[focusRow.current]?.querySelector<HTMLElement>('button');
    (row ?? listArea.current)?.focus(); focusRow.current = null;
  }, [items]);
  const notNow = () => { recordDismissal(STORAGE_KEYS.notificationOptIn); setDevice(d => ({ ...d, show: false })); window.setTimeout(() => listArea.current?.focus(), 0); };
  const settings = () => { closeNotificationCenter(); afterOverlayHistory('mhNotifications', () => openAccount('notifications')); };

  const openItem = async (item: NotificationInboxEntry) => {
    const target = notificationTarget(item);
    if (target.kind === 'none' || opening) return;
    // A page change waits until the center's own history entry is gone, so Back never meets a stray entry.
    if (target.kind === 'page') { const page = target.page; closeNotificationCenter(); afterOverlayHistory('mhNotifications', () => setActivePage(page)); return; }
    if (target.kind === 'orders') { closeNotificationCenter(); afterOverlayHistory('mhNotifications', () => setActivePage('orders')); return; }
    // The order is opened from the account's own order list, never from the notification's text.
    setOpening(item.id);
    try {
      const result = await getAccountOrdersOnServer(token, 50);
      if (alive.current.signal.aborted) return;
      const order = result.orders?.find(o => o.public_reference === target.reference);
      closeNotificationCenter();
      if (order) openOrderStatus(memberTrackingOrder(order)); else afterOverlayHistory('mhNotifications', () => setActivePage('orders'));
    } catch {
      if (!alive.current.signal.aborted) showToast('We couldn’t open that order right now. It is in My Orders.', 'info');
    } finally { if (!alive.current.signal.aborted) setOpening(null); }
  };

  return <SecurityDialog title="Notifications" onClose={closeNotificationCenter} layout="panel">
    <div className="space-y-4">
      {device.show && <NotificationAllowCard token={token} accountId={accountId} preferences={device.preferences} paused={device.paused} onNotNow={notNow} />}
      {device.blocked && <p className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-300"><BellOff className="mt-0.5 size-4 shrink-0" aria-hidden />This browser blocks notifications from Mystery Hub, so they won’t pop up here. You can still read them below.</p>}

      <div ref={listArea} tabIndex={-1} aria-label="Your notifications" className="space-y-4 outline-none">
      {!items && !error && <div role="status" aria-label="Loading notifications" className="space-y-2">
        {[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-800/60" aria-hidden="true" />)}
        <span className="sr-only">Loading notifications…</span>
      </div>}
      {error && <div role="alert" className="rounded-xl border border-slate-800 p-4 text-sm text-slate-300">
        <p className="font-semibold text-white">Your notifications couldn’t be loaded.</p>
        <p className="mt-1">Check your connection and try again.</p>
        <button type="button" className="mh-button-secondary mt-3" onClick={() => setAttempt(a => a + 1)}>Try again</button>
      </div>}
      {items && items.length === 0 && <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
        <ReceiptText className="mx-auto size-6 text-slate-400" aria-hidden />
        <p className="mt-2 font-semibold text-white">No notifications yet</p>
        <p className="mt-1 text-sm text-slate-400">Order updates and any news you chose will appear here.</p>
      </div>}
      {items && items.length > 0 && <ul aria-label="Recent notifications" className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
        {items.map(item => {
          const Icon = ICONS[item.category], target = notificationTarget(item), when = notificationTime(item.createdAt);
          const body = <>
            <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${item.category === 'orders' ? 'bg-emerald-500/10 text-emerald-300' : item.category === 'announcements' ? 'bg-sky-500/10 text-sky-300' : 'bg-slate-700/50 text-slate-300'}`} aria-hidden="true"><Icon className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs text-slate-400"><span className="font-semibold text-slate-300">{CATEGORY_LABEL[item.category]}</span><span aria-hidden="true">·</span><time dateTime={item.createdAt}>{when}</time></span>
              <span className="mt-0.5 block text-sm font-semibold text-white">{item.title}</span>
              <span className="mt-0.5 block text-sm text-slate-300 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">{item.body}</span>
            </span>
            {target.kind !== 'none' && (opening === item.id ? <Loader2 className="mt-1 size-4 shrink-0 animate-spin text-slate-400" aria-hidden /> : <ChevronRight className="mt-1 size-4 shrink-0 text-slate-500" aria-hidden />)}
          </>;
          return <li key={item.id}>
            {target.kind === 'none'
              ? <div className="flex gap-3 px-3.5 py-3">{body}</div>
              : <button type="button" onClick={() => { void openItem(item); }} aria-busy={opening === item.id || undefined} className="flex w-full gap-3 px-3.5 py-3 text-left hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#00c365]">{body}</button>}
          </li>;
        })}
      </ul>}
      {items && items.length > 0 && more !== 'done' && <div className="text-center">
        <button type="button" className="mh-button-secondary" disabled={more === 'loading'} onClick={() => { void loadMore(); }}>{more === 'loading' ? 'Loading…' : more === 'error' ? 'Try again' : 'Show older'}</button>
        {more === 'error' && <p role="alert" className="mt-2 text-sm text-slate-300">Older notifications couldn’t be loaded.</p>}
      </div>}
      </div>

      <button type="button" onClick={settings} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-800 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10">
        <Settings2 className="size-4" aria-hidden />Notification settings
      </button>
    </div>
  </SecurityDialog>;
}
