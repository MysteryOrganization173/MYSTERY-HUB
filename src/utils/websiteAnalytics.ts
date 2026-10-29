import { recordWebsiteAnalytics } from '../services/apiClient.js';
import type { WebsiteClientEvent, WebsiteAnalyticsInput } from '../config/websiteAnalytics.js';
import {growthIdentity} from './growthAnalytics';
/** No fingerprint, location, query string, content, contacts or image URLs. Failure is UX-neutral. */
export function trackWebsiteEvent(event: WebsiteClientEvent, metadata: WebsiteAnalyticsInput['metadata'], token?: string) {
  try {
    const {visitorId,sessionId}=growthIdentity(localStorage,sessionStorage);
    void recordWebsiteAnalytics({event,visitorId,sessionId,metadata},token).catch(()=>{});
  } catch { /* Disabled storage/network must not stop editing. */ }
}
