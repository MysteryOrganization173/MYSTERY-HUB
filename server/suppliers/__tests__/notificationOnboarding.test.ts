/** 3.4-C notification onboarding: one invitation, the browser's permission, server registration with consent, one result. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {notificationInviteOpportunity, activateNotificationInvite, inviteConsent, NOTIFICATION_COPY_VERSION} from '../../../src/pwa/notificationOnboarding';
import {notificationCopy, NOTIFICATION_ACTIONS, NOTIFICATION_RESULT} from '../../../src/pwa/invitationCopy';
import {markMarketingPromptAnswered, recordDismissal, NO_SNOOZE, STORAGE_KEYS} from '../../../src/pwa/launchPolicy';
import {pushEndpointHash} from '../../../src/services/customerNotifications';

const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/synthetic-device-1';
type Setup = { permission?: NotificationPermission; answer?: NotificationPermission; enabled?: boolean; guests?: boolean; paused?: boolean; optedOut?: boolean; promotional?: boolean; refuse?: boolean; confirm?: boolean; preRegistered?: boolean };

function setup(o: Setup = {}) {
  let permission: NotificationPermission = o.permission ?? 'default', asks = 0;
  let subscription: any = null;
  const registered = new Map<string, unknown>(), guestRegs = new Map<string, string>();
  const calls = { register: [] as unknown[], guestRegister: [] as unknown[] };
  const make = () => ({ endpoint: ENDPOINT, toJSON: () => ({ endpoint: ENDPOINT, expirationTime: null, keys: { p256dh: 'k', auth: 'a' } }), unsubscribe: async () => { subscription = null; return true; } });
  if (o.preRegistered) { subscription = make(); registered.set(ENDPOINT, null); }
  const pushManager = { async getSubscription() { return subscription; }, async subscribe() { subscription = make(); return subscription; } };
  const env: any = {
    navigator: { serviceWorker: { getRegistration: async () => ({ pushManager }), register: async () => ({ pushManager }) } }, PushManager: class {},
    isSecureContext: true, location: { pathname: '/' },
    Notification: { get permission() { return permission; }, requestPermission: async () => { asks++; permission = o.answer ?? 'granted'; return permission; } },
  };
  env.top = env; env.self = env;
  const client: any = {
    available: true,
    async configuration() { return { enabled: o.enabled ?? true, publicKey: KEY, workerPath: '/push-sw.js', guests: o.guests ?? true, paused: o.paused ?? false }; },
    async publicKey() { return KEY; },
    async deviceStatus(_t: string, endpoint: string) { return { subscribed: (o.confirm ?? true) && registered.has(endpoint) }; },
    async register(_t: string, sub: any, consent: unknown) { calls.register.push(consent); if (o.refuse) return { ok: false, message: 'This phone could not be registered.' }; registered.set(sub.endpoint, consent); return { ok: true, value: undefined }; },
    async unregister() { return { ok: true, value: undefined }; },
    async preferences() { return { transactional: true, promotional: o.promotional ?? false, marketingOptedOut: o.optedOut ?? false, version: '' }; },
    async savePreferences() { throw new Error('the invitation never writes preferences directly'); },
  };
  const guest: any = {
    async register(sub: any, consent: unknown) { calls.guestRegister.push(consent); const credential = '11111111-1111-4111-8111-111111111111.' + 'a'.repeat(43); guestRegs.set(credential, sub.endpoint); return { credential }; },
    async status(credential: string) { const endpoint = guestRegs.get(credential); return endpoint ? { subscribed: true, endpointHash: await pushEndpointHash(endpoint) } : { subscribed: false, endpointHash: null }; },
    async unregister(credential: string) { guestRegs.delete(credential); },
  };
  const options = (token: string | null, extra: object = {}) => ({ token, accountId: token ? 'buyer-1' : undefined, isCustomer: token ? true : undefined, signal: new AbortController().signal, snooze: NO_SNOOZE, now: Date.now(), environment: env, ...extra });
  return { env, client, guest, calls, options, asks: () => asks, registered };
}
/** V2: the assessment also says how to present the card (paused, repair) and the permission it saw. */
const fresh = { paused: false, repair: false, permission: 'default' } as const;
const memory = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) }; };

