import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {adminFinanceRouter} from '../../routes/financeApi.js';
import {AuthStore} from '../../db/authStore.js';
import {FinanceReconciliationStore,reconciliationFilters} from '../../db/financeReconciliationStore.js';
import {FinanceStore,FinanceError} from '../../db/financeStore.js';
import {RECONCILIATION_GROUPS,RECONCILIATION_REASONS} from '../../../shared/financeReconciliation.js';

let server:Server,base:string,calls=0;const original=FinanceReconciliationStore.report;
before(async()=>{const app=express();app.use('/api/admin/finance',adminFinanceRouter);server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/finance/reconciliation`;});
after(async()=>{FinanceReconciliationStore.report=original;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});
beforeEach(async()=>{
 AuthStore._clearDevStore();FinanceStore._reset();calls=0;
 for(const id of ['admin','owner','other','disabled']){await AuthStore.createUser({id,name:id,email:null,phone:null,passwordHash:'private-hash',role:id==='owner'||id==='other'?'customer':'admin',status:id==='disabled'?'disabled':'active'});await AuthStore.createSession(id,`token-${id}`);}
 FinanceReconciliationStore.report=async input=>{calls++;reconciliationFilters(input);return {generatedAt:new Date().toISOString(),scope:'Synthetic scope',counts:Object.fromEntries(Object.keys(RECONCILIATION_GROUPS).map(k=>[k,0])),rows:[],total:0,filteredTotal:0,limit:25,offset:0} as any;};
});
const request=(token?:string,query='')=>fetch(base+query,{headers:token?{Authorization:`Bearer ${token}`}:{}});
for(const [token,status] of [[undefined,401],['bad',401],['token-owner',403],['token-other',403],['token-disabled',403]] as const)test(`reconciliation rejects ${token||'anonymous'} before reading finance evidence`,async()=>{
 const response=await request(token,'?reference=MH-SYNTHETIC-OTHER-OWNER');assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(calls,0);assert.ok(!JSON.stringify(await response.json()).includes('private-hash'));
});
test('authorized Admin can read narrow no-store reconciliation data',async()=>{const response=await request('token-admin');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(calls,1);const data=await response.json();assert.deepEqual(data.rows,[]);assert.ok(!JSON.stringify(data).includes('payload'));});
test('invalid references/arrays cannot become a lookup or disclose underlying errors',async()=>{
 for(const query of ['?reference=%27%20OR%201%3D1','?reference=0591111111','?reference=a&reference=b','?filter=no_such_filter','?offset=-1','?limit=500','?raw=true'])assert.equal((await request('token-admin',query)).status,400);
});
test('database unavailability returns a failure rather than zeroed success',async()=>{
 FinanceReconciliationStore.report=async()=>{throw Error('SELECT private_payload FROM private_table private-customer@example.test');};
 const response=await request('token-admin');assert.equal(response.status,503);const text=await response.text();assert.ok(!text.includes('private_payload'));assert.ok(!text.includes('private-customer'));assert.ok(!text.includes('"counts"'));
});
test('explicit reporting failure remains non-mutating',async()=>{
 const before=await FinanceStore.metrics();FinanceReconciliationStore.report=async()=>{throw new FinanceError('Evidence unavailable. No records were changed.',503);};assert.equal((await request('token-admin')).status,503);assert.deepEqual(await FinanceStore.metrics(),before);
});
test('filters allow bounded pages and exact operational references only',()=>{assert.deepEqual(reconciliationFilters({filter:'attention',reference:' MH-20261102-123456 ',offset:'25',limit:'25'}),{filter:'attention',reference:'MH-20261102-123456',offset:25,limit:25});assert.equal(reconciliationFilters({reference:'fin_synthetic-id'}).reference,'fin_synthetic-id');});
for(const input of [{limit:0},{offset:1.2},{limit:NaN},{offset:100001},{reference:['MH-1']},{filter:{}},{reference:'MH-'+ 'a'.repeat(90)},{reference:'https://paystack.com/private'},{limit:true}])test(`invalid bounded filter ${JSON.stringify(input)}`,()=>assert.throws(()=>reconciliationFilters(input as any),FinanceError));
test('labels separate manual service, external compensation, supplier reimbursement and customer refunds',()=>{
 assert.equal(RECONCILIATION_REASONS.manual_fulfillment.group,'resolved');assert.ok(RECONCILIATION_REASONS.manual_fulfillment.explanation.includes('unchanged'));
 assert.ok(RECONCILIATION_REASONS.external_compensation.explanation.includes('not a provider-verified refund'));
 assert.ok(RECONCILIATION_REASONS.remedy_open.explanation.includes('Supplier reimbursement'));
 assert.ok(RECONCILIATION_REASONS.paystack_refund.explanation.includes('does not prove funds are already visible'));
});
