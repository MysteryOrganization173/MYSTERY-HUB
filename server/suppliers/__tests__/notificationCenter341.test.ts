// Mystery Hub 3.4.1 Release 2: Notification Center, one "Allow Notifications" experience, settings polish.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { notificationTime, notificationTarget, mergeInboxPage, CATEGORY_LABEL } from '../../../src/utils/notificationCenterPresentation.js';
import { memberInvite, inviteConsent } from '../../../src/pwa/notificationOnboarding.js';
import { NotificationAllowCard, PAUSED_ALLOW_NOTE } from '../../../src/components/notifications/NotificationAllowCard.js';
import { NotificationSettings, blockedHelp } from '../../../src/components/auth/NotificationSettings.js';
import { httpCustomerNotificationsClient } from '../../../src/services/customerNotifications.js';
import { enterOverlay, afterOverlayHistory } from '../../../src/utils/overlayHistory.js';

const source = (file: string) => readFileSync(file, 'utf8');
const NOW = Date.parse('2026-11-16T12:00:00Z');

test('times read plainly and never point to the future', () => {
  assert.equal(notificationTime('2026-11-16T11:59:40Z', NOW), 'Just now');
  assert.equal(notificationTime('2026-11-16T12:05:00Z', NOW), 'Just now', 'a fast server clock is not "in 5 min"');
  assert.equal(notificationTime('2026-11-16T11:55:00Z', NOW), '5 min ago');
  assert.equal(notificationTime('2026-11-16T09:00:00Z', NOW), '3 h ago');
  assert.equal(notificationTime('2026-11-15T08:00:00Z', NOW), 'Yesterday');
  assert.equal(notificationTime('2026-11-02T08:00:00Z', NOW), '2 Nov');
  assert.equal(notificationTime('2025-11-02T08:00:00Z', NOW), '2 Nov 2025');
  assert.equal(notificationTime('not a date', NOW), '');
});

test('each row opens only what it may: the account’s own order, an approved page, or nothing', () => {
  assert.deepEqual(notificationTarget({ category: 'orders', destination: '/orders', orderReference: 'MH-1' }), { kind: 'order', reference: 'MH-1' });
  assert.deepEqual(notificationTarget({ category: 'orders', destination: '/orders' }), { kind: 'orders' });
  assert.deepEqual(notificationTarget({ category: 'announcements', destination: '/app', opens: '/marketplace' }), { kind: 'page', page: 'marketplace' });
  assert.deepEqual(notificationTarget({ category: 'announcements', destination: '/app', opens: '/' }), { kind: 'page', page: 'home' });
  assert.deepEqual(notificationTarget({ category: 'announcements', destination: '/app' }), { kind: 'page', page: 'home' });
  assert.deepEqual(notificationTarget({ category: 'account', destination: '/app' }), { kind: 'none' });
  assert.deepEqual(CATEGORY_LABEL, { orders: 'Order update', announcements: 'Announcement', account: 'Account' });
});

test('older pages add only rows not already shown', () => {
  const row = (id: string) => ({ id, createdAt: '', title: id, body: '', destination: '/app' as const, category: 'account' as const });
  assert.deepEqual(mergeInboxPage([row('a'), row('b')], [row('b'), row('c')]).map(r => r.id), ['a', 'b', 'c']);
});

test('the inbox client reads category and only a well-formed order reference for order updates', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ success: true, items: [
    { id: '1', createdAt: '2026-11-16T10:00:00Z', title: 'Order delivered', body: 'b', destination: '/orders', category: 'orders', orderReference: 'MH-20261116-ABC123' },
    { id: '2', createdAt: '2026-11-16T10:00:00Z', title: 'News', body: 'b', destination: '/app', category: 'announcements', opens: '/data' },
    { id: '3', createdAt: '2026-11-16T10:00:00Z', title: 'Odd', body: 'b', destination: '/orders', orderReference: '<script>' },
    { id: '4', createdAt: '2026-11-16T10:00:00Z', title: 'Test', body: 'b', destination: '/app', category: 'unknown', orderReference: 'MH-X1234' },
  ] }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  try {
    const items = await httpCustomerNotificationsClient.inbox!('token');
    assert.deepEqual(items.map(i => [i.category, i.orderReference ?? null, i.opens ?? null]), [
      ['orders', 'MH-20261116-ABC123', null], ['announcements', null, '/data'], ['orders', null, null], ['account', null, null],
    ]);
  } finally { globalThis.fetch = original; }
});

