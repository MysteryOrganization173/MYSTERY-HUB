import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import { ReferralStore } from '../../db/referralStore.js';
import { ReferralService } from '../../services/referralService.js';
import { corsMiddleware } from '../../middleware/cors.js';
import { referralCaptureRateLimiter } from '../../middleware/rateLimiter.js';
import { AdminAuditStore } from '../../db/adminAuditStore.js';
import { planReferralRecovery, type ReferralRecoverySnapshot } from '../../services/referralRecovery.js';
import type { OrderRecord } from '../../types/orders.js';

const originalRecordClick = ReferralStore.recordClick;
const environment = { ...process.env };
beforeEach(() => { delete process.env.DATABASE_URL; process.env.NODE_ENV = 'test'; ReferralStore._clearDevStore(); });
afterEach(() => { ReferralStore.recordClick = originalRecordClick; process.env = { ...environment }; });

test('allowed cross-origin preflight permits visitor, authorization and JSON headers without wildcard', () => {
  for (const origin of ['https://mysteryhub.netlify.app', 'https://mysterybundlehub.com', 'http://localhost:5173']) {
    const headers: Record<string, string> = {};
    let status = 0;
    corsMiddleware({ method: 'OPTIONS', headers: { origin } } as any,
      { setHeader: (key: string, value: string) => { headers[key] = value; }, sendStatus: (value: number) => { status = value; } } as any,
      () => { throw new Error('Preflight must terminate'); });
    assert.equal(status, 204); assert.equal(headers['Access-Control-Allow-Origin'], origin);
    const allowed = headers['Access-Control-Allow-Headers'].toLowerCase().split(/,\s*/);
    for (const name of ['x-visitor-key', 'authorization', 'content-type']) assert.ok(allowed.includes(name));
    assert.ok(!allowed.includes('*'));
  }
});
test('untrusted origin remains outside the original allowlist', () => {
  const headers: Record<string, string> = {};
  corsMiddleware({ method: 'OPTIONS', headers: { origin: 'https://attacker.invalid' } } as any,
    { setHeader: (key: string, value: string) => { headers[key] = value; }, sendStatus: () => {} } as any, () => {});
  assert.equal(headers['Access-Control-Allow-Origin'], undefined);
});
test('valid capture records analytics and independent guest attribution', async () => {
  const profile = await ReferralStore.getOrCreateProfile('owner');
  const result = await ReferralService.captureVisitorReferral({ code: profile.referral_code, visitorKey: 'vk_one', captureId: 'capture_123' });
  assert.equal(result.valid, true); assert.equal(result.clickRecorded, true); assert.equal(result.attributionRecorded, true);
  const summary = await ReferralStore.getReferralSummary('owner');
  assert.equal(summary.rawClicksCount, 1); assert.equal(summary.clicksCount, 1); assert.equal(summary.uniqueVisitorsCount, 1);
});
test('failed analytics is truthful and preserves a valid lifetime attribution; retry records once', async () => {
  const profile = await ReferralStore.getOrCreateProfile('owner');
  ReferralStore.recordClick = async () => { throw new Error('private database error'); };
  const params = { code: profile.referral_code, visitorKey: 'vk_one', currentUserId: 'customer', captureId: 'capture_retry' };
  const result = await ReferralService.captureVisitorReferral(params);
  assert.equal(result.valid, true); assert.equal(result.clickRecorded, false); assert.equal(result.attributionRecorded, true);
  assert.equal(result.reason, 'click_not_recorded'); assert.ok(!JSON.stringify(result).includes('private database'));
  assert.equal((await ReferralStore.findAttributionByReferredUserId('customer'))?.referrer_user_id, 'owner');
  ReferralStore.recordClick = originalRecordClick;
  await ReferralService.captureVisitorReferral(params); await ReferralService.captureVisitorReferral(params);
  assert.equal(await ReferralStore.countClicksByReferrer('owner'), 1);
});
test('authenticated self referral records neither clicks nor attribution', async () => {
  const profile = await ReferralStore.getOrCreateProfile('owner');
  const result = await ReferralService.captureVisitorReferral({ code: profile.referral_code, currentUserId: 'owner', visitorKey: 'vk_one' });
  assert.equal(result.valid, false); assert.equal(result.reason, 'self_referral');
  assert.equal(await ReferralStore.countClicksByReferrer('owner'), 0);
  assert.equal((await ReferralService.resolveReferralContextForOrder({ userId: 'owner', explicitCode: profile.referral_code })).referrerUserId, null);
});
test('raw events differ from distinct visitors; null/transient keys never inflate uniqueness', async () => {
  const profile = await ReferralStore.getOrCreateProfile('owner');
  const realNow = Date.now;
  let now = realNow(); Date.now = () => now;
  try {
    const params = { profileId: profile.id, referrerUserId: 'owner', referralCode: profile.referral_code };
    await ReferralStore.recordClick({ ...params, visitorKey: 'vk_one' });
    now += 120_000;
    await ReferralStore.recordClick({ ...params, visitorKey: 'vk_one' });
    await ReferralStore.recordClick({ ...params, visitorKey: 'vk_two' });
    await ReferralStore.recordClick({ ...params, visitorKey: null });
    await ReferralStore.recordClick({ ...params, visitorKey: null });
    await ReferralStore.recordClick({ ...params, visitorKey: 'vk_transient_123' });
    assert.equal(await ReferralStore.countClicksByReferrer('owner'), 6);
    assert.equal(await ReferralStore.countUniqueVisitorsByReferrer('owner'), 2);
  } finally { Date.now = realNow; }
});
test('guest first touch and its lineage survive signup using a different code', async () => {
  const a = await ReferralStore.getOrCreateProfile('a'); const b = await ReferralStore.getOrCreateProfile('b');
  await ReferralStore.createGuestAttribution({ visitorKey: 'vk_one', referrerUserId: 'a', sourceCode: a.referral_code });
  const result = await ReferralStore.bindAttributionToUser({ referredUserId: 'customer', referrerUserId: 'b', sourceCode: b.referral_code, visitorKey: 'vk_one' });
  assert.equal(result.attribution?.referrer_user_id, 'a'); assert.equal(result.attribution?.source_code, a.referral_code);
  assert.equal(result.attribution?.level1_referrer_user_id, 'a');
});
test('checkout context and audit metadata preserve the captured first referrer rather than a later code', async () => {
  const a = await ReferralStore.getOrCreateProfile('a'); const b = await ReferralStore.getOrCreateProfile('b');
  await ReferralStore.createGuestAttribution({ visitorKey: 'vk_one', referrerUserId: 'a', sourceCode: a.referral_code });
  const context = await ReferralService.resolveReferralContextForOrder({ visitorKey: 'vk_one', explicitCode: b.referral_code });
  assert.equal(context.referrerUserId, 'a'); assert.equal(context.referralCode, a.referral_code);
  AdminAuditStore._clearDevStore();
  await ReferralService.captureVisitorReferral({ code: b.referral_code, visitorKey: 'vk_one', currentUserId: 'customer' });
  const audit = (await AdminAuditStore.findRecent()).find(item => item.action === 'referral_bound');
  assert.equal(JSON.parse(audit!.metadata_safe_json!).referrer_user_id, 'a');
  assert.equal(JSON.parse(audit!.metadata_safe_json!).source_code, a.referral_code);
});
test('public limiter uses visitor identity rather than aggregating users sharing a mobile network', () => {
  process.env.NODE_ENV = 'production';
  let allowed = 0; let rejected = 0;
  const response = { status: () => ({ json: () => { rejected++; } }) } as any;
  for (let i = 0; i < 61; i++) referralCaptureRateLimiter({ body: { visitorKey: 'rate_visitor_one' }, headers: {}, socket: { remoteAddress: 'same-network' } } as any, response, () => { allowed++; });
  referralCaptureRateLimiter({ body: { visitorKey: 'rate_visitor_two' }, headers: {}, socket: { remoteAddress: 'same-network' } } as any, response, () => { allowed++; });
  assert.equal(rejected, 1); assert.equal(allowed, 61);
});
test('changed reward keys cannot mint another direct reward, including after reversal', async () => {
  const entry = { referrer_user_id: 'owner', referred_user_id: 'customer', referral_attribution_id: null,
    order_id: 'order', marketplace_product_id: null, service_type: 'data' as const, reward_rule_id: null,
    amount_minor: 20, currency: 'GHS' as const, status: 'approved' as const, reason: 'fixture',
    idempotency_key: 'historical_reward:order', reversal_of_id: null, approved_at: null, rejected_at: null, reversed_at: null, metadata_json: null };
  const first = await ReferralStore.createLedgerEntry(entry);
  await ReferralStore.reverseLedgerEntry(first.record.id, 'Explicit reversal');
  const again = await ReferralStore.createLedgerEntry({ ...entry, idempotency_key: 'order_reward:order:newrule', amount_minor: 900 });
  assert.equal(again.alreadyExisted, true); assert.equal(again.record.status, 'reversed');
  assert.equal((await ReferralStore.findLedgerByOrderId('order')).length, 1);
});

