import assert from 'node:assert/strict';
import {test,beforeEach,before,after} from 'node:test';
import {randomUUID,createHmac} from 'node:crypto';
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
import {AdminAuditStore} from '../../db/adminAuditStore.js';
import {PaystackServerService as P} from '../../services/paystackService.js';
import {FulfilmentService as F} from '../../services/fulfilmentService.js';
import {DIRECT_RETAIL_MINOR} from '../../../shared/directPricing.js';
import {DATA_BUNDLES} from '../../../src/data/bundles.js';
import {canonicalGhanaPhone} from '../../utils/phone.js';
import {apiRouter,handlePaystackWebhook} from '../../routes/api.js';
import {adminRouter} from '../../routes/adminApi.js';
import {validateOrderPayment} from '../../services/paymentValidation.js';
import {computeEconomicReward} from '../../services/referralEconomics.js';
import {toSafePublicOrder} from '../../types/orders.js';
import {COMMERCIAL_SCHEMA} from '../../db/commercialSchema.js';

const originalFetch=globalThis.fetch,init=P.initializeTransaction,verify=P.verifyTransaction,dispatch=F.processPaidOrder,preflight=F.preflightCheck,provider=F.getProvider(),resolve=provider.resolvePackage;
let server:Server,base:string,parameters:any;
before(async()=>{const app=express();app.use(express.json());app.post('/api/webhooks/paystack',handlePaystackWebhook);app.use('/api',apiRouter);app.use('/api/admin',adminRouter);server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
after(async()=>{await new Promise<void>(r=>server.close(()=>r()));globalThis.fetch=originalFetch;P.initializeTransaction=init;P.verifyTransaction=verify;F.processPaidOrder=dispatch;F.preflightCheck=preflight;provider.resolvePackage=resolve;});
beforeEach(async()=>{process.env.NODE_ENV='test';delete process.env.DATABASE_URL;FinanceStore._reset();OrdersStore.clearDevStore();AuthStore._clearDevStore();ReferralStore._clearDevStore();AdminAuditStore._clearDevStore();
 for(const [id,phone] of [['buyer','+233241234567'],['other','+233271234567'],['admin',null]] as const){await AuthStore.createUser({id,name:id,email:id+'@fixture.test',phone,passwordHash:'fixture',role:id==='admin'?'admin':'customer'});await AuthStore.createSession(id,id+'-token');}
 globalThis.fetch=async()=>{throw Error('External network prohibited');};
 P.initializeTransaction=async p=>{parameters=p;return {success:true,reference:p.reference,accessCode:'fixture',authorizationUrl:'https://checkout.paystack.com/fixture'};};P.verifyTransaction=async()=>({isVerified:false,status:'unknown',amountPesewas:0,currency:'GHS'});
 F.processPaidOrder=async ref=>({order:(await OrdersStore.findOrder(ref))!,alreadyHandled:false});F.preflightCheck=async()=>({allowed:true,supplierCostMinor:400});provider.resolvePackage=async()=>({resolved:{supplierCostMinor:400}} as any);
});
const input=(extra:any={})=>({requestId:randomUUID(),customerEmail:'buyer@fixture.test',...extra});
const order=(extra:any={}):any=>{const id=randomUUID();return {id,user_id:'buyer',public_reference:id,customer_name:'Buyer',customer_email:'buyer@fixture.test',customer_phone:'+233271234567',recipient_phone:'+233271234567',network:'mtn',service_type:'data',product_id:'mtn-1gb',product_name_snapshot:'MTN 1GB',bundle_size_snapshot:'1GB',amount:549,currency:'GHS',status:'pending_payment',payment_provider:'paystack',payment_reference:'MH_'+id,payment_status:'pending',supplier_provider:'success_biz_hub',supplier_order_id:null,supplier_response:null,supplier_cost_minor:400,supplier_offer_ref:null,supplier_last_checked_at:null,failure_reason:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),paid_at:null,submitted_at:null,delivered_at:null,...extra};};
const request=(path:string,body?:any,token='buyer-token')=>originalFetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
const initialize=()=>C.initialize(order(),input());
for(const [id,price] of Object.entries(DIRECT_RETAIL_MINOR))test('approved launch catalog and frontend seed '+id,async()=>{assert.equal((await C.catalog()).products.find(p=>p.id===id)?.amountPesewas,price);assert.equal(DATA_BUNDLES.find(p=>p.id===id)?.priceGhc,price/100);});
for(const phone of ['0241234567','233241234567','+233241234567','(024) 123-4567'])test('canonical identity '+phone,()=>assert.equal(canonicalGhanaPhone(phone),'+233241234567'));
test('older unused buyer gets exact 100 discount and 449 total independent of recipient',async()=>{const q=await C.quote('mtn-1gb','buyer');assert.equal(q.discountMinor,100);assert.equal(q.totalMinor,449);const result=await initialize();assert.equal(result.amount,449);assert.equal(parameters.amountPesewas,449);assert.notEqual(result.recipient_phone,result.commercial_context!.buyerPhone);assert.equal((await C.quote('mtn-1gb','other')).discountMinor,100);});
test('guest receives regular retail and no buyer identity',async()=>{const q=await C.quote('mtn-1gb');assert.equal(q.discountMinor,0);assert.equal(q.totalMinor,549);const result=await C.initialize(order({user_id:null}),input());assert.equal(result.amount,549);assert.equal(result.commercial_context!.promotionId,null);});
test('missing phone preserves account but requires identity for offer',async()=>{const user=(await AuthStore.findUserById('buyer'))!;await AuthStore.saveAccount({...user,phone:null});assert.ok(await AuthStore.findSessionByToken('buyer-token'));assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'phone_required');});
test('historical delivered direct buyer ineligible',async()=>{await OrdersStore.createOrder(order({status:'delivered',payment_status:'success'}));assert.equal((await C.quote('mtn-1gb','buyer')).discountMinor,0);});
test('reseller history does not consume direct eligibility',async()=>{await OrdersStore.createOrder(order({status:'delivered',payment_status:'success',store_context:{siteId:'fixture'}}));assert.equal((await C.quote('mtn-1gb','buyer')).discountMinor,100);});
test('concurrent tabs reserve one promotion',async()=>{const results=await Promise.all([initialize(),initialize()]);assert.equal(results.filter(r=>r.commercial_context!.discountMinor===100).length,1);assert.equal(results.filter(r=>r.amount===549).length,1);});
test('same request does not initialize Paystack twice',async()=>{let calls=0;P.initializeTransaction=async p=>{calls++;return {success:true,reference:p.reference,accessCode:'fixture'};};const draft=order(),body=input();const [a,b]=await Promise.all([C.initialize(draft,body),C.initialize(draft,body)]);assert.equal(a.id,b.id);assert.equal(calls,1);});
test('stale discounted quote cannot silently become regular checkout',async()=>{const q=await C.quote('mtn-1gb','buyer');await initialize();await assert.rejects(()=>C.initialize(order(),input({expectedTotalMinor:q.totalMinor})),/changed/);});
test('price and discount tampering cannot select server total',async()=>{const result=await C.initialize(order(),input({discountMinor:500,amount:1,regularMinor:1,user_id:'other'}));assert.equal(result.amount,449);assert.equal(parameters.amountPesewas,449);});
test('wrong amount/currency/reference cannot verify discounted payment',async()=>{const o=await initialize();for(const extra of [{amountPesewas:549},{currency:'USD'},{reference:'other'}])assert.ok(validateOrderPayment(o,{isVerified:true,status:'success',amountPesewas:449,currency:'GHS',reference:o.payment_reference,...extra}));assert.equal(validateOrderPayment(o,{isVerified:true,status:'success',amountPesewas:449,currency:'GHS',reference:o.payment_reference}),null);});
test('Wallet exact debit and insufficient debit rollback reservation',async()=>{await assert.rejects(()=>C.initialize(order(),input({paymentMethod:'wallet'})),/Insufficient/);assert.equal((await C.quote('mtn-1gb','buyer')).discountMinor,100);await FinanceService.adjustment('admin','buyer',{confirmed:true,direction:'credit',amountMinor:1000,requestId:randomUUID(),reason:'Fixture'});const result=await C.initialize(order(),input({paymentMethod:'wallet'}));assert.equal(result.amount,449);assert.equal((await FinanceService.summary('buyer')).walletMinor,551);});
test('Paystack and Wallet concurrency can use welcome once',async()=>{await FinanceService.adjustment('admin','buyer',{confirmed:true,direction:'credit',amountMinor:1000,requestId:randomUUID(),reason:'Fixture'});const results=await Promise.allSettled([initialize(),C.initialize(order({network:'airteltigo',product_id:'at-1gb',amount:499}),input({paymentMethod:'wallet'}))]);assert.equal(results.filter((r:any)=>r.status==='fulfilled'&&r.value.commercial_context.discountMinor===100).length,1);});
test('definitive initialization rejection releases; ambiguous result does not',async()=>{P.initializeTransaction=async p=>({success:false,reference:p.reference,definitiveFailure:true});await assert.rejects(initialize);assert.equal((await C.quote('mtn-1gb','buyer')).discountMinor,100);P.initializeTransaction=async p=>({success:false,reference:p.reference});await assert.rejects(initialize);assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'reserved');});
test('browser cancellation does not release while acceptance uncertain',async()=>{const o=await initialize();await OrdersStore.cancelOrder(o.id,'customer_closed_checkout');assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'reserved');});
for(const status of ['failed','abandoned'] as const)test('verified '+status+' releases once',async()=>{const o=await initialize();await C.paymentFailed(o,{isVerified:false,status,amountPesewas:449,currency:'GHS',reference:o.payment_reference});await C.paymentFailed(o,{isVerified:false,status,amountPesewas:449,currency:'GHS',reference:o.payment_reference});assert.equal((await C.quote('mtn-1gb','buyer')).discountMinor,100);assert.equal(await C.allowPaid(o),false);});
test('forged terminal result cannot release reservation',async()=>{const o=await initialize();await C.paymentFailed(o,{isVerified:false,status:'failed',amountPesewas:1,currency:'USD',reference:o.payment_reference});assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'reserved');});
test('delivered redemption, duplicate effects, full refund and review protection',async()=>{const o=await initialize();const delivered={...o,status:'delivered',payment_status:'success'} as any;await OrdersStore.createOrder(delivered);await Promise.all([C.sync(delivered),C.sync(delivered)]);assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'redeemed');await C.sync({...delivered,status:'refunded',manual_review:true});assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'redeemed');await OrdersStore.createOrder({...delivered,status:'refunded'});await Promise.all([C.sync({...delivered,status:'refunded'}),C.sync({...delivered,status:'refunded'})]);assert.equal((await C.quote('mtn-1gb','buyer')).discountMinor,100);});
test('supplier ambiguity keeps reservation',async()=>{const o=await initialize();await C.sync({...o,status:'queued',manual_review:true,payment_status:'success'});assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'reserved');});
test('referrals use discounted revenue, not regular price',async()=>{const o=await initialize();const reward=computeEconomicReward(o,null,100,{service:'data',enabled:true,version:'fixture',reserveMinor:0,reserveBps:0,supplierCostMinor:null,mode:'fixed',marginBps:0});assert.equal(reward.amount,49);});
test('Admin future price persists and leaves historical order/economics unchanged',async()=>{const o=await initialize();const before=JSON.stringify(o.commercial_context);await C.save('admin',{kind:'pricing',confirmed:true,expectedVersion:'direct-launch-v1',configureReserve:true,reserveBps:200,reserveFixedMinor:10,products:[{productId:'mtn-1gb',retailMinor:599,recommendedMinor:649,enabled:true}]});assert.equal((await C.catalog()).products.find(p=>p.id==='mtn-1gb')?.amountPesewas,599);assert.equal((await OrdersStore.findOrder(o.id))?.amount,449);assert.equal(JSON.stringify((await OrdersStore.findOrder(o.id))?.commercial_context),before);assert.equal(await FinanceStore.readConfig('store-wholesale'),undefined);});
test('Admin stale revision and unsafe regular retail rejected',async()=>{const body={kind:'pricing',confirmed:true,expectedVersion:'wrong',reserveBps:0,reserveFixedMinor:0,products:[]};await assert.rejects(()=>C.save('admin',body),/changed/);await assert.rejects(()=>C.save('admin',{...body,expectedVersion:'direct-launch-v1',products:[{productId:'mtn-1gb',retailMinor:399,recommendedMinor:null,enabled:true}]}),/cost/);});
test('offer enabled/scope/amount editable; invalid total rejected',async()=>{let r=await C.save('admin',{kind:'offer',confirmed:true,expectedVersion:'welcome-launch-v1',enabled:false,discountMinor:100,services:['data'],requirement:'unique_phone'});assert.equal((await C.quote('mtn-1gb','buyer')).discountMinor,0);r=await C.save('admin',{kind:'offer',confirmed:true,expectedVersion:r.version,enabled:true,discountMinor:150,services:['data'],requirement:'unique_phone'});assert.equal((await C.quote('mtn-1gb','buyer')).totalMinor,399);await assert.rejects(()=>C.save('admin',{kind:'offer',confirmed:true,expectedVersion:r.version,enabled:true,discountMinor:999,services:['data'],requirement:'unique_phone'}),/positive/);});
test('Admin contribution uses actual cost and configured reserve; subsidy warning input remains allowed',async()=>{await C.save('admin',{kind:'pricing',confirmed:true,expectedVersion:'direct-launch-v1',configureReserve:true,reserveBps:300,reserveFixedMinor:10,products:[]});const row=(await C.admin()).products.find(p=>p.id==='mtn-1gb')!;assert.equal(row.supplierCostMinor,400);assert.equal(row.reserveMinor,26);assert.equal(row.contributionMinor,123);assert.equal(row.promoContributionMinor,26);});
test('public quote no phone/cost/owner leak; authenticated identity is authoritative',async()=>{const response=await request('commercial/quote/mtn-1gb?user_id=other');assert.equal(response.status,200);const json=await response.json();assert.equal(json.totalMinor,449);assert.ok(!JSON.stringify(json).includes('241234567'));assert.ok(!('supplierCostMinor' in json));});
test('Admin pricing RBAC and explicit confirmation enforced',async()=>{assert.equal((await request('admin/commercial')).status,403);assert.equal((await request('admin/commercial',{},'admin-token')).status,400);});
test('signup phone required; optional email and phone/email login preserved',async()=>{const pwd='Fixture-password-26';let r=await request('auth/register',{name:'Fixture',identifier:'new@fixture.test',password:pwd},'');assert.equal(r.status,400);r=await request('auth/register',{name:'Fixture',phone:'0249998888',identifier:'0249998888',password:pwd},'');assert.equal(r.status,201);assert.equal((await r.json()).user.email,null);r=await request('auth/login',{identifier:'233249998888',password:pwd},'');assert.equal(r.status,200);r=await request('auth/register',{name:'Fixture2',phone:'+233249998888',email:'different@fixture.test',password:pwd},'');assert.equal(r.status,409);});
test('equivalent-phone duplicate creation denied independently of frontend',async()=>{for(const phone of ['0241234567','233241234567'])await assert.rejects(()=>AuthStore.createUser({id:randomUUID(),name:'Fixture',phone,email:randomUUID()+'@fixture.test',passwordHash:'fixture'}));});
test('schema mirrors initializer, immutable snapshots and phone uniqueness',()=>{assert.ok(readFileSync('server/db/schema.sql','utf8').replace(/\r\n/g,'\n').includes(COMMERCIAL_SCHEMA.trim()));assert.ok(COMMERCIAL_SCHEMA.includes('users_phone_identity_unique'));assert.ok(COMMERCIAL_SCHEMA.includes('NOT EXISTS'));assert.ok(COMMERCIAL_SCHEMA.includes('IS DISTINCT FROM'));assert.ok(!COMMERCIAL_SCHEMA.includes('DELETE FROM users'));});
test('checkout contract and discovery are server-derived; no raw-config Admin workflow',()=>{const checkout=readFileSync('src/components/checkout/CheckoutModal.tsx','utf8');assert.ok(checkout.includes('expectedTotalMinor:commercial.totalMinor'));assert.ok(checkout.includes('commercial.discountMinor'));assert.ok(readFileSync('src/components/admin/sections/AdminCommercialSection.tsx','utf8').includes('negative expected contribution'));});