test('one rule everywhere: a member who said no to offers is offered order updates only, and consent follows the words', () => {
  assert.deepEqual(memberInvite({ promotional: false, marketingOptedOut: true }), { audience: 'member', offers: false });
  assert.deepEqual(memberInvite({ promotional: false, marketingOptedOut: false }), { audience: 'member', offers: true });
  assert.deepEqual(memberInvite({ promotional: true }), { audience: 'member', offers: true });
  assert.deepEqual(inviteConsent(memberInvite({ promotional: false, marketingOptedOut: true })).purposes, ['transactional']);
  assert.deepEqual(inviteConsent(memberInvite({ promotional: false })).purposes, ['transactional', 'marketing']);
  assert.match(source('src/pwa/notificationOnboarding.ts'), /return memberInvite\(preferences, options\.accountId\);/, 'the invitation uses the same rule');
});

test('the inline card says exactly what the invitation says, with Allow Notifications and Not now', () => {
  const render = (props: Partial<React.ComponentProps<typeof NotificationAllowCard>> = {}) => renderToStaticMarkup(React.createElement(NotificationAllowCard, { token: 't', accountId: 'a', preferences: { promotional: false, marketingOptedOut: false }, paused: false, ...props }));
  const full = render({ onNotNow: () => {} });
  assert.match(full, />Stay updated\.</);
  assert.match(full, />Get order updates, service news and occasional offers\.</);
  assert.match(full, />Allow Notifications</);
  assert.match(full, />Not now</);
  assert.match(full, /You can turn them off anytime\./);
  assert.match(render({ preferences: { promotional: false, marketingOptedOut: true } }), />Get updates about your orders on this device\.</, 'a withdrawn no is kept');
  assert.match(render({ preferences: null }), />Get updates about your orders on this device\.</, 'nothing extra is offered before choices load');
  assert.doesNotMatch(render(), />Not now</, 'settings shows no Not now');
  assert.ok(render({ paused: true }).includes(PAUSED_ALLOW_NOTE));
  const card = source('src/components/notifications/NotificationAllowCard.tsx');
  assert.match(card, /activateNotificationInvite\(client, guest, invite, \{ token, signal \}\)/, 'the same consent and registration as the invitation');
  assert.doesNotMatch(card, /\bsubscribeThisDevice/, 'never registers without recording the consent the words name');
});

test('settings: the device is turned on with the same card; blocked, unsupported and server trouble are said plainly', () => {
  const ui = source('src/components/auth/NotificationSettings.tsx');
  assert.match(ui, /<NotificationAllowCard token=\{token\} accountId=\{accountId\}/);
  assert.doesNotMatch(ui, /\bsubscribeThisDevice/, 'turning on always goes through the card (turning off still uses unsubscribe)');
  assert.match(ui, /We couldn’t check notifications right now/);
  assert.match(ui, /setConfigError\(true\)/);
  assert.doesNotMatch(ui, /RecentNotifications|client\.inbox/, 'no feed in My Account');
  assert.match(blockedHelp({ appleHomeScreen: true, installed: true }), /Settings › Notifications › Mystery Hub/);
  assert.match(blockedHelp({ appleHomeScreen: false, installed: false }), /Site settings › Notifications/);
  const embedded = renderToStaticMarkup(React.createElement(NotificationSettings, { token: 't', embedded: true, onShowRecent: () => {} }));
  assert.doesNotMatch(embedded, /<h3/, 'inside My Account the section heading is not repeated');
  assert.match(embedded, /See recent notifications/);
  const standalone = renderToStaticMarkup(React.createElement(NotificationSettings, { token: 't' }));
  assert.match(standalone, /<h3 id="account-notifications"/);
  assert.doesNotMatch(standalone, /See recent notifications/);
});

