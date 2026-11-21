import { notificationPermissionState, requestNotificationPermission, type NotificationPermissionState } from './notifications';
import { pushEndpointHash, type CustomerNotificationsClient, type GuestNotificationsClient, type NotificationConsent, type PushSubscriptionPayload } from '../services/customerNotifications';

/**
 * Device subscription for phone alerts. Builds on the permission-only module from P0-C: permission is never
 * treated as delivery. A device counts as subscribed only after the server confirms it holds the subscription.
 * Passive checks only inspect an existing registration. An explicit subscribe tap may register the reviewed
 * push-only worker, after configuration is confirmed; customer-generated sites and iframes are excluded.
 */
export type CustomerPushState =
  | 'unavailable'            // alerts not launched, unsupported browser, insecure page or no service worker
  | 'permission_needed'      // the phone has not been asked yet
  | 'disabled'               // the customer blocked notifications in the browser or phone settings
  | 'granted_not_subscribed' // permission given, but this device is not registered with the server
  | 'subscribing'
  | 'active'                 // the server confirmed this device's subscription
  | 'failed'                 // registration or the server check failed
  | 'unsubscribed';          // the customer turned alerts off for this device

export type ServerDeviceState = 'unknown' | 'subscribed' | 'not_subscribed' | 'error';
export type LocalPushStep = 'idle' | 'subscribing' | 'failed' | 'unsubscribed';

export function customerPushState(input: { contract: boolean; pushSupported: boolean; permission: NotificationPermissionState; server: ServerDeviceState; local: LocalPushStep }): CustomerPushState {
  const { contract, pushSupported, permission, server, local } = input;
  if (!contract || !pushSupported || permission === 'unsupported' || permission === 'unavailable') return 'unavailable';
  if (permission === 'denied') return 'disabled';
  if (local === 'subscribing') return 'subscribing';
  if (local === 'failed') return 'failed';
  if (permission === 'default') return local === 'unsubscribed' ? 'unsubscribed' : 'permission_needed';
  if (server === 'subscribed') return 'active';
  if (server === 'error') return 'failed';
  return local === 'unsubscribed' ? 'unsubscribed' : 'granted_not_subscribed';
}

/** What the account screen says for each state. "On" wording appears only for a server-confirmed device. */
export const PUSH_STATE_COPY: Record<CustomerPushState, { title: string; body: string; action: string | null }> = {
  unavailable: { title: 'Notifications aren’t available here', body: 'This browser can’t receive Mystery Hub notifications. Your orders always show their latest status on the Orders page.', action: null },
  permission_needed: { title: 'Notifications are off', body: 'Turn them on to get updates about your orders on this device. Your browser will ask first.', action: 'Turn on for this device' },
  disabled: { title: 'Notifications are blocked', body: 'This browser is blocking notifications from Mystery Hub. Allow them in its site settings, then come back here.', action: null },
  granted_not_subscribed: { title: 'Almost there', body: 'This browser allows notifications, but this device isn’t registered with Mystery Hub yet.', action: 'Finish turning on' },
  subscribing: { title: 'Turning on…', body: 'Registering this device with Mystery Hub. Keep this page open.', action: null },
  active: { title: 'Notifications are on', body: 'Mystery Hub confirmed this device. The updates you choose below can reach it.', action: 'Turn off for this device' },
  failed: { title: 'Notifications couldn’t be turned on', body: 'This device isn’t registered, so no notifications will arrive yet. Check your connection and try again.', action: 'Try again' },
  unsubscribed: { title: 'Notifications are off for this device', body: 'You turned them off here. Your other devices aren’t affected.', action: 'Turn on again' },
};
/** iPhone and iPad Safari tabs: Web Push works only in the Home Screen app, so say how to get there. */
export const IOS_HOME_SCREEN_COPY = {
  title: 'Use the Home Screen app',
  body: 'On iPhone and iPad, notifications work in the Mystery Hub Home Screen app. Add it to your Home Screen, open it from there, then turn notifications on here.',
} as const;
/** Registered, but the operator has paused sending: never imply that updates are arriving. */
export const PAUSED_NOTE = 'Mystery Hub isn’t sending notifications right now. This device will get them when sending resumes.';

type PushEnv = { Notification?: unknown; isSecureContext?: boolean; top?: unknown; self?: unknown; location?:{pathname:string}; navigator?: { serviceWorker?: { getRegistration(scope?: string): Promise<{ pushManager: PushManagerLike } | undefined>;register?(path:string,options:{scope:string;updateViaCache:string}):Promise<{pushManager:PushManagerLike}>;ready?:Promise<{pushManager:PushManagerLike}> } }; PushManager?: unknown };
type SubscriptionLike = { endpoint: string; toJSON(): unknown; unsubscribe(): Promise<boolean> };
type PushManagerLike = { getSubscription(): Promise<SubscriptionLike | null>; subscribe(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }): Promise<SubscriptionLike> };

