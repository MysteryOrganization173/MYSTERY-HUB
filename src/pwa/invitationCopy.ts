/**
 * Invitation wording (approved 3.4 copy) and the purchase moment, kept free of React and CSS so they are testable.
 * One heading, one sentence, one clear action and one way out.
 */
import type { OrderRecord } from '../types';
import type { InstallProgress } from './useAppInstall';

/** Install: computers have no home screen, so they get the desktop wording. */
export function installCopy(phone: boolean) {
  return phone
    ? { title: 'Mystery Hub, one tap away.', text: 'Buy data, track orders and more, right from your home screen.' }
    : { title: 'Mystery Hub, one click away.', text: 'Buy data, track orders and more, right from your desktop.' };
}

/** After the browser's dialog: "Installing" until the browser confirms, and only then "installed". */
export function installProgressCopy(progress: Exclude<InstallProgress, 'idle'>, phone: boolean) {
  return progress === 'installed'
    ? { title: 'Mystery Hub is installed', text: phone ? 'Open it any time from your home screen.' : 'Open it any time from your apps, dock or Start menu.' }
    : { title: 'Installing Mystery Hub…', text: phone ? 'Your phone is adding it to your home screen.' : 'Your browser is adding it to your apps.' };
}

/** Channel: the heart is decoration, so the heading's accessible name is the sentence alone. */
export const CHANNEL_COPY = {
  title: 'Stay in the Mystery.',
  text: 'Follow our official channel for bundle updates, Friday Drops and special offers.',
  follow: 'Follow Channel', later: 'Maybe later', following: 'Already following',
} as const;

/** A purchase made just now (within the hour) in this browser, verified by the server as paid. The order time
 *  comes from the server, so a phone clock up to ten minutes behind it is tolerated. */
export const PURCHASE_MOMENT_MS = 60 * 60 * 1000;
export const CLOCK_SKEW_MS = 10 * 60 * 1000;
export const verifiedPurchase = (order: Pick<OrderRecord, 'journey' | 'status' | 'createdAt'> | null, now = Date.now()) => {
  if (!order || order.journey !== 'direct_checkout' || !(order.status === 'processing' || order.status === 'delivered')) return false;
  const age = now - Date.parse(order.createdAt);
  return Number.isFinite(age) && age > -CLOCK_SKEW_MS && age < PURCHASE_MOMENT_MS;
};

/** Notifications: one heading, one sentence naming exactly what the tap agrees to, one action, one way out. */
export function notificationCopy(invite: { audience: 'member' | 'guest'; offers: boolean }) {
  if (invite.audience === 'guest') return { title: 'Stay updated.', text: 'Get Mystery Hub service news and occasional offers.' };
  return invite.offers
    ? { title: 'Stay updated.', text: 'Get order updates, service news and occasional offers.' }
    : { title: 'Stay updated.', text: 'Get updates about your orders on this device.' };
}
export const NOTIFICATION_ACTIONS = { allow: 'Allow Notifications', later: 'Not now', note: 'You can turn them off anytime.', ordersOnly: 'Order updates only' } as const;
/** V2: the browser already allows notifications but this device is not registered yet: one tap, no new prompt. */
export const NOTIFICATION_REPAIR_NOTE = 'Your browser already allows them.';
/** V2: the operator paused sending, and registering still works. Promises no date and never says they are arriving. */
export const PAUSED_INVITE_NOTE = 'Notifications will arrive once sending resumes.';
/** The quiet line under the invitation's actions. */
export const notificationNote = (invite: { repair?: boolean }) => (invite.repair ? `${NOTIFICATION_REPAIR_NOTE} ${NOTIFICATION_ACTIONS.note}` : NOTIFICATION_ACTIONS.note);
/** One state after the tap, shown only for what really happened. "On" appears only after server confirmation. */
export const NOTIFICATION_RESULT = {
  registered: { title: 'You’re all set.', text: 'Notifications are on for this device.' },
  denied: { title: 'Notifications are blocked.', text: 'Your browser is blocking them. You can allow them in its site settings.' },
  error: { title: 'Notifications aren’t on yet.', text: 'Something went wrong on our side. Please try again later.' },
} as const;
