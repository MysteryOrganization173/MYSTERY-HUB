import {SmsPreferences} from './SmsPreferences';
import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2, Smartphone } from 'lucide-react';
import { notificationPermissionState, type NotificationPermissionState } from '../../pwa/notifications';
import { IOS_HOME_SCREEN_COPY, PAUSED_NOTE, PUSH_STATE_COPY, customerPushState, pushSupported, readServerDeviceState, unsubscribeThisDevice, type LocalPushStep, type ServerDeviceState } from '../../pwa/push';
import { isInstalledApp, supportsAppleHomeScreen } from '../../pwa/appEnvironment';
import { httpCustomerNotificationsClient, type CustomerNotificationsClient, type NotificationPreferences } from '../../services/customerNotifications';
import { NotificationAllowCard } from '../notifications/NotificationAllowCard';
import { accountButton } from './SecurityDialog';

/** How to unblock notifications, in the words of the place the customer is in. */
export function blockedHelp(env: { appleHomeScreen: boolean; installed: boolean }): string {
  if (env.appleHomeScreen && env.installed) return 'On iPhone or iPad: open Settings › Notifications › Mystery Hub and turn on Allow Notifications. Then come back here.';
  if (env.installed) return 'Open your phone’s settings for the Mystery Hub app, choose Notifications and allow them. Then come back here.';
  return 'Tap the icon beside the web address, open Site settings › Notifications and choose Allow. Then come back here.';
}

/**
 * My Account › Notifications (3.4.1). The device card reflects the server's confirmation, never browser permission
 * alone, and each preference changes only after the server saves it. Turning this device on uses the same
 * "Allow Notifications" card as the invitation and the Notification Center (same words, same consent). Promotional
 * updates stay a separate choice, and allowing notifications never turns them back on after a "no".
 */
