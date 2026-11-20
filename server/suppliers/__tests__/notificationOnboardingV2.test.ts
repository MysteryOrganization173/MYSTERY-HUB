/**
 * Mystery Hub 3.4 — Notification Onboarding V2: discoverability, timing and the permission experience.
 * Each test names the acceptance item(s) it covers (brief § 14, items 1–25). Item 25 (narrow layouts) is checked in
 * the browser by scripts/reviewNotificationOnboardingV2.cjs; the CSS guarantees it relies on are asserted here.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  calmPage, claimInvitation, DAY, engaged, inlineOfferInView, inlineOfferVisible, invitationOnScreen, invitationPlan, notificationRestEnds,
  INVITATION_KEYS, NEW_SESSION, noteDismissal, noteNotificationsYield, notificationsLead, NOTIFICATION_TIMING,
  noteView, readSeen, readSession, registerInlineOffer, releaseInvitation, resetInvitationsForTest, sessionAllows,
  setInlineOfferInView, SETTLE_MS,
} from '../../../src/pwa/invitations.js';
import { installPromoMode, notificationInviteResting, notificationSnoozeEnds, NO_SNOOZE, readSnooze, recordDismissal, STORAGE_KEYS } from '../../../src/pwa/launchPolicy.js';
import { createAutoHide, type AutoHideClock } from '../../../src/pwa/autoHide.js';
import { activateNotificationInvite, inviteConsent, notificationInviteOpportunity, onNotificationChoice } from '../../../src/pwa/notificationOnboarding.js';
import { NOTIFICATION_ACTIONS, notificationCopy, notificationNote, PAUSED_INVITE_NOTE } from '../../../src/pwa/invitationCopy.js';
import { appBusy, isFormEntry } from '../../../src/components/pwa/invitationBusy.js';
import { pushEndpointHash } from '../../../src/services/customerNotifications.js';

const read = (file: string) => readFileSync(file, 'utf8');
const now = Date.UTC(2026, 10, 20, 12);
const HOUR = 3_600_000;
const memory = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) }; };
const withBrowser = (fn: (stores: { local: ReturnType<typeof memory>; tab: ReturnType<typeof memory> }) => void) => {
  const previous = (globalThis as { window?: unknown }).window;
  const stores = { local: memory(), tab: memory() };
  (globalThis as { window?: unknown }).window = { localStorage: stores.local, sessionStorage: stores.tab };
  resetInvitationsForTest();
  try { fn(stores); } finally { resetInvitationsForTest(); (globalThis as { window?: unknown }).window = previous; }
};
/** A new visit in the same browser: a fresh tab session, the same local storage. */
const newVisit = (stores: { tab: ReturnType<typeof memory> }) => {
  resetInvitationsForTest();
  const tab = memory();
  (globalThis as { window: { sessionStorage: unknown } }).window.sessionStorage = tab;
  stores.tab = tab;
};

/** A controllable clock for the auto-hide timer. */
function fakeClock() {
  let t = 0, nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: AutoHideClock & { advance(ms: number): void; active(): number } = {
    now: () => t,
    setTimeout: (fn, ms) => { const id = nextId++; timers.set(id, { at: t + ms, fn }); return id; },
    clearTimeout: id => { timers.delete(id as number); },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]); t = due[1].at; due[1].fn();
      }
      t = end;
    },
    active: () => timers.size,
  };
  return clock;
}

// A browser with Web Push and a server, as in notificationOnboarding.test.ts (synthetic keys and endpoints only).
const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/synthetic-v2-device';
function device(o: { permission?: NotificationPermission; answer?: NotificationPermission; paused?: boolean; enabled?: boolean; guests?: boolean; optedOut?: boolean; subscribed?: boolean; registered?: boolean } = {}) {
  let permission: NotificationPermission = o.permission ?? 'default', asks = 0, subscription: any = null;
  const registered = new Map<string, unknown>(), calls = { configuration: 0, preferences: 0, deviceStatus: 0, register: [] as unknown[] };
  const guestRegs = new Map<string, string>();
  const make = () => ({ endpoint: ENDPOINT, toJSON: () => ({ endpoint: ENDPOINT, expirationTime: null, keys: { p256dh: 'k', auth: 'a' } }), unsubscribe: async () => { subscription = null; return true; } });
  if (o.subscribed) subscription = make();
  if (o.registered) registered.set(ENDPOINT, null);
  const pushManager = { async getSubscription() { return subscription; }, async subscribe() { subscription = make(); return subscription; } };
  const env: any = {
    navigator: { serviceWorker: { getRegistration: async () => ({ pushManager }), register: async () => ({ pushManager }) } }, PushManager: class {},
    isSecureContext: true, location: { pathname: '/' },
    Notification: { get permission() { return permission; }, requestPermission: async () => { asks++; permission = o.answer ?? 'granted'; return permission; } },
  };
  env.top = env; env.self = env;
  const client: any = {
    available: true,
    async configuration() { calls.configuration++; return { enabled: o.enabled ?? true, publicKey: KEY, workerPath: '/push-sw.js', guests: o.guests ?? true, paused: o.paused ?? false }; },
    async publicKey() { return KEY; },
    async deviceStatus(_t: string, endpoint: string) { calls.deviceStatus++; return { subscribed: registered.has(endpoint) }; },
    // The server accepts a registration whether or not sending is paused (NotificationService.subscribe).
    async register(_t: string, sub: any, consent: unknown) { calls.register.push(consent); registered.set(sub.endpoint, consent); return { ok: true, value: { transactional: true, promotional: true } }; },
    async unregister() { return { ok: true, value: undefined }; },
    async preferences() { calls.preferences++; return { transactional: true, promotional: false, marketingOptedOut: o.optedOut ?? false, version: '' }; },
    async savePreferences() { throw new Error('never written by onboarding'); },
  };
  const guest: any = {
    async register(sub: any) { const credential = '22222222-2222-4222-8222-222222222222.' + 'b'.repeat(43); guestRegs.set(credential, sub.endpoint); return { credential }; },
    async status(credential: string) { const endpoint = guestRegs.get(credential); return endpoint ? { subscribed: true, endpointHash: await pushEndpointHash(endpoint) } : { subscribed: false, endpointHash: null }; },
    async unregister() {},
  };
  const options = (token: string | null, extra: object = {}) => ({ token, accountId: token ? 'buyer-v2' : undefined, isCustomer: token ? true : undefined, signal: new AbortController().signal, snooze: NO_SNOOZE, now: Date.now(), environment: env, ...extra });
  return { env, client, guest, calls, options, asks: () => asks, registered };
}

