import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {getPool,initDatabase} from '../../db/connection.js';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {AuthStore} from '../../db/authStore.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {contactOrder} from './fixtures/contactHub.js';
import {expandSmsEvents,smsTick,claimSms} from '../../sms/worker.js';
import {orderRecipients} from '../../sms/policy.js';
import {SmsService} from '../../sms/service.js';
import {publishAutomaticTemplate} from '../../sms/templatePublishing.js';
import {transactionalMessage} from '../../sms/transactional.js';
import {withSmsRuntime} from '../../sms/runtime.js';
import {SMS_DEFAULT_AUTO_EVENTS} from '../../../shared/smsTransactional.js';
import {smsEstimate} from '../../../src/utils/manualSms.js';
const url=process.env.MYSTERY_SMS_EXPERIENCE_POSTGRES_URL;
test('SMS experience V2 native lifecycle, recipients and release policy',{skip:!url},async t=>{
  assert.equal(process.env.DATABASE_URL,undefined);assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
  const saved={...process.env};Object.assign(process.env,{DATABASE_URL:url,DATABASE_SSL:'false',NODE_ENV:'test',MYSTERY_TEST_DATABASE_OPT_IN:'true'});
  const db=getPool()!;let sends=0;const submitted:any[]=[];
  const api={balance:async()=>({smsCredits:10000,mainBalance:'GHS 0',observedAt:new Date().toISOString()}),send:async(body:string,phones:string[])=>{sends++;submitted.push({body,phones});return phones.map(phone=>({phone,id:randomUUID(),state:'accepted'}));}} as any;
  try{
    assert.equal((await db.query("SELECT to_regclass('public.users') AS t")).rows[0].t,null);await initDatabase();
    for(const file of ['smsCommunicationsV1.sql','smsPermissionsV2.sql'])await db.query(readFileSync(new URL('../../db/'+file,import.meta.url),'utf8'));
    for(const [id,role,phone] of [['v2-admin','admin',null],['v2-buyer','customer','0591234567']] as const)await AuthStore.createUser({id,name:id,email:null,phone,passwordHash:'synthetic',role:role as any});
    Object.assign(process.env,{ARKESEL_API_KEY:'synthetic-only',ARKESEL_SENDER_ID:'MYSTERY HUB',ARKESEL_SMS_ENABLED:'true',ARKESEL_AUTO_SMS_ENABLED:'true',ARKESEL_WORKER_ENABLED:'true',ARKESEL_SANDBOX_MODE:'true',ARKESEL_TEST_ONLY:'false'});
    const configure=async(types=[...SMS_DEFAULT_AUTO_EVENTS])=>db.query("UPDATE mysteryhub_sms.settings SET paused=false,auto_enabled=true,auto_types=$1,recipient_updates=false,cutoff=clock_timestamp()-interval '1 second'",[types]);
    await configure();
    const fresh=async(extra:any={})=>{const at=new Date().toISOString(),o=contactOrder('v2-buyer',0,{network:'telecel',created_at:at,updated_at:at,paid_at:at,submitted_at:at,delivered_at:null,status:'processing',recipient_phone:'0241234567',...extra});await OrdersStore.createOrder(o);if(extra.resolution_json)await db.query('UPDATE orders SET resolution_json=$1 WHERE id=$2',[extra.resolution_json,o.id]);return o;};
    const count=async(id:string,stage?:string)=>(await db.query("SELECT * FROM mysteryhub_sms.messages WHERE order_id=$1 AND ($2::text IS NULL OR context->>'templateId'=$2)",[id,stage||null])).rows;
    const clear=()=>db.query("UPDATE mysteryhub_sms.messages SET state='cancelled' WHERE state='queued'");
    await t.test('account buyer gets one processing message without SMS grant, push permission or recipient SMS',async()=>{
      await db.query("INSERT INTO mysteryhub_notifications.preferences(user_id,transactional,marketing) VALUES('v2-buyer',false,false)");
      const o=await fresh();await Promise.all([expandSmsEvents(),expandSmsEvents()]);const rows=await count(o.id);
      assert.equal(rows.length,1);assert.equal(rows[0].recipient,'+233591234567');assert.equal(rows[0].context.templateId,'order_processing');assert.match(rows[0].body,/Your 1GB Telecel.*processing/);assert.equal(smsEstimate(rows[0].body).segments,1);
      await smsTick(api);assert.equal(sends,1);assert.deepEqual(submitted[0].phones,['+233591234567']);
      await db.query("UPDATE orders SET status='delivered',delivered_at=now() WHERE id=$1",[o.id]);await expandSmsEvents();await smsTick(api);await expandSmsEvents();assert.equal((await count(o.id)).length,2);assert.match(submitted[1].body,/delivered successfully/);assert.equal(sends,2);
    });
    await t.test('guest uses existing recipient only with neutral one-segment wording and no payer evidence',async()=>{
      await clear();const o=await fresh({user_id:null});await expandSmsEvents();const rows=await count(o.id);assert.equal(rows.length,1);assert.equal(rows[0].recipient,'+233241234567');assert.match(rows[0].body,/^A /);assert.match(rows[0].body,/notify this number/);assert.equal(smsEstimate(rows[0].body).segments,1);const c=await db.connect();try{assert.equal((await orderRecipients(c,o.id,'payment_confirmed',false,false)).recipients.length,0);}finally{c.release();}
    });
    await t.test('absent or invalid account phone never falls back to the purchased-for number',async()=>{
      const c=await db.connect();try{for(const phone of [null]){await db.query('UPDATE users SET phone=$1 WHERE id=$2',[phone,'v2-buyer']);const o=await fresh();assert.equal((await orderRecipients(c,o.id,'order_processing',true,true)).recipients.length,0);}}finally{c.release();await assert.rejects(()=>db.query("UPDATE users SET phone='invalid' WHERE id='v2-buyer'"),/Invalid account phone/);await db.query("UPDATE users SET phone='0591234567' WHERE id='v2-buyer'");}
    });
    await t.test('delivery before dispatch cancels stale processing before a provider submission marker',async()=>{
      await clear();const o=await fresh();await expandSmsEvents();await db.query("UPDATE orders SET status='delivered',delivered_at=now() WHERE id=$1",[o.id]);await expandSmsEvents();const rows=await count(o.id);const processing=rows.find(r=>r.context.templateId==='order_processing');assert.equal(processing.state,'cancelled');assert.equal(processing.network_started_at,null);assert.equal(rows.find(r=>r.context.templateId==='order_delivered').state,'queued');await clear();
    });
    await t.test('queued opt-out wins at dispatch and account-level withdrawal survives changed phone',async()=>{
      await clear();const o=await fresh();await expandSmsEvents();await db.query("INSERT INTO mysteryhub_sms.consents(user_id,phone,purpose,granted,source) VALUES('v2-buyer','+233591234567','transactional',false,'account_sms_settings')");
      const before=sends;await smsTick(api);assert.equal(sends,before);assert.equal((await count(o.id))[0].state,'cancelled');
      await db.query("UPDATE users SET phone='0551234567' WHERE id='v2-buyer'");const c=await db.connect();try{assert.equal((await orderRecipients(c,o.id,'order_processing',false,true)).recipients.length,0);}finally{c.release();}
      await db.query("UPDATE users SET phone='0591234567' WHERE id='v2-buyer'");await db.query("INSERT INTO mysteryhub_sms.consents(user_id,phone,purpose,granted,source) VALUES('v2-buyer','+233591234567','transactional',true,'account_sms_settings')");
    });
    await t.test('supplier uncertainty produces no processing; actionable review gets one attention then recovered delivery',async()=>{
      await clear();const o=await fresh({status:'paid',supplier_order_id:null,submitted_at:null});await expandSmsEvents();assert.equal((await count(o.id)).length,0);
      await db.query("UPDATE orders SET manual_review=false,status='refund_pending' WHERE id=$1",[o.id]);await expandSmsEvents();await expandSmsEvents();assert.equal((await count(o.id,'delivery_attention')).length,1);
      await db.query("UPDATE orders SET manual_review=false,status='delivered',supplier_order_id='synthetic-accepted',delivered_at=now() WHERE id=$1",[o.id]);await expandSmsEvents();assert.equal((await count(o.id,'order_delivered')).length,1);
      await clear();
    });
    await t.test('resolved attention and contradictory refund delivery cannot produce misleading copy',async()=>{
      const o=await fresh({status:'failed',manual_review:true,resolution_json:{stage:'resolved',outcome:'external_compensation'}});await expandSmsEvents();assert.equal((await count(o.id)).length,0);
      const c=await db.connect();try{await assert.rejects(()=>orderRecipients(c,o.id,'delivery_attention',false,true),/evidence/);await db.query("UPDATE orders SET status='delivered',manual_review=false,delivered_at=now() WHERE id=$1",[o.id]);await assert.rejects(()=>orderRecipients(c,o.id,'order_delivered',false,true),/evidence/);}finally{c.release();}
    });
    await t.test('store context, store reference and finance-only reseller orders stay outside discovery',async()=>{
      for(const extra of [{store_context:{channel:'website_store'}},{payment_reference:'MH_STORE_'+randomUUID()}]){const o=await fresh(extra);await expandSmsEvents();assert.equal((await count(o.id)).length,0);}
      const o=await fresh();await db.query("INSERT INTO finance_operations(id,user_id,kind,idempotency_key,state,amount_minor,payload) VALUES($1,'v2-buyer','store_checkout',$1,'pending',1000,$2)",[randomUUID(),JSON.stringify({orderId:o.id})]);await expandSmsEvents();assert.equal((await count(o.id)).length,0);
    });
    await t.test('new cutoff excludes historical orders and exact policy selection is enforced',async()=>{
      await clear();const o=await fresh({created_at:'2020-01-01T00:00:00Z'});await expandSmsEvents();assert.equal((await count(o.id)).length,0);
      const r=await SmsService.readiness();await SmsService.settings('v2-admin',{paused:false,autoEnabled:true,recipientUpdates:false,autoTypes:['order_delivered'],expectedRevision:r.settingsRevision,confirmed:true});assert.deepEqual((await SmsService.readiness()).autoTypes,['order_delivered']);
      for(const extra of [{autoTypes:['payment_confirmed']},{recipientUpdates:true},{autoTypes:['marketing']}])await assert.rejects(()=>SmsService.settings('v2-admin',{paused:false,autoEnabled:true,recipientUpdates:false,autoTypes:['order_delivered'],expectedRevision:r.settingsRevision+1,confirmed:true,...extra}));
      await configure();
    });
    await t.test('expanding an active policy cannot backfill previously delivered orders',async()=>{
      await clear();let r=await SmsService.readiness();await SmsService.settings('v2-admin',{paused:false,autoEnabled:true,recipientUpdates:false,autoTypes:['order_processing'],expectedRevision:r.settingsRevision,confirmed:true});
      const old=await fresh({status:'delivered',delivered_at:new Date().toISOString()});await expandSmsEvents();assert.equal((await count(old.id)).length,0);
      r=await SmsService.readiness();await SmsService.settings('v2-admin',{paused:false,autoEnabled:true,recipientUpdates:false,autoTypes:['order_processing','order_delivered'],expectedRevision:r.settingsRevision,confirmed:true});
      await expandSmsEvents();assert.equal((await count(old.id)).length,0);
      await new Promise(resolve=>setTimeout(resolve,3));const next=await fresh({status:'delivered',delivered_at:new Date().toISOString()});await expandSmsEvents();assert.equal((await count(next.id,'order_delivered')).length,1);await clear();
    });
    await t.test('approved wording publishing versions copy; arbitrary factual edits are rejected',async()=>{
      const old=(await db.query("SELECT version FROM mysteryhub_sms.templates WHERE id='order_processing'")).rows[0].version;
      await assert.rejects(()=>publishAutomaticTemplate('v2-admin',{id:'order_processing',wordingId:'invented',expectedVersion:old,confirmed:true}));
      await publishAutomaticTemplate('v2-admin',{id:'order_processing',wordingId:'concise',expectedVersion:old,confirmed:true});
      assert.equal((await db.query("SELECT count(*)::int n FROM mysteryhub_sms.template_versions WHERE template_id='order_processing'")).rows[0].n,2);
      const c=await db.connect();try{for(const network of ['mtn','telecel','airteltigo'])for(const bundle of ['1GB','3GB','10GB','99999.99GB'])for(const guest of [false,true]){const o={...contactOrder(null,0),network,bundle_size_snapshot:bundle,recipient_phone:'0551111116'};const body=await transactionalMessage(c,o,'order_delivered',guest);assert.equal(smsEstimate(body).segments,1);assert.equal(smsEstimate(body).encoding,'GSM-7');assert.ok(!body.includes('{{'));}}finally{c.release();}
    });
    await t.test('runtime observation contains only safe actual gates, no key, secret or test contacts',()=>{
      const value=JSON.stringify(withSmsRuntime());assert.ok(!value.includes('synthetic-only'));assert.ok(!value.includes('testNumbers'));assert.equal(withSmsRuntime().auto,true);
    });
    assert.equal((await db.query('SELECT count(*)::int AS n FROM finance_ledger')).rows[0].n,0);
  }finally{await db.end();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});
