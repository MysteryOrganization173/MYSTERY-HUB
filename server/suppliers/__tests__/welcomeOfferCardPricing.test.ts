import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { CommercialService } from '../../services/commercialService';
import { AuthStore } from '../../db/authStore';
import { FinanceStore } from '../../db/financeStore';
import { OrdersStore } from '../../db/ordersStore';
import { DATA_BUNDLES } from '../../../src/data/bundles';
import { BundleCard } from '../../../src/components/data/BundleCard';
import { CompactBundleRow } from '../../../src/components/data/CompactBundleRow';
import { welcomeOfferFromQuote, welcomePriceForBundle } from '../../../src/utils/welcomeOfferPresentation';
import { createWelcomeOfferCache } from '../../../src/utils/welcomeOfferCache';
import { WEBSITE_TEMPLATES } from '../../../src/data/templates';
const bundle = { ...DATA_BUNDLES.find(item => item.id === 'mtn-1gb')!, priceGhc:5.49 };
const eligibleQuote = { regularMinor:549, discountMinor:100, totalMinor:449, offer:{enabled:true,state:'eligible',discountMinor:100} };
const eligible = welcomeOfferFromQuote(eligibleQuote)!;
const context = { key:'buyer-session',token:'synthetic-session',productIds:['mtn-1gb','mtn-40gb'] };
beforeEach(async()=>{
  process.env.NODE_ENV='test';delete process.env.DATABASE_URL;AuthStore._clearDevStore();FinanceStore._reset();OrdersStore.clearDevStore();
  const user=await AuthStore.createUser({id:'buyer',name:'Synthetic buyer',email:'buyer@example.test',phone:'+233241234567',passwordHash:'fixture'});
  user.created_at='2020-01-01T00:00:00.000Z';
});

