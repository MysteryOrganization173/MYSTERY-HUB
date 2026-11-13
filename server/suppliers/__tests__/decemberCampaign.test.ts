import assert from 'node:assert/strict';
import {test,beforeEach,before,after} from 'node:test';
import {randomUUID} from 'node:crypto';
import express from 'express';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {readFileSync} from 'node:fs';
import {CommercialService as C} from '../../services/commercialService.js';
import {FinanceStore} from '../../db/financeStore.js';
import {FinanceService} from '../../services/financeService.js';
import {AuthStore} from '../../db/authStore.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {ReferralStore} from '../../db/referralStore.js';
import {STANDARD_DATA_REFERRAL_POLICY} from '../../config/dataReferralRewardPolicy.js';
import {AdminAuditStore} from '../../db/adminAuditStore.js';
import {PaystackServerService as P} from '../../services/paystackService.js';
import {FulfilmentService as F} from '../../services/fulfilmentService.js';
import {apiRouter} from '../../routes/api.js';
import {adminRouter} from '../../routes/adminApi.js';
import {toSafePublicOrder} from '../../types/orders.js';
import {DIRECT_CAMPAIGN_DEFAULT,DECEMBER_2026_CAMPAIGN_ID,campaignState,campaignPriceFor,campaignHeadlinePercent,normalizeCampaign,campaignEndsAt,campaignValueWarnings} from '../../../shared/directCampaign.js';
import {DIRECT_RETAIL_MINOR} from '../../../shared/directPricing.js';
import {serverSeasonStatus} from '../../../shared/seasonal.js';
import {campaignRefreshDelay} from '../../../src/hooks/useDirectCatalog.js';

/* December Specials 2026: a dated, server-authoritative selling price layered on the existing commercial pricing.
   Synthetic accounts and mocked Paystack/supplier responses only; no external request can leave this process. */

