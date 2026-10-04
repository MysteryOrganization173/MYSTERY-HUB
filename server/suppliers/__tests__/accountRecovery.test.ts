import { WEBSITE_TEMPLATES } from '../../../src/data/templates.js';
import assert from 'node:assert/strict';
import { test, before, after, beforeEach } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { apiRouter } from '../../routes/api.js';
import { adminRouter } from '../../routes/adminApi.js';
import { AuthStore } from '../../db/authStore.js';
import { AdminAuditStore } from '../../db/adminAuditStore.js';
import { ReferralStore } from '../../db/referralStore.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { WebsiteStore } from '../../db/websiteStore.js';
import { hashPassword, verifyPassword, generateTemporaryPassword } from '../../utils/crypto.js';
import { identifierConflict } from '../../services/accountSecurity.js';
import type { OrderRecord } from '../../types/orders.js';
import { createRateLimiter } from '../../middleware/rateLimiter.js';

let server: Server, base: string, originalHash: string;
before(async () => {
  delete process.env.DATABASE_URL; process.env.NODE_ENV = 'test';
  originalHash = await hashPassword('OriginalPassword123');
  const app = express(); app.use(express.json()); app.use('/api', apiRouter); app.use('/api/admin', adminRouter);
  server = await new Promise<Server>(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(async () => {
  AuthStore._clearDevStore(); ReferralStore._clearDevStore(); AdminAuditStore._clearDevStore(); OrdersStore.clearDevStore();
  for (const [id, email, phone, role] of [
    ['customer', 'customer@example.com', null, 'customer'], ['phone', null, '+233241234567', 'customer'], ['admin', 'admin@example.com', null, 'admin'],
  ] as const) { await AuthStore.createUser({ id, name: id, email, phone, passwordHash: originalHash, role }); await AuthStore.createSession(id, `${id}-token`); }
});
async function request(path: string, method = 'GET', body?: unknown, token?: string) {
  return fetch(base + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
const login = (identifier = 'customer@example.com', password = 'OriginalPassword123') => request('/auth/login', 'POST', { identifier, password });
const reset = (id = 'customer', token = 'admin-token', body: unknown = { confirm: true }) => request(`/admin/users/${id}/reset-password`, 'POST', body, token);
const change = (body: unknown, token = 'customer-token') => request('/auth/change-password', 'POST', body, token);
const profile = (body: unknown) => request('/auth/profile', 'PATCH', body, 'customer-token');
async function restored() { const result = await (await reset()).json(); const auth = await (await login(undefined, result.temporaryPassword)).json(); return { ...result, ...auth }; }

test('1 existing customer login still works', async () => { assert.equal((await login()).status, 200); });
test('2 incorrect password fails', async () => { assert.equal((await login(undefined, 'WrongPassword')).status, 401); });
test('3 disabled customer cannot log in', async () => { await AuthStore.updateUserStatus('customer', 'disabled'); assert.equal((await login()).status, 403); });
test('4 duplicate email signup returns friendly conflict', async () => { assert.equal((await request('/auth/register', 'POST', { name: 'New', identifier: 'CUSTOMER@example.com', password: 'newPassword123' })).status, 409); });
test('5 duplicate phone signup returns conflict', async () => { assert.equal((await request('/auth/register', 'POST', { name: 'New', identifier: '0241234567', password: 'newPassword123' })).status, 409); });
test('6 Ghana phone variants authenticate the same customer', async () => { for (const id of ['0241234567', '233241234567', '+233 24 123 4567']) assert.equal((await (await login(id)).json()).user.id, 'phone'); });
test('7 admin resets customer with no-store response', async () => { const res = await reset(); assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store'); assert.ok((await res.json()).temporaryPassword); });
test('8 nonexistent customer reset rejected', async () => { assert.equal((await reset('missing')).status, 404); });
test('9 customer cannot use admin reset endpoint', async () => { assert.equal((await reset('phone', 'customer-token')).status, 403); assert.equal((await reset('customer', '')).status, 401); });
test('10 administrator target and self reset rejected', async () => { assert.equal((await reset('admin')).status, 403); });
test('11 old password fails after reset', async () => { await reset(); assert.equal((await login()).status, 401); });
test('12 temporary password works', async () => { const result = await (await reset()).json(); assert.equal((await login(undefined, result.temporaryPassword)).status, 200); });
test('13 reset revokes all old sessions', async () => { await AuthStore.createSession('customer', 'second-device'); await reset(); assert.equal(await AuthStore.findSessionByToken('customer-token'), null); assert.equal(await AuthStore.findSessionByToken('second-device'), null); });
test('14 reset persists required password change', async () => { await reset(); assert.equal((await AuthStore.findUserById('customer'))!.must_change_password, true); });
test('15 plaintext temporary password absent from record and audit', async () => { const result = await (await reset()).json(); const user = (await AuthStore.findUserById('customer'))!; assert.notEqual(user.password_hash, result.temporaryPassword); assert.ok(await verifyPassword(result.temporaryPassword, user.password_hash)); assert.ok(!JSON.stringify([user, await AdminAuditStore.findRecent()]).includes(result.temporaryPassword)); });
test('16 login and refreshed safe profile include mustChangePassword', async () => { const auth = await restored(); assert.equal(auth.user.mustChangePassword, true); const data = await (await request('/auth/me', 'GET', undefined, auth.token)).json(); assert.equal(data.user.mustChangePassword, true); assert.equal(data.user.password_hash, undefined); });
test('17 forced change succeeds without repeating temporary password', async () => { const auth = await restored(); assert.equal((await change({ newPassword: 'PermanentPassword123' }, auth.token)).status, 200); });
test('18 forced change clears requirement', async () => { const auth = await restored(); const res = await change({ newPassword: 'PermanentPassword123' }, auth.token); assert.equal((await res.json()).user.mustChangePassword, false); assert.equal((await AuthStore.findUserById('customer'))!.must_change_password, false); });
test('19 temporary password stops working after permanent change', async () => { const auth = await restored(); await change({ newPassword: 'PermanentPassword123' }, auth.token); assert.equal((await login(undefined, auth.temporaryPassword)).status, 401); });
test('20 permanent password authenticates', async () => { const auth = await restored(); await change({ newPassword: 'PermanentPassword123' }, auth.token); assert.equal((await login(undefined, 'PermanentPassword123')).status, 200); });
test('21 forced change leaves referral profile unchanged', async () => { const initial = structuredClone(await ReferralStore.getOrCreateProfile('customer')); const auth = await restored(); await change({ newPassword: 'PermanentPassword123' }, auth.token); assert.deepEqual(await ReferralStore.findProfileByUserId('customer'), initial); });
test('22 normal change rejects incorrect current password', async () => { assert.equal((await change({ currentPassword: 'wrong', newPassword: 'PermanentPassword123' })).status, 400); });
test('23 normal change accepts correct current password', async () => { assert.equal((await change({ currentPassword: 'OriginalPassword123', newPassword: 'PermanentPassword123' })).status, 200); });
test('24 password policy and same-password rejection enforced', async () => { for (const newPassword of ['short', 'a'.repeat(129), 'OriginalPassword123']) assert.equal((await change({ currentPassword: 'OriginalPassword123', newPassword })).status, 400); });
test('25 replacement session works and previous sessions stop', async () => { await AuthStore.createSession('customer', 'second-device'); const res = await change({ currentPassword: 'OriginalPassword123', newPassword: 'PermanentPassword123' }); const data = await res.json(); assert.ok(await AuthStore.findSessionByToken(data.token)); assert.equal(await AuthStore.findSessionByToken('customer-token'), null); assert.equal(await AuthStore.findSessionByToken('second-device'), null); });
test('26 customer updates trimmed display name', async () => { const data = await (await profile({ name: '  Kwame Mensah  ' })).json(); assert.equal(data.user.name, 'Kwame Mensah'); assert.equal(data.user.id, 'customer'); });
test('27 email customer adds normalized phone and can use either identifier', async () => { assert.equal((await profile({ phone: '059 111 2233', currentPassword: 'OriginalPassword123' })).status, 200); assert.equal((await (await login('0591112233')).json()).user.id, 'customer'); assert.equal((await login()).status, 200); });
test('28 phone customer adds lowercased email and can use either identifier', async () => { const res = await request('/auth/profile', 'PATCH', { email: ' PHONE@EXAMPLE.COM ', currentPassword: 'OriginalPassword123' }, 'phone-token'); assert.equal(res.status, 200); assert.equal((await (await login('phone@example.com')).json()).user.id, 'phone'); assert.equal((await login('0241234567')).status, 200); });
test('29 invalid Ghana phone rejected', async () => { assert.equal((await profile({ phone: '12345', currentPassword: 'OriginalPassword123' })).status, 400); });
test('30 duplicate phone rejected including normalization variant', async () => { const res = await profile({ phone: '024 123 4567', currentPassword: 'OriginalPassword123' }); assert.equal(res.status, 409); });
test('31 duplicate email rejected', async () => { assert.equal((await profile({ email: 'ADMIN@example.com', currentPassword: 'OriginalPassword123' })).status, 409); });
test('32 final login identifier cannot be removed', async () => { assert.equal((await profile({ email: null, currentPassword: 'OriginalPassword123' })).status, 400); });
test('33 changing sign-in details requires password', async () => { assert.equal((await profile({ email: 'new@example.com' })).status, 400); assert.equal((await profile({ phone: '0591112233', currentPassword: 'wrong' })).status, 400); });
test('34 name-only update requires no password', async () => { assert.equal((await profile({ name: 'Customer Name' })).status, 200); });
test('35 admin corrects customer profile and revokes sessions on contact change', async () => { const res = await request('/admin/users/customer/profile', 'PATCH', { name: 'Corrected Name', phone: '0591112233' }, 'admin-token'); assert.equal(res.status, 200); assert.equal((await res.json()).user.phone, '+233591112233'); assert.equal(await AuthStore.findSessionByToken('customer-token'), null); });
test('36 admin uniqueness conflicts rejected', async () => { assert.equal((await request('/admin/users/customer/profile', 'PATCH', { phone: '0241234567' }, 'admin-token')).status, 409); });
test('37 profile action audited with only changed field names', async () => { await request('/admin/users/customer/profile', 'PATCH', { name: 'Corrected Name', currentPassword: 'DO_NOT_AUDIT' }, 'admin-token'); const [audit] = await AdminAuditStore.findRecent(); assert.equal(audit.action, 'customer_profile_updated'); assert.equal(audit.admin_user_id, 'admin'); assert.equal(audit.entity_id, 'customer'); assert.deepEqual(JSON.parse(audit.metadata_safe_json!).changedFields, ['name']); assert.ok(!audit.metadata_safe_json!.includes('DO_NOT_AUDIT')); });
test('38 customer signs out all devices', async () => { await AuthStore.createSession('customer', 'second-device'); assert.equal((await request('/auth/logout-all', 'POST', {}, 'customer-token')).status, 200); assert.equal(await AuthStore.findSessionByToken('customer-token'), null); assert.equal(await AuthStore.findSessionByToken('second-device'), null); });
test('39 admin revokes customer sessions and audits', async () => { assert.equal((await request('/admin/users/customer/revoke-sessions', 'POST', { confirm: true }, 'admin-token')).status, 200); assert.equal(await AuthStore.findSessionByToken('customer-token'), null); assert.equal((await AdminAuditStore.findRecent())[0].action, 'customer_sessions_revoked'); });
test('40 referral code survives reset and profile editing', async () => { const code = (await ReferralStore.getOrCreateProfile('customer')).referral_code; await reset(); await request('/admin/users/customer/profile', 'PATCH', { name: 'New Name' }, 'admin-token'); assert.equal((await ReferralStore.findProfileByUserId('customer'))!.referral_code, code); });
test('41 reward ledger is untouched', async () => { await ReferralStore.createLedgerEntry({ referrer_user_id: 'customer', referred_user_id: 'phone', referral_attribution_id: null, order_id: 'historic-order', marketplace_product_id: null, service_type: 'data', reward_rule_id: null, amount_minor: 50, currency: 'GHS', status: 'approved', reason: 'Historical earned reward', idempotency_key: 'historic-reward', reversal_of_id: null, approved_at: new Date().toISOString(), rejected_at: null, reversed_at: null, metadata_json: null }); const before = structuredClone(ReferralStore.adminDevSnapshot().ledger); await reset(); assert.deepEqual(ReferralStore.adminDevSnapshot().ledger, before); });
test('42 historical order ownership and snapshots survive', async () => { const at = new Date().toISOString(); const order = { id: 'owned-order', user_id: 'customer', public_reference: 'owned-order', customer_name: 'Historic Name', customer_email: 'historic@example.com', customer_phone: '0591112233', recipient_phone: '0591112233', network: 'mtn', product_id: 'data', product_name_snapshot: '1 GB', bundle_size_snapshot: '1GB', amount: 100, currency: 'GHS', status: 'pending_payment', payment_provider: 'paystack', payment_reference: 'owned-payment', payment_status: 'pending', created_at: at, updated_at: at } as OrderRecord; await OrdersStore.createOrder(order); const before = structuredClone(await OrdersStore.findOrdersByUserId('customer')); await reset(); await request('/admin/users/customer/profile', 'PATCH', { email: 'corrected@example.com' }, 'admin-token'); assert.deepEqual(await OrdersStore.findOrdersByUserId('customer'), before); });
test('43 website ownership and content survive', async () => { await WebsiteStore.createSite('customer', { template_id: WEBSITE_TEMPLATES[0].id, name: 'Owned Site' }); const before = structuredClone(await WebsiteStore.findSitesByUserId('customer')); await reset(); await request('/admin/users/customer/profile', 'PATCH', { name: 'New Name' }, 'admin-token'); assert.deepEqual(await WebsiteStore.findSitesByUserId('customer'), before); });
test('44 existing admin disable/enable controls preserve access semantics', async () => { assert.equal((await request('/admin/users/customer/status', 'PATCH', { status: 'disabled' }, 'admin-token')).status, 200); assert.equal((await login()).status, 403); assert.equal(await AuthStore.findSessionByToken('customer-token'), null); assert.equal((await request('/admin/users/customer/status', 'PATCH', { status: 'active' }, 'admin-token')).status, 200); assert.equal((await login()).status, 200); });
test('forced session cannot buy services, edit a website or update profile through APIs', async () => { const auth = await restored(); for (const [path, method] of [['/payments/initialize', 'POST'], ['/websites', 'POST'], ['/auth/profile', 'PATCH'], ['/orders/my-orders', 'GET']]) { const res = await request(path, method, method === 'GET' ? undefined : {}, auth.token); assert.equal(res.status, 403); assert.equal((await res.json()).code, 'PASSWORD_CHANGE_REQUIRED'); } });
test('confirmation is strictly true and admin controls remain customer only', async () => { assert.equal((await reset('customer', 'admin-token', { confirm: 'true' })).status, 400); assert.equal((await request('/admin/users/admin/revoke-sessions', 'POST', { confirm: true }, 'admin-token')).status, 403); assert.equal((await request('/admin/users/admin/profile', 'PATCH', { name: 'No' }, 'admin-token')).status, 403); });
test('normal customer password change requires current password', async () => { assert.equal((await change({ newPassword: 'PermanentPassword123' })).status, 400); });
test('two concurrent changes with the same old session permit exactly one', async () => { const results = await Promise.all([change({ currentPassword: 'OriginalPassword123', newPassword: 'PermanentPassword123' }), change({ currentPassword: 'OriginalPassword123', newPassword: 'AnotherPassword123' })]); assert.deepEqual(results.map(res => res.status).sort(), [200, 401]); });
test('temporary passwords satisfy policy without ambiguous characters', () => { const passwords = new Set(Array.from({ length: 100 }, generateTemporaryPassword)); assert.equal(passwords.size, 100); assert.ok([...passwords].every(pass => /^[A-HJ-NP-Za-km-z2-9]{4}(-[A-HJ-NP-Za-km-z2-9]{4}){3}$/.test(pass))); });
test('PostgreSQL uniqueness errors never expose database internals', () => { assert.equal(identifierConflict({ code: '23505', constraint: 'idx_users_phone_unique', detail: 'secret' })!.status, 409); assert.ok(!identifierConflict({ code: '23505', constraint: 'idx_users_phone_unique', detail: 'secret' })!.message.includes('secret')); });
test('rate limiter ignores spoofed forwarded headers', () => {
  process.env.NODE_ENV = 'development';
  try {
    const limit = createRateLimiter({ windowMs: 10000, max: 1 }); let permitted = 0, status = 0;
    const response = { status(code: number) { status = code; return this; }, json() {} } as any;
    for (const forwarded of ['1.2.3.4', '5.6.7.8']) limit({ ip: '127.0.0.1', headers: { 'x-forwarded-for': forwarded }, socket: { remoteAddress: '127.0.0.1' } } as any, response, () => { permitted++; });
    assert.equal(permitted, 1); assert.equal(status, 429);
  } finally { process.env.NODE_ENV = 'test'; }
});
test('login limit groups Ghana variants even when forwarded address changes', async () => {
  process.env.NODE_ENV = 'development';
  try {
    for (let i = 0; i < 16; i++) {
      const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `192.0.2.${i}` }, body: JSON.stringify({ identifier: ['0241234567', '+233241234567', '233241234567'][i % 3], password: 'WrongPassword' }) });
      assert.equal(response.status, i === 15 ? 429 : 401);
    }
  } finally { process.env.NODE_ENV = 'test'; }
});
test('revoked bearer session cannot silently become a guest purchase', async () => {
  await reset(); assert.equal((await request('/payments/initialize', 'POST', {}, 'customer-token')).status, 401);
  // True guest requests still reach ordinary input validation.
  assert.equal((await request('/payments/initialize', 'POST', {})).status, 400);
});
