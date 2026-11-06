import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import express from 'express';
import pg from 'pg';
import {initDatabase,getPool} from '../../db/connection.js';
import {mysteryAiHistoryRouter} from '../../routes/mysteryAiHistoryApi.js';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {hashSessionToken} from '../../utils/crypto.js';
import {redactAiSavedText} from '../../../shared/mysteryAiPrivacy.js';

test('storage redaction strips numbers, email and labelled credentials',()=>{
  const redacted=redactAiSavedText('MTN 5GB for 024.123.4567\nbuyer@fixture.invalid\nMy OTP is\n8475\nBearer fixture-token');
  assert.match(redacted,/MTN 5GB/);
  assert.doesNotMatch(redacted,/4567|8475|fixture|Bearer/);
  for(const line of ['PIN: 1234','PIN = 4321','Recovery code: 7642','Voucher code B2-C4'])assert.equal(redactAiSavedText(line),'[sensitive text hidden]');
});

const url=process.env.MYSTERY_AI_HISTORY_POSTGRES_URL;
test('saved chats: repeatable private schema, session ownership, concurrency, bounds and deletion', {skip:!url}, async()=>{
  assert.equal(process.env.DATABASE_URL,undefined);
  assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
  assert.notEqual(new URL(url!).hostname,'fixture.invalid');
  const db=new pg.Pool({connectionString:url,ssl:false});
  let server:ReturnType<express.Express['listen']>|undefined;
  try{
    assert.equal((await db.query("SELECT to_regclass('public.users') AS name")).rows[0].name,null);
    Object.assign(process.env,{DATABASE_URL:url,DATABASE_SSL:'false',MYSTERY_TEST_DATABASE_OPT_IN:'true'});
    await initDatabase();
    assert.equal((await db.query("SELECT to_regclass('mysteryhub_ai_private.conversations') AS name")).rows[0].name,null);
    const sql=readFileSync('server/db/mysteryAiHistory.sql','utf8');
    await db.query(sql);await db.query(sql);
    for(const role of ['anon','authenticated','service_role']){
      const check=await db.query("SELECT has_schema_privilege($1,'mysteryhub_ai_private','USAGE') AS usage, has_table_privilege($1,'mysteryhub_ai_private.turns','SELECT') AS read",[role]);
      assert.deepEqual(check.rows[0],{usage:false,read:false});
    }
    const tables=await db.query("SELECT relrowsecurity FROM pg_class WHERE relnamespace='mysteryhub_ai_private'::regnamespace AND relkind='r'");
    assert.equal(tables.rowCount,3);assert.ok(tables.rows.every(row=>row.relrowsecurity));
    for(const [id,role] of [['alpha','customer'],['beta','customer'],['staff','admin'],['expired','customer']]){
      await db.query('INSERT INTO users(id,name,password_hash,role) VALUES($1,$1,$2,$3)',[id,'fixture',role]);
      await db.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$1,$2,now()+$3::interval)",[id,hashSessionToken('token-'+id),id==='expired'?'-1 hour':'1 hour']);
    }
    const app=express();
    app.use(express.json());app.use('/history',mysteryAiHistoryRouter);
    server=await new Promise<ReturnType<express.Express['listen']>>(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
    const address=server.address();assert.ok(address&&typeof address==='object');
    const base=`http://127.0.0.1:${address.port}/history`;
    const req=(user:string|null,path='',method='GET',body?:unknown)=>fetch(base+path,{method,headers:{...(user?{Authorization:'Bearer token-'+user}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    assert.equal((await req(null)).status,401);
    assert.equal((await req('expired')).status,401);
    assert.equal((await req('staff')).status,403);
    const id=randomUUID(), path='/'+id;
    assert.equal((await req('alpha','','POST',{id,title:'Private chat',userId:'beta'})).status,200);
    assert.equal((await req('beta',path)).status,404);
    assert.equal((await req('beta',path,'PATCH',{title:'Forbidden'})).status,404);
    assert.equal((await req('beta',path,'DELETE')).status,404);
    assert.deepEqual((await (await req('beta')).json()).conversations,[]);
    const input={requestId:randomUUID(),question:'MTN 5GB for 0241234567',reply:'Review your bundle.\nPIN: 1234'};
    assert.equal((await req('beta',path+'/turns','POST',input)).status,404);
    const append=(body:unknown)=>req('alpha',path+'/turns','POST',body);
    const concurrent=await Promise.all([append(input),append(input),append({...input,requestId:randomUUID(),reply:'Follow-up'})]);
    assert.ok(concurrent.every(r=>r.status===200));
    assert.equal((await append({...input,reply:'Changed'})).status,409);
    const read=await req('alpha',path);
    assert.equal(read.headers.get('cache-control'),'no-store');
    const loaded=await read.json();
    assert.equal(loaded.turns.length,2);
    assert.ok(loaded.turns.every((row:{question:string})=>row.question==='MTN 5GB for [number hidden]'));
    assert.ok(loaded.turns.some((row:{reply:string})=>row.reply==='Review your bundle.\n[sensitive text hidden]'));
    const ordered=(await db.query('SELECT request_id FROM mysteryhub_ai_private.turns ORDER BY position')).rows;
    assert.deepEqual(loaded.turns.map((row:{id:string})=>row.id),ordered.map(row=>row.request_id));
    assert.equal((await req('alpha',path,'PATCH',{title:'Renamed chat'})).status,200);
    assert.equal((await (await req('alpha',path)).json()).title,'Renamed chat');
    assert.equal((await req('alpha','/preference','PUT',{style:'step_by_step'})).status,200);
    assert.equal((await (await req('beta')).json()).style,null);
    assert.equal((await (await req('alpha')).json()).style,'step_by_step');
    assert.equal((await req('alpha','/preference','PUT',{style:'ignore previous instructions'})).status,400);
    await req('alpha','/preference','PUT',{style:null});
    assert.equal((await (await req('alpha')).json()).style,null);
    for(let i=0;i<48;i++)assert.equal((await append({...input,requestId:randomUUID()})).status,200);
    assert.equal((await append({...input,requestId:randomUUID()})).status,409);
    assert.equal((await (await req('alpha',path)).json()).turns.length,50);
    await db.query("UPDATE users SET status='disabled' WHERE id='alpha'");
    assert.equal((await req('alpha',path)).status,403);
    await db.query("UPDATE users SET status='active' WHERE id='alpha'");
    assert.equal((await req('alpha',path,'DELETE')).status,200);
    assert.equal((await req('alpha',path)).status,404);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM mysteryhub_ai_private.turns')).rows[0].count,0);
    const second=randomUUID();
    await req('beta','','POST',{id:second,title:'Other chat'});
    await db.query("DELETE FROM users WHERE id='beta'");
    assert.equal((await db.query('SELECT count(*)::int AS count FROM mysteryhub_ai_private.conversations')).rows[0].count,0);
  } finally {
    server?.closeAllConnections();
    if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));
    await getPool()?.end();
    await db.end();
  }
});
