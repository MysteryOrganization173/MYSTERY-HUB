import {GREETING_TEMPLATES,GREETING_VARIANTS,type GreetingInput} from '../../shared/mysteryExperiences.js';
export class ExperienceError extends Error {constructor(public code:string,public status=400){super(code);}}
export const SHARE_ID=/^[A-Za-z0-9_-]{24}$/;
export const CREATOR_TOKEN=/^[A-Za-z0-9_-]{43}$/;
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function objectInput(input:unknown,keys:readonly string[]):Record<string,any> {
 if(!input||typeof input!=='object'||Array.isArray(input)||JSON.stringify(input).length>5000||Object.keys(input).some(k=>!keys.includes(k)))throw new ExperienceError('INVALID_INPUT');return input as Record<string,any>;
}
export function personalText(value:unknown,max:number,min=1):string {
 if(typeof value!=='string')throw new ExperienceError('INVALID_TEXT');
 const text=value.normalize('NFC').trim();
 if(Array.from(text).length<min||Array.from(text).length>max||/[\p{C}<>]/u.test(text.replace(/\n/g,''))||/(?:https?:|www\.|javascript:|data:|mailto:)/i.test(text)||!/[\p{L}\p{N}]/u.test(text))throw new ExperienceError('INVALID_TEXT');return text;
}
export function greetingInput(input:unknown):{value:GreetingInput;creatorToken:string;idempotencyKey:string} {
 const v=objectInput(input,['occasion','recipientName','senderName','showSender','templateId','message','variant','parentShareId','creatorToken','idempotencyKey']);
 if(!['christmas-2026','new-year-2027'].includes(v.occasion)||!GREETING_VARIANTS.includes(v.variant)||typeof v.showSender!=='boolean'||typeof v.creatorToken!=='string'||!CREATOR_TOKEN.test(v.creatorToken)||typeof v.idempotencyKey!=='string'||!UUID.test(v.idempotencyKey))throw new ExperienceError('INVALID_INPUT');
 const template=v.templateId===undefined?null:GREETING_TEMPLATES.find(t=>t.id===v.templateId&&t.occasion===v.occasion);
 if(v.templateId!==undefined&&!template||template&&v.message!==undefined)throw new ExperienceError('INVALID_TEMPLATE');
 if(v.parentShareId!==undefined&&(typeof v.parentShareId!=='string'||!SHARE_ID.test(v.parentShareId)))throw new ExperienceError('INVALID_PARENT');
 return {creatorToken:v.creatorToken,idempotencyKey:v.idempotencyKey,value:{occasion:v.occasion,recipientName:personalText(v.recipientName,60),senderName:v.showSender&&v.senderName?personalText(v.senderName,60):null,showSender:v.showSender,templateId:template?.id||null,message:template?.message||personalText(v.message,600,4),variant:v.variant,parentShareId:v.parentShareId||null}};
}
