import assert from 'node:assert/strict';
import {test,before,after,beforeEach} from 'node:test';
import express from 'express';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {randomUUID} from 'node:crypto';
import {apiRouter} from '../../routes/api.js';
import {adminRouter} from '../../routes/adminApi.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {AuthStore} from '../../db/authStore.js';
import {FinanceStore} from '../../db/financeStore.js';
import {WebsiteStore} from '../../db/websiteStore.js';
import {WebsiteAnalyticsStore} from '../../db/websiteAnalyticsStore.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import {PaystackServerService} from '../../services/paystackService.js';
import {maskOrderRecipient,toSafePublicOrder,type OrderRecord,type OrderStatus} from '../../types/orders.js';
import {maskDataRecipient,dataRecipientDisplay,dataOrderPresentation} from '../../../src/utils/dataPurchasePresentation';
import {createRateLimiter} from '../../middleware/rateLimiter.js';

const original={fetch:globalThis.fetch,refresh:FulfilmentService.refreshOrderStatusIfDue,verify:PaystackServerService.verifyTransaction};
let server:Server,base:string,siteId:string,refreshes:number;
const privateValues=['0241111111','+233241111111','233241111111','241111111',
  '0242222222','+233242222222','242222222','privacy-fixture@example.test','Synthetic Private Customer',
  'synthetic private address text','Private City','Private Area','Private Landmark','private-pickup',
  'supplier-private-id','supplier-private-response','private-referrer','private-admin-note'];
const privateKeys=['customer_phone','customer_email','customer_name','user_id','id','delivery_note','delivery_city',
  'delivery_area','delivery_landmark','pickup_location_snapshot','variant_snapshot','product_slug','supplier_order_id',
  'supplier_response','supplier_cost_minor','supplier_offer_ref','payment_reference','payment_status','admin_note',
  'referrer_user_id','referral_code','marketplace_context','commercial_context','store_context','wholesaleMinor',
  'reserveMinor','earningMinor','ownerId','accessCode','authorizationUrl'];
