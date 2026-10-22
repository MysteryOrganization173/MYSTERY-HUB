/**
 * Marketplace V2 browsing model.
 * Pure helpers for category discovery, truthful sorting/filtering and URL state.
 * Everything here derives from the authoritative public product/category data;
 * nothing invents stock, ratings, discounts or delivery promises.
 */
import type { MarketplaceProduct } from '../types';
import { marketplaceOptionPrice, purchasableOptions } from '../../shared/marketplaceVariants';

export type MarketplaceSort = 'recommended' | 'newest' | 'price_asc' | 'price_desc' | 'name';
export type MarketplaceKindFilter = 'physical' | 'digital' | 'service';
export type MarketplacePriceBand = 'under_500' | '500_2000' | '2000_5000' | 'over_5000';

export interface MarketplaceBrowseState {
  category: string; // 'all' or an admin category slug
  q: string;
  sort: MarketplaceSort;
  buyOnline: boolean;
  kind: MarketplaceKindFilter | '';
  price: MarketplacePriceBand | '';
  brand: string; // '' | a brand id (see productBrandInfo) | 'other'
}

export const DEFAULT_BROWSE_STATE: MarketplaceBrowseState = { category: 'all', q: '', sort: 'recommended', buyOnline: false, kind: '', price: '', brand: '' };

export const SORT_OPTIONS: { id: MarketplaceSort; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'newest', label: 'Newest first' },
  { id: 'price_asc', label: 'Price: low to high' },
  { id: 'price_desc', label: 'Price: high to low' },
  { id: 'name', label: 'Name: A to Z' },
];

export const KIND_LABELS: Record<MarketplaceKindFilter, string> = { physical: 'Physical items', digital: 'Digital & software', service: 'Services' };

// Bounds are in pesewas (minor units), matching the authoritative price fields.
export const PRICE_BANDS: { id: MarketplacePriceBand; label: string; min: number; max: number }[] = [
  { id: 'under_500', label: 'Under GH₵500', min: 0, max: 50000 },
  { id: '500_2000', label: 'GH₵500 – 2,000', min: 50000, max: 200000 },
  { id: '2000_5000', label: 'GH₵2,000 – 5,000', min: 200000, max: 500000 },
  { id: 'over_5000', label: 'Over GH₵5,000', min: 500000, max: Number.POSITIVE_INFINITY },
];

const SORT_IDS = new Set(SORT_OPTIONS.map(o => o.id));
const KIND_IDS = new Set(Object.keys(KIND_LABELS));
const BAND_IDS = new Set(PRICE_BANDS.map(b => b.id));
const SLUG = /^[a-z][a-z0-9_]{1,63}$/;

/* ---------------- Brands (structured spec first, then product names) ---------------- */

/**
 * Brands a Ghanaian electronics shopper looks for, matched as whole words in the
 * product name (model lines count, e.g. "EliteBook" is HP). Nothing is assumed when a
 * name names no brand.
 */
export const BRANDS: { id: string; label: string; pattern: RegExp }[] = [
  { id: 'apple', label: 'Apple', pattern: /\b(apple|mac ?book|imac|iphone|ipad|airpods)\b/i },
  { id: 'hp', label: 'HP', pattern: /\b(hp|hewlett[- ]packard|elitebook|probook|zbook|pavilion|spectre|omen)\b/i },
  { id: 'dell', label: 'Dell', pattern: /\b(dell|latitude|inspiron|xps|vostro|alienware)\b/i },
  { id: 'lenovo', label: 'Lenovo', pattern: /\b(lenovo|thinkpad|ideapad|thinkbook|legion)\b/i },
  { id: 'asus', label: 'Asus', pattern: /\b(asus|zenbook|vivobook)\b/i },
  { id: 'acer', label: 'Acer', pattern: /\b(acer|aspire|predator)\b/i },
  { id: 'microsoft', label: 'Microsoft', pattern: /\b(microsoft|surface (?:pro|laptop|go|book))\b/i },
  { id: 'samsung', label: 'Samsung', pattern: /\b(samsung|galaxy)\b/i },
  { id: 'toshiba', label: 'Toshiba', pattern: /\b(toshiba|dynabook)\b/i },
  { id: 'huawei', label: 'Huawei', pattern: /\b(huawei|matebook)\b/i },
  { id: 'msi', label: 'MSI', pattern: /\bmsi\b/i },
  { id: 'infinix', label: 'Infinix', pattern: /\binfinix\b/i },
  { id: 'tecno', label: 'Tecno', pattern: /\btecno\b/i },
  { id: 'xiaomi', label: 'Xiaomi', pattern: /\b(xiaomi|redmi)\b/i },
];
/** Groups products whose brand is unknown, so a category's brand tiles always add up to its total. */
export const OTHER_BRAND = 'other';
const BRAND_SLUG = /^[a-z0-9][a-z0-9-]{0,31}$/;
const BRAND_SPEC = /^(brand|make|manufacturer)$/i;

