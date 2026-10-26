/** F3 Notification Center, composer rules, AI proposals, customer subscription states and honest wording. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {pendingAdminNotificationsClient,httpAdminNotificationsClient,notificationDeliverySummary, NOTIFICATIONS_UNAVAILABLE, DELIVERY_STATES} from '../../../src/services/adminNotifications.js';
import {pendingAiDraftingClient, AI_DRAFT_ACTIONS} from '../../../src/services/adminAiDrafting.js';
import {pendingCustomerNotificationsClient} from '../../../src/services/customerNotifications.js';
import {STARTER_TEMPLATES, SAMPLE_PLACEHOLDERS, placeholdersIn, unsupportedPlaceholders, unfilledBlanks, renderWithSamples, lengthGuidance, sendBlockers, draftFingerprint, audienceAllows, insertAt, DELIVERY_LABELS, DEFAULT_LIMITS, type NotificationDraft} from '../../../src/utils/notificationComposer.js';
import {customerPushState, PUSH_STATE_COPY, subscribeThisDevice, unsubscribeThisDevice, readServerDeviceState, base64UrlToBytes} from '../../../src/pwa/push.js';
import {createFixtureNotificationsClient, createFixtureAiDraftingClient, createFixtureCustomerNotifications} from '../../../src/fixtures/notificationFixtures.js';
import {AdminNotificationsSection} from '../../../src/components/admin/sections/AdminNotificationsSection.js';
import {NotificationPreview} from '../../../src/components/admin/sections/AdminNotificationComposer.js';
import {NotificationSettings} from '../../../src/components/auth/NotificationSettings.js';

const source = (file: string) => readFileSync(file, 'utf8');
const F3_FILES = ['src/services/adminNotifications.ts', 'src/services/adminAiDrafting.ts', 'src/services/customerNotifications.ts', 'src/pwa/push.ts', 'src/utils/notificationComposer.ts', 'src/components/admin/sections/AdminNotificationsSection.tsx', 'src/components/admin/sections/AdminNotificationComposer.tsx', 'src/components/auth/NotificationSettings.tsx'];

test('without Codex contracts nothing is called, drafting and preview still work, and sending says it is waiting', () => {
  assert.equal(pendingAdminNotificationsClient.available, false);
  assert.equal(pendingAiDraftingClient.available, false);
  assert.equal(pendingCustomerNotificationsClient.available, false);
  const html = renderToStaticMarkup(React.createElement(AdminNotificationsSection, {sessionToken: 't',client:pendingAdminNotificationsClient,ai:pendingAiDraftingClient}));
  assert.ok(html.includes(NOTIFICATIONS_UNAVAILABLE));
  assert.match(html, /Sending not connected yet/);
  assert.match(html, /Phone preview/);
  assert.match(html, /AI wording help is not connected yet/);
  const page = source('src/components/admin/AdminPage.tsx');
  assert.match(page, /notifications: \{ label: 'Notifications'/);
  assert.match(page, /<AdminNotificationsSection key=\{token\} sessionToken=\{token\} initialView=\{param\}/, 'account changes reset notification UI');
  const live=renderToStaticMarkup(React.createElement(AdminNotificationsSection,{sessionToken:'t'}));
  assert.doesNotMatch(live,/Waiting for the notification server|Sending not connected yet/);assert.equal(httpAdminNotificationsClient.available,true);
});

test('raw backend delivery states map to honest per-device labels without inventing display receipts', () => {
  for(const state of ['queued','retry','provider_accepted','invalid','skipped','failed']){const s=notificationDeliverySummary({id:'fixture',state,created_at:'2026-10-26',history:[]});assert.equal(Object.values(s.counts).reduce((a,b)=>a+b,0),1);assert.equal(s.recipients,1);}
  assert.equal(notificationDeliverySummary({state:'provider_accepted',history:[]}).counts.accepted,1);
});

test('delivery wording never claims read, seen or delivered', () => {
  assert.deepEqual(DELIVERY_STATES, ['pending', 'sent', 'accepted', 'retrying', 'failed','invalid','skipped']);
  assert.match(DELIVERY_LABELS.accepted.help, /does not mean the person saw it/);
  for (const file of F3_FILES) {
    const text = source(file).replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(text, /['">]\s*(Read|Seen|Opened)\b|\bwas read\b|\bhas been seen\b|delivered to \d/i, file);
  }
  assert.doesNotMatch(source('src/components/auth/NotificationSettings.tsx'), /You will receive updates/);
});

test('the frontend does not invent a competing set of transactional templates or private placeholders', () => {
  assert.deepEqual(STARTER_TEMPLATES,[]); // Eight defaults are verified through the actual HTTP/PostgreSQL integration test.
  assert.deepEqual(SAMPLE_PLACEHOLDERS.map(p=>p.token),['{{appName}}','{{eventLabel}}']);
});

test('placeholders: found, checked against the server list, previewed with samples and inserted with spacing', () => {
  assert.deepEqual(placeholdersIn('Hi {{ First_Name }}, {{order_reference}} {{first_name}}'), ['{{first_name}}', '{{order_reference}}']);
  assert.deepEqual(unsupportedPlaceholders('Hi {{appName}} {{wallet_balance}}', SAMPLE_PLACEHOLDERS), ['{{wallet_balance}}']);
  assert.equal(renderWithSamples('Hi {{appName}}, {{unknown}}', SAMPLE_PLACEHOLDERS), 'Hi Mystery Hub, {{unknown}}');
  assert.deepEqual(unfilledBlanks('Until [end date] for [Offer name]'), ['[end date]', '[Offer name]']);
  assert.deepEqual(insertAt('Hello', 5, 5, '{{first_name}}'), {value: 'Hello {{first_name}}', caret: 20});
  assert.equal(insertAt('Hi,', 2, 2, '{{first_name}}').value, 'Hi {{first_name}},');
});

test('character guidance: phone guidance first, the limit second', () => {
  assert.equal(lengthGuidance('title', 'Payment received', DEFAULT_LIMITS).tone, 'ok');
  assert.equal(lengthGuidance('title', 'x'.repeat(50), DEFAULT_LIMITS).tone, 'long');
  assert.equal(lengthGuidance('title', 'x'.repeat(81), DEFAULT_LIMITS).tone, 'over');
  assert.equal(lengthGuidance('body', 'x'.repeat(241), DEFAULT_LIMITS).message, '1 over the 240-character limit');
});

test('send blockers enforce consent, audience, blanks, server placeholders and limits', async () => {
  const fx = createFixtureNotificationsClient();
  const audiences = await fx.audiences('t'), placeholders = await fx.placeholders('t');
  const ctx = {audiences, placeholders, limits: DEFAULT_LIMITS};
  const promo: NotificationDraft = {templateId: null, category: 'marketing', title: '[Offer name]', body: 'Hi {{wallet_balance}}', destination: null, audienceId: 'all-alerts'};
  const issues = sendBlockers(promo, ctx).join(' ');
  assert.match(issues, /Replace \[Offer name\]/);
  assert.match(issues, /cannot fill \{\{wallet_balance\}\}/);
  assert.match(issues, /Promotions can only go to people who agreed/);
  assert.equal(audienceAllows(audiences.find(a => a.id === 'promo-optin')!, 'marketing'), true);
  assert.equal(audienceAllows({...audiences[0], allowedCategories: ['marketing']}, 'marketing'), false, 'marketing needs a consent-only audience');
  assert.deepEqual(sendBlockers({...promo, title: 'AFA registration is here', body: 'Register for MTN AFA on Mystery Hub.', audienceId: 'promo-optin'}, ctx), []);
});

test('duplicate-send prevention: same draft keeps its key and the server returns the original', async () => {
  const fx = createFixtureNotificationsClient();
  const draft: NotificationDraft = {templateId: null, category: 'service', title: 'Maintenance', body: 'Short maintenance tonight.', destination: null, audienceId: 'all-alerts'};
  assert.equal(draftFingerprint(draft), draftFingerprint({...draft, title: ' Maintenance '}));
  assert.notEqual(draftFingerprint(draft), draftFingerprint({...draft, audienceId: 'recent-buyers'}));
  const input = {idempotencyKey: 'k1', templateId: null, category: 'service' as const, title: 'Maintenance', body: 'Short maintenance tonight.', destination: null, audienceId: 'all-alerts', confirmedRecipients: 412};
  const first = await fx.createSend('t', input), second = await fx.createSend('t', input);
  assert.ok(first.ok && !first.duplicate && second.ok && second.duplicate && second.send.id === first.send.id);
  const ui = source('src/components/admin/sections/AdminNotificationComposer.tsx');
  assert.match(ui, /if \(keyRef\.current\?\.fingerprint !== fingerprint\) keyRef\.current = \{ fingerprint, key: newKey\(\) \}/);
  assert.match(ui, /inFlight\.current/);
  assert.match(ui, /same message key is used, so it cannot be sent twice/);
});

test('confirmation re-reads the audience and the server refuses a stale count', async () => {
  const fx = createFixtureNotificationsClient({countDrift: 3});
  const fresh = await fx.countAudience('t', 'all-alerts');
  assert.equal(fresh, 415);
  const res = await fx.createSend('t', {idempotencyKey: 'k2', templateId: null, category: 'service', title: 'x', body: 'y', destination: null, audienceId: 'all-alerts', confirmedRecipients: fresh});
  assert.equal(res.ok ? null : res.code, 'count_changed');
  const ui = source('src/components/admin/sections/AdminNotificationComposer.tsx');
  const review = ui.slice(ui.indexOf('const review = async'), ui.indexOf('const send = async'));
  assert.match(review, /client\.prepareAudience\(token,/);
  assert.match(review,/current!==revision.current/,'a delayed audience result cannot confirm a changed draft');
  assert.match(ui, /disabled=\{!acknowledged \|\| sending\}/);
});

test('AI drafting only proposes: "Use this" fills the editor; nothing in the AI path sends', async () => {
  assert.deepEqual(AI_DRAFT_ACTIONS.map(a => a.label), ['Improve wording', 'Make shorter', 'Professional tone', 'Friendly tone', 'Correct grammar', 'Suggest alternatives']);
  const ok = await createFixtureAiDraftingClient().propose('t', {action: 'alternatives', title: 'a', body: 'b', placeholders: []});
  assert.ok(ok.ok && ok.proposals.length === 2);
  const down = await createFixtureAiDraftingClient('down').propose('t', {action: 'improve', title: 'a', body: 'b', placeholders: []});
  assert.equal(down.ok, false);
  const ui = source('src/components/admin/sections/AdminNotificationComposer.tsx');
  const askAi = ui.slice(ui.indexOf('const askAi = async'), ui.indexOf('const blockers ='));
  assert.doesNotMatch(askAi, /createSend|update\(/, 'AI results never change the draft or send by themselves');
  assert.match(ui, /onClick=\{\(\) => \{ update\(\{ title: p\.title, body: p\.body \}\); setProposals\(null\); \}\}>Use this/);
  assert.match(ui, /Keep my wording/);
});

test('preview shows sample values in an Android-style card', () => {
  const html = renderToStaticMarkup(React.createElement(NotificationPreview, {title: 'Hi {{appName}}', body: '{{eventLabel}}', placeholders: SAMPLE_PLACEHOLDERS, destination: 'My Orders'}));
  assert.match(html, /Hi Mystery Hub/);
  assert.match(html, /An account update is available. Sign in to view it./);
  assert.match(html, /Account inbox content after sign-in/);
  assert.match(html, /Opens: My Orders/);
});

test('customer states: permission alone is never "on"; only server confirmation is', () => {
  const base = {contract: true, pushSupported: true, permission: 'granted' as const, server: 'unknown' as const, local: 'idle' as const};
  assert.equal(customerPushState({...base, contract: false}), 'unavailable');
  assert.equal(customerPushState({...base, pushSupported: false}), 'unavailable');
  assert.equal(customerPushState({...base, permission: 'default'}), 'permission_needed');
  assert.equal(customerPushState({...base, permission: 'denied'}), 'disabled');
  assert.equal(customerPushState(base), 'granted_not_subscribed', 'granted but not confirmed');
  assert.equal(customerPushState({...base, server: 'subscribed'}), 'active');
  assert.equal(customerPushState({...base, server: 'error'}), 'failed');
  assert.equal(customerPushState({...base, local: 'failed'}), 'failed');
  assert.equal(customerPushState({...base, local: 'unsubscribed', server: 'not_subscribed'}), 'unsubscribed');
  for (const [state, copy] of Object.entries(PUSH_STATE_COPY)) if (state !== 'active') assert.doesNotMatch(copy.title + copy.body, /alerts are on|will receive/i, state);
});

const permissionWin = (answer: NotificationPermission) => { let permission: NotificationPermission = 'default'; return {Notification: {get permission() { return permission; }, requestPermission: async () => (permission = answer)}, isSecureContext: true, top: 1, self: 1}; };

test('subscribe journey: permission, subscribe, register, server confirmation; refusals are undone', async () => {
  const ok = createFixtureCustomerNotifications();
  const win = {...ok.env, ...permissionWin('granted')};
  const res = await subscribeThisDevice(ok.client, 't', win as never);
  assert.deepEqual([res.permission, res.server], ['granted', 'subscribed']);
  assert.equal(await readServerDeviceState(ok.client, 't', win as never), 'subscribed');
  assert.deepEqual(await unsubscribeThisDevice(ok.client, 't', win as never), {ok: true});
  assert.equal(ok.registered.size, 0);
  const refused = createFixtureCustomerNotifications({refuseRegister: true});
  const rwin = {...refused.env, ...permissionWin('granted')};
  assert.equal((await subscribeThisDevice(refused.client, 't', rwin as never)).server, 'error');
  assert.equal(await refused.env.navigator.serviceWorker.getRegistration().then(r => r!.pushManager.getSubscription()), null, 'browser subscription removed again');
  const unconfirmed = createFixtureCustomerNotifications({confirm: false});
  assert.equal((await subscribeThisDevice(unconfirmed.client, 't', {...unconfirmed.env, ...permissionWin('granted')} as never)).server, 'not_subscribed');
  const denied = createFixtureCustomerNotifications();
  assert.equal((await subscribeThisDevice(denied.client, 't', {...denied.env, ...permissionWin('denied')} as never)).permission, 'denied');
  assert.equal(base64UrlToBytes('AQID').length, 3);
});

test('account settings: real preferences are available while delivery remains unconfigured; consent is separate', () => {
  const html = renderToStaticMarkup(React.createElement(NotificationSettings, {token: 't'}));
  assert.match(html, /Phone alerts are not available/);
  assert.match(html, /role="switch"/);
  const ui = source('src/components/auth/NotificationSettings.tsx');
  assert.match(ui, /'promotional', 'News and offers'/);
  assert.match(ui, /if \(res\.ok\) setPrefs\(res\.value\); else setPrefsError/, 'a switch changes only after the server saves');
  assert.match(source('src/components/auth/AccountControls.tsx'), /<NotificationSettings key=\{sessionToken!\} token=\{sessionToken!\} \/>/);
});

test('fixtures stay isolated: no application file imports them', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? walk(p) : [p]; });
  for (const file of walk('src').filter(f => /\.(ts|tsx)$/.test(f) && !f.startsWith(path.join('src', 'fixtures')))) assert.doesNotMatch(source(file), /fixtures\//, file);
});

test('disabled server configuration cannot request browser permission or register a worker',async()=>{
 const fx=createFixtureCustomerNotifications();let asked=0;
 const client={...fx.client,publicKey:async()=>{throw Error('Delivery disabled');}};
 const win={...fx.env,...permissionWin('granted')};win.Notification.requestPermission=async()=>{asked++;return 'granted';};
 const r=await subscribeThisDevice(client,'synthetic-token',win as never);assert.equal(r.server,'error');assert.equal(asked,0);assert.equal(fx.registered.size,0);
});

test('campaign identity changes with the selected customer or template, not just visible wording',()=>{
 const d:NotificationDraft={templateId:'template_a',category:'marketing',title:'Service update',body:'Explore current services.',destination:'/app',audienceId:'customer',userId:'customer_a'};
 assert.notEqual(draftFingerprint(d),draftFingerprint({...d,userId:'customer_b'}));assert.notEqual(draftFingerprint(d),draftFingerprint({...d,templateId:'template_b'}));
});
