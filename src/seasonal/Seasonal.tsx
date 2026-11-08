import React, { Suspense, lazy, useEffect } from 'react';
import { X } from 'lucide-react';
import { useSeason } from './SeasonProvider';
import type { ChristmasSlot } from './christmas/ChristmasPack';
import type { SeasonPage } from './christmas/copy';

/**
 * A place in the site where the active seasonal pack may draw. When no season is active it renders nothing and
 * loads nothing: the pack (artwork + scoped stylesheet) is its own chunk, fetched only when a season is on screen.
 */
const loadChristmas = () => import('./christmas/ChristmasPack');
const ChristmasPack = lazy(loadChristmas);

export function Seasonal({ slot, page }: { slot: ChristmasSlot; page?: SeasonPage }) {
  const season = useSeason();
  if (!season.active || season.status.pack !== 'christmas-2026') return null;
  return <Suspense fallback={null}><ChristmasPack slot={slot} page={page} status={season.status} /></Suspense>;
}

/** True while a season is on screen, for the few components that adjust copy or layout around it. */
export const useSeasonActive = () => useSeason().active;

const PHASE_LABEL: Record<string, string> = {
  'christmas-season': 'Christmas season', 'christmas-day': 'Christmas Day', 'boxing-day': 'Boxing Day', 'year-end': 'Toward New Year',
  'new-years-eve': 'New Year’s Eve', 'new-years-day': 'New Year’s Day', 'new-year': 'New Year celebration', before: 'Before the season', after: 'After the season',
};

/**
 * Loads the pack's stylesheet as soon as a season applies, and shows the founder preview ribbon. The ribbon says
 * plainly that only this tab is affected, which day is being previewed, and how to leave.
 */
export function SeasonalShellLayer() {
  const season = useSeason();
  useEffect(() => { if (season.active) void loadChristmas(); }, [season.active]);
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
