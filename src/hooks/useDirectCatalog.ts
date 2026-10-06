import {useEffect,useSyncExternalStore} from 'react';
import {DATA_BUNDLES} from '../data/bundles';
import {commercialRequest} from '../services/commercialApi';
let current=DATA_BUNDLES.slice();const listeners=new Set<()=>void>();
let request:Promise<void>|null=null;
export async function refreshDirectCatalog(){
 if(request)return request;
 request=commercialRequest('commercial/products').then(result=>{
  current=result.products.map((p:any)=>({...DATA_BUNDLES.find(b=>b.id===p.id),id:p.id,network:p.network,dataAmount:p.dataAmount,priceGhc:p.priceGhc}));
  // Consumers outside React read the same latest price projection.
  for(const b of DATA_BUNDLES){const p=current.find(x=>x.id===b.id);if(p)b.priceGhc=p.priceGhc;}
  for(const listener of listeners)listener();
 }).finally(()=>{request=null;});return request;
}
export function useDirectCatalog(){
 const result=useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>current,()=>current);
 useEffect(()=>{const refresh=()=>{void refreshDirectCatalog().catch(()=>{});};refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
 return result;
}
