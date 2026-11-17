import type {PoolClient} from 'pg';
import {FinanceError} from '../db/financeStore.js';
import {canonicalGhanaPhone} from '../utils/phone.js';
import {smsEstimate} from '../../src/utils/manualSms.js';
import {SMS_TRANSACTIONAL_COPY, substituteTransactional, type TransactionalStage} from '../../shared/smsTransactional.js';

export function processingEvidence(o:any) {
  return ['submitted','processing'].includes(o.status) && !!o.supplier_order_id && validTime(o.submitted_at,o.paid_at)
    && !o.manual_review && !o.resolution_json?.outcome;
}
export function deliveredEvidence(o:any) {
  return o.status==='delivered' && validTime(o.delivered_at,o.paid_at) && !o.manual_review
    && !['paystack_refund','wallet_refund','external_compensation'].includes(o.resolution_json?.outcome)
    && (!!o.supplier_order_id || o.service_type==='marketplace'&&o.marketplace_status==='completed');
}
export function attentionEvidence(o:any) {
  // Match the existing paid-order Admin actionable queue, including supplier-confirmed failures.
  return (o.manual_review===true||['failed','refund_pending','cancelled','expired'].includes(o.status)) && !['delivered','refunded'].includes(o.status)
    && o.resolution_json?.stage!=='resolved' && !['manual_fulfillment','external_compensation'].includes(o.resolution_json?.outcome);
}
function validTime(value:any,paid:any) {
  return !!value && Number.isFinite(+new Date(value)) && +new Date(value)<=Date.now() && +new Date(value)>=+new Date(paid);
}
export async function transactionalMessage(c:PoolClient,o:any,stage:TransactionalStage,guest:boolean) {
  const network=({mtn:'MTN',telecel:'Telecel',airteltigo:'AirtelTigo',at:'AirtelTigo'} as Record<string,string>)[String(o.network).toLowerCase()];
  const bundle=String(o.bundle_size_snapshot||'').replace(/\s/g,'').toUpperCase();
  const destination=canonicalGhanaPhone(o.recipient_phone||o.customer_phone);
  if(o.service_type!=='data'||!network||!/^\d{1,5}(?:\.\d{1,2})?(?:MB|GB|TB)$/.test(bundle)||!destination)
    throw new FinanceError('An approved bundle message requires valid order facts.',409);
  const saved=(await c.query('SELECT body,version,enabled FROM mysteryhub_sms.templates WHERE id=$1',[stage])).rows[0];
  if(saved?.enabled===false)throw new FinanceError('This automatic template is disabled.',409);
  const approved=SMS_TRANSACTIONAL_COPY[stage];
  const published=Object.values(approved).includes(saved?.body)?saved.body:approved.standard;
  const facts={subject:guest?'A':'Your',bundle,network,destination:'0'+destination.slice(4,6)+'XXXX'+destination.slice(-3),
    notify:guest?'this number':'you',delivery_notice:guest?"We'll text this number when delivered.":"We'll text you when delivered."};
  let body=substituteTransactional(published,facts);
  if(smsEstimate(body).segments>1)body=substituteTransactional(approved.concise,facts);
  if(smsEstimate(body).encoding!=='GSM-7'||smsEstimate(body).segments>1)throw new FinanceError('Order facts exceed the reviewed one-segment message.',409);
  return body;
}
