import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { OrdersStore } from '../../db/ordersStore.js';
import { AuthStore } from '../../db/authStore.js';
import { FinanceStore } from '../../db/financeStore.js';
import { apiRouter, handlePaystackWebhook } from '../../routes/api.js';
import { PaystackServerService } from '../../services/paystackService.js';
import { FulfilmentService } from '../../services/fulfilmentService.js';
import { paymentOrder as order } from './paymentFixtures.js';
import type { OrderRecord } from '../../types/orders.js';


test('provider initialization uses only matching durable main telecom orders', async t => {
  assert.equal(process.env.DATABASE_URL, undefined);
  OrdersStore.clearDevStore();
  t.mock.method(PaystackServerService as any, 'getSecretKey', () => 'synthetic-test-key');
  const transport = t.mock.method(globalThis, 'fetch', async (url: string, request: { method: string; headers: Record<string,string>; body: string }) => {
    assert.equal(url, 'https://api.paystack.co/transaction/initialize');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.Authorization, 'Bearer synthetic-test-key');
    const body = JSON.parse(request.body);
    assert.equal(body.email, 'buyer@example.test');
    assert.equal(body.amount, 500);
    assert.equal(body.currency, 'GHS');
    return Response.json({ status: true, data: { reference: body.reference, access_code: 'fixture' } });
  });
  const data = order();
  for (const record of [data,
    order({ service_type: 'instant_bundle', product_id: 'instant-fixture', payment_reference: 'MH_PAY_INSTANT_MTN_1790000000000_120001' }),
    order({ service_type: 'airtime', product_id: 'airtime-mtn-4.5', face_value_minor: 450, payment_reference: 'MH_PAY_AIRTIME_MTN_1790000000000_120002' }),
  ]) {
    await OrdersStore.createOrder(record);
    const result = await PaystackServerService.initializeTransaction({ email: record.customer_email, amountPesewas: record.amount, reference: record.payment_reference });
    assert.equal(result.accessCode, 'fixture');
  }
  for (const record of [
    order({ service_type: 'marketplace', product_id: 'mp_fixture' }),
    order({ service_type: 'afa' }),
    order({ service_type: 'results_checker' }),
    order({ service_type: undefined }),
    order({ product_id: 'not-in-catalogue' }),
    order({ payment_reference: 'MH_STORE_fixture' }),
    order({ store_context: { siteId: 'fixture' } as OrderRecord['store_context'] }),
    order({ status: 'paid', payment_status: 'success' }),
  ]) {
    await OrdersStore.createOrder(record);
    const result = await PaystackServerService.initializeTransaction({ email: record.customer_email, amountPesewas: record.amount, reference: record.payment_reference, metadata: { service_type: 'data' } });
    assert.equal(result.success, false);
  }
  const options = { reference: data.payment_reference, email: data.customer_email, amountPesewas: data.amount };
  for (const forged of [
    { reference: 'MH-WALLET-fixture' }, { reference: data.public_reference }, { amountPesewas: 501 },
    { email: 'different@example.test' }, { metadata: { purpose: 'website_store_order' } },
    { metadata: { service_type: 'marketplace' } },
  ]) assert.equal((await PaystackServerService.initializeTransaction({ ...options, ...forged })).success, false);
  assert.equal(transport.mock.callCount(), 3);
});

