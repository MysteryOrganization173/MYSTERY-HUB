/**
 * Installable app: what this browser can do. Pure functions over injectable globals, so the decisions are testable.
 *
 * Feature detection first. The one exception is Apple's Add to Home Screen, which has no API to detect: there we
 * require WebKit's `navigator.standalone` property together with a touch screen and no Chromium install prompt.
 */
type Nav = Pick<Navigator, 'maxTouchPoints'> & { standalone?: boolean };
type Win = { matchMedia?: (query: string) => { matches: boolean } } & Partial<Record<'onbeforeinstallprompt', unknown>>;

/** Opened from the home screen (Android WebAPK, desktop app window or iOS home screen web app). */
export function isInstalledApp(win: Win | undefined = typeof window === 'undefined' ? undefined : window,
  nav: Nav | undefined = typeof navigator === 'undefined' ? undefined : navigator) {
  if (!win) return false;
  if (nav?.standalone === true) return true;
  return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']
    .some(mode => win.matchMedia?.(`(display-mode: ${mode})`).matches === true);
}

/** Chromium browsers can show their install dialog from a button (once they decide the site is installable). */
export function supportsInstallPrompt(win: Win | undefined = typeof window === 'undefined' ? undefined : window) {
  return Boolean(win && 'onbeforeinstallprompt' in win);
}

/** iPhone and iPad browsers (all WebKit) install through Share → Add to Home Screen; there is no prompt API. */
export function supportsAppleHomeScreen(win: Win | undefined = typeof window === 'undefined' ? undefined : window,
  nav: Nav | undefined = typeof navigator === 'undefined' ? undefined : navigator) {
  return Boolean(win && nav && 'standalone' in nav && (nav.maxTouchPoints || 0) > 0 && !supportsInstallPrompt(win));
}