test('the bell is for members, carries no count, and opens the one Notification Center', () => {
  const nav = source('src/components/common/Navbar.tsx');
  assert.match(nav, /\{user && <button type="button" onClick=\{\(\) => \{ closeMenus\(\); setSearchOpen\(false\); openNotificationCenter\(\); \}\}/);
  // The bell holds the icon and nothing else: no number, no dot.
  assert.match(nav, /aria-label="Notifications" title="Notifications"><Bell className="w-\[18px\] h-\[18px\]" aria-hidden="true" \/><\/button>\}/);
  assert.doesNotMatch(nav, /unread|badge/i);
  const center = source('src/components/notifications/NotificationCenter.tsx');
  assert.doesNotMatch(center, /unread|\bseen\b|markRead|read_at|opened_at/i, 'no invented read state');
  for (const text of ['No notifications yet', 'Your notifications couldn’t be loaded.', 'Try again', 'Show older', 'Notification settings']) assert.ok(center.includes(text), text);
  assert.match(center, /getAccountOrdersOnServer\(token, 50\)/, 'an order opens from the account’s own order list');
  assert.match(center, /useEffect\(\(\) => \{ closeNotificationCenter\(\); \}, \[user\?\.id\]\);/, 'sign-out or a switch closes it');
  assert.match(center, /return isOpen && user && sessionToken \?/, 'visitors have no inbox');
  assert.match(center, /afterOverlayHistory\('mhNotifications', \(\) => openAccount\('notifications'\)\)/);
  assert.match(source('src/App.tsx'), /<NotificationCenterHost \/>/);
  assert.match(source('src/components/auth/SecurityDialog.tsx'), /layout\?: 'dialog' \| 'sheet' \| 'panel';/);
});

test('the server inbox adds a category and the own order reference without any new table or read state', () => {
  const service = source('server/services/notificationService.ts');
  assert.match(service, /LEFT JOIN orders o ON o\.id=e\.order_id AND o\.user_id=\$1 WHERE e\.user_id=\$1/);
  assert.match(service, /category:r\.order_id\?'orders' as const:r\.template_snapshot\?\.category==='marketing'\?'announcements' as const:'account' as const/);
  assert.doesNotMatch(service, /read_at|unread/);
});

test('visitors keep their own sheet, now in the same words', () => {
  const sheet = source('src/components/pwa/NotificationsEntry.tsx');
  assert.match(sheet, /off: \{ icon: <BellRing [^}]*\/>, title: notificationCopy\(\{ audience: 'guest', offers: true \}\)\.title, body: offer \}/);
});

/** A small, synchronous stand-in for the browser's history: Back pops the top entry and then fires popstate. */
function fakeWindow() {
  const entries: any[] = [{ page: 'home' }]; let index = 0;
  const listeners = new Set<() => void>(); const timers: (() => void)[] = []; const pending: (() => void)[] = [];
  const win = {
    history: {
      get state() { return entries[index]; },
      pushState(state: any) { entries.splice(index + 1); entries.push(state); index++; },
      back() { pending.push(() => { if (index > 0) { index--; for (const l of [...listeners]) l(); } }); },
    },
    location: { pathname: '/', search: '', hash: '' },
    addEventListener: (_: 'popstate', fn: () => void) => listeners.add(fn),
    removeEventListener: (_: 'popstate', fn: () => void) => listeners.delete(fn),
    setTimeout: (fn: () => void) => { timers.push(fn); },
  };
  // Back is asynchronous in a browser: `settle` runs the queued traversals, `elapse` the timers.
  return { win, entries: () => entries.slice(0, index + 1), settle: () => { while (pending.length) pending.shift()!(); }, elapse: () => { while (timers.length) timers.shift()!(); }, userBack: () => { win.history.back(); } };
}

