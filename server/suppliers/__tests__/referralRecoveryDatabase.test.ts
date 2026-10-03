import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { reconcileReferralHistory } from '../../services/referralRecoveryRunner.js';

const time = '2026-01-01T00:00:00Z';
let attributions: any[]; let ledger: any[]; let writes: string[]; let queries: string[]; let failLedger: boolean;
const orders = [{ id: 'order', user_id: 'customer', referrer_user_id: 'owner', referral_code: 'MH-OWNER',
  created_at: time, status: 'delivered', payment_status: 'success', service_type: 'data', currency: 'GHS', delivered_at: '2026-01-02T00:00:00Z' }];
const audit = { id: 'audit', entity_id: 'original_reward', action: 'reward_approved', entity_type: 'reward_ledger',
  created_at: '2026-01-03T00:00:00Z', metadata_safe_json: JSON.stringify({ order_id: 'order', referrer_user_id: 'owner', service_type: 'data', amount_minor: 17 }) };
beforeEach(() => { attributions = []; ledger = []; writes = []; queries = []; failLedger = false; });
function fakePool() {
  return { connect: async () => {
    let backup: { attributions: any[]; ledger: any[] };
    return { release: () => { queries.push('RELEASE'); }, query: async (sql: string, params: any[] = []) => {
      queries.push(sql);
      if (sql.startsWith('BEGIN')) backup = structuredClone({ attributions, ledger });
      if (sql === 'ROLLBACK') { attributions = backup.attributions; ledger = backup.ledger; }
      if (sql === 'SELECT id FROM users;') return { rows: [{ id: 'owner' }, { id: 'customer' }] };
      if (sql === 'SELECT * FROM referral_profiles;') return { rows: [{ id: 'profile', user_id: 'owner', referral_code: 'MH-OWNER' }] };
      if (sql === 'SELECT * FROM referral_attributions;') return { rows: attributions };
      if (sql.includes('FROM orders;')) return { rows: orders };
      if (sql === 'SELECT * FROM reward_ledger;') return { rows: ledger };
      if (sql.includes('FROM admin_audit_log')) return { rows: [audit] };
      if (sql.includes('COUNT(*) AS count FROM referral_clicks')) return { rows: [{ count: '9' }] };
      if (sql.includes('INSERT INTO')) writes.push(sql);
      if (sql.includes('INSERT INTO referral_attributions')) {
        assert.ok(sql.includes('ON CONFLICT (referred_user_id) DO NOTHING'));
        attributions.push({ id: params[0], referrer_user_id: params[1], referred_user_id: params[2], source_code: params[3], first_seen_at: params[4] });
        return { rowCount: 1, rows: [{ id: params[0] }] };
      }
      if (sql.includes('INSERT INTO reward_ledger')) {
        if (failLedger) throw new Error('injected write failure');
        assert.ok(sql.includes('WHERE NOT EXISTS')); assert.ok(sql.includes('ON CONFLICT DO NOTHING'));
        ledger.push({ id: params[0], referrer_user_id: params[1], referred_user_id: params[2], order_id: params[3],
          service_type: params[4], amount_minor: params[5], created_at: params[7], idempotency_key: params[6] });
        return { rowCount: 1, rows: [{ id: params[0] }] };
      }
      return { rowCount: 0, rows: [] };
    } };
  } } as any;
}
test('default recovery dry-run is read-only and reports repairs without writing any source', async () => {
  const result = await reconcileReferralHistory(fakePool());
  assert.equal(result.mode, 'dry-run'); assert.equal(result.attributionRepairs.length, 1); assert.equal(result.rewardRepairs.length, 1);
  assert.equal(writes.length, 0); assert.ok(queries[0].includes('READ ONLY')); assert.ok(queries.includes('ROLLBACK'));
  assert.equal(result.clicks.storedEvents, 9); assert.equal(result.clicks.backfills, 0);
});
test('apply and repeated apply restore only proven records, exact amount once, without clicks', async () => {
  const first = await reconcileReferralHistory(fakePool(), true);
  assert.deepEqual(first.applied, { attributions: 1, rewards: 1 }); assert.equal(ledger[0].amount_minor, 17);
  const second = await reconcileReferralHistory(fakePool(), true);
  assert.deepEqual(second.applied, { attributions: 0, rewards: 0 }); assert.equal(ledger.length, 1); assert.equal(attributions.length, 1);
  assert.ok(!writes.some(sql => sql.includes('INSERT INTO referral_clicks')));
  assert.ok(queries.some(sql => sql.includes('SHARE ROW EXCLUSIVE'))); assert.ok(queries.includes('COMMIT'));
});
test('apply failure rolls back prior relationship repair and leaves retry safe', async () => {
  failLedger = true;
  await assert.rejects(reconcileReferralHistory(fakePool(), true), /injected write failure/);
  assert.equal(attributions.length, 0); assert.equal(ledger.length, 0); assert.ok(queries.includes('ROLLBACK'));
  failLedger = false; const retry = await reconcileReferralHistory(fakePool(), true);
  assert.deepEqual(retry.applied, { attributions: 1, rewards: 1 });
});
