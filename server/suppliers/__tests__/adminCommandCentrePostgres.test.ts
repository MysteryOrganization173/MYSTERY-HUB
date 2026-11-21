import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import pg from 'pg';
import { AuthStore } from '../../db/authStore.js';
import { getPool, initDatabase } from '../../db/connection.js';
import { MarketplaceControlStore } from '../../db/marketplaceControlStore.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { adminRouter } from '../../routes/adminApi.js';
import type { OrderRecord } from '../../types/orders.js';
import { hashSessionToken } from '../../utils/crypto.js';
import { assertSafeTestDatabase } from '../../utils/environment.js';
import { CREATIVE_INQUIRY_TYPE } from '../../../shared/creativeStudio.js';
import type { PaidOrderAlerts } from '../../../shared/adminAlerts.js';
import { shieldFixture } from './shieldFixtures.js';

const url = process.env.MYSTERY_ADMIN_ALERTS_POSTGRES_URL;

test('isolated PostgreSQL Admin alerts use the real private queues and sessions', { skip: !url }, async t => {
  assert.equal(process.env.DATABASE_URL, undefined);
  assertSafeTestDatabase({ NODE_ENV: 'test', DATABASE_URL: url, MYSTERY_TEST_DATABASE_OPT_IN: 'true' });
  const observer = new pg.Pool({ connectionString: url, ssl: false });
  let server: ReturnType<express.Express['listen']> | undefined;
  try {
    assert.equal((await observer.query("SELECT to_regclass('public.orders') name")).rows[0].name, null);
    Object.assign(process.env, { DATABASE_URL: url, DATABASE_SSL: 'false', MYSTERY_TEST_DATABASE_OPT_IN: 'true' });
    await initDatabase();
    for (const [id, role, expired] of [['admin', 'admin', false], ['expired', 'admin', true], ['customer', 'customer', false]] as const) {
      await AuthStore.createUser({ id, name: id, email: null, phone: null, passwordHash: 'synthetic', role });
      await observer.query('INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$1,$2,$3)',
        [id, hashSessionToken('synthetic-' + id), new Date(Date.now() + (expired ? -1 : 1) * 3_600_000)]);
    }
    const now = Date.now();
    let recipient = 0;
    const create = (label: string, patch: Partial<OrderRecord>) => OrdersStore.createOrder(shieldFixture(now, {
      id: 'alert-' + label, public_reference: 'MH-ALERT-' + label, payment_reference: 'PAY-ALERT-' + label,
      supplier_order_id: null, user_id: 'customer',
      recipient_phone: '+2332400000' + String(++recipient).padStart(2, '0'), ...patch,
    }));
    await create('HEALTHY', { status: 'processing' });
    await create('UNPAID', { status: 'failed', payment_status: 'pending', paid_at: null, manual_review: true });
    await observer.query("UPDATE orders SET manual_review = TRUE WHERE id = 'alert-UNPAID'");
    await create('UNCERTAIN', { status: 'queued', failure_reason: 'supplier_submission_uncertain' });
    await create('FAILED', { status: 'failed' });
    await create('REFUND', { status: 'refund_pending' });
    await create('RESOLVED', { status: 'failed', manual_review: true });
    await observer.query("UPDATE orders SET resolution_json = '{\"stage\":\"resolved\"}' WHERE id='alert-RESOLVED'");
    const creative = await MarketplaceControlStore.createInquiry({
      inquiryType: CREATIVE_INQUIRY_TYPE, productName: 'Synthetic quote', customerName: 'Private test customer',
      customerPhone: '0241234567', message: 'Private design brief',
    });

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server!.once('listening', resolve));
    const address = server.address() as { port: number };
    const read = (path: string, token?: string) => fetch(`http://127.0.0.1:${address.port}/api/admin/${path}`, {
      headers: token ? { Authorization: 'Bearer synthetic-' + token } : undefined,
    });
    const paid = () => read('alerts/paid-orders', 'admin');

    await t.test('customer, expired and anonymous sessions cannot read either source', async () => {
      for (const path of ['leads', 'alerts/paid-orders', 'orders?status=supplier_review&readOnly=true']) {
        for (const [token, status] of [[undefined, 401], ['expired', 401], ['customer', 403]] as const) {
          const response = await read(path, token);
          assert.equal(response.status, status);
          assert.equal(response.headers.get('cache-control'), 'no-store');
          assert.doesNotMatch(await response.text(), /MH-ALERT|Private design brief/);
        }
      }
    });
    await t.test('paid attention samples omit ordinary processing, unpaid flags and resolved cases', async () => {
      const response = await paid();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const { data } = await response.json() as { data: PaidOrderAlerts };
      assert.equal(data.total, 3);
      assert.deepEqual(Object.fromEntries(data.orders.map(row => [row.reference, row.reason])), {
        'MH-ALERT-UNCERTAIN': 'supplier_uncertain', 'MH-ALERT-FAILED': 'fulfilment_failed', 'MH-ALERT-REFUND': 'refund_exception',
      });
      for (const row of data.orders) assert.deepEqual(Object.keys(row).sort(), ['reason', 'reference', 'updatedAt']);
    });
    await t.test('Creative lead is identified without contact details and remains in the existing workflow', async () => {
      const response = await read('leads', 'admin');
      const body = await response.text();
      assert.equal(response.status, 200);
      const lead = JSON.parse(body).data.marketplace.latestNew[0];
      assert.equal(lead.reference, creative.id);
      assert.equal(lead.kind, 'creative');
      assert.doesNotMatch(body, /Private design brief|0241234567|Private test customer/);
      await MarketplaceControlStore.updateInquiry(creative.id, { expectedVersion: 0, status: 'contacted' }, 'admin');
      assert.equal((await (await read('leads', 'admin')).json()).data.marketplace.new, 0);
    });
    await t.test('older critical cases survive the limit even with five newer routine flags', async () => {
      for (let i = 0; i < 5; i++) {
        await create('FLAG-' + i, { status: 'processing', manual_review: true, created_at: new Date(now - i * 1000).toISOString() });
        await observer.query('UPDATE orders SET manual_review = TRUE WHERE id = $1', ['alert-FLAG-' + i]);
      }
      const { data } = await (await paid()).json() as { data: PaidOrderAlerts };
      assert.equal(data.total, 8);
      assert.equal(data.orders.length, 5);
      assert.deepEqual(new Set(data.orders.slice(0, 3).map(row => row.reason)), new Set(['supplier_uncertain', 'fulfilment_failed', 'refund_exception']));
      assert.ok(data.orders.slice(3).every(row => row.reason === 'flagged'));
    });
    await t.test('concurrent passive checks leave orders, ledgers and notification attempts unchanged', async () => {
      const snapshot = async () => {
        const rows = [];
        for (const table of ['orders', 'finance_ledger', 'finance_operations', 'reward_ledger', 'mysteryhub_notifications.attempts']) {
          rows.push((await observer.query(`SELECT * FROM ${table} ORDER BY 1`)).rows);
        }
        return rows;
      };
      const before = await snapshot();
      const responses = await Promise.all([paid(), paid(), read('leads', 'admin')]);
      for (const response of responses) assert.equal(response.status, 200);
      await Promise.all(responses.map(response => response.json()));
      assert.deepEqual(await snapshot(), before);
      const { rows: [privileges] } = await observer.query("SELECT has_table_privilege('anon','orders','SELECT') orders,has_table_privilege('authenticated','marketplace_inquiries','SELECT') enquiries");
      assert.deepEqual(privileges, { orders: false, enquiries: false });
    });
    await t.test('manual remedy leaves an independent supplier investigation without changing business facts', async () => {
      const original = await create('SPLIT', {
        status:'failed', submitted_at:null, failure_reason:'Pre-launch fixture',
        supplier_response:JSON.stringify({reason:'Synthetic ambiguous result',isTimeout:true,timestamp:new Date(now).toISOString()}),
      });
      const before = (await OrdersStore.findOrder(original.id))!;
      const financial = async () => ({
        operations:(await observer.query('SELECT * FROM finance_operations ORDER BY id')).rows,
        ledger:(await observer.query('SELECT * FROM finance_ledger ORDER BY id')).rows,
      });
      const money = await financial();
      const post = async (body:Record<string,unknown>) => fetch(`http://127.0.0.1:${address.port}/api/admin/orders/${original.public_reference}/resolution`, {
        method:'POST', headers:{Authorization:'Bearer synthetic-admin','Content-Type':'application/json'}, body:JSON.stringify(body),
      });
      const manual = {
        action:'resolve_manual',manualOutcome:'manual_fulfillment',confirmed:true,requestId:'split-native-remedy',
        expectedUpdatedAt:new Date(before.updated_at).toISOString(),expectedVersion:0,
        note:'Synthetic operator verified independent customer fulfillment',evidence:'Synthetic receipt checked',reference:'SYNTHETIC-REMEDY',
      };
      const alertsBefore=(await (await paid()).json()).data.total;
      const submitted = await Promise.all([post(manual),post({...manual,requestId:'split-native-remedy-second'})]);
      assert.deepEqual(submitted.map(r=>r.status).sort(),[200,409]);
      const queue = () => read('orders?status=supplier_review&readOnly=true','admin').then(r=>r.json());
      const open = await queue();
      assert.equal(open.orders.length,1);
      assert.equal(open.orders[0].resolution.supplierInvestigation,'open');
      assert.equal((await (await paid()).json()).data.total,alertsBefore-1);
      const evidence={
        action:'supplier_evidence',evidenceStatus:'delivered',confirmed:true,requestId:'split-native-evidence',
        expectedUpdatedAt:open.orders[0].updated_at,expectedVersion:1,
        note:'Synthetic supplier confirmed delivery and staff reconciled duplicate service',reference:'SYNTHETIC-SUPPORT',
      };
      assert.equal((await post(evidence)).status,200);
      assert.equal((await queue()).orders.length,0);
      const closed = (await OrdersStore.findOrder(original.id))!;
      assert.deepEqual(closed.resolution_json?.manual,open.orders[0].resolution.manual);
      assert.equal(closed.resolution_json?.supplierInvestigation,'closed');
      assert.equal(closed.resolution_json?.supplierEvidence?.status,'delivered');
      for(const field of ['status','payment_reference','payment_status','amount','supplier_order_id','supplier_response','submitted_at','delivered_at'] as const)
        assert.deepEqual(closed[field],before[field]);
      assert.deepEqual(await financial(),money);
      const audit = (await observer.query('SELECT action,metadata_safe_json::jsonb AS metadata FROM admin_audit_log WHERE entity_id=$1 ORDER BY created_at,id',[closed.id])).rows;
      assert.deepEqual(audit.map(row=>row.metadata.supplier_investigation).sort(),['closed','open']);
    });
  } finally {
    server?.closeAllConnections();
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await getPool()?.end();
    await observer.end();
  }
});
