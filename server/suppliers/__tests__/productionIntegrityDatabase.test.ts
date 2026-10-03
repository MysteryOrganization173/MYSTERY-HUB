/** Database-path regressions using the existing pg driver's query boundary.
 * SQL predicates/transaction ordering are asserted; no live database or supplier is contacted.
 */
import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import pg from 'pg';
import { OrdersStore } from '../../db/ordersStore.js';
import { ReferralService } from '../../services/referralService.js';
import type { OrderRecord } from '../../types/orders.js';

const environment = { ...process.env };
const originalQuery = pg.Pool.prototype.query;
const originalConnect = pg.Pool.prototype.connect;
const originalReward = ReferralService.processOrderReward;
let orders: Map<string, OrderRecord>;
let events: Set<string>;
let statements: string[];
let failCompletion: boolean;
let deliverBeforeUpdate: boolean;
let snapshot: { orders: Map<string, OrderRecord>; events: Set<string> } | undefined;
let rewardCalls: number;

function fixture(id = 'a', status: OrderRecord['status'] = 'pending_payment'): OrderRecord {
  const now = new Date().toISOString();
  return { id, public_reference: `MH-${id}`, payment_reference: `PAY-${id}`, customer_name: 'Fixture',
    customer_email: 'fixture@example.com', customer_phone: '+233201234567', recipient_phone: '+233201234567',
    network: 'telecel', product_id: 'fixture', product_name_snapshot: 'Fixture', bundle_size_snapshot: '1GB',
    amount: 1000, currency: 'GHS', status, payment_provider: 'paystack',
    payment_status: status === 'pending_payment' ? 'pending' : 'success', supplier_provider: 'success_biz_hub',
    supplier_order_id: `SBH-${id}`, supplier_response: null, supplier_cost_minor: null, supplier_offer_ref: null,
    supplier_last_checked_at: null, failure_reason: null, created_at: now, updated_at: now,
    paid_at: status === 'pending_payment' ? null : now, submitted_at: null, delivered_at: null };
}

async function query(sql: string, values: any[] = []) {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  statements.push(normalized);
  const row = (value?: OrderRecord) => ({ rows: value ? [{ ...value }] : [] });
  if (normalized === 'BEGIN') {
    snapshot = { orders: new Map([...orders].map(([id, order]) => [id, { ...order }])), events: new Set(events) };
    return { rows: [] };
  }
  if (normalized === 'ROLLBACK') { orders = snapshot!.orders; events = snapshot!.events; return { rows: [] }; }
  if (normalized === 'COMMIT' || normalized.includes('pg_advisory_xact_lock')) return { rows: [] };
  if (normalized.startsWith('SELECT event_id')) return { rows: events.has(values[0]) ? [{ event_id: values[0] }] : [] };
  if (normalized.startsWith('INSERT INTO supplier_webhook_events')) {
    if (failCompletion) throw new Error('fixture completion failure');
    const present = events.has(values[0]);
    events.add(values[0]);
    return { rows: present ? [] : [{ event_id: values[0] }] };
  }
  if (normalized.startsWith('SELECT * FROM orders')) {
    const order = [...orders.values()].find(o => normalized.includes('WHERE supplier_order_id')
      ? o.supplier_order_id === values[0]
      : [o.id, o.payment_reference, o.public_reference].includes(values[0]));
    return row(order);
  }
  if (normalized.startsWith('UPDATE orders SET status = CASE')) {
    assert.match(normalized, /WHERE payment_reference = \$1 AND status IN \('pending_payment', 'cancelled', 'expired'\) AND payment_status IN/);
    assert.match(normalized, /ELSE status END/);
    const order = [...orders.values()].find(o => o.payment_reference === values[0]);
    if (!order || !['pending_payment', 'cancelled', 'expired'].includes(order.status)
      || !['pending', 'cancelled', 'expired'].includes(order.payment_status)) return row();
    const updated = { ...order, status: order.status === 'pending_payment' ? 'paid' as const : order.status,
      payment_status: 'success' as const, paid_at: values[1], updated_at: values[2] };
    orders.set(order.id, updated);
    return row(updated);
  }
  if (normalized.startsWith("UPDATE orders SET status = 'queued'")) {
    assert.match(normalized, /WHERE id = \$2 AND status = 'paid' AND payment_status = 'success'/);
    const order = orders.get(values[1]);
    if (!order || order.status !== 'paid' || order.payment_status !== 'success') return row();
    const updated = { ...order, status: 'queued' as const, updated_at: values[0] };
    orders.set(order.id, updated);
    return row(updated);
  }
  if (normalized.startsWith('UPDATE orders SET status = $1, failure_reason')) {
    assert.match(normalized, /WHERE id = \$8 AND status = \$9 RETURNING/);
    const order = orders.get(values[7]);
    if (!order) return row();
    if (deliverBeforeUpdate) { order.status = 'delivered'; deliverBeforeUpdate = false; }
    if (order.status !== values[8]) return row();
    const updated = { ...order, status: values[0], failure_reason: values[1], supplier_order_id: values[2],
      supplier_response: values[3], delivered_at: values[4], updated_at: values[5], supplier_last_checked_at: values[6] };
    orders.set(order.id, updated);
    return row(updated);
  }
  throw new Error(`Unexpected test query: ${normalized}`);
}

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://fixture.invalid/never-contacted';
  orders = new Map(); events = new Set(); statements = []; failCompletion = false; deliverBeforeUpdate = false; rewardCalls = 0;
  pg.Pool.prototype.query = query as any;
  pg.Pool.prototype.connect = (async () => ({ query, release() {} })) as any;
  ReferralService.processOrderReward = async () => {
    assert.ok(events.has('event'), 'reward effects must occur only after event commit');
    assert.equal(statements.at(-1), 'COMMIT');
    rewardCalls++;
    return null;
  };
});
afterEach(() => {
  pg.Pool.prototype.query = originalQuery;
  pg.Pool.prototype.connect = originalConnect;
  ReferralService.processOrderReward = originalReward;
  for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
  Object.assign(process.env, environment);
});

