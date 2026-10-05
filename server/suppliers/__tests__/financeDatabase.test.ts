import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {FinanceStore} from '../../db/financeStore.js';
import {FinanceService} from '../../services/financeService.js';
import {FINANCE_SCHEMA} from '../../db/financeSchema.js';
import {randomUUID} from 'node:crypto';
import {OrdersStore} from '../../db/ordersStore.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
const originalDispatch=FulfilmentService.processPaidOrder;
const originalQuery=pg.Pool.prototype.query,originalConnect=pg.Pool.prototype.connect,env={...process.env};
let state:any,statements:Array<{sql:string;args:any[]}>,tail:Promise<void>,fail:string;
beforeEach(()=>{
 process.env.NODE_ENV='test';process.env.DATABASE_URL='postgresql://fixture.invalid/never-contacted';state={account:{wallet_minor:0,restricted:false},operations:[],ledger:[],orders:[],config:{},audit:[]};statements=[];tail=Promise.resolve();fail='';
 FulfilmentService.processPaidOrder=async reference=>({order:await OrdersStore.findOrder(reference),alreadyHandled:false});
 const query=async(sql:string,args:any[]=[])=>{
  sql=sql.replace(/\s+/g,' ').trim();statements.push({sql,args});if(fail&&sql.includes(fail))throw Error('Mock financial write failure');
  if(sql.startsWith('INSERT INTO finance_accounts'))return {rows:[]};
  if(sql.startsWith('SELECT * FROM finance_accounts'))return {rows:[{...state.account}]};
  if(sql.startsWith('UPDATE finance_accounts SET wallet_minor')){state.account.wallet_minor=args[0];return {rows:[]};}
  if(sql.startsWith('UPDATE finance_accounts SET restricted')){state.account.restricted=sql.includes('TRUE');return {rows:[]};}
  if(sql.startsWith('SELECT * FROM finance_operations'))return {rows:structuredClone(state.operations.filter((x:any)=>sql.includes('WHERE id=')?x.id===args[0]:x.user_id===args[0]))};
  if(sql.startsWith('INSERT INTO finance_operations')){const names=['id','user_id','kind','idempotency_key','state','amount_minor','payload','created_at'];const row=Object.fromEntries(names.map((k,n)=>[k,k==='payload'?JSON.parse(args[n]):args[n]]));row.updated_at=row.created_at;state.operations.push(row);return {rows:[]};}
  if(sql.startsWith('UPDATE finance_operations')){Object.assign(state.operations.find((x:any)=>x.id===args[3]),{state:args[0],payload:JSON.parse(args[1]),updated_at:args[2]});return {rows:[]};}
  if(sql.startsWith('SELECT * FROM finance_ledger'))return {rows:structuredClone(state.ledger.filter((x:any)=>x.user_id===args[0]))};
  if(sql.startsWith('INSERT INTO finance_ledger')){state.ledger.push(Object.fromEntries(['id','user_id','operation_id','bucket','delta_minor','balance_after_minor','description','created_at'].map((k,n)=>[k,args[n]])));return {rows:[]};}
  if(sql.startsWith('SELECT * FROM reward_ledger'))return {rows:[{referrer_user_id:args[0],amount_minor:2000,status:'approved'}]};
  if(sql.startsWith('SELECT order_id,service_type,amount_minor FROM reward_ledger'))return {rows:[]};
  if(sql.includes('COUNT(DISTINCT visitor_key)'))return {rows:[{count:'0'}]};
  if(sql.startsWith('SELECT value FROM finance_config'))return {rows:state.config[args[0]]?[{value:state.config[args[0]]}]:[]};
  if(sql.startsWith('INSERT INTO finance_config')){state.config[args[0]]=JSON.parse(args[1]);return {rows:[]};}
  if(sql.startsWith('INSERT INTO admin_audit_log')){state.audit.push(args);return {rows:[{id:args[0]}]};}
  if(sql.startsWith('INSERT INTO orders')){const columns=sql.match(/INSERT INTO orders \((.*?)\) VALUES/)![1].split(',').map(x=>x.trim());const row=Object.fromEntries(columns.map((key,index)=>[key,args[index]]));state.orders.push(row);return {rows:[row]};}
  if(sql.startsWith('SELECT * FROM orders'))return {rows:structuredClone(state.orders.filter((x:any)=>[x.id,x.payment_reference,x.public_reference].includes(args[0])))};
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[]};
  throw Error(`Unexpected mocked SQL: ${sql}`);
 };
 pg.Pool.prototype.query=query as any;
 pg.Pool.prototype.connect=(async()=>{let release!:()=>void,snapshot:any;return {async query(sql:string,args:any[]=[]) {
  if(sql.includes('pg_advisory_xact_lock')){const previous=tail;tail=new Promise<void>(r=>{release=r;});await previous;snapshot=structuredClone(state);statements.push({sql,args});return {rows:[]};}
  if(sql==='ROLLBACK'&&snapshot)state=snapshot;return query(sql,args);
 },release(){release?.();}};}) as any;
});
afterEach(()=>{pg.Pool.prototype.query=originalQuery;pg.Pool.prototype.connect=originalConnect;FulfilmentService.processPaidOrder=originalDispatch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);});
const request=()=>({amountMinor:1000,requestId:randomUUID(),confirmed:true});
test('PostgreSQL Wallet adjustment locks owner, writes projection/journal/audit then commits',async()=>{await FinanceService.adjustment('admin','owner',{...request(),direction:'credit',reason:'Fixture'});assert.equal(statements[0].sql,'BEGIN');assert.deepEqual(statements.find(s=>s.sql.includes('pg_advisory'))!.args,['finance:owner']);assert.equal(state.account.wallet_minor,1000);assert.equal(state.ledger.length,1);assert.equal(state.audit.length,1);assert.equal(statements.at(-1)!.sql,'COMMIT');});
test('bound financial SQL never interpolates identifiers/reasons',async()=>{await FinanceService.adjustment('admin','owner',{...request(),direction:'credit',reason:"Fixture's reason"});assert.ok(statements.every(s=>!s.sql.includes("Fixture's reason")));const insert=statements.find(s=>s.sql.startsWith('INSERT INTO finance_ledger'))!;assert.equal(insert.args[1],'owner');assert.equal(insert.args[4],1000);});
test('Earn transfer locks authoritative reward rows before paired ledger movements',async()=>{await FinanceService.transfer('owner',request());assert.ok(statements.some(s=>s.sql.includes('reward_ledger')&&s.sql.includes('FOR UPDATE')));assert.deepEqual(state.ledger.map((x:any)=>[x.bucket,x.delta_minor]),[['earn',-1000],['wallet',1000]]);});
test('PostgreSQL transfer retries have one operation and two journal rows',async()=>{const body=request();await FinanceService.transfer('owner',body);await FinanceService.transfer('owner',body);assert.equal(state.operations.length,1);assert.equal(state.ledger.length,2);});
test('row locking serializes simultaneous Earn transfers',async()=>{const results=await Promise.allSettled(Array.from({length:6},()=>FinanceService.transfer('owner',request())));assert.equal(results.filter(x=>x.status==='fulfilled').length,2);assert.equal(state.account.wallet_minor,2000);assert.equal(state.ledger.filter((x:any)=>x.bucket==='earn').length,2);});
test('Wallet credit failure rolls back both Earn and Wallet ledger',async()=>{fail='UPDATE finance_accounts SET wallet_minor';await assert.rejects(()=>FinanceService.transfer('owner',request()));assert.equal(state.ledger.length,0);assert.equal(state.operations.length,0);assert.equal(state.account.wallet_minor,0);assert.equal(statements.at(-1)!.sql,'ROLLBACK');});
test('Admin audit failure rolls back financial adjustment',async()=>{fail='INSERT INTO admin_audit_log';await assert.rejects(()=>FinanceService.adjustment('admin','owner',{...request(),direction:'credit',reason:'Fixture'}));assert.equal(state.account.wallet_minor,0);assert.equal(state.ledger.length,0);assert.equal(state.operations.length,0);});
test('reservation records fixed fee snapshot and releases through new journal entry',async()=>{const row=await FinanceService.requestWithdrawal('owner',{...request(),phone:'0241111111',network:'mtn',recipientName:'Fixture'});assert.equal(state.operations[0].payload.feeMinor,30);await FinanceService.withdrawalAction('admin',row.id,{confirmed:true,expectedState:'pending_review',action:'reject',reason:'Fixture'}).catch(error=>{throw error;});assert.equal(state.ledger.length,2);assert.equal(state.ledger[1].delta_minor,1000);});
test('financial schema is additive and matches schema.sql byte-for-byte after line normalization',()=>{const schema=readFileSync('server/db/schema.sql','utf8').replaceAll('\r\n','\n');assert.ok(schema.includes(FINANCE_SCHEMA.replaceAll('\r\n','\n')));assert.ok(!FINANCE_SCHEMA.includes('DROP'));assert.ok(FINANCE_SCHEMA.includes('UNIQUE(user_id,idempotency_key)'));assert.ok(FINANCE_SCHEMA.includes('UNIQUE(operation_id,bucket)'));assert.ok(FINANCE_SCHEMA.includes('CHECK(wallet_minor >= 0'));});
test('repeatable financial initialization runs after existing account/order infrastructure',()=>{const source=readFileSync('server/db/connection.ts','utf8');assert.ok(source.indexOf('await client.query(FINANCE_SCHEMA)')>source.indexOf('await client.query(AFA_SCHEMA)'));});
const purchase=()=>({id:randomUUID(),user_id:'owner',public_reference:randomUUID(),service_type:'data',network:'telecel',product_id:'fixture',recipient_phone:'+233201111111',amount:600,currency:'GHS',created_at:new Date().toISOString(),updated_at:new Date().toISOString()} as any);
const wallet=()=>FinanceService.adjustment('admin','owner',{...request(),direction:'credit',reason:'Fixture'});
test('PostgreSQL purchase commits debit, ledger and truthful Wallet order together',async()=>{await wallet();statements=[];await FinanceService.payOrder(purchase(),randomUUID());assert.equal(state.account.wallet_minor,400);assert.equal(state.orders[0].payment_provider,'wallet');assert.equal(state.orders[0].payment_status,'success');assert.ok(statements.findIndex(s=>s.sql.startsWith('INSERT INTO orders'))<statements.findIndex(s=>s.sql==='COMMIT'));assert.equal(statements.filter(s=>s.sql==='BEGIN').length,1);});
test('PostgreSQL order insert failure rolls back the purchase debit and operation',async()=>{await wallet();fail='INSERT INTO orders';await assert.rejects(()=>FinanceService.payOrder(purchase(),randomUUID()));assert.equal(state.account.wallet_minor,1000);assert.equal(state.operations.filter((x:any)=>x.kind==='purchase').length,0);assert.equal(state.ledger.length,1);assert.equal(state.orders.length,0);});
test('AFA creation callback shares financial transaction and failure rolls back order and debit',async()=>{await wallet();await assert.rejects(()=>FinanceService.payOrder({...purchase(),service_type:'afa'},randomUUID(),async(tx,order)=>{assert.ok(tx.client);await OrdersStore.createOrder(order,tx.client);throw Error('Synthetic encrypted registration insert failure');}));assert.equal(state.account.wallet_minor,1000);assert.equal(state.orders.length,0);assert.equal(state.ledger.length,1);});
test('PostgreSQL financial summary reuses transaction client for qualified visitor reads',async()=>{await wallet();pg.Pool.prototype.query=(async()=>{throw Error('Secondary connection prohibited');}) as any;const summary=await FinanceService.summary('owner');assert.equal(summary.walletMinor,1000);assert.equal(summary.achievements[1].progress,0);});
