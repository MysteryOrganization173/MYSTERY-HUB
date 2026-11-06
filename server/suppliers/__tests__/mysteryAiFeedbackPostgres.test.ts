import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import express from 'express';
import pg from 'pg';
import {initDatabase,getPool} from '../../db/connection.js';
import {mysteryAiFeedbackRouter} from '../../routes/mysteryAiFeedbackApi.js';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {hashSessionToken} from '../../utils/crypto.js';

const url=process.env.MYSTERY_AI_FEEDBACK_POSTGRES_URL;
test('private feedback: consent, redaction, repeatability, role isolation, idempotency and review', {skip:!url},async()=>{
  assert.equal(process.env.DATABASE_URL,undefined);
  assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
  assert.notEqual(new URL(url!).hostname,'fixture.invalid');
  const db=new pg.Pool({connectionString:url,ssl:false});
  let server:ReturnType<express.Express['listen']>|undefined;
  try{
    assert.equal((await db.query("SELECT to_regclass('public.users') AS name")).rows[0].name,null);
    Object.assign(process.env,{DATABASE_URL:url,DATABASE_SSL:'false',MYSTERY_TEST_DATABASE_OPT_IN:'true'});
    await initDatabase();
    assert.equal((await db.query("SELECT to_regclass('mysteryhub_ai_feedback_private.reports') AS name")).rows[0].name,null);
    const sql=readFileSync('server/db/mysteryAiFeedback.sql','utf8');
    await db.query(sql);await db.query(sql);
    const privileges=await db.query("SELECT relrowsecurity AS rls,has_table_privilege('anon',oid,'SELECT') OR has_table_privilege('authenticated',oid,'SELECT') OR has_table_privilege('service_role',oid,'SELECT') AS exposed FROM pg_class WHERE oid='mysteryhub_ai_feedback_private.reports'::regclass");
    assert.deepEqual(privileges.rows[0],{rls:true,exposed:false});
    for(const [id,role] of [['customer','customer'],['other','customer'],['staff','admin']]){
      await db.query('INSERT INTO users(id,name,password_hash,role) VALUES($1,$1,$2,$3)',[id,'fixture',role]);
      await db.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$1,$2,now()+interval '1 hour')",[id,hashSessionToken('token-'+id)]);
    }
    const app=express();app.use(express.json());app.use('/feedback',mysteryAiFeedbackRouter);
    server=await new Promise<ReturnType<express.Express['listen']>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    const address=server.address();assert.ok(address&&typeof address==='object');
    const base=`http://127.0.0.1:${address.port}/feedback`;
    const req=(user:string|null,path='',method='GET',body?:unknown)=>fetch(base+path,{method,headers:{...(user?{Authorization:'Bearer token-'+user}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    const post=(body:unknown,user:string|null='customer')=>req(user,'','POST',body);
    const noShare={reference:randomUUID(),category:'inaccurate',note:'Wrong service.\nOTP: 1234\nMy PIN 3456',shareAnswer:false};
    assert.equal((await post(noShare,null)).status,401);
    assert.equal((await post(noShare,'staff')).status,403);
    assert.equal((await post({...noShare,answer:'Not authorized'})).status,400);
    assert.equal((await post({...noShare,history:['not allowed']})).status,400);
    assert.equal((await post({...noShare,category:'__proto__'})).status,400);
    assert.equal((await post({...noShare,shareAnswer:true,answer:'x'.repeat(2001)})).status,400);
    const duplicate=await Promise.all([post(noShare),post(noShare)]);
    assert.ok(duplicate.every(r=>r.status===200));
    assert.equal((await post({...noShare,note:'Changed'})).status,409);
    assert.equal((await post(noShare,'other')).status,409);
    const shared={reference:randomUUID(),category:'broken_action',shareAnswer:true,answer:'Synthetic answer.\nPIN: 1234\n024.123.4567'};
    assert.equal((await post(shared)).status,200);
    assert.equal((await req('customer','/admin')).status,403);
    assert.equal((await req('customer','/admin/'+shared.reference,'PATCH',{status:'reviewed'})).status,403);
    const listing=await req('staff','/admin');assert.equal(listing.headers.get('cache-control'),'no-store');
    const {reports}=await listing.json();
    assert.equal(reports.length,2);
    assert.equal(reports.find((row:any)=>row.reference===noShare.reference).answer,null);
    assert.equal(reports.find((row:any)=>row.reference===noShare.reference).note,'Wrong service.\n[sensitive text hidden]\n[sensitive text hidden]');
    assert.equal(reports.find((row:any)=>row.reference===shared.reference).answer,'Synthetic answer.\n[sensitive text hidden]\n[number hidden]');
    assert.ok(reports.every((row:any)=>!('author_id' in row)&&!('history' in row)));
    assert.equal((await req('staff','/admin/'+shared.reference,'PATCH',{status:'reviewed'})).status,200);
    assert.equal((await (await req('staff','/admin')).json()).reports.length,1);
    assert.equal((await (await req('staff','/admin?status=reviewed')).json()).reports.length,1);
    for(let i=0;i<3;i++)assert.equal((await post({...noShare,reference:randomUUID()})).status,200);
    assert.equal((await post({...noShare,reference:randomUUID()})).status,429);
  }finally{
    server?.closeAllConnections();
    if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));
    await getPool()?.end();await db.end();
  }
});
