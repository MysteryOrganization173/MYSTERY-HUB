import type { PublicWebsiteSite } from '../types/index.js';
import { getTemplateById, mergeSiteWithTemplate } from './templateRendererUtils.js';
import { isSafeImageSource } from '../components/website/SafeImage.js';

export interface PublicSiteHead { title: string; description: string; url: string; image: string; icon: string }

const clip = (text: string, max: number) => { const t = text.replace(/\s+/g, ' ').trim(); return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t; };

/**
 * The owner's own name, words and images for the browser tab and share previews. Read-only: it uses the
 * published record exactly as saved (the Data store hero resolves the same way the page renders it).
 * Crawlers that do not run JavaScript still see the static tags in index.html until the server injects these.
 */
export function publicSiteHead(site: PublicWebsiteSite, origin: string): PublicSiteHead {
  const c = site.content || ({} as PublicWebsiteSite['content']);
  const template = getTemplateById(site.template_id);
  const merged = mergeSiteWithTemplate(template, c, site.settings);
  const name = clip(c.businessName || site.name || 'Business website', 70);
  const place = clip(c.location || '', 40);
  const description = clip(c.tagline || c.aboutText || `${name}${place ? ` in ${place}` : ''}: ${template.categoryLabel}.`, 160);
  const logo = isSafeImageSource(c.logoUrl) ? c.logoUrl! : '';
  const hero = isSafeImageSource(merged.heroImage) ? merged.heroImage! : '';
  return { title: name, description, url: `${origin.replace(/\/$/, '')}/sites/${encodeURIComponent(site.slug)}`, image: hero || logo, icon: logo };
}

export function applyPublicSiteHead(head: PublicSiteHead) {
  document.title = head.title;
  const meta = (attr: 'name' | 'property', key: string, value: string) => {
    let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!tag) { tag = document.createElement('meta'); tag.setAttribute(attr, key); document.head.appendChild(tag); }
    tag.setAttribute('content', value);
  };
  meta('name', 'description', head.description);
  meta('property', 'og:title', head.title);
  meta('property', 'og:description', head.description);
  meta('property', 'og:url', head.url);
  meta('property', 'og:type', 'website');
  if (head.image) { meta('property', 'og:image', head.image); meta('name', 'twitter:image', head.image); }
  meta('name', 'twitter:title', head.title);
  meta('name', 'twitter:description', head.description);
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.setAttribute('rel', 'canonical'); document.head.appendChild(canonical); }
  canonical.setAttribute('href', head.url);
  if (head.icon) document.head.querySelectorAll('link[rel~="icon"]').forEach(link => link.setAttribute('href', head.icon));
}
