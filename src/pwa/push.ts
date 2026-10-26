import { notificationPermissionState, requestNotificationPermission, type NotificationPermissionState } from './notifications';
import type { CustomerNotificationsClient, PushSubscriptionPayload } from '../services/customerNotifications';

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

/** What the account screen says for each state. "On" wording appears only for a server-confirmed subscription. */
export const PUSH_STATE_COPY: Record<CustomerPushState, { title: string; body: string; action: string | null }> = {
  unavailable: { title: 'Phone alerts are not available', body: 'Mystery Hub is not sending phone notifications to this device. Your orders always show their latest status on the Orders page.', action: null },
  permission_needed: { title: 'Phone alerts are off', body: 'Turn them on to hear about your orders on this phone. Your phone will ask for permission first.', action: 'Turn on for this phone' },
  disabled: { title: 'Notifications are blocked', body: 'This browser or phone is blocking notifications from Mystery Hub. Allow them in your phone or browser settings, then come back here.', action: null },
  granted_not_subscribed: { title: 'Almost there', body: 'Your phone allows notifications, but this device is not registered for Mystery Hub alerts yet.', action: 'Finish turning on' },
  subscribing: { title: 'Turning on alerts…', body: 'Registering this phone with Mystery Hub. Keep this page open.', action: null },
  active: { title: 'Phone alerts are on', body: 'Mystery Hub confirmed this phone is registered. Updates you choose below can reach it.', action: 'Turn off for this phone' },
  failed: { title: 'Alerts could not be turned on', body: 'This phone is not registered, so no alerts will arrive yet. Check your connection and try again.', action: 'Try again' },
  unsubscribed: { title: 'Alerts are off for this phone', body: 'You turned alerts off on this device. Your other devices are not affected.', action: 'Turn on again' },
};

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
export async function subscribeThisDevice(client: CustomerNotificationsClient, token: string, win: PushEnv | undefined = env(), signal?: AbortSignal): Promise<{ server: ServerDeviceState; permission: NotificationPermissionState; message?: string }> {
  const current = () => { if (signal?.aborted) throw new Error('Alert setup cancelled.'); };
  current();
  if(!client.available||!pushSupported(win))return {server:'unknown',permission:notificationPermissionState(win as never),message:'Phone alerts are available only in the Mystery Hub app context.'};
  let publicKey:string;try{publicKey=await client.publicKey(token);}catch(e){return {server:'error',permission:notificationPermissionState(win as never),message:(e as Error).message};}
  current();
  const permission = await requestNotificationPermission(win as never);
  current();
  if (permission !== 'granted') return { server: 'unknown', permission };
  const manager = await pushManager(win,true).catch(() => null);
  current();
  if (!manager) return { server: 'error', permission, message: 'Alerts are not ready on this device yet.' };
  let subscription: SubscriptionLike | null = null;
  try {
    subscription = (await manager.getSubscription()) ?? await manager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
    current();
    const registered = await client.register(token, subscription.toJSON() as PushSubscriptionPayload);
    current();
    if (!registered.ok) { await subscription.unsubscribe().catch(() => false); return { server: 'error', permission, message: registered.message }; }
    const confirmed = await client.deviceStatus(token, subscription.endpoint);
    current();
    return confirmed.subscribed ? { server: 'subscribed', permission } : { server: 'not_subscribed', permission, message: 'Mystery Hub could not confirm this phone yet. Try again in a moment.' };
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
