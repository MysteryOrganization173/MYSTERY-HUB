/** Public, bounded chat contract. No credentials or account authority. */
import type { AiTurn } from './mysteryAiIntent.js';
export const MYSTERY_AI_BUDGET={clientMs:12000,totalMs:9500,attemptMs:8000,catalogMs:1000} as const;
export function boundAiHistory(history: readonly AiTurn[]): AiTurn[] {
 const recent: AiTurn[] = [];
 let remaining = 12_000;
 for(const turn of history.slice(-8).reverse()){
   if(turn.content.length>remaining)break;
   remaining-=turn.content.length;
   recent.push({role:turn.role,content:turn.content});
 }
 return recent.reverse();
}
export type AiFailureCode='TIMEOUT'|'CANCELLED'|'QUOTA'|'CONFIGURATION'|'MODEL_UNAVAILABLE'|'PROVIDER_UNAVAILABLE'|'EMPTY_RESPONSE'|'SAFETY';
export function aiCanRetry(code:string){return !['CONFIGURATION','SAFETY','CANCELLED','MODEL_UNAVAILABLE','INVALID_REQUEST'].includes(code);}
export function aiFailureMessage(code:string){
 switch(code){
  case 'TIMEOUT':return 'Mystery AI took too long to answer. You can try again later or keep using Mystery Hub’s services.';
  case 'QUOTA':return 'AI answers have reached a temporary usage limit. Please wait before trying again; Mystery Hub’s other services remain available.';
  case 'CONFIGURATION':case 'MODEL_UNAVAILABLE':return 'AI answers are currently unavailable. You can still use Mystery Hub’s services and help guides.';
  case 'EMPTY_RESPONSE':return 'Mystery AI returned no answer this time. You can try again later or rephrase your question.';
  case 'SAFETY':return 'I could not provide a supported answer to that request. Try asking for guidance on a specific feature.';
  case 'CANCELLED':return 'This reply was cancelled. You can send a new question when ready.';
  default:return 'Mystery AI is temporarily unavailable. You can try again later or keep using Mystery Hub’s services.';
 }
}