const plan = (input: Partial<Parameters<typeof invitationPlan>[0]>) => invitationPlan({ notifications: false, install: false, channel: false, othersWaiting: false, engaged: false, lead: true, ...input });

test('1–3: a first-time visitor gets the notification card on the landing page, five seconds after it settles, with no engagement needed', () => {
  assert.equal(sessionAllows('notifications', NEW_SESSION, {}, now), true, 'a new visit in a new browser');
  assert.equal(notificationsLead(NEW_SESSION, {}, now), true, 'nothing shown before: notifications lead');
  assert.equal(engaged(NEW_SESSION), false, 'one page, no time on site');
  const first = plan({ notifications: true, engaged: false });
  assert.deepEqual(first.order, ['notifications'], 'no second page view or 25 seconds of use required');
  assert.equal(first.delayMs, 5_000, 'about five seconds after the page settles');
  assert.equal(NOTIFICATION_TIMING.settleMs, 5_000);
  // Install and the Channel keep their own engagement rule and 2-second settle.
  assert.deepEqual(plan({ install: true, channel: true, othersWaiting: true, engaged: false }).order, []);
  assert.deepEqual(plan({ install: true, channel: true, othersWaiting: true, engaged: true }), { order: ['install', 'channel'], delayMs: SETTLE_MS, yieldTurn: false });
});

test('4: an untouched card leaves about 12 seconds after it became visible; hover, focus, a hidden tab and a tap hold it', () => {
  assert.ok(NOTIFICATION_TIMING.autoHideMs >= 10_000 && NOTIFICATION_TIMING.autoHideMs <= 12_000, 'within the 10–12 second target');
  const clock = fakeClock();
  let expired = 0;
  const auto = createAutoHide(() => { expired++; }, clock);
  clock.advance(60_000);
  assert.equal(expired, 0, 'nothing counts before the card is visible');
  auto.start();
  clock.advance(NOTIFICATION_TIMING.autoHideMs - 1);
  assert.equal(expired, 0);
  clock.advance(1);
  assert.equal(expired, 1, 'gone after about 12 seconds untouched');

  const hovered = fakeClock(); let gone = false;
  const h = createAutoHide(() => { gone = true; }, hovered);
  h.start(); hovered.advance(9_000); h.hold('hover'); hovered.advance(120_000);
  assert.equal(gone, false, 'never while the pointer rests on it');
  h.release('hover'); hovered.advance(NOTIFICATION_TIMING.resumeMinMs - 1);
  assert.equal(gone, false, 'at least four seconds remain after the pointer leaves');
  hovered.advance(1); assert.equal(gone, true);

  const focused = fakeClock(); let leftFocused = false;
  const f = createAutoHide(() => { leftFocused = true; }, focused);
  f.hold('focus'); f.start(); focused.advance(60_000);
  assert.equal(leftFocused, false, 'keyboard focus inside holds it, even from the start');
  f.release('focus'); focused.advance(NOTIFICATION_TIMING.autoHideMs); assert.equal(leftFocused, true, 'the full time remains if it never ran');

  const hidden = fakeClock(); let hiddenGone = false;
  const v = createAutoHide(() => { hiddenGone = true; }, hidden);
  v.start(); hidden.advance(5_000); v.hold('hidden'); hidden.advance(10 * 60_000);
  assert.equal(hiddenGone, false, 'a background tab does not use up its time');
  v.release('hidden'); hidden.advance(6_999); assert.equal(hiddenGone, false); hidden.advance(1); assert.equal(hiddenGone, true, 'the remaining seven seconds');

  const tapped = fakeClock(); let tappedGone = false;
  const t = createAutoHide(() => { tappedGone = true; }, tapped);
  t.start(); tapped.advance(3_000); t.hold('interacted'); t.release('interacted'); tapped.advance(10 * 60_000);
  assert.equal(tappedGone, false, 'a tap or click inside holds it for good');

  const stopped = fakeClock(); let stoppedGone = false;
  const s = createAutoHide(() => { stoppedGone = true; }, stopped);
  s.start(); s.stop(); stopped.advance(60_000);
  assert.equal(stoppedGone, false, 'after Allow (working, result) the clock is stopped');
  assert.equal(stopped.active(), 0, 'no timer left behind');
});

