import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import type { MarketplaceProduct } from '../../../src/types/index.js';
import {
  DEFAULT_BROWSE_STATE, applyRefinements, cardSpecLine, categoryIconKey, categoryLabel, fulfilmentHint, isDirectPurchaseSupported,
  marketplaceHref, matchesSearch, openMarketplaceAt, parseBrowseState, productPath, productPriceMinor, productPriceText,
  referralRewardGhc, serializeBrowseState, sortProducts, summariseCategories, summariseBrands, productBrand, brandLayer, landingBrandCategory,
} from '../../../src/utils/marketplaceBrowse.js';
import { categoryMismatches } from '../../../src/utils/marketplaceCategoryCheck.js';
import { photoTreatment, COVER_TOLERANCE } from '../../../src/components/marketplace/MarketplaceMedia.js';
import { MarketplaceProductCard } from '../../../src/components/marketplace/MarketplaceProductCard.js';
import { MarketplaceCategoryTiles } from '../../../src/components/marketplace/MarketplaceCategoryTiles.js';
import { refineAvailability } from '../../../src/components/marketplace/MarketplaceRefineSheet.js';
import { MarketplaceProductDetailModal } from '../../../src/components/marketplace/MarketplaceProductDetailModal.js';

// Isolated fixtures only: no live products, prices or customers.
let seq = 0;
const product = (extra: Partial<MarketplaceProduct> = {}): MarketplaceProduct => {
  seq++;
  return {
    id: `mp_v2_${seq}`, slug: `fixture-${seq}`, name: `Fixture ${seq}`, category: 'laptops_computers', categoryLabel: 'Laptops & Computers',
    tagline: '', description: 'Fixture description', priceDisplay: 'GH₵1,000', priceType: 'fixed', priceMinor: 100000, priceGhc: 1000,
    availability: 'available', availabilityLabel: 'Available', highlights: [], productKind: 'physical', fulfilmentMode: 'both',
    purchaseEnabled: true, deliveryAvailable: true, pickupLocations: [], variants: [], createdAt: '2026-01-01T00:00:00Z', ...extra,
  };
};
const variants = [
  { id: 'small', name: '8GB / 256GB', priceMinor: 360000, priceGhc: 3600, active: true },
  { id: 'large', name: '16GB / 512GB', priceMinor: 410000, priceGhc: 4100, active: true },
];
const cats = [
  { slug: 'laptops_computers', label: 'Laptops & Computers', active: true, sort_order: 0 },
  { slug: 'phones_accessories', label: 'Phones & Accessories', active: true, sort_order: 1 },
  { slug: 'smart_home', label: 'Smart Home', active: true, sort_order: 2 },
  { slug: 'retired', label: 'Retired', active: false, sort_order: 3 },
];
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const card = (p: MarketplaceProduct) => html(React.createElement(MarketplaceProductCard, { product: p, onOpen: () => {}, onShareEarn: () => {}, formatGhc: n => String(n) }));

test('browse state round-trips through the URL and keeps unrelated params', () => {
  const state = { ...DEFAULT_BROWSE_STATE, category: 'phones_accessories', q: 'gan charger', sort: 'price_asc' as const, buyOnline: true, kind: 'physical' as const, price: 'under_500' as const };
  const qs = serializeBrowseState(state, '?product=abc&ref=CODE');
  assert.deepEqual(parseBrowseState(qs), state);
  assert.ok(qs.includes('product=abc') && qs.includes('ref=CODE'));
  assert.equal(serializeBrowseState(DEFAULT_BROWSE_STATE, '?category=x&sort=name'), '');
});

test('malformed URL values fall back safely', () => {
  const s = parseBrowseState('?category=<script>&sort=cheapest&type=weapon&price=free&buy=yes');
  assert.deepEqual(s, DEFAULT_BROWSE_STATE);
  assert.equal(parseBrowseState('?q=' + 'a'.repeat(500)).q.length, 80);
});

test('marketplace hrefs encode categories, search and product links', () => {
  assert.equal(marketplaceHref(), '/marketplace');
  assert.equal(marketplaceHref({ category: 'laptops_computers' }), '/marketplace?category=laptops_computers');
  assert.equal(marketplaceHref({ category: 'all', q: ' dell ' }), '/marketplace?q=dell');
  assert.equal(marketplaceHref({ product: 'a & b' }), '/marketplace?product=a+%26+b');
});

