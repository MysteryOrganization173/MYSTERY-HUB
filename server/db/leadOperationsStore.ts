import {getPool} from './connection.js';
import {LeadError} from '../services/leadWorkflow.js';
import {LEAD_FILTERS,type LeadSource,type LeadSummary} from '../../shared/leadOperations.js';
export function leadFilter(source:LeadSource,value:unknown){
 if(typeof value!=='string'||!(LEAD_FILTERS as readonly string[]).includes(value)||source==='ultra'&&value==='resolved'||source==='marketplace'&&value==='quoted')throw new LeadError('Invalid lead filter.');
 const status=source==='ultra'?'lead_status':'status',updated=source==='ultra'?'lead_updated_at':'updated_at';
 const open=`${status} NOT IN ('closed','resolved')`;
 if(value==='due'||value==='overdue')return `${open} AND follow_up_on ${value==='due'?'=':'<'} (NOW() AT TIME ZONE 'Africa/Accra')::date`;
 if(value==='recent')return `${source==='ultra'?'workflow_version>0':'(workflow_version>0 OR updated_at>created_at)'} AND ${updated}>=NOW()-interval '7 days'`;
 return value?`${status}='${value}'`:'TRUE'; // Only validated enum literals, never user SQL.
}
export class LeadOperationsStore{
 static async summary():Promise<LeadSummary>{
  const db=getPool();if(!db)throw new LeadError('Lead counts unavailable.',503);
  const c=await db.connect();try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await c.query("SET LOCAL statement_timeout='3000ms'");
   const clock=(await c.query("SELECT NOW() now,(NOW() AT TIME ZONE 'Africa/Accra')::date::text today")).rows[0],data:any={checkedAt:new Date(clock.now).toISOString(),today:clock.today};
   for(const source of ['ultra','marketplace'] as const){const table=source==='ultra'?'website_ultra_enquiries':'marketplace_inquiries',status=source==='ultra'?'lead_status':'status',updated=source==='ultra'?'coalesce(lead_updated_at,created_at)':'updated_at',reference=source==='ultra'?'reference':'id';
    const link=`id,${reference} reference,${status} status,created_at AS "createdAt",${updated} AS "updatedAt"`;
    data[source]=(await c.query(`SELECT count(*) FILTER(WHERE ${status}='new')::int new,count(*) FILTER(WHERE ${leadFilter(source,'due')})::int due,count(*) FILTER(WHERE ${leadFilter(source,'overdue')})::int overdue,
      (SELECT coalesce(json_agg(r),'[]') FROM (SELECT ${link} FROM ${table} WHERE ${status}='new' ORDER BY created_at DESC,id LIMIT 5) r) "latestNew",
      (SELECT coalesce(json_agg(r),'[]') FROM (SELECT ${link} FROM ${table} WHERE ${leadFilter(source,'recent')} ORDER BY ${updated} DESC,id LIMIT 5) r) recent FROM ${table}`)).rows[0];
   }await c.query('COMMIT');return data;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 static async history(source:LeadSource,id:string){const db=getPool();if(!db)throw new LeadError('History unavailable.',503);return (await db.query("SELECT admin_user_id,metadata_safe_json,created_at FROM admin_audit_log WHERE entity_type=$1 AND entity_id=$2 AND action=$3 ORDER BY created_at DESC,id DESC LIMIT 20",[source==='ultra'?'ultra_enquiry':'marketplace_inquiry',id,source==='ultra'?'ultra_enquiry_workflow_updated':'marketplace_inquiry_updated'])).rows;}
}
