import type { SeasonalPackId } from '../../shared/seasonal';
import {
  BOUNDARY_SPREAD_MS, FOREGROUND_REFRESH_MS, LAST_KNOWN_MS, REQUEST_TIMEOUT_MS, VISIBLE_REFRESH_MS,
  clockSkew, msUntilNextAccraDay, retryDelayMs, scheduledPackFrom, type StoredSeason,
} from './seasonClock';

/**
 * Mystery Hub 3.6.4 · keeps one page's season in step with the server and the Accra calendar. Pure scheduling: the
 * page supplies how to fetch, what time it is and what to do with an answer, so this runs (and is tested) without a
 * browser. Timers are the global ones, so tests drive them with mock timers.
 *
 * - The day changes on this device at each Accra midnight; the server is then asked (spread over 30 s).
 * - Back in the foreground (or a page restored from the back-forward cache): the day is worked out again, and the
 *   server is asked if nothing was asked for five minutes (a failure keeps its own backoff).
 * - Online again: asked at once. While visible: asked every 30 minutes. One request at a time; 8 s timeout.
 * - Clock correction comes only from a fresh answer (one the browser did not serve from its cache). A cached answer
 *   that disagrees with this device (another day, or a clock more than ten minutes out) triggers one fresh check.
 * - Offline: the last answer stands for up to LAST_KNOWN_MS; after that the page is ordinary until the server answers.
 */
export interface SeasonAnswer { pack: SeasonalPackId | null; greetings: unknown; skew: number; at: number }
export interface SeasonSyncDeps {
  /** Asks the server; `fresh` bypasses the browser's copy. Resolves null (or rejects) when there is no usable answer. */
  fetchStatus: (fresh: boolean, signal: AbortSignal) => Promise<unknown>;
  /** This device's clock (Date.now). */
  now: () => number;
  random: () => number;
  isHidden: () => boolean;
  /** Registers the page events (foreground, back-forward cache, online) and returns their removal. */
  listen: (handlers: { onReturn: () => void; onOnline: () => void }) => () => void;
  initial: StoredSeason | null;
  /** A usable server answer arrived (with the clock correction now in force). */
  onAnswer: (answer: SeasonAnswer) => void;
  /** Work out today's Accra day again from this corrected time. */
  onDay: (correctedNow: number) => void;
  /** The server cannot be reached and the last answer is too old to stand: show the ordinary appearance. */
  onStale: () => void;
}

export function startSeasonSync(d: SeasonSyncDeps): () => void {
  let alive = true, inflight: Promise<void> | null = null, failures = 0;
  let lastAnswer = d.initial?.at ?? 0, lastAttempt = 0, skew = d.initial?.skew ?? 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined, boundaryTimer: ReturnType<typeof setTimeout> | undefined, spreadTimer: ReturnType<typeof setTimeout> | undefined;
  const corrected = () => d.now() + skew;
  const day = () => d.onDay(corrected());

  const armBoundary = () => {
    clearTimeout(boundaryTimer);
    boundaryTimer = setTimeout(() => {
      day();
      clearTimeout(spreadTimer);
      spreadTimer = setTimeout(() => void ask(true), d.random() * BOUNDARY_SPREAD_MS);
      armBoundary();
    }, msUntilNextAccraDay(corrected()) + 250);
  };

  const ask = (fresh: boolean): Promise<void> => {
    if (inflight || !alive) return inflight ?? Promise.resolve();
    let recheck = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const sent = d.now(); lastAttempt = sent;
    inflight = Promise.resolve()
      .then(() => d.fetchStatus(fresh, controller.signal))
      .then((data) => {
        if (!alive) return;
        if (!data || typeof data !== 'object') throw new Error('Seasonal status unavailable');
        const answer = data as { serverTime?: unknown; date?: unknown; greetings?: unknown };
        const measured = clockSkew(answer.serverTime, sent, d.now());
        if (fresh) {
          if (measured !== skew) { skew = measured; armBoundary(); }
        } else if (measured !== 0 || (typeof answer.date === 'string' && answer.date !== new Date(corrected()).toISOString().slice(0, 10))) {
          // A copy from the browser's cache may be minutes old: confirm with a fresh answer before trusting it.
          recheck = true;
        }
        lastAnswer = d.now(); failures = 0; clearTimeout(retryTimer);
        d.onAnswer({ pack: scheduledPackFrom(data), greetings: answer.greetings, skew, at: lastAnswer });
        day();
      })
      .catch(() => {
        if (!alive) return;
        failures += 1;
        if (!lastAnswer || d.now() - lastAnswer > LAST_KNOWN_MS) d.onStale();
        clearTimeout(retryTimer);
        if (!d.isHidden()) retryTimer = setTimeout(() => void ask(true), retryDelayMs(failures));
      })
      .finally(() => {
        clearTimeout(timeout); inflight = null;
        if (recheck && alive) void ask(true);
      });
    return inflight;
  };

  const onReturn = () => {
    if (d.isHidden()) return;
    day(); armBoundary();
    // Throttled by the last attempt, so returning to the tab after a failure keeps the retry backoff.
    if (d.now() - Math.max(lastAnswer, lastAttempt) > FOREGROUND_REFRESH_MS) void ask(true);
  };
  const onOnline = () => { day(); if (failures > 0 || d.now() - lastAnswer > 60_000) void ask(true); };
  const visible = setInterval(() => { if (!d.isHidden()) void ask(true); }, VISIBLE_REFRESH_MS);
  const unlisten = d.listen({ onReturn, onOnline });
  void ask(false); armBoundary();
  return () => {
    alive = false;
    clearTimeout(retryTimer); clearTimeout(boundaryTimer); clearTimeout(spreadTimer); clearInterval(visible);
    unlisten();
  };
}
