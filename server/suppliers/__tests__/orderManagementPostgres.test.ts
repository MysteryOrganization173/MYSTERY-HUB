import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import {ORDER_MANAGEMENT_SCHEMA} from '../../db/orderManagementSchema.js';
import {getPool,initDatabase} from '../../db/connection.js';
import {OrderManagement} from '../../services/orderManagement.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {AdminAuditStore} from '../../db/adminAuditStore.js';
import express from 'express';
import {adminRouter} from '../../routes/adminApi.js';
import {hashSessionToken} from '../../utils/crypto.js';
import {httpOrderRecordClient} from '../../../src/services/orderRecordKeeping.js';

test('disposable PostgreSQL: repeat startup, archival parity, strict deletion, concurrent requests and audit rollback',{skip:process.env.MYSTERY_ORDER_MGMT_PG_TEST!=='true'},async()=>{
 assert.equal(process.env.DATABASE_URL,undefined);assert.equal(process.env.NODE_ENV,'test');
 const control=new pg.Client({host:'127.0.0.1',port:55491,user:'backend_gate',database:'postgres',ssl:false});await control.connect();
 const name='order_management_'+randomUUID().replaceAll('-','')+'_test';let pool:pg.Pool|null=null;
 const previous=AdminAuditStore.record;
 try{await control.query(`CREATE DATABASE ${name}`);
 process.env.DATABASE_URL=`postgresql://backend_gate@127.0.0.1:55491/${name}`;process.env.DATABASE_SSL='false';process.env.MYSTERY_TEST_DATABASE_OPT_IN='true';pool=getPool()!;
 const schema=fs.readFileSync('server/db/schema.sql','utf8');assert.ok(schema.replace(/\r\n/g,'\n').includes(ORDER_MANAGEMENT_SCHEMA.trim().replace(/\r\n/g,'\n')));await pool.query(schema);
 await pool.query(ORDER_MANAGEMENT_SCHEMA);await pool.query(ORDER_MANAGEMENT_SCHEMA);await initDatabase();await initDatabase();
 await pool.query("INSERT INTO users(id,name,password_hash,role) VALUES('admin','Synthetic admin','fixture','admin'),('buyer','Synthetic buyer','fixture','customer')");
 async function make(id:string,registered=true){await pool!.query("INSERT INTO orders(id,public_reference,customer_email,customer_phone,recipient_phone,network,product_id,product_name_snapshot,bundle_size_snapshot,amount,currency,status,payment_reference,payment_status,created_at) VALUES($1,$1,'fixture@example.test','0241111111','0241111111','telecel','fixture','Fixture','1GB',500,'GHS','failed',$2,'failed','2026-10-01')",[id,'pay-'+id]);if(registered)await pool!.query("INSERT INTO order_test_fixtures(order_id,provenance) VALUES($1,'synthetic_no_gateway')",[id]);return (await OrdersStore.findOrder(id))!;}
 const o=await make('MH-TEST-ARCHIVE');const body={confirmed:true,reason:'Synthetic cleanup verification',expectedUpdatedAt:new Date(o.updated_at).toISOString(),requestId:randomUUID(),action:'archive'};
 const results=await Promise.allSettled([OrderManagement.action(o.id,'admin',body),OrderManagement.action(o.id,'admin',{...body,requestId:randomUUID()})]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal((await OrdersStore.searchOrdersAdmin({status:'all'})).total,0);assert.equal((await OrdersStore.searchOrdersAdmin({status:'all',archived:'only'})).total,1);
 assert.equal((await pool.query('SELECT COUNT(*) FROM orders')).rows[0].count,'1');
 let current=(await OrdersStore.findOrder(o.id))!;await OrderManagement.action(o.id,'admin',{...body,requestId:randomUUID(),action:'restore',expectedUpdatedAt:new Date(current.updated_at).toISOString()});
 assert.equal((await OrdersStore.searchOrdersAdmin({status:'all'})).total,1);
 const deletion={...body,action:'delete_test',requestId:randomUUID(),expectedUpdatedAt:new Date((await OrdersStore.findOrder(o.id))!.updated_at).toISOString()};
 const deleted=await OrderManagement.action(o.id,'admin',deletion);assert.equal(deleted.deleted,true);assert.deepEqual(await OrderManagement.action(o.id,'admin',deletion),deleted);assert.equal(await OrdersStore.findOrder(o.id),null);
 const untrusted=await make('MH-TEST-NOT-PROVEN',false);await assert.rejects(()=>OrderManagement.action(untrusted.id,'admin',{...deletion,requestId:randomUUID(),expectedUpdatedAt:new Date(untrusted.updated_at).toISOString()}),/ineligible/);
 const linked=await make('MH-TEST-LINKED');await pool.query("INSERT INTO finance_operations(id,user_id,kind,idempotency_key,state,amount_minor,payload) VALUES('financial','buyer','direct_checkout','fixture','pending',500,$1)",[JSON.stringify({orderId:linked.id})]);
 await assert.rejects(()=>OrderManagement.action(linked.id,'admin',{...deletion,requestId:randomUUID(),expectedUpdatedAt:new Date(linked.updated_at).toISOString()}),/CONNECTED_EVIDENCE/);
 const cascaded=await make('MH-TEST-CASCADE');await pool.query('CREATE TABLE future_financial_evidence(order_id text REFERENCES orders(id) ON DELETE CASCADE)');await pool.query('INSERT INTO future_financial_evidence VALUES($1)',[cascaded.id]);await assert.rejects(()=>OrderManagement.action(cascaded.id,'admin',{...deletion,requestId:randomUUID(),expectedUpdatedAt:new Date(cascaded.updated_at).toISOString()}),/CONNECTED_EVIDENCE/);
 const rollback=await make('MH-TEST-ROLLBACK');const count=(await pool.query('SELECT COUNT(*) FROM order_management_events')).rows[0].count;
 AdminAuditStore.record=async()=>{throw Error('Injected audit failure');};await assert.rejects(()=>OrderManagement.action(rollback.id,'admin',{...deletion,requestId:randomUUID(),expectedUpdatedAt:new Date(rollback.updated_at).toISOString()}),/Injected/);AdminAuditStore.record=previous;
 assert.ok(await OrdersStore.findOrder(rollback.id));assert.equal((await pool.query('SELECT COUNT(*) FROM order_test_fixtures WHERE order_id=$1',[rollback.id])).rows[0].count,'1');assert.equal((await pool.query('SELECT COUNT(*) FROM order_management_events')).rows[0].count,count);
 await assert.rejects(()=>pool!.query('DELETE FROM order_management_events'),/append-only/);assert.equal((await pool.query('SELECT COUNT(*) FROM finance_operations')).rows[0].count,'1');assert.equal((await pool.query('SELECT COUNT(*) FROM finance_ledger')).rows[0].count,'0');
 const httpOrder=await make('MH-TEST-HTTP');const token='synthetic-integration-admin';
 await pool.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES('http-admin','admin',$1,NOW()+interval '1 hour')",[hashSessionToken(token)]);
 const app=express();app.use(express.json());app.use('/api/admin',adminRouter);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${(server.address() as any).port}`,previousFetch=globalThis.fetch;
 globalThis.fetch=(url,init)=>previousFetch(base+String(url),init);
 try{
  const original=await httpOrderRecordClient.getState(token,httpOrder.public_reference);assert.equal(original.canArchive,true);assert.equal(original.canDeleteTest,true);
  const a=await httpOrderRecordClient.archive(token,httpOrder.public_reference,{expectedVersion:original.version,reason:'Synthetic HTTP archival'});assert.ok(a.ok&&a.state.archived);
  const listed=await httpOrderRecordClient.listArchived(token,{page:1,limit:20});assert.equal(listed.items[0].reference,httpOrder.public_reference);assert.ok(listed.items[0].archivedAt);
  const stale=await httpOrderRecordClient.restore(token,httpOrder.public_reference,{expectedVersion:original.version,reason:'Synthetic stale restore'});assert.ok(!stale.ok&&stale.code==='version_conflict');
  if(!a.ok)throw Error('Archive failed');const restored=await httpOrderRecordClient.restore(token,httpOrder.public_reference,{expectedVersion:a.state.version,reason:'Synthetic HTTP restore'});assert.ok(restored.ok&&!restored.state.archived);
  assert.equal((await httpOrderRecordClient.history(token,httpOrder.public_reference))?.length,2);
  if(!restored.ok)throw Error('Restore failed');const deleted=await httpOrderRecordClient.deleteTest(token,httpOrder.public_reference,{expectedVersion:restored.state.version,confirmReference:httpOrder.public_reference,reason:'Synthetic HTTP deletion'});assert.equal(deleted.ok,true);
  await assert.rejects(()=>httpOrderRecordClient.getState('invalid',linked.id));
 }finally{globalThis.fetch=previousFetch;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
 console.log('PostgreSQL 17.6 isolated: repeat initialization, concurrent single winner, reversible archival, provenance/FK/JSON guards, idempotency and full deletion/audit rollback passed.');
 }finally{AdminAuditStore.record=previous;await pool?.end();await control.query(`DROP DATABASE ${name} WITH (FORCE)`);await control.end();delete process.env.DATABASE_URL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;}
});
