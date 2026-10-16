import {createHash,randomUUID} from 'node:crypto';
import {AdminAssistedStore} from '../db/adminAssistedStore.js';
import {OrdersStore} from '../db/ordersStore.js';
import {AdminAuditStore} from '../db/adminAuditStore.js';
import {AuthStore} from '../db/authStore.js';
import {FinanceError,FinanceTx} from '../db/financeStore.js';
import {CommercialService} from './commercialService.js';
import {FulfilmentService} from './fulfilmentService.js';
import {normalizeGhanaPhoneIdentifier} from '../utils/authValidation.js';
import {getGhanaPhoneLookupVariants} from '../utils/phone.js';
import {resolveSupplierPackage} from '../suppliers/successBizHub/catalogResolver.js';
import {toAdminOrderDetails,type OrderRecord} from '../types/orders.js';
import type {AssistedProduct,AssistedQuote,AssistedDecision,AssistedSource} from '../../shared/adminAssistedOrders.js';
const text=(value:unknown,label:string,min=2,max=1000)=>{if(typeof value!=='string'||value.trim().length<min||value.trim().length>max||/[<>\x00-\x1f]|sk_(live|test)_|Bearer\s/i.test(value))throw new FinanceError(`Provide ${label} without secrets.`);return value.trim();};
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export class AdminAssistedOrders {
 static async catalogue():Promise<AssistedProduct[]>{
   const provider=FulfilmentService.getProvider();
   if(!provider.client.isConfigured())throw new FinanceError('Supplier catalogue is not configured.',503);
   const [catalogue,raw,available]=await Promise.all([CommercialService.catalog(),provider.getRawCatalog(true),provider.checkServicesAvailable()]);
   if(!available.available)throw new FinanceError('Supplier Data service is unavailable.',503);
   return catalogue.products.flatMap(p=>{const resolved=resolveSupplierPackage(raw,p.network,p.dataAmount).resolved;
     if(!resolved||!Number.isSafeInteger(resolved.supplierCostMinor)||resolved.supplierCostMinor<=0)return [];
     return [{id:p.id,name:`${p.networkName} ${p.dataAmount}`,network:p.network,size:p.dataAmount,retailMinor:p.amountPesewas,supplierCostMinor:resolved.supplierCostMinor,offerRef:resolved.offerSlug||resolved.offerId||'',pricingRevision:catalogue.version}];
   });
 }
 static async quote(actor:string,input:Record<string,unknown>){
   if(Object.keys(input).some(k=>!['productId','source','customerId','customerName','customerPhone','recipient','reason','externalReference'].includes(k)))throw new FinanceError('Unexpected quote field. Prices are set by the server.');
   const source=input.source as AssistedSource;if(!['complimentary','admin_external'].includes(source))throw new FinanceError('Choose a complimentary giveaway or an externally collected payment.');
   const recipient=normalizeGhanaPhoneIdentifier(input.recipient);if(!recipient)throw new FinanceError('Enter a valid Ghana recipient number.');
   const customerId=input.customerId?text(input.customerId,'an existing customer ID',1,64):null;
   const user=customerId?await AuthStore.findUserById(customerId):null;
   if(customerId&&(!user||user.role!=='customer'||user.status!=='active'))throw new FinanceError('Select an enabled customer account.',409);
   const name=user?.name||text(input.customerName,'the intended customer name',2,100),phone=user?.phone?normalizeGhanaPhoneIdentifier(user.phone):normalizeGhanaPhoneIdentifier(input.customerPhone);
   if(!phone)throw new FinanceError('Enter the customer contact number separately from the recipient.');
   const reason=text(input.reason,'the order source and operational reason',10),externalReference=source==='admin_external'?text(input.externalReference,'external payment evidence/reference',3,160):null;
   const product=(await this.catalogue()).find(p=>p.id===input.productId);if(!product)throw new FinanceError('Select an available supplier-backed Data bundle.',409);
   if(source==='admin_external'&&product.retailMinor<product.supplierCostMinor)throw new FinanceError('The current retail price is below supplier cost. Review Commercial Pricing first.',409);
   await this.preflight(product,recipient);
   const now=new Date(),q:AssistedQuote={id:'aq_'+randomUUID(),actorId:actor,product,source,customerId,customerName:name,customerPhone:phone,customerEmail:user?.email||'',recipient,reason,externalReference,createdAt:now.toISOString(),expiresAt:new Date(+now+120000).toISOString()};
   return AdminAssistedStore.addQuote(q);
 }
 private static async preflight(p:AssistedProduct,recipient:string){
   const provider=FulfilmentService.getProvider();if(!provider.client.isConfigured()||!provider.client.isFulfillmentEnabled())throw new FinanceError('Supplier dispatch is disabled. No order was sent.',503);
   const result=await FulfilmentService.preflightCheck(p.network,p.size,recipient);
   if(!result.allowed||result.supplierCostMinor!==p.supplierCostMinor)throw new FinanceError(result.customerMessage||'Supplier cost or eligibility changed. Review a fresh quote.',409);
 }
 static async confirm(actor:string,input:Record<string,unknown>){
   if(Object.keys(input).some(k=>!['quoteId','requestId','confirmed'].includes(k))||input.confirmed!==true)throw new FinanceError('Explicit confirmation is required.');
   const quoteId=text(input.quoteId,'the reviewed quote',1,64),requestId=text(input.requestId,'a stable request ID',8,80);
   if(!/^[-\w]+$/.test(requestId))throw new FinanceError('Invalid request ID.');
   const hash=digest([actor,quoteId,requestId]),previous=await AdminAssistedStore.decision({request:requestId,quote:quoteId});
   if(previous){if(previous.input_hash!==hash||previous.actor_id!==actor)throw new FinanceError('This quote/request already authorized another order. Review the original order.',409);return this.inspect(previous.order_id);}
   const quote=await AdminAssistedStore.quote(quoteId);if(!quote||quote.actorId!==actor)throw new FinanceError('Quote not found for this administrator.',404);
   if(Date.parse(quote.expiresAt)<=Date.now())throw new FinanceError('Quote expired. Review a new quote before confirming.',409);
   const fresh=(await this.catalogue()).find(p=>p.id===quote.product.id);
   if(!fresh||digest(fresh)!==digest(quote.product))throw new FinanceError('Supplier or retail terms changed. Review a fresh quote.',409);
   await this.preflight(fresh,quote.recipient);
   const created=await AdminAssistedStore.transaction(async client=>{
     const operator=client?(await client.query('SELECT role,status FROM users WHERE id=$1 FOR SHARE',[actor])).rows[0]:await AuthStore.findUserById(actor);
     if(operator?.role!=='admin'||operator.status!=='active')throw new FinanceError('Administrator access changed. No order was authorized.',403);
     const locked=await AdminAssistedStore.quote(quoteId,client),old=await AdminAssistedStore.decision({request:requestId,quote:quoteId},client);
     if(old){if(old.input_hash!==hash||old.actor_id!==actor)throw new FinanceError('This quote/request already authorized another order.',409);return {id:old.order_id,dispatch:false};}
     if(!locked||locked.actorId!==actor||Date.parse(locked.expiresAt)<=Date.now())throw new FinanceError('Quote expired or unavailable.',409);
     if(client)await client.query("SELECT pg_advisory_xact_lock_shared(hashtextextended('commercial-policy',0))");
     const retail=await CommercialService.catalog(client?new FinanceTx(actor,client):undefined),product=retail.products.find(p=>p.id===locked.product.id);
     if(retail.version!==locked.product.pricingRevision||!product||product.amountPesewas!==locked.product.retailMinor)throw new FinanceError('Retail terms changed. Review a new quote.',409);
     if(locked.customerId){const user=client?(await client.query('SELECT role,status FROM users WHERE id=$1 FOR SHARE',[locked.customerId])).rows[0]:await AuthStore.findUserById(locked.customerId);if(!user||user.role!=='customer'||user.status!=='active')throw new FinanceError('Customer account changed. Review before ordering.',409);}
     if(client&&locked.product.network==='mtn')await client.query("SELECT pg_advisory_xact_lock(hashtext('mtn_' || $1))",[locked.recipient]);
     const variants=getGhanaPhoneLookupVariants(locked.recipient);
     const blocking=client?(await client.query("SELECT id FROM orders WHERE network=$1 AND recipient_phone=ANY($2::text[]) AND (status IN ('paid','queued','submitted','processing','refund_pending') OR (product_id=$3 AND created_at>NOW()-interval '5 minutes')) LIMIT 1",[locked.product.network,variants,locked.product.id])).rows.length>0:OrdersStore.adminDevOrders().some(o=>o.network===locked.product.network&&variants.some(p=>normalizeGhanaPhoneIdentifier(p)===normalizeGhanaPhoneIdentifier(o.recipient_phone))&&(['paid','queued','submitted','processing','refund_pending'].includes(o.status)||o.product_id===locked.product.id&&Date.parse(o.created_at)>Date.now()-300000));
     if(blocking)throw new FinanceError('An active or recently placed matching recipient order already exists. Inspect it before ordering again.',409);
     const id='ao_'+randomUUID(),now=new Date().toISOString(),order:OrderRecord={id,user_id:locked.customerId,public_reference:'MH-ADMIN-'+randomUUID().slice(0,8).toUpperCase(),customer_name:locked.customerName,customer_email:locked.customerEmail,customer_phone:locked.customerPhone,recipient_phone:locked.recipient,network:locked.product.network,service_type:'data',product_id:locked.product.id,product_name_snapshot:locked.product.name,bundle_size_snapshot:locked.product.size,amount:locked.source==='complimentary'?0:locked.product.retailMinor,currency:'GHS',status:'queued',payment_provider:locked.source,payment_reference:'MH_ADMIN_'+randomUUID(),payment_status:locked.source==='complimentary'?'not_required':'recorded',paid_at:null,supplier_provider:'success_biz_hub',supplier_order_id:null,supplier_response:null,supplier_cost_minor:null,supplier_offer_ref:locked.product.offerRef,supplier_last_checked_at:null,failure_reason:null,created_at:now,updated_at:now,submitted_at:null,delivered_at:null};
     await OrdersStore.createOrder(order,client);
     const decision:AssistedDecision={order_id:id,quote_id:quoteId,actor_id:actor,source:locked.source,request_id:requestId,input_hash:hash,snapshot:locked,created_at:now};await AdminAssistedStore.append(decision,client);
     await AdminAuditStore.record({adminUserId:actor,action:'admin_assisted_order_authorized',entityType:'order',entityId:id,metadata:{source:locked.source,quote_id:quoteId,retail_minor:locked.product.retailMinor,quoted_cost_minor:locked.product.supplierCostMinor,reason:locked.reason}},client);
     return {id,dispatch:true};
   });
   if(created.dispatch){const order=(await OrdersStore.findOrder(created.id))!;try{await FulfilmentService.dispatchClaimedOrder(order,true,quote.product.supplierCostMinor);}catch{await OrdersStore.saveSupplierUncertainSubmission(order.id,'Assisted submission interrupted. Reconcile original acceptance; never resend blindly.');}}
   return this.inspect(created.id);
 }
 static async inspect(id:string){const decision=await AdminAssistedStore.decision({order:id});if(!decision)throw new FinanceError('Assisted order not found.',404);const order=await OrdersStore.findOrder(decision.order_id);if(!order)throw new FinanceError('Assisted order record unavailable.',503);return {order:toAdminOrderDetails(order),authorization:decision};}
}
