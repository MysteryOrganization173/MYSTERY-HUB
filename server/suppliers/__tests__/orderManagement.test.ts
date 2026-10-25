import {test} from 'node:test';
import assert from 'node:assert/strict';
import {opsOrder} from './adminOperationsFixtures.js';
import {orderManagementEligibility,isUnpaidFailedAttempt} from '../../services/orderManagementPolicy.js';
import {toSafePublicOrder,toAdminOrderDetails} from '../../types/orders.js';
import express from 'express';
import {orderManagementRouter} from '../../routes/orderManagementApi.js';
import {AuthStore} from '../../db/authStore.js';

const fixture=()=>opsOrder({user_id:null,status:'failed',payment_status:'failed',paid_at:null,submitted_at:null,delivered_at:null,supplier_order_id:null,supplier_response:null,supplier_cost_minor:null,supplier_offer_ref:null});
test('deletion requires trusted provenance independent of names and archival',()=>{
 assert.equal(orderManagementEligibility(fixture(),false,false).deleteTest,false);
 assert.equal(orderManagementEligibility(fixture(),true,false).deleteTest,true);
 assert.equal(orderManagementEligibility({...fixture(),archived_at:new Date().toISOString()},false,false).deleteTest,false);
});
for(const [name,change] of Object.entries({paid:{payment_status:'success'},customer:{user_id:'buyer'},delivered:{delivered_at:new Date().toISOString()},dispatched:{supplier_order_id:'accepted'},cost:{supplier_cost_minor:0},response:{supplier_response:'{}'},referral:{referral_code:'CODE'},refund:{status:'refunded'},uncertain:{manual_review:true},wallet:{payment_provider:'wallet'},resolution:{resolution_json:{stage:'under_review'}}}))test(`deletion denies ${name} evidence`,()=>assert.equal(orderManagementEligibility({...fixture(),...change} as any,true,false).deleteTest,false));
test('incoming or JSON-only financial evidence blocks deletion',()=>assert.equal(orderManagementEligibility(fixture(),true,true).deleteTest,false));
test('a pending provider attempt is unsettled and cannot be deleted even with provenance',()=>assert.equal(orderManagementEligibility({...fixture(),payment_status:'pending'},true,false).deleteTest,false));
test('archive retains paid closed facts, refuses unsettled/active cases and can restore',()=>{
 assert.equal(orderManagementEligibility(opsOrder(),false,true).archive,true);
 assert.equal(orderManagementEligibility(opsOrder({status:'failed'}),false,true).archive,false);
 assert.equal(orderManagementEligibility(opsOrder({status:'processing'}),false,true).archive,false);
 assert.equal(orderManagementEligibility(opsOrder({archived_at:new Date().toISOString()}),false,true).restore,true);
});
test('unpaid historical attempt is never represented as a delivery failure; admin retains original status',()=>{
 const o={...fixture(),payment_status:'pending' as const,public_reference:'MH-20261001-858321',supplier_cost_minor:400};
 assert.equal(isUnpaidFailedAttempt(o),true);assert.equal(toSafePublicOrder(o).status,'expired');
 assert.equal(toSafePublicOrder(o).classification,'unpaid_attempt');assert.equal(toAdminOrderDetails(o).status,'failed');
 assert.equal(o.payment_status,'pending');assert.equal(o.status,'failed');
 assert.equal(isUnpaidFailedAttempt({...o,paid_at:new Date().toISOString()}),false);
 assert.equal(isUnpaidFailedAttempt({...o,supplier_order_id:'actual'}),false);
});
test('order management HTTP denies guests and customers before inspecting durable order data',async()=>{
 const previous=AuthStore.findSessionByToken;
 AuthStore.findSessionByToken=async()=>({user:{id:'buyer',role:'customer',status:'active'}} as any);
 const app=express();app.use(express.json(),orderManagementRouter);const server=app.listen(0,'127.0.0.1');
 try{await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
 assert.equal((await fetch(base+'/MH-SYNTHETIC')).status,401);
 assert.equal((await fetch(base+'/MH-SYNTHETIC',{headers:{authorization:'Bearer fixture'}})).status,403);
 }finally{AuthStore.findSessionByToken=previous;await new Promise<void>(r=>server.close(()=>r()));}
});
