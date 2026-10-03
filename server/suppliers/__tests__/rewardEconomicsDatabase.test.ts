import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import pg from 'pg';
import { ReferralService } from '../../services/referralService.js';
import { ReferralStore } from '../../db/referralStore.js';
import type { OrderRecord } from '../../types/orders.js';

const originalConnect = pg.Pool.prototype.connect;
const originalQuery = pg.Pool.prototype.query;
const environment = { ...process.env };
let rows: any[]; let statements: string[]; let failInsert: boolean; let released: number;
let lockTail: Promise<void>; let orders: Map<string, OrderRecord>;
function fixture(id: string): OrderRecord {
  const at = new Date(Date.now() - 10000).toISOString();
  return { id, user_id: 'buyer', referrer_user_id: 'owner', referral_attribution_id: 'attr', public_reference: id,
    customer_name: 'Buyer', customer_email: 'buyer@example.com', customer_phone: '0241111111', recipient_phone: '0241111111',
    network: 'mtn', service_type: 'data', product_id: 'data', product_name_snapshot: 'Data', bundle_size_snapshot: '1GB',
    amount: 1000, currency: 'GHS', status: 'delivered', payment_provider: 'paystack', payment_reference: `pay_${id}`,
    payment_status: 'success', supplier_provider: null, supplier_order_id: null, supplier_response: null,
    supplier_cost_minor: null, supplier_offer_ref: null, supplier_last_checked_at: null, failure_reason: null,
    paid_at: at, submitted_at: at, delivered_at: at, created_at: at, updated_at: at };
}
async function query(sql: string, args: any[] = []) {
  statements.push(sql);
  if (sql.includes('referral_attributions')) return { rows: [{ id: 'attr', referred_user_id: 'buyer', referrer_user_id: 'owner' }] };
  if (sql.includes('SELECT * FROM orders')) return { rows: orders.has(args[0]) ? [orders.get(args[0])] : [] };
  if (sql.includes('SELECT EXISTS') && sql.includes('FROM orders')) return { rows: [{ present: false }] };
  if (sql.includes('SELECT EXISTS') && sql.includes('FROM reward_ledger')) {
    assert.ok(sql.includes("reward_stage IN ('standard', 'acquisition')"));
    return { rows: [{ present: rows.some(row => row.order_id !== args[5] && row.reward_stage !== 'recurring') }] };
  }
  if (sql.includes('SELECT * FROM referral_reward_rules')) {
    assert.ok(sql.includes("purchase_stage IN ('any', $5)"));
    return { rows: [{ id: `data_${args[4]}`, service_type: 'data', purchase_stage: args[4], reward_type: 'fixed_minor',
      reward_minor: args[4] === 'acquisition' ? 50 : 10, enabled: true }] };
  }
  if (sql.includes('SELECT * FROM reward_ledger')) return { rows: rows.filter(row => row.order_id === (sql.includes('idempotency_key =') ? args[1] : args[0])) };
  if (sql.includes('INSERT INTO reward_ledger')) {
    if (failInsert) throw new Error('injected ledger insert failure');
    const row = { id: args[0], referrer_user_id: args[1], referred_user_id: args[2], referral_attribution_id: args[3],
      order_id: args[4], service_type: args[6], reward_rule_id: args[7], amount_minor: args[8], status: args[10],
      metadata_json: JSON.parse(args[18]), reward_stage: args[19], reward_relationship_key: args[20] };
    rows.push(row); return { rows: [row] };
  }
  return { rows: [], rowCount: 0 };
}
beforeEach(() => {
  process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = 'postgresql://fixture.invalid/never-contacted';
  rows = []; statements = []; failInsert = false; released = 0; lockTail = Promise.resolve(); orders = new Map();
  pg.Pool.prototype.query = query as any;
  pg.Pool.prototype.connect = (async () => {
    let releaseLock: (() => void) | undefined;
    return { release: () => { released++; }, query: async (sql: string, args: any[] = []) => {
      if (sql.includes('pg_advisory_xact_lock') && args[0]?.startsWith('referral-stage:')) {
        const previous = lockTail; lockTail = new Promise<void>(resolve => { releaseLock = resolve; }); await previous;
      }
      const result = await query(sql, args);
      if (sql === 'COMMIT' || sql === 'ROLLBACK') releaseLock?.();
      return result;
    } };
  }) as any;
});
afterEach(() => { pg.Pool.prototype.connect = originalConnect; pg.Pool.prototype.query = originalQuery; process.env = { ...environment }; });

test('PostgreSQL transaction serializes concurrent relationship rewards and inserts stage snapshots', async () => {
  const first = fixture('one'); const second = fixture('two'); orders.set(first.id, first); orders.set(second.id, second);
  const rewards = await Promise.all([ReferralService.processOrderReward(first), ReferralService.processOrderReward(second)]);
  assert.deepEqual(rewards.map(reward => reward?.amount_minor), [50, 10]);
  assert.deepEqual(rows.map(row => row.reward_stage), ['acquisition', 'recurring']);
  assert.equal(rows[0].reward_relationship_key, 'owner:attribution:attr:data');
  assert.ok(statements.some(sql => sql.includes('FOR UPDATE')));
  assert.ok(statements.indexOf('LOCK TABLE reward_ledger IN ROW EXCLUSIVE MODE;') < statements.findIndex(sql => sql.includes('SELECT EXISTS')));
  assert.equal(statements.filter(sql => sql === 'BEGIN').length, 2); assert.equal(released, 2);
});
test('insert failure rolls back stage transaction and retry can earn acquisition', async () => {
  const item = fixture('retry'); orders.set(item.id, item); failInsert = true;
  await assert.rejects(ReferralService.processOrderReward(item), /injected ledger insert failure/);
  assert.ok(statements.includes('ROLLBACK')); assert.equal(rows.length, 0);
  failInsert = false; assert.equal((await ReferralService.processOrderReward(item))?.amount_minor, 50);
  assert.equal(released, 2);
});
test('authoritative persisted order is rechecked before any payout', async () => {
  const input = fixture('changed'); orders.set(input.id, { ...input, payment_status: 'pending' });
  assert.equal(await ReferralService.processOrderReward(input), null); assert.equal(rows.length, 0);
  assert.ok(statements.includes('COMMIT')); assert.equal(released, 1);
});
test('stage-aware database lookup preserves specificity and deterministic tie breaking', async () => {
  await ReferralStore.findMatchingRule('data', 'mtn', 'data', 'acquisition');
  const sql = statements.find(value => value.includes('FROM referral_reward_rules'))!;
  assert.ok(sql.indexOf('CASE WHEN product_key') < sql.indexOf('CASE WHEN network'));
  assert.ok(sql.indexOf('CASE WHEN network') < sql.indexOf("CASE WHEN purchase_stage = 'any'"));
  assert.ok(sql.includes('created_at DESC, id ASC'));
});
