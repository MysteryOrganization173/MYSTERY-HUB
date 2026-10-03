import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import pg from 'pg';
import { ReferralStore } from '../../db/referralStore.js';

const environment = { ...process.env };
const originalConnect = pg.Pool.prototype.connect;
let queries: string[]; let failInsert: boolean; let stored: any[]; let released: number;
beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://fixture.invalid/never-contacted'; process.env.NODE_ENV = 'test';
  queries = []; failInsert = false; stored = []; released = 0;
  pg.Pool.prototype.connect = (async () => ({ release: () => { released++; },
    query: async (sql: string, params: any[] = []) => {
      queries.push(sql);
      if (sql.includes('SELECT * FROM referral_clicks')) return { rows: stored };
      if (sql.includes('INSERT INTO referral_clicks')) {
        if (failInsert) throw new Error('injected click failure');
        const record = { id: params[0], referral_profile_id: params[1], referrer_user_id: params[2], referral_code: params[3],
          visitor_key: params[4], created_at: params[7], capture_key: params[8] };
        stored.push(record); return { rows: [record] };
      }
      if (sql.includes('SELECT * FROM reward_ledger')) return { rows: stored };
      if (sql.includes('INSERT INTO reward_ledger')) {
        stored.push({ id: params[0], order_id: params[4], amount_minor: params[8] }); return { rows: stored };
      }
      if (sql.includes('SELECT * FROM referral_attributions')) return { rows: [] };
      if (sql.includes('INSERT INTO referral_attributions')) return { rows: [{ id: params[0], referrer_user_id: params[1], referred_user_id: params[2] }] };
      return { rows: [], rowCount: 0 };
    },
  })) as any;
});
afterEach(() => { pg.Pool.prototype.connect = originalConnect; process.env = { ...environment }; });
test('click insert failure rolls back; retry commits and replay returns persisted click without insert', async () => {
  const params = { profileId: 'profile', referrerUserId: 'owner', referralCode: 'MH-OWNER', visitorKey: 'vk_one', captureId: 'retry_key' };
  failInsert = true; await assert.rejects(ReferralStore.recordClick(params), /injected click failure/);
  assert.equal(stored.length, 0); assert.ok(queries.includes('ROLLBACK'));
  failInsert = false; const saved = await ReferralStore.recordClick(params); const replay = await ReferralStore.recordClick(params);
  assert.equal(saved.id, replay.id); assert.equal(stored.length, 1);
  assert.equal(queries.filter(sql => sql.includes('INSERT INTO referral_clicks')).length, 2);
  assert.ok(queries.some(sql => sql.includes('pg_advisory_xact_lock')));
  assert.ok(queries.some(sql => sql.includes('capture_key = $2') && sql.includes("INTERVAL '60 seconds'")));
  assert.equal(released, 3);
});
test('live reward creation locks before checking both historical and normal keys', async () => {
  const entry = { referrer_user_id: 'owner', referred_user_id: 'customer', referral_attribution_id: null,
    order_id: 'order', marketplace_product_id: null, service_type: 'data' as const, reward_rule_id: null,
    amount_minor: 20, currency: 'GHS' as const, status: 'approved' as const, reason: 'fixture',
    idempotency_key: 'historical_reward:order', reversal_of_id: null, approved_at: null, rejected_at: null, reversed_at: null, metadata_json: null };
  await ReferralStore.createLedgerEntry(entry);
  const repeat = await ReferralStore.createLedgerEntry({ ...entry, idempotency_key: 'new_rule_key', amount_minor: 90 });
  assert.equal(repeat.alreadyExisted, true); assert.equal(stored.length, 1);
  const lock = queries.findIndex(sql => sql.includes('LOCK TABLE reward_ledger'));
  const check = queries.findIndex(sql => sql.includes('SELECT * FROM reward_ledger'));
  assert.ok(lock > 0 && lock < check);
  assert.ok(queries[check].includes('network_level = $4') && queries[check].includes('reversal_of_id IS NULL'));
});
test('canonical binding serializes the graph and visitor before cycle/first-touch reads', async () => {
  const result = await ReferralStore.bindAttributionToUser({ referredUserId: 'customer', referrerUserId: 'owner', sourceCode: 'MH-OWNER', visitorKey: 'vk_one' });
  assert.equal(result.attribution?.referrer_user_id, 'owner');
  const graph = queries.findIndex(sql => sql.includes('referral-attribution-graph'));
  const read = queries.findIndex(sql => sql.includes('SELECT * FROM referral_attributions'));
  assert.ok(graph > 0 && graph < read); assert.ok(queries.includes('COMMIT')); assert.equal(released, 1);
});
