import React, { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useSeason } from './SeasonProvider';
import { retryOnce } from '../utils/lazyPage';
import { isChristmasPhase } from '../../shared/seasonal';
import type { ChristmasSlot } from './christmas/ChristmasPack';
import type { ShellSlotName } from './christmas/shell/ChristmasShell';
import type { SeasonPage } from './christmas/copy';

/**
 * A place in the site where the active seasonal pack may draw. When no season is active it renders nothing and
 * loads nothing: each part (artwork + scoped stylesheet) is its own chunk, fetched only when a season is on screen.
 * A dropped download is retried once; if it still fails the season simply does not show (the page never breaks).
 */
const loadChristmas = retryOnce(() => import('./christmas/ChristmasPack'));
const ChristmasPack = lazy(loadChristmas);
/** The Christmas homepage is its own chunk, so other pages never download it. */
const loadChristmasHome = retryOnce(() => import('./christmas/home/ChristmasHome'));
const ChristmasHome = lazy(loadChristmasHome);
/** The shared seasonal shell (logo hat, menu header, footer) for every visitor while a pack applies. */
const loadShell = retryOnce(() => import('./christmas/shell/ChristmasShell'));
const ShellSlot = lazy(() => loadShell().then(m => ({ default: m.ShellSlot })));
const ShellFooter = lazy(() => loadShell().then(m => ({ default: m.ChristmasFooter })));

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

/** A place in the shared shell (header logo, phone menu) where the season may draw, for guests and members alike. */
export function SeasonalShell({ slot }: { slot: ShellSlotName }) {
  const season = useSeason();
  if (!season.shellActive || season.status.pack !== 'christmas-2026') return null;
  return <SeasonalBoundary fallback={null}><Suspense fallback={null}><ShellSlot slot={slot} status={season.status} /></Suspense></SeasonalBoundary>;
}

/** The seasonal footer while a pack applies; the ordinary footer otherwise, while it loads, or if it ever fails. */
export function SeasonalFooter({ fallback }: { fallback: ReactNode }) {
  const season = useSeason();
  if (!season.shellActive || season.status.pack !== 'christmas-2026') return <>{fallback}</>;
  return <SeasonalBoundary fallback={fallback}><Suspense fallback={fallback}><ShellFooter status={season.status} /></Suspense></SeasonalBoundary>;
}

/** True while a season is on screen, for the few components that adjust copy or layout around it. */
export const useSeasonActive = () => useSeason().active;

const PHASE_LABEL: Record<string, string> = {
  'christmas-season': 'Christmas season', 'christmas-day': 'Christmas Day', 'boxing-day': 'Boxing Day', 'year-end': 'Toward New Year',
  'new-years-eve': 'New Year’s Eve', 'new-years-day': 'New Year’s Day', 'new-year': 'New Year celebration', before: 'Before the season', after: 'After the season',
};

/**
 * Loads the season's parts as soon as they apply (the shell for everyone, the guest pack for guests, the right
 * homepage on the homepage), and shows the founder preview ribbon. The ribbon names the phase being previewed
 * (Christmas or New Year), says plainly that only this tab is affected, and how to leave.
 */
export function SeasonalShellLayer({ page }: { page?: string }) {
  const season = useSeason();
  useEffect(() => { if (season.shellActive) void loadShell().catch(() => undefined); }, [season.shellActive]);
  useEffect(() => { if (season.active) void loadChristmas().catch(() => undefined); }, [season.active]);
  useEffect(() => { if (season.active && page === 'home') void loadChristmasHome().catch(() => undefined); }, [season.active, page]);
  if (!season.previewing) return null;
  const date = new Date(season.status.date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const title = isChristmasPhase(season.status.phase) ? 'Christmas preview' : 'New Year preview';
  return (
    <div className="mh-season-preview" role="status">
      <span className="mh-season-preview-dot" aria-hidden="true" />
      <p>
        <strong>{title}</strong>
        <span> · <span className="mh-season-preview-wide">{PHASE_LABEL[season.status.phase] || season.status.phase}, </span>{date}
          <span className="mh-season-preview-wide">{season.memberActive
            ? ' · Signed in: your homepage, header and footer show the season; other account pages stay as they are. Only this browser tab sees it.'
            : ' · Only this browser tab sees it.'}</span></span>
      </p>
      <button type="button" onClick={season.exitPreview}><X className="w-3.5 h-3.5" aria-hidden />Exit preview</button>
    </div>
  );
}
