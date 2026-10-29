import {API_BASE_URL} from './apiClient';
import type {GrowthReport} from '../../shared/growthAnalytics';
export async function getGrowthReport(token:string,range:number,signal?:AbortSignal):Promise<GrowthReport>{
 const r=await fetch(`${API_BASE_URL}/api/admin/analytics?range=${range}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal});
 if(!r.ok)throw Error([401,403].includes(r.status)?'Your staff session cannot access analytics. Sign in again.':'Analytics could not load. Please retry.');
 const b=await r.json();if(b.success!==true||!b.report||b.report.range!==range||!Array.isArray(b.report.warnings))throw Error('Analytics returned an incomplete report. Please retry.');return b.report;
}
