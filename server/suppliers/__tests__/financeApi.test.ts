import assert from 'node:assert/strict';
import {test,before,after,beforeEach} from 'node:test';
import express from 'express';
import {randomUUID,createHmac} from 'node:crypto';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {apiRouter,handlePaystackWebhook} from '../../routes/api.js';
import {adminRouter} from '../../routes/adminApi.js';
import {FinanceService} from '../../services/financeService.js';
import {FinanceStore} from '../../db/financeStore.js';
import {AuthStore} from '../../db/authStore.js';
import {ReferralStore} from '../../db/referralStore.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {AfaStore} from '../../db/afaStore.js';
import {AfaService} from '../../services/afaService.js';
import {PaystackServerService} from '../../services/paystackService.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import {getAuthoritativeProduct} from '../../data/productCatalog.js';
import {readFileSync} from 'node:fs';
const fetchOriginal=globalThis.fetch,initialize=PaystackServerService.initializeTransaction,verify=PaystackServerService.verifyTransaction,preflight=FulfilmentService.preflightCheck,airtimePreflight=FulfilmentService.preflightCheckAirtime,dispatch=FulfilmentService.processPaidOrder,afaConfig=AfaService.publicConfig;
let server:Server,base:string,transaction:any;
before(async()=>{const app=express();app.use(express.json({verify:(req,_res,body)=>{(req as any).rawBody=body;}}));app.post('/api/webhooks/paystack',handlePaystackWebhook);app.use('/api',apiRouter);app.use('/api/admin',adminRouter);server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
after(async()=>{await new Promise<void>(r=>server.close(()=>r()));PaystackServerService.initializeTransaction=initialize;PaystackServerService.verifyTransaction=verify;FulfilmentService.preflightCheck=preflight;FulfilmentService.preflightCheckAirtime=airtimePreflight;FulfilmentService.processPaidOrder=dispatch;AfaService.publicConfig=afaConfig;globalThis.fetch=fetchOriginal;});
beforeEach(async()=>{process.env.NODE_ENV='test';delete process.env.DATABASE_URL;process.env.APP_URL='https://mysterybundlehub.com';process.env.PAYSTACK_SECRET_KEY='sk_test_fixture';process.env.AFA_PII_ENCRYPTION_KEY='ab'.repeat(32);FinanceStore._reset();AuthStore._clearDevStore();OrdersStore.clearDevStore();ReferralStore._clearDevStore();AfaStore.clearTestStore();
  for(const role of ['owner','other','admin']){await AuthStore.createUser({id:role,name:role,email:`${role}@fixture.test`,phone:null,passwordHash:'fixture-only',role:role==='admin'?'admin':'customer'});await AuthStore.createSession(role,`${role}-token`);}
  globalThis.fetch=async()=>{throw Error('External network prohibited in this isolated test');};
  PaystackServerService.initializeTransaction=async params=>{transaction=params;return {success:true,reference:params.reference,authorizationUrl:'https://checkout.paystack.com/fixture'};};PaystackServerService.verifyTransaction=async ref=>({isVerified:true,status:'success',reference:ref,amountPesewas:transaction.amountPesewas,currency:'GHS',metadata:transaction.metadata});
  FulfilmentService.preflightCheck=async()=>({allowed:true,supplierCostMinor:200});FulfilmentService.preflightCheckAirtime=async()=>({allowed:true});FulfilmentService.processPaidOrder=async ref=>({order:await OrdersStore.findOrder(ref),alreadyHandled:false});AfaService.publicConfig=async()=>({enabled:true,available:true,retailPriceMinor:2500,retailPriceGhc:25,status:'available',message:'Fixture'});
});
const request=(path:string,method='GET',body?:unknown,token='owner-token')=>fetchOriginal(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
const seed=()=>FinanceService.adjustment('admin','owner',{amountMinor:10000,confirmed:true,requestId:randomUUID(),direction:'credit',reason:'Fixture'});
for(const path of ['/api/finance','/api/finance/transfer','/api/finance/withdrawals','/api/finance/topups'])test(`authentication enforced on ${path}`,async()=>assert.equal((await request(path,path==='/api/finance'?'GET':'POST',path==='/api/finance'?undefined:{},'')).status,401));
for(const path of ['/api/admin/finance/control','/api/admin/finance/withdrawals','/api/admin/finance/operations','/api/admin/finance/customers/owner'])test(`customer cannot access ${path}`,async()=>assert.equal((await request(path)).status,403));
test('customer cannot inspect another Wallet by supplying user_id',async()=>{await seed();const result=await request('/api/finance?user_id=owner','GET',undefined,'other-token');assert.equal((await result.json()).walletMinor,0);});
test('unknown session and forced password change rejected on finance',async()=>{assert.equal((await request('/api/finance','GET',undefined,'forged')).status,401);const find=AuthStore.findSessionByToken;AuthStore.findSessionByToken=async token=>{const data=await find.call(AuthStore,token);return data?{...data,user:{...data.user,must_change_password:true}}:data;};try{assert.equal((await request('/api/finance')).status,403);}finally{AuthStore.findSessionByToken=find;}});
test('topup is non-cacheable and ignores supplied user/fee/reference',async()=>{const response=await request('/api/finance/topups','POST',{amountMinor:1000,requestId:randomUUID(),user_id:'other',fee:999,reference:'forged'});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(transaction.amountPesewas,1000);assert.equal(transaction.metadata.user_id,'owner');assert.notEqual(transaction.reference,'forged');});
test('signed duplicate webhook and authenticated verification converge to one credit',async()=>{const first=await request('/api/finance/topups','POST',{amountMinor:1000,requestId:randomUUID()});const row=await first.json(),event={event:'charge.success',data:{reference:row.reference,status:'success',amount:1,currency:'USD'}};const payload=JSON.stringify(event),signature=createHmac('sha512','sk_test_fixture').update(payload).digest('hex');
 const webhook=()=>fetchOriginal(base+'/api/webhooks/paystack',{method:'POST',headers:{'Content-Type':'application/json','x-paystack-signature':signature},body:payload});
 await Promise.all([webhook(),webhook(),request(`/api/finance/topups/${row.reference}/verify`,'POST',{})]);const data=await FinanceService.summary('owner');assert.equal(data.walletMinor,1000);assert.equal(data.ledger.length,1);
});
test('unsigned wallet webhook rejected even in test mode',async()=>{const first=await request('/api/finance/topups','POST',{amountMinor:1000,requestId:randomUUID()});const row=await first.json();assert.equal((await request('/api/webhooks/paystack','POST',{event:'charge.success',data:{reference:row.reference}})).status,401);assert.equal((await FinanceService.summary('owner')).walletMinor,0);});
test('cross-owner verification returns no Wallet details',async()=>{const first=await request('/api/finance/topups','POST',{amountMinor:1000,requestId:randomUUID()});const row=await first.json();assert.equal((await request(`/api/finance/topups/${row.reference}/verify`,'POST',{},'other-token')).status,404);});
test('Wallet Data API ignores frontend price and maintains guest Paystack alternative',async()=>{await seed();const body={productId:'mtn-1gb',recipientPhone:'0241111111',customerEmail:'receipt@fixture.test',paymentMethod:'wallet',requestId:randomUUID(),amount:1};const response=await request('/api/payments/initialize','POST',body);assert.equal(response.status,200);const result=await response.json();assert.equal(result.amountPesewas,getAuthoritativeProduct('mtn-1gb')!.amountPesewas);assert.equal((await OrdersStore.findOrder(result.orderRef))?.payment_provider,'wallet');assert.equal((await request('/api/payments/initialize','POST',body,'')).status,401);});
test('Wallet Data retry returns existing order before active MTN check',async()=>{await seed();const body={productId:'mtn-1gb',recipientPhone:'0241111111',paymentMethod:'wallet',requestId:randomUUID()};const first=await (await request('/api/payments/initialize','POST',body)).json();const second=await (await request('/api/payments/initialize','POST',body)).json();assert.equal(first.orderRef,second.orderRef);assert.equal((await FinanceService.summary('owner')).walletMinor,10000-first.amountPesewas);});
test('Wallet Airtime uses same zero-surcharge server calculation',async()=>{await seed();const response=await request('/api/payments/initialize','POST',{productId:'airtime-telecel-10',serviceType:'airtime',network:'telecel',recipientPhone:'0201111111',amount:10,paymentMethod:'wallet',requestId:randomUUID()});assert.equal(response.status,200);const data=await response.json();assert.equal(data.amountPesewas,1000);assert.equal((await OrdersStore.findOrder(data.orderRef))?.service_fee_minor,0);});
test('Wallet AFA creates encrypted registration and preserves server retail price',async()=>{await seed();const body={name:'Fixture',phone:'0249116309',idNumber:'GHA-202501234-5',location:'Accra',region:'Greater Accra',dateOfBirth:'1990-02-12',consent:true,customerEmail:'receipt@fixture.test',amountMinor:1,paymentMethod:'wallet',requestId:randomUUID()};const response=await request('/api/afa/payments/initialize','POST',body);assert.equal(response.status,200);const data=await response.json();assert.equal(data.amountPesewas,2500);const order=(await OrdersStore.findOrder(data.orderRef))!;assert.equal(order.payment_provider,'wallet');assert.ok((await AfaStore.find(order.id))!.encrypted_payload);assert.ok(!JSON.stringify(data).includes(body.idNumber));});
test('Marketplace Wallet unsupported; no debit',async()=>{await seed();assert.equal((await request('/api/payments/initialize','POST',{productId:'mp_fixture',serviceType:'marketplace',recipientPhone:'0241111111',paymentMethod:'wallet',requestId:randomUUID()})).status,400);assert.equal((await FinanceService.summary('owner')).walletMinor,10000);});
test('Admin withdrawal mutation requires RBAC and confirmation',async()=>{assert.equal((await request('/api/admin/finance/withdrawals/unknown','POST',{action:'paid'})).status,403);assert.equal((await request('/api/admin/finance/withdrawals/unknown','POST',{action:'paid'},'admin-token')).status,400);});
test('client checkout explicitly sends Wallet and a stable request ID',()=>{const modal=readFileSync('src/components/checkout/CheckoutModal.tsx','utf8'),client=readFileSync('src/services/financeApi.ts','utf8');assert.ok(modal.includes('walletRequest.current!.id'));assert.ok(client.includes("paymentMethod:'wallet'"));assert.ok(modal.includes("'payments/initialize'"));assert.ok(!client.includes('PAYSTACK_SECRET'));});
test('customer confirmation explains withdrawal fee and irreversible transfer',()=>{const panel=readFileSync('src/components/finance/FinancialPanel.tsx','utf8');assert.ok(panel.includes('cannot be withdrawn back to Mobile Money'));assert.ok(panel.includes('Processing fee'));assert.ok(panel.includes('You receive'));assert.ok(panel.includes('I confirm'));});

test('Financial Control Room loading endpoints return JSON before the storefront fallback',async()=>{
  await seed();
  const paths=['/control','/withdrawals?offset=0','/operations?offset=0','/customers/owner'];
  const fallbackServer=express();fallbackServer.use('/api/admin',adminRouter);
  fallbackServer.use((_req,res)=>res.type('html').send('<!doctype html><html>Storefront fallback</html>'));
  const listener=await new Promise<Server>(resolve=>{const s=fallbackServer.listen(0,'127.0.0.1',()=>resolve(s));});
  try {
    const origin=`http://127.0.0.1:${(listener.address() as AddressInfo).port}`;
    const responses=await Promise.all(paths.map(path=>fetchOriginal(origin+'/api/admin/finance'+path,{headers:{Authorization:'Bearer admin-token'}})));
    for(const response of responses){assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/^application\/json/);assert.equal(response.headers.get('cache-control'),'no-store');}
    const [control,queue,operations,customer]=await Promise.all(responses.map(response=>response.json()));
    assert.equal(control.settings.withdrawalMinimumMinor,500);assert.equal(control.settings.withdrawalFeeBps,300);assert.deepEqual(control.economics.map((policy:any)=>policy.service),['data','airtime','afa']);assert.ok(Array.isArray(control.definitions));
    assert.deepEqual(queue,[]);assert.ok(operations.length>0);assert.equal(customer.walletMinor,10000);assert.ok(Array.isArray(customer.earnLedger));
  } finally {await new Promise<void>(resolve=>listener.close(()=>resolve()));}
});
