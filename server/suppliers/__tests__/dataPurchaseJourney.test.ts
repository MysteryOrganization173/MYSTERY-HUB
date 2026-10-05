import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BundleCard } from '../../../src/components/data/BundleCard';
import { CompactBundleRow } from '../../../src/components/data/CompactBundleRow';
import { DATA_BUNDLES } from '../../../src/data/bundles';
import { serviceNotices } from '../../../src/config/serviceNotices';
import { dataDeliveryNote, dataOrderPresentation, maskDataRecipient } from '../../../src/utils/dataPurchasePresentation';

for (const status of [undefined, 'pending_payment', 'failed', 'cancelled', 'expired', 'unknown']) {
  test(`Data receipt cannot confirm payment from ${status}`,()=>{
    const view=dataOrderPresentation(status);
    assert.equal(view.paymentConfirmed,false);assert.equal(view.processing,false);assert.equal(view.delivered,false);
  });
}
for (const status of ['paid','queued','submitted','processing','delivered','refund_pending','refunded']) {
  test(`Data receipt respects authoritative ${status}`,()=>{
    const view=dataOrderPresentation(status);
    assert.equal(view.paymentConfirmed,true);assert.equal(view.delivered,status==='delivered');
    assert.equal(view.processing,['submitted','processing'].includes(status));
  });
}
test('Refunded and review orders provide safe distinct next steps',()=>{
  assert.equal(dataOrderPresentation('refunded').label,'Refunded');
  assert.equal(dataOrderPresentation('refund_pending').label,'Refund pending');
  assert.match(dataOrderPresentation('queued',true).next,/avoid placing the same order/);
  assert.match(dataOrderPresentation('failed').next,/before placing/);
});
test('Recipient masking preserves existing public masks',()=>{
  assert.equal(maskDataRecipient('0241234567'),'024 ••• 4567');
  assert.equal(maskDataRecipient('024***4567'),'024***4567');
  assert.equal(maskDataRecipient('024 ••• 4567'),'024 ••• 4567');
});
test('Delivery copy is sourced from existing service notices',()=>{
  assert.equal(dataDeliveryNote('mtn'),serviceNotices.mtn.summary);
  assert.equal(dataDeliveryNote('airteltigo'),serviceNotices.airteltigo.summary.replace('⚡ ',''));
  assert.match(dataDeliveryNote('telecel'),/Track Order/);
});
for(const network of ['mtn','airteltigo','telecel'] as const) {
  test(`${network} catalogue cards retain exact catalogue price and validity`,()=>{
    const bundle=DATA_BUNDLES.find(row=>row.network===network)!;
    for(const Component of [BundleCard,CompactBundleRow]) {
      const html=renderToStaticMarkup(React.createElement(Component,{bundle,onBuy:()=>{}}));
      assert.ok(html.includes(`GH₵${bundle.priceGhc.toFixed(2)}`));assert.ok(html.includes(bundle.validity));
      assert.ok(html.includes(dataDeliveryNote(network)));assert.match(html,/Buy/);
    }
  });
}
