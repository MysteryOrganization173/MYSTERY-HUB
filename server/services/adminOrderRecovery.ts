import {createHash} from 'node:crypto';
import {OrdersStore} from '../db/ordersStore.js';
import {OrderResolutionStore} from '../db/orderResolutionStore.js';
import {AdminAuditStore} from '../db/adminAuditStore.js';
import {FinanceError,FinanceStore} from '../db/financeStore.js';
import {PaystackServerService} from './paystackService.js';
import {FulfilmentService} from './fulfilmentService.js';
import {toAdminOrderDetails,type OrderRecord} from '../types/orders.js';

export function recoveryBlock(o:OrderRecord):string|null {
  if(o.supplier_order_id)return 'Refresh the original supplier identifier. This action never sends a second supplier request.';
  if(o.status!=='paid'||o.submitted_at||o.manual_review||o.resolution_json||o.failure_reason)
    return 'Only an unclaimed, verified paid order is eligible. Claimed, failed or uncertain submissions require supplier reconciliation; missing ID is not proof of nonacceptance.';
  if(o.service_type!=='data'||o.store_context||o.payment_status!=='success'||!o.paid_at||o.currency!=='GHS'||!Number.isSafeInteger(o.amount)||o.amount<=0)
    return 'This recovery action supports direct paid Data orders only. Use the existing service-specific reconciliation for other services.';
  return null;
}
const intentKey='admin-supplier-recovery-once';
export class AdminOrderRecovery {
  static async inspect(reference:string){const o=await OrdersStore.findOrder(reference);if(!o)throw new FinanceError('Order not found.',404);const intent=await OrderResolutionStore.request(o.id,intentKey);return {order:toAdminOrderDetails(o),eligible:!intent&&!recoveryBlock(o),reason:intent?'Recovery was already claimed. Inspect its original supplier result; it will not be resent.':recoveryBlock(o)};}
  static async recover(reference:string,actor:string,input:Record<string,unknown>){
    if(Object.keys(input).some(k=>!['confirmed','requestId','expectedUpdatedAt','note'].includes(k))||input.confirmed!==true||typeof input.requestId!=='string'||!/^[-\w]{8,64}$/.test(input.requestId)||typeof input.expectedUpdatedAt!=='string'||typeof input.note!=='string'||input.note.trim().length<10||input.note.length>1000||/[<>\x00-\x1f]|sk_(live|test)_|Bearer\s/i.test(input.note))throw new FinanceError('Confirm the exact order, current revision and operational reason without secrets.');
    if(!Number.isFinite(Date.parse(input.expectedUpdatedAt)))throw new FinanceError('Reload the current order revision.');
    const initial=await OrdersStore.findOrder(reference);if(!initial)throw new FinanceError('Order not found.',404);
    const hash=createHash('sha256').update(JSON.stringify([actor,input.requestId,input.expectedUpdatedAt,input.note])).digest('hex');
    const prior=await OrderResolutionStore.request(initial.id,intentKey);
    if(prior){if(prior.input_hash!==hash||prior.actor_id!==actor)throw new FinanceError('Recovery already claimed; reconcile the original attempt instead of resending.',409);return this.inspect(reference);}
    const blocked=recoveryBlock(initial);if(blocked)throw new FinanceError(blocked,409);
    // Read-only provenance verification. A stored paid flag or a test-mode
    // transaction cannot authorize a new supplier charge.
    if(initial.payment_provider==='paystack'){
      let tx;try{tx=await PaystackServerService.fetchRefundTransaction(initial.payment_reference);}catch{throw new FinanceError('Original live payment could not be verified. Nothing was dispatched.',503);}
      if(tx.status!=='success'||tx.domain!=='live'||tx.reference!==initial.payment_reference||tx.amountPesewas!==initial.amount||tx.currency!=='GHS')throw new FinanceError('Original payment is not an exact successful live transaction.',409);
    }else if(initial.payment_provider==='wallet'&&initial.user_id){
      const valid=await FinanceStore.read(initial.user_id,async tx=>{const ops=await tx.operations(),purchase=ops.find(p=>p.kind==='purchase'&&p.state==='completed'&&p.payload.orderId===initial.id&&p.amount_minor===initial.amount);return !!purchase&&!ops.some(p=>p.kind==='refund'&&p.payload.orderId===initial.id)&&(await tx.ledger()).filter(e=>e.operation_id===purchase.id&&e.bucket==='wallet').reduce((s,e)=>s+e.delta_minor,0)===-initial.amount;});
      if(!valid)throw new FinanceError('Original Wallet debit could not be verified.',409);
    }else throw new FinanceError('Unsupported payment provenance.',409);
    const provider=FulfilmentService.getProvider();
    if(!provider.client.isConfigured()||!provider.client.isFulfillmentEnabled()||FulfilmentService.isTestPaymentEnvironment())throw new FinanceError('Live supplier dispatch is disabled. Nothing was sent.',503);
    const preflight=await FulfilmentService.preflightCheck(initial.network,initial.bundle_size_snapshot,initial.recipient_phone);
    if(!preflight.allowed)throw new FinanceError(preflight.customerMessage||'Supplier preflight did not permit recovery.',409);
    const claimed=await OrderResolutionStore.transaction(initial.id,null,async client=>{
      const current=await OrdersStore.findOrder(initial.id,client);if(!current)throw new FinanceError('Order not found.',404);
      const previous=await OrderResolutionStore.request(current.id,intentKey,client);if(previous)return null;
      const reason=recoveryBlock(current);if(reason||new Date(current.updated_at).toISOString()!==new Date(input.expectedUpdatedAt as string).toISOString()||current.amount!==initial.amount||current.payment_reference!==initial.payment_reference||current.user_id!==initial.user_id)throw new FinanceError(reason||'Order changed. Reload before acting.',409);
      const claimed=await OrdersStore.claimOrderForSupplierDispatch(current.id,client);if(!claimed)throw new FinanceError('Another process already claimed this order.',409);
      await OrderResolutionStore.append({order_id:current.id,request_id:intentKey,input_hash:hash,actor_id:actor,action:'supplier_recovery_claimed',result:{version:0,stage:'under_review',lastActor:actor,updatedAt:new Date().toISOString()}},client);
      await AdminAuditStore.record({adminUserId:actor,action:'supplier_recovery_claimed',entityType:'order',entityId:current.id,metadata:{reason:input.note,request_id:input.requestId}},client);
      return claimed;
    });
    if(claimed)try{await FulfilmentService.dispatchClaimedOrder(claimed,true);}catch{await OrdersStore.saveSupplierUncertainSubmission(claimed.id,'Admin recovery interrupted. Inspect original acceptance; automatic resend is blocked.');}
    return this.inspect(reference);
  }
}
