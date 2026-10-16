import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import express from 'express';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {decodeAdminHash} from '../../../src/utils/adminNavigation';
import {describeOrderCase,orderTimeline} from '../../../src/utils/adminOrderCase';
import {AuthStore} from '../../db/authStore.js';
import {adminRouter} from '../../routes/adminApi.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import {readFileSync} from 'node:fs';
let server:Server,base:string,reconciliations=0;const reconcile=FulfilmentService.reconcileActiveSupplierOrders;
before(async()=>{process.env.NODE_ENV='test';delete process.env.DATABASE_URL;delete process.env.SUCCESS_BIZ_HUB_API_KEY;AuthStore._clearDevStore();for(const role of ['admin','customer'] as const){await AuthStore.createUser({id:role,name:role,email:role+'@fixture.test',phone:null,passwordHash:'synthetic',role});await AuthStore.createSession(role,role+'-fixture');}FulfilmentService.reconcileActiveSupplierOrders=async()=>{reconciliations++;return {scanned:0,updatedCount:0};};const app=express();app.use(express.json());app.use('/api/admin',adminRouter);server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
after(async()=>{FulfilmentService.reconcileActiveSupplierOrders=reconcile;await new Promise<void>(resolve=>server.close(()=>resolve()));});
for(const path of ['overview','orders'])test(`${path} passive view is authenticated and never runs financial/supplier recovery`,async()=>{
  const calls=reconciliations;
  for(const [token,status] of [['',401],['customer-fixture',403],['admin-fixture',200]] as const){const response=await fetch(`${base}/api/admin/${path}?readOnly=true`,{headers:token?{Authorization:'Bearer '+token}:{}});assert.equal(response.status,status);}
  assert.equal(reconciliations,calls);
});
test('existing explicit reconciliation callers retain their contract',async()=>{const calls=reconciliations;assert.equal((await fetch(base+'/api/admin/overview',{headers:{Authorization:'Bearer admin-fixture'}})).status,200);assert.equal(reconciliations,calls+1);});
test('malformed hash cannot crash admin; order deep links retain their reference',()=>{assert.deepEqual(decodeAdminHash('#%E0%A4%A'),['overview']);assert.deepEqual(decodeAdminHash('#orders/ref/MH-safe'),['orders','ref','MH-safe']);assert.deepEqual(decodeAdminHash('#finance/requests'),['finance','requests']);});
test('unpaid closure and unknown resolution never claim a verified refund or no debit',()=>{
  const unpaid=describeOrderCase({status:'cancelled',payment_status:'cancelled'});assert.doesNotMatch(unpaid.explanation,/No money was received/);assert.match(unpaid.nextStep,/verify/);
  const unknown=describeOrderCase({status:'failed',payment_status:'success',resolution:{stage:'resolved'}});assert.equal(unknown.key,'failed_remedy_open');assert.doesNotMatch(unknown.label,/customer refunded/);
});
for(const outcome of ['paystack_refund','wallet_refund','manual_fulfillment','external_compensation'])test(`documented ${outcome} remains distinct from supplier delivery`,()=>{const order={status:'failed',payment_status:'success',resolution:{stage:'resolved',outcome}};const result=describeOrderCase(order);assert.match(result.key,/^resolved_/);assert.equal(orderTimeline(order).find(step=>step.label==='Delivered'),undefined);});
test('financial confirmation retains state, reference, acknowledgment and idempotency controls',()=>{const source=readFileSync('src/components/admin/sections/AdminFinanceSection.tsx','utf8');for(const marker of ['expectedState:row.state','confirmed:true','MoMo transaction reference','acknowledgement:','requestId,confirmed:true','parseGhs(amount)'])assert.ok(source.includes(marker),marker);});
