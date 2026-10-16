import assert from 'node:assert/strict';
import { test, before, after, beforeEach } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { apiRouter } from '../../routes/api.js';
import { FulfilmentService } from '../../services/fulfilmentService.js';
import { PaystackServerService } from '../../services/paystackService.js';
import { OrdersStore } from '../../db/ordersStore.js';

// Isolated fixtures only: an in-memory supplier catalogue, a stubbed Paystack, no network.
const provider = FulfilmentService.getProvider();
const client = provider.client as any;
const originals = { check: client.checkInstantBundlesService, list: client.getInstantBundles, init: PaystackServerService.initializeTransaction, fetch: globalThis.fetch };
const FLEXI = { id: 'flexi-fixture', name: 'Flexi fixture', network: 'mtn', isFlexi: true, mode: 'flexi', minAmountMajor: 2, maxAmountMajor: 300, enabled: true };
let catalogue: any[] = [];
let charged: number | null = null;
let server: Server; let base = '';

before(async () => {
  const app = express(); app.use(express.json()); app.use('/api', apiRouter);
  server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  await new Promise<void>(r => server.close(() => r()));
  client.checkInstantBundlesService = originals.check; client.getInstantBundles = originals.list;
  PaystackServerService.initializeTransaction = originals.init; globalThis.fetch = originals.fetch;
});
beforeEach(() => {
  process.env.NODE_ENV = 'test'; delete process.env.DATABASE_URL; OrdersStore.clearDevStore();
  catalogue = [{ ...FLEXI, payableRatio: 0.95 }];
  client.checkInstantBundlesService = async () => ({ permitted: true, available: true });
  client.getInstantBundles = async () => ({ data: catalogue });
  charged = null;
  PaystackServerService.initializeTransaction = (async (p: any) => { charged = p.amountPesewas ?? p.amount; return { success: true, reference: p.reference, accessCode: 'fixture', authorizationUrl: 'https://checkout.paystack.com/fixture' }; }) as any;
  globalThis.fetch = async () => { throw new Error('External network prohibited'); };
});
const quote = (key: string, amount: string | number) => originals.fetch(`${base}/api/instant-bundles/${key}/quote?amount=${amount}`).then(async r => ({ status: r.status, body: await r.json() }));

test('Flexi quote equals the amount payment initialization charges, for several payable ratios', async () => {
  for (const ratio of [0.9, 0.95, 1, 1.1]) {
    catalogue = [{ ...FLEXI, payableRatio: ratio }];
    for (const amount of [2, 10, 49.5, 300]) {
      const q = await quote('instant-flexi-fixture', amount);
      assert.equal(q.status, 200);
      assert.equal(q.body.success, true);
      const init = await originals.fetch(`${base}/api/payments/initialize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: 'instant-flexi-fixture', serviceType: 'instant_bundle', network: 'mtn', recipientPhone: '0241234567', customerEmail: 'fixture@example.test', amount }) });
      const initBody = await init.json();
      assert.equal(init.status, 200, JSON.stringify(initBody));
      assert.equal(initBody.amountPesewas, q.body.totalPesewas, `ratio ${ratio} amount ${amount}`);
      assert.equal(charged, q.body.totalPesewas);
      assert.equal(Number((q.body.retailPriceGhc + q.body.paymentProcessingFeeGhc).toFixed(2)), q.body.totalGhc);
    }
  }
});

test('Flexi quote exposes only public totals and rejects bad amounts, fixed packages and missing ones', async () => {
  const q = await quote('instant-flexi-fixture', 20);
  assert.deepEqual(Object.keys(q.body).sort(), ['amountGhc', 'paymentProcessingFeeGhc', 'productKey', 'retailPriceGhc', 'success', 'totalGhc', 'totalPesewas']);
  assert.equal((await quote('instant-flexi-fixture', 1)).status, 400, 'below minimum');
  assert.equal((await quote('instant-flexi-fixture', 301)).status, 400, 'above maximum');
  assert.equal((await quote('instant-flexi-fixture', 'abc')).status, 400);
  assert.equal((await quote('instant-missing', 20)).status, 404);
  catalogue = [{ id: 'fixed', name: '1GB', network: 'mtn', priceMinor: 500, enabled: true }];
  assert.equal((await quote('instant-fixed', 20)).status, 400);
  client.checkInstantBundlesService = async () => ({ permitted: true, available: false, reason: 'Paused' });
  assert.equal((await quote('instant-flexi-fixture', 20)).status, 503);
});

test('checkout waits for the server Flexi quote before offering Pay and sends the typed amount', () => {
  const modal = readFileSync('src/components/checkout/CheckoutModal.tsx', 'utf8');
  assert.match(modal, /getInstantFlexiQuote\(/);
  assert.match(modal, /flexiPending\}/, 'Pay is disabled while the quote is pending or failed');
  assert.match(modal, /amount: requestedAmount/);
  assert.doesNotMatch(modal, /estimateInstantCheckoutFeeGhc|Checkout fee \(estimate\)/, 'no client-side estimate reaches checkout');
});
