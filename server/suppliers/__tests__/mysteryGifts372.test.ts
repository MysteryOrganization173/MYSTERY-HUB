import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSync, transformSync } from 'esbuild';
import {
  giftStatus, publicGift, readPublicGift, unavailableGift, GIFT_ALLOWANCE, GIFT_NETWORKS, GIFT_STATUSES, PUBLIC_GIFT_KEYS,
  type GiftCustomerResolution, type GiftStatus, type PublicGreetingGift,
} from '../../../shared/mysteryGifts.js';
import type { CustomerResolution, OrderResolution } from '../../types/orderResolution.js';
import { toSafePublicOrder, type OrderRecord, type OrderStatus } from '../../types/orders.js';
import { AUTHORITATIVE_PRODUCTS } from '../../data/productCatalog.js';
import { dataOrderPresentation } from '../../../src/utils/dataPurchasePresentation.js';
import { customerOrderStatus } from '../../../src/utils/customerOrderPresentation.js';
import { GiftReveal, giftFromLine, giftStatusCopy, GIFT_NETWORK_COPY } from '../../../src/greetings/gifts/GiftReveal.js';
import {
  GiftChoice, GiftPicker, cedis, giftCheckout, giftProblems, giftProductsFromCatalogue, giftQuoteFromServer, giftSelection, shownGiftNetwork,
  type GiftProduct, type GiftQuote,
} from '../../../src/greetings/gifts/GiftSender.js';
import { DATA_NETWORK_CHOICES } from '../../../src/components/data/DataNetworkSelector.js';

/* Mystery Gifts V1 (3.7.2): the dormant public gift contract, its derivation from the existing order model, and the
   isolated sender/recipient components. No gift can exist yet; these tests pin what a recipient may ever learn. */

const root = path.resolve(import.meta.dirname, '../../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
// Source without its comments, by esbuild's own parser (strings stay intact, unlike a regex comment stripper).
const code = (file: string) => transformSync(read(file), { loader: file.endsWith('x') ? 'tsx' : 'ts', jsx: 'preserve', legalComments: 'none', tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true } } }).code;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const render = (el: React.ReactElement) => renderToStaticMarkup(el);
const h = React.createElement;
const noop = () => {};

// The values must stay the same as the server's own resolution vocabulary.
type Same<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
const resolutionsMatch: Same<GiftCustomerResolution, CustomerResolution> = true;

const STATUSES: OrderStatus[] = ['pending_payment', 'paid', 'queued', 'submitted', 'processing', 'delivered', 'failed', 'refund_pending', 'refunded', 'cancelled', 'expired'];
const PAYMENT: OrderRecord['payment_status'][] = ['pending', 'success', 'failed', 'cancelled', 'expired'];
const RESOLUTIONS: (OrderResolution | null)[] = [
  null,
  { version: 1, stage: 'under_review', outcome: 'paystack_refund', lastActor: 'admin', updatedAt: '2026-12-02T10:00:00Z' },
  { version: 1, stage: 'refund_pending', outcome: 'paystack_refund', lastActor: 'admin', updatedAt: '2026-12-02T10:00:00Z' },
  { version: 1, stage: 'resolved', outcome: 'paystack_refund', lastActor: 'admin', updatedAt: '2026-12-02T10:00:00Z' },
  { version: 1, stage: 'resolved', outcome: 'manual_fulfillment', lastActor: 'admin', updatedAt: '2026-12-02T10:00:00Z' },
  { version: 1, stage: 'resolved', outcome: 'external_compensation', lastActor: 'admin', updatedAt: '2026-12-02T10:00:00Z' },
];
const product = Object.values(AUTHORITATIVE_PRODUCTS).find(p => p.network === 'mtn' && p.dataAmount === '5GB') ?? Object.values(AUTHORITATIVE_PRODUCTS)[0];

