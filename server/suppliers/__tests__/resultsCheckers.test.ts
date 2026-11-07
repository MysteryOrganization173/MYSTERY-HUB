import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { apiRouter } from '../../routes/api.js';
import { adminRouter } from '../../routes/adminApi.js';
import { AuthStore } from '../../db/authStore.js';
import { AdminAuditStore } from '../../db/adminAuditStore.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { ReferralStore } from '../../db/referralStore.js';
import { FinanceStore } from '../../db/financeStore.js';
import { ResultsCheckerStore } from '../../db/resultsCheckerStore.js';
import { FulfilmentService } from '../../services/fulfilmentService.js';
import { PaystackServerService } from '../../services/paystackService.js';
import { ReferralService } from '../../services/referralService.js';
import { saveEconomicsPolicy } from '../../services/referralEconomics.js';
import { ResultsCheckerService } from '../../services/resultsCheckerService.js';
import { decryptPins, encryptPins } from '../../services/resultsCheckerEncryption.js';
import { validateReferralRule } from '../../services/referralRulePolicy.js';
import { CHECKER_PRODUCTS, checkerProduct, checkerReceiptState, matchCheckerOffer, parseVoucherCatalogue, parseVoucherPurchase } from '../../../shared/resultsCheckers.js';
import type { OrderRecord } from '../../types/orders.js';

const BECE = 'type-bece-synthetic', WASSCE = 'type-wassce-synthetic';
const catalogue = (over: Partial<Record<string, unknown>> = {}) => ({ success: true, data: [
  { id: BECE, name: 'BECE Results Checker', slug: 'bece', description: 'x', priceMinor: '1800', available: 40, ...over },
  { id: WASSCE, name: 'WASSCE Results Checker', slug: 'wassce', description: 'x', priceMinor: '1800', available: 40 },
  { id: 'type-private', name: 'WASSCE Private Candidates Checker', slug: 'wassce_private', priceMinor: '1800', available: 40 },
] });
const pinsReply = (count = 1, extra: Record<string, unknown> = {}) => ({ success: true, data: { id: 'VCH_SYNTH_1', priceMinor: String(1800 * count), pins: Array.from({ length: count }, (_, i) => ({ serial: `SER${1000 + i}`, pin: `SYNTHPIN${1000 + i}` })), ...extra } });

let server: Server, base: string;
let purchase: ReturnType<typeof mock.fn>, vouchers: ReturnType<typeof mock.fn>, lookup: ReturnType<typeof mock.fn>;
const auth = (token: string | null) => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });
const post = (path: string, body: unknown, token: string | null = 'buyer-token') => fetch(`${base}/api${path}`, { method: 'POST', headers: auth(token), body: JSON.stringify(body) });
const get = (path: string, token: string | null = 'buyer-token') => fetch(`${base}/api${path}`, { headers: auth(token) });

function setEnv() {
  Object.assign(process.env, { RESULTS_CHECKER_ENABLED: 'true', RESULTS_CHECKER_PIN_KEY: 'a'.repeat(64), RESULTS_CHECKER_TYPE_ID_BECE: BECE, RESULTS_CHECKER_TYPE_ID_WASSCE: WASSCE, SUCCESS_BIZ_HUB_API_KEY: 'sbh_test_synthetic', SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED: 'true', APP_URL: 'https://mysterybundlehub.com' });
}
const ENV_KEYS = ['RESULTS_CHECKER_ENABLED', 'RESULTS_CHECKER_PIN_KEY', 'RESULTS_CHECKER_TYPE_ID_BECE', 'RESULTS_CHECKER_TYPE_ID_WASSCE', 'SUCCESS_BIZ_HUB_API_KEY', 'SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED', 'APP_URL'];

