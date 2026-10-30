import { BUSINESS_CONFIG } from '../config/business.js';
import { WEBSITE_TEMPLATES } from '../data/templates.js';
import { DATA_RESELLER_STARTER_HERO_IMAGE, resolveDataResellerHeroImage } from './dataResellerArtwork.js';
import type { MarketplaceProduct, PublicWebsiteSite } from '../types/index.js';
import { websiteLayoutMode } from './websiteLayout.js';
import { framingRegion, isDefaultFraming, type ImageFraming } from '../../shared/marketplaceImageFraming.js';

// Canonical identity never comes from a request Host, Forwarded header or visitor query string.
export const PUBLIC_ORIGIN = `https://${BUSINESS_CONFIG.domain}`;
export interface SocialHead {
  title: string; description: string; url: string; image: string; icon?: string;
  imageAlt?: string; imageWidth?: number; imageHeight?: number; imageType?: string;
  noindex?: boolean;
}
export const clipMetadata = (value: string, max: number) => {
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

/** URL validation only. Never fetch an owner-controlled URL from the server. */
export function publicImageUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048 || /[\s<>\\]/.test(value)) return '';
  if (!value.startsWith('/') && !/^https:\/\//i.test(value)) return '';
  try {
    if (value.startsWith('//')) return '';
    const url = new URL(value, PUBLIC_ORIGIN);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') ||
        /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) return '';
    url.hash = '';
    return url.href;
  } catch { return ''; }
}

/** Only canonical, versioned Cloudinary image originals get a known-size JPEG social rendition.
 * Padding keeps the whole product/banner visible. External/already-transformed URLs stay exact.
 */
