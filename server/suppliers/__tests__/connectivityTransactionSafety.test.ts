import assert from 'node:assert/strict';
import {test,before,after,beforeEach,afterEach} from 'node:test';
import express from 'express';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {OrdersStore} from '../../db/ordersStore.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import {PaystackServerService} from '../../services/paystackService.js';
import {reconcileCheckoutClosure} from '../../services/paymentClosure.js';
import {createInstantQuote,validateInstantQuote,exactFlexiAmount} from '../../services/instantBundleQuote.js';
import {INSTANT_BUNDLE_CONFIG,calculateFlexiInstantBundlePrice} from '../../data/instantBundlePricing.js';
import {validateOrderPayment} from '../../services/paymentValidation.js';
import {apiRouter} from '../../routes/api.js';
import type {OrderRecord} from '../../types/orders.js';
import type {SbhInstantBundlePackage} from '../successBizHub/types.js';
const env={...process.env}, originalFetch=globalThis.fetch, config=structuredClone(INSTANT_BUNDLE_CONFIG);
let server:Server,base:string,sequence=0;
const pkg:SbhInstantBundlePackage={id:'flexi-fixture',name:'Flexi fixture',network:'telecel',isFlexi:true,payableRatio:1.1,minAmountMajor:1,maxAmountMajor:500};
function fixture():OrderRecord { const id=`safety_${++sequence}`,now=new Date(Date.now()-3600000).toISOString();return {
  id,public_reference:`MH-${id}`,payment_reference:`PAY-${id}`,customer_name:'Synthetic',customer_email:'fixture@example.com',
  customer_phone:'+233201234567',recipient_phone:'+233201234567',network:'telecel',service_type:'instant_bundle',
  product_id:'instant-fixture',product_name_snapshot:'Fixture',bundle_size_snapshot:'1GB',amount:1000,currency:'GHS',status:'pending_payment',
  payment_provider:'paystack',payment_status:'pending',supplier_provider:'success_biz_hub',supplier_order_id:null,supplier_response:null,
  supplier_cost_minor:null,supplier_offer_ref:'fixture',supplier_last_checked_at:null,failure_reason:null,created_at:now,updated_at:now,paid_at:null,submitted_at:null,delivered_at:null};}
