/** Website Builder V5 owner dashboard: separate payment and delivery, order filters, earnings definitions, price review. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {ownerOrderView,ownerOrderCounts,pricingReviewLines,STORE_EARNING_DEFINITIONS,OWNER_ORDER_FILTERS,type OwnerOrder} from '../../../src/utils/websiteOwnerOrders.js';
import {ownerAttention} from '../../../src/utils/websiteOwnerAttention.js';
import {WebsiteAnalyticsStore} from '../../db/websiteAnalyticsStore.js';

const order=(status:string,extra:Partial<OwnerOrder>={}):OwnerOrder=>({id:status,reference:'MH-FIXTURE',createdAt:'2026-10-21T08:00:00Z',network:'mtn',bundle:'5GB',recipient:'024 *** 0199',retailMinor:2399,earningMinor:150,earningState:'pending',status,manualReview:false,paid:!['pending_payment','cancelled','expired'].includes(status),...extra});

test('payment and delivery are two separate facts, both from server status',()=>{
  assert.deepEqual(ownerOrderView(order('pending_payment')),{payment:'Awaiting payment',delivery:'Not sent',group:'unpaid',paid:false});
  assert.equal(ownerOrderView(order('expired')).payment,'Payment not completed');
  assert.deepEqual(ownerOrderView(order('processing')),{payment:'Payment received',delivery:'Processing',group:'sending',paid:true});
  assert.equal(ownerOrderView(order('delivered')).group,'delivered');assert.equal(ownerOrderView(order('delivered')).delivery,'Delivered');
  assert.equal(ownerOrderView(order('failed')).group,'failed');assert.equal(ownerOrderView(order('refund_pending')).group,'failed');
  assert.equal(ownerOrderView(order('processing',{manualReview:true})).group,'check','manual review wins over status');
  assert.deepEqual(ownerOrderCounts([order('delivered'),order('delivered'),order('failed'),order('queued')]),{check:0,sending:1,delivered:2,failed:1,unpaid:0});
  assert.deepEqual(OWNER_ORDER_FILTERS.map(f=>f[0]),['all','check','sending','delivered','failed','unpaid']);
});

test('orders needing a check reach the attention list, only for Data stores',()=>{
  const base={published:true,content:{whatsapp:'0241234567'},views:4,sellableBundles:3};
  assert.equal(ownerAttention({...base,reseller:true,ordersNeedingCheck:2})[0].title,'2 orders need a check');
  assert.equal(ownerAttention({...base,reseller:true,ordersNeedingCheck:2})[0].action,'orders');
  assert.ok(!ownerAttention({...base,reseller:false,ordersNeedingCheck:2}).some(i=>i.id==='orders'));
  assert.ok(!ownerAttention({...base,reseller:true,ordersNeedingCheck:0}).some(i=>i.id==='orders'));
});

test('earnings definitions follow the ledger buckets and every figure is a server field',()=>{
  assert.deepEqual(STORE_EARNING_DEFINITIONS.map(d=>d[0]),['availableMinor','pendingMinor','reservedMinor','withdrawnMinor']);
  const finance=readFileSync('server/db/financeStore.ts','utf8');
  // Pending = store sales still pending; Reserved = store withdrawals under review or approved; Withdrawn = paid.
  assert.match(finance,/pendingMinor:sum\(operations\.filter\(x=>x\.kind==='store_sale'&&x\.state==='pending'\)\)/);
  assert.match(finance,/reservedMinor:sum\(operations\.filter\(x=>x\.kind==='withdrawal'&&x\.payload\.source==='store'&&\['pending_review','approved'\]/);
  const dash=readFileSync('src/components/website/WebsiteBusinessDashboard.tsx','utf8');
  assert.match(dash,/formatGhs\(Number\(e\[key\]\|\|0\)\)/);
  assert.match(dash,/\{!e\.reconciliationRequired&&<form/,'withdraw is hidden while earnings are under review');
  // Non-Data owners without Data history get no Orders, pricing or earnings tabs.
  assert.match(dash,/\.\.\.\(reseller\|\|data\?\.capabilities\?\.hasStoreHistory\|\|data\?\.capabilities\?\.hasStoreFundsOrWithdrawals\|\|data\?\.earnings\?\.lifetimeMinor\?\['Orders'/);
  assert.match(dash,/Recipient numbers are partly hidden/);
});

test('the price review lists every change before the versioned save',()=>{
  assert.deepEqual(pricingReviewLines([
    {id:'a',networkName:'MTN',dataAmount:'5GB',before:{price:'22.00',enabled:true},after:{price:'23.99',enabled:true}},
    {id:'b',networkName:'Telecel',dataAmount:'2GB',before:{price:'',enabled:false},after:{price:'11.50',enabled:true}},
    {id:'c',networkName:'AirtelTigo',dataAmount:'1GB',before:{price:'6.00',enabled:true},after:{price:'6.00',enabled:false}},
  ]),['MTN 5GB: GH₵22.00 → GH₵23.99','Telecel 2GB: No price → GH₵11.50 · switched on','AirtelTigo 1GB: switched off']);
  const pricing=readFileSync('src/components/website/WebsiteBundlePricing.tsx','utf8');
  assert.match(pricing,/data-pricing-review/);assert.match(pricing,/Confirm and save/);
  // The review button refuses below-minimum prices before showing the review; the save still sends expectedVersion.
  const review=pricing.slice(pricing.indexOf("setReviewing(true)")-260,pricing.indexOf("setReviewing(true)"));
  assert.ok(review.includes('sellerPriceError(p,drafts[p.id])')&&review.includes('return;'));
  assert.match(pricing,/expectedVersion:catalog\.version/);
});

test('owners can look at the last 24 hours',async()=>{
  const source=readFileSync('server/db/websiteAnalyticsStore.ts','utf8');assert.match(source,/\['1','7','30','90','all'\]\.includes\(range\)/);
  await assert.rejects(WebsiteAnalyticsStore.ownerAnalytics('site_missing','owner','2',true),/Invalid analytics period/);
  assert.equal((await WebsiteAnalyticsStore.ownerAnalytics('site_missing','owner','1',true)).range,'1');
});