/** A synthetic, fully populated Data order: every private field carries a recognisable value that must never leak. */
function order(patch: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'ord_guest_SYNTHETICxyz', user_id: 'user_synthetic_buyer', public_reference: 'MH-20261202-482913',
    customer_name: 'Akosua Synthetic', customer_email: 'akosua.synthetic@example.test', customer_phone: '0245550187', recipient_phone: '0245550187',
    network: product.network, service_type: 'data', product_id: product.id, product_name_snapshot: `${product.network.toUpperCase()} ${product.dataAmount}`,
    bundle_size_snapshot: product.dataAmount, amount: 4321, currency: 'GHS', status: 'delivered', payment_provider: 'paystack',
    payment_reference: 'MH_PAY_MTN_1764666000000_482913', payment_status: 'success', supplier_provider: 'success_biz_hub', supplier_order_id: 'SBH-SUPPLIER-77123',
    supplier_response: '{"secret":"supplier-response"}', supplier_cost_minor: 3999, supplier_offer_ref: 'offer-ref-9911', supplier_last_checked_at: '2026-12-02T10:05:00Z',
    failure_reason: 'synthetic-failure-reason', manual_review: false, admin_note: 'private admin note', created_at: '2026-12-02T09:59:00Z', updated_at: '2026-12-02T10:05:00Z',
    paid_at: '2026-12-02T10:00:00Z', submitted_at: '2026-12-02T10:01:00Z', delivered_at: '2026-12-02T10:04:00Z',
    commercial_context: { regularMinor: 4421, discountMinor: 100, paidMinor: 4321 } as OrderRecord['commercial_context'],
    referrer_user_id: 'user_referrer_secret', referral_code: 'REFSECRET',
    ...patch,
  };
}
/** What a recipient could learn: the existing public projection, then the gift projection over it. */
const giftFor = (o: OrderRecord) => publicGift(toSafePublicOrder(o) as Parameters<typeof publicGift>[0]);
const every = function* () {
  for (const status of STATUSES) for (const payment_status of PAYMENT) for (const manual_review of [false, true]) for (const resolution_json of RESOLUTIONS)
    yield order({ status, payment_status, manual_review, resolution_json });
};

/* ───────────────────────── The contract and its derivation ───────────────────────── */

test('the gift vocabulary is fixed: three networks, five statuses, five public keys, catalogue-shaped allowances', () => {
  assert.equal(resolutionsMatch, true);
  assert.deepEqual([...GIFT_NETWORKS], ['mtn', 'telecel', 'airteltigo']);
  assert.deepEqual([...GIFT_STATUSES], ['pending', 'delivered', 'review', 'undeliverable', 'status_unavailable']);
  assert.deepEqual([...PUBLIC_GIFT_KEYS], ['schemaVersion', 'kind', 'network', 'allowance', 'status']);
  // Every Data product the server sells has an allowance the contract accepts.
  for (const p of Object.values(AUTHORITATIVE_PRODUCTS)) assert.match(p.dataAmount, GIFT_ALLOWANCE, p.id);
  for (const bad of ['', '5 GB', '5gb', '0GB', 'Unlimited', '5GB<script>', '00005GB', '12345GB']) assert.doesNotMatch(bad, GIFT_ALLOWANCE, bad);
});

test('the founder scenarios map to the expected recipient status', () => {
  const at = (patch: Partial<OrderRecord>) => giftFor(order(patch))?.status ?? null;
  // No confirmed payment: nothing is shown.
  assert.equal(at({ status: 'pending_payment', payment_status: 'pending', paid_at: null }), null);
  assert.equal(at({ status: 'cancelled', payment_status: 'cancelled', paid_at: null }), null);
  assert.equal(at({ status: 'expired', payment_status: 'expired', paid_at: null }), null);
  assert.equal(at({ status: 'failed', payment_status: 'failed', paid_at: null }), null);
  // Even when support is looking at an unpaid attempt.
  assert.equal(at({ status: 'pending_payment', payment_status: 'pending', paid_at: null, manual_review: true }), null);
  // Paid, delivery in progress: pending (never "delivered" on payment alone).
  for (const status of ['paid', 'queued', 'submitted', 'processing'] as const) assert.equal(at({ status, delivered_at: null }), 'pending', status);
  assert.equal(at({ status: 'delivered' }), 'delivered');
  // Uncertain, failed after payment, or under review: being checked.
  assert.equal(at({ status: 'processing', manual_review: true }), 'review');
  assert.equal(at({ status: 'failed' }), 'review');
  assert.equal(at({ status: 'failed', resolution_json: RESOLUTIONS[1] }), 'review');
  // Refund paths and remedies: the gift will not arrive this way.
  assert.equal(at({ status: 'refund_pending', resolution_json: RESOLUTIONS[2] }), 'undeliverable');
  assert.equal(at({ status: 'refunded', resolution_json: RESOLUTIONS[3] }), 'undeliverable');
  assert.equal(at({ status: 'failed', resolution_json: RESOLUTIONS[5] }), 'undeliverable');
  // Support completed the service through another channel: delivered, as the receipt says.
  assert.equal(at({ status: 'failed', resolution_json: RESOLUTIONS[4] }), 'delivered');
  // A refunded status the projection still calls "review" stays under review, not undeliverable or delivered.
  assert.equal(at({ status: 'refunded' }), 'review');
  // Refund states without a recorded payment success: delivery did not complete, as the receipt says.
  assert.equal(at({ status: 'refund_pending', payment_status: 'pending' }), 'undeliverable');
  // Only ordinary customer-paid Data is a gift.
  assert.equal(at({ payment_provider: 'complimentary', payment_status: 'not_required' }), null);
  assert.equal(at({ payment_provider: 'admin_external', payment_status: 'recorded' }), null);
  for (const service_type of ['airtime', 'instant_bundle', 'marketplace', 'afa', 'results_checker'] as const) assert.equal(at({ service_type }), null, service_type);
});