const originalFetch=globalThis.fetch,init=P.initializeTransaction,verify=P.verifyTransaction,dispatch=F.processPaidOrder,preflight=F.preflightCheck,provider=F.getProvider(),resolve=provider.resolvePackage,clock=C.now;
let server:Server,base:string,parameters:any;
const at=(iso:string)=>{C.now=()=>new Date(iso);};
before(async()=>{const app=express();app.use(express.json());app.use('/api',apiRouter);app.use('/api/admin',adminRouter);server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
after(async()=>{await new Promise<void>(r=>server.close(()=>r()));globalThis.fetch=originalFetch;P.initializeTransaction=init;P.verifyTransaction=verify;F.processPaidOrder=dispatch;F.preflightCheck=preflight;provider.resolvePackage=resolve;C.now=clock;});
beforeEach(async()=>{process.env.NODE_ENV='test';delete process.env.DATABASE_URL;FinanceStore._reset();OrdersStore.clearDevStore();AuthStore._clearDevStore();ReferralStore._clearDevStore();AdminAuditStore._clearDevStore();
 for(const [id,phone] of [['buyer','+233241234567'],['other','+233271234567'],['admin',null]] as const){await AuthStore.createUser({id,name:id,email:id+'@fixture.test',phone,passwordHash:'fixture',role:id==='admin'?'admin':'customer'});await AuthStore.createSession(id,id+'-token');}
 globalThis.fetch=async()=>{throw Error('External network prohibited');};
 P.initializeTransaction=async p=>{parameters=p;return {success:true,reference:p.reference,accessCode:'fixture',authorizationUrl:'https://checkout.paystack.com/fixture'};};P.verifyTransaction=async()=>({isVerified:false,status:'unknown',amountPesewas:0,currency:'GHS'});
 F.processPaidOrder=async ref=>({order:(await OrdersStore.findOrder(ref))!,alreadyHandled:false});F.preflightCheck=async()=>({allowed:true,supplierCostMinor:400});provider.resolvePackage=async()=>({resolved:{supplierCostMinor:400}} as any);
 at('2026-11-11T10:00:00Z');
});
const input=(extra:any={})=>({requestId:randomUUID(),customerEmail:'buyer@fixture.test',...extra});
const order=(extra:any={}):any=>{const id=randomUUID();return {id,user_id:'buyer',public_reference:id,customer_name:'Buyer',customer_email:'buyer@fixture.test',customer_phone:'+233271234567',recipient_phone:'+233271234567',network:'mtn',service_type:'data',product_id:'mtn-1gb',product_name_snapshot:'MTN 1GB',bundle_size_snapshot:'1GB',amount:549,currency:'GHS',status:'pending_payment',payment_provider:'paystack',payment_reference:'MH_'+id,payment_status:'pending',supplier_provider:'success_biz_hub',supplier_order_id:null,supplier_response:null,supplier_cost_minor:400,supplier_last_checked_at:null,failure_reason:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),paid_at:null,submitted_at:null,delivered_at:null,...extra};};
const request=(path:string,body?:any,token='buyer-token')=>originalFetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
/** Stores campaign settings exactly as given (bypassing Admin validation), to prove the read side fails closed. */
const store=(value:any)=>FinanceStore.transaction('admin',tx=>tx.saveConfig('direct-campaign',value));
const ENABLED={...DIRECT_CAMPAIGN_DEFAULT,enabled:true,version:'december-test-enabled'};
const enable=async(extra:any={})=>{await store({...ENABLED,...extra});};
const adminEnable=(extra:any={})=>C.save('admin',{kind:'campaign',confirmed:true,expectedVersion:DIRECT_CAMPAIGN_DEFAULT.version,enabled:true,activation:DECEMBER_2026_CAMPAIGN_ID,startDate:'2026-12-01',endDate:'2027-01-04',products:[{productId:'mtn-1gb',campaignMinor:499},{productId:'mtn-2gb',campaignMinor:899}],...extra});
const price=async(id:string)=>(await C.catalog()).products.find(p=>p.id===id)!;

// ───────── Pricing ─────────
test('shipped disabled: catalogue, quote and revision are exactly the ordinary ones',async()=>{
 const catalog=await C.catalog();assert.equal(catalog.version,'direct-launch-v1');assert.equal('campaign' in catalog,false);
 for(const p of catalog.products){assert.equal('standardPesewas' in p,false);assert.equal('campaign' in p,false);}
 assert.equal((await price('mtn-1gb')).amountPesewas,549);assert.equal((await price('mtn-2gb')).amountPesewas,1049);
 at('2026-12-15T12:00:00Z');// Even inside the dates, a disabled campaign changes nothing.
 const q=await C.quote('mtn-1gb');assert.deepEqual(Object.keys(q).sort(),['buyerPhone','discountMinor','offer','pricingRevision','product','promotionRevision','regularMinor','totalMinor']);
 assert.equal(q.totalMinor,549);assert.equal(q.pricingRevision,'direct-launch-v1');
 assert.equal(DIRECT_CAMPAIGN_DEFAULT.enabled,false,'shipped off, whatever the date');assert.equal(DIRECT_CAMPAIGN_DEFAULT.startDate,'2026-12-01');assert.equal(DIRECT_CAMPAIGN_DEFAULT.endDate,'2027-01-04','approved last day');
 assert.deepEqual({...DIRECT_CAMPAIGN_DEFAULT.products},{'mtn-1gb':{campaignMinor:499},'mtn-2gb':{campaignMinor:899},'mtn-3gb':{campaignMinor:1339},'mtn-4gb':{campaignMinor:1779},'mtn-5gb':{campaignMinor:2199}},'exactly the five approved MTN prices');
});
for(const [when,iso,expected] of [['the day before (23:59:59 Accra)','2026-11-30T23:59:59Z',549],['the first second (00:00 Accra, 1 December)','2026-12-01T00:00:00Z',499],['during','2026-12-18T09:30:00Z',499],['the last second of 4 January (last day)','2027-01-04T23:59:59Z',499],['5 January 00:00 Accra (normal prices)','2027-01-05T00:00:00Z',549]] as const)
 test(`enabled campaign ${when}: MTN 1GB sells for ${expected}`,async()=>{await enable();at(iso);assert.equal((await price('mtn-1gb')).amountPesewas,expected);assert.equal((await C.quote('mtn-1gb')).totalMinor,expected);});
test('Accra dates come from the server clock, not the time zone of the process',()=>{
 const tz=process.env.TZ;process.env.TZ='Pacific/Kiritimati';
 try{assert.equal(campaignState(ENABLED,new Date('2026-11-30T23:00:00Z')),'scheduled');assert.equal(campaignState(ENABLED,new Date('2026-12-01T00:00:00Z')),'active');}finally{if(tz===undefined)delete process.env.TZ;else process.env.TZ=tz;}
});
test('missing or invalid stored settings fail closed to the standard price',async()=>{
 at('2026-12-10T12:00:00Z');
 for(const stored of [{...ENABLED,endDate:null},{...ENABLED,startDate:'2026-12-32'},{...ENABLED,endDate:'2026-11-01'},{...ENABLED,enabled:'true'},{...ENABLED,products:{'mtn-1gb':{campaignMinor:'4.99'}}},{...ENABLED,products:{'mtn-1gb':{campaignMinor:-1}}},{...ENABLED,products:{'mtn-1gb':{campaignMinor:4.99}}},{...ENABLED,products:null},'garbage']){
  await store(stored);assert.equal((await price('mtn-1gb')).amountPesewas,549,JSON.stringify(stored));
 }
 assert.equal(normalizeCampaign(null).enabled,false);
});
test('a campaign never raises a price, ignores unknown products and leaves other services alone',async()=>{
 at('2026-12-10T12:00:00Z');await enable({products:{'mtn-1gb':{campaignMinor:600},'mtn-2gb':{campaignMinor:899},'afa-registration':{campaignMinor:1999},'instant-mtn-1gb':{campaignMinor:1}}});
 const catalog=await C.catalog();assert.equal((await price('mtn-1gb')).amountPesewas,549);assert.equal((await price('mtn-2gb')).amountPesewas,899);
 assert.equal(catalog.products.some(p=>p.id==='afa-registration'||p.id.startsWith('instant-')),false);
 for(const p of catalog.products.filter(p=>p.id!=='mtn-2gb'))assert.equal(p.standardPesewas,undefined,p.id);
 assert.equal(campaignPriceFor(ENABLED,'mtn-1gb',499,new Date('2026-12-10T12:00:00Z')),null,'equal to the standard price is not a special');
});
test('a disabled product stays unavailable during the campaign',async()=>{
 await C.save('admin',{kind:'pricing',confirmed:true,expectedVersion:'direct-launch-v1',reserveBps:0,reserveFixedMinor:0,products:[{productId:'mtn-2gb',retailMinor:1049,recommendedMinor:null,enabled:false}]});
 await enable();at('2026-12-10T12:00:00Z');assert.equal((await C.catalog()).products.some(p=>p.id==='mtn-2gb'),false);await assert.rejects(()=>C.quote('mtn-2gb'),/unavailable/);
});
test('active campaign: public catalogue labels the special and a truthful headline from applied products only',async()=>{
 await enable();at('2026-12-10T12:00:00Z');
 const catalog=await C.catalog(),one=catalog.products.find(p=>p.id==='mtn-1gb')!;
 assert.equal(one.standardPesewas,549);assert.equal(one.amountPesewas,499);assert.equal(one.priceGhc,4.99);assert.equal(one.campaign?.label,'December Special');
 // MTN 2GB: (1049-899)/1049 = 14.3% → "up to 14%". Not 33%: AFA is not part of the applied catalogue.
 assert.deepEqual(catalog.campaign,{id:DECEMBER_2026_CAMPAIGN_ID,label:'December Special',title:'December Specials',endDate:'2027-01-04',endsAt:'2027-01-05T00:00:00.000Z',serverTime:'2026-12-10T12:00:00.000Z',maxSavingPercent:14});
 assert.equal(campaignHeadlinePercent([{amountPesewas:1999,standardPesewas:2999}]),33,'the AFA figure would be 33% once (and only if) it were applied');
 assert.equal(catalog.version,'direct-launch-v1~december-test-enabled');
 assert.doesNotMatch(JSON.stringify(catalog.campaign),/instant/i);
});
test('season preview, query strings and client fields cannot activate or choose a campaign price',async()=>{
 at('2026-11-20T12:00:00Z');await enable();
 for(const path of ['commercial/quote/mtn-1gb?season-preview=christmas-2026&season-date=2026-12-25','commercial/quote/mtn-1gb?campaign=december-specials-2026&now=2026-12-10','commercial/products?season-preview=christmas-2026&season-date=2027-01-01']){
  const body=await (await request(path,undefined,'')).json();const p=body.product||body.products.find((x:any)=>x.id==='mtn-1gb');assert.equal(p.amountPesewas,549,path);
 }
 const r=await C.initialize(order({user_id:null}),input({regularMinor:499,standardMinor:549,campaign:'december-specials-2026',amount:499}));assert.equal(r.amount,549);
});

// ───────── Exact money ─────────
for(const [id,standard,december,first] of [['mtn-1gb',549,499,399],['mtn-2gb',1049,899,799]] as const)
 test(`${id}: standard ${standard}, December ${december}, eligible first purchase ${first}`,async()=>{
  await enable();at('2026-12-10T12:00:00Z');
  const guest=await C.quote(id);assert.equal(guest.standardMinor,standard);assert.equal(guest.regularMinor,december);assert.equal(guest.discountMinor,0);assert.equal(guest.totalMinor,december);assert.equal(guest.campaignSavingMinor,standard-december);
  const eligible=await C.quote(id,'buyer');assert.equal(eligible.offer.state,'eligible');assert.equal(eligible.standardMinor,standard);assert.equal(eligible.regularMinor,december);assert.equal(eligible.discountMinor,100);assert.equal(eligible.totalMinor,first);
  assert.equal(eligible.regularMinor-eligible.discountMinor,eligible.totalMinor);assert.equal((eligible.standardMinor-eligible.totalMinor)/100,(standard-first)/100);
  for(const v of [guest.totalMinor,eligible.totalMinor,eligible.standardMinor])assert.ok(Number.isSafeInteger(v));
  assert.equal(JSON.parse(JSON.stringify(eligible)).totalMinor,first,'integer pesewas survive a JSON round trip');
 });
test('Paystack is initialised for exactly 399 and the snapshot records the whole breakdown',async()=>{
 await enable();at('2026-12-10T12:00:00Z');const q=await C.quote('mtn-1gb','buyer');
 const res=await request('payments/initialize',{productId:'mtn-1gb',recipientPhone:'0271234567',customerEmail:'receipt@fixture.test',requestId:randomUUID(),expectedTotalMinor:q.totalMinor,expectedRegularMinor:q.regularMinor,expectedStandardMinor:q.standardMinor,pricingRevision:q.pricingRevision,promotionRevision:q.promotionRevision});
 assert.equal(res.status,200);const body=await res.json();assert.equal(body.amountPesewas,399);assert.equal(parameters.amountPesewas,399);
 const o=(await OrdersStore.findOrder(body.orderRef))!;assert.equal(o.amount,399);
 assert.equal(o.commercial_context!.standardMinor,549);assert.equal(o.commercial_context!.regularMinor,499);assert.equal(o.commercial_context!.discountMinor,100);assert.equal(o.commercial_context!.paidMinor,399);
 assert.equal(o.commercial_context!.priceCampaignId,DECEMBER_2026_CAMPAIGN_ID);assert.equal(o.commercial_context!.priceCampaignRevision,'december-test-enabled');assert.equal(o.commercial_context!.promotionId,'welcome-v1');
});
test('Wallet debits exactly the December total (no welcome for a returning buyer)',async()=>{
 await enable();at('2026-12-10T12:00:00Z');
 await OrdersStore.createOrder(order({status:'delivered',payment_status:'success'}));
 await FinanceService.adjustment('admin','buyer',{confirmed:true,direction:'credit',amountMinor:1000,requestId:randomUUID(),reason:'Fixture'});
 const q=await C.quote('mtn-1gb','buyer');assert.equal(q.offer.state,'previous_buyer');assert.equal(q.totalMinor,499);
 const r=await C.initialize(order({recipient_phone:'+233200000001'}),input({paymentMethod:'wallet',expectedTotalMinor:499,expectedRegularMinor:499,pricingRevision:q.pricingRevision,promotionRevision:q.promotionRevision}));
 assert.equal(r.amount,499);assert.equal(r.commercial_context!.discountMinor,0);assert.equal((await FinanceService.summary('buyer')).walletMinor,501);
});
test('Wallet debits exactly 399 for an eligible first purchase',async()=>{
 await enable();at('2026-12-10T12:00:00Z');await FinanceService.adjustment('admin','buyer',{confirmed:true,direction:'credit',amountMinor:1000,requestId:randomUUID(),reason:'Fixture'});
 const r=await C.initialize(order(),input({paymentMethod:'wallet',expectedTotalMinor:399}));assert.equal(r.amount,399);assert.equal((await FinanceService.summary('buyer')).walletMinor,601);
});
test('a non-campaign sale during the campaign records no campaign fields',async()=>{
 await enable();at('2026-12-10T12:00:00Z');const r=await C.initialize(order({network:'airteltigo',product_id:'at-1gb',amount:499,recipient_phone:'+233270000000'}),input());
 assert.equal(r.amount,399);for(const k of ['standardMinor','priceCampaignId','priceCampaignRevision'])assert.equal(k in r.commercial_context!,false,k);
});

// ───────── Welcome benefit with the campaign ─────────
test('the welcome benefit is one-time: a first MTN 2GB purchase consumes it, so a later MTN 1GB gets the December price only',async()=>{
 await enable();at('2026-12-10T12:00:00Z');
 const first=await C.initialize(order({product_id:'mtn-2gb',bundle_size_snapshot:'2GB',amount:1049}),input());assert.equal(first.amount,799);
 assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'reserved');assert.equal((await C.quote('mtn-1gb','buyer')).totalMinor,499,'held while that payment is pending');
 const delivered={...first,status:'delivered',payment_status:'success'} as any;await OrdersStore.createOrder(delivered);await C.sync(delivered);await C.sync(delivered);
 const later=await C.quote('mtn-1gb','buyer');assert.equal(later.offer.state,'redeemed');assert.equal(later.totalMinor,499);
 const again=await C.initialize(order({recipient_phone:'+233200000002'}),input());assert.equal(again.amount,499);assert.equal(again.commercial_context!.discountMinor,0);
});
test('account creation alone is not a purchase; missing phone, duplicate phone and claimed phone get the December price only',async()=>{
 await enable();at('2026-12-10T12:00:00Z');
 assert.equal((await C.quote('mtn-1gb','buyer')).totalMinor,399,'a new account with nothing bought is still eligible');
 const user=(await AuthStore.findUserById('buyer'))!;await AuthStore.saveAccount({...user,phone:null});
 let q=await C.quote('mtn-1gb','buyer');assert.equal(q.offer.state,'phone_required');assert.equal(q.totalMinor,499);
 await AuthStore.saveAccount({...user});
 await FinanceStore.transaction('other',tx=>tx.saveConfig('welcome-phone:+233241234567',{userId:'other',orderId:'x',state:'redeemed'}));
 q=await C.quote('mtn-1gb','buyer');assert.equal(q.offer.state,'unavailable');assert.equal(q.totalMinor,499);
});
test('a verified failed payment releases the benefit; an uncertain one keeps it reserved',async()=>{
 await enable();at('2026-12-10T12:00:00Z');
 const o=await C.initialize(order(),input());assert.equal(o.amount,399);
 await C.paymentFailed(o,{isVerified:false,status:'failed',amountPesewas:399,currency:'GHS',reference:o.payment_reference} as any);
 assert.equal((await C.quote('mtn-1gb','buyer')).totalMinor,399,'released after a verified failure');
 const p=await C.initialize(order({recipient_phone:'+233200000003'}),input());assert.equal(p.amount,399);
 await C.paymentFailed(p,{isVerified:false,status:'unknown',amountPesewas:0,currency:'GHS',reference:p.payment_reference} as any);
 await OrdersStore.cancelOrder(p.id,'customer_closed_checkout');
 assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'reserved','an unverified or browser-only outcome never releases it');
 await C.paymentFailed(p,{isVerified:false,status:'failed',amountPesewas:499,currency:'GHS',reference:p.payment_reference} as any);
 assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'reserved','a failure for another amount cannot release the 399 reservation');
});
test('refunds keep the existing rules: full refund restores the benefit once, refund under review does not',async()=>{
 await enable();at('2026-12-10T12:00:00Z');const o=await C.initialize(order(),input());
 const delivered={...o,status:'delivered',payment_status:'success'} as any;await OrdersStore.createOrder(delivered);await C.sync(delivered);
 await C.sync({...delivered,status:'refunded',manual_review:true});assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'redeemed');
 await OrdersStore.createOrder({...delivered,status:'refunded'});await Promise.all([C.sync({...delivered,status:'refunded'}),C.sync({...delivered,status:'refunded'})]);
 assert.equal((await C.quote('mtn-1gb','buyer')).totalMinor,399);
});
test('concurrent tabs and Wallet+Paystack still use the benefit once',async()=>{
 await enable();at('2026-12-10T12:00:00Z');await FinanceService.adjustment('admin','buyer',{confirmed:true,direction:'credit',amountMinor:1000,requestId:randomUUID(),reason:'Fixture'});
 const results=await Promise.allSettled([C.initialize(order(),input()),C.initialize(order({recipient_phone:'+233200000004'}),input()),C.initialize(order({product_id:'mtn-2gb',amount:1049,recipient_phone:'+233200000005'}),input({paymentMethod:'wallet'}))]);
 const ok=results.filter((r:any)=>r.status==='fulfilled').map((r:any)=>r.value);assert.equal(ok.filter(r=>r.commercial_context.discountMinor===100).length,1);
 for(const r of ok)assert.equal(r.amount,r.commercial_context.regularMinor-r.commercial_context.discountMinor);
});
test('a future campaign that does not stack keeps the welcome benefit unused',async()=>{
 await enable({stacksWithWelcome:false});at('2026-12-10T12:00:00Z');
 const q=await C.quote('mtn-1gb','buyer');assert.equal(q.discountMinor,0);assert.equal(q.totalMinor,499);
 const r=await C.initialize(order(),input());assert.equal(r.amount,499);assert.equal(r.commercial_context!.promotionId,null);
 assert.equal((await C.quote('at-1gb','buyer')).totalMinor,399,'still available on a product outside that campaign');
});
test('referral acquisition subsidy is recognised on a December welcome order and uses the December price as its basis',async()=>{
 for(const rule of STANDARD_DATA_REFERRAL_POLICY)await ReferralStore.createOrUpdateRule(rule);
 await C.save('admin',{kind:'pricing',confirmed:true,expectedVersion:'direct-launch-v1',configureReserve:true,reserveBps:0,reserveFixedMinor:20,products:[]});
 await enable();at('2026-12-10T12:00:00Z');
 const o=await C.initialize(order({referrer_user_id:'other'}),input());assert.equal(o.amount,399);assert.equal(o.commercial_context!.contributionMinor,399-400-20);
 await OrdersStore.markOrderPaid(o.payment_reference,new Date().toISOString());await OrdersStore.updateOrderStatus(o.id,'delivered');
 const [reward]=await ReferralStore.findLedgerByOrderId(o.id);assert.equal(reward.reward_stage,'acquisition');assert.equal(reward.amount_minor,50,'the existing fixed first reward, once');
 assert.equal(reward.metadata_json?.calculation_mode,'welcome_acquisition_subsidy');
 const second=await C.initialize(order({recipient_phone:'+233200000006',referrer_user_id:'other'}),input());assert.equal(second.amount,499);
 await OrdersStore.markOrderPaid(second.payment_reference,new Date().toISOString());await OrdersStore.updateOrderStatus(second.id,'delivered');
 const [recurring]=await ReferralStore.findLedgerByOrderId(second.id);assert.equal(recurring.reward_stage,'recurring');assert.equal(recurring.metadata_json?.acquisition_subsidy,false);
});