test('5–6: leaving by itself is "ignored": no dismissal, no snooze, nothing else this visit; it may return on a later visit', () => withBrowser(stores => {
  noteView('home');
  assert.equal(claimInvitation(['notifications', 'install', 'channel'], now), 'notifications');
  releaseInvitation('notifications'); // the card left by itself (close('ignored') releases without noteDismissal)
  assert.equal(readSession().dismissed, false, 'not a dismissal');
  assert.deepEqual(readSnooze(STORAGE_KEYS.notificationOptIn, stores.local), NO_SNOOZE, 'no "Not now" count, no three-day snooze');
  assert.equal(claimInvitation(['install', 'channel', 'notifications'], now + 1_000), null, 'not replaced by Install or the Channel');
  noteView('data');
  assert.equal(claimInvitation(['notifications'], now + 60_000), null, 'and it does not reappear on the next page');
  // A later visit: a new tab session in the same browser.
  newVisit(stores);
  assert.equal(sessionAllows('notifications', readSession(), readSeen(), now + 2 * HOUR), false, 'not straight back in a new tab (12-hour rest, any tab)');
  assert.equal(sessionAllows('notifications', readSession(), readSeen(), now + 12 * HOUR), true, 'back on a later visit, with no multi-day penalty');
  assert.equal(NOTIFICATION_TIMING.ignoredRestMs, 12 * HOUR);
  const source = read('src/components/pwa/InvitationLayer.tsx');
  assert.match(source, /const auto = createAutoHide\(\(\) => \{\n\s+if \(reduced\) \{ onClose\('ignored'\); return; \}/, 'auto-hide closes as ignored');
  assert.match(source, /leaveTimer\.current = window\.setTimeout\(\(\) => \{ leaveTimer\.current = null; onClose\('ignored'\); \}, NOTIFICATION_TIMING\.exitMs\);/);
  assert.match(source, /if \(outcome === 'dismissed'\) noteDismissal\(\);/, 'only an explicit answer ends the visit\'s suggestions');
}));

test('7–9: "Not now" and close rest three days every time; old two-strike records and repeated answers never suppress for good', () => withBrowser(stores => {
  assert.equal(NOTIFICATION_TIMING.snoozeDays, 3);
  recordDismissal(STORAGE_KEYS.notificationOptIn, now, stores.local);
  const once = readSnooze(STORAGE_KEYS.notificationOptIn, stores.local);
  assert.equal(notificationInviteResting(once, now + 2 * DAY + 23 * HOUR), true, 'resting for three days');
  assert.equal(notificationInviteResting(once, now + 3 * DAY), false, 'back after three days');
  // The old implementation stopped after two answers ({ count: 2 }); such a record is read under the new rule.
  stores.local.setItem(STORAGE_KEYS.notificationOptIn, JSON.stringify({ count: 2, lastAt: now - 40 * DAY }));
  assert.equal(notificationInviteResting(readSnooze(STORAGE_KEYS.notificationOptIn, stores.local), now), false, 'old two-dismissal record: not suppressed');
  stores.local.setItem(STORAGE_KEYS.notificationOptIn, JSON.stringify({ count: 2, lastAt: now - DAY }));
  assert.equal(notificationInviteResting(readSnooze(STORAGE_KEYS.notificationOptIn, stores.local), now), true, 'a recent old answer still rests out its three days');
  let at = now;
  for (let i = 0; i < 6; i++) { recordDismissal(STORAGE_KEYS.notificationOptIn, at, stores.local); at += 3 * DAY; }
  assert.equal(readSnooze(STORAGE_KEYS.notificationOptIn, stores.local).count, 8, 'the count is kept (history) but never used');
  assert.equal(notificationInviteResting(readSnooze(STORAGE_KEYS.notificationOptIn, stores.local), at), false, 'six more answers: still only three days');
  // Corrupt, invalid or unreadable records, and changed clocks.
  stores.local.setItem(STORAGE_KEYS.notificationOptIn, '{not json');
  assert.equal(notificationInviteResting(readSnooze(STORAGE_KEYS.notificationOptIn, stores.local), now), false);
  stores.local.setItem(STORAGE_KEYS.notificationOptIn, JSON.stringify({ count: 'two', lastAt: 'yesterday' }));
  assert.equal(notificationInviteResting(readSnooze(STORAGE_KEYS.notificationOptIn, stores.local), now), false);
  assert.equal(notificationInviteResting(readSnooze(STORAGE_KEYS.notificationOptIn, null), now), false, 'storage unavailable: nothing remembered');
  assert.equal(notificationInviteResting({ count: 1, lastAt: now + 400 * DAY }, now), false, 'a far-future time (clock set back) never locks the card away');
  assert.equal(notificationInviteResting({ count: 1, lastAt: now + 6 * HOUR }, now), true, 'a slightly-ahead clock still rests from that time');
  assert.equal(notificationInviteResting({ count: 1, lastAt: -5 }, now), false);
  // The visit rule: nothing more after an explicit answer, whatever the kind.
  noteDismissal();
  assert.equal(sessionAllows('notifications', readSession(), {}, now), false, 'no repeat prompt in the same visit');
  // Install keeps its own 30-day / three-strike rule; the three days are not copied onto it.
  assert.equal(installPromoMode({ installed: false, hasPrompt: true, appleHomeScreen: false, snooze: { count: 1, lastAt: now - 4 * DAY }, now }), 'hidden');
  assert.equal(installPromoMode({ installed: false, hasPrompt: true, appleHomeScreen: false, snooze: { count: 3, lastAt: now - 400 * DAY }, now }), 'hidden');
}));

test('10–11, 24: one card per visit, never two at once, never beside an in-page install card, and no overlapping timers', () => withBrowser(() => {
  assert.equal(claimInvitation(['notifications'], now), 'notifications');
  assert.equal(invitationOnScreen(), 'notifications');
  assert.equal(claimInvitation(['install', 'channel'], now), null, 'never two at once');
  assert.equal(claimInvitation(['notifications'], now), null, 'a racing second timer cannot claim again');
  releaseInvitation('notifications');
  for (const page of ['data', 'services', 'home']) { noteView(page); assert.equal(claimInvitation(['notifications', 'install', 'channel'], now + DAY), null, `no repeat on ${page}`); }
  // In-page install cards: the floating Install and Channel cards stay off that page; nothing floats beside one on screen.
  const release = registerInlineOffer('home-install');
  assert.equal(inlineOfferVisible(), true);
  assert.equal(inlineOfferInView(), true, 'counts as on screen until the page says otherwise');
  setInlineOfferInView('home-install', false);
  assert.equal(inlineOfferInView(), false, 'scrolled out of view');
  setInlineOfferInView('home-install', true);
  assert.equal(inlineOfferInView(), true);
  release();
  assert.equal(inlineOfferInView(), false);
  setInlineOfferInView('home-install', true);
  assert.equal(inlineOfferInView(), false, 'a card that stopped offering cannot come back by a late observer report');
  const layer = read('src/components/pwa/InvitationLayer.tsx');
  assert.match(layer, /install: installAllowed && !inlineOffer, channel: channelAllowed && !inlineOffer,/);
  assert.match(layer, /const calm = !shown && !slot && !busy && !typing && tabVisible && loaded && !inlineInView && onCalmPage;/);
  assert.match(layer, /if \(shown && stage !== 'working' && \(busy \|\| typing \|\| inlineInView \|\| activePage !== shown\.page\)\) close\('ignored'\);/);
  // One settle timer, measured from when the page became calm: re-renders reschedule it without restarting the clock.
  assert.match(layer, /useEffect\(\(\) => \{ setCalmSince\(calm \? Date\.now\(\) : null\); \}, \[calm, activePage\]\);/);
  assert.match(layer, /\}, Math\.max\(0, calmSince \+ plan\.delayMs - Date\.now\(\)\)\);\n\s+return \(\) => window\.clearTimeout\(timer\);/);
}));

