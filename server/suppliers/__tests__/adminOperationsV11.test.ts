import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createAdminRequestScope } from '../../../src/utils/adminRequestScope';
import { adminOrderSearchParams, orderEventAge } from '../../../src/utils/adminOrderView';
import { describeOrderCase, isNeedsAttention, orderTimeline, ORDER_LENSES } from '../../../src/utils/adminOrderCase';
import { OrdersStore } from '../../db/ordersStore';
import { AuthStore } from '../../db/authStore';
import { adminRouter } from '../../routes/adminApi';
import { FulfilmentService } from '../../services/fulfilmentService';
import { opsOrder } from './adminOperationsFixtures';
import type { OrderRecord } from '../../types/orders';

let server: Server, base: string;
let reconciliationCalls = 0;
const originalReconcile = FulfilmentService.reconcileActiveSupplierOrders;
before(async () => {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.DATABASE_URL, undefined, 'this suite must use isolated memory');
  AuthStore._clearDevStore();
  for (const role of ['admin', 'customer'] as const) {
    await AuthStore.createUser({ id: role, name: 'Synthetic staff test', email: `${role}@example.test`, phone: null, passwordHash: 'unused', role });
    await AuthStore.createSession(role, `${role}-v11`);
  }
  FulfilmentService.reconcileActiveSupplierOrders = async () => { reconciliationCalls++; return { scanned: 0, updatedCount: 0 }; };
  const app = express(); app.use(express.json()); app.use('/api/admin', adminRouter);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => OrdersStore.clearDevStore());
