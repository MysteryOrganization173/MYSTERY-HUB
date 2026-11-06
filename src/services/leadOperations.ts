import {API_BASE_URL} from './apiClient';
import type {LeadSource,LeadSummary} from '../../shared/leadOperations';
import type {PaidOrderAlerts} from '../../shared/adminAlerts';
export class AdminReadError extends Error {
 constructor(message:string, readonly status:number){super(message);}
}
export async function leadRequest<T>(token:string,path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 const r=await fetch(API_BASE_URL+'/api/admin/'+path,{method:body?'PATCH':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},cache:'no-store',signal,...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json().catch(()=>null);
 if(!r.ok||!data)throw new AdminReadError(data?.error||'Admin request unavailable. Reload before retrying.',r.status);
 return data;
}
export const getLeadSummary=(token:string,signal?:AbortSignal)=>leadRequest<{data:LeadSummary}>(token,'leads',undefined,signal).then(r=>r.data);
export const getPaidOrderAlerts=(token:string,signal?:AbortSignal)=>leadRequest<{data:PaidOrderAlerts}>(token,'alerts/paid-orders',undefined,signal).then(r=>r.data);
export const leadChanged=()=>window.dispatchEvent(new Event('mh-leads-changed'));
// A new path for the versioned Marketplace contract fails closed against an older rolling backend.
export const leadUpdatePath=(source:LeadSource,id:string)=>source==='ultra'?'websites/ultra-enquiries/'+encodeURIComponent(id):'leads/marketplace/'+encodeURIComponent(id);
