import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { beforeEach, afterEach, test } from 'node:test';
import type { Request, Response } from 'express';
import { OrdersStore } from '../../db/ordersStore.js';
import { FulfilmentService } from '../../services/fulfilmentService.js';
import { PaystackServerService } from '../../services/paystackService.js';
import { validateOrderPayment } from '../../services/paymentValidation.js';
import { SuccessBizHubWebhookHandler } from '../successBizHub/webhookHandler.js';
import type { OrderRecord, OrderStatus } from '../../types/orders.js';

const environment = { ...process.env };
const originalFetch = globalThis.fetch;
let sequence = 0;

beforeEach(() => {
  delete process.env.DATABASE_URL;
  process.env.NODE_ENV = 'test';
  process.env.PAYSTACK_SECRET_KEY = 'sk_live_fixture';
  process.env.SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED = 'false';
  process.env.SUCCESS_BIZ_HUB_WEBHOOK_SECRET = 'fixture-webhook-secret';
  OrdersStore.clearDevStore();
  // No test in this suite may contact a payment/supplier service.
  globalThis.fetch = async () => { throw new Error('Unexpected external request in integrity tests'); };
});
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
  Object.assign(process.env, environment);
  globalThis.fetch = originalFetch;
});

function fixture(status: OrderStatus = 'pending_payment'): OrderRecord {
  const id = `integrity_${++sequence}`;
  const now = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return {
    id, public_reference: `MH-${id}`, payment_reference: `PAY-${id}`,
    customer_name: 'Integrity Test', customer_email: 'test@example.com',
    customer_phone: '+233201234567', recipient_phone: '+233201234567', network: 'telecel',
    service_type: 'instant_bundle', product_id: 'instant-fixture', product_name_snapshot: 'Fixture',
    bundle_size_snapshot: '1GB', amount: 1000, currency: 'GHS', status,
    payment_provider: 'paystack', payment_status: status === 'pending_payment' ? 'pending' : 'success',
    supplier_provider: 'success_biz_hub', supplier_order_id: status === 'pending_payment' ? null : `SBH-${id}`,
    supplier_response: null, supplier_cost_minor: null, supplier_offer_ref: 'fixture',
    supplier_last_checked_at: null, failure_reason: null, created_at: now, updated_at: now,
    paid_at: status === 'pending_payment' ? null : now, submitted_at: null, delivered_at: null,
  };
}

async function webhook(body: object, signature?: string) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const signed = signature ?? crypto.createHmac('sha256', 'fixture-webhook-secret').update(rawBody).digest('hex');
  let code = 0;
  let result: any;
  const req = { headers: { 'x-webhook-signature': signed }, body, rawBody } as unknown as Request;
  const res = { status(value: number) { code = value; return this; }, json(value: unknown) { result = value; return this; } } as unknown as Response;
  await SuccessBizHubWebhookHandler.handle(req, res);
  return { code, result };
}

function event(order: OrderRecord, id = `event-${order.id}`, status = 'delivered') {
  return { event: 'order.status.updated', event_id: id, data: { publicId: order.supplier_order_id, status } };
}

test('production rejects missing supplier webhook secret before processing', async () => {
  const order = fixture('submitted');
  await OrdersStore.createOrder(order);
  process.env.NODE_ENV = 'production';
  delete process.env.SUCCESS_BIZ_HUB_WEBHOOK_SECRET;
  assert.equal((await webhook(event(order))).code, 503);
  assert.equal((await OrdersStore.findOrder(order.id))?.status, 'submitted');
});

test('invalid signatures reject without consuming the event; valid signed retry succeeds', async () => {
  const order = fixture('submitted');
  await OrdersStore.createOrder(order);
  assert.equal((await webhook(event(order), 'invalid')).code, 401);
  assert.equal((await OrdersStore.findOrder(order.id))?.status, 'submitted');
  assert.equal((await webhook(event(order))).code, 200);
  assert.equal((await OrdersStore.findOrder(order.id))?.status, 'delivered');
});

test('duplicate and simultaneous signed events apply a successful transition only once', async () => {
  const order = fixture('submitted');
  await OrdersStore.createOrder(order);
  const results = await Promise.all([webhook(event(order)), webhook(event(order))]);
  assert.ok(results.every(r => r.code === 200));
  assert.equal(results.filter(r => r.result.message === 'Duplicate event acknowledged.').length, 1);
  const delivered = await OrdersStore.findOrder(order.id);
  await webhook(event(order));
  assert.equal((await OrdersStore.findOrder(order.id))?.updated_at, delivered?.updated_at);
});