test('history: Back closes only the sheet; closing another way removes its entry', () => {
  const h = fakeWindow(); let closed = 0;
  const exit = enterOverlay('mhAccount', () => { closed++; }, h.win as any);
  assert.equal(h.entries().length, 2);
  h.userBack(); h.settle();
  assert.equal(closed, 1, 'Back closes the sheet');
  assert.equal(h.entries().length, 1, 'and leaves the page entry where it was');
  exit(); h.settle();
  assert.equal(h.entries().length, 1, 'nothing more is popped once Back already closed it');
  const exit2 = enterOverlay('mhAccount', () => { closed++; }, h.win as any);
  exit2(); h.settle();
  assert.deepEqual([closed, h.entries().length], [1, 1], 'closing with × removes the entry without calling Back on the page');
});

test('history: a marker left by an earlier page life is never treated as the open sheet’s own', () => {
  const h = fakeWindow();
  h.win.history.pushState({ page: 'home', mhAccount: 'stale-from-before-a-reload' });
  let closed = 0;
  const exit = enterOverlay('mhAccount', () => { closed++; }, h.win as any);
  assert.equal(h.entries().length, 3, 'a fresh entry is pushed');
  exit(); h.settle();
  assert.equal(h.entries().length, 2, 'only its own entry is removed');
  assert.equal(closed, 0);
});

test('history: switching sheets or pages waits for the closing sheet to leave history', () => {
  const h = fakeWindow(); const order: string[] = [];
  const exit = enterOverlay('mhAccount', () => order.push('account closed by Back'), h.win as any);
  // My Account › See recent notifications: close, then open the center only once the entry is gone.
  afterOverlayHistory('mhAccount', () => { order.push('center opens'); enterOverlay('mhNotifications', () => order.push('center closed by Back'), h.win as any); }, h.win as any);
  assert.deepEqual(order, [], 'nothing opens while the account entry is still on top');
  exit(); h.settle();
  assert.deepEqual(order, ['center opens'], 'the late Back did not close the new sheet');
  assert.equal(h.entries().length, 2);
  // No entry on top: runs at once. A lost Back: runs after the fallback.
  let ran = 0; afterOverlayHistory('mhAccount', () => ran++, h.win as any); assert.equal(ran, 1, 'the entry on top is the center’s, so nothing to wait for');
  const g = fakeWindow(); let soon = 0; afterOverlayHistory('mhNotifications', () => soon++, g.win as any); assert.equal(soon, 1);
  const lost = fakeWindow(); lost.win.history.pushState({ mhNotifications: 'x' }); let late = 0;
  afterOverlayHistory('mhNotifications', () => late++, lost.win as any); assert.equal(late, 0); lost.elapse(); assert.equal(late, 1, 'never stuck waiting');
});

test('every screen with My Account can open the Notification Center', () => {
  const app = source('src/App.tsx');
  assert.equal((app.match(/<AccountControls \/>/g) || []).length, (app.match(/<NotificationCenterHost \/>/g) || []).length);
  const center = source('src/components/notifications/NotificationCenter.tsx');
  assert.match(center, /afterOverlayHistory\('mhNotifications', \(\) => setActivePage\(page\)\)/, 'a page opens after the center left history');
  assert.match(source('src/components/auth/MyAccountHub.tsx'), /afterOverlayHistory\('mhAccount', \(\) => setActivePage\('earn'\)\)/);
  assert.match(source('src/components/auth/SecurityDialog.tsx'), /if \(pressedOutside\.current && event\.target === event\.currentTarget\) closeRef\.current\?\.\(\);/, 'a press outside the panel closes it');
  assert.match(source('src/components/auth/NotificationSettings.tsx'), /allowable && !prefs && !prefsError/, 'the card waits for the account’s choices');
});
