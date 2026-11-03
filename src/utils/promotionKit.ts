import { formatGhs } from '../../shared/money.js';
import { websiteActionText, websiteContrast, readableWebsiteColor, mixWebsiteColor, normalizeWebsiteColor } from './websiteBrand.js';

/**
 * Promotion Kit V1 (Data Stores): ready-made adverts built only from what the owner has published.
 * Everything an advert says comes from verified facts: the business name, logo, colours and public link the owner
 * saved, and the bundles and prices the public storefront sells right now. Nothing here invents a discount, an
 * offer, urgency, a delivery time, a review or a sales figure. The drawing itself lives in promotionCanvas.ts.
 */
export type PromoFormat = 'story' | 'square';
export const PROMO_FORMATS: Record<PromoFormat, { width: number; height: number; label: string; hint: string }> = {
  story: { width: 1080, height: 1920, label: 'Status', hint: 'WhatsApp Status and stories · 1080 × 1920' },
  square: { width: 1080, height: 1080, label: 'Square', hint: 'Posts and chats · 1080 × 1080' },
};

export type PromoNetwork = 'mtn' | 'telecel' | 'airteltigo';
export const PROMO_NETWORKS: readonly PromoNetwork[] = ['mtn', 'telecel', 'airteltigo'];
export const promoNetworkName = (n: PromoNetwork) => n === 'mtn' ? 'MTN' : n === 'telecel' ? 'Telecel' : 'AirtelTigo';
/** The operators' own colours, as the storefront uses them. */
export const PROMO_NETWORK_COLOR: Record<PromoNetwork, string> = { mtn: '#FFCC00', telecel: '#E60000', airteltigo: '#004B93' };

/** A bundle the public storefront sells now, at the server's retail price. */
export interface PromoBundle { id: string; network: PromoNetwork; dataAmount: string; validity?: string; priceMinor: number }

/** The public storefront response, reduced to what customers can buy. Anything malformed is dropped, never guessed. */
export function promoBundlesFromStorefront(response: unknown): PromoBundle[] {
  const products = (response as { products?: unknown })?.products;
  if (!Array.isArray(products)) return [];
  return products.flatMap(raw => {
    const p = raw as Record<string, unknown>;
    const network = String(p.network || '') as PromoNetwork, priceMinor = Number(p.retailMinor);
    if (!PROMO_NETWORKS.includes(network) || typeof p.id !== 'string' || typeof p.dataAmount !== 'string' || !Number.isInteger(priceMinor) || priceMinor <= 0) return [];
    return [{ id: p.id, network, dataAmount: p.dataAmount.trim().slice(0, 12), validity: typeof p.validity === 'string' ? p.validity.slice(0, 24) : undefined, priceMinor }];
  });
}

const sizeGb = (amount: string) => { const m = /^\s*(\d+(?:\.\d+)?)\s*(GB|MB|TB)\s*$/i.exec(amount); if (!m) return Infinity; const v = Number(m[1]), u = m[2].toUpperCase(); return u === 'MB' ? v / 1024 : u === 'TB' ? v * 1024 : v; };
/** Smallest first, the owner's featured bundles leading, like the storefront. */
export function promoSortBundles(bundles: PromoBundle[], pinned: readonly string[] = []): PromoBundle[] {
  const sorted = [...bundles].sort((a, b) => sizeGb(a.dataAmount) - sizeGb(b.dataAmount) || a.priceMinor - b.priceMinor);
  return [...pinned.map(id => sorted.find(b => b.id === id)).filter((b): b is PromoBundle => !!b), ...sorted.filter(b => !pinned.includes(b.id))];
}
export const promoNetworksIn = (bundles: PromoBundle[]) => PROMO_NETWORKS.filter(n => bundles.some(b => b.network === n));
export const promoFromMinor = (bundles: PromoBundle[], network: PromoNetwork) => { const own = bundles.filter(b => b.network === network); return own.length ? Math.min(...own.map(b => b.priceMinor)) : null; };
export const promoPrice = (minor: number) => formatGhs(minor);

