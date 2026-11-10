import assert from 'node:assert/strict';
import {test, beforeEach, afterEach, mock} from 'node:test';
import express from 'express';
import {SupplierRegistry, resolveSupplierRoute, resolveOrderSupplier, telecomService, SupplierRoutingError, type SupplierRegistration} from '../supplierRouting.js';
import {UnconfiguredSupplierProvider} from '../supplierInterface.js';
import {SUPPLIER_SERVICES, SUPPLIER_NETWORKS, isSupplierRoutingOverview} from '../../../shared/supplierRouting.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {AuthStore} from '../../db/authStore.js';
import {adminCommercialRouter} from '../../routes/commercialApi.js';
import {routingOrder} from './fixtures/routingOrder.js';

const originalEnv = {...process.env};
const provider = FulfilmentService.getProvider();
const registration = (extra: Partial<SupplierRegistration> = {}): SupplierRegistration => ({id:'success_biz_hub',name:'Success Biz Hub',provider,services:SUPPLIER_SERVICES,networks:SUPPLIER_NETWORKS,plannedServices:[],configured:true,qualified:true,acceptsNewOrders:true,...extra});
const registry = (...entries: SupplierRegistration[]) => new SupplierRegistry(entries.length ? entries : [registration()]);
beforeEach(() => {
  assert.equal(process.env.DATABASE_URL, undefined);
  Object.assign(process.env,{SUCCESS_BIZ_HUB_API_KEY:'synthetic-only',SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED:'true',PAYSTACK_SECRET_KEY:'sk_live_synthetic_only'});
  OrdersStore.clearDevStore();
  mock.method(globalThis,'fetch',async()=>{throw Error('External requests prohibited');});
});
afterEach(() => {mock.restoreAll();process.env = {...originalEnv};});