type BrandSource = Pick<MarketplaceProduct, 'name'> & Partial<Pick<MarketplaceProduct, 'specs' | 'productKind' | 'category' | 'categoryLabel'>>;

/**
 * Name-based guesses only run on physical goods outside software/digital departments:
 * there "Microsoft 365" or "Apple Music" name a publisher, not a brand to shop hardware by.
 */
export function brandInferenceAllowed(product: BrandSource): boolean {
  if ((product.productKind || 'physical') !== 'physical') return false;
  if (!product.category) return true;
  const key = categoryIconKey(product.category, product.categoryLabel || '');
  return key !== 'software' && key !== 'digital';
}

const brandCache = new WeakMap<object, { id: string; label: string } | null>();

/**
 * The product's brand: an admin "Brand"/"Make"/"Manufacturer" specification wins (known brands
 * keep their canonical name, others become their own tile); otherwise the brand its name names
 * first. Published records are never rewritten to make this work.
 */
export function productBrandInfo(product: BrandSource): { id: string; label: string } | null {
  const cached = brandCache.get(product);
  if (cached !== undefined) return cached;
  let found: { id: string; label: string } | null = null;
  const declared = (product.specs || []).find(s => BRAND_SPEC.test((s?.label || '').trim()))?.value?.trim();
  if (declared && declared.length <= 40) {
    const known = BRANDS.find(b => b.label.toLowerCase() === declared.toLowerCase()) || BRANDS.find(b => b.pattern.test(declared));
    const id = declared.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
    if (known) found = { id: known.id, label: known.label };
    else if (BRAND_SLUG.test(id) && id !== OTHER_BRAND) found = { id, label: declared };
  }
  if (!found && brandInferenceAllowed(product)) {
    let best: { id: string; label: string; at: number } | null = null;
    for (const brand of BRANDS) {
      const at = product.name.search(brand.pattern);
      if (at >= 0 && (!best || at < best.at)) best = { id: brand.id, label: brand.label, at };
    }
    if (best) found = { id: best.id, label: best.label };
  }
  brandCache.set(product, found);
  return found;
}

/** The brand id a product belongs to, or null. */
export function productBrand(product: BrandSource): string | null {
  return productBrandInfo(product)?.id ?? null;
}

const matchesBrand = (product: MarketplaceProduct, brand: string) =>
  brand === OTHER_BRAND ? !productBrandInfo(product) : productBrand(product) === brand;

export interface BrandSummary { id: string; label: string; count: number; imageUrl?: string; imageFraming?: MarketplaceProduct['imageFraming'] }

const brandCover = (items: MarketplaceProduct[]) => items.find(p => p.featured && p.imageUrl && p.availability !== 'coming_soon') || items.find(p => p.imageUrl && p.availability !== 'coming_soon') || items.find(p => p.imageUrl);

