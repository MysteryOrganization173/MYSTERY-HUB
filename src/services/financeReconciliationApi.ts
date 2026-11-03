import {API_BASE_URL} from './apiClient';
import type {ReconciliationReport} from '../../shared/financeReconciliation';
export async function getFinanceReconciliation(token:string,filters:{filter:string;reference:string;offset:number},signal?:AbortSignal):Promise<ReconciliationReport>{
 const response=await fetch(`${API_BASE_URL}/api/admin/finance/reconciliation?${new URLSearchParams(Object.entries(filters).map(([k,v])=>[k,String(v)]))}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.error||'Reconciliation reporting is unavailable. Existing records were not changed.');
 if(!data||!Array.isArray(data.rows)||typeof data.generatedAt!=='string'||!data.counts)throw Error('Reconciliation evidence could not be read. Please retry.');
 return data;
}