test('the assessment is read-only: it never asks permission, and disabled, blocked or resting contexts offer nothing', async () => {
  const s = setup();
  assert.deepEqual(await notificationInviteOpportunity(s.client, s.guest, s.options('token')), { audience: 'member', offers: true, ...fresh });
  assert.equal(s.asks(), 0, 'no permission request without a tap');
  assert.equal(s.calls.register.length + s.calls.guestRegister.length, 0, 'no registration without a tap');
  assert.equal(await notificationInviteOpportunity(setup({ enabled: false }).client, s.guest, s.options('token')), null, 'sending not configured: nothing offered');
  // V2: the server accepts registrations while the operator has sending paused, so the card is shown and says so.
  assert.deepEqual(await notificationInviteOpportunity(setup({ paused: true }).client, s.guest, s.options('token')), { audience: 'member', offers: true, ...fresh, paused: true }, 'paused: still invited, presented as paused');
  const blocked = setup({ permission: 'denied' });
  assert.equal(await notificationInviteOpportunity(blocked.client, blocked.guest, blocked.options('token')), null, 'a blocked browser is never asked');
  const store = memory(); recordDismissal(STORAGE_KEYS.notificationOptIn, Date.now(), store); recordDismissal(STORAGE_KEYS.notificationOptIn, Date.now(), store);
  assert.equal(await notificationInviteOpportunity(s.client, s.guest, s.options('token', { snooze: { count: 1, lastAt: Date.now() - 60_000 } })), null, '"Not now" rests it three days');
  assert.deepEqual(await notificationInviteOpportunity(s.client, s.guest, s.options('token', { snooze: { count: 2, lastAt: Date.now() - 4 * 86_400_000 } })), { audience: 'member', offers: true, ...fresh }, 'V2: an old two-strike record is not final any more');
  const unsupported = setup(); delete unsupported.env.PushManager;
  assert.equal(await notificationInviteOpportunity(unsupported.client, unsupported.guest, unsupported.options('token')), null, 'no push support (e.g. an iPhone Safari tab): nothing impossible is offered');
});

test('members: offers are part of the one choice unless they declined them before; staff and registered devices get nothing', async () => {
  const optedOut = setup({ optedOut: true });
  assert.deepEqual(await notificationInviteOpportunity(optedOut.client, optedOut.guest, optedOut.options('token')), { audience: 'member', offers: false, ...fresh });
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = { localStorage: memory() };
  try {
    markMarketingPromptAnswered('buyer-1');
    const legacy = setup();
    assert.deepEqual(await notificationInviteOpportunity(legacy.client, legacy.guest, legacy.options('token')), { audience: 'member', offers: false, ...fresh }, 'an answer to the old separate offers question is kept');
  } finally { (globalThis as { window?: unknown }).window = previous; }
  const staff = setup();
  assert.equal(await notificationInviteOpportunity(staff.client, staff.guest, staff.options('token', { isCustomer: false })), null);
  const registered = setup({ permission: 'granted', preRegistered: true });
  assert.equal(await notificationInviteOpportunity(registered.client, registered.guest, registered.options('token')), null, 'a confirmed device is never asked again');
});

test('Allow: one permission request, registration with exactly the purposes the copy named, success only after confirmation', async () => {
  const s = setup();
  const invite = { audience: 'member' as const, offers: true };
  assert.deepEqual(await activateNotificationInvite(s.client, s.guest, invite, s.options('token')), { step: 'registered' });
  assert.equal(s.asks(), 1);
  assert.deepEqual(s.calls.register, [{ purposes: ['transactional', 'marketing'], copyVersion: NOTIFICATION_COPY_VERSION }]);
  const orders = setup();
  await activateNotificationInvite(orders.client, orders.guest, { audience: 'member', offers: false }, orders.options('token'));
  assert.deepEqual(orders.calls.register, [{ purposes: ['transactional'], copyVersion: NOTIFICATION_COPY_VERSION + '-orders' }], 'no offers recorded when the copy did not offer them');
  const refused = setup({ refuse: true });
  assert.equal((await activateNotificationInvite(refused.client, refused.guest, invite, refused.options('token'))).step, 'error', 'a refused registration is never shown as on');
  const unconfirmed = setup({ confirm: false });
  assert.equal((await activateNotificationInvite(unconfirmed.client, unconfirmed.guest, invite, unconfirmed.options('token'))).step, 'error', 'permission alone is not a registered device');
});

