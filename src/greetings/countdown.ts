import { useEffect, useState } from 'react';
import { fetchCountdown } from './api';

/**
 * New Year countdown to 1 January 2027, 00:00 in Accra (UTC, no daylight saving), using the server's clock.
 *
 * The server answers how long is left. The page anchors that to its own monotonic clock (performance.now) at the
 * midpoint of the request, so a wrong phone clock never matters and the count cannot drift while it runs. It re-asks
 * the server whenever the page comes back to the foreground or the connection returns (a sleeping phone may pause the
 * monotonic clock), ticks on whole seconds, and stops at zero.
 */
export const deadlineFrom = (remainingMs: number, sentAt: number, receivedAt: number) => (sentAt + receivedAt) / 2 + remainingMs;
export const remainingAt = (deadline: number, now: number) => Math.max(0, deadline - now);
export function countdownParts(ms: number) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  return { days: Math.floor(total / 86400), hours: Math.floor(total / 3600) % 24, minutes: Math.floor(total / 60) % 60, seconds: total % 60, done: total === 0 };
}
/** Milliseconds until the displayed whole second changes (never zero, so a tick always makes progress). */
export const nextTick = (ms: number) => ms <= 0 ? null : (ms % 1000) || 1000;

export type CountdownView = { state: 'syncing' } | { state: 'unavailable' } | { state: 'running'; remainingMs: number } | { state: 'arrived' } | { state: 'over' };
/** A week after midnight the card bows out: a New Year greeting opened later simply has no countdown. */
export const COUNTDOWN_OVER_AFTER = Date.parse('2027-01-08T00:00:00.000Z');

const monotonic = () => performance.now();
export function useNewYearCountdown(enabled: boolean, clock: () => number = monotonic): CountdownView {
  const [view, setView] = useState<CountdownView>({ state: 'syncing' });
  useEffect(() => {
    if (!enabled) return;
    let deadline: number | null = null, timer: ReturnType<typeof setTimeout> | undefined, alive = true, generation = 0;
    const tick = () => {
      if (!alive || deadline === null) return;
      const left = remainingAt(deadline, clock());
      if (left <= 0) { setView({ state: 'arrived' }); return; }
      setView({ state: 'running', remainingMs: left });
      timer = setTimeout(tick, nextTick(left)! + 5);
    };
    const sync = async () => {
      const mine = ++generation;
      const sentAt = clock();
      const answer = await fetchCountdown();
      if (!alive || mine !== generation) return;
      if (!answer.ok) { if (deadline === null) setView({ state: 'unavailable' }); return; }
      clearTimeout(timer);
      if (answer.data.passed) { deadline = clock(); setView({ state: Date.parse(answer.data.serverTime) >= COUNTDOWN_OVER_AFTER ? 'over' : 'arrived' }); return; }
      deadline = deadlineFrom(answer.data.remainingMs, sentAt, clock());
      tick();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void sync(); };
    const onOnline = () => void sync();
    void sync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => { alive = false; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onOnline); };
  }, [enabled, clock]);
  return view;
}
