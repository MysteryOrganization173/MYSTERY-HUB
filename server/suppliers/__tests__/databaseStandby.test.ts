import { randomUUID } from 'node:crypto';
import { ExperienceStore } from '../../db/experienceStore.js';
import { greetingInput } from '../../services/experienceValidation.js';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import express from 'express';
import pg from 'pg';
import { migrationEndpoints, databaseConfig, canonicalDefinition, verifySessionSource, NEON_HOST, SUPABASE_HOST } from '../../../scripts/db-standby-preflight.mjs';
import { databaseMode, mountDatabaseMode, requireRestoredDatabase } from '../../services/databaseReadiness.js';
import { getPool, initDatabase } from '../../db/connection.js';
import { AuthStore } from '../../db/authStore.js';
import { FinanceStore } from '../../db/financeStore.js';
import { OrdersStore } from '../../db/ordersStore.js';
import { hashSessionToken, hashPassword, verifyPassword } from '../../utils/crypto.js';
import { assertSafeTestDatabase } from '../../utils/environment.js';
import { opsOrder } from './adminOperationsFixtures.js';

const sourceAddress = 'postgresql://operator:synthetic@'+SUPABASE_HOST+'/postgres';
const neonAddress = 'postgresql://operator:synthetic@'+NEON_HOST+'/mysteryhub_standby_icu?sslmode=require';

test('migration accepts only verified direct endpoints and confines the reverse destination', () => {
  assert.equal(migrationEndpoints({MYSTERY_SOURCE_DATABASE_URL:sourceAddress,MYSTERY_STANDBY_DATABASE_URL:neonAddress}).target.database,'mysteryhub_standby_icu');
  assert.throws(()=>migrationEndpoints({MYSTERY_SOURCE_DATABASE_URL:neonAddress,MYSTERY_STANDBY_DATABASE_URL:sourceAddress},true),/isolated return/);
  assert.equal(migrationEndpoints({MYSTERY_SOURCE_DATABASE_URL:neonAddress,MYSTERY_STANDBY_DATABASE_URL:sourceAddress.replace('/postgres','/mysteryhub_return_november')},true).target.database,'mysteryhub_return_november');
  assert.throws(()=>migrationEndpoints({MYSTERY_SOURCE_DATABASE_URL:neonAddress,MYSTERY_STANDBY_DATABASE_URL:neonAddress}),/same database/);
  for(const value of [neonAddress+'&host=untrusted.example',neonAddress+'&sslmode=require',neonAddress.replace('require','disable'),
    neonAddress.replace('.c-3','-pooler.c-3'),'file:///tmp/test', 'postgresql://x:p@unknown.example/standby']) {
    assert.throws(()=>databaseConfig(value,undefined,{}),error=>error instanceof Error&&!error.message.includes('synthetic'));
  }
  assert.throws(()=>databaseConfig(sourceAddress,undefined,{NODE_ENV:'test'}),/isolated loopback/);
});

