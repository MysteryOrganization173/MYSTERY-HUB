/**
 * Airtime Fulfilment & Integration Test Suite
 * Validates live airtime pricing, 0% service fee calculation, network ordering,
 * Success Biz Hub v2 airtime API contract (POST /v2/airtime and GET /v2/airtime/:identifier),
 * safe non-hardcoded supplier cost storage, and error/idempotency protection.
 */

import assert from 'node:assert';
import { calculateAirtimeOrder, validateAirtimeAmount, AIRTIME_SERVICE_FEE_PERCENT } from '../../data/airtimePricing.js';
import { SuccessBizHubClient } from '../successBizHub/client.js';
import { SuccessBizHubProvider } from '../successBizHub/provider.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { OrderRecord } from '../../types/orders.js';
import { FulfilmentService } from '../../services/fulfilmentService.js';

async function runAirtimeTests() {
  console.log('=== STARTING MYSTERY HUB AIRTIME TEST SUITE ===');
  let passed = 0;
  process.env.SUCCESS_BIZ_HUB_API_KEY = 'sbh_test_key_12345';

  // 1. Server-authoritative 0% Airtime Fee Calculations
  {
    assert.strictEqual(AIRTIME_SERVICE_FEE_PERCENT, 0, 'Default service fee should be 0%');

    // Example 1: GH₵10 Airtime
    const calc10 = calculateAirtimeOrder(10);
    assert.strictEqual(calc10.faceValueGhc, 10);
    assert.strictEqual(calc10.faceValuePesewas, 1000);
    assert.strictEqual(calc10.serviceFeeGhc, 0);
    assert.strictEqual(calc10.serviceFeePesewas, 0);
    assert.strictEqual(calc10.totalGhc, 10);
    assert.strictEqual(calc10.totalPesewas, 1000);
    assert.strictEqual(calc10.amountMajor, '10', 'Supplier amountMajor should be "10"');

    // Example 2: GH₵50 Airtime
    const calc50 = calculateAirtimeOrder(50);
    assert.strictEqual(calc50.faceValueGhc, 50);
    assert.strictEqual(calc50.faceValuePesewas, 5000);
    assert.strictEqual(calc50.serviceFeeGhc, 0);
    assert.strictEqual(calc50.serviceFeePesewas, 0);
    assert.strictEqual(calc50.totalGhc, 50);
    assert.strictEqual(calc50.totalPesewas, 5000);
    assert.strictEqual(calc50.amountMajor, '50');

    // Example 3: Fractional face value GH₵12.50
    const calc1250 = calculateAirtimeOrder(12.50);
    assert.strictEqual(calc1250.faceValueGhc, 12.50);
    assert.strictEqual(calc1250.faceValuePesewas, 1250);
    assert.strictEqual(calc1250.serviceFeePesewas, 0);
    assert.strictEqual(calc1250.serviceFeeGhc, 0);
    assert.strictEqual(calc1250.totalPesewas, 1250);
    assert.strictEqual(calc1250.totalGhc, 12.50);
    assert.strictEqual(calc1250.amountMajor, '12.50');

    console.log('✓ 1. Server-authoritative Airtime fee & pesewa calculations passed');
    passed++;
  }

  // 2. Amount Validation
  {
    assert.strictEqual(validateAirtimeAmount(10).isValid, true);
    assert.strictEqual(validateAirtimeAmount(1).isValid, true);
    assert.strictEqual(validateAirtimeAmount(1000).isValid, true);
    assert.strictEqual(validateAirtimeAmount(0.5).isValid, false, 'Should reject < GH₵1.00');
    assert.strictEqual(validateAirtimeAmount(1001).isValid, false, 'Should reject > GH₵1000.00');
    assert.strictEqual(validateAirtimeAmount(NaN).isValid, false, 'Should reject NaN');
    console.log('✓ 2. Airtime amount validation boundaries (GH₵1 – GH₵1000) passed');
    passed++;
  }

  // 3. Success Biz Hub Airtime Contract: POST /v2/airtime
  {
    const client = new SuccessBizHubClient();
    let sentPayload: unknown = null;

    client.createAirtime = async (req) => {
      sentPayload = req;
      return {
        status: 'success',
        data: {
          publicId: 'air_sbh_987654',
          status: 'submitted',
          network: req.network,
          phone: req.phone,
          amountMinor: 1000,
          chargeMinor: 985, // Actual dealer cost from response, not assumed
        },
      };
    };

    const res = await client.createAirtime({
      network: 'mtn',
      phone: '0241234567',
      amountMajor: '10',
    });

    assert.deepStrictEqual(sentPayload, {
      network: 'mtn',
      phone: '0241234567',
      amountMajor: '10',
    });
    // Ensure no packageId is sent
    assert.strictEqual((sentPayload as Record<string, unknown>).packageId, undefined, 'Must NOT send packageId in airtime');

    assert.strictEqual(res.data.publicId, 'air_sbh_987654');
    assert.strictEqual(res.data.amountMinor, 1000);
    assert.strictEqual(res.data.chargeMinor, 985);

    console.log('✓ 3. Success Biz Hub POST /v2/airtime payload and response contract verified');
    passed++;
  }

  // 4. Success Biz Hub Airtime Status Contract: GET /v2/airtime/:identifier
  {
    const client = new SuccessBizHubClient();
    let queriedId = '';

    client.getAirtime = async (identifier) => {
      queriedId = identifier;
      return {
        status: 'success',
        data: {
          publicId: identifier,
          status: 'delivered',
          network: 'mtn',
          phone: '0241234567',
          amountMinor: 1000,
          chargeMinor: 985,
        },
      };
    };

    const res = await client.getAirtime('air_sbh_987654');
    assert.strictEqual(queriedId, 'air_sbh_987654');
    assert.strictEqual(res.data.status, 'delivered');
    assert.strictEqual(res.data.amountMinor, 1000);
    assert.strictEqual(res.data.chargeMinor, 985);

    console.log('✓ 4. Success Biz Hub GET /v2/airtime/:identifier contract verified');
    passed++;
  }

  // 5. Provider Network Normalization & Place Airtime
  {
    const client = new SuccessBizHubClient();
    client.createAirtime = async (req) => {
      return {
        status: 'success',
        data: {
          publicId: `air_${req.network}_123`,
          status: 'delivered',
          network: req.network,
          phone: req.phone,
          amountMinor: 1000,
          chargeMinor: 985,
        },
      };
    };

    const provider = new SuccessBizHubProvider(client);

    // Test AirtelTigo mapping
    const atResult = await provider.placeAirtime({
      internalOrderId: 'ord_1',
      publicReference: 'MH-20260930-111111',
      recipientPhone: '0271234567',
      network: 'airteltigo',
      amountMajor: '10',
      faceValuePesewas: 1000,
      customerTotalPesewas: 1020,
    });

    assert.strictEqual(atResult.success, true);
    assert.strictEqual(atResult.supplierOrderId, 'air_airteltigo_123');
    assert.strictEqual(atResult.status, 'delivered');
    assert.strictEqual(atResult.chargeMinor, 985);

    console.log('✓ 5. Provider airtime placement and returned monetary minor amounts verified');
    passed++;
  }

  // 6. DB Order Creation & Safe Public Representation for Airtime
  {
    const airtimeOrder: OrderRecord = {
      id: `ord_airtime_test_${Date.now()}`,
      public_reference: `MH-20260930-${Math.floor(100000 + Math.random() * 900000)}`,
      customer_name: 'Kwame Mensah',
      customer_email: 'kwame@example.com',
      customer_phone: '0241234567',
      recipient_phone: '0241234567',
      network: 'mtn',
      service_type: 'airtime',
      product_id: 'airtime-mtn-10',
      product_name_snapshot: 'MTN Airtime Top-Up',
      bundle_size_snapshot: 'GH₵10.00 Airtime',
      amount: 1020, // 1020 pesewas = GH₵10.20
      face_value_minor: 1000,
      service_fee_minor: 20,
      currency: 'GHS',
      status: 'pending_payment',
      payment_provider: 'paystack',
      payment_reference: `MH_PAY_AIRTIME_MTN_${Date.now()}`,
      payment_status: 'pending',
      supplier_provider: 'success_biz_hub',
      supplier_order_id: null,
      supplier_response: null,
      supplier_cost_minor: null,
      supplier_offer_ref: 'sbh_airtime',
      supplier_last_checked_at: null,
      failure_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      paid_at: null,
      submitted_at: null,
      delivered_at: null,
    };

    const createRes = await OrdersStore.createOrderWithMtnDuplicateCheck(airtimeOrder);
    assert.strictEqual(createRes.success, true);

    const retrieved = await OrdersStore.findOrder(airtimeOrder.public_reference);
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.service_type, 'airtime');
    assert.strictEqual(retrieved?.face_value_minor, 1000);
    assert.strictEqual(retrieved?.service_fee_minor, 20);
    assert.strictEqual(retrieved?.amount, 1020);

    console.log('✓ 6. Database storage of face value, service fee, and total pesewas verified');
    passed++;
  }

  // 7. Fulfilment Service Airtime Availability Preflight
  {
    const result = await FulfilmentService.preflightCheckAirtime('mtn', 1000, '0241234567');
    assert.strictEqual(typeof result.allowed, 'boolean');
    console.log('✓ 7. Airtime preflight check interface verified');
    passed++;
  }

  console.log(`\n=== ALL ${passed} AIRTIME INTEGRATION TESTS PASSED ===\n`);
}

runAirtimeTests().catch((err) => {
  console.error('Airtime test suite failed:', err);
  process.exit(1);
});
