import {randomUUID} from 'node:crypto';
import webPush from 'web-push';
import {getPool} from '../db/connection.js';
import {FinanceError} from '../db/financeStore.js';
import {NOTIFICATIONS as n,notificationTransaction} from './notificationService.js';
import {pushConfiguration,decryptSubscription,validateSubscription} from './notificationSafety.js';

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
async function claim(){return notificationTransaction(async c=>{
 const lease=randomUUID();const row=(await c.query(`SELECT * FROM ${n}.deliveries WHERE state IN ('queued','retry') AND next_at<=NOW() AND (lease_until IS NULL OR lease_until<NOW()) ORDER BY next_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0];if(!row)return null;
 const updated=(await c.query(`UPDATE ${n}.deliveries SET attempts=attempts+1,lease=$2,lease_until=NOW()+interval '60 seconds',updated_at=NOW() WHERE id=$1 RETURNING *`,[row.id,lease])).rows[0];
 await c.query(`INSERT INTO ${n}.attempts(id,delivery_id,attempt) VALUES($1,$2,$3)`,[randomUUID(),updated.id,updated.attempts]);return updated;
});}
async function current(job:any){return (await getPool()!.query(`SELECT d.encrypted_subscription,e.id AS notification_id,e.template_snapshot FROM ${n}.devices d
 JOIN sessions s ON s.id=d.session_id AND s.user_id=d.user_id JOIN users u ON u.id=d.user_id
 JOIN ${n}.events e ON e.id=$4 AND e.user_id=d.user_id JOIN ${n}.templates t ON t.id=e.template_id
 LEFT JOIN ${n}.preferences p ON p.user_id=d.user_id JOIN ${n}.settings config ON config.id=TRUE
 WHERE d.id=$1 AND d.user_id=$2 AND d.binding_version=$3 AND s.expires_at>NOW() AND u.status='active' AND COALESCE(u.must_change_password,FALSE)=FALSE
 AND t.enabled=TRUE AND config.paused=FALSE AND e.created_at>NOW()-interval '24 hours'
 AND ((e.template_snapshot->>'category'='transactional' AND COALESCE(p.transactional,TRUE)) OR (e.template_snapshot->>'category'='marketing' AND COALESCE(p.marketing,FALSE)))`,[job.device_id,job.user_id,job.binding_version,job.event_id])).rows[0];}
export async function processNotificationBatch(sender:Sender=send,max=10){
 if(!pushConfiguration().enabled||!getPool())return {processed:0,disabled:true};
 const settings=(await getPool()!.query(`SELECT paused FROM ${n}.settings WHERE id=TRUE`)).rows[0];if(settings?.paused)return {processed:0,disabled:true};
 await expandNotificationEvents();let processed=0;
 for(let i=0;i<Math.max(1,Math.min(max,25));i++){
  const job=await claim();if(!job)break;let state='skipped',code='ineligible';
  const live=await current(job);
  if(live){try{
    const subscription=validateSubscription(decryptSubscription(live.encrypted_subscription));
    // Deliberately generic: a late packet following logout/account switch cannot expose another account's order or promotion.
    const payload=JSON.stringify({version:1,notificationId:live.notification_id,title:'Mystery Hub',body:'An account update is available. Sign in to view it.',tag:'mh-'+live.notification_id});
    await sender(subscription,payload);state='provider_accepted';code='accepted';
   }catch(error){const status=Number((error as {statusCode?:number})?.statusCode);if(error instanceof FinanceError&&error.status===400){state='invalid';code='subscription_invalid';}
    else if([404,410].includes(status)){state='invalid';code='endpoint_expired';}
    else if(status>=400&&status<500&&status!==429){state='failed';code='provider_rejected';}
    else if(job.attempts>=5){state='failed';code='retry_exhausted';}
    else{state='retry';code=status===429?'provider_rate_limit':'provider_unavailable';}
   }
  }
  await notificationTransaction(async c=>{
    const result=await c.query(`UPDATE ${n}.deliveries SET state=$3,last_code=$4,lease=NULL,lease_until=NULL,next_at=NOW()+($5::int*interval '1 second'),updated_at=NOW() WHERE id=$1 AND lease=$2 RETURNING id`,[job.id,job.lease,state,code,Math.min(1800,30*2**job.attempts)]);
    if(result.rowCount){await c.query(`UPDATE ${n}.attempts SET code=$3,finished_at=NOW() WHERE delivery_id=$1 AND attempt=$2`,[job.id,job.attempts,code]);
     if(state==='invalid')await c.query(`DELETE FROM ${n}.devices WHERE id=$1 AND binding_version=$2`,[job.device_id,job.binding_version]);}
  });processed++;
 }return {processed,disabled:false};
}
export function startNotificationWorker(){if(!pushConfiguration().enabled)return ()=>{};let busy=false;
 const tick=async()=>{if(busy)return;busy=true;try{await processNotificationBatch();}catch{console.warn('[Notifications] Durable queue processing deferred.');}finally{busy=false;}};
 const timer=setInterval(tick,10000);timer.unref();void tick();return ()=>clearInterval(timer);
}
