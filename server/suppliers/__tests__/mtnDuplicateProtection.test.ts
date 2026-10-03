/**
 * MTN Duplicate Active Order Protection Test Suite
 *
 * Verifies business rule:
 * MTN does not permit another bundle order for the same recipient phone number
 * while a previous MTN order is still unresolved/processing.
 */

import assert from 'node:assert';
import { OrdersStore } from '../../db/ordersStore.js';
import { OrderRecord, OrderStatus } from '../../types/orders.js';
import {
  MTN_BLOCKING_STATUSES,
  MTN_TERMINAL_STATUSES,
  isMtnOrderBlocking,
  ACTIVE_MTN_ORDER_CODE,
  ACTIVE_MTN_ORDER_MESSAGE,
} from '../../services/duplicateOrderProtection.js';
import {
  canonicalGhanaPhone,
  areGhanaPhonesEqual,
  getGhanaPhoneLookupVariants,
} from '../../utils/phone.js';
import { FulfilmentService } from '../../services/fulfilmentService.js';
import { SuccessBizHubProvider } from '../successBizHub/provider.js';
import { SuccessBizHubClient } from '../successBizHub/client.js';

function createMockOrder(params: {
  id: string;
  publicRef: string;
  network: 'mtn' | 'telecel' | 'airteltigo';
  phone: string;
  status: OrderStatus;
}): OrderRecord {
  const now = new Date().toISOString();
  return {
    id: params.id,
    public_reference: params.publicRef,
    customer_name: 'Test Customer',
    customer_email: 'test@example.com',
    customer_phone: params.phone,
    recipient_phone: params.phone,
    network: params.network,
    product_id: `${params.network}-1gb`,
    product_name_snapshot: '1GB',
    bundle_size_snapshot: '1GB',
    amount: 499,
    currency: 'GHS',
    status: params.status,
    payment_provider: 'paystack',
    payment_reference: `PAY_${params.id}`,
    payment_status: params.status === 'pending_payment' ? 'pending' : 'success',
    supplier_provider: 'success_biz_hub',
    supplier_order_id: null,
    supplier_response: null,
    supplier_cost_minor: 420,
    supplier_offer_ref: null,
    supplier_last_checked_at: null,
    failure_reason: null,
    created_at: now,
    updated_at: now,
    paid_at: params.status === 'pending_payment' ? null : now,
    submitted_at: null,
    delivered_at: null,
  };
}