function assertPublic(data:unknown) {
  const json=JSON.stringify(data);
  for(const value of privateValues)assert.ok(!json.includes(value),`Public response exposed ${value}`);
  const walk=(value:any)=>{if(!value||typeof value!=='object')return;for(const [key,nested] of Object.entries(value)){
    assert.ok(!privateKeys.includes(key),`Public response exposed field ${key}`);walk(nested);
  }};walk(data);
}
function fixture(extra:Partial<OrderRecord>={}):OrderRecord {
  const id=randomUUID(),at='2026-10-01T12:00:00.000Z';
  return {id:`ord_${id}`,user_id:'customer',public_reference:`MH-${id}`,customer_name:'Synthetic Private Customer',
    customer_email:'privacy-fixture@example.test',customer_phone:'0242222222',recipient_phone:'0241111111',
    network:'mtn',service_type:'data',product_id:'mtn-1gb',product_name_snapshot:'MTN 1GB',bundle_size_snapshot:'1GB',
    amount:500,currency:'GHS',status:'processing',payment_provider:'paystack',payment_reference:`MH_pay_${id}`,
    payment_status:'success',supplier_provider:'synthetic-supplier',supplier_order_id:'supplier-private-id',
    supplier_response:'supplier-private-response',supplier_cost_minor:200,supplier_offer_ref:'private-offer',
    supplier_last_checked_at:at,failure_reason:null,manual_review:false,admin_note:'private-admin-note',
    product_slug:'private-slug',variant_snapshot:'private variant 0241111111',fulfilment_method:'delivery',
    pickup_location_snapshot:'private-pickup',delivery_city:'Private City',delivery_area:'Private Area',
    delivery_landmark:'Private Landmark',delivery_note:'synthetic private address text',marketplace_status:'out_for_delivery',
    marketplace_context:{identifierValue:'privacy-fixture@example.test',nested:{phone:'0241111111'}},
    referrer_user_id:'private-referrer',referral_code:'private-referral',created_at:at,updated_at:at,paid_at:at,
    submitted_at:at,delivered_at:null,...extra};
}
async function save(extra:Partial<OrderRecord>={}) {const order=fixture(extra);await OrdersStore.createOrder(order);return order;}
const request=(path:string,token='',method='GET',body?:unknown)=>original.fetch(base+path,{method,
  headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
before(async()=>{
  assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DATABASE_URL,undefined);
  const app=express();app.use(express.json());app.use('/api',apiRouter);app.use('/api/admin',adminRouter);
  // Exercise the same limiter independently with enforcement enabled in isolated tests.
  app.get('/test-limiter',createRateLimiter({windowMs:60_000,max:60,enforceInTests:true}),(_req,res)=>res.json({ok:true}));
  server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(async()=>{
  assert.equal(process.env.DATABASE_URL,undefined);OrdersStore.clearDevStore();AuthStore._clearDevStore();
  FinanceStore._reset();WebsiteStore.clearDevStore();WebsiteAnalyticsStore.clearDevStore();refreshes=0;
  for(const id of ['customer','other','owner','admin']){await AuthStore.createUser({id,name:id,
    email:id==='other'?'privacy-fixture@example.test':`${id}@fixture.test`,phone:id==='other'?'0242222222':null,
    passwordHash:'synthetic-only',role:id==='admin'?'admin':'customer'});await AuthStore.createSession(id,`${id}-token`);}
  const expired=await AuthStore.createSession('customer','expired-token');expired.expires_at='2000-01-01T00:00:00Z';
  siteId=(await WebsiteStore.createSite('owner',{template_id:'tmpl-data-reseller',name:'Privacy Fixture Store'})).site.id;
  globalThis.fetch=async()=>{throw Error('External network prohibited in privacy tests');};
  FulfilmentService.refreshOrderStatusIfDue=async order=>{refreshes++;return order;};
  PaystackServerService.verifyTransaction=async()=>({isVerified:false,status:'pending',amountPesewas:0,currency:'GHS',error:privateValues.join(' ')});
});
after(async()=>{globalThis.fetch=original.fetch;FulfilmentService.refreshOrderStatusIfDue=original.refresh;
  PaystackServerService.verifyTransaction=original.verify;await new Promise<void>(r=>server.close(()=>r()));});

for(const service of ['data','airtime','instant_bundle','marketplace','afa'] as const)test(`general tracking protects ${service} JSON and keeps useful fields`,async()=>{
  const order=await save({service_type:service});const response=await request(`/api/orders/lookup/${order.public_reference}`);
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const data=await response.json();assertPublic(data);
  assert.equal(data.order.recipient_phone,'******1111');assert.equal(data.order.status,'processing');assert.equal(data.order.amount,500);
  assert.equal(data.order.amount_ghc,5);assert.equal(data.order.currency,'GHS');assert.equal(data.order.network,'mtn');
  assert.equal(data.order.product_name_snapshot,'MTN 1GB');assert.equal(data.order.service_type,service);assert.equal(refreshes,1);
});
const statuses:OrderStatus[]=['pending_payment','paid','queued','submitted','processing','delivered','failed','refund_pending','refunded','cancelled','expired'];
for(const status of statuses)test(`tracking preserves authoritative ${status} status`,async()=>{
  const order=await save({status});const data=await (await request(`/api/orders/lookup/${order.public_reference}`)).json();
  assert.equal(data.order.status,status);assertPublic(data);
});
test('manual review remains visible for every service, independently of financial context',async()=>{
  const order=await save({manual_review:true});const data=await (await request(`/api/orders/lookup/${order.public_reference}`)).json();
  assert.equal(data.order.manual_review,true);assertPublic(data);
});
test('local, international and formatted numbers cannot leak through descriptive snapshots',async()=>{
  const order=await save({recipient_phone:'+233241111111',product_name_snapshot:'MTN 1GB +233 (24) 111-1111 privacy-fixture@example.test',
    bundle_size_snapshot:'1GB 024 111 1111 Synthetic Private Customer Private City'});
  const data=await (await request(`/api/orders/lookup/${order.public_reference}`)).json();assertPublic(data);
  assert.ok(!JSON.stringify(data).includes('111-1111'));assert.equal(data.order.recipient_phone,'******1111');
  assert.ok(data.order.product_name_snapshot.startsWith('MTN 1GB'));
});
test('public projection is allowlisted even if future raw fields are added',()=>{
  const order=fixture();Object.assign(order,{secret:'synthetic-secret',nested:{email:order.customer_email},accessCode:'private-access'});
  const data=toSafePublicOrder(order);assertPublic(data);assert.ok(!('secret' in data));assert.ok(!('nested' in data));
});
test('short/corrupt recipient values do not accidentally expose complete numbers',()=>{
  for(const number of ['','1234','abc','******1111'])assert.equal(maskOrderRecipient(number),'******');
  for(const number of ['0241111111','+233241111111','024 111 1111'])assert.equal(maskOrderRecipient(number),'******1111');
});
const storeContext=()=>({channel:'website_store' as const,siteId,ownerId:'owner',productId:'mtn-1gb',retailMinor:500,
  wholesaleMinor:300,reserveMinor:25,earningMinor:175,supplierCostMinor:200,currency:'GHS' as const,
  policyVersion:'fixture-policy',wholesaleVersion:'fixture-wholesale',priceVersion:'fixture-price'});
test('both reseller and general tracking exclude seller economics and recipient PII',async()=>{
  const order=await save({store_context:storeContext()});const before=structuredClone(await OrdersStore.findOrder(order.id));
  for(const path of [`/api/websites/${siteId}/store-orders/${order.public_reference}`,`/api/orders/lookup/${order.public_reference}`]){
    const response=await request(path);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    const data=await response.json();assertPublic(data);assert.equal((data.data||data.order).recipient_phone,'******1111');
  }assert.deepEqual(await OrdersStore.findOrder(order.id),before);
});
for(const reference of ['MH-unknown','not-a-reference','MH-%3Cscript%3E'])test(`reseller invalid/unknown ${reference} is non-disclosing`,async()=>{
  const response=await request(`/api/websites/${siteId}/store-orders/${reference}`);assert.equal(response.status,404);
  assert.equal(response.headers.get('cache-control'),'no-store');assertPublic(await response.json());assert.equal(refreshes,0);
});
test('cross-store reference rejected before supplier refresh',async()=>{
  const order=await save({store_context:storeContext()});const response=await request(`/api/websites/another-store/store-orders/${order.public_reference}`);
  assert.equal(response.status,404);assertPublic(await response.json());assert.equal(refreshes,0);
});
for(const [reference,status] of [['MH-missing',404],['%3Cscript%3E',400],['A'.repeat(129),400]] as const)test(`general invalid/unknown reference ${status} fails safely`,async()=>{
  const response=await request(`/api/orders/lookup/${reference}`);assert.equal(response.status,status);
  assert.equal(response.headers.get('cache-control'),'no-store');assertPublic(await response.json());assert.equal(refreshes,0);
});
for(const token of ['','customer-token','other-token','owner-token','admin-token','invalid-token','expired-token'])test(`reference-only lookup never grants ownership for ${token||'guest'}`,async()=>{
  const order=await save();const response=await request(`/api/orders/lookup/${order.public_reference}`,token);
  assert.equal(response.status,200);assertPublic(await response.json());
});
for(const path of ['/api/account/orders','/api/orders/my-orders']) {
  test(`${path} retains full own recipient and delivery with no internal economics`,async()=>{
    const order=await save();await save({user_id:'other'});await save({user_id:null});
    const response=await request(path,'customer-token');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    const data=await response.json();assert.equal(data.orders.length,1);assert.equal(data.orders[0].public_reference,order.public_reference);
    assert.equal(data.orders[0].recipient_phone,'0241111111');assert.equal(data.orders[0].delivery_note,'synthetic private address text');
    assert.equal(data.orders[0].variant_snapshot,order.variant_snapshot);assert.ok(!('supplier_response' in data.orders[0]));assert.ok(!('customer_email' in data.orders[0]));
  });
  for(const token of ['','invalid-token','expired-token'])test(`${path} rejects ${token||'missing'} session`,async()=>{
    await save();const response=await request(path,token);assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');assertPublic(await response.json());
  });
  test(`${path} does not infer ownership from matching guest email/phone or guessed reference`,async()=>{
    const order=await save({user_id:null});const response=await request(`${path}?reference=${order.public_reference}`,'other-token');
    assert.equal(response.status,200);assert.deepEqual((await response.json()).orders,[]);
  });
  test(`${path} filters any mismatched row at the authorization boundary`,async()=>{
    const find=OrdersStore.findOrdersByUserId;try{OrdersStore.findOrdersByUserId=async()=>[fixture({user_id:'other'}),fixture({user_id:null})];
      const response=await request(path,'customer-token');assert.deepEqual((await response.json()).orders,[]);
    }finally{OrdersStore.findOrdersByUserId=find;}
  });
}
test('admin keeps full operational details behind RBAC',async()=>{
  const order=await save();const response=await request(`/api/admin/orders/${order.public_reference}`,'admin-token');
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const data=await response.json();
  for(const field of ['recipient_phone','customer_email','delivery_note','supplier_order_id','admin_note','variant_snapshot'] as const)assert.equal(data.order[field],order[field]);
});
for(const token of ['','customer-token','owner-token','invalid-token','expired-token'])test(`admin detail denies ${token||'guest'}`,async()=>{
  const order=await save();const response=await request(`/api/admin/orders/${order.public_reference}`,token);
  assert.equal(response.status,token==='customer-token'||token==='owner-token'?403:401);assertPublic(await response.json());
});
test('authorized seller gets masked recipient and own economics, another seller is denied',async()=>{
  await save({store_context:storeContext(),payment_status:'pending'});
  const own=await request(`/api/websites/${siteId}/business`,'owner-token');assert.equal(own.status,200);
  const data=(await own.json()).data;assert.equal(data.orders[0].recipient,'******1111');assert.equal(data.orders[0].earningMinor,175);
  for(const value of privateValues)assert.ok(!JSON.stringify(data).includes(value));
  const wrong=await request(`/api/websites/${siteId}/business`,'other-token');assert.equal(wrong.status,403);assertPublic(await wrong.json());
});
test('paid verify and cancellation responses remain public even with valid customer session',async()=>{
  const order=await save();for(const token of ['','other-token']){
    const verify=await request(`/api/payments/verify/${order.payment_reference}`,token);assert.equal(verify.status,200);
    assert.equal(verify.headers.get('cache-control'),'no-store');const v=await verify.json();assert.equal(v.verified,true);assertPublic(v);
    const cancel=await request('/api/payments/cancel',token,'POST',{orderRef:order.public_reference});assert.equal(cancel.status,200);
    assert.equal(cancel.headers.get('cache-control'),'no-store');const c=await cancel.json();assert.equal(c.alreadyPaid,true);assertPublic(c);
  }
});
test('unpaid verify does not echo provider errors containing private data',async()=>{
  const order=await save({status:'pending_payment',payment_status:'pending'});
  const response=await request(`/api/payments/verify/${order.payment_reference}`);const data=await response.json();assert.equal(data.verified,false);assertPublic(data);
});
test('pending cancellation retains safe cancelled status and masked response',async()=>{
  const order=await save({status:'pending_payment',payment_status:'pending'});
  const response=await request('/api/payments/cancel','','POST',{orderRef:order.public_reference});const data=await response.json();
  assert.equal(data.cancelled,true);assert.equal(data.order.status,'cancelled');assertPublic(data);
});
for(const path of ['/api/payments/verify/MH-missing','/api/payments/cancel'])test(`missing payment reference is safe and no-store at ${path}`,async()=>{
  const response=await request(path,'',path.includes('cancel')?'POST':'GET',path.includes('cancel')?{orderRef:'MH-missing'}:undefined);
  assert.equal(response.status,404);assert.equal(response.headers.get('cache-control'),'no-store');assertPublic(await response.json());
});
for(const route of ['lookup','verify','cancel','store'])test(`${route} failure logs no private fixture/error payload`,async()=>{
  const find=OrdersStore.findOrder,error=console.error,logs:unknown[][]=[];console.error=(...args)=>logs.push(args);
  OrdersStore.findOrder=async()=>{throw Error(privateValues.join(' '));};
  try{const paths={lookup:'/api/orders/lookup/MH-error',verify:'/api/payments/verify/MH-error',cancel:'/api/payments/cancel',store:`/api/websites/${siteId}/store-orders/MH-error`};
    const response=await request(paths[route as keyof typeof paths],'',route==='cancel'?'POST':'GET',route==='cancel'?{orderRef:'MH-error'}:undefined);
    assert.ok(response.status>=500);assertPublic(await response.json());assertPublic(logs);
  }finally{OrdersStore.findOrder=find;console.error=error;}
});
test('tracking limiter permits normal polling and bounds enumeration',async()=>{
  for(let count=0;count<60;count++)assert.equal((await request('/test-limiter')).status,200);
  assert.equal((await request('/test-limiter')).status,429);
});
for(const status of statuses)test(`frontend tracking handles masked ${status} without reconstructing digits`,()=>{
  const safe=toSafePublicOrder(fixture({status}));assert.equal(maskDataRecipient(safe.recipient_phone),'******1111');
  assert.equal(dataRecipientDisplay(safe.recipient_phone,true),'******1111');assert.equal(dataRecipientDisplay(safe.recipient_phone),'******1111');
  const view=dataOrderPresentation(status);assert.ok(view.title);assert.ok(view.next);assert.equal(view.delivered,status==='delivered');
});
