import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SuccessBizHubClient } from '../successBizHub/client.js';
import { FulfilmentService } from '../../services/fulfilmentService.js';
import { PaystackServerService } from '../../services/paystackService.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { apiRouter } from '../../routes/api.js';

// Synthetic supplier, memory database, stubbed payment gateway. No external requests.
const environment = { ...process.env };
const realFetch = globalThis.fetch;
const originalInit = PaystackServerService.initializeTransaction;
const client = FulfilmentService.getProvider().client;
const catalog = { status: 'success', data: [{ name: 'Fixture data', kind: 'data', network: 'MTN', slug: 'fixture-data', packages: [{ id: 'fixture-2gb', sizeLabel: '2GB', priceMinor: 100 }] }] };
const services = { status: 'success', data: { services: [{ kind: 'data', available: true, enabled: true }] } };
let calls: string[];
let payments: number;
let server: Server;
let base: string;

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const abortError = () => new DOMException('Synthetic abort', 'AbortError');
const isTimeout = (error: unknown) => (error as { isTimeout?: boolean }).isTimeout === true;
function supplierFetch(override?: (path: string, options?: RequestInit) => Response | Promise<Response> | undefined) {
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://supplier.invalid', 'external requests prohibited');
    const path = url.pathname.replace('/v2', '');
    calls.push(path);
    const result = override?.(path, options);
    if (result) return result;
    if (path === '/services') return json(services);
    if (path === '/catalog') return json(catalog);
    if (path === '/wallet') return json({ data: { currency: 'GHS', availableMinor: 100_000 } });
    if (path === '/beneficiary-check') return json({ data: { eligible: true } });
    throw new Error('Unexpected supplier operation');
  };
}

before(async () => {
  const app = express(); app.use(express.json()); app.use('/api', apiRouter);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => {
  process.env.NODE_ENV = 'test';
  delete process.env.DATABASE_URL;
  process.env.SUCCESS_BIZ_HUB_BASE_URL = 'https://supplier.invalid/v2';
  process.env.SUCCESS_BIZ_HUB_API_KEY = 'synthetic-key';
  process.env.SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED = 'true';
  process.env.SUCCESS_BIZ_HUB_REQUEST_TIMEOUT_MS = '15000';
  process.env.PAYSTACK_SECRET_KEY = 'sk_live_synthetic_only';
  client.clearCache(); OrdersStore.clearDevStore(); calls = []; payments = 0;
  supplierFetch();
  PaystackServerService.initializeTransaction = async params => {
    payments++;
    return { success: true, reference: params.reference, accessCode: 'synthetic', authorizationUrl: 'https://checkout.invalid/synthetic' };
  };
});
afterEach(() => {
  client.clearCache(); globalThis.fetch = realFetch;
  PaystackServerService.initializeTransaction = originalInit;
  for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
  Object.assign(process.env, environment);
});

const initialize = async (body: Record<string, unknown> = {}) => {
  const response = await realFetch(`${base}/api/payments/initialize`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'mtn-2gb', recipientPhone: '0241234567', customerEmail: 'incident@example.test', ...body }),
  });
  return { status: response.status, body: await response.json() };
};

test('services header timeout fires at 15000ms; failures are not cached and recovery succeeds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal: AbortSignal;
  supplierFetch((_path, options) => new Promise((_resolve, reject) => {
    signal = options!.signal!;
    signal.addEventListener('abort', () => reject(abortError()), { once: true });
  }));
  const pending = client.getServices();
  const rejected = assert.rejects(pending, isTimeout);
  t.mock.timers.tick(14999); assert.equal(signal!.aborted, false);
  t.mock.timers.tick(1); assert.equal(signal!.aborted, true);
  await rejected;
  supplierFetch();
  assert.deepEqual(await client.getServices(), services);
  assert.equal(calls.length, 2, 'timeout must not poison the cache or trigger automatic retries');
});

test('services body stays under the original deadline after headers; no stale cache entry is written', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal: AbortSignal;
  let bodyStarted!: () => void;
  const started = new Promise<void>(resolve => { bodyStarted = resolve; });
  supplierFetch((_path, options) => {
    signal = options!.signal!;
    return new Response(new ReadableStream({ start(controller) {
      signal.addEventListener('abort', () => controller.error(abortError()), { once: true });
      bodyStarted();
    } }));
  });
  const pending = client.getServices();
  const rejected = assert.rejects(pending, isTimeout);
  await started; await Promise.resolve();
  t.mock.timers.tick(14999); assert.equal(signal!.aborted, false);
  t.mock.timers.tick(1); assert.equal(signal!.aborted, true, 'headers must not clear the deadline');
  await rejected;
  supplierFetch(); assert.deepEqual(await client.getServices(), services);
});

test('a complete response just before the deadline succeeds and does not abort later', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let stream!: ReadableStreamDefaultController;
  let signal!: AbortSignal;
  supplierFetch((_path, options) => {
    signal = options!.signal!;
    return new Response(new ReadableStream({ start(controller) { stream = controller; } }));
  });
  const pending = client.getServices();
  await Promise.resolve(); t.mock.timers.tick(14999);
  stream.enqueue(new TextEncoder().encode(JSON.stringify(services))); stream.close();
  assert.deepEqual(await pending, services);
  t.mock.timers.tick(1); assert.equal(signal.aborted, false, 'completed requests release their timer');
  await client.getServices(); assert.equal(calls.length, 1);
});

