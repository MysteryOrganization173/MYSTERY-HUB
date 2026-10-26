import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { isInstalledApp } from '../../pwa/appEnvironment';
import {
  markWelcomeShown, readTimestamp, showWelcomeSheet, STORAGE_KEYS, welcomeShownThisLaunch,
} from '../../pwa/launchPolicy';
import { AppWelcomeSheet } from './AppWelcomeSheet';
import { InstalledNotificationOnboarding } from './NotificationOptIn';

/**
 * Installed-app launch: renders nothing in a browser tab. Inside the installed app it may offer, one at a time,
 * a welcome sheet to a signed-out visitor who opened the app's start page, then (once signed in, on Home) a
 * small card explaining notifications. Neither appears over checkout, sign-in, the Website Builder or any dialog.
 */
export const AppLaunchLayer: React.FC = () => {
  const app = useApp();
  const { user, sessionToken, isAuthChecking, activePage } = app;
  const [installed] = useState(isInstalledApp);
  // Decided from the address the app was opened at, so a deep link is never interrupted.
  const [launchPath] = useState(() => (typeof window === 'undefined' ? '/' : window.location.pathname));
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  const busy = Boolean(app.activeEditorSite || app.isMysteryAiOpen || app.isCheckoutOpen || app.isStatusModalOpen || app.isAuthModalOpen
    || app.selectedTemplatePreview || app.marketplaceInquiryProduct || app.waitlistInfo.isOpen || app.isAccountOpen || user?.mustChangePassword);

  useEffect(() => {
    if (!installed || welcomeOpen || busy || activePage !== 'home') return;
    if (showWelcomeSheet({ installed, signedIn: Boolean(user), authChecking: isAuthChecking, path: launchPath,
      shownThisLaunch: welcomeShownThisLaunch(), guestChosenAt: readTimestamp(STORAGE_KEYS.welcomeGuest), now: Date.now() })) {
      markWelcomeShown();
      setWelcomeOpen(true);
    }
  }, [installed, user, isAuthChecking, launchPath, welcomeOpen, busy, activePage]);

  if (!installed) return null;
  if (welcomeOpen && !user && !busy && activePage === 'home') return <AppWelcomeSheet onClose={() => setWelcomeOpen(false)} />;
  if (user && sessionToken && !isAuthChecking && activePage === 'home' && !busy)
    return <InstalledNotificationOnboarding key={`${user.id}:${sessionToken}`} token={sessionToken} accountId={user.id} allowOffers={user.role==='customer'}/>;
  return null;
};
