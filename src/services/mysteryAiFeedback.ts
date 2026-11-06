import {API_BASE_URL} from './apiClient';
import type {AiFeedbackCategory,AiFeedbackReport} from '../../shared/mysteryAiFeedback';

async function request<T>(token:string,path:string,signal:AbortSignal,method='GET',body?:unknown):Promise<T>{
  const response=await fetch(`${API_BASE_URL}/api/mystery-ai/feedback${path}`,{method,cache:'no-store',
    signal:AbortSignal.any([signal,AbortSignal.timeout(8000)]),
    headers:{Authorization:`Bearer ${token}`,...(body!==undefined?{'Content-Type':'application/json'}:{})},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  if(!response.ok){
    const result=await response.json().catch(()=>null);
    throw Error(typeof result?.error==='string'?result.error:'Could not use Mystery AI feedback. Try again.');
  }
  return response.json();
}
export type FeedbackInput={reference:string;category:AiFeedbackCategory;note?:string;shareAnswer:boolean;answer?:string};
export const submitAiFeedback=(token:string,input:FeedbackInput,signal:AbortSignal)=>request<{reference:string}>(token,'',signal,'POST',input);
export const listAiFeedback=(token:string,signal:AbortSignal)=>request<{reports:AiFeedbackReport[]}>(token,'/admin',signal);
export const reviewAiFeedback=(token:string,id:string,signal:AbortSignal)=>request<{reviewed:boolean}>(token,`/admin/${encodeURIComponent(id)}`,signal,'PATCH',{status:'reviewed'});
