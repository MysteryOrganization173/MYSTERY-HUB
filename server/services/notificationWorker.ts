import {randomUUID} from 'node:crypto';
import webPush from 'web-push';
import {getPool} from '../db/connection.js';
import {FinanceError} from '../db/financeStore.js';
import {NOTIFICATIONS as n,notificationTransaction,pruneExpiredGuests,guestNewsEnabled,announcementPage} from './notificationService.js';
import {pushConfiguration,decryptSubscription,validateSubscription,renderTemplate,testOpenToken} from './notificationSafety.js';

type Sender=(subscription:ReturnType<typeof decryptSubscription>,payload:string)=>Promise<unknown>;
async function send(subscription:ReturnType<typeof decryptSubscription>,payload:string){const c=pushConfiguration();return webPush.sendNotification(subscription,payload,{TTL:3600,urgency:'normal',timeout:8000,vapidDetails:{subject:c.subject,publicKey:c.publicKey!,privateKey:c.privateKey}});}
export async function expandNotificationEvents(){
 return notificationTransaction(async c=>{const events=(await c.query(`SELECT * FROM ${n}.events WHERE expanded_at IS NULL ORDER BY created_at LIMIT 25 FOR UPDATE SKIP LOCKED`)).rows;
  for(const event of events){
   await c.query(`INSERT INTO ${n}.deliveries(event_id,device_id,user_id,binding_version)
    SELECT $1,d.id,d.user_id,d.binding_version FROM ${n}.devices d JOIN sessions s ON s.id=d.session_id AND s.user_id=d.user_id
    JOIN users u ON u.id=d.user_id LEFT JOIN ${n}.preferences p ON p.user_id=d.user_id
    JOIN ${n}.templates t ON t.id=$3
    WHERE d.user_id=$2 AND s.expires_at>NOW() AND u.status='active' AND COALESCE(u.must_change_password,FALSE)=FALSE AND t.enabled=TRUE
    AND $4::timestamptz>NOW()-interval '24 hours' AND COALESCE(p.transactional,TRUE)=TRUE AND t.category='transactional'
    ON CONFLICT(event_id,device_id) DO NOTHING`,[event.id,event.user_id,event.template_id,event.created_at]);
   await c.query(`UPDATE ${n}.events SET expanded_at=NOW() WHERE id=$1`,[event.id]);
  }return events.length;
 });
}
/** While sending is paused only the operator's own tests are claimed; nothing for customers or guests moves. */
async function claim(testsOnly:boolean){return notificationTransaction(async c=>{
 const lease=randomUUID();const row=(await c.query(`SELECT q.* FROM ${n}.deliveries q WHERE q.state IN ('queued','retry') AND q.next_at<=NOW() AND (q.lease_until IS NULL OR q.lease_until<NOW())
  AND (NOT $1::boolean OR EXISTS(SELECT 1 FROM ${n}.events e WHERE e.id=q.event_id AND e.operator_test)) ORDER BY q.next_at,q.id LIMIT 1 FOR UPDATE OF q SKIP LOCKED`,[testsOnly])).rows[0];if(!row)return null;
 const updated=(await c.query(`UPDATE ${n}.deliveries SET attempts=attempts+1,lease=$2,lease_until=NOW()+interval '60 seconds',updated_at=NOW() WHERE id=$1 RETURNING *`,[row.id,lease])).rows[0];
 await c.query(`INSERT INTO ${n}.attempts(id,delivery_id,attempt) VALUES($1,$2,$3)`,[randomUUID(),updated.id,updated.attempts]);return updated;
});}
/**
 * Re-checked right before sending. Accounts: a signed-in device still bound to the same account, an enabled
 * template, the person's current preference for that purpose and no pause; the operator's own test needs none of
 * the preference or pause conditions because it can only exist for their own account. Guest browsers: the same
 * unexpired registration, guest news still on, an announcement, no pause.
 */
