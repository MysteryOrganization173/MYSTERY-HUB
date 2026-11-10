import test,{mock} from 'node:test';
import express from 'express';
import {adminRouter} from '../../routes/adminApi.js';
import {AuthStore} from '../../db/authStore.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import assert from 'node:assert/strict';
import {opsOrder} from './adminOperationsFixtures.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {getPool,initDatabase} from '../../db/connection.js';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {matchesAdminPaymentView} from '../../../shared/adminPaymentView.js';
import {adminOrderSearchParams} from '../../../src/utils/adminOrderView.js';
import {readFileSync} from 'node:fs';
const fixtures=()=>[
 ...['pending','cancelled','failed'].map(payment_status=>opsOrder({user_id:null,payment_status:payment_status as any,status:payment_status==='pending'?'pending_payment':payment_status==='cancelled'?'cancelled':'failed',paid_at:null,failure_reason:payment_status==='failed'?'paystack_initialization_failed':null})),
 opsOrder({status:'expired',payment_status:'expired' as any,paid_at:null}),
 opsOrder(),opsOrder({status:'failed'}),opsOrder({status:'refund_pending'}),opsOrder({status:'processing',payment_provider:'wallet'}),
 opsOrder({payment_provider:'complimentary'}),opsOrder({payment_provider:'admin_external'}),
 opsOrder({paid_at:null}),opsOrder({archived_at:'2026-11-01T00:00:00Z'}),
];
async function check(){
 const rows=fixtures();await AuthStore.createUser({id:'history-buyer',name:'Synthetic',email:null,phone:null,passwordHash:'fixture',role:'customer'});rows.forEach((row,i)=>row.user_id=i===4?'history-buyer':null);for(const row of rows){await OrdersStore.createOrder(row);if(row.archived_at&&getPool())await getPool()!.query('UPDATE orders SET archived_at=$2 WHERE id=$1',[row.id,row.archived_at]);}
 assert.equal((await OrdersStore.searchOrdersAdmin({status:'all',archived:'include'})).total,12);
 for(const view of ['confirmed','not_completed'] as const){
  const result=await OrdersStore.searchOrdersAdmin({status:'all',archived:'include',paymentView:view,limit:100});
  assert.deepEqual(result.orders.map(o=>o.id).sort(),rows.filter(o=>matchesAdminPaymentView(o,view)).map(o=>o.id).sort());
 }
 assert.equal((await OrdersStore.searchOrdersAdmin({status:'all',paymentView:'confirmed',archived:'include'})).total,5);
 assert.equal((await OrdersStore.searchOrdersAdmin({status:'all',paymentView:'not_completed',archived:'include'})).total,4);
 assert.equal((await OrdersStore.searchOrdersAdmin({status:'all',q:rows[11].public_reference,archived:'include'})).total,1);
 assert.equal((await OrdersStore.searchOrdersAdmin({status:'all',q:rows[11].public_reference})).total,0);
 const pages=[];for(let page=1;page<=4;page++)pages.push(...(await OrdersStore.searchOrdersAdmin({status:'all',archived:'include',limit:3,page})).orders.map(o=>o.id));
 assert.equal(new Set(pages).size,12);
 assert.equal((await OrdersStore.searchOrdersAdmin({status:'all',archived:'include',dateFrom:'2026-10-17T00:00:00Z'})).total,0);
 const late=rows[0];await OrdersStore.markOrderPaid(late.payment_reference,'2026-11-10T00:00:00Z');
 assert.equal((await OrdersStore.searchOrdersAdmin({status:'all',paymentView:'not_completed',archived:'include'})).total,3);
 assert.equal((await OrdersStore.searchOrdersAdmin({status:'all',paymentView:'confirmed',archived:'include'})).total,6);
}
test('payment attempt history matrix in memory, including late success, archives and stable pagination',async()=>{assert.equal(process.env.DATABASE_URL,undefined);OrdersStore.clearDevStore();await check();});
test('lenses explicitly preserve full history and customer payment evidence',()=>{
 assert.deepEqual(adminOrderSearchParams('all',''),{status:'all',archived:'include'});
 assert.equal(adminOrderSearchParams('confirmed','').paymentView,'confirmed');
 assert.equal(adminOrderSearchParams('awaiting_payment','').paymentView,'not_completed');
 assert.deepEqual(adminOrderSearchParams('active',''),{});
 assert.match(readFileSync('src/services/apiClient.ts','utf8'),/searchParams.set\('readOnly','true'\)/);
});
test('Admin list uses read-only reporting and rejects customer access',async()=>{
 const auth=mock.method(AuthStore,'findSessionByToken',async(token:string)=>({user:{id:'synthetic',role:token==='staff'?'admin':'customer',status:'active'}} as any));
 const reconcile=mock.method(FulfilmentService,'reconcileActiveSupplierOrders',async()=>{throw Error('Passive query must not reconcile');});
 const app=express();app.use('/api/admin',adminRouter);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{const url=`http://127.0.0.1:${(server.address() as any).port}/api/admin/orders?readOnly=true&status=all&paymentView=confirmed&archived=include`;assert.equal((await fetch(url)).status,401);assert.equal((await fetch(url,{headers:{Authorization:'Bearer buyer'}})).status,403);assert.equal((await fetch(url,{headers:{Authorization:'Bearer staff'}})).status,200);assert.equal(reconcile.mock.callCount(),0);}finally{auth.mock.restore();reconcile.mock.restore();await new Promise<void>(r=>server.close(()=>r()));}
});
test('same history matrix against disposable PostgreSQL',{skip:!process.env.MYSTERY_ATTEMPTS_POSTGRES_URL},async()=>{
 const url=process.env.MYSTERY_ATTEMPTS_POSTGRES_URL!;assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
 Object.assign(process.env,{DATABASE_URL:url,DATABASE_SSL:'false',MYSTERY_TEST_DATABASE_OPT_IN:'true'});
 try{await initDatabase();assert.equal((await getPool()!.query('SELECT count(*)::int n FROM orders')).rows[0].n,0);await check();}finally{await getPool()?.end();delete process.env.DATABASE_URL;}
});