test('Session Pooler uses the Dashboard-pinned hostname, project login and database on port 5432 only', () => {
  const host='fixture.pooler.supabase.com';
  const address='postgresql://postgres.'+SUPABASE_HOST.split('.')[1]+':fixture%40password@'+host+':5432/postgres';
  const env={MYSTERY_SOURCE_DATABASE_URL:address,MYSTERY_STANDBY_DATABASE_URL:neonAddress,MYSTERY_SUPABASE_SESSION_HOST:host};
  const {source,target}=migrationEndpoints(env);
  assert.equal(source.sessionPooler,true);
  assert.equal(source.password,'fixture@password');
  assert.equal(target.sessionPooler,false);
  for(const input of [
    {...env,MYSTERY_SUPABASE_SESSION_HOST:''},
    {...env,MYSTERY_SUPABASE_SESSION_HOST:'another.pooler.supabase.com'},
    {...env,MYSTERY_SOURCE_DATABASE_URL:address.replace(host,'untrusted.example')},
    {...env,MYSTERY_SOURCE_DATABASE_URL:address.replace('.com','.com.untrusted.example')},
    {...env,MYSTERY_SOURCE_DATABASE_URL:address.replace('5432','6543')},
    {...env,MYSTERY_SOURCE_DATABASE_URL:address.replace(':5432','')},
    {...env,MYSTERY_SOURCE_DATABASE_URL:address.replace('fixture%40password','%GG')},
    {...env,MYSTERY_SOURCE_DATABASE_URL:address.replace('fixture%40password','%00')},
    {...env,MYSTERY_SOURCE_DATABASE_URL:address.replace('fixture%40password','')},
    {...env,MYSTERY_SOURCE_DATABASE_URL:address.replace('postgres.'+SUPABASE_HOST.split('.')[1],'postgres.otherproject')},
    {...env,MYSTERY_SOURCE_DATABASE_URL:address.replace('/postgres','/postgres2')},
    {...env,MYSTERY_STANDBY_DATABASE_URL:neonAddress.replace('standby_icu','standby_another')},
    {...env,MYSTERY_STANDBY_DATABASE_URL:address},
    {...env,MYSTERY_SOURCE_DATABASE_URL:sourceAddress,MYSTERY_STANDBY_DATABASE_URL:neonAddress.replace('standby_icu','staging')},
  ]) assert.throws(()=>migrationEndpoints(input),error=>error instanceof Error&&!error.message.includes('fixture%40password'));
});

test('the pooler backend must independently match the production database, role, and cluster', async () => {
  const checks:unknown[]=[];
  const client = {query: async (statement:string, values:string[]) => {
    checks.push(statement,values.length);
    return {rows:[{verified:false}]};
  }};
  await assert.rejects(()=>verifySessionSource(client,{sessionPooler:true}),/verified Supabase production cluster/);
  assert.match(String(checks[0]),/current_database\(\)='postgres'.*session_user='postgres'/);
  assert.match(String(checks[0]),/pg_catalog\.pg_control_system\(\)/);
  assert.equal(checks[1],1);
  await verifySessionSource({query:async()=>({rows:[{verified:true}]})},{sessionPooler:true});
  await verifySessionSource({query:async()=>assert.fail('unexpected query')},{sessionPooler:false});
});

test('object comparison permits PostgreSQL to move lossless varchar array casts without masking predicate changes', () => {
  const source = "CHECK (state = ANY ((ARRAY['ready'::character varying, 'it''s held'::character varying])::text[]))";
  const restored = "CHECK (state = ANY (ARRAY[('ready'::character varying)::text, ('it''s held'::character varying)::text]))";
  assert.equal(canonicalDefinition(source),canonicalDefinition(restored));
  assert.notEqual(canonicalDefinition(source),canonicalDefinition(restored.replace('ready','refunded')));
  const literal = "CHECK (state = 'ARRAY[(''ready''::character varying)::text]')";
  assert.equal(canonicalDefinition(literal),literal);
});

