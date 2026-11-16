import { useEffect, useRef } from 'react';

/**
 * 3.4.1: full-screen sheets (My Account, the Notification Center) close with the phone's Back, and only they close.
 * Each open gets its own history entry at the same address, marked with a value unique to that open, so Back pops
 * that entry and the page underneath stays put; closing any other way removes the entry again. A marker left over
 * from an earlier page life (a reload while a sheet was open) never counts as the current sheet's own.
 */
export type OverlayKey = 'mhAccount' | 'mhNotifications';

interface HistoryLike { state: any; pushState(state: any, title: string, url: string): void; replaceState(state: any, title: string): void; back(): void }
interface WindowLike { history: HistoryLike; location: { pathname: string; search: string; hash: string }; addEventListener(type: 'popstate', fn: () => void): void; removeEventListener(type: 'popstate', fn: () => void): void; setTimeout(fn: () => void, ms: number): unknown }
const env = (): WindowLike | null => typeof window === 'undefined' ? null : window as unknown as WindowLike;
let sequence = 0;

/** Enters a sheet's history entry; returns the exit to call when the sheet closes in any other way than Back. */
export function enterOverlay(key: OverlayKey, onBack: () => void, win: WindowLike | null = env()): () => void {
  if (!win) return () => {};
  const mark = `${Date.now().toString(36)}-${++sequence}`;
  win.history.pushState({ page: win.history.state?.page, [key]: mark }, '', win.location.pathname + win.location.search + win.location.hash);
  const ours = () => win.history.state?.[key] === mark;
  const onPop = () => { if (!ours()) onBack(); };
  win.addEventListener('popstate', onPop);
  return () => { win.removeEventListener('popstate', onPop); if (ours()) win.history.back(); };
}

export function useOverlayHistory(key: OverlayKey, onBack: () => void) {
  const back = useRef(onBack);
  back.current = onBack;
  useEffect(() => enterOverlay(key, () => back.current()), [key]);
}

/**
 * Runs `next` (open the other sheet, or go to another page) only after the closing sheet has left history (its
 * Back is asynchronous), so nothing new is stacked on top of that entry or closed by its Back. Without such an
 * entry it runs at once. If the Back is slow it keeps waiting; if it never comes (five seconds), the marker is removed
 * and it runs.
 */
export function afterOverlayHistory(key: OverlayKey, next: () => void, win: WindowLike | null = env()) {
  if (!win || !win.history.state?.[key]) { next(); return; }
  let done = false, waited = 0;
  const run = () => { if (done) return; done = true; win.removeEventListener('popstate', run); next(); };
  // A slow phone may take a while to go Back: keep waiting while the entry is still on top. Only if it never goes
  // does the marker get removed (so no later Back can be mistaken for it) before carrying on.
  const check = () => {
    if (done) return;
    if (!win.history.state?.[key]) { run(); return; }
    if (++waited < 5) { win.setTimeout(check, 1000); return; }
    const { [key]: _gone, ...rest } = win.history.state; win.history.replaceState(rest, ''); run();
  };
  win.addEventListener('popstate', run);
  win.setTimeout(check, 1000);
}
