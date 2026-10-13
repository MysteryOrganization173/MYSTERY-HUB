import {test,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PaystackServerService as Paystack} from '../../services/paystackService';
import {OrderResolutionService as Service} from '../../services/orderResolutionService';
import {OrdersStore} from '../../db/ordersStore';
import {OrderResolutionStore} from '../../db/orderResolutionStore';
import {FinanceStore} from '../../db/financeStore';
import {FinanceService} from '../../services/financeService';
import {AdminAuditStore} from '../../db/adminAuditStore';
import {ReferralStore} from '../../db/referralStore';
import {toSafePublicOrder,type OrderRecord} from '../../types/orders';
import {dataOrderPresentation} from '../../../src/utils/dataPurchasePresentation';

const originalFetch=globalThis.fetch,originalKey=process.env.PAYSTACK_SECRET_KEY;
let calls:string[]=[],refund:Record<string,unknown>,transaction:Record<string,unknown>;
let failAt='',malformedAt='';
beforeEach(()=>{
 assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DATABASE_URL,undefined);
 FinanceStore._reset();OrdersStore.clearDevStore();OrderResolutionStore._reset();ReferralStore._clearDevStore();AdminAuditStore._clearDevStore();
 process.env.PAYSTACK_SECRET_KEY='sk_live_synthetic_http_fixture';calls=[];failAt='';malformedAt='';
 refund={id:12345,integration:100982,transaction:9001,domain:'live',amount:549,deducted_amount:549,fully_deducted:true,currency:'GHS',channel:'mobile_money',status:'processed',refunded_at:new Date().toISOString(),customer_note:'Private fixture note',merchant_note:'Private fixture note'};
 transaction={id:9001,domain:'live',status:'reversed',reference:'',amount:549,currency:'GHS',paid_at:'2026-10-13T10:00:00.000Z',channel:'mobile_money',authorization:{authorization_code:'private_fixture'},customer:{email:'private@example.test'}};
 globalThis.fetch=(async(url,options)=>{
  const path=new URL(String(url)).pathname;calls.push(path);
  assert.equal(options?.method||'GET','GET');assert.equal((options?.headers as any)?.Authorization,'Bearer sk_live_synthetic_http_fixture');assert.ok(options?.signal);
  if(path.includes(failAt)&&failAt)throw Error('Synthetic provider timeout');
  if(path.includes(malformedAt)&&malformedAt)return new Response('{invalid JSON',{status:200});
  if(path==='/refund/12345')return new Response(JSON.stringify({status:true,message:'Refund retrieved',data:refund}));
  assert.equal(path,'/transaction/verify/'+encodeURIComponent(String(transaction.reference)));
  return new Response(JSON.stringify({status:true,message:'Verification successful',data:transaction}));
 }) as typeof fetch;
});
after(()=>{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.PAYSTACK_SECRET_KEY;else process.env.PAYSTACK_SECRET_KEY=originalKey;});
async function create(){
 const id='raw-refund-'+randomUUID(),at=new Date().toISOString();
 const order:OrderRecord={id,user_id:'buyer',public_reference:'MH-RAW-'+id,customer_name:'Synthetic buyer',customer_email:'fixture@example.test',customer_phone:'0240000000',recipient_phone:'0240000000',network:'mtn',service_type:'data',product_id:'fixture',product_name_snapshot:'Data',bundle_size_snapshot:'1GB',amount:549,currency:'GHS',status:'refund_pending',payment_provider:'paystack',payment_reference:'payment-'+id,payment_status:'success',supplier_provider:'success_biz_hub',supplier_order_id:'supplier-'+id,supplier_cost_minor:400,supplier_offer_ref:'fixture',supplier_last_checked_at:null,supplier_response:'{"status":"failed"}',failure_reason:'supplier_delivery_failed',manual_review:false,created_at:at,updated_at:at,paid_at:at,submitted_at:at,delivered_at:null};
 await OrdersStore.createOrder(order);await Service.action(id,'admin',body(order,'begin_review'));transaction.reference=order.payment_reference;
 return (await OrdersStore.findOrder(id))!;
}
const body=(order:OrderRecord,action='verify_external')=>({action,confirmed:true,requestId:randomUUID(),expectedUpdatedAt:new Date(order.updated_at).toISOString(),expectedVersion:order.resolution_json?.version||0,note:'Synthetic provider evidence checked',...(action==='verify_external'?{refundId:'12345'}:{})});
const verify=(order:OrderRecord)=>Service.action(order.id,'admin',body(order));
async function unresolved(order:OrderRecord){
 const current=(await OrdersStore.findOrder(order.id))!;
 assert.notEqual(current.resolution_json?.stage,'resolved');assert.equal(current.status,'refund_pending');
 assert.notEqual(toSafePublicOrder(current).customer_resolution,'refund_confirmed');
 assert.equal((await FinanceService.summary('buyer')).walletMinor,0);
}
test('raw HTTP processed refund plus reversed original transaction resolves without new payment success',async()=>{
 const order=await create(),result=await verify(order);assert.equal(result.order.resolution?.stage,'resolved');assert.equal(result.order.resolution?.refundId,'12345');assert.equal(result.order.payment_status,'success');assert.equal(result.order.amount,549);assert.ok('message' in result);assert.match(result.message,/Paystack refund processed/);
 assert.deepEqual(calls,['/refund/12345','/transaction/verify/'+order.payment_reference]);
 const safe=JSON.stringify(toSafePublicOrder((await OrdersStore.findOrder(order.id))!));assert.ok(!/private|refundId|merchant_note|authorization/.test(safe));
 assert.equal((await FinanceService.summary('buyer')).walletMinor,0);
});
test('processed refund can retain success during provider transaction-state propagation',async()=>{const order=await create();transaction.status='success';assert.equal((await verify(order)).order.resolution?.stage,'resolved');});
for(const status of ['pending','processing','needs-attention'])test('raw '+status+' refund plus reversal_pending transaction never resolves',async()=>{
 const order=await create();refund.status=status;refund.refunded_at=null;transaction.status='reversal_pending';
 const result=await verify(order);assert.equal(result.order.resolution?.stage,status==='needs-attention'?'under_review':'refund_pending');await unresolved(order);
});
test('raw failed refund with original transaction success remains unresolved',async()=>{const order=await create();refund.status='failed';refund.refunded_at=null;transaction.status='success';assert.equal((await verify(order)).order.resolution?.stage,'under_review');await unresolved(order);});
for(const [name,side,field,value] of [
 ['transaction ID','transaction','id',9002],['payment reference','transaction','reference','wrong-reference'],
 ['original amount','transaction','amount',550],['original currency','transaction','currency','NGN'],
 ['refund amount','refund','amount',548],['refund currency','refund','currency','NGN'],
 ['test-mode refund','refund','domain','test'],['test-mode transaction','transaction','domain','test'],
 ['refund ID','refund','id',12346],['pending original transaction','transaction','status','pending'],
 ['failed original transaction','transaction','status','failed'],['reversal pending original transaction','transaction','status','reversal_pending'],
 ['missing completion','refund','refunded_at',null],['invalid completion','refund','refunded_at','invalid-date'],
] as const)test('raw '+name+' cannot confirm a refund',async()=>{
 const order=await create();(side==='refund'?refund:transaction)[field]=value;
 // A mismatching provider reference is returned from the requested original-reference endpoint.
 const fetch=globalThis.fetch;if(field==='reference')globalThis.fetch=(async(url,options)=>{
   if(String(url).includes('/transaction/verify/')){calls.push(new URL(String(url)).pathname);return new Response(JSON.stringify({status:true,data:transaction}));}
   return fetch(url,options);
 }) as typeof fetch;
 if(name==='refund ID')await verify(order);else await assert.rejects(()=>verify(order));
 await unresolved(order);
});
for(const endpoint of ['/refund/','/transaction/'])for(const kind of ['timeout','malformed'])test('raw '+endpoint+' '+kind+' remains durably unconfirmed',async()=>{
 const order=await create();if(kind==='timeout')failAt=endpoint;else malformedAt=endpoint;
 const result=await verify(order);assert.match(result.order.resolution!.lastError!,/unconfirmed/);assert.equal((await OrderResolutionStore.history(order.id)).length,2);await unresolved(order);
});
test('raw transaction missing live domain is unverifiable',async()=>{const order=await create();delete transaction.domain;await verify(order);await unresolved(order);});
test('raw provider refund ID cannot be linked to another order',async()=>{
 const first=await create();await verify(first);const second=await create();await assert.rejects(()=>verify(second));await unresolved(second);
 assert.equal((await OrderResolutionStore.history(second.id)).length,1);
});
test('raw duplicate identical request remains idempotent',async()=>{const order=await create(),input=body(order);await Service.action(order.id,'admin',input);await Service.action(order.id,'admin',input);assert.equal(calls.length,2);assert.equal((await OrderResolutionStore.history(order.id)).length,2);});
test('ordinary raw purchase verification still rejects reversed transactions',async()=>{const order=await create();const result=await Paystack.verifyTransaction(order.payment_reference,12000);assert.equal(result.isVerified,false);assert.equal(result.status as string,'reversed');assert.equal(result.amountPesewas,549);});
test('refund transaction reader never simulates success for missing/test credentials',async()=>{const order=await create();for(const key of ['', 'sk_test_synthetic']){process.env.PAYSTACK_SECRET_KEY=key;await assert.rejects(()=>Paystack.fetchRefundTransaction(order.payment_reference));}assert.equal(calls.length,0);});
test('refund copy separates processed provider evidence from bank or MoMo visibility',()=>{
 const view=dataOrderPresentation('refunded',false,'refund_confirmed');assert.equal(view.title,'Refund verified');assert.match(view.next,/bank or MoMo provider may take time/);assert.doesNotMatch(view.next,/already received|already credited/);
 assert.match(readFileSync('src/components/admin/sections/AdminOrderResolution.tsx','utf8'),/does not confirm the funds are already visible/);
});
