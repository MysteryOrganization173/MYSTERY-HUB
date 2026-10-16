/**
 * Admin marketplace product photos (signed direct Cloudinary upload) and
 * Mystery AI pickup/delivery extraction. Cloudinary is mocked; no real upload happens.
 */
import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { adminRouter } from '../../routes/adminApi.js';
import { AuthStore } from '../../db/authStore.js';
import { MarketplaceAssetStore } from '../../db/marketplaceAssetStore.js';
import { WebsiteCloudinary } from '../../services/websiteCloudinary.js';
import { extractProductHeuristically, extractLocations, groundAiExtraction, sanitizeExtractionResult } from '../../services/marketplaceAiImporter.js';

let server: Server, base: string;
const realFetch = globalThis.fetch;
let cloudinaryResource: Record<string, unknown> | null = null;
let cloudinaryCalls: string[] = [];

before(async () => {
  delete process.env.DATABASE_URL; process.env.NODE_ENV = 'test';
  const app = express(); app.use(express.json()); app.use('/api/admin', adminRouter);
  server = await new Promise<Server>(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('https://api.cloudinary.com/')) {
      cloudinaryCalls.push(url);
      return cloudinaryResource ? new Response(JSON.stringify(cloudinaryResource), { status: 200 }) : new Response('{}', { status: 404 });
    }
    return realFetch(input, init);
  }) as typeof fetch;
});
after(async () => { globalThis.fetch = realFetch; await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(async () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'synthetic-cloud'; process.env.CLOUDINARY_API_KEY = 'synthetic-key'; process.env.CLOUDINARY_API_SECRET = 'synthetic-secret-never-sent';
  delete process.env.MARKETPLACE_IMAGE_MAX_BYTES;
  cloudinaryResource = null; cloudinaryCalls = [];
  AuthStore._clearDevStore(); MarketplaceAssetStore.clearDevStore();
  for (const [id, role] of [['admin', 'admin'], ['admin2', 'admin'], ['customer', 'customer']] as const) {
    await AuthStore.createUser({ id, name: id, email: `${id}@example.test`, phone: null, passwordHash: 'synthetic-not-a-password', role });
    await AuthStore.createSession(id, `${id}-fixture-session`);
  }
});
const call = (path: string, body?: unknown, token = 'admin-fixture-session') => fetch(`${base}/api/admin/marketplace/media${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const reserve = async (token = 'admin-fixture-session') => { const res = await call('/upload-intent', { filename: 'laptop.jpg', mime: 'image/jpeg', bytes: 250_000 }, token); return { res, body: await res.json() }; };
const resourceFor = (publicId: string, extra: Record<string, unknown> = {}) => ({ public_id: publicId, resource_type: 'image', type: 'upload', format: 'jpg', bytes: 240_000, width: 1600, height: 1200, secure_url: 'https://evil.example/x.jpg', version: 1700000000, ...extra });

test('customers and signed-out callers cannot reserve uploads', async () => {
  assert.equal((await reserve('customer-fixture-session')).res.status, 403);
  assert.equal((await reserve('')).res.status, 401);
});

test('upload intent is signed server-side with a fixed marketplace public ID and never exposes the secret', async () => {
  const { res, body } = await reserve();
  assert.equal(res.status, 201);
  const intent = body.intent;
  assert.match(intent.parameters.public_id, /^mysteryhub\/marketplace\/products\/asset_[0-9a-f-]{36}$/);
  assert.equal(intent.parameters.overwrite, 'false');
  assert.equal(intent.parameters.allowed_formats, 'jpg,png,webp');
  assert.equal(intent.uploadUrl, 'https://api.cloudinary.com/v1_1/synthetic-cloud/image/upload');
  assert.match(intent.signature, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(body).includes('synthetic-secret-never-sent'));
});

test('invalid files are rejected before anything is reserved', async () => {
  for (const bad of [{ filename: 'x.gif', mime: 'image/gif', bytes: 10 }, { filename: '../x.jpg', mime: 'image/jpeg', bytes: 10 }, { filename: 'x.jpg', mime: 'image/jpeg', bytes: 0 }, { filename: 'x.jpg', mime: 'image/jpeg', bytes: 10, publicId: 'hijack' }]) {
    assert.equal((await call('/upload-intent', bad)).status, 400, JSON.stringify(bad));
  }
  const big = await call('/upload-intent', { filename: 'x.jpg', mime: 'image/jpeg', bytes: 9 * 1024 * 1024 });
  assert.equal(big.status, 413);
  assert.equal((await MarketplaceAssetStore.recent()).length, 0);
});

test('missing Cloudinary configuration fails clearly and reserves nothing', async () => {
  delete process.env.CLOUDINARY_API_SECRET;
  const { res, body } = await reserve();
  assert.equal(res.status, 503);
  assert.match(body.error, /unavailable/i);
  const library = await (await call('')).json();
  assert.equal(library.configured, false);
});

test('finalize verifies the image with Cloudinary and stores a URL we build ourselves', async () => {
  const { body } = await reserve();
  cloudinaryResource = resourceFor(body.intent.parameters.public_id);
  const res = await call(`/${body.intent.assetId}/finalize`, {});
  assert.equal(res.status, 200);
  const { asset } = await res.json();
  assert.equal(asset.url, `https://res.cloudinary.com/synthetic-cloud/image/upload/v1700000000/${body.intent.parameters.public_id}.jpg`);
  assert.ok(!asset.url.includes('evil.example'));
  assert.ok(cloudinaryCalls.some(url => url.includes(encodeURIComponent(body.intent.parameters.public_id))));
  // Idempotent: a second finalize returns the same verified asset without another provider call.
  const calls = cloudinaryCalls.length;
  assert.equal((await (await call(`/${body.intent.assetId}/finalize`, {})).json()).asset.url, asset.url);
  assert.equal(cloudinaryCalls.length, calls);
  const library = await (await call('')).json();
  assert.equal(library.assets.length, 1);
  assert.ok(!JSON.stringify(library).includes('public_id'));
});

