import {growthIdentity} from './growthAnalytics';
import {getActiveSessionToken} from './authStorage';
const KEY='mh_campaign_touch_v1',WINDOW=7*86400000,uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let account:string|null|undefined,staff=false,generation=0,pending=0,queue=Promise.resolve();
const allowed=()=>typeof window!=='undefined'&&!staff&&navigator.doNotTrack!=='1'&&(navigator as any).globalPrivacyControl!==true&&!/^\/admin(?:\/|$)/i.test(location.pathname)&&!/[?&](?:isolated_template_preview|preview_template_id|owner_preview|editor_channel)=/.test(location.search);
function read(){try{const row=JSON.parse(localStorage.getItem(KEY)||'null');if(!row||!/^[-A-Za-z0-9_]{43}$/.test(row.token)||typeof row.expiresAt!=='number'||row.expiresAt<=Date.now()||row.expiresAt>Date.now()+WINDOW)return null;return row as {token:string;expiresAt:number};}catch{return null;}}
export function campaignSession(userId:string|null,isStaff=false){staff=isStaff;if(account!==undefined&&account!==null&&account!==userId){generation++;try{localStorage.removeItem(KEY);}catch{}}account=userId;}
/** Capture before route bundles/images load; remove only our token, preserving referrals/deep links. */
export function captureCampaignToken(){
 if(typeof window==='undefined')return;
 try{const url=new URL(location.href),token=url.searchParams.get('campaign_touch');if(!allowed()){localStorage.removeItem(KEY);}else if(token&&/^[-A-Za-z0-9_]{43}$/.test(token)){growthIdentity(localStorage,sessionStorage);localStorage.setItem(KEY,JSON.stringify({token,expiresAt:Date.now()+WINDOW}));}
  if(url.searchParams.has('campaign_touch')){url.searchParams.delete('campaign_touch');history.replaceState(history.state,'',url.pathname+url.search+url.hash);}
 }catch{/* No storage means unsupported attribution, never a blocked customer journey. */}
}
function observation(event:'visit'|'checkout',siteId?:string,attemptId?:string){
 try{if(!allowed())return;const row=read();if(!row)return;const ids=growthIdentity(localStorage,sessionStorage),epoch=generation,auth=getActiveSessionToken();if(pending>=8)return;pending++;
  const base=(import.meta.env?.VITE_API_BASE_URL||'').replace(/\/$/,''),body=JSON.stringify({event,token:row.token,...ids,...(siteId?{siteId}:{}),...(attemptId?{attemptId}:{})});
  queue=queue.catch(()=>{}).then(async()=>{if(epoch!==generation)return;await fetch(base+'/api/campaigns/events',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},body,keepalive:true,signal:AbortSignal.timeout(3000)});}).catch(()=>{}).finally(()=>pending--);
 }catch{}
}
export function campaignLanding(siteId?:string){captureCampaignToken();observation('visit',siteId);}
/** Called only at a validated checkout submission, never when viewing a bundle. */
export function campaignCheckoutFields(requestId?:unknown,siteId?:string):Record<string,string>{
 try{if(!allowed())return {};const row=read();if(!row)return {};const ids=growthIdentity(localStorage,sessionStorage),attemptId=typeof requestId==='string'&&uuid.test(requestId)?requestId:crypto.randomUUID();observation('checkout',siteId,attemptId);return {campaignToken:row.token,campaignVisitorId:ids.visitorId,campaignAttemptId:attemptId};}catch{return {};}
}
