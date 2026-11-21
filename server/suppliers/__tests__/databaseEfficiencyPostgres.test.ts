import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import webPush from 'web-push';
import { AuthStore } from '../../db/authStore.js';
import { getPool, initDatabase } from '../../db/connection.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { WebsiteBusinessService } from '../../services/websiteBusinessService.js';
import { FulfilmentService } from '../../services/fulfilmentService.js';
import { adminPeriod, financialReport, reportingFinancialOrders, reportingOrders } from '../../services/adminReporting.js';
import { processNotificationBatch } from '../../services/notificationWorker.js';
import type { OrderRecord } from '../../types/orders.js';
import { assertSafeTestDatabase } from '../../utils/environment.js';
import { opsOrder } from './adminOperationsFixtures.js';

const url = process.env.MYSTERY_EFFICIENCY_POSTGRES_URL;

test('database efficiency preserves recovery, finance totals and the existing worker cadence', { skip: !url }, async t => {
  assert.equal(process.env.DATABASE_URL, undefined);
  assertSafeTestDatabase({ NODE_ENV:'test', DATABASE_URL:url, MYSTERY_TEST_DATABASE_OPT_IN:'true' });
  Object.assign(process.env, { NODE_ENV:'test', DATABASE_URL:url, DATABASE_SSL:'false', MYSTERY_TEST_DATABASE_OPT_IN:'true' });
  const db = getPool()!;
  try {
    assert.equal((await db.query("SELECT to_regclass('public.orders') AS existing")).rows[0].existing, null);
    await initDatabase();
    await AuthStore.createUser({ id:'eff-owner', name:'Synthetic owner', passwordHash:'fixture', email:null, phone:null, role:'customer' });
    const context: NonNullable<OrderRecord['store_context']> = {
      channel:'website_store', siteId:'eff-store', ownerId:'eff-owner', productId:'fixture',
      retailMinor:1000, wholesaleMinor:800, reserveMinor:20, earningMinor:180,
      supplierCostMinor:600, currency:'GHS', policyVersion:'synthetic',
      wholesaleVersion:'synthetic', priceVersion:'synthetic',
    };
    const time = '2026-11-20T12:00:00Z';
    const save = (patch: Partial<OrderRecord> = {}) => OrdersStore.createOrder(opsOrder({
      user_id:null, store_context:context, paid_at:time, submitted_at:time, delivered_at:time,
      created_at:time, updated_at:time, ...patch,
    }));
    const saleState = async (id: string) => (await db.query(
      "SELECT state FROM finance_operations WHERE user_id='eff-owner' AND idempotency_key=$1",
      ['store-sale:' + id],
    )).rows[0]?.state;

    await t.test('fifty settled sales no longer hide pending credit, reversal or a supplier review', async () => {
      const settled: string[] = [];
      for (let i = 0; i < 50; i++) {
        const order = await save({ created_at:'2026-10-01T00:00:00Z', updated_at:'2026-10-01T00:00:00Z' });
        await WebsiteBusinessService.syncOrder(order);
        settled.push(order.id);
      }
      const missing = await save();
      const pending = await save({ status:'processing', delivered_at:null });
      await WebsiteBusinessService.syncOrder(pending);
      await db.query("UPDATE orders SET status='delivered',delivered_at=$2 WHERE id=$1", [pending.id,time]);
      const reversal = await save();
      await WebsiteBusinessService.syncOrder(reversal);
      await db.query("UPDATE orders SET status='failed' WHERE id=$1", [reversal.id]);
      const review = await save({ status:'processing', manual_review:true, delivered_at:null });
      await WebsiteBusinessService.syncOrder(review);
      await db.query("UPDATE orders SET status='failed',manual_review=true WHERE id=$1", [review.id]);
      const paid = await save({ status:'paid', supplier_order_id:null, submitted_at:null, delivered_at:null });

      const previous = (await db.query(`SELECT o.id FROM orders o LEFT JOIN finance_operations f
        ON f.kind='store_sale' AND f.payload->>'orderId'=o.id
        WHERE o.store_context IS NOT NULL AND o.payment_status='success'
         AND (o.status='paid' OR f.id IS NULL OR (f.state IN ('pending','available','manual_review')
           AND o.status IN ('delivered','failed','refunded','cancelled')))
        ORDER BY o.updated_at LIMIT 50`)).rows.map(row=>row.id);
      assert.deepEqual(new Set(previous), new Set(settled));

      const touched: string[] = [], refreshed: string[] = [], dispatched: string[] = [];
      const sync = WebsiteBusinessService.syncOrder.bind(WebsiteBusinessService);
      const fixtureMocks = [
        t.mock.method(WebsiteBusinessService,'syncOrder',async (order: OrderRecord) => { touched.push(order.id); return sync(order); }),
        t.mock.method(FulfilmentService,'refreshOrderStatusIfDue',async (order: OrderRecord) => { refreshed.push(order.id); return order; }),
        t.mock.method(FulfilmentService,'processPaidOrder',async (reference: string) => { dispatched.push(reference); }),
      ];
      try {
        await WebsiteBusinessService.recoverEffects();
        assert.deepEqual(new Set(touched),new Set([missing.id,pending.id,reversal.id,review.id,paid.id]));
        assert.deepEqual(refreshed,[review.id]);
        assert.deepEqual(dispatched,[paid.payment_reference]);
        assert.equal(await saleState(missing.id),'available');
        assert.equal(await saleState(pending.id),'available');
        assert.equal(await saleState(reversal.id),'reversed');
        assert.equal(await saleState(review.id),'pending');
        const ledger = (await db.query('SELECT * FROM finance_ledger ORDER BY id')).rows;
        await WebsiteBusinessService.recoverEffects();
        assert.deepEqual((await db.query('SELECT * FROM finance_ledger ORDER BY id')).rows,ledger);
        assert.ok(touched.every(id=>!settled.includes(id)));
      } finally { fixtureMocks.forEach(m=>m.mock.restore()); }
    });

    await t.test('report projection exactly preserves period totals without returning customer or audit details', async () => {
      const refund = await OrdersStore.createOrder(opsOrder({
        user_id:null, status:'refunded', paid_at:time, created_at:time, updated_at:time,
        resolution_json:{ stage:'resolved', version:1, outcome:'paystack_refund', verifiedAt:time, lastActor:'private-audit-fixture', updatedAt:time },
      }));
      await db.query('UPDATE orders SET resolution_json=$2 WHERE id=$1',[refund.id,refund.resolution_json]);
      const full = await reportingOrders();
      const projected = await reportingFinancialOrders();
      for (const period of ['all','today','last7','month']) {
        const window = adminPeriod({period}, new Date('2026-11-21T14:00:00Z'));
        assert.deepEqual(financialReport(projected, window),financialReport(full, window));
      }
      assert.equal(projected.length,full.length);
      assert.equal(financialReport(projected,adminPeriod({period:'all'},new Date('2026-11-21T14:00:00Z'))).confirmedRefundsMinor,1000);
      assert.doesNotMatch(JSON.stringify(projected),/private-audit-fixture|buyer@example|supplier_response/);
      const bytes = (rows:unknown)=>Buffer.byteLength(JSON.stringify(rows));
      assert.ok(bytes(projected)<bytes(full));
      t.diagnostic(`Synthetic report JSON bytes ${bytes(full)} -> ${bytes(projected)} across ${full.length} rows`);
    });

    await t.test('idle push tick uses one read with no transaction, including when paused', async () => {
      const keys = webPush.generateVAPIDKeys();
      Object.assign(process.env,{ WEB_PUSH_ENABLED:'true', WEB_PUSH_VAPID_PUBLIC_KEY:keys.publicKey,
        WEB_PUSH_VAPID_PRIVATE_KEY:keys.privateKey, WEB_PUSH_VAPID_SUBJECT:'mailto:fixture@example.test',
        WEB_PUSH_STORAGE_KEY:randomBytes(32).toString('base64') });
      // The deliberately isolated fixture has no pending push deliveries.
      await db.query('UPDATE mysteryhub_notifications.events SET expanded_at=now()');
      for (const paused of [true,false]) {
        await db.query('UPDATE mysteryhub_notifications.settings SET paused=$1 WHERE id',[paused]);
        const query = db.query.bind(db);
        const queries: string[] = [];
        const sample = t.mock.method(db,'query',((sql:string,...args:any[])=>{
          queries.push(sql);
          return (query as any)(sql,...args);
        }) as typeof db.query);
        try {
          assert.deepEqual(await processNotificationBatch(async()=>{throw Error('Unexpected provider call');}),{processed:0,disabled:paused});
          assert.equal(queries.length,1);
          assert.ok(queries[0].trimStart().startsWith('WITH policy'));
        } finally { sample.mock.restore(); }
      }
    });
  } finally { await db.end(); }
});
