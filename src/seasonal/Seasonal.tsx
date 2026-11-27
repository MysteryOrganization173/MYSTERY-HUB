import React, { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useSeason } from './SeasonProvider';
import { useApp } from '../context/AppContext';
import { retryOnce } from '../utils/lazyPage';
import { isChristmasPhase } from '../../shared/seasonal';
import type { ChristmasSlot } from './christmas/ChristmasPack';
import type { ShellSlotName } from './christmas/shell/ChristmasShell';
import type { SeasonPage } from './christmas/copy';
import type { MemberHomeViewProps } from '../components/home/MemberHomeView';

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
/** The signed-in customer's seasonal homepage, also its own chunk. */
const loadMemberHome = retryOnce(() => import('./christmas/member/ChristmasMemberHome'));
const ChristmasMemberHome = lazy(loadMemberHome);
/** The Data page's seasonal appearance (artwork, line and scoped stylesheet), for guests and members alike. */
const loadDataStore = retryOnce(() => import('./christmas/data/ChristmasDataStore'));
const ChristmasDataStore = lazy(loadDataStore);
/** Orders and the receipt (3.6.2): artwork, a line, a receipt flourish and one celebration, for guests and members. */
const loadOrders = retryOnce(() => import('./christmas/orders/ChristmasOrders'));
const ChristmasOrders = lazy(loadOrders);

/** If a seasonal chunk cannot load or render, show the ordinary interface instead of an error. */
class SeasonalBoundary extends React.Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/**
 * Slots that dress a shared page for signed-in customers too (3.6.4, Level B: one accent row above the title, and the
 * Creative Studio stage), so a member's Wallet, Help or Services page carries the same quiet seasonal detail as a
 * guest's. Never while the account is still being checked (no styles apply to that moment), and the guest-only slots
 * (header lights, sign-in invitation, footer greeting, checkout celebration) stay guest-only.
 */
const SHARED_SLOTS: readonly ChristmasSlot[] = ['page', 'creative-stage'];

export function Seasonal({ slot, page }: { slot: ChristmasSlot; page?: SeasonPage }) {
  const season = useSeason();
  const on = SHARED_SLOTS.includes(slot) ? season.active || season.memberActive : season.active;
  if (!on || season.status.pack !== 'christmas-2026') return null;
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

/**
 * The signed-in customer's seasonal homepage. It receives exactly the props the ordinary member homepage gets (the
 * same orders, Wallet, website record and actions, read once by MemberDashboard for this account), so the season
 * changes presentation only. If its chunk cannot load or render, `fallback` (the ordinary member homepage) shows.
 */
export function SeasonalMemberHome({ view, fallback }: { view: MemberHomeViewProps; fallback: ReactNode }) {
  const season = useSeason();
  if (!season.memberActive || season.status.pack !== 'christmas-2026') return <>{fallback}</>;
  return <SeasonalBoundary fallback={fallback}><Suspense fallback={<div className="mh-season-home-wait is-member" aria-busy="true" />}><ChristmasMemberHome view={view} status={season.status} /></Suspense></SeasonalBoundary>;
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

/**
 * The Data page's seasonal look. Unlike the guest page compositions it follows the shared shell rule (`shellActive`):
 * the same purchasing page is dressed for guests and signed-in customers, so signing in or out never changes it.
 * - `part="art"`: the illustration beside the title; `fallback` (the ordinary artwork) shows when no season applies
 *   or if the chunk cannot load or render.
 * - `part="line"`: the seasonal line above the title; nothing at all when no season applies.
 */
export function SeasonalDataStore({ part, fallback = null }: { part: 'art' | 'line'; fallback?: ReactNode }) {
  const season = useSeason();
  if (!season.shellActive || season.status.pack !== 'christmas-2026') return <>{fallback}</>;
  return <SeasonalBoundary fallback={fallback}><Suspense fallback={part === 'art' ? <div className="mh-ds-art-wait" aria-hidden="true" /> : null}><ChristmasDataStore part={part} status={season.status} /></Suspense></SeasonalBoundary>;
}

/**
 * Orders and the receipt in season (3.6.2), on the shared shell rule (`shellActive`) like the Data page.
 * - `part="art"`: the illustration beside the Orders title; `fallback` (the ordinary artwork) otherwise or on failure.
 * - `part="line"`: the seasonal line above the Orders title.
 * - `part="flourish"`: a small decoration on a receipt that is going well (the receipt decides; never on a problem).
 * - `part="celebrate"`: one finite celebration, only for a supplier delivery the receipt saw happen.
 * Nothing at all when no season applies; if the chunk cannot load, the ordinary design shows and nothing breaks.
 */
export function SeasonalOrders({ part, fallback = null }: { part: 'art' | 'line' | 'flourish' | 'celebrate'; fallback?: ReactNode }) {
  const season = useSeason();
  if (!season.shellActive || season.status.pack !== 'christmas-2026') return <>{fallback}</>;
  return <SeasonalBoundary fallback={fallback}><Suspense fallback={fallback}><ChristmasOrders part={part} status={season.status} /></Suspense></SeasonalBoundary>;
}

/** The Data page root's season attributes (a pure helper, kept beside the season so it is tested on real dates). */
export { dataStoreSeasonAttributes } from './dataStoreSeason';

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
  const { isAuthModalOpen } = useApp();
  useEffect(() => { if (season.shellActive) void loadShell().catch(() => undefined); }, [season.shellActive]);
  useEffect(() => { if (season.active || season.memberActive) void loadChristmas().catch(() => undefined); }, [season.active, season.memberActive]);
  useEffect(() => { if (season.active && page === 'home') void loadChristmasHome().catch(() => undefined); }, [season.active, page]);
  // The member homepage starts downloading while a returning customer's session is still being checked, and when a
  // guest opens Sign in / Create account, so signing in moves straight to it instead of waiting on a download.
  useEffect(() => { if (season.heldForSignedIn && page === 'home') void loadMemberHome().catch(() => undefined); }, [season.heldForSignedIn, page]);
  // The Data page's seasonal look is for every visitor, so it starts downloading as soon as the page is opened.
  useEffect(() => { if (season.shellActive && page === 'data') void loadDataStore().catch(() => undefined); }, [season.shellActive, page]);
  // Orders and the receipt share one small chunk: it starts downloading on the Orders page, or when a receipt opens.
  useEffect(() => { if (season.shellActive && page === 'orders') void loadOrders().catch(() => undefined); }, [season.shellActive, page]);
  useEffect(() => { if (season.active && isAuthModalOpen) void loadMemberHome().catch(() => undefined); }, [season.active, isAuthModalOpen]);
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
            ? ' · Signed in: your homepage, Data page, Orders, header and footer show the season; other account pages stay as they are. Only this browser tab sees it.'
            : ' · Only this browser tab sees it.'}</span></span>
      </p>
      <button type="button" onClick={season.exitPreview}><X className="w-3.5 h-3.5" aria-hidden />Exit preview</button>
    </div>
  );
}
