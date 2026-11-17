import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {getPool,initDatabase} from '../../db/connection.js';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {AuthStore} from '../../db/authStore.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {AdminAuditStore} from '../../db/adminAuditStore.js';
import {SmsPermissions} from '../../sms/permissions.js';
import {arkeselConfig,ArkeselClient,signingFingerprint} from '../../sms/arkesel.js';
import {smsTick} from '../../sms/worker.js';
import {applyReport,SmsService} from '../../sms/service.js';
import {resolveAudience,validateChannelUrl,suppressedNumbers} from '../../sms/policy.js';
import {smsTransaction} from '../../sms/store.js';
import {reconcileSms} from '../../sms/worker.js';
import {contactUser,contactOrder} from './fixtures/contactHub.js';

test('channel URL requires explicit confirmation and a canonical WhatsApp channel',()=>{
 const good='https://whatsapp.com/channel/0029SyntheticChannel';
 assert.equal(validateChannelUrl(good,true),good);
 for(const u of ['https://evil.test/channel/0029SyntheticChannel',good+'?redirect=evil','http://whatsapp.com/channel/0029SyntheticChannel','https://user@whatsapp.com/channel/0029SyntheticChannel'])assert.throws(()=>validateChannelUrl(u,true));
 assert.throws(()=>validateChannelUrl(good,false));
});

