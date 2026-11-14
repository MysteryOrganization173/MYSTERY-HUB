import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
import {transformSync} from 'esbuild';
import * as failure from '../../../shared/checkoutFailure';
import * as attempts from '../../../src/utils/directCheckoutAttempt';
import * as recovery from '../../../src/utils/checkoutRecovery';
import * as presentation from '../../../src/utils/dataPurchasePresentation';
import * as quotePresentation from '../../../src/utils/directQuotePresentation';
import * as money from '../../../shared/money';
import * as bundles from '../../../src/data/bundles';
import {BUSINESS_CONFIG} from '../../../src/config/business';
const compiled=transformSync(readFileSync('src/components/checkout/CheckoutModal.tsx','utf8'),{loader:'tsx',format:'cjs'}).code;
function harness(){
 const cells:any[]=[],effects:Array<()=>void>=[],values=new Map<string,string>(),payments:any[]=[];let cursor=0,closes=0,opened=0;
 const storage={getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)};
 let lookup:(ref:string)=>Promise<any>=async()=>({success:false});
 const context:any={isCheckoutOpen:true,checkoutBundle:{id:'mtn-1gb',network:'mtn',serviceType:'data',dataAmount:'1GB',priceGhc:5.49,validity:'30 days'},user:{id:'a',email:'fixture@example.test',phone:'0241234567'},sessionToken:'a-token',closeCheckout:()=>closes++,openOrderStatus:()=>opened++,createOrder:()=>({}),openDataPage:()=>{}};
 const react:any={createElement:(type:any,props:any,...children:any[])=>({type,props:{...props,children}}),useState:(initial:any)=>{const i=cursor++;if(!(i in cells))cells[i]=typeof initial==='function'?initial():initial;return [cells[i],(v:any)=>cells[i]=typeof v==='function'?v(cells[i]):v];},useRef:(initial:any)=>{const i=cursor++;return cells[i]??(cells[i]={current:initial});},useEffect:(fn:any,deps:any[]=[])=>{const i=cursor++,old=cells[i];if(!old||deps.some((d,j)=>!Object.is(d,old.deps[j])))effects.push(()=>{old?.cleanup?.();cells[i]={deps,cleanup:fn()};});}};
 const modules:any={react,'../../../shared/checkoutFailure':failure,'../../utils/directCheckoutAttempt':attempts,'../../utils/checkoutRecovery':{...recovery,savePendingCheckout:()=>{},clearPendingCheckout:()=>{}},'../../utils/dataPurchasePresentation':presentation,'../../utils/directQuotePresentation':quotePresentation,'../../../shared/money':money,'../../context/AppContext':{useApp:()=>context},'../../hooks/usePaystack':{usePaystack:()=>({initializeServerPayment:async(o:any)=>{payments.push(o);},isInitializing:false,loadingPhase:'idle'})},'../../hooks/useDialogFocus':{useDialogFocus:()=>({current:null})},'../../hooks/useVisualViewport':{useVisualViewport:()=>({height:850,top:0})},'../../services/commercialApi':{commercialRequest:async()=>({regularMinor:549,totalMinor:549,discountMinor:0,pricingRevision:'fixture',promotionRevision:'fixture',offer:{state:'eligible'}})},'../../services/apiClient':{lookupOrderOnServer:(ref:string)=>lookup(ref),cancelPaymentOnServer:async()=>{},getInstantFlexiQuote:async()=>({}),getInstantBundlesOnServer:async()=>({success:true,available:false,products:[]})},'../../data/bundles':bundles,'../../config/business':{BUSINESS_CONFIG},'../../utils/scroll':{smoothScrollToElement:()=>{}},'../../utils/instantBundleUtils':{getInstantBundlePresentation:()=>null},'../../components/common/NetworkBrandBadge':{},'../common/NetworkBrandBadge':{NetworkBrandBadge:()=>null},'../finance/WalletPaymentChoice':{WalletPaymentChoice:()=>null},'../../services/financeApi':{walletCheckout:()=>{throw Error('Wallet not used');}},'../../utils/referralCapture':{},'lucide-react':new Proxy({},{get:()=>()=>null})};
 const module={exports:{} as any};runInNewContext(compiled,{module,exports:module.exports,require:(name:string)=>{assert.ok(modules[name],name);return modules[name];},crypto:{randomUUID},sessionStorage:storage,setTimeout:()=>0,clearTimeout:()=>{}});
 const render=()=>{cursor=0;const tree=module.exports.CheckoutModal();while(effects.length)effects.shift()!();return tree;};
 const nodes=(t:any):any[]=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];
 const find=(predicate:(n:any)=>boolean)=>nodes(render()).find(predicate);
 const submit=()=>find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 return {context,values,payments,storage,render,find,submit,setLookup:(fn:typeof lookup)=>lookup=fn,counts:()=>({closes,opened})};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('direct denial requires recipient change and delayed old rejection cannot unlock a newer request',async()=>{
 const h=harness();h.render();await tick();await h.submit();const first=h.payments[0];first.onError(Object.assign(new Error('private'),{checkout:failure.preflightFailure('BENEFICIARY_NOT_ELIGIBLE')}));h.render();assert.equal(h.values.size,0);await h.submit();assert.equal(h.payments.length,1);h.find(n=>n.type==='input'&&n.props.id==='checkout-phone').props.onChange({target:{value:'0241234568'}});h.render();await h.submit();assert.equal(h.payments.length,2);first.onError(Object.assign(new Error('late'),{checkout:failure.preflightFailure('BENEFICIARY_NOT_ELIGIBLE')}));h.render();await h.submit();assert.equal(h.payments.length,2);
});
test('direct uncertain attempt survives reopening and cannot change details or create a new request',async()=>{
 const h=harness();h.render();await tick();await h.submit();h.payments[0].onError(new TypeError('Failed to fetch'));h.render();await h.submit();assert.equal(h.payments.length,1);assert.ok(attempts.readDirectAttempt(h.storage,attempts.directAttemptKey('a')));
 h.context.isCheckoutOpen=false;h.render();h.context.isCheckoutOpen=true;h.render();await tick();await h.submit();assert.equal(h.payments.length,1);assert.equal(h.find(n=>n.type==='input'&&n.props.id==='checkout-phone').props.disabled,true);
});
test('owned active-order reference is tracking only; rejection permits recipient correction',async()=>{
 const h=harness();h.render();await tick();await h.submit();h.payments[0].onError(Object.assign(new Error('Active order'),{checkout:failure.preflightFailure('ACTIVE_MTN_ORDER'),existingOrderReference:'MH-owned-active'}));h.render();assert.equal(h.values.size,0);const phone=h.find(n=>n.type==='input'&&n.props.id==='checkout-phone');assert.equal(phone.props.disabled,false);phone.props.onChange({target:{value:'0242222222'}});h.render();await h.submit();assert.equal(h.payments.length,2);assert.equal(h.payments[1].recipientPhone,'024 222 2222');assert.notEqual(h.payments[0].commercial.requestId,h.payments[1].commercial.requestId);assert.equal(attempts.readDirectAttempt(h.storage,attempts.directAttemptKey('a'))?.reference,undefined);
});
test('popup success without verification keeps durable recovery and stale account callbacks are ignored',async()=>{
 const h=harness();h.render();await tick();await h.submit();const first=h.payments[0];first.onOrderCreated('MH-a');first.onPaymentReceived('MH-a','pay-a');assert.equal(attempts.readDirectAttempt(h.storage,attempts.directAttemptKey('a'))?.reference,'MH-a');
 const before=h.counts();h.context.user={id:'b',email:'b@example.test',phone:'0242222222'};h.context.sessionToken='b-token';h.render();first.onPaymentReceived('MH-a','pay-a');assert.deepEqual(h.counts(),before);
});
test('delayed status response cannot unlock another account recovery checkpoint',async()=>{
 const h=harness();h.render();await tick();await h.submit();const first=h.payments[0];first.onOrderCreated('MH-a');first.onCancel('MH-a');h.render();let finish!:(result:any)=>void;h.setLookup(()=>new Promise(r=>finish=r));
 const button=h.find(n=>n.type==='button'&&n.props.onClick?.name==='checkPaymentStatus');assert.ok(button);const pending=button.props.onClick();
 attempts.saveDirectAttempt(h.storage,attempts.directAttemptKey('b'),{requestId:randomUUID(),productId:'mtn-1gb'});h.context.user={id:'b',email:'b@example.test',phone:'0242222222'};h.context.sessionToken='b-token';h.render();await tick();
 finish({success:true,order:{status:'paid',manual_review:false}});await pending;h.render();await h.submit();assert.equal(h.payments.length,1);assert.ok(attempts.readDirectAttempt(h.storage,attempts.directAttemptKey('b')));assert.deepEqual(h.counts(),{closes:0,opened:0});
});
