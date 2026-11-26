import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';
import { assertSafeTestDatabase } from '../../utils/environment.js';
import { getPool, initDatabase } from '../../db/connection.js';
import { AuthStore } from '../../db/authStore.js';
import { AdminAuditStore } from '../../db/adminAuditStore.js';
import { FinanceStore } from '../../db/financeStore.js';
import { CommercialService } from '../../services/commercialService.js';
import { ServiceControlService as S } from '../../services/serviceControlService.js';
import { SHIPPED_CONTROLS_VERSION } from '../../../shared/serviceControls.js';

/**
 * Mystery Hub 3.6.3 Service Control Center on the native engine. Run with MYSTERY_SERVICE_CONTROL_POSTGRES_URL pointing
 * at an EMPTY disposable *_test database. Proves what the memory store cannot: the advisory lock and version check
 * under truly concurrent saves, and that a save and its audit row commit or roll back together.
 */
const url = process.env.MYSTERY_SERVICE_CONTROL_POSTGRES_URL;
const control = (scope: string, state: string, expectedVersion: string) => ({ scope, state, title: 'Synthetic service update', message: 'Synthetic purchases are paused.', existingOrders: '', expectedRestoration: null, expectedVersion, confirmed: true });

test('native PostgreSQL Service Control Center: shipped default, concurrent saves, atomic audit', { skip: !url }, async (t) => {
  assert.equal(process.env.DATABASE_URL, undefined); assertSafeTestDatabase({ NODE_ENV: 'test', DATABASE_URL: url, MYSTERY_TEST_DATABASE_OPT_IN: 'true' });
  const observer = new pg.Pool({ connectionString: url, ssl: false });
  const record = AdminAuditStore.record;
  try {
    assert.equal((await observer.query("SELECT to_regclass('public.orders') AS name")).rows[0].name, null, 'Requires an empty disposable database');
    Object.assign(process.env, { DATABASE_URL: url, DATABASE_SSL: 'false', MYSTERY_TEST_DATABASE_OPT_IN: 'true', NODE_ENV: 'test' }); await initDatabase();
    for (const id of ['svc-admin-a', 'svc-admin-b']) await AuthStore.createUser({ id, name: 'Synthetic admin', email: `${id}@example.test`, phone: null, passwordHash: 'SYNTHETIC', role: 'admin' });
    S.useShippedDefaultsForTests(true); // the production path: nothing saved means the Release A record
    const audits = async () => (await observer.query("SELECT count(*)::int AS n FROM admin_audit_log WHERE action LIKE 'service_%'")).rows[0].n;

    await t.test('an empty table reads as the shipped emergency record, and the catalogue honours it', async () => {
      assert.equal((await observer.query("SELECT count(*)::int AS n FROM finance_config WHERE id LIKE 'service-%'")).rows[0].n, 0);
      const view = await S.admin();
      assert.deepEqual([view.controls.source, view.controls.version], ['shipped-default', SHIPPED_CONTROLS_VERSION]);
      assert.equal((await CommercialService.catalog()).products.some((p) => p.network === 'mtn'), false);
    });

    await t.test('two administrators saving at once from the same reviewed version: exactly one commits', async () => {
      const version = (await S.admin()).controls.version;
      const results = await Promise.allSettled([
        S.saveControl('svc-admin-a', control('data:telecel', 'suspended', version)),
        S.saveControl('svc-admin-b', control('airtime:mtn', 'maintenance', version)),
      ]);
      const won = results.filter((r) => r.status === 'fulfilled'), lost = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      assert.deepEqual([won.length, lost.length], [1, 1]);
      assert.equal(lost[0].reason.status, 409);
      assert.equal(await audits(), 1, 'one change, one audit row');
      const stored = (await observer.query("SELECT value FROM finance_config WHERE id='service-controls'")).rows[0].value;
      const scopes = stored.controls.map((c: any) => c.scope).sort();
      assert.ok(scopes.includes('data:mtn'), 'the emergency pause carried into the first saved record');
      assert.equal(scopes.length, 2, 'only the winning change was added');
    });

    await t.test('a save whose audit row cannot be written changes nothing', async () => {
      const before = (await observer.query("SELECT value FROM finance_config WHERE id='service-controls'")).rows[0].value, count = await audits();
      AdminAuditStore.record = async () => { throw new Error('synthetic audit failure'); };
      await assert.rejects(S.saveControl('svc-admin-a', control('data:airteltigo', 'suspended', before.version)), /synthetic audit failure/);
      AdminAuditStore.record = record;
      assert.deepEqual((await observer.query("SELECT value FROM finance_config WHERE id='service-controls'")).rows[0].value, before);
      assert.equal(await audits(), count);
      assert.equal(await S.purchaseBlock('data', 'airteltigo'), null);
    });

    await t.test('announcements: concurrent edits from one reviewed version, one wins; the public status reads the saved list', async () => {
      const version = (await S.admin()).announcements.version;
      const draft = { name: 'Synthetic', title: 'Synthetic update', summary: 'A synthetic summary.', details: '', severity: 'info', scope: 'global', placement: 'bar', pages: ['home'], audience: 'everyone', dismissible: true, startsAt: null, endsAt: null, expectedRestoration: null, cta: null };
      const results = await Promise.allSettled(['svc-admin-a', 'svc-admin-b'].map((id) => S.saveAnnouncement(id, { action: 'create', announcement: draft, expectedVersion: version, confirmed: true })));
      assert.deepEqual(results.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
      const created = (results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>).value;
      await S.saveAnnouncement('svc-admin-a', { action: 'publish', id: created.id, expectedVersion: created.saved, confirmed: true });
      const status = await S.publicStatus();
      assert.ok(status.announcements.some((a) => a.id === created.id), 'published');
      assert.ok(status.announcements.some((a) => a.id === 'mtn-data-maintenance-2026-11'), 'the emergency announcement carried into the saved list');
      assert.ok(status.controls.some((c) => c.scope === 'data:mtn' && c.blocksPurchases));
    });
  } finally {
    AdminAuditStore.record = record; S.useShippedDefaultsForTests(false);
    await getPool()?.end(); await observer.end(); delete process.env.DATABASE_URL; delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;
    void FinanceStore;
  }
});
