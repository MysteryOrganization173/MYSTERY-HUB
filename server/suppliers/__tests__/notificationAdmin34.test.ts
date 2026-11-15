/**
 * 3.4-D Admin Notification Center (unit): plain-language readiness without secrets, the phone check that gates
 * resume, audiences that count people and devices separately, approved destinations mirrored in the service
 * worker, announcement previews that show what the phone shows, and history mapped without invented receipts.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ANNOUNCEMENT_DESTINATIONS} from '../../../shared/notifications.js';
import {DESTINATION_LABELS, PROBLEM_LABELS, notificationHistoryItem, notificationReadiness, httpAdminNotificationsClient, type AdminNotificationsClient, type NotificationOverview} from '../../../src/services/adminNotifications.js';
import {AdminNotificationReadiness} from '../../../src/components/admin/sections/AdminNotificationReadiness.js';
import {AdminNotificationComposer, NotificationPreview} from '../../../src/components/admin/sections/AdminNotificationComposer.js';
import {pendingAiDraftingClient} from '../../../src/services/adminAiDrafting.js';
import {SAMPLE_PLACEHOLDERS, DEFAULT_LIMITS} from '../../../src/utils/notificationComposer.js';
import {notificationPage} from '../../../src/components/auth/AccountControls.js';

const health = (over: Record<string, unknown> = {}) => ({
  configuration: {enabled: true, valid: true, switchOn: true, guestNews: false}, paused: true, devices: 4, pending: 0,
  liveDevices: 3, liveAccounts: 2, signedOutDevices: 1, announcementCustomers: 1, announcementDevices: 2, guestBrowsers: 0, ownDevices: 1, waitingEvents: 2,
  deliveries7Days: {provider_accepted: 5, invalid: 1}, commonProblem: 'endpoint_expired', lastTest: null, phoneCheckedAt: null, ...over,
});
const overview = (h: any): NotificationOverview => ({subscribedDevices: h.devices, marketingConsented: 1, sendsLast7Days: 0, failedLast7Days: 0, sendingEnabled: h.configuration.enabled, paused: h.paused,
  worker: {running: true, lastCompletedAt: '2026-11-15T10:00:00Z', lastErrorAt: null, lastResult: 'paused_or_disabled'}, readiness: notificationReadiness(h)});
const client = {...httpAdminNotificationsClient} as AdminNotificationsClient;
const render = (h: any) => renderToStaticMarkup(React.createElement(AdminNotificationReadiness, {token: 't', client, overview: overview(h), onChanged: () => {}}));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('readiness speaks plainly: paused, devices versus accounts, waiting updates, last week and the common problem', () => {
  const page = text(render(health()));
  assert.match(page, /Push keys are set up/); assert.match(page, /The sending switch is on/);
  assert.match(page, /Sending is paused/); assert.match(page, /Your own tests still work/);
  assert.match(page, /3 devices on 2 accounts can receive/); assert.match(page, /1 more device is registered but signed out/);
  assert.match(page, /1 customer chose news and offers/); assert.match(page, /2 devices registered in all/);
  assert.match(page, /News for visitors without an account is off/);
  assert.match(page, /2 order updates are waiting/);
  assert.match(page, /Last 7 days: 5 accepted · 1 expired/); assert.match(page, /no longer subscribed, so it was removed/);
  assert.match(page, /Keys and phone addresses are never shown/);
});

test('resume needs a phone check first; a test needs the operator’s own device; unconfigured blocks both', () => {
  const unverified = render(health());
  assert.match(unverified, /Not checked on a phone yet/);
  assert.match(unverified, /<button[^>]*disabled=""[^>]*>.*?Resume sending/s, 'resume is disabled before a phone check');
  assert.match(text(unverified), /Available after you check a test on your phone/);
  const waiting = text(render(health({lastTest: {id: 'x', createdAt: '2026-11-15T10:00:00Z', openedAt: null, states: {provider_accepted: 1}}})));
  assert.match(waiting, /accepted by the push service for 1 device/); assert.match(waiting, /Waiting for you to tap it on your phone/);
  const verified = render(health({lastTest: {id: 'x', createdAt: '2026-11-15T10:00:00Z', openedAt: '2026-11-15T10:01:00Z', states: {provider_accepted: 1}}, phoneCheckedAt: '2026-11-15T10:01:00Z'}));
  assert.match(text(verified), /Checked on your phone/); assert.doesNotMatch(text(verified), /Waiting for you to tap/);
  assert.doesNotMatch(verified, /<button[^>]*disabled=""[^>]*>[^<]*(<[^>]+>)*Resume sending/, 'resume is available after the check');
  // A newer test not yet tapped does not undo an earlier check within 30 days (the server's rule too).
  const newer = render(health({lastTest: {id: 'y', createdAt: '2026-11-15T11:00:00Z', openedAt: null, states: {provider_accepted: 1}}, phoneCheckedAt: '2026-11-15T10:01:00Z'}));
  assert.match(text(newer), /Checked on your phone/); assert.match(text(newer), /Your latest test was sent .* Waiting for you to tap it on your phone/);
  assert.doesNotMatch(newer, /<button[^>]*disabled=""[^>]*>[^<]*(<[^>]+>)*Resume sending/);
  const noPhone = text(render(health({ownDevices: 0})));
  assert.match(noPhone, /No phone is registered to your account yet/);
  const unconfigured = render(health({configuration: {enabled: false, valid: false, switchOn: false, guestNews: false}}));
  assert.match(text(unconfigured), /Push keys are missing or invalid/); assert.match(text(unconfigured), /Not configured/);
  assert.doesNotMatch(unconfigured, /Resume sending|Pause sending/, 'no pause control without configuration');
  const live = text(render(health({paused: false})));
  assert.match(live, /Sending is live/); assert.match(live, /Pause sending/);
});

test('readiness carries no key material, only booleans and counts', () => {
  const r = notificationReadiness(health({configuration: {enabled: true, valid: true, switchOn: true, guestNews: true, publicKey: 'BPUBLIC', privateKey: 'SECRET'}}));
  assert.deepEqual(Object.keys(r).sort(), ['announcementCustomers', 'announcementDevices', 'commonProblem', 'guestBrowsers', 'guestNews', 'keysValid', 'last7Days', 'lastTest', 'liveAccounts', 'liveDevices', 'ownDevices', 'phoneCheckedAt', 'signedOutDevices', 'switchOn', 'waitingEvents']);
  assert.doesNotMatch(JSON.stringify(r), /BPUBLIC|SECRET/);
});

test('approved destinations: one list for the server, the Admin labels and the service worker', () => {
  assert.deepEqual(Object.keys(DESTINATION_LABELS).filter(k => k !== '/orders'), [...ANNOUNCEMENT_DESTINATIONS]);
  const sw = readFileSync('public/push-sw.js', 'utf8');
  const pages = JSON.parse(sw.match(/const PAGES=(\[[^\]]+\])/)![1].replaceAll("'", '"'));
  assert.deepEqual(pages, [...ANNOUNCEMENT_DESTINATIONS], 'the worker mirrors the server list');
  assert.match(sw, /url:announcement\?page\(data\.url\):null/); assert.match(sw, /new URL\(page\(event\.notification\.data\?\.url\),self\.location\.origin\)/);
  for (const path of ANNOUNCEMENT_DESTINATIONS) assert.notEqual(notificationPage(path), path === '/' ? 'orders' : 'home', path);
  assert.equal(notificationPage('/orders'), 'orders'); assert.equal(notificationPage('/data'), 'data'); assert.equal(notificationPage('https://evil.example/'), 'home');
});

test('an announcement preview shows the phone’s real text and page; an account update stays generic', () => {
  const announcement = text(renderToStaticMarkup(React.createElement(NotificationPreview, {kind: 'announcement', title: 'New on {{appName}}', body: 'Data bundles are back.', placeholders: SAMPLE_PLACEHOLDERS, destination: 'Data bundles'})));
  assert.match(announcement, /New on Mystery Hub/); assert.match(announcement, /Data bundles are back/); assert.match(announcement, /Opens: Data bundles/);
  assert.doesNotMatch(announcement, /An account update is available/);
  const account = text(renderToStaticMarkup(React.createElement(NotificationPreview, {title: 'Order delivered', body: 'Delivery is confirmed.', placeholders: SAMPLE_PLACEHOLDERS, destination: 'Orders after sign-in'})));
  assert.match(account, /An account update is available. Sign in to view it./); assert.match(account, /Account inbox content after sign-in/);
});

test('the composer counts customers and devices separately, offers only approved pages, and explains unavailable audiences', async () => {
  const fetched = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify(health({configuration: {enabled: true, valid: true, switchOn: true, guestNews: false}})), {status: 200})) as typeof fetch;
  try {
    const audiences = await httpAdminNotificationsClient.audiences('t');
    assert.deepEqual(audiences.map(a => [a.id, a.kind, a.eligibleCount, a.available]), [['marketing', 'members', 2, true], ['guests', 'guests', 0, false], ['everyone', 'everyone', 2, false], ['customer', 'members', null, true]]);
    assert.match(audiences[1].unavailableReason!, /Guest news is off/);
    const destinations = await httpAdminNotificationsClient.destinations('t');
    const html = text(renderToStaticMarkup(React.createElement(AdminNotificationComposer, {token: 't', client: httpAdminNotificationsClient, ai: pendingAiDraftingClient, seed: null, onSent: () => {}, onViewHistory: () => {},
      overview: overview(health()), data: {audiences, placeholders: SAMPLE_PLACEHOLDERS, destinations, limits: DEFAULT_LIMITS, templates: []}})));
    assert.match(html, /1 customer · 2 devices/); assert.match(html, /0 browsers/);
    assert.match(html, /Guest news is off \(WEB_PUSH_GUEST_NEWS\)/);
    for (const label of ['Home', 'Data bundles', 'All services', 'Marketplace', 'Mystery Earn']) assert.match(html, new RegExp(`>${label}<|${label}`), label);
    assert.match(html, /Sending is paused. You can send this to your own devices to check it/);
    assert.match(html, /Send to my devices first/);
    assert.doesNotMatch(html, /Each person sees their own details/);
  } finally { globalThis.fetch = fetched; }
});

test('history maps the server’s answers without inventing receipts', () => {
  const waiting = notificationHistoryItem({id: 'a', kind: 'order', createdAt: '2026-11-15', title: 'Order delivered', body: 'b', audience: 'account', targeted: 0, states: {}, waiting: true, destination: '/orders'});
  assert.equal(waiting.status, 'queued'); assert.equal(waiting.waiting, true); assert.equal(waiting.category, 'transactional');
  const mixed = notificationHistoryItem({id: 'b', kind: 'announcement', createdAt: '2026-11-15', title: 't', body: 'b', audience: 'everyone', targeted: 3, states: {provider_accepted: 2, invalid: 1}, destination: '/data'});
  assert.equal(mixed.status, 'completed_with_errors'); assert.deepEqual([mixed.counts.accepted, mixed.counts.invalid], [2, 1]); assert.equal(mixed.audienceLabel, 'Everyone who chose news'); assert.equal(mixed.destination, '/data');
  const sending = notificationHistoryItem({id: 'c', kind: 'announcement', createdAt: '2026-11-15', title: 't', body: 'b', audience: 'members', targeted: 2, states: {queued: 1, provider_accepted: 1}});
  assert.equal(sending.status, 'sending');
  const failed = notificationHistoryItem({id: 'd', kind: 'announcement', createdAt: '2026-11-15', title: 't', body: 'b', audience: 'guests', targeted: 1, states: {failed: 1}});
  assert.equal(failed.status, 'failed');
  const testItem = notificationHistoryItem({id: 'e', kind: 'test', createdAt: '2026-11-15', title: 'Test notification', body: 'b', audience: 'self', targeted: 1, states: {provider_accepted: 1}, openedAt: '2026-11-15T10:00:00Z', destination: '/orders'});
  assert.equal(testItem.openedAt, '2026-11-15T10:00:00Z'); assert.equal(testItem.audienceLabel, 'Your own devices');
  for (const code of ['endpoint_expired', 'subscription_invalid', 'provider_rejected', 'retry_exhausted', 'provider_rate_limit', 'provider_unavailable', 'ineligible']) assert.ok(PROBLEM_LABELS[code], code);
  for (const label of Object.values(PROBLEM_LABELS)) assert.doesNotMatch(label, /\b(read|seen|delivered to)\b/i);
});
