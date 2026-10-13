import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import pg from 'pg';
import {ORDER_RESOLUTION_SCHEMA} from '../../db/orderResolutionSchema';
import {OrdersStore} from '../../db/ordersStore';
import {AuthStore} from '../../db/authStore';
import {FinanceStore} from '../../db/financeStore';
import {FinanceService} from '../../services/financeService';
import {OrderResolutionService as Service} from '../../services/orderResolutionService';
import {OrderResolutionStore} from '../../db/orderResolutionStore';
import {PaystackServerService as Paystack} from '../../services/paystackService';
const modulePath=process.env.MYSTERY_TEST_PGLITE_PATH;
test('actual isolated PostgreSQL repeat migration, Wallet atomicity, audit rollback and refund uniqueness',{skip:!modulePath},async()=>{
 assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DATABASE_URL,undefined);
 const {PGlite}=createRequire(import.meta.url)(modulePath!);const db=new PGlite();
 const originalQuery=pg.Pool.prototype.query,originalConnect=pg.Pool.prototype.connect,refund=Paystack.fetchRefund,verify=Paystack.fetchRefundTransaction;
 let failWrite=false;
 try{
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
  await db.exec(fs.readFileSync('server/db/schema.sql','utf8'));
  await db.exec(ORDER_RESOLUTION_SCHEMA);await db.exec(ORDER_RESOLUTION_SCHEMA);
  assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE relname='order_resolution_events'")).rows[0].relrowsecurity,true);
  for(const role of ['anon','authenticated'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query('SELECT has_table_privilege($1,\'order_resolution_events\',$2) AS granted',[role,privilege])).rows[0].granted,false);
  await db.exec('SET ROLE anon');await assert.rejects(()=>db.query('SELECT * FROM order_resolution_events'),/permission denied/);await db.exec('RESET ROLE');
  for(const privilege of ['SELECT','INSERT'])assert.equal((await db.query('SELECT has_table_privilege(current_user,\'order_resolution_events\',$1) AS granted',[privilege])).rows[0].granted,true);
  const query=async(sql:string,values:any[]=[])=>{const result=await db.query(sql,values);if(failWrite&&sql.includes('UPDATE orders SET resolution_json='))throw Error('Injected post-write failure');return {rows:result.rows,rowCount:result.affectedRows};};
  pg.Pool.prototype.query=query as any;pg.Pool.prototype.connect=(async()=>({query,release(){}})) as any;process.env.DATABASE_URL='postgresql://fixture.invalid/never-contacted';
  for(const id of ['admin','buyer','other'])await AuthStore.createUser({id,name:'Synthetic '+id,email:null,phone:null,passwordHash:'fixture-only',role:id==='admin'?'admin':'customer',status:'active'});
  const make=async(id:string,provider='wallet')=>{const stamp=new Date().toISOString();await db.query("INSERT INTO orders(id,user_id,public_reference,customer_email,customer_phone,recipient_phone,network,product_id,product_name_snapshot,bundle_size_snapshot,amount,currency,status,payment_provider,payment_reference,payment_status,supplier_provider,supplier_order_id,supplier_response,created_at,updated_at,paid_at,service_type) VALUES($1,'buyer',$1,'fixture@example.test','0241111111','0241111111','airteltigo','fixture','Data','1GB',549,'GHS','refund_pending',$2,$3,'success','success_biz_hub',$4,'{\"status\":\"failed\"}',$5,$5,$5,'data')",[id,provider,'pay-'+id,'supplier-'+id,stamp]);return (await OrdersStore.findOrder(id))!;};
  const wallet=await make('wallet-order'),untouched=await make('unrelated-order','paystack');
  const before=(await db.query("SELECT * FROM orders WHERE id='unrelated-order'")).rows;
  await FinanceService.adjustment('admin','buyer',{amountMinor:549,requestId:'fixture-funding-request',confirmed:true,direction:'credit',reason:'Isolated fixture funding'});
  await FinanceStore.transaction('buyer',async tx=>{const op=await tx.create('purchase','purchase:fixture',549,{orderId:wallet.id});await tx.append(op,'wallet',-549,'Original purchase');});
  const action=async(id:string,name:string,extra:Record<string,unknown>={})=>{const o=(await OrdersStore.findOrder(id))!;return Service.action(id,'admin',{action:name,confirmed:true,requestId:'request-'+Math.random().toString(36).slice(2),expectedUpdatedAt:new Date(o.updated_at).toISOString(),expectedVersion:o.resolution_json?.version||0,note:'Synthetic verified supplier failure',...extra});};
  await action(wallet.id,'begin_review');await action(wallet.id,'supplier_evidence',{evidenceStatus:'failed'});
  const events=(await OrderResolutionStore.history(wallet.id)).length,audits=(await db.query('SELECT count(*) FROM admin_audit_log')).rows[0].count;
  failWrite=true;await assert.rejects(()=>action(wallet.id,'refund_wallet'),/Injected/);failWrite=false;
  assert.equal((await FinanceService.summary('buyer')).walletMinor,0);assert.equal((await OrdersStore.findOrder(wallet.id))!.status,'refund_pending');assert.equal((await OrderResolutionStore.history(wallet.id)).length,events);assert.equal((await db.query('SELECT count(*) FROM admin_audit_log')).rows[0].count,audits);assert.equal((await db.query("SELECT count(*) FROM finance_operations WHERE kind='refund'")).rows[0].count,0);
  await action(wallet.id,'refund_wallet');assert.equal((await FinanceService.summary('buyer')).walletMinor,549);assert.equal((await OrdersStore.findOrder(wallet.id))!.resolution_json?.stage,'resolved');assert.equal((await db.query("SELECT count(*) FROM finance_ledger WHERE description='Refund'")).rows[0].count,1);
  Paystack.fetchRefund=async id=>({id,transactionId:9001,amountMinor:549,currency:'GHS',status:'processed',domain:'live',refundedAt:new Date().toISOString()});Paystack.fetchRefundTransaction=async reference=>({reference,transactionId:9001,amountPesewas:549,currency:'GHS',status:'reversed',domain:'live'});
  await action(untouched.id,'begin_review');await action(untouched.id,'verify_external',{refundId:'12345'});const third=await make('third-order','paystack');await action(third.id,'begin_review');await assert.rejects(()=>action(third.id,'verify_external',{refundId:'12345'}));assert.equal((await OrdersStore.findOrder(third.id))!.status,'refund_pending');
  const expected=(await db.query('SELECT resolution_json FROM orders WHERE id=$1',[wallet.id])).rows[0].resolution_json;await db.exec(ORDER_RESOLUTION_SCHEMA);assert.deepEqual((await db.query('SELECT resolution_json FROM orders WHERE id=$1',[wallet.id])).rows[0].resolution_json,expected);
  // Original customer/payment facts on the Paystack fixture remain unchanged after its resolution.
  const final=(await db.query("SELECT * FROM orders WHERE id='unrelated-order'")).rows[0];for(const field of ['id','user_id','public_reference','amount','currency','payment_provider','payment_reference','payment_status','paid_at','customer_email','recipient_phone'])assert.deepEqual(final[field],before[0][field]);
  console.log('Actual embedded PostgreSQL: repeat migration, private history, full transaction rollback, original Wallet credit, unique external refund claim and immutable payment facts passed. No external server/provider used.');
 }finally{pg.Pool.prototype.query=originalQuery;pg.Pool.prototype.connect=originalConnect;Paystack.fetchRefund=refund;Paystack.fetchRefundTransaction=verify;delete process.env.DATABASE_URL;await db.close();}
});