test('across every combination the gift agrees with the receipt and the Orders list, never ahead of them', () => {
  let shown = 0;
  for (const o of every()) {
    const pub = toSafePublicOrder(o);
    const status = giftStatus(pub as Parameters<typeof giftStatus>[0]);
    const receipt = dataOrderPresentation(pub.status, pub.manual_review, pub.customer_resolution, pub.payment_basis);
    const list = customerOrderStatus({ serviceType: 'data', serverStatus: pub.status, status: 'processing', manualReview: pub.manual_review, customerResolution: pub.customer_resolution, paymentBasis: pub.payment_basis } as Parameters<typeof customerOrderStatus>[0]);
    const where = JSON.stringify({ s: o.status, p: o.payment_status, m: o.manual_review, r: o.resolution_json?.stage + ':' + o.resolution_json?.outcome });
    if (status === null) {
      // Hidden exactly when the receipt has no confirmed payment either.
      assert.equal(receipt.paymentConfirmed, false, where);
      continue;
    }
    shown++;
    assert.ok(receipt.paymentConfirmed, `a gift is never shown without a confirmed payment ${where}`);
    if (status === 'delivered') { assert.ok(receipt.delivered, `delivered only when the receipt says delivered ${where}`); assert.ok(['delivered', 'resolved'].includes(list.group), where); }
    if (status === 'pending') { assert.equal(receipt.delivered, false, where); assert.equal(list.group, 'in_progress', where); }
    if (status === 'review') { assert.equal(list.group, 'attention', where); }
    if (status === 'undeliverable') { assert.ok(['refunded', 'refund_pending', 'resolved'].includes(list.group), where); assert.notEqual(pub.customer_resolution, 'manual_fulfillment', where); }
  }
  assert.ok(shown > 100, `exercised ${shown} shown combinations`);
});

test('the public gift carries five fields and nothing private, for every combination', () => {
  const secrets = (o: OrderRecord) => [o.id, o.user_id!, o.public_reference, o.payment_reference, o.customer_email, o.customer_name!, o.recipient_phone, o.recipient_phone.slice(-4),
    o.supplier_order_id!, o.supplier_offer_ref!, 'supplier-response', o.failure_reason!, o.admin_note!, String(o.amount), '43.21', o.referral_code!, o.referrer_user_id!, 'success_biz_hub', 'paystack', '2026-12-02'];
  for (const o of every()) {
    const gift = giftFor(o);
    if (!gift) continue;
    assert.deepEqual(Object.keys(gift), [...PUBLIC_GIFT_KEYS]);
    const json = JSON.stringify(gift);
    for (const s of secrets(o)) assert.ok(!json.includes(s), `leaked ${s} in ${json}`);
    assert.deepEqual(readPublicGift(JSON.parse(json)), gift, 'the browser reads exactly what the server would send');
  }
  // Snapshots that are not a catalogue allowance never become a gift.
  assert.equal(giftFor(order({ bundle_size_snapshot: 'MTN 5GB for 0245550187' })), null);
  assert.equal(giftFor(order({ network: 'glo' as OrderRecord['network'] })), null);
});

test('the browser reader refuses anything unexpected, including one extra field', () => {
  const good: PublicGreetingGift = { schemaVersion: 1, kind: 'data', network: 'telecel', allowance: '10GB', status: 'pending' };
  assert.deepEqual(readPublicGift(good), good);
  for (const status of GIFT_STATUSES) assert.equal(readPublicGift({ ...good, status })?.status, status);
  for (const bad of [null, undefined, 'gift', 5, [good], { ...good, amount: 4321 }, { ...good, reference: 'MH-1' }, { ...good, recipient: '******0187' },
    { ...good, schemaVersion: 2 }, { ...good, schemaVersion: '1' }, { ...good, kind: 'Data' }, { ...good, kind: 'airtime' }, { ...good, network: 'glo' }, { ...good, allowance: '10 GB' }, { ...good, status: 'paid' },
    { schemaVersion: 1, kind: 'data', network: 'mtn', allowance: '5GB' }]) assert.equal(readPublicGift(bad), null, JSON.stringify(bad));
});

