import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {getPool} from '../db/connection.js';
import {FinanceError} from '../db/financeStore.js';
import {AdminAuditStore} from '../db/adminAuditStore.js';
import {hashSessionToken} from '../utils/crypto.js';
import {digest,encryptSubscription,decryptSubscription,pushConfiguration,validateSubscription,validateTemplate,renderTemplate} from './notificationSafety.js';

export const NOTIFICATIONS='mysteryhub_notifications';
export const requireUuid=(id:unknown)=>{if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new FinanceError('Invalid notification identifier.');return id;};
export const exact=(input:any,keys:string[])=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k)))throw new FinanceError('Unexpected notification field.');};
function db(){const pool=getPool();if(!pool)throw new FinanceError('Durable notifications require PostgreSQL.',503);return pool;}
export async function notificationTransaction<T>(work:(client:PoolClient)=>Promise<T>):Promise<T>{const c=await db().connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
async function audience(c:PoolClient,userId?:string){return (await c.query(`SELECT d.id FROM ${NOTIFICATIONS}.devices d JOIN sessions s ON s.id=d.session_id AND s.user_id=d.user_id
 JOIN users u ON u.id=d.user_id JOIN ${NOTIFICATIONS}.preferences p ON p.user_id=d.user_id
 WHERE s.expires_at>NOW() AND u.status='active' AND u.role='customer' AND COALESCE(u.must_change_password,FALSE)=FALSE AND p.marketing=TRUE AND ($1::text IS NULL OR d.user_id=$1) ORDER BY d.id LIMIT 1001`,[userId||null])).rows.map(r=>r.id as string);}
export class NotificationService {
 static config(){const c=pushConfiguration();return {enabled:c.enabled&&!!getPool(),publicKey:c.enabled?c.publicKey:null,workerPath:'/push-sw.js' as const};}
 static async preferences(userId:string){return (await db().query(`SELECT transactional,marketing FROM ${NOTIFICATIONS}.preferences WHERE user_id=$1`,[userId])).rows[0]||{transactional:true,marketing:false};}
 static async setPreferences(userId:string,input:any){exact(input,['transactional','marketing']);if(typeof input.transactional!=='boolean'||typeof input.marketing!=='boolean')throw new FinanceError('Choose transactional and marketing preferences explicitly.');return (await db().query(`INSERT INTO ${NOTIFICATIONS}.preferences(user_id,transactional,marketing) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET transactional=$2,marketing=$3,updated_at=NOW() RETURNING transactional,marketing`,[userId,input.transactional,input.marketing])).rows[0];}
 static async subscribe(userId:string,token:string,input:any){exact(input,['subscription']);if(!this.config().enabled)throw new FinanceError('Web Push is not enabled and configured.',503);const subscription=validateSubscription(input.subscription),hash=digest(subscription.endpoint);
 return notificationTransaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['notification-user:'+userId]);
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['notification-endpoint:'+hash]);
  const session=(await c.query('SELECT id FROM sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>NOW() FOR KEY SHARE',[hashSessionToken(token),userId])).rows[0];if(!session)throw new FinanceError('Sign in again before subscribing.',401);
  const previous=(await c.query(`SELECT * FROM ${NOTIFICATIONS}.devices WHERE endpoint_hash=$1 FOR UPDATE`,[hash])).rows[0];
  if(previous){const old=decryptSubscription(previous.encrypted_subscription);if(old.keys.auth!==subscription.keys.auth||old.keys.p256dh!==subscription.keys.p256dh)throw new FinanceError('Subscription ownership could not be verified.',409);}
  if(!previous||previous.user_id!==userId){const count=Number((await c.query(`SELECT COUNT(*) FROM ${NOTIFICATIONS}.devices WHERE user_id=$1`,[userId])).rows[0].count);if(count>=10)throw new FinanceError('Revoke an old notification device before adding another.',409);}
  const id=previous?.id||randomUUID();await c.query(`INSERT INTO ${NOTIFICATIONS}.devices(id,user_id,session_id,endpoint_hash,encrypted_subscription) VALUES($1,$2,$3,$4,$5)
   ON CONFLICT(endpoint_hash) DO UPDATE SET user_id=$2,session_id=$3,encrypted_subscription=$5,binding_version=${NOTIFICATIONS}.devices.binding_version+1,updated_at=NOW()`,[id,userId,session.id,hash,encryptSubscription(subscription)]);return {success:true,deviceId:id};
 });}
 static async revoke(userId:string,id:string){requireUuid(id);await db().query(`DELETE FROM ${NOTIFICATIONS}.devices WHERE id=$1 AND user_id=$2`,[id,userId]);return {success:true};}
 static async devices(userId:string,token:string){return (await db().query(`SELECT d.id,d.endpoint_hash,d.created_at,d.updated_at,(s.token_hash=$2 AND s.expires_at>NOW()) AS current_session FROM ${NOTIFICATIONS}.devices d JOIN sessions s ON s.id=d.session_id WHERE d.user_id=$1 ORDER BY d.updated_at DESC LIMIT 10`,[userId,hashSessionToken(token)])).rows;}
 static async inbox(userId:string,offset=0,id?:string){if(id)requireUuid(id);
  const rows=(await db().query(`SELECT e.id,e.created_at,e.order_id,e.label,e.template_snapshot FROM ${NOTIFICATIONS}.events e WHERE e.user_id=$1 AND ($2::uuid IS NULL OR e.id=$2) ORDER BY e.created_at DESC,e.id DESC LIMIT 25 OFFSET $3`,[userId,id||null,offset])).rows;
  if(id&&!rows.length)throw new FinanceError('Notification not found.',404);
  return rows.map(r=>({id:r.id,createdAt:r.created_at,...renderTemplate(r.template_snapshot,r.label),destination:r.order_id?'/orders':'/app'}));
 }
 static async templates(){return (await db().query(`SELECT * FROM ${NOTIFICATIONS}.templates ORDER BY locked DESC,id`)).rows;}
 static async saveTemplate(actor:string,id:string|undefined,input:any){exact(input,['id','title','body','category','enabled','expectedVersion']);const target=id||input.id;
  if(typeof target!=='string'||!/^[a-z][a-z0-9_-]{2,63}$/.test(target)||id&&input.id!==undefined&&input.id!==id)throw new FinanceError('Invalid template ID.');
  return notificationTransaction(async c=>{const existing=(await c.query(`SELECT * FROM ${NOTIFICATIONS}.templates WHERE id=$1 FOR UPDATE`,[target])).rows[0];
   if(id&&!existing)throw new FinanceError('Template not found.',404);if(!id&&existing)throw new FinanceError('Template already exists.',409);
   if(existing&&input.expectedVersion!==existing.version)throw new FinanceError('Template changed. Reload before saving.',409);
   if(existing?.locked)throw new FinanceError('Automatic transactional content is server-owned; use operational pause or customer preferences.',409);
   const value=validateTemplate(input);const row=(await c.query(`INSERT INTO ${NOTIFICATIONS}.templates(id,title,body,category,enabled) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET title=$2,body=$3,category=$4,enabled=$5,version=${NOTIFICATIONS}.templates.version+1,updated_at=NOW() RETURNING *`,[target,value.title,value.body,value.category,value.enabled])).rows[0];
   await c.query(`INSERT INTO ${NOTIFICATIONS}.template_versions(id,template_id,version,snapshot,actor_id) VALUES($1,$2,$3,$4,$5)`,[randomUUID(),target,row.version,JSON.stringify(row),actor]);
   await AdminAuditStore.record({adminUserId:actor,action:'notification_template_saved',entityType:'notification',entityId:target,metadata:{version:row.version,enabled:row.enabled}},c);return row;
  });
 }
 static async preview(templateId:string){const template=(await db().query(`SELECT * FROM ${NOTIFICATIONS}.templates WHERE id=$1`,[templateId])).rows[0];if(!template)throw new FinanceError('Template not found.',404);return {template,preview:renderTemplate(template,'Synthetic account update')};}
 static async previewAudience(actor:string,input:any){exact(input,['templateId','userId']);if(typeof input.templateId!=='string'||input.userId!==undefined&&(typeof input.userId!=='string'||input.userId.length>64))throw new FinanceError('Choose a valid template and optional customer.');
  return notificationTransaction(async c=>{const t=(await c.query(`SELECT * FROM ${NOTIFICATIONS}.templates WHERE id=$1`,[input.templateId])).rows[0];if(!t||t.category!=='marketing'||!t.enabled)throw new FinanceError('Choose an enabled marketing template.',409);
   const ids=await audience(c,input.userId);if(ids.length>1000)throw new FinanceError('Audience exceeds this release’s safe campaign limit. Select a customer instead.',409);
   const previewId=randomUUID(),hash=digest(JSON.stringify(ids));await c.query(`INSERT INTO ${NOTIFICATIONS}.audiences(id,actor_id,template_id,template_version,user_filter,device_ids,audience_hash) VALUES($1,$2,$3,$4,$5,$6,$7)`,[previewId,actor,t.id,t.version,input.userId||null,ids,hash]);
   const customers=ids.length?Number((await c.query(`SELECT COUNT(DISTINCT user_id) FROM ${NOTIFICATIONS}.devices WHERE id=ANY($1::uuid[])`,[ids])).rows[0].count):0;
   return {success:true,previewId,eligibleDevices:ids.length,eligibleCustomers:customers,expiresInSeconds:600,enabled:this.config().enabled};
  });
 }
 static async campaign(actor:string,input:any){exact(input,['previewId','requestId','confirmed']);requireUuid(input.previewId);if(input.confirmed!==true||typeof input.requestId!=='string'||!/^[a-zA-Z0-9_-]{8,64}$/.test(input.requestId))throw new FinanceError('Confirm the prepared audience with a valid request ID.');
  if(!this.config().enabled)throw new FinanceError('Real delivery is disabled until configuration is verified.',503);
  return notificationTransaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['notification-campaign:'+input.requestId]);const hash=digest(JSON.stringify([actor,input.previewId]));
   const old=(await c.query(`SELECT * FROM ${NOTIFICATIONS}.campaigns WHERE request_id=$1`,[input.requestId])).rows[0];if(old){if(old.input_hash!==hash)throw new FinanceError('Campaign request changed.',409);return {success:true,campaignId:old.id,eligibleDevices:old.recipient_count,duplicate:true};}
   const a=(await c.query(`SELECT * FROM ${NOTIFICATIONS}.audiences WHERE id=$1 AND actor_id=$2 AND expires_at>NOW() FOR UPDATE`,[input.previewId,actor])).rows[0];if(!a)throw new FinanceError('Audience preview expired or is unavailable. Preview again.',409);
   if((await c.query(`SELECT 1 FROM ${NOTIFICATIONS}.campaigns WHERE preview_id=$1`,[a.id])).rowCount)throw new FinanceError('This audience preview was already sent. Do not duplicate the campaign.',409);
   const t=(await c.query(`SELECT * FROM ${NOTIFICATIONS}.templates WHERE id=$1 FOR SHARE`,[a.template_id])).rows[0];if(!t.enabled||t.category!=='marketing'||t.version!==a.template_version)throw new FinanceError('Template changed. Preview again.',409);
   if((await c.query(`SELECT paused FROM ${NOTIFICATIONS}.settings WHERE id=TRUE`)).rows[0].paused)throw new FinanceError('Notification sending is paused.',409);
   const ids=await audience(c,a.user_filter);if(digest(JSON.stringify(ids))!==a.audience_hash||ids.length===0)throw new FinanceError('Audience changed or is empty. Preview again.',409);
   const campaignId=randomUUID();await c.query(`INSERT INTO ${NOTIFICATIONS}.campaigns(id,actor_id,preview_id,request_id,input_hash,recipient_count) VALUES($1,$2,$3,$4,$5,$6)`,[campaignId,actor,a.id,input.requestId,hash,ids.length]);
   const users=(await c.query(`SELECT DISTINCT user_id FROM ${NOTIFICATIONS}.devices WHERE id=ANY($1::uuid[])`,[ids])).rows;
   for(const u of users){const event=(await c.query(`INSERT INTO ${NOTIFICATIONS}.events(user_id,event_key,template_id,label) VALUES($1,$2,$3,'Service announcement') RETURNING id`,[u.user_id,`campaign:${campaignId}:${u.user_id}`,t.id])).rows[0];
    await c.query(`INSERT INTO ${NOTIFICATIONS}.deliveries(event_id,device_id,user_id,binding_version) SELECT $1,id,user_id,binding_version FROM ${NOTIFICATIONS}.devices WHERE user_id=$2 AND id=ANY($3::uuid[]) ON CONFLICT DO NOTHING`,[event.id,u.user_id,ids]);
    await c.query(`UPDATE ${NOTIFICATIONS}.events SET expanded_at=NOW() WHERE id=$1`,[event.id]);}
   await AdminAuditStore.record({adminUserId:actor,action:'notification_campaign_queued',entityType:'notification',entityId:campaignId,metadata:{eligible_devices:ids.length,template_id:t.id}},c);
   return {success:true,campaignId,eligibleDevices:ids.length,duplicate:false};
  });
 }
 static async deliveries(offset=0,id?:string){if(id)requireUuid(id);return (await db().query(`SELECT d.id,d.event_id,d.user_id,d.state,d.attempts,d.last_code,d.created_at,d.updated_at,e.template_snapshot,(SELECT COALESCE(json_agg(a ORDER BY a.attempt),'[]') FROM (SELECT attempt,code,started_at,finished_at FROM ${NOTIFICATIONS}.attempts WHERE delivery_id=d.id) a) AS history FROM ${NOTIFICATIONS}.deliveries d JOIN ${NOTIFICATIONS}.events e ON e.id=d.event_id WHERE ($2::uuid IS NULL OR d.id=$2) ORDER BY d.created_at DESC,d.id DESC LIMIT 50 OFFSET $1`,[offset,id||null])).rows;}
 static async deliveryCount(){return Number((await db().query(`SELECT COUNT(*) FROM ${NOTIFICATIONS}.deliveries`)).rows[0].count);}
 static async campaigns(offset=0){return (await db().query(`SELECT id,actor_id,preview_id,recipient_count,created_at FROM ${NOTIFICATIONS}.campaigns ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET $1`,[offset])).rows;}
 static async templateHistory(id:string){return (await db().query(`SELECT version,snapshot,actor_id,created_at FROM ${NOTIFICATIONS}.template_versions WHERE template_id=$1 ORDER BY version DESC LIMIT 50`,[id])).rows;}
 static async health(){return {configuration:{enabled:this.config().enabled,valid:pushConfiguration().valid},deliverySemantics:'provider acceptance only; display/viewing unconfirmed',...(await db().query(`SELECT (SELECT COUNT(*)::int FROM ${NOTIFICATIONS}.devices) AS devices,(SELECT COUNT(*)::int FROM ${NOTIFICATIONS}.deliveries WHERE state IN ('queued','retry')) AS pending,(SELECT COUNT(*)::int FROM ${NOTIFICATIONS}.deliveries WHERE state='failed') AS failed,(SELECT paused FROM ${NOTIFICATIONS}.settings WHERE id=TRUE) AS paused,(SELECT COUNT(*)::int FROM ${NOTIFICATIONS}.preferences WHERE marketing=TRUE) AS "marketingConsented",(SELECT COUNT(*)::int FROM ${NOTIFICATIONS}.events WHERE created_at>NOW()-interval '7 days') AS "eventsLast7Days",(SELECT COUNT(*)::int FROM ${NOTIFICATIONS}.deliveries WHERE state IN ('failed','invalid') AND updated_at>NOW()-interval '7 days') AS "failedLast7Days"`)).rows[0]};}
 static async settings(){return (await db().query(`SELECT paused FROM ${NOTIFICATIONS}.settings WHERE id=TRUE`)).rows[0];}
 static async setSettings(actor:string,input:any){exact(input,['paused','confirmed','reason']);if(typeof input.paused!=='boolean'||input.confirmed!==true||typeof input.reason!=='string'||input.reason.trim().length<5||input.reason.length>200||/[<>\x00-\x1f]|Bearer|secret|password/i.test(input.reason))throw new FinanceError('Confirm pause/resume with a safe reason.');return notificationTransaction(async c=>{await c.query(`UPDATE ${NOTIFICATIONS}.settings SET paused=$1 WHERE id=TRUE`,[input.paused]);await AdminAuditStore.record({adminUserId:actor,action:'notification_pause_changed',entityType:'notification',entityId:'settings',metadata:{paused:input.paused,reason:input.reason}},c);return {paused:input.paused};});}
}
