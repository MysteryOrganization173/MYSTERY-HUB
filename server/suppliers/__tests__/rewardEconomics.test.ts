import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { ReferralStore } from '../../db/referralStore.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { MarketplaceStore } from '../../db/marketplaceStore.js';
import { ReferralService } from '../../services/referralService.js';
import { validateReferralRule, publicReferralRule, isActiveReferralRule } from '../../services/referralRulePolicy.js';
import { STANDARD_DATA_REFERRAL_POLICY } from '../../config/dataReferralRewardPolicy.js';
import { describeReferralReward } from '../../../src/utils/referralRewardCopy.js';
import type { OrderRecord } from '../../types/orders.js';

let sequence = 0;
function order(extra: Partial<OrderRecord> = {}): OrderRecord {
  const id = `economics_${String(++sequence).padStart(4, '0')}`;
  const at = new Date(Date.now() - 60000 + sequence * 10).toISOString();
  return { id, user_id: 'buyer', referrer_user_id: 'referrer', public_reference: id,
    customer_name: 'Buyer', customer_email: 'same@example.com', customer_phone: '0241111111', recipient_phone: '0241111111',
    network: 'mtn', service_type: 'data', product_id: 'data-product', product_name_snapshot: 'Data', bundle_size_snapshot: '1GB',
    amount: 1000, currency: 'GHS', status: 'delivered', payment_provider: 'paystack', payment_reference: `pay_${id}`,
    payment_status: 'success', supplier_provider: null, supplier_order_id: null, supplier_response: null,
    supplier_cost_minor: 100, // Known synthetic supplier cost for margin-safe qualifications.
    supplier_offer_ref: null, supplier_last_checked_at: null, failure_reason: null,
    paid_at: at, submitted_at: at, delivered_at: at, created_at: at, updated_at: at, ...extra };
}
async function pay(extra: Partial<OrderRecord> = {}) {
  const item = order(extra); await OrdersStore.createOrder(item); return ReferralService.processOrderReward(item);
}
async function rule(extra: Record<string, unknown> = {}) {
  return ReferralStore.createOrUpdateRule(validateReferralRule({ service_type: 'data', purchase_stage: 'acquisition',
    reward_type: 'fixed_minor', reward_minor: 75, enabled: true, ...extra }));
}
beforeEach(async () => {
  delete process.env.DATABASE_URL; process.env.NODE_ENV = 'test'; sequence = 0;
  ReferralStore._clearDevStore(); OrdersStore.clearDevStore(); MarketplaceStore._clearInMemoryStore();
  for (const config of STANDARD_DATA_REFERRAL_POLICY) await ReferralStore.createOrUpdateRule(config);
});