test('maintenance refuses HTTP callbacks and checkout while exposing sanitized database readiness', async () => {
  assert.throws(()=>databaseMode({DATABASE_MAINTENANCE:'true'}),/verified database name/);
  assert.throws(()=>databaseMode({NODE_ENV:'production',DATABASE_URL:neonAddress}),/verified database name/);
  assert.throws(()=>databaseMode({NODE_ENV:'production',DATABASE_EXPECTED_NAME:'postgres',DATABASE_URL:sourceAddress+'?sslmode=require'}),/verify-full TLS/);
  assert.throws(()=>databaseMode({NODE_ENV:'production',DATABASE_EXPECTED_NAME:'different',DATABASE_URL:sourceAddress+'?sslmode=verify-full'}),/matching database/);
  assert.doesNotThrow(()=>databaseMode({NODE_ENV:'production',DATABASE_EXPECTED_NAME:'postgres',DATABASE_URL:sourceAddress+'?sslmode=verify-full'}));
  await requireRestoredDatabase(undefined);
  const app=express();
  app.get('/health',(_req,res)=>res.sendStatus(200));
  let probeCalls=0,handlerCalls=0;
  mountDatabaseMode(app,databaseMode({DATABASE_EXPECTED_NAME:'local_test',DATABASE_MAINTENANCE:'true'}),async ()=>{probeCalls++;throw Error('private-fixture-details');});
  app.post('*',(_req,res)=>{handlerCalls++;res.sendStatus(200);});
  const server=app.listen(0,'127.0.0.1');
  try {
    await once(server,'listening');
    const address=server.address();
    assert.ok(address&&typeof address!=='string');
    const base='http://127.0.0.1:'+address.port;
    const [health,readiness,second,checkout,hook]=await Promise.all([
      fetch(base+'/health'),fetch(base+'/ready'),fetch(base+'/ready'),
      fetch(base+'/api/checkout',{method:'POST'}),fetch(base+'/api/webhooks/paystack',{method:'POST'}),
    ]);
    assert.equal(health.status,200);
    assert.equal(readiness.status,503);
    assert.equal(readiness.headers.get('cache-control'),'no-store');
    assert.deepEqual(await readiness.json(),{status:'unavailable',maintenance:true});
    assert.equal(second.status,503);
    assert.equal(probeCalls,1);
    assert.equal(checkout.status,503);
    assert.equal(hook.status,503);
    assert.equal(hook.headers.get('retry-after'),'60');
    assert.equal(handlerCalls,0);
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
});

const source=process.env.MYSTERY_PORTABILITY_POSTGRES_URL;
const prefix = /^\/mh_source_test$/;
async function runMigration(script:string, from:string, to:string, dir:string, args:string[]=[], sourceCa?:string) {
  const {PATH}=process.env;
  const proc=spawn(process.execPath, ['scripts/'+script+'.mjs',...args],{
    env:{PATH,NODE_ENV:'test',MYSTERY_STANDBY_TEST:'true',MYSTERY_SOURCE_DATABASE_URL:from,
      MYSTERY_STANDBY_DATABASE_URL:to,MYSTERY_STANDBY_ARCHIVE_DIR:dir,MYSTERY_SOURCE_CA_FILE:sourceCa},
    stdio:['ignore','pipe','pipe'],
  });
  let stdout='',stderr='';
  proc.stdout!.setEncoding('utf8').on('data',s=>stdout+=s);
  proc.stderr!.setEncoding('utf8').on('data',s=>stderr+=s);
  const [code]=await once(proc,'close');
  return {code,stdout,stderr};
}

test('PostgreSQL 17 archive restores and reverses the complete app, and rejects unsafe targets', {skip:!source}, async t=>{
  assert.equal(process.env.DATABASE_URL,undefined);
  const sourceUrl=new URL(source!);
  assert.match(sourceUrl.pathname,prefix);
  assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:source,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
  const dir=mkdtempSync(join(tmpdir(),'mh-standby-postgres-'));
  const urlFor=(database:string)=>new URL('/'+database,sourceUrl).href;
  const target=urlFor('mh_target_test');
  const reverse=urlFor('mh_reverse_test');
  const blocked=urlFor('mh_blocked_test');
  const failed=urlFor('mh_failed_test');
  const admin=new URL(failed);
  admin.username='postgres';
  admin.password='local-test-only';
  const open=async (connectionString:string)=>{
    const client=new pg.Client({connectionString,ssl:false});
    await client.connect();
    return client;
  };
  Object.assign(process.env,{DATABASE_URL:source,DATABASE_SSL:'false',MYSTERY_TEST_DATABASE_OPT_IN:'true',NODE_ENV:'test'});
  const src=getPool()!;
  const dest=await open(target);
  const returnDb=await open(reverse);
  const blockedDb=await open(blocked);
  const faultyDb=await open(admin.href);
  const id='fixture-standby-owner';
  const password='synthetic-standby-passphrase';
  const session='synthetic-standby-session';
  let ref:string;
  try {
    for(const db of [src,dest,returnDb,blockedDb,faultyDb]) assert.equal((await db.query("SELECT to_regclass('public.orders') AS existing")).rows[0].existing,null);
    await initDatabase();
    for(const file of ['mysteryAiHistory.sql','mysteryAiFeedback.sql','smsCommunicationsV1.sql','smsPermissionsV2.sql']) {
      await src.query(readFileSync(new URL('../../db/'+file,import.meta.url),'utf8'));
    }
    await AuthStore.createUser({id,name:'Synthetic standby account',email:'standby@example.test',phone:null,passwordHash:await hashPassword(password),role:'admin'});
    await AuthStore.createSession(id,session);
    const order=await OrdersStore.createOrder(opsOrder({user_id:id}));
    ref=order.public_reference;
    const review=await OrdersStore.createOrder(opsOrder({user_id:id,status:'failed',delivered_at:null}));
    await src.query('UPDATE orders SET manual_review=true WHERE id=$1',[review.id]);
    await FinanceStore.transaction(id,async tx=>{
      const op=await tx.create('adjustment','fixture-standby-operation',700,{source:'synthetic'},'completed');
      await tx.append(op,'wallet',700,'Synthetic migration balance');
    });
    await src.query("SELECT nextval('mysteryhub_sms.consents_id_seq')");
    await requireRestoredDatabase('mh_source_test');
    await assert.rejects(()=>requireRestoredDatabase('mh_wrong_test'),/has not started/);

    await t.test('pg_dump imports a direct snapshot without writing the destination or creating an archive',async()=>{
      const probe=await runMigration('db-standby-clone',source!,target,dir,['--probe-source']);
      assert.equal(probe.code,0,probe.stderr);
      assert.match(probe.stdout,/imported the source snapshot/);
      assert.deepEqual(readdirSync(dir),[]);
      assert.equal((await dest.query("SELECT to_regclass('public.orders') AS existing")).rows[0].existing,null);
      const invalid=await runMigration('db-standby-clone',source!,target,dir,['--check']);
      assert.equal(invalid.code,1);
      assert.match(invalid.stderr,/read-only snapshot test/);
      assert.deepEqual(readdirSync(dir),[]);
    });

    const poolerUrl=process.env.MYSTERY_STANDBY_TEST_POOLER_URL;
    await t.test('Supavisor Session Pooler imports the identical PostgreSQL 17 snapshot over verified TLS', {skip:!poolerUrl},async()=>{
      assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:poolerUrl,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
      const ca=process.env.MYSTERY_STANDBY_TEST_POOLER_CA;
      const wrongCa=process.env.MYSTERY_STANDBY_TEST_WRONG_CA;
      assert.ok(ca&&wrongCa);
      const bad=await runMigration('db-standby-clone',poolerUrl!,target,dir,['--probe-source'],wrongCa);
      assert.equal(bad.code,1,bad.stdout);
      assert.match(bad.stderr,/TLS certificate validation failed/);
      const probe=await runMigration('db-standby-clone',poolerUrl!,target,dir,['--probe-source'],ca);
      assert.equal(probe.code,0,probe.stderr);
      const testTarget=urlFor('mh_pooler_target_test');
      const result=await runMigration('db-standby-clone',poolerUrl!,testTarget,dir,[],ca);
      assert.equal(result.code,0,result.stdout+'\n'+result.stderr);
      assert.match(result.stdout,/PARITY_VERIFIED_CUTOVER_REQUIRES_APPROVAL/);
      for(const folder of readdirSync(dir)) rmSync(join(dir,folder),{recursive:true,force:true});
    });

    await t.test('empty target stays unready and reports missing application inventory',async()=>{
      const check=await runMigration('db-standby-preflight',source!,target,dir);
      assert.equal(check.code,2,check.stderr);
      assert.match(check.stdout,/"verdict": "NOT_READY"/);
      assert.match(check.stdout,/public\.finance_ledger/);
      assert.doesNotMatch(check.stdout,/standby@example|synthetic-standby-passphrase/);
    });

    await t.test('mismatched locale refuses the restore before creating application objects',async()=>{
      const check=await runMigration('db-standby-clone',source!,urlFor('mh_locale_test'),dir);
      assert.equal(check.code,1,check.stdout+'\n'+check.stderr);
      assert.match(check.stderr,/Destination locale differs/);
    });

    await t.test('an optional schema may be absent, but a partial inventory blocks the clone',async()=>{
      await src.query('CREATE SCHEMA mysteryhub_experiences');
      try {
        const incomplete=await runMigration('db-standby-preflight',source!,target,dir);
        assert.equal(incomplete.code,2,incomplete.stderr);
        assert.match(incomplete.stdout,/mysteryhub_experiences\.budgets/);
      } finally { await src.query('DROP SCHEMA mysteryhub_experiences'); }
    });
    await src.query(readFileSync(new URL('../../db/mysteryExperiences.sql',import.meta.url),'utf8'));
    const greeting = greetingInput({
      occasion:'christmas-2026',recipientName:'Synthetic recipient',showSender:false,
      message:'Festive synthetic migration fixture.',variant:'gift-classic-v1',
      creatorToken:Buffer.alloc(32,1).toString('base64url'),idempotencyKey:randomUUID(),
    });
    const savedGreeting=await ExperienceStore.create(greeting.value,greeting.creatorToken,greeting.idempotencyKey,'a'.repeat(64),true);
    await ExperienceStore.report(savedGreeting.greeting.shareId,'b'.repeat(64),'privacy');
    await t.test('atomic full restore preserves authentication, payment namespace, Wallet and sequences',async()=>{
      const result=await runMigration('db-standby-clone',source!,target,dir);
      assert.equal(result.code,0,result.stdout+'\n'+result.stderr);
      assert.match(result.stdout,/PARITY_VERIFIED_CUTOVER_REQUIRES_APPROVAL/);
      assert.match(result.stdout,/"tables": 73/);
      const row=(await dest.query('SELECT password_hash FROM users WHERE id=$1',[id])).rows[0];
      assert.ok(await verifyPassword(password,row.password_hash));
      assert.equal((await dest.query('SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()',[hashSessionToken(session)])).rows[0].user_id,id);
      assert.equal((await dest.query('SELECT payment_status FROM orders WHERE public_reference=$1',[ref])).rows[0].payment_status,'success');
      assert.equal((await dest.query('SELECT manual_review FROM orders WHERE id=$1',[review.id])).rows[0].manual_review,true);
      await assert.rejects(()=>dest.query('UPDATE orders SET payment_reference=$2 WHERE id=$1',[review.id,order.payment_reference]),
        error=>(error as {code:string}).code==='23505');
      assert.equal((await dest.query('SELECT wallet_minor FROM finance_accounts WHERE user_id=$1',[id])).rows[0].wallet_minor,'700');
      assert.equal((await dest.query('SELECT last_value,is_called FROM mysteryhub_sms.consents_id_seq')).rows[0].is_called,true);
      await assert.rejects(()=>dest.query("UPDATE finance_ledger SET delta_minor=1 WHERE user_id=$1",[id]),/immutable/);
      const restoredGreeting=(await dest.query('SELECT creator_hash,idempotency_key FROM mysteryhub_experiences.greetings WHERE share_id=$1',[savedGreeting.greeting.shareId])).rows[0];
      assert.match(restoredGreeting.creator_hash,/^[a-f0-9]{64}$/);
      assert.equal(restoredGreeting.idempotency_key,greeting.idempotencyKey);
      assert.equal((await dest.query('SELECT count(*)::int n FROM mysteryhub_experiences.reports')).rows[0].n,1);
      assert.equal((await dest.query('SELECT enabled FROM mysteryhub_experiences.configuration')).rows[0].enabled,false);
      assert.equal((await dest.query("SELECT count(*)::int n FROM public.analytics_events WHERE event_name='experience_greeting_created'")).rows[0].n,1);
      await dest.query('GRANT SELECT(password_hash) ON public.users TO anon');
      const unsafe=await runMigration('db-standby-preflight',source!,target,dir);
      assert.equal(unsafe.code,1);
      assert.match(unsafe.stderr,/role privileges are unsafe/);
      await dest.query('REVOKE SELECT(password_hash) ON public.users FROM anon');
      await dest.query('SET ROLE anon');
      try {
        await assert.rejects(()=>dest.query('SELECT 1 FROM public.orders'),error=>(error as {code:string}).code==='42501');
        await assert.rejects(()=>dest.query('SELECT 1 FROM mysteryhub_sms.messages'),error=>(error as {code:string}).code==='42501');
        await assert.rejects(()=>dest.query('SELECT 1 FROM mysteryhub_experiences.greetings'),error=>(error as {code:string}).code==='42501');
      } finally { await dest.query('RESET ROLE'); }
      const folders=readdirSync(dir).filter(name=>readdirSync(join(dir,name)).length>0);
      assert.equal(folders.length,1);
      assert.deepEqual(readdirSync(join(dir,folders[0])),['application.dump']);
      assert.equal(statSync(join(dir,folders[0],'application.dump')).mode&0o777,0o600);
    });

    await t.test('same row counts cannot hide changed rows, missing indexes or changed sequence position',async()=>{
      await dest.query("UPDATE orders SET customer_name='different synthetic identity' WHERE public_reference=$1",[ref]);
      await dest.query('DROP INDEX public.finance_operations_user_time');
      await dest.query("SELECT nextval('mysteryhub_sms.consents_id_seq')");
      const check=await runMigration('db-standby-preflight',source!,target,dir);
      assert.equal(check.code,2,check.stderr);
      const report=JSON.parse(check.stdout);
      assert.deepEqual(report.differingCounts,[]);
      assert.ok(report.differingContents.includes('public.orders'));
      assert.ok(report.differingDefinitions.includes('index public.finance_operations_user_time'));
      assert.deepEqual(report.differingSequences,['mysteryhub_sms.consents_id_seq']);
      await dest.query("UPDATE orders SET customer_name=$2 WHERE public_reference=$1",[ref,order.customer_name]);
      await dest.query('CREATE INDEX finance_operations_user_time ON finance_operations(user_id,created_at DESC)');
      await dest.query("SELECT setval('mysteryhub_sms.consents_id_seq',1,true)");
    });

    await t.test('a fresh reverse archive includes changes written to the temporary database',async()=>{
      await dest.query("UPDATE orders SET failure_reason='synthetic return-side fact' WHERE public_reference=$1",[ref]);
      const result=await runMigration('db-standby-clone',target,reverse,dir);
      assert.equal(result.code,0,result.stdout+'\n'+result.stderr);
      assert.equal((await returnDb.query('SELECT failure_reason FROM orders WHERE public_reference=$1',[ref])).rows[0].failure_reason,'synthetic return-side fact');
      assert.notEqual((await src.query('SELECT failure_reason FROM orders WHERE public_reference=$1',[ref])).rows[0].failure_reason,'synthetic return-side fact');
    });

    await t.test('nonempty destination is preserved and a forced restore failure rolls back all app objects',async()=>{
      await blockedDb.query('CREATE TABLE public.preserve_me(id int); INSERT INTO public.preserve_me VALUES (1)');
      const rejected=await runMigration('db-standby-clone',source!,blocked,dir);
      assert.equal(rejected.code,1);
      assert.match(rejected.stderr,/Empty destination verification failed/);
      assert.equal((await blockedDb.query('SELECT count(*)::int n FROM public.preserve_me')).rows[0].n,1);
      await faultyDb.query(`CREATE SCHEMA fixture_failure;
        CREATE FUNCTION fixture_failure.stop_restore() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic-DDL-failure'; END $$;
        CREATE EVENT TRIGGER reject_restore ON ddl_command_start WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION fixture_failure.stop_restore()`);
      const failure=await runMigration('db-standby-clone',source!,failed,dir);
      assert.equal(failure.code,1,failure.stdout+'\n'+failure.stderr);
      assert.match(failure.stderr,/Atomic restore and privilege validation failed/);
      assert.doesNotMatch(failure.stderr,/synthetic-DDL-failure/);
      assert.equal((await faultyDb.query("SELECT count(*)::int n FROM pg_namespace WHERE left(nspname,11)='mysteryhub_'")).rows[0].n,0);
    });
  } finally {
    await Promise.all([src.end(),dest.end(),returnDb.end(),blockedDb.end(),faultyDb.end()]);
    rmSync(dir,{recursive:true,force:true});
  }
});
