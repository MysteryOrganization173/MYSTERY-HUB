import {AdminAuditStore} from '../db/adminAuditStore.js';
import {getPool} from '../db/connection.js';
import {ULTRA_STATUSES,MARKETPLACE_STATUSES,type LeadSource,type LeadWorkflow} from '../../shared/leadOperations.js';
export class LeadError extends Error{constructor(message:string,public status=400){super(message);}}
export function validateLeadChange(source:LeadSource,input:any){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['expectedVersion','status','adminNote','followUpOn','outcome'].includes(k))||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)throw new LeadError('Reload this enquiry before saving. A valid version is required.');
 if(!['status','adminNote','followUpOn','outcome'].some(k=>k in input))throw new LeadError('No follow-up changes supplied.');
 if(input.status!==undefined&&!(source==='ultra'?ULTRA_STATUSES:MARKETPLACE_STATUSES).includes(input.status))throw new LeadError('Invalid enquiry status.');
 if(input.adminNote!==undefined&&(typeof input.adminNote!=='string'||input.adminNote.length>1000||/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/.test(input.adminNote)))throw new LeadError('Use a plain-text note up to 1000 characters.');
 if(input.followUpOn!==undefined&&input.followUpOn!==null&&(typeof input.followUpOn!=='string'||!/^20\d\d-\d\d-\d\d$/.test(input.followUpOn)||!Number.isFinite(Date.parse(input.followUpOn+'T00:00:00Z'))||new Date(input.followUpOn+'T00:00:00Z').toISOString().slice(0,10)!==input.followUpOn))throw new LeadError('Use a valid follow-up date between 2000 and 2099.');
 if(input.outcome!==undefined&&(source!=='ultra'||input.outcome!==null&&!['accepted','not_proceeding','duplicate'].includes(input.outcome)))throw new LeadError('Invalid closure outcome.');
 return {...input,...(input.adminNote!==undefined?{adminNote:input.adminNote.trim()}:{})};
}
export function workflow(source:LeadSource,row:any):LeadWorkflow{return source==='ultra'?{status:row.lead_status||'new',note:row.lead_note||'',followUpOn:date(row.follow_up_on),outcome:row.lead_outcome||null,version:row.workflow_version||0,updatedAt:iso(row.lead_updated_at||row.created_at),updatedBy:row.lead_updated_by||null}:{status:row.status,note:row.admin_note||'',followUpOn:date(row.follow_up_on),outcome:null,version:row.workflow_version||0,updatedAt:iso(row.updated_at),updatedBy:row.lead_updated_by||null};}
const iso=(v:any)=>new Date(v).toISOString(),date=(v:any)=>v?typeof v==='string'?v.slice(0,10):new Date(v).toISOString().slice(0,10):null;
/** Both existing stores share locking/validation, not customer records or financial state. */
const pending=new Map<string,Promise<any>>();
export function saveLead(source:LeadSource,id:string,input:unknown,adminId:string,memory:{read:()=>any;write:(row:any)=>void}):Promise<any>{
 if(getPool())return saveLeadLocked(source,id,input,adminId,memory);
 const key=source+':'+id,work=(pending.get(key)||Promise.resolve()).catch(()=>{}).then(()=>saveLeadLocked(source,id,input,adminId,memory));pending.set(key,work);
 return work.finally(()=>{if(pending.get(key)===work)pending.delete(key);});
}
async function saveLeadLocked(source:LeadSource,id:string,input:unknown,adminId:string,memory:{read:()=>any;write:(row:any)=>void}){
 const change=validateLeadChange(source,input),db=getPool(),client=db?await db.connect():null;
 const table=source==='ultra'?'website_ultra_enquiries':'marketplace_inquiries';
 try{
  if(client){await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='5000ms'");}
  else if(process.env.NODE_ENV==='production')throw new LeadError('Persistent lead storage unavailable.',503);
  const old=client?(await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[id])).rows[0]:memory.read();
  if(!old)throw new LeadError('Enquiry not found.',404);
  const before=workflow(source,old),next={...before,status:change.status??before.status,note:change.adminNote??before.note,followUpOn:change.followUpOn===undefined?before.followUpOn:change.followUpOn,outcome:change.outcome===undefined?before.outcome:change.outcome};
  if(next.status!=='closed'){if(change.outcome!=null)throw new LeadError('A closure outcome requires Closed status.');next.outcome=null;}
  if(['status','note','followUpOn','outcome'].every(k=>(before as any)[k]===(next as any)[k])){if(client)await client.query('COMMIT');return old;} // Retry/no-op: no duplicate history.
  if(change.expectedVersion!==before.version)throw new LeadError('This enquiry changed in another session. Reload it before saving; your unsaved note has not been applied.',409);
  const now=new Date().toISOString(),record=source==='ultra'?{...old,lead_status:next.status,lead_note:next.note,follow_up_on:next.followUpOn,lead_outcome:next.outcome,workflow_version:before.version+1,lead_updated_at:now,lead_updated_by:adminId}:{...old,status:next.status,admin_note:next.note,follow_up_on:next.followUpOn,workflow_version:before.version+1,updated_at:now,lead_updated_by:adminId,contacted_at:next.status==='contacted'?old.contacted_at||now:old.contacted_at};
  if(client){
   const sql=source==='ultra'?'lead_status=$2,lead_note=$3,follow_up_on=$4,lead_outcome=$5,workflow_version=$6,lead_updated_at=$7,lead_updated_by=$8':'status=$2,admin_note=$3,follow_up_on=$4,contacted_at=$5,workflow_version=$6,updated_at=$7,lead_updated_by=$8';
   await client.query(`UPDATE ${table} SET ${sql} WHERE id=$1`,[id,next.status,next.note,next.followUpOn,source==='ultra'?next.outcome:record.contacted_at,before.version+1,now,adminId]);
  }
  await AdminAuditStore.record({adminUserId:adminId,action:source==='ultra'?'ultra_enquiry_workflow_updated':'marketplace_inquiry_updated',entityType:source==='ultra'?'ultra_enquiry':'marketplace_inquiry',entityId:id,metadata:{fromStatus:before.status,status:next.status,fromOutcome:before.outcome,outcome:next.outcome,noteChanged:before.note!==next.note,followUpOn:next.followUpOn,version:before.version+1}},client||undefined);
  if(client)await client.query('COMMIT');else memory.write(record);
  return record;
 }catch(e){if(client)await client.query('ROLLBACK');throw e;}finally{client?.release();}
}
