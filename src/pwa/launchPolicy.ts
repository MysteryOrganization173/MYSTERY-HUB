/**
 * Installable app: when Mystery Hub may suggest something. Every suggestion is one tap to dismiss, and every
 * dismissal is remembered on this device so nobody is asked again and again.
 */
const DAY = 24 * 60 * 60 * 1000;

export type Snooze = { count: number; lastAt: number | null };
export const NO_SNOOZE: Snooze = { count: 0, lastAt: null };

export const STORAGE_KEYS = {
  installPromo: 'mh_install_promo',
  notificationOptIn: 'mh_notification_optin',
  notificationOffers: 'mh_notification_offers_answered:',
  welcomeGuest: 'mh_app_welcome_guest_at',
  welcomeShown: 'mh_app_welcome_shown',
} as const;

/** Install card: "Not now" (or closing the browser dialog) hides it for 30 days; after the third time, for good. */
export const INSTALL_PROMO_REST_DAYS = 30;
export const INSTALL_PROMO_MAX_DISMISSALS = 3;
/** Notification card: asked at most twice, three weeks apart. The browser's own answer is always final. */
export const NOTIFICATION_REST_DAYS = 21;
export const NOTIFICATION_MAX_DISMISSALS = 2;
/** Welcome sheet: once per app launch, and not for a week after someone chooses to browse as a guest. */
export const WELCOME_GUEST_REST_DAYS = 7;

const resting = (snooze: Snooze, days: number, max: number, now: number) =>
  snooze.count >= max || (snooze.lastAt !== null && now - snooze.lastAt < days * DAY);

export type InstallPromoMode = 'install' | 'apple' | 'hidden';
export function installPromoMode({ installed, hasPrompt, appleHomeScreen, snooze, now }: {
  installed: boolean; hasPrompt: boolean; appleHomeScreen: boolean; snooze: Snooze; now: number;
}): InstallPromoMode {
  if (installed || resting(snooze, INSTALL_PROMO_REST_DAYS, INSTALL_PROMO_MAX_DISMISSALS, now)) return 'hidden';
  // Chromium only fires its prompt when the app is installable and not already installed.
  if (hasPrompt) return 'install';
  return appleHomeScreen ? 'apple' : 'hidden';
}

export function showWelcomeSheet({ installed, signedIn, authChecking, path, shownThisLaunch, guestChosenAt, now }: {
  installed: boolean; signedIn: boolean; authChecking: boolean; path: string; shownThisLaunch: boolean; guestChosenAt: number | null; now: number;
}) {
  if (!installed || signedIn || authChecking || shownThisLaunch) return false;
  // Deep links (an order, a product, the builder) open straight to what was asked for.
  if (path !== '/') return false;
  return guestChosenAt === null || now - guestChosenAt >= WELCOME_GUEST_REST_DAYS * DAY;
}

export function showNotificationOptIn({ installed, signedIn, permission, registered, snooze, now }: {
  installed: boolean; signedIn: boolean; permission: string; registered?: boolean; snooze: Snooze; now: number;
}) {
  if (!installed || !signedIn || !(permission === 'default' || permission === 'granted' && registered === false)) return false;
  return !resting(snooze, NOTIFICATION_REST_DAYS, NOTIFICATION_MAX_DISMISSALS, now);
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const local = (): Store | null => { try { return window.localStorage; } catch { return null; } };
const session = (): Store | null => { try { return window.sessionStorage; } catch { return null; } };

// A remembered prompt answer is not consent. The server preference is authoritative.
const offersAnsweredThisSession = new Set<string>();
export function marketingPromptAnswered(accountId: string, store: Store | null = local()): boolean {
  if (offersAnsweredThisSession.has(accountId)) return true;
  try { return store?.getItem(STORAGE_KEYS.notificationOffers + accountId) === '1'; } catch { return false; }
}
export function markMarketingPromptAnswered(accountId: string, store: Store | null = local()) {
  offersAnsweredThisSession.add(accountId);
  try { store?.setItem(STORAGE_KEYS.notificationOffers + accountId, '1'); } catch { /* remembered for this launch */ }
}

export function readSnooze(key: string, store: Store | null = local()): Snooze {
  try {
    const value = JSON.parse(store?.getItem(key) || 'null');
    if (value && Number.isInteger(value.count) && value.count >= 0) return { count: value.count, lastAt: Number.isFinite(value.lastAt) ? value.lastAt : null };
  } catch { /* corrupt or unavailable: treat as never dismissed */ }
  return NO_SNOOZE;
}

export function recordDismissal(key: string, now = Date.now(), store: Store | null = local()): Snooze {
  const next = { count: readSnooze(key, store).count + 1, lastAt: now };
  try { store?.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable */ }
  return next;
}

export function readTimestamp(key: string, store: Store | null = local()): number | null {
  try { const value = Number(store?.getItem(key)); return Number.isFinite(value) && value > 0 ? value : null; } catch { return null; }
}

export function writeTimestamp(key: string, now = Date.now(), store: Store | null = local()) {
  try { store?.setItem(key, String(now)); } catch { /* storage unavailable */ }
}

/** sessionStorage lives for one launch of the installed app, which is exactly the welcome sheet's lifetime. */
export const welcomeShownThisLaunch = () => { try { return session()?.getItem(STORAGE_KEYS.welcomeShown) === '1'; } catch { return false; } };
export const markWelcomeShown = () => { try { session()?.setItem(STORAGE_KEYS.welcomeShown, '1'); } catch { /* storage unavailable */ } };
