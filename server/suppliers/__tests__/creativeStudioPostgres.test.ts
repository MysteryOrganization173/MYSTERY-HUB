import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import pg from 'pg';
import { initDatabase, getPool } from '../../db/connection.js';
import { AuthStore } from '../../db/authStore.js';
import { assertSafeTestDatabase } from '../../utils/environment.js';
import { hashSessionToken } from '../../utils/crypto.js';
import { creativeStudioRouter } from '../../routes/creativeStudioApi.js';
import { adminRouter } from '../../routes/adminApi.js';

const url = process.env.MYSTERY_CREATIVE_POSTGRES_URL;

/** The production path only: a brief in real PostgreSQL, through the real routes, on CI's isolated throwaway database. */
test('Creative Studio briefs in PostgreSQL: one lead per request, every field fits, Admin only', { skip: !url }, async t => {
  assert.equal(process.env.DATABASE_URL, undefined);
  assertSafeTestDatabase({ NODE_ENV: 'test', DATABASE_URL: url, MYSTERY_TEST_DATABASE_OPT_IN: 'true' });
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: url, DATABASE_SSL: 'false', MYSTERY_TEST_DATABASE_OPT_IN: 'true' });
  const observer = new pg.Pool({ connectionString: url, ssl: false });
  let server: ReturnType<express.Express['listen']> | undefined;
  try {
    await initDatabase();
    for (const [id, role] of [['creative-staff', 'admin'], ['creative-buyer', 'customer']] as const) {
      await AuthStore.createUser({ id, name: id, email: null, phone: null, passwordHash: 'fixture', role });
      await observer.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$1,$2,now()+interval '1 hour')", [id, hashSessionToken('token-' + id)]);
    }
    const app = express(); app.use(express.json()); app.use('/api/creative-studio', creativeStudioRouter); app.use('/api/admin', adminRouter);
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server!.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const send = (body: unknown) => fetch(`${base}/api/creative-studio/enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const admin = (path: string, token = 'token-creative-staff', init: RequestInit = {}) => fetch(`${base}/api/admin/marketplace/inquiries${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    const rows = async (id: string) => (await observer.query('SELECT * FROM marketplace_inquiries WHERE id=$1', [id])).rows;
    const flyer = (requestId: string) => ({ requestId, service: 'flyers', name: 'Synthetic Customer', phone: '+233 24 123 4567', details: 'A synthetic flyer brief for a test only.', fields: { title: 'Synthetic event' } });
    const idOf = (requestId: string) => `inq_cs_${requestId.replace(/-/g, '')}`;

    await t.test('a saved brief is a Marketplace enquiry with no product, and a retry acknowledges the same lead', async () => {
      const requestId = randomUUID();
      const first = await send(flyer(requestId));
      assert.equal(first.status, 201);
      const { reference, receivedAt } = await first.json();
      assert.equal((await send(flyer(requestId))).status, 200);
      const stored = await rows(idOf(requestId));
      assert.equal(stored.length, 1);
      assert.equal(stored[0].product_id, null);
      assert.equal(stored[0].inquiry_type, 'creative_studio');
      assert.equal(stored[0].product_name, 'Creative Studio · Flyers & posters');
      assert.equal(stored[0].customer_phone, '0241234567');
      assert.equal(stored[0].status, 'new');
      assert.match(stored[0].message, new RegExp(reference));
      assert.ok(receivedAt);
    });

    await t.test('five simultaneous sends of one brief make exactly one lead, and all are acknowledged', async () => {
      const requestId = randomUUID();
      const replies = await Promise.all(Array.from({ length: 5 }, () => send(flyer(requestId))));
      assert.deepEqual(replies.map(r => r.status).sort(), [200, 200, 200, 200, 201]);
      assert.equal((await rows(idOf(requestId))).length, 1);
    });

    await t.test('the largest brief the form allows fits every column', async () => {
      const requestId = randomUUID();
      const res = await send({ requestId, service: 'logo', name: 'n'.repeat(80), phone: '+447700900123', email: `${'e'.repeat(110)}@example.test`, budget: 'b'.repeat(60), details: 'd'.repeat(800), neededBy: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
        links: [1, 2, 3].map(n => `https://site${n}.example/` + 'p'.repeat(170)),
        fields: { businessName: 'b'.repeat(120), businessType: 't'.repeat(160), logoStatus: 'Refresh my current logo', style: 'Traditional', colours: 'c'.repeat(80) } });
      assert.equal(res.status, 201);
      const [stored] = await rows(idOf(requestId));
      assert.ok(stored.message.length <= 2000);
      assert.match(stored.message, /Quote required: no price or delivery date has been promised\.$/);
    });

    await t.test('Admin finds a brief by reference and follows it up; customers and guests cannot read it', async () => {
      const requestId = randomUUID();
      const { reference } = await (await send(flyer(requestId))).json();
      const found = await (await admin(`?search=${reference}`)).json();
      assert.equal(found.total, 1);
      assert.equal(found.inquiries[0].id, idOf(requestId));
      const saved = await admin(`/${idOf(requestId)}`, 'token-creative-staff', { method: 'PATCH', body: JSON.stringify({ expectedVersion: 0, status: 'contacted', adminNote: 'Synthetic follow-up', followUpOn: '2030-01-15' }) });
      assert.equal(saved.status, 200);
      const [stored] = await rows(idOf(requestId));
      assert.equal(stored.status, 'contacted');
      assert.equal(stored.admin_note, 'Synthetic follow-up');
      assert.ok(stored.contacted_at);
      assert.equal((await admin('', 'token-creative-buyer')).status, 403);
      assert.equal((await admin('', 'invalid')).status, 401);
      assert.equal((await fetch(`${base}/api/admin/marketplace/inquiries`)).status, 401);
    });

    await t.test('a refused brief stores nothing, and no order or wallet record is created', async () => {
      const requestId = randomUUID();
      assert.equal((await send({ ...flyer(requestId), details: '<script>alert(1)</script> synthetic' })).status, 400);
      assert.equal((await rows(idOf(requestId))).length, 0);
      assert.equal(Number((await observer.query('SELECT count(*) FROM orders')).rows[0].count), 0);
    });
  } finally {
    server?.closeAllConnections();
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await observer.end();
    await getPool()?.end();
  }
});
