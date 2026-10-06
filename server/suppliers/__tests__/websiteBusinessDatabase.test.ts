/** PostgreSQL boundaries are fully mocked; no connection or external data mutation. */
import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {FinanceStore} from '../../db/financeStore.js';
import {WebsiteBusinessService as Business} from '../../services/websiteBusinessService.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import {PaystackServerService} from '../../services/paystackService.js';
import {WEBSITE_BUSINESS_SCHEMA} from '../../db/websiteBusinessSchema.js';
const original={query:pg.Pool.prototype.query,connect:pg.Pool.prototype.connect,resolve:FulfilmentService.getProvider().resolvePackage,preflight:FulfilmentService.preflightCheck,init:PaystackServerService.initializeTransaction,fetch:globalThis.fetch};
let state:any,statements:Array<{sql:string;values:any[]}>,fail:string;
beforeEach(()=>{
  assert.equal(process.env.NODE_ENV,'test');process.env.DATABASE_URL='postgresql://fixture.invalid/never-contacted';state={config:{},operations:[],ledger:[],orders:[],site:{id:'site_fixture',user_id:'owner',template_id:'tmpl-data-reseller',status:'published',content_json:{businessName:'Fixture'},settings_json:{}}};statements=[];fail='';
  globalThis.fetch=async()=>{throw Error('External network forbidden');};
  const query=async(sql:string,values:any[]=[])=>{
    sql=sql.replace(/\s+/g,' ').trim();statements.push({sql,values:structuredClone(values)});if(fail&&sql.includes(fail))throw Error('Mock business write failure');
    if(sql.includes('pg_advisory_xact_lock')||sql.startsWith('INSERT INTO finance_accounts')||sql.startsWith('INSERT INTO admin_audit_log'))return {rows:[]};
    if(sql.startsWith('SELECT * FROM finance_accounts'))return {rows:[{wallet_minor:0,restricted:false}]};
    if(sql.startsWith('SELECT * FROM website_sites'))return {rows:[structuredClone(state.site)]};
    if(sql.startsWith('SELECT id FROM website_sites'))return {rows:[{id:state.site.id}]};
    if(sql.startsWith('SELECT value FROM finance_config'))return {rows:state.config[values[0]]?[{value:structuredClone(state.config[values[0]])}]:[]};
    if(sql.startsWith('INSERT INTO finance_config')){state.config[values[0]]=JSON.parse(values[1]);return {rows:[]};}
    if(sql.startsWith('SELECT * FROM finance_operations'))return {rows:structuredClone(state.operations.filter((o:any)=>o.user_id===values[0]))};
    if(sql.startsWith('INSERT INTO finance_operations')){const keys=['id','user_id','kind','idempotency_key','state','amount_minor','payload','created_at'];const row=Object.fromEntries(keys.map((k,index)=>[k,k==='payload'?JSON.parse(values[index]):values[index]]));row.updated_at=row.created_at;state.operations.push(row);return {rows:[]};}
    if(sql.startsWith('UPDATE finance_operations')){Object.assign(state.operations.find((o:any)=>o.id===values[3]),{state:values[0],payload:JSON.parse(values[1]),updated_at:values[2]});return {rows:[]};}
    if(sql.startsWith('INSERT INTO orders')){const columns=sql.match(/INSERT INTO orders \((.*?)\) VALUES/)![1].split(',').map(s=>s.trim());assert.equal(columns.length,values.length);const row=Object.fromEntries(columns.map((key,index)=>[key,key==='store_context'?JSON.parse(values[index]):values[index]]));state.orders.push(row);return {rows:[row]};}
    if(sql.startsWith('SELECT * FROM orders'))return {rows:structuredClone(state.orders.filter((o:any)=>o.id===values[0]))};
    if(sql.startsWith('SELECT id FROM orders'))return {rows:[]};
    if(sql.startsWith('SELECT id,status,manual_review FROM orders'))return {rows:state.orders.filter((o:any)=>values[0].includes(o.id))};
    if(sql.startsWith('SELECT * FROM finance_ledger'))return {rows:structuredClone(state.ledger)};
    if(sql.startsWith('INSERT INTO finance_ledger')){const keys=['id','user_id','operation_id','bucket','delta_minor','balance_after_minor','description','created_at'];state.ledger.push(Object.fromEntries(keys.map((key,index)=>[key,values[index]])));return {rows:[]};}
    throw Error(`Unexpected mocked SQL: ${sql}`);
  };
  pg.Pool.prototype.query=query as any;
  pg.Pool.prototype.connect=(async()=>{let snapshot:any;return {async query(sql:string,values:any[]=[]){if(sql==='BEGIN'){snapshot=structuredClone(state);statements.push({sql,values});return {rows:[]};}if(sql==='ROLLBACK'){state=snapshot;statements.push({sql,values});return {rows:[]};}if(sql==='COMMIT'){statements.push({sql,values});return {rows:[]};}return query(sql,values);},release(){}};}) as any;
  FulfilmentService.preflightCheck=async()=>({allowed:true,supplierCostMinor:200});FulfilmentService.getProvider().resolvePackage=async()=>({resolved:{supplierCostMinor:200} as any});PaystackServerService.initializeTransaction=async params=>({success:true,reference:params.reference,accessCode:'fixture-access'});
});
afterEach(()=>{delete process.env.DATABASE_URL;pg.Pool.prototype.query=original.query;pg.Pool.prototype.connect=original.connect;FulfilmentService.preflightCheck=original.preflight;FulfilmentService.getProvider().resolvePackage=original.resolve;PaystackServerService.initializeTransaction=original.init;globalThis.fetch=original.fetch;});
async function configure(){await Business.savePolicy('admin',{confirmed:true,expectedVersion:'unconfigured',enabled:true,reserveBps:300,reserveFixedMinor:10,withdrawalMinimumMinor:500,withdrawalFeeBps:300});await Business.saveWholesale('admin',{confirmed:true,expectedVersion:'empty',productId:'mtn-1gb',enabled:true,wholesaleMinor:300});await Business.savePrices('site_fixture','owner',{expectedVersion:'empty',products:[{productId:'mtn-1gb',retailMinor:500,enabled:true}]});}
const input=()=>({productId:'mtn-1gb',recipientPhone:'0241111111',customerEmail:'fixture@example.invalid',requestId:randomUUID()});
test('checkout snapshots and latch commit together using owner, config, site and recipient locks',async()=>{await configure();await Business.initialize('site_fixture',input());assert.equal(state.orders.length,1);assert.equal(state.orders[0].store_context.earningMinor,175);assert.equal(state.operations.filter((o:any)=>o.kind==='store_checkout').length,1);assert.ok(statements.some(s=>s.sql.includes('pg_advisory_xact_lock_shared')&&s.values[0]==='store-config'));assert.ok(statements.some(s=>s.sql.includes('website_sites')&&s.sql.endsWith('FOR UPDATE')));assert.ok(statements.some(s=>s.sql.includes("hashtext('mtn_'")));assert.equal(statements.filter(s=>s.sql==='ROLLBACK').length,0);});
test('failed latch insert rolls back order and creates no payment',async()=>{await configure();fail='INSERT INTO finance_operations';await assert.rejects(()=>Business.initialize('site_fixture',input()),/Mock business/);assert.equal(state.orders.length,0);assert.equal(state.operations.length,0);assert.ok(statements.some(s=>s.sql==='ROLLBACK'));});
test('earning availability appends immutable store bucket and locks source orders on payout reads',async()=>{await configure();await Business.initialize('site_fixture',input());const order=state.orders[0];order.payment_status='success';order.status='delivered';order.delivered_at=new Date().toISOString();await Business.syncOrder(order);await Business.syncOrder(order);const earnings=await FinanceStore.transaction('owner',tx=>tx.storeEarnings());assert.equal(earnings.availableMinor,175);assert.equal(state.ledger.length,1);assert.equal(state.ledger[0].bucket,'store');assert.equal(state.ledger[0].balance_after_minor,null);assert.ok(statements.some(s=>s.sql.includes('orders WHERE id=ANY')&&s.sql.endsWith('FOR UPDATE')));});
test('earning write failure rolls back the operation and credit together',async()=>{await configure();await Business.initialize('site_fixture',input());const order=state.orders[0];order.payment_status='success';order.status='delivered';fail='INSERT INTO finance_ledger';await assert.rejects(()=>Business.syncOrder(order),/Mock business/);assert.equal(state.operations.filter((o:any)=>o.kind==='store_sale').length,0);assert.equal(state.ledger.length,0);});
test('schema initializer matches checked-in SQL and protects snapshots and duplicate earning',()=>{const sql=readFileSync('server/db/schema.sql','utf8');assert.ok(sql.includes(WEBSITE_BUSINESS_SCHEMA.trim()));assert.ok(WEBSITE_BUSINESS_SCHEMA.includes('finance_store_sale_order'));assert.ok(WEBSITE_BUSINESS_SCHEMA.includes('store_snapshot_immutable'));assert.ok(WEBSITE_BUSINESS_SCHEMA.includes('IS DISTINCT FROM'));assert.ok(!WEBSITE_BUSINESS_SCHEMA.includes('UPDATE orders SET'));assert.ok(!WEBSITE_BUSINESS_SCHEMA.includes('DELETE FROM'));});
