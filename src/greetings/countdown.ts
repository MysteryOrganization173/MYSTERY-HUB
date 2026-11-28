import { useEffect, useRef, useState } from 'react';
import { COUNTDOWN_TARGET } from '../../shared/mysteryExperiences';
import { fetchCountdown, type CountdownAnswer, type Result } from './api';

/**
 * New Year countdown to 1 January 2027, 00:00 in Accra (UTC, no daylight saving), using the server's clock.
 *
 * One engine for the quiet card under a New Year greeting and the standalone Mystery Countdown (/countdown).
 *
 * The server answers what time it is. The page anchors that answer to its own monotonic clock (performance.now) at the
 * midpoint of the request, so a wrong phone clock never matters and the count cannot drift while it runs. It never
 * decrements a counter: every render works the remaining time out again from the anchor.
 *
 * It asks the server again only when the answer could have gone stale: whenever the two local clocks disagree (a
 * sleeping phone can pause the monotonic clock; someone can change the wall clock), back in the foreground or online
 * after five minutes or more, every 30 minutes while visible, and once in the last few minutes before midnight (at a
 * moment of its own, so open pages do not all ask together). It never asks every second, and nothing here touches a
 * database. While the page is hidden it does no work at all.
 *
 * Without any server answer it says so (syncing or unavailable) and never invents a countdown from the device clock.
 * After one good answer it keeps counting from that answer when the connection drops.
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
export const COUNTDOWN_TARGET_MS = Date.parse(COUNTDOWN_TARGET);

/* ───────────────────────── The anchor: one server answer pinned to the local clocks ───────────────────────── */

/** Server time at the request's midpoint, with both local clocks read at that same moment. */
export interface Anchor { server: number; mono: number; wall: number; rtt: number }
/** Two local clocks that disagree by more than this since the anchor mean one of them jumped or paused. */
export const DRIFT_LIMIT = 1500;
/** A round trip slower than this is usable, but asked again soon for a tighter answer. */
export const ROUGH_RTT = 3000;

/**
 * An anchor from one answer, or null when the sample cannot be trusted: a malformed time, or a request during which the
 * two local clocks disagreed (it straddled a sleep or a clock change, so its midpoint means nothing).
 */
export function anchorFrom(serverTime: string, sent: { mono: number; wall: number }, received: { mono: number; wall: number }): Anchor | null {
  const server = Date.parse(serverTime);
  const rtt = received.mono - sent.mono;
  if (!Number.isFinite(server) || !(rtt >= 0) || Math.abs((received.wall - sent.wall) - rtt) > DRIFT_LIMIT) return null;
  return { server, mono: sent.mono + rtt / 2, wall: received.wall - rtt / 2, rtt };
}

/**
 * The server's time now. Normally the monotonic clock's elapsed time is added to the anchor. If the wall clock has run
 * ahead of it, the monotonic clock paused (the device slept), so the wall clock's elapsed time is the better guess; if
 * the wall clock fell behind, it was set back, so the monotonic clock is kept. Either way the estimate is `suspect`
 * until a fresh answer replaces the anchor.
 */
export function estimateServerTime(anchor: Anchor, mono: number, wall: number): { server: number; suspect: boolean } {
  const monoElapsed = mono - anchor.mono, wallElapsed = wall - anchor.wall, drift = wallElapsed - monoElapsed;
  if (drift > DRIFT_LIMIT) return { server: anchor.server + wallElapsed, suspect: true };
  return { server: anchor.server + monoElapsed, suspect: drift < -DRIFT_LIMIT };
}

/** Whether a new sample should replace the current anchor: a comparable or quicker answer, or a much older anchor. */
export function preferAnchor(current: Anchor | null, candidate: Anchor, currentSuspect = false) {
  if (!current || currentSuspect) return true;
  return candidate.rtt <= current.rtt * 1.5 + 300 || candidate.mono - current.mono > 10 * 60_000;
}

/* ───────────────────────── The controller: when to ask, what to show ───────────────────────── */

export type ClockView =
  | { state: 'syncing'; slow: boolean }
  | { state: 'unavailable' }
  /** `checking`: a local clock jumped (sleep or clock change) and a fresh answer is on its way. */
  | { state: 'running'; remainingMs: number; serverNow: number; checking: boolean }
  /**
   * Midnight on a suspect estimate (a jumped clock): shown as a check, never as zero and never as a celebration, until
   * the server answers. `failed`: the last check failed, and it keeps trying. Only the server's word ends it.
   */
  | { state: 'confirming'; failed: boolean }
  /** `live`: this page was counting, visible, and saw midnight happen (within a minute of it). */
  | { state: 'arrived'; serverNow: number; live: boolean };

