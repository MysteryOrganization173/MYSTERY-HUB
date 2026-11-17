import {randomUUID} from 'node:crypto';
import {getPool} from '../db/connection.js';
import {arkeselConfig,ArkeselClient,ArkeselError,signingFingerprint} from './arkesel.js';
import {smsInstalled,smsTransaction} from './store.js';
import {orderRecipients,resolveAudience,digest,suppressed} from './policy.js';
import {applyReport,SmsService} from './service.js';
import {smsEstimate} from '../../src/utils/manualSms.js';
export const smsWorkerHealth={running:false,lastTick:null as string|null,lastCode:null as string|null};
export async function expandSmsEvents(){const config=arkeselConfig();if(!config.auto)return;
 return smsTransaction(async c=>{const s=(await c.query('SELECT * FROM mysteryhub_sms.settings WHERE id=true FOR SHARE')).rows[0];if(s.paused||!s.auto_enabled||!s.cutoff)return;
  // Repairs optional guest-trigger failures using current truth; no pre-cutoff records are visited.
  for(const [suffix,template,condition] of [['payment','payment_confirmed',"o.payment_status='success' AND o.paid_at IS NOT NULL"],['delivered','order_delivered',"o.status='delivered' AND o.delivered_at IS NOT NULL"],['attention','delivery_attention',"COALESCE(o.manual_review,false)"],['refund:' ,'refund_update',"o.resolution_json->>'outcome' IN ('paystack_refund','wallet_refund') AND o.resolution_json->>'stage' IN ('refund_pending','resolved')"]]){
   const key=suffix==='refund:'?"'refund:'||(o.resolution_json->>'stage')":`'${suffix}'`;
   await c.query(`INSERT INTO mysteryhub_sms.guest_events(order_id,event_key,template_id) SELECT o.id,o.id||':sms:'||${key},$2 FROM orders o WHERE o.user_id IS NULL AND o.created_at>=$1 AND o.payment_status='success' AND (${condition}) AND NOT EXISTS(SELECT 1 FROM mysteryhub_sms.guest_events e WHERE e.event_key=o.id||':sms:'||${key}) ORDER BY o.created_at LIMIT 25 ON CONFLICT DO NOTHING`,[s.cutoff,template]);
  }
  const events=(await c.query(`SELECT * FROM (SELECT id::text,order_id,event_key,template_id,created_at,'push' AS source FROM mysteryhub_notifications.events UNION ALL SELECT id::text,order_id,event_key,template_id,created_at,'guest' AS source FROM mysteryhub_sms.guest_events) e WHERE e.created_at>=$1 AND NOT EXISTS(SELECT 1 FROM mysteryhub_sms.consumed_events x WHERE x.event_key=e.source||':'||e.id) ORDER BY created_at,id LIMIT 25`,[s.cutoff])).rows;
  for(const e of events){const inserted=await c.query('INSERT INTO mysteryhub_sms.consumed_events(event_key) VALUES($1) ON CONFLICT DO NOTHING RETURNING event_key',[e.source+':'+e.id]);if(!inserted.rowCount)continue;if(!s.auto_types.includes(e.template_id))continue;
   const order=(await c.query('SELECT created_at FROM orders WHERE id=$1',[e.order_id])).rows[0];if(!order||+new Date(order.created_at)<+new Date(s.cutoff))continue;
   // Each event is evaluated from current authoritative evidence; invalid/stale/reseller events are consumed but never sent.
   let result;try{result=await orderRecipients(c,e.order_id,e.template_id,s.recipient_updates,true);}catch(error){if((error as any)?.status===409||(error as any)?.status===400)continue;throw error;}
   for(const r of result.recipients)await c.query("INSERT INTO mysteryhub_sms.messages(event_key,order_id,user_id,purpose,origin,recipient,body,sender,sandbox,estimated_segments,context) VALUES($1,$2,$3,'transactional','automatic',$4,$5,$6,$7,$8,$9) ON CONFLICT(event_key) DO NOTHING",[digest([e.order_id,r.templateId,r.phone]),e.order_id,r.userId,r.phone,result.body,config.sender,config.sandbox,smsEstimate(result.body).segments,JSON.stringify({role:r.role,templateId:r.templateId})]);
  }
 });
}
export async function claimSms(credits:number){return smsTransaction(async c=>{
 await c.query("SELECT pg_advisory_xact_lock(hashtextextended('sms:submission-budget',0))");
 await c.query("UPDATE mysteryhub_sms.messages SET state='cancelled',error_code='QUEUE_REVIEW_EXPIRED' WHERE state='queued' AND created_at<now()-interval '24 hours'");
 await c.query("UPDATE mysteryhub_sms.messages SET state='uncertain',error_code='PROCESS_INTERRUPTED',updated_at=now() WHERE state='submission_started' AND lease_until<now()");
 await c.query("UPDATE mysteryhub_sms.attempts SET state='uncertain',error_code='PROCESS_INTERRUPTED',finished_at=now() WHERE message_id IN (SELECT id FROM mysteryhub_sms.messages WHERE state='uncertain' AND error_code='PROCESS_INTERRUPTED') AND finished_at IS NULL");
 const config=arkeselConfig(),s=(await c.query('SELECT * FROM mysteryhub_sms.settings WHERE id=true FOR SHARE')).rows[0];if(!config.sendAllowed||s.paused||!config.sandbox&&s.signing_fingerprint!==signingFingerprint(config))return null;
 const m=(await c.query("SELECT * FROM mysteryhub_sms.messages WHERE state='queued' AND sandbox=$1 ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED",[config.sandbox])).rows[0];if(!m)return null;
 const use=(await c.query(`SELECT COALESCE(SUM(estimated_segments) FILTER(WHERE network_started_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0)::int AS total,COALESCE(SUM(estimated_segments) FILTER(WHERE origin='automatic' AND network_started_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0)::int AS auto,COALESCE(SUM(estimated_segments) FILTER(WHERE network_started_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' OR state IN ('submission_started','uncertain','accepted')),0)::int AS floor_reserve,count(*) FILTER(WHERE network_started_at>now()-interval '1 minute')::int AS recent FROM mysteryhub_sms.messages WHERE sandbox=$1 AND network_started_at IS NOT NULL`,[config.sandbox])).rows[0];
 if(!config.daily||!config.autoDaily||use.total+m.estimated_segments>config.daily||m.origin==='automatic'&&use.auto+m.estimated_segments>config.autoDaily||use.recent>=10||credits-use.floor_reserve<m.estimated_segments+config.lowCredits)return null;
 if(m.origin==='automatic'&&(!config.auto||!s.auto_enabled)){await c.query("UPDATE mysteryhub_sms.messages SET state='cancelled',error_code='AUTO_DISABLED' WHERE id=$1",[m.id]);return null;}
 const lease=randomUUID();await c.query("UPDATE mysteryhub_sms.messages SET state='submission_started',network_started_at=now(),claim=$2,lease_until=now()+interval '90 seconds',updated_at=now() WHERE id=$1",[m.id,lease]);await c.query("INSERT INTO mysteryhub_sms.attempts(id,message_id,state) VALUES($1,$2,'submission_started')",[lease,m.id]);return {...m,claim:lease};
 });}
