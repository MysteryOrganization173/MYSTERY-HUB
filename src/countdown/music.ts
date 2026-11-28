import { accraDate } from '../../shared/seasonal';

/**
 * Mystery Countdown 3.7 final: the music catalogue and its seasons. Pure (no audio, no network), so every choice can be
 * checked with a controlled clock.
 *
 * Every track is solo acoustic piano: a public-domain melody in a public-domain hymnal setting, arranged for Mystery
 * Hub and recorded offline through the Salamander Grand Piano V3 samples (Yamaha C5, CC BY 3.0, Alexander Holm).
 * scripts/countdown-music renders them; docs/countdown-music/manifest.json records the rights for each one.
 *
 * Nothing here downloads anything. The page asks for one track at a time, only after the visitor taps to start music,
 * and asks for the next one shortly before it is needed.
 */

/** Where the recordings are served from: versioned paths that never change once published. */
export const AUDIO_BASE = '/countdown-audio/v1/';

export interface Track {
  id: string;
  title: string;
  /** Melody and setting, in plain words (credits panel). */
  music: string;
  seconds: number;
  /** Bytes per format, for the data-use note and tests. */
  bytes: { webm: number; mp3: number };
}

const ARRANGED = 'Arranged and recorded for Mystery Hub.';
export const TRACKS: readonly Track[] = [
  { id: 'silent-night', title: 'Silent Night', music: 'Franz Xaver Gruber, 1818', seconds: 159.84, bytes: { webm: 2330399, mp3: 3144141 } },
  { id: 'first-noel', title: 'The First Noel', music: 'Traditional English carol', seconds: 159.74, bytes: { webm: 2328851, mp3: 3169413 } },
  { id: 'away-in-a-manger', title: 'Away in a Manger', music: 'James R. Murray, 1887', seconds: 124.29, bytes: { webm: 1845991, mp3: 2405133 } },
  { id: 'what-child', title: 'What Child Is This?', music: 'Greensleeves, English traditional', seconds: 136.21, bytes: { webm: 1978963, mp3: 2684637 } },
  { id: 'bleak-midwinter', title: 'In the Bleak Midwinter', music: 'Gustav Holst, 1906', seconds: 211.56, bytes: { webm: 3082975, mp3: 4086933 } },
  { id: 'o-come-all-ye-faithful', title: 'O Come, All Ye Faithful', music: 'John Francis Wade, 1743', seconds: 196.3, bytes: { webm: 2875273, mp3: 3841317 } },
  { id: 'angels-we-have-heard', title: 'Angels We Have Heard on High', music: 'Traditional French carol', seconds: 125.31, bytes: { webm: 1828176, mp3: 2390805 } },
  { id: 'hark-the-herald', title: 'Hark! The Herald Angels Sing', music: 'Felix Mendelssohn, 1840', seconds: 189.31, bytes: { webm: 2780539, mp3: 3699429 } },
  { id: 'joy-to-the-world', title: 'Joy to the World', music: 'After Handel, arranged by Lowell Mason, 1836', seconds: 121.96, bytes: { webm: 1758123, mp3: 2440557 } },
  { id: 'auld-lang-syne', title: 'Auld Lang Syne', music: 'Traditional Scottish melody', seconds: 199.38, bytes: { webm: 2965896, mp3: 3884901 } },
  { id: 'ode-to-joy', title: 'Ode to Joy', music: 'Ludwig van Beethoven, 1824', seconds: 150.02, bytes: { webm: 2186723, mp3: 2964357 } },
];
export const trackById = (id: string) => TRACKS.find(t => t.id === id) ?? null;

/** The countdown's own sounds (cues), loaded only in the final hour, or for a replay of midnight. */
export const CUES = {
  build: { id: 'final-minute', bytes: { webm: 849022, mp3: 1114029 } },
  ticks: { id: 'ticks', bytes: { webm: 306673, mp3: 336861 } },
  midnightFx: { id: 'midnight-fx', bytes: { webm: 244125, mp3: 515205 } },
  midnightMusic: { id: 'midnight-music', bytes: { webm: 383362, mp3: 568701 } },
} as const;

export type AudioFormat = 'webm' | 'mp3';
export const audioUrl = (id: string, format: AudioFormat, base = AUDIO_BASE) => `${base}${id}.${format}`;
/** Opus in WebM where the browser plays it (smaller), MP3 everywhere else. */
export function pickFormat(canPlay: (type: string) => string): AudioFormat {
  try { return canPlay('audio/webm; codecs="opus"') ? 'webm' : 'mp3'; } catch { return 'mp3'; }
}