export function socialImage(value: string, padding: 'ffffff' | '0b0f12' = 'ffffff'): Pick<SocialHead, 'image' | 'imageWidth' | 'imageHeight' | 'imageType'> {
  const image = publicImageUrl(value);
  const original = image.match(/^(https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\/)(v\d+\/[^?#]+)$/);
  return original
    ? { image: `${original[1]}f_jpg,q_auto,c_pad,w_1200,h_630,b_rgb:${padding}/${original[2]}`, imageWidth: 1200, imageHeight: 630, imageType: 'image/jpeg' }
    : { image };
}

// Plain versioned Cloudinary originals whose public ID is safe to reuse as an overlay (l_a:b:c).
const COMPOSABLE_ORIGINAL = /^(https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\/)(v\d+\/([A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)\.(?:jpe?g|png|webp|avif|heic))$/i;

/**
 * Marketplace sharing image (1200x630 JPEG). The whole product photo sits as large as the
 * canvas allows (c_fit, never stretched or cropped), over an enlarged, blurred and darkened copy
 * of the same photo, so portrait shots no longer float in wide black bars. One deterministic URL
 * per photo + framing, so Cloudinary renders it once and caches it. Optional admin framing crops
 * the photo toward the subject first. Anything that is not a plain versioned Cloudinary original
 * keeps the existing behaviour (padded rendition, or the exact external URL).
 */
export function marketplaceSocialImage(value: string, framing?: ImageFraming | null): Pick<SocialHead, 'image' | 'imageWidth' | 'imageHeight' | 'imageType'> {
  const image = publicImageUrl(value);
  const original = image.match(COMPOSABLE_ORIGINAL);
  if (!original) return socialImage(image, '0b0f12');
  const [, base, path, publicId] = original;
  const region = !framing || isDefaultFraming(framing) ? null : framingRegion(framing);
  const crop = region ? `c_crop,g_north_west,h_${region.h},w_${region.w},x_${region.x},y_${region.y}/` : '';
  const transform = [
    `${crop}c_fill,h_630,w_1200`, 'e_blur:1500', 'e_brightness:-35',
    `l_${publicId.replace(/\//g, ':')}`, `${crop}c_fit,h_630,w_1200`, 'fl_layer_apply,g_center',
    // Flattens any transparency onto the brand's dark surface instead of JPEG white.
    'b_rgb:0b0f12,c_pad,h_630,w_1200', 'f_jpg', 'q_auto',
  ].join('/');
  return { image: `${base}${transform}/${path}`, imageWidth: 1200, imageHeight: 630, imageType: 'image/jpeg' };
}

const BRAND_IMAGE = BUSINESS_CONFIG.brandMarkUrl;

/** WhatsApp preview for /app: a finished 1200x630 JPEG (logo, headline, phone) stored as its own Cloudinary original.
 * It is already the exact social size, so it is served untouched instead of through socialImage()'s padded rendition.
 */
export const APP_SHARE_IMAGE = { image: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1792879753/mystery-hub/app-share/mystery-hub-app-preview-v1.jpg', imageWidth: 1200, imageHeight: 630, imageType: 'image/jpeg' } as const;

export const PUBLIC_PAGE_METADATA: Record<string, { title: string; description: string; image?: string; path: string; shareImage?: Pick<SocialHead, 'image' | 'imageWidth' | 'imageHeight' | 'imageType'>; imageAlt?: string }> = {
  home: { path: '/', title: 'Mystery Hub — Digital Services Marketplace in Ghana', description: 'Buy data and airtime in Ghana, create a free business website and track your orders. Explore Mystery Wallet, referral rewards and Marketplace enquiries.' },
  data: { path: '/data', title: 'Data & Airtime — Mystery Hub Ghana', description: 'Choose MTN, Telecel or AirtelTigo data and airtime. Review prices and recipient details, pay with Mobile Money and track your order.' },
  website: { path: '/website-builder', title: 'Website Builder for Ghanaian Businesses — Mystery Hub', description: 'Create a free business website. Choose a design, add your own details and photos, and publish a mobile-friendly site with your brand.', image: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1790789160/ChatGPT_Image_Sep_30_2026_05_25_38_PM_bbopws.png' },
  marketplace: { path: '/marketplace', title: 'Marketplace — Mystery Hub Ghana', description: 'Browse technology, digital products and services in Ghana. Check each listing for pricing, availability and checkout or enquiry options.', image: BUSINESS_CONFIG.marketplaceHeroImageUrl },
  earn: { path: '/earn', title: 'Mystery Earn — Mystery Hub', description: 'Invite people to Mystery Hub and earn rewards from qualifying purchases.' },
  afa: { path: '/afa', title: 'MTN AFA Registration — Mystery Hub', description: 'Check AFA availability, register your MTN number and track your registration. The registration fee does not include future MTN voice or data packages.' },
  services: { path: '/services', title: 'All Services — Mystery Hub Ghana', description: 'Explore Mystery Hub: Data, Airtime, Website Builder, Marketplace, AFA and Mystery Earn today, plus previews of what is coming next. ECG, water, TV renewals and results-checker services are not yet available.' },
  about: { path: '/about', title: 'About Mystery Hub — Reliable Digital Solutions for Ghana', description: 'Learn about Mystery Hub’s mission to provide honest, reliable data bundles, website building tools, and everyday digital utilities across Ghana.' },
  help: { path: '/help', title: 'Help & FAQs — Mystery Hub Ghana', description: 'Find answers about Data, Airtime, payments, order tracking, Mystery Earn, Website Builder, Wallet and support.' },
  app: { path: '/app', title: 'Install Mystery Hub | Everything Digital. One Trusted Place.', description: 'Buy data, top up airtime, track orders and create your own free business website. Get Mystery Hub on your phone.', shareImage: APP_SHARE_IMAGE, imageAlt: 'Mystery Hub on a phone: everything digital, one trusted place. Free to install, no app store needed.' },
};

export function publicPageHead(page: string): SocialHead {
  const entry = PUBLIC_PAGE_METADATA[page] || PUBLIC_PAGE_METADATA.home;
  return { title: entry.title, description: entry.description, url: `${PUBLIC_ORIGIN}${entry.path}`, ...(entry.shareImage || socialImage(entry.image || BRAND_IMAGE)), imageAlt: entry.imageAlt || entry.title, icon: publicImageUrl(BRAND_IMAGE) };
}

/** Explicit marketing-route allowlist: unknown/account/operational paths must not inherit an
 * indexable homepage. This controls metadata only; the existing SPA still handles navigation/auth.
 */
export function pageIndexingHead(pathname: string, search = ''): SocialHead {
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search);
  const preview = ['owner_preview', 'isolated_template_preview', 'preview_template_id', 'editor_channel', 'editor_site'].some(key => params.has(key));
  const aliases: Record<string, string> = { '/index.html': 'home', '/website': 'website', '/rewards': 'earn', '/referral': 'earn', '/afa-registration': 'afa', '/faq': 'help' };
  const clean = path.replace(/\/index\.html$/, '');
  const page = Object.entries(PUBLIC_PAGE_METADATA).find(([, entry]) => entry.path === clean)?.[0] || aliases[clean] || aliases[path];
  if (page && !preview) return publicPageHead(page);
  // Builder V6: an owner's editor is private; its title never echoes the website id.
  if (path.startsWith('/website-builder/edit')) return { title: 'Website Editor — Mystery Hub', description: 'Sign in where required to access your account or workspace.',
    url: `${PUBLIC_ORIGIN}/website-builder`, image: '', icon: publicImageUrl(BRAND_IMAGE), noindex: true };
  const area = path.split('/')[1];
  const titles: Record<string, string> = { admin: 'Staff & Operations Portal', wallet: 'Mystery Wallet', orders: 'Your Orders', account: 'My Account', dashboard: 'Your Dashboard', 'my-business': 'My Business', login: 'Sign In', signup: 'Create Account', register: 'Create Account', auth: 'Account Access' };
  // Never include arbitrary path components, references, editor channels or account query values.
  return { title: `${preview ? 'Website Preview' : titles[area] || 'Account & Workspace'} — Mystery Hub`, description: 'Sign in where required to access your account or workspace.',
    url: `${PUBLIC_ORIGIN}${titles[area] ? `/${area}` : '/'}`, image: '', icon: publicImageUrl(BRAND_IMAGE), noindex: true };
}

export function marketplaceProductHead(product: MarketplaceProduct): SocialHead {
  const price = product.priceMinor == null && product.priceType !== 'quote' ? 'Contact for pricing' : product.priceDisplay;
  const action = product.purchaseEnabled && product.fulfilmentMode !== 'inquiry_only' ? 'Online checkout available.' : 'Enquire for details.';
  const details = product.specs?.slice(0, 2).map(spec => `${spec.label}: ${spec.value}`).join('; ') || product.tagline || product.description;
  return {
    title: clipMetadata(product.name, 90),
    description: clipMetadata(`${price}. ${product.availabilityLabel}. ${action} ${details || ''}`, 240),
    url: `${PUBLIC_ORIGIN}/marketplace?product=${encodeURIComponent(product.slug || product.id)}`,
    // Merchandise keeps its whole photograph, filled out with a blurred copy of itself; owner sites retain their existing rendition.
    ...(publicImageUrl(product.imageUrl) ? marketplaceSocialImage(product.imageUrl!, product.imageFraming) : socialImage(BUSINESS_CONFIG.marketplaceHeroImageUrl, '0b0f12')),
    imageAlt: clipMetadata(product.imageAlt || product.name, 160), icon: publicImageUrl(BRAND_IMAGE),
  };
}

/** One browser/server definition. Input MUST be the public published-snapshot projection, never a draft.
 * Existing owners retain the renderer's legacy fallback, including QuickByte. New-site creation,
 * migration and image removal explicitly select the neutral starter (covered by V4 regressions).
 * Changing an existing owner's visible legacy artwork requires a separate owner/founder decision.
 */
export function websiteSocialHead(site: PublicWebsiteSite): SocialHead {
  const c = site.content;
  const template = WEBSITE_TEMPLATES.find(t => t.id === site.template_id);
  const name = clipMetadata(c.businessName || site.name || 'Business website', 90);
  const logo = publicImageUrl(c.logoUrl);
  const dataSite = template?.layoutType === 'reseller';
  const sectionHero = websiteLayoutMode(site.template_id, c) === 'sections'
    ? [...(c.composition?.sections || [])].sort((a,b) => a.order-b.order).find(section => section.enabled && section.type === 'hero')?.data : undefined;
  const savedHero = publicImageUrl(sectionHero?.image || c.heroImage);
  const hero = publicImageUrl(sectionHero?.image) || (dataSite ? publicImageUrl(resolveDataResellerHeroImage(c.heroImage, true)) : savedHero);
  const fallback = dataSite ? DATA_RESELLER_STARTER_HERO_IMAGE : template?.heroImage || WEBSITE_TEMPLATES.find(t => t.id === 'tmpl-legon-consult')!.heroImage!;
  return {
    title: name,
    description: clipMetadata(c.tagline || c.aboutText || `${name}${c.location ? ` in ${c.location}` : ''}: ${template?.categoryLabel || 'Business website'}.`, 160),
    url: `${PUBLIC_ORIGIN}/sites/${encodeURIComponent(site.slug)}`,
    ...socialImage(hero || logo || fallback), imageAlt: name,
    // No platform logo on independently owned business websites without an owner logo.
    icon: logo,
  };
}

/** The same canonical tags in browser navigation and the server's initial HTML. */
export function socialHeadEntries(head: SocialHead) {
  return [
    ['name', 'description', head.description], ['property', 'og:title', head.title],
    ['property', 'og:description', head.description], ['property', 'og:type', 'website'],
    ['property', 'og:url', head.url], ['property', 'og:image', head.image],
    ['property', 'og:image:alt', head.imageAlt || head.title],
    ['property', 'og:image:width', head.imageWidth ? String(head.imageWidth) : ''],
    ['property', 'og:image:height', head.imageHeight ? String(head.imageHeight) : ''],
    ['property', 'og:image:type', head.imageType || ''],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', head.title],
    ['name', 'twitter:description', head.description], ['name', 'twitter:image', head.image],
    ['name', 'robots', head.noindex ? 'noindex, nofollow' : ''],
  ] as const;
}

export function applySocialHead(head: SocialHead) {
  document.title = head.title;
  // Remove both name/property variants and all duplicates before adding a single authoritative tag.
  document.head.querySelectorAll('meta[property^="og:"],meta[name^="og:"],meta[property^="twitter:"],meta[name^="twitter:"],meta[name="description"],meta[name="robots"],link[rel="canonical"],link[rel~="icon"],link[rel="apple-touch-icon"]').forEach(tag => tag.remove());
  for (const [attr, key, value] of socialHeadEntries(head)) {
    if (!value) continue;
    const tag = document.createElement('meta'); tag.setAttribute(attr, key); tag.content = value; document.head.appendChild(tag);
  }
  const canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.href = head.url; document.head.appendChild(canonical);
  // An empty icon stays neutral rather than falling back to Mystery Hub's favicon or /favicon.ico.
  const icon = document.createElement('link'); icon.rel = 'icon'; icon.href = head.icon || 'data:,'; document.head.appendChild(icon);
}
