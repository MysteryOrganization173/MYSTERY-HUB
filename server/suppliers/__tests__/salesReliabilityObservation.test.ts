import {before,beforeEach,after,afterEach,test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {apiRouter} from '../../routes/api.js';
import {adminRouter} from '../../routes/adminApi.js';
import {websiteBusinessRouter} from '../../routes/websiteBusinessApi.js';
import {WebsiteBusinessService} from '../../services/websiteBusinessService.js';
import {salesCollector} from '../../services/salesReliability.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import {PaystackServerService} from '../../services/paystackService.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {AuthStore} from '../../db/authStore.js';
import type {SalesObservation} from '../../../shared/salesReliability.js';

const realFetch=globalThis.fetch,env={...process.env},init=PaystackServerService.initializeTransaction,enqueue=salesCollector.enqueue;
const client=FulfilmentService.getProvider().client;
const services={success:true,data:{keyPermissions:{instant_bundles:true},services:[{kind:'data',available:true},{slug:'airtime',available:true},{id:'instant_bundles',keyGranted:true,available:true,productCount:1}]}};
let server:Server,base:string,events:SalesObservation[],calls:string[],payments:number;
let override:(path:string,options?:RequestInit)=>Promise<Response>|Response|undefined;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
before(async()=>{const app=express();app.use(express.json());app.use('/api/websites',websiteBusinessRouter);app.use('/api/admin',adminRouter);app.use('/api',apiRouter);server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
after(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});
beforeEach(()=>{
  delete process.env.DATABASE_URL;Object.assign(process.env,{NODE_ENV:'test',SUCCESS_BIZ_HUB_API_KEY:'SYNTHETIC_SECRET_DO_NOT_PERSIST',SUCCESS_BIZ_HUB_BASE_URL:'https://supplier.invalid/v2',SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED:'true',SUCCESS_BIZ_HUB_REQUEST_TIMEOUT_MS:'20',PAYSTACK_SECRET_KEY:'sk_live_synthetic'});
  events=[];calls=[];payments=0;override=()=>undefined;client.clearCache();OrdersStore.clearDevStore();
  salesCollector.enqueue=e=>{events.push(e);};
  PaystackServerService.initializeTransaction=async p=>{payments++;return {success:true,reference:p.reference,authorizationUrl:'https://checkout.invalid/synthetic',accessCode:'synthetic'};};
  globalThis.fetch=async(input,options)=>{
    const url=new URL(String(input));assert.equal(url.hostname,'supplier.invalid');const path=url.pathname.replace('/v2','');calls.push(path);
    const replacement=override(path,options);if(replacement)return replacement;
    if(path==='/services')return json(services);
    if(path==='/catalog')return json({success:true,data:{offers:[{id:'fixture',slug:'fixture',kind:'data',network:'mtn',packages:[{sizeLabel:'2GB',priceMinor:100}]}]}});
    if(path==='/wallet')return json({success:true,data:{currency:'GHS',availableMinor:100000}});
    if(path==='/beneficiary-check')return json({success:true,data:{eligible:true}});
    if(path==='/instant-bundles')return json({success:true,data:[{id:'fixture-instant',name:'Synthetic',network:'telecel',dataAmount:'2GB',enabled:true,available:true,priceMinor:100}]});
    throw Error('Unexpected supplier request; real orders are forbidden');
  };
});
afterEach(()=>{globalThis.fetch=realFetch;PaystackServerService.initializeTransaction=init;salesCollector.enqueue=enqueue;client.clearCache();for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);});
const checkout=async(extra:Record<string,unknown>={})=>{const r=await realFetch(base+'/api/payments/initialize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:'mtn-2gb',recipientPhone:'0241234567',customerEmail:'synthetic-private@example.test',...extra})});return {status:r.status,body:await r.json()};};
for(const body of [{success:true,data:{results:[]}},{success:false,data:{eligible:false}},{success:true,data:{eligible:'false'}}])test(`unknown eligibility is operational evidence, never a recipient denial: ${JSON.stringify(body)}`,async()=>{
 override=path=>path==='/beneficiary-check'?json(body):undefined;const result=await checkout();assert.equal(result.body.code,'BENEFICIARY_CHECK_UNAVAILABLE');assert.equal(events[0].category,'supplier_response');assert.equal(events[0].stage,'beneficiary');assert.equal(events[0].fresh.beneficiary,undefined);assert.equal(payments,0);assert.equal(OrdersStore.adminDevOrders().length,0);
});
test('explicit denial cannot falsely recover a beneficiary outage',async()=>{
 override=path=>path==='/beneficiary-check'?json({success:true,data:{eligible:false}}):undefined;const result=await checkout();assert.equal(result.body.code,'BENEFICIARY_NOT_ELIGIBLE');assert.equal(events[0].category,'validation');assert.equal(events[0].fresh.beneficiary,undefined);assert.equal(events[0].fresh.application,undefined);assert.equal(payments,0);
});

test('healthy checkout records one preflight without duplicate supplier calls; cached results stay distinct',async()=>{
  assert.equal((await checkout()).status,200);assert.equal(payments,1);assert.equal(events.length,1);assert.equal(events[0].category,'passed');assert.ok(events[0].fresh.services);
  assert.deepEqual([...calls].sort(),['/services','/catalog','/wallet','/beneficiary-check'].sort());
  await checkout({recipientPhone:'0241234568'});assert.equal(events.length,2);assert.ok(events[1].cached.includes('services'));assert.equal(events[1].fresh.services,undefined);assert.equal(calls.length,5);
});
for(const [status,category] of [[401,'authorization'],[403,'authorization'],[429,'http_error'],[503,'http_error']] as const)test(`supplier HTTP ${status} is observed safely before payment`,async()=>{
  override=path=>path==='/services'?json({success:false,error:{message:'SYNTHETIC_SECRET_DO_NOT_PERSIST 0241234567 synthetic-private@example.test'}},status):undefined;
  assert.equal((await checkout()).status,503);assert.equal(payments,0);assert.equal(events[0].category,category);assert.equal(events[0].stage,'services');assert.equal(events[0].blocked,true);
  const saved=JSON.stringify(events);for(const value of ['0241234567','synthetic-private@example.test','SYNTHETIC_SECRET_DO_NOT_PERSIST','Bearer','x-api-key'])assert.ok(!saved.includes(value));
});
test('authenticated discovery header timeout is distinct from customer internet; no payment is initialized',async()=>{
  override=(path,options)=>path==='/services'?new Promise((_r,reject)=>options!.signal!.addEventListener('abort',()=>reject(new DOMException('Synthetic','AbortError')),{once:true})):undefined;
  assert.equal((await checkout()).status,503);assert.equal(payments,0);assert.equal(events[0].category,'timeout');assert.equal(events[0].phase,'headers');
});
test('stalled response body retains deadline and is observed without changing timeout behavior',async()=>{
  override=(path,options)=>path==='/services'?new Response(new ReadableStream({start(c){options!.signal!.addEventListener('abort',()=>c.error(new DOMException('Synthetic','AbortError')),{once:true});}})):undefined;
  assert.equal((await checkout()).status,503);assert.equal(events[0].category,'timeout');assert.equal(events[0].phase,'body');assert.equal(payments,0);
});
test('catalogue and connection failures retain their endpoint category',async()=>{
  override=path=>{if(path==='/catalog')throw TypeError('Sensitive connection details');return undefined;};
  await checkout();assert.equal(events[0].stage,'catalog');assert.equal(events[0].category,'connection');assert.equal(payments,0);
});
test('supplier wallet insufficiency is separate from customer validation',async()=>{
  override=path=>path==='/wallet'?json({success:true,data:{currency:'GHS',availableMinor:0}}):undefined;
  await checkout();assert.equal(events[0].category,'wallet_low');assert.equal(events[0].stage,'wallet');assert.equal(events[0].blocked,true);assert.equal(payments,0);
});
test('customer input, package rejection and beneficiary ineligibility do not become supplier outages',async()=>{
  await checkout({recipientPhone:'invalid',clientError:'supplier timeout'});assert.equal(events[0].category,'validation');assert.equal(calls.length,0);
  override=path=>path==='/beneficiary-check'?json({success:true,data:{eligible:false}}):undefined;
  await checkout();assert.equal(events[1].category,'validation');assert.equal(payments,0);
  client.clearCache();override=path=>path==='/catalog'?json({success:true,data:{offers:[]}}):undefined;
  await checkout();assert.equal(events[2].category,'validation');
});
test('Airtime and Instant Bundle preflights are observed independently',async()=>{
  await FulfilmentService.preflightCheckAirtime('mtn',1000,'0241234567');assert.equal(events[0].service,'airtime');assert.equal(events[0].category,'passed');
  assert.equal((await checkout({productId:'instant-fixture-instant',serviceType:'instant_bundle'})).status,200);
  assert.equal(events[1].service,'instant_bundle');assert.equal(events[1].category,'passed');assert.ok(events[1].cached.includes('services'));
});
test('monitoring observer failure cannot reject a legitimate checkout',async()=>{
  salesCollector.enqueue=()=>{throw Error('Synthetic monitoring failure');};
  assert.equal((await checkout()).status,200);assert.equal(payments,1);assert.equal(calls.length,4);
});
test('managed storefront HTTP and shared preflight produce one observation and no duplicate supplier calls',async()=>{
  const original=WebsiteBusinessService.initialize;
  WebsiteBusinessService.initialize=(async()=>{const preflight=await FulfilmentService.preflightCheck('mtn','2GB','0241234567');assert.ok(preflight.allowed);return {synthetic:true};}) as any;
  try{
    assert.equal((await realFetch(base+'/api/websites/synthetic/store-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,200);
    assert.equal(events.length,1);assert.equal(events[0].service,'data');assert.equal(calls.length,4);assert.equal(payments,0);
  }finally{WebsiteBusinessService.initialize=original;}
});
test('Uncertain gateway initialization after preflight does not falsely assign its root cause to the supplier or an internal defect',async()=>{
  PaystackServerService.initializeTransaction=async()=>{throw Error('Synthetic internal failure');};
  assert.equal((await checkout()).status,503);assert.equal(events[0].category,'application_error');assert.equal(events[0].stage,'application');assert.equal(events[0].blocked,false);
});
test('unexpected preflight exception has a separate internal error category',async()=>{
  const provider=FulfilmentService.getProvider(),original=provider.resolvePackage;
  provider.resolvePackage=async()=>{throw Error('Synthetic internal exception');};
  try{await checkout();assert.equal(events[0].category,'internal_error');assert.equal(payments,0);}finally{provider.resolvePackage=original;}
});
test('Admin wallet probes do not contribute checkout or recovery evidence',async()=>{
  await FulfilmentService.getProvider().getBalance();assert.equal(events.length,0);
});
test('only authorized active administrators can read operational evidence',async()=>{
  assert.equal((await realFetch(base+'/api/admin/sales-reliability')).status,401);
  for(const [id,role,status,expected] of [['customer','customer','active',403],['disabled-admin','admin','disabled',403],['active-admin','admin','active',200]] as const){
    await AuthStore.createUser({id,name:id,email:null,phone:null,passwordHash:'fixture',role,status});await AuthStore.createSession(id,'token-'+id);
    const response=await realFetch(base+'/api/admin/sales-reliability',{headers:{Authorization:'Bearer token-'+id}});assert.equal(response.status,expected);assert.equal(response.headers.get('cache-control'),'no-store');
  }
});
