import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transformSync} from 'esbuild';
import * as pricing from '../../../src/utils/websitePricing.js';
import * as money from '../../../shared/money.js';
import {storeReserve} from '../../../shared/storeEconomics.js';
import {pricingReviewLines} from '../../../src/utils/websiteOwnerOrders.js';
const compiled=transformSync(readFileSync('src/components/website/WebsiteBundlePricing.tsx','utf8'),{loader:'tsx',format:'cjs'}).code;
const catalog=(eligible=false)=>({version:'v1',policy:{enabled:true,reserveBps:300,reserveFixedMinor:10},products:[{id:'mtn-1gb',network:'mtn',networkName:'MTN',dataAmount:'1GB',retailMinor:500,enabled:false,minimumMinor:400,wholesaleMinor:300,configured:true,eligible}]});
const tick=()=>new Promise<void>(r=>setImmediate(r));
const deferred=()=>{let resolve!:(v:any)=>void,reject!:(v:any)=>void;const promise=new Promise<any>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(request:(...args:any[])=>Promise<any>){
 const cells:any[]=[],effects:Array<()=>void>=[],saved:number[]=[];let cursor=0,props={siteId:'site-a',token:'session-a'};
 const react={createElement:(type:any,props:any,...children:any[])=>({type,props:{...props,children}}),useState:(initial:any)=>{const i=cursor++;if(!(i in cells))cells[i]=initial;return [cells[i],(v:any)=>cells[i]=typeof v==='function'?v(cells[i]):v];},useRef:(initial:any)=>{const i=cursor++;return cells[i]??(cells[i]={current:initial});},useEffect:(fn:any,deps:any[])=>{const i=cursor++,old=cells[i];if(!old||deps.some((d,j)=>!Object.is(d,old.deps[j])))effects.push(()=>{old?.cleanup?.();cells[i]={deps,cleanup:fn()};});}};
 const modules:any={react,'../../services/websiteBusinessApi':{websiteBusinessRequest:request},'../../../shared/money':money,'../../../shared/storeEconomics':{storeReserve},'../../utils/websiteOwnerOrders':{pricingReviewLines},'../../utils/websitePricing':pricing};const module={exports:{} as any};
 runInNewContext(compiled,{module,exports:module.exports,require:(n:string)=>{assert.ok(modules[n],n);return modules[n];},window:{addEventListener(){},removeEventListener(){},confirm:()=>true},requestAnimationFrame:()=>{}});
 const render=()=>{cursor=0;const tree=module.exports.WebsiteBundlePricing({...props,onSaved:(n:number)=>saved.push(n)});while(effects.length)effects.shift()!();return tree;};
 const nodes=(v:any):any[]=>v&&typeof v==='object'?Array.isArray(v)?v.flatMap(nodes):[v,...nodes(v.props?.children)]:[];
 const text=(v:any):string=>v===null||v===undefined?'':Array.isArray(v)?v.map(text).join(''):typeof v==='object'?text(v.props?.children):String(v);
 const click=(label:string)=>{const n=nodes(render()).find(n=>n.type==='button'&&text(n)===label);assert.ok(n,label);assert.ok(!n.props.disabled,label);n.props.onClick();};
 return {render,click,saved,text:()=>text(render()),switch:(siteId:string,token:string)=>{props={siteId,token};render();},save:()=>{render();click('Preview setup');render();click('Confirm and save');},cleanup:()=>cells.forEach(c=>c?.cleanup?.())};
}
test('successful PUT followed by failed refresh never claims nothing was saved',async()=>{let put=false;const h=harness(async(_p,_t,_body,method)=>{if(method==='PUT'){put=true;return {};}if(put)throw Error('Temporary refresh failure');return catalog();});try{h.render();await tick();h.save();await tick();assert.match(h.text(),/settings were saved.*latest catalogue/i);assert.ok(!h.text().includes('Nothing was saved'));assert.deepEqual(h.saved,[]);}finally{h.cleanup();}});
test('unconfirmed transport result asks for reload, not blind save retry',async()=>{const h=harness(async(_p,_t,_body,method)=>{if(method==='PUT')throw Error('Network interrupted');return catalog();});try{h.render();await tick();h.save();await tick();assert.match(h.text(),/save result could not be confirmed.*Reload prices/i);}finally{h.cleanup();}});
test('success count comes from refreshed eligibility and does not promise service availability',async()=>{let put=false;const h=harness(async(_p,_t,_body,method)=>{if(method==='PUT'){put=true;return {};}return catalog(put);});try{h.render();await tick();h.save();await tick();assert.deepEqual(h.saved,[1]);assert.match(h.text(),/1 bundle meets the current catalogue rules/);assert.match(h.text(),/current service availability/);}finally{h.cleanup();}});
test('delayed load for old site/session cannot replace the current catalogue',async()=>{const old=deferred(),h=harness(async(_p,t)=>t==='session-a'?old.promise:{...catalog(),products:[]});try{h.render();h.switch('site-b','session-b');await tick();old.resolve(catalog(true));await tick();assert.ok(!h.text().includes('1 bundle configured'));assert.equal(h.saved.length,0);}finally{h.cleanup();}});
test('delayed save after a site/session switch cannot report success to the new owner',async()=>{const pending=deferred(),h=harness(async(_p,_t,_body,method)=>method==='PUT'?pending.promise:catalog());try{h.render();await tick();h.save();h.switch('site-b','session-b');await tick();pending.resolve({});await tick();assert.deepEqual(h.saved,[]);assert.ok(!h.text().includes('Your bundle setup is saved'));}finally{h.cleanup();}});
