import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { apiRouter } from '../../routes/api.js';
import { adminRouter } from '../../routes/adminApi.js';
import { MarketplaceControlStore } from '../../db/marketplaceControlStore.js';
import { AuthStore } from '../../db/authStore.js';
import { CreativeBriefError, creativeLeadMessage, creativeLeadSubject, validateCreativeBrief } from '../../../shared/creativeStudio.js';
import {
  CREATIVE_CATEGORIES, CREATIVE_COMMERCE, CREATIVE_PACKAGES, CreativePriceError, creativeCedis, creativeFromPrice, priceCreativeOrder,
} from '../../../shared/creativeCatalogue.js';
import { CREATIVE_PROJECTS, CREATIVE_WORK } from '../../../src/data/creativeStudioWork.js';

const TODAY = '2026-11-07';
const ID = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const order = (extra: Record<string, unknown> = {}) => ({
  requestId: ID, service: 'flyers', packageId: 'standard-flyer', extras: ['print-pdf'], name: 'Synthetic Customer', phone: '024 123 4567',
  details: 'Harvest service flyer with the time and venue.', fields: { title: 'Harvest Thanksgiving 2026' }, ...extra,
});
const fieldOf = (fn: () => unknown) => { try { fn(); } catch (e) { assert.ok(e instanceof CreativeBriefError, String(e)); return (e as CreativeBriefError).field; } assert.fail('expected a brief error'); };