test('new blocked checkouts reject before any order, supplier or finance write and preserve a historical signed callback', async t => {
  assert.equal(process.env.DATABASE_URL, undefined);
  OrdersStore.clearDevStore(); AuthStore._clearDevStore(); FinanceStore._reset();
  await AuthStore.createUser({ id: 'fixture', name: 'Fixture', email: 'buyer@example.test', phone: null, role: 'customer', passwordHash: 'fixture' });
  await AuthStore.createSession('fixture', 'fixture-token');
  const initialize = t.mock.method(PaystackServerService, 'initializeTransaction', async () => assert.fail('unexpected payment initialization'));
  const preflight = t.mock.method(FulfilmentService, 'preflightCheck', async () => assert.fail('unexpected supplier preflight'));
  const dispatch = t.mock.method(FulfilmentService, 'processPaidOrder', async () => ({ order: null, alreadyHandled: true }));
  t.mock.method(PaystackServerService as any, 'getSecretKey', () => 'synthetic-test-key');
  const app = express();
  app.use(express.json({ verify: (req, _res, body) => { (req as any).rawBody = body; } }));
  app.post('/api/webhooks/paystack', handlePaystackWebhook);
  app.use('/api', apiRouter);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const post = (path: string, input: object, authorized = true) => fetch(base + path, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(authorized ? { authorization: 'Bearer fixture-token' } : {}) },
    body: JSON.stringify(input),
  });
  try {
    const fields = { recipientPhone: '0241234567', customerEmail: 'buyer@example.test', requestId: crypto.randomUUID(), metadata: { service_type: 'data' } };
    const cases: [string, object][] = [
      ['/payments/initialize', { productId: 'mp_fixture', serviceType: 'data' }],
      ['/payments/initialize', { productId: 'mtn-1gb', serviceType: 'marketplace' }],
      ['/payments/initialize', { productId: 'mtn-1gb', serviceType: 'data', storeId:'site_fixture' }],
      ['/payments/initialize', { productId: 'mtn-1gb', serviceType: 'website_upgrade' }],
      ['/payments/initialize', { productId: 'mtn-1gb', serviceType: 'creative_studio' }],
      ['/payments/initialize', { productId: 'mtn-1gb', serviceType: 'unrecognized' }],
      ['/payments/initialize', { productId: 'afa-registration', serviceType: 'data', paymentMethod: 'wallet' }],
      ['/payments/initialize', { productId: 'results-checker-bece', serviceType: 'data' }],
      ['/afa/payments/initialize', { productId: 'mtn-1gb', serviceType: 'data', paymentMethod: 'wallet' }],
      ['/results-checkers/payments/initialize', { product: 'bece', qty: 1 }],
      ['/websites/site_fixture/store-checkout', { productId: 'mtn-1gb' }],
      ['/finance/topups', { amountMinor: 500 }],
    ];
    for (const [path, input] of cases) {
      const response = await post(path, { ...fields, ...input });
      assert.equal(response.status, 503, path);
      assert.equal((await response.json()).code, 'PAYMENT_UNAVAILABLE', path);
    }
    for (const path of ['/creative-studio/payments/initialize','/websites/upgrade/checkout']) assert.equal((await post(path, fields)).status, 404);
    assert.equal((await post('/finance/topups', fields, false)).status, 401);
    assert.equal((await post('/afa/payments/initialize', fields, false)).status, 401);
    assert.equal((await post('/results-checkers/payments/initialize', fields, false)).status, 401);
    assert.equal(initialize.mock.callCount(), 0);
    assert.equal(preflight.mock.callCount(), 0);
    assert.equal(OrdersStore.adminDevOrders().length, 0);
    assert.equal((await FinanceStore.read('fixture', tx => tx.operations())).length, 0);

    const legacy = order({ service_type: 'marketplace', product_id: 'mp_fixture' });
    await OrdersStore.createOrder(legacy);
    const body = JSON.stringify({ event: 'charge.success', data: { reference: legacy.payment_reference, amount: legacy.amount, status: 'success', currency: 'GHS' } });
    const signature = crypto.createHmac('sha512', 'synthetic-test-key').update(body).digest('hex');
    const response = await fetch(base + '/webhooks/paystack', { method: 'POST', headers: { 'content-type': 'application/json', 'x-paystack-signature': signature }, body });
    assert.equal(response.status, 200);
    assert.equal(dispatch.mock.callCount(), 1);
    assert.equal(dispatch.mock.calls[0].arguments[0], legacy.payment_reference);
    assert.equal(initialize.mock.callCount(), 0);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