test('stale verified failure cannot release an already-paid order',async()=>{
 const stale=await initialize();await OrdersStore.markOrderPaid(stale.payment_reference,new Date().toISOString());
 await C.paymentFailed(stale,{isVerified:false,status:'failed',reference:stale.payment_reference,amountPesewas:449,currency:'GHS'});
 assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'reserved');
});
test('historical refund with supplier ambiguity does not requalify',async()=>{
 await OrdersStore.createOrder(order({payment_status:'success',status:'refunded',manual_review:true}));
 assert.equal((await C.quote('mtn-1gb','buyer')).discountMinor,0);
});
test('existing enabled Data reserve reused and frozen for referral margin',async()=>{
 await FinanceStore.transaction('admin',tx=>tx.saveConfig('economics:data',{enabled:true,reserveMinor:10,reserveBps:200}));
 const o=await initialize();assert.equal(o.commercial_context!.reserveMinor,19);
 const result=computeEconomicReward(o,null,100,{service:'data',enabled:true,version:'later',reserveMinor:0,reserveBps:0,supplierCostMinor:null,mode:'fixed',marginBps:0});
 assert.equal(result.snapshot.operations_reserve_minor,19);assert.equal(result.amount,30);
});
test('safe order pricing shows saving without leaking buyer identity or supplier economics',async()=>{
 const o=await initialize(),safe=toSafePublicOrder({...o,manual_review:true});
 assert.deepEqual(safe.commercial_pricing,{regularMinor:549,discountMinor:100,paidMinor:449});assert.equal(safe.manual_review,true);
 assert.ok(!JSON.stringify(safe).includes('241234567'));assert.ok(!('commercial_context' in safe));
});
test('durable recovery redeems after delayed terminal financial effect',async()=>{
 const o=await initialize();await OrdersStore.createOrder({...o,status:'delivered',payment_status:'success'});
 await C.recover();await C.recover();assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'redeemed');
});
test('durable recovery releases abandoned verified payment',async()=>{
 const o=await initialize();P.verifyTransaction=async()=>({isVerified:false,status:'abandoned',reference:o.payment_reference,amountPesewas:449,currency:'GHS'});
 await C.recover();assert.equal((await C.quote('mtn-1gb','buyer')).discountMinor,100);
});
test('real fulfilment guard holds a released late payment for review without dispatch',async()=>{
 const o=await initialize();await C.paymentFailed(o,{isVerified:false,status:'failed',reference:o.payment_reference,amountPesewas:449,currency:'GHS'});
 await dispatch.call(F,o.payment_reference,new Date().toISOString(),'Fixture late payment');
 const current=(await OrdersStore.findOrder(o.id))!;assert.equal(current.manual_review,true);assert.equal(current.supplier_order_id,null);
 assert.equal(current.status,'paid');assert.equal((await C.quote('mtn-1gb','buyer')).discountMinor,0);
});
test('authenticated direct API Paystack contract uses discounted amount and actual receipt email',async()=>{
 const r=await request('payments/initialize',{productId:'mtn-1gb',recipientPhone:'0271234567',customerEmail:'receipt@fixture.test',requestId:randomUUID(),expectedTotalMinor:449,expectedRegularMinor:549});
 assert.equal(r.status,200);const body=await r.json();assert.equal(body.amountPesewas,449);assert.equal(parameters.email,'receipt@fixture.test');
 const o=(await OrdersStore.findOrder(body.orderRef))!;assert.equal(o.customer_email,'receipt@fixture.test');assert.equal(o.user_id,'buyer');assert.equal(o.commercial_context!.discountMinor,100);
});
test('guest direct API pays full price; malformed receipt cannot initialize payment',async()=>{
 let calls=0;P.initializeTransaction=async p=>{calls++;return {success:true,reference:p.reference,accessCode:'fixture'};};
 const body={productId:'mtn-1gb',recipientPhone:'0271234567',customerEmail:'guest@fixture.test',expectedTotalMinor:549};
 const r=await request('payments/initialize',body,'');assert.equal(r.status,200);assert.equal((await r.json()).amountPesewas,549);
 assert.equal((await request('payments/initialize',{...body,customerEmail:'bad'},'')).status,400);assert.equal(calls,1);
});
test('direct API Wallet retry returns same discounted purchase and debits once',async()=>{
 await FinanceService.adjustment('admin','buyer',{confirmed:true,direction:'credit',amountMinor:1000,requestId:randomUUID(),reason:'Fixture'});
 const body={productId:'mtn-1gb',recipientPhone:'0271234567',customerEmail:'receipt@fixture.test',requestId:randomUUID(),paymentMethod:'wallet',expectedTotalMinor:449};
 const a=await (await request('payments/initialize',body)).json(),b=await (await request('payments/initialize',body)).json();
 assert.equal(a.amountPesewas,449);assert.equal(a.orderRef,b.orderRef);assert.equal((await FinanceService.summary('buyer')).walletMinor,551);
});
test('invalid phone/signup and non-owner identity cannot select another welcome offer',async()=>{
 assert.equal((await request('auth/register',{name:'Fixture',phone:'123',password:'Fixture-password-26'},'')).status,400);
 const r=await request('commercial/quote/mtn-1gb?user_id=buyer',undefined,'other-token');assert.equal((await r.json()).totalMinor,449);
 await initialize();assert.equal((await (await request('commercial/quote/mtn-1gb?user_id=buyer',undefined,'other-token')).json()).offer.state,'eligible');
});
test('phone-only account can add real checkout email without fabricating profile email',async()=>{
 const user=(await AuthStore.findUserById('buyer'))!;await AuthStore.saveAccount({...user,email:null});
 const body={productId:'mtn-1gb',recipientPhone:'0271234567',requestId:randomUUID(),expectedTotalMinor:449};
 assert.equal((await request('payments/initialize',body)).status,400);
 const r=await request('payments/initialize',{...body,customerEmail:'phone-owner@fixture.test'});assert.equal(r.status,200);assert.equal(parameters.email,'phone-owner@fixture.test');assert.equal((await AuthStore.findUserById('buyer'))!.email,null);
});
test('Admin audit records previous/new prices, no account PII',async()=>{
 await C.save('admin',{kind:'pricing',confirmed:true,expectedVersion:'direct-launch-v1',reserveBps:0,reserveFixedMinor:0,products:[{productId:'mtn-1gb',retailMinor:599,recommendedMinor:699,enabled:true}]});
 const audit=(await AdminAuditStore.findRecent(10))[0];assert.equal(audit.action,'commercial_pricing_changed');const metadata=JSON.parse(audit.metadata_safe_json!);assert.ok(metadata.previous);assert.ok(metadata.next);assert.ok(!JSON.stringify(metadata).includes('241234567'));
});