test('turn-taking: notifications lead, give one visit to Install or the Channel after being shown, then lead again; neither starves', () => withBrowser(stores => {
  // Visit 1: the card is shown and left alone.
  assert.equal(notificationsLead(readSession(), readSeen(), now), true);
  assert.equal(claimInvitation(['notifications'], now), 'notifications');
  releaseInvitation('notifications');
  // Visit 2 (a day later): Install is waiting, so this visit is its turn; notifications stay away for the visit.
  newVisit(stores);
  const later = now + DAY;
  assert.equal(notificationsLead(readSession(), readSeen(), later), false);
  const turn = plan({ notifications: true, install: true, othersWaiting: true, engaged: false, lead: false });
  assert.deepEqual(turn, { order: [], delayMs: SETTLE_MS, yieldTurn: true }, 'waits for engagement for Install; no notification card');
  assert.deepEqual(plan({ notifications: true, install: true, othersWaiting: true, engaged: true, lead: false }).order, ['install'], 'the notification card does not take back the turn');
  noteNotificationsYield(later);
  assert.equal(readSession().yielded, true);
  assert.equal(notificationsLead(readSession(), readSeen(), later), false, 'decided once for the visit');
  // Visit 3: even if Install never appeared (the visitor left early), notifications lead again.
  newVisit(stores);
  assert.equal(notificationsLead(readSession(), readSeen(), later + DAY), true, 'no starvation of notifications');
  // When nothing else is possible at all, notifications are not held back.
  assert.deepEqual(plan({ notifications: true, othersWaiting: false, lead: false }).order, ['notifications']);
  // An in-page install card is Install's turn on its page: the floating card is off the page, and nothing else floats.
  assert.deepEqual(plan({ notifications: true, install: false, othersWaiting: true, engaged: true, lead: false }).order, []);
  // After Install was shown, notifications lead.
  assert.equal(notificationsLead(NEW_SESSION, { notifications: now, install: now + HOUR }, now + DAY), true);
  assert.equal(notificationsLead(NEW_SESSION, { notifications: now + HOUR, install: now }, now + DAY), false);
  assert.equal(notificationsLead(NEW_SESSION, { notifications: now + 900 * DAY }, now), true, 'a far-future record never blocks the lead');
  const stored = JSON.parse(stores.local.getItem(INVITATION_KEYS.seen) || '{}');
  assert.equal(stored.yield, later, 'the given-away visit is remembered across tabs');
}));

