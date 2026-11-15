import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BellOff, BellRing, Loader2, Smartphone } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SecurityDialog, accountButton } from '../auth/SecurityDialog';
import { httpCustomerNotificationsClient, httpGuestNotificationsClient } from '../../services/customerNotifications';
import { IOS_HOME_SCREEN_COPY, PAUSED_NOTE, pushSupported, readGuestDeviceState, unsubscribeGuestDevice } from '../../pwa/push';
import { activateNotificationInvite } from '../../pwa/notificationOnboarding';
import { notificationPermissionState } from '../../pwa/notifications';
import { isInstalledApp, supportsAppleHomeScreen } from '../../pwa/appEnvironment';
import { NOTIFICATION_ACTIONS, notificationCopy } from '../../pwa/invitationCopy';

// Opened from the footer's "Notifications" entry; one sheet for the whole app.
const listeners = new Set<() => void>();
let open = false;
const emit = () => listeners.forEach(listener => listener());
export const openNotificationSettings = () => { open = true; emit(); };
const closeNotificationSettings = () => { open = false; emit(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/**
 * The always-available way to manage notifications. Members manage everything in My Account (device, order updates,
 * news and offers, recent notifications). Guests get this small sheet for this browser: news and offers on or off,
 * and a pointer to sign in for order updates, which need an account.
 */
export function NotificationsEntryHost() {
  const isOpen = useSyncExternalStore(subscribe, () => open, () => false);
  const { user, openAccount } = useApp();
  useEffect(() => { if (isOpen && user) { closeNotificationSettings(); openAccount(); } }, [isOpen, user, openAccount]);
  return isOpen && !user ? <GuestNotificationsSheet onClose={closeNotificationSettings} /> : null;
}

type SheetState = 'loading' | 'on' | 'off' | 'working' | 'blocked' | 'unsupported' | 'guests_off' | 'ios' | 'error';

function GuestNotificationsSheet({ onClose }: { onClose: () => void }) {
  const { openAuth } = useApp();
  const [state, setState] = useState<SheetState>('loading');
  const [paused, setPaused] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const request = useRef(new AbortController());
  useEffect(() => {
    const controller = request.current;
    void (async () => {
      const config = await httpCustomerNotificationsClient.configuration!().catch(() => ({ enabled: false, guests: false, paused: true }));
      if (controller.signal.aborted) return;
      setPaused(config.paused === true);
      if (supportsAppleHomeScreen() && !isInstalledApp() && !pushSupported()) return setState('ios');
      if (!pushSupported() || !config.enabled) return setState('unsupported');
      if (!config.guests) return setState('guests_off');
      if (notificationPermissionState() === 'denied') return setState('blocked');
      const device = await readGuestDeviceState(httpGuestNotificationsClient);
      if (!controller.signal.aborted) setState(device === 'subscribed' ? 'on' : device === 'error' ? 'error' : 'off');
    })();
    return () => controller.abort();
  }, []);

  const turnOn = async () => {
    setState('working'); setReason(null);
    const result: { step: string; message?: string } = await activateNotificationInvite(httpCustomerNotificationsClient, httpGuestNotificationsClient, { audience: 'guest', offers: true }, { token: null, signal: request.current.signal }).catch(() => ({ step: 'error' }));
    if (request.current.signal.aborted) return;
    if (result.step === 'error' && result.message) setReason(result.message);
    setState(result.step === 'registered' ? 'on' : result.step === 'denied' ? 'blocked' : result.step === 'dismissed' ? 'off' : 'error');
  };
  const turnOff = async () => {
    setState('working');
    const result = await unsubscribeGuestDevice(httpGuestNotificationsClient);
    if (!request.current.signal.aborted) setState(result.ok ? 'off' : 'error');
  };
  const signIn = () => { onClose(); openAuth('login', 'Sign in to get updates about your orders.'); };

  const offer = notificationCopy({ audience: 'guest', offers: true }).text;
  const status: Record<SheetState, { icon: React.ReactNode; title: string; body: string }> = {
    loading: { icon: <Loader2 className="h-5 w-5 animate-spin text-slate-300" aria-hidden />, title: 'Checking this browser…', body: '' },
    working: { icon: <Loader2 className="h-5 w-5 animate-spin text-slate-300" aria-hidden />, title: 'One moment…', body: 'Keep this window open.' },
    on: { icon: <BellRing className="h-5 w-5 text-emerald-300" aria-hidden />, title: 'News and offers are on', body: 'This browser gets Mystery Hub service news and occasional offers.' },
    off: { icon: <BellOff className="h-5 w-5 text-slate-300" aria-hidden />, title: 'Notifications are off', body: offer },
    blocked: { icon: <BellOff className="h-5 w-5 text-slate-300" aria-hidden />, title: 'Notifications are blocked', body: 'This browser is blocking notifications from Mystery Hub. Allow them in its site settings, then come back here.' },
    unsupported: { icon: <BellOff className="h-5 w-5 text-slate-300" aria-hidden />, title: 'Notifications aren’t available here', body: 'This browser can’t receive Mystery Hub notifications right now.' },
    guests_off: { icon: <BellOff className="h-5 w-5 text-slate-300" aria-hidden />, title: 'Not available without an account yet', body: 'Mystery Hub news for visitors without an account is coming. Sign in to get updates about your orders.' },
    ios: { icon: <Smartphone className="h-5 w-5 text-slate-300" aria-hidden />, title: IOS_HOME_SCREEN_COPY.title, body: IOS_HOME_SCREEN_COPY.body },
    error: { icon: <BellOff className="h-5 w-5 text-amber-200" aria-hidden />, title: 'Something went wrong', body: reason ? `${reason} Nothing was changed.` : 'Nothing was changed. Please try again.' },
  };
  const s = status[state];
  return <SecurityDialog title="Notifications" onClose={onClose}>
    <div role="status" className="flex gap-3 rounded-2xl border border-slate-700 bg-slate-900/40 p-3.5">
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="min-w-0 space-y-1">
        <p className="font-semibold text-white">{s.title}</p>
        {s.body && <p className="text-sm text-slate-300">{s.body}</p>}
        {state === 'on' && paused && <p className="text-sm text-amber-200">{PAUSED_NOTE.replace('This device', 'This browser')}</p>}
      </div>
    </div>
    <div className="mt-3 grid gap-2">
      {(state === 'off' || state === 'error') && <button type="button" className={`${accountButton} w-full !bg-[#00c365] !text-black`} onClick={() => { void turnOn(); }}>{NOTIFICATION_ACTIONS.allow}</button>}
      {state === 'on' && <button type="button" className={`${accountButton} w-full`} onClick={() => { void turnOff(); }}>Turn off for this browser</button>}
      {state === 'off' && <p className="text-xs text-slate-400">{NOTIFICATION_ACTIONS.note}</p>}
    </div>
    <div className="mt-5 border-t border-slate-700 pt-4">
      <p className="text-sm text-slate-300">Order updates need an account, so only you can see them.</p>
      <button type="button" className={`${accountButton} mt-2 w-full`} onClick={signIn}>Sign in</button>
    </div>
  </SecurityDialog>;
}
