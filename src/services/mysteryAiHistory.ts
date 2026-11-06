import {API_BASE_URL} from './apiClient';
import type {AiReplyStyle} from '../../shared/mysteryAiPrivacy';

export type SavedChat = {id:string;title:string;updatedAt?:string};
export type SavedTurn = {id:string;question:string;reply:string;createdAt:string};
export type TurnToSave = {requestId:string;question:string;reply:string};

async function request<T>(token:string,path:string,signal:AbortSignal,method='GET',body?:unknown):Promise<T> {
  const response=await fetch(`${API_BASE_URL}/api/mystery-ai/history${path}`,{
    method,signal:AbortSignal.any([signal,AbortSignal.timeout(8000)]),cache:'no-store',headers:{Authorization:`Bearer ${token}`,...(body!==undefined?{'Content-Type':'application/json'}:{})},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  if(!response.ok){
    const error=await response.json().catch(()=>null);
    throw Error(typeof error?.error==='string'?error.error:'Could not access saved chats. Try again.');
  }
  return response.json();
}
export const aiHistory={
  list:(token:string,signal:AbortSignal)=>request<{conversations:SavedChat[];style:AiReplyStyle|null}>(token,'',signal),
  create:(token:string,id:string,signal:AbortSignal)=>request<SavedChat>(token,'',signal,'POST',{id,title:'New saved chat'}),
  read:(token:string,id:string,signal:AbortSignal)=>request<SavedChat&{turns:SavedTurn[]}>(token,`/${id}`,signal),
  append:(token:string,id:string,turn:TurnToSave,signal:AbortSignal)=>request<{saved:boolean}>(token,`/${id}/turns`,signal,'POST',turn),
  rename:(token:string,id:string,title:string,signal:AbortSignal)=>request<SavedChat>(token,`/${id}`,signal,'PATCH',{title}),
  remove:(token:string,id:string,signal:AbortSignal)=>request<{deleted:boolean}>(token,`/${id}`,signal,'DELETE'),
  preference:(token:string,style:AiReplyStyle|null,signal:AbortSignal)=>request<{style:AiReplyStyle|null}>(token,'/preference',signal,'PUT',{style}),
};