test('the browser answer decides: blocked stays blocked, a closed prompt changes nothing, and closing the card stops the flow', async () => {
  const denied = setup({ answer: 'denied' });
  assert.equal((await activateNotificationInvite(denied.client, denied.guest, { audience: 'member', offers: true }, denied.options('token'))).step, 'denied');
  assert.equal(denied.calls.register.length, 0);
  const closed = setup({ answer: 'default' });
  assert.equal((await activateNotificationInvite(closed.client, closed.guest, { audience: 'member', offers: true }, closed.options('token'))).step, 'dismissed');
  assert.equal(closed.calls.register.length, 0);
  const aborted = setup(); const controller = new AbortController(); controller.abort();
  await assert.rejects(() => activateNotificationInvite(aborted.client, aborted.guest, { audience: 'member', offers: true }, { ...aborted.options('token'), signal: controller.signal }));
  assert.equal(aborted.asks(), 0, 'no permission prompt after the card closed');
});

test('guests: news and occasional offers only, recorded as marketing consent; order updates are never offered to guests', async () => {
  const s = setup();
  const invite = await notificationInviteOpportunity(s.client, s.guest, s.options(null));
  assert.deepEqual(invite, { audience: 'guest', offers: true, ...fresh });
  assert.deepEqual(await activateNotificationInvite(s.client, s.guest, invite!, s.options(null)), { step: 'registered' });
  assert.deepEqual(s.calls.guestRegister, [{ purposes: ['marketing'], copyVersion: NOTIFICATION_COPY_VERSION + '-guest' }]);
  assert.equal(s.calls.register.length, 0, 'no account registration for a guest');
  assert.doesNotMatch(notificationCopy({ audience: 'guest', offers: true }).text, /order/i);
  const accountBrowser = setup({ permission: 'granted', preRegistered: true });
  assert.equal(await notificationInviteOpportunity(accountBrowser.client, accountBrowser.guest, accountBrowser.options(null)), null, 'a browser already holding a subscription (an account’s) is never offered guest news');
  const off = setup({ guests: false });
  assert.equal(await notificationInviteOpportunity(off.client, off.guest, off.options(null)), null, 'guest news switched off on the server: nothing offered');
  assert.deepEqual(inviteConsent({ audience: 'guest', offers: false }).purposes, ['marketing'], 'a guest choice can only ever be news and offers');
});

test('approved copy: one heading, one sentence, Allow Notifications / Not now, and one honest result', () => {
  assert.deepEqual(notificationCopy({ audience: 'member', offers: true }), { title: 'Stay updated.', text: 'Get order updates, service news and occasional offers.' });
  assert.doesNotMatch(notificationCopy({ audience: 'member', offers: false }).text, /offer|news/i, 'a past "no" to offers is respected in the words too');
  assert.equal(NOTIFICATION_ACTIONS.allow, 'Allow Notifications');
  assert.equal(NOTIFICATION_ACTIONS.later, 'Not now');
  assert.match(NOTIFICATION_ACTIONS.note, /turn them off anytime/);
  assert.equal(NOTIFICATION_RESULT.registered.text, 'Notifications are on for this device.');
  for (const text of [...Object.values(NOTIFICATION_RESULT).map(r => r.title + r.text), ...Object.values(NOTIFICATION_ACTIONS)])
    assert.doesNotMatch(text, /VAPID|service worker|endpoint|subscription|transactional|delivered|guarantee/i, 'no jargon and no delivery promise');
});

test('one invitation surface: the coordinated layer hosts it; the old second "offers?" card and installed-only card are gone', () => {
  const layer = readFileSync('src/components/pwa/InvitationLayer.tsx', 'utf8');
  assert.match(layer, /function NotificationInvitation\(/);
  assert.match(layer, /activateNotificationInvite\(httpCustomerNotificationsClient, httpGuestNotificationsClient, invite/);
  assert.match(layer, /if \(result\.step === 'dismissed'\) \{ recordDismissal\(STORAGE_KEYS\.notificationOptIn\)/);
  assert.doesNotMatch(layer, /Want offers|Yes, send me offers|acceptNotificationOffers/);
  const launch = readFileSync('src/components/pwa/AppLaunchLayer.tsx', 'utf8');
  assert.doesNotMatch(launch, /NotificationOptIn|InstalledNotificationOnboarding/);
  for (const guard of ['isCheckoutOpen', 'isAuthModalOpen', 'activeEditorSite', 'isAccountOpen', 'mustChangePassword']) assert.ok(readFileSync('src/components/pwa/invitationBusy.ts', 'utf8').includes(guard), guard);
  assert.match(layer, /useEffect\(\(\) => \{ if \(shown\?\.kind === 'notifications'\) close\('ignored'\); \}, \[accountKey\]\)/, 'another account never inherits the card');
});