test('a gift whose order cannot be read keeps only its recorded network and allowance', () => {
  assert.deepEqual(unavailableGift('airteltigo', '3GB'), { schemaVersion: 1, kind: 'data', network: 'airteltigo', allowance: '3GB', status: 'status_unavailable' });
  assert.equal(unavailableGift('vodafone', '3GB'), null);
  assert.equal(unavailableGift('mtn', '3 GB'), null);
});

/* ───────────────────────── Recipient: the second reveal ───────────────────────── */

const gift = (status: GiftStatus, network: PublicGreetingGift['network'] = 'mtn'): PublicGreetingGift => ({ schemaVersion: 1, kind: 'data', network, allowance: '5GB', status });

test('the gift stays wrapped until the recipient opens it, then names the gift and its true status', () => {
  const sealed = text(render(h(GiftReveal, { gift: gift('delivered'), senderName: 'Kojo' })));
  assert.match(sealed, /A little extra surprise/);
  assert.match(sealed, /Reveal your extra gift/);
  assert.doesNotMatch(sealed, /5GB|Delivered|MTN/, 'nothing about the gift shows before it is opened');
  for (const status of GIFT_STATUSES) {
    const html = render(h(GiftReveal, { gift: gift(status), senderName: null, initiallyOpen: true, onRetry: noop }));
    const t = text(html);
    const copy = giftStatusCopy(status, 'mtn');
    assert.match(t, /5GB Data Gift/, status);
    assert.match(t, /MTN/, status);
    assert.ok(t.includes(copy.title) && t.includes(copy.detail), status);
    assert.match(html, /role="status"/, status);
    // "Delivered" as a status only for a confirmed delivery; the success colour likewise.
    assert.equal(/class="mgg-status-title">Delivered</.test(html), status === 'delivered', status);
    assert.equal(/Check again/.test(t), status === 'status_unavailable', status);
    // No money, references, numbers (whole or masked) or dates; never asks the recipient to act on a payment.
    assert.doesNotMatch(t, /GH₵|cedi|refund|payment|paystack|reference|\b0\d{2}|\d{4}|\d{3}\s*[X*•]|[X*•]{3}|receipt/i, `${status}: ${t}`);
    // A greeting knows no phone number, and links get forwarded: never "your number", never a task for the recipient.
    assert.doesNotMatch(t, /your number|contact|support|whatsapp|call us|ask your sender|reply/i, `${status}: ${t}`);
  }
});

test('the recipient wording for every status is the reviewed copy, word for word', () => {
  assert.deepEqual(Object.fromEntries(GIFT_STATUSES.map(s => [s, giftStatusCopy(s, 'telecel')])), {
    pending: { title: 'On its way', detail: 'Delivery to the number your sender chose is in progress. Networks sometimes take a little while.' },
    delivered: { title: 'Delivered', detail: 'The bundle has been delivered to the number your sender chose. You can check your data balance with Telecel.' },
    review: { title: 'Being checked', detail: 'Its delivery is being checked. There’s nothing you need to do.' },
    undeliverable: { title: 'Couldn’t be delivered', detail: 'This bundle couldn’t be delivered to the number your sender chose. Mystery Hub handles this directly with your sender, so there’s nothing you need to do.' },
    status_unavailable: { title: 'Status unavailable', detail: 'We couldn’t check this gift’s delivery just now. Please try again in a moment.' },
  });
  // The heading follows the page outline, like GreetingStage, and is the focus target after opening.
  assert.match(render(h(GiftReveal, { gift: gift('pending'), senderName: null, initiallyOpen: true })), /<h2 tabindex="-1" class="mgg-allowance">/);
  assert.match(render(h(GiftReveal, { gift: gift('pending'), senderName: null, initiallyOpen: true, headingLevel: 3 })), /<h3 tabindex="-1" class="mgg-allowance">/);
  // The status can take focus after "Check again", so focus never drops to the page.
  assert.match(render(h(GiftReveal, { gift: gift('pending'), senderName: null, initiallyOpen: true })), /<div tabindex="-1" class="mgg-status" data-status="pending" role="status">/);
});

