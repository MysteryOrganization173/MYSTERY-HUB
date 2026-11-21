import type {OrderRecord} from '../types/orders.js';
import type {ManualResolutionOutcome} from '../types/orderResolution.js';

// Old payment handlers stored their local notice in supplier_response. These are
// not provider evidence, and missing publicId alone never proves nonacceptance.
const localPaymentNotices = new Set(['Paystack verify API','Paystack payment confirmed','Paystack webhook','Wallet payment confirmed','Wallet payment committed','Direct payment recovery','Managed store payment recovery']);
function readSupplierResponse(raw: string | null | undefined): unknown {
  try { return JSON.parse(raw || 'null'); } catch { return null; }
}

function responseStatus(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const envelope = value as { status?: unknown; data?: { status?: unknown } };
  const status = envelope.data?.status ?? envelope.status;
  return typeof status === 'string' ? status.trim().toLowerCase() : '';
}

export function supplierResolutionStatus(raw: string | null | undefined): string {
  return responseStatus(readSupplierResponse(raw));
}

type ClosureOrder = Pick<OrderRecord,'resolution_json'|'status'|'delivered_at'|'failure_reason'|'supplier_response'|'supplier_order_id'|'submitted_at'>;

function uncertaintyMarker(parsed: unknown): boolean {
  return !!parsed&&typeof parsed==='object'&&Object.keys(parsed).length===3&&
    'isTimeout' in parsed&&parsed.isTimeout===true&&
    'reason' in parsed&&typeof parsed.reason==='string'&&!!parsed.reason.trim()&&
    'timestamp' in parsed&&typeof parsed.timestamp==='string'&&Number.isFinite(Date.parse(parsed.timestamp));
}

// This narrow exception separates the customer remedy from an earlier
// uncertain submission. Never use it on an active or acknowledged attempt.
export function keepsSupplierInvestigationOpen(order: ClosureOrder): boolean {
  if(order.status!=='failed'||order.supplier_order_id||order.submitted_at) return false;
  const raw=order.supplier_response?.trim();
  const marker=uncertaintyMarker(readSupplierResponse(raw));
  return marker&&/^pre-?launch\b/i.test(order.failure_reason||'') ||
    order.failure_reason==='supplier_submission_uncertain'&&(!raw||localPaymentNotices.has(raw)||marker);
}

export function manualClosureBlock(order: ClosureOrder, outcome: ManualResolutionOutcome = 'manual_fulfillment'): string|null {
  const r=order.resolution_json;
  if(r?.outcome||r?.refundId||r?.lastAttemptAt||r?.providerStatus||r?.verifiedAt||r?.stage==='refund_pending'||order.status==='refunded'||order.delivered_at)
    return 'Reconcile the existing customer refund or delivery evidence first; manual resolution cannot replace it.';
  const raw=order.supplier_response?.trim();
  const parsed=readSupplierResponse(raw);
  const status=responseStatus(parsed);
  const outer=parsed&&typeof parsed==='object'&&'status' in parsed&&typeof parsed.status==='string'
    ? parsed.status.trim().toLowerCase() : '';
  if(order.status==='delivered'||r?.supplierEvidence?.status==='delivered'||[status,outer].some(value=>['completed','delivered','processed'].includes(value)))
    return 'The original supplier response already reports delivery or completion. Reconcile conflicting evidence before recording a separate remedy.';
  if([status,outer].some(value=>['accepted','submitted','queued','pending','processing','in_progress'].includes(value)))
    return 'The original supplier response shows an active submission. Reconcile it before recording a separate remedy.';
  if(outcome==='manual_fulfillment'&&keepsSupplierInvestigationOpen(order)) return null;
  if(order.failure_reason==='supplier_submission_uncertain'||r?.supplierEvidence?.status==='uncertain')
    return 'Supplier acceptance is uncertain. Reconcile it before closing this customer case.';
  if(r?.supplierEvidence?.status==='refund_pending')
    return 'The supplier refund is pending. Confirm its final outcome before closing this customer case.';
  const evidence=r?.supplierEvidence;
  const evidenceConfirmed=!!evidence&&['failed','refunded'].includes(evidence.status);
  if(raw){
    if(localPaymentNotices.has(raw))return evidenceConfirmed?null:'This is a local payment notice, not supplier evidence. Record independently confirmed supplier failure/nonacceptance using Record Supplier Evidence first.';
    if(keepsSupplierInvestigationOpen(order)){
      return evidenceConfirmed&&typeof evidence.reference==='string'&&evidence.reference.trim().length>=3
        ? null
        : 'The original supplier outcome is unconfirmed. Confirm its failure or supplier refund, then save the supplier support or transaction reference under Record Supplier Evidence.';
    }
    if(!['failed','refund_pending','refunded','rejected','cancelled','expired'].includes(status))
      return 'Supplier evidence is active, completed or unverifiable. Refresh the original supplier identifier or reconcile with the supplier before manual closure.';
  }else if(!evidenceConfirmed)return 'Record independently confirmed supplier failure/nonacceptance using Record Supplier Evidence first. An absent supplier identifier is not proof.';
  return null;
}
