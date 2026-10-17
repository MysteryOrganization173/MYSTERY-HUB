import {API_BASE_URL} from './apiClient';
export async function operationsRequest<T=any>(token:string,path:string,body?:unknown):Promise<T>{
 const res=await fetch(`${API_BASE_URL}/api/admin/operations/${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!res.headers.get('content-type')?.includes('application/json'))throw new Error('Admin service returned an unexpected response. Reload and try again.');
 const data=await res.json();if(!res.ok)throw new Error(data.error||'Admin operation failed. Check its history before retrying.');return data;
}
