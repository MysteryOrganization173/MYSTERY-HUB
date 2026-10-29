import {GROWTH_PAGES,GROWTH_SOURCES,GROWTH_MEDIA,campaignSlug,type GrowthEvent,type GrowthMetadata,type GrowthPage} from '../../shared/growthAnalytics';
const VISITOR='mh_analytics_visitor',SESSION='mh_analytics_session',LAST='mh_growth_last',BORN='mh_growth_born',CAMPAIGN='mh_growth_campaign';
const IDLE=30*60_000,AGE=90*86400_000;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let token:string|null=null,account:string|null|undefined,muted=false;
let queue=Promise.resolve(),pending=0,generation=0;
const sent=new Map<string,number>();
export function growthAllowed(path:string,search='',dnt:string|null=null){return dnt!=='1'&&!/^\/(?:sites(?:\/|$)|admin(?:\/|$))/.test(path)&&!/[?&](isolated_template_preview|preview_template_id)=/.test(search);}
export function growthIdentity(local:Storage,session:Storage,now=Date.now(),makeId=()=>crypto.randomUUID()) {
 let visitorId=local.getItem(VISITOR),sessionId=session.getItem(SESSION);const born=Number(local.getItem(BORN)||now),last=Number(session.getItem(LAST)||0);
 if(!visitorId||!uuid.test(visitorId)||now-born>=AGE){visitorId=makeId();local.setItem(VISITOR,visitorId);local.setItem(BORN,String(now));sessionId=null;}else if(!local.getItem(BORN))local.setItem(BORN,String(now));
 if(!sessionId||!uuid.test(sessionId)||now-last>=IDLE){sessionId=makeId();session.setItem(SESSION,sessionId);session.removeItem(CAMPAIGN);}
 session.setItem(LAST,String(now));return {visitorId,sessionId};
}
export function parseGrowthCampaign(search:string,referrer:string,origin:string){
 const p=new URLSearchParams(search),source=p.get('utm_source')?.toLowerCase(),medium=p.get('utm_medium')?.toLowerCase(),campaign=campaignSlug(p.get('utm_campaign'));
 if(source&&GROWTH_SOURCES.includes(source as any))return {source,medium:GROWTH_MEDIA.includes(medium as any)?medium:'other',...(campaign?{campaign}:{})};
 let host='';try{const r=new URL(referrer);if(r.origin===origin)return null;host=r.hostname.toLowerCase();}catch{}
 const known:[RegExp,string][]=[[/^(?:[\w-]+\.)?google\.[a-z.]+$/,'google'],[/^(?:[\w-]+\.)?bing\.com$/,'bing'],[/^(?:[\w-]+\.)?facebook\.com$/,'facebook'],[/^(?:[\w-]+\.)?instagram\.com$/,'instagram'],[/^(?:[\w-]+\.)?whatsapp\.com$/,'whatsapp'],[/^(?:[\w-]+\.)?youtube\.com$/,'youtube']];
 return {source:known.find(([re])=>re.test(host))?.[1]||(host?'other':'direct'),medium:host?'referral':'none'};
}
export function growthSession(authToken:string|null,userId:string|null,isStaff=false){
 muted=isStaff;token=authToken;
 if(account!==undefined&&account!==null&&account!==userId){generation++;sent.clear();try{sessionStorage.removeItem(SESSION);sessionStorage.removeItem(CAMPAIGN);}catch{}}
 account=userId;
}
export function trackGrowth(event:GrowthEvent,metadata:Partial<GrowthMetadata>={}) {
 try{
  if(typeof window==='undefined'||muted||!growthAllowed(location.pathname,location.search,navigator.doNotTrack))return;
  const ids=growthIdentity(localStorage,sessionStorage),now=Date.now();
  const page=(GROWTH_PAGES.includes(metadata.page as any)?metadata.page:'home') as GrowthPage;
  const once=['identity','standalone_launch','installed','install_prompt','install_accepted','install_dismissed'].includes(event);
  const key=[ids.sessionId,event,once?'session':page,metadata.productId||'',event==='identity'?account||'':''].join(':');
  const ttl=once?IDLE:30_000;
  if(now-(sent.get(key)||0)<ttl)return;if(sent.size>150)sent.clear();sent.set(key,now);
  let campaign:any;try{campaign=JSON.parse(sessionStorage.getItem(CAMPAIGN)||'null');}catch{}
  if(campaign){campaign=GROWTH_SOURCES.includes(campaign.source)&&GROWTH_MEDIA.includes(campaign.medium)?{source:campaign.source,medium:campaign.medium,...(campaignSlug(campaign.campaign)?{campaign:campaignSlug(campaign.campaign)}:{})}:null;}
  if(!campaign){campaign=parseGrowthCampaign(location.search,document.referrer,location.origin)||{source:'direct',medium:'none'};sessionStorage.setItem(CAMPAIGN,JSON.stringify(campaign));}
  const base=(import.meta.env?.VITE_API_BASE_URL||'').replace(/\/$/,'');
  const display=window.matchMedia?.('(display-mode: standalone)').matches||(navigator as any).standalone===true?'standalone':'web';
  const auth=token,epoch=generation,body=JSON.stringify({event,...ids,metadata:{page,...campaign,display,promptSupport:'onbeforeinstallprompt' in window?'yes':'no',...(metadata.productId?{productId:metadata.productId}:{})}});
  if(pending>=12)return;pending++;
  queue=queue.catch(()=>{}).then(async()=>{if(epoch!==generation)return;await fetch(base+'/api/analytics/events',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},body,keepalive:true,signal:AbortSignal.timeout(4000)});}).catch(()=>{}).finally(()=>{pending--;});
 }catch{/* Storage, privacy preferences or analytics failure never control the product journey. */}
}
