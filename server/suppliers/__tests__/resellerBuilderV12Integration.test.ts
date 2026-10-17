import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { createStoreCheckoutAttempt, readStoreCheckoutRecovery } from '../../../src/utils/storeCheckoutAttempt';
import { dataOrderPresentation } from '../../../src/utils/dataPurchasePresentation';

// Execute the actual component's event handlers. Browser checks additionally cover
// real React effects, native dialog top-layer behavior and responsive rendering.
const compiled=transformSync(readFileSync('src/components/website/ManagedDataStorefront.tsx','utf8'),{loader:'tsx',format:'cjs'}).code;
function component(preview=false,siteId='site-a') {
  const cells:any[]=[],effects:Array<()=>void>=[],calls={payments:[] as any[],requests:[] as string[],events:[] as string[],storageReads:0};
  const values=new Map<string,string>();let cursor=0;
  const react:any={createElement:(type:any,props:any,...children:any[])=>({type,props:{...props,children}}),
    useState:(initial:any)=>{const i=cursor++;if(!(i in cells))cells[i]=initial;return[cells[i],(value:any)=>{cells[i]=typeof value==='function'?value(cells[i]):value;}];},
    useRef:(initial:any)=>{const i=cursor++;return cells[i]??(cells[i]={current:initial});},
    useEffect:(fn:any,deps:any[])=>{const i=cursor++,old=cells[i];if(!old||deps.some((d,j)=>!Object.is(d,old.deps[j]))){effects.push(()=>{old?.cleanup?.();cells[i]={deps,cleanup:fn()};});}}
  };
  const tile=()=>null,tabs=()=>null,colors={accent:'#7c3aed',background:'#07101e',surface:'#0b1220',text:'#fff',mutedText:'#bbb',border:'#566',focus:'#fff'};
  const modules:any={react,'../../data/templates':{WEBSITE_TEMPLATES:[]},'../../data/bundles':{detectGhanaNetwork:()=>'mtn'},
    './storefront/ResellerCatalogue':{BundleTile:tile,NetworkTabs:tabs,lowestPrice:(b:any[])=>b.length?Math.min(...b.map(x=>x.priceMinor)):null,sortBundles:(b:any[])=>b,storeNetworkColor:()=>'#ffcc00',storeNetworkName:(n:string)=>n.toUpperCase(),storeNetworksIn:(b:any[])=>[...new Set(b.map(x=>x.network))]},
    '../../utils/websiteBrand':{websiteActionText:()=> '#fff',resolveResellerTheme:()=>colors},
    '../../utils/templateRendererUtils':{renderTemplateLayout:(_template:any,slots:any)=>({type:'layout',props:slots})},
    '../../hooks/usePaystack':{usePaystack:()=>({loadingPhase:'opening',initializeServerPayment:async(options:any)=>{calls.payments.push(options);}})},
    '../../services/websiteBusinessApi':{websiteBusinessRequest:async(path:string)=>{calls.requests.push(path);return path.endsWith('/storefront')?{products:[{id:'mtn-1gb',network:'mtn',dataAmount:'1GB',retailMinor:521}]}:{status:'pending_payment',manual_review:false};},trackPublicWebsite:(_id:string,event:string)=>calls.events.push(event)},
    '../../utils/dataPurchasePresentation':{dataOrderPresentation,dataDeliveryNote:()=> 'Check your recipient.',maskDataRecipient:()=> '024••••000'},'../../../shared/money':{formatGhs:(n:number)=>`GHc${n/100}`},
    '../../utils/storeCheckoutAttempt':{createStoreCheckoutAttempt,readStoreCheckoutRecovery},'../../../server/utils/phone':{isValidGhanaPhoneNumber:(p:string)=>p==='0240000000'}
  };
  const module={exports:{} as any};
  runInNewContext(compiled,{module,exports:module.exports,require:(name:string)=>{assert.ok(modules[name],name);return modules[name];},crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789abc'},sessionStorage:{getItem:(key:string)=>{calls.storageReads++;return values.get(key)||null;},setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)},setInterval:()=>0,clearInterval:()=>{},requestAnimationFrame:()=>{}});
  const wrapper=module.exports.ManagedDataStorefront({siteId,preview,template:{colorScheme:colors,demoBusinessName:'Synthetic owner'}});
  const render=()=>{cursor=0;const tree=wrapper.type(wrapper.props);while(effects.length)effects.shift()!();return tree;};
  const nodes=(tree:any):any[]=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children),...nodes(tree.props?.managedCheckout)];
  const find=(predicate:(node:any)=>boolean)=>nodes(render()).find(predicate);
  const buy=()=>{find(n=>n.type===tile).props.onChoose({id:'mtn-1gb',network:'mtn',dataAmount:'1GB',priceMinor:521});const phone=nodes(render()).find(n=>n.type==='input'&&n.props.type==='tel');phone?.props.onChange({target:{value:'0240000000'}});};
  const details=()=>{const inputs=nodes(render()).filter(n=>n.type==='input'&&n.props.type==='email');assert.equal(inputs.length,1);inputs[0].props.onChange({target:{value:'buyer@example.test'}});};
  const pay=()=>find(n=>n.type==='button'&&n.props.className?.includes('w-full font-bold')).props.onClick();
  const cleanup=()=>cells.forEach(cell=>cell?.cleanup?.());
  return {calls,values,wrapper,render,find,buy,details,pay,cleanup};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('V1.2 preview cannot initialize, recover, track or emit checkout analytics',async()=>{
  const h=component(true);h.render();await tick();h.buy();h.render();
  const input=h.find(n=>n.type==='input'&&n.props['aria-label']==='Order reference');input.props.onChange({target:{value:'MH-synthetic'}});
  h.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await tick();
  assert.deepEqual(h.calls.payments,[]);assert.deepEqual(h.calls.events,[]);assert.equal(h.calls.storageReads,0);
  assert.ok(h.calls.requests.every(path=>path.endsWith('/storefront')));assert.equal(h.values.size,0);h.cleanup();
});
test('published mode locks one request and cancellation resumes the same identity',async()=>{
  const h=component();h.render();await tick();h.buy();h.details();h.render();await h.pay();await h.pay();
  assert.equal(h.calls.payments.length,1);const first=h.calls.payments[0];assert.equal(first.store.siteId,'site-a');assert.equal(first.customerEmail,'buyer@example.test');assert.equal(first.store.expectedMinor,521);
  first.onOrderCreated('MH-synthetic');first.onCancel('MH-synthetic');first.onCancel('MH-synthetic');h.render();await h.pay();
  assert.equal(h.calls.payments.length,2);assert.equal(h.calls.payments[1].store.requestId,first.store.requestId);
  const saved=JSON.parse([...h.values.values()][0]);assert.deepEqual(Object.keys(saved).sort(),['reference','requestId']);h.cleanup();
});
test('preview/site changes remount checkout and old callbacks cannot activate the replacement',async()=>{
  const h=component();h.render();await tick();h.buy();h.details();h.render();await h.pay();const attempt=h.calls.payments[0];assert.equal(attempt.isActive(),true);h.cleanup();
  assert.equal(attempt.isActive(),false);const before=h.calls.requests.length;attempt.onPaymentReceived('MH-stale');attempt.onCancel('MH-stale');assert.equal(h.calls.requests.length,before);
  const preview=component(true),other=component(false,'site-b');assert.notEqual(h.wrapper.props.key,preview.wrapper.props.key);assert.notEqual(h.wrapper.props.key,other.wrapper.props.key);
});