const env = (): PushEnv | undefined => typeof window === 'undefined' ? undefined : window as unknown as PushEnv;

export function pushSupported(win: PushEnv | undefined = env()) {
  return Boolean(win?.navigator?.serviceWorker && 'PushManager' in (win as object)&&win.top===win.self&&win.isSecureContext!==false&&!win.location?.pathname.startsWith('/sites/'));
}

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function pushManager(win: PushEnv | undefined,register=false) {
  const sw=win?.navigator?.serviceWorker;
  let registration = await sw?.getRegistration('/');
  if(register&&sw?.register){registration=await sw.register('/push-sw.js',{scope:'/',updateViaCache:'none'});if(sw.ready)registration=await sw.ready;}
  return registration?.pushManager ?? null;
}

/** Reads this device's current server state without asking for anything. */
export async function readServerDeviceState(client: CustomerNotificationsClient, token: string, win: PushEnv | undefined = env()): Promise<ServerDeviceState> {
  if (!client.available || !pushSupported(win) || notificationPermissionState(win as never) !== 'granted') return 'unknown';
  try {
    const subscription = await (await pushManager(win))?.getSubscription();
    if (!subscription) return 'not_subscribed';
    return (await client.deviceStatus(token, subscription.endpoint)).subscribed ? 'subscribed' : 'not_subscribed';
  } catch { return 'error'; }
}

/**
 * Call only from a tap. Asks permission if needed, subscribes through the existing service worker, registers the
 * subscription with the server and then asks the server to confirm it. Anything short of that confirmation is
 * reported as not subscribed, and a subscription the server refused is removed from the browser again.
 */
export async function subscribeThisDevice(client: CustomerNotificationsClient, token: string, win: PushEnv | undefined = env(), signal?: AbortSignal, consent?: NotificationConsent): Promise<{ server: ServerDeviceState; permission: NotificationPermissionState; asked?: boolean; message?: string; preferences?: { transactional: boolean; promotional: boolean } }> {
  const current = () => { if (signal?.aborted) throw new Error('Alert setup cancelled.'); };
  current();
  if(!client.available||!pushSupported(win))return {server:'unknown',permission:notificationPermissionState(win as never),message:'Phone alerts are available only in the Mystery Hub app context.'};
  // The key first, so a disabled service never leads to a permission request. The HTTP client answers at once with
  // the key its recent configuration read confirmed, so the browser's question still follows the tap directly.
  let publicKey:string;try{publicKey=await client.publicKey(token);}catch(e){return {server:'error',permission:notificationPermissionState(win as never),message:(e as Error).message};}
  current();
  // `asked`: the browser really asked this time (only then can "default" mean the person closed its question).
  const asked = notificationPermissionState(win as never) === 'default';
  const permission = await requestNotificationPermission(win as never);
  current();
  if (permission !== 'granted') return { server: 'unknown', permission, asked };
  const manager = await pushManager(win,true).catch(() => null);
  current();
  if (!manager) return { server: 'error', permission, message: 'Alerts are not ready on this device yet.' };
  let subscription: SubscriptionLike | null = null;
  try {
    const existing = await manager.getSubscription();
    subscription = existing ?? await manager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
    current();
    const registered = await client.register(token, subscription.toJSON() as PushSubscriptionPayload, consent);
    current();
    // Remove only a subscription made by this attempt: an existing one may still serve a guest registration.
    if (!registered.ok) { if (!existing) await subscription.unsubscribe().catch(() => false); return { server: 'error', permission, message: registered.message }; }
    const confirmed = await client.deviceStatus(token, subscription.endpoint);
    current();
    return confirmed.subscribed ? { server: 'subscribed', permission, preferences: registered.value } : { server: 'not_subscribed', permission, message: 'Mystery Hub could not confirm this phone yet. Try again in a moment.' };
  } catch (error) {
    return { server: 'error', permission, message: error instanceof Error ? error.message : undefined };
  }
}

