/**
 * Installable app: notification permission only.
 *
 * Permission is not delivery. Sending alerts needs Web Push: a service worker, a VAPID key pair, an API that
 * stores each device's PushSubscription against its account, and a sender for order events. Those are handled
 * by push.ts and the authenticated notification APIs. This permission helper never subscribes or registers a
 * worker; delivery remains disabled until production configuration and consenting-device acceptance pass.
 */
export type NotificationPermissionState = 'unsupported' | 'unavailable' | 'default' | 'granted' | 'denied';

type NotificationLike = { permission: NotificationPermission; requestPermission: (callback?: (p: NotificationPermission) => void) => Promise<NotificationPermission> | void };
type Win = { Notification?: NotificationLike; isSecureContext?: boolean; top?: unknown; self?: unknown };

const api = (win: Win | undefined) => (win && 'Notification' in win ? win.Notification : undefined);

/** iPhone browsers only expose notifications inside a home screen web app, so a Safari tab reports unsupported. */
export function notificationPermissionState(win: Win | undefined = typeof window === 'undefined' ? undefined : window as unknown as Win): NotificationPermissionState {
  const notification = api(win);
  if (!notification) return 'unsupported';
  // Browsers refuse permission requests from insecure pages and embedded frames.
  if (win!.isSecureContext === false || win!.top !== win!.self) return 'unavailable';
  const { permission } = notification;
  return permission === 'granted' || permission === 'denied' ? permission : 'default';
}

/** Call only from a click. Older Safari versions answer through a callback rather than a promise. */
export function requestNotificationPermission(win: Win | undefined = typeof window === 'undefined' ? undefined : window as unknown as Win): Promise<NotificationPermissionState> {
  const notification = api(win);
  const state = notificationPermissionState(win);
  if (!notification || state !== 'default') return Promise.resolve(state);
  return new Promise(resolve => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(notificationPermissionState(win)); } };
    try {
      const result = notification.requestPermission(done);
      if (result && typeof result.then === 'function') result.then(done, done);
    } catch { done(); }
  });
}
