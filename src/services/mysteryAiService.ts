import { ActivePage, SafeEditorAiContext } from '../types';
import { API_BASE_URL } from './apiClient';
import {mysteryHubGuide,mysteryBuilderHelp,mysteryInstantHelp} from '../../shared/mysteryAiKnowledge';
import {aiActions,type AiGuideContext,type AiNavigation} from '../../shared/mysteryAiIntent';
import {MYSTERY_AI_BUDGET,aiCanRetry,aiFailureMessage,boundAiHistory} from '../../shared/mysteryAiPolicy';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: 'scripted' | 'gemini';
  actions?: AiNavigation[];
  quickAction?: AiNavigation;
}

export interface SuggestedQuestion {
  id: string;
  text: string;
  category?: string;
}

/** Stable editor tasks use the same verified guidance as the backend. */
export function resolveInstantBuilderHelp(query:string,editorContext?:SafeEditorAiContext|null) {
  const help=mysteryBuilderHelp(query,{editorContext});
  return help?{reply:help.reply}:null;
}

/**
 * Returns strictly page-aware suggested question chips based on the active page
 */
export function getSuggestedQuestionsForPage(page: ActivePage, options: { signedIn?: boolean } = {}): SuggestedQuestion[] {
  // Signed-in Home opens the chat from the member card: lead with what members come back for.
  if (page === 'home' && options.signedIn) {
    return [
      { id: 'member-track', text: 'How do I track my order?' },
      { id: 'member-delayed', text: 'What should I do if my bundle is delayed?' },
      { id: 'member-wallet', text: 'How do I add money to my Wallet?' },
      { id: 'member-web', text: 'Can I create a free website?' },
    ];
  }
  switch (page) {
    case 'data':
      return [
        { id: 'data-buy', text: 'How do I buy data on MTN, AirtelTigo or Telecel?' },
        { id: 'data-speed', text: 'How long does delivery take?' },
        { id: 'data-pricing', text: 'What are the current bundle rates?' },
        { id: 'data-momo', text: 'Can I pay with Mobile Money (MoMo)?' },
      ];
    case 'website':
      return [
        { id: 'web-free', text: 'Can I create a website for free?' },
        { id: 'web-templates', text: 'Which business templates are available?' },
        { id: 'web-momo', text: 'Do websites support Ghana MoMo & WhatsApp?' },
        { id: 'web-nocode', text: 'Do I need any coding skills to build one?' },
      ];
    case 'services':
      return [
        { id: 'srv-soon', text: 'Which utilities are launching next?' },
        { id: 'srv-ecg', text: 'Will I be able to buy ECG power tokens?' },
        { id: 'srv-waec', text: 'Can I buy WAEC results checker PINs?' },
        { id: 'srv-waitlist', text: 'How do I get notified at launch?' },
      ];
    case 'orders':
      return [
        { id: 'ord-track', text: 'How do I track my active order?' },
        { id: 'ord-delayed', text: 'What should I do if my bundle is delayed?' },
        { id: 'ord-support', text: 'How do I connect with WhatsApp support?' },
      ];
    case 'about':
      return [
        { id: 'abt-mission', text: 'What is Mystery Hub’s mission in Ghana?' },
        { id: 'abt-who', text: 'Who is Mystery Hub built for?' },
        { id: 'abt-location', text: 'Where is the Mystery Hub team based?' },
      ];
    case 'home':
    default:
      return [
        { id: 'home-who', text: 'Who are you and what is Mystery Hub?' },
        { id: 'home-buy', text: 'How do I buy data in Ghana?' },
        { id: 'home-web', text: 'Can I create a website for free?' },
        { id: 'home-services', text: 'What services are coming soon?' },
      ];
  }
}

/** Public error metadata, including the server's bounded manual-retry cooldown. */
export type MysteryAiFailureKind = 'busy' | 'limits' | 'timeout' | 'offline' | 'unavailable';
export const MYSTERY_AI_TIMEOUT_MESSAGE = aiFailureMessage('TIMEOUT');
export const MYSTERY_AI_OFFLINE_MESSAGE = 'You seem to be offline. Reconnect to the internet, then try again.';
export class MysteryAiError extends Error {
  constructor(message:string,readonly kind:MysteryAiFailureKind,readonly retryable=kind!=='limits',readonly retryAfterSeconds=0,readonly code?:string){super(message);}
}
const isOffline=()=>typeof navigator!=='undefined'&&navigator.onLine===false;

