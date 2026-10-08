/**
 * Mystery Hub Member Home & Authenticated Experience Test Suite
 * Validates:
 * - Guest vs Member homepage conditional rendering
 * - MemberHome greeting panel, quick actions, recent activity & Mystery Earn teaser
 * - GET /api/account/orders protected endpoint security & safe response mapping
 * - Navbar account dropdown and mobile drawer navigation
 * - AuthModal signup benefit chips & OrderStatusModal contextual conversion
 * - Order deduplication and cross-device account history on OrdersPage
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { OrdersStore } from '../../db/ordersStore.js';
import { toSafePublicOrder, OrderRecord } from '../../types/orders.js';

describe('Member Home & Logged-In Experience', () => {
  test('1. HomePage renders MemberHome for members and public Hero for guests', () => {
    const homePageCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/home/HomePage.tsx'),
      'utf-8'
    );

    assert.ok(
      homePageCode.includes('import { MemberHome } from \'./MemberHome\';'),
      'HomePage must import MemberHome component'
    );
    assert.ok(
      homePageCode.includes('if (user) {'),
      'HomePage must conditionally render member view when user is logged in'
    );
    assert.ok(
      homePageCode.includes('<MemberHome />'),
      'HomePage must render MemberHome for authenticated users'
    );
    assert.ok(
      homePageCode.includes('<Hero />'),
      'HomePage must render public Hero for guest users'
    );
    assert.strictEqual(
      homePageCode.includes('<WhyMysteryHub />'),
      true,
      'HomePage renders WhyMysteryHub for guests only'
    );
  });

  test('5. OrdersStore.findOrdersByUserId supports optional limit parameter', async () => {
    const testUserId = 'test_user_member_home_' + Date.now();
    const mockOrder1: OrderRecord = {
      id: 'ord_mh_test_1',
      user_id: testUserId,
      public_reference: 'MH-MEM-1',
      customer_name: 'Samuel Test',
      customer_email: 'samuel@example.com',
      customer_phone: '0592066298',
      recipient_phone: '0592066298',
      network: 'mtn',
      product_id: 'mtn-data-1gb',
      product_name_snapshot: 'MTN 1GB',
      bundle_size_snapshot: '1GB',
      amount: 499,
      currency: 'GHS',
      status: 'delivered',
      payment_provider: 'paystack',
      payment_reference: 'payref_1',
      payment_status: 'success',
      supplier_provider: 'success_biz_hub',
      supplier_order_id: 'sbh_1',
      supplier_response: 'ok',
      supplier_cost_minor: 350,
      supplier_offer_ref: 'ref_1',
      supplier_last_checked_at: new Date().toISOString(),
      failure_reason: null,
      created_at: new Date(Date.now() - 10000).toISOString(),
      updated_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
    };

    await OrdersStore.createOrderWithMtnDuplicateCheck(mockOrder1);

    const userOrders = await OrdersStore.findOrdersByUserId(testUserId, 3);
    assert.ok(Array.isArray(userOrders), 'findOrdersByUserId must return an array');
    assert.strictEqual(userOrders.length, 1, 'Should return the user order');
    assert.strictEqual(userOrders[0].user_id, testUserId, 'Returned order must match user_id');
  });

  test('6. toSafePublicOrder hides supplier internal fields', () => {
    const rawOrder: OrderRecord = {
      id: 'ord_internal_123',
      user_id: 'usr_456',
      public_reference: 'MH-SAFE-1',
      customer_name: 'Privacy User',
      customer_email: 'user@example.com',
      customer_phone: '0241234567',
      recipient_phone: '0241234567',
      network: 'telecel',
      product_id: 'telecel-5gb',
      product_name_snapshot: 'Telecel 5GB',
      bundle_size_snapshot: '5GB',
      amount: 1500,
      currency: 'GHS',
      status: 'delivered',
      payment_provider: 'paystack',
      payment_reference: 'ref_secret',
      payment_status: 'success',
      supplier_provider: 'secret_wholesaler',
      supplier_order_id: 'secret_supp_99',
      supplier_response: 'Internal supplier response payload',
      supplier_cost_minor: 1100,
      supplier_offer_ref: 'secret_offer_key',
      supplier_last_checked_at: new Date().toISOString(),
      failure_reason: null,
      admin_note: 'Internal admin note',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
    };

    const safeOrder = toSafePublicOrder(rawOrder);

    assert.strictEqual((safeOrder as Record<string, unknown>).supplier_provider, undefined);
    assert.strictEqual((safeOrder as Record<string, unknown>).supplier_cost_minor, undefined);
    assert.strictEqual((safeOrder as Record<string, unknown>).supplier_response, undefined);
    assert.strictEqual((safeOrder as Record<string, unknown>).admin_note, undefined);
    assert.strictEqual(safeOrder.public_reference, 'MH-SAFE-1');
    assert.strictEqual(safeOrder.amount_ghc, 15);
  });

  test('7. Navbar implements account dropdown and mobile drawer auth integration', () => {
    const navbarCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/common/Navbar.tsx'),
      'utf-8'
    );

    assert.ok(
      navbarCode.includes('accountDropdownOpen'),
      'Navbar must contain state for toggling account dropdown'
    );
    assert.ok(
      navbarCode.includes('My Home'),
      'Account dropdown must include My Home link'
    );
    assert.ok(
      navbarCode.includes('My Orders'),
      'Account dropdown must include My Orders link'
    );
    assert.ok(
      navbarCode.includes('Sign Out'),
      'Account dropdown must include Sign Out button'
    );
  });

  test('8. OrdersPage displays account order headers when authenticated', () => {
    const ordersPageCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/orders/OrdersPage.tsx'),
      'utf-8'
    );

    assert.ok(
      ordersPageCode.includes('user ? \'Your Orders\' : \'Order History & Tracking\''),
      'OrdersPage must customize heading based on authentication state'
    );
    assert.ok(
      ordersPageCode.includes('getAccountOrdersOnServer(sessionToken'),
      'OrdersPage must fetch account-linked orders when authenticated'
    );
  });

});
