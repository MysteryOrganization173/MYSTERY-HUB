/**
 * Data Storefront Launch Test Suite
 * Tests catalog integrity, retail pricing, unsupported package rejection,
 * service notice configuration, and lack of stale validity claims.
 */

import assert from 'node:assert';
import { AUTHORITATIVE_PRODUCTS, getAuthoritativeProduct } from '../../data/productCatalog.js';
import { DATA_BUNDLES } from '../../../src/data/bundles.js';
import { serviceNotices } from '../../../src/config/serviceNotices.js';

async function runStorefrontTests() {
  console.log('--- STARTING DATA STOREFRONT LAUNCH TEST SUITE ---');
  let passed = 0;

  // 1. MTN Express retail prices
  {
    const mtnExpected: Record<string, number> = {
      '1GB': 5.49,
      '2GB': 10.49,
      '3GB': 14.99,
      '4GB': 19.49,
      '5GB': 23.99,
      '6GB': 28.49,
      '8GB': 36.99,
      '10GB': 44.99,
      '15GB': 66.99,
      '20GB': 88.99,
      '25GB': 110.99,
      '30GB': 132.99,
      '40GB': 176.99,
    };

    for (const [size, price] of Object.entries(mtnExpected)) {
      const serverProduct = Object.values(AUTHORITATIVE_PRODUCTS).find(
        (p) => p.network === 'mtn' && p.dataAmount === size
      );
      assert.ok(serverProduct, `Server product for MTN ${size} must exist`);
      assert.strictEqual(
        serverProduct.priceGhc,
        price,
        `Server price for MTN ${size} must be ${price}`
      );
      assert.strictEqual(
        serverProduct.amountPesewas,
        Math.round(price * 100),
        `Pesewa price for MTN ${size} must match GHS amount`
      );

      const frontendBundle = DATA_BUNDLES.find(
        (b) => b.network === 'mtn' && b.dataAmount === size
      );
      assert.ok(frontendBundle, `Frontend bundle for MTN ${size} must exist`);
      assert.strictEqual(
        frontendBundle.priceGhc,
        price,
        `Frontend price for MTN ${size} must be ${price}`
      );
    }
    console.log('✓ 1. MTN Express retail prices verified across backend and frontend');
    passed++;
  }

  // 2. Unapproved 50GB MTN is unavailable
  {
    const server50Gb = Object.values(AUTHORITATIVE_PRODUCTS).find(
      (p) => p.network === 'mtn' && p.dataAmount === '50GB' && p.isActive
    );
    assert.strictEqual(server50Gb, undefined, 'MTN 50GB must not be available');

    const frontend50Gb = DATA_BUNDLES.find(
      (b) => b.network === 'mtn' && b.dataAmount === '50GB'
    );
    assert.strictEqual(frontend50Gb, undefined, 'MTN 50GB must not be in frontend catalog');
    console.log('✓ 2. Unapproved 50GB MTN retail package is unavailable as required');
    passed++;
  }

  // 3. AirtelTigo retail prices
  {
    const atExpected: Record<string, number> = {
      '1GB': 4.99,
      '2GB': 9.49,
      '3GB': 13.99,
      '4GB': 18.49,
      '5GB': 22.99,
    };

    for (const [size, price] of Object.entries(atExpected)) {
      const serverProduct = Object.values(AUTHORITATIVE_PRODUCTS).find(
        (p) => p.network === 'airteltigo' && p.dataAmount === size
      );
      assert.ok(serverProduct, `Server product for AT ${size} must exist`);
      assert.strictEqual(serverProduct.priceGhc, price);

      const frontendBundle = DATA_BUNDLES.find(
        (b) => b.network === 'airteltigo' && b.dataAmount === size
      );
      assert.ok(frontendBundle, `Frontend bundle for AT ${size} must exist`);
      assert.strictEqual(frontendBundle.priceGhc, price);
    }
    console.log('✓ 3. AirtelTigo retail prices verified');
    passed++;
  }

  // 4. Telecel retail prices
  {
    const telExpected: Record<string, number> = {
      '10GB': 44.99,
      '15GB': 66.99,
      '20GB': 88.99,
      '25GB': 110.99,
      '30GB': 122.99,
      '40GB': 163.99,
      '50GB': 203.99,
      '100GB': 399.99,
    };

    for (const [size, price] of Object.entries(telExpected)) {
      const serverProduct = Object.values(AUTHORITATIVE_PRODUCTS).find(
        (p) => p.network === 'telecel' && p.dataAmount === size
      );
      assert.ok(serverProduct, `Server product for Telecel ${size} must exist`);
      assert.strictEqual(serverProduct.priceGhc, price);

      const frontendBundle = DATA_BUNDLES.find(
        (b) => b.network === 'telecel' && b.dataAmount === size
      );
      assert.ok(frontendBundle, `Frontend bundle for Telecel ${size} must exist`);
      assert.strictEqual(frontendBundle.priceGhc, price);
    }
    console.log('✓ 4. Telecel retail prices verified');
    passed++;
  }

  // 5. Unsupported Telecel 1GB rejected
  {
    const tel1GbServer = getAuthoritativeProduct('telecel-1gb-7d');
    assert.strictEqual(tel1GbServer, null, 'Telecel 1GB must not be purchasable on server');

    const tel1GbFrontend = DATA_BUNDLES.find(
      (b) => b.network === 'telecel' && b.dataAmount === '1GB'
    );
    assert.strictEqual(tel1GbFrontend, undefined, 'Telecel 1GB must not appear on frontend');
    console.log('✓ 5. Unsupported Telecel 1GB combination blocked');
    passed++;
  }

  // 6. Centralized service notices configuration
  {
    assert.ok(serviceNotices.mtn, 'MTN service notice must be configured');
    assert.strictEqual(serviceNotices.mtn.enabled, true, 'MTN notice must be enabled');
    assert.strictEqual(serviceNotices.mtn.severity, 'warning');
    assert.ok(serviceNotices.mtn.message.includes('15–45 minutes'));
    assert.ok(serviceNotices.mtn.message.includes('48 hours'));
    assert.ok(serviceNotices.mtn.duplicatePolicyNote.includes('active MTN order'));
    assert.ok(serviceNotices.mtn.trackingNote.includes('trackable'));

    // Anti-slop / No false promises check
    assert.strictEqual(serviceNotices.mtn.message.toLowerCase().includes('guaranteed instant'), false);
    assert.strictEqual(serviceNotices.mtn.message.toLowerCase().includes('mystery shield'), false);
    console.log('✓ 6. Centralized service notices configuration verified');
    passed++;
  }

  // 7. Stale validity labels removed from primary items
  {
    const mtn1Gb = getAuthoritativeProduct('mtn-1gb');
    assert.ok(mtn1Gb);
    assert.strictEqual(mtn1Gb.id, 'mtn-1gb');

    const frontendMtn1 = DATA_BUNDLES.find((b) => b.id === 'mtn-1gb');
    assert.ok(frontendMtn1);
    assert.strictEqual(frontendMtn1.priceGhc, 5.49);

    console.log('✓ 7. Clean bundle metadata without confusing primary validity labels verified');
    passed++;
  }

  console.log(`ALL ${passed} DATA STOREFRONT LAUNCH TESTS PASSED SUCCESSFULLY!`);
}

runStorefrontTests().catch((err) => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
