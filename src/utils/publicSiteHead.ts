import type { PublicWebsiteSite } from '../types/index.js';
import { applySocialHead, websiteSocialHead, type SocialHead } from './socialMetadata.js';

export type PublicSiteHead = SocialHead;
/** Browser and initial server HTML share one definition; request Host never determines ownership. */
export function publicSiteHead(site: PublicWebsiteSite, _origin?: string): PublicSiteHead {
  return websiteSocialHead(site);
}
export function applyPublicSiteHead(head: PublicSiteHead) {
  applySocialHead(head);
  document.head.querySelectorAll('link[rel="manifest"],script[type="application/ld+json"]').forEach(tag => tag.remove());
}
