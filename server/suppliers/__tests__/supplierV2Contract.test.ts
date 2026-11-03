import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import { SuccessBizHubClient } from '../successBizHub/client.js';
import { SuccessBizHubProvider } from '../successBizHub/provider.js';

// Shape and orders example transcribed from the attached October 31 snapshot,
// Service discovery / response.json. Other capability IDs come from Authentication.
export const discovery = (id = 'orders', changes: Record<string, unknown> = {}) => ({
  success: true,
  data: {
    accountId: 'synthetic-account',
    keyPermissions: { orders: true, airtime: true, vouchers: true, afa: true, instant_bundles: true },
    services: [{ id, label: 'Data bundles', keyGranted: true, available: true, productCount: 3,
      place: 'POST /v2/orders', catalog: 'GET /v2/catalog', ...changes }],
  },
});
const environment = { ...process.env };
const realFetch = globalThis.fetch;
let client: SuccessBizHubClient;
let calls: number;
const reply = (body: unknown, status = 200) => {
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify(body), { status }); };
};
beforeEach(() => {
  process.env.SUCCESS_BIZ_HUB_API_KEY = 'synthetic-contract-key';
  process.env.SUCCESS_BIZ_HUB_BASE_URL = 'https://supplier.invalid/v2';
  client = new SuccessBizHubClient(); client.clearCache(); calls = 0;
  globalThis.fetch = async () => { throw new Error('Unexpected external request'); };
});
afterEach(() => {
  client.clearCache(); globalThis.fetch = realFetch;
  for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
  Object.assign(process.env, environment);
});

for (const id of ['orders', 'airtime', 'instant_bundles'] as const) {
  const check = async () => {
    const provider = new SuccessBizHubProvider(client);
    return id === 'orders' ? provider.checkServicesAvailable()
      : id === 'airtime' ? provider.checkAirtimeAvailable() : client.checkInstantBundlesService();
  };
  test(`${id}: documented authorized and available service is accepted`, async () => {
    reply(discovery(id)); assert.equal((await check()).available, true);
  });
  for (const [label, fields] of [
    ['unavailable', { available: false }], ['key denied', { keyGranted: false }],
    ['missing available', { available: undefined }], ['malformed boolean', { available: 'true' }],
    ['zero products (candidate fail-closed policy; release requires supplier clarification)', { productCount: 0 }],
    ['malformed count', { productCount: '3' }],
  ] as const) {
    test(`${id}: ${label} cannot authorize checkout`, async () => {
      reply(discovery(id, fields)); assert.equal((await check()).available, false);
    });
  }
  test(`${id}: denied keyPermissions cannot be overridden by keyGranted`, async () => {
    const body = discovery(id); body.data.keyPermissions[id] = false;
    reply(body); assert.equal((await check()).available, false);
  });
  test(`${id}: missing service cannot inherit another capability's availability`, async () => {
    reply(discovery(id === 'orders' ? 'instant_bundles' : 'orders'));
    assert.equal((await check()).available, false);
  });
}

for (const [name, data] of Object.entries({ empty: { services: [] }, missing: {},
  malformed: { services: 'available' }, missingPermissions: { services: discovery().data.services } })) {
  test(`orders: ${name} discovery fails closed`, async () => {
    reply({ success: true, data });
    assert.equal((await new SuccessBizHubProvider(client).checkServicesAvailable()).available, false);
  });
}
test('explicit denied discovery expires/refreshes and valid recovery is accepted', async () => {
  reply(discovery('orders', { available: false }));
  assert.equal((await new SuccessBizHubProvider(client).checkServicesAvailable()).available, false);
  reply(discovery()); await client.getServices(true);
  assert.equal((await new SuccessBizHubProvider(client).checkServicesAvailable()).available, true);
});

test('canonical success envelope is returned and valid responses remain cached', async () => {
  const body = discovery(); reply(body);
  assert.deepEqual(await client.getServices(), body); await client.getServices(); assert.equal(calls, 1);
});
const safeFailure = (code: string) => ({ success: false, error: { code,
  message: 'Echoed x-api-key=synthetic-contract-key, 0241234567, GHA-123456789-0, Jane Customer' } });
for (const [status, code] of [[200, 'FORBIDDEN'], [401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'],
  [429, 'RATE_LIMITED'], [503, 'SERVICE_UNAVAILABLE']] as const) {
  test(`HTTP ${status}: failed envelope preserves code/status without retaining sensitive text`, async () => {
    reply(safeFailure(code), status);
    await assert.rejects(client.getServices(), (error: any) => {
      assert.equal(error.code, code); assert.equal(error.statusCode, status);
      assert.doesNotMatch(`${error.message} ${JSON.stringify(error)}`, /synthetic-contract-key|0241234567|GHA-|Jane Customer/);
      return true;
    });
  });
}
for (const [name, body] of Object.entries({ missingSuccess: { data: {} },
  stringSuccess: { success: 'true', data: {} }, missingData: { success: true },
  nullData: { success: true, data: null }, primitiveData: { success: true, data: 'available' },
  nullEnvelope: null, arrayEnvelope: [] })) {
  test(`${name}: unexpected envelope is rejected`, async () => {
    reply(body); await assert.rejects(client.getServices());
  });
}
test('malformed JSON is rejected without exposing the body', async () => {
  globalThis.fetch = async () => new Response('<html>synthetic-contract-key 0241234567</html>');
  await assert.rejects(client.getServices(), error => !String(error).includes('0241234567'));
});
test('failed 200 response is not cached; recovery works without cache clearing', async () => {
  reply(safeFailure('SERVICE_UNAVAILABLE')); await assert.rejects(client.getServices());
  reply(discovery()); assert.equal((await client.getServices() as any).success, true);
  assert.equal(calls, 2);
});
test('order lifecycle status is preserved inside a valid envelope', async () => {
  for (const status of ['pending', 'processing', 'processed', 'failed', 'cancelled', 'refunded']) {
    reply({ success: true, data: { publicId: 'ORD_SYNTHETIC', status } });
    assert.equal((await client.getOrder('ORD_SYNTHETIC')).data.status, status);
  }
});
