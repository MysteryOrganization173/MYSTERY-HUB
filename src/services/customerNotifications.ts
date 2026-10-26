/**
 * Customer push subscriptions and notification preferences: the frontend's view of Codex's push backend.
 *
 * Contract status (checked 2026-10-25 on main, every remote branch and open PRs): there is no service worker, no
 * VAPID key, no subscription API and no preference API yet (see docs/installable-app.md, "Deferred: Web Push").
 * `pendingCustomerNotificationsClient` reports `available: false`, so the account screen says alerts have not
 * started and never claims they are on. When Codex's contract lands, implement this interface against it.
 * No endpoint is named here because none has been agreed. There is no notification history (inbox) contract
 * either, so no inbox is shown.
 */
export interface DeviceSubscriptionStatus { subscribed: boolean }

export interface NotificationPreferences {
  /** Order, payment and account updates. */
  transactional: boolean;
  /** News and offers: separate, explicit consent, off unless the customer turns it on. */
  promotional: boolean;
  version: string;
}

export type ClientResult<T = undefined> = { ok: true; value: T } | { ok: false; message: string };

export interface PushSubscriptionPayload { endpoint: string; expirationTime: number | null; keys: { p256dh: string; auth: string } }

export interface CustomerNotificationsClient {
  readonly available: boolean;
  /** The server's public application key used to register this device (base64url). */
  publicKey(token: string): Promise<string>;
  /** Whether the server holds an active subscription for this device's endpoint. */
  deviceStatus(token: string, endpoint: string): Promise<DeviceSubscriptionStatus>;
  register(token: string, subscription: PushSubscriptionPayload): Promise<ClientResult>;
  unregister(token: string, endpoint: string): Promise<ClientResult>;
  preferences(token: string): Promise<NotificationPreferences>;
  savePreferences(token: string, input: { transactional: boolean; promotional: boolean; expectedVersion: string }): Promise<ClientResult<NotificationPreferences>>;
}

export const CUSTOMER_NOTIFICATIONS_UNAVAILABLE = 'Mystery Hub is not sending phone notifications yet.';
const unavailable = (): Promise<never> => Promise.reject(new Error(CUSTOMER_NOTIFICATIONS_UNAVAILABLE));
export const pendingCustomerNotificationsClient: CustomerNotificationsClient = {
  available: false,
  publicKey: unavailable, deviceStatus: unavailable, register: unavailable, unregister: unavailable, preferences: unavailable, savePreferences: unavailable,
};