function snapshot(): ReferralRecoverySnapshot {
  const at = '2026-01-01T00:00:00.000Z';
  return { users: [{ id: 'owner' }, { id: 'customer' }, { id: 'other' }],
    profiles: [{ id: 'p', user_id: 'owner', referral_code: 'MH-OWNER', is_enabled: true, created_at: at, updated_at: at }],
    orders: [{ id: 'order', user_id: 'customer', referrer_user_id: 'owner', referral_code: 'MH-OWNER',
      created_at: at, delivered_at: '2026-01-02T00:00:00.000Z', status: 'delivered', payment_status: 'success', service_type: 'data', currency: 'GHS' } as OrderRecord],
    attributions: [], ledger: [], audits: [], storedClickCount: 3 };
}
function addApproval(data: ReferralRecoverySnapshot) {
  data.audits.push({ id: 'audit', admin_user_id: 'owner', action: 'reward_approved', entity_type: 'reward_ledger', entity_id: 'original_reward',
    created_at: '2026-01-03T00:00:00.000Z', metadata_safe_json: JSON.stringify({ order_id: 'order', referrer_user_id: 'owner', service_type: 'data', amount_minor: 27 }) });
}
test('historical relationships are recoverable without fabricating clicks and are idempotent', () => {
  const data = snapshot(); const first = planReferralRecovery(data);
  assert.equal(first.attributionRepairs.length, 1); assert.equal(first.clicks.backfills, 0); assert.equal(first.clicks.storedEvents, 3);
  const repair = first.attributionRepairs[0];
  data.attributions.push({ id: 'restored', referrer_user_id: repair.referrerUserId, referred_user_id: repair.referredUserId,
    source_code: repair.sourceCode, first_seen_at: repair.evidenceAt, bound_at: repair.evidenceAt, visitor_key: null,
    first_landing_path: null, status: 'locked', created_at: repair.evidenceAt, updated_at: repair.evidenceAt });
  assert.equal(planReferralRecovery(data).attributionRepairs.length, 0); assert.equal(planReferralRecovery(data).clicks.backfills, 0);
});
test('missing historical amount goes to review rather than today’s rule', () => {
  const plan = planReferralRecovery(snapshot());
  assert.equal(plan.rewardRepairs.length, 0); assert.ok(plan.manualReview.some(item => item.reason === 'historical_reward_amount_or_approval_unproven'));
});
test('persisted original approval restores exact amount once; subsequent run sees ledger', () => {
  const data = snapshot(); addApproval(data);
  const plan = planReferralRecovery(data); assert.equal(plan.rewardRepairs.length, 1); assert.equal(plan.rewardRepairs[0].amountMinor, 27);
  data.ledger.push({ id: 'original_reward', order_id: 'order' } as any);
  assert.equal(planReferralRecovery(data).rewardRepairs.length, 0);
});
test('original approval can prove a lost order referral context without using today’s reward rule', () => {
  const data = snapshot(); addApproval(data); data.orders[0].referrer_user_id = null; data.orders[0].referral_code = null;
  const plan = planReferralRecovery(data);
  assert.equal(plan.attributionRepairs.length, 1); assert.equal(plan.rewardRepairs.length, 1); assert.equal(plan.rewardRepairs[0].amountMinor, 27);
});
test('existing first touch cannot be hijacked by conflicting order evidence', () => {
  const data = snapshot(); data.attributions.push({ id: 'original', referred_user_id: 'customer', referrer_user_id: 'other', first_seen_at: '2025-01-01' } as any);
  const plan = planReferralRecovery(data); assert.equal(plan.attributionRepairs.length, 0); assert.equal(plan.rewardRepairs.length, 0);
  assert.ok(plan.manualReview.some(item => item.reason.includes('first_touch_preserved')));
});
test('circular historical relationships are all rejected before any repair', () => {
  const data = snapshot(); data.profiles.push({ ...data.profiles[0], id: 'pc', user_id: 'customer', referral_code: 'MH-CUSTOMER' });
  data.orders.push({ ...data.orders[0], id: 'cycle', user_id: 'owner', referrer_user_id: 'customer', referral_code: 'MH-CUSTOMER' });
  const plan = planReferralRecovery(data); assert.equal(plan.attributionRepairs.length, 0); assert.equal(plan.rewardRepairs.length, 0);
  assert.equal(plan.manualReview.filter(item => item.reason === 'circular_relationship').length, 2);
});
for (const scenario of ['reversed', 'unpaid', 'wrong_referrer', 'ambiguous_approval', 'later_attribution', 'invalid_amount']) {
  test(`historical reward safety: ${scenario}`, () => {
    const data = snapshot(); addApproval(data);
    if (scenario === 'reversed') data.audits.push({ ...data.audits[0], id: 'reversal', action: 'reward_reversed' });
    if (scenario === 'unpaid') data.orders[0].payment_status = 'pending';
    if (scenario === 'wrong_referrer') data.audits[0].metadata_safe_json = data.audits[0].metadata_safe_json!.replace('owner', 'other');
    if (scenario === 'ambiguous_approval') data.audits.push({ ...data.audits[0], id: 'second' });
    if (scenario === 'later_attribution') { data.orders[0].referrer_user_id = null; data.audits = []; data.attributions.push({ id: 'late', referred_user_id: 'customer', referrer_user_id: 'owner', first_seen_at: '2026-02-01' } as any); }
    if (scenario === 'invalid_amount') data.audits[0].metadata_safe_json = data.audits[0].metadata_safe_json!.replace('27', '-10');
    assert.equal(planReferralRecovery(data).rewardRepairs.length, 0);
  });
}