test('database payment confirmation starts with a conditional UPDATE and concurrent claims have one winner', async () => {
  const order = fixture(); orders.set(order.id, order);
  const claims = await Promise.all(Array.from({ length: 30 }, async () => {
    await OrdersStore.markOrderPaid(order.payment_reference, new Date().toISOString());
    return OrdersStore.claimOrderForSupplierDispatch(order.id);
  }));
  assert.ok(statements[0].startsWith('UPDATE orders SET status = CASE'));
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal(orders.get(order.id)?.status, 'queued');
  for (const status of ['submitted', 'processing', 'delivered'] as const) {
    orders.get(order.id)!.status = status;
    await OrdersStore.markOrderPaid(order.payment_reference, new Date().toISOString());
    assert.equal(orders.get(order.id)?.status, status);
  }
});

test('completion persistence failure rolls back order changes and permits retry', async () => {
  orders.set('a', fixture('a', 'submitted'));
  const updates = [{ supplierOrderId: 'SBH-a', status: 'delivered' as const, response: '{}' }];
  failCompletion = true;
  await assert.rejects(OrdersStore.processSupplierWebhookEvent('event', 'order.status.updated', {}, updates));
  assert.equal(orders.get('a')?.status, 'submitted');
  assert.equal(events.size, 0);
  assert.equal(rewardCalls, 0);
  assert.equal(statements.at(-1), 'ROLLBACK');
  failCompletion = false;
  assert.equal(await OrdersStore.processSupplierWebhookEvent('event', 'order.status.updated', {}, updates), true);
  assert.equal(orders.get('a')?.status, 'delivered');
  assert.equal(rewardCalls, 1);
  assert.equal(await OrdersStore.processSupplierWebhookEvent('event', 'order.status.updated', {}, updates), false);
  assert.equal(rewardCalls, 1);
});

test('a grouped event rolls back all orders if a later item is unavailable', async () => {
  orders.set('a', fixture('a', 'submitted'));
  const updates = [
    { supplierOrderId: 'SBH-a', status: 'delivered' as const, response: '{}' },
    { supplierOrderId: 'SBH-z', status: 'processing' as const, response: '{}' },
  ];
  await assert.rejects(OrdersStore.processSupplierWebhookEvent('event', 'order.status.updated', {}, updates));
  assert.equal(orders.get('a')?.status, 'submitted');
  assert.equal(events.size, 0);
  orders.set('z', fixture('z', 'submitted'));
  await OrdersStore.processSupplierWebhookEvent('event', 'order.status.updated', {}, updates);
  assert.equal(orders.get('a')?.status, 'delivered');
  assert.equal(orders.get('z')?.status, 'processing');
});

test('compare-and-set rechecks a concurrent delivery before applying a stale supplier callback', async () => {
  orders.set('a', fixture('a', 'submitted'));
  deliverBeforeUpdate = true;
  const result = await OrdersStore.updateOrderStatus('a', 'processing');
  assert.equal(result?.status, 'delivered');
  assert.equal(orders.get('a')?.status, 'delivered');
  assert.equal(rewardCalls, 0);
});