test('finalize refuses metadata, other admins, wrong images and unsupported formats', async () => {
  const { body } = await reserve();
  assert.equal((await call(`/${body.intent.assetId}/finalize`, { url: 'https://evil.example/x.jpg' })).status, 400);
  assert.equal((await call(`/${body.intent.assetId}/finalize`, {}, 'admin2-fixture-session')).status, 404);
  cloudinaryResource = resourceFor('mysteryhub/marketplace/products/asset_someone_else');
  assert.equal((await call(`/${body.intent.assetId}/finalize`, {})).status, 400);
  assert.equal((await MarketplaceAssetStore.find(body.intent.assetId))!.status, 'failed');
  const second = (await reserve()).body;
  cloudinaryResource = resourceFor(second.intent.parameters.public_id, { format: 'gif' });
  assert.equal((await call(`/${second.intent.assetId}/finalize`, {})).status, 400);
});

test('an expired intent cannot be finalized', async () => {
  const { body } = await reserve();
  const asset = (await MarketplaceAssetStore.find(body.intent.assetId))!;
  (MarketplaceAssetStore as any).clearDevStore();
  await (MarketplaceAssetStore as any).insert({ ...asset, expires_at: new Date(Date.now() - 1000).toISOString() });
  cloudinaryResource = resourceFor(body.intent.parameters.public_id);
  assert.equal((await call(`/${body.intent.assetId}/finalize`, {})).status, 409);
});

