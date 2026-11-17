import {observeSmsSender} from './providerDiagnostics.js';
import {cancelObsoleteAutomatic} from './automatic.js';
import {recordSmsRuntime} from './runtime.js';
import {randomUUID} from 'node:crypto';
import {getPool} from '../db/connection.js';
import {arkeselConfig,ArkeselClient,ArkeselError,signingFingerprint,senderBlocked} from './arkesel.js';
import {smsInstalled,smsTransaction} from './store.js';
import {orderRecipients,resolveAudience,digest,suppressed} from './policy.js';
import {applyReport,SmsService} from './service.js';
import {smsEstimate} from '../../src/utils/manualSms.js';
export const smsWorkerHealth={running:false,lastTick:null as string|null,lastCode:null as string|null};
export {expandSmsEvents} from './automatic.js';
import {expandSmsEvents} from './automatic.js';
export async function claimSms(credits:number){return smsTransaction(async c=>{
 await c.query("SELECT pg_advisory_xact_lock(hashtextextended('sms:submission-budget',0))");
 await cancelObsoleteAutomatic(c);
 await c.query("UPDATE mysteryhub_sms.messages SET state='cancelled',error_code='QUEUE_REVIEW_EXPIRED' WHERE state='queued' AND created_at<now()-interval '24 hours'");
 await c.query("UPDATE mysteryhub_sms.messages SET state='uncertain',error_code='PROCESS_INTERRUPTED',updated_at=now() WHERE state='submission_started' AND lease_until<now()");
 await c.query("UPDATE mysteryhub_sms.attempts SET state='uncertain',error_code='PROCESS_INTERRUPTED',finished_at=now() WHERE message_id IN (SELECT id FROM mysteryhub_sms.messages WHERE state='uncertain' AND error_code='PROCESS_INTERRUPTED') AND finished_at IS NULL");
 const config=arkeselConfig(),s=(await c.query('SELECT * FROM mysteryhub_sms.settings WHERE id=true FOR SHARE')).rows[0];if(!config.sendAllowed||s.paused||senderBlocked(s.balance?._providerSender,config)||!config.sandbox&&s.signing_fingerprint!==signingFingerprint(config))return null;
 const m=(await c.query("SELECT * FROM mysteryhub_sms.messages WHERE state='queued' AND sandbox=$1 ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED",[config.sandbox])).rows[0];if(!m)return null;
 const use=(await c.query(`SELECT COALESCE(SUM(estimated_segments) FILTER(WHERE network_started_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0)::int AS total,COALESCE(SUM(estimated_segments) FILTER(WHERE origin='automatic' AND network_started_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0)::int AS auto,COALESCE(SUM(estimated_segments) FILTER(WHERE network_started_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' OR state IN ('submission_started','uncertain','accepted')),0)::int AS floor_reserve,count(*) FILTER(WHERE network_started_at>now()-interval '1 minute')::int AS recent FROM mysteryhub_sms.messages WHERE sandbox=$1 AND network_started_at IS NOT NULL`,[config.sandbox])).rows[0];
 if(!config.daily||!config.autoDaily||use.total+m.estimated_segments>config.daily||m.origin==='automatic'&&use.auto+m.estimated_segments>config.autoDaily||use.recent>=10||credits-use.floor_reserve<m.estimated_segments+config.lowCredits)return null;
 if(m.origin==='automatic'&&(!config.auto||!s.auto_enabled)){await c.query("UPDATE mysteryhub_sms.messages SET state='cancelled',error_code='AUTO_DISABLED' WHERE id=$1",[m.id]);return null;}
 const lease=randomUUID();await c.query("UPDATE mysteryhub_sms.messages SET state='submission_started',network_started_at=now(),claim=$2,lease_until=now()+interval '90 seconds',updated_at=now() WHERE id=$1",[m.id,lease]);await c.query("INSERT INTO mysteryhub_sms.attempts(id,message_id,state) VALUES($1,$2,'submission_started')",[lease,m.id]);return {...m,claim:lease};
 });}
