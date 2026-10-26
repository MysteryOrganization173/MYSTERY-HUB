import {API_BASE_URL} from './apiClient';
export class NotificationHttpError extends Error {constructor(message:string,readonly status:number){super(message);}}
/** Private APIs always use the actual current Bearer session, never cookies or a cached staff identity. */
export async function notificationHttp(token:string|null,path:string,method='GET',body?:unknown,signal?:AbortSignal){
 if(token!==null&&!token)throw new NotificationHttpError('Sign in before managing notifications.',401);
 const response=await fetch(`${API_BASE_URL}/api/${path}`,{method,cache:'no-store',signal,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new NotificationHttpError(data?.error||'Could not confirm the notification request. Refresh before trying again.',response.status);
 if(!data||typeof data!=='object')throw new NotificationHttpError('Invalid notification response.',503);
 return data;
}
