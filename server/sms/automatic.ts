import type {PoolClient} from 'pg';
import {smsTransaction} from './store.js';
import {arkeselConfig} from './arkesel.js';
import {orderRecipients,digest} from './policy.js';
import {DIRECT_CONTACT_SQL} from '../db/contactHubStore.js';
import {smsEstimate} from '../../src/utils/manualSms.js';
import {SMS_AUTO_EVENTS} from '../../shared/smsTransactional.js';

/** SMS owns discovery for both account and guest orders. Push subscriptions/events are irrelevant. */
export async function expandSmsEvents() {
  const config=arkeselConfig();if(!config.auto)return;
  return smsTransaction(async c=>{
    const s=(await c.query('SELECT paused,auto_enabled,cutoff,auto_types FROM mysteryhub_sms.settings WHERE id=true FOR SHARE')).rows[0];
    if(s.paused||!s.auto_enabled||!s.cutoff)return;
    for(const stage of SMS_AUTO_EVENTS) {
      if(!s.auto_types.includes(stage))continue;
      const condition={
        order_processing:"o.status IN ('submitted','processing') AND o.supplier_order_id IS NOT NULL AND o.submitted_at>=o.paid_at AND o.submitted_at<=now() AND NOT o.manual_review AND o.resolution_json->>'outcome' IS NULL",
        order_delivered:"o.status='delivered' AND o.delivered_at>=o.paid_at AND o.delivered_at<=now() AND NOT o.manual_review",
        delivery_attention:"(o.manual_review OR o.status IN ('failed','refund_pending','cancelled','expired')) AND o.status NOT IN ('delivered','refunded') AND COALESCE(o.resolution_json->>'stage','')<>'resolved'",
        refund_update:"o.resolution_json->>'outcome' IN ('paystack_refund','wallet_refund') AND o.resolution_json->>'stage' IN ('refund_pending','resolved')",
      }[stage];
      const suffix=stage==='refund_update'?"$2||':'||(o.resolution_json->>'stage')":'$2';
      // Existing private outbox supports all order IDs; no trigger or business-table migration is needed.
      await c.query(`INSERT INTO mysteryhub_sms.guest_events(order_id,event_key,template_id)
        SELECT o.id,'v2:'||o.id||':'||${suffix},$2 FROM public.orders o
        WHERE o.created_at>=$1 AND o.created_at<=now() AND o.payment_status='success'
        AND o.payment_provider IN ('paystack','wallet') AND o.paid_at<=now() AND ${DIRECT_CONTACT_SQL}
        AND NOT EXISTS(SELECT 1 FROM order_test_fixtures f WHERE f.order_id=o.id)
        AND (${condition}) AND NOT EXISTS(SELECT 1 FROM mysteryhub_sms.guest_events e WHERE e.event_key='v2:'||o.id||':'||${suffix})
        ORDER BY o.created_at,o.id LIMIT 25 ON CONFLICT DO NOTHING`,[s.cutoff,stage]);
    }
    const events=(await c.query(`SELECT * FROM mysteryhub_sms.guest_events e WHERE left(event_key,3)='v2:' AND created_at>=$1
      AND NOT EXISTS(SELECT 1 FROM mysteryhub_sms.consumed_events x WHERE x.event_key='v2:'||e.id)
      ORDER BY created_at,id LIMIT 50`,[s.cutoff])).rows;
    for(const e of events) {
      if(!(await c.query("INSERT INTO mysteryhub_sms.consumed_events(event_key) VALUES($1) ON CONFLICT DO NOTHING RETURNING event_key",['v2:'+e.id])).rowCount)continue;
      if(!s.auto_types.includes(e.template_id))continue;
      const order=(await c.query('SELECT created_at FROM public.orders WHERE id=$1',[e.order_id])).rows[0];
      if(!order||+new Date(order.created_at)<+new Date(s.cutoff))continue;
      let result;try{result=await orderRecipients(c,e.order_id,e.template_id,false,true);}catch(error){if([400,409].includes((error as any)?.status))continue;throw error;}
      for(const r of result.recipients)await c.query(`INSERT INTO mysteryhub_sms.messages
        (event_key,order_id,user_id,purpose,origin,recipient,body,sender,sandbox,estimated_segments,context)
        VALUES($1,$2,$3,'transactional','automatic',$4,$5,$6,$7,$8,$9) ON CONFLICT(event_key) DO NOTHING`,
        [digest([e.order_id,r.templateId,r.phone]),e.order_id,r.userId,r.phone,result.body,config.sender,config.sandbox,smsEstimate(result.body).segments,
          JSON.stringify({role:r.role,templateId:r.templateId,eventType:e.template_id,experienceVersion:2})]);
    }
    await cancelObsoleteAutomatic(c);
  });
}

export async function cancelObsoleteAutomatic(c:PoolClient) {
  await c.query(`UPDATE mysteryhub_sms.messages m SET state='cancelled',error_code='AUTOMATIC_EVENT_OBSOLETE',updated_at=now()
    FROM mysteryhub_sms.settings s WHERE s.id AND m.origin='automatic' AND m.state='queued' AND
    (m.context->>'experienceVersion' IS DISTINCT FROM '2' OR NOT COALESCE(m.context->>'eventType'=ANY(s.auto_types),false)
      OR NOT EXISTS(SELECT 1 FROM public.orders o WHERE o.id=m.order_id AND o.created_at>=s.cutoff)
      OR (m.context->>'templateId'='order_processing' AND EXISTS(SELECT 1 FROM public.orders o WHERE o.id=m.order_id AND (o.status NOT IN ('submitted','processing') OR o.manual_review))))`);
}