test('discounted payment callback and signed webhook races do not duplicate reservation/redemption',async()=>{
 process.env.PAYSTACK_SECRET_KEY='sk_test_commercial_fixture';process.env.SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED='false';F.processPaidOrder=dispatch;
 const o=await initialize();P.verifyTransaction=async()=>({isVerified:true,status:'success',reference:o.payment_reference,amountPesewas:449,currency:'GHS'});
 const body={event:'charge.success',data:{reference:o.payment_reference,amount:449,currency:'GHS',status:'success'}};
 const hook=()=>originalFetch(base+'/api/webhooks/paystack',{method:'POST',headers:{'Content-Type':'application/json','x-paystack-signature':createHmac('sha512',process.env.PAYSTACK_SECRET_KEY!).update(JSON.stringify(body)).digest('hex')},body:JSON.stringify(body)});
 const responses=await Promise.all([request('payments/verify/'+o.payment_reference),hook(),hook()]);assert.ok(responses.every(r=>r.status===200));
 let current=(await OrdersStore.findOrder(o.id))!;assert.equal(current.payment_status,'success');assert.equal(current.amount,449);
 await OrdersStore.updateOrderStatus(o.id,'delivered');await request('payments/verify/'+o.payment_reference);await hook();current=(await OrdersStore.findOrder(o.id))!;
 assert.equal(current.status,'delivered');const ops=await FinanceStore.transaction('buyer',tx=>tx.operations());assert.equal(ops.filter(x=>x.kind==='welcome').length,1);assert.equal(ops.find(x=>x.kind==='welcome')?.state,'redeemed');
});

