export type LeadSource='ultra'|'marketplace';
export const ULTRA_STATUSES=['new','contacted','quoted','closed'] as const;
export const MARKETPLACE_STATUSES=['new','contacted','resolved','closed'] as const;
export const LEAD_FILTERS=['','new','contacted','quoted','resolved','closed','due','overdue','recent'] as const;
export interface LeadWorkflow {status:string;note:string;followUpOn:string|null;outcome:string|null;version:number;updatedAt:string;updatedBy:string|null}
export interface LeadLink {id:string;reference:string;status:string;createdAt:string;updatedAt:string}
export interface LeadSourceSummary {new:number;due:number;overdue:number;recent:LeadLink[];latestNew:LeadLink[]}
export interface LeadSummary {checkedAt:string;today:string;ultra:LeadSourceSummary;marketplace:LeadSourceSummary}
export function readLeadWorkflow(source:LeadSource,row:any):LeadWorkflow{const date=(v:any)=>v?new Date(v).toISOString().slice(0,10):null;return {status:source==='ultra'?row.lead_status||'new':row.status,note:(source==='ultra'?row.lead_note:row.admin_note)||'',followUpOn:date(row.follow_up_on),outcome:source==='ultra'?row.lead_outcome||null:null,version:row.workflow_version||0,updatedAt:new Date((source==='ultra'?row.lead_updated_at:row.updated_at)||row.created_at).toISOString(),updatedBy:row.lead_updated_by||null};}
export function leadDestination(source:LeadSource,filter:string){return {tab:source==='ultra'?'websites':'marketplace',param:(source==='ultra'?'enquiries/':'inquiries/')+filter};}
export function followUpState(date:string|null,status:string,today=new Date().toISOString().slice(0,10)) {return !date||['closed','resolved'].includes(status)?null:date<today?'overdue':date===today?'due':'scheduled';} // Accra = UTC.
export function freshLeadLinks(previous:LeadSummary|null,current:LeadSummary){
 if(!previous)return [];
 return (['ultra','marketplace'] as const).flatMap(source=>current[source].latestNew.filter(row=>row.createdAt>previous.checkedAt&&!previous[source].latestNew.some(old=>old.id===row.id)).map(row=>({source,...row})));
}