let server: Server, base: string;
before(async () => {
  assert.equal(process.env.DATABASE_URL, undefined, 'Isolated runner must remove inherited DB URL');
  const app = express(); app.use(express.json()); app.use('/api', apiRouter); app.use('/api/admin', adminRouter);
  server = await new Promise<Server>(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(async () => {
  MarketplaceControlStore.resetMemory(); AuthStore._clearDevStore();
  await AuthStore.createUser({ id: 'admin', name: 'admin', email: 'admin@example.test', phone: null, passwordHash: 'synthetic-unused-hash', role: 'admin' });
  await AuthStore.createSession('admin', 'admin-token');
});
const send = (body: unknown) => fetch(`${base}/api/creative-studio/enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const leads = async () => (await (await fetch(`${base}/api/admin/marketplace/inquiries`, { headers: { Authorization: 'Bearer admin-token' } })).json());

test('V2 launches as a safe draft: prices are drafts and no online payment exists', () => {
  assert.equal(CREATIVE_COMMERCE.pricing, 'draft', 'prices stay drafts until the founder approves them');
  assert.equal(CREATIVE_COMMERCE.payments, 'off', 'Creative Studio takes no payment in this release');
  assert.match(CREATIVE_COMMERCE.catalogueVersion, /^\d{4}-\d{2}-v\d+(-draft)?$/);
  // No Creative Studio code reaches the payment system.
  for (const file of ['server/routes/creativeStudioApi.ts', 'shared/creativeStudio.ts', 'shared/creativeCatalogue.ts', 'src/components/creative/CreativeSheet.tsx', 'src/components/creative/CreativeBriefForm.tsx', 'src/components/creative/CreativeStudioPage.tsx']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /paystack|initializePayment|ordersStore|OrdersStore|wallet/i, file);
  }
});

test('every package is a complete, honest offer with its own sample artwork', () => {
  assert.deepEqual(CREATIVE_CATEGORIES.map(c => c.id), ['flyers', 'social', 'logo', 'banners']);
  assert.equal(new Set(CREATIVE_PACKAGES.map(p => p.id)).size, CREATIVE_PACKAGES.length);
  const covers = CREATIVE_PACKAGES.map(p => p.art[0]);
  assert.equal(new Set(covers).size, covers.length, 'no two packages share a card image');
  for (const pkg of CREATIVE_PACKAGES) {
    assert.ok(CREATIVE_CATEGORIES.some(c => c.id === pkg.category), pkg.id);
    assert.ok(Number.isSafeInteger(pkg.priceMinor) && pkg.priceMinor >= 5000 && pkg.priceMinor % 100 === 0, `${pkg.id} is a whole-cedi price`);
    assert.ok(pkg.turnaroundDays >= 2 && pkg.turnaroundDays <= 10, `${pkg.id} has a realistic turnaround`);
    assert.ok(pkg.revisions >= 2 && pkg.revisions <= 3, `${pkg.id} has limited revisions`);
    assert.ok(pkg.deliverables.length >= 1 && pkg.files && pkg.limits.length >= 1 && pkg.goodFor.length >= 2, pkg.id);
    assert.equal(new Set(pkg.extras.map(e => e.id)).size, pkg.extras.length, `${pkg.id} extras are unique`);
    for (const extra of pkg.extras) assert.ok(Number.isSafeInteger(extra.priceMinor) && extra.priceMinor > 0 && extra.priceMinor < pkg.priceMinor * 2, `${pkg.id}/${extra.id}`);
    for (const id of pkg.art) assert.ok(CREATIVE_WORK.some(w => w.id === id), `${pkg.id} art ${id} is a real Cloudinary piece`);
    assert.doesNotMatch(JSON.stringify(pkg), /unlimited|guarantee|same day|24 ?hours|best in ghana|#1/i, pkg.id);
  }
  for (const project of CREATIVE_PROJECTS) assert.ok(CREATIVE_PACKAGES.some(p => p.id === project.package), project.id);
  assert.equal(creativeFromPrice(), 6900);
  assert.equal(creativeCedis(9900), 'GH₵99');
  assert.equal(creativeCedis(129950), 'GH₵1,299.50');
});

test('the price is calculated from the catalogue only, in catalogue order, and refuses anything unknown', () => {
  const price = priceCreativeOrder('standard-flyer', ['print-pdf', 'express']);
  assert.equal(price.totalMinor, 9900 + 3000 + 5000);
  assert.deepEqual(price.extras.map(e => e.id), ['express', 'print-pdf'], 'stable snapshot order');
  assert.equal(price.catalogueVersion, CREATIVE_COMMERCE.catalogueVersion);
  assert.throws(() => priceCreativeOrder('gold-flyer'), CreativePriceError);
  assert.throws(() => priceCreativeOrder('standard-flyer', ['business-card']), /no longer available/, 'an extra from another package');
  assert.throws(() => priceCreativeOrder('standard-flyer', ['express', 'express']), /once/);
  assert.throws(() => priceCreativeOrder('standard-flyer', 'express'), /from the list/);
});

test('a package order request is validated by the shared rule and snapshots the server price for Admin', () => {
  const brief = validateCreativeBrief(order(), TODAY);
  assert.equal(brief.price?.totalMinor, 12900);
  assert.equal(creativeLeadSubject(brief), 'Creative Studio · Standard flyer order');
  const message = creativeLeadMessage(brief);
  assert.match(message, /^Creative Studio order request CS-7C1D2E3F\nService: Flyers & posters\nPackage: Standard flyer \(GH₵99\)\nExtras: Print-ready PDF \(\+GH₵30\)\nTotal shown: GH₵129 \(draft price, catalogue /);
  assert.match(message, /Order request: no payment taken\. Confirm the package, price and start date with the customer before any work or payment\.$/);
  assert.doesNotMatch(message, /Quote required/);
  // Anything that could change the price is refused, never ignored.
  assert.equal(fieldOf(() => validateCreativeBrief(order({ packageId: 'logo-design', extras: [] }), TODAY)), 'package', 'package from another service');
  assert.equal(fieldOf(() => validateCreativeBrief(order({ packageId: 'nope' }), TODAY)), 'package');
  assert.equal(fieldOf(() => validateCreativeBrief(order({ extras: ['social-kit'] }), TODAY)), 'extras');
  assert.equal(fieldOf(() => validateCreativeBrief(order({ budget: 'GH₵20' }), TODAY)), 'budget');
  assert.throws(() => validateCreativeBrief(order({ totalMinor: 100 }), TODAY), /fields we do not accept/, 'a client amount is never accepted');
  // The largest order still fits the column and keeps its closing line.
  const big = creativeLeadMessage(validateCreativeBrief(order({ service: 'logo', packageId: 'starter-identity', extras: ['letterhead', 'launch-post', 'extra-revision'], details: 'd'.repeat(800),
    fields: { businessName: 'b'.repeat(120), businessType: 't'.repeat(160), logoStatus: 'A new logo', style: 'Elegant', colours: 'c'.repeat(80) },
    links: [1, 2, 3].map(n => `https://site${n}.example/` + 'p'.repeat(170)) }), TODAY));
  assert.ok(big.length <= 2000, String(big.length));
  assert.match(big, /Total shown: GH₵1,127 /);
  assert.match(big, /no payment taken/);
});

test('a guest package request is stored once as a Creative Studio lead with the price snapshot, and takes no payment', async () => {
  const first = await send(order());
  assert.equal(first.status, 201);
  const saved = await first.json();
  assert.equal(saved.reference, 'CS-7C1D2E3F');
  assert.equal(saved.service, 'Standard flyer');
  assert.deepEqual(saved.order, { package: 'standard-flyer', extras: ['print-pdf'], totalMinor: 12900, pricing: 'draft', catalogueVersion: CREATIVE_COMMERCE.catalogueVersion, paymentTaken: false });
  assert.equal((await send(order())).status, 200, 'a retried request is acknowledged, not duplicated');
  const list = await leads();
  assert.equal(list.total, 1);
  assert.equal(list.inquiries[0].product_name, 'Creative Studio · Standard flyer order');
  assert.equal(list.inquiries[0].inquiry_type, 'creative_studio');
  assert.ok(!list.inquiries[0].budget, 'a package has no budget');
  assert.match(list.inquiries[0].message, /Total shown: GH₵129 \(draft price/);
  // A forged amount or unknown extra is refused and stores nothing.
  const forged = await send(order({ requestId: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e', extras: ['business-card'] }));
  assert.equal(forged.status, 400);
  assert.equal((await forged.json()).field, 'extras');
  assert.equal((await leads()).total, 1);
  // A custom brief keeps the V1 quote path.
  const custom = await send({ requestId: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f', service: 'banners', name: 'Synthetic Customer', phone: '0241234567', details: 'A roll-up banner and two signboards for our shop opening.', fields: { placement: 'Signboard or roll-up' }, budget: 'GH₵600' });
  assert.equal(custom.status, 201);
  const customLead = (await leads()).inquiries.find((r: { id: string }) => r.id.includes('2c3d4e5f'));
  assert.equal(customLead.product_name, 'Creative Studio · Banners & web graphics');
  assert.match(customLead.message, /Quote required/);
});

test('the storefront is image-led, honest about drafts and payment, and keeps one way to each action', () => {
  const page = readFileSync('src/components/creative/CreativeStudioPage.tsx', 'utf8');
  const sheet = readFileSync('src/components/creative/CreativeSheet.tsx', 'utf8');
  const form = readFileSync('src/components/creative/CreativeBriefForm.tsx', 'utf8');
  // Draft prices and the closed checkout are said plainly where prices and the order button appear.
  assert.match(page, /Draft prices\./);
  assert.match(page, /Online payment isn’t open yet/);
  assert.match(sheet, /Draft price/);
  assert.match(sheet, /No payment is taken in the next step/);
  assert.match(form, /No payment is taken now/);
  assert.match(form, /Send order request/);
  assert.doesNotMatch(page + sheet + form, /Buy now|Pay now|Add to cart|Checkout now/i);
  // The sheet is a real modal dialog, Back closes it, and the order form survives going back to the details.
  assert.match(sheet, /showModal\(\)/);
  assert.match(page, /addEventListener\('popstate'/);
  assert.match(sheet, /stays mounted once opened/);
  // No invented proof.
  assert.doesNotMatch(page + sheet, /testimonial|★|rated|trusted by \d|clients served/i);
});
