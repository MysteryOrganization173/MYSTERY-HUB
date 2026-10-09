import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transformSync} from 'esbuild';
import {createStoreCheckoutAttempt,readStoreCheckoutRecovery,waitForStoreInitialization} from '../../../src/utils/storeCheckoutAttempt';

test('one in-flight checkout rejects double submission',()=>{const gate=createStoreCheckoutAttempt(),id=gate.begin()!;assert.equal(gate.begin(),null);assert.equal(gate.current(id),true);});
test('cancel plus close can settle only once',()=>{const gate=createStoreCheckoutAttempt(),id=gate.begin()!;assert.equal(gate.settle(id),true);assert.equal(gate.settle(id),false);assert.equal(gate.current(id),false);});
test('late signals cannot settle a newer resumed attempt',()=>{const gate=createStoreCheckoutAttempt(),old=gate.begin()!;gate.settle(old);const next=gate.begin()!;assert.equal(gate.current(old),false);assert.equal(gate.settle(old),false);assert.equal(gate.current(next),true);});
test('unmounted checkout cannot begin or accept callbacks',()=>{const gate=createStoreCheckoutAttempt(),id=gate.begin()!;gate.dispose();assert.equal(gate.current(id),false);assert.equal(gate.settle(id),false);assert.equal(gate.begin(),null);});
test('initialization deadline reports uncertainty and retains a late order reference',async()=>{let resolve:any;const remembered:string[]=[];const work=waitForStoreInitialization(new Promise<any>(r=>resolve=r),ref=>remembered.push(ref),5);await assert.rejects(work,/order may already exist/);assert.deepEqual(remembered,[]);resolve({orderRef:'MH-late'});await new Promise(r=>setImmediate(r));assert.deepEqual(remembered,['MH-late']);});
test('late initialization rejection retains the recovery reference without an unhandled rejection',async()=>{let reject:any;const remembered:string[]=[];const work=waitForStoreInitialization(new Promise<any>((_r,r)=>reject=r),ref=>remembered.push(ref),5);await assert.rejects(work,/timed out/);reject(Object.assign(new Error('uncertain'),{existingOrderReference:'MH-late'}));await new Promise(r=>setImmediate(r));assert.deepEqual(remembered,['MH-late']);});
test('reload recovery only reads a valid identity/reference and drops extra private fields',()=>{
  const row={requestId:'12345678-1234-1234-1234-123456789abc',reference:'MH-fixture',phone:'0240000000',email:'fixture@example.test'};
  assert.deepEqual(readStoreCheckoutRecovery({getItem:key=>{assert.equal(key,'mh_store_checkout:site');return JSON.stringify(row);}},'site'),{requestId:row.requestId,reference:row.reference});
});
test('disabled/corrupt storage and unsafe references never grant a payment state',()=>{
  assert.equal(readStoreCheckoutRecovery({getItem:()=>{throw Error('denied');}},'site'),null);
  for(const value of ['{','null','{}','{"requestId":"bad"}'])assert.equal(readStoreCheckoutRecovery({getItem:()=>value},'site'),null);
  assert.deepEqual(readStoreCheckoutRecovery({getItem:()=>JSON.stringify({requestId:'12345678-1234-1234-1234-123456789abc',reference:'<script>'})},'site'),{requestId:'12345678-1234-1234-1234-123456789abc'});
});

