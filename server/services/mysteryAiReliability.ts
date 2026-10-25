import {getGeminiClient} from './geminiClient.js';
import {CommercialService} from './commercialService.js';
import {buildMysteryAiSystemInstruction} from './mysteryAiContext.js';
import {Router} from 'express';
import {requireAdmin} from '../middleware/authMiddleware.js';
import {createRateLimiter} from '../middleware/rateLimiter.js';

export const AI_FAILURE="Couldn't reach Mystery AI just now. Try again.";
export type AiFailureCode='TIMEOUT'|'CANCELLED'|'QUOTA'|'CONFIGURATION'|'MODEL_UNAVAILABLE'|'PROVIDER_UNAVAILABLE'|'EMPTY_RESPONSE'|'SAFETY';
export function classifyAiError(error:unknown):AiFailureCode {
 const e=error as {status?:number;code?:number|string;name?:string};
 if(e?.name==='TimeoutError')return 'TIMEOUT';if(e?.name==='AbortError')return 'CANCELLED';
 const status=Number(e?.status||e?.code);if(status===429)return 'QUOTA';if(status===401||status===403)return 'CONFIGURATION';if(status===404)return 'MODEL_UNAVAILABLE';return 'PROVIDER_UNAVAILABLE';
}
/** Bounded known-service help. No live prices, customer lookup, discount or delivery promises. */
export function knownServiceHelp(message:string):string|null {
 const q=message.toLowerCase();
 if(/\b(order|track|delivery|refund)\b/.test(q))return 'Open Orders to view your order history or track a reference. Payment confirmation is separate from supplier delivery. Refunds remain unconfirmed until verified; contact support from Orders if you need help.';
 if(/\b(wallet|top.?up)\b/.test(q))return 'Mystery Wallet is available from your account. Open Wallet for its current funding options, limits and fees. Never share a payment PIN or password in chat.';
 if(/\b(website|reseller|template)\b/.test(q))return 'Open Website Builder to choose a template and edit a draft. Draft saving does not publish your site; use Publish when ready. Managed Data storefront checkout requires the store to be configured and enabled.';
 if(/\b(afa)\b/.test(q))return 'Open AFA Registration for the current eligibility, form and server-confirmed price. A verified payment is required before supplier submission; chat cannot submit or confirm a registration.';
 if(/\b(data|airtime|bundle|price|cost)\b/.test(q))return 'Open Data to see current network availability and checkout prices. Select a bundle and confirm the recipient and total before paying. Delivery follows the actual order status and is not guaranteed by chat.';
 if(/\b(support|contact|helpdesk)\b/.test(q))return 'Use the support links on Orders or Help & FAQs. Do not send passwords, payment PINs or private customer records in chat.';
 return null;
}
export async function bounded<T>(work:(signal:AbortSignal)=>Promise<T>,ms:number,parent?:AbortSignal):Promise<T> {
 const controller=new AbortController();const cancel=()=>controller.abort(parent?.reason||new DOMException('Cancelled','AbortError'));
 if(parent?.aborted)cancel();else parent?.addEventListener('abort',cancel,{once:true});
 let timer:ReturnType<typeof setTimeout>|undefined;let onAbort:()=>void=()=>{};
 try{return await Promise.race([Promise.resolve().then(()=>{controller.signal.throwIfAborted();return work(controller.signal);}),new Promise<never>((_,reject)=>{
 onAbort=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',onAbort,{once:true});
 if(controller.signal.aborted)onAbort();else timer=setTimeout(()=>controller.abort(new DOMException('Provider deadline','TimeoutError')),ms);
 })]);}finally{if(timer)clearTimeout(timer);parent?.removeEventListener('abort',cancel);controller.signal.removeEventListener('abort',onAbort);}
}
type Input={message:string;history:any[];activePage?:string};
export function createReliableMysteryAiRouter(validate:(body:any)=>Input,deps:{getClient?:typeof getGeminiClient;catalog?:typeof CommercialService.catalog;attemptTimeoutMs?:number;catalogTimeoutMs?:number}={}) {
 const router=Router();let active=0,cooldownUntil=0;const counts:Partial<Record<AiFailureCode,number>>={};
 const limiter=createRateLimiter({windowMs:60000,max:12,enforceInTests:true,key:req=>req.socket.remoteAddress||'unknown',message:'Mystery AI is receiving too many messages. Please wait a minute and try again.'});
 router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.get('/health',requireAdmin,(_req,res)=>res.json({configured:Boolean((deps.getClient||getGeminiClient)()),models:['gemini-3.1-flash-lite','gemini-3.8-flash'],activeRequests:active,cooldownSeconds:Math.max(0,Math.ceil((cooldownUntil-Date.now())/1000)),failureCounts:counts,scope:'process_since_start',providerAccessVerified:false}));
 router.post('/chat',limiter,async(req,res)=>{
 let input:Input;try{input=validate(req.body);}catch(e){res.status(400).json({error:(e as Error).message,code:'INVALID_REQUEST',retryable:false});return;}
 if(active>=4){res.set('Retry-After','2').status(429).json({error:'Mystery AI is busy. Please try again shortly.',code:'BUSY',retryable:true,retryAfterSeconds:2});return;}
 const started=Date.now(),request=new AbortController();const disconnect=()=>{if(!res.writableEnded)request.abort(new DOMException('Disconnected','AbortError'));};res.once('close',disconnect);
 const finish=(code:AiFailureCode)=>{
   if(request.signal.aborted||res.destroyed)return;
   const reply=knownServiceHelp(input.message);
   if(reply){res.json({reply,source:'guide',fallback:true,code,retryable:code!=='CONFIGURATION',latencyMs:Date.now()-started});return;}
   const quota=code==='QUOTA';if(quota)res.set('Retry-After','60');res.status(quota?429:503).json({error:AI_FAILURE,source:'unavailable',code,retryable:!['CONFIGURATION','SAFETY'].includes(code),...(quota?{retryAfterSeconds:60}:{})});
 };
 active++;
 try{
   const client=(deps.getClient||getGeminiClient)();if(!client){finish('CONFIGURATION');return;}
   if(Date.now()<cooldownUntil){finish('QUOTA');return;}
   const e=req.body.editorContext;
   const editor=e?.experienceMode==='website_editor'?{experienceMode:'website_editor',templateId:typeof e.templateId==='string'?e.templateId.slice(0,50):'',templateName:typeof e.templateName==='string'?e.templateName.slice(0,100):'',siteStatus:e.siteStatus==='published'?'published':'draft',activeEditorSection:typeof e.activeEditorSection==='string'?e.activeEditorSection.slice(0,50):'General',previewDevice:['desktop','tablet','mobile'].includes(e.previewDevice)?e.previewDevice:'mobile',hasUnsavedChanges:Boolean(e.hasUnsavedChanges)}:null;
   let products:Awaited<ReturnType<typeof CommercialService.catalog>>['products']=[];
   try{products=(await bounded(()=> (deps.catalog||CommercialService.catalog)(),deps.catalogTimeoutMs??1000,request.signal)).products;}catch{if(request.signal.aborted)return;}
   const instruction=buildMysteryAiSystemInstruction(editor,products);
   const contents=[...input.history.map(m=>({role:m.role==='user'?'user':'model',parts:[{text:m.content}]})),{role:'user',parts:[{text:`[Page: ${input.activePage||'home'}]\nCustomer Question: ${input.message}`}]}];
   const complex=input.message.trim().split(/\s+/).length>25||/rewrite|compose|draft a|compare|troubleshoot|explain why|critique|analy[sz]e|audit|marketing strategy|copywriting|professional tone/i.test(input.message);
   const models=complex?['gemini-3.8-flash','gemini-3.1-flash-lite']:['gemini-3.1-flash-lite','gemini-3.8-flash'];let failure:AiFailureCode='PROVIDER_UNAVAILABLE';
   for(const model of models){
     try{const ms=Math.min(deps.attemptTimeoutMs??(model==='gemini-3.8-flash'?4500:3000),9500-(Date.now()-started));if(ms<=0){failure='TIMEOUT';break;}
       const result=await bounded(signal=>client.models.generateContent({model,contents,config:{systemInstruction:instruction,temperature:.7,topP:.9,maxOutputTokens:1024,abortSignal:signal,httpOptions:{timeout:ms}}}),ms,request.signal);
       if(request.signal.aborted)return;
       if(result.promptFeedback?.blockReason){failure='SAFETY';break;}
       if(typeof result.text==='string'&&result.text.trim()){res.json({reply:result.text,source:'gemini',fallback:false,model,routingClass:complex?'complex':'simple',latencyMs:Date.now()-started});return;}failure='EMPTY_RESPONSE';
     }catch(error){failure=classifyAiError(error);if(request.signal.aborted)return;}
     counts[failure]=(counts[failure]||0)+1;
     // Allowlisted fields only. Never stringify upstream errors, bodies, history, user identity, credentials or URLs.
     console.warn(JSON.stringify({event:'mystery_ai_attempt',model,code:failure,elapsedMs:Date.now()-started}));
     if(failure==='QUOTA'){cooldownUntil=Date.now()+60000;break;}if(['CONFIGURATION','SAFETY'].includes(failure))break;
   }
   finish(failure);
 }catch{finish('PROVIDER_UNAVAILABLE');}finally{active--;res.removeListener('close',disconnect);}
 });return router;
}