test('a hidden sender stays a mystery, a named sender is named, and an undeliverable gift is described as chosen', () => {
  assert.equal(giftFromLine('delivered', null), 'Your mystery sender bought you an internet bundle to go with this greeting.');
  assert.equal(giftFromLine('pending', '  '), 'Your mystery sender bought you an internet bundle to go with this greeting.');
  assert.equal(giftFromLine('pending', 'Kojo'), 'Kojo bought you an internet bundle to go with this greeting.');
  assert.equal(giftFromLine('undeliverable', 'Kojo'), 'Kojo chose an internet bundle to go with this greeting.');
  assert.match(text(render(h(GiftReveal, { gift: gift('review'), senderName: null, initiallyOpen: true }))), /Your mystery sender bought you/);
});

test('network names and colours are the Data store’s own', () => {
  for (const n of GIFT_NETWORKS) {
    const store = DATA_NETWORK_CHOICES.find(c => c.id === n)!;
    assert.equal(GIFT_NETWORK_COPY[n].color, store.color, n);
    assert.equal(GIFT_NETWORK_COPY[n].ink, store.ink, n);
    assert.equal(GIFT_NETWORK_COPY[n].name, store.name, n);
    assert.match(giftStatusCopy('delivered', n).detail, new RegExp(store.name));
  }
});

/* ───────────────────────── Sender: optional, free by default, server prices only ───────────────────────── */

const catalogue = { products: [
  { id: 'mtn-1gb', network: 'mtn', dataAmount: '1GB', amountPesewas: 650, priceGhc: 6.5, isActive: true, validity: 'No expiry' },
  { id: 'mtn-10gb', network: 'mtn', dataAmount: '10GB', amountPesewas: 4590, isActive: true },
  { id: 'mtn-5gb', network: 'mtn', dataAmount: '5GB', amountPesewas: 2399, isActive: true },
  { id: 'tel-5gb', network: 'telecel', dataAmount: '5GB', amountPesewas: 2450 },
  { id: 'at-off', network: 'airteltigo', dataAmount: '2GB', amountPesewas: 1000, isActive: false },
  { id: 'glo', network: 'glo', dataAmount: '2GB', amountPesewas: 1000 },
  { id: 'free', network: 'mtn', dataAmount: '2GB', amountPesewas: 0 },
  { id: 'frac', network: 'mtn', dataAmount: '2GB', amountPesewas: 10.5 },
  { id: 'air', network: 'mtn', dataAmount: '2GB', amountPesewas: 900, serviceType: 'airtime' },
  { id: '', network: 'mtn', dataAmount: '2GB', amountPesewas: 900 },
  { id: 'weird', network: 'mtn', dataAmount: 'Unlimited', amountPesewas: 900 },
] };
const products = giftProductsFromCatalogue(catalogue);

test('giftable bundles come only from the server catalogue and only when valid', () => {
  assert.deepEqual(products.map(p => p.id), ['mtn-1gb', 'mtn-5gb', 'mtn-10gb', 'tel-5gb']);
  assert.deepEqual(products[0], { id: 'mtn-1gb', network: 'mtn', allowance: '1GB', priceMinor: 650, validity: 'No expiry' });
  for (const bad of [null, {}, { products: 'x' }, { products: [null, 1, 'x'] }]) assert.deepEqual(giftProductsFromCatalogue(bad), []);
  assert.equal(cedis(2399), 'GH₵23.99');
});

test('the gift choice appears only when gifting is available, with the free greeting as the default', () => {
  assert.equal(render(h(GiftChoice, { value: 'free', onChange: noop, available: false })), '');
  const html = render(h(GiftChoice, { value: 'free', onChange: noop, available: true }));
  const t = text(html);
  assert.match(t, /Make your surprise extra special/);
  assert.match(t, /Send a free greeting.*Always free/);
  assert.match(t, /Attach a data gift.*The greeting stays free; you pay only for the bundle\./);
  assert.match(html, /name="mgg-mode" checked="" value="free"/);
  assert.doesNotMatch(html, /checked="" value="gift"/);
});

test('the picker never blocks the free greeting: loading, failure and no bundles all keep it one tap away', () => {
  assert.match(text(render(h(GiftPicker, { products: 'loading', quote: null, onReview: noop, onContinue: noop, onSkip: noop }))), /Finding today’s data bundles/);
  const failed = text(render(h(GiftPicker, { products: 'failed', quote: null, onReview: noop, onContinue: noop, onSkip: noop, onRetryCatalogue: noop })));
  assert.match(failed, /couldn’t load data bundles.*free greeting is still ready.*Try again.*Send without a gift/);
  const none = text(render(h(GiftPicker, { products: [], quote: null, onReview: noop, onContinue: noop, onSkip: noop })));
  assert.match(none, /Data gifts aren’t available right now.*free greeting is still ready.*Send without a gift/);
  assert.doesNotMatch(none, /Try again/);
});

