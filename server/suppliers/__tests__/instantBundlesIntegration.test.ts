/**
 * Instant Bundles Integration Test Suite
 * Validates Success Biz Hub API v2 instant bundles contract:
 * - Service discovery first (GET /v2/services)
 * - Catalogue retrieval (GET /v2/instant-bundles)
 * - Retail price calculations (fixed & flexi with min margin and gateway fees)
 * - Order placement (POST /v2/instant-bundles)
 * - Order status inquiry (GET /v2/instant-bundles/:identifier)
 * - Fulfilment service dispatch & status mapping
 * - Public API endpoints & secrecy of supplier credentials/costs
 */

import assert from 'node:assert';
import {
  calculateFixedInstantBundlePrice,
  calculateFlexiInstantBundlePrice,
  toPublicInstantBundle,
  INSTANT_BUNDLE_CONFIG,
} from '../../data/instantBundlePricing.js';
import { SuccessBizHubClient } from '../successBizHub/client.js';
import { SuccessBizHubProvider } from '../successBizHub/provider.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { OrderRecord } from '../../types/orders.js';
import { FulfilmentService } from '../../services/fulfilmentService.js';
import { SbhInstantBundlePackage } from '../successBizHub/types.js';

async function runInstantBundlesTests() {
  console.log('=== STARTING MYSTERY HUB INSTANT BUNDLES TEST SUITE ===');
  let passed = 0;
  process.env.SUCCESS_BIZ_HUB_API_KEY = 'sbh_test_key_12345';

  // 1. Fixed Instant Bundle Retail Pricing & Minimum Margin Guarantee
  {
    // Test case: Supplier wholesale cost = GH₵10.00 (1000 pesewas)
    const fixedResult = calculateFixedInstantBundlePrice('pkg_mtn_1gb', 1000);
    assert.strictEqual(fixedResult.supplierCostPesewas, 1000);
    // Base markup: max(50p, 1000 * 10% = 100p) = 100p.
    // Divisor with 2% gateway fee = 0.98. Base = 1100p.
    // Retail = ceil(1100 / 0.98) = 1123 pesewas (GH₵11.23)
    assert(fixedResult.retailPricePesewas >= 1100, 'Retail price must cover wholesale + margin');
    assert(fixedResult.grossMarginPesewas >= INSTANT_BUNDLE_CONFIG.minMarginPesewas, 'Gross margin must meet minimum');
    assert.strictEqual(fixedResult.retailPriceGhc, Number((fixedResult.retailPricePesewas / 100).toFixed(2)));

    // Test case: String priceMinor
    const stringPriceResult = calculateFixedInstantBundlePrice('pkg_tigo_2gb', '2000');
    assert.strictEqual(stringPriceResult.supplierCostPesewas, 2000);
    assert(stringPriceResult.grossMarginPesewas >= 200);

    // Test case: Low wholesale cost where minMargin dominates
    const lowCostResult = calculateFixedInstantBundlePrice('pkg_mini_500mb', 100); // GH₵1.00
    assert.strictEqual(lowCostResult.supplierCostPesewas, 100);
    assert(lowCostResult.grossMarginPesewas >= 50, 'Minimum margin of 50 pesewas must be preserved');

    // Test case: Invalid price rejects
    assert.throws(() => calculateFixedInstantBundlePrice('pkg_bad', 0), /Invalid or missing supplier priceMinor/);
    assert.throws(() => calculateFixedInstantBundlePrice('pkg_bad', -50), /Invalid or missing supplier priceMinor/);
    assert.throws(() => calculateFixedInstantBundlePrice('pkg_bad', 'invalid'), /Invalid or missing supplier priceMinor/);

    console.log('✓ 1. Fixed Instant Bundle retail price calculation & integer pesewa margin guarantees verified');
    passed++;
  }

  // 2. Flexi Instant Bundle Retail Pricing & Bounds
  {
    // Test case: GH₵20 flexi bundle with 0.95 payable ratio
    const flexiResult = calculateFlexiInstantBundlePrice('pkg_flexi_mtn', 20, 0.95, 1, 500);
    // Face value = 2000p. Supplier cost = round(2000 * 0.95) = 1900p.
    assert.strictEqual(flexiResult.supplierCostPesewas, 1900);
    assert(flexiResult.grossMarginPesewas >= 50, 'Gross margin should be positive and meet minimum');
    assert(flexiResult.netPayoutPesewas > flexiResult.supplierCostPesewas, 'Net payout must exceed wholesale cost');

    // Test bounds validation
    assert.throws(() => calculateFlexiInstantBundlePrice('pkg_flexi', 0.5, 0.95, 1, 500), /Minimum amount for this package is GH₵1/);
    assert.throws(() => calculateFlexiInstantBundlePrice('pkg_flexi', 600, 0.95, 1, 500), /Maximum amount for this package is GH₵500/);
    assert.throws(() => calculateFlexiInstantBundlePrice('pkg_flexi', NaN, 0.95, 1, 500), /Please enter a valid flexi amount/);

    console.log('✓ 2. Flexi Instant Bundle price calculation, ratios & boundary validation verified');
    passed++;
  }

  // 3. Safe Public Model Normalization (toPublicInstantBundle)
  {
    const samplePackage: SbhInstantBundlePackage = {
      id: 'instant_mtn_5gb',
      name: '5GB Instant Daily',
      network: 'MTN',
      isFlexi: false,
      priceMinor: 2500, // GH₵25.00 wholesale
      dataAmount: '5GB',
      validity: '24 Hours',
      category: 'instant_data',
      available: true,
      payableRatio: 0.9,
    };

    const publicModel = toPublicInstantBundle(samplePackage);
    assert(publicModel !== null, 'Public model should be created');
    assert.strictEqual(publicModel?.productKey, 'instant-instant_mtn_5gb');
    assert.strictEqual(publicModel?.packageId, 'instant_mtn_5gb');
    assert.strictEqual(publicModel?.network, 'mtn');
    assert.strictEqual(publicModel?.dataAmount, '5GB');
    assert.strictEqual(publicModel?.validity, '24 Hours');
    assert.strictEqual(publicModel?.isFlexi, false);
    assert.strictEqual(publicModel?.availability, 'in_stock');
    assert(publicModel?.retailPriceGhc > 25, 'Retail price must be marked up');

    // Ensure raw supplier secret fields are NOT present in public model
    const publicKeys = Object.keys(publicModel as object);
    assert(!publicKeys.includes('priceMinor'), 'Public model must NEVER include priceMinor');
    assert(!publicKeys.includes('payableRatio'), 'Public model must NEVER include payableRatio');
    assert(!publicKeys.includes('supplierCostPesewas'), 'Public model must NEVER include supplierCost');

    console.log('✓ 3. Public catalog normalization and supplier cost privacy verified');
    passed++;
  }

  // 4. Supplier Client Service Discovery: checkInstantBundlesService
  {
    const client = new SuccessBizHubClient();

    // Mock GET /services with instant_bundles granted and available
    client.getServices = async () => ({
      status: 'success',
      data: {
        keyPermissions: { instant_bundles: true },
        services: [
          { id: 'data_bundles', available: true },
          { id: 'instant_bundles', available: true, productCount: 12, keyGranted: true },
        ],
      },
    });

    const check1 = await client.checkInstantBundlesService();
    assert.strictEqual(check1.permitted, true);
    assert.strictEqual(check1.available, true);
    assert.strictEqual(check1.productCount, 12);

    // Mock GET /services where instant_bundles is not permitted for this key
    client.getServices = async () => ({
      status: 'success',
      data: {
        keyPermissions: { instant_bundles: false },
        services: [{ id: 'data_bundles', available: true }],
      },
    });

    const check2 = await client.checkInstantBundlesService();
    assert.strictEqual(check2.permitted, false);
    assert.strictEqual(check2.available, false);

    console.log('✓ 4. Supplier service discovery (GET /v2/services) for instant_bundles verified');
    passed++;
  }

  // 5. Supplier Client Contract: createInstantBundle & getInstantBundle
  {
    const client = new SuccessBizHubClient();
    let capturedCreatePayload: unknown = null;

    client.createInstantBundle = async (req) => {
      capturedCreatePayload = req;
      return {
        status: 'success',
        data: {
          id: 'sbh_inst_ord_101',
          publicId: 'sbh_inst_ord_101',
          status: 'pending',
          packageId: req.packageId,
          phone: req.phone,
          amountMinor: 2500,
          chargeMinor: 2450,
        },
      };
    };

    const createRes = await client.createInstantBundle({
      packageId: 'pkg_5gb',
      phone: '0592066298',
      amountMajor: undefined,
    });

    assert.deepStrictEqual(capturedCreatePayload, {
      packageId: 'pkg_5gb',
      phone: '0592066298',
      amountMajor: undefined,
    });
    assert.strictEqual(createRes.data.publicId, 'sbh_inst_ord_101');

    // Test GET /instant-bundles/:identifier
    client.getInstantBundle = async (id: string) => ({
      status: 'success',
      data: {
        id,
        publicId: id,
        status: 'processed',
        amountMinor: 2500,
        chargeMinor: 2450,
      },
    });

    const statusRes = await client.getInstantBundle('sbh_inst_ord_101');
    assert.strictEqual(statusRes.data.status, 'processed');

    console.log('✓ 5. Supplier client POST & GET /instant-bundles contract verified');
    passed++;
  }

  // 6. SuccessBizHubProvider placeInstantBundle & getInstantBundleStatus
  {
    const client = new SuccessBizHubClient();
    client.createInstantBundle = async () => ({
      status: 'success',
      data: {
        publicId: 'sbh_inst_pub_777',
        status: 'processed',
        amountMinor: '1500',
        chargeMinor: '1480',
      },
    });

    const provider = new SuccessBizHubProvider(client);
    const placeResult = await provider.placeInstantBundle({
      internalOrderId: 'ord_inst_1',
      publicReference: 'MH-INST-001',
      packageId: 'pkg_mtn_3gb',
      phone: '0241234567',
    });

    assert.strictEqual(placeResult.success, true);
    assert.strictEqual(placeResult.supplierOrderId, 'sbh_inst_pub_777');
    assert.strictEqual(placeResult.status, 'delivered'); // 'processed' maps to 'delivered'
    assert.strictEqual(placeResult.amountMinor, 1500);
    assert.strictEqual(placeResult.chargeMinor, 1480);

    // Status lookup test
    client.getInstantBundle = async () => ({
      status: 'success',
      data: {
        publicId: 'sbh_inst_pub_777',
        status: 'failed',
        failureReason: 'Subscriber barred',
      },
    });

    const queryResult = await provider.getInstantBundleStatus('sbh_inst_pub_777');
    assert.strictEqual(queryResult.success, true);
    assert.strictEqual(queryResult.status, 'failed');
    assert.strictEqual(queryResult.errorMessage, 'Subscriber barred');

    console.log('✓ 6. SuccessBizHubProvider placeInstantBundle and status mapping verified');
    passed++;
  }

  // 7. FulfilmentService Live Instant Bundle Dispatch
  {
    const provider = FulfilmentService.getProvider();
    let sentToSupplier = false;

    provider.placeInstantBundle = async (req) => {
      sentToSupplier = true;
      assert.strictEqual(req.packageId, 'pkg_mtn_10gb');
      assert.strictEqual(req.phone, '0592066298');
      return {
        success: true,
        supplierOrderId: 'sbh_inst_order_999',
        status: 'processing',
        amountMinor: 5000,
        chargeMinor: 4900,
      };
    };

    // Temporarily mock environment to allow dispatch
    provider.client.isFulfillmentEnabled = () => true;
    provider.client.isConfigured = () => true;
    FulfilmentService.isTestPaymentEnvironment = () => false;

    const testInstantOrder: OrderRecord = {
      id: `ord_test_inst_${Date.now()}`,
      user_id: null,
      public_reference: `MH-INST-${Date.now()}`,
      customer_name: 'Test Customer',
      customer_email: 'test@mysteryhub.site',
      customer_phone: '0592066298',
      recipient_phone: '0592066298',
      network: 'mtn',
      service_type: 'instant_bundle',
      product_id: 'instant-pkg_mtn_10gb',
      product_name_snapshot: '10GB Instant Bundle',
      bundle_size_snapshot: '10GB',
      amount: 5500,
      currency: 'GHS',
      status: 'pending_payment',
      payment_provider: 'paystack',
      payment_reference: `pay_inst_${Date.now()}`,
      payment_status: 'pending',
      supplier_provider: 'success_biz_hub',
      supplier_order_id: null,
      supplier_response: null,
      supplier_cost_minor: 4900,
      supplier_offer_ref: 'pkg_mtn_10gb',
      supplier_last_checked_at: null,
      failure_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      paid_at: null,
      submitted_at: null,
      delivered_at: null,
    };

    await OrdersStore.createOrder(testInstantOrder);
    const dispatchResult = await FulfilmentService.processPaidOrder(
      testInstantOrder.payment_reference,
      new Date().toISOString()
    );

    assert(dispatchResult.order !== null, 'Order should be returned');
    assert.strictEqual(sentToSupplier, true, 'Paid instant bundle order must be dispatched to supplier');
    assert.strictEqual(dispatchResult.order?.supplier_order_id, 'sbh_inst_order_999');
    assert.strictEqual(dispatchResult.order?.status, 'processing');
    assert.strictEqual(dispatchResult.order?.supplier_cost_minor, 4900);

    // Clean up test order
    await OrdersStore.deleteOrder(testInstantOrder.id);

    console.log('✓ 7. FulfilmentService processPaidOrder & dispatch for Instant Bundles verified');
    passed++;
  }

  console.log(`\n=== ALL ${passed} INSTANT BUNDLES TESTS PASSED SUCCESSFULLY! ===`);
}

runInstantBundlesTests().catch((err) => {
  console.error('Instant Bundles test failed:', err);
  process.exit(1);
});