function raw(order:OrderRecord,status:string,change:Record<string,unknown>={}) {
  globalThis.fetch=async()=>new Response(JSON.stringify({status:true,data:{id:123,domain:'live',status,reference:order.payment_reference,amount:order.amount,currency:'GHS',...change}}));
}
before(async()=>{const app=express();app.use(express.json());app.use('/api',apiRouter);server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
beforeEach(()=>{process.env.NODE_ENV='test';delete process.env.DATABASE_URL;process.env.PAYSTACK_SECRET_KEY='sk_live_fixture';process.env.SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED='false';OrdersStore.clearDevStore();globalThis.fetch=async()=>{throw new Error('External network blocked');};});
afterEach(()=>{globalThis.fetch=originalFetch;Object.assign(INSTANT_BUNDLE_CONFIG,structuredClone(config));for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);});
for(const status of ['pending','ongoing','processing','reversed'])test(`closing a ${status} provider attempt keeps recovery open`,async()=>{const order=fixture();await OrdersStore.createOrder(order);raw(order,status);const result=await reconcileCheckoutClosure(order.public_reference);assert.equal(result.cancelled,false);assert.equal(result.order?.status,'pending_payment');assert.equal(result.order?.payment_status,'pending');});
for(const status of ['failed','abandoned'])test(`only matched provider ${status} evidence cancels`,async()=>{const order=fixture();await OrdersStore.createOrder(order);raw(order,status);assert.equal((await reconcileCheckoutClosure(order.public_reference)).cancelled,true);});
for(const [name,change] of [['amount',{amount:900}],['currency',{currency:'USD'}],['reference',{reference:'other'}]] as const)test(`unpaid ${name} mismatch cannot close an order`,async()=>{const order=fixture();await OrdersStore.createOrder(order);raw(order,'failed',change);assert.equal((await reconcileCheckoutClosure(order.id)).order?.status,'pending_payment');});
for(const kind of ['timeout','malformed','api-failure'])test(`${kind} is not evidence of cancellation or expiry`,async()=>{const order=fixture();await OrdersStore.createOrder(order);globalThis.fetch=async()=>{if(kind==='timeout')throw new Error('timeout');return kind==='malformed'?new Response('bad json'):new Response(JSON.stringify({status:false,message:'unavailable'}),{status:503});};assert.equal((await reconcileCheckoutClosure(order.id)).order?.status,'pending_payment');const reconciliation=await OrdersStore.reconcileStalePendingPayments();assert.equal(reconciliation.unresolvedCount,1);assert.equal(reconciliation.expiredCount,0);});
test('popup close followed by late MoMo approval and duplicate confirmations dispatches exactly once',async()=>{
  const order=fixture();await OrdersStore.createOrder(order);raw(order,'ongoing');await reconcileCheckoutClosure(order.id);
  const provider=FulfilmentService.getProvider(),original=provider.placeInstantBundle;let dispatched=0;
  process.env.SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED='true';provider.placeInstantBundle=async()=>{dispatched++;return {success:true,supplierOrderId:'SBH-once',status:'submitted'};};
  try{raw(order,'success');await Promise.all(Array.from({length:8},()=>reconcileCheckoutClosure(order.id)));assert.equal(dispatched,1);assert.equal((await OrdersStore.findOrder(order.id))?.status,'submitted');}finally{provider.placeInstantBundle=original;}
});
test('stale cancel/expiry reads cannot overwrite concurrent payment',async()=>{
  for(const action of ['cancelOrder','expireOrder'] as const){const order=fixture();await OrdersStore.createOrder(order);const find=OrdersStore.findOrder;let intercepted=false;
    OrdersStore.findOrder=async ref=>{const snapshot=await find.call(OrdersStore,ref);if(!intercepted){intercepted=true;OrdersStore.findOrder=find;await OrdersStore.markOrderPaid(order.payment_reference,new Date().toISOString());}return snapshot;};
    try{await OrdersStore[action](order.id);assert.equal((await find.call(OrdersStore,order.id))?.status,'paid');}finally{OrdersStore.findOrder=find;}}
});
test('ordinary reversed payment never grants successful payment',async()=>{const order=fixture();raw(order,'reversed');assert.equal(validateOrderPayment(order,await PaystackServerService.verifyTransaction(order.payment_reference)),'payment_not_successful');});
test('quote follows the complete supplier-ratio/gateway/margin model without exposing internals',()=>{
  INSTANT_BUNDLE_CONFIG.gatewayFeeRate=.035;INSTANT_BUNDLE_CONFIG.minProductMarginPesewas=35;INSTANT_BUNDLE_CONFIG.processingMarginPesewas=23;INSTANT_BUNDLE_CONFIG.processingMarginPercent=.1;
  const expected=calculateFlexiInstantBundlePrice(pkg.id,10,pkg.payableRatio!,1,500),quote=createInstantQuote(pkg,10);
  assert.equal(quote.totalMinor,expected.customerTotalPesewas);assert.equal(quote.productRetailMinor,expected.productRetailPricePesewas);assert.equal(quote.feeMinor,expected.paymentProcessingFeePesewas);
  assert.equal(validateInstantQuote(quote.token,pkg,10),true);assert.doesNotMatch(JSON.stringify(quote),/supplierCost|payableRatio|gatewayFeeRate|customer_email/);
});
test('tampering, expiry, amount/package changes and commercial revisions require fresh consent',()=>{
  const now=Date.now(),quote=createInstantQuote(pkg,10,now);
  assert.equal(validateInstantQuote(quote.token+'x',pkg,10,now),false);assert.equal(validateInstantQuote(quote.token,pkg,10,now+120000),false);
  assert.equal(validateInstantQuote(quote.token,pkg,11,now),false);assert.equal(validateInstantQuote(quote.token,{...pkg,id:'other'},10,now),false);
  INSTANT_BUNDLE_CONFIG.processingMarginPesewas++;assert.equal(validateInstantQuote(quote.token,pkg,10,now),false);
});
for(const value of ['10oops','1.001','Infinity',Infinity,NaN,-1,{},['10']])test(`invalid Flexi amount ${String(value)} fails closed`,()=>assert.throws(()=>exactFlexiAmount(value)));
test('API refuses missing/stale quote before creating order or initializing payment',async()=>{
  const provider=FulfilmentService.getProvider(),check=provider.client.checkInstantBundlesService,catalog=provider.client.getInstantBundles;
  provider.client.checkInstantBundlesService=async()=>({permitted:true,available:true,productCount:1});provider.client.getInstantBundles=async()=>({data:[pkg]});
  let providerCalls=0;globalThis.fetch=async()=>{providerCalls++;throw new Error('Payment must not be contacted');};
  try{const response=await originalFetch(base+'/api/payments/initialize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:`instant-${pkg.id}`,serviceType:'instant_bundle',recipientPhone:'0201234567',amount:10})});assert.equal(response.status,409);assert.equal((await response.json()).code,'INSTANT_QUOTE_CHANGED');assert.equal(OrdersStore.adminDevOrders().length,0);assert.equal(providerCalls,0);}finally{provider.client.checkInstantBundlesService=check;provider.client.getInstantBundles=catalog;}
});