const url=process.env.MYSTERY_SMS_V2_POSTGRES_URL;
test('native SMS V2: external consent, direct-source isolation and delivery fairness',{skip:!url},async t=>{
 assert.equal(process.env.DATABASE_URL,undefined);assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
 const saved={...process.env},observer=new pg.Pool({connectionString:url,ssl:false});
 try{
  assert.equal((await observer.query("SELECT to_regclass('public.users') AS t")).rows[0].t,null);
  Object.assign(process.env,{NODE_ENV:'test',DATABASE_URL:url,DATABASE_SSL:'false',MYSTERY_TEST_DATABASE_OPT_IN:'true'});await initDatabase();const db=getPool()!;
  await db.query(readFileSync('server/db/smsCommunicationsV1.sql','utf8'));
  const admin='v2-admin',buyer='v2-buyer',recipient='+233241234567',reseller='+233201234567';
  for(const u of [contactUser(admin,{role:'admin'}),contactUser(buyer,{phone:'0591234567'})])await AuthStore.createUser({id:u.id,name:u.name,email:u.email,phone:u.phone,passwordHash:'synthetic',role:u.role});
  await AuthStore.createSession(admin,'v2-admin-session');
  await OrdersStore.createOrder(contactOrder(buyer,0,{recipient_phone:recipient}));
  await OrdersStore.createOrder(contactOrder(null,0,{recipient_phone:recipient}));
  await OrdersStore.createOrder(contactOrder(null,0,{recipient_phone:reseller,store_context:{channel:'website_store',siteId:'synthetic-site',ownerId:buyer} as any}));
  const base={filters:{source:'registered'},purpose:'marketing',source:'previously_obtained',evidence:'Permission obtained in an existing support conversation',obtainedAt:'2026-11-01T12:00:00Z',granted:true};
  const grant=async(extra:any={})=>{const p=await SmsPermissions.preview(admin,{...base,...extra});const requestId=randomUUID();await SmsPermissions.confirm(admin,{reviewId:p.id,requestId,confirmed:true});return {p,requestId};};
  const audience=(extra:any={})=>smsTransaction(c=>resolveAudience(c,{filters:{source:'registered'},purpose:'marketing',templateId:'return',templateVersion:1,...extra}));
  await t.test('V1 remains usable without V2; reviewed migration is repeatable and private',async()=>{
   assert.equal((await SmsService.readiness()).permissionManagementInstalled,false);
   await assert.rejects(()=>SmsPermissions.preview(admin,base),/migration/);
   await db.query(readFileSync('server/db/smsPermissionsV2.sql','utf8'));await db.query(readFileSync('server/db/smsPermissionsV2.sql','utf8'));
   assert.equal((await SmsService.readiness()).permissionManagementInstalled,true);assert.equal((await SmsService.readiness()).paused,true);assert.equal((await SmsService.readiness()).autoEnabled,false);
   const c=await db.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE anon');await assert.rejects(()=>c.query('SELECT * FROM mysteryhub_sms.permission_records'),/permission denied/);}finally{await c.query('ROLLBACK');c.release();}
  });
  await t.test('a changed credential during a credit check cannot stamp an old response as current',async()=>{
   const old=ArkeselClient.prototype.balance,key=process.env.ARKESEL_API_KEY;
   ArkeselClient.prototype.balance=async()=>{process.env.ARKESEL_API_KEY='changed-synthetic-read-key';return {smsCredits:9999,mainBalance:'GHS 0.00',observedAt:new Date().toISOString()};};
   try{await assert.rejects(()=>SmsService.balance(),/configuration changed/);assert.equal((await SmsService.readiness()).balanceAt,null);}finally{ArkeselClient.prototype.balance=old;if(key===undefined)delete process.env.ARKESEL_API_KEY;else process.env.ARKESEL_API_KEY=key;}
  });
  await t.test('Admin attestation recognizes prior permission despite push withdrawal; retries are idempotent',async()=>{
   await db.query('INSERT INTO mysteryhub_notifications.preferences(user_id,transactional,marketing) VALUES($1,false,false)',[buyer]);
   assert.equal((await audience()).recipients.length,0);
   const {p,requestId}=await grant();assert.equal((await audience()).recipients.length,1);
   assert.equal((await SmsPermissions.confirm(admin,{reviewId:p.id,requestId,confirmed:true})).reused,true);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM mysteryhub_sms.permission_records')).rows[0].n,1);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM mysteryhub_sms.consents')).rows[0].n,0);
   const record=(await SmsPermissions.history()).rows[0];assert.equal(record.source,'previously_obtained');assert.equal(record.actor_id,admin);assert.equal(record.purpose,'marketing');
  });
  await t.test('single-purpose website changes preserve untouched historical permission and explicit withdrawals win',async()=>{
   await SmsService.preferences(buyer,{marketing:false,transactional:true,changedPurpose:'transactional',confirmed:true});
   assert.equal((await SmsService.readPreferences(buyer)).marketing,true);assert.equal((await audience()).recipients.length,1);
   await SmsService.preferences(buyer,{marketing:false,transactional:true,changedPurpose:'marketing',confirmed:true});
   assert.equal((await audience()).recipients.length,0);assert.equal((await SmsPermissions.preview(admin,base)).unique,0);
   await SmsService.preferences(buyer,{marketing:true,transactional:true,changedPurpose:'marketing',confirmed:true});
   assert.equal((await audience()).recipients.length,1);
  });
  await t.test('direct guest/registered recipients can receive purpose grants; duplicates and reseller-only numbers are excluded',async()=>{
   const p=await SmsPermissions.preview(admin,{...base,filters:{source:'recipient'},purpose:'operational'});assert.equal(p.unique,1);
   await SmsPermissions.confirm(admin,{reviewId:p.id,requestId:randomUUID(),confirmed:true});
   const a=await audience({filters:{source:'recipient'},purpose:'operational',templateId:'maintenance'});assert.deepEqual(a.recipients.map(r=>r.phone),[recipient]);assert.equal(a.recipients[0].role,'recipient');
   const {rows}=await smsTransaction(async c=>({rows:await c.query('SELECT phone FROM mysteryhub_sms.permission_records')}));assert.ok(!rows.rows.some(r=>r.phone===reseller));
   await assert.rejects(()=>SmsPermissions.preview(admin,{...base,numbers:[reseller]}),/Unexpected/);
  });
  await t.test('confirmed relocation URL is bound to the exact message and operational permission',async()=>{
   const channelUrl='https://whatsapp.com/channel/0029SyntheticChannel';
   const input={filters:{source:'recipient'},purpose:'operational',templateId:'channel_notice',templateVersion:1,channelUrl,channelConfirmed:true};
   const a=await audience(input);assert.equal(a.recipients.length,1);assert.ok(a.body.includes(channelUrl));
   await assert.rejects(()=>audience({...input,channelConfirmed:false}),/confirm/);
   await assert.rejects(()=>audience({...input,body:'Follow https://whatsapp.com/channel/0029OtherChannel'}),/confirmed/);
   await assert.rejects(()=>audience({...input,body:'Special offer '+channelUrl}),/Promotional/);await assert.rejects(()=>audience({...input,body:channelUrl+' HTTPS://evil.example/'}),/conflicting/);
  });
  await t.test('account-bound opt-outs survive phone changes and cannot be overridden by Admin grants',async()=>{
   await SmsService.preferences(buyer,{marketing:false,transactional:true,changedPurpose:'marketing',confirmed:true});
   await db.query('UPDATE users SET phone=$1 WHERE id=$2',['0551234567',buyer]);
   assert.equal((await SmsPermissions.preview(admin,base)).unique,0);assert.equal((await audience()).recipients.length,0);
   await SmsService.preferences(buyer,{marketing:true,transactional:true,changedPurpose:'marketing',confirmed:true});assert.equal((await audience()).recipients.length,1);
  });
  await t.test('stale audience, foreign Admin, expired review and audit failures cannot save permission records',async()=>{
   let p=await SmsPermissions.preview(admin,{...base,purpose:'transactional'});
   await assert.rejects(()=>SmsPermissions.confirm('other-admin',{reviewId:p.id,requestId:randomUUID(),confirmed:true}),/unavailable/);
   await db.query("UPDATE mysteryhub_sms.previews SET expires_at=now()-interval '1 second' WHERE id=$1",[p.id]);await assert.rejects(()=>SmsPermissions.confirm(admin,{reviewId:p.id,requestId:randomUUID(),confirmed:true}),/expired/);
   p=await SmsPermissions.preview(admin,{...base,purpose:'transactional'});const record=AdminAuditStore.record;AdminAuditStore.record=async()=>{throw Error('Synthetic audit unavailable');};
   try{await assert.rejects(()=>SmsPermissions.confirm(admin,{reviewId:p.id,requestId:randomUUID(),confirmed:true}),/audit/);}finally{AdminAuditStore.record=record;}
   assert.equal((await db.query('SELECT count(*)::int AS n FROM mysteryhub_sms.permission_records WHERE review_id=$1',[p.id])).rows[0].n,0);
   await db.query("INSERT INTO waitlist(id,service_key,service_title,channel,contact,contact_normalized,user_id,status) VALUES($1,'v2-sms','Fixture','sms','0200000000','+233200000000',$2,'unsubscribed')",[randomUUID(),buyer]);
   await assert.rejects(()=>SmsPermissions.confirm(admin,{reviewId:p.id,requestId:randomUUID(),confirmed:true}),/changed/);
  });
  await t.test('reviewed channel notice requires fresh credits, queues once, submits through the adapter once and tracks delivery',async()=>{
   Object.assign(process.env,{ARKESEL_API_KEY:'synthetic-v2-key',ARKESEL_WEBHOOK_SECRET:'synthetic-v2-signing-secret',ARKESEL_SMS_ENABLED:'true',ARKESEL_WORKER_ENABLED:'true',ARKESEL_SANDBOX_MODE:'true',ARKESEL_TEST_ONLY:'false',ARKESEL_SENDER_ID:'MYSTERY HUB'});
   const ready=await SmsService.readiness();await SmsService.settings(admin,{paused:false,autoEnabled:false,recipientUpdates:false,autoTypes:[],expectedRevision:ready.settingsRevision,confirmed:true});
   const p=await SmsService.preview(admin,{filters:{source:'recipient'},purpose:'operational',templateId:'channel_notice',templateVersion:1,channelUrl:'https://whatsapp.com/channel/0029SyntheticChannel',channelConfirmed:true});assert.equal(p.unique,1);
   const confirmation={previewId:p.id,requestId:randomUUID(),confirmed:true,queue:true};
   await assert.rejects(()=>SmsService.campaign(admin,'v2-admin-session',confirmation),/credits/);
   await db.query('UPDATE mysteryhub_sms.settings SET balance=$1,last_balance_at=now() WHERE id=true',[JSON.stringify({smsCredits:10000,_configFingerprint:signingFingerprint()})]);
   const campaign=await SmsService.campaign(admin,'v2-admin-session',confirmation);assert.equal((await SmsService.campaign(admin,'v2-admin-session',confirmation)).reused,true);
   const provider=randomUUID();let submissions=0;
   const adapter=new ArkeselClient(arkeselConfig,(async(input:any,init:any)=>{assert.equal(String(input),'https://sms.arkesel.com/api/v2/sms/send');const payload=JSON.parse(init.body);assert.equal(payload.sandbox,true);assert.deepEqual(payload.recipients,[recipient.slice(1)]);assert.equal(payload.sender,'MYSTERY HUB');assert.ok(payload.message.includes('0029SyntheticChannel'));submissions++;return new Response(JSON.stringify({status:'success',data:[{id:provider,recipient:recipient.slice(1)}]}),{headers:{'content-type':'application/json'}});}) as typeof fetch);
   const api={balance:async()=>({smsCredits:10000,mainBalance:'GHS 0.00',observedAt:new Date().toISOString()}),send:adapter.send.bind(adapter)} as any;
   await smsTick(api);await smsTick(api);assert.equal(submissions,1);
   const message=(await db.query('SELECT * FROM mysteryhub_sms.messages WHERE campaign_id=$1',[campaign.id])).rows[0];assert.equal(message.state,'accepted');assert.equal(message.provider_id,provider);
   await smsTransaction(c=>applyReport(c,provider,'DELIVERED',Math.floor(Date.now()/1000),{digest:'v2-controlled-delivery',phone:recipient,segments:1}));
   assert.equal((await SmsService.history({campaignId:campaign.id,state:'delivered'})).total,1);assert.equal((await SmsService.readiness()).autoEnabled,false);
  });
  await t.test('unchanged or unavailable reports do not starve messages beyond the first20; no submission occurs',async()=>{
   const attemptsBefore=(await db.query('SELECT count(*)::int AS n FROM mysteryhub_sms.attempts')).rows[0].n;
   const ids=Array.from({length:30},()=>randomUUID()),polled:string[][]=[];
   for(const id of ids)await db.query("INSERT INTO mysteryhub_sms.messages(event_key,recipient,body,sender,sandbox,purpose,origin,state,provider_id,estimated_segments,updated_at) VALUES($1,$2,'Synthetic notice','MYSTERY HUB',true,'operational','manual','accepted',$1,1,now()-interval '1 day')",[id,recipient]);
   const api={reports:async(selected:string[])=>{polled.push(selected);return selected.map(id=>({id,status:'QUEUED',phone:recipient,segments:1}));}} as any;
   await reconcileSms(api);await reconcileSms(api);assert.equal(new Set(polled.flat()).size,30);
   await assert.rejects(()=>reconcileSms({reports:async()=>{throw Error('Synthetic report unavailable');}} as any),/unavailable/);
   await reconcileSms(api);assert.equal((await db.query('SELECT count(*)::int AS n FROM mysteryhub_sms.attempts')).rows[0].n,attemptsBefore);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM finance_ledger')).rows[0].n,0);
  });
 }finally{await getPool()?.end();await observer.end();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});
