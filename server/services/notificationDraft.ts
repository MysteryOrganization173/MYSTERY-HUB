import {getGeminiClient} from './geminiClient.js';
import {NotificationService,exact} from './notificationService.js';
import {validateTemplate} from './notificationSafety.js';
import {FinanceError} from '../db/financeStore.js';
const modes=['shorten','clarify','grammar','professional','friendly','titles','variation'];
// Only server-approved generic text enters Gemini, never edited/custom templates or account data.
const approved:Record<string,{title:string;body:string;locked:boolean;category:'transactional'|'marketing'}>={
 payment_confirmed:{title:'Payment confirmed',body:'Your payment is verified. Open Orders to follow delivery.',locked:true,category:'transactional'},
 order_processing:{title:'Order processing',body:'Your supplier has accepted this order. Open Orders for the current status.',locked:true,category:'transactional'},
 order_delivered:{title:'Order delivered',body:'Delivery is confirmed for your order. Open Orders for details.',locked:true,category:'transactional'},
 delivery_attention:{title:'Order needs a check',body:'Open Orders for an update and support options. This does not mean delivery has failed.',locked:true,category:'transactional'},
 refund_update:{title:'Refund status update',body:'A verified refund-state update is available. Provider processing does not guarantee funds are visible yet. Open Orders.',locked:true,category:'transactional'},
 maintenance:{title:'Service update',body:'Open {{appName}} for the current service notice.',locked:false,category:'marketing'},
 new_service:{title:'Discover services',body:'Explore the services currently available in {{appName}}.',locked:false,category:'marketing'},
 special_offer:{title:'Current offers',body:'View current offers in {{appName}}. Terms and eligibility apply.',locked:false,category:'marketing'}
};
/** Template-only drafting. No account/order reads, recipient selection, persistence or send operation. */
export async function draftNotification(input:any,getClient=getGeminiClient){
 exact(input,['mode','templateId']);if(!modes.includes(input.mode)||typeof input.templateId!=='string'||input.templateId.length>64)throw new FinanceError('Choose a supported drafting mode and template.');
 const template=approved[input.templateId];if(!template)throw new FinanceError('AI drafting supports only the built-in generic templates. Custom text is never sent to Gemini.');
 await NotificationService.preview(input.templateId);const client=getClient();if(!client)throw new FinanceError('AI drafting is unavailable. Ordinary notifications remain independent.',503);
 const signal=AbortSignal.timeout(5000);let timer:ReturnType<typeof setTimeout>|undefined;
 try{const response=await Promise.race([client.models.generateContent({model:'gemini-3.1-flash-lite',contents:[{role:'user',parts:[{text:JSON.stringify({mode:input.mode,title:template.title,body:template.body})}]}],config:{systemInstruction:'Rewrite only the supplied approved notification in the requested style. Return JSON with title and body only. Preserve every placeholder. Do not add facts, discounts, amounts, delivery or refund claims, links, recipients or actions. Output is an unapproved draft, never a send instruction.',responseMimeType:'application/json',maxOutputTokens:250,abortSignal:signal,httpOptions:{timeout:5000,retryOptions:{attempts:1}}}}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('deadline')),5100);})]);
 const draft=JSON.parse(response.text||'');exact(draft,['title','body']);validateTemplate({...draft,category:template.category,enabled:true},Boolean(template.locked));
 const variables=(text:string)=>[...text.matchAll(/\{\{\w+\}\}/g)].map(x=>x[0]).sort().join('|');if(variables(template.title+template.body)!==variables(draft.title+draft.body))throw Error('Placeholders changed');
 if(/\d|[%₵$]|https?:|@|discount|promo.?code|guarantee|instant|password|token|secret|bearer/i.test((draft.title+' '+draft.body).replace(/does not guarantee|not guaranteed/gi,'')))throw Error('Unsupported draft');
 return {success:true,draft,source:'gemini',basedOn:'server-approved generic template',requiresReview:true,sent:false};
 }catch{throw new FinanceError('Could not produce a safe draft. Edit the approved template manually.',503);}finally{if(timer)clearTimeout(timer);}
}
