import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { API_BASE_URL } from '../services/apiClient';
import {
  accraDate, greetingsEntry, GREETINGS_COMING_SOON, parsePreviewDate, parseSeasonSetting, previewSeasonStatus, serverSeasonStatus,
  type GreetingsEntry, type SeasonalPackId, type SeasonStatus,
} from '../../shared/seasonal';
import { scheduledPackFrom, usableStoredSeason } from './seasonClock';
import { earlySeasonAnswer } from '../utils/startupHints';
import { startSeasonSync } from './seasonSync';

/**
 * Seasonal Experience state for the customer site.
 *
 * - Everyone sees what the server says (GET /api/seasonal/status). It is off unless the API service's
 *   SEASONAL_EXPERIENCE setting names a pack and today (Accra) is inside the pack's dates.
 * - A founder preview (?season-preview=christmas-2026, optionally &season-date=2026-12-25) shows the pack in this
 *   browser tab only, with a visible "Preview" ribbon. It is kept in sessionStorage, so it ends with the tab, and
 *   it never changes what any other visitor sees.
 * - Who sees what while a pack applies:
 *   - the shared shell (header logo, menu, footer) follows the season for everyone, including while sign-in is checked,
 *     so it never flickers on and off as the account loads (`shellActive`, `data-season-shell`);
 *   - signed-out visitors get the whole guest journey: every guest page composition and the guest homepage
 *     (`active`, `data-season`);
 *   - signed-in customers get the seasonal member homepage (`memberActive`); their other pages stay normal for now.
 * - Lifecycle (3.6.4): the server says which pack is switched on (`scheduledPack`, even before its first day); this
 *   page works out today's Accra day itself, so an open tab or installed app changes phase at midnight (1 December,
 *   Christmas Day, 27 December, New Year, and back to normal on 6 January) without a reload. It asks the server again
 *   only when that could change the answer: just after midnight (spread over 30 s), back in the foreground after five
 *   minutes, when the connection returns, and every 30 minutes while visible. A device clock more than ten minutes
 *   from the server's is corrected. Offline, the last answer stands for up to seven days, always within the pack's
 *   dates; after that the page is ordinary until the server answers. See seasonClock.ts.
 */

const PREVIEW_KEY = 'mh-season-preview';
const CACHE_KEY = 'mh-season-server';
const OFF = serverSeasonStatus(undefined);

interface StoredPreview { pack: SeasonalPackId; date: string | null }

export interface SeasonContextValue {
  /** The pack and phase that apply to this browser (server setting or preview), before the guest-only rule. */
  status: SeasonStatus;
  /** The guest pack is on screen: a pack applies and the visitor is signed out. */
  active: boolean;
  /** A pack applies and a customer is signed in: the seasonal member homepage is on screen. */
  memberActive: boolean;
  /** A pack applies, whoever is visiting: the shared header, menu and footer are seasonal. */
  shellActive: boolean;
  previewing: boolean;
  /** A pack applies, but this visitor is signed in (or still being checked), so guest page compositions stay off. */
  heldForSignedIn: boolean;
  /** Mystery Greetings, as the server reports it (the same for guests, members and previews). */
  greetings: GreetingsEntry;
  exitPreview: () => void;
}

const SeasonContext = createContext<SeasonContextValue>({ status: OFF, active: false, memberActive: false, shellActive: false, previewing: false, heldForSignedIn: false, greetings: GREETINGS_COMING_SOON, exitPreview: () => {} });
export const useSeason = () => useContext(SeasonContext);