async function runMtnDuplicateTests() {
  console.log('--- STARTING MTN DUPLICATE PROTECTION TEST SUITE ---');
  let passed = 0;

  // 1. Phone Normalization equivalence (059... vs 233... vs +233...)
  {
    const formatA = '0592066298';
    const formatB = '233592066298';
    const formatC = '+233592066298';

    assert.strictEqual(canonicalGhanaPhone(formatA), '+233592066298');
    assert.strictEqual(canonicalGhanaPhone(formatB), '+233592066298');
    assert.strictEqual(canonicalGhanaPhone(formatC), '+233592066298');

    assert.strictEqual(areGhanaPhonesEqual(formatA, formatB), true);
    assert.strictEqual(areGhanaPhonesEqual(formatB, formatC), true);
    assert.strictEqual(areGhanaPhonesEqual(formatA, formatC), true);

    const variants = getGhanaPhoneLookupVariants(formatA);
    assert.ok(variants.includes('+233592066298'));
    assert.ok(variants.includes('233592066298'));
    assert.ok(variants.includes('0592066298'));

    console.log('✓ 1. Phone normalization across 059 / 233 / +233 verified as same recipient');
    passed++;
  }

  // 2. MTN processing order + same phone => blocked
  {
    OrdersStore.clearDevStore();
    const order1 = createMockOrder({
      id: 'ord_mtn_proc_1',
      publicRef: 'MH-MTN-PROC-1',
      network: 'mtn',
      phone: '+233592066298',
      status: 'processing',
    });
    await OrdersStore.createOrder(order1);

    const active = await OrdersStore.findActiveMtnOrder('0592066298');
    assert.ok(active, 'Processing MTN order must be found as active');
    assert.strictEqual(active.public_reference, 'MH-MTN-PROC-1');
    assert.strictEqual(isMtnOrderBlocking(active), true);

    // Attempt to create second order for same phone
    const order2 = createMockOrder({
      id: 'ord_mtn_proc_2',
      publicRef: 'MH-MTN-PROC-2',
      network: 'mtn',
      phone: '0592066298',
      status: 'pending_payment',
    });
    const result = await OrdersStore.createOrderWithMtnDuplicateCheck(order2);
    assert.strictEqual(result.success, false, 'Second order must be blocked');
    if (!result.success) {
      assert.strictEqual(result.existingOrder.public_reference, 'MH-MTN-PROC-1');
    }

    console.log('✓ 2. MTN processing order + same phone => blocked');
    passed++;
  }

  // 3. MTN queued order + same phone => blocked
  {
    OrdersStore.clearDevStore();
    const orderQueued = createMockOrder({
      id: 'ord_mtn_q_1',
      publicRef: 'MH-MTN-Q-1',
      network: 'mtn',
      phone: '0592066298',
      status: 'queued',
    });
    await OrdersStore.createOrder(orderQueued);

    const active = await OrdersStore.findActiveMtnOrder('+233592066298');
    assert.ok(active, 'Queued MTN order must be found as active');
    assert.strictEqual(active.public_reference, 'MH-MTN-Q-1');

    const orderAttempt = createMockOrder({
      id: 'ord_mtn_q_2',
      publicRef: 'MH-MTN-Q-2',
      network: 'mtn',
      phone: '233592066298',
      status: 'pending_payment',
    });
    const result = await OrdersStore.createOrderWithMtnDuplicateCheck(orderAttempt);
    assert.strictEqual(result.success, false, 'Queued order must block new orders');

    console.log('✓ 3. MTN queued order + same phone => blocked');
    passed++;
  }

  // 4. MTN submitted order + same phone => blocked
  {
    OrdersStore.clearDevStore();
    const orderSubmitted = createMockOrder({
      id: 'ord_mtn_sub_1',
      publicRef: 'MH-MTN-SUB-1',
      network: 'mtn',
      phone: '233592066298',
      status: 'submitted',
    });
    await OrdersStore.createOrder(orderSubmitted);

    const active = await OrdersStore.findActiveMtnOrder('0592066298');
    assert.ok(active, 'Submitted MTN order must be found as active');
    assert.strictEqual(active.status, 'submitted');

    const orderAttempt = createMockOrder({
      id: 'ord_mtn_sub_2',
      publicRef: 'MH-MTN-SUB-2',
      network: 'mtn',
      phone: '+233592066298',
      status: 'pending_payment',
    });
    const result = await OrdersStore.createOrderWithMtnDuplicateCheck(orderAttempt);
    assert.strictEqual(result.success, false, 'Submitted order must block new orders');

    console.log('✓ 4. MTN submitted order + same phone => blocked');
    passed++;
  }

  // 5. MTN paid order & refund_pending order => blocked
  {
    OrdersStore.clearDevStore();
    const orderPaid = createMockOrder({
      id: 'ord_mtn_paid_1',
      publicRef: 'MH-MTN-PAID-1',
      network: 'mtn',
      phone: '0592066298',
      status: 'paid',
    });
    await OrdersStore.createOrder(orderPaid);
    const activePaid = await OrdersStore.findActiveMtnOrder('0592066298');
    assert.ok(activePaid, 'Paid MTN order must block');

    OrdersStore.clearDevStore();
    const orderRefundPending = createMockOrder({
      id: 'ord_mtn_rp_1',
      publicRef: 'MH-MTN-RP-1',
      network: 'mtn',
      phone: '0592066298',
      status: 'refund_pending',
    });
    await OrdersStore.createOrder(orderRefundPending);
    const activeRp = await OrdersStore.findActiveMtnOrder('0592066298');
    assert.ok(activeRp, 'refund_pending MTN order must block');

    console.log('✓ 5. MTN paid and refund_pending orders => blocked');
    passed++;
  }

  // 6. Delivered MTN order + same phone => allowed (Status Release)
  {
    OrdersStore.clearDevStore();
    const orderDelivered = createMockOrder({
      id: 'ord_mtn_del_1',
      publicRef: 'MH-MTN-DEL-1',
      network: 'mtn',
      phone: '0592066298',
      status: 'delivered',
    });
    await OrdersStore.createOrder(orderDelivered);

    const active = await OrdersStore.findActiveMtnOrder('0592066298');
    assert.strictEqual(active, null, 'Delivered order must NOT be blocking');

    const newOrder = createMockOrder({
      id: 'ord_mtn_del_2',
      publicRef: 'MH-MTN-DEL-2',
      network: 'mtn',
      phone: '0592066298',
      status: 'pending_payment',
    });
    const result = await OrdersStore.createOrderWithMtnDuplicateCheck(newOrder);
    assert.strictEqual(result.success, true, 'New order must be allowed after delivery');

    console.log('✓ 6. Delivered MTN order + same phone => allowed (automatic status release)');
    passed++;
  }

  // 7. Failed MTN order + same phone => allowed (Status Release)
  {
    OrdersStore.clearDevStore();
    const orderFailed = createMockOrder({
      id: 'ord_mtn_fail_1',
      publicRef: 'MH-MTN-FAIL-1',
      network: 'mtn',
      phone: '+233592066298',
      status: 'failed',
    });
    await OrdersStore.createOrder(orderFailed);

    const active = await OrdersStore.findActiveMtnOrder('0592066298');
    assert.strictEqual(active, null, 'Failed order must NOT be blocking');

    const newOrder = createMockOrder({
      id: 'ord_mtn_fail_2',
      publicRef: 'MH-MTN-FAIL-2',
      network: 'mtn',
      phone: '0592066298',
      status: 'pending_payment',
    });
    const result = await OrdersStore.createOrderWithMtnDuplicateCheck(newOrder);
    assert.strictEqual(result.success, true, 'New order must be allowed after failure');

    console.log('✓ 7. Failed MTN order + same phone => allowed');
    passed++;
  }

  // 8. Refunded MTN order + same phone => allowed (Status Release)
  {
    OrdersStore.clearDevStore();
    const orderRefunded = createMockOrder({
      id: 'ord_mtn_ref_1',
      publicRef: 'MH-MTN-REF-1',
      network: 'mtn',
      phone: '0592066298',
      status: 'refunded',
    });
    await OrdersStore.createOrder(orderRefunded);

    const active = await OrdersStore.findActiveMtnOrder('0592066298');
    assert.strictEqual(active, null, 'Refunded order must NOT be blocking');

    const newOrder = createMockOrder({
      id: 'ord_mtn_ref_2',
      publicRef: 'MH-MTN-REF-2',
      network: 'mtn',
      phone: '0592066298',
      status: 'pending_payment',
    });
    const result = await OrdersStore.createOrderWithMtnDuplicateCheck(newOrder);
    assert.strictEqual(result.success, true, 'New order must be allowed after refund');

    console.log('✓ 8. Refunded MTN order + same phone => allowed');
    passed++;
  }

  // 9. Active MTN order + different MTN phone => allowed
  {
    OrdersStore.clearDevStore();
    const activeOrderPhoneA = createMockOrder({
      id: 'ord_mtn_phone_a',
      publicRef: 'MH-MTN-A',
      network: 'mtn',
      phone: '0592066298',
      status: 'processing',
    });
    await OrdersStore.createOrder(activeOrderPhoneA);

    // Different phone: 0541234567
    const orderPhoneB = createMockOrder({
      id: 'ord_mtn_phone_b',
      publicRef: 'MH-MTN-B',
      network: 'mtn',
      phone: '0541234567',
      status: 'pending_payment',
    });
    const result = await OrdersStore.createOrderWithMtnDuplicateCheck(orderPhoneB);
    assert.strictEqual(result.success, true, 'Different recipient phone must NOT be blocked');

    console.log('✓ 9. Active MTN order + different MTN phone => allowed');
    passed++;
  }

  // 10. MTN active order does not incorrectly block another network (Telecel / AirtelTigo)
  {
    OrdersStore.clearDevStore();
    const activeMtnOrder = createMockOrder({
      id: 'ord_mtn_active',
      publicRef: 'MH-MTN-ACTIVE',
      network: 'mtn',
      phone: '0592066298',
      status: 'processing',
    });
    await OrdersStore.createOrder(activeMtnOrder);

    // Telecel order for same phone
    const telecelOrder = createMockOrder({
      id: 'ord_telecel_1',
      publicRef: 'MH-TEL-1',
      network: 'telecel',
      phone: '0592066298',
      status: 'pending_payment',
    });
    const resTelecel = await OrdersStore.createOrderWithMtnDuplicateCheck(telecelOrder);
    assert.strictEqual(resTelecel.success, true, 'Telecel order must NOT be blocked by active MTN order');

    // AirtelTigo order for same phone
    const atOrder = createMockOrder({
      id: 'ord_at_1',
      publicRef: 'MH-AT-1',
      network: 'airteltigo',
      phone: '0592066298',
      status: 'pending_payment',
    });
    const resAt = await OrdersStore.createOrderWithMtnDuplicateCheck(atOrder);
    assert.strictEqual(resAt.success, true, 'AirtelTigo order must NOT be blocked by active MTN order');

    console.log('✓ 10. MTN active order does not block Telecel or AirtelTigo');
    passed++;
  }

  // 11. Simultaneous duplicate requests cannot create two active MTN orders (Race Condition Protection)
  {
    OrdersStore.clearDevStore();
    const phone = '0592066298';

    // Simulate 5 simultaneous concurrent order creation requests
    const attempts = Array.from({ length: 5 }, (_, i) =>
      createMockOrder({
        id: `ord_simult_${i}`,
        publicRef: `MH-SIMULT-${i}`,
        network: 'mtn',
        phone,
        status: 'queued', // Active blocking status
      })
    );

    const results = await Promise.all(
      attempts.map((ord) => OrdersStore.createOrderWithMtnDuplicateCheck(ord))
    );

    const successCount = results.filter((r) => r.success).length;
    const blockedCount = results.filter((r) => !r.success).length;

    assert.strictEqual(successCount, 1, 'Exactly one concurrent request must succeed');
    assert.strictEqual(blockedCount, 4, 'All subsequent concurrent requests must be rejected');

    console.log('✓ 11. Simultaneous duplicate requests serialized (1 succeeded, 4 safely blocked)');
    passed++;
  }

  // 12. Fulfilment Service safeguard: simultaneous duplicate paid orders cannot create two active dispatches
  {
    OrdersStore.clearDevStore();
    const phone = '0592066298';

    // Order 1 is already in 'processing' status with supplier
    const activeOrder = createMockOrder({
      id: 'ord_active_dispatch_1',
      publicRef: 'MH-DISPATCH-1',
      network: 'mtn',
      phone,
      status: 'processing',
    });
    await OrdersStore.createOrder(activeOrder);

    // Order 2 was paid
    const paidOrder = createMockOrder({
      id: 'ord_paid_dispatch_2',
      publicRef: 'MH-DISPATCH-2',
      network: 'mtn',
      phone,
      status: 'paid',
    });
    await OrdersStore.createOrder(paidOrder);

    // Mock client that counts calls
    let supplierCalls = 0;
    const mockClient = new SuccessBizHubClient();
    mockClient.isFulfillmentEnabled = () => true;
    mockClient.createOrder = async () => {
      supplierCalls++;
      return { status: 'success', data: { publicId: 'sbh_mock_123', status: 'processing' } };
    };
    (FulfilmentService as unknown as { provider: SuccessBizHubProvider }).provider = new SuccessBizHubProvider(mockClient);

    // Attempt fulfilment on Order 2
    const savedPaymentKey = process.env.PAYSTACK_SECRET_KEY;
    process.env.PAYSTACK_SECRET_KEY = 'sk_live_mock_duplicate_guard';
    const result = await FulfilmentService.processPaidOrder(paidOrder.payment_reference, new Date().toISOString());
    if (savedPaymentKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = savedPaymentKey;
    assert.ok(result.order);
    assert.strictEqual(supplierCalls, 0, 'Supplier createOrder must NOT be called when another order is active');
    assert.strictEqual(result.order.status, 'queued', 'Second order must remain in queued state');
    assert.ok(result.order.failure_reason?.includes('active MTN order'));

    console.log('✓ 12. Simultaneous duplicate paid orders cannot create two active supplier dispatches');
    passed++;
  }

  // 13. Structured response verification (code, message, existingOrderReference, existingOrderStatus)
  {
    assert.strictEqual(ACTIVE_MTN_ORDER_CODE, 'ACTIVE_MTN_ORDER_EXISTS');
    assert.strictEqual(
      ACTIVE_MTN_ORDER_MESSAGE,
      'You already have an MTN bundle being processed for this number. Please wait for it to be completed before placing another order.'
    );
    console.log('✓ 13. Structured response codes and messages verified');
    passed++;
  }

  console.log(`\nALL ${passed} MTN DUPLICATE PROTECTION TESTS PASSED SUCCESSFULLY!`);
}

runMtnDuplicateTests().catch((err) => {
  console.error('TEST RUNNER FAILED:', err);
  process.exit(1);
});