for (const service of SUPPLIER_SERVICES) for (const network of SUPPLIER_NETWORKS) test(`${service}/${network}: deterministic default remains SBH`, () => {
  const route = resolveSupplierRoute(registry(),{service,network});
  assert.equal(route.providerId,'success_biz_hub'); assert.ok(Object.isFrozen(route));
});
test('unknown, duplicate and mismatched provider identities are rejected', () => {
  assert.throws(()=>registry().get('unknown'),SupplierRoutingError);
  assert.throws(()=>registry(registration(),registration()),SupplierRoutingError);
  assert.throws(()=>registry(registration({provider:new UnconfiguredSupplierProvider()})),SupplierRoutingError);
});
for (const extra of [{services:[]},{networks:[]},{provider:null},{qualified:false},{acceptsNewOrders:false},{configured:false}]) test(`capability/qualification/configuration fails closed: ${Object.keys(extra)[0]}`,()=>{
  assert.throws(()=>resolveSupplierRoute(registry(registration(extra)),{service:'data',network:'mtn'}),SupplierRoutingError);
});
test('unsupported service/network, missing/duplicate route and unmatched product are rejected',()=>{
  const r=registry(),context={service:'data' as const,network:'mtn'};
  for(const bad of [{service:'sms' as any,network:'mtn'},{service:'data' as const,network:'unknown'}])assert.throws(()=>resolveSupplierRoute(r,bad),SupplierRoutingError);
  assert.throws(()=>resolveSupplierRoute(r,context,[]),SupplierRoutingError);
  const specific={...context,network:'mtn' as const,providerId:'success_biz_hub' as const,productId:'qualified-product'};
  assert.throws(()=>resolveSupplierRoute(r,{...context,productId:'other'},[specific]),SupplierRoutingError);
  assert.throws(()=>resolveSupplierRoute(r,context,[{...specific,productId:undefined},{...specific,productId:undefined}]),SupplierRoutingError);
  assert.equal(resolveSupplierRoute(r,{...context,productId:'qualified-product'},[specific]).productId,'qualified-product');
});
test('TELCOGH remains metadata only; even a proposed route cannot select it',()=>{
  const r=registry(registration(),registration({id:'telcogh',name:'TELCOGH',provider:null,services:[],networks:[],plannedServices:['data','airtime'],qualified:false,acceptsNewOrders:false,configured:false}));
  assert.throws(()=>resolveSupplierRoute(r,{service:'data',network:'mtn'},[{service:'data',network:'mtn',providerId:'telcogh'}]),SupplierRoutingError);
  assert.throws(()=>resolveOrderSupplier(r,routingOrder({supplier_provider:'telcogh'})),SupplierRoutingError);
});
test('registry copies metadata; simultaneous resolutions cannot mutate another request',async()=>{
  const services:any[]=['data'];const r=registry(registration({services}));services.push('airtime');
  assert.throws(()=>resolveSupplierRoute(r,{service:'airtime',network:'mtn'}));
  const routes=await Promise.all(Array.from({length:30},async()=>resolveSupplierRoute(r,{service:'data',network:'mtn'})));
  assert.ok(routes.every(x=>x.providerId==='success_biz_hub'));assert.throws(()=>{(r.get('success_biz_hub').services as any).push('airtime');});
});
test('historical snapshot ignores new route availability; explicit unknown never becomes SBH',()=>{
  const r=registry(registration({acceptsNewOrders:false}));
  assert.equal(resolveOrderSupplier(r,routingOrder()).id,'success_biz_hub');
  assert.equal(resolveOrderSupplier(r,routingOrder({supplier_provider:null})).id,'success_biz_hub');
  for(const supplier_provider of ['unknown','telcogh','manual_supplier',''])assert.throws(()=>resolveOrderSupplier(r,routingOrder({supplier_provider})));
  assert.equal(telecomService(routingOrder({service_type:undefined,product_id:'instant-old'})),'instant_bundle');
  assert.equal(telecomService(routingOrder({service_type:undefined,product_id:'airtime-old'})),'airtime');
});
for (const supplier_provider of ['success_biz_hub','telcogh',null]) test(`submission and uncertainty preserve original identity ${supplier_provider}`,async()=>{
  const order=routingOrder({supplier_provider});await OrdersStore.createOrder(order);
  const held=await OrdersStore.saveSupplierUncertainSubmission(order.id,'Synthetic timeout');assert.equal(held?.supplier_provider,supplier_provider);
  const submitted=await OrdersStore.saveSupplierSubmission(order.id,'synthetic-ref',100,'offer','submitted');assert.equal(submitted?.supplier_provider,supplier_provider);
  assert.equal(submitted?.payment_status,'success');
});
for (const supplier_provider of ['telcogh','unknown']) test(`${supplier_provider} paid order is held; no default route, supplier calls or refund`,async()=>{
  const order=routingOrder({supplier_provider});await OrdersStore.createOrder(order);
  mock.method(FulfilmentService,'resolveRoute',()=>{throw Error('Must not resolve a default for an existing order');});
  mock.method(provider,'placeOrder',async()=>{throw Error('Must not dispatch');});
  const result=await FulfilmentService.dispatchClaimedOrder(order);
  assert.equal(result.order?.supplier_provider,supplier_provider);assert.equal(result.order?.manual_review,true);assert.equal(result.order?.status,'queued');assert.equal(result.order?.payment_status,'success');
  await assert.rejects(()=>FulfilmentService.refreshOrderStatusIfDue({...order,status:'processing',supplier_order_id:'same-id'},true),/Original supplier/);
});
for (const [service_type,product_id,method] of [['data','at-1gb','getOrderStatus'],['airtime','airtime-at','getAirtimeStatus'],['instant_bundle','instant-at','getInstantBundleStatus'],[undefined,'instant-legacy','getInstantBundleStatus'],[undefined,'airtime-legacy','getAirtimeStatus']] as const) test(`order-bound status lookup ${product_id}`,async()=>{
  const order=routingOrder({service_type,product_id,supplier_provider:null,status:'submitted',supplier_order_id:'old-sbh-id'});await OrdersStore.createOrder(order);
  mock.method(FulfilmentService,'resolveRoute',()=>{throw Error('Must not resolve defaults');});
  let calls=0;mock.method(provider,method,async (id:string)=>{calls++;assert.equal(id,'old-sbh-id');return {success:true,status:'processing',supplierOrderId:id,rawResponse:{status:'processing'}};});
  const updated=await FulfilmentService.refreshOrderStatusIfDue(order,true);assert.equal(calls,1);assert.equal(updated.status,'processing');assert.equal(updated.supplier_provider,null);
});
test('webhook supplier reference namespaces and ambiguity never target unrelated orders',async()=>{
  const sbh=routingOrder({status:'submitted',supplier_order_id:'same-id'}),telco=routingOrder({status:'submitted',supplier_provider:'telcogh',supplier_order_id:'same-id'});
  await OrdersStore.createOrder(sbh);await OrdersStore.createOrder(telco);
  assert.equal((await OrdersStore.findOrderBySupplierOrderId('same-id'))?.id,sbh.id);
  assert.equal((await OrdersStore.findOrderBySupplierOrderId('same-id',undefined,'telcogh'))?.id,telco.id);
  await OrdersStore.processSupplierWebhookEvent('synthetic-event','status',{},[{supplierOrderId:'same-id',status:'processing',response:'{"status":"processing"}'}]);
  assert.equal((await OrdersStore.findOrder(sbh.id))?.status,'processing');assert.equal((await OrdersStore.findOrder(telco.id))?.status,'submitted');
  const duplicate=routingOrder({supplier_provider:null,status:'submitted',supplier_order_id:'same-id'});await OrdersStore.createOrder(duplicate);
  assert.equal(await OrdersStore.findOrderBySupplierOrderId('same-id'),null);
  await assert.rejects(()=>OrdersStore.processSupplierWebhookEvent('ambiguous','status',{},[{supplierOrderId:'same-id',status:'delivered',response:'{}'}]));
  assert.equal((await OrdersStore.findOrder(duplicate.id))?.status,'submitted');
});
for(const variant of ['unchanged','changed-offer','changed-cost','legacy'] as const) test(`paid Data snapshot ${variant}: no reroute, no duplicate POST`,async()=>{
  const order=routingOrder({status:'paid',supplier_offer_ref:variant==='legacy'?null:'original-offer',supplier_cost_minor:100});await OrdersStore.createOrder(order);
  mock.method(FulfilmentService,'resolveRoute',()=>{throw Error('An existing order must not consult new routes');});
  mock.method(provider,'resolvePackage',async()=>({resolved:{offerSlug:variant==='changed-offer'?'other-offer':'original-offer',offerId:'offer-id',sizeLabel:'1GB',supplierCostMinor:variant==='changed-cost'?101:100}} as any));
  let posts=0;mock.method(provider.client,'createOrder',async()=>{posts++;return {status:'success',data:{publicId:'sbh-original',status:'processing'}} as any;});
  await Promise.all([FulfilmentService.processPaidOrder(order.payment_reference,order.paid_at!),FulfilmentService.processPaidOrder(order.payment_reference,order.paid_at!)]);
  const stored=(await OrdersStore.findOrder(order.id))!;
  assert.equal(stored.supplier_provider,'success_biz_hub');assert.equal(stored.payment_status,'success');
  if(variant==='changed-offer'||variant==='changed-cost'){assert.equal(posts,0);assert.equal(stored.status,'queued');assert.equal(stored.manual_review,true);assert.match(stored.admin_note!,/checkout snapshot/);}
  else{assert.equal(posts,1);assert.equal(stored.status,'processing');}
});
test('malformed overview never reaches Admin rendering',()=>{
  const snapshot=FulfilmentService.routingOverview();assert.equal(isSupplierRoutingOverview(snapshot),true);
  for(const change of [(v:any)=>v.providers=[null],(v:any)=>v.providers[0].networks=null,(v:any)=>v.routes=[null],(v:any)=>v.routes[0].service='sms']){const bad=structuredClone(snapshot);change(bad);assert.equal(isSupplierRoutingOverview(bad),false);}
});
test('Admin overview authorization, no-store, no activation endpoint and no supplier requests',async()=>{
  const app=express();app.use('/routing',adminCommercialRouter);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  mock.restoreAll(); // local HTTP only; provider methods remain prohibited by the test below
  const base=`http://127.0.0.1:${(server.address() as any).port}/routing/supplier-routing`;
  const supplierRequest=mock.method(provider.client as any,'request',async()=>{throw Error('No supplier requests allowed');});
  try {
    for(const role of ['customer','admin'] as const){await AuthStore.createUser({id:`routing-${role}`,name:'Synthetic',email:null,phone:null,passwordHash:'fixture',role});await AuthStore.createSession(`routing-${role}`,`routing-token-${role}`);}
    assert.equal((await fetch(base)).status,401);
    assert.equal((await fetch(base,{headers:{Authorization:'Bearer routing-token-customer'}})).status,403);
    const response=await fetch(base,{headers:{Authorization:'Bearer routing-token-admin'}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    const value=await response.json();assert.equal(value.mode,'read_only');assert.equal(value.routes.length,9);assert.ok(value.routes.every((r:any)=>r.providerId==='success_biz_hub'));
    const telco=value.providers.find((p:any)=>p.id==='telcogh');assert.equal(telco.acceptsNewOrders,false);assert.deepEqual(telco.networks,[]);assert.equal(JSON.stringify(value).includes('synthetic-only'),false);
    assert.equal((await fetch(base,{method:'POST',headers:{Authorization:'Bearer routing-token-admin'}})).status,404);assert.equal(supplierRequest.mock.callCount(),0);
  } finally {await new Promise<void>(r=>server.close(()=>r()));}
});