async function current(job:any){
 if(job.guest_device_id){if(!guestNewsEnabled())return undefined;
  return (await getPool()!.query(`SELECT g.encrypted_subscription,e.id AS notification_id,e.template_snapshot,e.destination FROM ${n}.guest_devices g
   JOIN ${n}.events e ON e.id=$3 AND e.guest_device_id=g.id JOIN ${n}.templates t ON t.id=e.template_id JOIN ${n}.settings config ON config.id=TRUE
   WHERE g.id=$1 AND g.binding_version=$2 AND g.expires_at>NOW() AND t.enabled=TRUE AND config.paused=FALSE AND e.created_at>NOW()-interval '24 hours'
   AND e.template_snapshot->>'category'='marketing'`,[job.guest_device_id,job.binding_version,job.event_id])).rows[0];}
 if(!job.device_id||!job.user_id)return undefined;
 return (await getPool()!.query(`SELECT d.encrypted_subscription,e.id AS notification_id,e.template_snapshot,e.destination,e.operator_test FROM ${n}.devices d
 JOIN sessions s ON s.id=d.session_id AND s.user_id=d.user_id JOIN users u ON u.id=d.user_id
 JOIN ${n}.events e ON e.id=$4 AND e.user_id=d.user_id JOIN ${n}.templates t ON t.id=e.template_id
 LEFT JOIN ${n}.preferences p ON p.user_id=d.user_id JOIN ${n}.settings config ON config.id=TRUE
 WHERE d.id=$1 AND d.user_id=$2 AND d.binding_version=$3 AND s.expires_at>NOW() AND u.status='active' AND COALESCE(u.must_change_password,FALSE)=FALSE
 AND t.enabled=TRUE AND e.created_at>NOW()-interval '24 hours'
 AND (e.operator_test OR config.paused=FALSE AND ((e.template_snapshot->>'category'='transactional' AND COALESCE(p.transactional,TRUE)) OR (e.template_snapshot->>'category'='marketing' AND COALESCE(p.marketing,FALSE))))`,[job.device_id,job.user_id,job.binding_version,job.event_id])).rows[0];}
