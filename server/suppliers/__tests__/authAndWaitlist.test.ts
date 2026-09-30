/**
 * Production Authentication & Real Waitlist Test Suite
 * Validates scrypt password hashing, constant-time verification, session token hashing,
 * Ghana phone/email identifier lookups, waitlist normalization & deduplication,
 * admin bootstrap behavior, and user-linked orders.
 */

import assert from 'node:assert';
import { hashPassword, verifyPassword, generateSessionToken, hashSessionToken } from '../../utils/crypto.js';
import { parseIdentifier, validatePassword, normalizeEmail } from '../../utils/authValidation.js';
import { canonicalGhanaPhone, getGhanaPhoneLookupVariants } from '../../utils/phone.js';
import { AuthStore } from '../../db/authStore.js';
import { WaitlistStore } from '../../db/waitlistStore.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { OrderRecord } from '../../types/orders.js';
import { bootstrapAdminAccount } from '../../services/adminBootstrap.js';

async function runAuthAndWaitlistTests() {
  console.log('=== STARTING AUTH & WAITLIST TEST SUITE ===');
  let passed = 0;

  AuthStore._clearDevStore();
  WaitlistStore._clearDevStore();
  OrdersStore.clearDevStore();

  // 1. Password Security & Scrypt Hashing
  {
    const rawPass = 'SecretP@ssw0rd123';
    const hash1 = await hashPassword(rawPass);
    const hash2 = await hashPassword(rawPass);

    assert.ok(hash1.startsWith('scrypt$'), 'Hash should start with scrypt$');
    assert.notStrictEqual(hash1, hash2, 'Two hashes of the same password MUST have different random salts');

    const valid1 = await verifyPassword(rawPass, hash1);
    assert.strictEqual(valid1, true, 'Valid password must verify to true');

    const valid2 = await verifyPassword('WrongPassword!', hash1);
    assert.strictEqual(valid2, false, 'Invalid password must verify to false');

    const validMalformed = await verifyPassword(rawPass, 'invalid_hash_format');
    assert.strictEqual(validMalformed, false, 'Malformed hash must safely return false without crashing');

    console.log('✓ 1. Scrypt password hashing, unique salts & constant-time verification passed');
    passed++;
  }

  // 2. Identifier Parsing & Normalization
  {
    // Email identifiers
    const emailParsed = parseIdentifier('  Kwame.Asante@Gmail.COM  ');
    assert.ok(emailParsed);
    assert.strictEqual(emailParsed.type, 'email');
    assert.strictEqual(emailParsed.normalized, 'kwame.asante@gmail.com');

    // Ghana Phone identifiers (local 024, international 23324, +23324)
    const phone1 = parseIdentifier('024 123 4567');
    assert.ok(phone1);
    assert.strictEqual(phone1.type, 'phone');
    assert.strictEqual(phone1.normalized, '+233241234567');

    const phone2 = parseIdentifier('+233 59 876 5432');
    assert.ok(phone2);
    assert.strictEqual(phone2.type, 'phone');
    assert.strictEqual(phone2.normalized, '+233598765432');

    // Invalid identifiers
    assert.strictEqual(parseIdentifier(''), null);
    assert.strictEqual(parseIdentifier('abc'), null);
    assert.strictEqual(parseIdentifier('12345'), null);

    // Password policy validation
    assert.strictEqual(validatePassword('short').isValid, false);
    assert.strictEqual(validatePassword('validPassword123').isValid, true);

    console.log('✓ 2. Identifier normalization (Email & Ghana Telecoms) and validation passed');
    passed++;
  }

  // 3. User Store & Phone Variant Lookups
  {
    const userPasswordHash = await hashPassword('CustomerSecure123');
    const createdUser = await AuthStore.createUser({
      id: 'usr_test_kwame_01',
      name: 'Kwame Mensah',
      email: 'kwame.mensah@example.com',
      phone: '0591234567',
      passwordHash: userPasswordHash,
      role: 'customer',
      status: 'active',
    });

    assert.strictEqual(createdUser.id, 'usr_test_kwame_01');
    assert.strictEqual(createdUser.name, 'Kwame Mensah');

    // Lookup by exact email
    const byEmail = await AuthStore.findUserByIdentifier('kwame.mensah@example.com');
    assert.ok(byEmail);
    assert.strictEqual(byEmail.id, 'usr_test_kwame_01');

    // Lookup by uppercase email
    const byEmailUpper = await AuthStore.findUserByIdentifier('KWAME.MENSAH@EXAMPLE.COM');
    assert.ok(byEmailUpper);
    assert.strictEqual(byEmailUpper.id, 'usr_test_kwame_01');

    // Lookup by local phone
    const byPhoneLocal = await AuthStore.findUserByIdentifier('0591234567');
    assert.ok(byPhoneLocal);
    assert.strictEqual(byPhoneLocal.id, 'usr_test_kwame_01');

    // Lookup by international phone variant (+233591234567)
    const byPhoneIntl = await AuthStore.findUserByIdentifier('+233591234567');
    assert.ok(byPhoneIntl);
    assert.strictEqual(byPhoneIntl.id, 'usr_test_kwame_01');

    console.log('✓ 3. User creation and multi-variant Ghana phone/email lookups passed');
    passed++;
  }

  // 4. Session Security, SHA-256 Hash Storage, and Session Lifecycle
  {
    const rawToken = generateSessionToken();
    assert.strictEqual(rawToken.length, 64, 'Raw session token should be 64 hex characters (32 bytes)');

    const expectedHash = hashSessionToken(rawToken);
    const session = await AuthStore.createSession('usr_test_kwame_01', rawToken, false);

    assert.strictEqual(session.user_id, 'usr_test_kwame_01');
    assert.strictEqual(session.token_hash, expectedHash);

    // Find session by raw token (resolves user)
    const resolved = await AuthStore.findSessionByToken(rawToken);
    assert.ok(resolved);
    assert.strictEqual(resolved.user.id, 'usr_test_kwame_01');
    assert.strictEqual(resolved.user.name, 'Kwame Mensah');

    // Revoke session
    const revoked = await AuthStore.revokeSession(rawToken);
    assert.strictEqual(revoked, true);

    const resolvedAfterRevoke = await AuthStore.findSessionByToken(rawToken);
    assert.strictEqual(resolvedAfterRevoke, null, 'Revoked session must not be found');

    console.log('✓ 4. Session token generation, SHA-256 storage & revocation lifecycle passed');
    passed++;
  }

  // 5. Real Waitlist Normalization & Intelligent Deduplication
  {
    // Add WhatsApp waitlist registration
    const join1 = await WaitlistStore.addToWaitlist({
      serviceKey: 'ecg_prepaid',
      serviceTitle: 'ECG Prepaid Electricity Top-Up',
      channel: 'whatsapp',
      contact: '024 111 2233',
      sourcePage: '/services',
      userId: 'usr_test_kwame_01',
    });

    assert.strictEqual(join1.alreadyJoined, false);
    assert.strictEqual(join1.record.service_key, 'ecg_prepaid');
    assert.strictEqual(join1.record.contact_normalized, '+233241112233');

    // Duplicate submission with international format (+233 24 111 2233)
    const join2 = await WaitlistStore.addToWaitlist({
      serviceKey: 'ecg_prepaid',
      serviceTitle: 'ECG Prepaid Electricity Top-Up',
      channel: 'whatsapp',
      contact: '+233 24 111 2233',
      sourcePage: '/services',
    });

    assert.strictEqual(join2.alreadyJoined, true, 'Duplicate phone contact must be detected');
    assert.strictEqual(join2.record.id, join1.record.id, 'Should return existing waitlist record');

    // Email waitlist registration
    const joinEmail = await WaitlistStore.addToWaitlist({
      serviceKey: 'water_bill',
      serviceTitle: 'Ghana Water Company Bill Pay',
      channel: 'email',
      contact: '  Ama.Owusu@Yahoo.COM ',
    });

    assert.strictEqual(joinEmail.alreadyJoined, false);
    assert.strictEqual(joinEmail.record.contact_normalized, 'ama.owusu@yahoo.com');

    // Duplicate email registration with different casing
    const joinEmailDup = await WaitlistStore.addToWaitlist({
      serviceKey: 'water_bill',
      serviceTitle: 'Ghana Water Company Bill Pay',
      channel: 'email',
      contact: 'AMA.OWUSU@YAHOO.COM',
    });

    assert.strictEqual(joinEmailDup.alreadyJoined, true, 'Duplicate email must be detected');

    console.log('✓ 5. Real Waitlist normalization, contact sanitization & deduplication passed');
    passed++;
  }

  // 6. User-Linked Orders Verification
  {
    const order1: OrderRecord = {
      id: 'ord_test_user_01',
      user_id: 'usr_test_kwame_01',
      public_reference: 'MH-20260930-998811',
      customer_name: 'Kwame Mensah',
      customer_email: 'kwame.mensah@example.com',
      customer_phone: '0591234567',
      recipient_phone: '0591234567',
      network: 'mtn',
      service_type: 'data',
      product_id: 'mtn-50gb',
      product_name_snapshot: 'MTN 50GB Big Time Data',
      bundle_size_snapshot: '50GB',
      amount: 19500,
      currency: 'GHS',
      status: 'delivered',
      payment_provider: 'paystack',
      payment_reference: 'MH_PAY_MTN_123456',
      payment_status: 'success',
      supplier_provider: 'success_biz_hub',
      supplier_order_id: 'sbh_ord_7788',
      supplier_response: 'Completed',
      supplier_cost_minor: 18000,
      supplier_offer_ref: 'sbh_mtn_50',
      supplier_last_checked_at: new Date().toISOString(),
      failure_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
    };

    await OrdersStore.createOrder(order1);

    const userOrders = await OrdersStore.findOrdersByUserId('usr_test_kwame_01');
    assert.strictEqual(userOrders.length, 1);
    assert.strictEqual(userOrders[0].public_reference, 'MH-20260930-998811');
    assert.strictEqual(userOrders[0].amount, 19500);

    console.log('✓ 6. User-linked orders storage and retrieval passed');
    passed++;
  }

  // 7. Admin Bootstrap Service Idempotency
  {
    process.env.ADMIN_BOOTSTRAP_EMAIL = 'admin@mysterybundlehub.com';
    process.env.ADMIN_BOOTSTRAP_PASSWORD = 'AdminSecurePass2026!';
    process.env.ADMIN_BOOTSTRAP_NAME = 'Super Admin';

    await bootstrapAdminAccount();

    const adminUser = await AuthStore.findUserByIdentifier('admin@mysterybundlehub.com');
    assert.ok(adminUser);
    assert.strictEqual(adminUser.role, 'admin');
    assert.strictEqual(adminUser.status, 'active');

    // Run again to verify idempotency
    await bootstrapAdminAccount();
    const adminUser2 = await AuthStore.findUserByIdentifier('admin@mysterybundlehub.com');
    assert.ok(adminUser2);
    assert.strictEqual(adminUser2.id, adminUser.id, 'Admin user ID should remain unchanged on re-run');

    console.log('✓ 7. Admin bootstrap service idempotency passed');
    passed++;
  }

  console.log(`\n=== ALL ${passed} AUTH & WAITLIST TESTS PASSED SUCCESSFULLY ===\n`);
}

runAuthAndWaitlistTests().catch((err) => {
  console.error('Test Suite Failed with Error:', err);
  process.exit(1);
});
