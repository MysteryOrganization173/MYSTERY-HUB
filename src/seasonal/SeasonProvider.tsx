import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { API_BASE_URL } from '../services/apiClient';
import {
  accraDate, greetingsEntry, GREETINGS_COMING_SOON, parsePreviewDate, parseSeasonSetting, previewSeasonStatus, serverSeasonStatus,
  type GreetingsEntry, type SeasonalPackId, type SeasonStatus,
} from '../../shared/seasonal';

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
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    return stored;
  }
  const saved = readStorage<StoredPreview>(() => sessionStorage, PREVIEW_KEY);
  return saved && parseSeasonSetting(saved.pack) ? { pack: saved.pack, date: parsePreviewDate(saved.date) } : null;
}

/** The last server answer, so a returning visitor sees the season immediately; the server is asked again every load. */
function cachedServerStatus(): SeasonStatus {
  const cached = readStorage<{ pack: string | null }>(() => localStorage, CACHE_KEY);
  return cached?.pack ? serverSeasonStatus(cached.pack) : OFF;
}

export const SeasonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthChecking } = useApp();
  const [preview, setPreview] = useState<StoredPreview | null>(takePreviewFromUrl);
  const [server, setServer] = useState<SeasonStatus>(cachedServerStatus);
  const [greetings, setGreetings] = useState<GreetingsEntry>(GREETINGS_COMING_SOON);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE_URL}/api/seasonal/status`, { headers: { Accept: 'application/json' } })
      .then(res => (res.ok ? res.json() : null))
      .then((data: { active?: boolean; pack?: unknown; greetings?: unknown } | null) => {
        if (!alive || !data) return;
        // The server is the only authority; the page recomputes the phase from today's Accra date.
        const pack = data.active ? parseSeasonSetting(data.pack) : null;
        writeStorage(() => localStorage, CACHE_KEY, { pack });
        setServer(serverSeasonStatus(pack));
        setGreetings(greetingsEntry(data.greetings));
      })
      .catch(() => { /* offline or blocked: keep the last known answer, which defaults to off */ });
    return () => { alive = false; };
  }, []);

  const exitPreview = useCallback(() => { writeStorage(() => sessionStorage, PREVIEW_KEY, null); setPreview(null); }, []);

  const value = useMemo<SeasonContextValue>(() => {
    const status = preview ? previewSeasonStatus(preview.pack, preview.date || accraDate()) : server;
    const signedOut = !user && !isAuthChecking;
    const signedIn = Boolean(user) && !isAuthChecking;
    return {
      status, active: status.active && signedOut, memberActive: status.active && signedIn, shellActive: status.active,
      previewing: Boolean(preview), heldForSignedIn: status.active && !signedOut, greetings, exitPreview,
    };
  }, [preview, server, greetings, user, isAuthChecking, exitPreview]);

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
