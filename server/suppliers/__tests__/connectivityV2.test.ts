import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Money, splitGhs} from '../../../src/components/purchase/Money';
import {estimateInstantCheckoutFeeGhc} from '../../../src/utils/instantFee';
import {calculateFlexiInstantBundlePrice} from '../../data/instantBundlePricing.js';
import {InstantBundleCard} from '../../../src/components/data/InstantBundleCard';
import type {PublicInstantBundle} from '../../../src/services/apiClient';

const source = (path: string) => readFileSync(path, 'utf8');
const product: PublicInstantBundle = {productKey: 'instant-x', packageId: 'x', name: '3GB', network: 'mtn', dataAmount: '3GB', validity: '1 Day',
  isFlexi: false, retailPriceGhc: 3, retailPricePesewas: 300, paymentProcessingFeeGhc: 0.17, estimatedTotalGhc: 3.17, availability: 'in_stock', category: 'Midnight'};

test('money keeps exact cedis and pesewas with one consistent mark', () => {
  assert.deepEqual(splitGhs(5.5), {whole: '5', pesewas: '50'});
  assert.deepEqual(splitGhs(1234.005), {whole: '1,234', pesewas: '01'});
  const html = renderToStaticMarkup(React.createElement(Money, {ghc: 23.99}));
  assert.match(html, /GH₵<\/span>23<span[^>]*>\.99/);
});

test('Flexi fee estimate matches the server default gross-up it describes', () => {
  for (const amount of [1, 5, 20, 49.5, 100, 500]) {
    const server = calculateFlexiInstantBundlePrice('pkg', amount, 0.95, 1, 500);
    assert.equal(server.productRetailPriceGhc, amount);
    assert.equal(estimateInstantCheckoutFeeGhc(amount), server.paymentProcessingFeeGhc, `amount ${amount}`);
  }
  assert.match(source('src/components/checkout/CheckoutModal.tsx'), /estimateInstantCheckoutFeeGhc\(faceValue\)/);
  assert.match(source('src/components/checkout/CheckoutModal.tsx'), /Checkout fee \(estimate\)/);
});

test('Instant cards state conditions and the fee before the tap, and take no phone number', () => {
  const html = renderToStaticMarkup(React.createElement(InstantBundleCard, {product, onBuy() {}}));
  assert.match(html, /aria-label="Buy 3GB MTN Ghana Midnight Bundle for GH₵3\.00 plus GH₵0\.17 checkout fee"/);
  assert.match(html, /Midnight-only data/);
  assert.match(html, /\+ GH₵0\.17 fee/);
  assert.doesNotMatch(html, /type="tel"|Recipient number/);
  const out = renderToStaticMarkup(React.createElement(InstantBundleCard, {product: {...product, availability: 'out_of_stock'}, onBuy() {}}));
  assert.match(out, /disabled=""/);
  assert.match(out, /unavailable/);
  const flexi = renderToStaticMarkup(React.createElement(InstantBundleCard, {product: {...product, isFlexi: true, minAmountGhc: 1, maxAmountGhc: 500}, onBuy() {}}));
  assert.match(flexi, /Choose an amount for Flexi MTN Ghana bundle/);
  assert.match(flexi, /GH₵1<\/span> to <span[^>]*>GH₵500/);
});

test('a Flexi amount the catalogue did not price never carries the catalogue fee', () => {
  const catalog = source('src/components/data/InstantBundlesCatalog.tsx');
  assert.match(catalog, /catalogPriced = !product.isFlexi \|\| finalPrice === product.retailPriceGhc/);
  assert.match(catalog, /serviceFeeGhc: catalogPriced \? product.paymentProcessingFeeGhc : undefined/);
  assert.match(catalog, /openCheckout\(convertedBundle\)/);
});

test('Airtime validates inline, keeps its zero-fee quote and hands the number to checkout', () => {
  const page = source('src/components/data/DataPage.tsx');
  assert.doesNotMatch(page, /showToast/);
  assert.match(page, /Minimum airtime is GH₵1\.00\./);
  assert.match(page, /faceValue > 1000/);
  assert.match(page, /openCheckout\(syntheticBundle, \{ recipientPhone: formatGhanaPhone\(airtimePhone\) \}\)/);
  assert.match(page, /isCompleteGhanaPhone\(airtimePhone\) && detectedAirtimeNet && detectedAirtimeNet !== airtimeNet/);
});

test('purchase taps confirm visually and respect reduced motion', () => {
  const css = source('src/index.css');
  assert.match(css, /\.mh-buy:active/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\n  \.mh-press, \.mh-buy/);
  assert.match(source('src/hooks/useTapFeedback.ts'), /prefers-reduced-motion: reduce/);
  for (const file of ['src/components/data/CompactBundleRow.tsx', 'src/components/data/InstantBundleCard.tsx']) assert.match(source(file), /useTapFeedback\(\)/);
});
