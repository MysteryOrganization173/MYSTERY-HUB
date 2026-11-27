import { parseSeasonSetting, type SeasonalPackId } from '../../shared/seasonal';

/**
 * Mystery Hub 3.6.4 · the season's clock and freshness rules, kept pure so they are tested on real dates.
 *
 * The server is the only authority on whether a pack is switched on (`scheduledPack`); the calendar it follows is the
 * shared Accra calendar in shared/seasonal.ts. An open tab works out today's Accra day itself, so it changes phase at
 * midnight without asking anyone, and it asks the server again only when that could change the answer: at a calendar
 * boundary, when it returns to the foreground after a while, when the connection returns, and rarely while visible.
 */

/** How long a stored server answer may stand in for the server when it cannot be reached (offline, blocked). */
export const LAST_KNOWN_MS = 7 * 24 * 60 * 60_000;
/** While the page stays visible, ask again this often, so switching the season off reaches tabs left open. */
export const VISIBLE_REFRESH_MS = 30 * 60_000;
/** Back in the foreground (or online again): ask again if the last answer is older than this. */
export const FOREGROUND_REFRESH_MS = 5 * 60_000;
/** A stored clock correction is reused for at most a day; after that the page measures it again. */
export const SKEW_KEEP_MS = 24 * 60 * 60_000;
/** A device clock further than this from the server's is not trusted: the page uses the server's time instead. */
export const SKEW_TRUST_MS = 10 * 60_000;
/** Give up on one status request after this long; the page keeps its last answer meanwhile. */
export const REQUEST_TIMEOUT_MS = 8_000;
/** Spread the post-midnight request over this window so every open tab does not ask in the same second. */
export const BOUNDARY_SPREAD_MS = 30_000;

const DAY_MS = 86_400_000;
const MAX_SKEW_MS = 366 * DAY_MS;

/**
 * Milliseconds until the next Accra calendar day starts. Ghana keeps GMT all year (no daylight saving), so the Accra
 * day starts at 00:00 UTC; `nowMs` is the corrected time (device time plus any distrusted-clock correction).
 */
export function msUntilNextAccraDay(nowMs: number): number {
  const into = ((nowMs % DAY_MS) + DAY_MS) % DAY_MS;
  return DAY_MS - into;
}

/**
 * The correction to apply to this device's clock, from one server answer. The server time is compared with the
 * middle of the request; a small difference (or one that a cached answer could explain) is ignored, so a correct
 * phone is never second-guessed. Anything unreadable means no correction.
 */
export function clockSkew(serverTime: unknown, sentAtMs: number, receivedAtMs: number): number {
  if (typeof serverTime !== 'string') return 0;
  const server = Date.parse(serverTime);
  if (!Number.isFinite(server) || receivedAtMs < sentAtMs) return 0;
  const offset = server - (sentAtMs + (receivedAtMs - sentAtMs) / 2);
  // A difference of more than a year is a broken answer, not a broken phone: it is ignored.
  if (Math.abs(offset) > MAX_SKEW_MS) return 0;
  return Math.abs(offset) > SKEW_TRUST_MS ? Math.round(offset) : 0;
}

/** What the server said about the season, as the page stores it between visits. */
export interface StoredSeason { pack: SeasonalPackId | null; at: number; skew: number }

/**
 * The pack the server has switched on, from its answer. `scheduledPack` names it even before the first day (so an open
 * tab can turn on at midnight on 1 December); an older server without it is read from `active` and `pack`.
 */
export function scheduledPackFrom(data: unknown): SeasonalPackId | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { scheduledPack?: unknown; active?: unknown; pack?: unknown };
  if ('scheduledPack' in d) return parseSeasonSetting(d.scheduledPack);
  return d.active === true ? parseSeasonSetting(d.pack) : null;
}

/**
 * A stored answer, if it may still be used: well formed, not from the future, and younger than LAST_KNOWN_MS.
 * Anything else (including the pre-3.6.4 format, which had no time) is ignored, so the page starts ordinary and asks.
 */
export function usableStoredSeason(raw: unknown, nowMs: number): StoredSeason | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { pack?: unknown; at?: unknown; skew?: unknown };
  if (typeof r.at !== 'number' || !Number.isFinite(r.at) || r.at > nowMs + 60_000 || nowMs - r.at > LAST_KNOWN_MS) return null;
  const skew = typeof r.skew === 'number' && Number.isFinite(r.skew) && Math.abs(r.skew) <= MAX_SKEW_MS && nowMs - r.at <= SKEW_KEEP_MS ? r.skew : 0;
  return { pack: r.pack === null ? null : parseSeasonSetting(r.pack), at: r.at, skew };
}

/** How long to wait before retrying after the status request failed (0, 1, 2… failures in a row). */
export const retryDelayMs = (failures: number) => Math.min(10 * 60_000, 30_000 * 2 ** Math.max(0, failures - 1));
