import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import pg from 'pg';
import { initDatabase, getPool } from '../../db/connection.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { AuthStore } from '../../db/authStore.js';
import { assertSafeTestDatabase } from '../../utils/environment.js';
import { hashSessionToken } from '../../utils/crypto.js';
import { ShieldStore } from '../../db/shieldStore.js';
import { ShieldService, type ShieldGateway } from '../../services/shieldService.js';
import { createShieldRouter, shieldAdminRouter } from '../../routes/shieldApi.js';
import { shieldFixture, shieldTestPolicy } from './shieldFixtures.js';

const url = process.env.MYSTERY_SHIELD_POSTGRES_URL;

test('Shield PostgreSQL reservation, permissions and financial isolation', { skip: !url }, async t => {
  assert.equal(process.env.DATABASE_URL, undefined);
  assertSafeTestDatabase({ NODE_ENV: 'test', DATABASE_URL: url, MYSTERY_TEST_DATABASE_OPT_IN: 'true' });
  const observer = new pg.Pool({ connectionString: url, ssl: false });
  let server: ReturnType<express.Express['listen']> | undefined;
  try {
    assert.equal((await observer.query("SELECT to_regclass('public.orders') AS name")).rows[0].name, null);
    Object.assign(process.env, { DATABASE_URL: url, DATABASE_SSL: 'false', MYSTERY_TEST_DATABASE_OPT_IN: 'true' });
    await initDatabase();
    assert.equal(await ShieldStore.ready(), false, 'Application startup must not install Shield schema');
    const schema = readFileSync('server/db/mysteryShield.sql', 'utf8');
    await observer.query(schema);
    await observer.query(schema);
    const now = Date.now(), policy = shieldTestPolicy(now);
    for (const [id, role] of [['shield-customer', 'customer'], ['other', 'customer'], ['staff', 'admin']] as const) {
      await AuthStore.createUser({ id, name: id, email: null, phone: null, passwordHash: 'fixture', role });
      await observer.query('INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$1,$2,now()+interval \'1 hour\')',
        [id, hashSessionToken('token-' + id)]);
    }
    const orders = await Promise.all(Array.from({ length: 7 }, (_, i) => OrdersStore.createOrder(shieldFixture(now, {
      id: 'shield-order-' + i, public_reference: 'MH-SHIELD-' + i,
      payment_reference: 'PAY-SHIELD-' + i, supplier_order_id: 'original-' + i,
      recipient_phone: '+23324000000' + i,
    }))));
    const snapshot = async () => {
      const results = [];
      for (const name of ['orders', 'finance_accounts', 'finance_operations', 'finance_ledger', 'reward_ledger']) {
        results.push((await observer.query('SELECT * FROM public.' + name + ' ORDER BY 1')).rows);
      }
      return results;
    };
    const before = await snapshot();
    let submits = 0;
    let result: 'accepted' | 'rejected' | 'timeout' | 'unknown' = 'accepted';
    const gateway: ShieldGateway = {
      async readOriginal(id) { return { success: true, data: { publicId: id, status: 'pending', network: 'mtn', sizeLabel: '1GB', beneficiaryMsisdn: orders.find(order => order.supplier_order_id === id)?.recipient_phone } }; },
      async quote() { return { packageId: 'synthetic-400', network: 'mtn', sizeMB: 400, costMinor: 300, expiresAt: Date.now() + 15_000 }; },
      async submit(input) {
        submits++;
        assert.equal(input.recipient, orders[Number(input.recipient.slice(-1))].recipient_phone);
        assert.equal(input.packageId, 'synthetic-400');
        assert.equal(input.maxChargeMinor, 300);
        assert.match(input.claimId, /^[a-f0-9-]{36}$/);
        if (result === 'timeout') throw new Error('Synthetic response loss');
        if (result === 'rejected' || result === 'unknown') return { state: result };
        return { state: 'accepted', supplierId: 'reward-' + input.claimId };
      },
      async lookup(supplierId) { return { supplierId, state: 'delivered', chargeMinor: 275 }; },
    };
    const service = new ShieldService(gateway, () => policy);
    const ref = (i: number) => orders[i].public_reference;
    const owner = 'shield-customer';

    await t.test('backend-only schema, permissions and default pause', async () => {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const row = (await observer.query(`SELECT has_schema_privilege($1, 'mysteryhub_shield', 'USAGE') AS schema,
          has_table_privilege($1, 'mysteryhub_shield.claims', 'SELECT,INSERT,UPDATE,DELETE') AS claims`, [role])).rows[0];
        assert.deepEqual(row, { schema: false, claims: false });
      }
      assert.equal((await observer.query("SELECT count(*)::int AS n FROM pg_class WHERE relnamespace='mysteryhub_shield'::regnamespace AND relrowsecurity")).rows[0].n, 2);
      assert.equal((await service.check(ref(0), owner, true))?.state, 'unavailable');
      assert.equal(submits, 0);
      await observer.query('UPDATE mysteryhub_shield.control SET paused = false');
    });

    await t.test('ownership and fail-closed production composition', async () => {
      assert.equal(await service.check(ref(0), 'other', true), null);
      assert.equal(await service.check(orders[0].payment_reference, owner, true), null);
      assert.equal((await new ShieldService(undefined, () => policy).check(ref(0), owner, true))?.state, 'unavailable');
      assert.equal((await new ShieldService(gateway, () => ({ ...policy, fulfillment: false })).check(ref(0), owner, true))?.state, 'unavailable');
      assert.equal(submits, 0);
    });

    await t.test('auth boundary, guest denial, override rejection and Admin permissions', async () => {
      const app = express();
      app.use(express.json());
      app.use('/shield', createShieldRouter(service, () => true));
      app.use('/admin/shield', shieldAdminRouter);
      server = app.listen(0, '127.0.0.1');
      await new Promise<void>(resolve => server!.once('listening', resolve));
      const base = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
      const headers = (id: string) => ({ Authorization: 'Bearer token-' + id });
      assert.equal((await fetch(base + '/shield/' + ref(0))).status, 401);
      assert.equal((await fetch(base + '/shield/' + ref(0), { headers: headers('other') })).status, 404);
      const ownerRead = await fetch(base + '/shield/' + ref(0), { headers: headers(owner) });
      assert.deepEqual(await ownerRead.json(), { state: 'eligible' });
      assert.match(ownerRead.headers.get('cache-control')!, /no-store/);
      assert.equal((await fetch(base + '/shield/' + ref(0) + '/claim', {
        method: 'POST', body: JSON.stringify({ recipient: 'override' }),
        headers: { ...headers(owner), 'Content-Type': 'application/json' },
      })).status, 400);
      assert.equal((await fetch(base + '/admin/shield', { headers: headers(owner) })).status, 403);
      assert.equal((await fetch(base + '/admin/shield', { headers: headers('staff') })).status, 200);
    });

    await t.test('concurrent same order and new process replay submit once', async () => {
      const otherProcess = new ShieldService(gateway, () => policy);
      const outcomes = await Promise.all([service.check(ref(0), owner, true), otherProcess.check(ref(0), owner, true)]);
      assert.ok(outcomes.some(view => view?.state === 'submitted'));
      assert.equal(submits, 1);
      assert.equal((await otherProcess.check(ref(0), owner, true))?.state, 'submitted');
      assert.equal((await service.check(ref(0), owner))?.state, 'submitted');
      const claim = await ShieldStore.existing(orders[0].id);
      assert.ok(claim);
      await service.reconcile(claim);
      assert.equal((await service.check(ref(0), owner))?.state, 'delivered');
      assert.equal(submits, 1);
    });

    await t.test('timeout keeps liability and never replays; competing orders share one budget', async () => {
      result = 'timeout';
      const timedOut = await service.check(ref(1), owner, true);
      assert.equal(timedOut?.state, 'uncertain');
      const held = await ShieldStore.existing(orders[1].id);
      assert.ok(held);
      await service.reconcile(held);
      assert.equal((await new ShieldService(gateway, () => policy).check(ref(1), owner, true))?.state, 'uncertain');
      assert.equal(submits, 2);
      result = 'rejected';
      const outcomes = await Promise.all([service.check(ref(2), owner, true), service.check(ref(3), owner, true)]);
      assert.deepEqual(outcomes.map(view => view?.state).sort(), ['budget_exhausted', 'failed']);
      assert.equal(submits, 3);
      const report = await ShieldStore.admin(policy);
      assert.equal(report.reservedMinor, 900);
      assert.equal(report.confirmedSpendMinor, 275);
      assert.equal(report.counts.uncertain, 1);
      assert.equal(report.counts.delivered, 1);
    });

    await t.test('fresh original delivery wins during claim; ambiguous reply latches; pause persists', async () => {
      const expanded = { ...policy, totalMinor: 1800, dailyMinor: 1800 };
      const changed = new ShieldService({ ...gateway, async quote(recipient) {
        await observer.query("UPDATE public.orders SET status='delivered', delivered_at=clock_timestamp() WHERE id=$1", [orders[4].id]);
        return gateway.quote(recipient);
      } }, () => expanded);
      assert.equal((await changed.check(ref(4), owner, true))?.state, 'completed');
      assert.equal(submits, 3);
      await observer.query("UPDATE public.orders SET status='processing', delivered_at=NULL WHERE id=$1", [orders[4].id]);
      result = 'unknown';
      const expandable = new ShieldService(gateway, () => expanded);
      assert.equal((await expandable.check(ref(5), owner, true))?.state, 'uncertain');
      assert.equal((await expandable.check(ref(5), owner, true))?.state, 'uncertain');
      await ShieldStore.pause('staff');
      assert.equal((await expandable.check(ref(6), owner, true))?.state, 'unavailable');
      assert.equal(submits, 4);
      await observer.query(schema);
      assert.equal((await ShieldStore.admin(expanded)).paused, true);
      assert.deepEqual(await snapshot(), before);
    });
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    await getPool()?.end();
    await observer.end();
  }
});
