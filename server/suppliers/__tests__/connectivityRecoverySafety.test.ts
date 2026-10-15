import assert from 'node:assert/strict';
import {test,afterEach} from 'node:test';
import {paymentSignals} from '../../../src/utils/paymentSignals';
import {getInstantQuote,checkPendingPayment,lookupOrderOnServer} from '../../../src/services/apiClient';
import {savePendingCheckout,readPendingCheckout} from '../../../src/utils/checkoutRecovery';
const originalFetch=globalThis.fetch,storage=(globalThis as any).localStorage;
afterEach(()=>{globalThis.fetch=originalFetch;(globalThis as any).localStorage=storage;});
test('duplicate popup closure is ignored but one late success remains recoverable',()=>{const signals=paymentSignals(()=>true);assert.equal(signals.close(),true);assert.equal(signals.close(),false);assert.equal(signals.success(),true);assert.equal(signals.success(),false);assert.equal(signals.close(),false);});
test('inactive checkout callbacks cannot change a replacement checkout',()=>{let active=true;const signals=paymentSignals(()=>active);active=false;assert.equal(signals.close(),false);assert.equal(signals.success(),false);});
test('managed storefront callback settlement behavior remains unchanged',()=>{const signals=paymentSignals(()=>true,true);assert.equal(signals.close(),true);assert.equal(signals.success(),false);});
test('malformed/future recovery records fail closed; persistence allowlists fields',()=>{
  const values=new Map<string,string>();(globalThis as any).localStorage={getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)};
  const entry={orderRef:'MH-fixture',label:'Flexi',network:'telecel' as const,startedAt:new Date().toISOString()};
  savePendingCheckout({...entry,ghanaCard:'DO-NOT-STORE',token:'DO-NOT-STORE'} as any);assert.doesNotMatch([...values.values()].join(''),/DO-NOT-STORE/);
  for(const change of [{label:{}},{network:'unknown'},{startedAt:new Date(Date.now()+86400000).toISOString()}]){savePendingCheckout({...entry,...change} as any);assert.equal(readPendingCheckout(),null);}
});
test('exact quote client accepts only a consistent GHS total for the selected product',async()=>{
  const quote={productId:'instant-fixture',requestedAmount:10,productRetailMinor:1105,feeMinor:35,totalMinor:1140,currency:'GHS',expiresAt:Date.now()+120000,token:'signed'};
  for(const change of [{},{totalMinor:1},{currency:'USD'},{productId:'another'},{expiresAt:0}]){globalThis.fetch=async()=>new Response(JSON.stringify({success:true,quote:{...quote,...change}}));if(Object.keys(change).length)await assert.rejects(getInstantQuote('instant-fixture',10));else assert.equal((await getInstantQuote('instant-fixture',10)).totalMinor,1140);}
});
test('missing order is identified by HTTP status without clearing payment evidence',async()=>{globalThis.fetch=async()=>new Response(JSON.stringify({error:'Order not found.'}),{status:404});await assert.rejects(lookupOrderOnServer('MH-missing'),(error:any)=>error.status===404);});
test('manual recovery verifies a pending payment on the server without initializing again',async()=>{const calls:string[]=[];globalThis.fetch=async url=>{calls.push(String(url));return new Response(JSON.stringify(String(url).includes('/verify/')?{verified:false,order:{status:'pending_payment'}}:{success:true,order:{status:'pending_payment'}}));};assert.equal((await checkPendingPayment('MH-fixture')).order.status,'pending_payment');assert.equal(calls.length,2);assert.match(calls[1],/payments\/verify\/MH-fixture/);assert.ok(calls.every(url=>!url.includes('initialize')));});
