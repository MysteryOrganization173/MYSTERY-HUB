import test, { before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { CommercialReadinessService as readiness } from '../../services/commercialReadinessService.js';
import { CommercialService } from '../../services/commercialService.js';
import { ResultsCheckerStore } from '../../db/resultsCheckerStore.js';
import { AuthStore } from '../../db/authStore.js';
import { adminCommercialRouter } from '../../routes/commercialApi.js';
import { isCommercialReadiness } from '../../../shared/serviceReadiness.js';
import { SuccessBizHubClient } from '../successBizHub/client.js';

const ids = ['orders', 'airtime', 'instant_bundles', 'afa', 'vouchers'];
const discovery = () => ({ success: true, data: { accountId: 'PRIVATE_ACCOUNT', keyPermissions: Object.fromEntries(ids.map(id => [id, true])), services: ids.map(id => ({ id, keyGranted: true, available: true, productCount: id === 'airtime' ? 0 : 1 })) } });
const fixtures: Record<string, unknown> = {
  '/catalog': { success: true, data: { offers: [{ id: 'data-offer', kind: 'data', name: 'MTN Data', packages: [{ sizeLabel: '2GB', priceMinor: '1800' }] }, { id: 'airtime-offer', kind: 'airtime', name: 'MTN Airtime' }] } },
  '/instant-bundles': { success: true, data: { available: true, packages: [{ id: 12, name: 'Fixed MTN', network: 'MTN', priceMinor: '1800', enabled: true, available: true }, { id: 13, name: 'Unavailable', available: false }] } },
  '/vouchers': { success: true, data: [{ id: 'bece-type', name: 'BECE Results Checker', priceMinor: '1800', available: 8 }] },
};
const envKeys = ['SUCCESS_BIZ_HUB_API_KEY', 'SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED', 'SUCCESS_BIZ_HUB_BASE_URL', 'RESULTS_CHECKER_TYPE_ID_BECE', 'RESULTS_CHECKER_ENABLED'];
const savedEnv = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
let calls: string[], server: Server, base: string;
before(async () => {
  assert.equal(process.env.DATABASE_URL, undefined);
  const app = express(); app.use('/api/admin/commercial', adminCommercialRouter);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { await new Promise<void>(r => server.close(() => r())); });
beforeEach(async () => {
  mock.restoreAll(); readiness.resetForTests(); calls = [];
  Object.assign(process.env, { SUCCESS_BIZ_HUB_API_KEY: 'sbh_synthetic_only', SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED: 'true', RESULTS_CHECKER_TYPE_ID_BECE: 'bece-type', RESULTS_CHECKER_ENABLED: 'false' });
  delete process.env.SUCCESS_BIZ_HUB_BASE_URL;
  mock.method(CommercialService, 'catalog', async () => ({ version: 'fixture', products: [{ id: 'mtn-2gb' }] } as any));
  mock.method(ResultsCheckerStore, 'ready', async () => true);
  mock.method(readiness.client, 'getReadinessResource', async (path: string) => { calls.push(path); return path === '/services' ? discovery() : fixtures[path]; });
});
afterEach(() => { mock.restoreAll(); for (const k of envKeys) if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; });

test('fresh canonical evidence reports independent services and preserves dynamic Airtime zero count', async () => {
  const result = await readiness.snapshot();
  assert.equal(isCommercialReadiness(result), true);
  assert.equal(result.readOnly, true); assert.ok(result.accountFingerprint);
  assert.equal(result.services[0].state, 'checks_passed');
  assert.equal(result.services[1].state, 'checks_passed'); assert.equal(result.services[1].reportedProducts, 0);
  assert.match(result.services[1].pricing, /fee: 0%/);
  assert.equal(result.services[2].catalogue.products[0].id, '12');
  assert.equal(result.services[2].catalogue.count, 1);
  assert.equal(result.services[4].state, 'disabled');
  assert.equal(result.services[4].checkers?.[0].grossSpreadMinor, 599);
  assert.equal(result.services[4].checkers?.[0].stock, 8);
  assert.deepEqual(calls.sort(), ['/catalog', '/instant-bundles', '/services', '/vouchers']);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_ACCOUNT|sbh_synthetic|customer|pin_key/i);
});

test('concurrent refreshes are single flight, bounded and shared for one minute; key changes invalidate evidence', async () => {
  await Promise.all(Array.from({ length: 15 }, () => readiness.snapshot()));
  assert.equal(calls.length, 4);
  await readiness.snapshot(); assert.equal(calls.length, 4);
  const now = Date.now(); mock.method(Date, 'now', () => now + 61_000);
  await readiness.snapshot(); assert.equal(calls.length, 8);
  process.env.SUCCESS_BIZ_HUB_API_KEY = 'sbh_new_synthetic_only';
  await readiness.snapshot(); assert.equal(calls.length, 12);
});

test('discovery timeout cannot be concealed by unrelated wallet success and causes no catalogue calls', async () => {
  mock.method(readiness.client, 'getWallet', async () => ({ success: true, data: { balance: '1000' } } as any));
  mock.method(readiness.client, 'getReadinessResource', async () => { throw Object.assign(Error('secret 0240000000'), { isTimeout: true }); });
  const result = await readiness.snapshot();
  assert.ok(result.services.every(s => s.state !== 'checks_passed'));
  assert.match(result.services[0].blockers.join(' '), /timed out/);
  assert.equal(result.services[0].catalogue.count, null);
  assert.doesNotMatch(JSON.stringify(result), /secret|0240000000/);
});

test('denied, conflicting, missing and duplicate capability fields never become verified permission', async () => {
  for (const variant of ['denied', 'conflict', 'missing', 'duplicate']) {
    readiness.resetForTests(); calls = [];
    const raw = discovery();
    if (variant === 'denied') { raw.data.keyPermissions.orders = false; raw.data.services[0].keyGranted = false; }
    if (variant === 'conflict') raw.data.keyPermissions.orders = false;
    if (variant === 'missing') raw.data.services.shift();
    if (variant === 'duplicate') raw.data.services.push({ ...raw.data.services[0] });
    mock.method(readiness.client, 'getReadinessResource', async (path: string) => { calls.push(path); return path === '/services' ? raw : fixtures[path]; });
    const row = (await readiness.snapshot()).services[0];
    assert.notEqual(row.state, 'checks_passed', variant); assert.equal(row.catalogue.state, 'unverified');
  }
});

test('service unavailable, failed envelopes and malformed catalogue remain truthful without raw errors', async () => {
  for (const value of [{ success: false, data: discovery().data }, { success: true, data: { services: [] } }, null]) {
    readiness.resetForTests();
    mock.method(readiness.client, 'getReadinessResource', async () => value);
    assert.ok((await readiness.snapshot()).services.every(s => s.state !== 'checks_passed'));
  }
  readiness.resetForTests();
  const raw = discovery(); raw.data.services[0].available = false;
  mock.method(readiness.client, 'getReadinessResource', async (path: string) => path === '/services' ? raw : { success: true, data: { offers: 'wrong' } });
  const result = await readiness.snapshot(); assert.equal(result.services[0].state, 'unavailable'); assert.equal(result.services[1].catalogue.count, null);
});

test('authorization, quota and persistence errors degrade read-only evidence instead of inventing zeros', async () => {
  for (const statusCode of [401, 403, 429, 503]) {
    readiness.resetForTests();
    mock.method(readiness.client, 'getReadinessResource', async () => { throw Object.assign(Error('RAW_PRIVATE_RESPONSE'), { statusCode }); });
    const result = await readiness.snapshot(); assert.equal(result.services[0].catalogue.count, null); assert.doesNotMatch(JSON.stringify(result), /RAW_PRIVATE/);
  }
  readiness.resetForTests();
  mock.method(CommercialService, 'catalog', async () => { throw Error('db unavailable'); });
  mock.method(ResultsCheckerStore, 'ready', async () => { throw Error('db unavailable'); });
  const result = await readiness.snapshot(); assert.notEqual(result.services[4].state, 'checks_passed');
});

test('Admin endpoint denies guests/customers, exposes no-store data only to active Admin, rejects POST', async () => {
  AuthStore._clearDevStore();
  for (const role of ['customer', 'admin'] as const) { await AuthStore.createUser({ id: role, name: role, email: null, phone: null, passwordHash: 'fixture', role }); await AuthStore.createSession(role, `token-${role}`); }
  const request = (token?: string, method = 'GET') => fetch(`${base}/api/admin/commercial/readiness`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  assert.equal((await request()).status, 401); assert.equal((await request('token-customer')).status, 403); assert.equal(calls.length, 0);
  const response = await request('token-admin'); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control')!, /no-store/);
  assert.equal((await request('token-admin', 'POST')).status, 404);
  await AuthStore.updateUserStatus('admin', 'disabled');
  assert.equal((await request('token-admin')).status, 403);
});

test('diagnostic transport uses only fresh strict GETs, refuses redirects, invalid envelopes and arbitrary endpoints', async () => {
  mock.restoreAll();
  const client = new SuccessBizHubClient(), seen: RequestInit[] = [];
  let payload: unknown = { success: false, error: { code: 'FORBIDDEN', message: 'PRIVATE' } };
  mock.method(globalThis, 'fetch', async (_url: any, options: RequestInit) => { seen.push(options); return new Response(JSON.stringify(payload)); });
  await assert.rejects(client.getReadinessResource('/services'), (e: any) => e.code === 'FORBIDDEN' && !e.message.includes('PRIVATE'));
  payload = discovery(); await client.getReadinessResource('/services'); await client.getReadinessResource('/services');
  assert.equal(seen.length, 3); assert.ok(seen.every(s => s.method === 'GET' && s.redirect === 'error' && s.body === undefined));
  await assert.rejects(client.getReadinessResource('/orders' as any)); assert.equal(seen.length, 3);
  process.env.SUCCESS_BIZ_HUB_BASE_URL = 'https://unexpected.invalid/v2';
  await assert.rejects(client.getReadinessResource('/services')); assert.equal(seen.length, 3);
});

test('diagnostic deadline covers a body that ignores abort without changing checkout deadlines', async () => {
  mock.restoreAll(); mock.timers.enable({ apis: ['setTimeout'] });
  let finish!: () => void;
  mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, text: () => new Promise<string>(resolve => { finish = () => resolve(JSON.stringify(discovery())); }) }));
  const pending = new SuccessBizHubClient().getReadinessResource('/services');
  await Promise.resolve(); await Promise.resolve(); mock.timers.tick(8000); finish();
  await assert.rejects(pending, (e: any) => e.isTimeout === true);
});


