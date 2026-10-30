import { useCallback, useEffect, useState, type SetStateAction } from 'react';
import type { WebsiteSiteRecord } from '../types';
import { getMyWebsitesOnServer } from '../services/apiClient';
import { withoutDeletedWebsites } from '../utils/websiteDeletion';

/**
 * The signed-in owner's websites, shared by the Website Builder and the Business Workspace. The last answer is kept
 * for that session token only, so moving between the two pages paints at once while the server is asked again.
 * Another account (a different token) never sees it, not even for one render.
 */
let cache: { token: string; sites: WebsiteSiteRecord[] } | null = null;

/** Builder V6: the editor is its own page, so it tells the shared list about each save; Builder and My Business
 * then paint the latest draft at once when the owner returns (and still ask the server again). Same account only. */
export function rememberOwnerWebsite(token: string | null, site: WebsiteSiteRecord) {
  if (!token || cache?.token !== token) return;
  cache = { token, sites: cache.sites.some(item => item.id === site.id) ? cache.sites.map(item => item.id === site.id ? site : item) : [site, ...cache.sites] };
}

export function useOwnerWebsites(token: string | null) {
  const [state, setState] = useState<{ token: string | null; sites: WebsiteSiteRecord[] }>(() => ({ token, sites: token && cache?.token === token ? cache.sites : [] }));
  const [loading, setLoading] = useState(Boolean(token && cache?.token !== token));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const setSites = useCallback((next: SetStateAction<WebsiteSiteRecord[]>) => {
    setState(prev => {
      const current = prev.token === token ? prev.sites : [];
      const sites = typeof next === 'function' ? next(current) : next;
      if (token) cache = { token, sites };
      return { token, sites };
    });
  }, [token]);

  useEffect(() => {
    if (!token) { cache = null; setState({ token: null, sites: [] }); setError(null); setLoading(false); return; }
    let live = true;
    const hit = cache?.token === token ? cache.sites : null;
    setState({ token, sites: hit || [] });
    setLoading(!hit); setError(null);
    getMyWebsitesOnServer(token)
      .then(res => { if (!live || !res.success) return; const sites = withoutDeletedWebsites(res.sites || []); cache = { token, sites }; setState({ token, sites }); })
      .catch((err: any) => { if (live) setError(err?.message || 'Unable to connect to website services. Please try again.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, tick]);

  const reload = useCallback(() => setTick(n => n + 1), []);
  const sites = state.token === token ? state.sites : [];
  return { sites, setSites, loading: loading || state.token !== token, error, reload };
}