test('homepage deep link replaces the pushed entry with the category URL', () => {
  const calls: unknown[][] = []; const pages: string[] = [];
  const g = globalThis as unknown as { window?: unknown };
  const before = g.window;
  g.window = { history: { replaceState: (...args: unknown[]) => calls.push(args) } };
  try { openMarketplaceAt(p => pages.push(p), { category: 'laptops_computers' }); } finally { g.window = before; }
  assert.deepEqual(pages, ['marketplace']);
  assert.equal(calls[0][2], '/marketplace?category=laptops_computers');
});

test('direct purchase rule: quote, inquiry-only, coming soon and dead variants are enquiry paths', () => {
  assert.equal(productPath(product()), 'buy');
  assert.equal(productPath(product({ priceType: 'quote', priceMinor: null })), 'enquire');
  assert.equal(productPath(product({ fulfilmentMode: 'inquiry_only' })), 'enquire');
  assert.equal(productPath(product({ purchaseEnabled: false })), 'enquire');
  assert.equal(productPath(product({ variants: variants.map(v => ({ ...v, active: false })) })), 'enquire');
  assert.equal(productPath(product({ availability: 'coming_soon' })), 'coming_soon');
  assert.equal(isDirectPurchaseSupported(product({ variants })), true);
});

test('detail sheet and card agree on enquiry-only products', () => {
  const p = product({ productKind: 'service', fulfilmentMode: 'inquiry_only', pickupLocations: [] });
  const detail = html(React.createElement(MarketplaceProductDetailModal, { product: p, onClose: () => {}, onBuyNow: () => {}, onInquire: () => {}, onShare: () => {}, onShareLink: () => {}, formatGhcReward: n => String(n ?? 0) }));
  assert.ok(!detail.includes('Buy Now ('));
  assert.ok(detail.includes('Order by enquiry'));
  assert.ok(detail.includes('No payment is taken'));
  assert.ok(detail.includes('Share product'));
  assert.ok(!detail.includes('Sourced on Request'));
  assert.ok(card(p).includes('Enquire to order'));
});

test('detail sheet shows buy-online guidance and keeps option price authority', () => {
  const p = product({ variants, priceType: 'starting_at', priceDisplay: 'From GH₵3,600' });
  const detail = html(React.createElement(MarketplaceProductDetailModal, { product: p, initialVariantId: 'large', onClose: () => {}, onBuyNow: () => {}, onInquire: () => {}, onShare: () => {}, formatGhcReward: n => String(n ?? 0) }));
  assert.ok(detail.includes('Available to buy online'));
  assert.ok(detail.includes('Buy Now (GH₵4,100)'));
  assert.ok(!detail.includes('Share product'), 'plain share only renders when the page provides it');
});

test('prices: variants use the lowest active option, quote items have no sortable price', () => {
  assert.equal(productPriceMinor(product({ variants: [...variants, { id: 'off', name: 'Off', priceMinor: 1000, priceGhc: 10, active: false }] })), 360000);
  assert.equal(productPriceMinor(product({ priceType: 'quote', priceMinor: null })), null);
  assert.equal(productPriceText(product({ priceType: 'quote', priceDisplay: 'Request Quote' })), 'Price on request');
  assert.equal(productPriceText(product({ priceDisplay: 'From GH₵3,600', priceType: 'starting_at' })), 'From GH₵3,600');
});

test('sorting is truthful: quote-only items never pose as cheapest or dearest', () => {
  const quote = product({ name: 'Quote', priceType: 'quote', priceMinor: null });
  const cheap = product({ name: 'Cheap', priceMinor: 18000, createdAt: '2026-03-01T00:00:00Z' });
  const dear = product({ name: 'Dear', priceMinor: 520000, createdAt: '2026-02-01T00:00:00Z' });
  const ranged = product({ name: 'Ranged', priceType: 'starting_at', priceMinor: 360000, variants, createdAt: '2026-04-01T00:00:00Z' });
  const list = [quote, dear, ranged, cheap];
  assert.deepEqual(sortProducts(list, 'price_asc').map(p => p.name), ['Cheap', 'Ranged', 'Dear', 'Quote']);
  assert.deepEqual(sortProducts(list, 'price_desc').map(p => p.name), ['Dear', 'Ranged', 'Cheap', 'Quote']);
  assert.deepEqual(sortProducts(list, 'newest').map(p => p.name), ['Ranged', 'Cheap', 'Dear', 'Quote']);
  assert.deepEqual(sortProducts(list, 'name').map(p => p.name), ['Cheap', 'Dear', 'Quote', 'Ranged']);
  assert.deepEqual(sortProducts(list, 'recommended'), list, 'recommended keeps the server curated order');
  assert.deepEqual(list.map(p => p.name), ['Quote', 'Dear', 'Ranged', 'Cheap'], 'sorting never mutates input');
});

