import type {CustomerNotificationsClient, GuestNotificationsClient, NotificationConsent, NotificationPreferences} from '../services/customerNotifications';
import {notificationPermissionState} from './notifications';
import {hasPushSubscription, pushSupported, readGuestDeviceState, readServerDeviceState, subscribeGuestDevice, subscribeThisDevice} from './push';
import {marketingPromptAnswered, notificationInviteResting, type Snooze} from './launchPolicy';

/**
 * Notification onboarding (3.4): one first-party invitation, then the browser's own permission request, then
 * server registration with purpose-specific consent, then one success state only after the server confirms.
 *
 * - Members: order updates, plus service news and offers unless they turned those off before (never revived).
 * - Guests: service news and occasional offers only. Order updates for guests stay off: there is no guest order
 *   capability to bind them to securely, so they are never offered here.
 * - Browser permission alone is never treated as consent or as a registered device.
 */
type Environment = Parameters<typeof subscribeThisDevice>[2];
export type InviteAudience = 'member' | 'guest';
export interface NotificationInvite { audience: InviteAudience; offers: boolean }
/**
 * What the read-only assessment found: the invite (what a tap consents to) plus how to present it.
 * - `paused`: the operator has paused sending; registering still works, and the card says when notifications arrive.
 * - `repair`: the browser already allows notifications but this device is not registered: one tap, no new prompt.
 * - `permission`: the browser permission seen when assessing (a later change means the assessment is stale).
 */
export interface NotificationOpportunity extends NotificationInvite { paused: boolean; repair: boolean; permission: 'default' | 'granted' }
export type InviteResult = { step: 'registered' | 'denied' | 'dismissed' | 'error'; message?: string };
/** The version of the words a person saw when they chose; recorded with each consent on the server. */
export const NOTIFICATION_COPY_VERSION = 'invite-3.4-1';
const current = (signal: AbortSignal) => { if (signal.aborted) throw new Error('Notification screen closed.'); };

/** The purposes one "Allow Notifications" tap records, exactly as its copy names them. */
export function inviteConsent(invite: NotificationInvite): NotificationConsent {
  if (invite.audience === 'guest') return { purposes: ['marketing'], copyVersion: NOTIFICATION_COPY_VERSION + '-guest' };
  return invite.offers
    ? { purposes: ['transactional', 'marketing'], copyVersion: NOTIFICATION_COPY_VERSION }
    : { purposes: ['transactional'], copyVersion: NOTIFICATION_COPY_VERSION + '-orders' };
}

/**
 * What a member's "Allow Notifications" offers, wherever it is shown (invitation, My Account, Notification Center):
 * order updates, plus service news and offers unless they turned those off before. A withdrawn "no" to offers is
 * never revived by allowing notifications; offers come back only through the News and offers switch.
 */
export function memberInvite(preferences: Pick<NotificationPreferences, 'promotional' | 'marketingOptedOut'>, accountId?: string): NotificationInvite {
  const declinedBefore = preferences.marketingOptedOut === true || (!preferences.promotional && !!accountId && marketingPromptAnswered(accountId));
  return { audience: 'member', offers: !declinedBefore };
}

/**
 * Read-only assessment: never asks permission, subscribes or writes consent. V2: an operator pause no longer hides
 * the invitation, because the server accepts registrations while sending is paused; the card says so instead.
 * Only an unconfigured or unavailable service (where registration would be refused) hides it.
 */
export async function notificationInviteOpportunity(client: CustomerNotificationsClient, guest: GuestNotificationsClient,
  options: { token: string | null; accountId?: string; isCustomer?: boolean; signal: AbortSignal; snooze: Snooze; now: number; environment?: Environment }): Promise<NotificationOpportunity | null> {
  current(options.signal);
  if (!client.available || !pushSupported(options.environment) || notificationInviteResting(options.snooze, options.now)) return null;
  // A blocked or unsupported browser is never asked: only "default" (not yet asked) or "granted" without a device.
  const permission = notificationPermissionState(options.environment as never);
  if (permission !== 'default' && permission !== 'granted') return null;
  const config = client.configuration ? await client.configuration() : { enabled: true, guests: false, paused: false };
  current(options.signal);
  // Invite only where registering can work: never while Web Push is unconfigured or off. A pause is shown, not hidden.
  if (!config.enabled) return null;
  const presentation = { paused: config.paused !== false, repair: permission === 'granted', permission } as const;
  if (options.token) {
    if (options.isCustomer === false) return null;
    const device = permission === 'granted' ? await readServerDeviceState(client, options.token, options.environment) : 'not_subscribed';
    current(options.signal);
    if (device !== 'not_subscribed') return null;
    const preferences = await client.preferences(options.token);
    current(options.signal);
    // An earlier "no" to offers (on the server, or the old separate offers question on this device) is kept.
    return { ...memberInvite(preferences, options.accountId), ...presentation };
  }
  if (!config.guests) return null;
  const state = await readGuestDeviceState(guest, options.environment);
  current(options.signal);
  if (state !== 'not_subscribed') return null;
  // A subscription without a confirmed guest registration usually belongs to an account (another tab, or signed in
  // earlier): never put guest news over it. Turning guest news on stays available from the footer's Notifications.
  if (permission === 'granted' && await hasPushSubscription(options.environment)) return null;
  current(options.signal);
  return { audience: 'guest', offers: true, ...presentation };
}

// Every "Allow Notifications" (the invitation, My Account, the Notification Center, the visitor sheet) runs through
// activateNotificationInvite. When one of them registers this device or the browser blocks notifications, an
// invitation assessed earlier in this page is out of date and must not appear.
const choiceListeners = new Set<(step: 'registered' | 'denied') => void>();
export function onNotificationChoice(listener: (step: 'registered' | 'denied') => void) {
  choiceListeners.add(listener);
  return () => { choiceListeners.delete(listener); };
}

/** One explicit tap: permission -> subscription -> registration with consent -> server confirmation. */
export async function activateNotificationInvite(client: CustomerNotificationsClient, guest: GuestNotificationsClient, invite: NotificationInvite,
  options: { token: string | null; signal: AbortSignal; environment?: Environment }): Promise<InviteResult> {
  current(options.signal);
  const consent = inviteConsent(invite);
  if (invite.audience === 'member' && !options.token) return { step: 'error', message: 'Sign in again to turn on notifications.' };
  const result = invite.audience === 'member'
    ? await subscribeThisDevice(client, options.token!, options.environment, options.signal, consent)
    : await subscribeGuestDevice(client, guest, consent, options.environment, options.signal);
  // Reported even if the screen closed after the answer came back, so nothing offers it again in this page.
  if (result.server === 'subscribed' || result.permission === 'denied') choiceListeners.forEach(listener => listener(result.server === 'subscribed' ? 'registered' : 'denied'));
  current(options.signal);
  if (result.server === 'subscribed') return { step: 'registered' };
  return { step: result.permission === 'denied' ? 'denied' : result.permission === 'default' ? 'dismissed' : 'error', message: result.message };
}
