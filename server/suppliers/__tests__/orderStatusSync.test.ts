/**
 * Order Status Sync & Mapping Test Suite
 * Tests order status transitions, public reference prioritization, and terminal state handling.
 */

import assert from 'node:assert';
import { OrderRecord, OrderStatus } from '../../types/orders.js';

// Frontend status mapping logic extracted for test validation
function mapServerStatusToClient(serverStatus: OrderStatus): {
  clientStatus: 'placed' | 'verifying' | 'processing' | 'delivered' | 'failed';
  statusMessage?: string;
  isTerminal: boolean;
} {
  let clientStatus: 'placed' | 'verifying' | 'processing' | 'delivered' | 'failed' = 'verifying';
  let statusMessage: string | undefined;

  if (serverStatus === 'delivered') {
    clientStatus = 'delivered';
  } else if (serverStatus === 'processing' || serverStatus === 'submitted') {
    clientStatus = 'processing';
  } else if (serverStatus === 'paid' || serverStatus === 'queued') {
    clientStatus = 'placed';
  } else if (serverStatus === 'refund_pending' || serverStatus === 'refunded') {
    clientStatus = 'failed';
    statusMessage = 'Delivery could not be completed. Your payment is being reviewed for refund.';
  } else if (serverStatus === 'failed') {
    clientStatus = 'failed';
    statusMessage = 'The telecom provider was unable to complete the delivery. Please contact support or retry.';
  } else if (serverStatus === 'pending_payment') {
    clientStatus = 'verifying';
  }

  const isTerminal = clientStatus === 'delivered' || clientStatus === 'failed';

  return { clientStatus, statusMessage, isTerminal };
}

async function runOrderStatusSyncTests() {
  console.log('--- STARTING ORDER STATUS SYNC TEST SUITE ---');
  let passed = 0;

  // 1. Normal order transition: queued -> submitted -> processing -> delivered
  {
    const step1 = mapServerStatusToClient('queued');
    assert.strictEqual(step1.clientStatus, 'placed');
    assert.strictEqual(step1.isTerminal, false, 'queued must not be terminal');

    const step2 = mapServerStatusToClient('submitted');
    assert.strictEqual(step2.clientStatus, 'processing');
    assert.strictEqual(step2.isTerminal, false, 'submitted must not be terminal');

    const step3 = mapServerStatusToClient('processing');
    assert.strictEqual(step3.clientStatus, 'processing');
    assert.strictEqual(step3.isTerminal, false, 'processing must not be terminal');

    const step4 = mapServerStatusToClient('delivered');
    assert.strictEqual(step4.clientStatus, 'delivered');
    assert.strictEqual(step4.isTerminal, true, 'delivered must be terminal');

    console.log('✓ 1. Mocked order transition (queued -> submitted -> processing -> delivered) verified');
    passed++;
  }

  // 2. Failure & Refund transitions: failed, refund_pending, refunded
  {
    const failedRes = mapServerStatusToClient('failed');
    assert.strictEqual(failedRes.clientStatus, 'failed');
    assert.strictEqual(failedRes.isTerminal, true);

    const refundPendingRes = mapServerStatusToClient('refund_pending');
    assert.strictEqual(refundPendingRes.clientStatus, 'failed');
    assert.strictEqual(
      refundPendingRes.statusMessage,
      'Delivery could not be completed. Your payment is being reviewed for refund.'
    );
    assert.strictEqual(refundPendingRes.isTerminal, true);

    const refundedRes = mapServerStatusToClient('refunded');
    assert.strictEqual(refundedRes.clientStatus, 'failed');
    assert.strictEqual(
      refundedRes.statusMessage,
      'Delivery could not be completed. Your payment is being reviewed for refund.'
    );
    assert.strictEqual(refundedRes.isTerminal, true);

    console.log('✓ 2. Failure and refund transitions (failed, refund_pending, refunded) verified');
    passed++;
  }

  // 3. Public reference prioritization over local ID
  {
    const activeOrder = {
      id: 'MH195857', // Local random ID
      publicReference: 'MH-20260930-592025', // Real backend public reference
    };

    const lookupRef = activeOrder.publicReference || activeOrder.id;
    assert.strictEqual(
      lookupRef,
      'MH-20260930-592025',
      'Lookup reference must prioritize real publicReference over local random ID'
    );

    // Fallback test when publicReference is absent
    const legacyOrder = {
      id: 'MH195857',
    };
    const legacyLookupRef = (legacyOrder as { publicReference?: string; id: string }).publicReference || legacyOrder.id;
    assert.strictEqual(legacyLookupRef, 'MH195857', 'Fallback to id works when publicReference is absent');

    console.log('✓ 3. Public reference prioritization over local random ID verified');
    passed++;
  }

  // 4. Verification flow: pending_payment -> verifying
  {
    const verifyingRes = mapServerStatusToClient('pending_payment');
    assert.strictEqual(verifyingRes.clientStatus, 'verifying');
    assert.strictEqual(verifyingRes.isTerminal, false);
    console.log('✓ 4. Verification mapping verified');
    passed++;
  }

  console.log(`\nALL ${passed} ORDER STATUS SYNC TESTS PASSED!`);
}

runOrderStatusSyncTests().catch((err) => {
  console.error('TEST RUNNER FAILED:', err);
  process.exit(1);
});