/** Removes this device on the server first, then in the browser, so the server never keeps sending to it. */
export async function unsubscribeThisDevice(client: CustomerNotificationsClient, token: string, win: PushEnv | undefined = env()): Promise<{ ok: boolean; message?: string }> {
  try {
    const subscription = await (await pushManager(win))?.getSubscription();
    if (!subscription) return { ok: true };
    const removed = await client.unregister(token, subscription.endpoint);
    if (!removed.ok) return { ok: false, message: removed.message };
    await subscription.unsubscribe().catch(() => false);
    return { ok: true };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Alerts could not be turned off. Try again.' }; }
}

// ── Guest news (no account) ───────────────────────────────────────────────────────────────────────────────────
const GUEST_KEY = 'mh_guest_notifications';
const GUEST_CREDENTIAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i;
export function readGuestCredential(): string | null {
  try { const value = window.localStorage.getItem(GUEST_KEY); return value && GUEST_CREDENTIAL.test(value) ? value : null; } catch { return null; }
}
function writeGuestCredential(value: string | null) {
  try { if (value) window.localStorage.setItem(GUEST_KEY, value); else window.localStorage.removeItem(GUEST_KEY); } catch { /* storage unavailable */ }
}

/** Passive: whether this browser already holds any push subscription (an account's, a guest's or a stale one). */
export async function hasPushSubscription(win: PushEnv | undefined = env()): Promise<boolean> {
  try { return Boolean(await (await pushManager(win))?.getSubscription()); } catch { return false; }
}

/** Passive: whether the server confirms this browser's guest registration (for its current subscription). */
export async function readGuestDeviceState(guest: GuestNotificationsClient, win: PushEnv | undefined = env()): Promise<ServerDeviceState> {
  const credential = readGuestCredential();
  if (!credential) return 'not_subscribed';
  if (!pushSupported(win) || notificationPermissionState(win as never) !== 'granted') return 'unknown';
  try {
    const subscription = await (await pushManager(win))?.getSubscription();
    if (!subscription) return 'not_subscribed';
    const status = await guest.status(credential);
    if (!status.subscribed) { writeGuestCredential(null); return 'not_subscribed'; }
    return status.endpointHash === await pushEndpointHash(subscription.endpoint) ? 'subscribed' : 'not_subscribed';
  } catch { return 'error'; }
}

/** Call only from a tap: permission, then subscription, then server registration, then server confirmation. */
export async function subscribeGuestDevice(client: CustomerNotificationsClient, guest: GuestNotificationsClient, consent: NotificationConsent, win: PushEnv | undefined = env(), signal?: AbortSignal): Promise<{ server: ServerDeviceState; permission: NotificationPermissionState; asked?: boolean; message?: string }> {
  const current = () => { if (signal?.aborted) throw new Error('Alert setup cancelled.'); };
  current();
  if (!client.available || !pushSupported(win)) return { server: 'unknown', permission: notificationPermissionState(win as never) };
  let publicKey: string; try { publicKey = await client.publicKey(''); } catch (e) { return { server: 'error', permission: notificationPermissionState(win as never), message: (e as Error).message }; }
  current();
  const asked = notificationPermissionState(win as never) === 'default';
  const permission = await requestNotificationPermission(win as never);
  current();
  if (permission !== 'granted') return { server: 'unknown', permission, asked };
  const manager = await pushManager(win, true).catch(() => null);
  current();
  if (!manager) return { server: 'error', permission, message: 'Notifications are not ready in this browser yet.' };
  let subscription: SubscriptionLike | null = null;
  let created = false, registered = false;
  try {
    const existing = await manager.getSubscription();
    created = !existing;
    subscription = existing ?? await manager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
    current();
    const { credential } = await guest.register(subscription.toJSON() as PushSubscriptionPayload, consent);
    registered = true;
    writeGuestCredential(credential);
    current();
    const status = await guest.status(credential);
    current();
    return status.subscribed && status.endpointHash === await pushEndpointHash(subscription.endpoint)
      ? { server: 'subscribed', permission }
      : { server: 'not_subscribed', permission, message: 'Mystery Hub could not confirm this browser yet. Try again in a moment.' };
  } catch (error) {
    // A refused guest registration leaves no stray browser subscription behind (only one this attempt created: an
    // existing one may belong to an account). Once the server holds the registration, the subscription stays.
    if (created && !registered) await subscription?.unsubscribe().catch(() => false);
    return { server: 'error', permission, message: error instanceof Error ? error.message : undefined };
  }
}

/** Removes the guest registration on the server first, then the browser subscription. */
export async function unsubscribeGuestDevice(guest: GuestNotificationsClient, win: PushEnv | undefined = env()): Promise<{ ok: boolean; message?: string }> {
  const credential = readGuestCredential();
  try {
    if (credential) await guest.unregister(credential);
    writeGuestCredential(null);
    const subscription = await (await pushManager(win))?.getSubscription();
    await subscription?.unsubscribe().catch(() => false);
    return { ok: true };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Notifications could not be turned off. Try again.' }; }
}