test('12–14: Allow asks the browser only from the tap, registration is confirmed by the server, and a granted-but-unregistered device is repaired without a prompt', async () => {
  const fresh = device();
  const invite = await notificationInviteOpportunity(fresh.client, fresh.guest, fresh.options('token'));
  assert.equal(fresh.asks(), 0, 'assessing never asks the browser');
  assert.equal(invite?.repair, false);
  assert.deepEqual(await activateNotificationInvite(fresh.client, fresh.guest, invite!, fresh.options('token')), { step: 'registered' });
  assert.equal(fresh.asks(), 1, 'one real permission request, from the tap');
  assert.equal(fresh.registered.has(ENDPOINT), true, 'success only after the server holds and confirms the device');
  const layer = read('src/components/pwa/InvitationLayer.tsx');
  assert.match(layer, /onClick=\{\(\) => \{ void allow\(\); \}\}>\{step === 'working' \? 'Allowing…' : NOTIFICATION_ACTIONS\.allow\}/, 'the request starts from the button press');

  const repair = device({ permission: 'granted' });
  const fix = await notificationInviteOpportunity(repair.client, repair.guest, repair.options('token'));
  assert.deepEqual(fix && { repair: fix.repair, permission: fix.permission }, { repair: true, permission: 'granted' });
  assert.equal(notificationNote(fix!), 'Your browser already allows them. You can turn them off anytime.');
  assert.deepEqual(await activateNotificationInvite(repair.client, repair.guest, fix!, repair.options('token')), { step: 'registered' });
  assert.equal(repair.asks(), 0, 'the existing permission is reused: no new prompt');

  const stale = device({ permission: 'granted', subscribed: true });
  const half = await notificationInviteOpportunity(stale.client, stale.guest, stale.options('token'));
  assert.equal(half?.repair, true, 'a subscription the server does not hold is repaired too');
  assert.deepEqual(await activateNotificationInvite(stale.client, stale.guest, half!, stale.options('token')), { step: 'registered' });
  assert.equal(stale.asks(), 0);
});

test('15–16: a registered device is never asked again; a blocked browser is respected; either answer retires invitations assessed earlier', async () => {
  const done = device({ permission: 'granted', subscribed: true, registered: true });
  assert.equal(await notificationInviteOpportunity(done.client, done.guest, done.options('token')), null, 'the server confirms this device: no invitation');
  assert.equal(done.calls.deviceStatus, 1, 'checked against the server, not local memory');
  const blocked = device({ permission: 'denied' });
  assert.equal(await notificationInviteOpportunity(blocked.client, blocked.guest, blocked.options('token')), null);
  assert.equal(await notificationInviteOpportunity(blocked.client, blocked.guest, blocked.options(null)), null, 'visitors too');
  assert.equal(blocked.asks(), 0);
  const heard: string[] = [];
  const stop = onNotificationChoice(step => heard.push(step));
  try {
    const no = device({ answer: 'denied' });
    assert.equal((await activateNotificationInvite(no.client, no.guest, { audience: 'member', offers: true }, no.options('token'))).step, 'denied');
    assert.equal(await notificationInviteOpportunity(no.client, no.guest, no.options('token')), null, 'never asked again after "Block"');
    const yes = device();
    await activateNotificationInvite(yes.client, yes.guest, { audience: 'member', offers: false }, yes.options('token'));
    assert.deepEqual(heard, ['denied', 'registered'], 'the coordinator hears both, from any Allow on the page');
    const closed = device({ answer: 'default' });
    assert.equal((await activateNotificationInvite(closed.client, closed.guest, { audience: 'member', offers: true }, closed.options('token'))).step, 'dismissed');
    assert.deepEqual(heard, ['denied', 'registered'], 'closing the browser question is neither');
  } finally { stop(); }
  const layer = read('src/components/pwa/InvitationLayer.tsx');
  assert.match(layer, /useEffect\(\(\) => onNotificationChoice\(\(\) => setNotifyDone\(true\)\), \[\]\);/);
  assert.match(layer, /notifications: Boolean\(notifyInvite\) && !notifyDone && !notificationInviteResting\(readSnooze\(STORAGE_KEYS\.notificationOptIn\), now\) && sessionAllows\('notifications', session, seen, now, \{ installedApp \}\),/);
  assert.match(layer, /notificationPermissionState\(\) !== invite\.permission/, 'a permission changed in another tab is assessed again');
});

test('17: consent follows the words, and a previous "no" to offers is never revived', async () => {
  const optedOut = device({ optedOut: true });
  const invite = await notificationInviteOpportunity(optedOut.client, optedOut.guest, optedOut.options('token'));
  assert.equal(invite?.offers, false);
  assert.equal(notificationCopy(invite!).text, 'Get updates about your orders on this device.');
  await activateNotificationInvite(optedOut.client, optedOut.guest, invite!, optedOut.options('token'));
  assert.deepEqual(optedOut.calls.register, [inviteConsent({ audience: 'member', offers: false })]);
  assert.deepEqual(inviteConsent({ audience: 'member', offers: false }).purposes, ['transactional']);
  assert.deepEqual(notificationCopy({ audience: 'member', offers: true }), { title: 'Stay updated.', text: 'Get order updates, service news and occasional offers.' }, 'the approved copy');
  assert.deepEqual([NOTIFICATION_ACTIONS.allow, NOTIFICATION_ACTIONS.later], ['Allow Notifications', 'Not now']);
});