test('search matches names, specs and options across words; non-matching search is empty', () => {
  const laptop = product({ name: 'Business Laptop', specs: [{ label: 'Processor', value: 'Core i5' }], variants });
  const phone = product({ name: 'Android Phone', category: 'phones_accessories', categoryLabel: 'Phones & Accessories' });
  assert.ok(matchesSearch(laptop, 'laptop i5'));
  assert.ok(matchesSearch(laptop, '512GB'));
  assert.ok(matchesSearch(phone, 'phones'));
  assert.ok(!matchesSearch(laptop, 'laptop projector'));
  assert.equal(applyRefinements([laptop, phone], { ...DEFAULT_BROWSE_STATE, q: 'projector' }).length, 0);
});

test('filters: category, buy online, type and price band combine correctly', () => {
  const a = product({ priceMinor: 30000 });
  const b = product({ priceMinor: 300000, category: 'phones_accessories' });
  const c = product({ priceType: 'quote', priceMinor: null, fulfilmentMode: 'inquiry_only' });
  const d = product({ productKind: 'digital', fulfilmentMode: 'digital_delivery', priceMinor: 20000 });
  const all = [a, b, c, d];
  assert.deepEqual(applyRefinements(all, { ...DEFAULT_BROWSE_STATE, category: 'phones_accessories' }), [b]);
  assert.deepEqual(applyRefinements(all, { ...DEFAULT_BROWSE_STATE, buyOnline: true }), [a, b, d]);
  assert.deepEqual(applyRefinements(all, { ...DEFAULT_BROWSE_STATE, kind: 'digital' }), [d]);
  assert.deepEqual(applyRefinements(all, { ...DEFAULT_BROWSE_STATE, price: 'under_500' }), [a, d]);
  assert.deepEqual(applyRefinements(all, { ...DEFAULT_BROWSE_STATE, price: 'under_500' }, ['price']), all);
});

test('category tiles use admin categories, live counts and real product photos; empty/inactive are hidden', () => {
  const plain = product({ imageUrl: 'https://res.cloudinary.com/x/plain.png' });
  const featured = product({ featured: true, imageUrl: 'https://res.cloudinary.com/x/featured.png' });
  const phone = product({ category: 'phones_accessories', categoryLabel: 'Phones & Accessories' });
  const orphan = product({ category: 'gaming_gear', categoryLabel: 'Gaming Gear' });
  const tiles = summariseCategories(cats, [plain, featured, phone, orphan]);
  assert.deepEqual(tiles.map(t => [t.slug, t.count]), [['laptops_computers', 2], ['phones_accessories', 1], ['gaming_gear', 1]]);
  assert.equal(tiles[0].imageUrl, 'https://res.cloudinary.com/x/featured.png');
  assert.equal(tiles[1].imageUrl, undefined, 'no photo means an icon tile, never stock art');
  assert.equal(tiles[1].iconKey, 'phone');
  assert.equal(tiles[2].iconKey, 'game');
  assert.equal(categoryLabel('smart_home', cats, []), 'Smart Home', 'deep link to an empty category still names it');
  assert.equal(categoryIconKey('business_services', 'Business Services'), 'box');
});

test('category tile markup: real links, counts and current state; hidden for a single category', () => {
  const tiles = summariseCategories(cats, [product(), product({ category: 'phones_accessories', categoryLabel: 'Phones & Accessories' })]);
  const out = html(React.createElement(MarketplaceCategoryTiles, { tiles, total: 2, selected: 'phones_accessories', onSelect: () => {} }));
  assert.ok(out.includes('href="/marketplace?category=laptops_computers"'));
  assert.ok(out.includes('1 item'));
  assert.ok(out.includes('aria-current="true"'));
  assert.ok(out.includes('All products'));
  assert.equal(html(React.createElement(MarketplaceCategoryTiles, { tiles: tiles.slice(0, 1), total: 1, selected: 'all', onSelect: () => {} })), '');
});

