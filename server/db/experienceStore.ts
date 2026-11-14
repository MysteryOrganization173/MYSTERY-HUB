import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {getPool} from './connection.js';
import {AdminAuditStore} from './adminAuditStore.js';
import {EXPERIENCE_ID,PHASES,EXPERIENCE_EVENTS,type ExperienceConfig,type GreetingInput,type PublicGreeting,type ExperienceEvent} from '../../shared/mysteryExperiences.js';
import {ExperienceError,CREATOR_TOKEN,SHARE_ID,UUID,objectInput} from '../services/experienceValidation.js';

let active=0;
/** Optional workload shares the existing pool, at most two transactions/process. No production memory fallback. */
export async function experienceTransaction<T>(work:(client:PoolClient)=>Promise<T>,readOnly=false):Promise<T>{
 if(active>=2)throw new ExperienceError('BUSY',429);
 const pool=getPool();if(!pool)throw new ExperienceError('STORAGE_UNAVAILABLE',503);
 active++;let client:PoolClient|undefined;
 try{client=await pool.connect();await client.query(readOnly?'BEGIN READ ONLY':'BEGIN');await client.query("SET LOCAL statement_timeout='2000ms'");await client.query("SET LOCAL lock_timeout='500ms'");await client.query("SET LOCAL idle_in_transaction_session_timeout='5000ms'");const result=await work(client);await client.query('COMMIT');return result;}
 catch(e){if(client)await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client?.release();active--;}
}
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const iso=(value:any)=>value instanceof Date?value.toISOString():value;
const normalizeConfig=(row:any):ExperienceConfig=>({...row,starts_at:iso(row.starts_at),ends_at:iso(row.ends_at),updated_at:iso(row.updated_at),override_until:iso(row.override_until)});
const privateGreeting=(row:any):PublicGreeting=>({schemaVersion:1,shareId:row.share_id,occasion:row.occasion,recipientName:row.recipient_name,senderName:row.show_sender?row.sender_name:null,message:row.message,variant:row.variant,expiresAt:iso(row.expires_at)});
export function abuseIdentity(peer:string):string {
 const key=process.env.EXPERIENCES_ABUSE_SECRET||'';
 if(!/^[a-f0-9]{64}$/i.test(key))throw new ExperienceError('CONFIGURATION_UNAVAILABLE',503);
 // Never retain a raw address; daily rotation limits correlation. No arbitrary Forwarded headers.
 return createHmac('sha256',key).update(new Date().toISOString().slice(0,10)+':'+peer).digest('hex');
}
async function budget(c:PoolClient,scope:string,max:number,seconds:number,credits=1){
 const result=await c.query(`INSERT INTO mysteryhub_experiences.budgets(scope,bucket,hits) VALUES($1,to_timestamp(floor(extract(epoch FROM now())/$3)*$3),$4) ON CONFLICT(scope,bucket) DO UPDATE SET hits=mysteryhub_experiences.budgets.hits+$4 WHERE mysteryhub_experiences.budgets.hits+$4<=$2 RETURNING hits`,[scope,max,seconds,credits]);
 if(!result.rowCount)throw new ExperienceError('RATE_LIMITED',429);
}
async function cleanBudgets(c:PoolClient){await c.query("DELETE FROM mysteryhub_experiences.budgets WHERE ctid IN (SELECT ctid FROM mysteryhub_experiences.budgets WHERE bucket<now()-interval '48 hours' LIMIT 100)");}
async function optionalCreated(c:PoolClient,row:any){
 await c.query('SAVEPOINT experience_analytics');
 try{await c.query(`INSERT INTO analytics_events(id,event_name,entity_type,entity_id,metadata_json) VALUES($1,'experience_greeting_created','experience',$2,$3) ON CONFLICT DO NOTHING`,['evt_'+randomUUID(),row.id,JSON.stringify({occasion:row.occasion})]);}
 catch{await c.query('ROLLBACK TO SAVEPOINT experience_analytics');}finally{await c.query('RELEASE SAVEPOINT experience_analytics');}
}
export class ExperienceStore {
 private static configFlight:Promise<ExperienceConfig>|null=null;
 private static reads={remaining:0,until:0,flight:null as Promise<void>|null};
 static async admit(peer:string,kind:'create'|'manage'){
  return experienceTransaction(async c=>{
   await cleanBudgets(c);
   await budget(c,kind+'-request:'+peer,kind==='create'?240:60,3600);await budget(c,kind+'-request:global',kind==='create'?20000:3000,86400);
  });
 }
 private static async admitRead(){
  // Leased global admission is durable across processes; at most one quota write per100 reads/process/minute.
  while(this.reads.remaining<=0||this.reads.until<=Date.now()){
   if(!this.reads.flight)this.reads.flight=experienceTransaction(async c=>{await cleanBudgets(c);await budget(c,'read:global',60000,60,100);}).then(()=>{this.reads.remaining=100;this.reads.until=Math.min(Date.now()+30000,Math.floor(Date.now()/60000)*60000+60000);}).finally(()=>{this.reads.flight=null;});
   await this.reads.flight;
  }
  this.reads.remaining--;
 }