before(async () => {
  assert.equal(process.env.DATABASE_URL, undefined);
  const app = express(); app.use(express.json()); app.use('/api', apiRouter); app.use('/api/admin', adminRouter);
  server = await new Promise<Server>(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { for (const k of ENV_KEYS) delete process.env[k]; await new Promise<void>(r => server.close(() => r())); });
beforeEach(async () => {
  mock.restoreAll(); setEnv();
  OrdersStore.clearDevStore(); ResultsCheckerStore.clearTestStore(); AuthStore._clearDevStore(); AdminAuditStore._clearDevStore(); ReferralStore._clearDevStore(); FinanceStore._reset();
  for (const [id, role] of [['buyer', 'customer'], ['other', 'customer'], ['referrer', 'customer'], ['admin', 'admin']] as const) {
    await AuthStore.createUser({ id, name: id, email: `${id}@example.test`, phone: id === 'buyer' ? '0241234567' : null, passwordHash: 'synthetic-unused', role });
    await AuthStore.createSession(id, `${id}-token`);
  }
  const client = ResultsCheckerService.client;
  mock.method(ResultsCheckerService, 'supplierSpendAllowed', () => true);
  vouchers = mock.method(client, 'getVouchers', async () => catalogue()) as never;
  purchase = mock.method(client, 'purchaseVoucher', async () => pinsReply()) as never;
  lookup = mock.method(client, 'getVoucherPurchase', async () => { throw new Error('not used'); }) as never;
  mock.method(PaystackServerService, 'initializeTransaction', async (p: { reference: string }) => ({ success: true, reference: p.reference, authorizationUrl: 'https://checkout.paystack.com/synthetic', accessCode: 'x' }));
});

/** A synthetic pending order, created the way the checkout creates one. */
async function pendingOrder(key: 'bece' | 'wassce' = 'bece', qty = 1, extra: Partial<OrderRecord> = {}) {
  const product = checkerProduct(key)!, id = `ord_${randomUUID()}`, now = new Date().toISOString();
  const order = { id, user_id: 'buyer', public_reference: `MH-RC-${randomUUID()}`, customer_name: 'buyer', customer_email: 'buyer@example.test', customer_phone: '0241234567', recipient_phone: '0241234567', network: 'education', service_type: 'results_checker', product_id: `results-checker-${key}`, product_name_snapshot: product.name, bundle_size_snapshot: product.name, amount: product.retailMinor * qty, currency: 'GHS', status: 'pending_payment', payment_provider: 'paystack', payment_reference: `MH_rc_${randomUUID()}`, payment_status: 'pending', supplier_provider: 'success_biz_hub', supplier_order_id: null, supplier_response: null, supplier_cost_minor: null, supplier_offer_ref: null, supplier_last_checked_at: null, failure_reason: null, created_at: now, updated_at: now, paid_at: null, submitted_at: null, delivered_at: null, ...extra } as unknown as OrderRecord;
  await ResultsCheckerStore.create(order, { product_key: key, qty, unit_price_minor: product.retailMinor, supplier_type_id: key === 'bece' ? BECE : WASSCE, quoted_cost_minor: 1800 });
  return order;
}
const pay = (order: OrderRecord) => FulfilmentService.processPaidOrder(order.payment_reference, new Date().toISOString());
const fresh = async (order: OrderRecord) => (await OrdersStore.findOrder(order.id))!;
const receipt = (order: OrderRecord, token: string | null = 'buyer-token') => get(`/results-checkers/orders/${order.public_reference}/receipt`, token);

test('catalogue, prices and matching: a familiar name alone never makes a product purchasable', () => {
  const bece = checkerProduct('bece')!, wassce = checkerProduct('wassce')!;
  assert.equal(bece.retailMinor, 2399); assert.equal(wassce.retailMinor, 2499);
  const rows = parseVoucherCatalogue(catalogue());
  assert.equal(rows[0].costMinor, 1800, 'pesewas: GH₵18.00 is 1800, not 18');
  assert.equal(matchCheckerOffer(bece, BECE, rows).state, 'ok');
  assert.equal(matchCheckerOffer(bece, undefined, rows).state, 'not_configured', 'found by name but not mapped: not for sale');
  assert.equal(matchCheckerOffer(bece, 'unknown', rows).state, 'missing');
  assert.equal(matchCheckerOffer(bece, WASSCE, rows).state, 'name_mismatch');
  assert.equal(matchCheckerOffer(wassce, 'type-private', rows).state, 'name_mismatch', 'private-candidate variants need their own decision');
  assert.equal(matchCheckerOffer(bece, BECE, parseVoucherCatalogue(catalogue({ priceMinor: '1801' }))).state, 'cost_too_high');
  assert.equal(matchCheckerOffer(bece, BECE, parseVoucherCatalogue(catalogue({ priceMinor: 'free' }))).state, 'cost_unknown');
  assert.equal(matchCheckerOffer(bece, BECE, parseVoucherCatalogue(catalogue({ available: 0 }))).state, 'out_of_stock');
  assert.equal(matchCheckerOffer(bece, BECE, parseVoucherCatalogue(catalogue({ available: 3 })), 4).state, 'out_of_stock');
  assert.equal(matchCheckerOffer(bece, BECE, parseVoucherCatalogue(catalogue({ available: 'many' }))).state, 'stock_unknown');
  assert.deepEqual(parseVoucherCatalogue({ data: 'nope' }), []);
  assert.deepEqual(parseVoucherCatalogue({ data: [{ name: 'no id' }, null] }), []);
});

test('PIN replies are read strictly: strings or objects, malformed entries counted, nothing invented', () => {
  assert.deepEqual(parseVoucherPurchase({ data: { id: 'A1', pins: ['ABCD1234', { pin: 'WXYZ9876', serial: 'S12345' }] } }).pins, [{ pin: 'ABCD1234' }, { pin: 'WXYZ9876', serial: 'S12345' }]);
  const bad = parseVoucherPurchase({ data: { id: 'A1', pins: ['<script>', { pin: '' }, null, 'GOODPIN1'] } });
  assert.equal(bad.pins.length, 1); assert.equal(bad.malformedPins, 3);
  assert.deepEqual(parseVoucherPurchase({}).pins, []);
  assert.equal(parseVoucherPurchase({ data: { id: '../evil', pins: [] } }).purchaseId, null);
});

test('encryption: only the right order and an untampered envelope open', () => {
  const envelope = encryptPins('ord_a', [{ pin: 'SECRETPIN1', serial: 'S1' }]);
  assert.ok(!envelope.includes('SECRETPIN1'));
  assert.deepEqual(decryptPins('ord_a', envelope), [{ pin: 'SECRETPIN1', serial: 'S1' }]);
  assert.throws(() => decryptPins('ord_b', envelope));
  const parsed = JSON.parse(envelope); parsed.data = Buffer.from('tampered').toString('base64');
  assert.throws(() => decryptPins('ord_a', JSON.stringify(parsed)));
});

test('the service stays closed unless every prerequisite is met, and never exposes cost or exact stock', async () => {
  const open = await (await get('/results-checkers/config', null)).json();
  assert.equal(open.available, true);
  assert.deepEqual(open.products.map((p: { priceMinor: number }) => p.priceMinor), [2399, 2499]);
  assert.doesNotMatch(JSON.stringify(open), /1800|costMinor|type-bece|"available":40/);
  for (const key of ['RESULTS_CHECKER_ENABLED', 'RESULTS_CHECKER_PIN_KEY', 'SUCCESS_BIZ_HUB_API_KEY']) {
    const saved = process.env[key]; delete process.env[key];
    const closed = await (await get('/results-checkers/config', null)).json();
    assert.equal(closed.available, false, key);
    assert.ok(closed.products.every((p: { available: boolean }) => !p.available), key);
    assert.equal((await post('/results-checkers/payments/initialize', { product: 'bece', qty: 1, customerEmail: 'a@example.test' })).status, 503, key);
    process.env[key] = saved;
  }
  delete process.env.RESULTS_CHECKER_TYPE_ID_BECE;
  const partly = await (await get('/results-checkers/config', null)).json();
  assert.deepEqual(partly.products.map((p: { available: boolean }) => p.available), [false, true]);
  assert.equal(purchase.mock.callCount(), 0);
  vouchers.mock.mockImplementation(async () => { throw new Error('supplier down'); });
  assert.equal((await (await get('/results-checkers/config', null)).json()).available, false);
});

test('live spending needs a live payment key: test payments cannot reach the real supplier', () => {
  mock.restoreAll();
  const was = { key: process.env.PAYSTACK_SECRET_KEY, env: process.env.NODE_ENV, url: process.env.SUCCESS_BIZ_HUB_BASE_URL };
  try {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_synthetic'; delete process.env.SUCCESS_BIZ_HUB_BASE_URL;
    assert.equal(ResultsCheckerService.supplierSpendAllowed(), false);
    process.env.SUCCESS_BIZ_HUB_BASE_URL = 'http://localhost:3199'; process.env.NODE_ENV = 'development';
    assert.equal(ResultsCheckerService.supplierSpendAllowed(), true, 'a stand-in on this machine only');
    process.env.NODE_ENV = 'production';
    assert.equal(ResultsCheckerService.supplierSpendAllowed(), false);
    // A live key only spends in an explicit production process, because webhook signatures are only enforced there.
    process.env.PAYSTACK_SECRET_KEY = 'sk_live_synthetic'; delete process.env.SUCCESS_BIZ_HUB_BASE_URL;
    for (const env of ['test', 'development', '']) { process.env.NODE_ENV = env; assert.equal(ResultsCheckerService.supplierSpendAllowed(), false, env || 'unset'); }
    delete process.env.NODE_ENV; assert.equal(ResultsCheckerService.supplierSpendAllowed(), false, 'NODE_ENV missing');
    process.env.NODE_ENV = 'production'; assert.equal(ResultsCheckerService.supplierSpendAllowed(), true);
    process.env.SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED = 'false';
    assert.equal(ResultsCheckerService.supplierSpendAllowed(), false);
  } finally { process.env.NODE_ENV = was.env; if (was.key === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = was.key; if (was.url === undefined) delete process.env.SUCCESS_BIZ_HUB_BASE_URL; else process.env.SUCCESS_BIZ_HUB_BASE_URL = was.url; }
});

test('checkout: sign-in required, the server sets the amount, invalid requests and stock problems are refused', async () => {
  assert.equal((await post('/results-checkers/payments/initialize', { product: 'bece', qty: 1, customerEmail: 'a@example.test' }, null)).status, 401);
  for (const [body, field] of [[{ product: 'nope', qty: 1, customerEmail: 'a@example.test' }, 'product'], [{ product: 'bece', qty: 0, customerEmail: 'a@example.test' }, 'qty'], [{ product: 'bece', qty: 6, customerEmail: 'a@example.test' }, 'qty'], [{ product: 'bece', qty: 1.5, customerEmail: 'a@example.test' }, 'qty'], [{ product: 'bece', qty: 1, customerEmail: 'nope' }, 'customerEmail']] as const) {
    const res = await post('/results-checkers/payments/initialize', body);
    assert.equal(res.status, 400); assert.equal((await res.json()).field, field);
  }
  const good = await post('/results-checkers/payments/initialize', { product: 'wassce', qty: 2, customerEmail: 'buyer@example.test', amount: 1, amountPesewas: 1, priceMinor: 1 });
  assert.equal(good.status, 200);
  const started = await good.json();
  assert.equal(started.amountPesewas, 4998, 'browser amounts are ignored');
  const order = (await OrdersStore.findOrder(started.reference))!;
  assert.equal(order.amount, 4998); assert.equal(order.service_type, 'results_checker'); assert.equal(order.status, 'pending_payment'); assert.equal(order.user_id, 'buyer');
  assert.equal(purchase.mock.callCount(), 0, 'nothing is bought before payment');
  vouchers.mock.mockImplementation(async () => catalogue({ available: 0 }));
  const empty = await post('/results-checkers/payments/initialize', { product: 'bece', qty: 1, customerEmail: 'buyer@example.test' });
  assert.equal(empty.status, 409);
  vouchers.mock.mockImplementation(async () => catalogue({ priceMinor: '2000' }));
  assert.equal((await post('/results-checkers/payments/initialize', { product: 'bece', qty: 1, customerEmail: 'buyer@example.test' })).status, 409, 'higher cost: stays unavailable, margin is not silently lowered');
  // The general checkout cannot be used to reach this product.
  for (const body of [{ serviceType: 'results_checker', productId: 'x' }, { productId: 'results-checker-bece' }]) assert.equal((await post('/payments/initialize', body, null)).status, 400);
});

test('an unpaid order never reaches the supplier', async () => {
  const order = await pendingOrder();
  assert.equal((await ResultsCheckerService.fulfil(order)).status, 'pending_payment');
  assert.equal(purchase.mock.callCount(), 0);
  const paidNotQueued = { ...order, payment_status: 'pending', status: 'queued' } as OrderRecord;
  await ResultsCheckerService.fulfil(paidNotQueued);
  assert.equal(purchase.mock.callCount(), 0);
  const body = await (await receipt(order)).json();
  assert.deepEqual(body.pins, []); assert.equal(body.paid, false);
  assert.equal(body.state, 'processing', 'a Mobile Money payment may still be on its way: never tell them nothing was charged');
  const page = readFileSync('src/components/checkers/ResultsCheckersPage.tsx', 'utf8');
  assert.doesNotMatch(page, /nothing has been charged/);
});

test('a verified payment buys once, stores PINs encrypted, then delivers; the customer can reopen the receipt', async () => {
  const order = await pendingOrder('bece', 2);
  purchase.mock.mockImplementation(async () => pinsReply(2));
  const { order: done } = await pay(order);
  assert.equal(done!.status, 'delivered');
  assert.equal(purchase.mock.callCount(), 1);
  assert.deepEqual(purchase.mock.calls[0].arguments[0], { typeId: BECE, qty: 2 });
  const stored = (await ResultsCheckerStore.find(order.id))!;
  assert.equal(stored.pin_count, 2); assert.ok(stored.pins_stored_at); assert.equal(stored.supplier_purchase_id, 'VCH_SYNTH_1');
  assert.ok(!stored.encrypted_pins!.includes('SYNTHPIN'), 'PINs are never stored in clear');
  const record = await fresh(order);
  assert.equal(record.supplier_cost_minor, 3600);
  assert.ok(!JSON.stringify(record).includes('SYNTHPIN'), 'the order record holds no PIN');
  // Receipt: the owner can open it repeatedly; responses must not be cached.
  const first = await receipt(order);
  assert.match(first.headers.get('cache-control') || '', /no-store/);
  const body = await first.json();
  assert.equal(body.state, 'ready');
  assert.deepEqual(body.pins, [{ serial: 'SER1000', pin: 'SYNTHPIN1000' }, { serial: 'SER1001', pin: 'SYNTHPIN1001' }]);
  assert.deepEqual((await (await receipt(order)).json()).pins, body.pins);
  // Nobody else can: other customers, guests and bad tokens get nothing.
  assert.equal((await receipt(order, 'other-token')).status, 404);
  assert.equal((await receipt(order, null)).status, 401);
  assert.equal((await receipt(order, 'invalid')).status, 401);
  assert.equal((await receipt(order, 'admin-token')).status, 404, 'staff do not see PINs through this route');
  assert.equal((await get('/results-checkers/orders/not-a-real-order/receipt')).status, 404);
  // The public order routes never carry PINs.
  assert.ok(!(await (await get(`/orders/lookup/${order.public_reference}`, null)).text()).includes('SYNTHPIN'));
  // Admin sees facts, not PINs.
  const admin = await (await get(`/admin/orders/${order.public_reference}`, 'admin-token')).text();
  assert.ok(!admin.includes('SYNTHPIN')); assert.match(admin, /"pinsStored":2/);
});

test('repeated callbacks and concurrent workers cannot buy twice', async () => {
  const order = await pendingOrder();
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  purchase.mock.mockImplementation(async () => { await gate; return pinsReply(); });
  const runs = [pay(order), pay(order), pay(order), pay(order)];
  await new Promise(r => setTimeout(r, 30)); release();
  await Promise.all(runs);
  assert.equal(purchase.mock.callCount(), 1);
  assert.equal((await fresh(order)).status, 'delivered');
  await pay(order);
  assert.equal(purchase.mock.callCount(), 1, 'a late duplicate callback changes nothing');
  // Two workers already past the dispatch claim.
  const second = await pendingOrder();
  await OrdersStore.markOrderPaid(second.payment_reference, new Date().toISOString());
  const claimed = (await OrdersStore.claimOrderForSupplierDispatch(second.id))!;
  purchase.mock.resetCalls();
  await Promise.all([ResultsCheckerService.fulfil(claimed), ResultsCheckerService.fulfil(claimed)]);
  assert.equal(purchase.mock.callCount(), 1);
});

test('a timeout or unknown outcome is never retried and never called delivered', async () => {
  for (const failure of [Object.assign(new Error('timed out'), { isTimeout: true }), Object.assign(new Error('bad gateway'), { statusCode: 503 }), Object.assign(new Error('odd'), { statusCode: 200 })]) {
    purchase.mock.resetCalls();
    purchase.mock.mockImplementation(async () => { throw failure; });
    const order = await pendingOrder();
    await pay(order);
    const after = await fresh(order);
    assert.notEqual(after.status, 'delivered');
    assert.equal(after.failure_reason, 'supplier_submission_uncertain');
    assert.equal(after.manual_review, true);
    assert.equal(purchase.mock.callCount(), 1);
    // Every later route, including a repeat dispatch and a status refresh, stays away from the purchase call.
    await pay(order); await ResultsCheckerService.fulfil(after); await ResultsCheckerService.refresh(after); await FulfilmentService.refreshOrderStatusIfDue(after);
    assert.equal(purchase.mock.callCount(), 1);
    const body = await (await receipt(order)).json();
    assert.deepEqual(body.pins, []); assert.equal(body.state, 'review'); assert.equal(body.paid, true);
  }
});

test('supplier refusals (401, 403, 429...) keep the payment record, flag review and never rebuy', async () => {
  for (const statusCode of [400, 401, 403, 404, 429]) {
    purchase.mock.resetCalls();
    purchase.mock.mockImplementation(async () => { throw Object.assign(new Error('refused'), { statusCode }); });
    const order = await pendingOrder();
    await pay(order);
    const after = await fresh(order);
    assert.equal(after.status, 'refund_pending', String(statusCode));
    assert.equal(after.manual_review, true);
    assert.equal(after.payment_status, 'success', 'payment history is preserved');
    assert.match(after.admin_note || '', /supplier statement/);
    await pay(order);
    assert.equal(purchase.mock.callCount(), 1);
  }
});

test('stock or cost changing after payment stops the purchase and goes to review', async () => {
  for (const change of [{ available: 0 }, { priceMinor: '1900' }]) {
    const order = await pendingOrder();
    purchase.mock.resetCalls();
    vouchers.mock.mockImplementation(async () => catalogue(change));
    await pay(order);
    const after = await fresh(order);
    assert.equal(purchase.mock.callCount(), 0);
    assert.equal(after.manual_review, true);
    assert.match(after.admin_note || '', /No voucher was bought/);
    assert.notEqual(after.status, 'delivered');
  }
  vouchers.mock.mockImplementation(async () => { throw new Error('supplier down'); });
  const order = await pendingOrder(); purchase.mock.resetCalls();
  await pay(order);
  assert.equal(purchase.mock.callCount(), 0);
  assert.equal((await fresh(order)).manual_review, true);
});

test('partial, missing and malformed PIN replies are never treated as complete', async () => {
  // Partial: what arrived is kept, the rest goes to review.
  purchase.mock.mockImplementation(async () => pinsReply(1));
  const partial = await pendingOrder('bece', 2);
  await pay(partial);
  let after = await fresh(partial);
  assert.notEqual(after.status, 'delivered'); assert.equal(after.manual_review, true);
  const body = await (await receipt(partial)).json();
  assert.equal(body.state, 'partial'); assert.equal(body.pins.length, 1); assert.equal(body.pinsExpected, 2);
  // Malformed entries.
  purchase.mock.mockImplementation(async () => ({ success: true, data: { id: 'VCH_M', priceMinor: '1800', pins: ['<bad>'] } }));
  const malformed = await pendingOrder();
  await pay(malformed);
  after = await fresh(malformed);
  assert.notEqual(after.status, 'delivered');
  assert.deepEqual((await (await receipt(malformed)).json()).pins, []);
  // No PINs and no reference: outcome unknown.
  purchase.mock.mockImplementation(async () => ({ success: true, data: {} }));
  const empty = await pendingOrder();
  await pay(empty);
  assert.equal((await fresh(empty)).failure_reason, 'supplier_submission_uncertain');
  // Not a success reply.
  purchase.mock.mockImplementation(async () => ({ success: false, data: { pins: ['LOOKSREAL1'] } }));
  const denied = await pendingOrder();
  await pay(denied);
  assert.equal((await ResultsCheckerStore.find(denied.id))!.pin_count, 0);
});

test('a known purchase can be completed from the lookup route, without a new purchase', async () => {
  purchase.mock.mockImplementation(async () => ({ success: true, data: { id: 'VCH_LOOK', priceMinor: '1800' } }));
  const order = await pendingOrder();
  await pay(order);
  assert.notEqual((await fresh(order)).status, 'delivered');
  assert.equal((await ResultsCheckerStore.find(order.id))!.supplier_purchase_id, 'VCH_LOOK');
  lookup.mock.mockImplementation(async () => ({ success: true, data: { id: 'VCH_LOOK', priceMinor: '1800', pins: [{ pin: 'LOOKEDUP1234' }] } }));
  purchase.mock.resetCalls();
  await ResultsCheckerService.refresh(await fresh(order));
  assert.equal(lookup.mock.callCount(), 1);
  assert.equal(purchase.mock.callCount(), 0);
  assert.equal((await fresh(order)).status, 'delivered');
  assert.deepEqual((await (await receipt(order)).json()).pins, [{ pin: 'LOOKEDUP1234' }]);
  // A lookup that names a different purchase is not accepted.
  purchase.mock.mockImplementation(async () => ({ success: true, data: { id: 'VCH_TWO', priceMinor: '1800' } }));
  const other = await pendingOrder();
  await pay(other);
  lookup.mock.mockImplementation(async () => ({ success: true, data: { id: 'VCH_OTHER', pins: ['OTHERPIN1234'] } }));
  await ResultsCheckerService.refresh(await fresh(other));
  assert.equal((await ResultsCheckerStore.find(other.id))!.pin_count, 0);
  assert.equal((await fresh(other)).manual_review, true);
});

test('a crash with no durable validation goes to review, and an interrupted purchase is flagged, not repeated', async () => {
  const order = await pendingOrder();
  await OrdersStore.markOrderPaid(order.payment_reference, new Date().toISOString());
  await OrdersStore.claimOrderForSupplierDispatch(order.id);
  await ResultsCheckerStore.claimSubmission(order.id);
  await ResultsCheckerStore.savePins(order.id, 'VCH_CRASH', [{ pin: 'RECOVERED1234' }]);
  await ResultsCheckerService.refresh(await fresh(order));
  assert.notEqual((await fresh(order)).status, 'delivered');
  assert.equal((await fresh(order)).manual_review, true);
  assert.equal((await fresh(order)).supplier_cost_minor, null, 'a quote is not a confirmed charge');
  assert.equal(purchase.mock.callCount(), 0);

  const interrupted = await pendingOrder();
  await OrdersStore.markOrderPaid(interrupted.payment_reference, new Date().toISOString());
  await OrdersStore.claimOrderForSupplierDispatch(interrupted.id);
  await ResultsCheckerStore.claimSubmission(interrupted.id);
  const queued = await fresh(interrupted);
  await ResultsCheckerService.refresh(queued);
  assert.equal((await fresh(interrupted)).failure_reason, queued.failure_reason, 'not flagged inside the 30 second window');
  const real = Date.now; mock.method(Date, 'now', () => real() + 60_000);
  await ResultsCheckerService.refresh(queued);
  assert.equal((await fresh(interrupted)).failure_reason, 'supplier_submission_uncertain');
  await ResultsCheckerService.fulfil(await fresh(interrupted));
  assert.equal(purchase.mock.callCount(), 0);
});

test('failure and refund states are preserved: delivered orders are not reopened, refunded orders are not bought', async () => {
  const order = await pendingOrder();
  await pay(order);
  purchase.mock.resetCalls();
  await ResultsCheckerService.fulfil(await fresh(order));
  await ResultsCheckerService.refresh(await fresh(order));
  assert.equal(purchase.mock.callCount(), 0);
  assert.equal((await fresh(order)).status, 'delivered');
  const refunded = await pendingOrder();
  await OrdersStore.markOrderPaid(refunded.payment_reference, new Date().toISOString());
  await OrdersStore.updateOrderStatus(refunded.id, 'refund_pending', 'test');
  await ResultsCheckerService.fulfil(await fresh(refunded));
  assert.equal(purchase.mock.callCount(), 0);
  assert.equal((await fresh(refunded)).status, 'refund_pending');
  assert.equal(checkerReceiptState({ paid: true, status: 'refund_pending', manualReview: true, pinCount: 0, qty: 1 }), 'review');
});

test('GH₵2 referral reward: needs an explicit rule and policy, pays once on delivery, never otherwise', async () => {
  assert.ok(validateReferralRule({ service_type: 'results_checker', reward_type: 'fixed_minor', reward_minor: 200, enabled: true }));
  const rewarded = (extra: Partial<OrderRecord> = {}) => pendingOrder('bece', 1, { referrer_user_id: 'referrer', ...extra });
  const ledger = async (id: string) => (await ReferralStore.findLedgerByOrderId(id)).filter(e => !e.reversal_of_id);
  // Off by default: a delivered referred order earns nothing without a rule and an enabled policy.
  let order = await rewarded(); await pay(order);
  assert.equal((await fresh(order)).status, 'delivered');
  assert.equal((await ledger(order.id)).length, 0);
  // A wildcard rule cannot switch it on.
  await saveEconomicsPolicy('admin', { confirmed: true, service: 'results_checker', enabled: true, mode: 'fixed', reserveMinor: 0, reserveBps: 195, marginBps: 0 });
  await ReferralStore.createOrUpdateRule({ service_type: 'all', reward_type: 'fixed_minor', reward_minor: 200, enabled: true, product_key: null, network: null, reward_percent_bps: null, starts_at: null, ends_at: null });
  order = await rewarded(); await pay(order);
  assert.equal((await ledger(order.id)).length, 0);
  // An explicit rule does.
  await ReferralStore.createOrUpdateRule({ service_type: 'results_checker', reward_type: 'fixed_minor', reward_minor: 200, enabled: true, product_key: null, network: null, reward_percent_bps: null, starts_at: null, ends_at: null });
  order = await rewarded(); await pay(order);
  const entries = await ledger(order.id);
  assert.equal(entries.length, 1); assert.equal(entries[0].amount_minor, 200); assert.equal(entries[0].referrer_user_id, 'referrer');
  // No double credit.
  await ReferralService.processOrderReward(await fresh(order)); await pay(order);
  assert.equal((await ledger(order.id)).length, 1);
  // No reward for an unpaid order, an unresolved purchase, a self-referral or no referrer.
  const unpaid = await rewarded();
  assert.equal(await ReferralService.processOrderReward(unpaid), null);
  purchase.mock.mockImplementation(async () => { throw new Error('timeout'); });
  const unresolved = await rewarded(); await pay(unresolved);
  assert.equal((await ledger(unresolved.id)).length, 0);
  purchase.mock.mockImplementation(async () => pinsReply());
  const self = await pendingOrder('bece', 1, { referrer_user_id: 'buyer' }); await pay(self);
  assert.equal((await ledger(self.id)).length, 0);
  const none = await pendingOrder(); await pay(none);
  assert.equal((await ledger(none.id)).length, 0);
  // The reward is capped by real margin: a thin order cannot pay out more than it earned.
  purchase.mock.mockImplementation(async () => pinsReply(1, { priceMinor: '2390' }));
  const thin = await rewarded(); await pay(thin);
  const thinEntries = await ledger(thin.id);
  assert.ok(thinEntries.length === 0 || (thinEntries[0].amount_minor) < 200);
});

test('security properties in the source: no PIN logging, no raw reply stored, no public analytics', () => {
  const service = readFileSync('server/services/resultsCheckerService.ts', 'utf8'), route = readFileSync('server/routes/resultsCheckerApi.ts', 'utf8'), store = readFileSync('server/db/resultsCheckerStore.ts', 'utf8');
  for (const source of [service, route, store]) assert.doesNotMatch(source, /console\.(log|info|warn|error|debug)/);
  assert.doesNotMatch(service, /saveSupplierSubmission\([^)]*response\)/);
  assert.doesNotMatch(readFileSync('src/components/checkers/ResultsCheckersPage.tsx', 'utf8'), /localStorage|sessionStorage|trackGrowth/);
  assert.ok(CHECKER_PRODUCTS.every(p => p.maxCostMinor === 1800));
  // Storage is installed by approval only, not at application startup.
  assert.doesNotMatch(readFileSync('server/db/connection.ts', 'utf8'), /results_checker_purchases|resultsCheckers\.sql/);
  const page = readFileSync('src/components/checkers/ResultsCheckersPage.tsx', 'utf8');
  assert.match(page, /aren't affiliated with or endorsed by WAEC/);
  assert.doesNotMatch(page, /instant|guaranteed|official partner/i);
});

test('review: PINs survive a failing save, and if they truly cannot be saved the order says exactly that', async () => {
  ResultsCheckerService.saveRetryDelayMs = 1;
  const real = ResultsCheckerStore.savePins.bind(ResultsCheckerStore);
  // A brief database failure: the retry saves them.
  let calls = 0;
  const flaky = mock.method(ResultsCheckerStore, 'savePins', async (...a: Parameters<typeof real>) => { if (++calls === 1) throw new Error('brief outage'); return real(...a); });
  const order = await pendingOrder();
  await pay(order);
  assert.equal((await fresh(order)).status, 'delivered');
  assert.equal((await ResultsCheckerStore.find(order.id))!.pin_count, 1);
  flaky.mock.restore();
  // The reference is what fails: the last attempt saves the PINs without it.
  const noRef = mock.method(ResultsCheckerStore, 'savePins', async (id: string, ref: string | null, pins: Parameters<typeof real>[2]) => { if (ref) throw new Error('duplicate key'); return real(id, ref, pins); });
  const second = await pendingOrder();
  await pay(second);
  assert.equal((await ResultsCheckerStore.find(second.id))!.pin_count, 1);
  noRef.mock.restore();
  // Every attempt fails: never delivered, flagged, not bought again.
  purchase.mock.resetCalls();
  const broken = mock.method(ResultsCheckerStore, 'savePins', async () => { throw new Error('down'); });
  const third = await pendingOrder();
  await pay(third);
  const after = await fresh(third);
  assert.equal(broken.mock.callCount(), 3);
  assert.notEqual(after.status, 'delivered');
  assert.equal(after.failure_reason, 'supplier_submission_uncertain');
  assert.equal(after.manual_review, true);
  await pay(third); await ResultsCheckerService.refresh(after);
  assert.equal(purchase.mock.callCount(), 1);
  broken.mock.restore();
  assert.doesNotMatch(readFileSync('server/db/resultsCheckers.sql', 'utf8'), /UNIQUE INDEX/);
});

test('review: switching the service off stops purchases for checkouts already paid', async () => {
  const order = await pendingOrder();
  delete process.env.RESULTS_CHECKER_ENABLED;
  await pay(order);
  const after = await fresh(order);
  assert.equal(purchase.mock.callCount(), 0);
  assert.equal(after.manual_review, true); assert.notEqual(after.status, 'delivered');
  assert.match(after.admin_note || '', /No voucher was bought/);
});

test('review: an unconfirmed or odd charge is flagged first, uses the cautious cost and pays no reward', async () => {
  await saveEconomicsPolicy('admin', { confirmed: true, service: 'results_checker', enabled: true, mode: 'fixed', reserveMinor: 0, reserveBps: 195, marginBps: 0 });
  await ReferralStore.createOrUpdateRule({ service_type: 'results_checker', reward_type: 'fixed_minor', reward_minor: 200, enabled: true, product_key: null, network: null, reward_percent_bps: null, starts_at: null, ends_at: null });
  const run = async (reply: unknown, qty = 1) => { purchase.mock.mockImplementation(async () => reply); const order = await pendingOrder('bece', qty, { referrer_user_id: 'referrer' }); await pay(order); return { order: await fresh(order), ledger: (await ReferralStore.findLedgerByOrderId(order.id)).length }; };
  const pinsFor = (n: number) => Array.from({ length: n }, (_, i) => ({ pin: 'SYNTHPIN' + (5000 + i) }));
  let r = await run({ success: true, data: { id: 'V1', pins: pinsFor(1) } });
  assert.equal(r.order.status, 'delivered'); assert.equal(r.order.manual_review, true); assert.equal(r.ledger, 0); assert.equal(r.order.supplier_cost_minor, 1800);
  r = await run({ success: true, data: { id: 'V2', priceMinor: '2000', pins: pinsFor(1) } });
  assert.equal(r.order.manual_review, true); assert.equal(r.ledger, 0); assert.equal(r.order.supplier_cost_minor, 2000);
  // Two vouchers where the reply's price is a higher unit price: margin must not be overstated.
  r = await run({ success: true, data: { id: 'V3', priceMinor: '2000', pins: pinsFor(2) } }, 2);
  assert.equal(r.order.supplier_cost_minor, 4000); assert.equal(r.order.manual_review, true); assert.equal(r.ledger, 0);
  // A confirmed charge, as a total or as a unit price, is clean and rewarded.
  r = await run({ success: true, data: { id: 'V4', priceMinor: '3600', pins: pinsFor(2) } }, 2);
  assert.equal(r.order.supplier_cost_minor, 3600); assert.ok(!r.order.manual_review); assert.equal(r.ledger, 1);
  r = await run({ success: true, data: { id: 'V5', priceMinor: '1800', pins: pinsFor(2) } }, 2);
  assert.equal(r.order.supplier_cost_minor, 3600); assert.ok(!r.order.manual_review);
});

test('review: surplus PINs and unreadable entries cannot slip past review on a later refresh', async () => {
  // Too many PINs: review, and the customer sees only what they paid for.
  purchase.mock.mockImplementation(async () => pinsReply(3));
  const surplus = await pendingOrder('bece', 1);
  await pay(surplus);
  let after = await fresh(surplus);
  assert.notEqual(after.status, 'delivered'); assert.equal(after.manual_review, true);
  await ResultsCheckerService.refresh(after);
  assert.notEqual((await fresh(surplus)).status, 'delivered');
  assert.equal((await (await receipt(surplus)).json()).pins.length, 1);
  // A full set plus an unreadable entry.
  purchase.mock.mockImplementation(async () => ({ success: true, data: { id: 'VM', priceMinor: '1800', pins: [{ pin: 'SYNTHPIN7777' }, '<bad>'] } }));
  const mixed = await pendingOrder();
  await pay(mixed);
  after = await fresh(mixed);
  await ResultsCheckerService.refresh(after);
  assert.notEqual((await fresh(mixed)).status, 'delivered');
  // An unreadable serial means the voucher may be unusable, so it isn't passed off as complete.
  purchase.mock.mockImplementation(async () => ({ success: true, data: { id: 'VS', priceMinor: '1800', pins: [{ pin: 'SYNTHPIN8888', serial: '<bad>' }] } }));
  const serial = await pendingOrder();
  await pay(serial);
  assert.notEqual((await fresh(serial)).status, 'delivered');
  assert.equal((await fresh(serial)).manual_review, true);
});

test('review: supplier lookups from status pages are throttled per order', async () => {
  purchase.mock.mockImplementation(async () => ({ success: true, data: { id: 'VCH_T', priceMinor: '1800' } }));
  const order = await pendingOrder();
  await pay(order);
  lookup.mock.mockImplementation(async () => ({ success: true, data: { id: 'VCH_T' } }));
  for (let i = 0; i < 5; i++) await ResultsCheckerService.refresh(await fresh(order));
  assert.equal(lookup.mock.callCount(), 1);
});

test('review: staff have one audited exit for stuck orders, and it never buys or completes anything', async () => {
  const route = (order: OrderRecord, body: unknown, token = 'admin-token') => post(`/admin/orders/${order.public_reference}/results-checker/refund-review`, body, token);
  purchase.mock.mockImplementation(async () => { throw new Error('timeout'); });
  const stuck = await pendingOrder();
  await pay(stuck);
  purchase.mock.resetCalls();
  assert.equal((await route(stuck, { note: 'Checked the supplier statement: no debit.' }, 'buyer-token')).status, 403);
  assert.equal((await route(stuck, { note: 'short' })).status, 400);
  assert.equal((await route(stuck, { note: '<script>alert(1)</script> nope nope' })).status, 400);
  const moved = await route(stuck, { note: 'Checked the supplier statement: no debit.' });
  assert.equal(moved.status, 200);
  const after = await fresh(stuck);
  assert.equal(after.status, 'refund_pending'); assert.equal(after.payment_status, 'success');
  assert.equal(purchase.mock.callCount(), 0);
  // Not for unpaid orders, or orders holding every PIN.
  assert.equal((await route(await pendingOrder(), { note: 'Checked the supplier statement.' })).status, 409);
  purchase.mock.mockImplementation(async () => pinsReply());
  const done = await pendingOrder(); await pay(done);
  assert.equal((await route(done, { note: 'Checked the supplier statement.' })).status, 409);
  // The test-order closer refuses these orders outright, including one holding PINs.
  assert.equal((await post(`/admin/orders/${done.public_reference}/close-test-order`, { confirmPaidTestOrder: true }, 'admin-token')).status, 400);
  assert.equal((await post(`/admin/orders/${stuck.public_reference}/close-test-order`, { confirmPaidTestOrder: true }, 'admin-token')).status, 400);
  // Staff cannot simply mark one delivered.
  const status = await fetch(`${base}/api/admin/orders/${stuck.public_reference}/status`, { method: 'PATCH', headers: auth('admin-token'), body: JSON.stringify({ status: 'delivered' }) });
  assert.ok(status.status >= 400 && status.status < 500, String(status.status));
});

test('readiness regression: previously saved PINs survive equal-size and longer disjoint replies', async () => {
  const order = await pendingOrder('bece', 3);
  await ResultsCheckerStore.savePins(order.id, 'PIN_KEEP', [{ pin: 'FIRSTPIN1234' }]);
  await ResultsCheckerStore.savePins(order.id, 'PIN_KEEP', [{ pin: 'SECONDPIN1234' }]);
  await ResultsCheckerStore.savePins(order.id, 'PIN_KEEP', [{ pin: 'SECONDPIN1234' }, { pin: 'THIRDPIN1234' }]);
  const row = (await ResultsCheckerStore.find(order.id))!;
  assert.deepEqual(ResultsCheckerStore.pins(row).map(p => p.pin).sort(), ['FIRSTPIN1234', 'SECONDPIN1234', 'THIRDPIN1234'].sort());
  assert.equal(row.pin_count, 3);
  await assert.rejects(ResultsCheckerStore.savePins('missing-order', null, [{ pin: 'SAFE1234' }]));
});

test('readiness regression: repeated identical vouchers cannot satisfy a multi-voucher quantity', async () => {
  purchase.mock.mockImplementation(async () => pinsReply(2, { pins: ['DUPLICATE1234', 'DUPLICATE1234'] }));
  const order = await pendingOrder('bece', 2); await pay(order);
  assert.notEqual((await fresh(order)).status, 'delivered');
  assert.equal((await fresh(order)).manual_review, true);
  assert.equal((await ResultsCheckerStore.find(order.id))!.pin_count, 1);
});

test('readiness regression: crash before validation facts are stored never invents delivery or confirmed cost', async () => {
  const order = await pendingOrder();
  await OrdersStore.markOrderPaid(order.payment_reference, new Date().toISOString());
  await OrdersStore.claimOrderForSupplierDispatch(order.id);
  const save = mock.method(OrdersStore, 'saveSupplierSubmission', async () => { throw Error('synthetic persistence failure'); });
  await assert.rejects(ResultsCheckerService.applyPurchase(await fresh(order), pinsReply(1, { pins: [{ pin: 'PRESERVED1234', serial: '<bad>' }] }), 1, 1800));
  save.mock.restore();
  await ResultsCheckerService.refresh(await fresh(order));
  assert.notEqual((await fresh(order)).status, 'delivered');
  assert.equal((await fresh(order)).manual_review, true);
  assert.equal((await fresh(order)).supplier_cost_minor, null);
  assert.equal((await ResultsCheckerStore.find(order.id))!.pin_count, 1);
  assert.equal(purchase.mock.callCount(), 0);
});

test('readiness regression: refund review during catalogue check prevents stale dispatch', async () => {
  const order = await pendingOrder();
  await OrdersStore.markOrderPaid(order.payment_reference, new Date().toISOString());
  await OrdersStore.claimOrderForSupplierDispatch(order.id);
  const snapshot = await fresh(order);
  vouchers.mock.mockImplementation(async () => {
    await OrdersStore.updateOrderReview(order.id, true, 'Synthetic staff review');
    await OrdersStore.updateOrderStatus(order.id, 'refund_pending');
    return catalogue();
  });
  await ResultsCheckerService.fulfil(snapshot);
  assert.equal(purchase.mock.callCount(), 0);
  assert.equal((await fresh(order)).status, 'refund_pending');
});


test('readiness regression: a crash after durable clean validation can recover without rebuying', async () => {
  const order = await pendingOrder();
  await OrdersStore.markOrderPaid(order.payment_reference, new Date().toISOString());
  await OrdersStore.claimOrderForSupplierDispatch(order.id);
  const status = mock.method(OrdersStore, 'updateOrderStatus', async () => { throw Error('synthetic crash after evidence'); });
  await assert.rejects(ResultsCheckerService.applyPurchase(await fresh(order), pinsReply(), 1, 1800));
  status.mock.restore();
  await ResultsCheckerService.refresh(await fresh(order));
  assert.equal((await fresh(order)).status, 'delivered');
  assert.equal((await fresh(order)).supplier_cost_minor, 1800);
  assert.equal(purchase.mock.callCount(), 0);
});

test('readiness regression: missing or changed encryption key never overwrites held value', async () => {
  const order = await pendingOrder();
  await ResultsCheckerStore.savePins(order.id, 'SAFE_KEY', [{ pin: 'RETAINED1234' }]);
  const before = (await ResultsCheckerStore.find(order.id))!;
  for (const key of ['', 'b'.repeat(64)]) {
    process.env.RESULTS_CHECKER_PIN_KEY = key;
    await assert.rejects(ResultsCheckerStore.savePins(order.id, 'SAFE_KEY', [{ pin: 'NEWPIN1234' }]));
    assert.equal((await ResultsCheckerStore.find(order.id))!.encrypted_pins, before.encrypted_pins);
  }
  process.env.RESULTS_CHECKER_PIN_KEY = 'a'.repeat(64);
  assert.deepEqual(ResultsCheckerStore.pins((await ResultsCheckerStore.find(order.id))!), [{ pin: 'RETAINED1234' }]);
});


test('readiness regression: crash recovery requires the encrypted PINs to remain readable', async () => {
  for (const key of ['', 'b'.repeat(64)]) {
    process.env.RESULTS_CHECKER_PIN_KEY = 'a'.repeat(64);
    const order = await pendingOrder();
    await OrdersStore.markOrderPaid(order.payment_reference, new Date().toISOString());
    await OrdersStore.claimOrderForSupplierDispatch(order.id);
    const status = mock.method(OrdersStore, 'updateOrderStatus', async () => { throw Error('synthetic crash'); });
    await assert.rejects(ResultsCheckerService.applyPurchase(await fresh(order), pinsReply(), 1, 1800));
    status.mock.restore(); process.env.RESULTS_CHECKER_PIN_KEY = key;
    await ResultsCheckerService.refresh(await fresh(order));
    assert.notEqual((await fresh(order)).status, 'delivered');
    assert.equal((await fresh(order)).manual_review, true);
  }
  process.env.RESULTS_CHECKER_PIN_KEY = 'a'.repeat(64);
  assert.equal(purchase.mock.callCount(), 0);
});
