import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createECDH} from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import express from 'express';
import webPush from 'web-push';
import {NOTIFICATION_SCHEMA} from '../../db/notificationSchema.js';
import {getPool,initDatabase} from '../../db/connection.js';
import {NotificationService as service,NOTIFICATIONS as n} from '../../services/notificationService.js';
import {processNotificationBatch} from '../../services/notificationWorker.js';
import {hashSessionToken} from '../../utils/crypto.js';
import {notificationRouter,adminNotificationRouter} from '../../routes/notificationApi.js';
import {httpAdminNotificationsClient as adminHttp} from '../../../src/services/adminNotifications.js';
import {httpCustomerNotificationsClient as customerHttp,readNotificationInbox} from '../../../src/services/customerNotifications.js';
import {httpAiDraftingClient} from '../../../src/services/adminAiDrafting.js';
import {OrderManagement} from '../../services/orderManagement.js';

test('PostgreSQL transactional notification lifecycle and operational security',{skip:process.env.MYSTERY_NOTIFICATION_PG_TEST!=='true'},async t=>{
 assert.equal(process.env.DATABASE_URL,undefined);assert.equal(process.env.NODE_ENV,'test');
 const original={...process.env};const keys=webPush.generateVAPIDKeys();Object.assign(process.env,{WEB_PUSH_ENABLED:'true',WEB_PUSH_VAPID_PUBLIC_KEY:keys.publicKey,WEB_PUSH_VAPID_PRIVATE_KEY:keys.privateKey,WEB_PUSH_VAPID_SUBJECT:'mailto:synthetic@example.test',WEB_PUSH_STORAGE_KEY:randomBytes(32).toString('base64')});
 const control=new pg.Client({host:'127.0.0.1',port:55491,user:'backend_gate',database:'postgres',ssl:false});await control.connect();const name='notifications_'+randomUUID().replaceAll('-','')+'_test';let pool:pg.Pool|null=null;
 const tokens={buyer1:'synthetic-session-one',buyer2:'synthetic-session-two',admin:'synthetic-admin-session'};
 const ec=createECDH('prime256v1');const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/SYNTHETIC-ONE',keys:{p256dh:ec.generateKeys().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
 const sender=async(_s:any,_p:string)=>{};
 try{await control.query(`CREATE DATABASE ${name}`);process.env.DATABASE_URL=`postgresql://backend_gate@127.0.0.1:55491/${name}`;process.env.DATABASE_SSL='false';process.env.MYSTERY_TEST_DATABASE_OPT_IN='true';pool=getPool()!;
 const schema=fs.readFileSync('server/db/schema.sql','utf8');assert.ok(schema.replace(/\r\n/g,'\n').includes(NOTIFICATION_SCHEMA.trim().replace(/\r\n/g,'\n')));await pool.query(schema.slice(0,schema.indexOf('CREATE SCHEMA IF NOT EXISTS mysteryhub_notifications;')));
 for(const id of ['buyer1','buyer2','admin']){await pool.query('INSERT INTO users(id,name,password_hash,role) VALUES($1,$2,\'fixture\',$3)',[id,'Synthetic '+id,id==='admin'?'admin':'customer']);await pool.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+interval '1 day')",['session-'+id,id,hashSessionToken(tokens[id as keyof typeof tokens])]);}
 const make=async(id:string,status='pending_payment',paid=false,user='buyer1',client:pg.Pool|pg.PoolClient=pool!)=>{await client.query("INSERT INTO orders(id,user_id,public_reference,customer_email,customer_phone,recipient_phone,network,product_id,product_name_snapshot,bundle_size_snapshot,amount,currency,status,payment_reference,payment_status,paid_at) VALUES($1,$2,$1,'fixture@example.test','0241111111','0241111111','telecel','fixture','Synthetic bundle','1GB',500,'GHS',$3,$4,$5,$6)",[id,user,status,'pay-'+id,paid?'success':'pending',paid?new Date().toISOString():null]);};
 await make('historical','paid',true);await pool.query(NOTIFICATION_SCHEMA);await pool.query(NOTIFICATION_SCHEMA);
 await t.test('fresh/repeated startup preserves historical orders and generates no backfill',async()=>{await initDatabase();await initDatabase();assert.equal((await pool!.query(`SELECT COUNT(*) FROM ${n}.events`)).rows[0].count,'0');assert.equal((await pool!.query("SELECT status FROM orders WHERE id='historical'")).rows[0].status,'paid');});
 let deviceId='';
 assert.equal((await service.settings()).paused,true);
 await service.setSettings('admin',{paused:false,confirmed:true,reason:'Resume isolated synthetic delivery tests'});
 await t.test('encrypted multi-device subscriptions bind to actual active sessions and reject endpoint spoofing',async()=>{
  deviceId=(await service.subscribe('buyer1',tokens.buyer1,{subscription})).deviceId;const row=(await pool!.query(`SELECT * FROM ${n}.devices WHERE id=$1`,[deviceId])).rows[0];assert.equal(row.session_id,'session-buyer1');assert.doesNotMatch(row.encrypted_subscription,/SYNTHETIC|fcm|synthetic-session/);
  await assert.rejects(()=>service.subscribe('buyer2',tokens.buyer1,{subscription}),/Sign in again/);await assert.rejects(()=>service.subscribe('buyer2',tokens.buyer2,{subscription:{...subscription,keys:{...subscription.keys,auth:randomBytes(16).toString('base64url')}}}),/ownership/);
  const second=await service.subscribe('buyer1',tokens.buyer1,{subscription:{...subscription,endpoint:'https://fcm.googleapis.com/fcm/send/SYNTHETIC-TWO'}});assert.notEqual(second.deviceId,deviceId);
 });
 await t.test('payment cannot imply delivery, duplicate updates deduplicate, supplier state is required',async()=>{
  await make('paid-order','paid',true);await pool!.query("UPDATE orders SET payment_status='success' WHERE id='paid-order'");let events=(await pool!.query(`SELECT template_id FROM ${n}.events WHERE order_id='paid-order'`)).rows;assert.deepEqual(events.map(r=>r.template_id),['payment_confirmed']);
  await pool!.query("UPDATE orders SET status='processing' WHERE id='paid-order'");assert.equal((await pool!.query(`SELECT COUNT(*) FROM ${n}.events WHERE template_id='order_processing'`)).rows[0].count,'0');
  await pool!.query("UPDATE orders SET supplier_order_id='synthetic-supplier',submitted_at=NOW(),status='submitted' WHERE id='paid-order'");await pool!.query("UPDATE orders SET status='processing' WHERE id='paid-order'");
  await pool!.query("UPDATE orders SET status='delivered',delivered_at=NOW() WHERE id='paid-order'");await pool!.query("UPDATE orders SET status='delivered' WHERE id='paid-order'");events=(await pool!.query(`SELECT template_id FROM ${n}.events WHERE order_id='paid-order' ORDER BY template_id`)).rows;
  assert.deepEqual(events.map(r=>r.template_id),['order_delivered','order_processing','payment_confirmed']);
 });
 await t.test('supplier uncertainty is only a neutral attention event, unpaid failure has no transactional push',async()=>{
  await make('uncertain','queued',true);await pool!.query("UPDATE orders SET manual_review=TRUE,failure_reason='supplier_submission_uncertain' WHERE id='uncertain'");await make('unpaid-failure','failed');
  const events=(await pool!.query(`SELECT template_id,template_snapshot FROM ${n}.events WHERE order_id='uncertain' ORDER BY template_id`)).rows;assert.deepEqual(events.map(r=>r.template_id),['delivery_attention','payment_confirmed']);assert.match(events[0].template_snapshot.body,/does not mean delivery has failed/);assert.equal((await pool!.query(`SELECT COUNT(*) FROM ${n}.events WHERE order_id='unpaid-failure'`)).rows[0].count,'0');
 });
 await t.test('order transaction rollback removes its event; separate connections see committed events only',async()=>{
  const c=await pool!.connect(),other=await pool!.connect();try{assert.notEqual((await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,(await other.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);await c.query('BEGIN');await make('rollback','paid',true,'buyer1',c);assert.equal((await other.query(`SELECT COUNT(*) FROM ${n}.events WHERE order_id='rollback'`)).rows[0].count,'0');await c.query('ROLLBACK');assert.equal((await pool!.query(`SELECT COUNT(*) FROM ${n}.events WHERE order_id='rollback'`)).rows[0].count,'0');}finally{c.release();other.release();}
 });
 await t.test('concurrent workers send each committed device event once and never change orders/ledger',async()=>{
  const before=(await pool!.query('SELECT id,status,payment_status FROM orders ORDER BY id')).rows;const sends:string[]=[];
  await Promise.all([processNotificationBatch(async(_s,payload)=>{sends.push(JSON.parse(payload).notificationId);await new Promise(r=>setTimeout(r,4));},25),processNotificationBatch(async(_s,payload)=>{sends.push(JSON.parse(payload).notificationId);},25)]);
  const accepted=Number((await pool!.query(`SELECT COUNT(*) FROM ${n}.deliveries WHERE state='provider_accepted'`)).rows[0].count);assert.equal(sends.length,accepted);assert.ok(accepted>0);assert.deepEqual((await pool!.query('SELECT id,status,payment_status FROM orders ORDER BY id')).rows,before);assert.equal((await pool!.query('SELECT COUNT(*) FROM finance_ledger')).rows[0].count,'0');
 });
 await t.test('retry is durable, provider acceptance differs from display and expired leases recover',async()=>{
  await make('retry-order','paid',true);await processNotificationBatch(async()=>{throw {statusCode:503};},1);let job=(await pool!.query(`SELECT * FROM ${n}.deliveries WHERE state='retry' LIMIT 1`)).rows[0];assert.ok(job);assert.equal(job.attempts,1);
  await pool!.query(`UPDATE ${n}.deliveries SET next_at=NOW(),lease=$2,lease_until=NOW()-interval '1 minute' WHERE id=$1`,[job.id,randomUUID()]);await processNotificationBatch(sender,25);job=(await pool!.query(`SELECT * FROM ${n}.deliveries WHERE id=$1`,[job.id])).rows[0];assert.equal(job.state,'provider_accepted');assert.equal(job.attempts,2);assert.equal((await pool!.query(`SELECT COUNT(*) FROM ${n}.attempts WHERE delivery_id=$1`,[job.id])).rows[0].count,'2');assert.match((await service.health()).deliverySemantics,/display\/viewing unconfirmed/);
 });
 await t.test('operational pause and transactional opt-out prevent queued network sends',async()=>{
  await make('paused-order','paid',true);let sent=0;
  await service.setSettings('admin',{paused:true,confirmed:true,reason:'Synthetic maintenance pause'});
  assert.deepEqual(await processNotificationBatch(async()=>{sent++;},25),{processed:0,disabled:true});
  await service.setPreferences('buyer1',{transactional:false,marketing:false});
  await service.setSettings('admin',{paused:false,confirmed:true,reason:'Synthetic maintenance resume'});
  await processNotificationBatch(async()=>{sent++;},25);assert.equal(sent,0);
  await service.setPreferences('buyer1',{transactional:true,marketing:false});
 });
 await t.test('expired sessions prevent delivery before the provider is contacted',async()=>{
  await make('expired-session-order','paid',true);await pool!.query("UPDATE sessions SET expires_at=NOW()-interval '1 minute' WHERE user_id='buyer1'");let sent=0;
  try{await processNotificationBatch(async()=>{sent++;},25);assert.equal(sent,0);}finally{await pool!.query("UPDATE sessions SET expires_at=NOW()+interval '1 day' WHERE user_id='buyer1'");}
 });
 await t.test('marketing opt-in, preview counts, immutable snapshots and idempotent confirmed sends',async()=>{
  assert.deepEqual(await service.preferences('buyer1'),{transactional:true,marketing:false});assert.equal((await service.previewAudience('admin',{templateId:'special_offer'})).eligibleDevices,0);
  await service.setPreferences('buyer1',{transactional:true,marketing:true});const preview=await service.previewAudience('admin',{templateId:'special_offer',userId:'buyer1'});assert.equal(preview.eligibleCustomers,1);assert.equal(preview.eligibleDevices,2);
  await assert.rejects(()=>service.campaign('admin',{previewId:preview.previewId,requestId:randomUUID(),confirmed:false}));const input={previewId:preview.previewId,requestId:randomUUID(),confirmed:true};const first=await service.campaign('admin',input);assert.equal((await service.campaign('admin',input)).campaignId,first.campaignId);
  await assert.rejects(()=>service.campaign('admin',{...input,requestId:randomUUID()}),/already sent/);
  const e=(await pool!.query(`SELECT * FROM ${n}.events WHERE event_key LIKE $1`,['campaign:'+first.campaignId+':%'])).rows[0];const old=e.template_snapshot.body;
  await service.saveTemplate('admin','special_offer',{title:'Current offers',body:'Explore the current offers in {{appName}}.',category:'marketing',enabled:true,expectedVersion:1});assert.equal((await pool!.query(`SELECT template_snapshot FROM ${n}.events WHERE id=$1`,[e.id])).rows[0].template_snapshot.body,old);
  await service.setPreferences('buyer1',{transactional:true,marketing:false});let sent=0;await processNotificationBatch(async()=>{sent++;},25);assert.equal(sent,0);assert.equal((await service.templateHistory('special_offer')).length,1);
 });
 await t.test('stale template or changed audience and duplicate preview cannot create another campaign',async()=>{
  await service.setPreferences('buyer1',{transactional:true,marketing:true});const preview=await service.previewAudience('admin',{templateId:'special_offer'});await service.saveTemplate('admin','special_offer',{title:'View current offers',body:'Open {{appName}} to explore current offers.',category:'marketing',enabled:true,expectedVersion:2});await assert.rejects(()=>service.campaign('admin',{previewId:preview.previewId,requestId:randomUUID(),confirmed:true}),/Template changed/);
  const changed=await service.previewAudience('admin',{templateId:'special_offer'});await service.setPreferences('buyer1',{transactional:true,marketing:false});await assert.rejects(()=>service.campaign('admin',{previewId:changed.previewId,requestId:randomUUID(),confirmed:true}),/Audience changed/);
 });
 await t.test('rebound device cannot deliver an old account event; logout cascades device revocation',async()=>{
  await make('account-switch','paid',true);await service.subscribe('buyer2',tokens.buyer2,{subscription});let sends=0;await processNotificationBatch(async()=>{sends++;},25);assert.equal(sends,1); // Only buyer1's other device remains eligible.
  await pool!.query("DELETE FROM sessions WHERE id='session-buyer2'");assert.equal((await pool!.query(`SELECT COUNT(*) FROM ${n}.devices WHERE id=$1`,[deviceId])).rows[0].count,'0');
 });
 await t.test('invalid provider endpoints revoke only the matching device and history remains',async()=>{
  await make('invalid-device','paid',true);await processNotificationBatch(async()=>{throw {statusCode:410};},25);assert.equal((await pool!.query(`SELECT COUNT(*) FROM ${n}.devices WHERE user_id='buyer1'`)).rows[0].count,'0');assert.ok((await service.deliveries()).some(r=>r.state==='invalid'));assert.ok((await service.deliveries()).some(r=>r.history.length>0));
 });
 await t.test('refund completion requires verified resolution; no status-only completion claim',async()=>{
  await make('refund-order','refunded',true);assert.equal((await pool!.query(`SELECT COUNT(*) FROM ${n}.events WHERE order_id='refund-order' AND template_id='refund_update'`)).rows[0].count,'0');
  await pool!.query("UPDATE orders SET resolution_json=$1 WHERE id='refund-order'",[JSON.stringify({stage:'resolved',outcome:'paystack_refund',verifiedAt:new Date().toISOString()})]);assert.equal((await pool!.query(`SELECT COUNT(*) FROM ${n}.events WHERE order_id='refund-order' AND template_id='refund_update'`)).rows[0].count,'1');
 });
 await t.test('private table access and account inbox isolation hold through actual HTTP',async()=>{
  await control.query("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; END $$;");await pool!.query(NOTIFICATION_SCHEMA);const c=await pool!.connect();try{await c.query('SET ROLE anon');await assert.rejects(()=>c.query(`SELECT * FROM ${n}.devices`),/permission denied/);}finally{await c.query('RESET ROLE');c.release();}
  const app=express();app.use(express.json());app.use('/notifications',notificationRouter);app.use('/admin',adminNotificationRouter);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  try{const base=`http://127.0.0.1:${(server.address() as any).port}`;const notification=(await service.inbox('buyer1'))[0];assert.ok(notification);
   assert.equal((await fetch(base+'/notifications/inbox/'+notification.id)).status,401);assert.equal((await fetch(base+'/notifications/inbox/'+notification.id,{headers:{authorization:'Bearer '+tokens.admin}})).status,404);assert.equal((await fetch(base+'/notifications/inbox/'+notification.id,{headers:{authorization:'Bearer '+tokens.buyer1}})).status,200);assert.equal((await fetch(base+'/admin/templates',{headers:{authorization:'Bearer '+tokens.buyer1}})).status,403);
  }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
 });
 await t.test('real frontend adapters use protected HTTP contracts, prepared audiences and private inbox ownership',async()=>{
  const app=express();app.use(express.json());app.use('/api/notifications',notificationRouter);app.use('/api/admin/notifications',adminNotificationRouter);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`,oldFetch=globalThis.fetch;
  const requests:Array<{path:string;body:any}>=[];globalThis.fetch=(url,init)=>{requests.push({path:String(url),body:init?.body?JSON.parse(String(init.body)):null});return oldFetch(base+String(url),init);};
  try{
   const templates=await adminHttp.templates(tokens.admin);assert.equal(templates.length,8);assert.equal(templates.filter(t=>t.locked).length,5);assert.equal(templates.filter(t=>!t.locked&&t.category==='marketing').length,3);
   assert.equal((await adminHttp.saveTemplate(tokens.admin,{id:'payment_confirmed',expectedVersion:'1',category:'transactional',name:'No override',title:'Payment confirmed',body:'Fake payment confirmation',destination:'/orders'})).ok,false);
   assert.equal((await customerHttp.savePreferences(tokens.buyer1,{transactional:true,promotional:true,expectedVersion:''})).ok,true);assert.equal((await customerHttp.preferences(tokens.buyer1)).promotional,true);
   assert.deepEqual(Object.keys(requests.find(r=>r.path.endsWith('/preferences')&&r.body)!.body).sort(),['marketing','transactional']);
   const sub={...subscription,expirationTime:null,endpoint:'https://fcm.googleapis.com/fcm/send/SYNTHETIC-HTTP'};assert.equal((await customerHttp.register(tokens.buyer1,sub)).ok,true);assert.equal((await customerHttp.deviceStatus(tokens.buyer1,sub.endpoint)).subscribed,true);assert.equal((await customerHttp.deviceStatus(tokens.buyer1,sub.endpoint+'OTHER')).subscribed,false);
   const saved=await adminHttp.saveTemplate(tokens.admin,{id:null,expectedVersion:null,name:'Service notice',title:'Service notice',body:'Explore available services in {{appName}}.',category:'marketing',destination:'/app',enabled:true});assert.ok(saved.ok);if(!saved.ok)throw Error('Template save failed');
   const preview=await adminHttp.prepareAudience!(tokens.admin,{templateId:saved.template.id,userId:'buyer1'});assert.equal(preview.eligibleDevices,1);
   const input={previewId:preview.previewId,idempotencyKey:randomUUID(),templateId:saved.template.id,category:'marketing' as const,title:saved.template.title,body:saved.template.body,destination:'/app',audienceId:'customer',confirmedRecipients:1};
   const sent=await adminHttp.createSend(tokens.admin,input);assert.ok(sent.ok);const duplicate=await adminHttp.createSend(tokens.admin,input);assert.ok(duplicate.ok&&duplicate.duplicate);
   assert.equal((await adminHttp.createSend(tokens.admin,{...input,body:'Unreviewed changed body'})).ok,false);
   assert.equal((await adminHttp.createSend(tokens.admin,{...input,idempotencyKey:randomUUID()})).ok,false);
   await processNotificationBatch(sender,25);const page=await adminHttp.sends(tokens.admin,{page:1,limit:20});assert.ok(page.items.length>0);const detail=await adminHttp.send(tokens.admin,page.items[0].id);assert.equal(detail.recipients,1);assert.equal(Object.values(detail.counts).reduce((a,b)=>a+b,0),1);
   const notification=(await service.inbox('buyer1'))[0];assert.ok(['/app','/orders'].includes((await readNotificationInbox(tokens.buyer1,notification.id)).destination));await assert.rejects(()=>readNotificationInbox(tokens.admin,notification.id));
   await assert.rejects(()=>adminHttp.templates(tokens.buyer1));
   const beforeKey=process.env.GEMINI_API_KEY;delete process.env.GEMINI_API_KEY;try{await httpAiDraftingClient.propose(tokens.admin,{templateId:'new_service',action:'friendly',title:'PRIVATE_CUSTOMER_MUST_NOT_LEAVE',body:'PRIVATE_CUSTOMER_MUST_NOT_LEAVE',placeholders:[]});}finally{if(beforeKey!==undefined)process.env.GEMINI_API_KEY=beforeKey;}
   assert.deepEqual(requests.find(r=>r.path.endsWith('/draft'))!.body,{templateId:'new_service',mode:'friendly'});assert.doesNotMatch(JSON.stringify(requests.filter(r=>r.path.endsWith('/draft'))),/PRIVATE_CUSTOMER/);
   process.env.WEB_PUSH_ENABLED='false';assert.equal((await customerHttp.configuration!()).enabled,false);await assert.rejects(()=>customerHttp.publicKey(tokens.buyer1));await assert.rejects(()=>adminHttp.prepareAudience!(tokens.admin,{templateId:saved.template.id}));process.env.WEB_PUSH_ENABLED='true';
   await pool!.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES('buyer2-http','buyer2',$1,NOW()+interval '1 day')",[hashSessionToken(tokens.buyer2)]);
   assert.equal((await customerHttp.register(tokens.buyer2,sub)).ok,true);assert.equal((await customerHttp.deviceStatus(tokens.buyer1,sub.endpoint)).subscribed,false);assert.equal((await customerHttp.deviceStatus(tokens.buyer2,sub.endpoint)).subscribed,true);await assert.rejects(()=>readNotificationInbox(tokens.buyer2,notification.id));
   assert.equal((await customerHttp.unregister(tokens.buyer2,sub.endpoint)).ok,true);assert.equal((await customerHttp.deviceStatus(tokens.buyer2,sub.endpoint)).subscribed,false);
  }finally{globalThis.fetch=oldFetch;process.env.WEB_PUSH_ENABLED='true';server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
 });
 await t.test('notification foreign-key evidence prevents B1 fixture deletion in the combined schema',async()=>{
  await make('notification-linked','failed',false);await pool!.query("UPDATE orders SET user_id=NULL,payment_status='failed' WHERE id='notification-linked'");await pool!.query("INSERT INTO order_test_fixtures(order_id,provenance) VALUES('notification-linked','synthetic_no_gateway')");
  await pool!.query(`INSERT INTO ${n}.events(user_id,order_id,event_key,template_id,label) VALUES('buyer1','notification-linked','synthetic-evidence','delivery_attention','Synthetic evidence')`);
  const details=await OrderManagement.details('notification-linked');assert.equal(details.eligibility.deleteTest,false);assert.ok(details.eligibility.denials.includes('CONNECTED_EVIDENCE'));
 });
 }finally{await pool?.end();await control.query(`DROP DATABASE ${name} WITH (FORCE)`);await control.end();for(const key of ['DATABASE_URL','DATABASE_SSL','MYSTERY_TEST_DATABASE_OPT_IN','WEB_PUSH_ENABLED','WEB_PUSH_VAPID_PUBLIC_KEY','WEB_PUSH_VAPID_PRIVATE_KEY','WEB_PUSH_VAPID_SUBJECT','WEB_PUSH_STORAGE_KEY']){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}}
});
