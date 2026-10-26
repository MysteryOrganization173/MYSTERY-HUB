/** Reviewed backend HTTP integration. Pending clients remain injectable offline fallbacks only; production uses the live adapters below. */
export type AiDraftAction = 'improve' | 'shorter' | 'professional' | 'friendly' | 'alternatives' | 'grammar';

export const AI_DRAFT_ACTIONS: Array<{ id: AiDraftAction; label: string }> = [
  { id: 'improve', label: 'Improve wording' },
  { id: 'shorter', label: 'Make shorter' },
  { id: 'professional', label: 'Professional tone' },
  { id: 'friendly', label: 'Friendly tone' },
  { id: 'grammar', label: 'Correct grammar' },
  { id: 'alternatives', label: 'Suggest alternatives' },
];

export interface AiDraftProposal { title: string; body: string }
export type AiDraftResult = { ok: true; proposals: AiDraftProposal[] } | { ok: false; message: string };

export interface AdminAiDraftingClient {
  readonly available: boolean;
  propose(token: string, input: { templateId?:string|null; action: AiDraftAction; title: string; body: string; placeholders: string[] }, signal?: AbortSignal): Promise<AiDraftResult>;
}

export const AI_DRAFTING_UNAVAILABLE = 'AI wording help is not connected yet. Your message and preview work normally without it.';

export const pendingAiDraftingClient: AdminAiDraftingClient = {
  available: false,
  propose: () => Promise.resolve({ ok: false, message: AI_DRAFTING_UNAVAILABLE }),
};

import {notificationHttp} from './notificationHttp';
export const httpAiDraftingClient:AdminAiDraftingClient={available:true,async propose(token,input,signal){
 try{if(!input.templateId||!['payment_confirmed','order_processing','order_delivered','delivery_attention','refund_update','maintenance','new_service','special_offer'].includes(input.templateId))throw Error('Choose a built-in template for safe AI wording help. Custom or edited text is never sent to Gemini.');
 const modes={improve:'clarify',shorter:'shorten',professional:'professional',friendly:'friendly',alternatives:'titles',grammar:'grammar'};
 const r=await notificationHttp(token,'admin/notifications/draft','POST',{templateId:input.templateId,mode:modes[input.action]},signal);
 if(r.sent!==false||r.requiresReview!==true||!r.draft)throw Error('Invalid drafting response. No message was sent.');return {ok:true,proposals:[r.draft]};
 }catch(e){if(signal?.aborted)throw e;return {ok:false,message:(e as Error).message};}
}};
