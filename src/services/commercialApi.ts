import { API_BASE_URL } from './apiClient';
export async function commercialRequest(path:string,token?:string|null,body?:unknown):Promise<any>{
 const response=await fetch(`${API_BASE_URL}/api/${path}`,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Pricing unavailable.');return result;
}
