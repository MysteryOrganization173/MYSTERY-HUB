import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import type { OrderRecord } from '../../../src/types';
import type { AuthenticatedCustomerOrderDetails } from '../../types/orders';
import {
  accountOrderRecord, classifyTrackInput, customerOrderRecipient, customerOrderStatus, customerOrderTitle,
  mergeCustomerOrders, orderDateLabel, orderMatchesFilter, orderMatchesQuery, shortStatusLabel,
} from '../../../src/utils/customerOrderPresentation';
import { orderRecordFromLookup } from '../../../src/utils/checkoutRecovery';
import { memberOrderLabel, memberTrackingOrder } from '../../../src/utils/memberHomePresentation';

test('Orders state is remounted per session and remembered searches are account scoped', () => {
  const page = source('src/components/orders/OrdersPage.tsx');
  assert.match(page, /<OrdersHistory key=\{`\$\{user\?\.id \|\| 'guest'\}:\$\{sessionToken \|\| ''\}`\}/);
  assert.match(page, /const viewKey = `\$\{VIEW_KEY\}:\$\{user\?\.id \|\| 'guest'\}`/);
  assert.match(page, /return \(\) => \{\s*isMounted = false;/);
});

test('Home, Orders and the receipt retain the same Marketplace stage and payment basis', () => {
  for (const marketplace_status of ['awaiting_fulfilment', 'ready_for_pickup', 'out_for_delivery', 'completed', 'refunded'] as const) {
    const raw = {public_reference:'MH-COMPAT',status:'processing',service_type:'marketplace',marketplace_status,network:'mtn',amount_ghc:10,amount:1000,currency:'GHS',created_at:'2026-10-24T10:00:00Z',recipient_phone:'0241234567',manual_review:false} as AuthenticatedCustomerOrderDetails;
    assert.equal(memberOrderLabel(raw),customerOrderStatus(accountOrderRecord(raw)).label);
    assert.equal(memberTrackingOrder(raw).marketplaceStatus, marketplace_status);
  }
});

const source = (path: string) => readFileSync(path, 'utf8');
// Synthetic fixtures only.
const order = (over: Partial<OrderRecord> = {}): OrderRecord => ({
  id: 'MH-T-1', publicReference: 'MH-T-1', serviceType: 'data', network: 'mtn', paymentMethod: 'paystack', amountGhc: 10.5,
  bundle: { id: 'server-bundle-MH-T-1', network: 'mtn', dataAmount: '2GB', dataBytesValue: 0, validity: 'Standard', validityCategory: 'Daily', priceGhc: 10.5 },
  recipientPhone: '0241234567', buyerRecipientVisible: true, status: 'placed', serverStatus: 'queued',
  createdAt: '2026-10-24T10:00:00Z', updatedAt: '2026-10-24T10:00:00Z', ...over,
});
const group = (over: Partial<OrderRecord>) => customerOrderStatus(order(over));

test('every server status maps to one documented customer group', () => {
  const cases: [string, string, string][] = [
    ['pending_payment', 'awaiting_payment', 'Awaiting payment confirmation'],
    ['paid', 'in_progress', 'Queued for delivery'],
    ['queued', 'in_progress', 'Queued for delivery'],
    ['submitted', 'in_progress', 'Processing'],
    ['processing', 'in_progress', 'Processing'],
    ['delivered', 'delivered', 'Delivered'],
    ['failed', 'attention', 'Delivery issue'],
    ['refund_pending', 'refund_pending', 'Refund pending'],
    ['refunded', 'refund_pending', 'Refund review'],
    ['cancelled', 'cancelled', 'Payment cancelled'],
    ['expired', 'cancelled', 'Payment expired'],
  ];
  for (const [serverStatus, expected, label] of cases) assert.deepEqual(group({ serverStatus }), { group: expected, label }, serverStatus);
});

test('a supplier submission awaiting confirmation is never failed or delivered', () => {
  for (const serverStatus of ['paid', 'queued', 'submitted', 'processing']) {
    const view = group({ serverStatus });
    assert.equal(view.group, 'in_progress');
    assert.doesNotMatch(view.label, /fail|deliver(ed)?$|refund/i);
  }
});

test('refund pending and verified refund stay distinct; only a verified resolution reads Refunded', () => {
  assert.deepEqual(group({ serverStatus: 'refund_pending', customerResolution: 'refund_pending' }), { group: 'refund_pending', label: 'Refund pending' });
  assert.deepEqual(group({ serverStatus: 'refunded', customerResolution: 'refund_confirmed' }), { group: 'refunded', label: 'Refunded' });
  assert.notEqual(group({ serverStatus: 'refunded' }).label, 'Refunded');
  assert.notEqual(group({ serviceType: 'afa', serverStatus: 'refunded' }).label, 'Refunded');
  assert.notEqual(group({ serviceType: 'marketplace', serverStatus: 'processing', marketplaceStatus: 'refunded' }).label, 'Refunded');
  // The server marks paid-but-stopped orders for review until a resolution is recorded.
  assert.deepEqual(group({ serverStatus: 'refunded', customerResolution: 'review' }), { group: 'attention', label: 'Resolution review' });
});

test('manual review needs attention and outranks progress, but not a final resolution', () => {
  assert.deepEqual(group({ serverStatus: 'processing', manualReview: true }), { group: 'attention', label: 'Manual review' });
  assert.deepEqual(group({ serverStatus: 'refund_pending', manualReview: true, customerResolution: 'refund_pending' }), { group: 'attention', label: 'Manual review' });
  assert.equal(group({ serverStatus: 'refunded', manualReview: true, customerResolution: 'refund_confirmed' }).group, 'refunded');
  assert.equal(group({ serverStatus: 'failed', customerResolution: 'manual_fulfillment' }).group, 'resolved');
  assert.equal(group({ serverStatus: 'failed', customerResolution: 'external_compensation' }).group, 'resolved');
});

test('AFA keeps its registration wording and review rules', () => {
  assert.deepEqual(group({ serviceType: 'afa', serverStatus: 'delivered' }), { group: 'delivered', label: 'Registered' });
  assert.deepEqual(group({ serviceType: 'afa', serverStatus: 'submitted' }), { group: 'in_progress', label: 'Submitted for Registration' });
  assert.deepEqual(group({ serviceType: 'afa', serverStatus: 'processing', manualReview: true }), { group: 'attention', label: 'Needs Attention' });
  assert.deepEqual(group({ serviceType: 'afa', serverStatus: 'pending_payment' }), { group: 'awaiting_payment', label: 'Awaiting Payment' });
  // afaStatusLabel ignores manual review once registered; the group follows it.
  assert.equal(group({ serviceType: 'afa', serverStatus: 'delivered', manualReview: true }).group, 'delivered');
});

test('Marketplace stages come from marketplace_status, including refunds on a processing order', () => {
  const m = (marketplaceStatus: string, serverStatus = 'processing') => group({ serviceType: 'marketplace', marketplaceStatus, serverStatus });
  assert.deepEqual(m('ready_for_pickup'), { group: 'in_progress', label: 'Ready for pickup' });
  assert.deepEqual(m('out_for_delivery'), { group: 'in_progress', label: 'Out for delivery' });
  assert.deepEqual(m('completed', 'delivered'), { group: 'delivered', label: 'Completed' });
  assert.deepEqual(m('refund_pending'), { group: 'refund_pending', label: 'Refund pending' });
  assert.deepEqual(m('cancelled', 'cancelled'), { group: 'cancelled', label: 'Cancelled' });
});

test('assisted orders never claim a customer payment and flag stopped orders for support', () => {
  assert.deepEqual(group({ paymentBasis: 'complimentary', serverStatus: 'queued' }), { group: 'in_progress', label: 'Awaiting supplier' });
  assert.deepEqual(group({ paymentBasis: 'operator_recorded', serverStatus: 'failed' }), { group: 'attention', label: 'Support review' });
  assert.deepEqual(group({ paymentBasis: 'complimentary', serverStatus: 'delivered' }), { group: 'delivered', label: 'Delivered' });
});

test('device records without server status stay unconfirmed', () => {
  assert.equal(group({ serverStatus: undefined, status: 'verifying' }).group, 'awaiting_payment');
  assert.equal(shortStatusLabel(group({ serverStatus: undefined, status: 'verifying' }).label), 'Confirming payment');
});

test('filters only group real states', () => {
  assert.ok(orderMatchesFilter('awaiting_payment', 'active') && orderMatchesFilter('in_progress', 'active'));
  assert.ok(!orderMatchesFilter('attention', 'active') && !orderMatchesFilter('refund_pending', 'delivered'));
  assert.ok(orderMatchesFilter('refund_pending', 'refunds') && orderMatchesFilter('refunded', 'refunds'));
  assert.ok(orderMatchesFilter('resolved', 'all') && !orderMatchesFilter('resolved', 'delivered'));
});

test('public tracking accepts references only and never a phone number', () => {
  assert.deepEqual(classifyTrackInput('  '), { kind: 'empty' });
  for (const phone of ['0241234567', '024 123 4567', '+233 24 123 4567', '233241234567']) assert.deepEqual(classifyTrackInput(phone), { kind: 'phone' }, phone);
  assert.deepEqual(classifyTrackInput('MH 2026/!'), { kind: 'invalid' });
  assert.deepEqual(classifyTrackInput(' #MH-20261024-1A2B3C '), { kind: 'reference', reference: 'MH-20261024-1A2B3C' });
  assert.deepEqual(classifyTrackInput('MH-3f9c2a71-5d0e-4b8a-9f3e-12ab34cd56ef').kind, 'reference');
  const panel = source('src/components/orders/TrackOrderPanel.tsx');
  assert.match(panel, /if \(input.kind !== 'reference'\) \{[\s\S]*?return;/);
  assert.match(panel, /lookupOrderOnServer\(input.reference\)/);
  assert.match(panel, /Phone numbers can’t be used to look up orders/);
});

test('search my orders filters this page only and matches recipient digits', () => {
  const page = source('src/components/orders/OrdersPage.tsx');
  assert.ok(!page.includes('lookupOrderOnServer'), 'list search must not query the server');
  const o = order({ network: 'telecel', bundle: { ...order().bundle, dataAmount: '5GB' } });
  assert.ok(orderMatchesQuery(o, 'telecel 5gb'));
  assert.ok(orderMatchesQuery(o, '024 123'));
  assert.ok(orderMatchesQuery(o, '+233241234567'));
  assert.ok(orderMatchesQuery(o, 'mh-t-1'));
  assert.ok(orderMatchesQuery(o, 'queued'));
  assert.ok(!orderMatchesQuery(o, 'airtime'));
});

test('server and device orders merge once, newest first', () => {
  const server = [order({ id: 'MH-A', publicReference: 'MH-A', createdAt: '2026-10-20T00:00:00Z' })];
  const local = [
    order({ id: 'MH111', publicReference: 'MH-A', createdAt: '2026-10-20T00:00:00Z' }),
    order({ id: 'MH222', publicReference: 'MH-B', createdAt: '2026-10-22T00:00:00Z' }),
  ];
  assert.deepEqual(mergeCustomerOrders(server, local).map(o => o.id), ['MH222', 'MH-A']);
});

test('account rows show the buyer number; reference lookups stay masked', () => {
  const row = { public_reference: 'MH-A', recipient_phone: '0241234567', network: 'mtn', product_name_snapshot: 'MTN 2GB', bundle_size_snapshot: '2GB', amount: 1050, amount_ghc: 10.5, currency: 'GHS', status: 'delivered', created_at: '2026-10-24T00:00:00Z', paid_at: null, delivered_at: '2026-10-24T00:05:00Z', service_type: 'data', marketplace_status: null } as AuthenticatedCustomerOrderDetails;
  const account = accountOrderRecord(row);
  assert.equal(customerOrderRecipient(account), '024 123 4567');
  assert.equal(account.deliveredAt, '2026-10-24T00:05:00Z');
  const lookup = orderRecordFromLookup({ ...row, recipient_phone: '******4567' });
  assert.equal(lookup.buyerRecipientVisible, undefined);
  assert.equal(customerOrderRecipient(lookup), '******4567');
  assert.equal(customerOrderRecipient(orderRecordFromLookup(row)), '024 ••• 4567');
});

test('card titles name the purchase without the reference', () => {
  assert.equal(customerOrderTitle(order()), '2GB Data');
  assert.equal(customerOrderTitle(order({ serviceType: 'afa' })), 'MTN AFA Registration');
  assert.equal(customerOrderTitle(order({ serviceType: 'airtime', bundle: { ...order().bundle, dataAmount: 'GH₵20.00 Airtime' } })), 'GH₵20.00 Airtime');
  assert.equal(customerOrderTitle(order({ serviceType: 'marketplace', bundle: { ...order().bundle, description: 'Wireless earbuds' } })), 'Wireless earbuds');
  const card = source('src/components/orders/CustomerOrderCard.tsx');
  assert.ok(!card.includes('publicReference'), 'the list card does not print the reference');
  assert.ok(!card.includes('dataOrderPresentation'), 'delivery explanations live in the receipt');
  assert.equal((card.match(/<button/g) || []).length, 1, 'one control per card, no nested buttons');
});

test('dates read as today, yesterday or a short date', () => {
  const now = new Date(2026, 9, 24, 15, 0);
  assert.match(orderDateLabel(new Date(2026, 9, 24, 9, 5).toISOString(), now), /^Today, /);
  assert.match(orderDateLabel(new Date(2026, 9, 23, 22, 0).toISOString(), now), /^Yesterday, /);
  assert.match(orderDateLabel(new Date(2025, 2, 3).toISOString(), now), /2025/);
  assert.equal(orderDateLabel('not a date', now), '');
});

test('account history limit is stated honestly and no new polling is added', () => {
  const page = source('src/components/orders/OrdersPage.tsx');
  assert.match(page, /ACCOUNT_ORDER_LIMIT = 50/);
  assert.match(page, /getAccountOrdersOnServer\(sessionToken, ACCOUNT_ORDER_LIMIT\)/);
  assert.match(page, /most recent account orders/);
  assert.ok(!/setInterval|setTimeout\(/.test(page));
  assert.match(page, /Orders saved on this device are still shown/);
});

test('receipt keeps server-authoritative tracking and copies only the reference', () => {
  const status = source('src/components/checkout/OrderStatusModal.tsx');
  assert.match(status, /navigator.clipboard.writeText\(displayRef\)/);
  assert.match(status, /catch \{\s*showToast\(/);
  assert.match(status, /setInterval\(fetchServerStatus, 3000\)/);
  assert.ok(!status.includes('or retry'), 'failed orders must not invite a repeat purchase');
  for (const internal of ['supplier_order_id', 'supplier_response', 'failure_reason', 'admin_note']) assert.ok(!status.includes(internal), internal);
});
