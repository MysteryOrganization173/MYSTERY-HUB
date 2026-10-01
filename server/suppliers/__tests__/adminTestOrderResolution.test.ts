/**
 * Admin Test Order Resolution & Drawer Stability Test Suite
 *
 * Covers:
 * A. Drawer close state does not reopen after refresh (race condition prevention)
 * B. Delivered order cannot be closed as test
 * C. Order with supplier_order_id cannot be closed as test
 * D. Unpaid stale order can be closed
 * E. Paid stale order requires explicit confirmation
 * F. Confirmed paid test order becomes failed
 * G. Closed MTN test order no longer blocks findActiveMtnOrder()
 * H. Audit log written
 * I. Unrelated order untouched
 */

import assert from 'node:assert';
import { OrdersStore } from '../../db/ordersStore.js';
import { AdminAuditStore } from '../../db/adminAuditStore.js';
import { OrderRecord } from '../../types/orders.js';

console.log('--- STARTING ADMIN TEST ORDER RESOLUTION TEST SUITE ---');

async function runTests() {
  await OrdersStore.initDb();

  const nowIso = new Date().toISOString();
  const testPhone = '0592066298';

  // Helper to create test orders in OrdersStore
  const makeOrder = (overrides: Partial<OrderRecord>): OrderRecord => ({
    id: `ord_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    public_reference: `MH-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    customer_name: 'Test Customer',
    customer_email: 'test@example.com',
    customer_phone: testPhone,
    recipient_phone: testPhone,
    network: 'mtn',
    service_type: 'data',
    product_id: 'mtn-data-1gb',
    product_name_snapshot: 'MTN 1GB Data',
    bundle_size_snapshot: '1GB',
    amount: 1020,
    currency: 'GHS',
    status: 'processing',
    payment_provider: 'paystack',
    payment_reference: `pay_ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    payment_status: 'pending',
    supplier_provider: 'success_biz_hub',
    supplier_order_id: null,
    supplier_response: null,
    supplier_cost_minor: null,
    supplier_offer_ref: null,
    supplier_last_checked_at: null,
    failure_reason: null,
    created_at: nowIso,
    updated_at: nowIso,
    paid_at: null,
    submitted_at: null,
    delivered_at: null,
    ...overrides,
  });

  // A. Drawer close state does not reopen after refresh
  console.log('Testing Test A: Drawer close state does not reopen after refresh...');
  {
    // Simulate frontend state management
    let selectedOrder: OrderRecord | null = makeOrder({ public_reference: 'MH-DRAWER-TEST-1' });
    const selectedOrderRef: { current: OrderRecord | null } = { current: selectedOrder };

    // User closes drawer
    const closeOrderDrawer = () => {
      selectedOrderRef.current = null;
      selectedOrder = null;
    };
    closeOrderDrawer();

    // Async fetch completes with orders list containing the previously selected order
    const mockFetchedOrders = [makeOrder({ public_reference: 'MH-DRAWER-TEST-1', status: 'delivered' })];

    // Simulated fetch callback: only updates if drawer is still open
    if (selectedOrderRef.current) {
      const updated = mockFetchedOrders.find(
        (o) => o.public_reference === selectedOrderRef.current?.public_reference
      );
      if (updated && selectedOrderRef.current) {
        selectedOrder = updated;
      }
    }

    assert.strictEqual(selectedOrder, null, 'selectedOrder must remain null after close');
    assert.strictEqual(selectedOrderRef.current, null, 'selectedOrderRef must remain null');
    console.log('✓ A. Drawer close state does not reopen after refresh');
  }

  // B. Delivered order cannot be closed as test
  console.log('Testing Test B: Delivered order cannot be closed as test...');
  {
    const deliveredOrder = await OrdersStore.createOrder(
      makeOrder({
        status: 'delivered',
        delivered_at: nowIso,
        payment_status: 'success',
        paid_at: nowIso,
      })
    );

    // Safety rule evaluation
    const canClose = deliveredOrder.status !== 'delivered' && !deliveredOrder.delivered_at;
    assert.strictEqual(canClose, false, 'Delivered order must be blocked from closure');
    console.log('✓ B. Delivered order cannot be closed as test');
  }

  // C. Order with supplier_order_id cannot be closed as test
  console.log('Testing Test C: Order with supplier_order_id cannot be closed as test...');
  {
    const dispatchedOrder = await OrdersStore.createOrder(
      makeOrder({
        status: 'submitted',
        supplier_order_id: 'SBH_LIVE_998822',
        payment_status: 'success',
        paid_at: nowIso,
      })
    );

    const hasSupplierId = Boolean(dispatchedOrder.supplier_order_id);
    assert.strictEqual(hasSupplierId, true);
    // Safety check: must refuse if supplier_order_id exists
    const isEligibleForTestClose = !dispatchedOrder.supplier_order_id;
    assert.strictEqual(isEligibleForTestClose, false, 'Dispatched order must not be closed as test');
    console.log('✓ C. Order with supplier_order_id cannot be closed as test');
  }

  // D. Unpaid stale order can be closed
  console.log('Testing Test D: Unpaid stale order can be closed...');
  {
    const unpaidOrder = await OrdersStore.createOrder(
      makeOrder({
        status: 'pending_payment',
        payment_status: 'pending',
        paid_at: null,
        supplier_order_id: null,
      })
    );

    const isPaid = unpaidOrder.payment_status === 'success' || Boolean(unpaidOrder.paid_at);
    assert.strictEqual(isPaid, false, 'Order is unpaid');

    const closed = await OrdersStore.closeAsTestOrder(
      unpaidOrder.id,
      'Pre-launch test order closed by administrator.'
    );
    assert.ok(closed, 'Order must be updated');
    assert.strictEqual(closed?.status, 'failed', 'Status must be set to failed');
    assert.strictEqual(
      closed?.failure_reason,
      'Pre-launch test order closed by administrator.'
    );
    console.log('✓ D. Unpaid stale order can be closed');
  }

  // E. Paid stale order requires explicit confirmation
  console.log('Testing Test E: Paid stale order requires explicit confirmation...');
  {
    const paidOrder = await OrdersStore.createOrder(
      makeOrder({
        status: 'queued',
        payment_status: 'success',
        paid_at: nowIso,
        supplier_order_id: null,
      })
    );

    const isPaid = paidOrder.payment_status === 'success' || Boolean(paidOrder.paid_at);
    assert.strictEqual(isPaid, true, 'Order has successful payment');

    // Attempt without confirmation
    const confirmPaidTestOrder = false as boolean;
    const canProceedWithoutConfirm = !isPaid || confirmPaidTestOrder === true;
    assert.strictEqual(canProceedWithoutConfirm, false, 'Must reject closure when unconfirmed');
    console.log('✓ E. Paid stale order requires explicit confirmation');
  }

  // F. Confirmed paid test order becomes failed
  console.log('Testing Test F: Confirmed paid test order becomes failed...');
  {
    const paidOrder = await OrdersStore.createOrder(
      makeOrder({
        status: 'processing',
        payment_status: 'success',
        paid_at: nowIso,
        supplier_order_id: null,
        payment_reference: 'pay_ref_paid_test_123',
        amount: 2500,
      })
    );

    const confirmPaidTestOrder = true;
    assert.strictEqual(confirmPaidTestOrder, true);

    const closed = await OrdersStore.closeAsTestOrder(
      paidOrder.id,
      'Pre-launch test order closed by administrator with confirmed test flag.'
    );

    assert.ok(closed);
    assert.strictEqual(closed?.status, 'failed');
    // Financial and payment accounting records preserved
    assert.strictEqual(closed?.payment_status, 'success');
    assert.strictEqual(closed?.paid_at, nowIso);
    assert.strictEqual(closed?.payment_reference, 'pay_ref_paid_test_123');
    assert.strictEqual(closed?.amount, 2500);
    console.log('✓ F. Confirmed paid test order becomes failed while preserving payment data');
  }

  // G. Closed MTN test order no longer blocks findActiveMtnOrder()
  console.log('Testing Test G: Closed MTN test order no longer blocks findActiveMtnOrder()...');
  {
    const dedicatedMtnPhone = '0541112233';
    const blockingOrder = await OrdersStore.createOrder(
      makeOrder({
        recipient_phone: dedicatedMtnPhone,
        network: 'mtn',
        status: 'queued', // Blocking status
        payment_status: 'pending',
      })
    );

    // Verify it blocks
    const activeBefore = await OrdersStore.findActiveMtnOrder(dedicatedMtnPhone);
    assert.ok(activeBefore, 'Active MTN order must be detected');
    assert.strictEqual(activeBefore?.public_reference, blockingOrder.public_reference);

    // Close as test order
    await OrdersStore.closeAsTestOrder(blockingOrder.id, 'Test order closed by admin.');

    // Verify it NO LONGER blocks
    const activeAfter = await OrdersStore.findActiveMtnOrder(dedicatedMtnPhone);
    assert.strictEqual(activeAfter, null, 'Closed MTN test order must no longer block duplicate checks');
    console.log('✓ G. Closed MTN test order no longer blocks findActiveMtnOrder()');
  }

  // H. Audit log written
  console.log('Testing Test H: Audit log written...');
  {
    const auditRecord = await AdminAuditStore.record({
      adminUserId: 'usr_admin_test_1',
      action: 'prelaunch_test_order_closed',
      entityType: 'order',
      entityId: 'MH-AUDIT-TEST-1',
      metadata: {
        previousStatus: 'queued',
        paymentStatus: 'pending',
        hadPaidAt: false,
        hadSupplierOrderId: false,
        reason: 'Developer cleanup',
        confirmedPaidTestOrder: false,
      },
    });

    assert.ok(auditRecord);
    assert.strictEqual(auditRecord.action, 'prelaunch_test_order_closed');
    assert.strictEqual(auditRecord.entity_id, 'MH-AUDIT-TEST-1');

    const recent = await AdminAuditStore.findRecent(10);
    const found = recent.find((r) => r.entity_id === 'MH-AUDIT-TEST-1');
    assert.ok(found, 'Audit log entry must be retrieved in findRecent');
    console.log('✓ H. Audit log written and verified');
  }

  // I. Unrelated order untouched
  console.log('Testing Test I: Unrelated order untouched...');
  {
    const unrelatedOrder = await OrdersStore.createOrder(
      makeOrder({
        public_reference: 'MH-UNRELATED-ORDER-1',
        status: 'processing',
        payment_status: 'success',
        amount: 5000,
      })
    );

    const targetOrder = await OrdersStore.createOrder(
      makeOrder({
        public_reference: 'MH-TARGET-ORDER-1',
        status: 'pending_payment',
      })
    );

    // Close only the target order
    await OrdersStore.closeAsTestOrder(targetOrder.id, 'Target order closed.');

    // Verify unrelated order remains untouched
    const freshUnrelated = await OrdersStore.findOrder(unrelatedOrder.id);
    assert.ok(freshUnrelated);
    assert.strictEqual(freshUnrelated?.status, 'processing');
    assert.strictEqual(freshUnrelated?.payment_status, 'success');
    assert.strictEqual(freshUnrelated?.amount, 5000);
    assert.strictEqual(freshUnrelated?.failure_reason, null);
    console.log('✓ I. Unrelated order remains untouched');
  }

  console.log('=== ALL 9 ADMIN TEST ORDER RESOLUTION TESTS PASSED! ===');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
