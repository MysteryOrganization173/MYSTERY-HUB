import {randomBytes,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {getPool} from '../db/connection.js';
import {FinanceError} from '../db/financeStore.js';
import {AdminAuditStore} from '../db/adminAuditStore.js';
import {hashSessionToken} from '../utils/crypto.js';
import {digest,encryptSubscription,decryptSubscription,pushConfiguration,validateSubscription,validateTemplate,renderTemplate} from './notificationSafety.js';
import {ANNOUNCEMENT_DESTINATIONS,type AnnouncementDestination,type NotificationAudienceKind,type NotificationHistoryKind} from '../../shared/notifications.js';

export const NOTIFICATIONS='mysteryhub_notifications';
export const requireUuid=(id:unknown)=>{if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new FinanceError('Invalid notification identifier.');return id;};
export const exact=(input:any,keys:string[])=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k)))throw new FinanceError('Unexpected notification field.');};
function db(){const pool=getPool();if(!pool)throw new FinanceError('Durable notifications require PostgreSQL.',503);return pool;}
export async function notificationTransaction<T>(work:(client:PoolClient)=>Promise<T>):Promise<T>{const c=await db().connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
async function audience(c:PoolClient,userId?:string){return (await c.query(`SELECT d.id FROM ${NOTIFICATIONS}.devices d JOIN sessions s ON s.id=d.session_id AND s.user_id=d.user_id
 JOIN users u ON u.id=d.user_id JOIN ${NOTIFICATIONS}.preferences p ON p.user_id=d.user_id
 WHERE s.expires_at>NOW() AND u.status='active' AND u.role='customer' AND COALESCE(u.must_change_password,FALSE)=FALSE AND p.marketing=TRUE AND ($1::text IS NULL OR d.user_id=$1) ORDER BY d.id LIMIT 1001`,[userId||null])).rows.map(r=>r.id as string);}
/**
 * Guest browsers that chose news: unexpired, and not this same browser's live account registration (a browser that
 * signed in gets its account notifications instead, never both).
 */
async function guestAudience(c:PoolClient){return (await c.query(`SELECT g.id FROM ${NOTIFICATIONS}.guest_devices g WHERE g.expires_at>NOW()
 AND NOT EXISTS(SELECT 1 FROM ${NOTIFICATIONS}.devices d JOIN sessions s ON s.id=d.session_id WHERE d.endpoint_hash=g.endpoint_hash AND s.expires_at>NOW()) ORDER BY g.id LIMIT 1001`)).rows.map(r=>r.id as string);}
const AUDIENCE_KINDS:NotificationAudienceKind[]=['members','guests','everyone'];
const HISTORY_KINDS:NotificationHistoryKind[]=['announcement','test','order'];
const DELIVERY_STATES=['queued','retry','provider_accepted','failed','invalid','skipped'];
/** Who an announcement may reach, from consent only: customers who chose news and offers, guest browsers that did, or both. */
async function audienceFor(c:PoolClient,kind:NotificationAudienceKind,userId?:string|null){
 return {members:kind==='guests'?[]:await audience(c,userId||undefined),guests:kind==='members'?[]:await guestAudience(c)};
}
const audienceHash=(kind:NotificationAudienceKind,destination:string|null,ids:{members:string[];guests:string[]})=>digest(JSON.stringify([kind,destination,ids.members,ids.guests]));
/** The approved page an announcement opens; anything else falls back to the home page. */
export const announcementPage=(value:unknown):AnnouncementDestination=>ANNOUNCEMENT_DESTINATIONS.includes(value as AnnouncementDestination)?value as AnnouncementDestination:'/';
const requestKey=(value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9_-]{8,64}$/.test(value);
type Purpose='transactional'|'marketing';
/** Purpose-specific consent from an explicit, first-party choice, with the copy version the person saw. */
function consentInput(input:any,allowed:Purpose[]){
 if(input===undefined)return null;exact(input,['purposes','copyVersion']);
 if(!Array.isArray(input.purposes)||!input.purposes.length||input.purposes.some((p:unknown)=>!allowed.includes(p as Purpose))||new Set(input.purposes).size!==input.purposes.length
  ||typeof input.copyVersion!=='string'||!/^[a-z0-9._-]{1,40}$/.test(input.copyVersion))throw new FinanceError('Invalid notification consent.');
 return {purposes:input.purposes as Purpose[],copyVersion:input.copyVersion as string};
}
/** Append-only evidence: who (account or guest browser), which purpose, granted or withdrawn, from where, when. */
async function recordConsent(c:PoolClient,subject:{userId?:string;guestDeviceId?:string},purpose:Purpose,granted:boolean,source:string,copyVersion:string|null){
 await c.query(`INSERT INTO ${NOTIFICATIONS}.consents(user_id,guest_device_id,purpose,granted,source,copy_version) VALUES($1,$2,$3,$4,$5,$6)`,[subject.userId||null,subject.guestDeviceId||null,purpose,granted,source,copyVersion]);
}
/**
 * A withdrawn marketing choice is never switched back on implicitly. The ledger decides; for someone with no ledger
 * entries at all (preferences saved before the ledger existed), a saved "off" counts as a withdrawal.
 */
async function marketingOptedOut(c:PoolClient|ReturnType<typeof db>,userId:string){
 const last=(await c.query(`SELECT granted FROM ${NOTIFICATIONS}.consents WHERE user_id=$1 AND purpose='marketing' ORDER BY seq DESC LIMIT 1`,[userId])).rows[0];
 if(last)return last.granted===false;
 if((await c.query(`SELECT 1 FROM ${NOTIFICATIONS}.consents WHERE user_id=$1 LIMIT 1`,[userId])).rowCount)return false;
 const saved=(await c.query(`SELECT marketing FROM ${NOTIFICATIONS}.preferences WHERE user_id=$1`,[userId])).rows[0];
 return saved?saved.marketing===false:false;
}
/** Before the first ledger entry for someone, a pre-ledger saved "off" is written into the ledger, so it stays decisive. */
async function carryLegacyOptOut(c:PoolClient,userId:string){
 if((await c.query(`SELECT 1 FROM ${NOTIFICATIONS}.consents WHERE user_id=$1 LIMIT 1`,[userId])).rowCount)return;
 const saved=(await c.query(`SELECT marketing FROM ${NOTIFICATIONS}.preferences WHERE user_id=$1`,[userId])).rows[0];
 if(saved&&saved.marketing===false)await recordConsent(c,{userId},'marketing',false,'legacy_preference',null);
}
/**
 * Expired guest registrations are removed with an evidence row, in one statement that skips rows another worker holds,
 * so retention really is 180 days. Run by the notification worker on every tick while delivery is configured.
 */
export async function pruneExpiredGuests(){
 return (await db().query(`WITH gone AS (DELETE FROM ${NOTIFICATIONS}.guest_devices WHERE id IN (SELECT id FROM ${NOTIFICATIONS}.guest_devices WHERE expires_at<NOW() ORDER BY expires_at LIMIT 200 FOR UPDATE SKIP LOCKED) RETURNING id)
  INSERT INTO ${NOTIFICATIONS}.consents(guest_device_id,purpose,granted,source) SELECT id,'marketing',FALSE,'guest_expired' FROM gone`)).rowCount||0;
}
/** At most this many new guest registrations in ten minutes, site-wide, counted from rows actually created. */
const GUEST_REGISTRATION_BUDGET=200;
/** Guest news is an operational gate (WEB_PUSH_GUEST_NEWS=true), off unless the operator turns it on. */
export const guestNewsEnabled=()=>process.env.WEB_PUSH_GUEST_NEWS==='true';
const GUEST_CREDENTIAL=/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i;
function guestCredential(header:unknown){const match=typeof header==='string'?GUEST_CREDENTIAL.exec(header.trim()):null;if(!match)throw new FinanceError('Notifications are not on for this browser.',401);return {id:match[1].toLowerCase(),secretHash:digest(match[2])};}
export class NotificationService {
 static config(){const c=pushConfiguration(),enabled=c.enabled&&!!getPool();return {enabled,publicKey:enabled?c.publicKey:null,workerPath:'/push-sw.js' as const,guests:enabled&&guestNewsEnabled()};}
 /** Public view: whether sending is actually on, so the site never invites people to something that is paused. */
 static async publicConfig(){const c=this.config();if(!c.enabled)return {...c,paused:true};
  try{const paused=(await db().query(`SELECT paused FROM ${NOTIFICATIONS}.settings WHERE id=TRUE`)).rows[0]?.paused!==false;return {...c,paused};}
  catch{return {enabled:false,publicKey:null,workerPath:'/push-sw.js' as const,guests:false,paused:true};}
 }
 /** `marketingOptedOut`: the customer turned news and offers off before, so an invitation must not offer them again. */
 static async preferences(userId:string){const p=(await db().query(`SELECT transactional,marketing FROM ${NOTIFICATIONS}.preferences WHERE user_id=$1`,[userId])).rows[0]||{transactional:true,marketing:false};return {transactional:p.transactional,marketing:p.marketing,marketingOptedOut:await marketingOptedOut(db(),userId)};}
 static async setPreferences(userId:string,input:any){exact(input,['transactional','marketing','source']);if(typeof input.transactional!=='boolean'||typeof input.marketing!=='boolean'||input.source!==undefined&&input.source!=='notification_invitation')throw new FinanceError('Choose transactional and marketing preferences explicitly.');
  // The invitation's only follow-up answer is "Order updates only": that source can never record a grant of offers.
  if(input.source==='notification_invitation'&&(input.marketing!==false||input.transactional!==true))throw new FinanceError('Choose transactional and marketing preferences explicitly.');
  // Evidence names where the choice was made: My Account, or the invitation's own "Order updates only".
  const [source,copyVersion]=input.source==='notification_invitation'?['notification_invitation','invite-3.4-1']:['account_settings','settings-1'];
  return notificationTransaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['notification-user:'+userId]);
   await carryLegacyOptOut(c,userId);
   const before=(await c.query(`SELECT transactional,marketing FROM ${NOTIFICATIONS}.preferences WHERE user_id=$1`,[userId])).rows[0]||{transactional:true,marketing:false};
   const after=(await c.query(`INSERT INTO ${NOTIFICATIONS}.preferences(user_id,transactional,marketing) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET transactional=$2,marketing=$3,updated_at=NOW() RETURNING transactional,marketing`,[userId,input.transactional,input.marketing])).rows[0];
   for(const purpose of ['transactional','marketing'] as const)if(before[purpose]!==after[purpose])await recordConsent(c,{userId},purpose,after[purpose],source,copyVersion);
   return after;
  });}
 static async subscribe(userId:string,token:string,input:any){exact(input,['subscription','consent']);if(!this.config().enabled)throw new FinanceError('Web Push is not enabled and configured.',503);const consent=consentInput(input.consent,['transactional','marketing']);const subscription=validateSubscription(input.subscription),hash=digest(subscription.endpoint);
 return notificationTransaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['notification-user:'+userId]);
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['notification-endpoint:'+hash]);
  const session=(await c.query('SELECT id FROM sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>NOW() FOR KEY SHARE',[hashSessionToken(token),userId])).rows[0];if(!session)throw new FinanceError('Sign in again before subscribing.',401);
  const previous=(await c.query(`SELECT * FROM ${NOTIFICATIONS}.devices WHERE endpoint_hash=$1 FOR UPDATE`,[hash])).rows[0];
  if(previous){const old=decryptSubscription(previous.encrypted_subscription);if(old.keys.auth!==subscription.keys.auth||old.keys.p256dh!==subscription.keys.p256dh)throw new FinanceError('Subscription ownership could not be verified.',409);}
  if(!previous||previous.user_id!==userId){const count=Number((await c.query(`SELECT COUNT(*) FROM ${NOTIFICATIONS}.devices WHERE user_id=$1`,[userId])).rows[0].count);if(count>=10)throw new FinanceError('Revoke an old notification device before adding another.',409);}
  const id=previous?.id||randomUUID();await c.query(`INSERT INTO ${NOTIFICATIONS}.devices(id,user_id,session_id,endpoint_hash,encrypted_subscription) VALUES($1,$2,$3,$4,$5)
   ON CONFLICT(endpoint_hash) DO UPDATE SET user_id=$2,session_id=$3,encrypted_subscription=$5,binding_version=${NOTIFICATIONS}.devices.binding_version+1,updated_at=NOW()`,[id,userId,session.id,hash,encryptSubscription(subscription)]);
  // The same browser was registered for guest news: the account takes over and the guest consent ends with it, but
  // only when the keys prove it is the same browser (an endpoint alone never removes someone else's registration).
  // A guest row for this endpoint is replaced by the signed-in account, which outranks an anonymous registration;
  // the evidence says whether the keys proved it was the same browser (a mismatch can only be a stale or planted row).
  const guest=(await c.query(`SELECT id,encrypted_subscription FROM ${NOTIFICATIONS}.guest_devices WHERE endpoint_hash=$1 FOR UPDATE`,[hash])).rows[0];
  if(guest){const old=decryptSubscription(guest.encrypted_subscription),same=old.keys.auth===subscription.keys.auth&&old.keys.p256dh===subscription.keys.p256dh;
   await c.query(`DELETE FROM ${NOTIFICATIONS}.guest_devices WHERE id=$1`,[guest.id]);await recordConsent(c,{guestDeviceId:guest.id},'marketing',false,same?'replaced_by_account':'replaced_by_account_unverified',null);}
  let preferences=(await c.query(`SELECT transactional,marketing FROM ${NOTIFICATIONS}.preferences WHERE user_id=$1 FOR UPDATE`,[userId])).rows[0]||null;
  if(consent){
   // One explicit "Allow Notifications" may record each purpose its copy named, but never revives withdrawn offers.
   await carryLegacyOptOut(c,userId);
   const optedOut=await marketingOptedOut(c,userId),granted=consent.purposes.filter(p=>p!=='marketing'||!optedOut);
   for(const purpose of granted)await recordConsent(c,{userId},purpose,true,'notification_invitation',consent.copyVersion);
   preferences=(await c.query(`INSERT INTO ${NOTIFICATIONS}.preferences(user_id,transactional,marketing) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET transactional=$2,marketing=$3,updated_at=NOW() RETURNING transactional,marketing`,
    [userId,granted.includes('transactional')||(preferences?.transactional??true),granted.includes('marketing')||(preferences?.marketing??false)])).rows[0];
  }
  return {success:true,deviceId:id,preferences:preferences?{transactional:preferences.transactional,marketing:preferences.marketing}:{transactional:true,marketing:false}};
 });}
 /**
  * Guest news: a browser without an account may receive service news and offers after explicitly choosing them.
  * Order updates are never offered to guests here (no guest order capability exists to bind them securely). The
  * browser keeps a random credential; only its hash is stored. No account, phone number or order is involved.
  */
 static async guestSubscribe(input:any){exact(input,['subscription','consent']);if(!this.config().enabled)throw new FinanceError('Web Push is not enabled and configured.',503);
  if(!this.config().guests)throw new FinanceError('Guest news is not available yet.',503);
  const consent=consentInput(input.consent,['marketing']);if(!consent)throw new FinanceError('Choose to receive Mystery Hub news first.');
  const subscription=validateSubscription(input.subscription),hash=digest(subscription.endpoint);
  return notificationTransaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['notification-endpoint:'+hash]);
   // Only a live account registration blocks guest news; a device left behind by an expired session cannot receive.
   if((await c.query(`SELECT 1 FROM ${NOTIFICATIONS}.devices d JOIN sessions s ON s.id=d.session_id WHERE d.endpoint_hash=$1 AND s.expires_at>NOW()`,[hash])).rowCount)throw new FinanceError('This browser already receives your account notifications.',409);
   const previous=(await c.query(`SELECT * FROM ${NOTIFICATIONS}.guest_devices WHERE endpoint_hash=$1 FOR UPDATE`,[hash])).rows[0];
   if(previous){const old=decryptSubscription(previous.encrypted_subscription);if(old.keys.auth!==subscription.keys.auth||old.keys.p256dh!==subscription.keys.p256dh)throw new FinanceError('Subscription ownership could not be verified.',409);}
   if(!previous&&Number((await c.query(`SELECT COUNT(*) FROM ${NOTIFICATIONS}.guest_devices WHERE created_at>NOW()-interval '10 minutes'`)).rows[0].count)>=GUEST_REGISTRATION_BUDGET)
    throw new FinanceError('Too many new registrations right now. Please try again in a few minutes.',429);
   const id=previous?.id||randomUUID(),secret=randomBytes(32).toString('base64url');
   await c.query(`INSERT INTO ${NOTIFICATIONS}.guest_devices(id,endpoint_hash,encrypted_subscription,secret_hash) VALUES($1,$2,$3,$4)
    ON CONFLICT(endpoint_hash) DO UPDATE SET encrypted_subscription=$3,secret_hash=$4,binding_version=${NOTIFICATIONS}.guest_devices.binding_version+1,updated_at=NOW(),expires_at=NOW()+interval '180 days'`,[id,hash,encryptSubscription(subscription),digest(secret)]);
   await recordConsent(c,{guestDeviceId:id},'marketing',true,'guest_invitation',consent.copyVersion);
   return {success:true,deviceId:id,credential:`${id}.${secret}`};
  });}
 /** Server confirmation for a guest browser; also keeps an actively used registration from expiring. */
 static async guestStatus(header:unknown){const cred=guestCredential(header);
  const row=(await db().query(`UPDATE ${NOTIFICATIONS}.guest_devices SET expires_at=CASE WHEN expires_at<NOW()+interval '179 days' THEN NOW()+interval '180 days' ELSE expires_at END
   WHERE id=$1 AND secret_hash=$2 AND expires_at>NOW() RETURNING endpoint_hash,expires_at`,[cred.id,cred.secretHash])).rows[0];
  if(!row)throw new FinanceError('Notifications are not on for this browser.',404);return {success:true,subscribed:true,endpointHash:row.endpoint_hash as string,expiresAt:row.expires_at};
 }
 static async guestUnsubscribe(header:unknown){const cred=guestCredential(header);return notificationTransaction(async c=>{
  const row=(await c.query(`DELETE FROM ${NOTIFICATIONS}.guest_devices WHERE id=$1 AND secret_hash=$2 RETURNING id`,[cred.id,cred.secretHash])).rows[0];
  if(row)await recordConsent(c,{guestDeviceId:row.id},'marketing',false,'guest_unsubscribe',null);return {success:true};
 });}
 static async revoke(userId:string,id:string){requireUuid(id);await db().query(`DELETE FROM ${NOTIFICATIONS}.devices WHERE id=$1 AND user_id=$2`,[id,userId]);return {success:true};}
 static async devices(userId:string,token:string){return (await db().query(`SELECT d.id,d.endpoint_hash,d.created_at,d.updated_at,(s.token_hash=$2 AND s.expires_at>NOW()) AS current_session FROM ${NOTIFICATIONS}.devices d JOIN sessions s ON s.id=d.session_id WHERE d.user_id=$1 ORDER BY d.updated_at DESC LIMIT 10`,[userId,hashSessionToken(token)])).rows;}
 static async inbox(userId:string,offset=0,id?:string){if(id)requireUuid(id);
  const rows=(await db().query(`SELECT e.id,e.created_at,e.order_id,e.label,e.template_snapshot,e.destination FROM ${NOTIFICATIONS}.events e WHERE e.user_id=$1 AND ($2::uuid IS NULL OR e.id=$2) ORDER BY e.created_at DESC,e.id DESC LIMIT 25 OFFSET $3`,[userId,id||null,offset])).rows;
  if(id&&!rows.length)throw new FinanceError('Notification not found.',404);
  // Opening the operator's own test from its notification is the evidence that the whole path works on that phone.
  // Only tests are marked this way; customer notifications are never tracked as opened.
  if(id)await db().query(`UPDATE ${NOTIFICATIONS}.events SET opened_at=NOW() WHERE id=$1 AND user_id=$2 AND operator_test AND opened_at IS NULL`,[id,userId]);
  return rows.map(r=>({id:r.id,createdAt:r.created_at,...renderTemplate(r.template_snapshot,r.label),destination:r.order_id?'/orders' as const:'/app' as const,
   ...(r.template_snapshot?.category==='marketing'?{opens:announcementPage(r.destination)}:{})}));
 }
 /** The operator's test wording is internal (used only by "Send a test"), so it is not listed among templates. */
 static async templates(){return (await db().query(`SELECT * FROM ${NOTIFICATIONS}.templates WHERE id<>'operator_test' ORDER BY locked DESC,id`)).rows;}
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
 /**
  * Who would receive an announcement right now, counted by the server from consent alone: customers who chose news
  * and offers (people and their devices), guest browsers that chose news (only while guest news is on), or both.
  * The preview binds the template version, audience, page and exact recipients for ten minutes.
  */
 static async previewAudience(actor:string,input:any){exact(input,['templateId','userId','audience','destination']);
  const kind=(input.audience??'members') as NotificationAudienceKind,destination=input.destination??'/';
  if(typeof input.templateId!=='string'||input.userId!==undefined&&(typeof input.userId!=='string'||!input.userId.trim()||input.userId.length>64||kind!=='members')
   ||!AUDIENCE_KINDS.includes(kind)||!ANNOUNCEMENT_DESTINATIONS.includes(destination))throw new FinanceError('Choose a valid template, audience, page and optional customer.');
  if(kind!=='members'&&!this.config().guests)throw new FinanceError('Guest news is off, so only customers with accounts can receive announcements.',409);
  return notificationTransaction(async c=>{const t=(await c.query(`SELECT * FROM ${NOTIFICATIONS}.templates WHERE id=$1`,[input.templateId])).rows[0];if(!t||t.category!=='marketing'||!t.enabled)throw new FinanceError('Choose an enabled marketing template.',409);
   const ids=await audienceFor(c,kind,input.userId);if(ids.members.length+ids.guests.length>1000)throw new FinanceError('Audience exceeds this release’s safe campaign limit. Select a customer instead.',409);
   const previewId=randomUUID();await c.query(`INSERT INTO ${NOTIFICATIONS}.audiences(id,actor_id,template_id,template_version,user_filter,device_ids,guest_device_ids,audience_kind,destination,audience_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [previewId,actor,t.id,t.version,input.userId||null,ids.members,ids.guests,kind,destination,audienceHash(kind,destination,ids)]);
   const customers=ids.members.length?Number((await c.query(`SELECT COUNT(DISTINCT user_id) FROM ${NOTIFICATIONS}.devices WHERE id=ANY($1::uuid[])`,[ids.members])).rows[0].count):0;
   return {success:true,previewId,audience:kind,destination,eligibleDevices:ids.members.length+ids.guests.length,eligibleCustomers:customers,eligibleCustomerDevices:ids.members.length,eligibleGuests:ids.guests.length,expiresInSeconds:600,enabled:this.config().enabled};
  });
 }
 static async campaign(actor:string,input:any){exact(input,['previewId','requestId','confirmed']);requireUuid(input.previewId);if(input.confirmed!==true||!requestKey(input.requestId))throw new FinanceError('Confirm the prepared audience with a valid request ID.');
  if(!this.config().enabled)throw new FinanceError('Real delivery is disabled until configuration is verified.',503);
  return notificationTransaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['notification-campaign:'+input.requestId]);const hash=digest(JSON.stringify([actor,input.previewId]));
   const old=(await c.query(`SELECT * FROM ${NOTIFICATIONS}.campaigns WHERE request_id=$1`,[input.requestId])).rows[0];if(old){if(old.input_hash!==hash)throw new FinanceError('Campaign request changed.',409);return {success:true,campaignId:old.id,eligibleDevices:old.recipient_count,duplicate:true};}
   const a=(await c.query(`SELECT * FROM ${NOTIFICATIONS}.audiences WHERE id=$1 AND actor_id=$2 AND expires_at>NOW() FOR UPDATE`,[input.previewId,actor])).rows[0];if(!a)throw new FinanceError('Audience preview expired or is unavailable. Preview again.',409);
   if((await c.query(`SELECT 1 FROM ${NOTIFICATIONS}.campaigns WHERE preview_id=$1`,[a.id])).rowCount)throw new FinanceError('This audience preview was already sent. Do not duplicate the campaign.',409);
   const t=(await c.query(`SELECT * FROM ${NOTIFICATIONS}.templates WHERE id=$1 FOR SHARE`,[a.template_id])).rows[0];if(!t.enabled||t.category!=='marketing'||t.version!==a.template_version)throw new FinanceError('Template changed. Preview again.',409);
   if((await c.query(`SELECT paused FROM ${NOTIFICATIONS}.settings WHERE id=TRUE`)).rows[0].paused)throw new FinanceError('Notification sending is paused.',409);
   const kind=a.audience_kind as NotificationAudienceKind;if(kind!=='members'&&!this.config().guests)throw new FinanceError('Guest news was turned off. Preview again.',409);
   const ids=await audienceFor(c,kind,a.user_filter),total=ids.members.length+ids.guests.length;
   if(audienceHash(kind,a.destination,ids)!==a.audience_hash||total===0)throw new FinanceError('Audience changed or is empty. Preview again.',409);
   // Campaigns are created one at a time, and the same announcement is never queued twice for the same audience
   // within 30 minutes, even from a second preview (two tabs, a double confirmation, a retried request).
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['notification-campaigns']);
   if((await c.query(`SELECT 1 FROM ${NOTIFICATIONS}.campaigns k JOIN ${NOTIFICATIONS}.audiences p ON p.id=k.preview_id WHERE p.template_id=$1 AND p.template_version=$2 AND p.audience_kind=$3
    AND p.user_filter IS NOT DISTINCT FROM $4 AND p.destination IS NOT DISTINCT FROM $5 AND k.created_at>NOW()-interval '30 minutes' LIMIT 1`,[a.template_id,a.template_version,kind,a.user_filter,a.destination])).rowCount)
    throw new FinanceError('This announcement was already queued for this audience in the last 30 minutes. It was not queued again.',409);
   const campaignId=randomUUID(),page=announcementPage(a.destination);await c.query(`INSERT INTO ${NOTIFICATIONS}.campaigns(id,actor_id,preview_id,request_id,input_hash,recipient_count) VALUES($1,$2,$3,$4,$5,$6)`,[campaignId,actor,a.id,input.requestId,hash,total]);
   // One event per customer (their inbox shows it once) with a delivery per device; one event per guest browser.
   if(ids.members.length)await c.query(`WITH ev AS (INSERT INTO ${NOTIFICATIONS}.events(user_id,event_key,template_id,label,destination,campaign_id,expanded_at)
     SELECT u.user_id,$1||u.user_id,$2,'Service announcement',$3,$4,NOW() FROM (SELECT DISTINCT user_id FROM ${NOTIFICATIONS}.devices WHERE id=ANY($5::uuid[])) u RETURNING id,user_id)
    INSERT INTO ${NOTIFICATIONS}.deliveries(event_id,device_id,user_id,binding_version) SELECT ev.id,d.id,d.user_id,d.binding_version FROM ev JOIN ${NOTIFICATIONS}.devices d ON d.user_id=ev.user_id AND d.id=ANY($5::uuid[]) ON CONFLICT DO NOTHING`,
    [`campaign:${campaignId}:`,t.id,page,campaignId,ids.members]);
   if(ids.guests.length)await c.query(`WITH ev AS (INSERT INTO ${NOTIFICATIONS}.events(guest_device_id,event_key,template_id,label,destination,campaign_id,expanded_at)
     SELECT g.id,$1||g.id::text,$2,'Service announcement',$3,$4,NOW() FROM ${NOTIFICATIONS}.guest_devices g WHERE g.id=ANY($5::uuid[]) RETURNING id,guest_device_id)
    INSERT INTO ${NOTIFICATIONS}.deliveries(event_id,guest_device_id,binding_version) SELECT ev.id,g.id,g.binding_version FROM ev JOIN ${NOTIFICATIONS}.guest_devices g ON g.id=ev.guest_device_id`,
    [`campaign:${campaignId}:guest:`,t.id,page,campaignId,ids.guests]);
   await AdminAuditStore.record({adminUserId:actor,action:'notification_campaign_queued',entityType:'notification',entityId:campaignId,metadata:{eligible_devices:total,customer_devices:ids.members.length,guest_browsers:ids.guests.length,audience:kind,destination:page,template_id:t.id}},c);
   return {success:true,campaignId,eligibleDevices:total,duplicate:false};
  });
 }
 static async deliveries(offset=0,id?:string){if(id)requireUuid(id);return (await db().query(`SELECT d.id,d.event_id,d.user_id,d.state,d.attempts,d.last_code,d.created_at,d.updated_at,e.template_snapshot,(SELECT COALESCE(json_agg(a ORDER BY a.attempt),'[]') FROM (SELECT attempt,code,started_at,finished_at FROM ${NOTIFICATIONS}.attempts WHERE delivery_id=d.id) a) AS history FROM ${NOTIFICATIONS}.deliveries d JOIN ${NOTIFICATIONS}.events e ON e.id=d.event_id WHERE ($2::uuid IS NULL OR d.id=$2) ORDER BY d.created_at DESC,d.id DESC LIMIT 50 OFFSET $1`,[offset,id||null])).rows;}
 static async deliveryCount(){return Number((await db().query(`SELECT COUNT(*) FROM ${NOTIFICATIONS}.deliveries`)).rows[0].count);}
 static async campaigns(offset=0){return (await db().query(`SELECT id,actor_id,preview_id,recipient_count,created_at FROM ${NOTIFICATIONS}.campaigns ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET $1`,[offset])).rows;}
 static async templateHistory(id:string){return (await db().query(`SELECT version,snapshot,actor_id,created_at FROM ${NOTIFICATIONS}.template_versions WHERE template_id=$1 ORDER BY version DESC LIMIT 50`,[id])).rows;}
 /**
  * Readiness facts for the Admin overview, never secrets: whether keys are valid and the switch is on (not the keys),
  * pause, devices that can receive (signed-in) versus registrations left by expired sign-ins, people versus devices,
  * guest browsers, order updates waiting for a resume, the last seven days by state, and the viewer's own last test.
  */
 static async health(actor?:string){const n=NOTIFICATIONS;
  const facts=(await db().query(`WITH live AS (SELECT d.id,d.user_id FROM ${n}.devices d JOIN sessions s ON s.id=d.session_id AND s.user_id=d.user_id WHERE s.expires_at>NOW()),
   announce AS (SELECT d.id,d.user_id FROM live d JOIN users u ON u.id=d.user_id JOIN ${n}.preferences p ON p.user_id=d.user_id
    WHERE u.status='active' AND u.role='customer' AND COALESCE(u.must_change_password,FALSE)=FALSE AND p.marketing=TRUE)
   SELECT (SELECT COUNT(*)::int FROM ${n}.events) AS "savedEvents",(SELECT COUNT(*)::int FROM ${n}.attempts) AS "deliveryAttempts",(SELECT COUNT(*)::int FROM ${n}.deliveries WHERE state='provider_accepted') AS "providerAccepted",
    (SELECT COUNT(*)::int FROM ${n}.devices) AS devices,(SELECT COUNT(*)::int FROM ${n}.deliveries WHERE state IN ('queued','retry')) AS pending,(SELECT COUNT(*)::int FROM ${n}.deliveries WHERE state='failed') AS failed,
    (SELECT paused FROM ${n}.settings WHERE id=TRUE) AS paused,(SELECT COUNT(*)::int FROM ${n}.preferences WHERE marketing=TRUE) AS "marketingConsented",
    (SELECT COUNT(*)::int FROM ${n}.events WHERE created_at>NOW()-interval '7 days') AS "eventsLast7Days",(SELECT COUNT(*)::int FROM ${n}.deliveries WHERE state IN ('failed','invalid') AND updated_at>NOW()-interval '7 days') AS "failedLast7Days",
    (SELECT COUNT(*)::int FROM live) AS "liveDevices",(SELECT COUNT(DISTINCT user_id)::int FROM live) AS "liveAccounts",
    (SELECT COUNT(*)::int FROM ${n}.devices)-(SELECT COUNT(*)::int FROM live) AS "signedOutDevices",
    (SELECT COUNT(*)::int FROM announce) AS "announcementDevices",(SELECT COUNT(DISTINCT user_id)::int FROM announce) AS "announcementCustomers",
    (SELECT COUNT(*)::int FROM ${n}.guest_devices WHERE expires_at>NOW()) AS "guestBrowsers",(SELECT COUNT(*)::int FROM live WHERE user_id=$1::text) AS "ownDevices",
    (SELECT COUNT(*)::int FROM ${n}.events e WHERE e.expanded_at IS NULL AND NOT e.operator_test AND e.created_at>NOW()-interval '24 hours' AND EXISTS(SELECT 1 FROM live WHERE live.user_id=e.user_id)) AS "waitingEvents",
    (SELECT COALESCE(jsonb_object_agg(x.state,x.n),'{}'::jsonb) FROM (SELECT state,COUNT(*)::int n FROM ${n}.deliveries WHERE updated_at>NOW()-interval '7 days' GROUP BY state) x) AS "deliveries7Days",
    (SELECT last_code FROM ${n}.deliveries WHERE state IN ('failed','invalid','retry') AND last_code IS NOT NULL AND updated_at>NOW()-interval '7 days' GROUP BY last_code ORDER BY COUNT(*) DESC,last_code LIMIT 1) AS "commonProblem"`,[actor||null])).rows[0];
  // The phone check is the viewer's latest plain test (an announcement test opens its page, so it cannot record a
  // tap) and when they last opened any test from its notification within the 30 days the resume rule accepts.
  const lastTest=actor?(await db().query(`SELECT e.id,e.created_at AS "createdAt",e.opened_at AS "openedAt",e.template_id AS "templateId",
   (SELECT COALESCE(jsonb_object_agg(x.state,x.n),'{}'::jsonb) FROM (SELECT state,COUNT(*)::int n FROM ${n}.deliveries WHERE event_id=e.id GROUP BY state) x) AS states
   FROM ${n}.events e WHERE e.operator_test AND e.template_id='operator_test' AND e.user_id=$1 ORDER BY e.created_at DESC,e.id DESC LIMIT 1`,[actor])).rows[0]||null:null;
  const phoneCheckedAt=actor?(await db().query(`SELECT MAX(opened_at) AS at FROM ${n}.events WHERE operator_test AND user_id=$1 AND opened_at>NOW()-interval '30 days'`,[actor])).rows[0].at??null:null;
  const c=pushConfiguration();
  return {configuration:{enabled:this.config().enabled,valid:c.valid,switchOn:process.env.WEB_PUSH_ENABLED==='true',guestNews:guestNewsEnabled()},deliverySemantics:'provider acceptance only; display/viewing unconfirmed',...facts,lastTest,phoneCheckedAt};
 }
 /**
  * The operator's own test, to their own signed-in devices only (taken from the session, never from input). It works
  * while sending is paused, so a phone can be checked before any customer receives anything. A plain test takes the
  * private account path: generic text on the lock screen, the test itself after sign-in, and an "opened" mark when
  * it is opened from the notification. A test of a saved announcement shows that announcement's text and opens its
  * page. Idempotent per request, audited, at most three in ten minutes.
  */
 static async testToSelf(actor:string,input:any){exact(input,['requestId','templateId','destination']);
  if(!requestKey(input.requestId)||input.templateId!==undefined&&(typeof input.templateId!=='string'||input.templateId==='operator_test')
   ||input.destination!==undefined&&(input.templateId===undefined||!ANNOUNCEMENT_DESTINATIONS.includes(input.destination)))throw new FinanceError('Use a valid test request.');
  if(!this.config().enabled)throw new FinanceError('Web Push is not configured, so no test can be sent.',503);
  return notificationTransaction(async c=>{const n=NOTIFICATIONS;
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['notification-test:'+actor]);
   const key=`test:${actor}:${input.requestId}`;
   const old=(await c.query(`SELECT e.id,(SELECT COUNT(*)::int FROM ${n}.deliveries WHERE event_id=e.id) AS devices FROM ${n}.events e WHERE e.event_key=$1 AND e.user_id=$2 AND e.operator_test`,[key,actor])).rows[0];
   if(old)return {success:true,eventId:old.id as string,devices:old.devices as number,duplicate:true};
   if(Number((await c.query(`SELECT COUNT(*) FROM ${n}.events WHERE operator_test AND user_id=$1 AND created_at>NOW()-interval '10 minutes'`,[actor])).rows[0].count)>=3)
    throw new FinanceError('Three tests were sent in the last 10 minutes. Wait a few minutes before sending another.',429);
   const templateId=input.templateId??'operator_test';
   const t=(await c.query(`SELECT * FROM ${n}.templates WHERE id=$1 FOR SHARE`,[templateId])).rows[0];
   if(!t||!t.enabled||templateId!=='operator_test'&&t.category!=='marketing')throw new FinanceError('Choose an enabled announcement template to test.',409);
   const devices=(await c.query(`SELECT d.id FROM ${n}.devices d JOIN sessions s ON s.id=d.session_id AND s.user_id=d.user_id JOIN users u ON u.id=d.user_id
    WHERE d.user_id=$1 AND s.expires_at>NOW() AND u.status='active' AND COALESCE(u.must_change_password,FALSE)=FALSE ORDER BY d.id LIMIT 10`,[actor])).rows.map(r=>r.id as string);
   if(!devices.length)throw new FinanceError('No phone or browser is registered to your account. Sign in to Mystery Hub on your phone, turn on notifications in My Account, then try again.',409);
   const event=(await c.query(`INSERT INTO ${n}.events(user_id,event_key,template_id,label,destination,operator_test,expanded_at) VALUES($1,$2,$3,$4,$5,TRUE,NOW()) RETURNING id`,
    [actor,key,templateId,templateId==='operator_test'?'Test notification':'Service announcement',templateId==='operator_test'?null:announcementPage(input.destination)])).rows[0];
   await c.query(`INSERT INTO ${n}.deliveries(event_id,device_id,user_id,binding_version) SELECT $1,d.id,d.user_id,d.binding_version FROM ${n}.devices d WHERE d.id=ANY($2::uuid[]) AND d.user_id=$3`,[event.id,devices,actor]);
   await AdminAuditStore.record({adminUserId:actor,action:'notification_test_queued',entityType:'notification',entityId:event.id,metadata:{devices:devices.length,template_id:templateId}},c);
   return {success:true,eventId:event.id as string,devices:devices.length,duplicate:false};
  });
 }
 /**
  * History grouped the way an operator thinks: announcements (per campaign), the operator's tests, and automatic
  * order updates, each with the push service's answers per state. Filter by kind and by a state any delivery is in.
  */
 static async history(input:{kind?:unknown;state?:unknown;offset?:number}){const n=NOTIFICATIONS,kind=(input.kind??'announcement') as NotificationHistoryKind,state=input.state??null,offset=input.offset??0;
  if(!HISTORY_KINDS.includes(kind)||state!==null&&!DELIVERY_STATES.includes(state as string))throw new FinanceError('Choose a valid history filter.');
  const states=(where:string)=>`(SELECT COALESCE(jsonb_object_agg(x.state,x.n),'{}'::jsonb) FROM (SELECT d.state,COUNT(*)::int n FROM ${n}.deliveries d JOIN ${n}.events e ON e.id=d.event_id WHERE ${where} GROUP BY d.state) x)`;
  const has=(where:string)=>`($1::text IS NULL OR EXISTS(SELECT 1 FROM ${n}.deliveries d JOIN ${n}.events e ON e.id=d.event_id WHERE ${where} AND d.state=$1))`;
  const query=kind==='announcement'
   ?{rows:`SELECT k.id,k.created_at,k.actor_id,k.recipient_count AS targeted,p.audience_kind,p.user_filter IS NOT NULL AS single_customer,COALESCE(p.destination,'/') AS destination,
      (SELECT e.template_snapshot FROM ${n}.events e WHERE e.campaign_id=k.id ORDER BY e.created_at,e.id LIMIT 1) AS snapshot,${states('e.campaign_id=k.id')} AS states,FALSE AS waiting
      FROM ${n}.campaigns k JOIN ${n}.audiences p ON p.id=k.preview_id WHERE ${has('e.campaign_id=k.id')} ORDER BY k.created_at DESC,k.id DESC LIMIT 25 OFFSET $2`,
     total:`SELECT COUNT(*)::int AS total FROM ${n}.campaigns k WHERE ${has('e.campaign_id=k.id')}`}
   :kind==='test'
   ?{rows:`SELECT o.id,o.created_at,o.user_id AS actor_id,o.template_snapshot AS snapshot,o.label,o.destination,o.opened_at,(SELECT COUNT(*)::int FROM ${n}.deliveries d WHERE d.event_id=o.id) AS targeted,
      ${states('e.id=o.id')} AS states,FALSE AS waiting FROM ${n}.events o WHERE o.operator_test AND ${has('e.id=o.id')} ORDER BY o.created_at DESC,o.id DESC LIMIT 25 OFFSET $2`,
     total:`SELECT COUNT(*)::int AS total FROM ${n}.events o WHERE o.operator_test AND ${has('e.id=o.id')}`}
   :{rows:`SELECT o.id,o.created_at,o.order_id,o.template_snapshot AS snapshot,o.label,(SELECT COUNT(*)::int FROM ${n}.deliveries d WHERE d.event_id=o.id) AS targeted,
      ${states('e.id=o.id')} AS states,o.expanded_at IS NULL AS waiting FROM ${n}.events o
      WHERE NOT o.operator_test AND o.campaign_id IS NULL AND o.guest_device_id IS NULL AND o.template_snapshot->>'category'='transactional' AND ${has('e.id=o.id')} ORDER BY o.created_at DESC,o.id DESC LIMIT 25 OFFSET $2`,
     total:`SELECT COUNT(*)::int AS total FROM ${n}.events o WHERE NOT o.operator_test AND o.campaign_id IS NULL AND o.guest_device_id IS NULL AND o.template_snapshot->>'category'='transactional' AND ${has('e.id=o.id')}`};
  const [rows,total]=await Promise.all([db().query(query.rows,[state,offset]),db().query(query.total,[state])]);
  const text=(r:any)=>{try{return r.snapshot?.title?renderTemplate(r.snapshot,r.label||'Service announcement'):{title:'Announcement',body:''};}catch{return {title:r.snapshot?.title||'Announcement',body:r.snapshot?.body||''};}};
  return {success:true,total:total.rows[0].total as number,items:rows.rows.map(r=>({id:r.id,kind,createdAt:r.created_at,actorId:r.actor_id??null,...text(r),
   audience:kind==='announcement'?r.audience_kind:kind==='test'?'self':'account',singleCustomer:!!r.single_customer,
   destination:kind==='order'||kind==='test'&&r.snapshot?.category!=='marketing'?'/orders':announcementPage(r.destination),orderId:r.order_id??null,
   targeted:r.targeted,states:r.states||{},waiting:!!r.waiting,openedAt:r.opened_at??null}))};
 }
 /** Every device's attempts for one announcement, test or order update: states, codes and times, never endpoints or people. */
 static async historyDetail(kind:unknown,id:unknown){requireUuid(id);if(!HISTORY_KINDS.includes(kind as NotificationHistoryKind))throw new FinanceError('Choose a valid history filter.');const n=NOTIFICATIONS;
  const where=kind==='announcement'?'e.campaign_id=$1':kind==='test'?'e.id=$1 AND e.operator_test':'e.id=$1 AND NOT e.operator_test AND e.campaign_id IS NULL';
  const [rows,problems]=await Promise.all([db().query(`SELECT d.id,d.state,d.attempts,d.last_code AS "lastCode",d.created_at AS "createdAt",d.updated_at AS "updatedAt",e.guest_device_id IS NOT NULL AS guest,
    (SELECT COALESCE(json_agg(a ORDER BY a.attempt),'[]') FROM (SELECT attempt,code,started_at AS "startedAt",finished_at AS "finishedAt" FROM ${n}.attempts WHERE delivery_id=d.id) a) AS history
    FROM ${n}.deliveries d JOIN ${n}.events e ON e.id=d.event_id WHERE ${where} ORDER BY d.created_at,d.id LIMIT 200`,[id]),
   db().query(`SELECT d.last_code AS code,COUNT(*)::int AS count FROM ${n}.deliveries d JOIN ${n}.events e ON e.id=d.event_id WHERE ${where} AND d.state IN ('failed','invalid','retry','skipped') AND d.last_code IS NOT NULL GROUP BY d.last_code ORDER BY count DESC,code`,[id])]);
  return {success:true,deliveries:rows.rows,problems:problems.rows};
 }
 static async settings(){return (await db().query(`SELECT paused FROM ${NOTIFICATIONS}.settings WHERE id=TRUE`)).rows[0];}
 static async setSettings(actor:string,input:any){exact(input,['paused','confirmed','reason']);if(typeof input.paused!=='boolean'||input.confirmed!==true||typeof input.reason!=='string'||input.reason.trim().length<5||input.reason.length>200||/[<>\x00-\x1f]|Bearer|secret|password/i.test(input.reason))throw new FinanceError('Confirm pause/resume with a safe reason.');return notificationTransaction(async c=>{
  // Resuming is the activation step: it needs a phone that really showed and opened an operator test (last 30 days).
  if(input.paused===false&&!(await c.query(`SELECT 1 FROM ${NOTIFICATIONS}.events WHERE operator_test AND opened_at>NOW()-interval '30 days' LIMIT 1`)).rowCount)
   throw new FinanceError('Before resuming, verify a phone: send a test to your devices and open it from the notification.',409);
  await c.query(`UPDATE ${NOTIFICATIONS}.settings SET paused=$1 WHERE id=TRUE`,[input.paused]);await AdminAuditStore.record({adminUserId:actor,action:'notification_pause_changed',entityType:'notification',entityId:'settings',metadata:{paused:input.paused,reason:input.reason}},c);return {paused:input.paused};});}
}