test('cards communicate the real path, price and reward without fabricated claims', () => {
  const buy = card(product({ name: 'Buyable', specs: [{ label: 'RAM', value: '16GB' }], referralRewardGhc: 50, referralRewardMinor: 5000 }));
  assert.ok(buy.includes('Buy online'));
  assert.ok(buy.includes('16GB'));
  assert.ok(buy.includes('Share &amp; earn GH₵50'));
  assert.ok(buy.includes('href="/marketplace?product=fixture-'));
  assert.ok(!/In Stock|rating|reviews|% off/i.test(buy));
  assert.ok(!buy.includes('>Available<'), 'plain availability is not repeated on every card');
  const quote = card(product({ priceType: 'quote', priceMinor: null, priceDisplay: 'Request Quote', availability: 'check_availability', availabilityLabel: 'Check Availability' }));
  assert.ok(quote.includes('Price on request') && quote.includes('Enquire to order') && quote.includes('Check Availability'));
  const soon = card(product({ availability: 'coming_soon', availabilityLabel: 'Coming Soon', referralRewardGhc: 20 }));
  assert.ok(soon.includes('Coming soon'));
  assert.ok(!soon.includes('Share &amp; earn'), 'coming-soon items advertise no reward');
  assert.equal(referralRewardGhc(product({ referralRewardGhc: 0 })), null);
});

test('missing images fall back to a category icon, not a broken image', () => {
  const out = card(product({ imageUrl: undefined }));
  assert.ok(!out.includes('<img'));
  assert.ok(out.includes('lucide'));
});

test('fulfilment hints come only from configured data', () => {
  assert.equal(fulfilmentHint(product({ fulfilmentMode: 'pickup', pickupLocations: [{ id: 'h', name: 'Hub', city: 'Accra', area: 'Circle', active: true }] })), 'Pickup in Accra');
  assert.equal(fulfilmentHint(product({ fulfilmentMode: 'both', pickupLocations: [{ id: 'h', name: 'Hub', city: 'Kumasi', area: 'Adum', active: false }] })), 'Delivery available');
  assert.equal(fulfilmentHint(product({ fulfilmentMode: 'pickup', pickupLocations: [] })), null);
  assert.equal(fulfilmentHint(product({ productKind: 'digital', fulfilmentMode: 'digital_delivery' })), 'Digital delivery');
  assert.equal(fulfilmentHint(product({ fulfilmentMode: 'inquiry_only' })), null);
  assert.equal(cardSpecLine(product({ highlights: ['  ', 'Real highlight'] })), 'Real highlight');
});

test('refine sheet offers nothing for a tiny uniform catalogue and only splitting options for a larger one', () => {
  const small = [product(), product()];
  assert.deepEqual(refineAvailability(small), { buy: false, kinds: [], bands: [] });
  const large = Array.from({ length: 60 }, (_, i) => product({
    priceMinor: 10000 + i * 15000, productKind: i % 3 === 0 ? 'digital' : 'physical', fulfilmentMode: i % 3 === 0 ? 'digital_delivery' : 'both',
    purchaseEnabled: i % 5 !== 0, category: i % 2 ? 'phones_accessories' : 'laptops_computers',
  }));
  const offered = refineAvailability(large);
  assert.equal(offered.buy, true);
  assert.deepEqual(offered.kinds, ['physical', 'digital']);
  assert.equal(offered.bands.length, 4);
  const sorted = sortProducts(applyRefinements(large, { ...DEFAULT_BROWSE_STATE, category: 'phones_accessories', buyOnline: true }), 'price_desc');
  assert.ok(sorted.length > 0 && sorted.every(p => p.category === 'phones_accessories' && productPath(p) === 'buy'));
  for (let i = 1; i < sorted.length; i++) assert.ok(productPriceMinor(sorted[i - 1])! >= productPriceMinor(sorted[i])!);
});

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('page wiring: URL state, Back closes product sheets, scroll restoration and no category refetch', () => {
  const page = source('src/components/marketplace/MarketplacePage.tsx');
  assert.ok(page.includes('parseBrowseState(window.location.search)'));
  assert.ok(page.includes("window.history.pushState({ page: 'marketplace', mhProduct"));
  assert.ok(page.includes("addEventListener('popstate'"));
  assert.ok(page.includes('mhScroll'));
  assert.ok(page.includes('getPublicMarketplaceProductBySlug'), 'deep links outside the loaded list still resolve');
  assert.ok(!page.includes('category: selectedCategory'), 'category switching is instant, not a refetch');
});

