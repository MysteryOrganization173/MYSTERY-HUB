import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  formatGhanaPhone, ghanaPhoneDigits, isCompleteGhanaPhone, isConnectivityError,
  savePendingCheckout, readPendingCheckout, clearPendingCheckout, isSettledForRecovery, orderRecordFromLookup,
} from '../../../src/utils/checkoutRecovery';
import {CompactBundleRow} from '../../../src/components/data/CompactBundleRow';
import {DATA_BUNDLES} from '../../../src/data/bundles';

const source = (path: string) => readFileSync(path, 'utf8');
const checkout = source('src/components/checkout/CheckoutModal.tsx');
const status = source('src/components/checkout/OrderStatusModal.tsx');
const banner = source('src/components/checkout/PendingPaymentBanner.tsx');
const page = source('src/components/data/DataPage.tsx');

function memoryStorage() {
  const values = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  (globalThis as any).window ??= {addEventListener() {}, removeEventListener() {}};
}

test('recipient numbers format as 024 123 4567 and accept pasted +233 forms', () => {
  assert.equal(formatGhanaPhone('0241234567'), '024 123 4567');
  assert.equal(formatGhanaPhone('+233 24 123 4567'), '024 123 4567');
  assert.equal(formatGhanaPhone('233241234567'), '024 123 4567');
  assert.equal(formatGhanaPhone('02412'), '024 12');
  assert.equal(ghanaPhoneDigits('024 123 45678'), '0241234567');
  assert.equal(isCompleteGhanaPhone('024 123 4567'), true);
  assert.equal(isCompleteGhanaPhone('024 123 456'), false);
  assert.equal(isCompleteGhanaPhone('241 234 5678'), false);
});

test('only connectivity failures are described as "nothing was charged"', () => {
  assert.equal(isConnectivityError(new TypeError('Failed to fetch')), true);
  assert.equal(isConnectivityError({code: 'CHECKOUT_TIMEOUT', message: 'slow'}), true);
  assert.equal(isConnectivityError(new Error('Price changed. Refresh and review before paying.')), false);
  assert.match(checkout, /if \(isConnectivityError\(err\)\)/);
  // Connectivity copy appears only after initialization failed, before any Paystack window opened.
  assert.ok(checkout.indexOf('no payment window was opened') > checkout.indexOf("err.code === 'PACKAGE_UNAVAILABLE'"));
});

test('last payment is remembered by reference only and expires after a day', () => {
  memoryStorage();
  const startedAt = new Date().toISOString();
  savePendingCheckout({orderRef: 'MH-20261015-482913', label: 'MTN Ghana 5GB Data Bundle', network: 'mtn', startedAt});
  assert.deepEqual(readPendingCheckout(), {orderRef: 'MH-20261015-482913', label: 'MTN Ghana 5GB Data Bundle', network: 'mtn', startedAt});
  assert.ok(!JSON.stringify(readPendingCheckout()).match(/\d{10}/), 'no recipient number is stored');
  clearPendingCheckout('MH-other');
  assert.ok(readPendingCheckout(), 'another order does not clear this reminder');
  assert.equal(readPendingCheckout(Date.now() + 25 * 60 * 60 * 1000), null);
  savePendingCheckout({orderRef: 'bad ref!', label: 'x', network: 'mtn', startedAt});
  assert.equal(readPendingCheckout(), null);
  for (const settled of ['paid', 'queued', 'processing', 'delivered', 'failed', 'refund_pending', 'expired']) assert.equal(isSettledForRecovery(settled), true);
  for (const open of ['pending_payment', 'cancelled', undefined]) assert.equal(isSettledForRecovery(open), false, String(open));
});

test('recovery reads server status and never retries or assumes payment', () => {
  const recovery = checkout.slice(checkout.indexOf('const checkPaymentStatus'), checkout.indexOf('const handleSubmit'));
  assert.match(recovery, /lookupOrderOnServer\(attemptRef\)/);
  assert.match(recovery, /view.paymentConfirmed/);
  assert.doesNotMatch(recovery, /initializeServerPayment|walletCheckout|createOrder/);
  assert.doesNotMatch(banner, /initializeServerPayment|walletCheckout|createOrder|verifyPayment/);
  assert.match(banner, /lookupOrderOnServer\(pending.orderRef\)/);
  // The reference is kept from the moment the server creates the order, and cleared on confirmation.
  assert.match(checkout, /onOrderCreated: \(orderRef\) => \{[\s\S]*?savePendingCheckout/);
  assert.match(checkout, /onPaymentReceived: \(orderRef, reference\) => \{\s*clearPendingCheckout\(orderRef\)/);
  // Closing Paystack keeps the existing server cancel call and explains next steps instead of a toast.
  assert.match(checkout, /setPaymentClosed\(true\);\s*if \(orderRef\) \{\s*cancelPaymentOnServer\(orderRef\)/);
  assert.match(checkout, /approve the prompt on your phone with your PIN/);
  assert.match(checkout, /Never share your MoMo PIN/);
});

test('checkout keeps the pay action pinned and server pricing authoritative', () => {
  assert.match(checkout, /type="submit"\s+form="checkout-form"/);
  assert.match(checkout, /useVisualViewport\(isCheckoutOpen\)/);
  assert.match(checkout, /commercial\?\.totalMinor\/100 \|\| checkoutBundle.priceGhc/);
  assert.match(checkout, /aria-label="Review your purchase"/);
});

test('receipt timeline only advances from server-derived presentation', () => {
  const journey = status.slice(status.indexOf('const journey'), status.indexOf('const currentStep'));
  assert.match(journey, /complete: dataView.paymentConfirmed/);
  assert.equal((journey.match(/complete: dataView.delivered/g) || []).length, 2);
  assert.doesNotMatch(journey, /activeOrder.status ===/);
  assert.match(status, /last checked/);
  assert.match(status, /setCheckFailed\(true\)/);
});

test('one bundle list on the Data page; rows remain the shared Homepage V2 row', () => {
  assert.doesNotMatch(page, /BundleCard|viewMode/);
  assert.match(page, /<PendingPaymentBanner \/>/);
  assert.ok(page.indexOf('MTN Network Service Notice') < page.indexOf('<CompactBundleRow'), 'MTN timing shows before the list');
  const bundle = DATA_BUNDLES.find(b => b.id === 'mtn-5gb')!;
  const html = renderToStaticMarkup(React.createElement(CompactBundleRow, {bundle, onBuy() {}}));
  assert.match(html, /role="button"/);
  assert.match(html, new RegExp(`Buy 5GB MTN Ghana data for GH₵${bundle.priceGhc.toFixed(2)}`));
});

test('lookup receipts keep public masking and map server states', () => {
  const base = {public_reference: 'MH-1', recipient_phone: '024 *** 4567', network: 'mtn' as const, product_name_snapshot: 'MTN 5GB', bundle_size_snapshot: '5GB', amount: 2399, amount_ghc: 23.99, currency: 'GHS' as const, created_at: '2026-10-15T12:00:00Z', paid_at: null, delivered_at: null};
  const map = (status: any) => orderRecordFromLookup({...base, status});
  assert.equal(map('pending_payment').status, 'verifying');
  assert.equal(map('queued').status, 'placed');
  assert.equal(map('submitted').status, 'processing');
  assert.equal(map('delivered').status, 'delivered');
  assert.equal(map('refund_pending').status, 'failed');
  assert.equal(map('queued').buyerRecipientVisible, undefined);
});