test('cached catalog cannot authorize payment while services times out; recovery can initialize once', async () => {
  await client.getCatalog();
  supplierFetch(path => { if (path === '/services') throw abortError(); });
  const failed = await initialize();
  assert.equal(failed.status, 503); assert.equal(failed.body.code, 'SERVICE_TEMPORARILY_UNAVAILABLE');
  assert.equal(payments, 0); assert.equal(OrdersStore.adminDevOrders().length, 0);
  assert.equal(calls.filter(path => path === '/catalog').length, 1);
  assert.ok(!calls.includes('/beneficiary-check')); assert.ok(!calls.includes('/wallet'));
  supplierFetch();
  assert.equal((await initialize()).status, 200); assert.equal(payments, 1);
  assert.equal(OrdersStore.adminDevOrders().length, 1);
  assert.ok(calls.includes('/beneficiary-check')); assert.ok(calls.includes('/wallet'));
  assert.ok(!calls.includes('/orders'), 'initialization never submits a supplier order');
});

test('unreachable, rejected and explicitly disabled services all fail before payment', async () => {
  for (const mode of ['network', 'forbidden', 'disabled']) {
    client.clearCache();
    supplierFetch(path => {
      if (path !== '/services') return;
      if (mode === 'network') throw new TypeError('Synthetic connection failure');
      if (mode === 'forbidden') return json({ message: 'Synthetic permission denied' }, 403);
      return json({ data: [{ kind: 'data', enabled: false, available: false }] });
    });
    const failed = await initialize();
    assert.equal(failed.status, 503, mode);
    assert.equal(failed.body.code, 'SERVICE_TEMPORARILY_UNAVAILABLE', mode);
    assert.equal(payments, 0); assert.equal(OrdersStore.adminDevOrders().length, 0);
  }
});

test('beneficiary and wallet protections still block initialization', async () => {
  supplierFetch(path => path === '/beneficiary-check' ? json({ data: { eligible: false } }) : undefined);
  const beneficiary = await initialize();
  assert.equal(beneficiary.status, 400); assert.equal(beneficiary.body.code, 'BENEFICIARY_NOT_ELIGIBLE');
  client.clearCache();
  supplierFetch(path => path === '/wallet' ? json({ data: { currency: 'GHS', availableMinor: 0 } }) : undefined);
  const wallet = await initialize();
  assert.equal(wallet.status, 503); assert.equal(wallet.body.code, 'SUPPLIER_WALLET_LOW');
  assert.equal(payments, 0); assert.equal(OrdersStore.adminDevOrders().length, 0);
});

test('airtime services timeout returns temporary unavailability without opening payment', async () => {
  supplierFetch(path => { if (path === '/services') throw abortError(); });
  const failed = await initialize({ productId: 'airtime-mtn', serviceType: 'airtime', network: 'mtn', amount: 10 });
  assert.equal(failed.status, 503); assert.equal(failed.body.code, 'SERVICE_TEMPORARILY_UNAVAILABLE');
  assert.equal(payments, 0);
});

test('regular data availability does not imply Instant Bundle permission or availability', async () => {
  assert.equal((await client.checkInstantBundlesService()).available, false);
  assert.equal((await initialize({ productId: 'instant-fixture', serviceType: 'instant_bundle' })).status, 503);
  assert.equal(payments, 0);
  client.clearCache();
  supplierFetch(path => { if (path === '/services') throw abortError(); });
  const failed = await initialize({ productId: 'instant-fixture', serviceType: 'instant_bundle' });
  assert.equal(failed.status, 503); assert.equal(failed.body.code, 'SERVICE_TEMPORARILY_UNAVAILABLE');
  assert.match(failed.body.message, /No payment has been taken/);
  assert.doesNotMatch(failed.body.message, /standard Data|synthetic|timed out|key/);
  assert.equal(payments, 0);
});

for (const serviceType of ['data', 'airtime', 'instant_bundle'] as const) {
test(`${serviceType}: a stalled submission body remains uncertain with exactly one POST`, async t => {
  const initialized = await initialize();
  assert.equal(initialized.status, 200);
  const order = { ...OrdersStore.adminDevOrders()[0], service_type: serviceType, face_value_minor: 1000 };
  OrdersStore.clearDevStore(); await OrdersStore.createOrder(order);
  const endpoint = serviceType === 'data' ? '/orders' : serviceType === 'airtime' ? '/airtime' : '/instant-bundles';
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let bodyStarted!: () => void;
  const started = new Promise<void>(resolve => { bodyStarted = resolve; });
  supplierFetch((path, options) => {
    if (path !== endpoint) return;
    return new Response(new ReadableStream({ start(controller) {
      options!.signal!.addEventListener('abort', () => controller.error(abortError()), { once: true });
      bodyStarted();
    } }));
  });
  const pending = FulfilmentService.processPaidOrder(order.payment_reference, new Date().toISOString());
  await started; await Promise.resolve(); t.mock.timers.tick(15000);
  const result = await pending;
  assert.equal(result.order?.status, 'queued');
  assert.equal(result.order?.failure_reason, 'supplier_submission_uncertain');
  await FulfilmentService.processPaidOrder(order.payment_reference, new Date().toISOString());
  assert.equal(calls.filter(path => path === endpoint).length, 1, 'uncertain submission must never be retried');
});
}