after(async () => { FulfilmentService.reconcileActiveSupplierOrders = originalReconcile; await new Promise<void>(resolve => server.close(() => resolve())); });
const get = (path: string, token = 'admin-v11') => fetch(base + '/api/admin/' + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

test('default reference search finds cancelled and expired paid orders; explicit lenses remain explicit', async () => {
  for (const status of ['cancelled', 'expired'] as const) {
    const order = opsOrder({ status, public_reference: `MH-CUSTOMER-${status}`, delivered_at: null });
    await OrdersStore.createOrder(order);
    const params = adminOrderSearchParams('active', order.public_reference);
    const response = await get(`orders?readOnly=true&q=${order.public_reference}&status=${params.status}`);
    assert.equal(response.status, 200);
    const result = await response.json(); assert.equal(result.pagination.total, 1); assert.equal(result.orders[0].public_reference, order.public_reference);
  }
  assert.deepEqual(adminOrderSearchParams('active', ''), {});
  assert.deepEqual(adminOrderSearchParams('needs_attention', 'MH-EXACT'), { status: 'needs_attention' });
  assert.deepEqual(adminOrderSearchParams('delivered', 'MH-EXACT'), { status: 'delivered' });
});

test('attention list, per-order explanation and overview agree without treating normal work as incidents', async () => {
  const cases: Array<[Partial<OrderRecord>, boolean]> = [
    [{ status: 'pending_payment', payment_status: 'pending', supplier_order_id: null, paid_at: null }, false],
    [{ status: 'paid', supplier_order_id: null }, false],
    [{ status: 'queued', supplier_order_id: null }, false],
    [{ status: 'processing', supplier_response: '{"status":"processing"}' }, false],
    [{ status: 'processing', failure_reason: 'supplier_submission_uncertain', supplier_order_id: null }, true],
    [{ status: 'failed' }, true],
    [{ status: 'refund_pending' }, true],
    [{ status: 'refunded' }, true],
    [{ status: 'paid', manual_review: true }, true],
    [{ status: 'failed', payment_status: 'failed', manual_review: true, failure_reason: 'Pre-launch fixture' }, false],
    [{ status: 'failed', resolution_json: { version: 1, stage: 'resolved', outcome: 'wallet_refund', lastActor: 'admin', updatedAt: new Date().toISOString() } }, false],
  ];
  const expected: string[] = [];
  for (const [extra, actionable] of cases) {
    const order = opsOrder(extra); await OrdersStore.createOrder(order);
    const input = { ...order, resolution: order.resolution_json };
    assert.equal(isNeedsAttention(input), actionable, JSON.stringify(extra));
    if (actionable) expected.push(order.public_reference);
  }
  const result = await (await get('orders?readOnly=true&status=needs_attention&limit=100')).json();
  assert.deepEqual(result.orders.map((o: any) => o.public_reference).sort(), expected.sort());
  const overview = await (await get('overview?readOnly=true')).json();
  assert.equal(overview.metrics.allTime.manualReviewPendingCount, expected.length);
  assert.equal(reconciliationCalls, 0, 'passive investigation must not dispatch or reconcile');
});

test('authorized filters and pagination retain separate payment/fulfilment semantics', async () => {
  for (let i = 0; i < 23; i++) await OrdersStore.createOrder(opsOrder({ network: 'mtn', status: 'processing', public_reference: `MH-PAGE-${i}` }));
  await OrdersStore.createOrder(opsOrder({ network: 'telecel', status: 'processing' }));
  await OrdersStore.createOrder(opsOrder({ network: 'mtn', payment_status: 'pending', status: 'pending_payment', paid_at: null }));
  const first = await (await get('orders?readOnly=true&status=with_supplier&network=mtn&paymentStatus=success&limit=20&page=1')).json();
  const second = await (await get('orders?readOnly=true&status=with_supplier&network=mtn&paymentStatus=success&limit=20&page=2')).json();
  assert.equal(first.pagination.total, 23); assert.equal(first.pagination.totalPages, 2); assert.equal(first.orders.length, 20); assert.equal(second.orders.length, 3);
  assert.equal(new Set([...first.orders, ...second.orders].map(o => o.id)).size, 23);
  const all = await (await get('orders?readOnly=true&status=all&paymentStatus=pending')).json(); assert.equal(all.pagination.total, 1);
});

test('list and detail refresh read fresh stored facts without supplier submissions or passive reconciliation', async () => {
  const order = opsOrder({ status: 'processing', delivered_at: null }); await OrdersStore.createOrder(order);
  const first = await (await get(`orders/${order.public_reference}`)).json(); assert.equal(first.order.status, 'processing');
  await OrdersStore.updateOrderStatus(order.id, 'delivered');
  const detail = await (await get(`orders/${order.public_reference}`)).json();
  const list = await (await get(`orders?readOnly=true&q=${order.public_reference}&status=all`)).json();
  assert.equal(detail.order.status, 'delivered'); assert.equal(list.orders[0].status, 'delivered'); assert.equal(reconciliationCalls, 0);
});

test('order search, detail and attention reads remain staff-only and deny customer enumeration', async () => {
  const order = opsOrder(); await OrdersStore.createOrder(order);
  for (const path of ['orders?readOnly=true&q=MH-', 'orders?readOnly=true&status=needs_attention', `orders/${order.public_reference}`, 'overview?readOnly=true']) {
    for (const [token, status] of [['', 401], ['customer-v11', 403]] as const) {
      const response = await get(path, token); assert.equal(response.status, status);
      const body = await response.text(); assert.ok(!body.includes(order.customer_email)); assert.ok(!body.includes(order.public_reference));
    }
  }
});

test('uncertain submission guidance distinguishes a recorded supplier identifier from absent acceptance evidence', () => {
  const uncertain = { status: 'processing', payment_status: 'success', failure_reason: 'supplier_submission_uncertain' };
  assert.match(describeOrderCase(uncertain).nextStep, /No supplier identifier.*supplier support/);
  assert.match(describeOrderCase({ ...uncertain, supplier_order_id: 'real-reference' }).nextStep, /recorded supplier reference/);
  assert.match(describeOrderCase(uncertain).nextStep, /Do not resubmit/);
  assert.equal(ORDER_LENSES.find(item => item.id === 'processing')?.params.status, 'with_supplier');
  const timeline = orderTimeline(uncertain);
  assert.equal(timeline.some(step => step.label === 'Not delivered' || step.label === 'Delivered'), false);
  assert.ok(timeline.some(step => step.label === 'Delivery not confirmed' && step.state === 'current'));
  assert.ok(timeline.some(step => step.label === 'Supplier reconciliation'));
});
test('a legacy processing status without a supplier identifier does not invent acceptance', () => {
  const result = describeOrderCase({ status: 'processing', payment_status: 'success' });
  assert.equal(result.key, 'queued_for_supplier'); assert.match(result.explanation, /does not confirm acceptance/); assert.equal(result.needsAttention, false);
});

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
for (const channel of ['list', 'detail', 'overview', 'queue', 'copy']) test(`delayed ${channel} response cannot replace a newer completed request`, async () => {
  const scope = createAdminRequestScope(); scope.setContext('staff-one');
  let displayed = '';
  const older = deferred<string>(), newer = deferred<string>();
  const run = async (request: Promise<string>) => { const current = scope.begin(channel); const result = await request; if (current()) displayed = result; };
  const a = run(older.promise), b = run(newer.promise); newer.resolve('new'); await b; older.resolve('old'); await a; assert.equal(displayed, 'new');
});
test('closing/reopening the same order and completing an action invalidate its pending detail load', async () => {
  const scope = createAdminRequestScope(); scope.setContext('admin');
  const first = scope.begin('detail'); scope.invalidate('detail'); const reopened = scope.begin('detail');
  assert.equal(first(), false); assert.equal(reopened(), true);
  scope.invalidate('detail'); const action = scope.begin('action'); assert.equal(reopened(), false); assert.equal(action(), true);
});
test('session change and unmount invalidate every old response, including actions and clipboard feedback', () => {
  const scope = createAdminRequestScope(); scope.setContext('admin-one');
  const pending = ['list', 'detail', 'action', 'overview', 'copy'].map(channel => scope.begin(channel));
  scope.setContext('admin-two'); assert.ok(pending.every(current => !current()));
  const current = scope.begin('detail'); scope.invalidate(); assert.equal(current(), false);
});
test('independent list requests do not invalidate a newer full detail or an action', () => {
  const scope = createAdminRequestScope(); const detail = scope.begin('detail'), action = scope.begin('action');
  scope.begin('list'); scope.begin('list'); assert.equal(detail(), true); assert.equal(action(), true);
});
test('event ages describe the actual recorded update without inventing a failure time', () => {
  const now = Date.parse('2026-10-22T12:00:00Z');
  assert.equal(orderEventAge(null, now), 'Time not recorded'); assert.equal(orderEventAge('bad', now), 'Time not recorded');
  assert.equal(orderEventAge('2026-10-22T11:55:00Z', now), '5 min ago'); assert.equal(orderEventAge('2026-10-22T10:00:00Z', now), '2 hr ago'); assert.equal(orderEventAge('2026-10-20T12:00:00Z', now), '2 days ago');
});
