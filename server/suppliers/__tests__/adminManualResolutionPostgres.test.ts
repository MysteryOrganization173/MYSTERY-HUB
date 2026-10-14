import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {getPool} from '../../db/connection';
import {AuthStore} from '../../db/authStore';
import {OrdersStore} from '../../db/ordersStore';
import {OrderResolutionService} from '../../services/orderResolutionService';
import {OrderResolutionStore} from '../../db/orderResolutionStore';

// Explicit opt-in to a disposable standalone loopback cluster only. Never inherit an app URL.
test('standalone PostgreSQL manual resolution concurrency, queue parity and complete rollback',{skip:process.env.MYSTERY_MANUAL_PG_TEST!=='true'},async()=>{
 assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DATABASE_URL,undefined);
 const control=new pg.Client({host:'127.0.0.1',port:55489,user:'manual_gate',database:'postgres',ssl:false});
 await control.connect();const name='manual_'+randomUUID().replaceAll('-','')+'_test';
 let pool:pg.Pool|null=null;const persist=OrdersStore.persistResolution;
 try{
  assert.equal((await control.query("SELECT host(inet_server_addr()) AS host")).rows[0].host,'127.0.0.1');
  await control.query(`CREATE DATABASE ${name}`);
  process.env.DATABASE_URL=`postgresql://manual_gate@127.0.0.1:55489/${name}`;process.env.DATABASE_SSL='false';process.env.MYSTERY_TEST_DATABASE_OPT_IN='true';pool=getPool()!;
  await pool.query(fs.readFileSync('server/db/schema.sql','utf8'));
  for(const id of ['admin','buyer'])await AuthStore.createUser({id,name:'Synthetic '+id,email:null,phone:null,passwordHash:'fixture-only',role:id==='admin'?'admin':'customer',status:'active'});
  const make=async(id:string)=>{await pool!.query("INSERT INTO orders(id,user_id,public_reference,customer_email,customer_phone,recipient_phone,network,product_id,product_name_snapshot,bundle_size_snapshot,amount,currency,status,payment_provider,payment_reference,payment_status,supplier_provider,supplier_order_id,supplier_response,failure_reason,manual_review,paid_at,service_type) VALUES($1,'buyer',$1,'fixture@example.test','0241111111','0241111111','airteltigo','fixture-data','Data','1GB',549,'GHS','refund_pending','paystack',$2,'success','success_biz_hub',$3,'{\"status\":\"failed\"}','supplier_delivery_failed',true,NOW(),'data')",[id,'pay-'+id,'supplier-'+id]);return (await OrdersStore.findOrder(id))!;};
  const o=await make('concurrent');const body={action:'resolve_manual',manualOutcome:'manual_fulfillment',confirmed:true,expectedUpdatedAt:new Date(o.updated_at).toISOString(),expectedVersion:0,note:'Confirmed synthetic remedy',evidence:'Synthetic completion evidence'};
  const clients=await Promise.all([pool.connect(),pool.connect()]);assert.notEqual((await clients[0].query('SELECT pg_backend_pid() AS pid')).rows[0].pid,(await clients[1].query('SELECT pg_backend_pid() AS pid')).rows[0].pid);clients.forEach(c=>c.release());
  const financialBefore=(await pool.query('SELECT * FROM finance_operations')).rows;
  const outcomes=await Promise.allSettled([OrderResolutionService.action(o.id,'admin',{...body,requestId:randomUUID()}),OrderResolutionService.action(o.id,'admin',{...body,requestId:randomUUID(),manualOutcome:'external_compensation',method:'Cash',reference:'FIXTURE-CASH'})]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1,JSON.stringify(outcomes));assert.equal((await OrderResolutionStore.history(o.id)).length,1);
  assert.equal((await OrdersStore.searchOrdersAdmin({status:'needs_attention'})).total,0);const metrics=await OrdersStore.getOverviewMetrics();assert.equal(metrics.allTime.manualReviewPendingCount,0);assert.equal(metrics.today.attentionCount,0);assert.equal(metrics.allTime.unresolvedPaidCount,0);
  const after=(await OrdersStore.findOrder(o.id))!;for(const key of ['status','payment_status','payment_reference','amount','currency','supplier_order_id','supplier_response','paid_at','delivered_at'] as const)assert.deepEqual(after[key],o[key]);
  assert.deepEqual((await pool.query('SELECT * FROM finance_operations')).rows,financialBefore);assert.equal((await pool.query('SELECT COUNT(*) FROM finance_ledger')).rows[0].count,'0');
  const rollback=await make('rollback'),audits=(await pool.query('SELECT * FROM admin_audit_log ORDER BY id')).rows;
  OrdersStore.persistResolution=async(...args)=>{await persist.apply(OrdersStore,args);throw Error('Injected after actual SQL write');};
  await assert.rejects(()=>OrderResolutionService.action(rollback.id,'admin',{...body,expectedUpdatedAt:new Date(rollback.updated_at).toISOString(),requestId:randomUUID()}),/Injected/);OrdersStore.persistResolution=persist;
  assert.deepEqual(await OrdersStore.findOrder(rollback.id),rollback);assert.equal((await OrderResolutionStore.history(rollback.id)).length,0);assert.deepEqual((await pool.query('SELECT * FROM admin_audit_log ORDER BY id')).rows,audits);
  assert.equal((await OrdersStore.searchOrdersAdmin({status:'needs_attention'})).total,1);assert.equal((await OrdersStore.getOverviewMetrics()).allTime.unresolvedPaidCount,1);
  console.log('Standalone PostgreSQL: distinct connections, one resolution, SQL queue/count parity, unchanged financial ledger and post-write transaction rollback passed.');
 }finally{OrdersStore.persistResolution=persist;await pool?.end();await control.end();delete process.env.DATABASE_URL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;}
});
