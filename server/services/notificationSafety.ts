import {createCipheriv,createDecipheriv,randomBytes,createHash,createECDH,ECDH} from 'node:crypto';
import type {NotificationTemplate,SubscriptionInput} from '../../shared/notifications.js';
import {FinanceError} from '../db/financeStore.js';
const safe=(value:unknown,min:number,max:number)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max&&!/[<>\x00-\x1f]/.test(value);
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function pushConfiguration(){
 const key=process.env.WEB_PUSH_STORAGE_KEY||'',publicKey=process.env.WEB_PUSH_VAPID_PUBLIC_KEY||'',privateKey=process.env.WEB_PUSH_VAPID_PRIVATE_KEY||'',subject=process.env.WEB_PUSH_VAPID_SUBJECT||'';
 let valid=false;try{const e=createECDH('prime256v1');e.setPrivateKey(Buffer.from(privateKey,'base64url'));valid=Buffer.from(key,'base64').length===32&&e.getPublicKey().toString('base64url')===publicKey&&/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s]+)$/.test(subject);}catch{}
 return {enabled:process.env.WEB_PUSH_ENABLED==='true'&&valid,valid,publicKey:valid?publicKey:null,privateKey,subject};
}
function storageKey(){const key=Buffer.from(process.env.WEB_PUSH_STORAGE_KEY||'','base64');if(key.length!==32)throw new FinanceError('Notification encryption is not configured.',503);return key;}
export function encryptSubscription(subscription:SubscriptionInput){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',storageKey(),iv);cipher.setAAD(Buffer.from('mysteryhub-push-v1'));const data=Buffer.concat([cipher.update(JSON.stringify(subscription),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');}
export function decryptSubscription(value:string):SubscriptionInput{const data=Buffer.from(value,'base64');const cipher=createDecipheriv('aes-256-gcm',storageKey(),data.subarray(0,12));cipher.setAAD(Buffer.from('mysteryhub-push-v1'));cipher.setAuthTag(data.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8'));}
export function validateSubscription(value:any):SubscriptionInput {
 if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['endpoint','expirationTime','keys'].includes(k))||typeof value.endpoint!=='string'||value.endpoint.length>2048)throw new FinanceError('Invalid push subscription.');
 let url:URL;try{url=new URL(value.endpoint);}catch{throw new FinanceError('Invalid push endpoint.');}
 const host=url.hostname;const allowed=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(host)||/^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
 if(!allowed||url.protocol!=='https:'||url.port&&url.port!=='443'||url.username||url.password||url.hash)throw new FinanceError('Unsupported push provider endpoint.');
 const bytes=(x:unknown,n:number)=>typeof x==='string'&&/^[a-zA-Z0-9_-]+$/.test(x)&&Buffer.from(x,'base64url').length===n&&Buffer.from(x,'base64url').toString('base64url')===x;
 if(!value.keys||Object.keys(value.keys).some(k=>!['p256dh','auth'].includes(k))||!bytes(value.keys.p256dh,65)||!bytes(value.keys.auth,16)||Buffer.from(value.keys.p256dh,'base64url')[0]!==4)throw new FinanceError('Invalid push encryption keys.');
 try{ECDH.convertKey(Buffer.from(value.keys.p256dh,'base64url'),'prime256v1',undefined,undefined,'uncompressed');}catch{throw new FinanceError('Invalid push public key.');}
 if(value.expirationTime!=null&&(!Number.isFinite(value.expirationTime)||value.expirationTime<=Date.now()))throw new FinanceError('Push subscription has expired.');
 return {endpoint:url.href,keys:{p256dh:value.keys.p256dh,auth:value.keys.auth},expirationTime:value.expirationTime??null};
}
export function validateTemplate(body:any,locked=false):Pick<NotificationTemplate,'title'|'body'|'category'|'enabled'> {
 if(!body||!safe(body.title,3,80)||!safe(body.body,5,240)||!['transactional','marketing'].includes(body.category)||typeof body.enabled!=='boolean')throw new FinanceError('Use a title (3–80), body (5–240), category and enabled flag.');
 if(!locked&&body.category!=='marketing')throw new FinanceError('Custom templates are marketing only. Automatic transactional templates are server-owned.');
 const text=(body.title+' '+body.body).normalize('NFKC');const stripped=text.replace(/\{\{(appName|eventLabel)\}\}/g,'');
 if(/[{}]/.test(stripped)||!locked&&/https?:|@|\d|[%₵$]|discount|promo.?code|guarantee|instant|certif|password|token|secret|bearer|\bpaid\b|payment confirmed|payment verified|\bdelivered\b|refund (processed|complete)|order processing|registration complete/i.test(stripped))throw new FinanceError('Unsupported placeholder, private data or unverified promotional claim.');
 return {title:body.title.trim(),body:body.body.trim(),category:body.category,enabled:body.enabled};
}
export function renderTemplate(template:Pick<NotificationTemplate,'title'|'body'>,eventLabel='Account update'){
 const values:Record<string,string>={appName:'Mystery Hub',eventLabel};const resolve=(text:string)=>text.replace(/\{\{(\w+)\}\}/g,(_all,key)=>{if(!(key in values))throw new FinanceError('Unresolved template placeholder.');return values[key];});
 const result={title:resolve(template.title),body:resolve(template.body)};if(/[{}]/.test(result.title+result.body))throw new FinanceError('Unresolved template placeholder.');return result;
}
