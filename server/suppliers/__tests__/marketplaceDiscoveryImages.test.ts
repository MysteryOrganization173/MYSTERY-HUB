/**
 * Marketplace discovery (departments → brands → products) and product-photo framing.
 * Isolated fixtures only: no live products, prices, customers or Cloudinary calls.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, beforeEach } from 'node:test';
import type { MarketplaceProduct } from '../../../src/types/index.js';
import {
  DEFAULT_BROWSE_STATE, OTHER_BRAND, applyRefinements, brandLayer, brandLabel, landingBrandCategory, parseBrowseState, productBrand,
  productBrandInfo, selectDepartment, serializeBrowseState, sortProducts, summariseCategories,
} from '../../../src/utils/marketplaceBrowse.js';
import { MarketplaceCategoryTiles } from '../../../src/components/marketplace/MarketplaceCategoryTiles.js';
import { MarketplaceProductCard } from '../../../src/components/marketplace/MarketplaceProductCard.js';
import { photoLayout, PARTIAL_CROP } from '../../../src/components/marketplace/MarketplaceMedia.js';
import { MarketplacePhotoFraming } from '../../../src/components/admin/sections/MarketplacePhotoFraming.js';
import { formatImageFraming, framingRegion, parseImageFraming } from '../../../shared/marketplaceImageFraming.js';
import { marketplaceProductHead, marketplaceSocialImage } from '../../../src/utils/socialMetadata.js';
import { MarketplaceStore } from '../../db/marketplaceStore.js';
import { validateProductInput } from '../../services/marketplaceProductPolicy.js';
import { toPublicMarketplaceProduct } from '../../types/marketplace.js';

let seq = 0;
const product = (extra: Partial<MarketplaceProduct> = {}): MarketplaceProduct => {
  seq++;
  return {
    id: `mp_disc_${seq}`, slug: `disc-${seq}`, name: `Fixture ${seq}`, category: 'laptops_computers', categoryLabel: 'Laptops & Computers',
    tagline: '', description: 'Fixture description', priceDisplay: 'GH₵1,000', priceType: 'fixed', priceMinor: 100000, priceGhc: 1000,
    availability: 'available', availabilityLabel: 'Available', highlights: [], productKind: 'physical', fulfilmentMode: 'both',
    purchaseEnabled: true, deliveryAvailable: true, pickupLocations: [], variants: [], createdAt: '2026-01-01T00:00:00Z', ...extra,
  };
};
const digital = (extra: Partial<MarketplaceProduct> = {}) => product({ category: 'digital_products', categoryLabel: 'Digital Products', productKind: 'digital', fulfilmentMode: 'digital_delivery', ...extra });
const cats = [
  { slug: 'laptops_computers', label: 'Laptops & Computers', active: true, sort_order: 0 },
  { slug: 'phones_accessories', label: 'Phones & Accessories', active: true, sort_order: 1 },
  { slug: 'digital_products', label: 'Digital Products', active: true, sort_order: 5 },
];
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const img = (name: string) => `https://res.cloudinary.com/fixture/image/upload/v1/${name}.jpg`;

// The founder's catalogue shape: many laptops across six brands plus a Digital Products department.
const laptops = [
  product({ name: 'Dell Latitude 7490', imageUrl: img('dell1') }), product({ name: 'Dell Latitude 5400' }), product({ name: 'Dell XPS 13 9370', featured: true, imageUrl: img('dell3') }),
  product({ name: 'HP EliteBook 840 G6', imageUrl: img('hp1') }), product({ name: 'HP ProBook 450 G7' }),
  product({ name: 'Lenovo ThinkPad T480', imageUrl: img('lenovo') }), product({ name: 'Microsoft Surface Laptop 3', imageUrl: img('surface') }),
  product({ name: 'Apple MacBook Air M1', imageUrl: img('mac') }), product({ name: 'Toshiba Dynabook Tecra', imageUrl: img('toshiba') }),
];
const digitals = [
  digital({ name: 'Microsoft 365 Personal (1 year)' }), digital({ name: 'Apple Music gift card' }), digital({ name: 'Canva Pro team seat' }),
];
const catalogue = [...laptops, ...digitals];

test('root cause regression: a second department no longer hides the laptop brand gallery', () => {
  const tiles = summariseCategories(cats, catalogue);
  assert.deepEqual(tiles.map(t => [t.slug, t.count]), [['laptops_computers', 9], ['digital_products', 3]]);
  assert.equal(landingBrandCategory(catalogue, tiles), 'laptops_computers', 'the only branded department leads on the landing view');
  const brands = brandLayer(catalogue, 'laptops_computers')!;
  assert.deepEqual(brands.map(b => [b.id, b.count]), [['dell', 3], ['hp', 2], ['apple', 1], ['lenovo', 1], ['microsoft', 1], ['toshiba', 1]]);
  assert.equal(brands.reduce((n, b) => n + b.count, 0), 9, 'brand counts add up to the department');
  assert.equal(brands[0].imageUrl, img('dell3'), 'featured photo first');
  const row = { category: 'laptops_computers', label: 'Laptops & Computers', brands, total: 9 };
  const out = html(React.createElement(MarketplaceCategoryTiles, { tiles, total: catalogue.length, selected: 'laptops_computers', onSelect: () => {}, brandRow: row, selectedBrand: '', onSelectBrand: () => {} }));
  assert.ok(out.includes('Shop by department') && out.includes('Laptops &amp; Computers, 9 items') && out.includes('Digital Products, 3 items') && out.includes('All products, 12 items'));
  assert.ok(out.includes('Shop Laptops &amp; Computers by brand'), 'departments and brands render together');
  for (const label of ['Dell', 'HP', 'Lenovo', 'Microsoft', 'Apple', 'Toshiba']) assert.ok(out.includes(`>${label}<`), `${label} tile`);
  assert.ok(out.includes('href="/marketplace?category=laptops_computers&amp;brand=dell"'), 'brand links keep their department');
  assert.ok(out.indexOf('Shop by department') < out.indexOf('by brand'), 'brands sit directly under the departments, before any product');
});

test('brands never leak into departments where they mean nothing', () => {
  assert.equal(productBrand(digitals[0]), null, '"Microsoft 365" is a publisher, not a hardware brand');
  assert.equal(productBrand(digitals[1]), null, '"Apple Music" is not an Apple device');
  assert.equal(brandLayer(catalogue, 'digital_products'), null, 'Digital Products shows its listings directly');
  assert.equal(productBrand(product({ name: 'Microsoft 365 install service', productKind: 'service', category: 'laptops_computers' })), null, 'services are not branded by name');
  assert.equal(productBrand(product({ name: 'Galaxy projector', category: 'ai_productivity', categoryLabel: 'AI & Productivity Tools' })), null);
  assert.equal(productBrand(product({ name: 'Chip-level repairs' })), null, 'whole words only');
});

test('structured brand specification wins over name guesses; unknown brands get their own tile', () => {
  assert.equal(productBrand(product({ name: 'Office laptop 14"', specs: [{ label: 'Brand', value: 'HP' }] })), 'hp');
  assert.equal(productBrand(product({ name: 'Dell-style charger', specs: [{ label: 'Manufacturer', value: 'Lenovo' }] })), 'lenovo', 'spec beats name');
  const haier = product({ name: 'Y11C business laptop', specs: [{ label: 'Make', value: 'Haier' }], imageUrl: img('haier') });
  assert.deepEqual(productBrandInfo(haier), { id: 'haier', label: 'Haier' });
  const declaredDigital = digital({ name: 'Office suite', specs: [{ label: 'Brand', value: 'Microsoft' }] });
  assert.equal(productBrand(declaredDigital), 'microsoft', 'an explicit admin brand is respected anywhere');
  const brands = brandLayer([...laptops, haier], 'laptops_computers')!;
  assert.ok(brands.some(b => b.id === 'haier' && b.label === 'Haier' && b.count === 1));
  assert.equal(parseBrowseState('?category=laptops_computers&brand=haier').brand, 'haier');
  assert.equal(applyRefinements([...laptops, haier], parseBrowseState('?category=laptops_computers&brand=haier')).length, 1);
  assert.equal(brandLabel('haier', [haier]), 'Haier');
});

test('unbranded items in a branded department are grouped as Other brands and filter exactly', () => {
  const generic = product({ name: 'Core i5 office laptop', imageUrl: img('generic') });
  const brands = brandLayer([...laptops, generic], 'laptops_computers')!;
  const other = brands.find(b => b.id === OTHER_BRAND)!;
  assert.equal(other.count, 1); assert.equal(other.label, 'Other brands'); assert.equal(brands.at(-1)!.id, OTHER_BRAND, 'Other is last');
  const state = { ...DEFAULT_BROWSE_STATE, category: 'laptops_computers', brand: OTHER_BRAND };
  assert.deepEqual(applyRefinements([...laptops, generic], state).map(p => p.name), ['Core i5 office laptop']);
  assert.equal(brandLayer([laptops[0], laptops[1]], 'laptops_computers'), null, 'one brand alone is not a choice');
  assert.equal(brandLayer([product({ name: 'Lone laptop' })], 'laptops_computers'), null, 'a one-product department shows products directly');
});

test('department switches reset incompatible brands; compatible ones survive', () => {
  const dellMonitor = product({ name: 'Dell P2419H monitor', category: 'phones_accessories', categoryLabel: 'Phones & Accessories' });
  const all = [...catalogue, dellMonitor];
  const dell = { ...DEFAULT_BROWSE_STATE, category: 'laptops_computers', brand: 'dell', q: 'latitude', sort: 'price_desc' as const };
  const toDigital = selectDepartment(dell, 'digital_products', all);
  assert.equal(toDigital.brand, '', 'Laptops → Dell → Digital Products never keeps Dell');
  assert.equal(toDigital.q, 'latitude', 'search stays'); assert.equal(toDigital.sort, 'price_desc', 'sort stays');
  assert.equal(selectDepartment(dell, 'phones_accessories', all).brand, 'dell', 'Dell exists there too');
  assert.equal(selectDepartment({ ...dell, brand: OTHER_BRAND }, 'phones_accessories', all).brand, '', '"Other" is per department');
  assert.equal(selectDepartment(dell, 'all', all).brand, 'dell');
});

test('URL state: department + brand round-trip, deep links parse, junk is ignored, product links survive', () => {
  const state = { ...DEFAULT_BROWSE_STATE, category: 'laptops_computers', brand: 'hp', sort: 'price_asc' as const };
  const qs = serializeBrowseState(state, '?product=hp-elitebook&ref=CODE');
  assert.ok(qs.includes('category=laptops_computers') && qs.includes('brand=hp') && qs.includes('product=hp-elitebook') && qs.includes('ref=CODE'));
  assert.deepEqual(parseBrowseState(qs), state);
  assert.equal(parseBrowseState('?brand=HP').brand, 'hp', 'case-insensitive');
  for (const junk of ['<script>', '../../etc', 'a'.repeat(40), '-dell']) assert.equal(parseBrowseState(`?brand=${encodeURIComponent(junk)}`).brand, '');
});

test('search, sort and refinements stay coherent with a selected brand', () => {
  const state = { ...DEFAULT_BROWSE_STATE, category: 'laptops_computers', brand: 'dell', q: 'latitude' };
  assert.deepEqual(applyRefinements(catalogue, state).map(p => p.name).sort(), ['Dell Latitude 5400', 'Dell Latitude 7490']);
  const priced = [product({ name: 'Dell A', priceMinor: 300000 }), product({ name: 'Dell B', priceMinor: 200000 }), product({ name: 'HP C', priceMinor: 100000 })];
  assert.deepEqual(sortProducts(applyRefinements(priced, { ...DEFAULT_BROWSE_STATE, brand: 'dell' }), 'price_asc').map(p => p.name), ['Dell B', 'Dell A']);
  assert.equal(applyRefinements(catalogue, { ...state, brand: 'toshiba' }).length, 0, 'an empty combination is reported, not hidden');
});

test('page wiring: departments/brands push history, reveal the brand gallery first, and clear stale brands', () => {
  const page = source('src/components/marketplace/MarketplacePage.tsx');
  assert.ok(page.includes("window.history.pushState({ page: 'marketplace' }"), 'department and brand choices create Back entries');
  assert.ok(page.includes('navigateBrowse(selectDepartment(browse, slug, products))'));
  assert.ok(page.includes("reveal(brandRowRef.current, 'gallery')"), 'a branded department scrolls to its brands, not past them');
  assert.ok(page.includes('Math.min(rect.bottom - bottom, rect.top - header)'), 'never scrolls the gallery under the sticky header');
  assert.ok(page.includes("setBrowse(parseBrowseState(window.location.search))"), 'Back/forward restore department and brand');
  assert.ok(page.includes("updateBrowse({ brand: '' })"), 'stale brand links fall back to the department');
  assert.ok(page.includes("onChange={(e) => updateBrowse({ q: e.target.value.slice(0, 80) })}"), 'typing never floods history');
  const tiles = source('src/components/marketplace/MarketplaceCategoryTiles.tsx');
  assert.ok(tiles.includes('scroll-mt-20'), 'scroll target clears the sticky header');
});

test('photo layout matrix: fill when close, enlarge-and-blur otherwise, never stretched', () => {
  const card = { width: 160, height: 200 }; // 4:5 card
  const cases: Array<[string, number, number, 'cover' | 'contain']> = [
    ['3:4 portrait (most supplier photos)', 960, 1280, 'cover'], ['810x1080', 810, 1080, 'cover'], ['828x1041', 828, 1041, 'cover'],
    ['very narrow portrait 828x1792', 828, 1792, 'contain'], ['square 960x966', 960, 966, 'contain'], ['landscape 810x699', 810, 699, 'contain'], ['wide 1672x941', 1672, 941, 'contain'],
  ];
  for (const [label, w, h, treatment] of cases) {
    const layout = photoLayout({ width: w, height: h }, card);
    assert.equal(layout.treatment, treatment, label);
    if (treatment === 'contain') {
      assert.ok(layout.scale > 1 && layout.scale <= 1 / (1 - PARTIAL_CROP) + 1e-9, `${label}: enlarged at most until ${PARTIAL_CROP * 100}% is trimmed`);
      const fill = Math.max((w / h) / 0.8, 0.8 / (w / h));
      assert.ok(layout.scale <= fill + 1e-9, `${label}: never enlarged past filling the frame`);
    } else assert.equal(layout.scale, 1);
  }
  assert.equal(photoLayout({ width: 0, height: 0 }, card).treatment, 'contain', 'unknown sizes never crop');
  assert.deepEqual(photoLayout({ width: 810, height: 699 }, card, { fit: 'contain' }), { treatment: 'contain', scale: 1, position: '50% 50%' }, 'product page shows everything');
  // Small square tiles accept a 3:4 phone shot as a fill.
  assert.equal(photoLayout({ width: 960, height: 1280 }, { width: 64, height: 64 }, { coverTolerance: 0.26 }).treatment, 'cover');
  // Admin framing pans and zooms toward the subject, but never on the whole-photo product page.
  const framed = photoLayout({ width: 960, height: 1280 }, card, { framing: { x: 26, y: 80, zoom: 1.6 } });
  assert.equal(framed.treatment, 'cover');
  const b = framed.box!;
  assert.ok(Math.abs(b.width / b.height - (960 / 1280) / 0.8) < 0.01, 'framed box keeps the photo proportions (no stretching)');
  assert.ok(b.left <= 0 && b.top <= 0 && b.left + b.width >= 100 - 1e-6 && b.top + b.height >= 100 - 1e-6, 'a filled frame never shows empty edges');
  const subjectX = b.left + 0.26 * b.width, subjectY = b.top + 0.8 * b.height;
  const unframedX = 26, unframedY = 80; // where the subject sits in the frame without framing (roughly)
  assert.ok(Math.abs(subjectX - 50) < Math.abs(unframedX - 50) && Math.abs(subjectY - 50) <= Math.abs(unframedY - 50), 'the subject moves toward the centre');
  assert.equal(photoLayout({ width: 960, height: 1280 }, card, { fit: 'contain', framing: { x: 30, y: 70, zoom: 1.3 } }).box, undefined, 'product page ignores framing');
  const media = source('src/components/marketplace/MarketplaceMedia.tsx');
  assert.ok(!/object-fill|object-\[fill\]/.test(media), 'no stretching fit is ever used');
});

test('cards carry framing to the photo; missing photos keep the icon tile; purchase chips unchanged', () => {
  const out = html(React.createElement(MarketplaceProductCard, { product: product({ imageUrl: img('a'), imageFraming: { x: 20, y: 80, zoom: 1.5 } }), onOpen: () => {}, onShareEarn: () => {}, formatGhc: n => String(n) }));
  assert.ok(out.includes('data-photo-fit="adaptive"') && out.includes('aspect-[4/5]'));
  const none = html(React.createElement(MarketplaceProductCard, { product: product({ imageUrl: undefined }), onOpen: () => {}, onShareEarn: () => {}, formatGhc: n => String(n) }));
  assert.ok(!none.includes('<img'));
  const enquire = html(React.createElement(MarketplaceProductCard, { product: product({ purchaseEnabled: false, fulfilmentMode: 'inquiry_only' }), onOpen: () => {}, onShareEarn: () => {}, formatGhc: n => String(n) }));
  assert.ok(enquire.includes('>Enquire<') && !enquire.includes('>Buy online<'), 'enquiry-only products never look purchasable');
});

test('framing values: strict parse, normalised format, crop region stays inside the photo', () => {
  assert.deepEqual(parseImageFraming('30,70,1.25'), { x: 30, y: 70, zoom: 1.25 });
  for (const bad of ['', '101,5,1', '5,5,0.9', '5,5,2.5', '5,5', 'x,y,z', '5,5,1;DROP', ' 1,2,3.333']) assert.equal(parseImageFraming(bad), null, bad);
  assert.equal(formatImageFraming({ x: 50, y: 50, zoom: 1 }), null, 'centred default is stored as automatic');
  assert.equal(formatImageFraming({ x: 33.4, y: 120, zoom: 1.27 }), '33,100,1.25');
  assert.deepEqual(framingRegion({ x: 50, y: 60, zoom: 1.25 }), { x: 0.1, y: 0.2, w: 0.8, h: 0.8 });
  assert.deepEqual(framingRegion({ x: 0, y: 100, zoom: 2 }), { x: 0, y: 0.5, w: 0.5, h: 0.5 }, 'clamped at the edges');
});

test('sharing image: deterministic composite, framing crop, safe fallbacks for other hosts and odd IDs', () => {
  const url = 'https://res.cloudinary.com/da6oeat7m/image/upload/v1792489459/mysteryhub/marketplace/products/asset_9781a83f.jpg';
  const plain = marketplaceSocialImage(url);
  assert.equal(plain.image, 'https://res.cloudinary.com/da6oeat7m/image/upload/c_fill,h_630,w_1200/e_blur:1500/e_brightness:-35/l_mysteryhub:marketplace:products:asset_9781a83f/c_fit,h_630,w_1200/fl_layer_apply,g_center/b_rgb:0b0f12,c_pad,h_630,w_1200/f_jpg/q_auto/v1792489459/mysteryhub/marketplace/products/asset_9781a83f.jpg');
  assert.equal(marketplaceSocialImage(url).image, plain.image, 'same input, same URL: rendered once, then cached');
  assert.deepEqual([plain.imageWidth, plain.imageHeight, plain.imageType], [1200, 630, 'image/jpeg']);
  assert.ok(plain.image.startsWith('https://'));
  const framed = marketplaceSocialImage(url, { x: 50, y: 60, zoom: 1.25 }).image;
  assert.equal((framed.match(/c_crop,g_north_west,h_0\.8,w_0\.8,x_0\.1,y_0\.2\//g) || []).length, 2, 'backdrop and product use the same crop');
  assert.notEqual(framed, plain.image, 'a framing change gets its own cached rendition');
  // IDs that cannot be reused as an overlay keep the previous padded rendition; other hosts stay exact.
  assert.match(marketplaceSocialImage('https://res.cloudinary.com/x/image/upload/v1/My%20Laptop.jpg').image, /c_pad,w_1200,h_630,b_rgb:0b0f12/);
  assert.match(marketplaceSocialImage('https://res.cloudinary.com/x/image/upload/v1/laptop.v2.jpg').image, /c_pad,w_1200,h_630/);
  assert.deepEqual(marketplaceSocialImage('https://images.supplier.example/laptop.jpg'), { image: 'https://images.supplier.example/laptop.jpg' });
  assert.deepEqual(marketplaceSocialImage('http://insecure.example/laptop.jpg'), { image: '' }, 'never a non-HTTPS preview');
  const head = marketplaceProductHead(product({ imageUrl: url, imageFraming: { x: 50, y: 60, zoom: 1.25 }, name: 'HP EliteBook 840 G6' }));
  assert.equal(head.image, framed); assert.equal(head.url, `https://mysterybundlehub.com/marketplace?product=${head.url.split('product=')[1]}`);
  assert.equal(head.title, 'HP EliteBook 840 G6');
});

test('admin preview: card, whole-photo page and WhatsApp preview; exact sharing link only for Cloudinary originals', () => {
  const cloud = html(React.createElement(MarketplacePhotoFraming, { imageUrl: img('hp'), name: 'HP', framing: null, onChange: () => {} }));
  for (const view of ['card', 'detail', 'social']) assert.ok(cloud.includes(`data-mh-preview="${view}"`), view);
  assert.ok(cloud.includes('Automatic framing') && cloud.includes('Open exact image') && cloud.includes('c_fit,h_630,w_1200'));
  const external = html(React.createElement(MarketplacePhotoFraming, { imageUrl: 'https://images.supplier.example/a.jpg', name: 'HP', framing: { x: 40, y: 40, zoom: 1.2 }, onChange: () => {} }));
  assert.ok(!external.includes('Open exact image') && external.includes('not stored on Mystery Hub'));
  assert.ok(external.includes('role="slider"'), 'custom framing opens the keyboard-accessible controls');
  const editor = source('src/components/admin/sections/MarketplaceProductEditor.tsx');
  assert.ok(editor.includes('imageFraming,'), 'framing is saved with the product');
  assert.ok(editor.includes('framingState.url === imageUrl'), 'a new main photo starts from automatic');
});

beforeEach(() => MarketplaceStore._clearInMemoryStore());

test('persistence: framing validates, saves, resets with a new main photo and never publishes a draft', async () => {
  const base = { name: 'Framing fixture laptop', category: 'laptops_computers', priceType: 'fixed', priceGhc: 4500, availability: 'available', productKind: 'physical', fulfilmentMode: 'both', imageUrl: img('frame') };
  const created = await MarketplaceStore.createProduct(await validateProductInput({ ...base, imageFraming: { x: 40, y: 65, zoom: 1.3 } }) as never, 'admin');
  assert.equal(created.image_framing, '40,65,1.3'); assert.equal(created.published, false);
  assert.deepEqual(toPublicMarketplaceProduct(created).imageFraming, { x: 40, y: 65, zoom: 1.3 });
  const priceBefore = created.price_minor;
  const edited = await MarketplaceStore.updateProduct(created.id, await validateProductInput({ imageFraming: { x: 10, y: 90, zoom: 2 } }, created) as never, 'admin');
  assert.equal(edited.image_framing, '10,90,2'); assert.equal(edited.published, false, 'editing framing keeps a draft a draft'); assert.equal(edited.price_minor, priceBefore);
  const newPhoto = await MarketplaceStore.updateProduct(created.id, await validateProductInput({ imageUrl: img('other') }, edited) as never, 'admin');
  assert.equal(newPhoto.image_framing, null, 'a different main photo starts automatic');
  const auto = await MarketplaceStore.updateProduct(created.id, await validateProductInput({ imageFraming: { x: 50, y: 50, zoom: 1 } }, newPhoto) as never, 'admin');
  assert.equal(auto.image_framing, null, 'centred default stored as automatic');
  for (const bad of [{ x: 120, y: 5, zoom: 1 }, { x: 5, y: 5, zoom: 3 }, 'nope', 42, [1, 2, 3]]) await assert.rejects(validateProductInput({ imageFraming: bad }, auto), /Invalid photo framing/);
  assert.equal((await validateProductInput({ imageFraming: null }, auto) as { imageFraming: unknown }).imageFraming, null);
  assert.equal(toPublicMarketplaceProduct({ ...auto, image_framing: 'garbage' }).imageFraming, undefined, 'bad stored values mean automatic');
});
