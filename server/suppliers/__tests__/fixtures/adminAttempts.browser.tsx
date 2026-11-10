import React from 'react';
import {createRoot} from 'react-dom/client';
import {AdminRecentOrders} from '../../../../src/components/admin/sections/AdminRecentOrders';
import {AdminOrdersSection} from '../../../../src/components/admin/sections/AdminOrdersSection';
(window as any).__calls=[];(window as any).__hold=false;(window as any).__pending=[];
window.fetch=async(input:any)=>{
 const url=new URL(String(input),location.origin);(window as any).__calls.push(url.search);
 if(url.pathname!='/api/admin/orders')return new Response(JSON.stringify({success:true,items:[],orders:[],authorization:null}));
 const view=url.searchParams.get('paymentView'),all=url.searchParams.get('status')==='all';
 if((window as any).__hold)await new Promise(r=>(window as any).__pending.push(r));
 const rows=Array.from({length:30},(_,i)=>({id:'synthetic-'+i,public_reference:'MH-SYNTH-'+i,product_name_snapshot:!all?'Active fixture':view==='confirmed'?'Paid fixture':view==='not_completed'?'Unpaid fixture':'History fixture',network:'telecel',service_type:'data',amount:1000,status:view==='not_completed'?'cancelled':'delivered',payment_status:view==='not_completed'?'cancelled':'success',payment_provider:'paystack',created_at:'2026-11-10T00:00:00Z',updated_at:'2026-11-10T00:00:00Z',manual_review:false}));
 const page=Number(url.searchParams.get('page')||1),limit=Number(url.searchParams.get('limit')||20);
 const filtered=url.searchParams.get('q')==='none'?[]:rows;
 return new Response(JSON.stringify({success:true,orders:filtered.slice((page-1)*limit,page*limit),pagination:{total:filtered.length,totalPages:filtered.length?Math.ceil(filtered.length/limit):1,page,limit}}));
};
createRoot(document.getElementById('root')!).render(<main className="p-4 text-white"><p>Synthetic review — no customer records</p><AdminRecentOrders token="synthetic" onOpenOrder={()=>{}} onOpenAll={lens=>(window as any).__destination=lens}/><AdminOrdersSection sessionToken="synthetic"/></main>);
