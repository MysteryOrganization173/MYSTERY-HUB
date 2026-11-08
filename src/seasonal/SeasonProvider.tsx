import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { API_BASE_URL } from '../services/apiClient';
import {
  accraDate, parsePreviewDate, parseSeasonSetting, previewSeasonStatus, serverSeasonStatus,
  type SeasonalPackId, type SeasonStatus,
} from '../../shared/seasonal';

/**
 * Seasonal Experience state for the customer site.
 *
 * - Everyone sees what the server says (GET /api/seasonal/status). It is off unless the API service's
 *   SEASONAL_EXPERIENCE setting names a pack and today (Accra) is inside the pack's dates.
 * - A founder preview (?season-preview=christmas-2026, optionally &season-date=2026-12-25) shows the pack in this
 *   browser tab only, with a visible "Preview" ribbon. It is kept in sessionStorage, so it ends with the tab, and
 *   it never changes what any other visitor sees.
 * - Phase 1 dresses the signed-out experience only. Signed-in customers keep the normal appearance until Phase 2.
 */

const PREVIEW_KEY = 'mh-season-preview';
const CACHE_KEY = 'mh-season-server';
const OFF = serverSeasonStatus(undefined);

interface StoredPreview { pack: SeasonalPackId; date: string | null }

export interface SeasonContextValue {
  /** The pack and phase that apply to this browser (server setting or preview), before the guest-only rule. */
  status: SeasonStatus;
  /** True when the seasonal presentation is on screen: a pack applies and the visitor is signed out. */
  active: boolean;
  previewing: boolean;
  /** A pack applies, but this visitor is signed in, so Phase 1 keeps the normal appearance. */
  heldForSignedIn: boolean;
  exitPreview: () => void;
}

const SeasonContext = createContext<SeasonContextValue>({ status: OFF, active: false, previewing: false, heldForSignedIn: false, exitPreview: () => {} });
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
    const stored: StoredPreview | null = pack ? { pack, date: parsePreviewDate(url.searchParams.get('season-date')) } : null;
    writeStorage(() => sessionStorage, PREVIEW_KEY, stored);
    url.searchParams.delete('season-preview'); url.searchParams.delete('season-date');
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

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE_URL}/api/seasonal/status`, { headers: { Accept: 'application/json' } })
      .then(res => (res.ok ? res.json() : null))
      .then((data: { active?: boolean; pack?: unknown } | null) => {
        if (!alive || !data) return;
        // The server is the only authority; the page recomputes the phase from today's Accra date.
        const pack = data.active ? parseSeasonSetting(data.pack) : null;
        writeStorage(() => localStorage, CACHE_KEY, { pack });
        setServer(serverSeasonStatus(pack));
      })
      .catch(() => { /* offline or blocked: keep the last known answer, which defaults to off */ });
    return () => { alive = false; };
  }, []);

  const exitPreview = useCallback(() => { writeStorage(() => sessionStorage, PREVIEW_KEY, null); setPreview(null); }, []);

  const value = useMemo<SeasonContextValue>(() => {
    const status = preview ? previewSeasonStatus(preview.pack, preview.date || accraDate()) : server;
    const signedOut = !user && !isAuthChecking;
    return { status, active: status.active && signedOut, previewing: Boolean(preview), heldForSignedIn: status.active && !signedOut, exitPreview };
  }, [preview, server, user, isAuthChecking, exitPreview]);

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
};

/** Attributes for the customer shell. Absent when the season is off, so the normal styles apply untouched. */
export function seasonShellAttributes(season: SeasonContextValue): Record<string, string> {
  if (!season.active || !season.status.pack) return {};
  return { 'data-season': 'christmas', 'data-season-phase': season.status.phase };
}
