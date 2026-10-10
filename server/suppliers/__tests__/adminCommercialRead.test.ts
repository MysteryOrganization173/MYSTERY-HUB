import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { CommercialService } from '../../services/commercialService.js';
import { adminCommercialRouter } from '../../routes/commercialApi.js';
import { FinanceStore } from '../../db/financeStore.js';
import { AuthStore } from '../../db/authStore.js';
import { ReferralStore } from '../../db/referralStore.js';
import { AdminAuditStore } from '../../db/adminAuditStore.js';
import { FulfilmentService } from '../../services/fulfilmentService.js';
import { adminRead, adminSupplierCosts, adminMatchingRule } from '../../services/adminCommercialRead.js';
const provider=FulfilmentService.getProvider(),original=provider.resolvePackage,read=FinanceStore.readConfig,all=ReferralStore.getAllRules;
beforeEach(()=>{FinanceStore._reset();AuthStore._clearDevStore();ReferralStore._clearDevStore();AdminAuditStore._clearDevStore();provider.resolvePackage=async()=>({resolved:{supplierCostMinor:400}} as any);FinanceStore.readConfig=read;ReferralStore.getAllRules=all;});
after(()=>{provider.resolvePackage=original;FinanceStore.readConfig=read;ReferralStore.getAllRules=all;});
test('missing optional config yields launch defaults with unconfigured reserve',async()=>{const r=await CommercialService.admin();assert.ok(r.products.length>10);assert.equal(r.prices.reserveConfigured,false);assert.equal(r.products[0].reserveMinor,null);assert.equal(r.products[0].supplierCostMinor,400);});
test('known zero supplier cost is distinct from unknown',async()=>{provider.resolvePackage=async()=>({resolved:{supplierCostMinor:0}} as any);let r=await CommercialService.admin();assert.equal(r.products[0].supplierCostMinor,0);assert.equal(r.products[0].supplierCostState,'known');provider.resolvePackage=async()=>({resolved:{}} as any);r=await CommercialService.admin();assert.equal(r.products[0].supplierCostMinor,null);assert.equal(r.products[0].supplierCostState,'unknown');assert.equal(r.products[0].spreadMinor,null);});
test('synchronous supplier throw is isolated and retry can recover',async()=>{provider.resolvePackage=()=>{throw new Error('fixture secret must not escape');};let r=await CommercialService.admin();assert.equal(r.dependencyStatus.supplierCosts,'unavailable');assert.ok(r.products.every(p=>p.supplierCostMinor===null));provider.resolvePackage=async()=>({resolved:{supplierCostMinor:400}} as any);r=await CommercialService.admin();assert.equal(r.dependencyStatus.supplierCosts,'known');});
test('rejected supplier read does not hide configuration',async()=>{provider.resolvePackage=async()=>{throw Error('offline');};const r=await CommercialService.admin();assert.ok(r.offer.version);assert.equal(r.products[0].acquisitionContributionMinor,null);});
for(const value of [null,[],{bad:true}])test('malformed product config fails closed '+JSON.stringify(value),async()=>{FinanceStore.readConfig=async id=>id==='direct-pricing'?{products:value}:read(id);await assert.rejects(()=>CommercialService.admin(),e=>(e as any).status===503&&(e as any).dependency==='direct_pricing');});
test('critical read exception is sanitized and categorized',async()=>{FinanceStore.readConfig=async()=>{throw Error('private credential');};await assert.rejects(()=>CommercialService.admin(),e=>(e as any).message==='Commercial service unavailable.'&&(e as any).status===503);});
test('critical timeout is bounded',async()=>{await assert.rejects(()=>adminRead('fixture',()=>new Promise(()=>{}),15),e=>(e as any).reason==='timeout');});
test('supplier deadline stops queued requests and bounds concurrency',async()=>{let active=0,peak=0,calls=0;const results=await adminSupplierCosts(Array.from({length:20},(_,i)=>i),async()=>{calls++;active++;peak=Math.max(peak,active);return new Promise(()=>{});},20);assert.ok(peak<=4);assert.equal(calls,4);assert.ok(results.every(r=>r.state==='unavailable'&&r.minor===null));});
test('rules are read once, and admin performs no financial writes',async()=>{let reads=0;ReferralStore.getAllRules=async()=>{reads++;return all();};const writes=FinanceStore.transaction;FinanceStore.transaction=async()=>{throw Error('No mutation allowed');};try{await CommercialService.admin();assert.equal(reads,1);}finally{FinanceStore.transaction=writes;}});
test('batch rule matching preserves specific product and stage priority',()=>{const base:any={enabled:true,service_type:'data',purchase_stage:'any',created_at:'2026-01-01T00:00:00Z'};const rules=[{...base,id:'generic'},{...base,id:'network',network:'mtn'},{...base,id:'exact',network:'mtn',product_key:'mtn-1gb',purchase_stage:'acquisition'},{...base,id:'expired',product_key:'mtn-1gb',ends_at:'2020-01-01'}];assert.equal(adminMatchingRule(rules,'mtn','mtn-1gb','acquisition','2026-10-10T00:00:00Z')?.id,'exact');assert.equal(adminMatchingRule(rules,'mtn','mtn-1gb','recurring','2026-10-10T00:00:00Z')?.id,'network');});
test('admin RBAC, expired session and sanitized critical 503 remain intact',async()=>{
 const app=express();app.use('/api/admin/commercial',adminCommercialRouter);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+(server.address() as any).port+'/api/admin/commercial';
 try{for(const [id,role] of [['admin','admin'],['buyer','customer']] as const){await AuthStore.createUser({id,name:id,email:id+'@fixture.test',phone:null,passwordHash:'fixture',role});await AuthStore.createSession(id,id+'-token');}
 const get=(token='')=>fetch(url,{headers:token?{Authorization:'Bearer '+token}:{}});
 assert.equal((await get()).status,401);assert.equal((await get('expired')).status,401);assert.equal((await get('buyer-token')).status,403);assert.equal((await get('admin-token')).status,200);
 FinanceStore.readConfig=async()=>{throw Error('sensitive backend detail');};const result=await get('admin-token');assert.equal(result.status,503);assert.equal(result.headers.get('cache-control'),'no-store');const json=await result.json();assert.equal(json.error,'Commercial service unavailable.');assert.ok(json.requestId);assert.ok(!JSON.stringify(json).includes('sensitive'));
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
