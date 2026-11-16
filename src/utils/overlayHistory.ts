import { useEffect, useRef } from 'react';

/**
 * 3.4.1: full-screen sheets (My Account, the Notification Center) close with the phone's Back, and only they close.
 * Each gets its own history entry at the same address, so Back pops that entry and the page underneath stays put;
 * closing any other way removes the entry again.
 */
export type OverlayKey = 'mhAccount' | 'mhNotifications';

const top = (key: OverlayKey) => typeof window !== 'undefined' && Boolean(window.history.state?.[key]);

export function useOverlayHistory(key: OverlayKey, onBack: () => void) {
  const back = useRef(onBack);
  back.current = onBack;
  useEffect(() => {
    if (!top(key)) window.history.pushState({ page: window.history.state?.page, [key]: true }, '', window.location.pathname + window.location.search + window.location.hash);
    const onPop = () => { if (!top(key)) back.current(); };
    window.addEventListener('popstate', onPop);
    return () => { window.removeEventListener('popstate', onPop); if (top(key)) window.history.back(); };
  }, [key]);
}

/**
 * Opens the next sheet only after the closing one has left history (its Back is asynchronous), so the new sheet is
 * not closed by that Back. Without such an entry it runs at once.
 */
export function afterOverlayHistory(key: OverlayKey, next: () => void) {
  if (!top(key)) { next(); return; }
  const run = () => { window.removeEventListener('popstate', run); next(); };
  window.addEventListener('popstate', run);
}
