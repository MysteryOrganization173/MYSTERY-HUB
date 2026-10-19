import { MarketplaceStore } from '../db/marketplaceStore.js';
import { WebsiteStore } from '../db/websiteStore.js';
import type { PublicWebsiteSite } from '../../src/types/index.js';
import { marketplaceProductHead, PUBLIC_ORIGIN, publicPageHead, websiteSocialHead, type SocialHead } from '../../src/utils/socialMetadata.js';
import { marketplaceProductKey } from '../../src/utils/marketplaceDeepLink.js';
import { getPageFromPath } from '../../src/utils/routing.js';

export const publicMetadataReaders = {
  product: (key: string) => MarketplaceStore.getPublicProductBySlug(key, true),
  site: async (slug: string): Promise<PublicWebsiteSite | null> => {
    // The store projects the published snapshot and removes editor-only content. No writes.
    const site = await WebsiteStore.findPublishedSiteBySlug(slug);
    return site ? { id: site.id, slug: site.slug, name: site.name, template_id: site.template_id,
      content: site.content_json, settings: site.settings_json, published_at: site.published_at } : null;
  },
};
export type PublicMetadataReaders = typeof publicMetadataReaders;

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
  return { head: publicPageHead(getPageFromPath(path)), status: 200, customerSite: false };
}