/** "MTN, Telecel and AirtelTigo" from the networks actually on sale. */
export function promoNetworkList(networks: PromoNetwork[]): string {
  const names = networks.map(promoNetworkName);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export interface PromoFacts {
  name: string;
  logoUrl?: string;
  url: string;
  tagline?: string;
  colors: { background: string; primary: string; accent: string };
  /** Verified bundles from the public storefront; empty when none are on sale or they could not be checked. */
  bundles: PromoBundle[];
  pinned?: string[];
}

export type PromoDesignId = 'launch' | 'bundles' | 'networks' | 'featured' | 'identity' | 'direct';
export interface PromoDesign { id: PromoDesignId; label: string; use: string; needsBundles: boolean; messages: (f: PromoFacts) => string[] }

/** Six layouts with different jobs. Messages are fixed, true statements; the owner may also write their own. */
export const PROMO_DESIGNS: readonly PromoDesign[] = [
  { id: 'launch', label: 'Store launch', use: 'Tell people your store is open', needsBundles: false, messages: () => ['Now open', 'My data store is open', 'Buy your data from me'] },
  { id: 'bundles', label: 'Price list', use: 'Your real bundles and prices for one network', needsBundles: true, messages: () => ['Data bundles for you', 'Buy data in a few taps', 'Top up your data here'] },
  { id: 'networks', label: 'Networks', use: 'Every network you sell, with its starting price', needsBundles: true, messages: f => { const list = promoNetworkList(promoNetworksIn(f.bundles)); return [`${list} data`, 'Your network, your bundle', 'Data for every phone in the house']; } },
  { id: 'featured', label: 'Featured bundle', use: 'One bundle you choose, big and clear', needsBundles: true, messages: () => ['Featured bundle', 'My pick for you', 'Get this bundle'] },
  { id: 'identity', label: 'Brand', use: 'Your name and logo, no prices', needsBundles: false, messages: f => [...(f.tagline && f.tagline.length <= 60 ? [f.tagline] : []), 'Data bundles, made simple', 'Your data store'] },
  { id: 'direct', label: 'Straight to store', use: 'Your link and how buying works', needsBundles: false, messages: () => ['Buy data in a few taps', 'Order your data here', 'Tap the link to buy'] },
];
export const promoDesign = (id: PromoDesignId) => PROMO_DESIGNS.find(d => d.id === id) || PROMO_DESIGNS[0];
/** Designs that quote bundles are offered only when the storefront has verified bundles on sale. */
export const promoDesignAvailable = (design: PromoDesign, facts: PromoFacts) => !design.needsBundles || facts.bundles.length > 0;

export const PROMO_HEADLINE_MAX = 48;
/** The owner's own headline: plain text, one line of thought, no markup. */
export const cleanPromoHeadline = (text: string) => text.replace(/[<>{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, PROMO_HEADLINE_MAX);

export type PromoTreatment = 'brand' | 'bold' | 'light';
export const PROMO_TREATMENTS: ReadonlyArray<{ id: PromoTreatment; label: string }> = [
  { id: 'brand', label: 'Your colours' }, { id: 'bold', label: 'Bold' }, { id: 'light', label: 'Light' },
];
export interface PromoPalette { bg: string; panel: string; ink: string; muted: string; accent: string; onAccent: string; line: string }
/** Every treatment keeps text readable (4.5:1) on whatever colours the owner saved. */
export function promoPalette(colors: PromoFacts['colors'], treatment: PromoTreatment): PromoPalette {
  const bg0 = normalizeWebsiteColor(colors.background, '#0b0f19'), accent0 = normalizeWebsiteColor(colors.accent, '#3b82f6'), primary0 = normalizeWebsiteColor(colors.primary, '#0f172a');
  if (treatment === 'bold') {
    const ink = websiteActionText(accent0), dark = ink === '#ffffff';
    const panel = mixWebsiteColor(accent0, dark ? '#000000' : '#ffffff', 0.18);
    const accent = dark ? '#ffffff' : '#0b0f19';
    return { bg: accent0, panel, ink, muted: readableWebsiteColor(mixWebsiteColor(ink, accent0, 0.25), [accent0]), accent, onAccent: websiteActionText(accent), line: mixWebsiteColor(ink, accent0, 0.7) };
  }
  if (treatment === 'light') {
    const bg = mixWebsiteColor('#ffffff', accent0, 0.06), ink = '#0f172a';
    const accent = readableWebsiteColor(accent0, [bg], 3);
    return { bg, panel: '#ffffff', ink, muted: '#475569', accent, onAccent: websiteActionText(accent), line: mixWebsiteColor(ink, bg, 0.85) };
  }
  const ink = readableWebsiteColor(websiteActionText(bg0), [bg0]);
  // Cards take a hint of the owner's main colour only while the text on them stays readable; otherwise a tint of the page.
  const tinted = mixWebsiteColor(primary0, bg0, 0.35), tint = mixWebsiteColor(bg0, ink, 0.07);
  const panel = websiteContrast(ink, tinted) >= 4.5 && websiteContrast(readableWebsiteColor(accent0, [bg0], 3), tinted) >= 3 ? tinted : tint;
  const accent = readableWebsiteColor(accent0, [bg0, panel], 3);
  return { bg: bg0, panel, ink, muted: readableWebsiteColor(mixWebsiteColor(ink, bg0, 0.3), [bg0, panel]), accent, onAccent: websiteActionText(accent), line: mixWebsiteColor(ink, bg0, 0.82) };
}

/** mysterybundlehub.com/sites/ama-data-hub: the link as people will type it. */
export const promoDisplayUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

export interface PromoChoice { design: PromoDesignId; format: PromoFormat; treatment: PromoTreatment; headline: string; network?: PromoNetwork; bundleId?: string }

/** The bundles a design shows, from verified facts only. */
export function promoBundlesFor(choice: PromoChoice, facts: PromoFacts): PromoBundle[] {
  const sorted = promoSortBundles(facts.bundles, facts.pinned || []);
  if (choice.design === 'featured') { const pick = sorted.find(b => b.id === choice.bundleId) || sorted[0]; return pick ? [pick] : []; }
  if (choice.design === 'bundles') { const network = choice.network && promoNetworksIn(sorted).includes(choice.network) ? choice.network : promoNetworksIn(sorted)[0]; return sorted.filter(b => b.network === network).slice(0, choice.format === 'story' ? 5 : 3); }
  return [];
}

/** A ready-to-paste caption that says only what the advert shows. */
export function promoCaption(choice: PromoChoice, facts: PromoFacts): string {
  const name = facts.name.trim() || 'my store', networks = promoNetworksIn(facts.bundles), list = promoNetworkList(networks);
  const shown = promoBundlesFor(choice, facts);
  const tail = `Buy on ${name} and pay securely: ${facts.url}`;
  switch (choice.design) {
    case 'launch': return `${name} is open! ${networks.length ? `Buy ${list} data bundles` : 'Buy data bundles'} any time on my store and pay securely: ${facts.url}`;
    case 'bundles': return shown.length ? [`${promoNetworkName(shown[0].network)} data bundles from ${name}:`, ...shown.map(b => `• ${b.dataAmount} · ${promoPrice(b.priceMinor)}`), 'Prices as shown on my store; the store always shows the current price.', tail].join('\n') : tail;
    case 'networks': return networks.length ? `${list} data bundles, all on ${name}. ${networks.map(n => `${promoNetworkName(n)} from ${promoPrice(promoFromMinor(facts.bundles, n)!)}`).join(' · ')}. ${tail}` : tail;
    case 'featured': return shown[0] ? `${shown[0].dataAmount} ${promoNetworkName(shown[0].network)} for ${promoPrice(shown[0].priceMinor)} on ${name}. The store always shows the current price. ${facts.url}` : tail;
    case 'identity': return `${name} · data bundles: ${facts.url}`;
    default: return `Need data? Open my store, choose your bundle and pay securely: ${facts.url}`;
  }
}

/** What the picture shows, for screen readers and the alt text of a shared image. */
export function promoDescription(choice: PromoChoice, facts: PromoFacts): string {
  const shown = promoBundlesFor(choice, facts);
  return [`${promoDesign(choice.design).label} advert for ${facts.name}`, choice.headline, ...shown.map(b => `${promoNetworkName(b.network)} ${b.dataAmount} ${promoPrice(b.priceMinor)}`), promoDisplayUrl(facts.url)].filter(Boolean).join('. ');
}

/** A file name people can recognise in their gallery. */
export const promoFileName = (slug: string, choice: PromoChoice) => `${(slug || 'my-store').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'my-store'}-${choice.design}-${choice.format === 'story' ? '1080x1920' : '1080x1080'}.png`;
