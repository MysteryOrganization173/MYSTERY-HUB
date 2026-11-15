// Mystery Hub 3.4.1 Release 1: unified navigation, My Account hub, registration and receipt email, Smart Buy Again.
import assert from 'node:assert/strict';
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { apiRouter } from '../../routes/api.js';
import { AuthStore } from '../../db/authStore.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { hashPassword } from '../../utils/crypto.js';
import { toSafeUserProfile } from '../../types/auth.js';
import type { OrderRecord } from '../../types/orders.js';
import { resolveReorder, reorderableOrder, type ReorderDependencies } from '../../services/reorderService.js';
import { reorderAction, reorderMessage } from '../../../src/utils/reorderPresentation.js';
import { canRememberReceiptEmail, defaultReceiptEmail } from '../../../src/utils/receiptEmail.js';
import type { DataBundle } from '../../../src/types/index.js';

const source = (file: string) => readFileSync(file, 'utf8');
let server: Server, base: string, hash: string;
before(async () => {
  delete process.env.DATABASE_URL; process.env.NODE_ENV = 'test';
  hash = await hashPassword('Synthetic#Member-341');
  const app = express(); app.use(express.json()); app.use('/api', apiRouter);
  server = await new Promise<Server>(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(async () => {
  AuthStore._clearDevStore(); OrdersStore.clearDevStore();
  await AuthStore.createUser({ id: 'ama', name: 'Ama Synthetic', email: null, phone: '+233240000341', passwordHash: hash });
  await AuthStore.createUser({ id: 'kofi', name: 'Kofi Synthetic', email: 'kofi@example.test', phone: '+233240000342', passwordHash: hash });
  await AuthStore.createSession('ama', 'ama-token'); await AuthStore.createSession('kofi', 'kofi-token');
});
const call = (path: string, method = 'GET', body?: unknown, token?: string) =>
  fetch(base + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

let sequence = 0;
function order(overrides: Partial<OrderRecord> = {}): OrderRecord {
  const now = new Date().toISOString(), n = ++sequence;
  return {
    id: `ord_341_${n}`, user_id: 'ama', public_reference: `MH-341-${n}`, customer_name: 'Ama Synthetic', customer_email: 'ama@customer.example.test',
    customer_phone: '+233240000341', recipient_phone: '0241234567', network: 'mtn', service_type: 'data', product_id: 'mtn-2gb',
    product_name_snapshot: 'MTN 2GB', bundle_size_snapshot: '2GB', amount: 99_999, currency: 'GHS', status: 'delivered',
    payment_provider: 'paystack', payment_reference: `MH_PAY_341_${n}`, payment_status: 'success', supplier_provider: 'success_biz_hub',
    supplier_order_id: 'SUP-341', supplier_response: null, supplier_cost_minor: 777, supplier_offer_ref: 'offer-secret', supplier_last_checked_at: null,
    failure_reason: null, created_at: now, updated_at: now, paid_at: now, submitted_at: now, delivered_at: now, ...overrides,
  } as OrderRecord;
}
const deps = (over: Partial<ReorderDependencies> = {}): ReorderDependencies => ({
  dataCatalogue: async () => ({ products: [{ id: 'mtn-2gb', network: 'mtn', dataAmount: '2GB', validity: 'Non-expiry' }, { id: 'telecel-5gb', network: 'telecel', dataAmount: '5GB' }] }),
  instantCatalogue: async () => ({ available: true, packages: [
    { id: 'pkg-fixed', name: 'MTN 1GB Instant', network: 'MTN', dataAmount: '1GB', validity: '1 day', priceMinor: 400, enabled: true, available: true, mode: 'fixed' },
    { id: 'pkg-flexi', name: 'MTN Flexi', network: 'MTN', isFlexi: true, mode: 'flexi', minAmountMajor: 1, maxAmountMajor: 500, payableRatio: 0.8, enabled: true, available: true },
    { id: 'pkg-off', name: 'Off', network: 'MTN', dataAmount: '3GB', priceMinor: 900, enabled: false },
  ] as any }),
  ...over,
});
const SECRET_FIELDS = /supplier|cost|payableRatio|priceMinor|offer-secret|margin|99999|999\.99/i;

// ─── Smart Buy Again: the server resolves the product by its stored id, never by name or old price ───

test('a delivered Data order resolves to today’s catalogue product by its stored id, with no historical price', async () => {
  const answer = await resolveReorder(order(), deps());
  assert.equal(answer.available, true);
  assert.equal(answer.kind, 'data');
  assert.deepEqual((answer as any).product, { id: 'mtn-2gb', network: 'mtn', dataAmount: '2GB', validity: 'Non-expiry' });
  assert.equal(answer.recipientPhone, '0241234567');
  assert.doesNotMatch(JSON.stringify(answer), SECRET_FIELDS, 'no supplier facts and no old amount');
});

test('the product name and price never identify a product: a renamed snapshot still maps by id, an unknown id is discontinued', async () => {
  const renamed = await resolveReorder(order({ product_name_snapshot: 'Telecel 5GB', bundle_size_snapshot: '5GB', amount: 1 }), deps());
  assert.equal((renamed as any).product.id, 'mtn-2gb');
  const unknown = await resolveReorder(order({ product_id: 'mtn-2-gb-promo', product_name_snapshot: 'MTN 2GB' }), deps());
  assert.deepEqual([unknown.available, (unknown as any).reason], [false, 'discontinued']);
});

test('a product switched off in today’s catalogue is unavailable, with its network kept for the catalogue', async () => {
  const answer = await resolveReorder(order(), deps({ dataCatalogue: async () => ({ products: [] }) }));
  assert.deepEqual([answer.available, (answer as any).reason, answer.network, answer.kind], [false, 'unavailable', 'mtn', 'data']);
});

test('only delivered, settled orders with nothing open can be bought again', async () => {
  for (const over of [
    { status: 'processing' }, { status: 'failed' }, { status: 'refunded' }, { status: 'refund_pending' }, { status: 'pending_payment', payment_status: 'pending' },
    { manual_review: true }, { resolution_json: { version: 1, stage: 'under_review' } }, { resolution_json: { version: 1, stage: 'resolved', outcome: 'paystack_refund' } },
    { payment_status: 'failed' },
  ] as Partial<OrderRecord>[]) {
    const o = order(over);
    assert.equal(reorderableOrder(o), false, JSON.stringify(over));
    assert.equal((await resolveReorder(o, deps()) as any).reason, 'not_completed', JSON.stringify(over));
  }
  assert.equal(reorderableOrder(order({ payment_provider: 'complimentary', payment_status: 'not_required' })), true);
});

test('website-store purchases and other services are not repeated from here', async () => {
  assert.equal((await resolveReorder(order({ store_context: { retailMinor: 1 } as any }), deps()) as any).reason, 'not_repeatable');
  for (const service_type of ['marketplace', 'afa', 'results_checker'] as const) assert.equal((await resolveReorder(order({ service_type }), deps()) as any).reason, 'not_repeatable');
});

test('Airtime repeats the chosen face value with today’s fee; an unreadable amount asks the customer to choose again', async () => {
  const answer = await resolveReorder(order({ service_type: 'airtime', product_id: 'airtime-telecel-10', network: 'telecel', face_value_minor: 1000, amount: 5 }), deps());
  assert.equal(answer.available, true);
  assert.deepEqual((answer as any).airtime, { faceValueGhc: 10, serviceFeeGhc: 0, totalGhc: 10 });
  assert.equal(answer.network, 'telecel');
  for (const face of [null, 0, 50, 200_000]) assert.equal((await resolveReorder(order({ service_type: 'airtime', product_id: 'airtime-mtn-x', face_value_minor: face }), deps()) as any).reason, 'unidentifiable', String(face));
});

test('Instant Bundles are checked against the live catalogue: fixed works, Flexi asks for the amount, off or missing is explained', async () => {
  const fixed = await resolveReorder(order({ service_type: 'instant_bundle', product_id: 'instant-pkg-fixed' }), deps());
  assert.equal(fixed.available, true);
  assert.equal((fixed as any).product.productKey, 'instant-pkg-fixed');
  assert.doesNotMatch(JSON.stringify(fixed), /payableRatio|priceMinor|recipientAlternative|offer-secret|supplier/i);
  assert.equal((await resolveReorder(order({ service_type: 'instant_bundle', product_id: 'instant-pkg-flexi' }), deps()) as any).reason, 'choose_amount');
  assert.equal((await resolveReorder(order({ service_type: 'instant_bundle', product_id: 'instant-pkg-off' }), deps()) as any).reason, 'unavailable');
  assert.equal((await resolveReorder(order({ service_type: 'instant_bundle', product_id: 'instant-gone' }), deps()) as any).reason, 'discontinued');
  assert.equal((await resolveReorder(order({ service_type: 'instant_bundle', product_id: 'mtn-2gb' }), deps()) as any).reason, 'unidentifiable');
  assert.equal((await resolveReorder(order({ service_type: 'instant_bundle', product_id: 'instant-pkg-fixed' }), deps({ instantCatalogue: async () => ({ available: false, packages: [] }) })) as any).reason, 'service_unavailable');
  assert.equal((await resolveReorder(order({ service_type: 'instant_bundle', product_id: 'instant-pkg-fixed' }), deps({ instantCatalogue: async () => { throw new Error('down'); } })) as any).reason, 'service_unavailable');
});

test('the reorder route answers only the owner, by public reference, without caching, and never creates anything', async () => {
  const mine = await OrdersStore.createOrder(order());
  const before = (await OrdersStore.findOrdersByUserId('ama')).length;
  const ok = await call(`/account/orders/${mine.public_reference}/reorder`, 'GET', undefined, 'ama-token');
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  const body = await ok.json();
  assert.equal(body.reorder.available, true);
  assert.equal(body.reorder.product.id, 'mtn-2gb');
  assert.doesNotMatch(JSON.stringify(body), SECRET_FIELDS);
  assert.equal((await OrdersStore.findOrdersByUserId('ama')).length, before, 'no order created');
  assert.equal((await call(`/account/orders/${mine.public_reference}/reorder`, 'GET', undefined, 'kofi-token')).status, 404, 'another customer’s order reads as not found');
  assert.equal((await call(`/account/orders/${mine.public_reference}/reorder`)).status, 401);
  assert.equal((await call(`/account/orders/${mine.payment_reference}/reorder`, 'GET', undefined, 'ama-token')).status, 404, 'a payment reference never names an order here');
  assert.equal((await call(`/account/orders/${mine.id}/reorder`, 'GET', undefined, 'ama-token')).status, 404, 'nor does an internal id');
  assert.equal((await call(`/account/orders/${encodeURIComponent('x\' OR 1=1')}/reorder`, 'GET', undefined, 'ama-token')).status, 404);
  const guest = await OrdersStore.createOrder(order({ user_id: null }));
  assert.equal((await call(`/account/orders/${guest.public_reference}/reorder`, 'GET', undefined, 'ama-token')).status, 404, 'a guest order has no owner to match');
});

// ─── Client: the answer opens a checkout review or explains and opens the right catalogue ───

const catalogue: DataBundle[] = [{ id: 'mtn-2gb', network: 'mtn', dataAmount: '2GB', dataBytesValue: 2048, validity: 'Non-expiry', validityCategory: 'Monthly', priceGhc: 11.5 }];
test('a Data answer opens checkout for today’s catalogue entry with the previous recipient filled in', () => {
  const action = reorderAction({ reference: 'MH-1', recipientPhone: '+233241234567', network: 'mtn', available: true, kind: 'data', product: { id: 'mtn-2gb', network: 'mtn', dataAmount: '2GB' } }, catalogue);
  assert.equal(action.type, 'checkout');
  if (action.type !== 'checkout') return;
  assert.equal(action.bundle.id, 'mtn-2gb');
  assert.equal(action.bundle.priceGhc, 11.5, 'display only; the checkout quote decides the total');
  assert.equal(action.recipientPhone, '024 123 4567');
  const unseen = reorderAction({ reference: 'MH-1', recipientPhone: '0241234567', network: 'telecel', available: true, kind: 'data', product: { id: 'telecel-5gb', network: 'telecel', dataAmount: '5GB' } }, catalogue);
  assert.equal(unseen.type === 'checkout' && unseen.bundle.priceGhc, 0, 'an entry the page has not loaded yet carries no price of its own');
});

test('Airtime and Instant answers build the same checkout bundles their own pages build', () => {
  const airtime = reorderAction({ reference: 'MH-2', recipientPhone: '0201234567', network: 'telecel', available: true, kind: 'airtime', airtime: { faceValueGhc: 10, serviceFeeGhc: 0, totalGhc: 10 } }, catalogue);
  assert.ok(airtime.type === 'checkout');
  if (airtime.type === 'checkout') {
    assert.equal(airtime.bundle.id, 'airtime-telecel-10');
    assert.equal(airtime.bundle.serviceType, 'airtime');
    assert.equal(airtime.bundle.faceValueGhc, 10);
  }
  const instant = reorderAction({ reference: 'MH-3', recipientPhone: '0241234567', network: 'mtn', available: true, kind: 'instant_bundle', product: { productKey: 'instant-pkg', packageId: 'pkg', name: 'MTN 1GB', network: 'mtn', dataAmount: '1GB', validity: '1 day', isFlexi: false, retailPriceGhc: 4, retailPricePesewas: 400, paymentProcessingFeeGhc: 0.08, paymentProcessingFeePesewas: 8, estimatedTotalGhc: 4.08, estimatedTotalPesewas: 408, availability: 'in_stock' } }, catalogue);
  assert.ok(instant.type === 'checkout' && instant.bundle.id === 'instant-pkg' && instant.bundle.serviceType === 'instant_bundle');
});

test('an unavailable answer explains in a sentence and opens the matching catalogue tab and network', () => {
  const cases: [any, string, string][] = [
    [{ kind: 'data', reason: 'discontinued', network: 'mtn' }, 'data', 'That bundle is no longer sold. Here are today’s MTN bundles.'],
    [{ kind: 'instant_bundle', reason: 'choose_amount', network: 'mtn' }, 'instant', 'Choose the amount again for this flexible MTN bundle.'],
    [{ kind: 'airtime', reason: 'unidentifiable', network: 'airteltigo' }, 'airtime', 'We couldn’t read the amount from that order. Choose the amount again.'],
    [{ kind: 'data', reason: 'not_completed', network: null }, 'data', 'Only delivered orders can be bought again. Choose what you need here.'],
  ];
  for (const [answer, mode, message] of cases) {
    const action = reorderAction({ reference: 'MH', recipientPhone: '', available: false, ...answer }, catalogue);
    assert.deepEqual(action, { type: 'catalogue', mode, network: answer.network ?? 'all', message });
  }
  for (const reason of ['not_completed', 'not_repeatable', 'unidentifiable', 'discontinued', 'unavailable', 'choose_amount', 'service_unavailable'] as const) assert.ok(reorderMessage(reason, 'data', 'mtn').length < 90, reason);
});

test('Buy again opens a checkout review and never initializes a payment by itself', () => {
  const hook = source('src/hooks/useBuyAgain.ts');
  assert.match(hook, /getReorderOnServer\(asked, reference, controller\.signal\)/);
  assert.match(hook, /openCheckout\(action\.bundle, \{ recipientPhone: action\.recipientPhone \}\)/);
  assert.doesNotMatch(hook, /initialize|walletCheckout|payments\//);
  assert.match(hook, /token\.current !== asked/, 'an answer for a previous account is dropped');
  for (const view of ['src/components/home/MemberHomeView.tsx', 'src/seasonal/christmas/member/ChristmasMemberView.tsx']) assert.match(source(view), /buyAgainButton\(order, ?buyAgain/);
  assert.match(source('src/components/checkout/OrderStatusModal.tsx'), /buyAgain\(activeOrder\.publicReference!, \{ beforeOpen: closeOrderStatus \}\)/);
  // The review still fetches its own server quote and keeps Pay unavailable until it arrives.
  assert.match(source('src/components/checkout/CheckoutModal.tsx'), /commercialRequest\('commercial\/quote\/'\+encodeURIComponent\(checkoutBundle\.id\)/);
});

// ─── Receipt email: a separate, explicit, server-stored preference ───

test('receipt email is remembered only by explicit choice and never touches sign-in details', async () => {
  const userBefore = (await AuthStore.findUserById('ama'))!;
  const res = await call('/auth/receipt-email', 'PUT', { email: 'Ama.Receipts@Example.test ' }, 'ama-token');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.equal(body.user.receiptEmail, 'ama.receipts@example.test');
  assert.equal(body.user.email, null, 'the sign-in email is not set');
  const userAfter = (await AuthStore.findUserById('ama'))!;
  assert.equal(userAfter.email, null); assert.equal(userAfter.phone, userBefore.phone); assert.equal(userAfter.password_hash, userBefore.password_hash);
  assert.ok(await AuthStore.findSessionByToken('ama-token'), 'no session is revoked');
  assert.equal((await (await call('/auth/me', 'GET', undefined, 'ama-token')).json()).user.receiptEmail, 'ama.receipts@example.test');
  // Signing in with the receipt email is impossible: it is not an identifier.
  assert.equal((await call('/auth/login', 'POST', { identifier: 'ama.receipts@example.test', password: 'Synthetic#Member-341' })).status, 401);
  assert.equal((await (await call('/auth/receipt-email', 'PUT', { email: null }, 'ama-token')).json()).user.receiptEmail, null, 'null forgets it');
});

test('receipt email rejects bad input, other fields, other people and a pending password change', async () => {
  for (const body of [{ email: 'not-an-email' }, { email: 42 }, {}, { email: 'a@b.co', phone: '0241111111' }, { receiptEmail: 'a@b.co' }, ['a@b.co'], { email: 'x'.repeat(130) + '@example.test' }]) {
    assert.equal((await call('/auth/receipt-email', 'PUT', body, 'ama-token')).status, 400, JSON.stringify(body).slice(0, 40));
  }
  assert.equal((await call('/auth/receipt-email', 'PUT', { email: 'a@example.test' })).status, 401);
  const user = (await AuthStore.findUserById('kofi'))!; await AuthStore.saveAccount({ ...user, must_change_password: true });
  assert.equal((await call('/auth/receipt-email', 'PUT', { email: 'a@example.test' }, 'kofi-token')).status, 403);
  assert.equal((await AuthStore.findUserById('ama'))!.receipt_email ?? null, null);
});

test('safe profiles carry the receipt email; checkout prefers it, then the sign-in email, and offers Remember only for a new address', () => {
  const user = { id: 'u', name: 'U', email: 'login@example.test', phone: null, password_hash: 'x', role: 'customer', status: 'active', created_at: '', updated_at: '', last_login_at: null, must_change_password: false, password_changed_at: null, receipt_email: 'r@example.test' } as const;
  assert.equal(toSafeUserProfile(user).receiptEmail, 'r@example.test');
  assert.equal(toSafeUserProfile({ ...user, receipt_email: undefined }).receiptEmail, null);
  assert.equal(defaultReceiptEmail({ email: 'login@example.test', receiptEmail: 'r@example.test' }), 'r@example.test');
  assert.equal(defaultReceiptEmail({ email: 'login@example.test', receiptEmail: null }), 'login@example.test');
  assert.equal(defaultReceiptEmail(null), '');
  assert.equal(canRememberReceiptEmail(null, 'new@example.test'), false, 'guests have nothing to remember it on');
  assert.equal(canRememberReceiptEmail({ email: 'login@example.test' }, 'LOGIN@example.test '), false);
  assert.equal(canRememberReceiptEmail({ email: null }, 'new@example'), false);
  assert.equal(canRememberReceiptEmail({ email: null }, 'new@example.test'), true);
  const checkout = source('src/components/checkout/CheckoutModal.tsx');
  assert.match(checkout, /Remember this email for future receipts/);
  assert.match(checkout, /setRememberReceipt\(false\);\n/, 'unchecked by default on every open');
  assert.match(checkout, /saveReceiptEmailOnServer\(token,email\)/);
  assert.doesNotMatch(checkout, /updateProfileOnServer/, 'checkout never edits sign-in details');
  assert.match(checkout, /customerEmail: receiptEmail \|\| user\?\.email \|\| undefined/, 'the order uses the typed address');
});

test('schema adds the receipt column additively and the session lookup reads it', () => {
  assert.match(source('server/db/schema.sql'), /ALTER TABLE users ADD COLUMN IF NOT EXISTS receipt_email VARCHAR\(254\) NULL;/);
  assert.match(source('server/db/connection.ts'), /name: 'users\.receipt_email', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS receipt_email VARCHAR\(254\) NULL;`/);
  assert.match(source('server/db/authStore.ts'), /u\.receipt_email as u_receipt_email/);
  assert.match(source('server/db/authStore.ts'), /UPDATE users SET receipt_email=\$2, updated_at=\$3 WHERE id=\$1 RETURNING \*;/);
});

// ─── Navigation and My Account ───

test('one menu button below desktop, one compact account dropdown on desktop, never both', () => {
  const nav = source('src/components/common/Navbar.tsx');
  assert.equal((nav.match(/aria-controls="mobile-menu"/g) || []).length, 1);
  assert.match(nav, /className=\{`mh-menu-trigger xl:hidden/);
  assert.match(nav, /<div className="relative hidden xl:block" ref=\{dropdownRef\}>/, 'the dropdown trigger exists only from 1280px');
  assert.equal((nav.match(/Sign Out/g) || []).length, 2, 'one Sign Out in the phone menu and one in the desktop dropdown');
  assert.equal((nav.match(/<ShareAppButton /g) || []).length, 2);
  for (const label of ['My Orders', 'Wallet', 'My Business', 'Earn', 'Website Builder', 'Marketplace', 'More Services', 'My Account', 'Help & FAQs', 'Ask Mystery AI']) assert.ok(nav.includes(`'${label}'`) || nav.includes(`>${label}<`), label);
  assert.match(nav, /wide: true/, 'bottom-nav pages appear in the menu only where the bottom nav is hidden');
  assert.match(nav, /entry\.wide \? 'hidden md:block' : undefined/);
  assert.match(nav, /aria-current=\{current \? 'page' : undefined\}/);
  assert.match(nav, /useEffect\(\(\) => \{ setMobileMenuOpen\(false\); setAccountDropdownOpen\(false\); \}, \[user\?\.id\]\)/, 'signing in or out closes menus');
  assert.match(source('src/index.css'), /\.mh-app:has\(\.mh-mobile-menu\) \.mh-bottom-nav \{ visibility: hidden; \}/);
});

test('My Account is one sheet of short sections with forms opened in place, keeping every server check', () => {
  const hub = source('src/components/auth/MyAccountHub.tsx');
  for (const heading of ['Personal details', 'Security', 'Notifications', 'Rewards']) assert.match(hub, new RegExp(`title="${heading}"`));
  assert.match(hub, /layout="sheet"/);
  assert.doesNotMatch(hub, /<SecurityDialog[^>]*>[\s\S]*<SecurityDialog/, 'no dialog inside the dialog');
  assert.match(hub, /\.\.\.\(identifiersChanged \? \{ currentPassword \} : \{\}\)/, 'sign-in changes still need the current password');
  assert.match(hub, /revokeOwnSessionsOnServer\(sessionToken!\)/);
  assert.match(hub, /<PasswordForm forced=\{false\}/);
  assert.match(source('src/components/auth/AccountControls.tsx'), /if \(user\?\.mustChangePassword\) return <SecurityDialog title="Create a new password" mandatory><PasswordForm forced \/><\/SecurityDialog>;/);
  assert.match(source('src/components/auth/AccountControls.tsx'), /<MyAccountHub key=\{user\.id\}/, 'switching accounts remounts the sheet');
  assert.match(source('src/components/pwa/NotificationsEntry.tsx'), /openAccount\('notifications'\)/);
  assert.match(source('src/components/auth/SecurityDialog.tsx'), /layout\?: 'dialog' \| 'sheet'/);
});
