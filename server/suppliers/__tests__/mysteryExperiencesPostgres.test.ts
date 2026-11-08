import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import express from 'express';
import pg from 'pg';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {initDatabase,getPool} from '../../db/connection.js';
import {ExperienceStore,abuseIdentity} from '../../db/experienceStore.js';
import {ExperienceService} from '../../services/experienceService.js';
import {greetingInput} from '../../services/experienceValidation.js';
import {AuthStore} from '../../db/authStore.js';
import {AdminAuditStore} from '../../db/adminAuditStore.js';
import {experienceRouter,adminExperienceRouter} from '../../routes/experienceApi.js';
import {createPublicHtmlRouter} from '../../routes/publicHtml.js';
const url=process.env.MYSTERY_EXPERIENCES_POSTGRES_URL;
const token=()=>randomBytes(32).toString('base64url');
const payload=()=>({occasion:'christmas-2026',recipientName:'Synthetic Ama',showSender:false,senderName:'HIDDEN IDENTITY',message:'A joyful Christmas to you and your family.',variant:'gift-classic-v1',creatorToken:token(),idempotencyKey:randomUUID()});
test('Experiences native PostgreSQL, HTTP and raw HTML — isolated only',{skip:!url},async t=>{
 assert.equal(process.env.DATABASE_URL,undefined);assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
 Object.assign(process.env,{NODE_ENV:'test',DATABASE_URL:url,DATABASE_SSL:'false',MYSTERY_TEST_DATABASE_OPT_IN:'true',MYSTERY_EXPERIENCES_ENABLED:'false',MYSTERY_GREETING_LINKS_ENABLED:'true',MYSTERY_GREETINGS_ENABLED:'true',EXPERIENCES_ABUSE_SECRET:'c'.repeat(64)});
 const db=new pg.Pool({connectionString:url,ssl:false});
 assert.equal(Number((await db.query("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'")).rows[0].count),0,'Requires an empty disposable database');
 const dir=mkdtempSync(join(tmpdir(),'experience-native-'));writeFileSync(join(dir,'index.html'),'<html><head><title>Test</title></head><body><div id="root"></div></body></html>');
 const app=express();app.use('/api/experiences',experienceRouter);app.use('/api/admin/experiences',adminExperienceRouter);app.use(createPublicHtmlRouter(dir));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
 const json=(body:unknown,auth?:string)=>({method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:auth}:{})},body:JSON.stringify(body)});
 const create=async(body=payload(),peer=token(),analytics=true)=>{const v=greetingInput(body);return ExperienceStore.create(v.value,v.creatorToken,v.idempotencyKey,peer,analytics);};
 let first:any,firstInput=payload();
 try{
  await initDatabase();
  await t.test('startup leaves optional schema absent and failure is safe',async()=>{
   assert.equal((await db.query("SELECT to_regclass('mysteryhub_experiences.configuration') value")).rows[0].value,null);
   const response=await fetch(base+'/api/experiences/greetings',json(payload()));assert.equal(response.status,503);assert.doesNotMatch(JSON.stringify(await response.json()),/postgres|password|SQL/i);
  });
  const schema=readFileSync('server/db/mysteryExperiences.sql','utf8');
  await t.test('failed schema installation rolls back the entire optional namespace',async()=>{
   await assert.rejects(db.query(schema.replace('COMMIT;','SELECT 1/0; COMMIT;')));await db.query('ROLLBACK');
   assert.equal((await db.query("SELECT to_regclass('mysteryhub_experiences.configuration') value")).rows[0].value,null);
  });
  await db.query(schema);await db.query(schema);
  await AuthStore.createUser({id:'exp-admin',name:'Synthetic Admin',email:null,phone:null,passwordHash:'fixture',role:'admin'});await AuthStore.createSession('exp-admin','synthetic-admin');
  await AuthStore.createUser({id:'exp-customer',name:'Synthetic Customer',email:null,phone:null,passwordHash:'fixture',role:'customer'});await AuthStore.createSession('exp-customer','synthetic-customer');
  await t.test('RLS/grants protect every private table and all DML operations',async()=>{
   const tables=(await db.query("SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='mysteryhub_experiences' AND c.relkind='r'")).rows;assert.equal(tables.length,4);assert.ok(tables.every(t=>t.relrowsecurity));assert.equal((await db.query("SELECT has_schema_privilege('service_role','mysteryhub_experiences','USAGE') access")).rows[0].access,false);
   for(const role of ['anon','authenticated'])for(const table of tables)for(const sql of [`SELECT * FROM mysteryhub_experiences.${table.relname}`,`DELETE FROM mysteryhub_experiences.${table.relname}`,`UPDATE mysteryhub_experiences.${table.relname} SET ${table.relname==='configuration'?'revision=1':table.relname==='greetings'?"message='nope'":table.relname==='budgets'?'hits=1':"reason='spam'"}`,`INSERT INTO mysteryhub_experiences.${table.relname} DEFAULT VALUES`]){
    await db.query('BEGIN');try{await db.query(`SET LOCAL ROLE ${role}`);await assert.rejects(db.query(sql),(e:any)=>e.code==='42501');}finally{await db.query('ROLLBACK');}
   }
  });
  await t.test('malformed and oversized personal bodies return sanitized JSON without logging content',async()=>{
   const response=await fetch(base+'/api/experiences/greetings',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"message":"PRIVATE_PARSE_FIXTURE" nope'});assert.equal(response.status,400);assert.doesNotMatch(await response.text(),/PRIVATE_PARSE_FIXTURE|SyntaxError/);
   const large=await fetch(base+'/api/experiences/greetings',json({message:'PRIVATE'.repeat(2000)}));assert.equal(large.status,413);assert.doesNotMatch(await large.text(),/PRIVATE/);
  });
  await t.test('Admin auth/preview/configuration uses optimistic concurrency and atomic audit',async()=>{
   const endpoint=base+'/api/admin/experiences';
   assert.equal((await fetch(endpoint+'/preview',json({phase:'christmas_day'}))).status,401);
   assert.equal((await fetch(endpoint+'/preview',json({phase:'christmas_day'},'Bearer synthetic-customer'))).status,403);
   const preview=await fetch(endpoint+'/preview',json({phase:'christmas_day'},'Bearer synthetic-admin'));assert.equal(preview.status,200);assert.equal((await preview.json()).preview,true);assert.equal((await ExperienceStore.configuration()).enabled,false);
   for(const authorization of [undefined,'Bearer synthetic-customer']){
    const rejected=await fetch(endpoint+'/configuration',{...json({}),method:'PUT',headers:{'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})}});assert.equal(rejected.status,authorization?403:401);
   }
   const initial=await ExperienceStore.configuration();
   const configured=await fetch(endpoint+'/configuration',{...json({expectedRevision:initial.revision,lifecycle:'draft',enabled:false,previewEnabled:true,override:null},'Bearer synthetic-admin'),method:'PUT'});assert.equal(configured.status,200);
   const old=await ExperienceStore.configuration();const update={expectedRevision:old.revision,lifecycle:'approved',enabled:true,previewEnabled:true,override:null};
   const results=await Promise.allSettled([ExperienceStore.configure('exp-admin',update),ExperienceStore.configure('exp-admin',update)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.code,'REVISION_CONFLICT');
   assert.equal((await ExperienceStore.audit()).length,2);
   const config=await ExperienceStore.configuration();const failure=mock.method(AdminAuditStore,'record',async()=>{throw Error('synthetic audit failure');});
   await assert.rejects(ExperienceStore.configure('exp-admin',{...update,expectedRevision:config.revision,enabled:false}));failure.mock.restore();assert.equal((await ExperienceStore.configuration()).revision,config.revision);
   assert.equal((await ExperienceService.state(new Date('2026-12-25'))).active,false,'deployment gate is independent');
   process.env.MYSTERY_EXPERIENCES_ENABLED='true';assert.equal((await ExperienceService.state(new Date('2026-12-25'))).phase,'christmas_day');
   const reads=await Promise.all(Array.from({length:10},()=>ExperienceStore.configuration()));assert.ok(reads.every(c=>c.revision===config.revision));
  });
  await t.test('anonymous creation commits before success; another client opens a real link without any local state',async()=>{
   const response=await fetch(base+'/api/experiences/greetings',json(firstInput));assert.equal(response.status,201);first=await response.json();assert.match(first.url,/^https:\/\/mysterybundlehub.com\/g\/[A-Za-z0-9_-]{24}$/);
   const secondClient=await fetch(base+'/api/experiences/greetings/'+first.shareId);assert.equal(secondClient.status,200);const body=await secondClient.json();assert.equal(body.message,firstInput.message);assert.equal(body.senderName,null);assert.doesNotMatch(JSON.stringify(body),/creator|HIDDEN|payload_hash|idempotency|reporter/);
   const stored=(await db.query('SELECT creator_hash,sender_name FROM mysteryhub_experiences.greetings WHERE share_id=$1',[first.shareId])).rows[0];assert.notEqual(stored.creator_hash,firstInput.creatorToken);assert.equal(stored.sender_name,null);
  });
  await t.test('lost-response retries, conflicting content and concurrent retries cannot duplicate greetings',async()=>{
   const replay=await fetch(base+'/api/experiences/greetings',json(firstInput));assert.equal(replay.status,200);assert.equal((await replay.json()).shareId,first.shareId);
   assert.equal((await fetch(base+'/api/experiences/greetings',json({...firstInput,message:'A different greeting message.'}))).status,409);
   const body=payload();const results=await Promise.all([create(body,'concurrent'),create(body,'concurrent')]);assert.equal(results[0].greeting.shareId,results[1].greeting.shareId);assert.equal(results.filter(r=>!r.duplicate).length,1);
   const beforeReplay=Number((await db.query("SELECT hits FROM mysteryhub_experiences.budgets WHERE scope='create-request:concurrent'")).rows[0].hits);
   await create(body,'concurrent');
   assert.equal(Number((await db.query("SELECT hits FROM mysteryhub_experiences.budgets WHERE scope='create-request:concurrent'")).rows[0].hits),beforeReplay+1);
   const records=await db.query('SELECT count(*)::int n FROM mysteryhub_experiences.greetings WHERE creator_hash=$1 AND idempotency_key=$2',[ (await import('node:crypto')).createHash('sha256').update(body.creatorToken).digest('hex'),body.idempotencyKey]);assert.equal(records.rows[0].n,1);
  });
  await t.test('a fresh process reads persisted configuration/greeting and shares global admission',async()=>{
   const run=(script:string)=>execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env},encoding:'utf8'});
   const imports=`import {ExperienceStore} from './server/db/experienceStore.ts';import {getPool} from './server/db/connection.ts';`;
   assert.match(run(imports+`const c=await ExperienceStore.configuration();const g=await ExperienceStore.greeting('${first.shareId}');if(c.revision<2||g.shareId!=='${first.shareId}')throw Error('Not persisted');await getPool().end();console.log('PERSISTED');`),/PERSISTED/);
   await db.query("UPDATE mysteryhub_experiences.budgets SET hits=60000 WHERE scope='read:global'");
   assert.match(run(imports+`try{await ExperienceStore.greeting('${first.shareId}');throw Error('Quota bypassed');}catch(e){if(e.status!==429)throw e;}finally{await getPool().end();}console.log('DURABLE_LIMIT');`),/DURABLE_LIMIT/);
   await db.query("UPDATE mysteryhub_experiences.budgets SET hits=100 WHERE scope='read:global'");
  });
  await t.test('failed COMMIT never grants local read credits; read-only traffic prunes expired budgets',async()=>{
   const pool=getPool()!,connect=pool.connect.bind(pool);let fail=true,reservations=0;
   (ExperienceStore as any).reads={remaining:0,until:0,flight:null};
   const wrap=mock.method(pool,'connect',async()=>{const client=await connect();return {query:async(sql:string,values?:any[])=>{if(values?.[0]==='read:global')reservations++;if(sql==='COMMIT'&&fail){fail=false;throw Error('synthetic commit failure');}return client.query(sql,values);},release:()=>client.release()};});
   try{await assert.rejects(ExperienceStore.exists(first.shareId));assert.equal((ExperienceStore as any).reads.remaining,0);assert.equal(await ExperienceStore.exists(first.shareId),true);assert.equal(reservations,2);}finally{wrap.mock.restore();}
   await db.query("INSERT INTO mysteryhub_experiences.budgets(scope,bucket,hits) VALUES('old-fixture',now()-interval '3 days',1)");
   (ExperienceStore as any).reads={remaining:0,until:0,flight:null};await ExperienceStore.exists(first.shareId);
   assert.equal((await db.query("SELECT count(*)::int n FROM mysteryhub_experiences.budgets WHERE scope='old-fixture'")).rows[0].n,0);
  });
  await t.test('share collisions retry safely; repeated identical content with changed key is rejected',async()=>{
   const body=payload(),v=greetingInput(body);let calls=0;const result=await ExperienceStore.create(v.value,v.creatorToken,v.idempotencyKey,'collision',true,()=>++calls===1?first.shareId:randomBytes(18).toString('base64url'));assert.equal(calls,2);assert.notEqual(result.greeting.shareId,first.shareId);
   await assert.rejects(create({...body,idempotencyKey:randomUUID()},'collision'),(e:any)=>e.code==='DUPLICATE_CONTENT');
  });
  await t.test('privacy preferences suppress parent attribution and optional analytics failure never loses a greeting',async()=>{
   const body={...payload(),parentShareId:first.shareId};const result=await ExperienceService.create(body,'privacy',false);const row=(await db.query('SELECT parent_id FROM mysteryhub_experiences.greetings WHERE share_id=$1',[result.shareId])).rows[0];assert.equal(row.parent_id,null);
   await db.query('ALTER TABLE analytics_events RENAME TO analytics_events_temporarily_unavailable');
   try{const result=await create(payload(),'analytics-down');assert.ok(result.greeting.shareId);}finally{await db.query('ALTER TABLE analytics_events_temporarily_unavailable RENAME TO analytics_events');}
  });
  await t.test('raw crawler HTML has real metadata and never changes engagement totals',async()=>{
   const count=async()=>Number((await db.query("SELECT count(*) FROM analytics_events WHERE entity_type='experience'")).rows[0].count);const before=await count();
   const response=await fetch(base+'/g/'+first.shareId,{headers:{'User-Agent':'WhatsApp/2.0'}});const html=await response.text();assert.equal(response.status,200);assert.match(html,/og:image/);assert.ok(html.includes(first.url));assert.doesNotMatch(html,/Synthetic Ama|A joyful|HIDDEN/);assert.match(response.headers.get('x-robots-tag')!,/noindex/);assert.equal(await count(),before);
  });
  await t.test('events deduplicate, reject PII/financial claims, and skip crawlers/privacy opt-outs',async()=>{
   const body={event:'greeting_open',shareId:first.shareId,visitorId:randomUUID(),sessionId:randomUUID()};
   const response=await fetch(base+'/api/experiences/events',json(body));assert.equal(response.status,200);assert.equal((await response.json()).duplicate,false);assert.equal((await (await fetch(base+'/api/experiences/events',json(body))).json()).duplicate,true);
   for(const headers of ([{'User-Agent':'facebookexternalhit'},{DNT:'1'},{'Sec-GPC':'1'},{Purpose:'prefetch'}] as Record<string,string>[])){const response=await fetch(base+'/api/experiences/events',{...json({...body,sessionId:randomUUID()}),headers:{'Content-Type':'application/json',...headers}});assert.equal((await response.json()).accepted,false);}
   assert.equal((await fetch(base+'/api/experiences/events',json({...body,message:'PRIVATE'}))).status,400);
   assert.equal((await fetch(base+'/api/experiences/events',json({...body,event:'paid_order'}))).status,400);
   const report=await ExperienceStore.metrics();assert.ok(report.created>0);assert.equal(report.conversions,null);assert.doesNotMatch(JSON.stringify(report),/Synthetic Ama|HIDDEN|A joyful/);
  });
  await t.test('creator revocation requires an independent secret and is idempotent; old links remain after Jan6',async()=>{
   assert.equal((await fetch(base+'/api/experiences/greetings/'+first.shareId+'/revoke',json({},'Greeting '+token()))).status,404);
   assert.equal((await fetch(base+'/api/experiences/greetings/'+first.shareId)).status,200);
   const now=Date.now();const clock=mock.method(Date,'now',()=>Date.parse('2027-01-10T00:00:00Z'));
   assert.equal((await ExperienceService.greeting(first.shareId)).shareId,first.shareId);clock.mock.restore();assert.ok(now);
   for(let i=0;i<2;i++)assert.equal((await fetch(base+'/api/experiences/greetings/'+first.shareId+'/revoke',json({},'Greeting '+firstInput.creatorToken))).status,200);
   assert.equal((await fetch(base+'/api/experiences/greetings/'+first.shareId)).status,404);assert.equal((await fetch(base+'/g/'+first.shareId)).status,404);
  });
  await t.test('expired greetings, reporting caps and Admin moderation work without exposing content',async()=>{
   const result=await create();const share=result.greeting.shareId;
   for(let i=0;i<10;i++)await ExperienceStore.report(share,'report-peer','spam');await assert.rejects(ExperienceStore.report(share,'report-peer','spam'),(e:any)=>e.status===429);
   assert.equal((await ExperienceStore.reports()).find(r=>r.share_id===share).reports,1);
   await ExperienceStore.moderate('exp-admin',share);await assert.rejects(ExperienceStore.greeting(share),(e:any)=>e.status===404);
   const expired=await create();await db.query("UPDATE mysteryhub_experiences.greetings SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE share_id=$1",[expired.greeting.shareId]);await assert.rejects(ExperienceStore.greeting(expired.greeting.shareId),(e:any)=>e.status===404);
  });
  await t.test('failed management attempts and repeated replays consume durable request budgets',async()=>{
   for(let i=0;i<60;i++)await assert.rejects(ExperienceStore.revoke(first.shareId,token(),'bad-manager'),(e:any)=>e.status===404);
   await assert.rejects(ExperienceStore.revoke(first.shareId,token(),'bad-manager'),(e:any)=>e.status===429);
   const hits=(await db.query("SELECT hits FROM mysteryhub_experiences.budgets WHERE scope='manage-request:bad-manager'")).rows[0].hits;assert.equal(hits,60);
  });
  await t.test('retention is bounded, audited and rollback-safe; no financial/order records were created',async()=>{
   const old=await create();await db.query("UPDATE mysteryhub_experiences.greetings SET created_at=now()-interval '400 days',expires_at=now()-interval '35 days' WHERE share_id=$1",[old.greeting.shareId]);
   await assert.rejects(create(),(e:any)=>e.code==='RETENTION_REQUIRED');
   const cleanup=await ExperienceStore.maintenance('exp-admin');assert.ok(cleanup.greetings!>=1);assert.equal((await db.query('SELECT count(*)::int n FROM orders')).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM finance_ledger')).rows[0].n,0);
   const plan=(await db.query("EXPLAIN SELECT share_id FROM mysteryhub_experiences.greetings WHERE share_id=$1",[first.shareId])).rows.map(r=>r['QUERY PLAN']).join(' ');assert.ok(plan);
  });
 }finally{mock.restoreAll();await new Promise<void>(r=>server.close(()=>r()));rmSync(dir,{recursive:true});await db.end();await getPool()?.end();}
});