// ───────── Quote changes during checkout ─────────
test('a quote taken before the start, the end or a campaign change is refused at payment, never silently re-priced',async()=>{
 await enable();at('2026-11-30T23:59:00Z');const before=await C.quote('mtn-1gb','buyer');assert.equal(before.totalMinor,449);
 at('2026-12-01T00:00:30Z');
 await assert.rejects(()=>C.initialize(order(),input({expectedTotalMinor:before.totalMinor,expectedRegularMinor:before.regularMinor,pricingRevision:before.pricingRevision,promotionRevision:before.promotionRevision})),(e:any)=>e.checkout?.code==='CHECKOUT_REVIEW_REQUIRED'&&e.checkout?.paymentState==='not_started');
 const during=await C.quote('mtn-1gb','buyer');assert.equal(during.totalMinor,399);
 at('2027-01-05T00:00:01Z');
 await assert.rejects(()=>C.initialize(order(),input({expectedTotalMinor:during.totalMinor,expectedRegularMinor:during.regularMinor,pricingRevision:during.pricingRevision,promotionRevision:during.promotionRevision})),(e:any)=>e.checkout?.code==='CHECKOUT_REVIEW_REQUIRED'&&e.checkout?.paymentState==='not_started');
 at('2026-12-10T00:00:00Z');const q=await C.quote('mtn-1gb');
 await store({...ENABLED,version:'december-test-changed',products:{'mtn-1gb':{campaignMinor:489}}});
 await assert.rejects(()=>C.initialize(order({user_id:null}),input({expectedTotalMinor:q.totalMinor,expectedRegularMinor:q.regularMinor,pricingRevision:q.pricingRevision})),(e:any)=>e.checkout?.code==='CHECKOUT_REVIEW_REQUIRED'&&e.checkout?.paymentState==='not_started');
 assert.equal(OrdersStore.adminDevOrders().length,0,'no order or payment was created for a stale quote');
});
test('losing eligibility between quote and payment, or a stale standard price, requires review',async()=>{
 await enable();at('2026-12-10T12:00:00Z');const q=await C.quote('mtn-1gb','buyer');assert.equal(q.totalMinor,399);
 await OrdersStore.createOrder(order({status:'delivered',payment_status:'success',recipient_phone:'+233200000007'}));
 await assert.rejects(()=>C.initialize(order(),input({expectedTotalMinor:399,expectedRegularMinor:499,pricingRevision:q.pricingRevision,promotionRevision:q.promotionRevision})),(e:any)=>e.checkout?.code==='CHECKOUT_REVIEW_REQUIRED'&&e.checkout?.paymentState==='not_started');
 await assert.rejects(()=>C.initialize(order({user_id:null}),input({expectedTotalMinor:499,expectedStandardMinor:599})),(e:any)=>e.checkout?.code==='CHECKOUT_REVIEW_REQUIRED'&&e.checkout?.paymentState==='not_started');
});
test('a December price below the current supplier cost refuses checkout instead of selling at a loss',async()=>{
 await enable();at('2026-12-10T12:00:00Z');
 await assert.rejects(()=>C.initialize(order({user_id:null,supplier_cost_minor:520}),input()),(e:any)=>e.checkout?.code==='CHECKOUT_REVIEW_REQUIRED'&&e.checkout?.paymentState==='not_started');
 const ok=await C.initialize(order({user_id:null,supplier_cost_minor:430}),input());assert.equal(ok.amount,499);
});
test('historical orders keep their paid amount and snapshot after the campaign ends or changes',async()=>{
 await enable();at('2026-12-10T12:00:00Z');const o=await C.initialize(order(),input());const snapshot=JSON.stringify(o.commercial_context);
 at('2027-01-10T12:00:00Z');await store({...ENABLED,version:'later',products:{'mtn-1gb':{campaignMinor:450}}});
 const saved=(await OrdersStore.findOrder(o.id))!;assert.equal(saved.amount,399);assert.equal(JSON.stringify(saved.commercial_context),snapshot);
 const safe=toSafePublicOrder(saved) as any;assert.deepEqual(safe.commercial_pricing,{regularMinor:499,discountMinor:100,paidMinor:399,standardMinor:549});
 assert.equal(JSON.stringify(safe).includes('+233241234567'),false);assert.equal('priceCampaignRevision' in safe.commercial_pricing,false);
 const old=toSafePublicOrder({...saved,commercial_context:{regularMinor:549,discountMinor:100,paidMinor:449,pricingRevision:'direct-launch-v1',promotionId:'welcome-v1',promotionRevision:'welcome-launch-v1',buyerPhone:null,supplierCostMinor:400,reserveMinor:null,contributionMinor:null}} as any) as any;
 assert.deepEqual(old.commercial_pricing,{regularMinor:549,discountMinor:100,paidMinor:449},'pre-campaign snapshots are read exactly as before');
});