async function revalidate(m:any){return smsTransaction(async c=>{const config=arkeselConfig(),s=(await c.query('SELECT * FROM mysteryhub_sms.settings WHERE id=true')).rows[0];if(!config.sendAllowed||config.sandbox!==m.sandbox||config.sender!==m.sender||s.paused||!config.sandbox&&s.signing_fingerprint!==signingFingerprint(config))return false;
 const current=(await c.query("SELECT state,claim FROM mysteryhub_sms.messages WHERE id=$1",[m.id])).rows[0];if(current?.state!=='submission_started'||current.claim!==m.claim)return false;
 if(m.origin==='manual'){
  const campaign=(await c.query("SELECT ca.*,p.input AS audience_input FROM mysteryhub_sms.campaigns ca JOIN mysteryhub_sms.previews p ON p.id=ca.preview_id JOIN sessions se ON se.token_hash=ca.session_hash AND se.expires_at>now() JOIN users u ON u.id=ca.actor_id AND u.id=se.user_id WHERE ca.id=$1 AND ca.state='queued' AND u.role='admin' AND u.status='active' AND NOT u.must_change_password",[m.campaign_id])).rows[0];if(!campaign)return false;
  const audience=await resolveAudience(c,campaign.audience_input);return audience.body===m.body&&audience.recipients.some(r=>r.phone===m.recipient);
 }
 if(!config.auto||!s.auto_enabled)return false;const evidence=await orderRecipients(c,m.order_id,m.context.templateId,s.recipient_updates,true);return evidence.body===m.body&&evidence.recipients.some(r=>r.phone===m.recipient&&r.role===m.context.role);
 });}
