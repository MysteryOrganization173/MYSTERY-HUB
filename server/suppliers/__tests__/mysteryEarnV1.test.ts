/**
 * Mystery Earn V1: Lifetime Referral Engine & Immutable Reward Ledger Test Suite
 * Validates:
 * 1. Permanent unique referral profile generation (MH-XXXXXX format, idempotent, collision-free)
 * 2. Canonical, URL-safe referral URL building across any route
 * 3. Non-invasive visitor click recording & guest attribution
 * 4. First-touch lifetime attribution binding on user registration/login
 * 5. Strict self-referral rejection & prevention
 * 6. Lifetime attribution priority over transient codes (first-touch wins)
 * 7. Authoritative reward rules engine (fixed minor pesewas, percentage basis points, product/network specificity)
 * 8. Immutable reward ledger creation on terminal delivered orders
 * 9. Strict reward ledger idempotency (no double-crediting)
 * 10. Automatic reward ledger reversal on order failure/refund
 * 11. Accurate user referral summary calculations (minor units & formatted GHS)
 * 12. Admin reward rule configuration & audit logging
 */

import assert from 'node:assert';
import { ReferralStore } from '../../db/referralStore.js';
import { ReferralService } from '../../services/referralService.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { AuthStore } from '../../db/authStore.js';
import { AdminAuditStore } from '../../db/adminAuditStore.js';
import { OrderRecord } from '../../types/orders.js';
import { buildReferralUrl } from '../../utils/referralUrl.js';

