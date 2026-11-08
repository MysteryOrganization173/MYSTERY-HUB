import React, { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useSeason } from './SeasonProvider';
import { retryOnce } from '../utils/lazyPage';
import type { ChristmasSlot } from './christmas/ChristmasPack';
import type { SeasonPage } from './christmas/copy';

/**
 * A place in the site where the active seasonal pack may draw. When no season is active it renders nothing and
 * loads nothing: the pack (artwork + scoped stylesheet) is its own chunk, fetched only when a season is on screen.
 * A dropped download is retried once; if it still fails the season simply does not show (the page never breaks).
 */
const loadChristmas = retryOnce(() => import('./christmas/ChristmasPack'));
const ChristmasPack = lazy(loadChristmas);
/** The Christmas homepage is its own chunk, so other pages never download it. */
const loadChristmasHome = retryOnce(() => import('./christmas/home/ChristmasHome'));
const ChristmasHome = lazy(loadChristmasHome);

/** If a seasonal chunk cannot load or render, show the ordinary interface instead of an error. */
class SeasonalBoundary extends React.Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function Seasonal({ slot, page }: { slot: ChristmasSlot; page?: SeasonPage }) {
  const season = useSeason();
  if (!season.active || season.status.pack !== 'christmas-2026') return null;
  return <SeasonalBoundary fallback={null}><Suspense fallback={null}><ChristmasPack slot={slot} page={page} status={season.status} /></Suspense></SeasonalBoundary>;
}

/**
 * The season's own signed-out homepage. While its chunk downloads a short festive placeholder holds the space (the
 * download starts as soon as the app opens, see SeasonalShellLayer); if it cannot load or render, `fallback` (the
 * ordinary homepage) is shown instead, so a visitor always has a working homepage.
 */
export function SeasonalHome({ fallback }: { fallback: ReactNode }) {
  const season = useSeason();
  if (!season.active || season.status.pack !== 'christmas-2026') return <>{fallback}</>;
  return <SeasonalBoundary fallback={fallback}><Suspense fallback={<div className="mh-season-home-wait" aria-busy="true" />}><ChristmasHome status={season.status} /></Suspense></SeasonalBoundary>;
}

/** True while a season is on screen, for the few components that adjust copy or layout around it. */
export const useSeasonActive = () => useSeason().active;

const PHASE_LABEL: Record<string, string> = {
  'christmas-season': 'Christmas season', 'christmas-day': 'Christmas Day', 'boxing-day': 'Boxing Day', 'year-end': 'Toward New Year',
  'new-years-eve': 'New Year’s Eve', 'new-years-day': 'New Year’s Day', 'new-year': 'New Year celebration', before: 'Before the season', after: 'After the season',
};

/**
 * Loads the pack (and, on the homepage, the seasonal homepage) as soon as a season applies, and shows the founder
 * preview ribbon. The ribbon says plainly that only this tab is affected, which day is being previewed, and how to
 * leave.
 */
export function SeasonalShellLayer({ page }: { page?: string }) {
  const season = useSeason();
  useEffect(() => { if (season.active) void loadChristmas().catch(() => undefined); }, [season.active]);
  useEffect(() => { if (season.active && page === 'home') void loadChristmasHome().catch(() => undefined); }, [season.active, page]);
  if (!season.previewing) return null;
  const date = new Date(season.status.date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return (
    <div className="mh-season-preview" role="status">
      <span className="mh-season-preview-dot" aria-hidden="true" />
      <p>
        <strong>Christmas preview</strong>
        <span>{season.heldForSignedIn
          ? ' · Phase 1 covers the signed-out site. Sign out, or open the preview link in a private window, to see it.'
          : <> · <span className="mh-season-preview-wide">{PHASE_LABEL[season.status.phase] || season.status.phase}, </span>{date}<span className="mh-season-preview-wide"> · Only this browser tab sees it.</span></>}</span>
      </p>
      <button type="button" onClick={season.exitPreview}><X className="w-3.5 h-3.5" aria-hidden />Exit preview</button>
    </div>
  );
}
