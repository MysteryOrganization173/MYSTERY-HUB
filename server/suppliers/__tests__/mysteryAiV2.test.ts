import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {sendMysteryAiMessage,getGroundedLocalResponse,resolveInstantBuilderHelp,MysteryAiError,MYSTERY_AI_TIMEOUT_MESSAGE} from '../../../src/services/mysteryAiService.js';
import {hasUnsupportedActionClaim} from '../../services/mysteryAiReliability.js';
import {createMysteryAiRouter} from '../../routes/mysteryAiApi.js';
const editor={experienceMode:'website_editor',templateId:'tmpl-boutique',templateName:'Boutique',siteStatus:'draft',activeEditorSection:'contact',previewDevice:'mobile',hasUnsavedChanges:false} as const;
const turn=(role:'user'|'assistant',content:string)=>({id:role+content,role,content,timestamp:''});
async function remote(query:string,reply:string,page:any='home',history:any[]=[]) {
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({reply,source:'gemini',fallback:false}),{status:200});
 try{return await sendMysteryAiMessage(query,page,history);}finally{globalThis.fetch=original;}
}
for(const query of ['What is Mystery Hub?','Thanks.','Hello.','Okay.','Tell me about credit scores','Can you explain how websites work?'])test(`incidental answer wording cannot navigate: ${query}`,async()=>{
 const result=await remote(query,'Mystery Hub offers data bundles and a website builder. Open the Orders page for support.');assert.equal(result.quickAction,undefined);
});
test('Wallet funding intent does not become Airtime credit',async()=>{assert.equal((await remote('How do I top up my Wallet?','Choose Wallet.')).quickAction?.targetPage,'wallet');});
test('explicit destinations remain useful',async()=>{
 for(const [query,target] of [['Take me to where I can buy MTN data','data'],['Open Airtime','data'],['Help me create a website on Mystery Hub','website'],['How do I track my order?','orders']])assert.equal((await remote(query,'Helpful guidance.')).quickAction?.targetPage,target);
});
test('Airtime action carries the existing supported data mode',async()=>{const r=await remote('Take me to airtime top-up','Choose Airtime.');assert.equal((r.quickAction as any)?.dataMode,'airtime');});
test('ambiguous multi-service comparison does not choose an arbitrary destination',async()=>{assert.equal((await remote('Compare Data, Wallet and Website Builder','Each has a different purpose.')).quickAction,undefined);});
test('explicit negation and unsupported routes never create a quick action',async()=>{for(const q of ['Do not take me to data','Open the admin panel','Browse the live web for me'])assert.equal((await remote(q,'Here is general information about data bundles.')).quickAction,undefined);});
test('ordinary phone and design questions are not intercepted by editor keywords',()=>{
 assert.equal(resolveInstantBuilderHelp('Why is my phone so slow?',editor),null);assert.equal(resolveInstantBuilderHelp('What is a logo?',editor),null);assert.equal(resolveInstantBuilderHelp('How do I buy a bundle?',editor),null);
});
test('Builder help names current controls and distinguishes saving from publication',()=>{
 assert.match(resolveInstantBuilderHelp('How do I change my colours?',editor)!.reply,/Design|Colors/);
 assert.match(resolveInstantBuilderHelp('How do I publish my website?',editor)!.reply,/checklist|checks/i);
 assert.match(resolveInstantBuilderHelp('How do I update my live website?',editor)!.reply,/Update Live/);
 assert.doesNotMatch(resolveInstantBuilderHelp('How do I delete my website?',editor)!.reply,/Danger Zone|permanently removes/);
});
test('general water/website questions do not get canned platform-service answers',()=>{assert.equal(getGroundedLocalResponse('Explain the water cycle','home'),null);assert.equal(getGroundedLocalResponse('Explain how websites work','home'),null);});
test('a free-website follow-up uses the last customer topic',()=>{
 const history=[turn('user','Help me create a website on Mystery Hub'),turn('assistant','You can use the free Website Builder.')];
 const help=(getGroundedLocalResponse as any)('Can I use it for free?','home',undefined,history);assert.ok(help);assert.match(help.reply,/Free|free/);assert.match(help.reply,/one|1/);
});
test('Store Earnings are distinct from Mystery Earn',()=>{const help=getGroundedLocalResponse('How do Store Earnings work?','home');assert.ok(help);assert.match(help.reply,/seller|Store Earnings/);assert.doesNotMatch(help.reply,/your referral link/);});
test('server timeout uses a known guide without blaming customer internet',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({code:'TIMEOUT',retryable:true}),{status:503});
 try{const r=await sendMysteryAiMessage('How do I track my order?','home',[]);assert.equal(r.source,'scripted');assert.match(r.reply,/cannot|can’t/);}finally{globalThis.fetch=original;}
 assert.doesNotMatch(MYSTERY_AI_TIMEOUT_MESSAGE,/check your connection/i);
});
test('retry metadata preserves server cooldown for the UI',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({code:'QUOTA',retryable:true,retryAfterSeconds:45}),{status:429,headers:{'Retry-After':'45'}});
 try{await assert.rejects(sendMysteryAiMessage('Explain quantum physics','home',[]),e=>e instanceof MysteryAiError&&(e as any).retryAfterSeconds===45);}finally{globalThis.fetch=original;}
});
test('provider cancellation is non-retryable and does not invoke an alternate model',async()=>{
 let calls=0;const app=express();app.use(express.json(),createMysteryAiRouter({getClient:()=>({models:{generateContent:async()=>{calls++;throw new DOMException('Cancelled','AbortError');}}}) as any,catalog:async()=>({products:[]}) as any}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{const response=await fetch(`http://127.0.0.1:${(server.address() as any).port}/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'A synthetic open-ended question'})});const d=await response.json();assert.equal(calls,1);assert.equal(d.code,'CANCELLED');assert.equal(d.retryable,false);}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});

test('editor context does not turn unrelated publishing, colour or financial questions into website help',()=>{
 for(const q of ['How do I publish a book?','How do I change the colour of my phone screen?','How can I update live stock prices?','How do I upload an image to Facebook?','How do I preview my exam results?','How do I unpublish a Facebook post?','How do I add a contact on my phone?','How do I add a service in Linux?','How do I add products to Amazon?','How do I change my Instagram password?'])assert.equal(resolveInstantBuilderHelp(q,editor),null,q);
});
test('short explicit navigation preserves Data and Instant Bundles destinations',async()=>{
 for(const q of ['Open data','Take me to data','Go to data','Open Instant Bundles']){
  const r=await remote(q,'Helpful answer.');assert.equal(r.quickAction?.targetPage,'data',q);assert.equal(r.quickAction?.dataMode,q.includes('Instant')?'instant':'data');
 }
});
test('explaining other people buying is not customer purchase intent; negative recharge stays negative',async()=>{
 for(const q of ['Why do people buy data bundles?','Explain why customers buy airtime','I do not want to recharge airtime'])assert.equal((await remote(q,'Helpful answer.')).quickAction,undefined,q);
});

// Real HTTP boundary, synthetic provider only. No application startup, credentials or database.
async function apiV2(client:any,run:(base:string)=>Promise<void>,extra:any={}){
 const app=express();app.use(express.json(),createMysteryAiRouter({getClient:()=>client,catalog:async()=>({products:[]}) as any,attemptTimeoutMs:15,...extra}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{await run(`http://127.0.0.1:${(server.address() as any).port}`);}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
}
const postV2=(base:string,message='Synthetic general question',extra:any={})=>fetch(base+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,...extra})});
for(const [label,output,status,code,retryable,calls] of [
 ['empty response',{text:''},503,'EMPTY_RESPONSE',true,2],
 ['provider unavailable',{throw:{status:503,message:'secret'}},503,'PROVIDER_UNAVAILABLE',true,2],
 ['invalid configuration',{throw:{status:403,message:'secret'}},503,'CONFIGURATION',false,1],
 ['quota',{throw:{status:429,message:'secret'}},429,'QUOTA',true,1],
 ['model unavailable',{throw:{status:404}},503,'MODEL_UNAVAILABLE',false,2],
 ['safety',{promptFeedback:{blockReason:'SAFETY'}},503,'SAFETY',false,1],
 ['false account access',{text:'I checked your order and it is delivered.'},503,'SAFETY',false,1],
 ['false payment action',{text:"I've refunded your payment."},503,'SAFETY',false,1],
] as const)test(`bounded provider outcome: ${label}`,async()=>{
 let invoked=0;await apiV2({models:{generateContent:async()=>{invoked++;if('throw' in output)throw output.throw;return output;}}},async base=>{
  const res=await postV2(base),body=await res.json();assert.equal(res.status,status);assert.equal(body.code,code);assert.equal(body.retryable,retryable);assert.equal(invoked,calls);assert.doesNotMatch(JSON.stringify(body),/secret|I checked|refunded your/);
 });
});
test('Instant Bundles name is accepted without accepting a delivery guarantee',async()=>{
 await apiV2({models:{generateContent:async()=>({text:'Choose Instant Bundles to see current options; delivery depends on fulfilment.'})}},async base=>{
  const res=await postV2(base);assert.equal(res.status,200);assert.equal((await res.json()).source,'gemini');
 });
 await apiV2({models:{generateContent:async()=>({text:'Airtime delivery is guaranteed immediately.'})}},async base=>assert.equal((await (await postV2(base)).json()).code,'SAFETY'));
});
test('simple conversations and verified editor help avoid both catalogue and model calls',async()=>{
 let calls=0;await apiV2({models:{generateContent:async()=>{calls++;return {text:'unused'};}}},async base=>{
  for(const message of ['Hello','Thanks','Okay','How do I publish my website?']){
   const res=await postV2(base,message,{editorContext:editor});const body=await res.json();assert.equal(body.source,'guide');assert.equal(body.fallback,false);assert.equal(res.headers.get('Cache-Control'),'no-store');
  }assert.equal(calls,0);
 },{catalog:async()=>{throw Error('Instant help must not fetch the catalogue');}});
});
test('backend total deadline bounds two hung model attempts even when they ignore abort',async()=>{
 let calls=0;const at=Date.now();await apiV2({models:{generateContent:()=>{calls++;return new Promise(()=>{});}}},async base=>{
  const res=await postV2(base);assert.equal((await res.json()).code,'TIMEOUT');assert.ok(calls<=2);assert.ok(Date.now()-at<1000);
 },{totalTimeoutMs:25});
});
test('first-model timeout aborts transport, then existing alternate may succeed',async()=>{
 let calls=0,aborted=false;await apiV2({models:{generateContent:async(input:any)=>{calls++;if(calls===2)return {text:'Recovered answer'};return new Promise((_,reject)=>input.config.abortSignal.addEventListener('abort',()=>{aborted=true;reject(input.config.abortSignal.reason);}));}}},async base=>{
  const res=await postV2(base);assert.equal(res.status,200);assert.equal((await res.json()).reply,'Recovered answer');assert.equal(calls,2);assert.equal(aborted,true);
 });
});
test('frontend deadline covers ignored abort and a stalled response body',async()=>{
 const original=globalThis.fetch;
 try{
  for(const mock of [()=>new Promise<Response>(()=>{}),()=>Promise.resolve(new Response(new ReadableStream({start(){}})))]){
   globalThis.fetch=mock;const at=Date.now();await assert.rejects(sendMysteryAiMessage('Explain quantum physics','home',[],undefined,undefined,10),e=>e instanceof MysteryAiError&&e.kind==='timeout');assert.ok(Date.now()-at<1000);
  }
 }finally{globalThis.fetch=original;}
});
test('user cancellation never produces a late guide even when provider transport ignores abort',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>new Promise(()=>{});const controller=new AbortController();
 try{const pending=sendMysteryAiMessage('Wallet','home',[],undefined,controller.signal);controller.abort();await assert.rejects(pending,{name:'AbortError'});}finally{globalThis.fetch=original;}
});
test('short follow-ups use recent user intent rather than incidental assistant words',()=>{
 const history=[turn('user','How do I buy MTN data?'),turn('assistant','There are websites and Wallet features too.')];
 assert.match(getGroundedLocalResponse('What about Telecel?','home',undefined,history)!.reply,/Telecel/);
 assert.equal(getGroundedLocalResponse('What about Telecel?','home',undefined,history)?.quickAction,undefined);
 const unclear=[turn('user','Explain gardening'),turn('assistant','Mystery Hub offers data.')];assert.equal(getGroundedLocalResponse('Why?','home',undefined,unclear),null);
});
test('public help preserves missing-information, payment and future-service boundaries',()=>{
 assert.match(getGroundedLocalResponse('Can you refund my order?','home')!.reply,/unconfirmed until verified|cannot/);
 assert.match(getGroundedLocalResponse('Can I buy WAEC PINs?','home')!.reply,/planned|not a purchasable/);
 assert.match(getGroundedLocalResponse('Can I withdraw Wallet funds?','home')!.reply,/cannot be withdrawn/);
 assert.match(getGroundedLocalResponse('How do I publish my website?','website')!.reply,/chat cannot publish/);
});
test('Airtime history wins over the shared data page for a network follow-up',()=>{
 const history=[turn('user','How do I buy Airtime?'),turn('assistant','Choose Airtime.')];
 const response=getGroundedLocalResponse('What about Telecel?','data',undefined,history);assert.match(response!.reply,/choose Airtime/);assert.equal(response?.quickAction,undefined);
});
test('All Services and Help keep exact supported navigation destinations',async()=>{
 assert.equal((await remote('Open All Services','Helpful answer.')).quickAction?.targetPage,'services');
 assert.equal((await remote('Open Help','Helpful answer.')).quickAction?.targetPage,'help');
});

test('capability guard permits framed drafts and denials, but rejects direct execution assertions',()=>{
 assert.equal(hasUnsupportedActionClaim('Here is a message you can send: “I submitted my AFA form yesterday and would like help checking it.”'),false);
 assert.equal(hasUnsupportedActionClaim('“I have published my website and need help.”'),false);
 assert.equal(hasUnsupportedActionClaim('I cannot access your order or refund it.'),false);
 assert.equal(hasUnsupportedActionClaim('I checked your order and it is delivered.'),true);
});

test('AI health remains Admin-only and separates guide outcomes from verified generation',async()=>{
 const {AuthStore}=await import('../../db/authStore.js');const find=AuthStore.findSessionByToken,touch=AuthStore.touchSession;
 try{
  AuthStore.findSessionByToken=async token=>({user:{role:token==='synthetic-admin'?'admin':'customer',status:'active',must_change_password:false}}) as any;
  AuthStore.touchSession=async()=>{};
  let fail=true;
  await apiV2({models:{generateContent:async()=>{if(fail)throw {status:503,message:'synthetic-private-key-and-message'};return {text:'Useful answer'};}}},async base=>{
   assert.equal((await fetch(base+'/health')).status,401);
   assert.equal((await fetch(base+'/health',{headers:{Authorization:'Bearer synthetic-customer'}})).status,403);
   await postV2(base,'Hello');await postV2(base,'Wallet funding');
   const health=async()=>{const r=await fetch(base+'/health',{headers:{Authorization:'Bearer synthetic-admin'}});assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');return r.json();};
   const first=await health();assert.equal(first.providerAccessVerified,false);assert.equal(first.requestOutcomes.instantGuide,1);assert.equal(first.requestOutcomes.fallbackGuide,1);assert.equal(first.failureCounts.PROVIDER_UNAVAILABLE,2);assert.equal(first.latency.completedRequests,2);
   assert.doesNotMatch(JSON.stringify(first),/synthetic-private|How do I track|order history/);
   fail=false;await postV2(base);const recovered=await health();assert.equal(recovered.providerAccessVerified,true);assert.equal(recovered.requestOutcomes.generated,1);assert.equal(recovered.successfulGenerations,1);assert.equal(recovered.activeRequests,0);
  });
 }finally{AuthStore.findSessionByToken=find;AuthStore.touchSession=touch;}
});

test('service-qualified payment/delivery problems retain safe order guidance',async()=>{
 for(const q of ['My MTN data bundle is delayed','I paid for 2GB and have not received it','I need a refund for my airtime','How do I track my airtime order?']){
  const help=getGroundedLocalResponse(q,'home');assert.ok(help,q);assert.match(help.reply,/Payment confirmation is separate|cannot look up private/);
 }
 assert.equal((await remote('How do I track my airtime order?','Track your existing order.')).quickAction?.targetPage,'orders');
 assert.equal((await remote('Compare data delivery and airtime delivery','It depends.')).quickAction,undefined);
 for(const q of ['Buy airtime and track my order','How do I track my order and buy airtime?','I want to buy data bundles and airtime'])assert.equal((await remote(q,'Use the relevant workflows.')).quickAction,undefined,q);
});