test('choosing shows only networks that have bundles, and prices exactly as the catalogue gave them', () => {
  const t = text(render(h(GiftPicker, { products, quote: null, onReview: noop, onContinue: noop, onSkip: noop })));
  assert.match(t, /Their network MTN Telecel Bundle/);
  assert.doesNotMatch(t, /AirtelTigo/, 'a network with no bundle on offer is not shown');
  assert.match(t, /1GB GH₵6\.50 No expiry 5GB GH₵23\.99 10GB GH₵45\.90/);
  assert.doesNotMatch(t, /Telecel.*GH₵24\.50/, 'only the chosen network’s bundles are listed');
  assert.match(t, /Their mobile number.*Type their number again/);
  // One network only: no network choice, the bundle legend names it.
  const single = text(render(h(GiftPicker, { products: products.filter(p => p.network === 'telecel'), quote: null, onReview: noop, onContinue: noop, onSkip: noop })));
  assert.match(single, /Telecel bundle 5GB GH₵24\.50/);
  assert.doesNotMatch(single, /Their network/);
});

test('the number is checked twice before review', () => {
  assert.deepEqual(giftProblems(null, '', ''), { product: 'Choose a bundle.', number: 'Enter a 10-digit Ghana number, like 024 123 4567.' });
  assert.deepEqual(giftProblems('mtn-5gb', '024 555 018', '024 555 018'), { number: 'Enter a 10-digit Ghana number, like 024 123 4567.' });
  assert.deepEqual(giftProblems('mtn-5gb', '024 555 0187', '024 555 0178'), { confirm: 'The two numbers don’t match. Check them once more.' });
  assert.deepEqual(giftProblems('mtn-5gb', '+233 24 555 0187', '0245550187'), {});
});

const serverQuote = (productId: string, regularMinor: number, discountMinor = 0, extra: Record<string, unknown> = {}) =>
  ({ product: { id: productId }, regularMinor, discountMinor, totalMinor: regularMinor - discountMinor, pricingRevision: 'p-1', promotionRevision: 'w-1', offer: { enabled: true }, ...extra });

test('a quote is read for one bundle only, and only when it adds up', () => {
  assert.deepEqual(giftQuoteFromServer('mtn-5gb', serverQuote('mtn-5gb', 2399, 100)),
    { state: 'ready', productId: 'mtn-5gb', regularMinor: 2399, discountMinor: 100, totalMinor: 2299, pricingRevision: 'p-1', promotionRevision: 'w-1' });
  assert.equal((giftQuoteFromServer('mtn-5gb', serverQuote('mtn-5gb', 2399, 0, { standardMinor: 2700 })) as { standardMinor?: number }).standardMinor, 2700);
  for (const bad of [null, 'x', {}, serverQuote('mtn-10gb', 2399), { ...serverQuote('mtn-5gb', 2399), totalMinor: 2000 }, serverQuote('mtn-5gb', 2399, 2399),
    { ...serverQuote('mtn-5gb', 2399), regularMinor: 23.99, totalMinor: 23.99 }, { ...serverQuote('mtn-5gb', 2399), pricingRevision: '' }, { ...serverQuote('mtn-5gb', 2399), promotionRevision: 7 },
    { ...serverQuote('mtn-5gb', 2399), discountMinor: -1, totalMinor: 2400 }, serverQuote('mtn-5gb', 2399, 0, { standardMinor: '27' })])
    assert.deepEqual(giftQuoteFromServer('mtn-5gb', bad), { state: 'failed' }, JSON.stringify(bad));
});

