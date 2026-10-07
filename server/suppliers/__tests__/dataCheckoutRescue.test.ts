import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {preferredPaymentMethod} from '../../../src/utils/checkoutPresentation';
import {dataOrderPresentation,maskDataRecipient,dataRecipientDisplay,dataValidityLabel} from '../../../src/utils/dataPurchasePresentation';
const source=(path:string)=>readFileSync(path,'utf8');
const checkout=source('src/components/checkout/CheckoutModal.tsx');
test('guest and signed-in payment defaults remain balance-aware',()=>{
  assert.equal(preferredPaymentMethod(false,10000,549),'paystack');
  assert.equal(preferredPaymentMethod(true,549,549),'wallet');
  assert.equal(preferredPaymentMethod(true,1,549),'paystack');
  assert.equal(preferredPaymentMethod(true,null,549),'paystack');
  assert.equal(preferredPaymentMethod(true,10000,549,true),'paystack');
  const choice=source('src/components/finance/WalletPaymentChoice.tsx');
  assert.match(choice,/if \(!sessionToken\) return null/);
  assert.match(choice,/touched.current = true/);
  assert.match(choice,/Short by/);
  assert.match(choice,/rounded-lg border border-emerald-500/);
  assert.match(choice,/closeCheckout\(\);setActivePage\('wallet'\)/);
});
test('production confirmation stays with recipient ahead of payment choices and action',()=>{
  assert.equal(checkout.split('Confirm your order').length-1,1);
  assert.match(checkout,/Delivered orders sent to the wrong number may not be reversible/);
  assert.ok(checkout.indexOf('id="checkout-phone"')<checkout.indexOf('MTN orders are queued'));
  assert.ok(!checkout.includes('dataDeliveryNote'));
  assert.ok(checkout.indexOf('id="checkout-phone"')<checkout.indexOf('<WalletPaymentChoice'));
  assert.match(checkout,/value=\{phone\}/);
  assert.match(checkout,/Pay GH₵/);
  assert.match(checkout,/submissionPending.current \|\| isInitializing \|\| walletBusy/);
  assert.match(checkout,/disabled=\{walletBusy \|\| isInitializing \|\| isRegularData && !commercial\}/);
});
test('production bundle card stays first with compact receipt and payment controls',()=>{
  assert.match(checkout,/Bundle \/ Airtime Summary Card/);
  assert.match(checkout,/bg-slate-900\/90/);
  assert.match(checkout,/checkoutBundle.dataAmount} Data Bundle/);
  assert.ok(checkout.indexOf('Bundle / Airtime Summary Card')<checkout.indexOf('Receipt email'));
  assert.ok(checkout.indexOf('Receipt email')<checkout.indexOf('id="checkout-phone"'));
  const choice=source('src/components/finance/WalletPaymentChoice.tsx');
  assert.match(choice,/grid grid-cols-2/);
  assert.match(choice,/formatGhs\(balance\)\+' available'/);
  assert.match(choice,/Mobile Money<span[^>]*>Secure checkout/);
});
test('discount and authoritative quote contract remain intact',()=>{
  for(const field of ['expectedTotalMinor:commercial.totalMinor','expectedRegularMinor:commercial.regularMinor','pricingRevision:commercial.pricingRevision','promotionRevision:commercial.promotionRevision']) assert.ok(checkout.includes(field));
  assert.match(checkout,/commercial\?\.discountMinor>0/);
  assert.match(checkout,/commercial.discountMinor\/100/);
  assert.match(checkout,/commercial\?\.totalMinor\/100/);
  assert.match(checkout,/commercial&&\/price\|pricing\|quote\|welcome offer\|promotion\/i.test\(serverError\)/);
  assert.match(checkout,/quoteError&&<button/);
  assert.match(checkout,/setQuoteRefresh/);
  assert.match(checkout,/customerEmail: receiptEmail \|\| user\?\.email/);
  assert.match(checkout,/setEditingReceipt\(!\//);
  assert.match(checkout,/onClick=\{\(\)=>setEditingReceipt\(true\)\}/);
});
test('customer Welcome Offer copy hides internal eligibility reasons',()=>{
  const notice=source('src/components/data/WelcomeOfferNotice.tsx');
  for(const text of ['unique Ghana phone','canonical phone','duplicate account','anti-abuse','eligibility identity','account binding','fraud control','Guest purchases stay at regular price']) assert.ok(!(notice+checkout).includes(text),text);
  assert.match(notice,/\['guest','eligible'\]/);
  assert.match(checkout,/Add your phone in Account to check your Welcome Offer/);
});
test('MTN notice appears once at network level with caveats in disclosure',()=>{
  const page=source('src/components/data/DataPage.tsx');
  assert.equal(page.split('MTN delivery').length-1,1);
  assert.match(page,/Most orders arrive within 15–45 minutes/);
  assert.match(page,/<details><summary[^>]*>Details/);
  assert.match(page,/mtnNotice.message/);
  for(const card of ['BundleCard','CompactBundleRow']) assert.ok(!source(`src/components/data/${card}.tsx`).includes('dataDeliveryNote'));
});
test('buyer recipient presentation is opt-in; public lookup retains masking',()=>{
  const orders=source('src/components/orders/OrdersPage.tsx');
  const status=source('src/components/checkout/OrderStatusModal.tsx');
  assert.match(checkout,/openOrderStatus\(newOrder\)/);
  assert.match(orders,/recipientPhone: o.recipient_phone,\s+buyerRecipientVisible: true/);
  assert.ok(!orders.slice(orders.indexOf('const handleServerLookup')).includes('buyerRecipientVisible: true'));
  assert.match(status,/dataRecipientDisplay\(activeOrder.recipientPhone, activeOrder.buyerRecipientVisible\)/);
  assert.match(source('src/context/AppContext.tsx'),/recipientPhone: phone,\s+buyerRecipientVisible: true/);
  assert.equal(dataRecipientDisplay('0241234567',true),'024 123 4567');
  assert.equal(dataRecipientDisplay('0241234567'),'024 ••• 4567');
  assert.equal(maskDataRecipient('0241234567'),'024 ••• 4567');
  assert.equal(maskDataRecipient('024***4567'),'024***4567');
});
test('status progression is server-authoritative without duplicate checkout toast',()=>{
  assert.ok(!checkout.includes('Payment received. Checking your order'));
  assert.ok(!checkout.includes("setActivePage('orders');showToast"));
  assert.equal(dataOrderPresentation(undefined).paymentConfirmed,false);
  assert.equal(dataOrderPresentation('paid').paymentConfirmed,true);
  assert.equal(dataOrderPresentation('processing').processing,true);
  assert.equal(dataOrderPresentation('delivered').delivered,true);
  const status=source('src/components/checkout/OrderStatusModal.tsx');
  assert.match(status,/motion-reduce:animate-none/);
  assert.match(status,/dataView.paymentConfirmed/);
});

test('customer Data validity hides routing labels without fabricating durations',()=>{
  for(const label of ['Direct SIM','Direct SIM Credit','Direct Credit','direct credit',' Direct Credit '])assert.equal(dataValidityLabel(label),'');
  for(const label of ['90 Days','30 Days','7 Days'])assert.equal(dataValidityLabel(label),label);
  assert.equal(dataValidityLabel(undefined),'');
  const page=source('src/components/data/DataPage.tsx');
  assert.ok(!page.includes('>Direct SIM Credit<'));
  assert.ok(!page.includes('MTN Express · Direct SIM Credit'));
  for(const file of ['BundleCard','CompactBundleRow'])assert.match(source(`src/components/data/${file}.tsx`),/dataValidityLabel\(bundle.validity\)/);
  assert.match(checkout,/dataValidityLabel\(checkoutBundle.validity\)/);
});