 static async configuration(){if(this.configFlight)return this.configFlight;this.configFlight=experienceTransaction(async c=>{const row=(await c.query('SELECT * FROM mysteryhub_experiences.configuration WHERE id=$1',[EXPERIENCE_ID])).rows[0];if(!row)throw new ExperienceError('STORAGE_UNAVAILABLE',503);return normalizeConfig(row);},true).finally(()=>{this.configFlight=null;});return this.configFlight;}
 static async configure(actor:string,input:unknown,now=new Date()){
  const v=objectInput(input,['expectedRevision','lifecycle','enabled','previewEnabled','override']);
  if(!Number.isSafeInteger(v.expectedRevision)||!['draft','approved','archived'].includes(v.lifecycle)||typeof v.enabled!=='boolean'||typeof v.previewEnabled!=='boolean'||v.enabled&&v.lifecycle!=='approved')throw new ExperienceError('INVALID_CONFIGURATION');
  let phase:string|null=null,until:string|null=null;
  if(v.override!==null){const o=objectInput(v.override,['phase','until']);if(!PHASES.includes(o.phase)||typeof o.until!=='string'||!Number.isFinite(Date.parse(o.until))||Date.parse(o.until)<=now.getTime()||Date.parse(o.until)>now.getTime()+86400000||!v.enabled)throw new ExperienceError('INVALID_OVERRIDE');phase=o.phase;until=new Date(o.until).toISOString();}
  return experienceTransaction(async c=>{
   const old=(await c.query('SELECT * FROM mysteryhub_experiences.configuration WHERE id=$1 FOR UPDATE',[EXPERIENCE_ID])).rows[0];
   if(!old)throw new ExperienceError('STORAGE_UNAVAILABLE',503);if(old.revision!==v.expectedRevision)throw new ExperienceError('REVISION_CONFLICT',409);
   const next=(await c.query('UPDATE mysteryhub_experiences.configuration SET lifecycle=$2,enabled=$3,preview_enabled=$4,override_phase=$5,override_until=$6,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *',[EXPERIENCE_ID,v.lifecycle,v.enabled,v.previewEnabled,phase,until])).rows[0];
   await AdminAuditStore.record({adminUserId:actor,action:'experience_configured',entityType:'experience',entityId:EXPERIENCE_ID,metadata:{previous:normalizeConfig(old),next:normalizeConfig(next)}},c);return normalizeConfig(next);
  });
 }
 static async audit(){return experienceTransaction(async c=>(await c.query("SELECT id,action,admin_user_id,metadata_safe_json,created_at FROM admin_audit_log WHERE entity_type='experience' ORDER BY created_at DESC LIMIT 30")).rows,true);}
 static async create(value:GreetingInput,token:string,key:string,peer:string,analytics:boolean,makeShare=()=>randomBytes(18).toString('base64url')){
  await this.admit(peer,'create');
  const {parentShareId:_,...content}=value;
  const creator=hash(token),digest=hash(JSON.stringify(content));
  return experienceTransaction(async c=>{
   // Creator lock covers identical retries, changed-key duplicate content and management operations.
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['greeting:'+creator]);
   const old=(await c.query('SELECT * FROM mysteryhub_experiences.greetings WHERE creator_hash=$1 AND idempotency_key=$2',[creator,key])).rows[0];
   if(old){if(old.payload_hash!==digest)throw new ExperienceError('IDEMPOTENCY_CONFLICT',409);if(old.revoked_at||new Date(old.expires_at).getTime()<=Date.now())throw new ExperienceError('GREETING_UNAVAILABLE',404);return {greeting:privateGreeting(old),duplicate:true};}
   if((await c.query("SELECT 1 FROM mysteryhub_experiences.greetings WHERE creator_hash=$1 AND payload_hash=$2 AND created_at>now()-interval '10 minutes' LIMIT 1",[creator,digest])).rowCount)throw new ExperienceError('DUPLICATE_CONTENT',409);
   if((await c.query("SELECT 1 FROM mysteryhub_experiences.greetings WHERE expires_at<now()-interval '30 days' OR revoked_at<now()-interval '30 days' LIMIT 1")).rowCount)throw new ExperienceError('RETENTION_REQUIRED',503);
   await budget(c,'create:'+peer,20,3600);await budget(c,'create:global',1000,86400);
   let parent:null|string=null;
   if(analytics&&value.parentShareId){parent=(await c.query('SELECT id FROM mysteryhub_experiences.greetings WHERE share_id=$1 AND revoked_at IS NULL AND expires_at>now()',[value.parentShareId])).rows[0]?.id;if(!parent)throw new ExperienceError('INVALID_PARENT');}
   for(let i=0;i<5;i++){
    const share=makeShare();if(!SHARE_ID.test(share))throw new ExperienceError('IDENTIFIER_UNAVAILABLE',503);
    const row=(await c.query(`INSERT INTO mysteryhub_experiences.greetings(id,share_id,creator_hash,idempotency_key,payload_hash,occasion,recipient_name,sender_name,show_sender,template_id,message,variant,parent_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now()+interval '365 days') ON CONFLICT(share_id) DO NOTHING RETURNING *`,[randomUUID(),share,creator,key,digest,value.occasion,value.recipientName,value.senderName,value.showSender,value.templateId,value.message,value.variant,parent])).rows[0];
    if(row){if(analytics)await optionalCreated(c,row);return {greeting:privateGreeting(row),duplicate:false};}
   }
   throw new ExperienceError('IDENTIFIER_UNAVAILABLE',503);
  });
 }
 static async exists(share:string){if(!SHARE_ID.test(share))return false;await this.admitRead();return experienceTransaction(async c=>Boolean((await c.query('SELECT 1 FROM mysteryhub_experiences.greetings WHERE share_id=$1 AND revoked_at IS NULL AND expires_at>now()',[share])).rowCount),true);}
 static async greeting(share:string){
  if(!SHARE_ID.test(share))throw new ExperienceError('GREETING_UNAVAILABLE',404);
  await this.admitRead();
  return experienceTransaction(async c=>{const row=(await c.query('SELECT share_id,occasion,recipient_name,sender_name,show_sender,message,variant,expires_at FROM mysteryhub_experiences.greetings WHERE share_id=$1 AND revoked_at IS NULL AND expires_at>now()',[share])).rows[0];if(!row)throw new ExperienceError('GREETING_UNAVAILABLE',404);return privateGreeting(row);},true);
 }
 static async revoke(share:string,token:string,peer:string){
  if(!SHARE_ID.test(share)||!CREATOR_TOKEN.test(token))throw new ExperienceError('GREETING_UNAVAILABLE',404);
  await this.admit(peer,'manage');
  return experienceTransaction(async c=>{
   const row=(await c.query('UPDATE mysteryhub_experiences.greetings SET revoked_at=coalesce(revoked_at,now()) WHERE share_id=$1 AND creator_hash=$2 RETURNING id',[share,hash(token)])).rows[0];if(!row)throw new ExperienceError('GREETING_UNAVAILABLE',404);return {revoked:true};
  });
 }
 static async report(share:string,peer:string,reason:string){
  if(!SHARE_ID.test(share)||!['abuse','spam','privacy'].includes(reason))throw new ExperienceError('INVALID_REPORT');
  return experienceTransaction(async c=>{await cleanBudgets(c);await budget(c,'report:'+peer,10,86400);await budget(c,'report:global',1000,86400);await c.query(`INSERT INTO mysteryhub_experiences.reports(greeting_id,reporter_hash,reason) SELECT id,$2,$3 FROM mysteryhub_experiences.greetings WHERE share_id=$1 AND revoked_at IS NULL AND expires_at>now() ON CONFLICT DO NOTHING`,[share,peer,reason]);return {accepted:true};});
 }
 static async reports(){return experienceTransaction(async c=>(await c.query('SELECT g.share_id,count(*)::int reports,min(r.created_at) first_report,max(r.created_at) last_report FROM mysteryhub_experiences.reports r JOIN mysteryhub_experiences.greetings g ON g.id=r.greeting_id WHERE g.revoked_at IS NULL GROUP BY g.id ORDER BY count(*) DESC,g.id LIMIT 50')).rows,true);}
 static async moderate(actor:string,share:string){
  if(!SHARE_ID.test(share))throw new ExperienceError('GREETING_UNAVAILABLE',404);
  return experienceTransaction(async c=>{const row=(await c.query('UPDATE mysteryhub_experiences.greetings SET revoked_at=coalesce(revoked_at,now()) WHERE share_id=$1 RETURNING id',[share])).rows[0];if(!row)throw new ExperienceError('GREETING_UNAVAILABLE',404);await AdminAuditStore.record({adminUserId:actor,action:'greeting_revoked',entityType:'experience',entityId:row.id,metadata:{reason:'abuse_review'}},c);return {revoked:true};});
 }
 static async event(event:ExperienceEvent,share:string|undefined,visitor:string,session:string,peer:string){
  if(!EXPERIENCE_EVENTS.includes(event)||!UUID.test(visitor)||!UUID.test(session)||share!==undefined&&!SHARE_ID.test(share)||event.startsWith('greeting_')&&!share)throw new ExperienceError('INVALID_EVENT');
  return experienceTransaction(async c=>{
   let entity='countdown';if(share){entity=(await c.query('SELECT id FROM mysteryhub_experiences.greetings WHERE share_id=$1 AND revoked_at IS NULL AND expires_at>now()',[share])).rows[0]?.id;if(!entity)throw new ExperienceError('GREETING_UNAVAILABLE',404);}
   const inserted=await c.query(`INSERT INTO analytics_events(id,event_name,visitor_id,session_id,entity_type,entity_id,metadata_json) VALUES($1,$2,$3,$4,'experience',$5,'{}') ON CONFLICT DO NOTHING RETURNING id`,['evt_'+randomUUID(),'experience_'+event,visitor,session,entity]);
   if(inserted.rowCount){await cleanBudgets(c);await budget(c,'event:'+peer,180,3600);await budget(c,'event:global',10000,86400);}return {accepted:true,duplicate:!inserted.rowCount};
  });
 }
 static async metrics(days=30){
  if(![7,30,90].includes(days))throw new ExperienceError('INVALID_RANGE');
  return experienceTransaction(async c=>({days,...(await c.query(`SELECT count(*)::int created,count(*) FILTER(WHERE parent_id IS NOT NULL)::int remix_context,count(*) FILTER(WHERE revoked_at IS NULL AND expires_at>now())::int valid FROM mysteryhub_experiences.greetings WHERE created_at>=now()-$1*interval '1 day'`,[days])).rows[0],events:(await c.query(`SELECT event_name,count(*)::int observations,count(DISTINCT visitor_id)::int estimated_browsers FROM analytics_events WHERE entity_type='experience' AND created_at>=now()-$1*interval '1 day' GROUP BY event_name ORDER BY event_name`,[days])).rows,conversions:null,limitations:['Client events are estimates, not verified humans or sales.','Cross-device identity and WhatsApp delivery are not measured.','Use existing Campaign Manager for authoritative attributed orders.']}),true);
 }
 static async maintenance(actor:string){return experienceTransaction(async c=>{
  const greetings=await c.query("DELETE FROM mysteryhub_experiences.greetings WHERE id IN (SELECT id FROM mysteryhub_experiences.greetings WHERE expires_at<now()-interval '30 days' OR revoked_at<now()-interval '30 days' LIMIT 500)");
  const budgets=await c.query("DELETE FROM mysteryhub_experiences.budgets WHERE ctid IN (SELECT ctid FROM mysteryhub_experiences.budgets WHERE bucket<now()-interval '48 hours' LIMIT 5000)");
  const events=await c.query("DELETE FROM analytics_events WHERE id IN (SELECT id FROM analytics_events WHERE entity_type='experience' AND created_at<now()-interval '90 days' LIMIT 5000)");
  const counts={greetings:greetings.rowCount,budgets:budgets.rowCount,events:events.rowCount};await AdminAuditStore.record({adminUserId:actor,action:'experience_retention',entityType:'experience',entityId:EXPERIENCE_ID,metadata:counts},c);return counts;
 });}
}
