import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {invalidateAdminOverview,loadAdminOverview,signalsFromOverview} from '../../../src/components/admin/adminSignals.js';
const saved=globalThis.fetch;after(()=>{globalThis.fetch=saved;});
const response=(count:number)=>new Response(JSON.stringify({success:true,metrics:{allTime:{manualReviewPendingCount:count,pendingWaitlist:0},supplier:{isLowBalance:false,status:'unconfigured'}}}),{headers:{'Content-Type':'application/json'}});
test('successful action refresh bypasses the TTL and passive reads never reconcile supplier orders',async()=>{let calls=0;globalThis.fetch=async url=>{assert.match(String(url),/readOnly=true/);return response(++calls===1?1:0);};assert.equal(signalsFromOverview((await loadAdminOverview('synthetic-signals')).metrics).ordersAttention,1);await loadAdminOverview('synthetic-signals');assert.equal(calls,1);assert.equal(signalsFromOverview((await loadAdminOverview('synthetic-signals',true)).metrics).ordersAttention,0);assert.equal(calls,2);});
test('older forced response cannot replace newer navigation signals',async()=>{let older!:(r:Response)=>void,newer!:(r:Response)=>void,calls=0;globalThis.fetch=async()=>new Promise<Response>(resolve=>{if(++calls===1)older=resolve;else newer=resolve;});const a=loadAdminOverview('synthetic-ordering',true),b=loadAdminOverview('synthetic-ordering',true);newer(response(0));await b;older(response(1));await a;assert.equal(signalsFromOverview((await loadAdminOverview('synthetic-ordering')).metrics).ordersAttention,0);});
test('resolution invalidation bypasses a cached navigation count and its in-flight predecessor',async()=>{
 const token='synthetic-invalidation';let finishOlder!:(value:Response)=>void,calls=0;
 globalThis.fetch=async()=>{
  calls++;
  if(calls===2)return new Promise<Response>(resolve=>{finishOlder=resolve;});
  return response(calls===1?2:1);
 };
 await loadAdminOverview(token);
 const older=loadAdminOverview(token,true);
 invalidateAdminOverview(token);
 assert.equal(signalsFromOverview((await loadAdminOverview(token)).metrics).ordersAttention,1);
 finishOlder(response(2));
 await older;
 assert.equal(signalsFromOverview((await loadAdminOverview(token)).metrics).ordersAttention,1);
 assert.equal(calls,3);
});
