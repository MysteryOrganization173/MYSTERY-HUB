import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemberHomeView,type MemberHomeViewProps} from '../../../src/components/home/MemberHomeView';
import {memberOrderTone,memberOrderSteps,memberOrderNext,memberReorder} from '../../../src/utils/memberHomePresentation';
import type {AuthenticatedCustomerOrderDetails} from '../../types/orders';

const noop=()=>{};
const order=(status:string,extra:Partial<AuthenticatedCustomerOrderDetails>={}):AuthenticatedCustomerOrderDetails=>({public_reference:'MH-V3',network:'mtn',product_name_snapshot:'MTN 5GB',bundle_size_snapshot:'5GB',recipient_phone:'0240000000',amount:2350,amount_ghc:23.5,currency:'GHS',status,created_at:'2026-10-20T10:00:00Z',paid_at:null,delivered_at:null,service_type:'data',...extra} as AuthenticatedCustomerOrderDetails);
const base:MemberHomeViewProps={name:'Ama',greeting:'Good morning',orders:[],loading:false,error:false,assistant:noop,wallet:React.createElement('p',null,'Wallet slot'),retry:noop,track:noop,actions:{data:noop,airtime:noop,website:noop,earn:noop,orders:noop,marketplace:noop,afa:noop,services:noop}};
const render=(extra:Partial<MemberHomeViewProps>={})=>renderToStaticMarkup(React.createElement(MemberHomeView,{...base,...extra}));

test('order tone follows the server status and never upgrades an unfinished order',()=>{
  for(const s of ['pending_payment','paid','queued','submitted','processing'])assert.equal(memberOrderTone(order(s)),'active');
  for(const s of ['failed','refund_pending'])assert.equal(memberOrderTone(order(s)),'attention');
  assert.equal(memberOrderTone(order('processing',{manual_review:true})),'attention');
  assert.equal(memberOrderTone(order('delivered',{customer_resolution:'review'})),'attention');
  assert.equal(memberOrderTone(order('failed',{customer_resolution:'refund_confirmed'})),'closed');
  for(const s of ['refunded','cancelled','expired'])assert.equal(memberOrderTone(order(s)),'closed');
  assert.equal(memberOrderTone(order('delivered')),'done');
});

test('progress steps light only what the server has confirmed; Delivered is never pre-lit',()=>{
  assert.deepEqual(memberOrderSteps(order('pending_payment'))!.map(s=>s.done),[false,false,false]);
  assert.deepEqual(memberOrderSteps(order('queued'))!.map(s=>s.done),[true,false,false]);
  assert.deepEqual(memberOrderSteps(order('processing'))!.map(s=>s.done),[true,true,false]);
  assert.equal(memberOrderSteps(order('delivered')),null);
  assert.equal(memberOrderSteps(order('processing',{service_type:'marketplace'})),null);
});

test('attention copy warns against repeating the order; Buy again exists only for delivered data or airtime',()=>{
  assert.match(memberOrderNext(order('failed')),/before placing the same order again/);
  assert.match(memberOrderNext(order('processing',{service_type:'afa',manual_review:true})),/before placing the same order again/);
  assert.equal(memberReorder(order('failed')),null);
  assert.equal(memberReorder(order('processing')),null);
  assert.equal(memberReorder(order('delivered',{service_type:'marketplace'})),null);
  assert.deepEqual(memberReorder(order('delivered',{network:'telecel'})),{mode:'data',network:'telecel'});
  assert.deepEqual(memberReorder(order('delivered',{service_type:'airtime'})),{mode:'airtime',network:'mtn'});
});

test('an order needing attention leads the page, offers support and no Buy again',()=>{
  const html=render({orders:[order('failed')]});
  assert.match(html,/member-home-primary is-urgent/);assert.match(html,/Needs attention/);assert.match(html,/WhatsApp support/);
  assert.match(html,/One of your orders needs attention/);assert.doesNotMatch(html,/Buy again/);assert.match(html,/Track Order/);
});

test('an active order shows truthful progress; a delivered one offers Buy again; a new account gets network choices',()=>{
  const active=render({orders:[order('processing')]});
  assert.match(active,/Order to follow/);assert.match(active,/aria-label="Order progress"/);assert.match(active,/is-urgent/);
  const done=render({orders:[order('delivered')]});
  assert.match(done,/Buy again/);assert.doesNotMatch(done,/is-urgent/);assert.doesNotMatch(done,/Order progress/);
  const fresh=render();
  assert.match(fresh,/Your first order starts here/);for(const n of ['MTN','Telecel','AirtelTigo'])assert.ok(fresh.includes(`>${n}<`));
});

test('network choice opens that network’s catalogue; nothing on the page starts a payment',()=>{
  const source=readFileSync('src/components/home/MemberHomeView.tsx','utf8');
  assert.doesNotMatch(source,/paystack|checkout|walletCheckout|financeRequest/i);
  assert.match(source,/onClick=\{\(\)=>data\(n\.id\)\}/);
});

test('website card uses the account’s own Website Builder record and stays generic without it',()=>{
  assert.match(render(),/Website Builder/);
  assert.match(render({website:{state:'none'}}),/Create a free website/);
  const draft=render({website:{state:'draft',name:'Ama Data Hub',slug:'ama-data-hub'}});assert.match(draft,/Finish your website/);assert.match(draft,/Ama Data Hub · not published yet/);
  const live=render({website:{state:'published',name:'Ama Data Hub',slug:'ama-data-hub'}});assert.match(live,/Your website is live/);assert.doesNotMatch(live,/Create a free website/);
  const member=readFileSync('src/components/home/MemberHome.tsx','utf8');
  assert.match(member,/getMyWebsitesOnServer\(sessionToken!\)/);assert.match(member,/withoutDeletedWebsites/);
});

test('Earn tile promises no amounts; Wallet stays its own server balance with its disclosure',()=>{
  const html=render({orders:[order('delivered')]});
  assert.match(html,/Earn when friends’ purchases qualify/);assert.doesNotMatch(html,/GH₵\s?0\.00|guaranteed|per referral/i);
  const wallet=readFileSync('src/components/home/HomeWalletSummary.tsx','utf8');
  assert.match(wallet,/financeRequest\(sessionToken\)/);assert.match(wallet,/data\.walletMinor/);assert.doesNotMatch(wallet,/earn\.|availableMinor|store/i);
  assert.match(wallet,/Wallet funds cannot be withdrawn/);
});

test('promotion slot renders only when given content',()=>{
  assert.doesNotMatch(render(),/member-home-slot/);
  assert.match(render({promotion:React.createElement('p',null,'Install prompt')}),/member-home-slot[^>]*><p>Install prompt/);
});

test('member spotlight prioritizes unresolved attention over a newer pending purchase', () => {
  const source = readFileSync('src/utils/memberHomePresentation.ts', 'utf8');
  // The optional historical classifier (Codex contract pending) is passed through; attention still outranks active.
  assert.match(source, /sorted\.find\(o=>memberOrderTone\(o(,classify)?\)==='attention'\)\?\?sorted\.find\(o=>memberOrderTone\(o(,classify)?\)==='active'\)/);
  const older=order('failed',{public_reference:'MH-OLDER',created_at:'2026-10-19T00:00:00Z'});
  const newer=order('pending_payment',{public_reference:'MH-NEWER'});
  const html=render({orders:[newer,older]});
  assert.match(html,/One of your orders needs attention/);
  assert.match(html,/MH-OLDER/);
});
