import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemberHomeView, type MemberHomeViewProps} from '../../../src/components/home/MemberHomeView';
import {memberGreeting,memberOrderLabel,memberOrderSelection,memberTrackingOrder} from '../../../src/utils/memberHomePresentation';
import {appendFeedback,shouldNotifyAuthTransition} from '../../../src/utils/authFeedback';
import {AuthFields} from '../../../src/components/auth/AuthFields';
import type {SafePublicOrderDetails} from '../../types/orders';
const noop=()=>{};
const order=(status:string,reference='MH-FIXTURE',date='2026-10-08'):SafePublicOrderDetails=>({public_reference:reference,network:'mtn',product_name_snapshot:'MTN 1GB',bundle_size_snapshot:'1GB',recipient_phone:'0240000000',amount:521,amount_ghc:5.21,currency:'GHS',status,created_at:date,paid_at:null,delivered_at:null,service_type:'data'} as SafePublicOrderDetails);
const props:MemberHomeViewProps={name:'Akosua',greeting:'Good morning',orders:[],loading:false,error:false,assistant:noop,wallet:React.createElement('p',null,'Authoritative Wallet slot'),retry:noop,track:noop,actions:{data:noop,airtime:noop,website:noop,earn:noop,orders:noop,marketplace:noop,afa:noop,services:noop}};
const render=(extra:Partial<MemberHomeViewProps>={})=>renderToStaticMarkup(React.createElement(MemberHomeView,{...props,...extra}));

const fieldProps = {
  signup: true, busy: false, error: '', emailOpen: false, revealEmail: noop, recover: noop,
  values: { name: '', identifier: '', email: '', password: '', rememberMe: false },
  changes: { name: noop, identifier: noop, email: noop, password: noop, rememberMe: noop },
};
const fields = (extra: Partial<React.ComponentProps<typeof AuthFields>> = {}) =>
  renderToStaticMarkup(React.createElement(AuthFields, { ...fieldProps, ...extra }));
function input(html: string, id: string) {
  const tag = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
  assert.ok(tag, `missing ${id}`);
  return tag[0];
}

test('signup keeps labelled required name, Ghana phone and password with password-manager semantics', () => {
  const html = fields();
  for (const id of ['auth-name', 'auth-identifier', 'auth-password']) {
    assert.match(html, new RegExp(`for="${id}"`));
    assert.match(input(html, id), /required=""/);
  }
  assert.match(input(html, 'auth-name'), /autoComplete="name"/i);
  assert.match(input(html, 'auth-identifier'), /type="tel"/);
  assert.match(input(html, 'auth-identifier'), /inputMode="tel"/i);
  assert.match(input(html, 'auth-password'), /autoComplete="new-password"/i);
  assert.match(input(html, 'auth-password'), /minLength="8"/i);
});

test('optional email starts collapsed and is genuinely optional when revealed', () => {
  assert.doesNotMatch(fields(), /<input[^>]*id="auth-email"/);
  assert.match(fields(), /type="button" aria-expanded="false" aria-controls="auth-email"/);
  const email = input(fields({ emailOpen: true }), 'auth-email');
  assert.match(email, /type="email"/);
  assert.match(email, /autoComplete="email"/i);
  assert.doesNotMatch(email, /required/);
});

test('previously entered optional email stays visible when switching back to signup', () => {
  const html = fields({ values: { ...fieldProps.values, email: 'synthetic@example.test' } });
  assert.match(input(html, 'auth-email'), /value="synthetic@example.test"/);
});

test('signin accepts phone or email without signup fields and uses current-password autocomplete', () => {
  const html = fields({ signup: false });
  assert.doesNotMatch(html, /id="auth-name"|id="auth-email"/);
  assert.match(input(html, 'auth-identifier'), /autoComplete="username"/i);
  assert.match(input(html, 'auth-password'), /autoComplete="current-password"/i);
  assert.match(html, /Forgot password/);
});

test('validation associates every visible field with the inline error', () => {
  const html = fields({ error: 'Invalid details', emailOpen: true });
  for (const id of ['auth-name', 'auth-identifier', 'auth-email', 'auth-password']) {
    assert.match(input(html, id), /aria-invalid="true"/);
    assert.match(input(html, id), /aria-describedby="[^"]*auth-error/);
  }
});

test('pending requests disable fields and a settled retry re-enables them', () => {
  assert.match(fields({ busy: true }), /<fieldset disabled=""/);
  assert.doesNotMatch(fields({ busy: false }), /<fieldset disabled/);
});

