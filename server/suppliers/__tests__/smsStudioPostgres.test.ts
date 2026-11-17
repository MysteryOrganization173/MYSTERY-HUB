import {draftSms} from '../../sms/draft.js';
import assert from 'node:assert/strict';import {test} from 'node:test';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {getPool,initDatabase} from '../../db/connection.js';import {assertSafeTestDatabase} from '../../utils/environment.js';
import {AuthStore} from '../../db/authStore.js';import {OrdersStore} from '../../db/ordersStore.js';import {contactOrder} from './fixtures/contactHub.js';
import {SmsService} from '../../sms/service.js';import {buyingPatterns} from '../../sms/buyingPatterns.js';
import {BUSINESS_CONFIG} from '../../../src/config/business.js';
const url=process.env.MYSTERY_SMS_STUDIO_POSTGRES_URL;
test('native SMS studio: audience evidence, template versions and financial isolation',{skip:!url},async t=>{
 assert.equal(process.env.DATABASE_URL,undefined);assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});const saved={...process.env};
 Object.assign(process.env,{NODE_ENV:'test',DATABASE_URL:url,DATABASE_SSL:'false',MYSTERY_TEST_DATABASE_OPT_IN:'true'});const db=getPool()!;
 try{
  assert.equal((await db.query("SELECT to_regclass('public.users') AS t")).rows[0].t,null);await initDatabase();for(const f of ['smsCommunicationsV1.sql','smsPermissionsV2.sql'])await db.query(readFileSync('server/db/'+f,'utf8'));
  for(const [id,role] of [['studio-admin','admin'],['studio-buyer','customer'],['studio-reseller','customer']])await AuthStore.createUser({id,name:id,email:null,phone:id==='studio-buyer'?'0551234567':null,passwordHash:'synthetic',role:role as any});await AuthStore.createSession('studio-admin','studio-admin-session');
  const now=Date.now();for(const days of [91,61,31,1]){const at=new Date(now-days*86400000).toISOString();await OrdersStore.createOrder(contactOrder('studio-buyer',0,{created_at:at,updated_at:at,paid_at:at,delivered_at:at}));}
  const reseller=contactOrder('studio-reseller',0);await OrdersStore.createOrder(reseller);await db.query("INSERT INTO finance_operations(id,user_id,kind,idempotency_key,state,amount_minor,payload) VALUES($1,'studio-reseller','store_sale',$1,'completed',1000,$2)",[randomUUID(),JSON.stringify({orderId:reseller.id})]);
  const baseline=(await db.query('SELECT revision,paused,auto_enabled,auto_types,cutoff FROM mysteryhub_sms.settings')).rows;
  await t.test('personal buying cycles use direct qualifying purchases and exclude reseller-only identities',async()=>{
   const result=await buyingPatterns();const buyer=result.customers.find(c=>c.id==='studio-buyer')!;assert.equal(buyer.cycleDays,30);assert.equal(buyer.group,'recent');assert.ok(!result.customers.some(c=>c.id==='studio-reseller'));assert.equal(result.retentionAutomation,false);
  });
  await t.test('same-day bursts do not hide a monthly buying cycle',async()=>{
   const at=new Date().toISOString();for(let i=0;i<25;i++)await OrdersStore.createOrder(contactOrder('studio-buyer',0,{created_at:at,updated_at:at,paid_at:at,delivered_at:at}));
   const result=await buyingPatterns();assert.equal(result.customers.find(c=>c.id==='studio-buyer')!.cycleDays,30);
  });
  await t.test('promotional AI proposals require marketing permission from the default operational composer',async()=>{
   const draft=await draftSms({brief:{goal:'availability',audience:'direct_customers',service:'data',network:'all',keyFacts:'',tone:'friendly',desiredSegments:1,cta:'Check current services.',officialLink:'none'}},()=>({models:{generateContent:async()=>({text:JSON.stringify({alternatives:['Need data? Explore current bundles.']})})}}));
   assert.ok('purpose' in draft);assert.equal(draft.purpose,'marketing');const input={filters:{source:'registered'},selected:[{id:'studio-buyer',source:'registered'}],body:draft.alternatives[0]};
   assert.equal((await SmsService.preview('studio-admin',{...input,purpose:draft.purpose})).unique,0);
   await assert.rejects(()=>SmsService.preview('studio-admin',{...input,purpose:'operational'}),/Promotional/);
  });
  await t.test('channel URL variants cannot bypass confirmation or marketing purpose',async()=>{
   for(const url of ['HTTPS://whatsapp.com/channel/0029SyntheticChannel','whatsapp.com/channel/0029SyntheticChannel','https://www.whatsapp.com/channel/0029SyntheticChannel'])await assert.rejects(()=>SmsService.preview('studio-admin',{filters:{source:'registered'},purpose:'operational',body:'Follow our channel for offers: '+url}),/confirm|Channel/i);
  });
  const selection={filters:{source:'registered'},selected:[{id:'studio-buyer',source:'registered'}],purpose:'marketing',templateId:'friday',templateVersion:0,channelUrl:BUSINESS_CONFIG.contact.whatsappChannelUrl,channelConfirmed:true};
  await t.test('new virtual library templates still require marketing permission and confirmed channel',async()=>{
   await assert.rejects(()=>SmsService.preview('studio-admin',{...selection,channelConfirmed:false}),/confirm/i);
   assert.equal((await SmsService.preview('studio-admin',selection)).unique,0);
   await db.query("INSERT INTO mysteryhub_sms.consents(user_id,phone,purpose,granted,source) VALUES('studio-buyer','+233551234567','marketing',true,'account_sms_settings')");
   const p=await SmsService.preview('studio-admin',selection);assert.equal(p.unique,1);assert.ok(p.body.includes(BUSINESS_CONFIG.contact.whatsappChannelUrl));assert.ok(!p.body.includes('{{'));
   const requestId=randomUUID(),campaign=await SmsService.campaign('studio-admin','studio-admin-session',{previewId:p.id,requestId,confirmed:true,queue:false});assert.equal(campaign.state,'draft');assert.equal((await SmsService.campaign('studio-admin','studio-admin-session',{previewId:p.id,requestId,confirmed:true,queue:false})).id,campaign.id);
  });
  await t.test('stale or incorrect buying-pattern audiences cannot pass a campaign review',async()=>{
   const input={filters:{source:'registered'},selected:[{id:'studio-buyer',source:'registered'}],purpose:'marketing',body:'Explore current services before ordering.'};
   await assert.rejects(()=>SmsService.preview('studio-admin',{...input,buyingGroup:'due'}),/audience changed/);
   assert.equal((await SmsService.preview('studio-admin',{...input,buyingGroup:'recent'})).unique,1);
  });
  await t.test('publishing edits creates versions and rejects stale/disabled virtual template fallback',async()=>{
   await SmsService.templates('studio-admin',{id:'friday',title:'Friday update',body:'See the official channel for confirmed campaign details: {{channel_url}}',purpose:'marketing',enabled:true,expectedVersion:0});
   await assert.rejects(()=>SmsService.preview('studio-admin',selection),/changed/);
   assert.equal((await SmsService.preview('studio-admin',{...selection,templateVersion:1})).unique,1);
   await SmsService.templates('studio-admin',{id:'friday',title:'Friday update',body:'See current confirmed channel details: {{channel_url}}',purpose:'marketing',enabled:false,expectedVersion:1});
   await assert.rejects(()=>SmsService.preview('studio-admin',{...selection,templateVersion:0}),/changed/);
   assert.equal((await db.query("SELECT count(*)::int AS n FROM mysteryhub_sms.template_versions WHERE template_id='friday'")).rows[0].n,2);
  });
  await t.test('fast/instant claims require current evidence even for a custom message',async()=>{
   const input={filters:{source:'registered'},selected:selection.selected,purpose:'marketing',body:'Instant delivery is currently available. Check verified service details.'};
   await assert.rejects(()=>SmsService.preview('studio-admin',input),/performance/);
   assert.equal((await SmsService.preview('studio-admin',{...input,claimConfirmed:true,claimEvidence:'Synthetic confirmed current operational performance'})).unique,1);
  });
  await t.test('studio reads and prepared drafts preserve automatic policy, financial records and provider silence',async()=>{
   assert.deepEqual((await db.query('SELECT revision,paused,auto_enabled,auto_types,cutoff FROM mysteryhub_sms.settings')).rows,baseline);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM finance_ledger')).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int AS n FROM mysteryhub_sms.attempts')).rows[0].n,0);
   assert.equal((await db.query("SELECT count(*)::int AS n FROM mysteryhub_sms.messages WHERE state<>'draft'")).rows[0].n,0);
  });
 }finally{await db.end();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});
