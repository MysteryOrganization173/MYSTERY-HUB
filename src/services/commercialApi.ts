import { API_BASE_URL } from './apiClient';
export async function commercialRequest(path:string,token?:string|null,body?:unknown,signal?:AbortSignal):Promise<any>{
 const response=await fetch(`${API_BASE_URL}/api/${path}`,{signal,method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json();if(!response.ok){const error=new Error(result.error||'Pricing unavailable.') as Error & {status:number};error.status=response.status;throw error;}return result;
}
