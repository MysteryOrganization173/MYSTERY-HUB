import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { hasInstallPrompt, INSTALL_PENDING_KEY, INSTALLED_AT_KEY, promptInstall, subscribeInstallPrompt, wasInstalledThisVisit } from './installPrompt';
import { isInstalledApp, supportsAppleHomeScreen } from './appEnvironment';
import { isInAppBrowser } from './installGuidance';
import { installPromoMode, readSnooze, recordDismissal, STORAGE_KEYS, type InstallPromoMode } from './launchPolicy';
import { installRemembered, readTime } from './invitations';

/**
 * 'installing': the browser's dialog was accepted, which is not yet an install. 'installed': the browser confirmed
 * it (`appinstalled`). Nothing in between is ever shown as installed.
 */
export type InstallProgress = 'idle' | 'installing' | 'installed';

const userAgent = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent || '');

/** Install card state for this device. `mode` is 'hidden' whenever installing is impossible or was declined. */
export function useAppInstall() {
  const hasPrompt = useSyncExternalStore(subscribeInstallPrompt, hasInstallPrompt, () => false);
  const installedNow = useSyncExternalStore(subscribeInstallPrompt, wasInstalledThisVisit, () => false);
  const [snooze, setSnooze] = useState(() => readSnooze(STORAGE_KEYS.installPromo));
  const [progress, setProgress] = useState<InstallProgress>('idle');
  // App browsers inside WhatsApp, Facebook or Instagram cannot add to the home screen, whatever they report.
  const [environment] = useState(() => ({ installed: isInstalledApp(), apple: supportsAppleHomeScreen() && !isInAppBrowser(userAgent()) }));
  const [remembered, setRemembered] = useState(() => installRemembered({ installedAt: readTime(INSTALLED_AT_KEY), pendingAt: readTime(INSTALL_PENDING_KEY), now: Date.now() }));

  useEffect(() => { if (installedNow) setProgress('installed'); }, [installedNow]);

  const mode: InstallPromoMode = installPromoMode({
    installed: environment.installed, hasPrompt, appleHomeScreen: environment.apple, snooze, now: Date.now(), remembered,
  });

  const dismiss = useCallback(() => setSnooze(recordDismissal(STORAGE_KEYS.installPromo)), []);

  /** Runs inside the button's click so the browser accepts it as a user gesture. */
  const install = useCallback(async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      // Pending, not installed: the browser confirms with `appinstalled`, which clears this mark.
      try { window.localStorage.setItem(INSTALL_PENDING_KEY, String(Date.now())); } catch { /* storage unavailable */ }
      setRemembered(true);
      setProgress(current => (current === 'installed' ? current : 'installing'));
    } else if (outcome === 'dismissed') dismiss();
    return outcome;
  }, [dismiss]);

  // The /app landing page explains installing even after a dismissal, so it also needs the raw capabilities.
  return { mode, progress, install, dismiss, hasPrompt, installed: environment.installed, apple: environment.apple };
}
