import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {GoogleGenAI} from '@google/genai';
import {createMysteryAiRouter} from '../../routes/mysteryAiApi.js';
import {aiProviderDiagnostic,classifyAiError,knownServiceHelp} from '../../services/mysteryAiReliability.js';
import {getGroundedLocalResponse,sendMysteryAiMessage} from '../../../src/services/mysteryAiService.js';
import {buildMysteryAiSystemInstruction} from '../../services/mysteryAiContext.js';
import {validateUltraEnquiry} from '../../services/websiteValidation.js';
import {notificationWorkerHealth,startNotificationWorker} from '../../services/notificationWorker.js';

async function rawProvider(status:number,body:unknown,run:(base:string,calls:()=>number)=>Promise<void>){
 let calls=0;
 const client=new GoogleGenAI({apiKey:'synthetic-not-a-secret',httpOptions:{fetch:async()=>{calls++;return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});}}});
 const app=express();app.use(express.json(),createMysteryAiRouter({getClient:()=>client,catalog:async()=>({products:[]}) as any,attemptTimeoutMs:100}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{await run(`http://127.0.0.1:${(server.address() as any).port}`,()=>calls);}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
}
const post=(base:string,message='Unmatched synthetic question')=>fetch(base+'/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message})});
test('raw Gemini success is explicitly labelled as a model response',async()=>{
 await rawProvider(200,{candidates:[{content:{role:'model',parts:[{text:'Synthetic provider response'}]},finishReason:'STOP'}]},async(base,calls)=>{
  const r=await post(base),b=await r.json();assert.equal(r.status,200);assert.equal(b.source,'gemini');assert.equal(b.fallback,false);assert.equal(b.reply,'Synthetic provider response');assert.equal(calls(),1);
 });
});
for(const status of [400,401,402,403])test(`raw Gemini HTTP ${status} is a non-retryable configuration failure, never a second model`,async()=>{
 const secret='DO_NOT_LOG_CUSTOMER_OR_KEY';const old=console.warn,logs:string[]=[];console.warn=(v)=>logs.push(String(v));
 try{await rawProvider(status,{error:{code:status,message:secret,status:'INVALID_ARGUMENT',details:[{reason:'API_KEY_INVALID',metadata:{key:secret}}]}},async(base,calls)=>{
  for(let i=0;i<2;i++){const r=await post(base),b=await r.json();assert.equal(r.status,503);assert.equal(b.code,'CONFIGURATION');assert.equal(b.retryable,false);assert.ok(!JSON.stringify(b).includes(secret));}assert.equal(calls(),1);
 });assert.ok(logs.some(l=>l.includes('API_KEY_INVALID')));assert.ok(!logs.join('').includes(secret));}finally{console.warn=old;}
});
test('raw quota response has no hidden SDK retries and offers a labelled guide',async()=>{
 await rawProvider(429,{error:{code:429,status:'RESOURCE_EXHAUSTED',message:'quota'}},async(base,calls)=>{
  const first=await post(base);assert.equal(first.status,429);assert.equal((await first.json()).code,'QUOTA');
  const b=await(await post(base,'Hi, what can you help me with?')).json();assert.equal(b.source,'guide');assert.equal(b.fallback,true);assert.equal(calls(),1);
 });
});
test('candidate safety block never retries a different model or exposes partial unsafe text',async()=>{
 await rawProvider(200,{candidates:[{finishReason:'SAFETY',content:{parts:[{text:'unsafe partial text'}]}}]},async(base,calls)=>{
  const b=await(await post(base)).json();assert.equal(b.code,'SAFETY');assert.equal(b.retryable,false);assert.equal(b.reply,undefined);assert.equal(calls(),1);
 });
});
test('diagnostics allow only fixed status/reason/network codes; arbitrary provider metadata stays private',()=>{
 assert.equal(classifyAiError({statusCode:402}),'CONFIGURATION');
 assert.deepEqual(aiProviderDiagnostic({message:JSON.stringify({error:{code:400,details:[{reason:'SECRET-VALUE'}]}}),cause:{code:'SECRET-NETWORK'}}),{httpStatus:400,reason:null,networkCode:null});
 assert.equal(aiProviderDiagnostic({cause:{code:'ECONNRESET'}}).networkCode,'ECONNRESET');
});
for(const q of ['Hi, what can you help me with?','What is Mystery Hub?','How do I buy MTN data?','Can I buy airtime?','Where can I track my order?',"My payment went through but I haven't received my bundle.",'Can I create my own business website?','How does Mystery Earn work?','Can I withdraw money from my Wallet?','Do you have a website builder?','How do I contact support?'])test(`same safe offline and backend guide: ${q}`,()=>{
 const local=getGroundedLocalResponse(q,'home');assert.ok(local);assert.equal(local.reply,knownServiceHelp(q));assert.doesNotMatch(local.reply,/15–45|48 hours|instant delivery|45%|20%/i);
});
test('Wallet guide rejects withdrawals; Earn guide never invents economics or reads accounts',()=>{
 assert.match(knownServiceHelp('Can I withdraw money from my Wallet?')!,/cannot be withdrawn/);
 assert.match(knownServiceHelp('How does Mystery Earn work?')!,/effective reward policy/);
 assert.match(buildMysteryAiSystemInstruction(undefined,[]),/current availability/);
});
test('a response with missing provenance is never labelled genuine AI',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({reply:'unverified answer'}),{status:200});
 try{await assert.rejects(()=>sendMysteryAiMessage('Explain quantum physics','home',[]));const answer=await sendMysteryAiMessage('Hi','home',[]);assert.equal(answer.source,'scripted');assert.notEqual(answer.reply,'unverified answer');}finally{globalThis.fetch=old;}
});
test('locally personalized welcome text is never sent as model conversation history',async()=>{
 const old=globalThis.fetch;let payload:any;globalThis.fetch=async(_url,init)=>{payload=JSON.parse(String(init?.body));return new Response(JSON.stringify({reply:'response',source:'gemini',fallback:false}),{status:200});};
 try{await sendMysteryAiMessage('question','home',[{id:'welcome-home',role:'assistant',content:'Hi private account name',timestamp:''},{id:'prior',role:'user',content:'Prior question',timestamp:''}]);assert.deepEqual(payload.history,[{role:'user',content:'Prior question'}]);assert.ok(!JSON.stringify(payload).includes('private account name'));}finally{globalThis.fetch=old;}
});
test('backend guide navigation follows its service contract, not incidental words in the reply',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({reply:knownServiceHelp('Hi'),source:'guide',fallback:true}),{status:200});
 try{assert.equal((await sendMysteryAiMessage('Hi','home',[])).quickAction?.targetPage,'services');assert.equal((await sendMysteryAiMessage('Wallet','home',[])).quickAction?.targetPage,'wallet');}finally{globalThis.fetch=old;}
});
const brief={businessName:'Synthetic Studio',businessType:'Design',contactName:'Synthetic Owner',phone:'0241234567',email:'synthetic@example.test',existingDomain:'no',estimatedPages:3,featuresRequirements:'A portfolio',preferredStyle:'Simple',projectNotes:'Keep this progress',referenceWebsite:''};
for(const value of ['', '  \t ',undefined])test(`optional Ultra reference ${JSON.stringify(value)} accepts a valid email and preserves the input`,()=>{
 const original={...brief,referenceWebsite:value};const before=JSON.stringify(original);const result=validateUltraEnquiry(original);assert.equal(result.referenceWebsite,'');assert.equal(result.email,brief.email);assert.equal(result.projectNotes,brief.projectNotes);assert.equal(JSON.stringify(original),before);
});
test('nonempty malformed Ultra reference fails clearly without erasing the original brief',()=>{
 const input={...brief,referenceWebsite:'example without scheme'};assert.throws(()=>validateUltraEnquiry(input),/full HTTP or HTTPS/);assert.equal(input.projectNotes,brief.projectNotes);assert.equal(input.businessName,brief.businessName);
});
test('notification worker health is observational; no configured worker or receipt is fabricated',()=>{
 const previous=process.env.WEB_PUSH_ENABLED;process.env.WEB_PUSH_ENABLED='false';try{const stop=startNotificationWorker();assert.equal(notificationWorkerHealth().running,false);assert.equal(notificationWorkerHealth().lastCompletedAt,null);stop();}finally{if(previous===undefined)delete process.env.WEB_PUSH_ENABLED;else process.env.WEB_PUSH_ENABLED=previous;}
});
