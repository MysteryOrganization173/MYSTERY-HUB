import { API_BASE_URL } from './apiClient';
export interface ManagedCategory { slug:string; label:string; active:boolean; sort_order:number; }
export interface MarketplaceInquiry {
 id:string; product_id?:string; product_name:string; customer_name?:string; customer_phone?:string; customer_email?:string;
 inquiry_type:string; message?:string; budget?:string; status:string; admin_note?:string; created_at:string; updated_at:string; contacted_at?:string;
}
export async function marketplaceControlRequest(path:string,token?:string,method='GET',body?:unknown) {
 const response=await fetch(`${API_BASE_URL}/api/${token?'admin/':''}marketplace/${path}`,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();if(!response.ok)throw new Error(data.error || 'Marketplace request failed.');return data;
}