async function revalidate(m:any){return smsTransaction(async c=>{const config=arkeselConfig(),s=(await c.query('SELECT * FROM mysteryhub_sms.settings WHERE id=true')).rows[0];if(!config.sendAllowed||config.sandbox!==m.sandbox||config.sender!==m.sender||s.paused||senderBlocked(s.balance?._providerSender,config)||!config.sandbox&&s.signing_fingerprint!==signingFingerprint(config))return false;
 const current=(await c.query("SELECT state,claim FROM mysteryhub_sms.messages WHERE id=$1",[m.id])).rows[0];if(current?.state!=='submission_started'||current.claim!==m.claim)return false;
 if(m.origin==='manual'){
  const campaign=(await c.query("SELECT ca.*,p.input AS audience_input FROM mysteryhub_sms.campaigns ca JOIN mysteryhub_sms.previews p ON p.id=ca.preview_id JOIN sessions se ON se.token_hash=ca.session_hash AND se.expires_at>now() JOIN users u ON u.id=ca.actor_id AND u.id=se.user_id WHERE ca.id=$1 AND ca.state='queued' AND u.role='admin' AND u.status='active' AND NOT u.must_change_password",[m.campaign_id])).rows[0];if(!campaign)return false;
  const audience=await resolveAudience(c,campaign.audience_input);return audience.body===m.body&&audience.recipients.some(r=>r.phone===m.recipient);
 }
 if(!config.auto||!s.auto_enabled||m.context.experienceVersion!==2||!s.auto_types.includes(m.context.eventType)||!s.cutoff)return false;const order=(await c.query('SELECT created_at FROM orders WHERE id=$1',[m.order_id])).rows[0];if(!order||+new Date(order.created_at)<+new Date(s.cutoff))return false;const evidence=await orderRecipients(c,m.order_id,m.context.templateId,s.recipient_updates,true);return evidence.body===m.body&&evidence.recipients.some(r=>r.phone===m.recipient&&r.role===m.context.role);
 });}
export async function smsTick(api=new ArkeselClient()){
 const config=arkeselConfig();if(!config.sendAllowed||!config.worker||!await smsInstalled())return {disabled:true};
 const db=getPool()!;const settings=(await db.query('SELECT paused,balance FROM mysteryhub_sms.settings WHERE id=true')).rows[0];if(senderBlocked(settings?.balance?._providerSender,config))return {providerBlocked:true};const paused=settings?.paused!==false;if(paused)return {paused:true};await expandSmsEvents();await db.query('UPDATE mysteryhub_sms.settings SET heartbeat=now() WHERE id=true');
 const fingerprint=signingFingerprint(config),balance=await api.balance();if(fingerprint!==signingFingerprint())return {configurationChanged:true};await db.query("UPDATE mysteryhub_sms.settings SET balance=COALESCE(balance,'{}'::jsonb)||$1::jsonb,last_balance_at=now() WHERE id=true",[JSON.stringify({...balance,_configFingerprint:fingerprint})]);
 const m=await claimSms(balance.smsCredits);if(!m)return {idle:true};
 let state='uncertain',id:string|null=null,code:string|null=null,attempted=false;
 try{if(!await revalidate(m)){state='cancelled';code='REVIEW_OR_PERMISSION_CHANGED';}else{attempted=true;const result=(await api.send(m.body,[m.recipient]))[0];state=result.state==='accepted'?'accepted':result.state==='rejected'?'failed':'uncertain';id=result.id;code=result.state==='uncertain'?'ACCEPTANCE_UNKNOWN':result.state==='rejected'?'INVALID_RECIPIENT':null;}}
 catch(error){state=!attempted?'cancelled':error instanceof ArkeselError&&!error.uncertain?'failed':'uncertain';code=error instanceof ArkeselError?error.code+(error.details?.fields.length?':'+error.details.fields.join(','):''):'OUTCOME_UNKNOWN';}
 await persistSmsOutcome(m,state,id,code);
 return {processed:true,state};
}
export function startSmsWorker(){void recordSmsRuntime();const observation=setInterval(()=>void recordSmsRuntime(),30000);observation.unref();if(!arkeselConfig().worker||!arkeselConfig().sendAllowed){void disableStoredSmsPolicy();return ()=>clearInterval(observation);}let busy=false,stopped=false,next=0,nextReports=0,nextPrune=0,nextSenderCheck=0;const api=new ArkeselClient();smsWorkerHealth.running=true;
 const timer=setInterval(async()=>{if(busy||stopped||Date.now()<next)return;busy=true;try{if(Date.now()>nextSenderCheck){await observeSmsSender(api);nextSenderCheck=Date.now()+600000;}await smsTick(api);if(Date.now()>nextPrune){await SmsService.prune();nextPrune=Date.now()+3600000;}if(Date.now()>nextReports){await reconcileSms(api);nextReports=Date.now()+60000;}smsWorkerHealth.lastTick=new Date().toISOString();smsWorkerHealth.lastCode=null;next=Date.now()+5000;}catch{smsWorkerHealth.lastCode='SMS_WORKER_UNAVAILABLE';next=Date.now()+60000;}finally{busy=false;}},5000);timer.unref();return ()=>{stopped=true;clearInterval(observation);clearInterval(timer);smsWorkerHealth.running=false;};}