test('paid welcome order recovers dispatch after a process interruption',async()=>{
 process.env.PAYSTACK_SECRET_KEY='sk_test_commercial_fixture';process.env.SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED='false';
 const o=await initialize();await OrdersStore.markOrderPaid(o.payment_reference,new Date().toISOString());F.processPaidOrder=dispatch;
 await C.recover();assert.equal((await OrdersStore.findOrder(o.id))!.status,'queued');assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'reserved');
});
test('Paystack rejection classification preserves conflict/timeout ambiguity',async()=>{
 process.env.PAYSTACK_SECRET_KEY='sk_test_fixture';
 for(const status of [400,408,409,429,500]){
  globalThis.fetch=async()=>new Response(JSON.stringify({status:false,message:'Fixture rejection'}),{status});
  const result=await init.call(P,{email:'fixture@fixture.test',amountPesewas:449,reference:'fixture'});assert.equal(result.definitiveFailure,status===400);
 }
});
test('checkout final total and reopened quote cannot reuse stale welcome display',()=>{
 const source=readFileSync('src/components/checkout/CheckoutModal.tsx','utf8');assert.ok(!source.includes('checkoutBundle.priceGhc.toFixed(2)'));assert.ok(source.includes('[isCheckoutOpen,checkoutBundle?.id'));assert.ok(source.includes('if (isCheckoutOpen && checkoutBundle)'));
});

