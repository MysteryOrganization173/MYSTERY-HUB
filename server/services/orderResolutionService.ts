import {createHash} from 'node:crypto';
import {OrdersStore} from '../db/ordersStore.js';
import {OrderResolutionStore} from '../db/orderResolutionStore.js';
import {AdminAuditStore} from '../db/adminAuditStore.js';
import {FinanceError} from '../db/financeStore.js';
import {FinanceService} from './financeService.js';
import {PaystackServerService} from './paystackService.js';
import {toAdminOrderDetails} from '../types/orders.js';
import type {ManualResolutionOutcome,OrderResolution} from '../types/orderResolution.js';
const allowed=['begin_review','supplier_evidence','verify_external','refund_wallet','resolve_manual'];
const manualOutcomes:ManualResolutionOutcome[]=['manual_fulfillment','external_compensation','supplier_failed_pending_remedy'];
function evidenceText(value:unknown,label:string,min=5,max=1000){
 const text=typeof value==='string'?value.trim():'';
 if(text.length<min||text.length>max||/[<>\x00-\x1f]|sk_(?:live|test)_|Bearer\s/i.test(text))throw new FinanceError(`Provide ${label} (${min}–${max} characters), without secrets.`);
 return text;
}
export class OrderResolutionService {
 static async details(reference:string){const order=await OrdersStore.findOrder(reference);if(!order)throw new FinanceError('Order not found.',404);return {order:toAdminOrderDetails(order),history:await OrderResolutionStore.history(order.id)};}
 static async action(reference:string,adminId:string,input:Record<string,unknown>){
   for(const key of Object.keys(input))if(!['action','confirmed','requestId','expectedUpdatedAt','expectedVersion','note','evidenceStatus','refundId','manualOutcome','evidence','method','reference'].includes(key))throw new FinanceError('Unexpected resolution field.');
   const action=String(input.action||'');if(!allowed.includes(action)||input.confirmed!==true)throw new FinanceError('Explicitly confirm an available resolution action.');
   if(typeof input.requestId!=='string'||! /^[a-zA-Z0-9_-]{8,64}$/.test(input.requestId))throw new FinanceError('Invalid resolution request ID.');
   if(typeof input.expectedUpdatedAt!=='string'||!Number.isFinite(Date.parse(input.expectedUpdatedAt))||!Number.isSafeInteger(input.expectedVersion))throw new FinanceError('Reload the current order before continuing.');
   const note=typeof input.note==='string'?input.note.trim():'';
   if(note.length<5||note.length>1000||/[<>\x00-\x08]|sk_(?:live|test)_|Bearer\s/i.test(note))throw new FinanceError('Provide a concise operational reason (5–1000 characters).');
   let manual:OrderResolution['manual'];
   if(action==='resolve_manual'){
     if(!manualOutcomes.includes(input.manualOutcome as ManualResolutionOutcome))throw new FinanceError('Select an explicit manual resolution outcome.');
     manual={outcome:input.manualOutcome as ManualResolutionOutcome,reason:note,evidence:evidenceText(input.evidence,'documented evidence'),actor:adminId,at:''};
     if(manual.outcome==='external_compensation'){manual.method=evidenceText(input.method,'the compensation method',2,80);manual.reference=evidenceText(input.reference,'the external transaction/reference',3,160);}
     if(input.refundId!==undefined||input.evidenceStatus!==undefined)throw new FinanceError('Do not mix manual attestation with provider refund actions.');
   }else if(['manualOutcome','evidence','method','reference'].some(key=>input[key]!==undefined))throw new FinanceError('Manual evidence requires the manual resolution action.');
   const initial=await OrdersStore.findOrder(reference);if(!initial)throw new FinanceError('Order not found.',404);
   const hash=createHash('sha256').update(JSON.stringify(Object.keys(input).sort().map(key=>[key,input[key]]))).digest('hex');
   const previous=await OrderResolutionStore.request(initial.id,input.requestId);
   if(previous){if(previous.input_hash!==hash||previous.actor_id!==adminId)throw new FinanceError('Resolution request changed.',409);return this.details(reference);}
   if(initial.payment_status!=='success'||!initial.paid_at||initial.currency!=='GHS'||!Number.isSafeInteger(initial.amount)||initial.amount<=0)throw new FinanceError('Only verified paid orders are eligible.',409);
   if(!['failed','refund_pending','refunded','cancelled','expired'].includes(initial.status))throw new FinanceError('Await the authoritative supplier outcome; do not refund an active/delivered order here.',409);
   if(action==='refund_wallet'&&(initial.payment_provider!=='wallet'||!initial.user_id))throw new FinanceError('Paystack-to-Wallet compensation is disabled. Refund the original payment method.',409);
   if(action==='verify_external'&&initial.payment_provider!=='paystack')throw new FinanceError('Use the original Wallet ledger refund.',409);
   let provider:Awaited<ReturnType<typeof PaystackServerService.fetchRefund>>|undefined,unavailable=false;
   if(action==='verify_external'){
     if(!initial.resolution_json||initial.resolution_json.stage==='resolved')throw new FinanceError('Begin an unresolved customer refund review first.',409);
     if(typeof input.refundId!=='string'||! /^[1-9][0-9]{0,18}$/.test(input.refundId))throw new FinanceError('Enter the externally initiated Paystack refund ID.');
     if(initial.resolution_json.refundId&&initial.resolution_json.refundId!==input.refundId)throw new FinanceError('Reconcile the already linked refund before using another ID.',409);
     try{provider=await PaystackServerService.fetchRefund(input.refundId);}catch{unavailable=true;}
     if(provider){let payment:Awaited<ReturnType<typeof PaystackServerService.fetchRefundTransaction>>|undefined;
       try{payment=await PaystackServerService.fetchRefundTransaction(initial.payment_reference);}catch{unavailable=true;}
       if(!unavailable&&(!payment||payment.domain!=='live'||payment.reference!==initial.payment_reference||payment.amountPesewas!==initial.amount||payment.currency!==initial.currency||payment.transactionId!==provider.transactionId||provider.id!==input.refundId||provider.domain!=='live'||provider.amountMinor!==initial.amount||provider.currency!==initial.currency||provider.status==='processed'&&!['success','reversed'].includes(payment.status)))throw new FinanceError('Refund evidence does not match this exact live payment, amount and currency.',409);
       if(provider.status==='processed'&&(!provider.refundedAt||!Number.isFinite(Date.parse(provider.refundedAt))))throw new FinanceError('Refund completion evidence is incomplete.',409);
     }
   }
   const effects:Array<()=>Promise<void>>=[];
   const result=await OrderResolutionStore.transaction(initial.id,action==='refund_wallet'?initial.user_id!:null,async(client,tx)=>{
     const order=await OrdersStore.findOrder(initial.id,client);if(!order)throw new FinanceError('Order not found.',404);
     const old=await OrderResolutionStore.request(order.id,input.requestId as string,client);if(old){if(old.input_hash!==hash||old.actor_id!==adminId)throw new FinanceError('Resolution request changed.',409);return toAdminOrderDetails(order);}
     if(new Date(order.updated_at).toISOString()!==new Date(input.expectedUpdatedAt as string).toISOString()||(order.resolution_json?.version||0)!==input.expectedVersion)throw new FinanceError('Order changed. Reload its details before acting.',409);
     if(order.resolution_json?.stage==='resolved'||!['failed','refund_pending','refunded','cancelled','expired'].includes(order.status))throw new FinanceError('This case is already resolved or its supplier outcome changed.',409);
     if(order.payment_status!=='success'||!order.paid_at||order.payment_reference!==initial.payment_reference||order.amount!==initial.amount||order.currency!==initial.currency||order.payment_provider!==initial.payment_provider||order.user_id!==initial.user_id)throw new FinanceError('Payment identity changed.',409);
     const now=new Date().toISOString();const resolution:OrderResolution={...(order.resolution_json||{}),version:(order.resolution_json?.version||0)+1,stage:order.resolution_json?.stage||'under_review',lastActor:adminId,updatedAt:now};
     if(manual){
       // A linked/attempted customer refund cannot be replaced with an operator attestation.
       if(resolution.outcome||resolution.refundId||resolution.lastAttemptAt||resolution.providerStatus||resolution.stage==='refund_pending'||order.status==='refunded'||order.delivered_at)throw new FinanceError('Reconcile the existing customer refund or delivery evidence first; manual resolution cannot replace it.',409);
       if(manual.outcome!=='supplier_failed_pending_remedy'){
         if(order.failure_reason==='supplier_submission_uncertain'||resolution.supplierEvidence?.status==='uncertain')throw new FinanceError('Supplier acceptance is uncertain. Reconcile it before closing this customer case.',409);
         if(order.supplier_response){
           let status='';try{const raw=JSON.parse(order.supplier_response);status=String(raw?.data?.status||raw?.status||'').toLowerCase();}catch{}
           if(!['failed','refund_pending','refunded','rejected','cancelled','expired'].includes(status))throw new FinanceError('Supplier evidence is active, completed or unverifiable. Reconcile it before manual closure.',409);
         }else if(order.supplier_order_id&&!resolution.supplierEvidence)throw new FinanceError('Document a confirmed supplier failure before manual closure.',409);
       }
       resolution.manual={...manual,at:now};
       resolution.stage=manual.outcome==='supplier_failed_pending_remedy'?'under_review':'resolved';
       if(resolution.stage==='resolved')resolution.outcome=manual.outcome as 'manual_fulfillment'|'external_compensation';
       else resolution.supplierEvidence={status:'failed',note:manual.evidence,actor:adminId,at:now};
     }
     if(action==='supplier_evidence'){
       if(!['failed','refund_pending','refunded','uncertain'].includes(String(input.evidenceStatus)))throw new FinanceError('Select a documented supplier outcome.');
       resolution.supplierEvidence={status:input.evidenceStatus as any,note,actor:adminId,at:now};
     }
     if(action==='verify_external'){
       resolution.lastAttemptAt=now;
       if(unavailable){resolution.lastError='Paystack verification unavailable. Customer refund remains unconfirmed.';}
       else if(provider){resolution.refundId=provider.id;resolution.providerStatus=provider.status;resolution.paymentReference=order.payment_reference;resolution.amountMinor=order.amount;resolution.outcome='paystack_refund';resolution.lastError=undefined;resolution.stage=provider.status==='processed'?'resolved':['failed','needs-attention'].includes(provider.status)?'under_review':'refund_pending';if(resolution.stage==='under_review')resolution.lastError='External refund needs action in Paystack; customer remedy remains unresolved.';if(resolution.stage==='resolved')resolution.verifiedAt=now;}
     }
     if(action==='refund_wallet'){
       if(!tx||!resolution.supplierEvidence||!['failed','refunded'].includes(resolution.supplierEvidence.status)||resolution.outcome)throw new FinanceError('Record confirmed supplier failure evidence before the original Wallet refund.',409);
       const refunded={...order,status:'refunded' as const,manual_review:false};
       await FinanceService.refundInTransaction(refunded,tx,adminId);
       resolution.stage='resolved';resolution.outcome='wallet_refund';resolution.amountMinor=order.amount;resolution.paymentReference=order.payment_reference;resolution.verifiedAt=now;
     }
     let current=order;
     if(resolution.stage==='resolved'&&!manual){
       current=(await OrdersStore.updateOrderStatus(order.id,'refunded',undefined,undefined,undefined,{client,afterCommit:effects,authoritativeCustomerRefund:true}))!;
       current={...current,manual_review:false};
     }
     if(manual)current={...order,manual_review:resolution.stage!=='resolved'};
     // Refund ID uniqueness, order state and append-only history/audit commit together.
     await OrderResolutionStore.append({order_id:order.id,request_id:input.requestId as string,input_hash:hash,action,actor_id:adminId,result:resolution},client);
     await AdminAuditStore.record({adminUserId:adminId,action:'order_resolution_'+action,entityType:'order',entityId:order.id,metadata:{stage:resolution.stage,amount_minor:resolution.amountMinor||null,refund_id:resolution.refundId||null,reason:note}},client);
     return toAdminOrderDetails(await OrdersStore.persistResolution(current,resolution,client));
   });
   for(const effect of effects)try{await effect();}catch{console.warn('[Order resolution] Durable refund requires downstream reconciliation.');}
   return {order:result,history:await OrderResolutionStore.history(initial.id),message:manual?(result.resolution?.stage==='resolved'?'Manually resolved by operator attestation. Original payment and supplier facts are unchanged.':'Supplier failure evidence saved. Customer remedy remains open.'):unavailable?'Verification unavailable; refund remains unconfirmed.':result.resolution?.stage==='resolved'?(result.resolution.outcome==='paystack_refund'?'Paystack refund processed and case resolved; customer account visibility may take time.':'Original Wallet refund confirmed and case resolved.'):'Resolution evidence saved; customer refund is not yet confirmed.'};
 }
}