// ───────── Admin ─────────
test('enabling needs Admin, a typed confirmation, complete dates and known supplier cost; changes are audited',async()=>{
 assert.equal((await request('admin/commercial',{kind:'campaign'},'buyer-token')).status,403);
 await assert.rejects(()=>adminEnable({activation:undefined}),/Type december-specials-2026/);
 await assert.rejects(()=>adminEnable({endDate:null}),/first and last day/);
 await assert.rejects(()=>adminEnable({endDate:'2026-11-30'}),/on or after/);
 await assert.rejects(()=>adminEnable({products:[{productId:'mtn-1gb',campaignMinor:549}]}),/below the standard price/);
 await assert.rejects(()=>adminEnable({products:[{productId:'afa-registration',campaignMinor:1999}]}),/standard Data product/);
 await assert.rejects(()=>adminEnable({products:[{productId:'mtn-1gb',campaignMinor:'4.99'}]}));
 await assert.rejects(()=>adminEnable({confirmed:false}),/Confirm/);
 await assert.rejects(()=>adminEnable({expectedVersion:'stale'}),/Refresh/);
 provider.resolvePackage=async()=>null as any;await assert.rejects(()=>adminEnable(),/known authoritative supplier cost/);
 provider.resolvePackage=async()=>({resolved:{supplierCostMinor:520}} as any);await assert.rejects(()=>adminEnable(),/known authoritative supplier cost/);
 provider.resolvePackage=async()=>({resolved:{supplierCostMinor:400}} as any);
 at('2027-01-05T08:00:00Z');await assert.rejects(()=>adminEnable(),/already ended/);at('2026-11-11T10:00:00Z');
 assert.equal((await price('mtn-1gb')).amountPesewas,549,'nothing was saved by the refused attempts');
 const saved=await adminEnable();assert.equal(saved.enabled,true);assert.notEqual(saved.version,DIRECT_CAMPAIGN_DEFAULT.version);
 assert.equal((await price('mtn-1gb')).amountPesewas,549,'scheduled: still the standard price on 11 November');
 at('2026-12-01T00:00:00Z');assert.equal((await price('mtn-1gb')).amountPesewas,499);
 const audit=(await AdminAuditStore.findRecent(10)).find(a=>a.action==='commercial_campaign_changed')!;const meta=JSON.parse(audit.metadata_safe_json||'{}');
 assert.equal(meta.previous.enabled,false);assert.equal(meta.next.enabled,true);assert.equal(meta.next.endDate,'2027-01-04');
 const off=await C.save('admin',{kind:'campaign',confirmed:true,expectedVersion:saved.version,enabled:false,startDate:'2026-12-01',endDate:'2027-01-05',products:[{productId:'mtn-1gb',campaignMinor:499}]});
 assert.equal(off.enabled,false);assert.equal((await price('mtn-1gb')).amountPesewas,549,'turning it off restores the standard price immediately');
});
test('Admin input cannot name inherited or prototype keys as products; stored ones are ignored',async()=>{
 for(const productId of ['toString','__proto__','constructor','hasOwnProperty'])await assert.rejects(()=>adminEnable({products:[{productId,campaignMinor:100}]}),/standard Data product/,productId);
 at('2026-12-10T12:00:00Z');await store(JSON.parse('{"enabled":true,"startDate":"2026-12-01","endDate":"2027-01-05","version":"x","products":{"__proto__":{"campaignMinor":1},"mtn-1gb":{"campaignMinor":499}}}'));
 assert.equal((await price('mtn-1gb')).amountPesewas,499);assert.equal(normalizeCampaign(JSON.parse('{"products":{"__proto__":{"campaignMinor":1}}}')).products['__proto__'],undefined);
});
test('a disabled draft can be prepared without supplier cost; the welcome offer cannot empty a campaign payment',async()=>{
 provider.resolvePackage=async()=>null as any;
 const draft=await C.save('admin',{kind:'campaign',confirmed:true,expectedVersion:DIRECT_CAMPAIGN_DEFAULT.version,enabled:false,startDate:'2026-12-01',endDate:null,products:[{productId:'mtn-1gb',campaignMinor:120},{productId:'mtn-3gb',campaignMinor:1399}]});
 assert.equal(draft.enabled,false);assert.deepEqual(draft.products['mtn-3gb'],{campaignMinor:1399});
 await assert.rejects(()=>C.save('admin',{kind:'offer',confirmed:true,expectedVersion:'welcome-launch-v1',enabled:true,discountMinor:150,services:['data'],requirement:'unique_phone'}),/positive payment/);
});
test('Admin view: dates, state, standard vs December prices, contributions, issues and AFA blocker',async()=>{
 await C.save('admin',{kind:'pricing',confirmed:true,expectedVersion:'direct-launch-v1',configureReserve:true,reserveBps:195,reserveFixedMinor:0,products:[]});
 const view:any=await C.admin();assert.equal(view.campaign.state,'disabled');assert.equal(view.campaign.today,'2026-11-11');assert.equal(view.campaign.startDate,'2026-12-01');
 const one=view.products.find((p:any)=>p.id==='mtn-1gb');
 assert.equal(one.retailMinor,549);assert.equal(one.campaignMinor,499);assert.equal(one.campaignApplies,false);assert.equal(one.effectiveMinor,549);assert.equal(one.campaignWelcomeTotalMinor,399);
 assert.equal(one.campaignContributionMinor,499-400-10);assert.equal(one.campaignWelcomeContributionMinor,399-400-8);assert.deepEqual(one.campaignIssues,[]);
 assert.equal(view.products.find((p:any)=>p.id==='mtn-3gb').campaignMinor,1339);assert.equal(view.products.find((p:any)=>p.id==='mtn-6gb').campaignMinor,null,'no unapproved size');
 assert.equal(view.afa.promotionApplies,false);assert.equal(view.afa.config.enabled,false);assert.equal(view.afa.config.campaignMinor,1999);assert.equal(view.afa.config.cost,null);assert.ok(view.afa.blockers.includes('No Admin-confirmed contractual supplier cost.'));
 provider.resolvePackage=async()=>({resolved:{supplierCostMinor:520}} as any);
 assert.match(((await C.admin()) as any).products.find((p:any)=>p.id==='mtn-1gb').campaignIssues.join(' '),/below the current supplier cost/);
});
test('the Data Store recommendation and reseller economics do not read the campaign',()=>{
 const store=readFileSync('server/services/websiteBusinessService.ts','utf8');assert.doesNotMatch(store,/direct-campaign|campaignPriceFor|CommercialService\.catalog/);
});