test('homepage shortcuts and featured items deep link into the matching Marketplace view', () => {
  const home = source('src/components/home/HomeMarketplaceSection.tsx');
  for (const slug of ['laptops_computers', 'creator_tools', 'ai_productivity', 'business_essentials']) assert.ok(home.includes(`slug: '${slug}'`));
  assert.ok(home.includes('openMarketplaceAt(setActivePage'));
  assert.ok(home.includes('marketplaceHref({ product: p.slug || p.id })'));
  assert.ok(home.includes('Ask About This Item'));
  assert.ok(source('src/components/common/Navbar.tsx').includes('openMarketplaceAt(setActivePage'));
});

test('enquiry modal explains what happens after sending', () => {
  const inquiry = source('src/components/marketplace/MarketplaceInquiryModal.tsx');
  assert.ok(inquiry.includes('What happens next'));
  assert.ok(inquiry.includes('does not place an order or require payment'));
});

test('real-photo treatment: dark frame, near-fit photos fill, mismatched shapes are shown whole', () => {
  const withPhoto = card(product({ imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/box.png', variants }));
  assert.ok(withPhoto.includes('data-photo-fit="adaptive"'), 'cards choose the treatment per photo');
  assert.ok(withPhoto.includes('aspect-[4/5]'), 'card frame matches 3:4 phone photography');
  assert.ok(!withPhoto.includes('#f7f8fa') && !withPhoto.includes('mix-blend-multiply') && !withPhoto.includes('p-[7%]'), 'no pale studio surface, padding or multiply blending');
  assert.ok(withPhoto.includes('2 options'));
  // 3:4 vendor shots lose only ~6% in a 4:5 frame, so they fill it.
  assert.equal(photoTreatment({ width: 810, height: 1080 }, { width: 160, height: 200 }), 'cover');
  assert.equal(photoTreatment({ width: 960, height: 1280 }, { width: 160, height: 200 }), 'cover');
  // Square-ish shots in a tall frame, and wide banners, would lose part of the product.
  assert.equal(photoTreatment({ width: 810, height: 755 }, { width: 160, height: 200 }), 'contain');
  assert.equal(photoTreatment({ width: 1672, height: 941 }, { width: 160, height: 200 }), 'contain');
  assert.equal(photoTreatment({ width: 0, height: 0 }, { width: 160, height: 200 }), 'contain', 'unknown sizes never crop');
  assert.ok(1 - Math.min((810 / 1080) / 0.8, 0.8 / (810 / 1080)) <= COVER_TOLERANCE);
  const detail = source('src/components/marketplace/MarketplaceProductDetailModal.tsx');
  assert.ok(detail.includes('fit="contain"'), 'the product sheet always shows the whole photo');
  assert.ok(!detail.includes('mix-blend-multiply'));
  const noPhoto = card(product({ imageUrl: undefined }));
  assert.ok(!noPhoto.includes('<img'), 'missing images keep the dark icon tile');
  const enquire = card(product({ purchaseEnabled: false }));
  assert.ok(enquire.includes('>Enquire<') && !enquire.includes('>Buy online<'), 'enquiry-only products never show the buy chip');
});

test('single-category catalogue: brands from product names become the discovery row with exact counts', () => {
  const laptops = [
    product({ name: 'HP EliteBook 840 G6', imageUrl: 'https://res.cloudinary.com/x/hp1.jpg' }),
    product({ name: 'Hp ProBook 450', imageUrl: 'https://res.cloudinary.com/x/hp2.jpg' }),
    product({ name: 'Dell Latitude 7490' }),
    product({ name: 'Apple MacBook Air M1', imageUrl: 'https://res.cloudinary.com/x/mac.jpg', featured: true }),
    product({ name: 'Core i5 office laptop' }),
  ];
  assert.equal(productBrand({ name: 'ThinkPad T480 by Lenovo' }), 'lenovo');
  assert.equal(productBrand({ name: 'Chip-level repairs' }), null, 'whole words only');
  assert.equal(productBrand({ name: 'Core i5 office laptop' }), null, 'no brand is assumed');
  const brands = summariseBrands(laptops);
  assert.deepEqual(brands.map(b => [b.id, b.count]), [['hp', 2], ['apple', 1], ['dell', 1]]);
  assert.equal(brands.find(b => b.id === 'apple')!.imageUrl, 'https://res.cloudinary.com/x/mac.jpg');
  assert.equal(brands.find(b => b.id === 'dell')!.imageUrl, undefined, 'no photo, no stock art');
  const state = parseBrowseState('?brand=hp');
  assert.equal(state.brand, 'hp');
  assert.equal(parseBrowseState('?brand=<script>').brand, '', 'unknown brands are ignored');
  assert.equal(applyRefinements(laptops, state).length, 2, 'the filter count equals the tile count');
  assert.equal(serializeBrowseState(state), '?brand=hp');
  const tiles = summariseCategories(cats, laptops);
  assert.equal(tiles.length, 1);
  const row = { category: 'laptops_computers', label: 'Laptops & Computers', brands: brandLayer(laptops, 'all')!, total: laptops.length };
  assert.equal(landingBrandCategory(laptops, tiles), 'laptops_computers', 'one department leads with its brands');
  const out = html(React.createElement(MarketplaceCategoryTiles, { tiles, total: laptops.length, selected: 'all', onSelect: () => {}, brandRow: row, selectedBrand: 'hp', onSelectBrand: () => {} }));
  assert.ok(out.includes('Shop Laptops &amp; Computers by brand'));
  assert.ok(out.includes('href="/marketplace?category=laptops_computers&amp;brand=hp"') && out.includes('HP, 2 items') && out.includes('All Laptops &amp; Computers, 5 items'));
  assert.ok(out.includes('Other brands, 1 item'), 'unbranded laptops keep the counts adding up');
  assert.ok(out.includes('aria-current="true"'));
  assert.ok(!out.includes('Phones'), 'empty categories are never shown');
  assert.ok(!out.includes('Shop by department'), 'a single department is not repeated as a tile');
  assert.equal(brandLayer(laptops.slice(0, 2), 'all'), null, 'one brand is not worth a row');
  assert.equal(html(React.createElement(MarketplaceCategoryTiles, { tiles, total: 2, selected: 'all', onSelect: () => {}, brandRow: null, onSelectBrand: () => {} })), '');
});

test('admin category check flags clear name mismatches and never edits on its own', () => {
  const rows = categoryMismatches([
    product({ id: 'a', name: 'iPhone 13 Pro 256GB' }),
    product({ id: 'b', name: 'HP EliteBook 840' }),
    product({ id: 'c', name: 'Blue Yeti USB microphone' }),
    product({ id: 'd', name: 'Mystery gadget', tagline: 'Wireless webcam for meetings' }),
    product({ id: 'e', name: 'Laptop with phone charger' }),
    product({ id: 'f', name: 'iPhone case', archived: true }),
  ], [...cats, { slug: 'creator_tools', label: 'Creator Tools', active: true, sort_order: 4 }]);
  assert.deepEqual(rows.map(r => [r.productId, r.suggested]), [['a', 'phones_accessories'], ['c', 'creator_tools'], ['d', 'creator_tools']]);
  assert.match(rows[2].reason, /tagline/);
  assert.equal(categoryMismatches([product({ name: 'Ring light' })], cats).length, 0, 'never suggests an inactive or missing category');
  const panel = source('src/components/admin/sections/MarketplaceControlPanels.tsx');
  assert.ok(panel.includes('<CategoryCheck') && panel.includes('onEdit(product)'), 'fixes go through the audited product editor');
  assert.ok(!/categoryMismatches[^\n]*PATCH/.test(panel));
});

test('refinement: homepage featured CTA follows the real purchase path', () => {
  const home = source('src/components/home/HomeMarketplaceSection.tsx');
  assert.ok(home.includes("productPath(p) === 'buy' ?"));
  assert.ok(home.includes('View &amp; Buy'));
  assert.ok(home.includes('PATH_LABELS[productPath(p)]'));
});