export interface ClockDeps {
  fetch: () => Promise<Result<CountdownAnswer>>;
  mono: () => number;
  wall: () => number;
  visible: () => boolean;
  setTimer: (run: () => void, ms: number) => unknown;
  clearTimer: (timer: unknown) => void;
  onView: (view: ClockView) => void;
  /** 0 ≤ n < 1, for spreading checks and retries across open pages (Math.random unless a test pins it). */
  random?: () => number;
}

/** Seen midnight live this long after it happened (a tab brought back a few seconds late still celebrates). */
export const LIVE_GRACE = 60_000;
export const SLOW_AFTER = 4_000;
/**
 * With a trusted answer and no clock jump, coming back to the page or back online asks again only after this long:
 * the two-clock check already catches a sleep or a clock change, so a quick app switch costs nothing.
 */
export const RESYNC_GAP = 5 * 60_000;
export const REFRESH_EVERY = 30 * 60_000;
/** One last check in the final minutes, when the anchor is more than a minute old: between T-3:00 and T-2:00. */
export const FINAL_CHECK = 120_000;
export const FINAL_SPREAD = 60_000;
/** Retries without a trusted answer, each spread by up to ±20% so open pages never retry in step. */
export const RETRY_DELAYS = [5_000, 15_000, 30_000, 60_000] as const;

export function createCountdownClock(deps: ClockDeps) {
  let anchor: Anchor | null = null, suspect = false, sawRunning = false, stopped = true;
  let arrived: { live: boolean } | null = null, confirming = false, finalChecked = false, failures = 0, refinements = 0;
  // `inflight` is the generation of the request still pending (0: none). A newer generation abandons an older answer.
  let generation = 0, inflight = 0, lastAttempt = -Infinity;
  let tickTimer: unknown, retryTimer: unknown, slowTimer: unknown;
  let view: ClockView = { state: 'syncing', slow: false };
  const random = deps.random ?? Math.random;
  const finalCheckAt = FINAL_CHECK + Math.floor(random() * FINAL_SPREAD);
  const emit = (next: ClockView) => { view = next; deps.onView(next); };
  const clear = (timer: unknown) => { if (timer !== undefined) deps.clearTimer(timer); };

  /** Works out what to show from the anchor, and when to look again. Safe to call any number of times. */
  function evaluate() {
    clear(tickTimer); tickTimer = undefined;
    if (stopped || !anchor) return;
    const estimate = estimateServerTime(anchor, deps.mono(), deps.wall());
    // A clock jumped: ask again at once, abandoning any request that may have straddled the jump.
    if (estimate.suspect && !suspect) { suspect = true; sync(true); }
    if (arrived) { emit({ state: 'arrived', serverNow: estimate.server, live: arrived.live }); return; }
    const remaining = Math.max(0, COUNTDOWN_TARGET_MS - estimate.server);
    if (remaining === 0) {
      // Midnight only from a trusted estimate. A jumped clock (a sleep, or someone moving the device clock forward) waits
      // for the server's word, however long that takes: a guess never becomes a Welcome 2027 that cannot be undone.
      if (suspect) {
        if (!confirming) { confirming = true; emit({ state: 'confirming', failed: false }); }
        if (inflight === 0 && retryTimer === undefined) sync(true);
        return;
      }
      arrived = { live: sawRunning && deps.visible() && estimate.server - COUNTDOWN_TARGET_MS <= LIVE_GRACE };
      emit({ state: 'arrived', serverNow: estimate.server, live: arrived.live });
      return;
    }
    if (!deps.visible()) return; // hidden: no ticking; the foreground check picks up from here
    sawRunning = true;
    emit({ state: 'running', remainingMs: remaining, serverNow: estimate.server, checking: suspect });
    if (!finalChecked && remaining <= finalCheckAt) { finalChecked = true; if (deps.mono() - anchor.mono > 60_000) sync(false, 0); }
    else if (deps.mono() - lastAttempt > REFRESH_EVERY) sync(false, 0);
    tickTimer = deps.setTimer(evaluate, nextTick(remaining)! + 5);
  }

  /**
   * Asks the server. Unforced, it never overlaps a pending request and, once a trusted anchor exists, never repeats
   * within `gap` of the last attempt. Forced (start, a jumped clock, a scheduled retry) it skips that spacing and
   * replaces any pending request. `quiet` (an automatic retry) leaves an "unavailable" message in place rather than
   * flickering back to "checking", so a screen reader is not told the same thing again on every retry.
   */
  function sync(force = false, gap = RESYNC_GAP, quiet = false) {
    if (stopped) return;
    if (inflight !== 0 && !force) return;
    if (!force && anchor && !suspect && deps.mono() - lastAttempt < gap) return;
    const mine = ++generation;
    inflight = mine; lastAttempt = deps.mono();
    clear(retryTimer); retryTimer = undefined;
    const sent = { mono: deps.mono(), wall: deps.wall() };
    if (!anchor && !(quiet && view.state === 'unavailable')) {
      if (view.state !== 'syncing' || view.slow) emit({ state: 'syncing', slow: false });
      clear(slowTimer);
      slowTimer = deps.setTimer(() => { if (!anchor && inflight === mine) emit({ state: 'syncing', slow: true }); }, SLOW_AFTER);
    }
    void deps.fetch().then(result => {
      if (stopped || mine !== generation) return;
      inflight = 0; clear(slowTimer); slowTimer = undefined;
      const candidate = result.ok ? anchorFrom(result.data.serverTime, sent, { mono: deps.mono(), wall: deps.wall() }) : null;
      if (candidate) {
        failures = 0;
        if (preferAnchor(anchor, candidate, suspect)) { anchor = candidate; suspect = false; }
        confirming = false;
        // A slow answer is kept, and asked again (twice at most) for a tighter one.
        const rtt = (anchor ?? candidate).rtt;
        if (rtt > ROUGH_RTT && !arrived && refinements < 2) { refinements++; retryTimer = deps.setTimer(() => sync(true), 15_000); }
        else if (rtt <= ROUGH_RTT) refinements = 0;
        evaluate();
        return;
      }
      failures++;
      if (!anchor) { if (view.state !== 'unavailable') emit({ state: 'unavailable' }); scheduleRetry(); return; }
      if (confirming) {
        // The server could not confirm midnight yet: say so, and keep asking (spaced out, and only while visible).
        if (view.state !== 'confirming' || !view.failed) emit({ state: 'confirming', failed: true });
        scheduleRetry();
        return;
      }
      // A trusted anchor keeps counting; only a jumped clock is worth asking about again soon.
      if (suspect) scheduleRetry();
      evaluate();
    });
  }

  function scheduleRetry() {
    clear(retryTimer); retryTimer = undefined;
    if (stopped || !deps.visible() || arrived) return;
    const base = RETRY_DELAYS[Math.min(failures, RETRY_DELAYS.length) - 1] ?? RETRY_DELAYS[0];
    retryTimer = deps.setTimer(() => sync(true, 0, true), Math.round(base * (0.8 + 0.4 * random())));
  }

  return {
    start() { if (!stopped) return; stopped = false; sync(true); },
    stop() { stopped = true; generation++; inflight = 0; clear(tickTimer); clear(retryTimer); clear(slowTimer); tickTimer = retryTimer = slowTimer = undefined; },
    /**
     * visibilitychange / pageshow: pause everything while hidden. On return, show the estimate at once; ask the server
     * at once if a clock jumped, otherwise only when the last answer is RESYNC_GAP old.
     */
    visibility() {
      if (stopped) return;
      if (!deps.visible()) { clear(tickTimer); clear(retryTimer); tickTimer = retryTimer = undefined; return; }
      const before = generation;
      evaluate();
      if (generation === before) { if (suspect) sync(true); else sync(); }
    },
    online() { sync(); },
    /** The "Try again" button: at once, or, when an automatic retry is already on its way, it says so. */
    retry() {
      if (inflight !== 0 && !anchor) { if (view.state === 'unavailable') emit({ state: 'syncing', slow: false }); return; }
      sync(false, 0);
    },
    get view() { return view; },
  };
}

