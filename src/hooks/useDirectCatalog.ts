import {useEffect,useSyncExternalStore} from 'react';
import {DATA_BUNDLES} from '../data/bundles';
import {commercialRequest} from '../services/commercialApi';
import type {DataBundle} from '../types';
let current=DATA_BUNDLES.slice();const listeners=new Set<()=>void>();
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
export async function refreshDirectCatalog(){
 if(request)return request;
 request=commercialRequest('commercial/products').then(result=>{
  // Rebuilt from the static fields only: campaign fields come from this response alone, so none outlives the campaign.
  current=result.products.map((p:any)=>{const {standardPriceGhc:_s,priceCampaign:_c,...base}=(DATA_BUNDLES.find(b=>b.id===p.id)||{}) as DataBundle;return {...base,id:p.id,network:p.network,dataAmount:p.dataAmount,priceGhc:p.priceGhc,...campaignFields(p)};});
  const c=result.campaign;campaign=c&&typeof c.label==='string'&&typeof c.title==='string'?{id:String(c.id),label:c.label,title:c.title,endDate:typeof c.endDate==='string'?c.endDate:null,maxSavingPercent:Number.isSafeInteger(c.maxSavingPercent)&&c.maxSavingPercent>0?c.maxSavingPercent:null}:null;
  confirmed=true;
  if(boundary){clearTimeout(boundary);boundary=null;}
  const delay=campaignRefreshDelay(c);if(delay!==null)boundary=setTimeout(()=>{boundary=null;void refreshDirectCatalog().catch(()=>{});},delay);
  // Consumers outside React read the same latest price projection.
  for(const b of DATA_BUNDLES){const p=current.find(x=>x.id===b.id);if(p){b.priceGhc=p.priceGhc;if(p.priceCampaign){b.standardPriceGhc=p.standardPriceGhc;b.priceCampaign=p.priceCampaign;}else{delete b.standardPriceGhc;delete b.priceCampaign;}}}
  for(const listener of listeners)listener();
 }).finally(()=>{request=null;});return request;
}
export function useDirectCatalog(){
 const result=useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>current,()=>current);
 useEffect(()=>{const refresh=()=>{void refreshDirectCatalog().catch(()=>{});};refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
 return result;
}
