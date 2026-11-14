import type { ExperienceEvent } from '../../shared/mysteryExperiences';
import { growthAllowed, growthIdentity, trackGrowth } from '../utils/growthAnalytics';
import { postExperienceEvent } from './api';

/**
 * Interaction counts for Mystery Greetings: an event name, the greeting's public ID where it applies, and the same
 * anonymous browser/session IDs the site already uses. Never names, messages, creator secrets or account identity.
 * Do Not Track, Global Privacy Control and blocked storage switch it off here; the server drops bots and prefetches.
 */
const seen = new Set<string>();
export function analyticsAllowed(nav: Pick<Navigator, 'doNotTrack'> & { globalPrivacyControl?: boolean } = navigator, loc: Pick<Location, 'pathname' | 'search'> = location) {
  return growthAllowed(loc.pathname, loc.search, nav.doNotTrack) && nav.globalPrivacyControl !== true;
}
export function trackExperience(event: ExperienceEvent, shareId?: string) {
  try {
    if (!analyticsAllowed()) return;
    const key = `${event}:${shareId || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    const { visitorId, sessionId } = growthIdentity(localStorage, sessionStorage);
    void postExperienceEvent({ event, ...(shareId ? { shareId } : {}), visitorId, sessionId });
  } catch { /* analytics never shapes the greeting */ }
}
/** The site's ordinary page view for these standalone pages, under the same consent rules as the events above. */
export const trackGreetingsPage = () => { if (analyticsAllowed()) trackGrowth('page_view', { page: 'greetings' }); };
