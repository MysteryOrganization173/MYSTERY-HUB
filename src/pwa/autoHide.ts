import { NOTIFICATION_TIMING } from './invitations';

/**
 * Notification onboarding V2: the untouched card leaves by itself, as "ignored" (never a dismissal, no snooze).
 *
 * The clock runs only while nothing holds it:
 * - `hover` and `focus` (inside the card) and `hidden` (the tab is in the background) hold it while they last;
 * - `interacted` (a tap or click inside the card) holds it for good.
 * When the last hold ends, at least `resumeMinMs` remains, so the card never vanishes the moment a pointer or focus
 * leaves it. After Allow the card is in its working or result state, where this clock is not running at all.
 */
export type AutoHideHold = 'hover' | 'focus' | 'hidden' | 'interacted';
export interface AutoHideClock { now(): number; setTimeout(fn: () => void, ms: number): unknown; clearTimeout(id: unknown): void }

export function createAutoHide(onExpire: () => void, clock: AutoHideClock, {
  durationMs = NOTIFICATION_TIMING.autoHideMs as number, resumeMinMs = NOTIFICATION_TIMING.resumeMinMs as number,
} = {}) {
  const holds = new Set<AutoHideHold>();
  let remaining = durationMs, startedAt = 0, timer: unknown = null, started = false, finished = false;
  const run = () => {
    if (!started || finished || holds.size || timer !== null) return;
    startedAt = clock.now();
    timer = clock.setTimeout(() => { timer = null; finished = true; onExpire(); }, remaining);
  };
  const pause = () => {
    if (timer === null) return;
    clock.clearTimeout(timer);
    timer = null;
    remaining = Math.max(resumeMinMs, remaining - (clock.now() - startedAt));
  };
  return {
    /** The card is now visible: start counting (unless something already holds it). */
    start() { started = true; run(); },
    hold(reason: AutoHideHold) { if (finished) return; holds.add(reason); pause(); },
    release(reason: AutoHideHold) { if (finished || reason === 'interacted' || !holds.delete(reason)) return; run(); },
    /** The card left some other way, or moved past its first state: never expire. */
    stop() { finished = true; if (timer !== null) clock.clearTimeout(timer); timer = null; },
    get running() { return timer !== null; },
    get remainingMs() { return timer === null ? remaining : Math.max(0, remaining - (clock.now() - startedAt)); },
  };
}

export const windowClock: AutoHideClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: id => window.clearTimeout(id as number),
};
