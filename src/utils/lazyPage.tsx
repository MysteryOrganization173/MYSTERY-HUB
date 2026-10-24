import React, { Suspense, lazy, type ComponentType, type ReactNode } from 'react';
import { RouteFallback, RouteLoadError } from '../components/common/RouteFallback';

type Loader<M> = () => Promise<M>;

/** One retry absorbs a dropped request on a weak mobile connection before the page shows its error state. */
export function retryOnce<M>(load: Loader<M>, wait = 800): Loader<M> {
  return () => load().catch(() => new Promise<M>((resolve, reject) => setTimeout(() => load().then(resolve, reject), wait)));
}

/** Data Saver and 2G connections never download pages the visitor has not asked for. */
export function canWarm(nav: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator) {
  const connection = (nav as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } } | undefined)?.connection;
  return !connection?.saveData && !/(^|-)2g$/.test(connection?.effectiveType || '');
}

const warmQueue: Loader<unknown>[] = [];
let warmScheduled = false;
function scheduleWarm(load: Loader<unknown>) {
  warmQueue.push(load);
  if (warmScheduled || typeof window === 'undefined') return;
  warmScheduled = true;
  // After the first screen has loaded and settled, so warming never competes with the start page or its artwork.
  const start = () => window.setTimeout(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const run = () => { if (canWarm()) for (const next of warmQueue.splice(0)) void next().catch(() => undefined); };
    if (idle) idle(run, { timeout: 4000 }); else run();
  }, 1500);
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
}

/** Marks a failed download, so the page can tell "check your connection" apart from a fault inside the page. */
const DOWNLOAD_FAILED = Symbol('mh.downloadFailed');
export const isDownloadFailure = (error: unknown) => Boolean(error && typeof error === 'object' && (error as Record<symbol, unknown>)[DOWNLOAD_FAILED]);

class LoadBoundary extends React.Component<{ children: ReactNode }, { failed: null | 'download' | 'page' }> {
  state: { failed: null | 'download' | 'page' } = { failed: null };
  static getDerivedStateFromError(error: unknown) { return { failed: isDownloadFailure(error) ? 'download' as const : 'page' as const }; }
  render() { return this.state.failed ? <RouteLoadError reason={this.state.failed} /> : this.props.children; }
}

/**
 * A page that downloads the first time it is shown. A failed download (offline, or a release replaced the file)
 * shows a calm retry message instead of a blank screen; retrying reloads so the newest release is used.
 */
export function lazyPage<M extends Record<string, unknown>, K extends keyof M>(
  load: Loader<M>, name: K, { warm = false, fallback = <RouteFallback /> }: { warm?: boolean; fallback?: ReactNode } = {},
) {
  const loadOnce = retryOnce(load);
  let pending: Promise<M> | null = null;
  const shared = () => (pending ||= loadOnce().catch(error => {
    pending = null;
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { [DOWNLOAD_FAILED]: true });
  }));
  const Page = lazy(() => shared().then(module => ({ default: module[name] as ComponentType<any> })));
  if (warm) scheduleWarm(shared);
  const LazyPage = (props: Record<string, unknown>) => (
    <LoadBoundary><Suspense fallback={fallback}><Page {...props} /></Suspense></LoadBoundary>
  );
  LazyPage.displayName = `Lazy(${String(name)})`;
  return LazyPage as unknown as M[K];
}