/** Puts a claimed delivery back in the queue untouched (sending was paused after the claim); the try is noted. */
async function requeue(job:any){await notificationTransaction(async c=>{
 // Only a delivery that is still queued goes back; one cancelled meanwhile stays cancelled.
 const back=await c.query(`UPDATE ${n}.deliveries SET lease=NULL,lease_until=NULL,next_at=NOW(),updated_at=NOW() WHERE id=$1 AND lease=$2 AND state IN ('queued','retry') RETURNING id`,[job.id,job.lease]);
 await c.query(`UPDATE ${n}.attempts SET code='paused',finished_at=NOW() WHERE delivery_id=$1 AND attempt=$2`,[job.id,job.attempts]);
 if(!back.rowCount)await c.query(`UPDATE ${n}.deliveries SET lease=NULL,lease_until=NULL WHERE id=$1 AND lease=$2`,[job.id,job.lease]);
});}
export async function processNotificationBatch(sender:Sender=send,max=10){
 if(!pushConfiguration().enabled||!getPool())return {processed:0,disabled:true};
 // Retention runs even while sending is paused: expired guest registrations never outlive their 180 days.
 await pruneExpiredGuests().catch(()=>0);
 // Paused: no order update or announcement is expanded or sent; only the operator's own tests move.
 const pausedNow=async()=>(await getPool()!.query(`SELECT paused FROM ${n}.settings WHERE id=TRUE`)).rows[0]?.paused!==false;
 const paused=await pausedNow();
 if(!paused)await expandNotificationEvents();let processed=0;
 for(let i=0;i<Math.max(1,Math.min(max,25));i++){
  // A pause that lands while a batch is running holds the rest of it: nothing more is claimed for customers.
  if(!paused&&i>0&&await pausedNow())break;
  const job=await claim(paused);if(!job)break;let state='skipped',code='ineligible';
  const live=await current(job);
  // Not sendable only because sending was paused after this claim: it goes back in the queue, never dropped.
  if(!live&&!paused&&await pausedNow()){await requeue(job);break;}
  if(live){try{
    const subscription=validateSubscription(decryptSubscription(live.encrypted_subscription));
    // Account updates stay deliberately generic: a late packet after logout or an account switch cannot expose
    // another account's order. Announcements (opted-in news and offers) carry their own approved, non-personal
    // template text, so the phone can say what they are about.
    const fit=(text:string,max:number)=>text.length<=max?text:text.slice(0,max-1).trimEnd()+'…';
    const announcement=live.template_snapshot?.category==='marketing'?renderTemplate(live.template_snapshot,'Service announcement'):null;
    const payload=JSON.stringify(announcement
     ?{version:1,notificationId:live.notification_id,kind:'announcement',title:fit(announcement.title,80),body:fit(announcement.body,240),url:announcementPage(live.destination),tag:'mh-'+live.notification_id}
     :{version:1,notificationId:live.notification_id,kind:'account',title:'Mystery Hub',body:'An account update is available. Sign in to view it.',tag:'mh-'+live.notification_id,
       // The operator's own test carries a token only this push delivers; opening the test with it is the phone check.
       ...(live.operator_test?{open:testOpenToken(live.notification_id)}:{})});
    await sender(subscription,payload);state='provider_accepted';code='accepted';
   }catch(error){const status=Number((error as {statusCode?:number})?.statusCode);if(error instanceof FinanceError&&error.status===400){state='invalid';code='subscription_invalid';}
    else if([404,410].includes(status)){state='invalid';code='endpoint_expired';}
    else if(status>=400&&status<500&&status!==429){state='failed';code='provider_rejected';}
    else if(job.attempts>=5){state='failed';code='retry_exhausted';}
    else{state='retry';code=status===429?'provider_rate_limit':'provider_unavailable';}
   }
  }
  await notificationTransaction(async c=>{
    // A delivery cancelled while this send was in flight is never revived; it is recorded as accepted only if the push
    // service had already taken it (the truth). The try itself is always recorded.
    const result=await c.query(`UPDATE ${n}.deliveries SET state=$3,last_code=$4,lease=NULL,lease_until=NULL,next_at=NOW()+($5::int*interval '1 second'),updated_at=NOW()
     WHERE id=$1 AND lease=$2 AND (state IN ('queued','retry') OR $3='provider_accepted') RETURNING id`,[job.id,job.lease,state,code,Math.min(1800,30*2**job.attempts)]);
    await c.query(`UPDATE ${n}.attempts SET code=$3,finished_at=NOW() WHERE delivery_id=$1 AND attempt=$2 AND finished_at IS NULL`,[job.id,job.attempts,code]);
    if(!result.rowCount)await c.query(`UPDATE ${n}.deliveries SET lease=NULL,lease_until=NULL WHERE id=$1 AND lease=$2`,[job.id,job.lease]);
    {
     // A subscription the push service says is gone is removed (even if this delivery was cancelled meanwhile); for a
     // guest browser that ends its news, with evidence. Both statements are idempotent.
     if(state==='invalid'&&job.guest_device_id)await c.query(`WITH gone AS (DELETE FROM ${n}.guest_devices WHERE id=$1 AND binding_version=$2 RETURNING id)
      INSERT INTO ${n}.consents(guest_device_id,purpose,granted,source) SELECT id,'marketing',FALSE,'guest_endpoint_expired' FROM gone`,[job.guest_device_id,job.binding_version]);
     else if(state==='invalid'&&job.device_id)await c.query(`DELETE FROM ${n}.devices WHERE id=$1 AND binding_version=$2`,[job.device_id,job.binding_version]);}
  });processed++;
 }return {processed,disabled:paused};
}
const workerHealth:{running:boolean;inFlight:boolean;lastCompletedAt:string|null;lastErrorAt:string|null;lastResult:'paused_or_disabled'|'processed'|null}={running:false,inFlight:false,lastCompletedAt:null,lastErrorAt:null,lastResult:null};
/** Process-local observation only, not proof of provider acceptance or phone receipt. Admin route only. */
export const notificationWorkerHealth=()=>({...workerHealth,scope:'process_since_start' as const});
export function startNotificationWorker(){if(!pushConfiguration().enabled)return ()=>{};let busy=false;workerHealth.running=true;
 const tick=async()=>{if(busy)return;busy=true;workerHealth.inFlight=true;try{const result=await processNotificationBatch();workerHealth.lastResult=result.disabled?'paused_or_disabled':'processed';workerHealth.lastCompletedAt=new Date().toISOString();}catch{workerHealth.lastErrorAt=new Date().toISOString();console.warn('[Notifications] Durable queue processing deferred.');}finally{busy=false;workerHealth.inFlight=false;}};
 const timer=setInterval(tick,10000);timer.unref();void tick();return ()=>{clearInterval(timer);workerHealth.running=false;};
}
