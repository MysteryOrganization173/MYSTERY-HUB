import {API_BASE_URL} from './apiClient';
export async function contactRequest<T>(token:string,path:string,body:unknown,signal?:AbortSignal):Promise<T>{
 const r=await fetch(`${API_BASE_URL}/api/admin/contacts/${path}`,{method:'POST',cache:'no-store',signal,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.error||'Contacts could not be loaded. Try again later.');}
 return (path==='export'?r.text():r.json()) as Promise<T>;
}
