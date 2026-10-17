import type {OrderRecord} from '../types/orders.js';

// Old payment handlers stored their local notice in supplier_response. These are
// not provider evidence, and missing publicId alone never proves nonacceptance.
const localPaymentNotices = new Set(['Paystack verify API','Paystack payment confirmed','Paystack webhook','Wallet payment confirmed','Wallet payment committed','Direct payment recovery','Managed store payment recovery']);
export function manualClosureBlock(order:Pick<OrderRecord,'resolution_json'|'status'|'delivered_at'|'failure_reason'|'supplier_response'>):string|null {
  const r=order.resolution_json;
  if(r?.outcome||r?.refundId||r?.lastAttemptAt||r?.providerStatus||r?.stage==='refund_pending'||order.status==='refunded'||order.delivered_at)
    return 'Reconcile the existing customer refund or delivery evidence first; manual resolution cannot replace it.';
  if(order.failure_reason==='supplier_submission_uncertain'||r?.supplierEvidence?.status==='uncertain')
    return 'Supplier acceptance is uncertain. Reconcile it before closing this customer case.';
  const evidenceConfirmed=!!r?.supplierEvidence&&['failed','refunded'].includes(r.supplierEvidence.status);
  const raw=order.supplier_response?.trim();
  if(raw){
    if(localPaymentNotices.has(raw))return evidenceConfirmed?null:'This is a local payment notice, not supplier evidence. Record independently confirmed supplier failure/nonacceptance using Record Supplier Evidence first.';
    let status='';try{const parsed=JSON.parse(raw);status=String(parsed?.data?.status||parsed?.status||'').toLowerCase();}catch{}
    if(!['failed','refund_pending','refunded','rejected','cancelled','expired'].includes(status))
      return 'Supplier evidence is active, completed or unverifiable. Refresh the original supplier identifier or reconcile with the supplier before manual closure.';
  }else if(!evidenceConfirmed)return 'Record independently confirmed supplier failure/nonacceptance using Record Supplier Evidence first. An absent supplier identifier is not proof.';
  return null;
}
