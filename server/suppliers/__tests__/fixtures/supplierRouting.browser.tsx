import React from 'react';
import {createRoot} from 'react-dom/client';
import {AdminSupplierRouting} from '../../../../src/components/admin/sections/AdminSupplierRouting';
import {SUPPLIER_SERVICES, SUPPLIER_NETWORKS} from '../../../../shared/supplierRouting';
Object.assign(window,{__routingCalls:0,__routingMode:'success',__routingPending:[]});
window.fetch=async(input:any,options:any)=>{
  if(!String(input).endsWith('/api/admin/commercial/supplier-routing')||options.method!=='GET')throw Error('Only synthetic routing GET permitted');
  (window as any).__routingCalls++;
  if((window as any).__routingMode==='hold')await new Promise(r=>(window as any).__routingPending.push(r));
  if((window as any).__routingMode==='error')return new Response('{"error":"Fixture unavailable"}',{status:503});
  const snapshot={mode:'read_only',providers:[{id:'success_biz_hub',name:'Success Biz Hub',implementedServices:SUPPLIER_SERVICES,plannedServices:[],networks:SUPPLIER_NETWORKS,configured:true,qualified:true,acceptsNewOrders:true,restriction:'Existing fulfillment configuration, preflight and payment safeguards remain required.'},{id:'telcogh',name:'TELCOGH',implementedServices:[],plannedServices:['data','airtime'],networks:[],configured:false,qualified:false,acceptsNewOrders:false,restriction:'Not integrated or qualified. Activation is unavailable in this release.'}],routes:SUPPLIER_SERVICES.flatMap(service=>SUPPLIER_NETWORKS.map(network=>({service,network,providerId:'success_biz_hub'})))};
  return new Response(JSON.stringify((window as any).__routingMode==='malformed'?{...snapshot,providers:[null]}:snapshot));
};
createRoot(document.getElementById('root')!).render(<main className="min-h-screen bg-slate-950 p-3 text-white sm:p-6"><p className="mb-3 text-xs">Synthetic review — no production records</p><AdminSupplierRouting token="synthetic-only"/></main>);