/** Brand tiles with exact counts and a real photo from that brand, most stocked first. */
export function summariseBrands(products: MarketplaceProduct[]): BrandSummary[] {
  const groups = new Map<string, { label: string; items: MarketplaceProduct[] }>();
  for (const p of products) {
    const brand = productBrandInfo(p);
    if (!brand) continue;
    const group = groups.get(brand.id) || { label: brand.label, items: [] };
    group.items.push(p);
    groups.set(brand.id, group);
  }
  return [...groups.entries()].map(([id, { label, items }]) => {
    const cover = brandCover(items);
    return { id, label, count: items.length, imageUrl: cover?.imageUrl, imageFraming: cover?.imageFraming };
  }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * The brand row for one department (or the whole catalogue), or null when brands would not
 * help: fewer than two real brands means there is nothing to choose between. Unbranded items
 * get an "Other" tile so the counts always add up to the department total.
 */
export function brandLayer(products: MarketplaceProduct[], category: string): BrandSummary[] | null {
  const scope = category === 'all' ? products : products.filter(p => p.category === category);
  const brands = summariseBrands(scope);
  if (brands.length < 2) return null;
  const unbranded = scope.filter(p => !productBrandInfo(p));
  if (!unbranded.length) return brands;
  const cover = brandCover(unbranded);
  return [...brands, { id: OTHER_BRAND, label: 'Other brands', count: unbranded.length, imageUrl: cover?.imageUrl, imageFraming: cover?.imageFraming }];
}

/**
 * Which department's brands the landing view ("All products") offers. Only a catalogue with one
 * department leads with brands, because there the brands are the only way to narrow it. With
 * several departments the landing view is the whole catalogue: brands belong to the department
 * the customer chooses, so a laptop gallery never sits over phones or digital products.
 */
export function landingBrandCategory(products: MarketplaceProduct[], categories: CategorySummary[]): string | null {
  if (categories.length >= 2) return null;
  return brandLayer(products, 'all') ? (categories[0]?.slug ?? 'all') : null;
}

export const brandLabel = (id: string, products: MarketplaceProduct[] = []) =>
  id === OTHER_BRAND ? 'Other brands' : BRANDS.find(b => b.id === id)?.label || products.map(p => productBrandInfo(p)).find(b => b?.id === id)?.label || id;

/**
 * Department change: a brand survives only when the new department still has products from it
 * (Dell laptops → Dell monitors), so a stale brand can never empty or skew the results.
 */
export function selectDepartment(state: MarketplaceBrowseState, category: string, products: MarketplaceProduct[]): MarketplaceBrowseState {
  const keep = state.brand && state.brand !== OTHER_BRAND && products.some(p => (category === 'all' || p.category === category) && matchesBrand(p, state.brand));
  return { ...state, category, brand: keep ? state.brand : '' };
}

/** Reads browse state from a query string, ignoring anything malformed. */
export function parseBrowseState(search: string): MarketplaceBrowseState {
  const params = new URLSearchParams(search);
  const category = (params.get('category') || '').trim().toLowerCase();
  const sort = params.get('sort') as MarketplaceSort;
  const kind = params.get('type') as MarketplaceKindFilter;
  const price = params.get('price') as MarketplacePriceBand;
  return {
    category: SLUG.test(category) ? category : 'all',
    q: (params.get('q') || '').slice(0, 80),
    sort: SORT_IDS.has(sort) ? sort : 'recommended',
    buyOnline: params.get('buy') === '1',
    kind: KIND_IDS.has(kind) ? kind : '',
    price: BAND_IDS.has(price) ? price : '',
    brand: BRAND_SLUG.test((params.get('brand') || '').toLowerCase()) ? params.get('brand')!.toLowerCase() : '',
  };
}

/** Writes browse state into a query string, keeping unrelated params (product, ref, utm…). */
export function serializeBrowseState(state: MarketplaceBrowseState, currentSearch = ''): string {
  const params = new URLSearchParams(currentSearch);
  const set = (key: string, value: string | false) => { if (value) params.set(key, value); else params.delete(key); };
  set('category', state.category !== 'all' && state.category);
  set('q', state.q.trim());
  set('sort', state.sort !== 'recommended' && state.sort);
  set('buy', state.buyOnline && '1');
  set('type', state.kind);
  set('price', state.price);
  set('brand', state.brand);
  const out = params.toString();
  return out ? `?${out}` : '';
}

export function marketplaceHref(params: { category?: string; brand?: string; q?: string; product?: string } = {}): string {
  const query = new URLSearchParams();
  if (params.category && params.category !== 'all') query.set('category', params.category);
  if (params.brand) query.set('brand', params.brand);
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.product) query.set('product', params.product);
  const qs = query.toString();
  return `/marketplace${qs ? `?${qs}` : ''}`;
}

/* ---------------- Product facts ---------------- */

export type MarketplacePath = 'buy' | 'enquire' | 'coming_soon';

/** Same rule the detail sheet uses to decide whether direct checkout is offered. */
export function isDirectPurchaseSupported(product: MarketplaceProduct): boolean {
  const options = purchasableOptions(product.variants);
  return product.purchaseEnabled !== false && product.priceType !== 'quote' && product.availability !== 'coming_soon'
    && (!(product.variants?.length) || options.length > 0) && (product.fulfilmentMode || 'both') !== 'inquiry_only';
}

export function productPath(product: MarketplaceProduct): MarketplacePath {
  if (product.availability === 'coming_soon') return 'coming_soon';
  return isDirectPurchaseSupported(product) ? 'buy' : 'enquire';
}

export const PATH_LABELS: Record<MarketplacePath, string> = { buy: 'Buy online', enquire: 'Enquire to order', coming_soon: 'Coming soon' };

/** Lowest authoritative price in pesewas, or null for quote-only / unpriced items. */
export function productPriceMinor(product: MarketplaceProduct): number | null {
  if (product.priceType === 'quote') return null;
  const base = Number.isSafeInteger(product.priceMinor) && (product.priceMinor as number) > 0 ? product.priceMinor as number : null;
  return marketplaceOptionPrice(base, product.variants || []);
}

export function productPriceText(product: MarketplaceProduct): string {
  if (product.priceType === 'quote') return 'Price on request';
  return product.priceDisplay;
}

export function productKind(product: MarketplaceProduct): MarketplaceKindFilter {
  return product.productKind || 'physical';
}

/** Short, truthful fulfilment hint for cards, based only on configured data. */
export function fulfilmentHint(product: MarketplaceProduct): string | null {
  const mode = product.fulfilmentMode || 'both';
  if (mode === 'inquiry_only') return null;
  if (mode === 'digital_delivery') return 'Digital delivery';
  if (mode === 'manual_activation') return 'Set up by our team';
  if (productKind(product) !== 'physical') return null;
  const cities = [...new Set((product.pickupLocations || []).filter(l => l.active !== false && l.city).map(l => l.city.trim()))];
  const pickup = mode !== 'delivery' && cities.length > 0;
  const delivery = mode !== 'pickup' && product.deliveryAvailable !== false;
  const pickupText = pickup ? `Pickup in ${cities[0]}${cities.length > 1 ? ` +${cities.length - 1}` : ''}` : '';
  if (pickup && delivery) return `${pickupText} or delivery`;
  if (pickup) return pickupText;
  if (delivery) return 'Delivery available';
  return null;
}

/** One line of real specification text for a card (admin specs first, then highlights). */
export function cardSpecLine(product: MarketplaceProduct): string | null {
  const specs = (product.specs || []).map(s => s.value?.trim()).filter(Boolean).slice(0, 2);
  if (specs.length) return specs.join(' · ');
  const highlight = (product.highlights || []).find(h => h && h.trim());
  return highlight ? highlight.trim() : (product.tagline?.trim() || null);
}

export function referralRewardGhc(product: MarketplaceProduct): number | null {
  const eligible = product.published !== false && !product.archived && product.availability !== 'coming_soon'
    && typeof product.referralRewardGhc === 'number' && product.referralRewardGhc > 0;
  return eligible ? product.referralRewardGhc as number : null;
}

/* ---------------- Search, filter, sort ---------------- */

const normalise = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

export function matchesSearch(product: MarketplaceProduct, query: string): boolean {
  const terms = normalise(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalise([
    product.name, product.tagline, product.description, product.categoryLabel, product.badge,
    ...(product.highlights || []), ...(product.specs || []).flatMap(s => [s.label, s.value]),
    ...(product.variants || []).filter(v => v.active !== false).map(v => v.name),
  ].filter(Boolean).join(' '));
  return terms.every(term => haystack.includes(term));
}

function inBand(product: MarketplaceProduct, bandId: MarketplacePriceBand): boolean {
  const band = PRICE_BANDS.find(b => b.id === bandId);
  const price = productPriceMinor(product);
  return !!band && price !== null && price >= band.min && price < band.max;
}

/** Applies every active refinement except the ones named in `skip` (used for live counts). */
export function applyRefinements(products: MarketplaceProduct[], state: MarketplaceBrowseState, skip: Array<'category' | 'q' | 'buy' | 'kind' | 'price' | 'brand'> = []): MarketplaceProduct[] {
  return products.filter(p =>
    (skip.includes('category') || state.category === 'all' || p.category === state.category)
    && (skip.includes('brand') || !state.brand || matchesBrand(p, state.brand))
    && (skip.includes('q') || matchesSearch(p, state.q))
    && (skip.includes('buy') || !state.buyOnline || productPath(p) === 'buy')
    && (skip.includes('kind') || !state.kind || productKind(p) === state.kind)
    && (skip.includes('price') || !state.price || inBand(p, state.price)));
}

const time = (value?: string) => { const t = value ? Date.parse(value) : NaN; return Number.isFinite(t) ? t : 0; };

/**
 * Sorts a copy of the list. "Recommended" keeps the server's curated order
 * (featured, then the admin's sort position, then newest). Price sorts always
 * place price-on-request items last so they never pose as the cheapest item.
 */
export function sortProducts(products: MarketplaceProduct[], sort: MarketplaceSort): MarketplaceProduct[] {
  const indexed = products.map((p, i) => ({ p, i }));
  const byPrice = (dir: 1 | -1) => (a: { p: MarketplaceProduct; i: number }, b: { p: MarketplaceProduct; i: number }) => {
    const pa = productPriceMinor(a.p); const pb = productPriceMinor(b.p);
    if (pa === null && pb === null) return a.i - b.i;
    if (pa === null) return 1;
    if (pb === null) return -1;
    return (pa - pb) * dir || a.i - b.i;
  };
  const comparators: Record<MarketplaceSort, (a: { p: MarketplaceProduct; i: number }, b: { p: MarketplaceProduct; i: number }) => number> = {
    recommended: (a, b) => a.i - b.i,
    newest: (a, b) => time(b.p.createdAt) - time(a.p.createdAt) || a.i - b.i,
    price_asc: byPrice(1),
    price_desc: byPrice(-1),
    name: (a, b) => a.p.name.localeCompare(b.p.name, 'en', { sensitivity: 'base', numeric: true }) || a.i - b.i,
  };
  return indexed.sort(comparators[sort]).map(x => x.p);
}

export function activeRefinementCount(state: MarketplaceBrowseState): number {
  return Number(state.buyOnline) + Number(!!state.kind) + Number(!!state.price);
}

/* ---------------- Categories ---------------- */

export interface CategoryInput { slug: string; label: string; active?: boolean; sort_order?: number }
export interface CategorySummary { slug: string; label: string; count: number; imageUrl?: string; imageAlt?: string; imageFraming?: MarketplaceProduct['imageFraming']; iconKey: CategoryIconKey }
export type CategoryIconKey = 'laptop' | 'phone' | 'audio' | 'camera' | 'software' | 'printer' | 'digital' | 'home' | 'game' | 'box';

const ICON_RULES: [CategoryIconKey, RegExp][] = [
  ['laptop', /laptop|computer|desktop|pc\b|workstation|monitor/],
  ['phone', /phone|mobile|tablet|charger|accessor/],
  ['audio', /creator|audio|mic|sound|speaker|headphone|media/],
  ['camera', /camera|photo|video|light/],
  ['printer', /printer|pos\b|hardware|retail|essential|scanner/],
  ['software', /software|ai\b|productivity|app|saas|tool/],
  ['digital', /digital|domain|hosting|cloud|subscription|licen/],
  ['home', /home|appliance|kitchen|furniture/],
  ['game', /gam|console/],
];

/** Picks a recognisable icon from the admin's own slug/label, for tiles without photography. */
export function categoryIconKey(slug: string, label: string): CategoryIconKey {
  const text = `${slug.replace(/_/g, ' ')} ${label}`.toLowerCase();
  return ICON_RULES.find(([, re]) => re.test(text))?.[0] || 'box';
}

/**
 * Builds category tiles from admin categories plus live counts. Tile imagery is a
 * real product photo from that category (featured first), never stock artwork.
 * Categories with no published products are left out of the tile row; a deep link
 * to one still resolves (see `categoryLabel`).
 */
export function summariseCategories(categories: CategoryInput[], products: MarketplaceProduct[]): CategorySummary[] {
  const known = new Map<string, CategoryInput>();
  [...categories].filter(c => c.active !== false && c.slug !== 'all')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label))
    .forEach(c => known.set(c.slug, c));
  // Products whose category is not in the list (e.g. category API unavailable) still get a tile.
  products.forEach(p => { if (p.category && p.category !== 'all' && !known.has(p.category)) known.set(p.category, { slug: p.category, label: p.categoryLabel || p.category }); });
  return [...known.values()].map(c => {
    const items = products.filter(p => p.category === c.slug);
    const withImage = items.filter(p => typeof p.imageUrl === 'string' && /^https?:\/\//.test(p.imageUrl));
    const cover = withImage.find(p => p.featured && p.availability !== 'coming_soon') || withImage.find(p => p.availability !== 'coming_soon') || withImage[0];
    return { slug: c.slug, label: c.label, count: items.length, imageUrl: cover?.imageUrl, imageAlt: cover ? (cover.imageAlt || cover.name) : undefined, imageFraming: cover?.imageFraming, iconKey: categoryIconKey(c.slug, c.label) };
  }).filter(c => c.count > 0);
}

export function categoryLabel(slug: string, categories: CategoryInput[], products: MarketplaceProduct[]): string {
  if (slug === 'all') return 'All products';
  return categories.find(c => c.slug === slug)?.label || products.find(p => p.category === slug)?.categoryLabel || slug.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
}

/**
 * Opens the Marketplace at a category, search or product from elsewhere in the app
 * (homepage shortcuts, navbar search) instead of dropping customers on the full feed.
 */
export function openMarketplaceAt(setActivePage: (page: 'marketplace') => void, params: { category?: string; q?: string; product?: string }) {
  setActivePage('marketplace');
  if (typeof window !== 'undefined') window.history.replaceState({ page: 'marketplace' }, '', marketplaceHref(params));
}
