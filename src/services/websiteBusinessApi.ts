import { API_BASE_URL } from './apiClient';
export async function websiteBusinessRequest<T=any>(path:string,token?:string,body?:unknown,method=body?'POST':'GET'):Promise<T> {
  const response=await fetch(`${API_BASE_URL}/api/${path}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Website services returned an unexpected response. Please retry.');
  const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error||'Website action failed.'),{existingOrderReference:result.existingOrderReference});return result.data;
}
export function initializeStorePayment(siteId:string,requestId:string,productId:string,recipientPhone:string,customerEmail:string,token?:string){return websiteBusinessRequest(`websites/${encodeURIComponent(siteId)}/store-checkout`,token,{requestId,productId,recipientPhone,customerEmail});}
export function trackPublicWebsite(siteId:string,event:string){
  try{
    const identity=(storage:Storage,key:string)=>{let value=storage.getItem(key);if(!value||!/^[-0-9a-f]{36}$/i.test(value)){value=crypto.randomUUID();storage.setItem(key,value);}return value;};
    void websiteBusinessRequest(`websites/${encodeURIComponent(siteId)}/public-events`,undefined,{event,visitorId:identity(localStorage,'mh_site_visitor'),sessionId:identity(sessionStorage,'mh_site_session')}).catch(()=>{});
  }catch{ /* Anonymous analytics failure cannot block a purchase or contact action. */ }
}

/** Count contact links and explicit primary actions, never every navigation button. */
export function publicWebsiteClickKind(target:Element):string|null {
  const marked=target.getAttribute('data-website-event');if(marked==='whatsapp_click')return marked;
  const href=target.getAttribute('href')||'';
  if(href.startsWith('tel:'))return 'call_click';
  if(href.startsWith('mailto:'))return 'email_click';
  if(/^https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)(\/|$)/i.test(href))return 'whatsapp_click';
  if(target.getAttribute('data-website-primary-cta')==='true'||target.tagName==='A'&&href&&!href.startsWith('#'))return 'primary_cta_click';
  return null;
}