test('existing eligible account receives genuine 549→449 server quote and display projection',async()=>{
  const quote=await CommercialService.quote('mtn-1gb','buyer');const price=welcomePriceForBundle(bundle,welcomeOfferFromQuote(quote));
  assert.equal(price?.regularMinor,549);assert.equal(price?.totalMinor,449);assert.equal(price?.discountMinor,100);assert.equal((await AuthStore.findUserById('buyer'))!.created_at,'2020-01-01T00:00:00.000Z');
});
test('configured server saving applies across multiple standard bundles, without changing regular prices',async()=>{
  await FinanceStore.transaction('buyer',tx=>tx.saveConfig('welcome-offer',{version:'fixture',enabled:true,services:['data'],discountMinor:150}));
  const offer=welcomeOfferFromQuote(await CommercialService.quote('mtn-1gb','buyer'));
  for(const item of DATA_BUNDLES.slice(0,8)){const before=item.priceGhc;const price=welcomePriceForBundle(item,offer);assert.equal(price?.totalMinor,Math.round(before*100)-150);assert.equal(item.priceGhc,before);}
});
test('guest server quote retains regular price and offers no discounted card',async()=>{const quote=await CommercialService.quote('mtn-1gb');assert.equal(quote.offer.state,'guest');assert.equal(welcomePriceForBundle(bundle,welcomeOfferFromQuote(quote)),null);});
for(const state of ['reserved','redeemed'])test(state+' server eligibility cannot appear newly available',async()=>{
  await FinanceStore.transaction('buyer',tx=>tx.create('welcome','fixture-'+state,100,{orderId:'fixture'},state));const quote=await CommercialService.quote('mtn-1gb','buyer');assert.equal(quote.offer.state,state);assert.equal(welcomePriceForBundle(bundle,welcomeOfferFromQuote(quote)),null);
});
test('previous paid direct buyer displays regular price',async()=>{await OrdersStore.createOrder({id:'past',user_id:'buyer',public_reference:'past',service_type:'data',payment_status:'success',status:'delivered',created_at:new Date().toISOString(),updated_at:new Date().toISOString()} as any);const quote=await CommercialService.quote('mtn-1gb','buyer');assert.equal(quote.offer.state,'previous_buyer');assert.equal(welcomePriceForBundle(bundle,welcomeOfferFromQuote(quote)),null);});
test('disabled offer and missing unique phone fail closed',async()=>{
  await FinanceStore.transaction('buyer',tx=>tx.saveConfig('welcome-offer',{enabled:false}));assert.equal(welcomePriceForBundle(bundle,welcomeOfferFromQuote(await CommercialService.quote('mtn-1gb','buyer'))),null);
  await AuthStore.createUser({id:'no-phone',name:'No phone',email:'no-phone@example.test',phone:null,passwordHash:'fixture'});assert.equal((await CommercialService.quote('mtn-1gb','no-phone')).offer.state,'disabled');
  await FinanceStore.transaction('buyer',tx=>tx.saveConfig('welcome-offer',{enabled:true}));const quote=await CommercialService.quote('mtn-1gb','no-phone');assert.equal(quote.offer.state,'phone_required');assert.equal(welcomePriceForBundle(bundle,welcomeOfferFromQuote(quote)),null);
});
test('all noneligible or unavailable states retain regular pricing',()=>{for(const state of ['guest','redeemed','reserved','previous_buyer','phone_required','phone_conflict','disabled','unavailable','unknown'])assert.equal(welcomePriceForBundle(bundle,{...eligible,state}),null);});
test('malformed, nonpositive or inconsistent server discounts cannot establish a Welcome Price',()=>{
  for(const quote of [null,{}, {...eligibleQuote,discountMinor:99},{...eligibleQuote,totalMinor:450},{...eligibleQuote,offer:{...eligible,enabled:false}},{...eligibleQuote,offer:{...eligible,discountMinor:0}},{...eligibleQuote,offer:{...eligible,discountMinor:100.5}}])assert.equal(welcomeOfferFromQuote(quote),null);
  assert.equal(welcomePriceForBundle({...bundle,priceGhc:1},eligible),null);assert.equal(welcomePriceForBundle({...bundle,priceGhc:NaN},eligible),null);
});
test('only public offer fields survive the projection',()=>{assert.deepEqual(welcomeOfferFromQuote({...eligibleQuote,buyerPhone:'private',supplierCostMinor:400,offer:{...eligible,phone:'private'}}),eligible);});
test('standard card renders crossed-out regular price, prominent configured saving and accurate accessible Buy action',()=>{
  const html=renderToStaticMarkup(React.createElement(BundleCard,{bundle,directWelcomeOffer:eligible,onBuy(){}}));assert.match(html,/<del>GH₵5\.49<\/del>/);assert.match(html,/Welcome Price/);assert.match(html,/text-emerald-300/);assert.match(html,/GH₵4\.49/);assert.match(html,/You save GH₵1\.00/);assert.match(html,/one qualifying purchase only/);assert.doesNotMatch(html,/>Popular<|>Value</);
});
test('compact row has the same prices, saving and accessible activation',()=>{const html=renderToStaticMarkup(React.createElement(CompactBundleRow,{bundle,directWelcomeOffer:eligible,onBuy(){}}));assert.match(html,/<del>GH₵5\.49<\/del>/);assert.match(html,/Buy 1GB MTN Ghana data\. Welcome Price GH₵4\.49/);assert.match(html,/role="button"/);assert.match(html,/tabindex="0"/);assert.match(html,/You save GH₵1\.00/);});
test('reseller-themed cards require regular retail even if accidentally passed a direct offer',()=>{const html=renderToStaticMarkup(React.createElement(BundleCard,{bundle,colorScheme:WEBSITE_TEMPLATES[0].colorScheme,directWelcomeOffer:eligible,onBuy(){}}));assert.doesNotMatch(html,/Welcome Price|You save|<del>/);assert.match(html,/GH₵5\.49/);});
test('ordinary reusable cards, Instant and Airtime never inherit a global promotion',()=>{assert.doesNotMatch(renderToStaticMarkup(React.createElement(BundleCard,{bundle,onBuy(){}})),/Welcome Price|<del>/);for(const serviceType of ['airtime','instant_bundle'] as const)assert.equal(welcomePriceForBundle({...bundle,serviceType},eligible),null);for(const id of ['instant-mtn','airtime-mtn'])assert.equal(welcomePriceForBundle({...bundle,id},eligible),null);});
test('many cards and repeat mounts share one cached eligibility request',async()=>{let calls=0,time=1000;const store=createWelcomeOfferCache(async()=>{calls++;return eligibleQuote;},()=>time);await Promise.all(Array.from({length:30},()=>store.refresh(context)));for(let i=0;i<30;i++)assert.equal(welcomePriceForBundle(bundle,store.read(context.key))?.totalMinor,449);await store.refresh(context);assert.equal(calls,1);time+=31000;await store.refresh(context);assert.equal(calls,2);});
test('account switching hides old eligibility immediately and discards delayed responses',async()=>{
  const resolves:((value:unknown)=>void)[]=[];const store=createWelcomeOfferCache(()=>new Promise(resolve=>resolves.push(resolve)));const old=store.refresh(context);const other={...context,key:'different-account',token:'other-fixture'};assert.equal(store.read(other.key),null);const next=store.refresh(other);resolves[1]({...eligibleQuote,discountMinor:0,totalMinor:549,offer:{...eligible,state:'redeemed'}});await next;resolves[0](eligibleQuote);await old;assert.equal(store.read(other.key)?.state,'redeemed');assert.equal(store.read(context.key),null);
});
test('logout cannot retain the previous account discount',async()=>{const store=createWelcomeOfferCache(async(_id,token)=>token?eligibleQuote:{...eligibleQuote,discountMinor:0,totalMinor:549,offer:{...eligible,state:'guest'}});await store.refresh(context);const guest={...context,key:'guest',token:null};assert.equal(store.read(guest.key),null);await store.refresh(guest);assert.equal(welcomePriceForBundle(bundle,store.read(guest.key)),null);});
test('focus revalidation, order transition and profile changes discard stale eligibility',async()=>{let state='eligible';const store=createWelcomeOfferCache(async()=>({...eligibleQuote,discountMinor:state==='eligible'?100:0,totalMinor:state==='eligible'?449:549,offer:{...eligible,state}}));await store.refresh(context);state='reserved';await store.refresh(context,true);assert.equal(welcomePriceForBundle(bundle,store.read(context.key)),null);state='eligible';const changed={...context,key:'updated-phone-or-order'};assert.equal(store.read(changed.key),null);await store.refresh(changed);assert.equal(store.read(changed.key)?.state,'eligible');});
test('network/auth failures clear cached eligibility without inventing a saving or a request per card',async()=>{let fail=false,calls=0;const store=createWelcomeOfferCache(async()=>{calls++;if(fail)throw Object.assign(Error(),{status:503});return eligibleQuote;});await store.refresh(context);fail=true;await store.refresh(context,true);assert.equal(store.read(context.key),null);assert.equal(calls,2);});
test('missing/disabled anchor gets at most one alternate product; service failure gets none',async()=>{const calls:string[]=[];const store=createWelcomeOfferCache(async id=>{calls.push(id);if(calls.length===1)throw Object.assign(Error(),{status:404});return eligibleQuote;});await store.refresh(context);assert.deepEqual(calls,context.productIds);assert.equal(store.read(context.key)?.state,'eligible');const failed=createWelcomeOfferCache(async()=>{throw Object.assign(Error(),{status:503});});await failed.refresh(context);assert.equal(failed.read(context.key),null);});
test('aborted older refresh cannot overwrite the newest result for the same account',async()=>{const resolvers:((value:unknown)=>void)[]=[];const store=createWelcomeOfferCache(()=>new Promise(resolve=>resolvers.push(resolve)));const first=store.refresh(context);const second=store.refresh(context,true);resolvers[1]({...eligibleQuote,discountMinor:0,totalMinor:549,offer:{...eligible,state:'reserved'}});await second;resolvers[0](eligibleQuote);await first;assert.equal(store.read(context.key)?.state,'reserved');});
test('Home and Data explicitly share the same offer with notices/cards; checkout retains fresh authority and revision checks',()=>{
  for(const file of ['src/components/home/HomeFeaturedData.tsx','src/components/data/DataPage.tsx']){const source=readFileSync(file,'utf8');assert.match(source,/useWelcomeOffer\(DATA_BUNDLES\)/);assert.match(source,/WelcomeOfferNotice offer=\{welcomeOffer\}/);assert.match(source,/directWelcomeOffer=\{welcomeOffer\}/);}
  const notice=readFileSync('src/components/data/WelcomeOfferNotice.tsx','utf8');assert.doesNotMatch(notice,/commercialRequest|quote\//);assert.match(notice,/one qualifying Data purchase/);
  const checkout=readFileSync('src/components/checkout/CheckoutModal.tsx','utf8');assert.match(checkout,/commercialRequest\('commercial\/quote\/'.*checkoutBundle.id/);assert.match(checkout,/expectedTotalMinor:commercial.totalMinor/);assert.match(checkout,/pricingRevision:commercial.pricingRevision/);assert.match(checkout,/promotionRevision:commercial.promotionRevision/);assert.match(checkout,/setQuoteRefresh/);
  const hook=readFileSync('src/hooks/useWelcomeOffer.ts','utf8');assert.match(hook,/addEventListener\('focus'/);assert.match(hook,/user\?\.phone/);assert.match(hook,/sessionToken/);assert.match(hook,/activeOrder\?\.serverStatus/);
});
