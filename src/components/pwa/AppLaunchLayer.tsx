import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { isInstalledApp } from '../../pwa/appEnvironment';
import { notificationPermissionState } from '../../pwa/notifications';
import {
  markWelcomeShown, readSnooze, readTimestamp, showNotificationOptIn, showWelcomeSheet, STORAGE_KEYS, welcomeShownThisLaunch,
} from '../../pwa/launchPolicy';
import { AppWelcomeSheet } from './AppWelcomeSheet';
import { NotificationOptIn } from './NotificationOptIn';

/** Lets the signed-in toast finish before the notification card takes the same corner of the screen. */
const OPT_IN_DELAY_MS = 2600;

/**
 * Installed-app launch: renders nothing in a browser tab. Inside the installed app it may offer, one at a time,
 * a welcome sheet to a signed-out visitor who opened the app's start page, then (once signed in, on Home) a
 * small card explaining notifications. Neither appears over checkout, sign-in, the Website Builder or any dialog.
 */
export const AppLaunchLayer: React.FC = () => {
  const app = useApp();
  const { user, isAuthChecking, activePage } = app;
  const [installed] = useState(isInstalledApp);
  // Decided from the address the app was opened at, so a deep link is never interrupted.
  const [launchPath] = useState(() => (typeof window === 'undefined' ? '/' : window.location.pathname));
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [optInReady, setOptInReady] = useState(false);
  const [optInActive, setOptInActive] = useState(false);

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

  useEffect(() => {
    setOptInReady(false);
    if (!installed || !user || activePage !== 'home') return;
    const timer = window.setTimeout(() => setOptInReady(true), OPT_IN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [installed, user, activePage]);

  // Once on screen the card stays until answered, so a "granted" or "blocked" confirmation is not cut short.
  useEffect(() => {
    if (!optInReady || busy || optInActive) return;
    if (showNotificationOptIn({ installed, signedIn: Boolean(user), permission: notificationPermissionState(),
      snooze: readSnooze(STORAGE_KEYS.notificationOptIn), now: Date.now() })) setOptInActive(true);
  }, [optInReady, busy, optInActive, installed, user]);

  if (!installed) return null;
  if (welcomeOpen && !user && !busy && activePage === 'home') return <AppWelcomeSheet onClose={() => setWelcomeOpen(false)} />;
  if (optInActive && user && activePage === 'home' && !busy) return <NotificationOptIn onDone={() => setOptInActive(false)} />;
  return null;
};
