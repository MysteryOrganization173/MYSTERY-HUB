/**
 * Mystery Hub Seasonal Experience System: the calendar and the status model, shared by the page and the server.
 *
 * A seasonal experience is a presentation layer only. It never changes prices, products, availability, orders or
 * payments. It is OFF unless the API service sets SEASONAL_EXPERIENCE to a known pack id, and even then it only shows
 * inside that pack's dates (Africa/Accra). Founder previews are per browser and never change what anyone else sees.
 */

export const SEASONAL_PACKS = ['christmas-2026'] as const;
export type SeasonalPackId = typeof SEASONAL_PACKS[number];

/** The approved Christmas-to-New-Year calendar. Dates are Accra calendar days (Ghana keeps UTC, with no daylight saving). */
export type SeasonPhase =
  | 'before'            // before 1 December: nothing shows (a preview shows the Christmas season)
  | 'christmas-season'  // 1–24 December
  | 'christmas-day'     // 25 December
  | 'boxing-day'        // 26 December
  | 'year-end'          // 27–30 December, the turn toward New Year
  | 'new-years-eve'     // 31 December
  | 'new-years-day'     // 1 January
  | 'new-year'          // 2–5 January
  | 'after';            // from 6 January the normal appearance returns

export interface SeasonalPack {
  id: SeasonalPackId;
  /** First and last Accra days the pack may show. */
  start: string;
  end: string;
  christmas: string;
  newYear: string;
}

export const CHRISTMAS_2026: SeasonalPack = { id: 'christmas-2026', start: '2026-12-01', end: '2027-01-05', christmas: '2026-12-25', newYear: '2027-01-01' };
export const SEASONAL_PACK_INFO: Record<SeasonalPackId, SeasonalPack> = { 'christmas-2026': CHRISTMAS_2026 };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (value: string) => DATE.test(value) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;

/** Today's calendar day in Accra, as YYYY-MM-DD. */
export function accraDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Accra', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000);
}

export function seasonPhase(date: string, pack: SeasonalPack = CHRISTMAS_2026): SeasonPhase {
  if (date < pack.start) return 'before';
  if (date > pack.end) return 'after';
  const toChristmas = daysBetween(date, pack.christmas);
  if (toChristmas > 0) return 'christmas-season';
  if (toChristmas === 0) return 'christmas-day';
  if (toChristmas === -1) return 'boxing-day';
  const toNewYear = daysBetween(date, pack.newYear);
  if (toNewYear > 1) return 'year-end';
  if (toNewYear === 1) return 'new-years-eve';
  if (toNewYear === 0) return 'new-years-day';
  return 'new-year';
}

/** Phases in which the pack is on screen. */
export const isLivePhase = (phase: SeasonPhase) => phase !== 'before' && phase !== 'after';

/** The server setting, read strictly: only an exact known pack id turns anything on. */
export function parseSeasonSetting(value: unknown): SeasonalPackId | null {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (SEASONAL_PACKS as readonly string[]).includes(id) ? id as SeasonalPackId : null;
}

/** A preview date a reviewer may pick, so every phase can be checked before it happens. */
export function parsePreviewDate(value: unknown): string | null {
  if (typeof value !== 'string' || !isRealDate(value)) return null;
  return value >= '2026-11-01' && value <= '2027-01-10' ? value : null;
}

export type SeasonSource = 'off' | 'server' | 'preview';

export interface SeasonStatus {
  /** Whether the pack is on screen for this visitor (before guest-only rules on the page). */
  active: boolean;
  pack: SeasonalPackId | null;
  phase: SeasonPhase;
  /** The Accra day the phase was worked out for. */
  date: string;
  daysToChristmas: number;
  daysToNewYear: number;
  source: SeasonSource;
}

/** What the server says to every visitor. Off unless the setting names a pack and today is inside its dates. */
export function serverSeasonStatus(setting: unknown, now: Date = new Date()): SeasonStatus {
  const pack = parseSeasonSetting(setting);
  const date = accraDate(now);
  const info = SEASONAL_PACK_INFO[pack || 'christmas-2026'];
  const phase = seasonPhase(date, info);
  const active = Boolean(pack) && isLivePhase(phase);
  return { active, pack: active ? pack : null, phase, date, daysToChristmas: daysBetween(date, info.christmas), daysToNewYear: daysBetween(date, info.newYear), source: active ? 'server' : 'off' };
}

/**
 * A founder preview in one browser. It shows the pack whatever the server says; a preview before 1 December shows
 * the Christmas season (with the real countdown), and after 5 January it still shows New Year so it can be reviewed.
 */
export function previewSeasonStatus(packId: SeasonalPackId, date: string): SeasonStatus {
  const info = SEASONAL_PACK_INFO[packId];
  const real = seasonPhase(date, info);
  const phase: SeasonPhase = real === 'before' ? 'christmas-season' : real === 'after' ? 'new-year' : real;
  return { active: true, pack: packId, phase, date, daysToChristmas: daysBetween(date, info.christmas), daysToNewYear: daysBetween(date, info.newYear), source: 'preview' };
}

/** Christmas phases use the Christmas artwork; from 27 December the same pack carries New Year greetings. */
export const isChristmasPhase = (phase: SeasonPhase) => phase === 'christmas-season' || phase === 'christmas-day' || phase === 'boxing-day';

/**
 * Mystery Greetings: one entry for both seasonal homepages, guest or signed in. The server reports it in the season
 * status (`greetings.createPath`): a same-site path once the real greeting creator is open, null until then. Creating a
 * greeting needs no account, so the entry never asks anyone to sign in. Anything that is not a plain same-site path
 * reads as not open, so a malformed answer can never expose a link.
 */
export type GreetingsEntry = { state: 'coming-soon' } | { state: 'open'; createHref: string };
export const GREETINGS_COMING_SOON: GreetingsEntry = { state: 'coming-soon' };
export function greetingsEntry(reported: unknown): GreetingsEntry {
  const path = reported && typeof reported === 'object' ? (reported as { createPath?: unknown }).createPath : null;
  return typeof path === 'string' && /^\/[a-z0-9][a-z0-9/-]*$/i.test(path) && !path.includes('//') ? { state: 'open', createHref: path } : GREETINGS_COMING_SOON;
}