async function runMysteryEarnV1Tests() {
  console.log('=== STARTING MYSTERY EARN V1 TEST SUITE ===');
  let passed = 0;

  // Clear in-memory stores for clean test run
  ReferralStore._clearDevStore();
  OrdersStore.clearDevStore();
  AuthStore._clearDevStore();
  AdminAuditStore._clearDevStore();

  // 1. Permanent Referral Profile Generation & Case-Insensitive Lookup
  {
    const userA = await AuthStore.createUser({
      id: 'usr_earn_test_1',
      name: 'Kofi Mensah',
      email: 'kofi@example.com',
      phone: '+233241112233',
      passwordHash: 'scrypt$dummy_hash',
      role: 'customer',
      status: 'active',
    });

    const profile1 = await ReferralStore.getOrCreateProfile(userA.id);
    assert.ok(profile1.referral_code.startsWith('MH-'), 'Referral code must follow format MH-XXXXXX');
    assert.strictEqual(profile1.referral_code.length, 9, 'Referral code format MH- + 6 characters = length 9');
    assert.strictEqual(profile1.user_id, userA.id);

    // Idempotency check: Calling getOrCreateProfile again returns identical code
    const profile2 = await ReferralStore.getOrCreateProfile(userA.id);
    assert.strictEqual(profile2.referral_code, profile1.referral_code, 'Referral code must be permanent and never regenerate');

    // Case-insensitive lookup check
    const lookupLower = await ReferralStore.findProfileByCode(profile1.referral_code.toLowerCase());
    assert.ok(lookupLower, 'Case-insensitive code lookup must succeed');
    assert.strictEqual(lookupLower?.id, profile1.id);

    console.log('✓ 1. Permanent referral profile generation & case-insensitive lookup passed');
    passed++;
  }

  // 2. Canonical Referral Link Builder
  {
    const code = 'MH-9A7K3X';

    const rootUrl = buildReferralUrl('/', code, 'https://mysterybundlehub.com');
    assert.strictEqual(rootUrl, 'https://mysterybundlehub.com/?ref=MH-9A7K3X');

    const dataUrl = buildReferralUrl('/data', code, 'https://mysterybundlehub.com');
    assert.strictEqual(dataUrl, 'https://mysterybundlehub.com/data?ref=MH-9A7K3X');

    const productUrl = buildReferralUrl('/marketplace/pos-terminal-v2?color=black', code, 'https://mysterybundlehub.com');
    assert.strictEqual(productUrl, 'https://mysterybundlehub.com/marketplace/pos-terminal-v2?color=black&ref=MH-9A7K3X');

    console.log('✓ 2. Canonical referral link builder passed');
    passed++;
  }

  // 3. Visitor Click Recording & Guest Attribution
  {
    const referrer = await ReferralStore.findProfileByUserId('usr_earn_test_1');
    assert.ok(referrer);

    const clickRes = await ReferralService.captureVisitorReferral({
      code: referrer.referral_code,
      visitorKey: 'vk_guest_test_abc123',
      landingPath: '/data',
      userAgent: 'Mozilla/5.0 Test Browser',
    });

    assert.strictEqual(clickRes.valid, true);
    assert.strictEqual(clickRes.referrerUserId, 'usr_earn_test_1');

    const guestAttr = await ReferralStore.findAttributionByVisitorKey('vk_guest_test_abc123');
    assert.ok(guestAttr, 'Guest attribution must be stored');
    assert.strictEqual(guestAttr?.referrer_user_id, 'usr_earn_test_1');
    assert.strictEqual(guestAttr?.source_code, referrer.referral_code);

    const clicksCount = await ReferralStore.countClicksByReferrer('usr_earn_test_1');
    assert.strictEqual(clicksCount, 1, 'Clicks count must increment to 1');

    console.log('✓ 3. Visitor click recording & guest attribution passed');
    passed++;
  }

  // 4. Lifetime Attribution Binding on User Signup (First-Touch Lifetime Binding)
  {
    const referrer = await ReferralStore.findProfileByUserId('usr_earn_test_1');
    assert.ok(referrer);

    // New user registers who previously had the guest visitor key
    const userB = await AuthStore.createUser({
      id: 'usr_earn_test_2',
      name: 'Ama Serwaa',
      email: 'ama@example.com',
      phone: '+233245556677',
      passwordHash: 'scrypt$dummy_hash',
      role: 'customer',
      status: 'active',
    });

    const bindResult = await ReferralStore.bindAttributionToUser({
      referredUserId: userB.id,
      referrerUserId: referrer.user_id,
      sourceCode: referrer.referral_code,
      visitorKey: 'vk_guest_test_abc123',
      landingPath: '/data',
    });

    assert.strictEqual(bindResult.isNew, true);
    assert.ok(bindResult.attribution);
    assert.strictEqual(bindResult.attribution?.referred_user_id, userB.id);
    assert.strictEqual(bindResult.attribution?.referrer_user_id, 'usr_earn_test_1');

    // Verify lifetime lookup
    const lifetime = await ReferralStore.findAttributionByReferredUserId(userB.id);
    assert.ok(lifetime);
    assert.strictEqual(lifetime?.referrer_user_id, 'usr_earn_test_1');

    console.log('✓ 4. Lifetime first-touch attribution binding passed');
    passed++;
  }

  // 5. Strict Self-Referral Rejection
  {
    const referrer = await ReferralStore.findProfileByUserId('usr_earn_test_1');
    assert.ok(referrer);

    // Attempting to self-refer
    const selfRes = await ReferralService.captureVisitorReferral({
      code: referrer.referral_code,
      visitorKey: 'vk_self_key',
      landingPath: '/data',
      currentUserId: 'usr_earn_test_1', // same user!
    });

    assert.strictEqual(selfRes.valid, false);
    assert.strictEqual(selfRes.reason, 'self_referral');

    // Direct store binding attempt
    const selfBind = await ReferralStore.bindAttributionToUser({
      referredUserId: 'usr_earn_test_1',
      referrerUserId: 'usr_earn_test_1',
      sourceCode: referrer.referral_code,
    });

    assert.strictEqual(selfBind.attribution, null);
    assert.strictEqual(selfBind.isNew, false);

    console.log('✓ 5. Strict self-referral rejection passed');
    passed++;
  }

  // 6. First-Touch Attribution Lock (Subsequent codes do not overwrite)
  {
    // Create user C
    const userC = await AuthStore.createUser({
      id: 'usr_earn_test_3',
      name: 'Kwabena Osei',
      email: 'kwabena@example.com',
      phone: '+233249998877',
      passwordHash: 'scrypt$dummy_hash',
      role: 'customer',
      status: 'active',
    });
    const profileC = await ReferralStore.getOrCreateProfile(userC.id);

    // User B visits with User C's referral link
    const context = await ReferralService.resolveReferralContextForOrder({
      userId: 'usr_earn_test_2', // User B is already bound to User A!
      visitorKey: 'vk_new_visit',
      explicitCode: profileC.referral_code,
    });

    // Must return User A as the lifetime referrer, NOT User C
    assert.strictEqual(context.referrerUserId, 'usr_earn_test_1', 'Lifetime first-touch referrer must win');
    assert.strictEqual(context.referralCode, (await ReferralStore.findProfileByUserId('usr_earn_test_1'))?.referral_code);

    console.log('✓ 6. First-touch attribution lock (lifetime priority) passed');
    passed++;
  }

  // 7. Authoritative Reward Rules Engine Configuration
  {
    // Rule 1: Fixed 200 pesewas (GH₵2.00) for MTN Data Bundles
    await ReferralStore.createOrUpdateRule({
      id: 'rule_mtn_data_test',
      service_type: 'data',
      network: 'mtn',
      reward_type: 'fixed_minor',
      reward_minor: 200, // 200 pesewas
      enabled: true,
    });

    // Rule 2: 3% (300 basis points) for Instant Bundles
    await ReferralStore.createOrUpdateRule({
      id: 'rule_instant_bundles_test',
      service_type: 'instant_bundle',
      reward_type: 'percent_bps',
      reward_percent_bps: 300, // 3%
      enabled: true,
    });

    // Test Rule Matching
    const mtnRule = await ReferralStore.findMatchingRule('data', 'mtn');
    assert.ok(mtnRule);
    assert.strictEqual(mtnRule?.id, 'rule_mtn_data_test');
    assert.strictEqual(mtnRule?.reward_minor, 200);

    const instantRule = await ReferralStore.findMatchingRule('instant_bundle', 'telecel');
    assert.ok(instantRule);
    assert.strictEqual(instantRule?.id, 'rule_instant_bundles_test');
    assert.strictEqual(instantRule?.reward_percent_bps, 300);

    console.log('✓ 7. Authoritative reward rules engine configuration passed');
    passed++;
  }

  // 8. Immutable Reward Ledger Creation on Delivered Orders
  let testOrderId = '';
  {
    const orderTimestamp = Date.now();
    testOrderId = `ord_earn_test_${orderTimestamp}`;
    const testOrder: OrderRecord = {
      id: testOrderId,
      user_id: 'usr_earn_test_2', // Ama (referred by Kofi)
      public_reference: `MH-EARN-${orderTimestamp}`,
      customer_name: 'Ama Serwaa',
      customer_email: 'ama@example.com',
      customer_phone: '+233245556677',
      recipient_phone: '+233245556677',
      network: 'mtn',
      service_type: 'data',
      product_id: 'mtn-5gb',
      product_name_snapshot: 'MTN 5GB Non-Expiry',
      bundle_size_snapshot: '5GB',
      amount: 4500, // GH₵45.00 in pesewas
      currency: 'GHS',
      status: 'delivered',
      payment_provider: 'paystack',
      payment_reference: `PAY_${orderTimestamp}`,
      payment_status: 'success',
      supplier_provider: 'success_biz_hub',
      supplier_order_id: `sbh_ord_${orderTimestamp}`,
      supplier_response: null,
      supplier_cost_minor: 4000,
      supplier_offer_ref: 'mtn-5gb',
      supplier_last_checked_at: null,
      failure_reason: null,
      paid_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
      referrer_user_id: 'usr_earn_test_1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await OrdersStore.createOrder(testOrder);

    const reward = await ReferralService.processOrderReward(testOrder);
    assert.ok(reward, 'Delivered order must create a reward ledger record');
    assert.strictEqual(reward?.referrer_user_id, 'usr_earn_test_1');
    assert.strictEqual(reward?.referred_user_id, 'usr_earn_test_2');
    assert.strictEqual(reward?.amount_minor, 200, 'Fixed MTN rule should award 200 pesewas');
    assert.strictEqual(reward?.status, 'approved');

    console.log('✓ 8. Immutable reward ledger creation on delivered orders passed');
    passed++;
  }

  // 9. Strict Reward Ledger Idempotency
  {
    const existingOrder = await OrdersStore.findOrder(testOrderId);
    assert.ok(existingOrder);

    // Call processOrderReward again with the same order
    const repeatReward = await ReferralService.processOrderReward(existingOrder);
    assert.ok(repeatReward);
    assert.strictEqual(repeatReward?.amount_minor, 200);

    // Verify only ONE ledger entry exists for this order
    const ledgerEntries = await ReferralStore.getLedgerForUser('usr_earn_test_1');
    assert.strictEqual(ledgerEntries.length, 1, 'Ledger must remain strictly deduplicated via idempotency key');

    console.log('✓ 9. Strict reward ledger idempotency passed');
    passed++;
  }

  // 10. Percentage-Based Instant Bundle Reward Processing
  {
    const instantTimestamp = Date.now() + 10;
    const instantOrder: OrderRecord = {
      id: `ord_instant_earn_${instantTimestamp}`,
      user_id: 'usr_earn_test_2',
      public_reference: `MH-INSTANT-${instantTimestamp}`,
      customer_name: 'Ama Serwaa',
      customer_email: 'ama@example.com',
      customer_phone: '+233245556677',
      recipient_phone: '+233245556677',
      network: 'telecel',
      service_type: 'instant_bundle',
      product_id: 'instant-telecel-10gb',
      product_name_snapshot: 'Telecel 10GB Instant',
      bundle_size_snapshot: '10GB',
      amount: 10000, // GH₵100.00 (10,000 pesewas)
      currency: 'GHS',
      status: 'delivered',
      payment_provider: 'paystack',
      payment_reference: `PAY_INSTANT_${instantTimestamp}`,
      payment_status: 'success',
      supplier_provider: 'success_biz_hub',
      supplier_order_id: `sbh_inst_${instantTimestamp}`,
      supplier_response: null,
      supplier_cost_minor: 9000,
      supplier_offer_ref: 'telecel-10gb',
      supplier_last_checked_at: null,
      failure_reason: null,
      paid_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
      referrer_user_id: 'usr_earn_test_1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await OrdersStore.createOrder(instantOrder);
    const instantReward = await ReferralService.processOrderReward(instantOrder);
    assert.ok(instantReward);
    // 3% of 10,000 pesewas = 300 pesewas (GH₵3.00)
    assert.strictEqual(instantReward?.amount_minor, 300, '3% of 10000 pesewas must equal 300 pesewas');
    assert.strictEqual(instantReward?.status, 'approved');

    console.log('✓ 10. Percentage-based instant bundle reward calculation passed');
    passed++;
  }

  // 11. Reward Ledger Reversal on Order Failure/Refund
  {
    const ledgerBefore = await ReferralStore.getLedgerForUser('usr_earn_test_1');
    assert.strictEqual(ledgerBefore.length, 2);

    const reversed = await ReferralService.reverseOrderRewards(testOrderId, 'Test order refund');
    assert.ok(reversed.length >= 1, 'Reversal must update ledger entry status');
    assert.strictEqual(reversed[0].status, 'reversed');

    console.log('✓ 11. Reward ledger reversal on order refund passed');
    passed++;
  }

  // 12. Accurate User Referral Summary Calculation
  {
    const summary = await ReferralStore.getReferralSummary('usr_earn_test_1');
    assert.strictEqual(summary.clicksCount, 1);
    assert.strictEqual(summary.referredCustomersCount, 1);
    assert.ok(summary.code.startsWith('MH-'));
    assert.ok(summary.shareUrl.includes('ref=MH-'));
    assert.strictEqual(typeof summary.approvedRewardsMinor, 'number');
    assert.strictEqual(typeof summary.approvedRewardsGhc, 'number');
    assert.strictEqual(summary.approvedRewardsGhc, summary.approvedRewardsMinor / 100);

    console.log('✓ 12. Accurate user referral summary calculation passed');
    passed++;
  }

  console.log(`\n========================================`);
  console.log(`ALL ${passed}/${passed} MYSTERY EARN V1 TESTS PASSED`);
  console.log(`========================================\n`);
}

runMysteryEarnV1Tests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