test('marketplace_assets schema is additive and mirrored in schema.sql', () => {
  const schema = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8');
  const code = readFileSync(new URL('../../db/marketplaceAssetSchema.ts', import.meta.url), 'utf8');
  assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS marketplace_assets ('));
  assert.ok(code.includes('CREATE TABLE IF NOT EXISTS marketplace_assets ('));
  assert.ok(!/DROP|ALTER TABLE marketplace_products/i.test(code));
});

const ADVERT = `iPhone 13 Pro 256GB – Neat UK used
Price: GHC 6,200
📍 Pickup: Kwame Nkrumah Circle, opposite the Vodafone office
Delivery within Accra available, nationwide via VIP bus
Call 0244000000`;

test('Mystery AI extracts only explicitly stated pickup points and delivery terms', () => {
  const result = extractProductHeuristically(ADVERT);
  assert.equal(result.pickupLocations.length, 1);
  assert.equal(result.pickupLocations[0].city, ''); // The pickup quote does not state a city.
  assert.equal(result.pickupLocations[0].area, 'Kwame Nkrumah Circle');
  assert.ok(ADVERT.includes(result.pickupLocations[0].evidence.replace('Pickup: ', '')));
  assert.equal(result.delivery.available, true);
  assert.deepEqual(result.delivery.areas, ['Accra', 'Nationwide']);
  assert.ok(!JSON.stringify(result.pickupLocations).includes('0244000000'));
});

test('no location is invented when the advert states none', () => {
  const result = extractProductHeuristically('HP EliteBook 840 G8\nPrice: GHC 4,100\nFree Delivery Nationwide');
  assert.deepEqual(result.pickupLocations, []);
  assert.equal(result.delivery.available, true);
  assert.ok(result.warnings.some(w => /free delivery/i.test(w)));
  assert.ok(!JSON.stringify(result).includes('Accra Pickup Hub'));
});

test('pickup-only adverts mark delivery unavailable and shop locations carry a confirmation warning', () => {
  const located = extractLocations('Laptop GHC 3000\nLocation: Adum, Kumasi\nPickup only');
  assert.equal(located.pickupLocations[0].city, 'Kumasi');
  assert.equal(located.pickupLocations[0].area, 'Adum');
  assert.equal(located.delivery.available, false);
  assert.ok(located.warnings.some(w => /confirm customers can pick up/i.test(w)));
});

test('AI locations without an exact advert quote are removed', () => {
  const ai = sanitizeExtractionResult({ name: 'iPhone 13 Pro', priceGhc: 6200, pickupLocations: [{ name: 'Accra Mall', city: 'Accra', area: 'Tetteh Quarshie', evidence: 'Pickup at Accra Mall' }], delivery: { available: true, areas: ['Accra', 'Kumasi'], evidence: 'Delivery within Accra available, nationwide via VIP bus' } });
  const grounded = groundAiExtraction(ai, ADVERT);
  assert.ok(!grounded.pickupLocations.some(l => l.name === 'Accra Mall'));
  assert.equal(grounded.pickupLocations[0].area, 'Kwame Nkrumah Circle');
  assert.deepEqual(grounded.delivery.areas, ['Accra', 'Nationwide']);
  assert.ok(grounded.warnings.some(w => /pickup location the advert does not state/i.test(w)));
});

test('admin editor applies price options as purchasable options only, never as duplicate specifications', () => {
  const editor = readFileSync(new URL('../../../src/components/admin/sections/MarketplaceProductEditor.tsx', import.meta.url), 'utf8');
  assert.ok(!editor.includes('Config: '));
  assert.ok(!editor.includes('window.confirm'));
  assert.ok(editor.includes('capture="environment"'));
  assert.ok(!/CLOUDINARY_API_SECRET|api_secret/i.test(editor));
});

test('simultaneous reservations cannot exceed the per-admin pending limit', async () => {
  const requests = await Promise.all(Array.from({length: 32}, () => MarketplaceAssetStore.reserve('admin', {filename:'x.jpg',mime:'image/jpeg',bytes:100}).then(() => 201, (error: any) => error.status)));
  assert.equal(requests.filter(status => status === 201).length,24);
  assert.equal(requests.filter(status => status === 429).length,8);
});

test('finalization cannot cross the reservation expiry during provider inspection', async () => {
  const {body} = await reserve(); const realNow=Date.now, inspect=WebsiteCloudinary.inspect;
  const asset=(await MarketplaceAssetStore.find(body.intent.assetId))!;
  // The initial check passes but the verification completes beyond its capability window.
  Date.now=()=>Date.parse(asset.expires_at)-1;
  WebsiteCloudinary.inspect=async()=>{Date.now=()=>Date.parse(asset.expires_at)+1;return resourceFor(asset.public_id) as any;};
  try {await assert.rejects(()=>MarketplaceAssetStore.finalize('admin',asset.id),(error:any)=>error.status===409);}
  finally {Date.now=realNow;WebsiteCloudinary.inspect=inspect;}
  assert.equal((await MarketplaceAssetStore.find(body.intent.assetId))!.status,'pending');
});

test('concurrent repeated finalization returns one verified asset',async()=>{
 const {body}=await reserve();cloudinaryResource=resourceFor(body.intent.parameters.public_id);
 const results=await Promise.all(Array.from({length:6},()=>call(`/${body.intent.assetId}/finalize`,{})));
 assert.ok(results.every(r=>r.status===200));assert.equal((await MarketplaceAssetStore.recent()).length,1);
});

test('AI cannot borrow a city from delivery, invent nationwide delivery or reverse pickup-only terms',()=>{
 const advert='Camera GHC 3000\nPickup: Circle\nDelivery within Tema available';
 const ai=sanitizeExtractionResult({pickupLocations:[{name:'Circle',city:'Tema',area:'Circle',evidence:'Pickup: Circle'}],delivery:{available:true,areas:['Nationwide'],terms:'Free nationwide delivery',evidence:'Camera GHC 3000'}});
 const output=groundAiExtraction(ai,advert);assert.equal(output.pickupLocations[0].city,'');assert.deepEqual(output.delivery.areas,['Tema']);assert.doesNotMatch(output.delivery.terms,/free|nationwide/i);
 const only=groundAiExtraction(ai,'Camera GHC 3000\nPickup only');assert.equal(only.delivery.available,false);
 const none=groundAiExtraction(ai,'Camera GHC 3000');assert.equal(none.delivery.available,null);assert.deepEqual(none.pickupLocations,[]);
});

test('ordinary descriptive places are not AI-created pickup points',()=>{
 const result=groundAiExtraction(sanitizeExtractionResult({pickupLocations:[{name:'Accra',city:'Accra',area:'Circle',evidence:'Designed in Accra'}]}),'Camera GHC 3000\nDesigned in Accra\nDelivery to Circle');
 assert.deepEqual(result.pickupLocations,[]);
});
