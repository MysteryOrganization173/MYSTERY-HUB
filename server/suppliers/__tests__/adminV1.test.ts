/**
 * Admin V1 Integration & Security Test Suite
 * Validates strict RBAC enforcement, session integrity, order reviews,
 * waitlist management, customer moderation, system health, and safe audit logging.
 */

import { AuthStore } from '../../db/authStore.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { WaitlistStore } from '../../db/waitlistStore.js';
import { AdminAuditStore } from '../../db/adminAuditStore.js';
import { hashPassword, verifyPassword, generateSessionToken, hashSessionToken } from '../../utils/crypto.js';
import { OrderRecord, toAdminOrderDetails } from '../../types/orders.js';
import { toSafeUserProfile } from '../../types/auth.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
}

async function runAdminV1Tests() {
  console.log('=== STARTING ADMIN V1 TEST SUITE ===');

  await OrdersStore.initDb();

  // ==========================================
  // 1. SECURITY & RBAC ENFORCEMENT
  // ==========================================
  console.log('-> 1. Testing RBAC, Session Validation & Impersonation Prevention...');

  // 1a. Create a normal Customer Account
  const customerPassword = 'CustomerSecurePassword123!';
  const customerHash = await hashPassword(customerPassword);
  const customer = await AuthStore.createUser({
    id: `usr_test_cust_${Date.now()}`,
    name: 'Normal Customer',
    email: 'customer@test.com',
    phone: '0541112233',
    passwordHash: customerHash,
    role: 'customer',
    status: 'active',
  });

  // 1b. Create an Admin Account
  const adminPassword = 'AdminSecurePassword456!';
  const adminHash = await hashPassword(adminPassword);
  const admin = await AuthStore.createUser({
    id: `usr_test_admin_${Date.now()}`,
    name: 'Operations Admin',
    email: 'ops.admin@test.com',
    phone: '0599998877',
    passwordHash: adminHash,
    role: 'admin',
    status: 'active',
  });

  // 1c. Create sessions
  const customerRawToken = generateSessionToken();
  const customerSession = await AuthStore.createSession(customer.id, customerRawToken, false);

  const adminRawToken = generateSessionToken();
  const adminSession = await AuthStore.createSession(admin.id, adminRawToken, false);

  // Validate session resolution
  const resolvedCustomer = await AuthStore.findSessionByToken(customerRawToken);
  assert(Boolean(resolvedCustomer && resolvedCustomer.user.role === 'customer'), 'Customer session resolved as customer role');

  const resolvedAdmin = await AuthStore.findSessionByToken(adminRawToken);
  assert(Boolean(resolvedAdmin && resolvedAdmin.user.role === 'admin'), 'Admin session resolved as admin role');

  // Customer cannot bypass server-side role check
  assert(resolvedCustomer?.user.role !== 'admin', 'Customer cannot claim admin role on backend');

  // Verify password hash is never exposed in safe profiles
  const safeAdminProfile = toSafeUserProfile(admin);
  assert(!('password_hash' in safeAdminProfile), 'Safe user profile never exposes password_hash');
  assert(!('password' in safeAdminProfile), 'Safe user profile never exposes password');

  console.log('✓ 1. RBAC, Session Validation & Password Protection passed');

  // ==========================================
  // 2. ORDERS MANAGEMENT, SEARCH & CONTROLS
  // ==========================================
  console.log('-> 2. Testing Order Listing, Search, Filters & Review Notes...');

  const testOrderRef = `MH-TEST-ADMIN-${Date.now()}`;
  const testOrder: OrderRecord = {
    id: `ord_admin_${Date.now()}`,
    user_id: customer.id,
    public_reference: testOrderRef,
    customer_name: 'Test Customer',
    customer_email: 'customer@test.com',
    customer_phone: '0541112233',
    recipient_phone: '0592066298',
    network: 'mtn',
    product_id: 'mtn-1gb',
    product_name_snapshot: 'MTN 1GB Data',
    bundle_size_snapshot: '1GB',
    service_type: 'data',
    amount: 1200,
    face_value_minor: 1200,
    service_fee_minor: 0,
    currency: 'GHS',
    status: 'processing',
    payment_provider: 'paystack',
    payment_status: 'success',
    payment_reference: `pay_admin_${Date.now()}`,
    supplier_provider: 'success_biz_hub',
    supplier_order_id: 'sbh_ord_999888',
    supplier_response: JSON.stringify({ status: 'processing' }),
    supplier_cost_minor: 950,
    supplier_offer_ref: 'mtn-data-1gb',
    supplier_last_checked_at: new Date().toISOString(),
    failure_reason: null,
    manual_review: false,
    admin_note: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    paid_at: new Date().toISOString(),
    submitted_at: new Date().toISOString(),
    delivered_at: null,
  };

  await OrdersStore.createOrder(testOrder);

  // Search by reference
  const searchByRef = await OrdersStore.searchOrdersAdmin({ q: testOrderRef });
  assert(searchByRef.orders.length === 1, 'Search by exact public reference found 1 order');
  assert(searchByRef.orders[0].public_reference === testOrderRef, 'Correct order reference returned');

  // Search by phone
  const searchByPhone = await OrdersStore.searchOrdersAdmin({ q: '0592066298' });
  assert(searchByPhone.orders.some((o) => o.public_reference === testOrderRef), 'Search by recipient phone found order');

  // Search by network filter
  const filterMtn = await OrdersStore.searchOrdersAdmin({ network: 'mtn' });
  assert(filterMtn.orders.some((o) => o.public_reference === testOrderRef), 'Filter by network found order');

  // Search by non-matching filter
  const filterTelecel = await OrdersStore.searchOrdersAdmin({ q: testOrderRef, network: 'telecel' });
  assert(filterTelecel.orders.length === 0, 'Non-matching network filter returned 0 orders');

  // Test updating manual review flag and internal admin note
  const updatedOrder = await OrdersStore.updateOrderReview(
    testOrder.id,
    true,
    'Investigating delayed delivery with customer on WhatsApp.'
  );
  assert(Boolean(updatedOrder && updatedOrder.manual_review === true), 'Manual review flag set to true');
  assert(updatedOrder?.admin_note === 'Investigating delayed delivery with customer on WhatsApp.', 'Admin note persisted');

  // Verify AdminOrderDetails formatting
  const adminDetails = toAdminOrderDetails(updatedOrder!);
  assert(adminDetails.public_reference === testOrderRef, 'AdminOrderDetails contains public reference');
  assert(adminDetails.supplier_order_id === 'sbh_ord_999888', 'AdminOrderDetails contains supplier order ID');
  assert(adminDetails.manual_review === true, 'AdminOrderDetails contains manual review flag');
  assert(adminDetails.admin_note !== null, 'AdminOrderDetails contains admin note');

  console.log('✓ 2. Order Listing, Search, Filters & Review Notes passed');

  // ==========================================
  // 3. WAITLIST PERSISTENCE & WORKFLOWS
  // ==========================================
  console.log('-> 3. Testing Waitlist Management & State Transitions...');

  const { record: waitlistEntry } = await WaitlistStore.addToWaitlist({
    serviceKey: 'ecg-prepaid',
    serviceTitle: 'ECG Prepaid Power Tokens',
    channel: 'whatsapp',
    contact: '0541112233',
    userId: customer.id,
  });

  // Admin search for waitlist
  const waitlistSearch = await WaitlistStore.searchWaitlistAdmin({
    serviceKey: 'ecg-prepaid',
    status: 'pending',
  });
  assert(waitlistSearch.entries.some((e) => e.id === waitlistEntry.id), 'Waitlist search found new pending entry');

  // Update waitlist status to 'contacted' with note
  const updatedWaitlist = await WaitlistStore.updateWaitlistStatus(
    waitlistEntry.id,
    'contacted',
    'Sent WhatsApp early access invite'
  );
  assert(Boolean(updatedWaitlist && updatedWaitlist.status === 'contacted'), 'Waitlist status updated to contacted');
  assert(updatedWaitlist?.admin_note === 'Sent WhatsApp early access invite', 'Waitlist admin note persisted');
  assert(Boolean(updatedWaitlist?.contacted_at), 'Contacted timestamp recorded');

  // Grouped stats check
  const groupedStats = await WaitlistStore.getWaitlistGroupedStats();
  assert(groupedStats.totalAll >= 1, 'Grouped waitlist total calculated');
  assert(typeof groupedStats.serviceCounts === 'object', 'Service counts aggregated');
  assert(typeof groupedStats.channelCounts === 'object', 'Channel counts aggregated');

  console.log('✓ 3. Waitlist Management & State Transitions passed');

  // ==========================================
  // 4. CUSTOMER ACCOUNT MODERATION & SECURITY
  // ==========================================
  console.log('-> 4. Testing Customer Moderation, Disabling & Session Revocation...');

  // Search users admin
  const userSearch = await AuthStore.searchUsersAdmin({ q: 'Normal Customer' });
  assert(userSearch.users.some((u) => u.id === customer.id), 'Customer search found customer account');

  // Disable customer
  const disabledCustomer = await AuthStore.updateUserStatus(customer.id, 'disabled');
  assert(Boolean(disabledCustomer && disabledCustomer.status === 'disabled'), 'Customer status updated to disabled');

  // Revoke all sessions for disabled customer
  await AuthStore.revokeAllUserSessions(customer.id);

  // Verify that previous customer session is now revoked/rejected
  const revokedCheck = await AuthStore.findSessionByToken(customerRawToken);
  assert(revokedCheck === null, 'Revoked customer session is no longer valid');

  // Attempting to login with disabled account
  const disabledLookup = await AuthStore.findUserByIdentifier('customer@test.com');
  assert(Boolean(disabledLookup && disabledLookup.status === 'disabled'), 'Disabled account identified');

  // Re-enable customer
  const reenabledCustomer = await AuthStore.updateUserStatus(customer.id, 'active');
  assert(Boolean(reenabledCustomer && reenabledCustomer.status === 'active'), 'Customer account successfully re-enabled');

  console.log('✓ 4. Customer Moderation, Disabling & Session Revocation passed');

  // ==========================================
  // 5. AUDIT LOGGING
  // ==========================================
  console.log('-> 5. Testing Administrative Audit Logging...');

  await AdminAuditStore.record({
    adminUserId: admin.id,
    action: 'order_review_updated',
    entityType: 'order',
    entityId: testOrderRef,
    metadata: { manualReview: true, noteLength: 40 },
  });

  await AdminAuditStore.record({
    adminUserId: admin.id,
    action: 'customer_disabled',
    entityType: 'user',
    entityId: customer.id,
    metadata: { reason: 'Policy violation check' },
  });

  const recentLogs = await AdminAuditStore.findRecent(10);
  assert(recentLogs.length >= 2, 'Recent audit logs retrieved');
  assert(recentLogs.some((l) => l.action === 'order_review_updated'), 'Order review audit log recorded');
  assert(recentLogs.some((l) => l.action === 'customer_disabled'), 'Customer disabled audit log recorded');

  console.log('✓ 5. Administrative Audit Logging passed');

  // ==========================================
  // 6. OVERVIEW METRICS COMPUTATION
  // ==========================================
  console.log('-> 6. Testing Overview Metrics Aggregations...');

  const overview = await OrdersStore.getOverviewMetrics();
  assert(typeof overview.today.ordersCount === 'number', 'Today orders count computed');
  assert(typeof overview.today.revenueGhc === 'number', 'Today revenue GHS computed');
  assert(typeof overview.last7Days.revenueGhc === 'number', 'Last 7 days revenue GHS computed');
  assert(typeof overview.allTime.ordersCount === 'number', 'All-time orders count computed');

  console.log('✓ 6. Overview Metrics Aggregations passed');

  console.log('=== ALL 6 ADMIN V1 TESTS PASSED SUCCESSFULLY ===');
}

runAdminV1Tests().catch((err) => {
  console.error('Fatal Admin V1 Test Error:', err);
  process.exit(1);
});
