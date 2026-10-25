import type {OrderRecord} from '../types/orders.js';

/** A supplier cost snapshot is an estimate, not proof of payment or supplier acceptance. */
export function isUnpaidFailedAttempt(o:OrderRecord):boolean {
  return o.status==='failed' && ['pending','failed','cancelled','expired'].includes(o.payment_status)
    && o.payment_provider==='paystack' && !o.paid_at && !o.submitted_at && !o.delivered_at
    && !o.supplier_order_id && !o.manual_review && !o.resolution_json && !o.store_context
    && o.failure_reason!=='supplier_submission_uncertain';
}
export const unpaidFailedAttemptSql = `(status='failed' AND payment_status IN ('pending','failed','cancelled','expired')
 AND payment_provider='paystack' AND paid_at IS NULL AND submitted_at IS NULL AND delivered_at IS NULL
 AND supplier_order_id IS NULL AND COALESCE(manual_review,FALSE)=FALSE AND resolution_json IS NULL AND store_context IS NULL
 AND failure_reason IS DISTINCT FROM 'supplier_submission_uncertain')`;

export function orderManagementEligibility(o:OrderRecord,registeredTest:boolean,linked:boolean,now=Date.now()) {
  const active=['paid','queued','submitted','processing','refund_pending'].includes(o.status);
  const unresolved=o.manual_review || o.failure_reason==='supplier_submission_uncertain'
    || o.payment_status==='success' && !['delivered','refunded'].includes(o.status) && o.resolution_json?.stage!=='resolved'
    || o.status==='refunded' && o.resolution_json?.stage!=='resolved';
  const stalePending=o.status==='pending_payment' && now-new Date(o.created_at).getTime()>=86_400_000;
  const terminal=['delivered','refunded','cancelled','expired','failed'].includes(o.status)||stalePending;
  const archive=!o.archived_at && terminal && !active && !unresolved;
  const denials:string[]=[];
  if(!registeredTest)denials.push('TEST_PROVENANCE_REQUIRED');
  if(o.user_id)denials.push('CUSTOMER_LINKED');
  if(o.payment_provider!=='paystack'||!['failed','cancelled','expired'].includes(o.payment_status)||o.paid_at)denials.push('PAYMENT_EVIDENCE');
  if(!['cancelled','expired','failed'].includes(o.status))denials.push('NOT_CLOSED');
  if(o.submitted_at||o.delivered_at||o.supplier_order_id||o.supplier_response||o.supplier_offer_ref||o.supplier_cost_minor!=null)denials.push('SUPPLIER_EVIDENCE');
  if(o.store_context||o.commercial_context||o.referral_attribution_id||o.referrer_user_id||o.referral_code||o.resolution_json||linked)denials.push('CONNECTED_EVIDENCE');
  if(o.manual_review||active||unresolved)denials.push('UNSETTLED');
  return {archive,restore:Boolean(o.archived_at),deleteTest:denials.length===0,denials};
}
