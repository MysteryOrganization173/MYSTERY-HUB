import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { initDatabase, getPool } from '../../db/connection.js';
import { assertSafeTestDatabase } from '../../utils/environment.js';
import { AuthStore } from '../../db/authStore.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { ResultsCheckerStore } from '../../db/resultsCheckerStore.js';
import { FulfilmentService } from '../../services/fulfilmentService.js';
import { ResultsCheckerService } from '../../services/resultsCheckerService.js';
import type { OrderRecord } from '../../types/orders.js';

const url = process.env.MYSTERY_CHECKERS_POSTGRES_URL;

/** Real PostgreSQL on CI's throwaway database, with a synthetic supplier. No real voucher is bought. */
test('Results checkers in PostgreSQL: storage stays optional, one purchase per order, encrypted PINs, no public access', { skip: !url }, async t => {
  assert.equal(process.env.DATABASE_URL, undefined);
  assertSafeTestDatabase({ NODE_ENV: 'test', DATABASE_URL: url, MYSTERY_TEST_DATABASE_OPT_IN: 'true' });
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: url, DATABASE_SSL: 'false', MYSTERY_TEST_DATABASE_OPT_IN: 'true', RESULTS_CHECKER_ENABLED: 'true', RESULTS_CHECKER_PIN_KEY: 'b'.repeat(64), RESULTS_CHECKER_TYPE_ID_BECE: 'type-bece', SUCCESS_BIZ_HUB_API_KEY: 'sbh_test_synthetic', SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED: 'true' });
  const observer = new pg.Pool({ connectionString: url, ssl: false });
  try {
    await initDatabase();
    await t.test('application startup does not install the table, and the service stays closed without it', async () => {
      assert.equal((await observer.query("SELECT to_regclass('public.results_checker_purchases') AS name")).rows[0].name, null);
      assert.equal(await ResultsCheckerStore.ready(), false);
      assert.equal(await ResultsCheckerService.prerequisitesMet(), false);
    });
    const schema = readFileSync('server/db/resultsCheckers.sql', 'utf8');
    await observer.query(schema);
    await observer.query(schema); // Explicit activation schema is safe to rerun on the isolated database.
    assert.equal(await ResultsCheckerStore.ready(), true);
    await AuthStore.createUser({ id: 'rc-buyer', name: 'rc-buyer', email: null, phone: null, passwordHash: 'fixture', role: 'customer' });
    mock.method(ResultsCheckerService, 'supplierSpendAllowed', () => true);
    mock.method(ResultsCheckerService.client, 'getVouchers', async () => ({ success: true, data: [{ id: 'type-bece', name: 'BECE Results Checker', slug: 'bece', priceMinor: '1800', available: 20 }] }));
    const makeOrder = async () => {
      const now = new Date().toISOString();
      const order = { id: `ord_${randomUUID()}`, user_id: 'rc-buyer', public_reference: `MH-RC-${randomUUID()}`, customer_name: 'b', customer_email: 'b@example.test', customer_phone: '0241234567', recipient_phone: '0241234567', network: 'education', service_type: 'results_checker', product_id: 'results-checker-bece', product_name_snapshot: 'BECE Results Checker', bundle_size_snapshot: 'BECE Results Checker', amount: 2399, currency: 'GHS', status: 'pending_payment', payment_provider: 'paystack', payment_reference: `MH_rc_${randomUUID()}`, payment_status: 'pending', supplier_provider: 'success_biz_hub', supplier_order_id: null, supplier_response: null, supplier_cost_minor: null, supplier_offer_ref: null, supplier_last_checked_at: null, failure_reason: null, created_at: now, updated_at: now, paid_at: null, submitted_at: null, delivered_at: null } as unknown as OrderRecord;
      await ResultsCheckerStore.create(order, { product_key: 'bece', qty: 1, unit_price_minor: 2399, supplier_type_id: 'type-bece', quoted_cost_minor: 1800 });
      return order;
    };
    await t.test('concurrent verified payments buy exactly once and deliver with encrypted PINs', async () => {
      const buy = mock.method(ResultsCheckerService.client, 'purchaseVoucher', async () => { await new Promise(r => setTimeout(r, 40)); return { success: true, data: { id: `VCH_${randomUUID().slice(0, 8)}`, priceMinor: '1800', pins: [{ serial: 'PGSERIAL1', pin: 'PGSECRET1234' }] } }; });
      const order = await makeOrder();
      await Promise.all(Array.from({ length: 6 }, () => FulfilmentService.processPaidOrder(order.payment_reference, new Date().toISOString())));
      assert.equal(buy.mock.callCount(), 1);
      const row = (await observer.query('SELECT o.status,o.supplier_response,o.supplier_cost_minor,p.encrypted_pins,p.pin_count FROM orders o JOIN results_checker_purchases p ON p.order_id=o.id WHERE o.id=$1', [order.id])).rows[0];
      assert.equal(row.status, 'delivered'); assert.equal(row.pin_count, 1); assert.equal(row.supplier_cost_minor, 1800);
      assert.ok(!row.encrypted_pins.includes('PGSECRET'));
      assert.ok(!JSON.stringify(row.supplier_response || '').includes('PGSECRET'));
      assert.deepEqual(ResultsCheckerStore.pins((await ResultsCheckerStore.find(order.id))!), [{ serial: 'PGSERIAL1', pin: 'PGSECRET1234' }]);
      buy.mock.restore();
    });
    await t.test('the submission claim is won once across separate calls, and an uncertain purchase stays blocked', async () => {
      const order = await makeOrder();
      await OrdersStore.markOrderPaid(order.payment_reference, new Date().toISOString());
      await OrdersStore.claimOrderForSupplierDispatch(order.id);
      const wins = await Promise.all(Array.from({ length: 8 }, () => ResultsCheckerStore.claimSubmission(order.id)));
      assert.equal(wins.filter(Boolean).length, 1);
      const buy = mock.method(ResultsCheckerService.client, 'purchaseVoucher', async () => { throw new Error('must not run'); });
      await ResultsCheckerService.fulfil((await OrdersStore.findOrder(order.id))!);
      assert.equal(buy.mock.callCount(), 0);
      assert.equal((await OrdersStore.findOrder(order.id))!.failure_reason, 'supplier_submission_uncertain');
      buy.mock.restore();
    });
    await t.test('the order and its purchase row are created together or not at all', async () => {
      const order = await makeOrder();
      await assert.rejects(ResultsCheckerStore.create({ ...order, id: `ord_${randomUUID()}`, public_reference: `MH-RC-${randomUUID()}`, payment_reference: `MH_rc_${randomUUID()}` }, { product_key: 'nope' as 'bece', qty: 1, unit_price_minor: 2399, supplier_type_id: 'type-bece', quoted_cost_minor: 1800 }));
      assert.equal(Number((await observer.query("SELECT count(*) FROM orders WHERE service_type='results_checker' AND id NOT IN (SELECT order_id FROM results_checker_purchases)")).rows[0].count), 0);
    });
    await t.test('concurrent replies preserve every encrypted voucher and deny stale dispatch claims', async () => {
      const order = await makeOrder();
      await Promise.all(['PGPIN1111', 'PGPIN2222', 'PGPIN3333'].map(pin => ResultsCheckerStore.savePins(order.id, 'PG_MERGE', [{ pin }])));
      await ResultsCheckerStore.savePins(order.id, 'PG_MERGE', [{ pin: 'PGPIN1111' }]);
      const row = (await ResultsCheckerStore.find(order.id))!;
      assert.equal(row.pin_count, 3);
      assert.deepEqual(ResultsCheckerStore.pins(row).map(p => p.pin).sort(), ['PGPIN1111', 'PGPIN2222', 'PGPIN3333']);
      assert.equal(await ResultsCheckerStore.claimSubmission(order.id), false, 'unpaid order');
      await OrdersStore.markOrderPaid(order.payment_reference, new Date().toISOString());
      await OrdersStore.claimOrderForSupplierDispatch(order.id);
      await OrdersStore.updateOrderReview(order.id, true, 'Synthetic review');
      assert.equal(await ResultsCheckerStore.claimSubmission(order.id), false, 'current review beats stale queued snapshot');
      await assert.rejects(ResultsCheckerStore.savePins('missing-order', null, [{ pin: 'PGPIN4444' }]));
    });
    await t.test('public database roles cannot read purchases, and row security is on', async () => {
      const facts = (await observer.query("SELECT has_table_privilege('anon','public.results_checker_purchases','SELECT') AS anon, has_table_privilege('authenticated','public.results_checker_purchases','SELECT') AS authed, (SELECT relrowsecurity FROM pg_class WHERE oid='public.results_checker_purchases'::regclass) AS rls")).rows[0];
      assert.equal(facts.anon, false); assert.equal(facts.authed, false); assert.equal(facts.rls, true);
      for (const role of ['anon', 'authenticated']) for (const sql of [
        'SELECT * FROM results_checker_purchases',
        "INSERT INTO results_checker_purchases(order_id) VALUES('denied')",
        'UPDATE results_checker_purchases SET pin_count=0',
        'DELETE FROM results_checker_purchases',
      ]) {
        await observer.query('BEGIN');
        try {
          await observer.query(`SET LOCAL ROLE ${role}`);
          await assert.rejects(observer.query(sql), (err: any) => err.code === '42501');
        } finally { await observer.query('ROLLBACK'); }
      }

    });
  } finally { mock.restoreAll(); await observer.end(); await getPool()?.end(); }
});
