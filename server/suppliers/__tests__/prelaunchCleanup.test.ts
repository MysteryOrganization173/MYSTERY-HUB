/**
 * Pre-Launch Order Data Cleanup Test Suite
 *
 * Verifies:
 * 1. Dry run changes nothing in database/memory store
 * 2. Only explicitly listed refs can change
 * 3. Delivered orders are preserved and skipped
 * 4. Unrelated orders are completely untouched
 * 5. Stale fake processing order can be terminalized with administrative failure reason
 * 6. Terminalized MTN order no longer blocks findActiveMtnOrder()
 * 7. Running script twice is safe/idempotent
 * 8. Paid orders are protected unless explicit allowPaid is passed
 * 9. Explicit delete mode deletes row from database/memory store
 */

import assert from 'node:assert';
import { OrdersStore } from '../../db/ordersStore.js';
import { runPrelaunchCleanup, maskRecipientPhone } from '../../../scripts/cleanupPrelaunchOrders.js';
import { OrderRecord } from '../../types/orders.js';

// Synthetic cleanup fixtures always use memory, never an inherited database URL.
delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';

function createMockOrder(overrides: Partial<OrderRecord>): OrderRecord {
  const now = new Date().toISOString();
  const id = overrides.id || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const publicRef = overrides.public_reference || `MH-TEST-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  return {
    id,
    user_id: null,
    public_reference: publicRef,
    customer_name: 'Test Customer',
    customer_email: 'test@example.com',
    customer_phone: '0592066298',
    recipient_phone: '0592066298',
    network: 'mtn',
    service_type: 'data',
    product_id: 'mtn-1gb',
    product_name_snapshot: 'MTN 1GB',
    bundle_size_snapshot: '1GB',
    amount: 500,
    currency: 'GHS',
    status: 'processing',
    payment_provider: 'paystack',
    payment_reference: `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    payment_status: 'pending',
    supplier_provider: 'success_biz_hub',
    supplier_order_id: null,
    supplier_response: null,
    supplier_cost_minor: 400,
    supplier_offer_ref: 'mtn_1gb_offer',
    supplier_last_checked_at: null,
    failure_reason: null,
    created_at: now,
    updated_at: now,
    paid_at: null,
    submitted_at: null,
    delivered_at: null,
    ...overrides,
  };
}