/** One request, one body deadline, no automatic client retries or model calls. */
export async function sendMysteryAiMessage(
 userMessage:string,activePage:ActivePage,history:ChatMessage[],editorContext?:SafeEditorAiContext|null,
 signal?:AbortSignal,timeoutMs:number=MYSTERY_AI_BUDGET.clientMs
):Promise<{reply:string;actions?:AiNavigation[];quickAction?:AiNavigation;source:'scripted'|'gemini'}>{
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 const turns=boundAiHistory(history.filter(m=>!m.id.startsWith('welcome-')));
 const context:AiGuideContext={activePage,history:turns,editorContext};
 const actions=aiActions(userMessage,context);
 const result=(reply:string,source:'scripted'|'gemini')=>({reply,source,actions,quickAction:actions[0]});
 if(actions.length===2)return result('Choose Data Bundles or Airtime to see the current options and checkout details.','scripted');
 const instant=mysteryInstantHelp(userMessage,context);if(instant)return result(instant.reply,'scripted');
 const controller=new AbortController();let timedOut=false;
 const cancel=()=>controller.abort(new DOMException('Cancelled','AbortError'));
 signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort(new DOMException('Chat deadline','TimeoutError'));},timeoutMs);
 let onAbort=()=>{};
 try{
   // Race the complete fetch/body operation even if a transport ignores cancellation.
   const work=async()=>{
     const res=await fetch(`${API_BASE_URL}/api/mystery-ai/chat`,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
       body:JSON.stringify({message:userMessage,activePage,history:turns,editorContext:editorContext||undefined})});
     const data=await res.json().catch(()=>({}));
     if(res.status===429){
       const seconds=Math.ceil(Math.min(300,Math.max(1,Number(res.headers.get('Retry-After')||data.retryAfterSeconds)||60)));
       throw new MysteryAiError(data.code==='QUOTA'?`AI answers have reached a temporary usage limit. Please wait ${seconds} seconds before trying again.`:`Mystery AI is busy. Please wait ${seconds} seconds before trying again.`,'busy',data.retryable!==false,seconds,data.code==='QUOTA'?'QUOTA':'BUSY');
     }
     if(res.status===400)throw new MysteryAiError('The message or conversation exceeds chat limits. Shorten your message or reset the conversation and try again.','limits',false,0,'INVALID_REQUEST');
     if(res.ok&&typeof data.reply==='string'&&data.reply.trim()&&(data.source==='guide'||data.source==='gemini'&&!data.fallback))return result(data.reply,data.source==='guide'?'scripted':'gemini');
     const code=['TIMEOUT','CANCELLED','QUOTA','CONFIGURATION','MODEL_UNAVAILABLE','PROVIDER_UNAVAILABLE','EMPTY_RESPONSE','SAFETY'].includes(data.code)?data.code:'PROVIDER_UNAVAILABLE';
     throw new MysteryAiError(aiFailureMessage(code),code==='TIMEOUT'?'timeout':'unavailable',aiCanRetry(code)&&data.retryable!==false,0,code);
   };
   return await Promise.race([work(),new Promise<never>((_,reject)=>{
     onAbort=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',onAbort,{once:true});
     if(controller.signal.aborted)onAbort();
   })]);
 }catch(error){
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   // Server limits and cancellation/safety remain explicit; known outage help may still work.
   if(error instanceof MysteryAiError&&(['busy','limits'].includes(error.kind)||['CANCELLED','SAFETY'].includes(error.code||'')))throw error;
   const help=getGroundedLocalResponse(userMessage,activePage,editorContext,turns);if(help)return {...help,source:'scripted'};
   if(error instanceof MysteryAiError)throw error;
   if(isOffline())throw new MysteryAiError(MYSTERY_AI_OFFLINE_MESSAGE,'offline');
   if(timedOut)throw new MysteryAiError(MYSTERY_AI_TIMEOUT_MESSAGE,'timeout',true,0,'TIMEOUT');
   throw new MysteryAiError(aiFailureMessage('PROVIDER_UNAVAILABLE'),'unavailable');
 }finally{
   clearTimeout(timer);signal?.removeEventListener('abort',cancel);controller.signal.removeEventListener('abort',onAbort);
 }
}

/** A guide never invents an action from the text it returns. */
export function getGroundedLocalResponse(query:string,activePage:ActivePage,editorContext?:SafeEditorAiContext|null,history:AiGuideContext['history']=[]) {
 const context:AiGuideContext={activePage,editorContext,history};
 const actions=aiActions(query,context);
 const help=mysteryHubGuide(query,context);
 return help||actions.length?{reply:help?.reply||'Use the button below to continue.',actions,quickAction:actions[0]}:null;
}