function readStorage<T>(storage: () => Storage, key: string): T | null {
  try { const raw = storage().getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
function writeStorage(storage: () => Storage, key: string, value: unknown) {
  try { if (value === null) storage().removeItem(key); else storage().setItem(key, JSON.stringify(value)); } catch { /* storage may be blocked */ }
}

/** Reads ?season-preview from the address once, keeps it for this tab, and removes it from the address bar. */
function takePreviewFromUrl(): StoredPreview | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const asked = url.searchParams.get('season-preview');
  if (asked !== null) {
    const pack = parseSeasonSetting(asked);
    // A link copied through email or a messaging app can arrive with its "&" escaped as "&amp;" ("?…&amp;season-date=…");
    // without this the date would be lost and the preview would silently show today instead of the day asked for.
    const date = url.searchParams.get('season-date') ?? url.searchParams.get('amp;season-date');
    const stored: StoredPreview | null = pack ? { pack, date: parsePreviewDate(date) } : null;
    writeStorage(() => sessionStorage, PREVIEW_KEY, stored);
    url.searchParams.delete('season-preview'); url.searchParams.delete('season-date'); url.searchParams.delete('amp;season-date');
    try { window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`); } catch { /* a locked-down browser: the address simply keeps the parameters */ }
    return stored;
  }
  const saved = readStorage<StoredPreview>(() => sessionStorage, PREVIEW_KEY);
  return saved && parseSeasonSetting(saved.pack) ? { pack: saved.pack, date: parsePreviewDate(saved.date) } : null;
}

/** The last server answer (if recent enough), so a returning visitor sees the season immediately. */
const storedSeason = () => usableStoredSeason(readStorage<unknown>(() => localStorage, CACHE_KEY), Date.now());
/**
 * 3.7.3: where the page starts. The page's first script asks the server before the app has downloaded (startupHints.ts);
 * if that answer is already here, a first-time visitor starts on the right appearance instead of switching from the
 * ordinary homepage a moment later. It counts like a stored answer (the scheduler below still asks the server at once,
 * as before): it says which pack is on, never corrects the clock, and keeps any correction this device already had.
 */
function startingSeason() {
  const stored = storedSeason();
  const early = earlySeasonAnswer();
  // The newer of the two wins (the stored answer can be newer if this provider mounts again later on the same page).
  if (!early || (stored && stored.at > early.at)) return stored;
  return usableStoredSeason({ pack: scheduledPackFrom(early.data), at: early.at, skew: stored?.skew ?? 0 }, Date.now()) ?? stored;
}
/** The status for one Accra day, from the pack the server switched on (or none). */
const statusOn = (pack: SeasonalPackId | null, day: string) => serverSeasonStatus(pack, new Date(day + 'T12:00:00Z'));

export const SeasonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthChecking } = useApp();
  const [preview, setPreview] = useState<StoredPreview | null>(takePreviewFromUrl);
  const [initial] = useState(startingSeason);
  const [scheduled, setScheduled] = useState<SeasonalPackId | null>(initial?.pack ?? null);
  const skew = useRef(initial?.skew ?? 0);
  const [today, setToday] = useState(() => accraDate(new Date(Date.now() + skew.current)));
  const [greetings, setGreetings] = useState<GreetingsEntry>(GREETINGS_COMING_SOON);

  // The server connection and the Accra-midnight schedule (seasonSync.ts): one request at a time, refreshed only when
  // the answer could have changed; the phase itself is worked out on this device from the corrected clock.
  useEffect(() => startSeasonSync({
    fetchStatus: (fresh, signal) => fetch(`${API_BASE_URL}/api/seasonal/status`, { headers: { Accept: 'application/json' }, signal, ...(fresh ? { cache: 'no-cache' as RequestCache } : {}) })
      .then(res => (res.ok ? res.json() : null)),
    now: () => Date.now(),
    random: Math.random,
    isHidden: () => document.visibilityState === 'hidden',
    listen: ({ onReturn, onOnline }) => {
      document.addEventListener('visibilitychange', onReturn);
      window.addEventListener('focus', onReturn); window.addEventListener('pageshow', onReturn); window.addEventListener('online', onOnline);
      return () => {
        document.removeEventListener('visibilitychange', onReturn);
        window.removeEventListener('focus', onReturn); window.removeEventListener('pageshow', onReturn); window.removeEventListener('online', onOnline);
      };
    },
    initial,
    onAnswer: (data) => {
      // The server is the only authority on which pack is on; the page recomputes the phase from today's Accra date.
      skew.current = data.skew;
      writeStorage(() => localStorage, CACHE_KEY, { pack: data.pack, at: data.at, skew: data.skew });
      setScheduled(data.pack);
      setGreetings(greetingsEntry(data.greetings));
    },
    onDay: (corrected) => setToday(accraDate(new Date(corrected))),
    // Offline or blocked for longer than the last answer may stand: the ordinary appearance until the server answers.
    onStale: () => setScheduled(null),
  }), [initial]);

  const exitPreview = useCallback(() => { writeStorage(() => sessionStorage, PREVIEW_KEY, null); setPreview(null); }, []);

  const value = useMemo<SeasonContextValue>(() => {
    const status = preview ? previewSeasonStatus(preview.pack, preview.date || today) : statusOn(scheduled, today);
    const signedOut = !user && !isAuthChecking;
    const signedIn = Boolean(user) && !isAuthChecking;
    return {
      status, active: status.active && signedOut, memberActive: status.active && signedIn, shellActive: status.active,
      previewing: Boolean(preview), heldForSignedIn: status.active && !signedOut, greetings, exitPreview,
    };
  }, [preview, scheduled, today, greetings, user, isAuthChecking, exitPreview]);

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
};

/**
 * Attributes for the customer shell. Absent when the season is off, so the normal styles apply untouched.
 * - `data-season-shell`: a pack applies (any visitor): the shared header, menu and footer.
 * - `data-season`: the guest pack (signed-out visitors only), exactly as before.
 * - `data-season-audience`: guest, member, or pending while the account is being checked.
 * - `data-season-page`: lets the pack adjust shared chrome for one page only (the homepage draws its own lights).
 */
export function seasonShellAttributes(season: SeasonContextValue, page?: string): Record<string, string> {
  if (!season.shellActive || !season.status.pack) return {};
  return {
    'data-season-shell': 'christmas',
    'data-season-audience': season.active ? 'guest' : season.memberActive ? 'member' : 'pending',
    'data-season-phase': season.status.phase,
    ...(season.active ? { 'data-season': 'christmas' } : {}),
    ...(page ? { 'data-season-page': page } : {}),
  };
}