test('processing failure returns non-2xx and allows the exact signed event to retry', async () => {
  const order = fixture('submitted');
  await OrdersStore.createOrder(order);
  const original = OrdersStore.updateOrderStatus;
  OrdersStore.updateOrderStatus = async () => { throw new Error('fixture database failure'); };
  try { assert.equal((await webhook(event(order))).code, 503); }
  finally { OrdersStore.updateOrderStatus = original; }
  assert.equal((await webhook(event(order))).code, 200);
  assert.equal((await OrdersStore.findOrder(order.id))?.status, 'delivered');
});

test('webhook arriving before supplier ID persistence can retry after the order exists', async () => {
  const order = fixture('submitted');
  assert.equal((await webhook(event(order))).code, 503);
  await OrdersStore.createOrder(order);
  assert.equal((await webhook(event(order))).code, 200);
});

test('first confirmation moves pending to paid', async () => {
  const order = fixture();
  await OrdersStore.createOrder(order);
  const result = await OrdersStore.markOrderPaid(order.payment_reference, new Date().toISOString());
  assert.equal(result.alreadyPaid, false);
  assert.equal(result.order?.status, 'paid');
  assert.equal(result.order?.payment_status, 'success');
});

for (const status of ['queued', 'submitted', 'processing', 'delivered', 'refunded'] as OrderStatus[]) {
  test(`duplicate payment confirmation preserves ${status}`, async () => {
    const order = fixture(status);
    await OrdersStore.createOrder(order);
    const result = await OrdersStore.markOrderPaid(order.payment_reference, new Date().toISOString());
    assert.equal(result.alreadyPaid, true);
    assert.deepEqual(result.order, order);
  });
}

test('concurrent confirmations and dispatches make one supplier purchase', async () => {
  const order = fixture();
  await OrdersStore.createOrder(order);
  process.env.SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED = 'true';
  const provider = FulfilmentService.getProvider();
  const original = provider.placeInstantBundle;
  let purchases = 0;
  provider.placeInstantBundle = async () => {
    purchases++;
    await new Promise(resolve => setTimeout(resolve, 5));
    return { success: true, supplierOrderId: 'SBH-once', status: 'submitted' };
  };
  try {
    await Promise.all(Array.from({ length: 20 }, () => FulfilmentService.processPaidOrder(order.payment_reference, new Date().toISOString())));
    assert.equal(purchases, 1);
    assert.equal((await OrdersStore.findOrder(order.id))?.status, 'submitted');
  } finally { provider.placeInstantBundle = original; }
});

for (const [name, change] of [
  ['amount', { amountPesewas: 999 }], ['zero amount', { amountPesewas: 0 }],
  ['currency', { currency: 'USD' }], ['reference', { reference: 'another-order' }],
  ['unverified success', { isVerified: false }],
] as const) {
  test(`stale reconciliation rejects ${name} mismatch without marking paid or dispatching`, async () => {
    const order = fixture();
    await OrdersStore.createOrder(order);
    const verify = PaystackServerService.verifyTransaction;
    const dispatch = FulfilmentService.processPaidOrder;
    let calls = 0;
    PaystackServerService.verifyTransaction = async () => ({
      isVerified: true, status: 'success', reference: order.payment_reference,
      amountPesewas: order.amount, currency: order.currency, ...change,
    });
    FulfilmentService.processPaidOrder = async () => { calls++; throw new Error('must not dispatch'); };
    try {
      const result = await OrdersStore.reconcileStalePendingPayments();
      assert.equal(result.unresolvedCount, 1);
      assert.equal(calls, 0);
      assert.equal((await OrdersStore.findOrder(order.id))?.status, 'pending_payment');
      assert.equal((await OrdersStore.findOrder(order.id))?.payment_status, 'pending');
    } finally { PaystackServerService.verifyTransaction = verify; FulfilmentService.processPaidOrder = dispatch; }
  });
}

test('matching authoritative reconciliation progresses payment through the existing pipeline', async () => {
  const order = fixture();
  await OrdersStore.createOrder(order);
  const verify = PaystackServerService.verifyTransaction;
  PaystackServerService.verifyTransaction = async () => ({
    isVerified: true, status: 'success', reference: order.payment_reference, amountPesewas: order.amount, currency: 'GHS',
  });
  try {
    assert.equal((await OrdersStore.reconcileStalePendingPayments()).verifiedPaidCount, 1);
    assert.equal((await OrdersStore.findOrder(order.id))?.payment_status, 'success');
  } finally { PaystackServerService.verifyTransaction = verify; }
});

