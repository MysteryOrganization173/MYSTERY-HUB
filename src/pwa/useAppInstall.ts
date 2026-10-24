import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { hasInstallPrompt, promptInstall, subscribeInstallPrompt, wasInstalledThisVisit } from './installPrompt';
import { isInstalledApp, supportsAppleHomeScreen } from './appEnvironment';
import { installPromoMode, readSnooze, recordDismissal, STORAGE_KEYS, type InstallPromoMode } from './launchPolicy';

export type InstallProgress = 'idle' | 'installing' | 'installed';

/** Install card state for this device. `mode` is 'hidden' whenever installing is impossible or was declined. */
export function useAppInstall() {
  const hasPrompt = useSyncExternalStore(subscribeInstallPrompt, hasInstallPrompt, () => false);
  const installedNow = useSyncExternalStore(subscribeInstallPrompt, wasInstalledThisVisit, () => false);
  const [snooze, setSnooze] = useState(() => readSnooze(STORAGE_KEYS.installPromo));
  const [progress, setProgress] = useState<InstallProgress>('idle');
  const [environment] = useState(() => ({ installed: isInstalledApp(), apple: supportsAppleHomeScreen() }));

  useEffect(() => { if (installedNow) setProgress('installed'); }, [installedNow]);

  const mode: InstallPromoMode = installPromoMode({
    installed: environment.installed, hasPrompt, appleHomeScreen: environment.apple, snooze, now: Date.now(),
  });

  const dismiss = useCallback(() => setSnooze(recordDismissal(STORAGE_KEYS.installPromo)), []);

  /** Runs inside the button's click so the browser accepts it as a user gesture. */
  const install = useCallback(async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') setProgress(current => (current === 'installed' ? current : 'installing'));
    else if (outcome === 'dismissed') dismiss();
    return outcome;
  }, [dismiss]);

  return { mode, progress, install, dismiss };
}