test('first paid delivered Data order receives 50 pesewas with durable stage snapshot', async () => {
  const reward = await pay(); assert.equal(reward?.amount_minor, 50); assert.equal(reward?.reward_stage, 'acquisition');
  assert.equal(reward?.metadata_json?.rule_value, 50); assert.equal(reward?.metadata_json?.purchase_stage, 'acquisition');
});
test('second qualifying Data order receives 10', async () => { await pay(); assert.equal((await pay())?.amount_minor, 10); });
test('third qualifying Data order remains recurring', async () => { await pay(); await pay(); const third = await pay(); assert.equal(third?.amount_minor, 10); assert.equal(third?.reward_stage, 'recurring'); });
for (const scenario of [
  { name: 'unpaid even with paid_at', extra: { payment_status: 'pending' } },
  { name: 'failed', extra: { status: 'failed' } },
  { name: 'cancelled', extra: { status: 'cancelled' } },
  { name: 'refunded before reward', extra: { status: 'refunded' } },
] as const) test(`${scenario.name} order does not consume acquisition`, async () => {
  assert.equal(await pay(scenario.extra), null); assert.equal((await pay())?.amount_minor, 50);
});
test('20 concurrent delivered orders processed newest first have exactly one acquisition', async () => {
  const orders = Array.from({ length: 20 }, () => order());
  for (const item of orders) await OrdersStore.createOrder(item);
  const rewards = await Promise.all(orders.reverse().map(item => ReferralService.processOrderReward(item)));
  assert.equal(rewards.filter(item => item?.reward_stage === 'acquisition').length, 1);
  assert.equal(rewards.filter(item => item?.reward_stage === 'recurring').length, 19);
  assert.equal(rewards.reduce((sum, item) => sum + item!.amount_minor, 0), 240);
});
test('self referral earns nothing', async () => { assert.equal(await pay({ user_id: 'referrer' }), null); });
test('non referred customer earns nothing', async () => { assert.equal(await pay({ referrer_user_id: null }), null); });
test('legacy any rules preserve economics and standard ledger classification', async () => {
  ReferralStore._clearDevStore(); await rule({ purchase_stage: 'any', reward_minor: 200 });
  assert.equal((await pay())?.reward_stage, 'standard'); assert.equal((await pay())?.amount_minor, 200);
});
test('stage wins against equivalent any rule', async () => { await rule({ purchase_stage: 'any', reward_minor: 250 }); assert.equal((await pay())?.amount_minor, 50); });
test('network stage overrides global stage', async () => { await rule({ network: 'mtn', reward_minor: 80 }); assert.equal((await pay())?.amount_minor, 80); });
test('product stage overrides network stage', async () => {
  await rule({ network: 'mtn', reward_minor: 80 }); await rule({ product_key: 'data-product', reward_minor: 90 }); assert.equal((await pay())?.amount_minor, 90);
});
test('more specific any product still overrides global stage', async () => { await rule({ product_key: 'data-product', purchase_stage: 'any', reward_minor: 95 }); assert.equal((await pay())?.amount_minor, 95); });
test('disabled rule ignored', async () => { await rule({ network: 'mtn', enabled: false }); assert.equal((await pay())?.amount_minor, 50); });
test('expired and future rules ignored at delivery time', async () => {
  await rule({ network: 'mtn', ends_at: '2020-01-01T00:00:00Z' }); await rule({ product_key: 'data-product', starts_at: '2099-01-01T00:00:00Z' });
  assert.equal((await pay())?.amount_minor, 50);
});
test('Marketplace product reward keeps precedence over rules and Data policy', async () => {
  const product = await MarketplaceStore.createProduct({ name: 'Product', category: 'business_software', priceType: 'fixed', priceMinor: 1000,
    availability: 'available', published: true, referralRewardMinor: 250 }, 'admin');
  const reward = await pay({ service_type: 'marketplace', product_id: product.id, marketplace_status: 'completed' });
  assert.equal(reward?.amount_minor, 250); assert.equal(reward?.reward_stage, 'standard'); assert.equal(reward?.reward_rule_id, null);
  assert.equal((await pay())?.amount_minor, 50);
});
test('repeat processing returns original amount even after rule edit', async () => {
  const item = order(); await OrdersStore.createOrder(item); const first = await ReferralService.processOrderReward(item);
  await rule({ id: 'standard_data_acquisition_v1', reward_minor: 99 });
  const repeat = await ReferralService.processOrderReward(item); assert.equal(repeat?.id, first?.id); assert.equal(repeat?.amount_minor, 50);
  assert.equal((await ReferralStore.findLedgerByOrderId(item.id)).length, 1);
});
test('reversed acquisition keeps stage and future orders recurring without retroactive promotion', async () => {
  const item = order(); await OrdersStore.createOrder(item); await ReferralService.processOrderReward(item); const second = await pay();
  const reversed = await ReferralService.reverseOrderRewards(item.id, 'refund'); assert.equal(reversed[0].reward_stage, 'acquisition');
  assert.equal(reversed[0].status, 'reversed'); assert.equal((await pay())?.amount_minor, 10);
  assert.equal((await ReferralStore.findLedgerById(second!.id))?.reward_stage, 'recurring');
});
test('admin rejects invalid amounts percentages stages dates and contradictory payloads', () => {
  const base = { service_type: 'data', reward_minor: 50 };
  for (const invalid of [ { reward_minor: -1 }, { reward_minor: 0.5 }, { purchase_stage: 'first' }, { enabled: 'true' },
    { reward_type: 'percent_bps', reward_minor: null, reward_percent_bps: 10001 },
    { reward_type: 'percent_bps', reward_minor: null, reward_percent_bps: -1 },
    { reward_type: 'percent_bps', reward_percent_bps: 250 }, { starts_at: 'bad' }, { starts_at: '2026-04-31T00:00:00Z' },
    { starts_at: '2026-10-03T24:00:00Z' },
    { starts_at: '2026-10-03T00:00:00Z', ends_at: '2026-10-02T00:00:00Z' }, { level2_reward_minor: 100 } ]) {
    assert.throws(() => validateReferralRule({ ...base, ...invalid }), /./);
  }
  assert.equal(validateReferralRule({ ...base, reward_minor: 0 }).reward_minor, 0);
});
test('public rules expose safe stage and truthful configurable customer copy', async () => {
  const stored = await rule({ reward_minor: 80 }); const publicRule = publicReferralRule({ ...stored, level2_reward_minor: 1000 });
  assert.equal(publicRule.purchase_stage, 'acquisition'); assert.ok(!('level2_reward_minor' in publicRule));
  assert.equal(describeReferralReward(publicRule), "GH₵0.80 on a referred customer's first qualifying Data purchase");
  assert.match(describeReferralReward({ ...publicRule, purchase_stage: 'recurring', reward_minor: 10 }), /GH₵0.10 on future qualifying Data purchases/);
});
test('genuine guest attribution persists through signup for recurring rewards', async () => {
  const profile = await ReferralStore.getOrCreateProfile('referrer');
  await ReferralService.captureVisitorReferral({ code: profile.referral_code, visitorKey: 'guest-identity', landingPath: '/data' });
  const attribution = await ReferralStore.findAttributionByVisitorKey('guest-identity'); assert.ok(attribution);
  const first = await pay({ user_id: null, referral_attribution_id: attribution.id }); assert.equal(first?.amount_minor, 50);
  await ReferralStore.bindAttributionToUser({ referredUserId: 'buyer', referrerUserId: 'referrer', sourceCode: profile.referral_code, visitorKey: 'guest-identity' });
  const second = await pay({ referral_attribution_id: attribution.id }); assert.equal(second?.amount_minor, 10);
  assert.equal(second?.reward_relationship_key, first?.reward_relationship_key);
});
test('guest without proven attribution cannot receive stage reward; no email or phone matching', async () => {
  assert.equal(await pay({ user_id: null, referral_attribution_id: 'invented' }), null);
  assert.equal((await pay({ user_id: 'different-buyer' }))?.amount_minor, 50);
  assert.equal((await pay({ user_id: 'another-buyer' }))?.amount_minor, 50);
});
test('prior paid delivered history without ledger makes current order recurring', async () => {
  await OrdersStore.createOrder(order()); assert.equal((await pay())?.amount_minor, 10);
});
test('Data policy never leaks into instant or Airtime', async () => {
  assert.equal(await pay({ service_type: 'instant_bundle' }), null); assert.equal(await pay({ service_type: 'airtime' }), null);
  assert.equal((await pay())?.amount_minor, 50);
});
test('percentage stage rule uses configured basis points and normal rounding', async () => {
  await rule({ network: 'mtn', reward_type: 'percent_bps', reward_minor: null, reward_percent_bps: 333 });
  assert.equal((await pay())?.amount_minor, 33);
});
test('fixed reward above charge rejected without altering config or writing a ledger entry', async () => {
  await rule({ network: 'mtn', reward_minor: 2000 }); assert.equal(await pay(), null);
  assert.equal((await ReferralStore.findMatchingRule('data', 'mtn', 'data-product', 'acquisition'))?.reward_minor, 2000);
});
test('equivalent rules choose newest creation time then stable ID', async () => {
  await rule({ id: 'z', network: 'mtn', created_at: '2020-01-01T00:00:00Z' });
  await ReferralStore.createOrUpdateRule({ id: 'a', service_type: 'data', network: 'mtn', purchase_stage: 'acquisition', enabled: true, reward_minor: 82, created_at: '2090-01-01T00:00:00Z' });
  await ReferralStore.createOrUpdateRule({ id: 'b', service_type: 'data', network: 'mtn', purchase_stage: 'acquisition', enabled: true, reward_minor: 83, created_at: '2090-01-01T00:00:00Z' });
  assert.equal((await pay())?.amount_minor, 82);
});
test('public active filter excludes dates and admin update retains dormant fields', async () => {
  const stored = await ReferralStore.createOrUpdateRule({ service_type: 'data', reward_minor: 10, enabled: true, level2_reward_minor: 200 });
  const updated = await ReferralStore.createOrUpdateRule(validateReferralRule({ reward_minor: 20 }, stored));
  assert.equal(updated.level2_reward_minor, 200); assert.equal(isActiveReferralRule({ ...stored, starts_at: '2099-01-01T00:00:00Z' }), false);
});