test('what reaches checkout is exactly the reviewed bundle, the reviewed number and the server’s own amounts', () => {
  assert.equal(shownGiftNetwork(products, null), 'mtn');
  assert.equal(shownGiftNetwork(products, 'telecel'), 'telecel');
  assert.equal(shownGiftNetwork(products, 'airteltigo'), 'mtn', 'a network with no bundle falls back');
  assert.equal(shownGiftNetwork([], null), null);
  assert.deepEqual(giftSelection(products, 'mtn', 'mtn-5gb', '024 555 0187'), { productId: 'mtn-5gb', recipient: '0245550187' });
  assert.deepEqual(giftSelection(products, 'mtn', 'mtn-5gb', '+233 24 555 0187'), { productId: 'mtn-5gb', recipient: '0245550187' });
  assert.equal(giftSelection(products, 'telecel', 'mtn-5gb', '024 555 0187'), null, 'a bundle kept from another network is never sent');
  assert.equal(giftSelection(products, 'mtn', 'nope', '024 555 0187'), null);
  assert.equal(giftSelection(products, 'mtn', null, '024 555 0187'), null);
  assert.equal(giftSelection(products, 'mtn', 'mtn-5gb', '024 555 018'), null, 'an incomplete number is never sent');
  const selection = giftSelection(products, 'mtn', 'mtn-5gb', '024 555 0187');
  const ready = giftQuoteFromServer('mtn-5gb', serverQuote('mtn-5gb', 2399, 100));
  assert.deepEqual(giftCheckout(selection, ready),
    { productId: 'mtn-5gb', recipient: '0245550187', expectedTotalMinor: 2299, expectedRegularMinor: 2399, pricingRevision: 'p-1', promotionRevision: 'w-1' });
  assert.equal(giftCheckout(selection, giftQuoteFromServer('mtn-5gb', serverQuote('mtn-5gb', 2399, 0, { standardMinor: 2700 })))?.expectedStandardMinor, 2700);
  assert.equal(giftCheckout(selection, giftQuoteFromServer('mtn-10gb', serverQuote('mtn-10gb', 4590))), null, 'a quote for another bundle never pays for this one');
  for (const quote of [null, { state: 'checking' }, { state: 'failed' }] as (GiftQuote | null)[]) assert.equal(giftCheckout(selection, quote), null);
  assert.equal(giftCheckout(null, ready), null);
});

test('review waits for this bundle’s server price, tells a discount from a price change, and keeps money facts out of the greeting', () => {
  const at = (quote: GiftQuote | null, senderHidden = false) => render(h(GiftPicker, { products, quote, senderHidden, onReview: noop, onContinue: noop, onSkip: noop,
    initial: { network: 'mtn', productId: 'mtn-5gb', number: '024 555 0187', confirm: '024 555 0187', stage: 'review' } }));
  const disabled = /<button type="button" class="mg-btn mg-btn-primary" disabled="">Continue to payment/;
  const checking = at({ state: 'checking' });
  assert.match(text(checking), /Review your gift MTN 5GB data For 024 555 0187 Checking today’s price/);
  assert.match(checking, disabled);
  assert.doesNotMatch(text(checking), /GH₵/, 'no total before the server answers');
  const stale = at(giftQuoteFromServer('mtn-10gb', serverQuote('mtn-10gb', 4590)));
  assert.match(text(stale), /Checking today’s price/, 'a leftover quote for another bundle is not this bundle’s price');
  assert.doesNotMatch(text(stale), /GH₵45\.90/);
  assert.match(stale, disabled);
  const ready = at(giftQuoteFromServer('mtn-5gb', serverQuote('mtn-5gb', 2399)));
  assert.match(text(ready), /Total GH₵23\.99 The greeting stays free/);
  assert.doesNotMatch(text(ready), /price has changed|welcome offer/i);
  assert.doesNotMatch(ready, disabled);
  assert.match(text(ready), /Their network will usually text them when it arrives, which can be before they open your greeting\. Mystery Hub won’t text them about your order\./);
  assert.match(text(ready), /Removing the greeting later won’t cancel or refund the bundle\./);
  assert.match(text(ready), /link never shows the price or their number/);
  const discounted = text(at(giftQuoteFromServer('mtn-5gb', serverQuote('mtn-5gb', 2399, 100))));
  assert.match(discounted, /Bundle GH₵23\.99 Your welcome offer −GH₵1\.00 Total GH₵22\.99 The greeting stays free/);
  assert.doesNotMatch(discounted, /price has changed/, 'the buyer’s own welcome offer is not a price change');
  assert.match(text(at(giftQuoteFromServer('mtn-5gb', serverQuote('mtn-5gb', 2499)))), /Total GH₵24\.99 The bundle’s price has changed since you chose it/);
  assert.match(text(at({ state: 'failed' })), /couldn’t confirm today’s price just now\. Try again/);
  assert.match(at({ state: 'failed' }), disabled);
  assert.match(text(at(giftQuoteFromServer('mtn-5gb', serverQuote('mtn-5gb', 2399)), true)), /Your name stays hidden from them\. Your receipt details stay with Mystery Hub and the payment provider/);
  assert.doesNotMatch(text(ready), /name stays hidden/);
});

