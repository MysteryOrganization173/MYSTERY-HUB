import {createHash} from 'node:crypto';
import {FinanceError,FinanceStore} from '../db/financeStore.js';
import {getPool} from '../db/connection.js';
import {OrdersStore} from '../db/ordersStore.js';
import type {OrderRecord} from '../types/orders.js';
import {requireCheckoutRecovery} from './checkoutFailure.js';
/** New guest clients have a random UUID. Its namespace/hash gives the existing order PK durable uniqueness. */
export function guestCheckoutId(requestId:unknown):string|null{
 if(requestId===undefined)return null; // Legacy clients remain compatible; no invented recoverability for them.
 if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))throw new FinanceError('Refresh checkout to obtain a valid request identity.');
 return 'ord_guest_'+createHash('sha256').update(requestId.toLowerCase()).digest('base64url');
}
function sameOrder(order:OrderRecord,productId:string,recipient:string,email:string,userId:string|null){
 return order.user_id===userId&&!order.store_context&&(order.service_type===null||order.service_type==='data')&&order.payment_provider==='paystack'&&order.product_id===productId&&order.recipient_phone===recipient&&order.customer_email===email;
}
/** Read-only recovery before (and after rejected) preflight; an existing attempt must not be called a new denial. */
export async function recoverDirectCheckout(userId:string|undefined,input:Record<string,unknown>,productId:string,recipient:string,email:string):Promise<(OrderRecord&{checkout:any})|null>{
 if(input.paymentMethod==='wallet'||input.requestId===undefined)return null;
 if(userId){
  if(typeof input.requestId!=='string'||!/^[-a-zA-Z0-9_]{16,80}$/.test(input.requestId))throw new FinanceError('A stable request ID is required.');
  const row=await FinanceStore.read(userId,tx=>tx.find(`direct:${input.requestId}`));if(!row)return null;
  const order=await OrdersStore.findOrder(row.payload.orderId);
  if(!order||!sameOrder(order,productId,recipient,email,userId))throw requireCheckoutRecovery();
  if(order.payment_status==='success'||order.paid_at||order.supplier_order_id||row.state!=='pending'||!row.payload.checkout)throw requireCheckoutRecovery(order.public_reference);
  return {...order,checkout:row.payload.checkout};
 }
 const id=guestCheckoutId(input.requestId);const order=id?await OrdersStore.findOrder(id):null;if(!order)return null;
 if(!sameOrder(order,productId,recipient,email,null))throw requireCheckoutRecovery();
 // Guest access codes were never durably stored: expose only the matched public reference, never reinitialize.
 throw requireCheckoutRecovery(order.public_reference);
}
const memoryTails=new Map<string,Promise<void>>();
/** Database PK is the production concurrency authority; mirror it in memory instead of overwriting a fixture. */
export async function createGuestCheckoutOnce(order:OrderRecord,input:Record<string,unknown>){
 const stable=guestCheckoutId(input.requestId);if(stable)order={...order,id:stable};
 const create=async()=>{
  const old=stable?await OrdersStore.findOrder(stable):null;
  if(old){if(!sameOrder(old,order.product_id,order.recipient_phone,order.customer_email!,null))throw requireCheckoutRecovery();throw requireCheckoutRecovery(old.public_reference);}
  try{return {order,result:await OrdersStore.createOrderWithMtnDuplicateCheck(order)};}
  catch(error){
   const existing=stable?await OrdersStore.findOrder(stable):null;
   if(existing&&sameOrder(existing,order.product_id,order.recipient_phone,order.customer_email!,null))throw requireCheckoutRecovery(existing.public_reference);
   throw error;
  }
 };
 if(!stable||getPool())return create();
 const previous=memoryTails.get(stable)||Promise.resolve();let release!:()=>void;const next=new Promise<void>(r=>release=r);memoryTails.set(stable,next);await previous;
 try{return await create();}finally{release();if(memoryTails.get(stable)===next)memoryTails.delete(stable);}
}
