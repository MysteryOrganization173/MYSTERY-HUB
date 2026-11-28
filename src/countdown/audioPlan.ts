/**
 * Mystery Countdown 3.7 final: when each sound plays around midnight, and the celebration's shared timeline.
 * Kept in step with scripts/countdown-music/previews.py, which mixes the founder previews with the same numbers.
 *
 * The clock is authoritative: every cue is started when the page shows its moment (the visible second changes, the
 * celebration begins), at the offset that moment calls for, so a late or slow start never delays what is on screen.
 */

/** Seconds before midnight. */
export const PLAYLIST_FADE_AT = 62;
export const PLAYLIST_FADE_SECONDS = 4;
export const BUILD_AT = 60;
/** Second k's cue is ticks[(10 - k) * 2 s, +2 s], played when the clock shows k; the last gives way to midnight. */
export const TICK_SLOT = 2;
export const LAST_TICK_FADE = 0.06;
/** Seconds after midnight. */
export const NEW_YEAR_AT = 25;
export const MIDNIGHT_MUSIC_FADE_AT = 25;
export const MIDNIGHT_MUSIC_FADE_SECONDS = 4;
/** Between playlist tracks. */
export const CROSSFADE = 2.5;
/** The next track starts loading this long before the current one ends (never with data saver on). */
export const PREFETCH_BEFORE_END = 30;
/** The countdown's own sounds are fetched once the final hour starts (a few hundred kilobytes). */
export const CUES_FROM_SECONDS = 3600;

export const tickOffset = (secondsShown: number) => (10 - secondsShown) * TICK_SLOT;
/** Where the build should be, `remainingMs` before midnight (null outside the final minute). */
export const buildOffset = (remainingMs: number) => remainingMs > BUILD_AT * 1000 || remainingMs <= 0 ? null : BUILD_AT - remainingMs / 1000;

/** The celebration: how long the page celebrates, and when each firework bursts (shared by sound and sight). */
export const CELEBRATION_SECONDS = 22;
export const CELEBRATION_REDUCED_SECONDS = 6;
export interface Burst { at: number; x: number; y: number; size: number }
/** From scripts/countdown-music cues.py (FIREWORKS): seconds after midnight, position as a share of the screen. */
export const FIREWORKS: readonly Burst[] = [
  { at: 0.55, x: 0.269, y: 0.38, size: 1.0 }, { at: 1.35, x: 0.752, y: 0.45, size: 0.9 }, { at: 2.2, x: 0.5, y: 0.26, size: 1.1 },
  { at: 3.05, x: 0.185, y: 0.5, size: 0.8 }, { at: 3.9, x: 0.794, y: 0.34, size: 1.0 }, { at: 5.0, x: 0.416, y: 0.22, size: 1.2 },
  { at: 6.3, x: 0.689, y: 0.48, size: 0.8 }, { at: 7.2, x: 0.248, y: 0.4, size: 0.9 }, { at: 8.6, x: 0.563, y: 0.2, size: 1.25 },
  { at: 10.2, x: 0.332, y: 0.44, size: 0.8 }, { at: 11.4, x: 0.773, y: 0.36, size: 0.9 }, { at: 13.0, x: 0.5, y: 0.18, size: 1.3 },
  { at: 13.35, x: 0.29, y: 0.42, size: 0.7 }, { at: 13.7, x: 0.71, y: 0.4, size: 0.7 },
];
/** The chorus of Auld Lang Syne in the midnight music, and when it has settled. */
export const MIDNIGHT_CHORUS = { start: 2.4, end: 22.24, settled: 24.74 } as const;
