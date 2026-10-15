import {API_BASE_URL} from './apiClient';
import type {WebsiteSiteRecord} from '../types/index.js';
import type {websiteStarter} from '../config/websiteStarters.js';
import type {websiteExampleReview,WebsiteLayoutMode} from '../utils/websiteLayout.js';
import type {websiteMigrationSummary} from '../utils/websiteTemplateMigration.js';
export class WebsiteB1Error extends Error {
  constructor(message:string,public status:number,public code?:string,public review?:ReturnType<typeof websiteExampleReview>){super(message);}
}
/** Dedicated engineering contracts; no UI, payment, publisher or second draft state. */
async function request<T>(path:string,token?:string,body?:unknown,method=body?'POST':'GET'):Promise<T> {
  const response=await fetch(`${API_BASE_URL}/api/websites${path}`,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.headers.get('content-type')?.includes('application/json'))throw new WebsiteB1Error('Website services returned an unexpected response.',response.status);
  const result=await response.json();if(!response.ok)throw new WebsiteB1Error(result.error||'Website action failed.',response.status,result.code,result.review);
  return result;
}
export const getWebsiteStarter=(templateId:string)=>request<ReturnType<typeof websiteStarter>&{success:true}>(`/starter-preview?templateId=${encodeURIComponent(templateId)}`);
/** Optional `content` uses the existing validated owner fields (e.g. whatsapp, location). */
export const createWebsiteStarter=(token:string,templateId:string,businessName:string,starterVersion:number,content?:Partial<WebsiteSiteRecord['content_json']>)=>request<{success:true;site:WebsiteSiteRecord;alreadyExists:boolean}>('',token,{templateId,businessName,starterVersion,...(content&&Object.keys(content).length?{content}:{})});
export const getWebsitePublicationReadiness=(token:string,id:string)=>request<{success:true;revision:string;layoutMode:WebsiteLayoutMode;canPublish:boolean;review:ReturnType<typeof websiteExampleReview>}>(`/${encodeURIComponent(id)}/publication-readiness`,token);
export const setWebsiteLayout=(token:string,id:string,expectedUpdatedAt:string,mode:WebsiteLayoutMode)=>request<{success:true;site:WebsiteSiteRecord}>(`/${encodeURIComponent(id)}/layout`,token,{expectedUpdatedAt,mode,confirmed:true});
export const reviewWebsiteExamples=(token:string,id:string,expectedUpdatedAt:string,itemIds:string[],action:'confirm'|'remove')=>request<{success:true;site:WebsiteSiteRecord}>(`/${encodeURIComponent(id)}/review-examples`,token,{expectedUpdatedAt,itemIds,action,confirmed:true});
export interface WebsiteCheckpointSummary {id:string;templateId:string;name:string;sourceRevision:string;reason:string;createdAt:string}
export const getWebsiteTemplatePlan=(token:string,id:string,targetTemplateId:string)=>request<{success:true;revision:string;summary:ReturnType<typeof websiteMigrationSummary>;content:WebsiteSiteRecord['content_json'];settings:WebsiteSiteRecord['settings_json'];publishedTemplateId:string|null;recoverable:WebsiteCheckpointSummary[];checkpointSlotsRemaining:number}>(`/${encodeURIComponent(id)}/template-plan?targetTemplateId=${encodeURIComponent(targetTemplateId)}`,token);
/** Uses the existing publish endpoint; preserves its structured example-review error. */
export const publishWebsiteB1=(token:string,id:string,expectedUpdatedAt:string)=>request<{success:true;site:WebsiteSiteRecord}>(`/${encodeURIComponent(id)}/publish`,token,{expectedUpdatedAt});
export const getWebsiteCheckpoints=(token:string,id:string)=>request<{success:true;limit:number;checkpoints:WebsiteCheckpointSummary[]}>(`/${encodeURIComponent(id)}/checkpoints`,token);
export const getWebsiteCheckpoint=(token:string,id:string,checkpointId:string)=>request<{success:true;checkpoint:WebsiteCheckpointSummary&{document:{name:string;content:WebsiteSiteRecord['content_json'];settings:WebsiteSiteRecord['settings_json']}}}>(`/${encodeURIComponent(id)}/checkpoints/${encodeURIComponent(checkpointId)}`,token);
export const restoreWebsiteDraft=(token:string,id:string,expectedUpdatedAt:string,checkpointId:string)=>request<{success:true;site:WebsiteSiteRecord}>(`/${encodeURIComponent(id)}/restore-draft`,token,{expectedUpdatedAt,checkpointId,confirmed:true});
export const discardWebsiteCheckpoint=(token:string,id:string,expectedUpdatedAt:string,checkpointId:string)=>request<{success:true}>(`/${encodeURIComponent(id)}/checkpoints/${encodeURIComponent(checkpointId)}`,token,{expectedUpdatedAt,confirmed:true},'DELETE');
