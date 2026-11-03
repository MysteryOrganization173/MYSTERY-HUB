/** Synthetic, local-only browser data; no production financial account or provider traffic. */
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AdminFinanceSection} from '../../../../src/components/admin/sections/AdminFinanceSection';
import {RECONCILIATION_GROUPS,RECONCILIATION_REASONS,type ReconciliationRow} from '../../../../shared/financeReconciliation';
const at=new Date().toISOString(),codes=['completed','manual_fulfillment','unpaid_closed','awaiting','progressing','completed','completed','completed','completed','completed'];
const rows:ReconciliationRow[]=Array.from({length:55},(_,i)=>{
 const code=i===2?'delivery_incomplete':i===3?'remedy_open':codes[i%codes.length],d=RECONCILIATION_REASONS[code];
 return {key:`order:ord_browser_${i}`,orderReference:`MH-FIN-BROWSER-${i}`,operationId:null,financeUserId:null,service:'data',recordType:'order',amountMinor:1200,currency:'GHS',paymentStatus:['unpaid_closed','awaiting'].includes(code)?'pending':'success',fulfillmentStatus:code==='manual_fulfillment'?'failed':code==='completed'?'delivered':code==='awaiting'?'pending_payment':'processing',marketplaceStatus:null,operationState:null,createdAt:at,updatedAt:at,paidAt:code==='awaiting'?null:at,deliveredAt:code==='completed'?at:null,resolutionAt:code==='manual_fulfillment'?at:null,archived:code==='manual_fulfillment',code,group:d.group,label:d.label,explanation:d.explanation,requiresInvestigation:['needs_review','evidence_unavailable'].includes(d.group)};
});
const d=RECONCILIATION_REASONS.funding_uncertain;rows.push({key:'operation:fin_BROWSER_TOPUP',orderReference:null,operationId:'fin_BROWSER_TOPUP',financeUserId:'fixture-owner',service:'wallet_funding',recordType:'topup',amountMinor:1000,currency:'GHS',paymentStatus:null,fulfillmentStatus:null,marketplaceStatus:null,operationState:'initialization_uncertain',createdAt:at,updatedAt:at,paidAt:null,deliveredAt:null,resolutionAt:null,archived:false,code:'funding_uncertain',...d,requiresInvestigation:true});
const fixture={requests:[] as Array<{path:string;method:string}>,writes:0,failNext:false,slowNext:false,refreshed:false,setToken:(_token:string)=>{}};
(window as any).__financeFixture=fixture;
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status});
window.fetch=async(input,options)=>{
 const url=new URL(String(input),location.origin),path=url.pathname,method=options?.method||'GET';fixture.requests.push({path:path+url.search,method});
 if(method!=='GET'){fixture.writes++;throw Error('Financial writes are forbidden in this browser fixture');}
 if((options?.headers as any)?.Authorization!=='Bearer synthetic-admin')return json({error:'Unauthorized'},403);
 if(path==='/api/admin/finance/reconciliation'){
  if(fixture.failNext){fixture.failNext=false;return json({error:'Synthetic reporting unavailable; no records changed.'},503);}
  if(fixture.slowNext){fixture.slowNext=false;await new Promise(r=>setTimeout(r,700));} // Intentionally ignore AbortSignal.
  const reference=url.searchParams.get('reference')||'',filter=url.searchParams.get('filter')||'all',offset=Number(url.searchParams.get('offset')||0);
  if(reference&&!/^(?:MH[-_][A-Za-z0-9_-]+|fin_[A-Za-z0-9_-]+)$/.test(reference))return json({error:'Use a valid exact order reference or finance ID and bounded page.'},400);
  const scope=rows.filter(r=>!reference||r.orderReference===reference||r.operationId===reference),visible=scope.filter(r=>filter==='all'||r.group===filter||filter==='attention'&&r.requiresInvestigation);
  return json({generatedAt:new Date().toISOString(),scope:'All synthetic records including archived history. No live provider verification.',counts:Object.fromEntries(Object.keys(RECONCILIATION_GROUPS).map(g=>[g,scope.filter(r=>r.group===g).length])),total:scope.length,filteredTotal:visible.length,rows:visible.slice(offset,offset+25).map(r=>fixture.refreshed?{...r,updatedAt:'2026-11-02T12:34:56Z'}:r),limit:25,offset});
 }
 if(path==='/api/admin/finance/control')return location.search.includes('control-fail')?json({error:'Synthetic finance summary unavailable'},503):json({metrics:{walletLiabilityMinor:1000,availableEarnLiabilityMinor:200,storeEarningsLiabilityMinor:300},settings:{withdrawalMinimumMinor:500,withdrawalFeeBps:300,topupMinimumMinor:100,topupMaximumMinor:100000},definitions:[],economics:[]});
 if(path==='/api/admin/finance/withdrawals'||path==='/api/admin/finance/operations')return json([]);
 if(path==='/api/admin/finance/customers/fixture-owner')return json({walletMinor:1000,restricted:false,earn:{availableMinor:0,reservedMinor:0},ledger:[],withdrawals:[],earnLedger:[]});
 throw Error('Unexpected synthetic API request: '+path);
};
function App(){const [token,setToken]=useState('synthetic-admin');fixture.setToken=setToken;return <><header className="sticky top-0 z-40 h-16 bg-slate-950 p-4">Hub Admin</header><main className="p-4"><AdminFinanceSection sessionToken={token} initialView={new URLSearchParams(location.search).get('view')||undefined}/></main></>;}
createRoot(document.getElementById('root')!).render(<App/>);