/* ───────────────────────── React adapters ───────────────────────── */

const monotonic = () => performance.now();
const wallClock = () => Date.now();
const pageVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

/** The shared engine as a hook. `retry` re-asks the server at once (the "Try again" button). */
export function useCountdownClock(enabled = true, mono: () => number = monotonic, wall: () => number = wallClock): { view: ClockView; retry: () => void } {
  const [view, setView] = useState<ClockView>({ state: 'syncing', slow: false });
  const controller = useRef<ReturnType<typeof createCountdownClock> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const clock = createCountdownClock({ fetch: fetchCountdown, mono, wall, visible: pageVisible, setTimer: (run, ms) => setTimeout(run, ms), clearTimer: timer => clearTimeout(timer as ReturnType<typeof setTimeout>), onView: setView });
    controller.current = clock;
    const onVisible = () => clock.visibility(), onOnline = () => clock.online();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('online', onOnline);
    clock.start();
    return () => {
      clock.stop(); controller.current = null;
      document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('pageshow', onVisible); window.removeEventListener('online', onOnline);
    };
  }, [enabled, mono, wall]);
  return { view, retry: () => controller.current?.retry() };
}

/** The embedded card's simpler view of the same engine (its states are unchanged since 3.6). */
export function embeddedView(view: ClockView): CountdownView {
  switch (view.state) {
    case 'running': return { state: 'running', remainingMs: view.remainingMs };
    case 'arrived': return { state: view.serverNow >= COUNTDOWN_OVER_AFTER ? 'over' : 'arrived' };
    case 'unavailable': return { state: 'unavailable' };
    default: return { state: 'syncing' };
  }
}

export function useNewYearCountdown(enabled: boolean): CountdownView {
  return embeddedView(useCountdownClock(enabled).view);
}
