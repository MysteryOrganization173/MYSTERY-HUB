import { recordWebsiteAnalytics } from '../services/apiClient.js';
import type { WebsiteClientEvent, WebsiteAnalyticsInput } from '../config/websiteAnalytics.js';
function randomIdentity(storage: Storage, key: string) {
  let id=storage.getItem(key);
  if(!id || !/^[0-9a-f-]{36}$/i.test(id)) { id=crypto.randomUUID(); storage.setItem(key,id); }
  return id;
}
/** No fingerprint, location, query string, content, contacts or image URLs. Failure is UX-neutral. */
export function trackWebsiteEvent(event: WebsiteClientEvent, metadata: WebsiteAnalyticsInput['metadata'], token?: string) {
  try {
    const visitorId=randomIdentity(localStorage,'mh_analytics_visitor'), sessionId=randomIdentity(sessionStorage,'mh_analytics_session');
    void recordWebsiteAnalytics({event,visitorId,sessionId,metadata},token).catch(()=>{});
  } catch { /* Disabled storage/network must not stop editing. */ }
}
