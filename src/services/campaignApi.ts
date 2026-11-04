import {API_BASE_URL} from './apiClient';
import type {Campaign,CampaignLink,CampaignSpend,CampaignReport} from '../../shared/campaigns';
export interface CampaignDetail {campaign:Campaign;links:CampaignLink[];spend:CampaignSpend[]}
async function request<T>(token:string,path:string,method='GET',body?:unknown,signal?:AbortSignal):Promise<T>{
 const response=await fetch(API_BASE_URL+'/api/admin/campaigns'+path,{method,headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal});
 const result=await response.json().catch(()=>null);
 if(!response.ok||result?.success!==true)throw Error([401,403].includes(response.status)?'Your staff session cannot access campaigns. Sign in again.':result?.error||'Campaigns could not load. Please retry.');
 return result.data;
}
export const campaignApi={
 list:(token:string,offset=0,signal?:AbortSignal)=>request<{campaigns:Campaign[];total:number;offset:number;limit:number}>(token,'?offset='+offset,'GET',undefined,signal),
 report:(token:string,filters:Record<string,string>,signal?:AbortSignal)=>request<CampaignReport>(token,'/report?'+new URLSearchParams(Object.entries(filters).filter(([,v])=>v)),'GET',undefined,signal),
 detail:(token:string,id:string,signal?:AbortSignal)=>request<CampaignDetail>(token,'/'+encodeURIComponent(id),'GET',undefined,signal),
 create:(token:string,body:unknown)=>request<Campaign>(token,'','POST',body),
 update:(token:string,id:string,body:unknown)=>request<Campaign>(token,'/'+encodeURIComponent(id),'PATCH',body),
 link:(token:string,id:string,body:unknown)=>request<CampaignLink>(token,'/'+encodeURIComponent(id)+'/links','POST',body),
 spend:(token:string,id:string,body:unknown)=>request<CampaignSpend>(token,'/'+encodeURIComponent(id)+'/spend','POST',body),
};