async function runTests() {
  console.log('=== STARTING PRE-LAUNCH ORDER CLEANUP TEST SUITE ===');

  // Test 0: Masking helper
  {
    assert.strictEqual(maskRecipientPhone('0592066298'), '059***6298');
    assert.strictEqual(maskRecipientPhone('0241234567'), '024***4567');
    assert.strictEqual(maskRecipientPhone(''), 'unknown');
    console.log('✓ 0. Mask recipient phone works securely');
  }

  // Test 1: Dry run changes nothing
  {
    OrdersStore.clearDevStore();
    const order = await OrdersStore.createOrder(
      createMockOrder({
        public_reference: 'MH-DRYRUN-1',
        status: 'processing',
        payment_status: 'pending',
      })
    );

    const report = await runPrelaunchCleanup({
      confirm: false,
      targetRefs: ['MH-DRYRUN-1'],
    });

    assert.strictEqual(report.isDryRun, true);
    assert.strictEqual(report.terminalizedCount, 0);
    assert.strictEqual(report.deletedCount, 0);

    const check = await OrdersStore.findOrder('MH-DRYRUN-1');
    assert.ok(check);
    assert.strictEqual(check.status, 'processing');
    console.log('✓ 1. Dry run changes nothing in the database');
  }

  // Test 2: Only explicitly listed refs can change
  {
    OrdersStore.clearDevStore();
    await OrdersStore.createOrder(
      createMockOrder({
        public_reference: 'MH-TARGET-1',
        status: 'queued',
        payment_status: 'pending',
      })
    );
    await OrdersStore.createOrder(
      createMockOrder({
        public_reference: 'MH-UNLISTED-1',
        status: 'queued',
        payment_status: 'pending',
      })
    );

    const report = await runPrelaunchCleanup({
      confirm: true,
      targetRefs: ['MH-TARGET-1'],
    });

    assert.strictEqual(report.isDryRun, false);
    assert.strictEqual(report.terminalizedCount, 1);

    const targetOrder = await OrdersStore.findOrder('MH-TARGET-1');
    assert.strictEqual(targetOrder?.status, 'failed');

    const unlistedOrder = await OrdersStore.findOrder('MH-UNLISTED-1');
    assert.strictEqual(unlistedOrder?.status, 'queued');
    console.log('✓ 2. Only explicitly listed refs can change; unlisted orders are untouched');
  }

  // Test 3: Delivered orders are preserved
  {
    OrdersStore.clearDevStore();
    await OrdersStore.createOrder(
      createMockOrder({
        public_reference: 'MH-DELIVERED-1',
        status: 'delivered',
        payment_status: 'success',
        delivered_at: new Date().toISOString(),
      })
    );

    const report = await runPrelaunchCleanup({
      confirm: true,
      targetRefs: ['MH-DELIVERED-1'],
    });

    assert.strictEqual(report.skippedDeliveredCount, 1);
    assert.strictEqual(report.terminalizedCount, 0);

    const order = await OrdersStore.findOrder('MH-DELIVERED-1');
    assert.strictEqual(order?.status, 'delivered');
    console.log('✓ 3. Delivered orders are preserved and skipped');
  }

  // Test 4: Unrelated orders are completely preserved
  {
    OrdersStore.clearDevStore();
    const legitOrder = await OrdersStore.createOrder(
      createMockOrder({
        public_reference: 'MH-LEGIT-100',
        recipient_phone: '0209998888',
        network: 'telecel',
        status: 'submitted',
        payment_status: 'success',
      })
    );
    const staleTest = await OrdersStore.createOrder(
      createMockOrder({
        public_reference: 'MH-STALE-TEST-1',
        recipient_phone: '0592066298',
        network: 'mtn',
        status: 'processing',
        payment_status: 'pending',
      })
    );

    await runPrelaunchCleanup({
      confirm: true,
      targetRefs: ['MH-STALE-TEST-1'],
    });

    const refreshedLegit = await OrdersStore.findOrder('MH-LEGIT-100');
    assert.strictEqual(refreshedLegit?.status, 'submitted');
    assert.strictEqual(refreshedLegit?.recipient_phone, '0209998888');

    const refreshedStale = await OrdersStore.findOrder('MH-STALE-TEST-1');
    assert.strictEqual(refreshedStale?.status, 'failed');
    console.log('✓ 4. Unrelated customer orders are untouched');
  }

  // Test 5: Stale fake processing order can be terminalized
  {
    OrdersStore.clearDevStore();
    await OrdersStore.createOrder(
      createMockOrder({
        public_reference: 'MH-STALE-PROC-1',
        status: 'processing',
        payment_status: 'pending',
      })
    );

    const report = await runPrelaunchCleanup({
      confirm: true,
      targetRefs: ['MH-STALE-PROC-1'],
    });

    assert.strictEqual(report.terminalizedCount, 1);
    const order = await OrdersStore.findOrder('MH-STALE-PROC-1');
    assert.strictEqual(order?.status, 'failed');
    assert.strictEqual(order?.failure_reason, 'Pre-launch test order closed during production cleanup.');
    console.log('✓ 5. Stale fake processing order terminalized with audit reason');
  }

  // Test 6: Terminalized MTN order no longer blocks findActiveMtnOrder()
  {
    OrdersStore.clearDevStore();
    const testPhone = '0592066298';

    await OrdersStore.createOrder(
      createMockOrder({
        public_reference: 'MH-BLOCKING-MTN-1',
        recipient_phone: testPhone,
        network: 'mtn',
        status: 'processing',
        payment_status: 'pending',
      })
    );

    // Initial check: Phone IS blocked
    const blockedBefore = await OrdersStore.findActiveMtnOrder(testPhone);
    assert.ok(blockedBefore, 'Order should be active and blocking');
    assert.strictEqual(blockedBefore.public_reference, 'MH-BLOCKING-MTN-1');

    // Run cleanup
    await runPrelaunchCleanup({
      confirm: true,
      targetRefs: ['MH-BLOCKING-MTN-1'],
    });

    // Check after: Phone is NO LONGER blocked
    const blockedAfter = await OrdersStore.findActiveMtnOrder(testPhone);
    assert.strictEqual(blockedAfter, null, 'Terminalized order must not block new purchases');
    console.log('✓ 6. Terminalized MTN order no longer blocks findActiveMtnOrder()');
  }

  // Test 7: Running script twice is safe / idempotent
  {
    OrdersStore.clearDevStore();
    await OrdersStore.createOrder(
      createMockOrder({
        public_reference: 'MH-IDEMPOTENT-1',
        status: 'processing',
        payment_status: 'pending',
      })
    );

    // Run 1
    const report1 = await runPrelaunchCleanup({
      confirm: true,
      targetRefs: ['MH-IDEMPOTENT-1'],
    });
    assert.strictEqual(report1.terminalizedCount, 1);

    // Run 2 (idem)
    const report2 = await runPrelaunchCleanup({
      confirm: true,
      targetRefs: ['MH-IDEMPOTENT-1'],
    });
    // Already in failed status, still handled safely
    const order = await OrdersStore.findOrder('MH-IDEMPOTENT-1');
    assert.strictEqual(order?.status, 'failed');
    console.log('✓ 7. Running cleanup twice is safe and idempotent');
  }

  // Test 8: Paid orders safety check
  {
    OrdersStore.clearDevStore();
    await OrdersStore.createOrder(
      createMockOrder({
        public_reference: 'MH-PAID-TEST-1',
        status: 'processing',
        payment_status: 'success',
        paid_at: new Date().toISOString(),
      })
    );

    // Without allowPaid, it must be skipped
    const reportWithoutAllow = await runPrelaunchCleanup({
      confirm: true,
      targetRefs: ['MH-PAID-TEST-1'],
      allowPaid: false,
    });
    assert.strictEqual(reportWithoutAllow.skippedPaidCount, 1);
    assert.strictEqual(reportWithoutAllow.terminalizedCount, 0);
    const orderStillProcessing = await OrdersStore.findOrder('MH-PAID-TEST-1');
    assert.strictEqual(orderStillProcessing?.status, 'processing');

    // With explicit allowPaid, it can be terminalized
    const reportWithAllow = await runPrelaunchCleanup({
      confirm: true,
      targetRefs: ['MH-PAID-TEST-1'],
      allowPaid: true,
    });
    assert.strictEqual(reportWithAllow.terminalizedCount, 1);
    const orderTerminalized = await OrdersStore.findOrder('MH-PAID-TEST-1');
    assert.strictEqual(orderTerminalized?.status, 'failed');
    console.log('✓ 8. Paid orders protected by default, terminalized only with explicit allowPaid');
  }

  // Test 9: Explicit delete mode
  {
    OrdersStore.clearDevStore();
    await OrdersStore.createOrder(
      createMockOrder({
        public_reference: 'MH-DELETE-1',
        status: 'pending_payment',
        payment_status: 'pending',
      })
    );

    const report = await runPrelaunchCleanup({
      confirm: true,
      action: 'delete',
      targetRefs: ['MH-DELETE-1'],
    });

    assert.strictEqual(report.deletedCount, 1);
    const deletedCheck = await OrdersStore.findOrder('MH-DELETE-1');
    assert.strictEqual(deletedCheck, null);
    console.log('✓ 9. Explicit delete action removes order from storage');
  }

  console.log('\n=== ALL 10 PRE-LAUNCH ORDER CLEANUP TESTS PASSED SUCCESSFULLY! ===\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
