import type {PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {FinanceError} from '../db/financeStore.js';
import {ContactHubStore,DIRECT_CONTACT_SQL} from '../db/contactHubStore.js';
import {contactFilters} from '../services/contactHubPolicy.js';
import {canonicalGhanaPhone} from '../utils/phone.js';
import {SMS_PRESETS,type SmsPurpose} from '../../shared/smsCommunications.js';
import {smsEstimate} from '../../src/utils/manualSms.js';
import {arkeselConfig,canonicalCallback} from './arkesel.js';
export const digest=(v:unknown)=>createHash('sha256').update(canonicalCallback(v)).digest('hex');
export const strict=(v:any,keys:string[])=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw new FinanceError('Unexpected SMS field.');};
export function safeMessage(v:unknown){if(typeof v!=='string'||!v.trim()||v.length>1600||/[\x00-\x08\x0b\x0c\x0e-\x1f]|sk_(live|test)_|api.key\s*[:=]|Bearer\s|password\s*[:=]/i.test(v))throw new FinanceError('Enter a safe SMS message of up to1600 characters.');return v.trim();}
export function renderSms(body:string,values:Record<string,string>){const result=body.replace(/\{\{(\w+)\}\}/g,(_,key)=>{if(!values[key])throw new FinanceError('A required message fact is unavailable.');return values[key];});if(/\{\{|\}\}/.test(result))throw new FinanceError('Unrecognized message placeholder.');return safeMessage(result);}
export type Recipient={phone:string;userId:string|null;orderId?:string;role:'buyer'|'recipient'|'test';templateId?:string};
export async function suppressed(c:PoolClient,phone:string,userId?:string|null,purpose:SmsPurpose='operational'){
 const result=await c.query(`SELECT EXISTS(SELECT 1 FROM waitlist w WHERE channel='sms' AND status='unsubscribed' AND (user_id=$2 OR mystery_canonical_phone(COALESCE(NULLIF(contact_normalized,''),contact))=$1)) OR EXISTS(SELECT 1 FROM mysteryhub_notifications.preferences p JOIN users u ON u.id=p.user_id WHERE transactional=false AND (u.id=$2 OR mystery_canonical_phone(u.phone)=$1)) OR EXISTS(SELECT 1 FROM mysteryhub_sms.consents WHERE phone=$1 AND purpose='transactional' AND granted=false AND id IN(SELECT max(id) FROM mysteryhub_sms.consents WHERE phone=$1 AND purpose='transactional' GROUP BY user_id)) AS blocked`,[phone,userId||null]);
 if(result.rows[0].blocked)return true;
 if(purpose==='marketing'){const x=(await c.query("SELECT granted FROM mysteryhub_sms.consents WHERE phone=$1 AND purpose='marketing' ORDER BY id DESC LIMIT 1",[phone])).rows[0];const denied=(await c.query("SELECT 1 FROM mysteryhub_sms.consents WHERE phone=$1 AND purpose='marketing' AND granted=false AND id IN(SELECT max(id) FROM mysteryhub_sms.consents WHERE phone=$1 AND purpose='marketing' GROUP BY user_id) LIMIT 1",[phone])).rowCount;return x?.granted!==true||!!denied;}
 return false;
}
export async function orderRecipients(c:PoolClient,orderId:string,templateId:string,allowRecipient=false,automatic=false):Promise<{body:string;recipients:Recipient[]}>{
 const o=(await c.query(`SELECT o.* FROM orders o WHERE (o.id=$1 OR o.public_reference=$1) AND ${DIRECT_CONTACT_SQL} AND NOT EXISTS(SELECT 1 FROM order_test_fixtures f WHERE f.order_id=o.id)`,[orderId])).rows[0];
 const validTime=(v:unknown)=>typeof v==='string'||v instanceof Date?Number.isFinite(+new Date(v))&&+new Date(v)<=Date.now():false;
 if(!o||!Number.isSafeInteger(o.amount)||o.amount<=0||o.currency!=='GHS'||o.payment_status!=='success'||!['paystack','wallet'].includes(o.payment_provider)||!o.paid_at||!Number.isFinite(+new Date(o.paid_at))||+new Date(o.paid_at)>Date.now())throw new FinanceError('Authoritative direct payment evidence is unavailable.',409);
 orderId=o.id;let id=templateId;
 if(templateId==='refund_update'){id=o.resolution_json?.stage==='resolved'&&o.resolution_json?.verifiedAt?'refund_completed':'refund_initiated';}
 const t=SMS_PRESETS.find(t=>t.id===id&&t.locked);if(!t)throw new FinanceError('Choose an approved order template.');
 if(id==='order_processing'&&(!['submitted','processing'].includes(o.status)||!o.supplier_order_id||!validTime(o.submitted_at)||+new Date(o.submitted_at)<+new Date(o.paid_at)||o.manual_review))throw new FinanceError('Supplier acceptance is not established.',409);
 if(id==='order_delivered'&&(o.status!=='delivered'||!validTime(o.delivered_at)||+new Date(o.delivered_at)<+new Date(o.paid_at)||o.manual_review||!o.supplier_order_id&&!(o.service_type==='marketplace'&&o.marketplace_status==='completed')))throw new FinanceError('Delivery evidence is unavailable.',409);
 if(id==='delivery_attention'&&!o.manual_review&&!['failed','refund_pending','cancelled','expired'].includes(o.status))throw new FinanceError('Order attention evidence is unavailable.',409);
 if(id.startsWith('refund_')&&(!['paystack_refund','wallet_refund'].includes(o.resolution_json?.outcome)||id==='refund_completed'&&(o.resolution_json?.stage!=='resolved'||!validTime(o.resolution_json?.verifiedAt))||id==='refund_initiated'&&o.resolution_json?.stage!=='refund_pending'))throw new FinanceError('The requested refund state is not verified.',409);
 const recipients:Recipient[]=[];
 if(o.user_id){const u=(await c.query("SELECT id,phone FROM users WHERE id=$1 AND role='customer' AND status='active' AND NOT must_change_password",[o.user_id])).rows[0],phone=canonicalGhanaPhone(u?.phone);if(phone)recipients.push({phone,userId:u.id,orderId,role:'buyer',templateId:id});}
 else {const e=(await c.query('SELECT payer_phone FROM admin_guest_buyer_evidence WHERE order_id=$1',[orderId])).rows[0],phone=canonicalGhanaPhone(e?.payer_phone);if(phone)recipients.push({phone,userId:null,orderId,role:'buyer',templateId:id});}
 // Recipient notifications never contain payment/refund details; explicit policy permits delivery/attention only.
 if(allowRecipient&&['order_delivered','delivery_attention'].includes(id)){const phone=canonicalGhanaPhone(o.recipient_phone);if(phone&&!recipients.some(r=>r.phone===phone))recipients.push({phone,userId:null,orderId,role:'recipient',templateId:id});}
 const allowed=[];for(const r of recipients){const optin=automatic&&r.role==='buyer'?(await c.query("SELECT granted FROM mysteryhub_sms.consents WHERE phone=$1 AND purpose='transactional' ORDER BY id DESC LIMIT 1",[r.phone])).rows[0]?.granted===true:true;if((!arkeselConfig().enabled||!arkeselConfig().testOnly||arkeselConfig().testNumbers.includes(r.phone))&&optin&&!await suppressed(c,r.phone,r.userId,'transactional'))allowed.push(r);}
 return {body:renderSms(t.body,{reference:o.public_reference,network:o.network,bundle:o.bundle_size_snapshot,site:'https://mysterybundlehub.com'}),recipients:allowed};
}
export async function resolveAudience(c:PoolClient,input:any){
 strict(input,['filters','selected','numbers','purpose','body','templateId','templateVersion','orderId']);
 const purpose=input.purpose as SmsPurpose;if(!['transactional','operational','marketing'].includes(purpose))throw new FinanceError('Choose a message purpose.');
 const template=input.templateId?(await c.query('SELECT * FROM mysteryhub_sms.templates WHERE id=$1 AND enabled=true',[input.templateId])).rows[0]:null;
 if(input.templateId&&(!template||template.version!==input.templateVersion))throw new FinanceError('Template changed. Reload and review.',409);
 if(purpose==='transactional'){if(!template?.locked||typeof input.orderId!=='string'||input.orderId.length>64)throw new FinanceError('Transactional messages require one genuine order and a locked approved template.');const result=await orderRecipients(c,input.orderId,template.id);return {...result,purpose,templateVersion:template.version,summary:{matched:result.recipients.length,unique:result.recipients.length,duplicates:0,invalid:0,excluded:0,resellerOrdersExcluded:0}};}
 if(template?.locked||template&&template.purpose!==purpose)throw new FinanceError('This template does not match the selected purpose.');
 const body=renderSms(safeMessage(input.body||template?.body),{site:'https://mysterybundlehub.com'});if(purpose==='operational'&&/discount|promo.?code|special offer|giveaway|join.{0,30}channel|payment confirmed|refund completed|guaranteed delivery/i.test(body))throw new FinanceError('Promotional or financial claims cannot be sent as a generic operational notice.');const filters=contactFilters(input.filters||{}),data=await ContactHubStore.query(filters,new Date(),c,true);
 if(data.total>10000)throw new FinanceError('Narrow this audience below10000 records.',413);
 let rows=data.rows;
 if(input.selected!==undefined){if(!Array.isArray(input.selected)||!input.selected.length||input.selected.length>100||input.selected.some((s:any)=>typeof s?.id!=='string'||typeof s?.source!=='string'))throw new FinanceError('Select up to100 existing contacts.');rows=rows.filter(r=>input.selected.some((s:any)=>s.source===r.source&&s.id===r.id));if(rows.length!==input.selected.length)throw new FinanceError('Selected contacts changed. Refresh before review.',409);}
 if(input.numbers!==undefined){if(!Array.isArray(input.numbers)||input.numbers.length>100||input.numbers.some((n:any)=>!canonicalGhanaPhone(n)))throw new FinanceError('Enter up to100 valid Ghana numbers.');const phones=[...new Set(input.numbers.map(canonicalGhanaPhone))];rows=rows.filter(r=>phones.includes(r.phone));for(const phone of phones)if(!rows.some(r=>r.phone===phone)&&arkeselConfig().testNumbers.includes(phone as string))rows.push({phone,id:phone,source:'test'} as any);}
 const accountData=await ContactHubStore.query(contactFilters({source:'registered'}),new Date(),c,true);if(accountData.total>10000)throw new FinanceError('Account permission evidence exceeds safe preparation limits.',413);
 const recipients:Recipient[]=[];let excluded=0,invalid=0,duplicates=0;const seen=new Set<string>();
 for(const r of rows){if(!r.phone){invalid++;continue;}if(seen.has(r.phone)){duplicates++;continue;}seen.add(r.phone);
  const account=accountData.rows.find(a=>a.phone===r.phone&&a.supportReviewEligible),test=(r.source as string)==='test';
  if(await suppressed(c,r.phone,account?.id,purpose)||purpose==='operational'&&!account&&!test){excluded++;continue;}
  recipients.push({phone:r.phone,userId:account?.id||null,role:test?'test':'buyer'});
 }
 const config=arkeselConfig();if(config.enabled&&config.testOnly){for(let i=recipients.length-1;i>=0;i--)if(!config.testNumbers.includes(recipients[i].phone)){recipients.splice(i,1);excluded++;}}const estimate=smsEstimate(body),credits=estimate.segments*recipients.length;
 if(recipients.length>config.campaignLimit||credits>config.campaignCredits)throw new FinanceError('Audience exceeds the configured campaign recipient/estimated-credit limit.',413);
 return {purpose,body,recipients,templateVersion:template?.version||null,summary:{matched:rows.length,unique:recipients.length,duplicates,invalid,excluded,validNumbers:seen.size,exclusionReasons:{permissionOrRelationship:excluded,invalidPhone:invalid},resellerOrdersExcluded:data.quality?.resellerOrdersExcluded||0,estimatedSegments:estimate.segments,estimatedCredits:credits,encoding:estimate.encoding}};
}
