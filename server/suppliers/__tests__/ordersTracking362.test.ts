// Mystery Hub 3.6.2 · Orders, tracking and the digital receipt. Synthetic fixtures only.
// Guards what the redesign must never get wrong: what each status means, what the money label claims, which stages are
// shown as done, what a guest or another account can see, when the season may decorate, and that no new requests run.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { OrderRecord } from '../../../src/types';
import { orderReceiptView, orderSaving, receiptService } from '../../../src/utils/orderReceiptPresentation';
import { customerOrderStatus, visibleDeviceOrders } from '../../../src/utils/customerOrderPresentation';
import { ordersSeasonAttributes, ordersLook } from '../../../src/seasonal/ordersSeason';
import { previewSeasonStatus } from '../../../shared/seasonal';
import { CustomerOrderCard } from '../../../src/components/orders/CustomerOrderCard';

const source = (path: string) => readFileSync(path, 'utf8');
const code = (path: string) => source(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const order = (over: Partial<OrderRecord> = {}): OrderRecord => ({
  id: 'MH-T-1', publicReference: 'MH-T-1', serviceType: 'data', network: 'mtn', paymentMethod: 'paystack', amountGhc: 23.5,
  bundle: { id: 'server-bundle-MH-T-1', network: 'mtn', dataAmount: '5GB', dataBytesValue: 0, validity: 'Standard', validityCategory: 'Daily', priceGhc: 23.5 },
  recipientPhone: '0241234567', buyerRecipientVisible: true, status: 'placed', serverStatus: 'queued',
  createdAt: '2026-11-24T10:00:00Z', updatedAt: '2026-11-24T10:00:00Z', ...over,
});
const view = (over: Partial<OrderRecord>) => orderReceiptView(order(over));
const allWords = (v: ReturnType<typeof orderReceiptView>) => [v.title, v.label, v.next, v.amountLabel, v.amountNote, v.paymentLine, ...v.steps.flatMap(s => [s.label, s.detail])].join(' | ');

/* ───────── Status truth: the nineteen states must not collapse ───────── */

test('payment states: unconfirmed, confirmed, queued, with the supplier, processing, delivered', () => {
  const pending = view({ serverStatus: 'pending_payment', status: 'verifying' });
  assert.equal(pending.tone, 'pending');
  assert.equal(pending.amountLabel, 'Order total', 'an unconfirmed payment is never called an amount paid');
  assert.equal(pending.amountNote, 'Payment not confirmed yet');
  assert.equal(pending.paymentConfirmed, false);
  assert.equal(pending.festive, false, 'an unconfirmed payment gets no festive decoration');
  assert.deepEqual(pending.steps.map(s => s.state), ['current', 'upcoming', 'upcoming']);

  for (const serverStatus of ['paid', 'queued']) {
    const v = view({ serverStatus });
    assert.equal(v.title, 'Payment confirmed'); assert.equal(v.label, 'Queued for delivery'); assert.equal(v.amountLabel, 'Amount paid');
    assert.deepEqual(v.steps.map(s => s.state), ['done', 'current', 'upcoming']);
    assert.equal(v.steps[1].detail, 'Queued after payment');
    assert.equal(v.supplierDelivered, false, 'a confirmed payment is not a delivery');
  }
  for (const serverStatus of ['submitted', 'processing']) {
    const v = view({ serverStatus, status: 'processing' });
    assert.equal(v.label, 'Processing'); assert.equal(v.steps[1].detail, 'Being processed now'); assert.equal(v.steps[2].state, 'upcoming');
  }
  const delivered = view({ serverStatus: 'delivered', status: 'delivered' });
  assert.equal(delivered.title, 'Your data has been delivered'); assert.equal(delivered.tone, 'success');
  assert.deepEqual(delivered.steps.map(s => s.state), ['done', 'done', 'done']);
  assert.equal(delivered.supplierDelivered, true); assert.equal(delivered.festive, true);
});

test('stopped orders: failed, manual review and resolution review stop the journey where it stopped', () => {
  const unpaidFailed = view({ serverStatus: 'failed', status: 'failed' });
  assert.equal(unpaidFailed.tone, 'attention'); assert.equal(unpaidFailed.amountLabel, 'Order total');
  assert.equal(unpaidFailed.steps[0].state, 'halted', 'a failed attempt without a confirmed payment never shows the payment as done');
  const review = view({ serverStatus: 'processing', manualReview: true });
  assert.equal(review.title, 'Your order needs support review'); assert.equal(review.label, 'Manual review');
  assert.deepEqual(review.steps.map(s => s.state), ['done', 'halted', 'upcoming'], 'manual review does not keep glowing as progress');
  assert.equal(review.festive, false);
  const resolution = view({ serverStatus: 'failed', status: 'failed', customerResolution: 'review' });
  assert.equal(resolution.journeyKind, 'resolution'); assert.equal(resolution.label, 'Resolution review');
  assert.match(resolution.next, /do not repeat the order/);
  assert.deepEqual(resolution.steps.map(s => [s.label, s.state]), [['Payment received', 'done'], ['Support review', 'halted'], ['Outcome', 'upcoming']]);
});

test('refunds: pending, legacy refunded and verified stay distinct; only a verified resolution claims a refund', () => {
  const pending = view({ serverStatus: 'refund_pending', status: 'failed', customerResolution: 'refund_pending' });
  assert.equal(pending.tone, 'refund'); assert.equal(pending.title, 'Customer refund awaiting verification');
  assert.equal(pending.amountNote, 'Refund not confirmed yet');
  assert.deepEqual(pending.steps.at(-1), { key: 'outcome', label: 'Refund confirmation', detail: 'Not confirmed yet', state: 'upcoming' }, 'no visible "Refund verified" until it is');

  for (const serviceType of ['data', 'afa', 'airtime'] as const) {
    const legacy = view({ serviceType, serverStatus: 'refunded', status: 'failed' });
    assert.equal(legacy.label, 'Refund review', serviceType);
    assert.equal(legacy.title, 'Refund confirmation pending', serviceType);
    assert.doesNotMatch(legacy.title + legacy.label, /^Refunded$|Refund verified/, `${serviceType}: a refunded status alone is not a verified refund`);
    assert.equal(legacy.steps.at(-1)!.state, 'upcoming');
    assert.doesNotMatch(legacy.steps.map(s => s.label).join(' '), /Refund verified/, serviceType);
  }
  const verified = view({ serverStatus: 'refunded', status: 'failed', customerResolution: 'refund_confirmed' });
  assert.equal(verified.title, 'Refund verified'); assert.equal(verified.label, 'Refunded'); assert.equal(verified.tone, 'resolved');
  assert.equal(verified.amountNote, 'Refund verified'); assert.equal(verified.steps.at(-1)!.state, 'done');
  assert.equal(verified.festive, false);
});

test('manual completion and external remedies are operator outcomes, never supplier delivery or a Paystack refund', () => {
  const manual = view({ serverStatus: 'failed', status: 'failed', customerResolution: 'manual_fulfillment' });
  assert.equal(manual.title, 'Service completed manually'); assert.match(manual.next, /does not claim delivery by the original supplier/);
  assert.equal(manual.supplierDelivered, false, 'no celebration for a manual remedy');
  assert.deepEqual(manual.steps.at(-1), { key: 'outcome', label: 'Completed by support', detail: 'Through another channel', state: 'done' });
  const external = view({ serverStatus: 'failed', status: 'failed', customerResolution: 'external_compensation' });
  assert.equal(external.title, 'External remedy recorded'); assert.match(external.next, /not a Paystack-verified refund/);
  assert.equal(external.amountNote, 'Remedy recorded by support');
  assert.doesNotMatch(allWords(external), /Refund verified|Refunded/);
});

test('cancelled and expired payments are closed, never confirmed, and still caution about deducted money', () => {
  for (const serverStatus of ['cancelled', 'expired']) {
    for (const serviceType of ['data', 'airtime', 'instant_bundle', 'afa'] as const) {
      const v = view({ serviceType, serverStatus, status: 'verifying' });
      assert.equal(v.journeyKind, 'closed', `${serviceType} ${serverStatus}`);
      assert.equal(v.title, 'Payment was not completed', `${serviceType} ${serverStatus}: never "Confirming your payment"`);
      assert.equal(v.amountLabel, 'Order total');
      assert.match(v.next, /If money was deducted, contact support/);
      assert.doesNotMatch(v.paymentLine, /Confirmed/);
      assert.equal(v.festive, false);
    }
  }
});

test('assisted orders: complimentary and operator-recorded never claim a customer payment', () => {
  const free = view({ serverStatus: 'delivered', status: 'delivered', paymentBasis: 'complimentary' });
  assert.equal(free.amountLabel, 'Complimentary'); assert.match(free.amountNote, /No customer payment/);
  assert.equal(free.paymentConfirmed, false); assert.match(free.paymentLine, /no payment taken/);
  assert.equal(free.steps[0].label, 'Complimentary');
  const recorded = view({ serverStatus: 'queued', paymentBasis: 'operator_recorded' });
  assert.equal(recorded.amountLabel, 'Recorded payment'); assert.match(recorded.paymentLine, /not a Paystack payment/);
  assert.equal(recorded.steps[0].label, 'Payment recorded'); assert.equal(recorded.steps[0].state, 'done');
  assert.equal(recorded.steps[1].detail, 'Queued for the supplier', 'no "after payment" for an assisted order');
  // A stopped assisted order is never shown as progressing (refunded, cancelled).
  assert.equal(customerOrderStatus(order({ serverStatus: 'refunded', status: 'failed', paymentBasis: 'complimentary' })).group, 'attention');
  assert.deepEqual(customerOrderStatus(order({ serverStatus: 'cancelled', status: 'verifying', paymentBasis: 'operator_recorded' })), { group: 'cancelled', label: 'Cancelled' });
  assert.equal(view({ serverStatus: 'cancelled', status: 'verifying', paymentBasis: 'complimentary' }).festive, false);
  // The receipt shows "No charge" rather than a GH₵0.00 price for a complimentary order stored at zero.
  assert.match(source('src/components/checkout/OrderStatusModal.tsx'), /activeOrder\.paymentBasis === 'complimentary' && !\(activeOrder\.amountGhc > 0\) \? 'No charge'/);
  // Card and receipt agree for a stopped assisted order.
  const stopped = order({ serverStatus: 'failed', status: 'failed', paymentBasis: 'operator_recorded' });
  assert.equal(orderReceiptView(stopped).label, customerOrderStatus(stopped).label);
  assert.equal(orderReceiptView(stopped).label, 'Support review');
});

test('service wording: airtime is not a bundle, AFA is a registration, Marketplace and checkers keep their own stages', () => {
  const airtime = (serverStatus: string) => view({ serviceType: 'airtime', serverStatus, bundle: { ...order().bundle, id: 'airtime-mtn-20', dataAmount: 'GH₵20.00 Airtime' } });
  assert.equal(airtime('delivered').title, 'Your airtime has been delivered');
  for (const s of ['paid', 'processing', 'delivered']) assert.doesNotMatch(airtime(s).title + airtime(s).next, /bundle|data has/i, s);
  const afa = (serverStatus: string, extra = {}) => view({ serviceType: 'afa', serverStatus, ...extra });
  assert.equal(afa('delivered').title, 'AFA registration confirmed'); assert.equal(afa('delivered').label, 'Registered'); assert.equal(afa('delivered').doneWord, 'Registered');
  assert.equal(afa('submitted').title, 'Registration in progress'); assert.equal(afa('submitted').steps[1].detail, 'Submitted for registration');
  assert.equal(afa('processing', { manualReview: true }).title, 'Your registration needs support review');
  for (const s of ['delivered', 'processing']) assert.doesNotMatch(allWords(afa(s)), /data|bundle/i);
  const market = (marketplaceStatus: string, serverStatus = 'paid') => view({ serviceType: 'marketplace', serverStatus, marketplaceStatus, bundle: { ...order().bundle, id: 'marketplace-x', description: 'Earbuds' } });
  assert.equal(market('ready_for_pickup').steps[1].detail, 'Ready for pickup');
  assert.equal(market('completed', 'delivered').title, 'Order completed'); assert.equal(market('completed', 'delivered').doneWord, 'Completed');
  assert.equal(market('refunded', 'processing').title, 'Refund confirmation pending');
  assert.equal(view({ serviceType: 'results_checker', serverStatus: 'delivered' }).title, 'Your checker purchase is ready');
  // Marketplace keeps its own words in every stage the server records, including a paid order Admin has not moved.
  for (const marketplaceStatus of ['pending_payment', 'paid', null, 'awaiting_fulfilment']) {
    const m = view({ serviceType: 'marketplace', serverStatus: 'paid', marketplaceStatus, bundle: { ...order().bundle, id: 'marketplace-x', description: 'Earbuds' } });
    assert.doesNotMatch(allWords(m) + m.notYetDone, /network|bundle|data|SIM/i, String(marketplaceStatus));
  }
  const legacyMarket = view({ serviceType: 'marketplace', serverStatus: 'delivered', status: 'delivered', marketplaceStatus: null, bundle: { ...order().bundle, id: 'marketplace-x' } });
  assert.equal(legacyMarket.title, 'Order completed');
  // Results Checker and AFA never mention the network; AFA's caution speaks of registration.
  for (const serviceType of ['results_checker', 'afa'] as const) assert.doesNotMatch(allWords(view({ serviceType, serverStatus: 'paid' })), /network/i, serviceType);
  assert.match(view({ serviceType: 'afa', serverStatus: 'paid' }).notYetDone, /registration is complete/);
  // AFA review wording follows the card's rule: a manual flag on an unpaid or cancelled AFA order is not "support review".
  for (const serverStatus of ['pending_payment', 'cancelled', 'refund_pending']) {
    const afaReview = order({ serviceType: 'afa', serverStatus, status: 'verifying', manualReview: true });
    assert.doesNotMatch(orderReceiptView(afaReview).title, /support review/i, serverStatus);
    assert.notEqual(customerOrderStatus(afaReview).group, 'attention', serverStatus);
  }
  assert.equal(receiptService(order({ serviceType: undefined, bundle: { ...order().bundle, id: 'instant-mtn-video-3' } })), 'instant');
  assert.equal(view({ serviceType: 'instant_bundle', serverStatus: 'delivered' }).title, 'Your bundle has been delivered');
});

test('a device record the server has never answered for claims nothing and is checked at least once', () => {
  const unchecked = view({ serverStatus: undefined, status: 'delivered' });
  assert.equal(unchecked.unchecked, true);
  assert.equal(unchecked.paymentConfirmed, false); assert.equal(unchecked.amountLabel, 'Order total');
  assert.equal(unchecked.paymentLine, 'Last known on this device');
  assert.equal(unchecked.supplierDelivered, false, 'never celebrated from a device guess');
  assert.notEqual(unchecked.steps[0].state, 'done');
  assert.match(code('src/components/checkout/OrderStatusModal.tsx'), /const isTerminal = Boolean\(activeOrder\?\.serverStatus\) && \(/);
});

test('no receipt wording invents a percentage, a timer or a delivery estimate', () => {
  const states: Partial<OrderRecord>[] = ['pending_payment', 'paid', 'queued', 'submitted', 'processing', 'delivered', 'failed', 'refund_pending', 'refunded', 'cancelled', 'expired']
    .flatMap(serverStatus => (['data', 'airtime', 'instant_bundle', 'afa', 'marketplace', 'results_checker'] as const).map(serviceType => ({ serverStatus, serviceType })));
  for (const s of states) assert.doesNotMatch(allWords(view(s)), /\d+\s?%|\b\d+\s?(min|minute|hour)s?\b|within|guarantee|instant delivery/i, JSON.stringify(s));
  // Festive decoration only while things go well.
  for (const s of states) {
    const v = view(s);
    assert.equal(v.festive, ['in_progress', 'delivered'].includes(v.group), JSON.stringify(s));
  }
});

/* ───────── The card ───────── */

test('cards: one control, complimentary is never shown as money, savings only once paid', () => {
  const html = (o: OrderRecord) => renderToStaticMarkup(React.createElement(CustomerOrderCard, { order: o, status: customerOrderStatus(o), onOpen() {}, now: new Date('2026-11-24T12:00:00Z') }));
  const free = html(order({ serverStatus: 'delivered', status: 'delivered', paymentBasis: 'complimentary' }));
  assert.match(free, /Complimentary/); assert.doesNotMatch(free, /GH₵23\.50/);
  const pricing = { regularMinor: 2450, discountMinor: 100, paidMinor: 2350 };
  assert.match(html(order({ serverStatus: 'delivered', status: 'delivered', commercialPricing: pricing })), /Saved GH₵1\.00/);
  assert.doesNotMatch(html(order({ serverStatus: 'cancelled', status: 'verifying', commercialPricing: pricing })), /Saved/, 'a cancelled payment saved nothing');
  assert.equal(orderSaving(order({ commercialPricing: pricing }), 'awaiting_payment'), 0);
  const card = source('src/components/orders/CustomerOrderCard.tsx');
  assert.equal((card.match(/<button/g) || []).length, 1);
  assert.ok(!card.includes('publicReference') && !card.includes('fetch(') && !card.includes('lookupOrderOnServer'));
});

/* ───────── Privacy, isolation and synchronisation ───────── */

test('device orders another account made here stay hidden after sign-out or an account switch', () => {
  const guestBuy = order({ id: 'MH1', publicReference: 'MH-G' });
  const amaBuy = order({ id: 'MH2', publicReference: 'MH-A', ownerUserId: 'usr_ama' });
  const kofiBuy = order({ id: 'MH3', publicReference: 'MH-K', ownerUserId: 'usr_kofi' });
  const all = [guestBuy, amaBuy, kofiBuy];
  assert.deepEqual(visibleDeviceOrders(all, null).map(o => o.id), ['MH1'], 'a guest sees only signed-out purchases');
  assert.deepEqual(visibleDeviceOrders(all, 'usr_ama').map(o => o.id), ['MH1', 'MH2']);
  assert.deepEqual(visibleDeviceOrders(all, 'usr_kofi').map(o => o.id), ['MH1', 'MH3']);
  const ctx = code('src/context/AppContext.tsx');
  assert.match(ctx, /ownerUserId: user\?\.id,/);
  assert.match(ctx, /setIsStatusModalOpen\(false\); setActiveOrder\(null\);/, 'signing out closes and forgets an open receipt');
  assert.match(code('src/components/orders/OrdersPage.tsx'), /visibleDeviceOrders\(localOrders, user\?\.id\)/);
});

test('a live status update reaches the open receipt for every service, carries every status field, and only status fields', () => {
  const ctx = code('src/context/AppContext.tsx');
  const update = ctx.slice(ctx.indexOf('const updateOrderStatus = ('), ctx.indexOf('const [authContextMessage'));
  for (const field of ['customerResolution', 'paymentBasis', 'marketplaceStatus', 'manualReview', 'serverStatus', 'statusMessage']) assert.match(update, new RegExp(`${field}:`), field);
  assert.doesNotMatch(update, /recipientPhone|amountGhc|buyerRecipientVisible|\['afa', 'data'\]/, 'no owner fields, and no service is left out');
  assert.match(update, /setActiveOrder\(\(current\) => \(current && matches\(current\) \? apply\(current\) : current\)\)/, 'never replaces a different open order');
  const page = code('src/components/orders/OrdersPage.tsx');
  const sync = page.slice(page.indexOf('const ref = activeOrder?.publicReference;'), page.indexOf('}, [activeOrder]);'));
  for (const field of ['customerResolution', 'paymentBasis', 'marketplaceStatus']) assert.match(sync, new RegExp(`${field}: activeOrder\\.${field}`), field);
  assert.doesNotMatch(sync, /recipientPhone|amountGhc|buyerRecipientVisible|bundle/, 'a masked lookup never overwrites owner details');
});

test('status changes are announced by one live region that stays mounted', () => {
  const modal = code('src/components/checkout/OrderStatusModal.tsx');
  const live = modal.indexOf('<p role="status" aria-live="polite" className="sr-only">'), keyed = modal.indexOf('<section key={view.group}');
  assert.ok(live > 0 && live < keyed, 'the live region sits outside the section that remounts on a status change');
  assert.equal((modal.match(/role="status"/g) || []).length, 2, 'the status line, and the copy-failure note');
});

test('a celebration needs the server to have said "not yet" while this receipt was open', () => {
  const modal = code('src/components/checkout/OrderStatusModal.tsx');
  assert.match(modal, /if \(serverStatus !== 'delivered'\) seenUndelivered\.current = lookupReference;/);
  assert.match(modal, /if \(!isStatusModalOpen\) seenUndelivered\.current = null;/, 'a reopened receipt never replays it');
  assert.match(modal, /const justDelivered = Boolean\(isStatusModalOpen && view\?\.supplierDelivered && lookupReference && seenUndelivered\.current === lookupReference\);/);
  assert.equal(view({ serverStatus: 'delivered', status: 'delivered', customerResolution: 'manual_fulfillment' }).supplierDelivered, false);
});

test('tracking: only the latest lookup opens a receipt, and never over one the customer opened meanwhile', () => {
  const panel = code('src/components/orders/TrackOrderPanel.tsx');
  assert.match(panel, /const mine = \+\+ticket\.current;/);
  assert.match(panel, /if \(!alive\.current \|\| mine !== ticket\.current\) return;/);
  assert.match(panel, /if \(receiptOpen\.current\) return;\s*openOrderStatus\(orderRecordFromLookup\(res\.order\)\);/);
});

test('the receipt drops late answers, never overlaps its checks, and keeps the existing schedule', () => {
  const modal = code('src/components/checkout/OrderStatusModal.tsx');
  assert.match(modal, /let alive = true, inFlight = false;/);
  assert.match(modal, /if \(!alive\) return;/);
  assert.match(modal, /if \(inFlight\) return;/);
  assert.match(modal, /\(shown\.publicReference \|\| shown\.id\) === lookupReference/, 'an answer for another order is ignored');
  assert.match(modal, /return \(\) => \{ alive = false; stop\(\); \};/);
  assert.match(modal, /\}, \[isStatusModalOpen, lookupReference, isTerminal\]\);/, 'the loop no longer restarts on every app render');
  // 3.7.3: one schedule, in utils/receiptChecks: still 3 s while the order can move (performanceMobile373 runs it).
  assert.equal((modal.match(/setInterval\(|startReceiptChecks\(/g) || []).length, 1); assert.match(modal, /startReceiptChecks\(\{\s*check: fetchServerStatus,/);
  // Only the public reference is shown or copied; no payment or internal identifiers.
  assert.match(modal, /navigator\.clipboard\.writeText\(displayRef\)/);
  for (const internal of ['paymentReference', 'supplier_order_id', 'supplier_response', 'failure_reason', 'admin_note', 'resolution_json', 'customer_email']) assert.ok(!modal.includes(internal), internal);
  // The page makes no lookups of its own; tracking keeps the reference-only contract.
  assert.ok(!code('src/components/orders/OrdersPage.tsx').includes('lookupOrderOnServer'));
  assert.ok(!code('src/components/orders/TrackOrderPanel.tsx').includes('buyerRecipientVisible'));
});

test('one primary action fits the situation; problems come before selling; blocked services are never repeated', () => {
  const modal = code('src/components/checkout/OrderStatusModal.tsx');
  assert.match(modal, /const needsHelp = view\.tone === 'attention' \|\| view\.tone === 'refund';/);
  assert.match(modal, /const primary = activeOrder\.serviceType === 'results_checker' \? 'results' : needsHelp \? 'help' : delivered && repeatable && !pausedIncident \? 'buy' : 'done';/, '3.6.3: never Buy again for a paused service');
  assert.match(modal, /const repeatable = view\.service === 'data' \|\| view\.service === 'airtime' \|\| view\.service === 'instant';/, 'Marketplace, AFA and checkers are never offered again from a receipt');
  assert.equal(receiptService(order({ serviceType: undefined, bundle: { ...order().bundle, id: 'marketplace-legacy' } })), 'marketplace', 'a legacy Marketplace row without a service type is not repeatable');
  assert.match(modal, /void buyAgain\(reference, \{ beforeOpen: closeOrderStatus, /, 'Smart Buy Again keeps the authoritative reorder contract');
  assert.doesNotMatch(modal, /openCheckout\(|initializePayment|paystack/i, 'the receipt never opens a payment by itself');
  assert.doesNotMatch(modal, /links and tracks every purchase/, 'no claim that past guest purchases join a new account');
});

/* ───────── Season ───────── */

test('the season decorates Orders and receipts that are going well, for guests and members, on the existing calendar', () => {
  const on = (date: string) => ({ shellActive: true, status: previewSeasonStatus('christmas-2026', date) });
  assert.deepEqual(ordersSeasonAttributes({ shellActive: false, status: previewSeasonStatus('christmas-2026', '2026-12-10') }), {});
  assert.equal(ordersSeasonAttributes(on('2026-12-10'))['data-or-look'], 'christmas');
  assert.equal(ordersSeasonAttributes(on('2026-12-25'))['data-or-look'], 'christmas-day');
  assert.equal(ordersSeasonAttributes(on('2026-12-31'))['data-or-look'], 'new-year');
  assert.equal(ordersLook(previewSeasonStatus('christmas-2026', '2027-01-02')), 'new-year');
  const modal = code('src/components/checkout/OrderStatusModal.tsx');
  assert.match(modal, /data-rc-mood=\{view\.festive \? 'bright' : 'serious'\}/);
  assert.match(modal, /\{\.\.\.\(view\.festive \? ordersSeasonAttributes\(season\) : \{\}\)\}/, 'serious receipts never carry the season');
  assert.match(source('src/components/checkout/receipt.css'), /\.mh-rc\[data-rc-mood="serious"\]::after \{ content: none !important; \}/, 'no seasonal sheet bow on a serious receipt');
  const seasonal = source('src/seasonal/Seasonal.tsx');
  assert.match(seasonal, /export function SeasonalOrders[\s\S]*?if \(!season\.shellActive \|\| season\.status\.pack !== 'christmas-2026'\) return <>\{fallback\}<\/>;/);
  assert.match(seasonal, /lazy\(loadOrders\)/, 'the seasonal Orders look is its own lazy chunk');
  assert.ok(!code('src/components/orders/OrdersPage.tsx').includes('<Seasonal slot='), 'no guest-only page accent on Orders');
});

/** Every selector of every rule in a stylesheet, with keyframes and @media wrappers removed. */
function selectorsOf(cssText: string): string[] {
  const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/@media[^{]+\{/g, '');
  const out: string[] = [];
  for (const rule of css.match(/[^{}]+\{[^{}]*\}/g) || []) {
    let depth = 0, current = '';
    for (const ch of rule.slice(0, rule.indexOf('{'))) {
      if (ch === '(') depth++; if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(current.trim()); current = ''; } else current += ch;
    }
    out.push(current.trim());
  }
  return out.filter(Boolean);
}

test('every style is scoped: ordinary Orders and receipt, and the seasonal re-tone', () => {
  for (const s of selectorsOf(source('src/components/orders/orders.css'))) assert.match(s, /^\.mh-or\b/, s);
  for (const s of selectorsOf(source('src/components/checkout/receipt.css'))) assert.match(s, /^\.mh-rc\b/, s);
  for (const s of selectorsOf(source('src/seasonal/christmas/orders/orders.css'))) assert.match(s, /^\.mh-(or|rc)\[data-or-season="christmas"\]/, s);
});

test('motion is finite, transform and opacity only, and reduced motion holds it still', () => {
  const files = ['src/components/orders/orders.css', 'src/components/checkout/receipt.css', 'src/seasonal/christmas/orders/orders.css'];
  for (const file of files) {
    const css = source(file);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, file);
    for (const block of css.match(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g) || []) {
      const props = [...block.matchAll(/([a-z-]+)\s*:/g)].map(m => m[1]);
      for (const prop of props) assert.ok(['opacity', 'transform', 'background-position'].includes(prop), `${file}: ${block.slice(0, 40)} animates ${prop}`);
    }
    // The only endless loops are the loading shimmer and the refresh spinner, which exist only while a request runs.
    const infinite = (css.match(/animation:[^;]*infinite[^;]*;/g) || []);
    for (const rule of infinite) assert.match(rule, /mh-or-shimmer|mh-or-spin/, `${file}: ${rule}`);
  }
  assert.match(source('src/components/orders/orders.css'), /\.mh-or \.mh-or-refresh\[aria-busy="true"\] svg \{ animation: mh-or-spin/);
});

/* ───────── The Data page's Welcome Offer, inside the page margins ───────── */

test('the Welcome Offer sits in the title panel under the store title, after payment recovery, in a fixed-height line (3.7 closeout)', () => {
  const page = source('src/components/data/DataPage.tsx');
  const root = page.indexOf('<div className="mh-ds py-4'), container = page.indexOf('<div className="max-w-7xl mx-auto', root);
  const banner = page.indexOf('<PendingPaymentBanner />', container), hero = page.indexOf('<DataStoreHero', container);
  assert.ok(root > 0 && container > root && banner > container && hero > banner, 'container > recovery > title panel');
  assert.match(page.slice(hero, hero + 400), /offer=\{dataProductMode==='data'&&welcomeAdvertShown\(welcomeOffer,directCatalogConfirmed\(\)\)/);
  assert.doesNotMatch(page, /WelcomeOfferNotice/);
  const hero2 = source('src/components/data/DataStoreHero.tsx');
  assert.ok(hero2.indexOf('mh-ds-offer-slot') > hero2.indexOf('id="data-store-title"'), 'below the store title');
  assert.match(source('src/components/data/dataStore.css'), /\.mh-ds \.mh-ds-offer-slot \{ grid-area: offer; display: flex; align-items: center; min-width: 0; height: 28px;/, 'one fixed height, whatever it holds');
});