test('18: an operator pause does not hide onboarding; registering still works and the card says when notifications arrive', async () => {
  const paused = device({ paused: true });
  const invite = await notificationInviteOpportunity(paused.client, paused.guest, paused.options('token'));
  assert.equal(invite?.paused, true, 'still invited while sending is paused');
  assert.deepEqual(await activateNotificationInvite(paused.client, paused.guest, invite!, paused.options('token')), { step: 'registered' });
  assert.equal(PAUSED_INVITE_NOTE, 'Notifications will arrive once sending resumes.');
  assert.doesNotMatch(PAUSED_INVITE_NOTE, /\d|today|tomorrow|soon/i, 'no date and no promise of timing');
  const guestPaused = device({ paused: true });
  assert.equal((await notificationInviteOpportunity(guestPaused.client, guestPaused.guest, guestPaused.options(null)))?.paused, true, 'visitors too');
  assert.equal(await notificationInviteOpportunity(device({ enabled: false }).client, paused.guest, paused.options('token')), null, 'not configured: registration would be refused, so nothing is offered');
  // The backend contract: registering is refused only when Web Push is not configured, never because of the pause.
  const service = read('server/services/notificationService.ts');
  const subscribe = service.slice(service.indexOf(' static async subscribe('), service.indexOf(' static async guestStatus('));
  assert.ok(subscribe.length > 500);
  assert.doesNotMatch(subscribe, /paused/, 'member and guest registration do not check the pause');
  const layer = read('src/components/pwa/InvitationLayer.tsx');
  assert.match(layer, /\{invite\.paused && <p className="mh-invite-note mh-invite-paused">\{PAUSED_INVITE_NOTE\}<\/p>\}/);
  assert.match(layer, /\{step === 'registered' && invite\.paused && <p className="mh-invite-note mh-invite-paused">\{PAUSED_INVITE_NOTE\}<\/p>\}/, 'success says "on", and that they arrive once sending resumes');
});

test('19–20: install is never advertised in the installed app; checkout, sign-in, account security and typing are never interrupted', () => {
  assert.equal(installPromoMode({ installed: true, hasPrompt: true, appleHomeScreen: true, snooze: NO_SNOOZE, now }), 'hidden');
  const base: any = { activeEditorSite: null, isMysteryAiOpen: false, isCheckoutOpen: false, isStatusModalOpen: false, isAuthModalOpen: false, selectedTemplatePreview: null, marketplaceInquiryProduct: null, waitlistInfo: { isOpen: false }, isAccountOpen: false, user: null };
  assert.equal(appBusy(base), false);
  for (const busy of [{ isCheckoutOpen: true }, { isStatusModalOpen: true }, { isAuthModalOpen: true }, { isAccountOpen: true }, { activeEditorSite: { id: 's' } }, { user: { mustChangePassword: true } }]) assert.equal(appBusy({ ...base, ...busy }), true, JSON.stringify(busy));
  for (const page of ['orders', 'wallet', 'afa', 'checkers', 'admin', 'editor', 'business', 'app']) assert.equal(calmPage(page, ''), false, page);
  assert.equal(calmPage('home', '?reference=MH-PAY-1'), false, 'an uncertain payment return');
  for (const field of [{ tagName: 'INPUT' }, { tagName: 'INPUT', type: 'tel' }, { tagName: 'INPUT', type: 'email' }, { tagName: 'INPUT', type: 'password' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }]) assert.equal(isFormEntry(field), true, JSON.stringify(field));
  for (const control of [null, { tagName: 'BUTTON' }, { tagName: 'A' }, { tagName: 'INPUT', type: 'checkbox' }, { tagName: 'INPUT', type: 'submit' }, { tagName: 'INPUT', type: 'radio' }]) assert.equal(isFormEntry(control), false, JSON.stringify(control));
  const layer = read('src/components/pwa/InvitationLayer.tsx');
  assert.match(layer, /const busy = overlays > 0 \|\| isAuthChecking \|\| appBusy\(app\);/, 'any dialog, sheet or menu on the shared overlay stack');
  assert.match(layer, /if \(!shown \|\| stage === 'working'\) return;/, 'a working card is never cut off by a scroll');
});

test('21–22: visitors follow the guest-news flag; browsers that cannot receive Web Push are offered nothing impossible', async () => {
  const open = device({ guests: true });
  assert.equal((await notificationInviteOpportunity(open.client, open.guest, open.options(null)))?.audience, 'guest');
  assert.equal(notificationCopy({ audience: 'guest', offers: true }).text, 'Get Mystery Hub service news and occasional offers.', 'the guest wording, no order updates');
  const closed = device({ guests: false });
  assert.equal(await notificationInviteOpportunity(closed.client, closed.guest, closed.options(null)), null, 'WEB_PUSH_GUEST_NEWS off: nothing claimed for visitors');
  const iphoneTab = device(); delete iphoneTab.env.PushManager;
  assert.equal(await notificationInviteOpportunity(iphoneTab.client, iphoneTab.guest, iphoneTab.options('token')), null, 'an iPhone Safari tab (no Web Push) is not offered it');
  const webview = device(); delete webview.env.navigator.serviceWorker;
  assert.equal(await notificationInviteOpportunity(webview.client, webview.guest, webview.options('token')), null, 'an in-app browser without a service worker');
  const framed = device(); framed.env.top = {};
  assert.equal(await notificationInviteOpportunity(framed.client, framed.guest, framed.options('token')), null, 'an embedded frame');
  const site = device(); site.env.location = { pathname: '/sites/demo' };
  assert.equal(await notificationInviteOpportunity(site.client, site.guest, site.options('token')), null, 'a published business website');
  assert.equal(iphoneTab.calls.configuration + webview.calls.configuration, 0, 'no request at all where nothing is possible');
});

