import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createMysteryAiRouter} from '../../routes/mysteryAiApi.js';
import {bounded,classifyAiError,knownServiceHelp} from '../../services/mysteryAiReliability.js';
async function api(client:any,run:(base:string)=>Promise<void>,extra:Record<string,unknown>={}){
 const app=express();app.use(express.json(),createMysteryAiRouter({getClient:()=>client,catalog:async()=>({products:[]}) as any,attemptTimeoutMs:25,...extra}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));try{await run(`http://127.0.0.1:${(server.address() as any).port}`);}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
}
const post=(base:string,message='Unmatched synthetic question',signal?:AbortSignal)=>fetch(base+'/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message}),signal});
for(const [status,code] of [[429,'QUOTA'],[403,'CONFIGURATION'],[404,'MODEL_UNAVAILABLE'],[503,'PROVIDER_UNAVAILABLE']] as const)test(`safe classification for provider HTTP ${status}`,()=>assert.equal(classifyAiError({status,message:'secret'}),code));
test('all known service fallbacks are useful, deterministic and make no success/price claims',()=>{
 for(const message of ['Order tracking','Wallet funding','AFA registration','data price','business website','contact support'])assert.ok(knownServiceHelp(message));
 assert.equal(knownServiceHelp('Explain quantum physics'),null);assert.doesNotMatch(knownServiceHelp('data price')!,/GH₵|instant delivery|guaranteed delivery/i);
});
test('quota returns retry contract and opens provider cooldown rather than trying another model',async()=>{
 let calls=0;await api({models:{generateContent:async()=>{calls++;throw {status:429,message:'secret'};}}},async base=>{
 for(let i=0;i<2;i++){const response=await post(base);assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');assert.equal((await response.json()).code,'QUOTA');}assert.equal(calls,1);
 });
});
test('model-not-found falls back to the existing supported alternative without duplicating history',async()=>{
 const calls:any[]=[];await api({models:{generateContent:async(input:any)=>{calls.push(input);if(calls.length===1)throw {status:404};return {text:'Provider answer'};}}},async base=>{
 assert.equal((await post(base)).status,200);assert.deepEqual(calls.map(c=>c.model),['gemini-3.1-flash-lite','gemini-3.8-flash']);assert.equal(calls[1].contents.length,1);assert.ok(calls[0].config.abortSignal);
 });
});
test('hung provider is aborted and capacity recovers; no orphaned promise rejection',async()=>{
 let aborted=0;await api({models:{generateContent:(input:any)=>new Promise((_,reject)=>input.config.abortSignal.addEventListener('abort',()=>{aborted++;reject(input.config.abortSignal.reason);},{once:true}))}},async base=>{
 for(let i=0;i<5;i++){const response=await post(base);assert.equal(response.status,503);assert.equal((await response.json()).code,'TIMEOUT');}assert.equal(aborted,10);
 });
});
test('catalog hanging has a bounded timeout and provider still receives a safe empty catalogue',async()=>{
 await api({models:{generateContent:async()=>({text:'Safe response'})}},async base=>assert.equal((await post(base)).status,200),{catalog:()=>new Promise(()=>{}),catalogTimeoutMs:10});
});
test('known questions work without configured Gemini and identify non-AI source',async()=>{
 await api(null,async base=>{const response=await post(base,'How do I track my order?');assert.equal(response.status,200);const body=await response.json();assert.equal(body.source,'guide');assert.equal(body.fallback,true);assert.match(body.reply,/Open Orders/);});
});
test('request disconnect cancels provider transport and health is admin protected',async()=>{
 let started=false,cancelled=false;await api({models:{generateContent:(input:any)=>new Promise((_,reject)=>{started=true;input.config.abortSignal.addEventListener('abort',()=>{cancelled=true;reject(input.config.abortSignal.reason);},{once:true});})}},async base=>{
 const controller=new AbortController();const pending=post(base,undefined,controller.signal);for(let i=0;i<30&&!started;i++)await new Promise(r=>setTimeout(r,2));controller.abort();await assert.rejects(pending,{name:'AbortError'});
 for(let i=0;i<30&&!cancelled;i++)await new Promise(r=>setTimeout(r,2));assert.equal(cancelled,true);assert.equal((await fetch(base+'/health')).status,401);
 });
});
test('bounded cancellation handles an already-aborted parent without invoking provider',async()=>{
 const controller=new AbortController();controller.abort();let called=false;await assert.rejects(()=>bounded(async()=>{called=true;return 1;},10,controller.signal),{name:'AbortError'});assert.equal(called,false);
});
