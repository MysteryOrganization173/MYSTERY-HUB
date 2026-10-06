/** All PostgreSQL boundaries are mocked. No database sockets or external calls. */
import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {CommercialService as C} from '../../services/commercialService.js';
import {PaystackServerService as P} from '../../services/paystackService.js';
import {FulfilmentService as F} from '../../services/fulfilmentService.js';
import {COMMERCIAL_SCHEMA} from '../../db/commercialSchema.js';
const original={query:pg.Pool.prototype.query,connect:pg.Pool.prototype.connect,init:P.initializeTransaction,resolve:F.getProvider().resolvePackage,fetch:globalThis.fetch};
let state:any,sqls:Array<{sql:string;values:any[]}>,fail:string,paymentCalls:number;
beforeEach(()=>{
 assert.equal(process.env.NODE_ENV,'test');process.env.DATABASE_URL='postgresql://fixture.invalid/never-contacted';
 state={config:{},operations:[],orders:[],audits:[],users:[{id:'buyer',phone:'+233241234567',status:'active'}]};sqls=[];fail='';paymentCalls=0;
 globalThis.fetch=async()=>{throw Error('External network forbidden');};
 const query=async(sql:string,values:any[]=[])=>{
  sql=sql.replace(/\s+/g,' ').trim();sqls.push({sql,values:structuredClone(values)});if(fail&&sql.includes(fail))throw Error('Fixture write failure');
  if(sql.includes('pg_advisory_xact_lock')||sql.startsWith('INSERT INTO finance_accounts'))return {rows:[]};
  if(sql.startsWith('SELECT * FROM finance_accounts'))return {rows:[{wallet_minor:0,restricted:false}]};
  if(sql.startsWith('SELECT * FROM users'))return {rows:state.users.filter((u:any)=>u.id===values[0])};
  if(sql.startsWith('SELECT id FROM users'))return {rows:state.users.filter((u:any)=>u.phone===values[0]).map((u:any)=>({id:u.id}))};
  if(sql.startsWith('SELECT value FROM finance_config'))return {rows:state.config[values[0]]?[{value:structuredClone(state.config[values[0]])}]:[]};
  if(sql.startsWith('INSERT INTO finance_config')){state.config[values[0]]=JSON.parse(values[1]);return {rows:[]};}
  if(sql.startsWith('SELECT * FROM finance_operations'))return {rows:structuredClone(state.operations.filter((o:any)=>o.user_id===values[0]))};
  if(sql.startsWith('INSERT INTO finance_operations')){const keys=['id','user_id','kind','idempotency_key','state','amount_minor','payload','created_at'];const row=Object.fromEntries(keys.map((k,i)=>[k,k==='payload'?JSON.parse(values[i]):values[i]]));row.updated_at=row.created_at;state.operations.push(row);return {rows:[]};}
  if(sql.startsWith('UPDATE finance_operations')){Object.assign(state.operations.find((o:any)=>o.id===values[3]),{state:values[0],payload:JSON.parse(values[1]),updated_at:values[2]});return {rows:[]};}
  if(sql.startsWith('INSERT INTO orders')){const keys=sql.match(/INSERT INTO orders \((.*?)\) VALUES/)![1].split(',').map(s=>s.trim());assert.equal(keys.length,49);assert.equal(values.length,49);const row=Object.fromEntries(keys.map((k,i)=>[k,k==='commercial_context'?JSON.parse(values[i]):values[i]]));state.orders.push(row);return {rows:[row]};}
  if(sql.startsWith('SELECT * FROM orders'))return {rows:structuredClone(sql.includes('user_id=')?state.orders.filter((o:any)=>o.user_id===values[0]&&o.payment_status==='success'&&(o.status!=='refunded'||o.manual_review)):state.orders.filter((o:any)=>o.id===values[0]))};
  if(sql.startsWith('SELECT id FROM orders'))return {rows:[]};
  if(sql.startsWith('INSERT INTO admin_audit_log')){state.audits.push(values);return {rows:[]};}
  throw Error('Unexpected SQL: '+sql);
 };
 pg.Pool.prototype.query=query as any;
 pg.Pool.prototype.connect=(async()=>{let snapshot:any;return {async query(sql:string,values:any[]=[]){if(sql==='BEGIN'){snapshot=structuredClone(state);sqls.push({sql,values});return {rows:[]};}if(sql==='ROLLBACK'){state=snapshot;sqls.push({sql,values});return {rows:[]};}if(sql==='COMMIT'){sqls.push({sql,values});return {rows:[]};}return query(sql,values);},release(){}};}) as any;
 P.initializeTransaction=async p=>{paymentCalls++;assert.ok(sqls.some(s=>s.sql==='COMMIT'));assert.equal(p.amountPesewas,449);return {success:true,reference:p.reference,accessCode:'fixture'};};F.getProvider().resolvePackage=async()=>({resolved:{supplierCostMinor:400}} as any);
});
afterEach(()=>{delete process.env.DATABASE_URL;pg.Pool.prototype.query=original.query;pg.Pool.prototype.connect=original.connect;P.initializeTransaction=original.init;F.getProvider().resolvePackage=original.resolve;globalThis.fetch=original.fetch;});
const order=():any=>{const id=randomUUID();return {id,user_id:'buyer',public_reference:'MH-'+id,payment_reference:'PAY-'+id,product_id:'mtn-1gb',service_type:'data',network:'mtn',recipient_phone:'+233271234567',customer_phone:'+233271234567',customer_email:'fixture@fixture.invalid',amount:549,currency:'GHS',status:'pending_payment',payment_status:'pending',payment_provider:'paystack',supplier_cost_minor:400,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};};
const body=()=>({requestId:randomUUID(),expectedTotalMinor:449});
test('PostgreSQL promotion/order/latch commit together before external initialization',async()=>{
 await C.initialize(order(),body());assert.equal(state.orders.length,1);assert.equal(state.orders[0].commercial_context.paidMinor,449);assert.equal(state.operations.length,2);assert.equal(paymentCalls,1);
 assert.ok(sqls.some(s=>s.sql.includes('pg_advisory_xact_lock_shared')));assert.ok(sqls.some(s=>s.sql==='SELECT * FROM users WHERE id=$1 FOR UPDATE'));assert.ok(sqls.some(s=>s.sql.includes("'welcome:'")));assert.ok(sqls.some(s=>s.sql.includes("hashtext('mtn_'")));
});
for(const failure of ['INSERT INTO orders','INSERT INTO finance_operations','INSERT INTO finance_config'])test('PostgreSQL rolls back reservation and order on '+failure,async()=>{
 fail=failure;await assert.rejects(()=>C.initialize(order(),body()),/Fixture write/);assert.equal(state.orders.length,0);assert.equal(state.operations.length,0);assert.deepEqual(state.config,{});assert.equal(paymentCalls,0);assert.ok(sqls.some(s=>s.sql==='ROLLBACK'));
});
test('PostgreSQL stale payment failure locks and re-reads current paid order',async()=>{
 const o=await C.initialize(order(),body());state.orders[0].payment_status='success';state.orders[0].paid_at=new Date().toISOString();
 await C.paymentFailed(o,{isVerified:false,status:'failed',reference:o.payment_reference,amountPesewas:449,currency:'GHS'});assert.equal(state.operations.find((o:any)=>o.kind==='welcome').state,'reserved');assert.ok(sqls.some(s=>s.sql==='SELECT * FROM orders WHERE id=$1 FOR UPDATE'));
});
test('PostgreSQL audit failure rolls back future pricing',async()=>{
 fail='INSERT INTO admin_audit_log';await assert.rejects(()=>C.save('admin',{kind:'pricing',confirmed:true,expectedVersion:'direct-launch-v1',reserveBps:0,reserveFixedMinor:0,products:[]}),/Fixture write/);assert.deepEqual(state.config,{});
});
test('PostgreSQL duplicate historical phone is denied promo without merging accounts',async()=>{
 state.users.push({id:'other',phone:'+233241234567',status:'active'});assert.equal((await C.quote('mtn-1gb','buyer')).offer.state,'phone_conflict');assert.equal(state.users.length,2);
});
test('PostgreSQL schema uses canonical uniqueness, phone lock and one active benefit',()=>{
 assert.ok(COMMERCIAL_SCHEMA.includes("pg_advisory_xact_lock(hashtextextended('phone:'"));assert.ok(COMMERCIAL_SCHEMA.includes('CREATE UNIQUE INDEX IF NOT EXISTS finance_one_active_welcome'));assert.ok(COMMERCIAL_SCHEMA.includes('NEW.phone IS NOT DISTINCT FROM OLD.phone'));assert.ok(COMMERCIAL_SCHEMA.includes('users_phone_identity_unique'));
});