// ───────── Finalized plan (13 November 2026) ─────────
const PLAN:[string,number,number,number][]=[['mtn-1gb',549,499,399],['mtn-2gb',1049,899,799],['mtn-3gb',1499,1339,1239],['mtn-4gb',1949,1779,1679],['mtn-5gb',2399,2199,2099]];
for(const [id,standard,december,first] of PLAN)test(`approved ${id}: standard ${standard}, December ${december}, first purchase ${first} (one welcome benefit)`,async()=>{
 await enable();at('2026-12-20T09:00:00Z');
 const guest=await C.quote(id),eligible=await C.quote(id,'buyer');
 assert.deepEqual([guest.standardMinor,guest.regularMinor,guest.discountMinor,guest.totalMinor],[standard,december,0,december]);
 assert.deepEqual([eligible.standardMinor,eligible.regularMinor,eligible.discountMinor,eligible.totalMinor],[standard,december,100,first]);
 const paid=await C.initialize(order({product_id:id,bundle_size_snapshot:id.slice(4).toUpperCase(),amount:standard}),input({expectedTotalMinor:first,expectedRegularMinor:december,expectedStandardMinor:standard,pricingRevision:eligible.pricingRevision,promotionRevision:eligible.promotionRevision}));
 assert.equal(paid.amount,first);assert.equal(paid.commercial_context!.regularMinor-paid.commercial_context!.discountMinor,paid.amount);
 assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'reserved','that first purchase holds the one benefit; no second redemption');
});
test('only the five approved products change; every other price, Instant and reseller pricing stay standard',async()=>{
 await enable();at('2026-12-20T09:00:00Z');const approved=PLAN.map(p=>p[0]);
 for(const p of (await C.catalog()).products){
  if(approved.includes(p.id))assert.equal(p.standardPesewas,DIRECT_RETAIL_MINOR[p.id],p.id);
  else{assert.equal(p.amountPesewas,DIRECT_RETAIL_MINOR[p.id],p.id);assert.equal(p.standardPesewas,undefined,p.id);}
 }
 assert.equal((await C.catalog()).products.some(p=>/^(instant|airtime)-/.test(p.id)),false);
 const store=readFileSync('server/services/websiteBusinessService.ts','utf8');assert.doesNotMatch(store,/direct-campaign|campaignPriceFor/);
});
test('5 January: commercial prices are normal and every promotional field is gone, while the New Year appearance still runs',async()=>{
 await enable();at('2027-01-05T00:00:00Z');const catalog=await C.catalog();
 assert.equal(catalog.version,'direct-launch-v1');assert.equal('campaign' in catalog,false);
 for(const p of catalog.products){assert.equal('standardPesewas' in p,false);assert.equal('campaign' in p,false);}
 const q=await C.quote('mtn-5gb','buyer');assert.equal(q.totalMinor,2299);assert.equal('standardMinor' in q,false);
 assert.equal(serverSeasonStatus('christmas-2026',new Date('2027-01-05T12:00:00Z')).active,true,'visuals continue on 5 January');
 assert.equal(campaignEndsAt(ENABLED),'2027-01-05T00:00:00.000Z');
});
test('an open page refreshes at the server boundary, measured on the server clock (not the device date)',()=>{
 assert.equal(campaignRefreshDelay({endsAt:'2027-01-05T00:00:00.000Z',serverTime:'2027-01-04T23:59:00.000Z'}),61500);
 for(const c of [{endsAt:'2027-01-05T00:00:00.000Z',serverTime:'2027-01-05T00:00:01.000Z'},{endsAt:'x',serverTime:'2027-01-04T00:00:00Z'},{},null,{endsAt:'2027-03-05T00:00:00Z',serverTime:'2026-12-01T00:00:00Z'}])assert.equal(campaignRefreshDelay(c),null,JSON.stringify(c));
});
test('shipped draft vs saved Admin settings: a saved campaign is authoritative and never migrated by a deploy',async()=>{
 let view:any=await C.admin();assert.equal(view.campaign.source,'shipped-default');assert.deepEqual(view.campaign.planDifferences,[]);assert.equal(view.campaign.enabled,false);
 // An older saved draft (as PR #112 allowed): two products, no last day.
 const old={id:DECEMBER_2026_CAMPAIGN_ID,enabled:false,startDate:'2026-12-01',endDate:null,stacksWithWelcome:true,products:{'mtn-1gb':{campaignMinor:499},'mtn-2gb':{campaignMinor:899}},version:'saved-older-draft'};
 await store(old);view=await C.admin();
 assert.equal(view.campaign.source,'saved');assert.equal(view.campaign.endDate,null,'the saved value wins over the shipped 4 January');
 assert.deepEqual(view.campaign.planDifferences,['Last day is not set; approved 2027-01-04.','mtn-3gb is missing; approved 1339 pesewas.','mtn-4gb is missing; approved 1779 pesewas.','mtn-5gb is missing; approved 2199 pesewas.']);
 assert.deepEqual(view.campaign.approvedPlan.products['mtn-5gb'],{campaignMinor:2199});
 // Even enabled, the old saved list applies only its own products: nothing is silently added.
 await store({...old,enabled:true,endDate:'2027-01-04',version:'saved-enabled'});at('2026-12-20T09:00:00Z');
 assert.equal((await price('mtn-1gb')).amountPesewas,499);assert.equal((await price('mtn-3gb')).amountPesewas,1499);
 // The Admin path: load the approved plan into a draft and save it, still disabled.
 at('2026-11-13T10:00:00Z');await store(old);
 const saved=await C.save('admin',{kind:'campaign',confirmed:true,expectedVersion:'saved-older-draft',enabled:false,startDate:'2026-12-01',endDate:'2027-01-04',products:PLAN.map(([productId,,campaignMinor])=>({productId,campaignMinor}))});
 assert.equal(saved.enabled,false);view=await C.admin();assert.deepEqual(view.campaign.planDifferences,[]);assert.equal(view.campaign.source,'saved');
 at('2026-12-20T09:00:00Z');assert.equal((await price('mtn-3gb')).amountPesewas,1499,'a saved draft stays standard until enabled');
});
test('economics: costs only from the routed supplier; unknown cost keeps the enable blocker; value ladder and referral exposure',async()=>{
 for(const rule of STANDARD_DATA_REFERRAL_POLICY)await ReferralStore.createOrUpdateRule(rule);
 await C.save('admin',{kind:'pricing',confirmed:true,expectedVersion:'direct-launch-v1',configureReserve:true,reserveBps:195,reserveFixedMinor:0,products:[]});
 provider.resolvePackage=async(_n:string,size:string)=>({resolved:{supplierCostMinor:Math.round(parseFloat(size)*400)}} as any);
 let view:any=await C.admin();const row=(id:string)=>view.products.find((p:any)=>p.id===id);
 const five=row('mtn-5gb');assert.equal(five.campaignSupplier,'success_biz_hub');assert.equal(five.supplierCostMinor,2000);
 assert.equal(five.campaignContributionMinor,2199-2000-43);assert.equal(five.campaignWelcomeContributionMinor,2099-2000-41);
 assert.equal(row('mtn-1gb').campaignWelcomeContributionMinor,399-400-8,'a loss-making first purchase is reported, not repriced');
 assert.equal(row('mtn-1gb').campaignFirstReferralRewardMinor,50);assert.equal(row('mtn-1gb').campaignAcquisitionContributionMinor,399-400-8-50);
 // At 21.99 (4.40/GB) the 5GB undercuts every larger standard MTN bundle: reported, never silently repriced.
 assert.deepEqual(view.campaign.valueWarnings.map((w:any)=>[w.id,w.minor,w.combinationMinor,w.combination.join(' + ')]),[['mtn-6gb',2849,2678,'MTN 2GB + MTN 4GB'],['mtn-8gb',3699,3538,'MTN 3GB + MTN 5GB'],['mtn-10gb',4499,4398,'2 × MTN 5GB'],['mtn-15gb',6699,6597,'3 × MTN 5GB'],['mtn-20gb',8899,8796,'4 × MTN 5GB'],['mtn-25gb',11099,10995,'5 × MTN 5GB'],['mtn-30gb',13299,13194,'6 × MTN 5GB'],['mtn-40gb',17699,17592,'8 × MTN 5GB']]);
 for(const w of view.campaign.valueWarnings)assert.equal(row(w.id).campaignMinor,null,'only standard sizes are flagged; none was added to the campaign');
 assert.deepEqual(campaignValueWarnings(Object.entries(DIRECT_RETAIL_MINOR).filter(([id])=>id.startsWith('mtn-')).map(([id,minor])=>({id,label:id,gb:parseFloat(id.slice(4)),minor}))),[],'standard prices have no such inversion');
 // No routable supplier (e.g. a route that is not Success Biz Hub, or none): cost unconfirmed and enabling refused.
 const route=F.resolveRoute;F.resolveRoute=(()=>{throw new Error('no route');}) as any;
 try{view=await C.admin();assert.equal(row('mtn-1gb').campaignSupplier,null);assert.match(row('mtn-1gb').campaignIssues.join(' '),/Supplier cost is unknown/);
  await assert.rejects(()=>adminEnable(),/supplier that would fulfil it/);}finally{F.resolveRoute=route;}
 provider.resolvePackage=async(_n:string,size:string)=>size==='5GB'?null as any:({resolved:{supplierCostMinor:400}} as any);
 await assert.rejects(()=>adminEnable({products:PLAN.map(([productId,,campaignMinor])=>({productId,campaignMinor}))}),/MTN Ghana 5GB: a December price must cover/);
});
