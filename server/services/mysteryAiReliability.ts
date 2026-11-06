import {mysteryHubGuide,mysteryInstantHelp,mysteryVerifiedHelp} from '../../shared/mysteryAiKnowledge.js';
import {getGeminiClient} from './geminiClient.js';
import {CommercialService} from './commercialService.js';
import {afaAvailabilityHelp,buildMysteryAiSystemInstruction,dataPriceHelp,referralPolicyHelp} from './mysteryAiContext.js';
import {getPublicReferralRules} from './publicReferralPolicy.js';
import {AfaService} from './afaService.js';
import {Router} from 'express';
import {ThinkingLevel} from '@google/genai';
import {requireAdmin} from '../middleware/authMiddleware.js';
import {createRateLimiter} from '../middleware/rateLimiter.js';

import {MYSTERY_AI_BUDGET,aiCanRetry,aiFailureMessage,boundAiHistory,type AiFailureCode} from '../../shared/mysteryAiPolicy.js';
import {aiPriorQuestion,aiText,aiTopic,isWritingRequest,type AiGuideContext,type AiTurn} from '../../shared/mysteryAiIntent.js';
export type {AiFailureCode} from '../../shared/mysteryAiPolicy.js';
export const AI_FAILURE=aiFailureMessage('PROVIDER_UNAVAILABLE');
/** Extract fixed codes only. Never expose the upstream message, metadata, URL or key. */
export function aiProviderDiagnostic(error:unknown) {
 const e=error as {status?:unknown;statusCode?:unknown;code?:unknown;message?:unknown;cause?:{code?:unknown}};
 let payload:any;
 if(typeof e?.message==='string'&&e.message.length<16384){try{payload=JSON.parse(e.message)?.error;}catch{}}
 const n=Number(e?.status??e?.statusCode??e?.code??payload?.code);
 const reasons=['API_KEY_INVALID','API_KEY_EXPIRED','API_KEY_SERVICE_BLOCKED','API_KEY_HTTP_REFERRER_BLOCKED','API_KEY_IP_ADDRESS_BLOCKED','BILLING_DISABLED','SERVICE_DISABLED','CONSUMER_INVALID'];
 const reason=Array.isArray(payload?.details)?payload.details.map((d:any)=>d?.reason).find((r:unknown)=>typeof r==='string'&&reasons.includes(r)):undefined;
 const network=e?.cause?.code;
 return {httpStatus:Number.isInteger(n)&&n>=100&&n<=599?n:null,reason:reason||null,networkCode:typeof network==='string'&&['ENOTFOUND','ECONNREFUSED','ETIMEDOUT','ECONNRESET','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(network)?network:null};
}
export function classifyAiError(error:unknown):AiFailureCode {
 const e=error as {name?:string};
 if(e?.name==='TimeoutError')return 'TIMEOUT';if(e?.name==='AbortError')return 'CANCELLED';
 const {httpStatus:status,reason}=aiProviderDiagnostic(error);if(status===429)return 'QUOTA';if(reason||[400,401,402,403].includes(status!))return 'CONFIGURATION';if(status===404)return 'MODEL_UNAVAILABLE';return 'PROVIDER_UNAVAILABLE';
}
/** Same public guide as the offline frontend; never represented as model generation. */
export const knownServiceHelp = (message:string,context:AiGuideContext={}) => mysteryHubGuide(message,context)?.reply ?? null;
/** Conservative boundary for the unverified delivery promises observed in live replies.
 * This is not a general fact-checker; unrelated website publishing stays unaffected.
 */
export function hasUnsupportedDeliveryClaim(reply:string):boolean {
 // Instant Bundles is a product name, not a promise of delivery speed.
 return reply.replace(/\binstant bundles?\b/gi,'bundles').split(/[.!?\n]/).some(sentence=>{
   if(!/\b(?:airtime|recharge|bundles?|delivery|delivered|fulfilment)\b/i.test(sentence))return false;
   for(const match of sentence.matchAll(/\b(?:instant(?:ly)?|immediate(?:ly)?|guaranteed)\b/gi)){
     const before=sentence.slice(Math.max(0,match.index!-40),match.index);
     if(!/\b(?:not|never|cannot|can't|no|without|isn't|aren't|don't|doesn't)(?:\W+\w+){0,3}\W*$/i.test(before))return true;
   }
   return false;
 });
}
/** Reject explicit claims of executing tools that this informational assistant does not have.
 * Narrow first-person completion claims only; this is not a general hallucination filter.
 */
export function hasUnsupportedActionClaim(reply:string):boolean {
 return /(?:^|[.!?]\s+|\n)\s*[*_]*(?:i (?:have |just |already )?|i['’]ve (?:just |already )?)(?:refunded|charged|deducted|submitted|published|unpublished|purchased|transferred|verified your payment|checked your (?:order|account|balance)|accessed your|contacted (?:support|the supplier))\b/i.test(reply);
}
export function hasUnsupportedBusinessClaim(reply:string):boolean {
 const q=aiText(reply);
 if(/\bsuccess[\s-]*biz[\s-]*hub\b/.test(q))return true;
 if(/(?:^|[.!?]\s+|\n)\s*[*_]*(?:yes,\s*)?(?:(?:your|that) (?:order|payment|refund|reward|voucher)|order MH-[A-Z0-9-]+) (?:(?:is|was|has been) (?:delivered|confirmed|complete[d]?|processed|credited|issued|successful|(?:still )?processing)|went through)\b/i.test(reply))return true;
 if(/(?:^|[.!?]\s+|\n)\s*[*_]*your (?:wallet |available )?balance is (?:GH₵\s*|GHS\s*)?\d/i.test(reply))return true;
 return /\bmystery hub\b/.test(q)&&/\b(?:giveaways?|customer of the week)\b/.test(q)&&
   /\b(?:every friday|never (?:offers?|runs?|had)|does not (?:offer|run)|doesn't (?:offer|run)|winner is|guaranteed|(?:win|prize of) \d)\b/.test(q);
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
type Input={message:string;history:AiTurn[];activePage?:string};
export function createReliableMysteryAiRouter(validate:(body:any)=>Input,deps:{getClient?:typeof getGeminiClient;catalog?:typeof CommercialService.catalog;referralRules?:typeof getPublicReferralRules;afaConfig?:typeof AfaService.publicConfig;attemptTimeoutMs?:number;catalogTimeoutMs?:number;totalTimeoutMs?:number}={}) {
 const router=Router();let active=0,cooldownUntil=0,cooldownCode:AiFailureCode='QUOTA',successfulGenerations=0;
 let lastSuccessAt:string|null=null,lastFailure:({code:AiFailureCode;at:string}&ReturnType<typeof aiProviderDiagnostic>)|null=null;
 const counts:Partial<Record<AiFailureCode,number>>={};
 const outcomes={generated:0,instantGuide:0,fallbackGuide:0,unavailable:0,cancelled:0};
 let completedRequests=0,totalLatencyMs=0,maxLatencyMs=0;
 const limiter=createRateLimiter({windowMs:60000,max:12,enforceInTests:true,key:req=>req.socket.remoteAddress||'unknown',message:'Mystery AI is receiving too many messages. Please wait a minute and try again.'});
 router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.get('/health',requireAdmin,(_req,res)=>res.json({configured:Boolean((deps.getClient||getGeminiClient)()),models:['gemini-3.1-flash-lite','gemini-3.8-flash'],activeRequests:active,cooldownSeconds:Math.max(0,Math.ceil((cooldownUntil-Date.now())/1000)),failureCounts:counts,scope:'process_since_start',providerAccessVerified:successfulGenerations>0,successfulGenerations,lastSuccessAt,lastFailure,requestOutcomes:outcomes,latency:{completedRequests,meanMs:completedRequests?Math.round(totalLatencyMs/completedRequests):null,maxMs:completedRequests?maxLatencyMs:null}}));
 router.post('/chat',limiter,async(req,res)=>{
 let input:Input;try{input=validate(req.body);}catch(e){res.status(400).json({error:(e as Error).message,code:'INVALID_REQUEST',retryable:false});return;}
 if(active>=4){res.set('Retry-After','2').status(429).json({error:'Mystery AI is busy. Please try again shortly.',code:'BUSY',retryable:true,retryAfterSeconds:2});return;}
 const started=Date.now(),request=new AbortController();
 const history=boundAiHistory(input.history);
 const page=input.activePage&&/^(?:home|data|website|editor|creative|business|marketplace|services|help|about|orders|wallet|earn|afa|app)$/.test(input.activePage)?input.activePage:'home';
 const context:AiGuideContext={activePage:page,history};const disconnect=()=>{if(!res.writableEnded)request.abort(new DOMException('Disconnected','AbortError'));};res.once('close',disconnect);
 const finish=(code:AiFailureCode)=>{
   if(request.signal.aborted||res.destroyed)return;
   const reply=knownServiceHelp(input.message,context);
   if(reply){outcomes.fallbackGuide++;res.json({reply,source:'guide',fallback:true,code,retryable:aiCanRetry(code),latencyMs:Date.now()-started});return;}
   outcomes.unavailable++;const quota=code==='QUOTA';if(quota)res.set('Retry-After','60');res.status(quota?429:503).json({error:aiFailureMessage(code),source:'unavailable',code,retryable:aiCanRetry(code),...(quota?{retryAfterSeconds:60}:{})});
 };
 active++;
 try{
   const e=req.body.editorContext;
   const editor=e?.experienceMode==='website_editor'?{experienceMode:'website_editor',templateId:typeof e.templateId==='string'?e.templateId.slice(0,50):'',templateName:typeof e.templateName==='string'?e.templateName.slice(0,100):'',siteStatus:e.siteStatus==='published'?'published':'draft',activeEditorSection:typeof e.activeEditorSection==='string'?e.activeEditorSection.slice(0,50):'General',previewDevice:['desktop','tablet','mobile'].includes(e.previewDevice)?e.previewDevice:'mobile',hasUnsavedChanges:Boolean(e.hasUnsavedChanges)}:null;
   context.editorContext=editor;
   const guide=(reply:string)=>{
     if(request.signal.aborted||res.destroyed)return;
     outcomes.instantGuide++;
     res.json({reply,source:'guide',fallback:false,latencyMs:Date.now()-started});
   };
   const instant=mysteryInstantHelp(input.message,context)||mysteryVerifiedHelp(input.message,context);
   if(instant){guide(instant.reply);return;}
   const topic=aiTopic(input.message,context),q=aiText(input.message);
   const readPublic=async<T>(read:()=>Promise<T>)=>{
     try{return await bounded(read,deps.catalogTimeoutMs??MYSTERY_AI_BUDGET.catalogMs,request.signal);}
     catch{return undefined;}
   };
   if(topic==='earn'&&!isWritingRequest(input.message)){
     const showRates=/\b(?:how much|rates?|percent(?:age)?|first purchase|repeat purchase)\b/.test(q);
     const policy=showRates?(await readPublic(()=> (deps.referralRules||getPublicReferralRules)()))?.dataPolicy:undefined;
     guide(referralPolicyHelp(policy,showRates));return;
   }
   if(topic==='afa'&&!isWritingRequest(input.message)){
     if(/\b(?:available|availability|register|sign up|buy|open|how much|price|cost|fees?)\b/.test(q)){
       const config=await readPublic(()=>deps.afaConfig?deps.afaConfig():AfaService.publicConfig());
       guide(afaAvailabilityHelp(config));return;
     }
     guide(knownServiceHelp('AFA registration')!);return;
   }
   const asksPrice=(text:string)=>/\b(?:how much|prices?|cost|rates?)\b/.test(text);
   const prior=aiPriorQuestion(context);
   const networkFollowUp=/^what about (telecel|mtn|airteltigo|at)$/.exec(q);
   const priceFollowUp=networkFollowUp&&asksPrice(aiText(prior));
   const question=priceFollowUp?prior.replace(/\b(?:mtn|telecel|airteltigo|at)\b/gi,networkFollowUp[1]==='at'?'AirtelTigo':networkFollowUp[1]):q==='how much'?prior:input.message;
   if(topic==='data'&&(asksPrice(q)||priceFollowUp)&&!isWritingRequest(input.message)){
     if(/\binstant bundles?\b/.test(aiText(question))){
       guide('I can’t verify an Instant Bundles price here. Open Instant Bundles to see current offers and their checkout prices.');return;
     }
     const catalog=await readPublic(()=> (deps.catalog||CommercialService.catalog)());
     guide(dataPriceHelp(question,catalog?.products));return;
   }
   const client=(deps.getClient||getGeminiClient)();if(!client){finish('CONFIGURATION');return;}
   if(Date.now()<cooldownUntil){finish(cooldownCode);return;}
   const instruction=buildMysteryAiSystemInstruction(editor);
   const contents=[...history.map(m=>({role:m.role==='user'?'user':'model',parts:[{text:m.content}]})),{role:'user',parts:[{text:`[Page: ${page}]\nCustomer Question: ${input.message}`}]}];
   const complex=input.message.trim().split(/\s+/).length>25||/rewrite|compose|draft a|compare|troubleshoot|explain why|critique|analy[sz]e|audit|marketing strategy|copywriting|professional tone/i.test(input.message);
   const models=complex?['gemini-3.8-flash','gemini-3.1-flash-lite']:['gemini-3.1-flash-lite','gemini-3.8-flash'];let failure:AiFailureCode='PROVIDER_UNAVAILABLE';
   for(const model of models){
     let diagnostic:ReturnType<typeof aiProviderDiagnostic>={httpStatus:null,reason:null,networkCode:null};
     // Full-context production probes completed in 2.3–7.6s. Give the selected model
     // a useful share of the EXISTING overall budget instead of cancelling at 3s.
     try{const ms=Math.min(deps.attemptTimeoutMs??MYSTERY_AI_BUDGET.attemptMs,(deps.totalTimeoutMs??MYSTERY_AI_BUDGET.totalMs)-(Date.now()-started));if(ms<=0){failure='TIMEOUT';break;}
       // SDK HttpOptions.timeout injects X-Server-Timeout, rejected with HTTP400 in this deployment.
       // Keep the same hard deadline via bounded() + transport abortSignal, without that server hint.
       const result=await bounded(signal=>client.models.generateContent({model,contents,config:{systemInstruction:instruction,temperature:.7,topP:.9,maxOutputTokens:512,thinkingConfig:{thinkingLevel:model==='gemini-3.1-flash-lite'?ThinkingLevel.MINIMAL:ThinkingLevel.LOW},abortSignal:signal,httpOptions:{retryOptions:{attempts:1}}}}),ms,request.signal);
       if(request.signal.aborted)return;
       if(result.promptFeedback?.blockReason||result.candidates?.some(c=>['SAFETY','BLOCKLIST','PROHIBITED_CONTENT','SPII'].includes(c.finishReason||''))||typeof result.text==='string'&&(result.text.length>4000||hasUnsupportedDeliveryClaim(result.text)||hasUnsupportedActionClaim(result.text)||hasUnsupportedBusinessClaim(result.text))){failure='SAFETY';}else
       if(typeof result.text==='string'&&result.text.trim()){outcomes.generated++;successfulGenerations++;lastSuccessAt=new Date().toISOString();res.json({reply:result.text,source:'gemini',fallback:false,model,routingClass:complex?'complex':'simple',latencyMs:Date.now()-started});return;}if(failure!=='SAFETY')failure='EMPTY_RESPONSE';
     }catch(error){failure=classifyAiError(error);if(request.signal.aborted)return;diagnostic=aiProviderDiagnostic(error);}
     lastFailure={code:failure,at:new Date().toISOString(),...diagnostic};
     counts[failure]=(counts[failure]||0)+1;
     // Allowlisted fields only. Never stringify upstream errors, bodies, history, user identity, credentials or URLs.
     console.warn(JSON.stringify({event:'mystery_ai_attempt',model,code:failure,...diagnostic,elapsedMs:Date.now()-started}));
     if(['QUOTA','CONFIGURATION'].includes(failure)){cooldownCode=failure;cooldownUntil=Date.now()+60000;break;}if(['SAFETY','CANCELLED'].includes(failure))break;
   }
   finish(failure);
 }catch{finish('PROVIDER_UNAVAILABLE');}finally{active--;if(request.signal.aborted)outcomes.cancelled++;else{const latency=Date.now()-started;completedRequests++;totalLatencyMs+=latency;maxLatencyMs=Math.max(maxLatencyMs,latency);}res.removeListener('close',disconnect);}
 });return router;
}
