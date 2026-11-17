import {buyingPatterns} from './buyingPatterns.js';
import {SMS_BUYING_GROUPS} from '../../shared/smsStudio.js';
import {studioTemplates} from './studio.js';
import {SMS_STUDIO_TEMPLATES,smsChannelMention} from '../../shared/smsStudio.js';
import type {PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {FinanceError} from '../db/financeStore.js';
import {ContactHubStore,DIRECT_CONTACT_SQL} from '../db/contactHubStore.js';
import {contactFilters} from '../services/contactHubPolicy.js';
import {canonicalGhanaPhone} from '../utils/phone.js';
import {SMS_PRESETS,type SmsPurpose} from '../../shared/smsCommunications.js';
import {smsEstimate} from '../../src/utils/manualSms.js';
import {processingEvidence,deliveredEvidence,attentionEvidence,transactionalMessage} from './transactional.js';
import {permissionEvidence} from './permissions.js';
import {arkeselConfig,canonicalCallback} from './arkesel.js';
export const digest=(v:unknown)=>createHash('sha256').update(canonicalCallback(v)).digest('hex');
export const strict=(v:any,keys:string[])=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw new FinanceError('Unexpected SMS field.');};
export function safeMessage(v:unknown){if(typeof v!=='string'||!v.trim()||v.length>1600||/[\x00-\x08\x0b\x0c\x0e-\x1f]|sk_(live|test)_|api.key\s*[:=]|Bearer\s|password\s*[:=]/i.test(v))throw new FinanceError('Enter a safe SMS message of up to1600 characters.');return v.trim();}
export function renderSms(body:string,values:Record<string,string>){const result=body.replace(/\{\{(\w+)\}\}/g,(_,key)=>{if(!values[key])throw new FinanceError('A required message fact is unavailable.');return values[key];});if(/\{\{|\}\}/.test(result))throw new FinanceError('Unrecognized message placeholder.');return safeMessage(result);}
export type Recipient={phone:string;userId:string|null;orderId?:string;role:'buyer'|'recipient'|'test';templateId?:string};
export async function suppressed(c:PoolClient,phone:string,userId?:string|null,purpose:SmsPurpose='operational'){return (await suppressedNumbers(c,[{phone,userId}],purpose)).has(phone);}
/** Batch permission evidence for a full audience; never issue per-contact SQL reads. */
export async function suppressedNumbers(c:PoolClient,targets:{phone:string;userId?:string|null}[],purpose:SmsPurpose,requireGrant=purpose==='marketing',reasons=new Map<string,string>()){
 const phones=[...new Set(targets.map(t=>t.phone))],userIds=[...new Set(targets.flatMap(t=>t.userId?[t.userId]:[]))],blocked=new Set<string>();
 if(!phones.length)return blocked;
 const byUser=new Map<string,string[]>();for(const t of targets)if(t.userId)byUser.set(t.userId,[...(byUser.get(t.userId)||[]),t.phone]);
 const restrictions=(await c.query(`SELECT user_id,mystery_canonical_phone(COALESCE(NULLIF(contact_normalized,''),contact)) AS phone FROM waitlist WHERE channel='sms' AND status='unsubscribed' AND (user_id=ANY($2::text[]) OR mystery_canonical_phone(COALESCE(NULLIF(contact_normalized,''),contact))=ANY($1::text[]))`,[phones,userIds])).rows;
 for(const r of restrictions){if(r.phone){blocked.add(r.phone);reasons.set(r.phone,'smsOptOut');}for(const phone of byUser.get(r.user_id)||[]){blocked.add(phone);reasons.set(phone,'smsOptOut');}}
 const consent=(await c.query("SELECT DISTINCT ON(phone,purpose,user_id) id,phone,purpose,granted FROM mysteryhub_sms.consents WHERE phone=ANY($1::text[]) AND purpose=ANY($2::text[]) ORDER BY phone,purpose,user_id,id DESC",[phones,purpose==='marketing'?['transactional','marketing']:['transactional']])).rows;
 const latest=new Map<string,{id:bigint;granted:boolean}>();for(const r of consent){if(!r.granted){blocked.add(r.phone);reasons.set(r.phone,'smsOptOut');}if(r.purpose===(purpose==='marketing'?'marketing':'transactional')){const old=latest.get(r.phone);if(!old||BigInt(r.id)>old.id)latest.set(r.phone,{id:BigInt(r.id),granted:r.granted===true});}}
 if(userIds.length){const withdrawals=(await c.query('SELECT DISTINCT ON(user_id,purpose) user_id,purpose,granted FROM mysteryhub_sms.consents WHERE user_id=ANY($1::text[]) AND purpose=ANY($2::text[]) ORDER BY user_id,purpose,id DESC',[userIds,purpose==='marketing'?['transactional','marketing']:['transactional']])).rows;for(const r of withdrawals)if(!r.granted)for(const phone of byUser.get(r.user_id)||[]){blocked.add(phone);reasons.set(phone,'smsOptOut');}}
 const recorded=await permissionEvidence(c,phones,purpose);
 for(const phone of phones){const evidence=recorded.get(phone);if(evidence?.granted===false){blocked.add(phone);reasons.set(phone,'smsOptOut');}if(requireGrant&&latest.get(phone)?.granted!==true&&evidence?.granted!==true&&!blocked.has(phone)){blocked.add(phone);reasons.set(phone,'missingPurposePermission');}}

 return blocked;
}
export async function orderRecipients(c:PoolClient,orderId:string,templateId:string,allowRecipient=false,automatic=false):Promise<{body:string;recipients:Recipient[]}>{
 const o=(await c.query(`SELECT o.* FROM orders o WHERE (o.id=$1 OR o.public_reference=$1) AND ${DIRECT_CONTACT_SQL} AND NOT EXISTS(SELECT 1 FROM order_test_fixtures f WHERE f.order_id=o.id)`,[orderId])).rows[0];
 const validTime=(v:unknown)=>typeof v==='string'||v instanceof Date?Number.isFinite(+new Date(v))&&+new Date(v)<=Date.now():false;
 if(!o||!Number.isSafeInteger(o.amount)||o.amount<=0||o.currency!=='GHS'||o.payment_status!=='success'||!['paystack','wallet'].includes(o.payment_provider)||!o.paid_at||!Number.isFinite(+new Date(o.paid_at))||+new Date(o.paid_at)>Date.now())throw new FinanceError('Authoritative direct payment evidence is unavailable.',409);
 orderId=o.id;let id=templateId;
 if(templateId==='refund_update'){id=o.resolution_json?.stage==='resolved'&&o.resolution_json?.verifiedAt?'refund_completed':'refund_initiated';}
 const t=SMS_PRESETS.find(t=>t.id===id&&t.locked);if(!t)throw new FinanceError('Choose an approved order template.');
 if(id==='order_processing'&&!processingEvidence(o))throw new FinanceError('Supplier acceptance is not established.',409);
 if(id==='order_delivered'&&!deliveredEvidence(o))throw new FinanceError('Delivery evidence is unavailable.',409);
 if(id==='delivery_attention'&&!attentionEvidence(o))throw new FinanceError('Order attention evidence is unavailable.',409);
 if(id.startsWith('refund_')&&(!['paystack_refund','wallet_refund'].includes(o.resolution_json?.outcome)||id==='refund_completed'&&(o.resolution_json?.stage!=='resolved'||!validTime(o.resolution_json?.verifiedAt))||id==='refund_initiated'&&o.resolution_json?.stage!=='refund_pending'))throw new FinanceError('The requested refund state is not verified.',409);
 const recipients:Recipient[]=[];
 if(o.user_id){const u=(await c.query("SELECT id,phone FROM users WHERE id=$1 AND role='customer' AND status='active' AND NOT must_change_password",[o.user_id])).rows[0],phone=canonicalGhanaPhone(u?.phone);if(phone)recipients.push({phone,userId:u.id,orderId,role:'buyer',templateId:id});}
 else if(['order_processing','order_delivered','delivery_attention'].includes(id)){const phone=canonicalGhanaPhone(o.recipient_phone);if(phone)recipients.push({phone,userId:null,orderId,role:'recipient',templateId:id});}
 // Routine registered notifications are buyer-only. Guest status copy is neutral.
 const allowed=[];for(const r of recipients){if((!arkeselConfig().enabled||!arkeselConfig().testOnly||arkeselConfig().testNumbers.includes(r.phone))&&!await suppressed(c,r.phone,r.userId,'transactional'))allowed.push(r);}
 const body=['order_processing','order_delivered','delivery_attention'].includes(id)?await transactionalMessage(c,o,id as any,!o.user_id):renderSms(t.body,{reference:o.public_reference,network:o.network,bundle:o.bundle_size_snapshot,site:'https://mysterybundlehub.com'});
 return {body,recipients:allowed};
}
export async function resolveAudience(c:PoolClient,input:any){
 strict(input,['filters','selected','numbers','purpose','body','templateId','templateVersion','orderId','channelUrl','channelConfirmed','claimConfirmed','claimEvidence','buyingGroup']);
 const purpose=input.purpose as SmsPurpose;if(!['transactional','operational','marketing'].includes(purpose))throw new FinanceError('Choose a message purpose.');
 const savedTemplate=input.templateId?(await c.query('SELECT * FROM mysteryhub_sms.templates WHERE id=$1',[input.templateId])).rows[0]:null;
 const template=input.templateId?studioTemplates(savedTemplate?[savedTemplate]:[]).find(t=>t.id===input.templateId&&t.enabled!==false):null;
 if(input.templateId&&(!template||template.version!==input.templateVersion))throw new FinanceError('Template changed. Reload and review.',409);
 if(purpose==='transactional'){if(!template?.locked||typeof input.orderId!=='string'||input.orderId.length>64)throw new FinanceError('Transactional messages require one genuine order and a locked approved template.');const result=await orderRecipients(c,input.orderId,template.id);return {...result,purpose,templateVersion:template.version,summary:{matched:result.recipients.length,unique:result.recipients.length,duplicates:0,invalid:0,excluded:0,resellerOrdersExcluded:0}};}
 if(template?.locked||template&&template.purpose!==purpose)throw new FinanceError('This template does not match the selected purpose.');
 const channel=template?.id==='channel_notice',usesChannel=channel||smsChannelMention(String(input.body||template?.body||''));const channelUrl=usesChannel?validateChannelUrl(input.channelUrl,input.channelConfirmed):'';
 if((SMS_STUDIO_TEMPLATES.find(t=>t.id===template?.id&&'requiresPerformanceEvidence' in t)||/instant|express|moving fast|fast delivery/i.test(String(input.body||template?.body||'')))&& (input.claimConfirmed!==true||typeof input.claimEvidence!=='string'||input.claimEvidence.trim().length<12||input.claimEvidence.length>300))throw new FinanceError('Confirm current service performance and record concise evidence for this announcement.');
 const body=renderSms(safeMessage(input.body||template?.body),{site:'https://mysterybundlehub.com',channel_url:channelUrl});if(purpose==='operational'&&/discount|promo.?code|special offer|giveaway|\boffers\b|need data|Friday Mystery Drop|payment confirmed|refund completed|guaranteed delivery/i.test(body))throw new FinanceError('Promotional or financial claims cannot be sent as a generic operational notice.');if(usesChannel&&((body.match(/(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/[^\s]+/gi)||[]).some(url=>url.replace(/[.,;!]$/,'')!==channelUrl)||!body.includes(channelUrl)||(body.match(/https?:\/\/[^\s]+/gi)||[]).some(url=>url.replace(/[.,;!]$/,'')!==channelUrl)))throw new FinanceError('The announcement must contain the confirmed channel URL and no conflicting links.');if(!channel&&purpose==='operational'&&/join.{0,30}channel/i.test(body))throw new FinanceError('Use the dedicated channel relocation template and confirm its URL.');const filters=contactFilters(input.filters||{});if(filters.permission==='service_notice_review')throw new FinanceError('Clear the legacy service-notice filter and use SMS permission review.');const data=await ContactHubStore.query(filters,new Date(),c,true);
 if(data.total>10000)throw new FinanceError('Narrow this audience below10000 records.',413);
 let rows=data.rows;
 if(input.selected!==undefined){if(!Array.isArray(input.selected)||!input.selected.length||input.selected.length>100||input.selected.some((s:any)=>typeof s?.id!=='string'||typeof s?.source!=='string'))throw new FinanceError('Select up to100 existing contacts.');rows=rows.filter(r=>input.selected.some((s:any)=>s.source===r.source&&s.id===r.id));if(rows.length!==input.selected.length)throw new FinanceError('Selected contacts changed. Refresh before review.',409);}
 if(input.buyingGroup!==undefined){
  if(typeof input.buyingGroup!=='string'||!Object.hasOwn(SMS_BUYING_GROUPS,input.buyingGroup)||filters.source!=='registered')throw new FinanceError('Choose a valid direct-account buying-pattern group.');
  const current=await buyingPatterns(c),eligible=new Set(current.customers.filter(r=>r.group===input.buyingGroup).map(r=>r.id));
  rows=rows.filter(r=>r.source==='registered'&&eligible.has(r.id));
  if(input.selected&&rows.length!==input.selected.length)throw new FinanceError('Buying-pattern audience changed. Refresh the group and review again.',409);
 }
 if(input.numbers!==undefined){if(!Array.isArray(input.numbers)||input.numbers.length>100||input.numbers.some((n:any)=>!canonicalGhanaPhone(n)))throw new FinanceError('Enter up to100 valid Ghana numbers.');const phones=[...new Set(input.numbers.map(canonicalGhanaPhone))];rows=rows.filter(r=>phones.includes(r.phone));for(const phone of phones)if(!rows.some(r=>r.phone===phone)&&arkeselConfig().testNumbers.includes(phone as string))rows.push({phone,id:phone,source:'test'} as any);}
 const accountData=await ContactHubStore.query(contactFilters({source:'registered'}),new Date(),c,true);if(accountData.total>10000)throw new FinanceError('Account permission evidence exceeds safe preparation limits.',413);
 const accounts=new Map(accountData.rows.filter(a=>a.phone&&a.status==='active'&&a.purchases>0&&a.smsPermission!=='sms_unsubscribed').map(a=>[a.phone,a]));
 // Suppression identity uses ALL related direct accounts, even when an opt-out makes
 // that account ineligible for operational support. Permission is never inferred
 // from the narrower relationship map used to choose an intended buyer.
 const allAccountIds=new Map<string,string[]>();for(const a of accountData.rows)if(a.phone)allAccountIds.set(a.phone,[...(allAccountIds.get(a.phone)||[]),a.id]);
 const targets=rows.filter(r=>r.phone).flatMap(r=>(allAccountIds.get(r.phone!)||[null]).map(userId=>({phone:r.phone!,userId})));
 const reasons=new Map<string,string>();const blocked=await suppressedNumbers(c,targets,purpose,usesChannel||purpose==='marketing',reasons);const recorded=await permissionEvidence(c,rows.flatMap(r=>r.phone?[r.phone]:[]),purpose);for(const r of [...accountData.rows,...rows])if(r.phone&&r.smsPermission==='sms_unsubscribed'){blocked.add(r.phone);reasons.set(r.phone,'smsOptOut');}
 const recipients:Recipient[]=[];let excluded=0,invalid=0,duplicates=0;let permissionExcluded=0,optOutExcluded=0,relationshipExcluded=0,testExcluded=0;const seen=new Set<string>();
 for(const r of rows){if(!r.phone){invalid++;continue;}if(seen.has(r.phone)){duplicates++;continue;}seen.add(r.phone);
  const account=accounts.get(r.phone),test=(r.source as string)==='test';
  if(blocked.has(r.phone)||purpose==='operational'&&!account&&!test&&recorded.get(r.phone)?.granted!==true){excluded++;if(blocked.has(r.phone)){if(reasons.get(r.phone)==='smsOptOut')optOutExcluded++;else permissionExcluded++;}else relationshipExcluded++;continue;}
  recipients.push({phone:r.phone,userId:account?.id||null,role:test?'test':account||r.source==='payer'?'buyer':'recipient'});
 }
 const config=arkeselConfig();if(config.enabled&&config.testOnly){for(let i=recipients.length-1;i>=0;i--)if(!config.testNumbers.includes(recipients[i].phone)){recipients.splice(i,1);excluded++;testExcluded++;}}const estimate=smsEstimate(body),credits=estimate.segments*recipients.length;
 if(recipients.length>config.campaignLimit||credits>config.campaignCredits)throw new FinanceError('Audience exceeds the configured campaign recipient/estimated-credit limit.',413);
 return {purpose,body,recipients,templateVersion:template?.version||null,summary:{matched:rows.length,unique:recipients.length,duplicates,invalid,excluded,validNumbers:seen.size,exclusionReasons:{smsOptOut:optOutExcluded,missingPurposePermission:permissionExcluded,missingDirectServiceRelationship:relationshipExcluded,controlledTestRestriction:testExcluded,invalidPhone:invalid},resellerOrdersExcluded:data.quality?.resellerOrdersExcluded||0,estimatedSegments:estimate.segments,estimatedCredits:credits,encoding:estimate.encoding}};
}

export function validateChannelUrl(value:unknown,confirmed:unknown){if(confirmed!==true||typeof value!=='string')throw new FinanceError('Enter and confirm the real official WhatsApp Channel URL.');let u:URL;try{u=new URL(value);}catch{throw new FinanceError('Use a valid WhatsApp Channel URL.');}if(u.origin!=='https://whatsapp.com'||!/^\/channel\/[A-Za-z0-9]{10,64}$/.test(u.pathname)||u.search||u.hash||u.username||u.password)throw new FinanceError('Use only an HTTPS whatsapp.com/channel/ link without tracking or credentials.');return u.href;}
