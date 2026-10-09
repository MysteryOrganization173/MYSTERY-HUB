import assert from 'node:assert/strict';
import {test,before,beforeEach,after} from 'node:test';
import {readFileSync} from 'node:fs';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import express from 'express';
import {apiRouter} from '../../routes/api.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {AuthStore} from '../../db/authStore.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import type {OrderRecord,SafePublicOrderDetails} from '../../types/orders.js';
import {getAccountOrdersOnServer} from '../../../src/services/apiClient';
import {MemberHomeView,type MemberHomeViewProps} from '../../../src/components/home/MemberHomeView';
import {memberTrackingOrder} from '../../../src/utils/memberHomePresentation';

const originalFetch=globalThis.fetch,originalRefresh=FulfilmentService.refreshOrderStatusIfDue;
let server:Server,base:string;
const noop=()=>{};
const fixture:OrderRecord={id:'synthetic-integration-order',user_id:'integration-a',public_reference:'MH-INTEGRATION-ONLY',
  customer_name:'Synthetic Customer',customer_email:'customer@example.test',customer_phone:'0241111111',recipient_phone:'0242222222',
  network:'mtn',service_type:'marketplace',product_id:'synthetic-product',product_name_snapshot:'Synthetic Product',bundle_size_snapshot:'Standard',
  amount:521,currency:'GHS',status:'processing',payment_provider:'paystack',payment_reference:'MH-INTEGRATION-PAYMENT',payment_status:'success',
  supplier_provider:null,supplier_order_id:null,supplier_response:null,supplier_cost_minor:null,supplier_offer_ref:null,supplier_last_checked_at:null,
  failure_reason:null,delivery_note:'Synthetic private delivery note',delivery_city:'Synthetic private city',fulfilment_method:'delivery',
  created_at:'2026-10-09T12:00:00Z',updated_at:'2026-10-09T12:00:00Z',paid_at:'2026-10-09T12:00:00Z',submitted_at:null,delivered_at:null};
function markup(orders:MemberHomeViewProps['orders'],extra:Partial<MemberHomeViewProps>={}) {
  return renderToStaticMarkup(React.createElement(MemberHomeView,{name:'Synthetic',greeting:'Good morning',orders,loading:false,error:false,
    wallet:React.createElement('p',null,'Server Wallet slot'),assistant:noop,retry:noop,track:noop,
    actions:{data:noop,airtime:noop,website:noop,earn:noop,orders:noop,marketplace:noop,afa:noop,services:noop},...extra}));
}
before(async()=>{
  assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DATABASE_URL,undefined);
  const app=express();app.use(express.json());app.use('/api',apiRouter);
  server=await new Promise(resolve=>{const listening=app.listen(0,'127.0.0.1',()=>resolve(listening));});
  base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // The real frontend client may only reach this isolated API; never its configured external base.
  globalThis.fetch=(input,init)=>{
    if(typeof input!=='string')throw Error('Unexpected client request');
    const pathname=new URL(input,'http://isolated.test').pathname;
    if(pathname!=='/api/account/orders')throw Error('External request prohibited');
    return originalFetch(base+pathname,init);
  };
  FulfilmentService.refreshOrderStatusIfDue=async order=>order;
});
beforeEach(async()=>{
  OrdersStore.clearDevStore();AuthStore._clearDevStore();
  for(const id of ['integration-a','integration-b']){
    await AuthStore.createUser({id,name:id,email:`${id}@example.test`,phone:null,passwordHash:'synthetic-only',role:'customer'});
    await AuthStore.createSession(id,`${id}-token`);
  }
  await OrdersStore.createOrder({...fixture});
});
after(async()=>{globalThis.fetch=originalFetch;FulfilmentService.refreshOrderStatusIfDue=originalRefresh;
  await new Promise<void>(resolve=>server.close(()=>resolve()));});

test('real authenticated account API client feeds richer owned orders into the new Member Home',async()=>{
  const result=await getAccountOrdersOnServer('integration-a-token');
  assert.equal(result.success,true);assert.equal(result.orders.length,1);
  assert.equal(result.orders[0].recipient_phone,fixture.recipient_phone);
  assert.equal(result.orders[0].delivery_note,fixture.delivery_note);
  const html=markup(result.orders);assert.match(html,/Your account overview/);assert.match(html,/Server Wallet slot/);
  assert.ok(html.includes(fixture.recipient_phone));assert.ok(html.includes(fixture.public_reference));
  assert.equal(memberTrackingOrder(result.orders[0]).buyerRecipientVisible,true);
  assert.equal(memberTrackingOrder(result.orders[0]).serverStatus,'processing');
});
for(const token of ['', 'integration-a-token','integration-b-token'])test(`public lookup stays masked for ${token||'guest'} after customer integration`,async()=>{
  const response=await originalFetch(`${base}/api/orders/lookup/${fixture.public_reference}`,{headers:token?{Authorization:`Bearer ${token}`}:{}});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const data:{order:SafePublicOrderDetails}=await response.json();
  assert.equal(data.order.recipient_phone,'******2222');assert.equal(data.order.status,'processing');
  assert.ok(!JSON.stringify(data).includes(fixture.recipient_phone));assert.ok(!JSON.stringify(data).includes(fixture.delivery_note!));
  assert.ok(!('delivery_city' in data.order));
});
test('another authenticated account gets an empty new dashboard, never the first customer recipient',async()=>{
  const result=await getAccountOrdersOnServer('integration-b-token');assert.deepEqual(result.orders,[]);
  const html=markup(result.orders);assert.match(html,/Your first order starts here/);assert.ok(!html.includes(fixture.recipient_phone));
});
test('logout invalidates private history and the next account still cannot inherit old orders',async()=>{
  assert.equal((await getAccountOrdersOnServer('integration-a-token')).orders.length,1);
  const response=await originalFetch(base+'/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer integration-a-token','Content-Type':'application/json'},body:'{}'});
  assert.equal(response.status,200);await assert.rejects(getAccountOrdersOnServer('integration-a-token'));
  assert.deepEqual((await getAccountOrdersOnServer('integration-b-token')).orders,[]);
});
test('loading and failed member renders do not expose retained private orders',async()=>{
  const result=await getAccountOrdersOnServer('integration-a-token');
  for(const extra of [{loading:true},{error:true}])assert.ok(!markup(result.orders,extra).includes(fixture.recipient_phone));
});
test('member integration uses the authorized client/types and retains session remount and late-response guard',()=>{
  const member=readFileSync('src/components/home/MemberHome.tsx','utf8');
  assert.match(member,/getAccountOrdersOnServer\(sessionToken!,5\)/);assert.match(member,/AuthenticatedCustomerOrderDetails\[\]/);
  assert.doesNotMatch(member,/lookupOrder|\/orders\/lookup/);assert.match(member,/key=\{sessionToken\}/);
  assert.match(member,/return\(\)=>\{active=false;\}/);assert.match(member,/if\(active\)setOrders/);
  assert.match(readFileSync('src/utils/memberHomePresentation.ts','utf8'),/memberTrackingOrder\(o:AuthenticatedCustomerOrderDetails\)/);
});
