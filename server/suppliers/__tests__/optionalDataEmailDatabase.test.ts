import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import pg from 'pg';
import {OrdersStore} from '../../db/ordersStore.js';
import type {OrderRecord} from '../../types/orders.js';
const originalConnect=pg.Pool.prototype.connect,originalQuery=pg.Pool.prototype.query;
let statements:{sql:string;values:unknown[]}[],existing:OrderRecord|undefined,blocked:boolean,failInsert:boolean;
const order={id:'ord_guest_'+'a'.repeat(48),user_id:null,recipient_phone:'+233241234567',network:'mtn',customer_email:'',commercial_context:{regularMinor:549,discountMinor:0,paidMinor:549}} as OrderRecord;
async function query(sql:string,values:unknown[]=[]) {
 const text=sql.replace(/\s+/g,' ').trim();statements.push({sql:text,values});
 if(text==='BEGIN'||text==='COMMIT'||text==='ROLLBACK'||text.includes('pg_advisory_xact_lock'))return {rows:[]};
 if(text.startsWith('SELECT * FROM orders WHERE id='))return {rows:existing?[existing]:[]};
 if(text.startsWith('SELECT id FROM orders'))return {rows:blocked?[{id:'active'}]:[]};
 if(text.startsWith('INSERT INTO orders')){if(failInsert)throw Error('Synthetic insert failure');return {rows:[]};}
 throw Error('Unexpected query');
}
beforeEach(()=>{process.env.DATABASE_URL='postgresql://fixture.invalid/never-contacted';statements=[];existing=undefined;blocked=false;failInsert=false;pg.Pool.prototype.query=query as unknown as typeof originalQuery;pg.Pool.prototype.connect=(async()=>({query,release(){}})) as unknown as typeof originalConnect;});
afterEach(()=>{pg.Pool.prototype.query=originalQuery;pg.Pool.prototype.connect=originalConnect;delete process.env.DATABASE_URL;});
test('guest latch commits complete snapshot under request and MTN locks before provider work',async()=>{assert.equal((await OrdersStore.claimGuestDirectOrder(order)).created,true);assert.equal(statements[0].sql,'BEGIN');assert.ok(statements[1].sql.includes('guest-direct:'));assert.ok(statements[2].sql.includes('FOR UPDATE'));const insert=statements.find(s=>s.sql.startsWith('INSERT'))!;assert.ok(insert.sql.includes('commercial_context'));assert.equal(insert.values.length,49);assert.equal(insert.values[7],'');assert.deepEqual(JSON.parse(insert.values[48] as string),order.commercial_context);assert.equal(statements.at(-1)!.sql,'COMMIT');assert.ok(order.id.length<=64);});
test('existing durable request returns original order without another INSERT',async()=>{existing=order;const result=await OrdersStore.claimGuestDirectOrder({...order,payment_reference:'different'});assert.equal(result.created,false);assert.equal(result.order,order);assert.equal(statements.filter(s=>s.sql.startsWith('INSERT')).length,0);assert.equal(statements.at(-1)!.sql,'COMMIT');});
test('MTN recipient conflict rolls back without changing an existing order',async()=>{blocked=true;await assert.rejects(()=>OrdersStore.claimGuestDirectOrder(order),/already active/);assert.equal(statements.at(-1)!.sql,'ROLLBACK');assert.ok(!statements.some(s=>s.sql.startsWith('INSERT')));});
test('failed persistence rolls back and never reports claim success',async()=>{failInsert=true;await assert.rejects(()=>OrdersStore.claimGuestDirectOrder(order),/insert failure/);assert.equal(statements.at(-1)!.sql,'ROLLBACK');});