// Execute the real production hook with isolated React state/API/SDK seams.
// Actual rendered React, native dialog and hit-testing are checked separately in Chrome.
const compiled=transformSync(readFileSync('src/hooks/usePaystack.ts','utf8'),{loader:'ts',format:'cjs',define:{'import.meta.env.DEV':'false','import.meta.env.VITE_PAYSTACK_PUBLIC_KEY':'""'}}).code;
test('SDK load listeners leave on unmount without removing the shared script',()=>{
  const listeners=new Map<string,()=>void>();let cleanup:any,writes=0;const window:any={};
  const script={addEventListener:(name:string,fn:()=>void)=>listeners.set(name,fn),removeEventListener:(name:string,fn:()=>void)=>{assert.equal(listeners.get(name),fn);listeners.delete(name);}};
  const module={exports:{} as any},react={useEffect:(fn:any)=>cleanup=fn(),useState:(value:unknown)=>[value,()=>writes++],useCallback:(fn:any)=>fn};
  runInNewContext(compiled,{module,exports:module.exports,require:(name:string)=>name==='react'?react:{},window,document:{querySelector:()=>script},console});
  module.exports.usePaystack();assert.equal(listeners.size,2);const loaded=listeners.get('load')!;window.PaystackPop=class {};loaded();assert.equal(writes,1);cleanup();assert.equal(listeners.size,0);loaded();assert.equal(writes,1);
});
function harness(overrides:Record<string,unknown>={},sdk=true) {
  const state={init:0,direct:0,verify:0,opens:0,received:0,cancels:0,created:[] as string[],errors:[] as string[],callbacks:null as any,active:true};
  let initWork:any=async()=>({success:true,orderRef:'MH-fixture',reference:'pay-fixture',accessCode:'access-fixture',amountPesewas:521,...overrides});
  let verifyWork:any=async()=>{state.verify++;return {success:true};};
  const window:any=sdk?{PaystackPop:class {resumeTransaction(code:string,callbacks:any){assert.equal(code,'access-fixture');state.opens++;state.callbacks=callbacks;}}}:{};
  const modules:any={react:{useState:(value:unknown)=>[value,()=>{}],useEffect:()=>{},useCallback:(fn:any)=>fn},'../utils/storeCheckoutAttempt':{waitForStoreInitialization},'../services/apiClient':{initializePaymentOnServer:async()=>{state.direct++;return initWork();},verifyPaymentOnServer:()=>verifyWork()},'../services/websiteBusinessApi':{initializeStorePayment:async(...args:any[])=>{state.init++;assert.deepEqual(args,['site','request','mtn-1gb','0240000000','receipt@example.test',undefined]);return initWork();}},'../utils/authStorage':{getActiveSessionToken:()=>null}};
  const module={exports:{} as any};let clock=0;
  runInNewContext(compiled,{module,exports:module.exports,require:(name:string)=>{assert.ok(modules[name],name);return modules[name];},window,console,Error,setTimeout,setInterval:(fn:()=>void)=>setInterval(fn,1),clearInterval,Date:{now:()=>clock+=1000}});
  const hook=module.exports.usePaystack();
  const options:any={isActive:()=>state.active,store:{siteId:'site',requestId:'request',expectedMinor:521},productId:'mtn-1gb',recipientPhone:'0240000000',customerEmail:'receipt@example.test',onOrderCreated:(ref:string)=>state.created.push(ref),onPaymentReceived:()=>state.received++,onCancel:()=>state.cancels++,onError:(e:Error)=>state.errors.push(e.message)};
  return {state,options,run:()=>hook.initializeServerPayment(options),setInit:(fn:any)=>initWork=fn,setVerify:(fn:any)=>verifyWork=fn};
}
test('store payment calls existing server endpoint and resumes the issued access code',async()=>{const h=harness();await h.run();assert.equal(h.state.init,1);assert.equal(h.state.direct,0);assert.equal(h.state.opens,1);assert.deepEqual(h.state.created,['MH-fixture']);assert.equal(h.state.received,0);});
test('price mismatch preserves reference and never opens payment',async()=>{const h=harness({amountPesewas:522});await h.run();assert.equal(h.state.opens,0);assert.equal(h.state.received,0);assert.deepEqual(h.state.created,['MH-fixture']);assert.match(h.state.errors[0],/price changed/);});
test('missing access code fails without success',async()=>{const h=harness({accessCode:undefined});await h.run();assert.equal(h.state.opens,0);assert.equal(h.state.received,0);assert.match(h.state.errors[0],/access code/);});
test('missing production SDK fails without simulated success',async()=>{const h=harness({},false);await h.run();assert.equal(h.state.received,0);assert.equal(h.state.opens,0);assert.match(h.state.errors[0],/Unable to load Paystack/);});
for(const response of [{isSimulated:true},{accessCode:'dev_access_fixture'}])test(`production store rejects synthetic authorization ${JSON.stringify(response)}`,async()=>{const h=harness(response);await h.run();assert.equal(h.state.opens,0);assert.equal(h.state.received,0);assert.match(h.state.errors[0],/simulated authorization/);});
test('official SDK error never reports payment success',async()=>{const h=harness();await h.run();h.state.callbacks.onError(new Error('SDK loading failed'));h.state.callbacks.onClose();assert.deepEqual(h.state.errors,['SDK loading failed']);assert.equal(h.state.received,0);assert.equal(h.state.cancels,0);});
test('cancel and close signals restore once without verification or success',async()=>{const h=harness();await h.run();h.state.callbacks.onCancel();h.state.callbacks.onClose();await h.state.callbacks.onSuccess();assert.equal(h.state.cancels,1);assert.equal(h.state.received,0);assert.equal(h.state.verify,0);});
test('success signal owns settlement while authoritative verification is pending',async()=>{const h=harness();let resolve:any;h.setVerify(()=>new Promise(r=>resolve=r));await h.run();const success=h.state.callbacks.onSuccess();h.state.callbacks.onClose();h.state.callbacks.onCancel();assert.equal(h.state.cancels,0);assert.equal(h.state.received,0);resolve({success:false});await success;assert.equal(h.state.received,1);await h.state.callbacks.onSuccess();assert.equal(h.state.received,1);});
test('verification error still goes to order tracking, not a local paid mutation',async()=>{const h=harness();h.setVerify(async()=>{throw Error('offline');});await h.run();await h.state.callbacks.onSuccess();assert.equal(h.state.received,1);assert.equal(h.state.errors.length,0);});
test('leaving during initialization preserves the reference but cannot open SDK',async()=>{const h=harness();let resolve:any;h.setInit(()=>new Promise(r=>resolve=r));const work=h.run();h.state.active=false;resolve({success:true,orderRef:'MH-fixture',reference:'pay-fixture',accessCode:'access-fixture',amountPesewas:521});await work;assert.deepEqual(h.state.created,['MH-fixture']);assert.equal(h.state.opens,0);assert.equal(h.state.received,0);});
test('late SDK signals after unmount cannot verify or change checkout',async()=>{const h=harness();await h.run();h.state.active=false;await h.state.callbacks.onSuccess();h.state.callbacks.onCancel();h.state.callbacks.onError(new Error('late'));assert.equal(h.state.verify,0);assert.equal(h.state.received,0);assert.equal(h.state.cancels,0);assert.deepEqual(h.state.errors,[]);});
test('uncertain initialization keeps the supplied reference even after leaving',async()=>{const h=harness();h.setInit(async()=>{h.state.active=false;throw Object.assign(new Error('uncertain'),{existingOrderReference:'MH-uncertain'});});await h.run();assert.deepEqual(h.state.created,['MH-uncertain']);assert.equal(h.state.opens,0);assert.equal(h.state.received,0);});
test('direct Data caller still uses its existing API and callback',async()=>{const h=harness();delete h.options.store;delete h.options.isActive;await h.run();assert.equal(h.state.direct,1);assert.equal(h.state.init,0);await h.state.callbacks.onSuccess();assert.equal(h.state.received,1);});