export async function smsTick(api=new ArkeselClient()){
 const config=arkeselConfig();if(!config.sendAllowed||!config.worker||!await smsInstalled())return {disabled:true};
 const db=getPool()!;const paused=(await db.query('SELECT paused FROM mysteryhub_sms.settings WHERE id=true')).rows[0]?.paused!==false;if(paused)return {paused:true};await expandSmsEvents();await db.query('UPDATE mysteryhub_sms.settings SET heartbeat=now() WHERE id=true');
 const fingerprint=signingFingerprint(config),balance=await api.balance();if(fingerprint!==signingFingerprint())return {configurationChanged:true};await db.query('UPDATE mysteryhub_sms.settings SET balance=$1,last_balance_at=now() WHERE id=true',[JSON.stringify({...balance,_configFingerprint:fingerprint})]);
 const m=await claimSms(balance.smsCredits);if(!m)return {idle:true};
 let state='uncertain',id:string|null=null,code:string|null=null,attempted=false;
 try{if(!await revalidate(m)){state='cancelled';code='REVIEW_OR_PERMISSION_CHANGED';}else{attempted=true;const result=(await api.send(m.body,[m.recipient]))[0];state=result.state==='accepted'?'accepted':result.state==='rejected'?'failed':'uncertain';id=result.id;code=result.state==='uncertain'?'ACCEPTANCE_UNKNOWN':result.state==='rejected'?'INVALID_RECIPIENT':null;}}
 catch(error){state=!attempted?'cancelled':error instanceof ArkeselError&&!error.uncertain?'failed':'uncertain';code=error instanceof ArkeselError?error.code:'OUTCOME_UNKNOWN';}
 await persistSmsOutcome(m,state,id,code);
 return {processed:true,state};
}
export function startSmsWorker(){if(!arkeselConfig().worker||!arkeselConfig().sendAllowed){void disableStoredSmsPolicy();return ()=>{};}let busy=false,stopped=false,next=0,nextReports=0,nextPrune=0;const api=new ArkeselClient();smsWorkerHealth.running=true;
 const timer=setInterval(async()=>{if(busy||stopped||Date.now()<next)return;busy=true;try{await smsTick(api);if(Date.now()>nextPrune){await SmsService.prune();nextPrune=Date.now()+3600000;}if(Date.now()>nextReports){await reconcileSms(api);nextReports=Date.now()+60000;}smsWorkerHealth.lastTick=new Date().toISOString();smsWorkerHealth.lastCode=null;next=Date.now()+5000;}catch{smsWorkerHealth.lastCode='SMS_WORKER_UNAVAILABLE';next=Date.now()+60000;}finally{busy=false;}},5000);timer.unref();return ()=>{stopped=true;clearInterval(timer);smsWorkerHealth.running=false;};}
export async function reconcileSms(api=new ArkeselClient()){
 if(!await smsInstalled())return;const rows=await smsTransaction(async c=>(await c.query("WITH selected AS (SELECT id FROM mysteryhub_sms.messages WHERE NOT redacted AND provider_id IS NOT NULL AND state IN ('accepted','uncertain') ORDER BY updated_at,id LIMIT 20 FOR UPDATE SKIP LOCKED) UPDATE mysteryhub_sms.messages m SET updated_at=now() FROM selected s WHERE m.id=s.id RETURNING m.provider_id,m.recipient")).rows);if(!rows.length)return;const reports=await api.reports(rows.map(r=>r.provider_id));await smsTransaction(async c=>{for(const r of reports)await applyReport(c,r.id,r.status,Math.floor(Date.now()/1000),{digest:digest(['poll',r.id,r.status,r.segments]),phone:r.phone,segments:r.segments});});
}

async function disableStoredSmsPolicy(){try{if(!await smsInstalled())return;await smsTransaction(async c=>{await c.query("UPDATE mysteryhub_sms.settings SET auto_enabled=false,paused=true,revision=revision+1 WHERE auto_enabled=true OR paused=false");await c.query("UPDATE mysteryhub_sms.messages SET state='cancelled',error_code='SERVER_SMS_DISABLED' WHERE origin='automatic' AND state='queued'");});}catch{/* No schema/configuration dependency can prevent application startup. */}}

/** The final commit may succeed even when its acknowledgement is lost; fallback never demotes stronger evidence. */
export async function persistSmsOutcome(m:any,state:string,id:string|null,code:string|null,transaction= smsTransaction,db=getPool()!){
 try{await transaction(async c=>{await c.query("UPDATE mysteryhub_sms.messages SET state=$2,provider_id=$3,error_code=$4,updated_at=now() WHERE id=$1 AND claim=$5 AND state IN ('submission_started','uncertain')",[m.id,state,id,code,m.claim]);await c.query('UPDATE mysteryhub_sms.attempts SET state=$2,error_code=$3,finished_at=now() WHERE id=$1',[m.claim,state,code]);});}
 catch{await db.query("UPDATE mysteryhub_sms.messages SET state='uncertain',error_code='RESULT_STORAGE_FAILED' WHERE id=$1 AND claim=$2 AND state='submission_started'",[m.id,m.claim]).catch(()=>{});}
}
