import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { notificationPermissionState, type NotificationPermissionState } from '../../pwa/notifications';
import { PUSH_STATE_COPY, customerPushState, pushSupported, readServerDeviceState, subscribeThisDevice, unsubscribeThisDevice, type LocalPushStep, type ServerDeviceState } from '../../pwa/push';
import { httpCustomerNotificationsClient, type CustomerNotificationsClient, type NotificationPreferences } from '../../services/customerNotifications';
import { accountButton } from './SecurityDialog';

/**
 * My Account › Notifications. The device card reflects the server's confirmation, never browser permission alone,
 * and each preference changes only after the server saves it. Promotional updates are a separate choice that
 * starts off. Account choices remain available while real device delivery is disabled pending configuration.
 */
export function NotificationSettings({ token, client = httpCustomerNotificationsClient }: { token: string; client?: CustomerNotificationsClient }) {
  const [configured,setConfigured]=useState(false);
  const [permission, setPermission] = useState<NotificationPermissionState>(() => notificationPermissionState());
  const [server, setServer] = useState<ServerDeviceState>('unknown');
  const [local, setLocal] = useState<LocalPushStep>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [saving, setSaving] = useState<keyof Pick<NotificationPreferences, 'transactional' | 'promotional'> | null>(null);
  const alive = useRef(true);
  useEffect(() => {alive.current=true;return () => { alive.current = false; };}, []);

  useEffect(() => {
    if (!client.available) return;
    let active=true;setConfigured(false);setPrefs(null);setServer('unknown');setLocal('idle');setMessage(null);
    void (client.configuration?client.configuration():Promise.resolve({enabled:true})).then(c=>{if(active)setConfigured(c.enabled);},()=>{if(active)setConfigured(false);});
    void readServerDeviceState(client, token).then(s => { if (active&&alive.current) setServer(s); });
    client.preferences(token).then(p => { if (active&&alive.current) setPrefs(p); }, e => { if (active&&alive.current) setPrefsError(e instanceof Error ? e.message : 'Your choices could not be loaded.'); });
    return ()=>{active=false;};
  }, [client, token]);

  const state = customerPushState({ contract: client.available&&configured, pushSupported: pushSupported(), permission, server, local });
  const copy = PUSH_STATE_COPY[state];

  const act = async () => {
    setMessage(null);
    if (state === 'active') {
      setLocal('subscribing');
      const res = await unsubscribeThisDevice(client, token);
      if (!alive.current) return;
      if (res.ok) { setServer('not_subscribed'); setLocal('unsubscribed'); } else { setLocal('idle'); setMessage(res.message ?? 'Alerts could not be turned off. Try again.'); }
      return;
    }
    setLocal('subscribing');
    const res = await subscribeThisDevice(client, token);
    if (!alive.current) return;
    setPermission(res.permission); setServer(res.server);
    setLocal(res.server === 'subscribed' || res.permission !== 'granted' ? 'idle' : 'failed');
    if (res.message) setMessage(res.message);
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
    <section aria-labelledby="account-notifications" className="mt-6 space-y-3 border-t border-slate-700 pt-4">
      <h3 id="account-notifications" className="font-bold">Notifications</h3>
      <div role="status" className={`flex gap-3 rounded-2xl border p-3.5 ${state === 'active' ? 'border-emerald-500/30 bg-emerald-500/5' : state === 'failed' || state === 'disabled' ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-700 bg-slate-900/40'}`}>
        {busy ? <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-slate-300" aria-hidden /> : <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${state === 'active' ? 'text-emerald-300' : 'text-slate-300'}`} aria-hidden />}
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-white">{copy.title}</p>
          <p className="text-sm text-slate-300">{copy.body}</p>
          {message && <p className="text-sm text-amber-200">{message}</p>}
        </div>
      </div>
      {copy.action && <button type="button" disabled={busy} onClick={() => void act()} className={`${accountButton} w-full ${state === 'active' ? '' : '!bg-[#00c365] !text-black'}`}>{copy.action}</button>}

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
      {!client.available && <p className="text-xs text-slate-400">When phone alerts start, you will choose here between order updates and, separately, news and offers.</p>}
    </section>
  );
}