export const MUSIC_CREDITS = {
  piano: 'Piano: Salamander Grand Piano V3 by Alexander Holm, licensed CC BY 3.0.',
  pianoLicence: 'https://creativecommons.org/licenses/by/3.0/',
  melodies: 'Melodies and hymn settings: public domain (settings from the Open Hymnal Project).',
  arrangement: ARRANGED,
} as const;

/* ───────────────────────── Seasons ───────────────────────── */

/**
 * The soundtrack follows the Ghana calendar (from the server's time, never the device's):
 * Christmas until Boxing Day, the turn toward New Year (27 to 30 December), New Year's Eve led by Auld Lang Syne, a
 * quieter final hour, New Year music from midnight to 7 January, then a short reflective set.
 */
export type Season = 'christmas' | 'turn' | 'eve' | 'hour' | 'newyear' | 'after';
export const SEASON_LABEL: Record<Season, string> = {
  christmas: 'Christmas', turn: 'Towards the New Year', eve: 'New Year’s Eve', hour: 'The final hour', newyear: 'New Year', after: 'New Year',
};
export const PLAYLISTS: Record<Season, readonly string[]> = {
  christmas: ['silent-night', 'first-noel', 'away-in-a-manger', 'what-child', 'bleak-midwinter', 'o-come-all-ye-faithful', 'angels-we-have-heard', 'hark-the-herald', 'joy-to-the-world'],
  turn: ['joy-to-the-world', 'auld-lang-syne', 'hark-the-herald', 'ode-to-joy', 'angels-we-have-heard', 'o-come-all-ye-faithful', 'first-noel', 'bleak-midwinter', 'silent-night'],
  eve: ['auld-lang-syne', 'ode-to-joy', 'joy-to-the-world', 'hark-the-herald', 'angels-we-have-heard', 'o-come-all-ye-faithful', 'first-noel', 'silent-night'],
  hour: ['auld-lang-syne', 'silent-night', 'bleak-midwinter', 'ode-to-joy'],
  newyear: ['ode-to-joy', 'joy-to-the-world', 'auld-lang-syne', 'hark-the-herald', 'angels-we-have-heard', 'o-come-all-ye-faithful'],
  after: ['auld-lang-syne', 'ode-to-joy'],
};

/** The season for a moment: `serverNow` from the shared clock, and whether the final hour has begun. */
export function seasonFor(serverNow: number | null, finalHour = false): Season {
  if (finalHour) return 'hour';
  if (serverNow === null || !Number.isFinite(serverNow)) return 'christmas';
  const day = accraDate(new Date(serverNow));
  if (day >= '2027-01-08') return 'after';
  if (day >= '2027-01-01') return 'newyear';
  if (day === '2026-12-31') return 'eve';
  if (day >= '2026-12-27') return 'turn';
  return 'christmas';
}

/* ───────────────────────── Order ───────────────────────── */

/**
 * The next track to play. In order, the playlist simply continues (and wraps). Shuffled, it is a fair random pick
 * that never repeats the current track and avoids the most recently played ones while the list allows it.
 * `random` returns 0 ≤ n < 1 (Math.random unless a test pins it).
 */
export function nextTrack(list: readonly string[], current: string | null, opts: { shuffle: boolean; recent: readonly string[]; random?: () => number; failed?: ReadonlySet<string> }): string | null {
  const failed = opts.failed ?? new Set<string>();
  const usable = list.filter(id => !failed.has(id));
  if (!usable.length) return null;
  if (!opts.shuffle) {
    const at = current === null ? -1 : list.indexOf(current);
    for (let i = 1; i <= list.length; i++) {
      const id = list[(at + i + list.length) % list.length];
      if (!failed.has(id) && (id !== current || usable.length === 1)) return id;
    }
    return usable[0];
  }
  const random = opts.random ?? Math.random;
  const notCurrent = usable.filter(id => id !== current);
  if (!notCurrent.length) return usable[0];
  // Keep away from the last few played (up to half the list), but always leave at least one choice.
  const keepAway = new Set(opts.recent.slice(-Math.max(1, Math.floor(usable.length / 2))));
  const fresh = notCurrent.filter(id => !keepAway.has(id));
  const pool = fresh.length ? fresh : notCurrent;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

/** The track before the current one (in the order played, else the playlist's order). */
export function previousTrack(list: readonly string[], current: string | null, history: readonly string[]): string | null {
  const before = history.filter(id => id !== current);
  if (before.length) return before[before.length - 1];
  if (current === null || !list.length) return list[0] ?? null;
  const at = list.indexOf(current);
  return list[(at - 1 + list.length) % list.length];
}

/** Megabytes for the data-use note (one decimal). */
export const megabytes = (bytes: number) => Math.round(bytes / 100_000) / 10;
