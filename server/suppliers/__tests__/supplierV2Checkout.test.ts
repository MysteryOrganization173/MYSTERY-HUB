import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { apiRouter } from '../../routes/api.js';
import { FulfilmentService } from '../../services/fulfilmentService.js';
import { PaystackServerService } from '../../services/paystackService.js';
import { OrdersStore } from '../../db/ordersStore.js';

// Canonical numeric package from Instant Bundles / response.json in the snapshot.
const fixed = { id: 12, name: 'MTN 1GB Instant', network: 'MTN', isFlexi: false,
  mode: 'fixed', priceMinor: '450', payableRatio: null, minAmountMajor: null,
  maxAmountMajor: null, dataAmount: '1GB', validity: '30 days' };
const environment = { ...process.env }, realFetch = globalThis.fetch;
const originalInit = PaystackServerService.initializeTransaction;
const client = FulfilmentService.getProvider().client;
let server: Server, base: string, packages: any[], payments: number, supplierPosts: number;
let supplierUnavailable: boolean, catalogAvailable: boolean;
let transformServices: (data: any) => any;
before(async () => {
  const app = express(); app.use(express.json()); app.use('/api', apiRouter);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => {
  process.env.NODE_ENV = 'test'; delete process.env.DATABASE_URL;
  process.env.SUCCESS_BIZ_HUB_API_KEY = 'synthetic-contract-key';
  process.env.SUCCESS_BIZ_HUB_BASE_URL = 'https://supplier.invalid/v2';
  process.env.SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED = 'true';
  client.clearCache(); OrdersStore.clearDevStore(); packages = [{ ...fixed }];
  payments = 0; supplierPosts = 0; supplierUnavailable = false; catalogAvailable = true;
  transformServices = data => data;
  PaystackServerService.initializeTransaction = async p => {
    payments++; return { success: true, reference: p.reference, accessCode: 'synthetic', authorizationUrl: 'https://checkout.invalid/synthetic' };
  };
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input)); assert.equal(url.origin, 'https://supplier.invalid');
    if (options?.method === 'POST' && url.pathname !== '/v2/beneficiary-check') {
      supplierPosts++; throw new Error('Supplier submissions prohibited');
    }
    let data: unknown;
    if (url.pathname === '/v2/services') {
      if (supplierUnavailable) throw new DOMException('Synthetic timeout', 'AbortError');
      data = { accountId: 'synthetic', keyPermissions: { orders: true, airtime: true, instant_bundles: true },
        services: ['orders', 'airtime', 'instant_bundles'].map(id => ({ id, keyGranted: true, available: true, productCount: 3 })) };
      data = transformServices(data);
    } else if (url.pathname === '/v2/instant-bundles') data = { available: catalogAvailable, flexiPayRatio: '1', packages };
    else if (url.pathname === '/v2/catalog') data = { offers: [{ id: 'offer-synthetic', slug: 'mtn-data',
      offerSlug: 'mtn_data', name: 'MTN Data', network: 'MTN', kind: 'data',
      packages: [{ id: 'pkg-synthetic', sizeLabel: '1GB', volumeMb: 1000, priceMinor: '450' }] }] };
    else if (url.pathname === '/v2/wallet') data = { availableMinor: '50000', currency: 'GHS' };
    else if (url.pathname === '/v2/beneficiary-check') data = { results: [{ phone: '0241234567', eligible: true }] };
    else throw new Error('Unexpected supplier endpoint');
    return new Response(JSON.stringify({ success: true, data }));
  };
});
afterEach(() => {
  client.clearCache(); globalThis.fetch = realFetch; PaystackServerService.initializeTransaction = originalInit;
  for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
  Object.assign(process.env, environment);
  assert.equal(supplierPosts, 0);
});
const initialize = async (body: object = {}) => {
  const response = await realFetch(`${base}/api/payments/initialize`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'instant-12', serviceType: 'instant_bundle',
      recipientPhone: '0241234567', customerEmail: 'synthetic@example.test', ...body }) });
  return { status: response.status, body: await response.json() };
};
test('documented fixed package without optional availability flags remains payable', async () => {
  assert.equal((await initialize()).status, 200); assert.equal(payments, 1);
});
for (const [name, fields] of [['explicitly available', { enabled: true, available: true }],
  ['out of stock', { enabled: true, available: false }], ['disabled', { enabled: false, available: true }]] as const) {
  test(`Instant package: ${name}`, async () => {
    packages = [{ ...fixed, ...fields }];
    const result = await initialize();
    assert.equal(result.status, name === 'explicitly available' ? 200 : 404);
    assert.equal(payments, name === 'explicitly available' ? 1 : 0);
  });
}
test('missing Instant package blocks payment', async () => {
  packages = []; assert.equal((await initialize()).status, 404); assert.equal(payments, 0);
});
test('catalogue-level available:false blocks payment and is not cached over recovery', async () => {
  catalogAvailable = false; assert.equal((await initialize()).status, 503); assert.equal(payments, 0);
  catalogAvailable = true; assert.equal((await initialize()).status, 200); assert.equal(payments, 1);
});
test('valid Flexi package works and invalid amounts remain rejected', async () => {
  packages = [{ ...fixed, isFlexi: true, mode: 'flexi', payableRatio: 0.95, minAmountMajor: 2, maxAmountMajor: 300 }];
  assert.equal((await initialize({ amount: 1 })).status, 400); assert.equal(payments, 0);
  assert.equal((await initialize({ amount: 20 })).status, 200); assert.equal(payments, 1);
});
test('unavailable Flexi package cannot be quoted or charged', async () => {
  packages = [{ ...fixed, isFlexi: true, mode: 'flexi', minAmountMajor: 2, maxAmountMajor: 300, available: false }];
  assert.equal((await realFetch(`${base}/api/instant-bundles/instant-12/quote?amount=20`)).status, 404);
  assert.equal((await initialize({ amount: 20 })).status, 404); assert.equal(payments, 0);
});
test('supplier timeout blocks payment and recovery permits a legitimate purchase', async () => {
  supplierUnavailable = true; assert.equal((await initialize()).status, 503); assert.equal(payments, 0);
  supplierUnavailable = false; assert.equal((await initialize()).status, 200); assert.equal(payments, 1);
});
test('valid documented regular data preflight remains payable', async () => {
  assert.equal((await initialize({ productId: 'mtn-1gb', serviceType: 'data' })).status, 200);
  assert.equal(payments, 1);
});
for (const service of ['orders', 'airtime', 'instant_bundles']) {
  test(`${service}: denied discovery prevents both order creation and payment initialization`, async () => {
    transformServices = data => ({ ...data, keyPermissions: { ...data.keyPermissions, [service]: false } });
    const body = service === 'orders' ? { productId: 'mtn-1gb', serviceType: 'data' }
      : service === 'airtime' ? { productId: 'airtime-mtn', serviceType: 'airtime', network: 'mtn', amount: 10 } : {};
    assert.equal((await initialize(body)).status, 503);
    assert.equal(payments, 0); assert.equal(OrdersStore.adminDevOrders().length, 0);
  });
}