test('an input problem is announced on the field it belongs to', () => {
  const html = render(h(GiftPicker, { products, quote: null, onReview: noop, onContinue: noop, onSkip: noop }));
  // The checking-twice advice is read with both number fields.
  assert.match(html, /id="mgg-field-number"[^>]*aria-describedby="mgg-help-number"/);
  assert.match(html, /id="mgg-field-confirm"[^>]*aria-describedby="mgg-help-number"/);
  assert.match(html, /<p class="mg-help" id="mgg-help-number">/);
  // The bundle group takes focus on an error, so it must show that focus.
  assert.match(read('src/greetings/gifts/gifts.css'), /\.mgg-field-product:focus \{ outline: 3px solid/);
});

/* ───────────────────────── Isolation: dormant means unreachable ───────────────────────── */

// Everything a production entry point can load, as esbuild's bundler resolves it: static, dynamic and index imports,
// and the '@' alias. Packages are left out; only this repository's own files matter here.
const ASSETS = Object.fromEntries(['.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.mp3', '.mp4', '.html', '.txt', '.md', '.sql'].map(e => [e, 'empty' as const]));
function reachable(entry: string, platform: 'browser' | 'node'): string[] {
  const result = buildSync({ entryPoints: [path.join(root, entry)], absWorkingDir: root, bundle: true, write: false, metafile: true, packages: 'external', platform,
    format: 'esm', splitting: true, outdir: path.join(root, '.gift-reach'), loader: ASSETS, alias: { '@': root }, jsx: 'automatic', logLevel: 'silent' });
  return Object.keys(result.metafile!.inputs);
}
const GIFT_FILE = /(^|\/)src\/greetings\/gifts\/|(^|\/)shared\/mysteryGifts\.ts$|giftsReview/;

test('nothing in production reaches the gift components or the gift contract', () => {
  // A positive control first: the review fixture does reach them, so the check can see an import when there is one.
  assert.ok(reachable('scripts/review/giftsReview.tsx', 'browser').filter(f => GIFT_FILE.test(f)).length >= 3, 'the reachability check must see the fixture’s imports');
  for (const [entry, platform] of [['src/main.tsx', 'browser'], ['server.ts', 'node']] as const) {
    const files = reachable(entry, platform);
    assert.ok(files.length > 100, `${entry} was resolved`);
    assert.deepEqual(files.filter(f => GIFT_FILE.test(f)), [], `${entry} must not load the dormant gift code`);
  }
  // The only page is index.html, and it loads only the app.
  assert.deepEqual([...read('index.html').matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]), ['/src/main.tsx']);
  assert.doesNotMatch(read('vite.config.ts'), /scripts\/review|giftsReview/);
  // The live Greetings surfaces are the free ones, unchanged by this release.
  for (const file of ['src/main.tsx', 'src/greetings/CreatorPage.tsx', 'src/greetings/RecipientPage.tsx', 'src/greetings/GreetingStage.tsx', 'src/greetings/api.ts'])
    assert.doesNotMatch(code(file), /[Gg]ift(Reveal|Choice|Picker|Sender)|data gift|giftStatus|mysteryGifts|\/gifts/, file);
  // No contract pretends a gift exists: the public greeting has no gift field, and no server route attaches one.
  assert.doesNotMatch(read('shared/mysteryExperiences.ts').match(/interface PublicGreeting \{[^}]*\}/)![0], /gift/i);
  assert.doesNotMatch(code('server/routes/experienceApi.ts'), /gift/i);
  assert.doesNotMatch(code('server/routes/api.ts'), /greeting/i, 'checkout knows nothing about greetings');
});

test('the dormant components never call a server, start a payment or hardcode a price', () => {
  for (const file of ['src/greetings/gifts/GiftReveal.tsx', 'src/greetings/gifts/GiftSender.tsx', 'shared/mysteryGifts.ts']) {
    const body = code(file);
    assert.doesNotMatch(body, /fetch\(|XMLHttpRequest|sendBeacon|usePaystack|PaystackPop|paystack|apiClient|commercialRequest|localStorage|sessionStorage/i, file);
    assert.doesNotMatch(body, /GH₵\s*\d|amountPesewas\s*[:=]\s*\d|priceMinor\s*[:=]\s*\d/, `${file} must not carry a price`);
  }
  const css = read('src/greetings/gifts/gifts.css');
  assert.doesNotMatch(css, /infinite/, 'gift motion is finite');
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.mgg-card \{ animation: none; \}/);
  for (const rule of css.match(/^[^@\s/][^{]*\{/gm) ?? []) for (const sel of rule.replace('{', '').split(',')) {
    if (/^\s*(from|to|\d+%)\s*$/.test(sel)) continue;
    assert.match(sel.trim(), /^\.mgg-|^#mgg-/, `unscoped gift rule: ${sel}`);
  }
});