test('disabled and malformed products never yield positive supplier catalogue readiness', async () => {
  for (const products of [[{ id: 12 }], [{ id: 12, name: 'Disabled fixed', network: 'MTN', priceMinor: '1800', available: false }]]) {
    readiness.resetForTests();
    mock.method(readiness.client, 'getReadinessResource', async (path: string) => path === '/services' ? discovery() : path === '/instant-bundles' ? { success: true, data: { available: true, packages: products } } : fixtures[path]);
    assert.notEqual((await readiness.snapshot()).services[2].state, 'checks_passed');
  }
  readiness.resetForTests();
  mock.method(readiness.client, 'getReadinessResource', async (path: string) => path === '/services' ? discovery() : path === '/catalog' ? { success: true, data: { offers: [{ id: 'disabled', name: 'Disabled', kind: 'data', enabled: false, packages: [{ sizeLabel: '1GB', priceMinor: '100' }] }, { id: 'disabled-airtime', name: 'Disabled airtime', kind: 'airtime', available: false }, { id: 'package-off', name: 'Data', kind: 'data', packages: [{ sizeLabel: '2GB', priceMinor: '100', enabled: false }] }] } } : fixtures[path]);
  const result = await readiness.snapshot();
  assert.notEqual(result.services[0].state, 'checks_passed'); assert.notEqual(result.services[1].state, 'checks_passed');
});

test('documented dynamic Flexi remains distinguishable from a malformed fixed product', async () => {
  mock.method(readiness.client, 'getReadinessResource', async (path: string) => path === '/services' ? discovery() : path === '/instant-bundles' ? { success: true, data: { available: true, flexiPayRatio: '1', packages: [{ id: 12, name: 'MTN Flexi', network: 'MTN', isFlexi: true, mode: 'flexi', minAmountMajor: '1', maxAmountMajor: '500' }] } } : fixtures[path]);
  const result = await readiness.snapshot(); assert.equal(result.services[2].state, 'checks_passed'); assert.equal(result.services[2].catalogue.products[0].costMinor, null);
});

test('malformed nested successful snapshots are rejected before Admin rendering', async () => {
  const result = await readiness.snapshot(); assert.ok(isCommercialReadiness(result));
  for (const mutate of [(r: any) => r.services[0].catalogue.products = [null], (r: any) => r.services[0].checkers = {}, (r: any) => r.services[0].state = '__proto__', (r: any) => r.services[1].id = 'orders']) {
    const broken = structuredClone(result); mutate(broken); assert.equal(isCommercialReadiness(broken), false);
  }
});
