import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {getPool,initDatabase} from '../../db/connection.js';
import {SalesReliabilityStore as Store} from '../../db/salesReliabilityStore.js';
import {SalesCollector} from '../../services/salesReliability.js';
import {salesView} from '../../services/salesReliabilityRules.js';
import type {SalesObservation} from '../../../shared/salesReliability.js';

const url=process.env.MYSTERY_MONITOR_POSTGRES_URL;
test('native PostgreSQL monitoring durability, concurrency, bounded history and financial isolation',{skip:!url},async t=>{
  assert.equal(process.env.DATABASE_URL,undefined);assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
  const observer=new pg.Pool({connectionString:url,ssl:false,max:2});
  try{
    assert.equal((await observer.query("SELECT to_regclass('public.users') AS name")).rows[0].name,null,'NEW empty disposable database required');
    assert.deepEqual((await observer.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0],{rolsuper:false,rolbypassrls:false});
    Object.assign(process.env,{DATABASE_URL:url,DATABASE_SSL:'false',NODE_ENV:'test',MYSTERY_TEST_DATABASE_OPT_IN:'true'});await initDatabase();
    await observer.query("INSERT INTO users(id,name,password_hash) VALUES('monitor-sentinel','Synthetic','fixture'); INSERT INTO finance_accounts(user_id,wallet_minor) VALUES('monitor-sentinel',1234)");
    const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
    const publicTables=(await observer.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
    const snapshot=async()=>Promise.all(publicTables.map(async r=>(await observer.query(`SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) AS data FROM public.${quote(r.tablename)} t`)).rows));
    const before=await snapshot();
    const now=Date.now(),event=(at:number,extra:Partial<SalesObservation>={}):SalesObservation=>({id:randomUUID(),at,service:'data',stage:'services',category:'timeout',blocked:true,phase:'headers',fresh:{},cached:[],...extra});
    const failures=[event(now-180000),event(now-120000),event(now-60000)];
    await t.test('three failed attempts create one durable incident; duplicate batch is idempotent',async()=>{
      await Store.save(failures,now);await Store.save(failures,now);
      const state=await Store.read(undefined,now);assert.equal(state.observations.length,3);assert.equal(state.incidents.length,1);assert.equal(state.incidents[0].affectedAttempts,3);assert.equal(state.incidents[0].blockedAttempts,3);
    });
    await t.test('concurrent writers serialize; retry creates no duplicate incident or affected attempt',async()=>{
      const batches=Array.from({length:5},(_,i)=>[event(now-50000+i)]);
      const results=await Promise.allSettled(batches.map(batch=>Store.save(batch,now)));
      for(let i=0;i<results.length;i++)if(results[i].status==='rejected')await Store.save(batches[i],now);
      const state=await Store.read(undefined,now);assert.equal(state.incidents.length,1);assert.equal(state.incidents[0].affectedAttempts,8);assert.equal(state.observations.length,8);
    });
    await t.test('new collector/restored database state survives restart; wallet and cached evidence cannot recover discovery',async()=>{
      const c=new SalesCollector();assert.equal((await c.view(now)).state,'active');
      await Store.save([event(now-40000,{category:'passed',blocked:false,fresh:{wallet:now-40000},cached:['services']})],now);
      assert.equal((await Store.read(undefined,now)).incidents[0].firstRecoveryAt,null);
      await Store.save([event(now-30000,{category:'passed',blocked:false,fresh:{services:now-30000}})],now);
      assert.equal((await c.view(now)).state,'recovering');
      await Store.save([event(now+30000,{category:'passed',blocked:false,fresh:{services:now+30000}})],now+30000);
      assert.equal((await new SalesCollector().view(now+30000)).state,'recovered');
    });
    await t.test('buffered persistence preserves the event-time ten-minute boundary',async()=>{
      const buffered=[event(now-600000+1,{service:'airtime',stage:'catalog'}),event(now-100,{service:'airtime',stage:'catalog'}),event(now,{service:'airtime',stage:'catalog'})];
      await Store.save(buffered,now+5000);
      const state=await Store.read(undefined,now+5000);
      const found=state.incidents.find(i=>i.service==='airtime'&&i.stage==='catalog');
      assert.equal(found?.affectedAttempts,3,'flush delay must not erase a failure inside the actual event-time window');
      const outside=[event(now-600000,{service:'instant_bundle',stage:'catalog'}),event(now-100,{service:'instant_bundle',stage:'catalog'}),event(now,{service:'instant_bundle',stage:'catalog'})];
      await Store.save(outside,now+5000);
      assert.equal((await Store.read(undefined,now+5000)).incidents.some(i=>i.service==='instant_bundle'),false,'the exact ten-minute boundary stays exclusive');
    });
    await t.test('repeated initialization and all monitoring writes leave existing customer/finance tables unchanged',async()=>{
      await initDatabase();assert.deepEqual(await snapshot(),before);
      const tables=(await observer.query("SELECT c.relrowsecurity,c.relforcerowsecurity,(SELECT count(*) FROM pg_policy WHERE polrelid=c.oid) AS policies,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS anon,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS customer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='mysteryhub_operations' AND c.relkind='r'")).rows;
      assert.equal(tables.length,2);for(const row of tables)assert.deepEqual(row,{relrowsecurity:true,relforcerowsecurity:false,policies:'0',anon:false,customer:false});
    });
    await t.test('retention is bounded by both age and count; expired incidents are not fabricated as recovered',async()=>{
      await observer.query("INSERT INTO mysteryhub_operations.checkout_observations SELECT gen_random_uuid(),NOW(),'data','application','validation',false,'unknown','{}','[]' FROM generate_series(1,5001)");
      await observer.query("INSERT INTO mysteryhub_operations.checkout_observations VALUES(gen_random_uuid(),NOW()-interval '2 days','data','services','timeout',true,'headers','{}','[]')");
      await observer.query("INSERT INTO mysteryhub_operations.checkout_incidents SELECT gen_random_uuid(),'data','catalog','timeout',NOW()-interval '2 days',NOW()-interval '2 days',3,3,NULL,NULL,NOW()-interval '1 day' FROM generate_series(1,105)");
      await observer.query("INSERT INTO mysteryhub_operations.checkout_incidents VALUES(gen_random_uuid(),'airtime','services','timeout',NOW()-interval '100 days',NOW()-interval '100 days',3,3,NULL,NULL,NULL)");
      await Store.save([],Date.now());
      assert.equal(Number((await observer.query('SELECT count(*) FROM mysteryhub_operations.checkout_observations')).rows[0].count),5000);
      assert.equal(Number((await observer.query('SELECT count(*) FROM mysteryhub_operations.checkout_incidents')).rows[0].count),100);
      assert.equal(Number((await observer.query("SELECT count(*) FROM mysteryhub_operations.checkout_incidents WHERE last_failure_at<NOW()-interval '90 days'")).rows[0].count),0);
      const state=await Store.read();const view=salesView(state.observations,state.incidents,Date.now(),'durable',{pending:0,dropped:0,writeFailed:false,lastPersistedAt:null,since:now});assert.notEqual(view.state,'healthy');
    });
  }finally{await getPool()?.end();await observer.end();delete process.env.DATABASE_URL;delete process.env.DATABASE_SSL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;}
});