export async function reconcileSms(api=new ArkeselClient()){
 if(!await smsInstalled())return;const rows=await smsTransaction(async c=>(await c.query("WITH selected AS (SELECT id FROM mysteryhub_sms.messages WHERE NOT redacted AND provider_id IS NOT NULL AND state IN ('accepted','uncertain') ORDER BY updated_at,id LIMIT 20 FOR UPDATE SKIP LOCKED) UPDATE mysteryhub_sms.messages m SET updated_at=now() FROM selected s WHERE m.id=s.id RETURNING m.provider_id,m.recipient")).rows);if(!rows.length)return;const reports=await api.reports(rows.map(r=>r.provider_id));await smsTransaction(async c=>{for(const r of reports)await applyReport(c,r.id,r.status,Math.floor(Date.now()/1000),{digest:digest(['poll',r.id,r.status,r.segments]),phone:r.phone,segments:r.segments});});
}

async function disableStoredSmsPolicy(){try{if(!await smsInstalled())return;await smsTransaction(async c=>{await c.query("UPDATE mysteryhub_sms.settings SET auto_enabled=false,paused=true,revision=revision+1 WHERE auto_enabled=true OR paused=false");await c.query("UPDATE mysteryhub_sms.messages SET state='cancelled',error_code='SERVER_SMS_DISABLED' WHERE origin='automatic' AND state='queued'");});}catch{/* No schema/configuration dependency can prevent application startup. */}}

/** The final commit may succeed even when its acknowledgement is lost; fallback never demotes stronger evidence. */
export async function persistSmsOutcome(m:any,state:string,id:string|null,code:string|null,transaction= smsTransaction,db=getPool()!){
 try{await transaction(async c=>{await c.query("UPDATE mysteryhub_sms.messages SET state=$2,provider_id=$3,error_code=$4,updated_at=now() WHERE id=$1 AND claim=$5 AND state IN ('submission_started','uncertain')",[m.id,state,id,code,m.claim]);await c.query('UPDATE mysteryhub_sms.attempts SET state=$2,error_code=$3,finished_at=now() WHERE id=$1',[m.claim,state,code]);});}
 catch{await db.query("UPDATE mysteryhub_sms.messages SET state='uncertain',error_code='RESULT_STORAGE_FAILED' WHERE id=$1 AND claim=$2 AND state='submission_started'",[m.id,m.claim]).catch(()=>{});}
}