test('23: one read-only assessment per account per page life; nothing is fetched again on re-render', async () => {
  const member = device();
  await notificationInviteOpportunity(member.client, member.guest, member.options('token'));
  assert.deepEqual({ configuration: member.calls.configuration, preferences: member.calls.preferences, deviceStatus: member.calls.deviceStatus }, { configuration: 1, preferences: 1, deviceStatus: 0 });
  const aborted = device();
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => notificationInviteOpportunity(aborted.client, aborted.guest, aborted.options('token', { signal: controller.signal })));
  assert.equal(aborted.calls.configuration, 0, 'a cancelled assessment (sign-out, another account) stops before any request');
  const layer = read('src/components/pwa/InvitationLayer.tsx');
  assert.match(layer, /if \(assessment\.current\?\.key === accountKey\) return;\n\s+assessment\.current\?\.controller\.abort\(\);/, 'keyed by account and session; the previous request is cancelled');
  assert.match(layer, /\}, \[accountKey, isAuthChecking, onCalmPage, reassess\]\);/, 'not re-run by engagement ticks or other re-renders');
  assert.match(layer, /useEffect\(\(\) => \{ if \(shown\?\.kind === 'notifications'\) close\('ignored'\); \}, \[accountKey\]\);/, 'another account never inherits the card');
});

test('25: the card stays a small, nonblocking strip on narrow phones, and reduced motion removes the exit motion', () => {
  const css = read('src/components/pwa/pwa.css');
  assert.match(css, /\.mh-invite \{\n\s+position: fixed; z-index: 46; left: 12px; right: 12px; bottom: calc\(4\.75rem \+ env\(safe-area-inset-bottom, 0px\)\);/, 'above the phone tab bar, inside a 12 px gutter');
  assert.match(css, /max-height: calc\(100dvh - 10rem\)/);
  assert.match(css, /@media \(max-height: 640px\) and \(max-width: 767px\)/, 'short Android screens get a tighter card');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.mh-invite, \.mh-invite-leaving \{ animation: none; \} \}/);
  assert.match(read('src/components/pwa/InvitationLayer.tsx'), /window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/, 'with reduced motion it simply goes');
});

// ── Independent review fixes ──────────────────────────────────────────────────────────────────────────────────