export function NotificationSettings({ token, client = httpCustomerNotificationsClient, onShowRecent, accountId = '', embedded = false }: {
  token: string; client?: CustomerNotificationsClient; onShowRecent?: () => void; accountId?: string; embedded?: boolean;
}) {
  const [configured,setConfigured]=useState(false);
  const [configError,setConfigError]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const [paused,setPaused]=useState(false);
  const [iosTab]=useState(()=>supportsAppleHomeScreen()&&!isInstalledApp()&&!pushSupported());
  const [permission, setPermission] = useState<NotificationPermissionState>(() => notificationPermissionState());
  const [server, setServer] = useState<ServerDeviceState>('unknown');
  const [local, setLocal] = useState<LocalPushStep>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [saving, setSaving] = useState<keyof Pick<NotificationPreferences, 'transactional' | 'promotional'> | null>(null);
  const alive = useRef(true);
  useEffect(() => {alive.current=true;return () => { alive.current = false; };}, []);
  // When the card is replaced by "Notifications are on", focus moves to that status rather than to the page.
  const statusCard = useRef<HTMLDivElement>(null), focusStatus = useRef(false);
  useEffect(() => { if (focusStatus.current && server === 'subscribed') { focusStatus.current = false; statusCard.current?.focus(); } }, [server]);

  useEffect(() => {
    if (!client.available) return;
    let active=true;setConfigured(false);setConfigError(false);setPrefs(null);setPrefsError(null);setServer('unknown');setLocal('idle');setMessage(null);
    void (client.configuration?client.configuration():Promise.resolve({enabled:true,paused:false})).then(c=>{if(active){setConfigured(c.enabled);setPaused(c.paused===true);}},()=>{if(active){setConfigured(false);setConfigError(true);}});
    void readServerDeviceState(client, token).then(s => { if (active&&alive.current) setServer(s); });
    client.preferences(token).then(p => { if (active&&alive.current) setPrefs(p); }, e => { if (active&&alive.current) setPrefsError(e instanceof Error ? e.message : 'Your choices could not be loaded.'); });
    return ()=>{active=false;};
  }, [client, token, attempt]);

  const state = customerPushState({ contract: client.available&&configured, pushSupported: pushSupported(), permission, server, local });
  // An iPhone/iPad Safari tab cannot receive Web Push: show the Home Screen path instead of a dead end.
  const copy = state === 'unavailable' && iosTab && configured ? { ...IOS_HOME_SCREEN_COPY, action: null } : PUSH_STATE_COPY[state];
  // Not on yet, and it can be turned on here: the shared "Allow Notifications" card does it.
  const allowable = configured && !iosTab && (state === 'permission_needed' || state === 'granted_not_subscribed' || state === 'unsubscribed' || state === 'failed');

  const turnOff = async () => {
    setMessage(null);
    setLocal('subscribing');
    const res = await unsubscribeThisDevice(client, token);
    if (!alive.current) return;
    if (res.ok) { setServer('not_subscribed'); setLocal('unsubscribed'); } else { setLocal('idle'); setMessage(res.message ?? 'Notifications could not be turned off. Try again.'); }
  };

  const toggle = async (key: 'transactional' | 'promotional') => {
    if (!prefs || saving) return;
    setSaving(key); setPrefsError(null);
    try {
      const res = await client.savePreferences(token, { transactional: key === 'transactional' ? !prefs.transactional : prefs.transactional, promotional: key === 'promotional' ? !prefs.promotional : prefs.promotional, expectedVersion: prefs.version });
      if (!alive.current) return;
      if (res.ok) setPrefs(res.value); else setPrefsError(res.message);
    } catch (e) { if (alive.current) setPrefsError(e instanceof Error ? e.message : 'Your choice was not saved.'); }
    finally { if (alive.current) setSaving(null); }
  };

  const Icon = state === 'active' ? BellRing : state === 'disabled' || state === 'unsubscribed' ? BellOff : Bell;
  const busy = state === 'subscribing';

  return (
    <section aria-labelledby={embedded ? undefined : 'account-notifications'} aria-label={embedded ? 'Notification settings' : undefined} className={embedded ? 'mt-4 space-y-3' : 'mt-6 space-y-3 border-t border-slate-700 pt-4'}>
      {!embedded && <h3 id="account-notifications" className="font-bold">Notifications</h3>}
      {configError
        ? <div role="status" className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5">
            <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-white">We couldn’t check notifications right now</p>
              <p className="text-sm text-slate-300">Nothing was changed. Check your connection and try again.</p>
              <button type="button" className="mt-1 min-h-11 font-semibold text-emerald-300" onClick={() => setAttempt(a => a + 1)}>Try again</button>
            </div>
          </div>
        : allowable && !prefs && !prefsError
        // The card waits for the account's choices, so its sentence never changes under the customer's finger.
        ? <p role="status" className="text-sm text-slate-400">Checking this device…</p>
        : allowable
        ? <NotificationAllowCard token={token} accountId={accountId} preferences={prefs} paused={paused} client={client}
            onRegistered={() => { focusStatus.current = true; setPermission('granted'); setServer('subscribed'); setLocal('idle'); void client.preferences(token).then(p => { if (alive.current) setPrefs(p); }, () => {}); }} />
        : <>
          <div ref={statusCard} tabIndex={-1} role="status" className={`flex gap-3 rounded-2xl border p-3.5 outline-none ${state === 'active' ? 'border-emerald-500/30 bg-emerald-500/5' : state === 'disabled' ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-700 bg-slate-900/40'}`}>
            {busy ? <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-slate-300" aria-hidden /> : state === 'unavailable' && iosTab ? <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" aria-hidden /> : <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${state === 'active' ? 'text-emerald-300' : 'text-slate-300'}`} aria-hidden />}
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-white">{copy.title}</p>
              <p className="text-sm text-slate-300">{state === 'disabled' ? blockedHelp({ appleHomeScreen: supportsAppleHomeScreen(), installed: isInstalledApp() }) : copy.body}</p>
              {state === 'active' && paused && <p className="text-sm text-amber-200">{PAUSED_NOTE}</p>}
              {message && <p className="text-sm text-amber-200">{message}</p>}
            </div>
          </div>
          {state === 'active' && <button type="button" disabled={busy} onClick={() => void turnOff()} className={`${accountButton} w-full`}>{copy.action}</button>}
        </>}

      {client.available && (
        <fieldset className="space-y-2" disabled={!prefs || Boolean(saving)}>
          <legend className="mb-1 text-sm text-slate-300">What you receive</legend>
          {([
            ['transactional', 'Order and account updates', 'Payments, deliveries, delays and refunds for your own orders.'],
            ['promotional', 'News and offers', 'New services and occasional offers. Only if you choose it; you can stop anytime.'],
          ] as const).map(([key, label, help]) => (
            <label key={key} className="flex min-h-14 cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-700 p-3">
              <span><span className="block text-sm font-semibold text-white">{label}</span><span className="block text-xs text-slate-400">{help}</span></span>
              <span className="flex items-center gap-2">
                {saving === key && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Saving" />}
                <input type="checkbox" role="switch" className="relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-700 transition-colors before:absolute before:left-1 before:top-1 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition-transform checked:bg-[#00c365] checked:before:translate-x-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00c365] disabled:opacity-50" checked={Boolean(prefs?.[key])} onChange={() => void toggle(key)} />
              </span>
            </label>
          ))}
          {!prefs && !prefsError && <p role="status" className="text-xs text-slate-400">Loading your choices…</p>}
          {prefsError && <p role="alert" className="text-sm text-rose-300">{prefsError}</p>}
          {state !== 'active' && prefs && <p className="text-xs text-slate-400">These choices are saved to your account. Alerts reach this phone only once it is registered above.</p>}
        </fieldset>
      )}
      {!client.available && <p className="text-xs text-slate-400">When notifications start, you will choose here between order updates and, separately, news and offers.</p>}
      {/* Recent notifications live in the Notification Center (the bell), not here. */}
      {onShowRecent && <button type="button" onClick={onShowRecent} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-700 px-3 text-left text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10">See recent notifications<span aria-hidden="true">›</span></button>}
      <SmsPreferences token={token}/>
    </section>
  );
}