test('development simulation is explicit and cannot bypass production amount validation', () => {
  const order = fixture();
  delete process.env.PAYSTACK_SECRET_KEY;
  const simulated = { isVerified: true, status: 'success' as const, reference: order.payment_reference, currency: 'GHS', amountPesewas: 0, isSimulated: true };
  assert.equal(validateOrderPayment(order, simulated), null);
  process.env.NODE_ENV = 'production';
  assert.equal(validateOrderPayment(order, simulated), 'payment_amount_mismatch');
});

test('ambiguous supplier timeout is visible for review and never blindly resubmitted', async () => {
  const order = fixture();
  await OrdersStore.createOrder(order);
  process.env.SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED = 'true';
  const provider = FulfilmentService.getProvider();
  const original = provider.placeInstantBundle;
  let purchases = 0;
  provider.placeInstantBundle = async () => { purchases++; throw Object.assign(new Error('fixture timeout'), { isTimeout: true }); };
  try {
    await FulfilmentService.processPaidOrder(order.payment_reference, new Date().toISOString());
    await FulfilmentService.processPaidOrder(order.payment_reference, new Date().toISOString());
    await FulfilmentService.reconcileActiveSupplierOrders(true);
    const current = await OrdersStore.findOrder(order.id);
    assert.equal(purchases, 1);
    assert.equal(current?.status, 'queued');
    assert.equal(current?.manual_review, true);
    assert.equal(current?.failure_reason, 'supplier_submission_uncertain');
    assert.equal(await OrdersStore.getUncertainSupplierSubmissionCount(), 1);
    assert.equal((await OrdersStore.searchOrdersAdmin({ manualReview: true })).orders.length, 1);
  } finally { provider.placeInstantBundle = original; }
});

test('uncertain order with a reliable supplier ID is polled, never purchased again', async () => {
  const order = fixture('queued');
  order.failure_reason = 'supplier_submission_uncertain';
  await OrdersStore.createOrder(order);
  process.env.SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED = 'true';
  process.env.SUCCESS_BIZ_HUB_API_KEY = 'fixture-key';
  const provider = FulfilmentService.getProvider();
  const original = provider.getInstantBundleStatus;
  let queried = '';
  provider.getInstantBundleStatus = async id => { queried = id; return { success: true, status: 'delivered' }; };
  try {
    await FulfilmentService.reconcileActiveSupplierOrders(true);
    assert.equal(queried, order.supplier_order_id);
    assert.equal((await OrdersStore.findOrder(order.id))?.status, 'delivered');
  } finally { provider.getInstantBundleStatus = original; }
});

test('delayed supplier updates cannot downgrade processing/delivered or undo refunds', async () => {
  for (const [from, to] of [['processing', 'submitted'], ['delivered', 'processing'], ['delivered', 'refund_pending'], ['refunded', 'delivered']] as const) {
    const order = fixture(from);
    await OrdersStore.createOrder(order);
    assert.equal((await OrdersStore.updateOrderStatus(order.id, to))?.status, from);
  }
  const delivered = fixture('delivered');
  await OrdersStore.createOrder(delivered);
  assert.equal((await OrdersStore.updateOrderStatus(delivered.id, 'refunded', 'Explicit admin refund', undefined, undefined, { explicitReversal: true }))?.status, 'refunded');
});

test('late confirmed payment on an expired order records payment for review without dispatch', async () => {
  const order = fixture('expired');
  order.payment_status = 'expired';
  await OrdersStore.createOrder(order);
  await FulfilmentService.processPaidOrder(order.payment_reference, new Date().toISOString());
  const current = await OrdersStore.findOrder(order.id);
  assert.equal(current?.status, 'expired');
  assert.equal(current?.payment_status, 'success');
  assert.equal(current?.manual_review, true);
});

test('historical uncertain orders remain visible even without the new manual-review flag', async () => {
  const order = fixture('queued');
  order.manual_review = false;
  order.failure_reason = 'supplier_submission_uncertain';
  await OrdersStore.createOrder(order);
  assert.equal((await OrdersStore.searchOrdersAdmin({ status: 'needs_attention' })).orders.length, 1);
  assert.equal((await OrdersStore.getOverviewMetrics()).allTime.manualReviewPendingCount, 1);
});

test('marketplace admin status cannot downgrade completed delivery; explicit refund remains available', async () => {
  const order = fixture('delivered');
  order.service_type = 'marketplace';
  order.marketplace_status = 'completed';
  await OrdersStore.createOrder(order);
  assert.equal((await OrdersStore.updateMarketplaceStatus(order.id, 'awaiting_fulfilment'))?.status, 'delivered');
  assert.equal((await OrdersStore.updateMarketplaceStatus(order.id, 'refunded'))?.status, 'refunded');
});
