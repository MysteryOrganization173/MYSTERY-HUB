import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {AfaStore} from '../../db/afaStore.js';
import {AFA_SCHEMA} from '../../db/afaSchema.js';
import {decryptAfaPayload} from '../../services/afaEncryption.js';
import type {OrderRecord} from '../../types/orders.js';
const env={...process.env},query=pg.Pool.prototype.query,connect=pg.Pool.prototype.connect;
const payload={name:'Fixture',phone:'0249116309',idNumber:'GHA-202501234-5',location:'Accra',region:'Greater Accra',dateOfBirth:'1990-02-12'};
const order={id:'afa-db',recipient_phone:'+233249116309',created_at:new Date().toISOString(),service_type:'afa',payment_status:'success',status:'queued'} as OrderRecord;
let statements:Array<{sql:string;values:any[]}>,duplicate:boolean,failInsert:boolean,claimed:boolean,released:boolean;
beforeEach(()=>{process.env.NODE_ENV='test';process.env.DATABASE_URL='postgresql://fixture.invalid/never-contacted';process.env.AFA_PII_ENCRYPTION_KEY='ab'.repeat(32);statements=[];duplicate=false;failInsert=false;claimed=false;released=false;
  const mockQuery=async(sql:string,values:any[]=[])=>{sql=sql.replace(/\s+/g,' ').trim();statements.push({sql,values});
    if(sql.startsWith('SELECT order_id'))return {rows:duplicate?[{order_id:'existing'}]:[]};
    if(sql.startsWith('INSERT INTO afa_registrations')&&failInsert)throw new Error('fixture insert failure');
    if(sql.startsWith('UPDATE afa_registrations a SET submission_attempted_at')){const won=!claimed;claimed=true;return {rows:won?[{id:'afa-db'}]:[]};}
    return {rows:[]};};
  pg.Pool.prototype.query=mockQuery as any;pg.Pool.prototype.connect=(async()=>({query:mockQuery,release(){released=true;}})) as any;
});
afterEach(()=>{pg.Pool.prototype.query=query;pg.Pool.prototype.connect=connect;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);});
test('AFA order and encrypted registration insert share one transaction',async()=>{await AfaStore.create(order,payload);assert.equal(statements[0].sql,'BEGIN');assert.equal(statements.at(-1)!.sql,'COMMIT');assert.ok(released);assert.equal(statements.filter(s=>s.sql.startsWith('INSERT INTO orders')).length,1);const row=statements.find(s=>s.sql.startsWith('INSERT INTO afa_registrations'))!;assert.deepEqual(decryptAfaPayload(order.id,row.values[4]),payload);assert.ok(!JSON.stringify(row.values[5]).includes(payload.dateOfBirth));assert.match(row.sql,/\$7,\$7/);});
test('PostgreSQL duplicate check takes phone lock before inserting order',async()=>{duplicate=true;await assert.rejects(AfaStore.create(order,payload),/active or completed/);assert.match(statements[1].sql,/pg_advisory_xact_lock/);assert.equal(statements.filter(s=>s.sql.startsWith('INSERT INTO orders')).length,0);assert.equal(statements.at(-1)!.sql,'ROLLBACK');assert.ok(released);});
test('registration insert failure rolls back the order too',async()=>{failInsert=true;await assert.rejects(AfaStore.create(order,payload));assert.equal(statements.at(-1)!.sql,'ROLLBACK');assert.ok(!statements.some(s=>s.sql==='COMMIT'));assert.ok(released);});
test('PostgreSQL latch is conditional on verified payment, queued order and untouched latch',async()=>{assert.equal(await AfaStore.claimSubmission(order.id),true);assert.equal(await AfaStore.claimSubmission(order.id),false);const sql=statements[0].sql;for(const text of ["o.payment_status='success'","o.status='queued'",'submission_attempted_at IS NULL','supplier_public_id IS NULL','encrypted_payload IS NOT NULL'])assert.ok(sql.includes(text));});
test('supplier identifier is stored with bounded parameters rather than interpolated SQL',async()=>{await AfaStore.supplierState(order.id,'AFA_DB','processing');assert.deepEqual(statements[0].values,[order.id,'AFA_DB','processing']);assert.match(statements[0].sql,/supplier_public_id=\$2/);});
test('purge erases ciphertext and preserves completed duplicate block by default',async()=>{await AfaStore.purge(order.id);assert.match(statements[0].sql,/encrypted_payload=NULL/);assert.deepEqual(statements[0].values,[order.id,false]);});
test('crash cleanup only targets terminal orders with retained ciphertext',async()=>{await AfaStore.reconcileTerminalPayloads();assert.match(statements[0].sql,/encrypted_payload IS NOT NULL/);assert.match(statements[0].sql,/'delivered','failed','refunded','cancelled','expired'/);assert.ok(!statements[0].sql.includes("'refund_pending'"));});
test('schema.sql and repeatable initialization agree; unique phone and supplier IDs are indexed',()=>{const schema=readFileSync(new URL('../../db/schema.sql',import.meta.url),'utf8');assert.ok(schema.includes(AFA_SCHEMA.trim()));assert.match(AFA_SCHEMA,/order_id VARCHAR\(64\) NOT NULL UNIQUE REFERENCES orders/);assert.match(AFA_SCHEMA,/WHERE purchase_blocked = TRUE/);assert.match(AFA_SCHEMA,/supplier_public_id VARCHAR\(64\)/);assert.doesNotMatch(AFA_SCHEMA,/DROP |ALTER TABLE users|date_of_birth/i);});
test('PostgreSQL repurchase cleanup never releases an unresolved attempted submission',async()=>{
  await AfaStore.create(order,payload);
  const sql=statements.find(s=>s.sql.startsWith('UPDATE afa_registrations a SET purchase_blocked'))!.sql;
  assert.match(sql,/a.submission_attempted_at IS NULL AND a.supplier_public_id IS NULL/);
  assert.match(sql,/a.supplier_status IN \('failed','rejected','cancelled'\)/);
});
test('PostgreSQL terminal reconciliation protects registered and unresolved reservations',async()=>{
  await AfaStore.reconcileTerminalPayloads();const sql=statements[0].sql;
  assert.match(sql,/o.status='delivered' OR a.supplier_status='registered' THEN a.purchase_blocked/);
  assert.match(sql,/a.submission_attempted_at IS NULL AND a.supplier_public_id IS NULL/);
  assert.match(sql,/a.supplier_status IN \('failed','rejected','cancelled'\)/);
});
test('PostgreSQL release-and-purge atomically rechecks supplier acceptance',async()=>{
  await AfaStore.purge(order.id,true);const sql=statements[0].sql;
  assert.match(sql,/NOT \$2 OR submission_attempted_at IS NULL AND supplier_public_id IS NULL/);
  assert.match(sql,/supplier_status IN \('failed','rejected','cancelled'\)/);
});
