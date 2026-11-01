import {API_BASE_URL} from './apiClient';
import type {LeadSource,LeadSummary} from '../../shared/leadOperations';
export async function leadRequest<T>(token:string,path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 const r=await fetch(API_BASE_URL+'/api/admin/'+path,{method:body?'PATCH':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},cache:'no-store',signal,...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Lead operation unavailable. Reload before retrying.');return data;
}
export const getLeadSummary=(token:string,signal?:AbortSignal)=>leadRequest<{data:LeadSummary}>(token,'leads',undefined,signal).then(r=>r.data);
export const leadChanged=()=>window.dispatchEvent(new Event('mh-leads-changed'));
// A new path for the versioned Marketplace contract fails closed against an older rolling backend.
export const leadUpdatePath=(source:LeadSource,id:string)=>source==='ultra'?'websites/ultra-enquiries/'+encodeURIComponent(id):'leads/marketplace/'+encodeURIComponent(id);
