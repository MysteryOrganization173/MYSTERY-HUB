import {ExperienceService} from './experienceService.js';
import {APP_SHARE_IMAGE} from '../../src/utils/socialMetadata.js';
import { MarketplaceStore } from '../db/marketplaceStore.js';
import { WebsiteStore } from '../db/websiteStore.js';
import type { PublicWebsiteSite } from '../../src/types/index.js';
import { marketplaceProductHead, PUBLIC_ORIGIN, publicPageHead, pageIndexingHead, websiteSocialHead, type SocialHead } from '../../src/utils/socialMetadata.js';
import { marketplaceProductKey } from '../../src/utils/marketplaceDeepLink.js';

export const publicMetadataReaders = {
  greeting: (share: string) => ExperienceService.exists(share),
  product: (key: string) => MarketplaceStore.getPublicProductBySlug(key, true),
  site: async (slug: string): Promise<PublicWebsiteSite | null> => {
    // The store projects the published snapshot and removes editor-only content. No writes.
    const site = await WebsiteStore.findPublishedSiteBySlug(slug);
    return site ? { id: site.id, slug: site.slug, name: site.name, template_id: site.template_id,
      content: site.content_json, settings: site.settings_json, published_at: site.published_at } : null;
  },
};
export type PublicMetadataReaders = Omit<typeof publicMetadataReaders,'greeting'> & {greeting?: (share:string)=>Promise<boolean>};

const unavailableHead = (kind: 'product' | 'website'): SocialHead => ({
  ...publicPageHead(kind === 'product' ? 'marketplace' : 'website'),
  title: kind === 'product' ? 'Product unavailable — Mystery Hub' : 'Website unavailable',
  description: kind === 'product' ? 'This product is not currently available. Browse the Marketplace for current listings.' : 'This website is not currently published or could not be found.',
  ...(kind === 'website' ? { image: '', icon: '', imageWidth: undefined, imageHeight: undefined, imageType: undefined } : {}),
  noindex: true,
});

export async function resolvePublicSocialMetadata(requestTarget: string, readers: PublicMetadataReaders = publicMetadataReaders): Promise<{ head: SocialHead; status: number; customerSite: boolean }> {
  if (requestTarget.length > 4096 || !requestTarget.startsWith('/') || requestTarget.startsWith('//') || /[\\\u0000-\u001f]/.test(requestTarget)) throw new Error('Invalid public path');
  const url = new URL(requestTarget, PUBLIC_ORIGIN);
  const path = url.pathname;
  if (/^\/g(?:\/|$)/i.test(path)) {
    const match=path.match(/^\/g\/([A-Za-z0-9_-]{24})\/?$/);
    const found=match&&readers.greeting?await readers.greeting(match[1]):false;
    const head:SocialHead={title:found?'🎁 A special surprise is waiting for you.':'Greeting unavailable — Mystery Hub',description:found?'Open a little surprise, shared with you through Mystery Greetings.':'This greeting is not available.',url:match?`${PUBLIC_ORIGIN}/g/${match[1]}`:`${PUBLIC_ORIGIN}/g`,...(found?APP_SHARE_IMAGE:{image:''}),imageAlt:found?'Mystery Hub — a shared digital surprise':undefined,noindex:true};
    return {head,status:found?200:404,customerSite:false};
  }
  // Preview query URLs render isolated editor frames, never a public owner/product landing page.
  if (['owner_preview', 'isolated_template_preview', 'preview_template_id', 'editor_channel', 'editor_site'].some(key => url.searchParams.has(key))) {
    return { head: pageIndexingHead(path, url.search), status: 200, customerSite: false };
  }
  if (/^\/sites(?:\/|$)/i.test(path)) {
    const match = path.match(/^\/sites\/([a-z0-9][a-z0-9-]{0,99})\/?$/i);
    const site = match ? await readers.site(match[1].toLowerCase()) : null;
    return { head: site ? websiteSocialHead(site) : unavailableHead('website'), status: site ? 200 : 404, customerSite: true };
  }
  if (/^\/marketplace(?:\/|$)/i.test(path)) {
    const key = marketplaceProductKey(path, url.search);
    if (key) {
      const product = /^[a-z0-9][a-z0-9_-]{0,127}$/.test(key) ? await readers.product(key) : null;
      return { head: product ? marketplaceProductHead(product) : unavailableHead('product'), status: product ? 200 : 404, customerSite: false };
    }
  }
  return { head: pageIndexingHead(path, url.search), status: 200, customerSite: false };
}
