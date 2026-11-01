/** Local browser fixture only. Every API call is synthetic; no production credentials or requests. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {AdminSystemSection} from '../../../../src/components/admin/sections/AdminSystemSection';
import type {SalesReliabilityView,SalesState} from '../../../../shared/salesReliability';
const mode=new URLSearchParams(location.search).get('case')||'active',now=Date.now();
const states:Record<string,SalesState>={active:'active',recovering:'recovering',recovered:'recovered',healthy:'healthy',stale:'healthy','wallet-slow':'active','error-after':'active'};
const data:SalesReliabilityView={checkedAt:mode==='stale'?now-120000:now,state:states[mode]||'insufficient_evidence',storage:mode==='unavailable'?'unavailable':'durable',collector:{pending:0,dropped:0,writeFailed:false,lastPersistedAt:now,since:now-3600000},recent:{attempts:5,passed:0,validation:0,unverified:0,failures:5,blocked:5,lastObservedAt:now-1000,lastFreshPassAt:null,categories:[{category:'timeout',count:5}],byService:['data','airtime','instant_bundle'].map(service=>({service:service as any,attempts:service==='data'?5:0,lastFreshPassAt:null}))},incidents:[],externalAlerts:'admin_only'};
if(['active','recovering','recovered','wallet-slow','error-after'].includes(mode))data.incidents=[{id:'synthetic-incident',service:'data',stage:'services',category:'timeout',firstFailureAt:now-300000,lastFailureAt:now-120000,affectedAttempts:5,blockedAttempts:5,firstRecoveryAt:mode==='recovering'||mode==='recovered'?now-90000:null,lastRecoveryAt:mode==='recovering'?now-90000:mode==='recovered'?now-1000:null,recoveredAt:mode==='recovered'?now-1000:null,state:states[mode]||'active'}];
if(mode==='empty'||mode==='healthy'||mode==='stale'){data.recent={...data.recent,attempts:0,failures:0,blocked:0,categories:[],lastObservedAt:null,byService:data.recent.byService.map(s=>({...s,attempts:0}))};}
if(mode==='healthy'||mode==='stale'){data.recent.attempts=1;data.recent.passed=1;data.recent.lastFreshPassAt=data.checkedAt;data.recent.lastObservedAt=data.checkedAt;data.recent.byService[0]={service:'data',attempts:1,lastFreshPassAt:data.checkedAt};}
let reads=0;
window.fetch=async(input)=>{
  const path=String(input);
  if(path.endsWith('/sales-reliability')){
    if(mode==='loading')return new Promise(()=>{});
    if(mode==='error'||mode==='error-after'&&reads++>0)throw Error('Synthetic unavailable');
    return new Response(JSON.stringify({success:true,data}),{status:200});
  }
  if(path.endsWith('/system')){
    if(mode==='wallet-slow')return new Promise(()=>{});
    return new Response(JSON.stringify({success:true,system:{environment:'synthetic',nodeVersion:'fixture',uptimeSeconds:300,components:{apiServer:{status:'healthy',label:'Online'},database:{status:'connected',type:'Synthetic PostgreSQL'},paystack:{status:'configured',mode:'Live',currency:'GHS'},successBizHub:{status:'connected',walletBalanceGhc:1000,isLowBalance:false,lowBalanceThresholdGhc:100},geminiAi:{status:'configured',model:'Synthetic'},fulfilmentPipeline:{status:'enabled',autoDispatch:true,uncertainSubmissionCount:0}}}}),{status:200});
  }
  if(path.endsWith('/audit-logs'))return new Response(JSON.stringify({success:true,logs:[]}),{status:200});
  throw Error('Unexpected fixture request');
};
createRoot(document.getElementById('root')!).render(<main className="min-w-0 p-4"><AdminSystemSection sessionToken="synthetic-admin-only"/></main>);