test('review H1: a failure before the browser asks is an error with Try again, never a "Not now"', async () => {
  const offline = device();
  offline.client.publicKey = async () => { throw new Error('Network down'); };
  const result = await activateNotificationInvite(offline.client, offline.guest, { audience: 'member', offers: true }, offline.options('token'));
  assert.equal(result.step, 'error', 'not dismissed: no three-day snooze for a yes that never reached the browser');
  assert.equal(offline.asks(), 0, 'a service that cannot answer never leads to a permission request');
  const guestOffline = device();
  guestOffline.client.publicKey = async () => { throw new Error('Network down'); };
  assert.equal((await activateNotificationInvite(guestOffline.client, guestOffline.guest, { audience: 'guest', offers: true }, guestOffline.options(null))).step, 'error');
  const closed = device({ answer: 'default' });
  assert.equal((await activateNotificationInvite(closed.client, closed.guest, { audience: 'member', offers: true }, closed.options('token'))).step, 'dismissed', 'only a browser question that was really asked and closed is "dismissed"');
  // The HTTP client answers the key at once from the configuration the assessment just read, so the browser's
  // question follows the tap without a network wait.
  const client = read('src/services/customerNotifications.ts');
  assert.match(client, /async publicKey\(\)\{if\(knownKey&&Date\.now\(\)-knownKey\.at<KNOWN_KEY_MS\)return knownKey\.key;/);
  assert.match(client, /knownKey=c&&c\.enabled&&c\.publicKey\?\{key:c\.publicKey,at:Date\.now\(\)\}:null;/, 'a disabled configuration forgets the key');
});

test('review M1: "Not now" given elsewhere (Notification Center, another tab) stops the floating card at once', () => {
  const layer = read('src/components/pwa/InvitationLayer.tsx');
  assert.match(layer, /const order = latest\.order\.filter\(kind => kind !== 'notifications' \|\| !notificationInviteResting\(readSnooze\(STORAGE_KEYS\.notificationOptIn\), Date\.now\(\)\)\);/, 're-read when the timer fires');
  assert.match(read('src/components/notifications/NotificationCenter.tsx'), /const notNow = \(\) => \{ recordDismissal\(STORAGE_KEYS\.notificationOptIn\);/, 'the Notification Center writes the same snooze');
});

test('review M2: an in-page install card registered below the fold never counts as on screen', () => withBrowser(() => {
  const release = registerInlineOffer('below-fold', false);
  assert.equal(inlineOfferVisible(), true, 'still the page’s install suggestion');
  assert.equal(inlineOfferInView(), false, 'but not on screen, so a floating notification card is not knocked off');
  release();
  assert.match(read('src/components/pwa/InstallAppPromo.tsx'), /registerInlineOffer\(offerId, observe \? onScreen\(section!\) : true\)/);
}));

test('review M3 and L1: keyboard users get the time they need; the exit can always be stopped; focus is kept after Allow', () => {
  const clock = fakeClock(); let gone = false;
  const auto = createAutoHide(() => { gone = true; }, clock);
  auto.start(); clock.advance(2_000); auto.hold('keyboard'); clock.advance(10 * 60_000);
  assert.equal(gone, false, 'someone moving by keyboard is not raced to the end of the page');
  auto.hold('focus'); auto.release('focus'); auto.release('keyboard');
  clock.advance(NOTIFICATION_TIMING.resumeMinMs + 6_000); assert.equal(gone, true, 'after visiting the card and leaving it, the usual time');
  const layer = read('src/components/pwa/InvitationLayer.tsx');
  assert.match(layer, /notifications: 'Suggestion: turn on Mystery Hub notifications, at the end of the page for a few seconds\. Notifications in the footer is always there\.',/);
  assert.match(layer, /const keydown = \(event: KeyboardEvent\) => \{ if \(!visited && \(event\.key === 'Tab' \|\| event\.key === 'F6'\)\) auto\.hold\('keyboard'\); \};/);
  assert.match(layer, /const focusIn = \(\) => \{ auto\.hold\('focus'\); cancelExit\(\); \};/);
  assert.match(layer, /card\.addEventListener\('click', cancelExit\);/);
  assert.match(layer, /return \(\) => \{\n\s+auto\.stop\(\);\n\s+cancelExit\(\);/, 'leaving the first state stops a pending exit');
  assert.match(layer, /focusResult\.current = Boolean\(cardRef\.current\?\.contains\(document\.activeElement\)\);/);
  assert.match(layer, /style=\{leaving \? \{ animationDuration: `\$\{NOTIFICATION_TIMING\.exitMs\}ms` \} : undefined\}/, 'the exit length comes from the timing constants');
});

test('review L2–L3: no assessment when the card cannot appear; no notification card right after another tab’s card', () => {
  const layer = read('src/components/pwa/InvitationLayer.tsx');
  assert.match(layer, /if \(restEnds > at \|\| !sessionAllows\('notifications', visit, readSeen\(\), at, \{ installedApp \}\)\) \{\n\s+setNotifyAssessed\(key\);/);
  assert.equal(NOTIFICATION_TIMING.afterOtherMs, 30 * 60_000);
  assert.equal(sessionAllows('notifications', NEW_SESSION, { channel: now - 5 * 60_000 }, now), false, 'a Channel card in another tab five minutes ago');
  assert.equal(sessionAllows('notifications', NEW_SESSION, { channel: now - 31 * 60_000 }, now), true);
  assert.equal(sessionAllows('notifications', NEW_SESSION, { install: now - 60_000 }, now, { installedApp: true }), true, 'the installed app’s first use right after installing');
  assert.equal(sessionAllows('notifications', NEW_SESSION, { channel: now + 900 * DAY }, now), true, 'a far-future record never blocks');
});

test('verification N1–N3: a short key memory, rests that end on an open page are looked at again, typed-in fields keep focus', () => {
  const client = read('src/services/customerNotifications.ts');
  assert.match(client, /const KNOWN_KEY_MS=60_000;/, 'the key from the assessment is trusted for one minute');
  assert.match(client, /catch\(e\)\{knownKey=null;throw e;\}/, 'a failed configuration read forgets it');
  assert.equal(notificationRestEnds({}, now), null);
  assert.equal(notificationRestEnds({ notifications: now - HOUR }, now), now - HOUR + NOTIFICATION_TIMING.ignoredRestMs);
  assert.equal(notificationRestEnds({ channel: now - 10 * 60_000 }, now), now + 20 * 60_000, 'the half-hour gap');
  assert.equal(notificationRestEnds({ channel: now - 10 * 60_000 }, now, { installedApp: true }), null);
  assert.equal(notificationRestEnds({ notifications: now - 13 * HOUR, install: now - 40 * 60_000 }, now), null, 'nothing running');
  assert.equal(notificationSnoozeEnds({ count: 1, lastAt: now - DAY }, now), now + 2 * DAY);
  assert.equal(notificationSnoozeEnds({ count: 2, lastAt: now - 4 * DAY }, now), null);
  const layer = read('src/components/pwa/InvitationLayer.tsx');
  assert.match(layer, /if \(visit\.shown \|\| visit\.dismissed\) \{ setNotifyAssessed\(key\); return; \}/, 'only this visit\'s answer ends it for the page');
  assert.match(layer, /if \(restEnds > at\) lookAgain\.current = window\.setTimeout\(\(\) => \{ lookAgain\.current = null; assessment\.current = null; setReassess\(n => n \+ 1\); \}/, 'a rest that ends while the page is open is looked at again');
  assert.match(layer, /if \(active && active !== document\.body && !cardRef\.current\?\.contains\(active\)\) return;/, 'focus taken elsewhere is left alone');
});