test('already-paid callback recovers late released reference into manual review',async()=>{
 const o=await initialize();await C.paymentFailed(o,{isVerified:false,status:'failed',reference:o.payment_reference,amountPesewas:449,currency:'GHS'});
 await OrdersStore.markOrderPaid(o.payment_reference,new Date().toISOString());F.processPaidOrder=dispatch;
 const response=await request('payments/verify/'+o.payment_reference);assert.equal(response.status,200);assert.equal((await response.json()).order.manual_review,true);
 const current=(await OrdersStore.findOrder(o.id))!;assert.equal(current.status,'paid');assert.equal(current.supplier_order_id,null);
});

test('price-only Admin save cannot silently configure zero processing costs',async()=>{
 await C.save('admin',{kind:'pricing',confirmed:true,expectedVersion:'direct-launch-v1',reserveBps:0,reserveFixedMinor:0,products:[{productId:'mtn-1gb',retailMinor:599,recommendedMinor:null,enabled:true}]});
 assert.equal((await C.admin()).prices.reserveConfigured,false);const o=await initialize();assert.equal(o.commercial_context!.reserveMinor,null);
 await FinanceStore.transaction('admin',tx=>tx.saveConfig('economics:data',{enabled:true,reserveMinor:10,reserveBps:200}));assert.equal((await C.admin()).prices.reserveConfigured,true);assert.equal((await C.admin()).prices.reserveFixedMinor,10);
});
