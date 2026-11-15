import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  hasInstallPrompt, installMarksVersion, markInstallPending, markInstallStepsSeen, promptInstall, readInstallMarks,
  subscribeInstallPrompt, wasInstalledThisVisit,
} from './installPrompt';
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
  const marksVersion = useSyncExternalStore(subscribeInstallPrompt, installMarksVersion, () => 0);
  // App browsers inside WhatsApp, Facebook or Instagram cannot add to the home screen, whatever they report.
  const [environment] = useState(() => ({ installed: isInstalledApp(), apple: supportsAppleHomeScreen() && !isInAppBrowser(userAgent()) }));
  // Re-read whenever a mark changes here, in another card or in another tab, and when the browser offers
  // installation again; memory fills in when storage is blocked.
  const remembered = useMemo(() => installRemembered({ ...readInstallMarks(readTime), now: Date.now() }), [marksVersion, hasPrompt]);

  useEffect(() => { if (installedNow) setProgress('installed'); }, [installedNow]);

  const mode: InstallPromoMode = installPromoMode({
    installed: environment.installed, hasPrompt, appleHomeScreen: environment.apple, snooze, now: Date.now(), remembered,
  });

  const dismiss = useCallback(() => setSnooze(recordDismissal(STORAGE_KEYS.installPromo)), []);
  /** iPhone/iPad: the steps were read. Safari cannot confirm an install, so this rests without counting as a "no". */
  const stepsSeen = useCallback(() => { markInstallStepsSeen(); }, []);

  /** Runs inside the button's click so the browser accepts it as a user gesture. */
  const install = useCallback(async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      // Pending, not installed: the browser confirms with `appinstalled`, which clears this mark.
      markInstallPending();
      setProgress(current => (current === 'installed' ? current : 'installing'));
    } else if (outcome === 'dismissed') dismiss();
    return outcome;
  }, [dismiss]);

  // The /app landing page explains installing even after a dismissal, so it also needs the raw capabilities.
  return { mode, progress, install, dismiss, stepsSeen, hasPrompt, installed: environment.installed, apple: environment.apple };
}
