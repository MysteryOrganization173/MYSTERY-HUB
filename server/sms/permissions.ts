import type {PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {getPool} from '../db/connection.js';
import {ContactHubStore} from '../db/contactHubStore.js';
import {contactFilters} from '../services/contactHubPolicy.js';
import {AdminAuditStore} from '../db/adminAuditStore.js';
import {FinanceError} from '../db/financeStore.js';
import {smsTransaction} from './store.js';
import {digest,strict,suppressedNumbers} from './policy.js';
import type {SmsPurpose} from '../../shared/smsCommunications.js';

export async function permissionsInstalled(c:Pick<PoolClient,'query'>=getPool()!){
 if(!c)return false;
 return (await c.query("SELECT to_regclass('mysteryhub_sms.permission_records') IS NOT NULL AS installed")).rows[0].installed===true;
}
/** An administrator attests evidence; this never rewrites a customer opt-out. */
export async function permissionEvidence(c:PoolClient,phones:string[],purpose:SmsPurpose){
 if(!phones.length||!await permissionsInstalled(c))return new Map<string,any>();
 const rows=(await c.query('SELECT DISTINCT ON(phone) phone,purpose,granted,source,obtained_at,recorded_at,id FROM mysteryhub_sms.permission_records WHERE phone=ANY($1::text[]) AND purpose=$2 ORDER BY phone,id DESC',[phones,purpose])).rows;
 return new Map(rows.map(r=>[r.phone,r]));
}
async function permissionAudience(c:PoolClient,input:any){
 const filters=contactFilters(input.filters||{});if(filters.permission==='service_notice_review')throw new FinanceError('Clear the legacy service-notice review filter; SMS permission review is separate from Web Push.');
 const data=await ContactHubStore.query(filters,new Date(),c,true);
 if(data.total>10000)throw new FinanceError('Narrow permission registration below10000 contact records.',413);
 let rows=data.rows;
 if(input.selected!==undefined){if(!Array.isArray(input.selected)||!input.selected.length||input.selected.length>100||input.selected.some((s:any)=>typeof s?.id!=='string'||typeof s?.source!=='string'))throw new FinanceError('Select up to100 existing direct contacts.');rows=rows.filter(r=>input.selected.some((s:any)=>s.source===r.source&&s.id===r.id));if(rows.length!==input.selected.length)throw new FinanceError('Selected direct contacts changed. Review again.',409);}
 const accounts=await ContactHubStore.query(contactFilters({source:'registered'}),new Date(),c,true);
 if(accounts.total>10000)throw new FinanceError('Narrow account evidence before permission registration.',413);
 const ids=new Map<string,string[]>();for(const r of accounts.rows)if(r.phone)ids.set(r.phone,[...(ids.get(r.phone)||[]),r.id]);
 // Only explicit SMS withdrawals suppress registration. Missing marketing grants do not.
 const targets=rows.filter(r=>r.phone).flatMap(r=>(ids.get(r.phone!)||[null]).map(userId=>({phone:r.phone!,userId})));
 const blocked=await suppressedNumbers(c,targets,input.purpose,false);
 const phones=[...new Set(rows.filter(r=>r.phone&&!(r.source==='registered'&&r.status!=='active')).map(r=>r.phone!))];
 const eligible=phones.filter(p=>!blocked.has(p)&&!rows.some(r=>r.phone===p&&r.smsPermission==='sms_unsubscribed'));
 if(eligible.length>1000)throw new FinanceError('Register at most1000 unique direct numbers per reviewed batch.',413);
 return {phones:eligible,summary:{matched:rows.length,unique:eligible.length,duplicates:rows.filter(r=>r.phone).length-phones.length,missing:rows.filter(r=>!r.phone).length,suppressed:phones.length-eligible.length,resellerOrdersExcluded:data.quality?.resellerOrdersExcluded||0}};
}
export class SmsPermissions {
 static async preview(actor:string,input:any){
  strict(input,['filters','selected','purpose','source','evidence','obtainedAt','granted']);
  if(!['operational','transactional','marketing'].includes(input.purpose)||!['previously_obtained','admin_recorded'].includes(input.source)||typeof input.granted!=='boolean'||typeof input.evidence!=='string'||input.evidence.trim().length<8||input.evidence.length>300||/[\x00-\x1f]/.test(input.evidence)||typeof input.obtainedAt!=='string'||!Number.isFinite(Date.parse(input.obtainedAt))||Date.parse(input.obtainedAt)>Date.now())throw new FinanceError('Provide purpose, permission source, actual collection date and a concise evidence description.');
  return smsTransaction(async c=>{
   if(!await permissionsInstalled(c))throw new FinanceError('Reviewed SMS permission migration is pending. Existing SMS workflows remain available.',503);
   const audience=await permissionAudience(c,input),id=randomUUID(),hash=digest([actor,input,audience]);
   await c.query('INSERT INTO mysteryhub_sms.previews(id,actor_id,input,digest,recipients,summary) VALUES($1,$2,$3,$4,$5,$6)',[id,actor,JSON.stringify({...input,kind:'permission_registration'}),hash,JSON.stringify(audience.phones),JSON.stringify(audience.summary)]);
   return {id,...audience.summary,numbers:audience.phones,purpose:input.purpose,source:input.source,obtainedAt:input.obtainedAt,granted:input.granted,expiresAt:new Date(Date.now()+600000).toISOString(),warning:'Attestation records prior SMS permission, not a new website opt-in. No messages are sent. Explicit customer SMS opt-outs cannot be overridden.'};
  });
 }
 static async confirm(actor:string,input:any){
  strict(input,['reviewId','requestId','confirmed']);if(input.confirmed!==true||![input.reviewId,input.requestId].every(v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v)))throw new FinanceError('Confirm the reviewed permission batch with valid request IDs.');
  return smsTransaction(async c=>{
   if(!await permissionsInstalled(c))throw new FinanceError('SMS permission migration is pending.',503);
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended('sms:permissions',0))");
   const old=(await c.query('SELECT actor_id,review_id,request_id,input_hash FROM mysteryhub_sms.permission_records WHERE request_id=$1 OR review_id=$2 LIMIT 1',[input.requestId,input.reviewId])).rows[0];
   if(old){if(old.actor_id!==actor||old.review_id!==input.reviewId)throw new FinanceError('Permission request is already associated with a different review.',409);return {saved:true,reused:true};}
   const p=(await c.query("SELECT * FROM mysteryhub_sms.previews WHERE id=$1 AND actor_id=$2 AND expires_at>now() FOR UPDATE",[input.reviewId,actor])).rows[0];
   if(!p||p.input.kind!=='permission_registration')throw new FinanceError('Permission review expired or unavailable.',409);
   const {kind,...original}=p.input,audience=await permissionAudience(c,original);
   if(!audience.phones.length||digest([actor,original,audience])!==p.digest)throw new FinanceError('Audience or SMS withdrawals changed. Review again.',409);
   await c.query(`INSERT INTO mysteryhub_sms.permission_records(phone,purpose,granted,source,evidence,obtained_at,actor_id,request_id,review_id,input_hash) SELECT phone,$2,$3,$4,$5,$6,$7,$8,$9,$10 FROM unnest($1::text[]) phone`,[audience.phones,original.purpose,original.granted,original.source,original.evidence.trim(),original.obtainedAt,actor,input.requestId,input.reviewId,p.digest]);
   await AdminAuditStore.record({adminUserId:actor,action:'sms_permission_registered',entityType:'sms_permission_batch',entityId:input.reviewId,metadata:{count:audience.phones.length,purpose:original.purpose,source:original.source,granted:original.granted}},c);
   return {saved:true,count:audience.phones.length,sent:false};
  });
 }
 static async history(page=1){if(!Number.isSafeInteger(page)||page<1||page>10000)throw new FinanceError('Invalid permission history page.');return smsTransaction(async c=>{if(!await permissionsInstalled(c))return {installed:false,rows:[]};return {installed:true,rows:(await c.query('SELECT phone,purpose,granted,source,evidence,obtained_at,actor_id,recorded_at FROM mysteryhub_sms.permission_records ORDER BY id DESC LIMIT 25 OFFSET $1',[(page-1)*25])).rows,page};});}
}
