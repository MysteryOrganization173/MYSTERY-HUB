/**
 * Installable app: capture of Chromium's install prompt.
 *
 * Imported by main.tsx before any surface loads, because `beforeinstallprompt` can fire before the app code has
 * downloaded and would otherwise be missed. No React here, so the entry script stays tiny. Business websites
 * (/sites/:slug) never offer Mystery Hub's install: their visitors are the owner's customers.
 */
import {trackGrowth} from '../utils/growthAnalytics';
import {isInstalledApp} from './appEnvironment';
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

let deferred: InstallPromptEvent | null = null;
let installedThisVisit = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export const INSTALLED_AT_KEY = 'mh_app_installed_at';
/** Set when someone accepts the browser's install dialog; cleared once the install is confirmed. */
export const INSTALL_PENDING_KEY = 'mh_install_pending_at';
/** iPhone/iPad: the Add to Home Screen steps were read (Safari cannot confirm an install). */
export const INSTALL_STEPS_SEEN_KEY = 'mh_install_steps_seen_at';

const remember = (win: Window, key: string, value: string | null) => {
  try { if (value === null) win.localStorage.removeItem(key); else win.localStorage.setItem(key, value); } catch { /* storage unavailable */ }
};
// Install marks live in localStorage and, for this page, in memory too, so blocked storage still behaves. Every
// change bumps a version that useAppInstall subscribes to (other tabs reach it through the storage event).
type Marks = { installed: number | null; pending: number | null; steps: number | null };
const marks: Marks = { installed: null, pending: null, steps: null };
let marksVersion = 0;
const touchMarks = () => { marksVersion++; notify(); };
const setMark = (win: Window, field: keyof Marks, key: string, value: number | null) => {
  marks[field] = value;
  remember(win, key, value === null ? null : field === 'installed' ? new Date(value).toISOString() : String(value));
};
export const markInstallPending = (win: Window = window) => { setMark(win, 'pending', INSTALL_PENDING_KEY, Date.now()); touchMarks(); };
export const markInstallStepsSeen = (win: Window = window) => { setMark(win, 'steps', INSTALL_STEPS_SEEN_KEY, Date.now()); touchMarks(); };
export const installMarksVersion = () => marksVersion;
/** Stored install marks, with this page's own marks filling in where storage failed. */
export function readInstallMarks(read: (key: string) => number | null) {
  return { installedAt: read(INSTALLED_AT_KEY) ?? marks.installed, pendingAt: read(INSTALL_PENDING_KEY) ?? marks.pending, stepsAt: read(INSTALL_STEPS_SEEN_KEY) ?? marks.steps };
}

/** Platform pages only: a published business website must never advertise Mystery Hub's own app. */
export function isPlatformPage(location: Pick<Location, 'pathname' | 'search'>) {
  return !/^\/sites\//.test(location.pathname) && !/[?&](isolated_template_preview|preview_template_id)=/.test(location.search);
}

export function captureInstallPrompt(win: Window = window) {
  if (!isPlatformPage(win.location)) return;
  // Opened from the home screen: the install is confirmed. Remembered here, so the browser tab sharing this storage
  // (Android, desktop Chromium) stops suggesting it too. iPhone home screen apps keep their own storage.
  if (isInstalledApp(win as never)) {
    marks.installed = Date.now();
    try { if (!win.localStorage.getItem(INSTALLED_AT_KEY)) win.localStorage.setItem(INSTALLED_AT_KEY, new Date().toISOString()); } catch { /* storage unavailable */ }
    setMark(win, 'pending', INSTALL_PENDING_KEY, null);
  }
  win.addEventListener?.('storage', event => {
    if (event.key === null || [INSTALLED_AT_KEY, INSTALL_PENDING_KEY, INSTALL_STEPS_SEEN_KEY].includes(event.key)) touchMarks();
  });
  win.addEventListener('beforeinstallprompt', event => {
    // Keep the browser's own mini-infobar quiet; Mystery Hub offers install from its own card instead.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  win.addEventListener('appinstalled', () => {
    deferred = null;
    installedThisVisit = true;
    trackGrowth('installed',{page:win.location.pathname==='/app'?'app':'home'});
    setMark(win, 'installed', INSTALLED_AT_KEY, Date.now());
    setMark(win, 'pending', INSTALL_PENDING_KEY, null);
    touchMarks();
  });
}

export const hasInstallPrompt = () => deferred !== null;
export const wasInstalledThisVisit = () => installedThisVisit;

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Must be called from a click handler. A prompt can be shown once, so it is released whatever the answer. */
export async function promptInstall(): Promise<InstallOutcome> {
  trackGrowth('install_action',{page:typeof location!=='undefined'&&location.pathname==='/app'?'app':'home'});
  const event = deferred;
  if (!event) return 'unavailable';
  deferred = null;
  notify();
  try {
    await event.prompt();
    trackGrowth('install_prompt',{page:typeof location!=='undefined'&&location.pathname==='/app'?'app':'home'});
    const { outcome } = await event.userChoice;
    trackGrowth(outcome==='accepted'?'install_accepted':'install_dismissed',{page:typeof location!=='undefined'&&location.pathname==='/app'?'app':'home'});
    return outcome;
  } catch {
    return 'unavailable';
  }
}
