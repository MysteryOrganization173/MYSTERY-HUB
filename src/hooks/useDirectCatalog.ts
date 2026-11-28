import {useEffect,useSyncExternalStore} from 'react';
import {DATA_BUNDLES} from '../data/bundles';
import {commercialRequest} from '../services/commercialApi';
import type {DataBundle} from '../types';
import {onServiceStatusChange,purchasePaused} from './useServiceStatus';
// 3.6.3: a network whose Data is paused in the Service Control Center is never offered, before or after the server
// answers; the server leaves the same products out of its own catalogue, so a stale page cannot buy them either.
const offered=(b:DataBundle)=>!purchasePaused('data',b.network);
let unfiltered:DataBundle[]=DATA_BUNDLES.slice();
let current=unfiltered.filter(offered);const listeners=new Set<()=>void>();
onServiceStatusChange(()=>{current=unfiltered.filter(offered);for(const listener of listeners)listener();});
let request:Promise<void>|null=null;
// True once this page has the server's own catalogue (until then `current` is the bundled fallback list).
let confirmed=false;
/** The server's active price campaign (December Specials), or null. Never set by the client. */
export interface DirectCampaignSummary {id:string;label:string;title:string;endDate:string|null;maxSavingPercent:number|null}
let campaign:DirectCampaignSummary|null=null;
// One pending refresh at the campaign's end, so an open page drops December prices and badges at the boundary.
let boundary:ReturnType<typeof setTimeout>|null=null;
/** Delay until the server says the campaign stops applying, measured on the server's clock (never the device's date). */
export function campaignRefreshDelay(c:any):number|null{
 const end=Date.parse(c?.endsAt),now=Date.parse(c?.serverTime);
 if(!Number.isFinite(end)||!Number.isFinite(now))return null;
 const delay=end-now;return delay>0&&delay<=7*86_400_000?delay+1500:null;
}
/** Whether the catalogue on screen came from the server, so derived figures (e.g. "up to X% off") can rely on it. */
export const directCatalogConfirmed=()=>confirmed;
export const directCampaign=()=>confirmed?campaign:null;
/** A campaign price is shown only when the server says it applies and it is a genuine reduction. */
function campaignFields(p:any):Pick<DataBundle,'standardPriceGhc'|'priceCampaign'>{
 const ok=p?.campaign&&typeof p.campaign.label==='string'&&Number.isSafeInteger(p.standardPesewas)&&Number.isSafeInteger(p.amountPesewas)&&p.standardPesewas>p.amountPesewas;
 return ok?{standardPriceGhc:p.standardPesewas/100,priceCampaign:{label:p.campaign.label,stacksWithWelcome:p.campaign.stacksWithWelcome===true}}:{};
}
/** New server-only plans need size/filter metadata even without a bundled fallback card. */
export function projectDirectCatalogBundle(p:any):DataBundle|null {
 const existing=DATA_BUNDLES.find(b=>b.id===p.id);
 if(existing){
  const {standardPriceGhc:_s,priceCampaign:_c,...base}=existing;
  return {...base,id:p.id,network:p.network,dataAmount:p.dataAmount,priceGhc:p.priceGhc,...campaignFields(p)};
 }
 const size=typeof p.dataAmount==='string'?/^(\d+(?:\.\d+)?)(GB|MB)$/.exec(p.dataAmount):null;
 if(!size||!['mtn','telecel','airteltigo'].includes(p.network))return null;
 const mb=Number(size[1])*(size[2]==='GB'?1024:1);
 if(!Number.isFinite(mb)||mb<=0)return null;
 return {
  id:p.id,network:p.network,dataAmount:p.dataAmount,dataBytesValue:mb,
  validity:p.validity??'',validityCategory:'Monthly',priceGhc:p.priceGhc,
  description:p.description,serviceType:'data',...campaignFields(p),
 };
}
export async function refreshDirectCatalog(){
 if(request)return request;
 request=commercialRequest('commercial/products').then(result=>{
  // Rebuilt from the static fields only: campaign fields come from this response alone, so none outlives the campaign.
  unfiltered=result.products.map(projectDirectCatalogBundle).filter((p:DataBundle|null):p is DataBundle=>p!==null);
  current=unfiltered.filter(offered);
  const c=result.campaign;campaign=c&&typeof c.label==='string'&&typeof c.title==='string'?{id:String(c.id),label:c.label,title:c.title,endDate:typeof c.endDate==='string'?c.endDate:null,maxSavingPercent:Number.isSafeInteger(c.maxSavingPercent)&&c.maxSavingPercent>0?c.maxSavingPercent:null}:null;
  confirmed=true;
  if(boundary){clearTimeout(boundary);boundary=null;}
  const delay=campaignRefreshDelay(c);if(delay!==null)boundary=setTimeout(()=>{boundary=null;void refreshDirectCatalog().catch(()=>{});},delay);
  // Consumers outside React read the same latest price projection.
  for(const b of DATA_BUNDLES){const p=current.find(x=>x.id===b.id);if(p){b.priceGhc=p.priceGhc;if(p.priceCampaign){b.standardPriceGhc=p.standardPriceGhc;b.priceCampaign=p.priceCampaign;}else{delete b.standardPriceGhc;delete b.priceCampaign;}}}
  for(const listener of listeners)listener();
 }).finally(()=>{request=null;});return request;
}
/**
 * 3.7.3: one refresh schedule for the whole page, however many parts show the catalogue (the homepage's featured Data,
 * the Data page and the seasonal homepages each used to start their own minute timer and focus listener, so a page
 * could ask several times a minute). The catalogue is still re-read every minute while visible and when the customer returns,
 * and a newly shown part (or a minute tick just after a return) reuses an answer under 30 s old instead of asking again.
 * Checkout asks the server for its own quote either way; this only decides how often the shelf itself is refreshed.
 */
export const CATALOG_REFRESH_MS=60_000,CATALOG_REUSE_MS=30_000;
let lastAnswerAt=0,users=0,refreshTimer:ReturnType<typeof setInterval>|null=null;
const hidden=()=>typeof document!=='undefined'&&document.visibilityState==='hidden';
/** Asks again unless an answer arrived in the last 30 s (or the page is in the background, for the timer). */
function refreshIfDue(){if(hidden()||(confirmed&&Date.now()-lastAnswerAt<CATALOG_REUSE_MS))return;void refreshDirectCatalog().then(()=>{lastAnswerAt=Date.now();}).catch(()=>{});}
const onReturn=()=>{if(!hidden())refreshIfDue();};
/** Starts (or joins) the page's one schedule; returns the part's release. Exported for tests. */
export function startCatalogSchedule(){
 users++;refreshIfDue();
 if(users===1&&typeof window!=='undefined'){refreshTimer=setInterval(refreshIfDue,CATALOG_REFRESH_MS);window.addEventListener('focus',onReturn);document.addEventListener('visibilitychange',onReturn);}
 return()=>{users--;if(users===0&&refreshTimer){clearInterval(refreshTimer);refreshTimer=null;window.removeEventListener('focus',onReturn);document.removeEventListener('visibilitychange',onReturn);}};
}
export function useDirectCatalog(){
 const result=useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>current,()=>current);
 useEffect(startCatalogSchedule,[]);
 return result;
}