test('each customer or admin interactive session emits one success while replay is suppressed', () => {
  assert.equal(shouldNotifyAuthTransition(null, 'customer-token'), true);
  assert.equal(shouldNotifyAuthTransition('customer-token', 'customer-token'), false);
  assert.equal(shouldNotifyAuthTransition('customer-token', 'admin-token'), true);
  assert.equal(shouldNotifyAuthTransition('admin-token', 'admin-token'), false);
});

test('background restoration and security-session replacement do not replay login success', () => {
  assert.equal(shouldNotifyAuthTransition(null, 'restored-token', false), false);
  assert.equal(shouldNotifyAuthTransition('old-token', 'replaced-token', false), false);
});
test('auth feedback replaces related duplicates while independent warnings remain',()=>{
  const warning={id:'w',message:'Payment needs review',type:'warning' as const};
  let rows=appendFeedback([warning],{id:'a',message:'Signed in.',type:'success',key:'auth'});
  rows=appendFeedback(rows,{id:'b',message:'Signed in.',type:'success',key:'auth'});
  assert.equal(rows.length,2);assert.deepEqual(rows[0],warning);assert.equal(rows[1].id,'b');
  rows=appendFeedback(rows,{id:'c',message:'Signed out.',type:'info',key:'auth'});
  assert.equal(rows.length,2);assert.equal(rows[1].message,'Signed out.');
});
for(const [hour,greeting] of [[5,'Good morning'],[11,'Good morning'],[12,'Good afternoon'],[16,'Good afternoon'],[17,'Good evening'],[0,'Good evening']] as const)test(`greeting at ${hour}`,()=>assert.equal(memberGreeting(hour),greeting));
test('active order takes priority without duplicating it in recent activity or mutating input',()=>{
  const rows=[order('delivered','MH-NEW','2026-10-08'),order('processing','MH-ACTIVE','2026-10-07')];
  const before=structuredClone(rows),selected=memberOrderSelection(rows);
  assert.equal(selected.latest?.public_reference,'MH-ACTIVE');assert.equal(selected.prioritizesActive,true);assert.deepEqual(selected.recent.map(o=>o.public_reference),['MH-NEW']);assert.deepEqual(rows,before);
});
test('payment-pending order stays visible and never maps to delivery',()=>{
  const pending=order('pending_payment');assert.equal(memberOrderSelection([pending]).latest,pending);
  assert.equal(memberTrackingOrder(pending).status,'verifying');assert.equal(memberTrackingOrder(pending).serverStatus,'pending_payment');
});
for(const status of ['paid','queued','submitted','processing','failed','refund_pending','refunded','cancelled','expired'])test(`${status} is never presented as delivered`,()=>assert.notEqual(memberTrackingOrder(order(status)).status,'delivered'));
test('confirmed delivery, manual review and service type retain authoritative meaning',()=>{
  assert.equal(memberTrackingOrder(order('delivered')).status,'delivered');
  const afa={...order('processing'),service_type:'afa' as const,manual_review:true};
  assert.equal(memberOrderLabel(afa),'Needs attention');assert.equal(memberTrackingOrder(afa).serviceType,'afa');assert.equal(memberTrackingOrder(afa).manualReview,true);assert.equal(memberTrackingOrder(afa).buyerRecipientVisible,true);
});
test('loading state does not claim an empty history or expose stale order details',()=>{
  const html=render({loading:true,orders:[order('delivered')]});assert.ok(html.includes('role="status"'));assert.ok(!html.includes('MH-FIXTURE'));assert.ok(!html.includes('Your first order starts here'));
});
test('failed order load offers recovery without claiming no purchases',()=>{
  const html=render({error:true});assert.ok(html.includes('role="alert"'));assert.ok(html.includes('Try again'));assert.ok(!html.includes('Your first order starts here'));
});
test('empty member dashboard keeps useful actions and never invents balances',()=>{
  const html=render();for(const action of ['Buy Data','Website Builder','Mystery Earn','View all orders','Authoritative Wallet slot'])assert.ok(html.includes(action));assert.ok(html.includes('Your first order starts here'));assert.ok(!html.includes('GH₵0.00'));
});
test('hero reference appears once while additional orders remain discoverable',()=>{
  const html=render({orders:[order('processing'),order('delivered','MH-OLDER','2026-10-07')]});assert.equal(html.split('MH-FIXTURE').length-1,1);assert.ok(html.includes('MH-OLDER'));assert.ok(html.includes('Track Order'));assert.ok(html.includes('aria-labelledby="member-services"'));
});
