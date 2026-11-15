/** Mystery Hub 3.4-B: invitation coordination, install and Channel invitations, Channel URL and footers. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  calmPage, engaged, sessionAllows, channelInviteAllowed, installRemembered, invitationOrder, NEW_SESSION, NO_CHANNEL_STATE, DAY,
  INVITATION_GAP_MS, ENGAGED_ACTIVE_MS, readSession, readChannelInvite, readTime, recordChannelLater, recordChannelFollowing,
  recordChannelOpened, claimInvitation, claimWelcome, releaseInvitation, invitationOnScreen, registerInlineOffer, inlineOfferVisible,
  noteDismissal, noteView, notePurchase, resetInvitationsForTest, INVITATION_KEYS, readSeen, noteInvitationAnswered,
} from '../../../src/pwa/invitations.js';
import { installPromoMode, NO_SNOOZE } from '../../../src/pwa/launchPolicy.js';
import { CHANNEL_COPY, installCopy, installProgressCopy, verifiedPurchase } from '../../../src/pwa/invitationCopy.js';
import { BUSINESS_CONFIG } from '../../../src/config/business.js';

const read = (file: string) => readFileSync(file, 'utf8');
const now = Date.UTC(2026, 10, 15, 12);
const memory = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) }; };
const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
const withBrowser = (fn: () => void) => {
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = { localStorage: memory(), sessionStorage: memory() };
  resetInvitationsForTest();
  try { fn(); } finally { resetInvitationsForTest(); (globalThis as { window?: unknown }).window = previous; }
};

test('invitations appear only on calm browsing pages, never on orders, payments, Admin, the editor or a payment return', () => {
  for (const page of ['home', 'data', 'services', 'marketplace', 'creative', 'about', 'help', 'earn', 'website']) assert.equal(calmPage(page, ''), true, page);
  for (const page of ['orders', 'wallet', 'afa', 'checkers', 'app', 'admin', 'editor', 'business']) assert.equal(calmPage(page, ''), false, page);
  assert.equal(calmPage('home', '?reference=MH-1'), false, 'Paystack return');
  assert.equal(calmPage('data', '?utm_source=whatsapp&trxref=abc'), false, 'Paystack return (trxref)');
  assert.equal(calmPage('home', '?utm_source=whatsapp'), true);
});

test('engagement means a second page, about half a minute of active use, or a verified purchase', () => {
  assert.equal(engaged(NEW_SESSION), false);
  assert.equal(engaged({ ...NEW_SESSION, views: 1, activeMs: ENGAGED_ACTIVE_MS - 1 }), false, 'a single quick look is not engagement');
  assert.equal(engaged({ ...NEW_SESSION, views: 2 }), true);
  assert.equal(engaged({ ...NEW_SESSION, activeMs: ENGAGED_ACTIVE_MS }), true);
  assert.equal(engaged({ ...NEW_SESSION, purchase: true }), true);
  const order = (extra: object) => ({ journey: 'direct_checkout', status: 'delivered', createdAt: new Date(now - 5 * 60_000).toISOString(), ...extra }) as never;
  assert.equal(verifiedPurchase(order({}), now), true);
  assert.equal(verifiedPurchase(order({ status: 'processing' }), now), true, 'paid and verified, delivery in progress');
  assert.equal(verifiedPurchase(order({ status: 'verifying' }), now), false, 'payment not yet verified');
  assert.equal(verifiedPurchase(order({ status: 'failed' }), now), false);
  assert.equal(verifiedPurchase(order({ journey: undefined }), now), false, 'a reference lookup (order recovery) is not a purchase here');
  assert.equal(verifiedPurchase(order({ createdAt: new Date(now - 2 * 60 * 60_000).toISOString() }), now), false, 'tracking an older order is not a fresh purchase');
  assert.equal(verifiedPurchase(order({ createdAt: 'soon' }), now), false);
  assert.equal(verifiedPurchase(null, now), false);
});

test('one unsolicited invitation per visit, none after a dismissal, none within 12 hours, and each kind rests after being seen', () => {
  const s = { ...NEW_SESSION, views: 3 };
  assert.equal(sessionAllows('install', s, {}, now), true);
  assert.equal(sessionAllows('channel', { ...s, shown: 'install' }, {}, now), false, 'one per visit');
  assert.equal(sessionAllows('channel', { ...s, dismissed: true }, {}, now), false, 'nothing right after a dismissal');
  assert.equal(sessionAllows('channel', { ...s, welcome: true }, {}, now), false, 'the welcome sheet is not followed by marketing');
  assert.equal(sessionAllows('notifications', { ...s, welcome: true }, {}, now), true, 'first-use notifications may follow the welcome');
  assert.equal(sessionAllows('channel', s, { install: now - INVITATION_GAP_MS + 60_000 }, now), false, 'another tab showed one recently');
  assert.equal(sessionAllows('channel', s, { install: now - INVITATION_GAP_MS - 1 }, now), true);
  assert.equal(sessionAllows('install', s, { install: now - 6 * DAY }, now), false, 'install rests a week after being ignored');
  assert.equal(sessionAllows('install', s, { install: now - 7 * DAY }, now), true);
  assert.equal(sessionAllows('channel', s, { channel: now - 13 * DAY }, now), false, 'the Channel rests two weeks after being ignored');
  assert.equal(sessionAllows('channel', s, { channel: now + 400 * DAY }, now), true, 'a timestamp far in the future (changed clock) never locks');
  // Installed-app first use: notifications have their own snooze; marketing gaps and rests never block them.
  assert.equal(sessionAllows('notifications', s, { install: now - 60_000, channel: now - 60_000, notifications: now - DAY }, now), true);
  assert.equal(sessionAllows('notifications', { ...s, shown: 'notifications' }, {}, now), true, 'an unanswered notification card may return within its visit');
  assert.equal(sessionAllows('notifications', { ...s, shown: 'channel' }, {}, now), false, 'but never after another invitation in the same visit');
  assert.equal(sessionAllows('notifications', { ...s, dismissed: true }, {}, now), false);
  assert.equal(sessionAllows('install', s, { notifications: now - 60_000 }, now), true, 'a notification card does not start the marketing gap');
});

test('Channel: "Maybe later" rests 30 then 60 days and stops at the third; "Already following" stops it; a click is not a follow', () => {
  assert.equal(channelInviteAllowed(NO_CHANNEL_STATE, now), true);
  assert.equal(channelInviteAllowed({ ...NO_CHANNEL_STATE, later: 1, laterAt: now - 29 * DAY }, now), false);
  assert.equal(channelInviteAllowed({ ...NO_CHANNEL_STATE, later: 1, laterAt: now - 30 * DAY }, now), true);
  assert.equal(channelInviteAllowed({ ...NO_CHANNEL_STATE, later: 2, laterAt: now - 59 * DAY }, now), false, 'repeated dismissals rest longer');
  assert.equal(channelInviteAllowed({ ...NO_CHANNEL_STATE, later: 2, laterAt: now - 60 * DAY }, now), true);
  assert.equal(channelInviteAllowed({ ...NO_CHANNEL_STATE, later: 3, laterAt: now - 900 * DAY }, now), false, 'third "Maybe later" is final');
  assert.equal(channelInviteAllowed({ ...NO_CHANNEL_STATE, following: true }, now), false);
  assert.equal(channelInviteAllowed({ ...NO_CHANNEL_STATE, openedAt: now - 89 * DAY }, now), false);
  assert.equal(channelInviteAllowed({ ...NO_CHANNEL_STATE, openedAt: now - 90 * DAY }, now), true, 'opening is not a follow: it may ask again later');
  const store = memory();
  recordChannelOpened(now, store);
  assert.equal(readChannelInvite(store).following, false, 'opening WhatsApp never records a follow');
  recordChannelLater(now, store); recordChannelLater(now + 1, store);
  assert.deepEqual({ ...readChannelInvite(store), openedAt: 0 }, { later: 2, laterAt: now + 1, following: false, openedAt: 0 });
  recordChannelFollowing(store);
  assert.equal(readChannelInvite(store).following, true);
});

test('install: accepted but unconfirmed is pending (3 days), confirmed is remembered (90 days), and both hide automatic suggestions', () => {
  assert.equal(installRemembered({ installedAt: null, pendingAt: null, now }), false);
  assert.equal(installRemembered({ installedAt: null, pendingAt: now - 2 * DAY, now }), true);
  assert.equal(installRemembered({ installedAt: null, pendingAt: now - 3 * DAY, now }), false, 'an install that never completed is offered again');
  assert.equal(installRemembered({ installedAt: now - 89 * DAY, pendingAt: null, now }), true);
  assert.equal(installRemembered({ installedAt: now - 90 * DAY, pendingAt: null, now }), false);
  assert.equal(installRemembered({ installedAt: null, pendingAt: null, stepsAt: now - 29 * DAY, now }), true, 'iPhone steps read: rests without a strike');
  assert.equal(installRemembered({ installedAt: null, pendingAt: null, stepsAt: now - 30 * DAY, now }), false);
  const base = { installed: false, hasPrompt: true, appleHomeScreen: false, snooze: NO_SNOOZE, now };
  assert.equal(installPromoMode(base), 'install');
  assert.equal(installPromoMode({ ...base, remembered: true }), 'hidden');
  assert.deepEqual(invitationOrder({ install: true, channel: true }), ['install', 'channel'], 'install has priority when it can genuinely happen');
  assert.deepEqual(invitationOrder({ install: false, channel: true }), ['channel']);
  const store = memory();
  store.setItem('iso', '2026-11-01T10:00:00.000Z'); store.setItem('ms', String(now)); store.setItem('junk', 'soon');
  assert.equal(readTime('iso', store), Date.parse('2026-11-01T10:00:00.000Z'), 'the browser confirmation is stored as ISO');
  assert.equal(readTime('ms', store), now);
  assert.equal(readTime('junk', store), null);
  assert.equal(readTime('missing', broken), null);
});

test('storage failure never breaks the rules: corrupt or blocked storage reads as "nothing remembered"', () => {
  assert.deepEqual(readSession(broken), NEW_SESSION);
  assert.deepEqual(readChannelInvite(broken), NO_CHANNEL_STATE);
  const store = memory();
  store.setItem(INVITATION_KEYS.channel, '{nope');
  assert.deepEqual(readChannelInvite(store), NO_CHANNEL_STATE);
  store.setItem(INVITATION_KEYS.session, JSON.stringify({ views: -4, shown: 'popup', dismissed: 'yes', activeMs: 1.5 }));
  assert.deepEqual(readSession(store), NEW_SESSION, 'invalid fields are ignored');
  store.setItem(INVITATION_KEYS.seen, JSON.stringify({ install: 'x', channel: now, other: now }));
  assert.deepEqual(readSeen(store), { channel: now });
});

test('the coordinator keeps one invitation on screen and remembers the visit across reloads of the tab', () => withBrowser(() => {
  noteView('home');
  assert.equal(engaged(readSession()), false);
  noteView('home'); assert.equal(readSession().views, 1, 'the same page again is not a second view');
  noteView('data'); assert.equal(engaged(readSession()), true);
  assert.equal(claimInvitation(['install', 'channel']), 'install');
  assert.equal(invitationOnScreen(), 'install');
  assert.equal(claimInvitation(['channel']), null, 'never two at once');
  releaseInvitation('install');
  assert.equal(claimInvitation(['channel']), null, 'one per visit');
  assert.equal(readSession().shown, 'install', 'kept in this tab, so a refresh or Back does not show another');
  assert.ok(readSeen().install, 'remembered across tabs for the 12-hour gap');
}));

test('the welcome sheet and any dismissal keep marketing invitations out of the visit; inline cards keep floating ones away', () => withBrowser(() => {
  assert.equal(claimWelcome(), true);
  assert.equal(claimInvitation(['install', 'channel']), null, 'nothing on top of the welcome sheet');
  releaseInvitation('welcome');
  assert.equal(claimInvitation(['channel']), null, 'nor right after it');
  assert.equal(claimInvitation(['notifications']), 'notifications', 'first-use notifications remain possible');
  releaseInvitation('notifications');
  resetInvitationsForTest();
  (globalThis as { window: { sessionStorage: unknown } }).window.sessionStorage = memory();
  (globalThis as { window: { localStorage: unknown } }).window.localStorage = memory();
  noteDismissal();
  assert.equal(claimInvitation(['channel']), null, 'nothing immediately after a dismissal');
  const release = registerInlineOffer('home-card');
  assert.equal(inlineOfferVisible(), true);
  release();
  assert.equal(inlineOfferVisible(), false);
  notePurchase();
  assert.equal(readSession().purchase, true);
}));

test('acting on the page card uses the visit; a failed session write never revives a stale record', () => withBrowser(() => {
  noteView('home'); noteView('data');
  noteInvitationAnswered('install');
  assert.equal(claimInvitation(['channel']), null, 'Install App on the Home card: no Channel card follows it in this visit');
  resetInvitationsForTest();
  const stale = memory();
  stale.setItem(INVITATION_KEYS.session, JSON.stringify({ ...NEW_SESSION, views: 5 }));
  let writable = true;
  (globalThis as { window: { sessionStorage: unknown } }).window.sessionStorage = { getItem: (k: string) => stale.getItem(k), setItem: (k: string, v: string) => { if (!writable) throw new Error('quota'); stale.setItem(k, v); } };
  writable = false;
  assert.equal(claimInvitation(['channel']), 'channel');
  releaseInvitation('channel');
  assert.equal(readSession().shown, 'channel', 'memory wins once storage stops accepting writes');
  assert.equal(claimInvitation(['install']), null, 'still one per visit');
}));

test('the welcome slot is released only after the sheet has been open, and installed notifications use the coordinator', () => {
  const layer = read('src/components/pwa/AppLaunchLayer.tsx');
  assert.match(layer, /if \(welcomeOpen\) \{ welcomeWasOpen\.current = true; return; \}/);
  assert.match(layer, /&& claimWelcome\(\)\)/);
  assert.match(layer, /const busy = appBusy\(app\);/);
  const optIn = read('src/components/pwa/NotificationOptIn.tsx');
  assert.match(optIn, /claimInvitation\(\['notifications'\]\)/);
  assert.match(optIn, /recordDismissal\(STORAGE_KEYS\.notificationOptIn\);noteDismissal\(\);onDone\(\);/);
  const inline = read('src/components/pwa/InstallAppPromo.tsx');
  assert.match(inline, /noteInvitationAnswered\('install'\); void install\(\);/);
  assert.match(read('src/pwa/useAppInstall.ts'), /const remembered = installRemembered\(\{/, 'install marks are re-read on every render');
});

test('approved copy: one heading, one sentence, clear actions; installing is never shown as installed', () => {
  assert.deepEqual(installCopy(true), { title: 'Mystery Hub, one tap away.', text: 'Buy data, track orders and more, right from your home screen.' });
  assert.equal(installCopy(false).title, 'Mystery Hub, one click away.', 'computers have no home screen');
  assert.match(installProgressCopy('installing', true).title, /^Installing Mystery Hub…$/);
  assert.doesNotMatch(installProgressCopy('installing', true).text, /installed/i);
  assert.equal(installProgressCopy('installed', true).title, 'Mystery Hub is installed');
  assert.deepEqual(CHANNEL_COPY, {
    title: 'Stay in the Mystery.', text: 'Follow our official channel for bundle updates, Friday Drops and special offers.',
    follow: 'Follow Channel', later: 'Maybe later', following: 'Already following',
  });
  const layer = read('src/components/pwa/InvitationLayer.tsx');
  assert.match(layer, /CHANNEL_COPY\.title\}<\/>|CHANNEL_COPY\.title\} <span aria-hidden="true">💚<\/span>/, 'the heart is decoration, not part of the heading name');
  assert.doesNotMatch(layer, /[Tt]hanks for following|You('|’)re following|Followed/, 'a click is never presented as a follow');
  assert.match(layer, /href=\{BUSINESS_CONFIG\.contact\.whatsappChannelUrl\} target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(layer, /focus\(\)|autoFocus|data-autofocus|useOverlayLock|aria-modal="true"/, 'never takes focus or blocks the page');
  assert.doesNotMatch(read('src/components/pwa/InstallAppPromo.tsx') + layer, /Google Play|App Store download|play\.google|apps\.apple/, 'no fake store buttons');
});

test('the layer lives only in the customer shell; Greetings, published sites, Admin, the editor and My Business never mount it', () => {
  const app = read('src/App.tsx');
  assert.equal((app.match(/<InvitationLayer \/>/g) || []).length, 1);
  const main = app.slice(app.indexOf('return (\n    <div className="mh-app'));
  assert.ok(main.includes('<InvitationLayer />'), 'in the main customer shell');
  for (const shell of ["activePage === 'editor'", "activePage === 'admin'", "activePage === 'business'"]) {
    const start = app.indexOf(shell), end = app.indexOf('\n  }\n', start);
    assert.ok(!app.slice(start, end).includes('InvitationLayer'), shell);
  }
  // Greetings and published sites are separate entry surfaces in main.tsx that never load App.
  const entry = read('src/main.tsx');
  assert.match(entry, /greetingPath \? Promise\.all\(\[import\('\.\/greetings\/RecipientPage'\)/);
  assert.match(entry, /siteSlug\s*\? import\('\.\/components\/website\/PublicPublishedSite'\)/);
  const layer = read('src/components/pwa/InvitationLayer.tsx'), busy = read('src/components/pwa/invitationBusy.ts');
  assert.match(layer, /const busy = overlays > 0 \|\| isAuthChecking \|\| appBusy\(app\);/);
  for (const guard of ['isCheckoutOpen', 'isStatusModalOpen', 'isAuthModalOpen', 'activeEditorSite', 'isAccountOpen', 'mustChangePassword', 'isMysteryAiOpen', 'selectedTemplatePreview', 'marketplaceInquiryProduct', 'waitlistInfo.isOpen'])
    assert.ok(busy.includes(guard), guard);
  assert.match(read('src/utils/overlayStack.ts'), /export function subscribeOverlays/);
});

test('the new official WhatsApp Channel replaces the old one in every first-party file; support chat is never the Channel', () => {
  assert.equal(BUSINESS_CONFIG.contact.whatsappChannelUrl, 'https://whatsapp.com/channel/0029Vb97gokADTOKgN8Nzr0s');
  assert.notEqual(BUSINESS_CONFIG.contact.supportWhatsAppUrl, BUSINESS_CONFIG.contact.whatsappChannelUrl);
  const files: string[] = [];
  const walk = (dir: string) => { for (const name of readdirSync(dir)) { const full = path.join(dir, name); if (statSync(full).isDirectory()) { if (name !== 'node_modules' && name !== '__tests__') walk(full); } else if (/\.(tsx?|css|html|json|js|py|cjs)$/.test(name)) files.push(full); } };
  for (const dir of ['src', 'server', 'shared', 'public', 'scripts']) walk(dir);
  files.push('index.html', 'server.ts');
  for (const file of files) assert.ok(!read(file).includes('0029VbBt1MGC6ZvlDJ8Biz3l'), `old Channel in ${file}`);
  const market = read('src/components/marketplace/MarketplacePage.tsx');
  assert.doesNotMatch(market, /Ask about available products and sourcing on WhatsApp/, 'a one-way Channel cannot answer questions');
});

test('footers: private support and community are separate groups, each contact is labelled, and "Get the app" stays voluntary', () => {
  const footer = read('src/components/common/Footer.tsx');
  const support = footer.slice(footer.indexOf('aria-labelledby="footer-support"'), footer.indexOf('aria-labelledby="footer-community"'));
  const community = footer.slice(footer.indexOf('aria-labelledby="footer-community"'), footer.indexOf('<nav aria-label="Footer"'));
  for (const link of ['contact.supportWhatsAppUrl', 'contact.smsLink', 'contact.phoneLink', 'contact.emailLink']) { assert.ok(support.includes(link), link); assert.ok(!community.includes(link), link); }
  for (const link of ['contact.whatsappChannelUrl', 'contact.telegramChannelUrl']) { assert.ok(community.includes(link), link); assert.ok(!support.includes(link), link); }
  for (const label of ['<strong>WhatsApp support</strong>', '<strong>SMS</strong>', '<strong>Call</strong>', '<strong>Email</strong>']) assert.ok(support.includes(label), label);
  assert.match(footer, /installed \? \[\] : \[\{ label: 'Get the app', page: 'app'/);
  const shell = read('src/seasonal/christmas/shell/ChristmasShell.tsx');
  const help = shell.slice(shell.indexOf('className="xs-footer-help"'), shell.indexOf('<nav aria-label="Footer"'));
  const follow = shell.slice(shell.indexOf('className="xs-footer-community"'), shell.indexOf('className="xs-footer-help"'));
  for (const link of ['contact.supportWhatsAppUrl', 'contact.smsLink', 'contact.phoneLink', 'contact.emailLink']) assert.ok(help.includes(link) && !follow.includes(link), link);
  for (const link of ['contact.whatsappChannelUrl', 'contact.telegramChannelUrl']) assert.ok(follow.includes(link) && !help.includes(link), link);
  assert.match(shell, /installed \? \[\] : \[\{ label: 'Get the app', page: 'app'/);
  // Neither footer can reach a customer-published website: those render outside the app shell.
  assert.match(read('src/main.tsx'), /siteSlug/);
});
