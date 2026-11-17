import assert from 'node:assert/strict';
import {test,mock} from 'node:test';
import pg from 'pg';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {getPool,initDatabase} from '../../db/connection.js';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {AuthStore} from '../../db/authStore.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {AdminAuditStore} from '../../db/adminAuditStore.js';
import {ContactHubStore,contactTransaction} from '../../db/contactHubStore.js';
import {ContactHubService} from '../../services/contactHubService.js';
import {contactFilters,deriveContacts,matchesContact,sortContacts} from '../../services/contactHubPolicy.js';
import {CONTACT_SORTS} from '../../../shared/contactHub.js';
import {contactDataset,contactNow,contactUser,contactOrder,contactWaitlist} from './fixtures/contactHub.js';
const url=process.env.MYSTERY_CONTACT_POSTGRES_URL;
test('native Contact Hub aggregates, permissions, complete exports and audit isolation',{skip:!url},async t=>{
 assert.equal(process.env.DATABASE_URL,undefined);assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
 const observer=new pg.Pool({connectionString:url,ssl:false});
 try{
  assert.equal((await observer.query("SELECT to_regclass('public.users') AS n")).rows[0].n,null,'Requires empty disposable database');
  Object.assign(process.env,{DATABASE_URL:url,DATABASE_SSL:'false',MYSTERY_TEST_DATABASE_OPT_IN:'true',NODE_ENV:'test'});await initDatabase();
  const pool=getPool()!,d=contactDataset();
  for(const user of d.users)await AuthStore.createUser({id:user.id,name:user.name,email:user.email,phone:user.phone,passwordHash:user.password_hash,role:user.role,status:user.status});
  await pool.query("UPDATE users SET created_at='2026-09-01T00:00:00Z'");
  // Model legacy raw phone formats in the isolated fixture only, before the canonicalization trigger existed.
  await pool.query('ALTER TABLE users DISABLE TRIGGER users_phone_identity_guard');
  try{for(const u of d.users)await pool.query('UPDATE users SET phone=$1 WHERE id=$2',[u.phone,u.id]);}finally{await pool.query('ALTER TABLE users ENABLE TRIGGER users_phone_identity_guard');}
  const seed=async(o:any)=>{await OrdersStore.createOrder(o);await pool.query('UPDATE orders SET manual_review=$1,resolution_json=$2::jsonb,archived_at=$3,marketplace_status=$4 WHERE id=$5',[o.manual_review||false,o.resolution_json?JSON.stringify(o.resolution_json):null,o.archived_at||null,o.marketplace_status||null,o.id]);};
  for(const o of d.orders)await seed(o);
  const rows=deriveContacts(d.users,d.orders,[],contactNow);
  await t.test('SQL and memory agree across every source, segment, sort and advanced filter',async()=>{
   const filters:any[]=[{},...['all','registered','guest','recipient','payer'].map(source=>({source})),...['no_purchases','one_time','repeat','recent','at_risk','inactive','high_value','frequent'].map(segment=>({segment})),...CONTACT_SORTS.map(sort=>({sort})),{status:'disabled'},{phone:'valid'},{phone:'invalid'},{phone:'missing'},{network:'telecel'},{service:'data'},{q:'059 123 4567'},{q:'ama'},{q:'%_'},{minPurchases:2,maxPurchases:4},{minSpending:1000,maxSpending:3000},{minDays:30,maxDays:60},{firstFrom:'2026-09-01',firstTo:'2026-09-30'},{lastFrom:'2026-11-01',lastTo:'2026-11-14'},{vip:'high_value'},{vip:'formerly_active'},{permission:'service_notice_review'},{page:2,limit:2}];
   for(const input of filters){const f=contactFilters({source:'registered',...input}),expected=sortContacts(rows.filter(r=>matchesContact(r,f)),f.sort);const actual=await contactTransaction(false,c=>ContactHubStore.query(f,contactNow,c));assert.equal(actual.quality?.guestInvalidDeliveries,1);assert.equal(actual.total,expected.length,JSON.stringify(input));assert.deepEqual(actual.rows,expected.slice((f.page-1)*f.limit,f.page*f.limit),JSON.stringify(input));}
  });
  await t.test('recipient matching never transfers guest activity or payer details to account',async()=>{
   const profile=await ContactHubService.profile({source:'registered',id:'repeat'}),guest=await ContactHubService.profile({source:'guest',id:'+233241234567'});
   assert.equal(profile.contact.purchases,2);assert.equal(guest.contact.purchases,2);assert.equal(guest.contact.name,null);assert.equal(profile.orders.length,2);assert.ok(profile.orders.some(o=>o.archived));assert.ok(!JSON.stringify(profile).includes('Unrelated guest purchaser'));
   await assert.rejects(()=>ContactHubService.profile({source:'registered',id:'staff'}),/not found/);
  });
  await t.test('scope-specific SMS unsubscribe and existing transactional restriction are respected without inferring consent',async()=>{
   const w=contactWaitlist('one','+233591234567');await pool.query('INSERT INTO waitlist(id,user_id,service_key,service_title,channel,contact,contact_normalized,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[w.id,null,w.service_key,w.service_title,w.channel,w.contact,'',w.status]);
   await pool.query("INSERT INTO mysteryhub_notifications.preferences(user_id,transactional,marketing) VALUES('frequent',FALSE,TRUE)");
   const all=await contactTransaction(false,c=>ContactHubStore.query(contactFilters({source:'registered'}),contactNow,c,true));assert.equal(all.rows.find(r=>r.id==='one')!.smsPermission,'sms_unsubscribed');assert.equal(all.rows.find(r=>r.id==='frequent')!.supportRestricted,true);
   const marketing=await ContactHubService.preview({filters:{source:'registered'},purpose:'marketing'});assert.equal(marketing.uniqueNumbers,0);assert.equal(marketing.excluded,all.total);
  });
  await t.test('full filtered export is not the current page and records a durable safe audit',async()=>{
   const filters={source:'registered',limit:1,page:2,phone:'valid'};const preview=await ContactHubService.preview({filters,purpose:'administrative'});assert.equal(preview.total,4);assert.equal(preview.uniqueNumbers,4);
   const result=await ContactHubService.export('staff',{filters,purpose:'administrative',format:'txt',confirmed:true,expectedRevision:preview.revision});assert.equal(result.content.split('\n').length,4);assert.ok(result.content.includes('+233591234567'));
   const audit=(await pool.query("SELECT * FROM admin_audit_log WHERE action='contact_export_prepared' ORDER BY created_at DESC LIMIT 1")).rows[0];assert.equal(audit.admin_user_id,'staff');assert.ok(!audit.metadata_safe_json.includes('+233'));assert.ok(!audit.metadata_safe_json.includes('@example.test'));assert.equal(JSON.parse(audit.metadata_safe_json).uniqueNumbers,4);
  });
  await t.test('changed audience requires new preview; failed audit cannot return data',async()=>{
   const preview=await ContactHubService.preview({filters:{source:'registered'},purpose:'support_notice'});await pool.query("UPDATE users SET status='disabled' WHERE id='repeat'");
   await assert.rejects(()=>ContactHubService.export('staff',{filters:{source:'registered'},purpose:'support_notice',format:'txt',confirmed:true,expectedRevision:preview.revision}),/changed/);
   const fresh=await ContactHubService.preview({filters:{source:'registered'},purpose:'administrative'});const audit=mock.method(AdminAuditStore,'record',async()=>{throw Error('Synthetic audit storage failure');});
   try{await assert.rejects(()=>ContactHubService.export('staff',{filters:{source:'registered'},purpose:'administrative',format:'csv',confirmed:true,expectedRevision:fresh.revision}),/audit storage/);}finally{audit.mock.restore();}
  });
  await t.test('review/refund/fixture evidence excludes apparent delivered rows and invalid timestamps',async()=>{
   for(const extra of [{manual_review:true},{resolution_json:{stage:'under_review'}},{resolution_json:{}},{resolution_json:{stage:'resolved',outcome:'wallet_refund'}},{paid_at:null},{delivered_at:null},{status:'cancelled'},{payment_provider:'complimentary',payment_status:'not_required'}])await seed(contactOrder('zero',1,extra as any));
   const synthetic=contactOrder('zero',1);await OrdersStore.createOrder(synthetic);await pool.query("INSERT INTO order_test_fixtures(order_id,provenance) VALUES($1,'synthetic_no_gateway')",[synthetic.id]);
   const refunded=contactOrder('zero',1);await OrdersStore.createOrder(refunded);await pool.query("INSERT INTO finance_operations(id,user_id,kind,idempotency_key,state,amount_minor,payload) VALUES('contact-refund','zero','refund','contact-refund','completed',1000,$1)",[JSON.stringify({orderId:refunded.id})]);
   const result=await contactTransaction(false,c=>ContactHubStore.query(contactFilters({source:'registered',q:'zero'}),contactNow,c));assert.equal(result.rows[0].purchases,0);
  });
  await t.test('larger audience, aggregate plans and retained private roles',async()=>{
   for(let i=0;i<60;i++)await AuthStore.createUser({id:'contact-'+i,name:'Contact '+i,email:null,phone:'025'+String(1000000+i),passwordHash:'fixture',role:'customer'});
   const filters={source:'registered',q:'Contact '},preview=await ContactHubService.preview({filters,purpose:'administrative'});assert.equal(preview.total,60);const out=await ContactHubService.export('staff',{filters,purpose:'administrative',format:'txt',confirmed:true,expectedRevision:preview.revision});assert.equal(out.content.split('\n').length,60);
   // Representative synthetic history. Explain the ACTUAL feature query, not a surrogate aggregate.
   await pool.query(`INSERT INTO orders SELECT (jsonb_populate_record(NULL::orders,to_jsonb(o)||jsonb_build_object('id','contact-perf-'||g,'public_reference','MH-CONTACT-PERF-'||g,'payment_reference','CONTACT-PERF-'||g))).* FROM orders o CROSS JOIN generate_series(1,10000) g WHERE o.id=$1`,[d.orders[0].id]);
   for(const [label,f]of [['filtered',contactFilters({source:'registered',q:'one'})],['export',contactFilters({phone:'valid'})]] as const){
    let captured:{sql:string;values:unknown[]}|null=null;
    await contactTransaction(false,c=>ContactHubStore.query(f,contactNow,{query:async(sql:string,values:unknown[])=>{captured={sql,values};return c!.query(sql,values);}} as any,label==='export'));
    const query=captured!;const plan=await contactTransaction(false,c=>c!.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+query.sql,query.values));
    const ms=plan.rows[0]['QUERY PLAN'][0]['Execution Time'];assert.ok(ms<4500,'Feature query must fit the five-second statement deadline');console.info('Synthetic Contact Hub actual query plan:',label,ms,'ms; 10,000 extra orders');
   }
   const denied=await observer.connect();try{await denied.query('BEGIN');await denied.query('SET LOCAL ROLE anon');await assert.rejects(()=>denied.query('SELECT phone FROM users'),/permission denied/);}finally{await denied.query('ROLLBACK');denied.release();}
  });
  await t.test('V2 direct/reseller isolation, signed-in recipients, payer provenance and all export scopes',async()=>{
   const d2=(await import('./fixtures/contactHubV2.js')).contactV2Dataset();
   for(const u of d2.users)await AuthStore.createUser({id:u.id,name:u.name,email:u.email,phone:u.phone,passwordHash:u.password_hash,role:u.role,status:u.status});
   for(const o of d2.orders)await seed(o.store_context===false as any?{...o,store_context:{} as any}:o);
   await pool.query("INSERT INTO finance_operations(id,user_id,kind,idempotency_key,state,amount_minor,payload) VALUES('v2-store-op','finance-only','store_checkout','v2-store-op','pending',1000,$1)",[JSON.stringify({orderId:'reseller-finance'})]);
   for(const e of d2.payers)await pool.query("INSERT INTO admin_guest_buyer_evidence(order_id,buyer_key,payer_name,payer_phone,account_id,evidence,actor_id,request_id,input_hash) VALUES($1,$2,$3,$4,NULL,'Synthetic verified evidence','staff',$1,$1)",[e.order_id,e.buyer_key,e.payer_name,e.payer_phone]);
   for(const id of ['seller-only','malformed','reference-only','finance-only'])await assert.rejects(()=>ContactHubService.profile({source:'registered',id}),/not found/);
   const mixed=await ContactHubService.profile({source:'registered',id:'mixed'});assert.equal(mixed.contact.purchases,1);assert.equal(mixed.contact.spendingMinor,1000);assert.deepEqual(mixed.orders.map(o=>o.reference),[d2.orders[0].public_reference]);
   const expected=deriveContacts(d2.users,d2.orders,[],contactNow,{storeOrderIds:d2.storeIds,guestPayers:d2.payers});
   for(const source of ['all','registered','recipient','guest','payer']){
    const f=contactFilters({source}),actual=await contactTransaction(false,c=>ContactHubStore.query(f,contactNow,c,true));
    for(const row of expected.filter(r=>matchesContact(r,f))){const a=actual.rows.find(r=>r.id===row.id);assert.ok(a,source+row.id);for(const key of ['source','phone','purchases','spendingMinor','firstAt','lastAt','provenance','accountIds'])assert.deepEqual(a[key as keyof typeof a],row[key as keyof typeof row],source+key);}
    assert.ok(!actual.rows.some(r=>r.phone==='+233599990001'));
    const filters={source,q:'059999'},preview=await ContactHubService.preview({filters,purpose:'administrative'}),out=await ContactHubService.export('staff',{filters,purpose:'administrative',format:'txt',confirmed:true,expectedRevision:preview.revision});assert.ok(!out.content.includes('599990001'));
   }
   const p=await ContactHubService.profile({source:'directory',id:'+233599990002'});assert.equal(p.contact.purchases,3);assert.equal(p.contact.spendingMinor,0);assert.ok(p.relationships?.some(r=>r.id==='zero-v2'));assert.ok(p.orders.every(o=>!o.reference.startsWith('MH_STORE_')));
   const unsubscribe=contactWaitlist('zero-v2','+233599990041');await pool.query('INSERT INTO waitlist(id,user_id,service_key,service_title,channel,contact,contact_normalized,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[unsubscribe.id,unsubscribe.user_id,unsubscribe.service_key,unsubscribe.service_title,unsubscribe.channel,unsubscribe.contact,unsubscribe.contact_normalized,unsubscribe.status]);
   assert.equal((await ContactHubService.profile({source:'directory',id:'+233599990002'})).contact.smsPermission,'sms_unsubscribed');
   for(const [i,phone] of ['0599990030','0599990031'].entries()){const order=contactOrder(null,2,{recipient_phone:'0599990060'});await seed(order);await pool.query("INSERT INTO admin_guest_buyer_evidence(order_id,buyer_key,payer_name,payer_phone,account_id,evidence,actor_id,request_id,input_hash) VALUES($1,'user:changed-phone','Changed payer',$2,NULL,'Synthetic verified historical phone','staff',$1,$1)",[order.id,phone]);const detail=await ContactHubService.profile({source:'payer',id:'user:changed-phone|+233'+phone.slice(1)});assert.equal(detail.contact.purchases,1);assert.equal(detail.orders.length,1);}
   const f={source:'registered'},expired=(await import('../../services/contactHubService.js')).contactExportPreview([],0,'administrative',contactFilters(f),Date.now()-900001);await assert.rejects(()=>ContactHubService.export('staff',{filters:f,purpose:'administrative',format:'txt',confirmed:true,expectedRevision:expired.revision}),/expired/);
  });
  await t.test('existing optional SMS withdrawals constrain manual support without removing recovery contacts',async()=>{
   await pool.query(readFileSync('server/db/smsCommunicationsV1.sql','utf8'));
   const phone='+233599990070',oldPhone='+233599990071';
   const users=[contactUser('withdrawal-buyer',{phone}),contactUser('withdrawal-shared',{phone:null})];
   for(const u of users)await AuthStore.createUser({id:u.id,name:u.name,email:u.email,phone:u.phone,passwordHash:'fixture',role:'customer'});
   // An existing shared-number legacy account must not bypass another identity's withdrawal.
   await pool.query('ALTER TABLE users DISABLE TRIGGER users_phone_identity_guard');
   try{await pool.query('UPDATE users SET phone=$1 WHERE id=$2',['0'+phone.slice(4),users[1].id]);}finally{await pool.query('ALTER TABLE users ENABLE TRIGGER users_phone_identity_guard');}
   const orders=[contactOrder(users[0].id,1,{recipient_phone:phone}),contactOrder(users[1].id,1,{recipient_phone:phone}),contactOrder(null,1,{recipient_phone:phone})];
   for(const o of orders)await seed(o);
   const filters={q:phone},preview=await ContactHubService.preview({filters,purpose:'administrative'});
   await pool.query("INSERT INTO mysteryhub_sms.consents(user_id,phone,purpose,granted,source) VALUES($1,$2,'transactional',false,'account_sms_settings')",[users[0].id,oldPhone]);
   await assert.rejects(()=>ContactHubService.export('staff',{filters,purpose:'administrative',format:'txt',confirmed:true,expectedRevision:preview.revision}),/changed/);
   const sql=await contactTransaction(false,c=>ContactHubStore.query(contactFilters(filters),contactNow,c,true));
   const memory=deriveContacts(users.map(u=>({...u,phone})),orders,[],contactNow,{smsWithdrawals:[{phone:oldPhone,user_id:users[0].id,purpose:'transactional'}]});
   for(const source of ['registered','recipient','guest','directory']){
    const expected=memory.filter(r=>r.source===source);const actual=await contactTransaction(false,c=>ContactHubStore.query(contactFilters({source:source==='directory'?'all':source,q:phone}),contactNow,c,true));
    assert.equal(actual.total,expected.length);for(const r of actual.rows){assert.deepEqual(r.smsRestrictions,['transactional']);assert.equal(r.supportReviewEligible,false);}
   }
   assert.equal(sql.total,1);const fresh=await ContactHubService.preview({filters,purpose:'administrative'});assert.equal(fresh.uniqueNumbers,1);
   assert.equal((await ContactHubService.export('staff',{filters,purpose:'administrative',format:'txt',confirmed:true,expectedRevision:fresh.revision})).content,phone);
   await pool.query("INSERT INTO mysteryhub_sms.consents(user_id,phone,purpose,granted,source) VALUES($1,$2,'transactional',true,'account_sms_settings'),($1,$2,'marketing',false,'account_sms_settings')",[users[0].id,phone]);
   let buyer=(await ContactHubService.profile({source:'registered',id:users[0].id})).contact;assert.deepEqual(buyer.smsRestrictions,['marketing']);assert.equal(buyer.supportReviewEligible,true);
   await pool.query(readFileSync('server/db/smsPermissionsV2.sql','utf8'));
   const record=async(granted:boolean)=>pool.query("INSERT INTO mysteryhub_sms.permission_records(phone,purpose,granted,source,evidence,obtained_at,actor_id,request_id,review_id,input_hash) VALUES($1,'operational',$2,'admin_recorded','Synthetic permission fixture',now(),'staff',$3,$4,'synthetic')",[phone,granted,randomUUID(),randomUUID()]);
   await record(false);buyer=(await ContactHubService.profile({source:'registered',id:users[0].id})).contact;assert.deepEqual(buyer.smsRestrictions,['marketing','operational']);assert.equal(buyer.supportReviewEligible,false);
   assert.equal((await ContactHubService.list({source:'registered',q:phone,permission:'service_notice_review'})).total,0);
   await record(true);buyer=(await ContactHubService.profile({source:'registered',id:users[0].id})).contact;assert.deepEqual(buyer.smsRestrictions,['marketing']);assert.equal(buyer.supportReviewEligible,true);
   assert.equal((await ContactHubService.list({source:'registered',q:phone,permission:'suppressed'})).total,2);
   assert.equal((await ContactHubService.preview({filters:{source:'registered',q:phone},purpose:'marketing'})).uniqueNumbers,0);
   const settings=(await pool.query('SELECT paused,auto_enabled FROM mysteryhub_sms.settings')).rows[0];assert.deepEqual(settings,{paused:true,auto_enabled:false});
   assert.equal((await pool.query('SELECT count(*)::int AS n FROM mysteryhub_sms.messages')).rows[0].n,0);
  });
  const counts=(await pool.query('SELECT (SELECT COUNT(*)::int FROM finance_ledger) AS ledger,(SELECT COUNT(*)::int FROM order_resolution_events) AS resolutions')).rows[0];assert.equal(counts.ledger,0);assert.equal(counts.resolutions,0);
 }finally{mock.restoreAll();await getPool()?.end();await observer.end();delete process.env.DATABASE_URL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;}
});
