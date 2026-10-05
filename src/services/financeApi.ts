import { API_BASE_URL } from './apiClient';
export async function financeRequest<T=any>(token:string,path='',body?:unknown,admin=false):Promise<T> {
  const response=await fetch(`${API_BASE_URL}/api/${admin?'admin/finance':'finance'}${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Financial request unavailable. Check history before retrying.');return data;
}
export async function walletCheckout(token:string,path:string,body:Record<string,unknown>) {
  const response=await fetch(`${API_BASE_URL}/api/${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({...body,paymentMethod:'wallet'})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||data.message||'Wallet payment not confirmed. Check My Orders before retrying.');return data;
}
