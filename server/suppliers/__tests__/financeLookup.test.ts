import assert from 'node:assert/strict';
import {test} from 'node:test';
import pg, {type PoolClient} from 'pg';
import {FinanceTx, type FinanceOperation} from '../../db/financeStore.js';
import {FINANCE_SCHEMA} from '../../db/financeSchema.js';
import {assertSafeTestDatabase} from '../../utils/environment.js';

const lookup='SELECT * FROM finance_operations WHERE user_id=$1 AND idempotency_key=$2 LIMIT 1';
const at='2026-11-01T12:00:00.000Z';
const operation=(user:string,key:string,id=user+key):FinanceOperation=>({id,user_id:user,kind:'adjustment',idempotency_key:key,state:'completed',amount_minor:100,payload:{reason:'Synthetic fixture'},created_at:at,updated_at:at});
const memory=(operations:FinanceOperation[]=[])=>({accounts:{},operations,ledger:[],config:{}});

test('PostgreSQL lookup binds both owner and key, returns one normalized operation',async()=>{
  const calls:any[]=[];
  const client={query:async(sql:string,args:string[])=>{
    calls.push({sql,args});assert.equal(sql,lookup);assert.deepEqual(args,['owner',"key:' OR true --"]);
    return {rows:[{...operation('owner',args[1]),amount_minor:'100',created_at:new Date(at),updated_at:new Date(at)}]};
  }} as unknown as PoolClient;
  const found=await new FinanceTx('owner',client).find("key:' OR true --");
  assert.equal(found?.amount_minor,100);assert.equal(found?.created_at,at);assert.equal(found?.updated_at,at);
  assert.deepEqual(found?.payload,{reason:'Synthetic fixture'});assert.equal(calls.length,1);
});

test('PostgreSQL missing and foreign operations retain undefined, errors propagate',async()=>{
  const rows=[operation('other','foreign'),operation('other','shared'),operation('owner','shared')];
  const client={query:async(sql:string,[user,key]:string[])=>{assert.equal(sql,lookup);return {rows:rows.filter(r=>r.user_id===user&&r.idempotency_key===key).slice(0,1)};}} as unknown as PoolClient;
  const tx=new FinanceTx('owner',client);
  assert.equal(await tx.find('missing'),undefined);assert.equal(await tx.find('foreign'),undefined);
  assert.equal((await tx.find('shared'))?.user_id,'owner');
  const broken={query:async()=>{throw Error('Synthetic database unavailable');}} as unknown as PoolClient;
  await assert.rejects(()=>new FinanceTx('owner',broken).find('shared'),/Synthetic database unavailable/);
});

test('memory lookup preserves user isolation, missing result and existing object identity',async()=>{
  const own=operation('owner','shared'),other=operation('other','shared');
  const state=memory([own,other,operation('other','foreign')]),before=structuredClone(state),tx=new FinanceTx('owner',undefined,state);
  assert.equal(await tx.find('shared'),own);assert.equal(await tx.find('foreign'),undefined);assert.equal(await tx.find('unknown'),undefined);
  assert.deepEqual(state,before);
});

test('repeated memory lookup/create flow applies one operation, one ledger effect and one balance credit',async()=>{
  const state=memory(),tx=new FinanceTx('owner',undefined,state);
  for(let i=0;i<10;i++){
    if(await tx.find('once'))continue;
    const row=await tx.create('adjustment','once',100,{});await tx.append(row,'wallet',100,'Synthetic credit');
  }
  assert.equal(state.operations.length,1);assert.equal(state.ledger.length,1);assert.equal((await tx.account()).wallet_minor,100);
});

const url=process.env.MYSTERY_FINANCE_LOOKUP_POSTGRES_URL;
test('native PostgreSQL: bounded lookup parity, unique index, isolated users and idempotent financial effects',{skip:!url},async t=>{
  assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
  const client=new pg.Client({connectionString:url,ssl:false});await client.connect();
  try{
    assert.equal((await client.query("SELECT to_regclass('public.users') AS t")).rows[0].t,null,'Requires an empty disposable test database');
    await client.query('BEGIN');
    await client.query('CREATE TABLE users(id varchar(64) PRIMARY KEY)');await client.query(FINANCE_SCHEMA);
    await client.query("INSERT INTO users(id) VALUES('owner'),('other')");
    await client.query(`INSERT INTO finance_operations(id,user_id,kind,idempotency_key,state,amount_minor,payload,created_at,updated_at)
      SELECT 'fixture-'||g,CASE WHEN g<=1000 THEN 'owner' ELSE 'other' END,'adjustment','key-'||g,'completed',100,'{}',$1,$1 FROM generate_series(1,2000) g`,[at]);
    const tx=new FinanceTx('owner',client as unknown as PoolClient);
    await t.test('matches full-history semantics, including dates, payload, zero amount and missing/foreign keys',async()=>{
      await client.query("UPDATE finance_operations SET amount_minor=0,payload='{\"fixture\":true}' WHERE id='fixture-3'");
      const old=(await tx.operations()).find(r=>r.idempotency_key==='key-3');assert.deepEqual(await tx.find('key-3'),old);
      assert.equal(await tx.find('key-1500'),undefined);assert.equal(await tx.find('missing'),undefined);
      const other=new FinanceTx('other',client as unknown as PoolClient);assert.equal((await other.find('key-1500'))?.user_id,'other');
      await client.query("INSERT INTO finance_operations(id,user_id,kind,idempotency_key,state,amount_minor) VALUES('shared-other','other','adjustment','key-3','completed',999)");
      assert.deepEqual(await tx.find('key-3'),old);
    });
    await t.test('existing owner/key unique index supports the bounded query without a migration',async()=>{
      const plan=(await client.query('EXPLAIN (FORMAT JSON) '+lookup,['owner','key-3'])).rows[0]['QUERY PLAN'];
      assert.match(JSON.stringify(plan),/Index.*Scan/);assert.match(JSON.stringify(plan),/idempotency_key/);
      assert.match(JSON.stringify(plan),/user_id/);
    });
    await t.test('repeated reads do not duplicate credit or ledger effects',async()=>{
      for(let i=0;i<10;i++){
        if(await tx.find('once'))continue;
        const row=await tx.create('adjustment','once',100,{});await tx.append(row,'wallet',100,'Synthetic credit');
      }
      for(let i=0;i<10;i++)assert.ok(await tx.find('once'));
      assert.equal((await client.query("SELECT count(*)::int AS n FROM finance_operations WHERE user_id='owner' AND idempotency_key='once'")).rows[0].n,1);
      assert.equal((await client.query('SELECT count(*)::int AS n FROM finance_ledger')).rows[0].n,1);
      assert.equal((await tx.account()).wallet_minor,100);
    });
  }finally{await client.query('ROLLBACK');await client.end();}
});
