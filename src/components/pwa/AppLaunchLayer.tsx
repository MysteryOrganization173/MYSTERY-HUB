import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { isInstalledApp } from '../../pwa/appEnvironment';
import {
  markWelcomeShown, readTimestamp, showWelcomeSheet, STORAGE_KEYS, welcomeShownThisLaunch,
} from '../../pwa/launchPolicy';
import { claimWelcome, releaseInvitation } from '../../pwa/invitations';
import { AppWelcomeSheet } from './AppWelcomeSheet';
import { appBusy } from './invitationBusy';

/**
 * Installed-app launch: renders nothing in a browser tab. Inside the installed app it may offer a welcome sheet to a
 * signed-out visitor who opened the app's start page. It never appears over checkout, sign-in, the Website Builder or
 * any dialog. The first-use notification invitation that may follow sign-in belongs to the coordinated InvitationLayer.
 */
export const AppLaunchLayer: React.FC = () => {
  const app = useApp();
  const { user, isAuthChecking, activePage } = app;
  const [installed] = useState(isInstalledApp);
  // Decided from the address the app was opened at, so a deep link is never interrupted.
  const [launchPath] = useState(() => (typeof window === 'undefined' ? '/' : window.location.pathname));
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  const busy = appBusy(app);

  useEffect(() => {
    if (!installed || welcomeOpen || busy || activePage !== 'home') return;
    if (showWelcomeSheet({ installed, signedIn: Boolean(user), authChecking: isAuthChecking, path: launchPath,
      shownThisLaunch: welcomeShownThisLaunch(), guestChosenAt: readTimestamp(STORAGE_KEYS.welcomeGuest), now: Date.now() })
      && claimWelcome()) {
      // Shown alone; install and Channel suggestions then stay out of this visit (pwa/invitations).
      markWelcomeShown();
      setWelcomeOpen(true);
    }
  }, [installed, user, isAuthChecking, launchPath, welcomeOpen, busy, activePage]);

  // The coordinator's slot is held exactly while the sheet is on screen. It is freed whenever the sheet stops
  // showing, whatever the reason (closed, signed in elsewhere, a dialog), and then the sheet is not re-offered.
  const welcomeVisible = installed && welcomeOpen && !user && !busy && activePage === 'home';
  const welcomeShown = useRef(false);
  useEffect(() => {
    if (welcomeVisible) { welcomeShown.current = true; return; }
    if (!welcomeShown.current) return;
    welcomeShown.current = false;
    releaseInvitation('welcome');
    setWelcomeOpen(false);
  }, [welcomeVisible]);
  useEffect(() => () => { if (welcomeShown.current) releaseInvitation('welcome'); }, []);
  if (!installed) return null;
  // Notifications (first use after the welcome and sign-in) are offered by the coordinated InvitationLayer.
  if (welcomeVisible) return <AppWelcomeSheet onClose={() => setWelcomeOpen(false)} />;
  return null;
};
