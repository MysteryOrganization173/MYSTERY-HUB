/** P0-C installable app: install card, installed-app launch, notification permission and start-up code size. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {installPromoMode, showNotificationOptIn, showWelcomeSheet, readSnooze, recordDismissal, NO_SNOOZE, INSTALL_PROMO_MAX_DISMISSALS} from '../../../src/pwa/launchPolicy.js';
import {isInstalledApp, supportsAppleHomeScreen, supportsInstallPrompt} from '../../../src/pwa/appEnvironment.js';
import {notificationPermissionState, requestNotificationPermission, PUSH_DELIVERY_ENABLED} from '../../../src/pwa/notifications.js';
import {captureInstallPrompt, hasInstallPrompt, promptInstall, subscribeInstallPrompt, isPlatformPage, INSTALLED_AT_KEY} from '../../../src/pwa/installPrompt.js';
import {retryOnce, canWarm} from '../../../src/utils/lazyPage.js';
import {RouteLoadError} from '../../../src/components/common/RouteFallback.js';

const source = (file: string) => readFileSync(file, 'utf8');
const DAY = 86_400_000, now = Date.UTC(2026, 9, 24);
const media = (modes: string[]) => (query: string) => ({matches: modes.some(mode => query === `(display-mode: ${mode})`)});
const memory = () => { const map = new Map<string, string>(); return {getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v)}; };

test('install card appears only where installing can work, and rests after "Not now"', () => {
  const base = {installed: false, hasPrompt: false, appleHomeScreen: false, snooze: NO_SNOOZE, now};
  assert.equal(installPromoMode({...base, hasPrompt: true}), 'install', 'Chromium with a captured prompt');
  assert.equal(installPromoMode({...base, appleHomeScreen: true}), 'apple', 'iPhone/iPad gets Add to Home Screen steps');
  assert.equal(installPromoMode(base), 'hidden', 'no prompt and no known manual path: no card, no guessed instructions');
  assert.equal(installPromoMode({...base, hasPrompt: true, installed: true}), 'hidden', 'never inside the installed app');
  assert.equal(installPromoMode({...base, hasPrompt: true, snooze: {count: 1, lastAt: now - 29 * DAY}}), 'hidden', '30-day rest');
  assert.equal(installPromoMode({...base, hasPrompt: true, snooze: {count: 1, lastAt: now - 31 * DAY}}), 'install');
  assert.equal(installPromoMode({...base, hasPrompt: true, snooze: {count: INSTALL_PROMO_MAX_DISMISSALS, lastAt: now - 400 * DAY}}), 'hidden', 'third "Not now" is final');
});

test('dismissals are remembered per device and survive corrupt storage', () => {
  const store = memory();
  assert.deepEqual(readSnooze('k', store), NO_SNOOZE);
  recordDismissal('k', now, store); recordDismissal('k', now + 1, store);
  assert.deepEqual(readSnooze('k', store), {count: 2, lastAt: now + 1});
  store.setItem('k', '{not json');
  assert.deepEqual(readSnooze('k', store), NO_SNOOZE);
  assert.deepEqual(readSnooze('k', null), NO_SNOOZE, 'private mode / blocked storage');
});

test('installed-app welcome: signed-out launches of the start page only, never over a deep link', () => {
  const base = {installed: true, signedIn: false, authChecking: false, path: '/', shownThisLaunch: false, guestChosenAt: null, now};
  assert.equal(showWelcomeSheet(base), true);
  assert.equal(showWelcomeSheet({...base, installed: false}), false, 'browser tabs keep today\'s experience');
  assert.equal(showWelcomeSheet({...base, signedIn: true}), false, 'a restored session goes straight in');
  assert.equal(showWelcomeSheet({...base, authChecking: true}), false, 'no flash while the session is being restored');
  for (const deep of ['/orders', '/data', '/marketplace', '/website-builder']) assert.equal(showWelcomeSheet({...base, path: deep}), false, deep);
  assert.equal(showWelcomeSheet({...base, shownThisLaunch: true}), false, 'once per launch');
  assert.equal(showWelcomeSheet({...base, guestChosenAt: now - 2 * DAY}), false, 'guest choice respected for a week');
  assert.equal(showWelcomeSheet({...base, guestChosenAt: now - 8 * DAY}), true);
});

test('notification card: installed app, signed in, permission not yet asked, and not after "Not now" twice', () => {
  const base = {installed: true, signedIn: true, permission: 'default', snooze: NO_SNOOZE, now};
  assert.equal(showNotificationOptIn(base), true);
  for (const permission of ['granted', 'denied', 'unsupported', 'unavailable']) assert.equal(showNotificationOptIn({...base, permission}), false, permission);
  assert.equal(showNotificationOptIn({...base, signedIn: false}), false);
  assert.equal(showNotificationOptIn({...base, installed: false}), false, 'browser tabs are never asked');
  assert.equal(showNotificationOptIn({...base, snooze: {count: 1, lastAt: now - 3 * DAY}}), false);
  assert.equal(showNotificationOptIn({...base, snooze: {count: 1, lastAt: now - 22 * DAY}}), true);
  assert.equal(showNotificationOptIn({...base, snooze: {count: 2, lastAt: now - 300 * DAY}}), false);
});

test('installed detection and install paths come from feature detection', () => {
  assert.equal(isInstalledApp({matchMedia: media(['standalone'])}, {maxTouchPoints: 5}), true);
  assert.equal(isInstalledApp({matchMedia: media([])}, {maxTouchPoints: 5, standalone: true}), true, 'iOS home screen app');
  assert.equal(isInstalledApp({matchMedia: media(['browser'])}, {maxTouchPoints: 0}), false);
  assert.equal(supportsInstallPrompt({onbeforeinstallprompt: null}), true);
  assert.equal(supportsAppleHomeScreen({matchMedia: media([])}, {maxTouchPoints: 5, standalone: false}), true, 'iPhone or iPad');
  assert.equal(supportsAppleHomeScreen({matchMedia: media([])}, {maxTouchPoints: 0, standalone: false}), false, 'desktop Safari');
  assert.equal(supportsAppleHomeScreen({onbeforeinstallprompt: null}, {maxTouchPoints: 5, standalone: false}), false, 'Chromium uses its own dialog');
  assert.equal(supportsAppleHomeScreen({matchMedia: media([])}, {maxTouchPoints: 5}), false, 'Firefox Android: no guessed steps');
});

test('notification permission: every state, callback-style Safari, and no request where browsers refuse', async () => {
  assert.equal(notificationPermissionState({}), 'unsupported');
  const page = (permission: NotificationPermission, extra: object = {}) => { const win: any = {isSecureContext: true, ...extra}; win.top = win; win.self = win;
    win.Notification = {permission, calls: 0, requestPermission(cb?: (p: NotificationPermission) => void) { this.calls++; this.permission = 'granted'; cb?.('granted'); return undefined; }}; return win; };
  assert.equal(notificationPermissionState(page('default')), 'default');
  assert.equal(notificationPermissionState(page('granted')), 'granted');
  assert.equal(notificationPermissionState(page('denied')), 'denied');
  assert.equal(notificationPermissionState(page('default', {isSecureContext: false})), 'unavailable');
  const framed = page('default'); framed.top = {}; assert.equal(notificationPermissionState(framed), 'unavailable');
  assert.equal(await requestNotificationPermission(framed), 'unavailable'); assert.equal(framed.Notification.calls, 0);
  const safari = page('default'); assert.equal(await requestNotificationPermission(safari), 'granted', 'callback form resolves');
  const modern: any = page('default'); modern.Notification.requestPermission = function () { this.permission = 'denied'; return Promise.resolve('denied'); };
  assert.equal(await requestNotificationPermission(modern), 'denied');
  assert.equal(PUSH_DELIVERY_ENABLED, false);
});

test('install prompt is captured early, shown only from the button, and never on business websites', async () => {
  assert.equal(isPlatformPage({pathname: '/sites/quickbyte-data', search: ''}), false);
  assert.equal(isPlatformPage({pathname: '/', search: '?isolated_template_preview=x'}), false);
  assert.equal(isPlatformPage({pathname: '/data', search: ''}), true);
  const site: any = new EventTarget(); site.location = {pathname: '/sites/a', search: ''};
  captureInstallPrompt(site); const blocked = new Event('beforeinstallprompt', {cancelable: true}); site.dispatchEvent(blocked);
  assert.equal(blocked.defaultPrevented, false); assert.equal(hasInstallPrompt(), false);

  const win: any = new EventTarget(); win.location = {pathname: '/', search: ''}; win.localStorage = memory();
  captureInstallPrompt(win);
  let changes = 0; const stop = subscribeInstallPrompt(() => changes++);
  const event: any = new Event('beforeinstallprompt', {cancelable: true}); let prompted = 0;
  event.prompt = async () => { prompted++; }; event.userChoice = Promise.resolve({outcome: 'dismissed'});
  win.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true, 'browser mini-infobar held back for the in-page card');
  assert.equal(hasInstallPrompt(), true); assert.equal(prompted, 0, 'never prompted automatically');
  assert.equal(await promptInstall(), 'dismissed'); assert.equal(prompted, 1);
  assert.equal(hasInstallPrompt(), false, 'a prompt is used once');
  assert.equal(await promptInstall(), 'unavailable');
  win.dispatchEvent(new Event('appinstalled')); assert.ok(win.localStorage.getItem(INSTALLED_AT_KEY));
  assert.ok(changes >= 2); stop();
});

test('lazy pages: one retry on a dropped download, Data Saver respected, and an honest error state', async () => {
  let calls = 0; const flaky = retryOnce(async () => { if (++calls === 1) throw new Error('network'); return 'ok'; }, 1);
  assert.equal(await flaky(), 'ok'); assert.equal(calls, 2);
  const broken = retryOnce(async () => { throw new Error('gone'); }, 1); await assert.rejects(broken());
  assert.equal(canWarm({connection: {saveData: true}} as any), false);
  assert.equal(canWarm({connection: {effectiveType: 'slow-2g'}} as any), false);
  assert.equal(canWarm({connection: {effectiveType: '2g'}} as any), false);
  assert.equal(canWarm({connection: {effectiveType: '4g'}} as any), true);
  assert.equal(canWarm({} as any), true);
  const html = renderToStaticMarkup(React.createElement(RouteLoadError));
  assert.match(html, /Try again/); assert.match(html, /role="alert"/);
});

test('app shell: Home ships with the app, other pages and heavy overlays load on demand', () => {
  const app = source('src/App.tsx');
  assert.match(app, /import \{ HomePage \} from '\.\/components\/home\/HomePage'/);
  for (const page of ['DataPage', 'WebsiteBuilderPage', 'MarketplacePage', 'OrdersPage', 'MysteryEarnPage', 'WalletPage', 'AdminPage', 'TemplatePreviewModal', 'MysteryAiAssistant'])
    assert.match(app, new RegExp(`const ${page} = lazyPage\\(\\(\\) => import\\(`), page);
  // Payment and sign-in code stay exactly as they were: loaded with the app, never deferred.
  assert.match(app, /import \{ CheckoutModal \} from '\.\/components\/checkout\/CheckoutModal'/);
  assert.match(app, /import \{ AuthModal \} from '\.\/components\/auth\/AuthModal'/);
  assert.doesNotMatch(source('src/components/website/TemplateCardPreview.tsx'), /^import \{ renderTemplateLayout \}/m);
  assert.match(source('src/main.tsx'), /captureInstallPrompt\(\);[\s\S]*const surface/);
});

test('push is isolated to explicit consent, with no offline cache or automatic permission prompt', () => {
  const files: string[] = [];
  const walk = (dir: string) => { for (const name of readdirSync(dir)) { const p = path.join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(name)) files.push(p); } };
  walk('src');
  for (const file of files) {
    const code = source(file);
    assert.doesNotMatch(code, /serviceWorker\.register|pushManager\.subscribe|caches\.open/i, file);
    if (/requestPermission\(/.test(code)) assert.equal(file, path.join('src', 'pwa', 'notifications.ts'), 'permission is requested in one place only');
    if (/\.subscribe\(\{\s*userVisibleOnly/.test(code)) assert.equal(file, path.join('src', 'pwa', 'push.ts'), 'device subscription lives in one place only');
  }
  // P0 Notification Center: push.ts may subscribe, but only from a tap, through an existing registration, and never
  // while the push contract is unavailable (the shipped client is a pending one with available:false).
  const push = source('src/pwa/push.ts');
  assert.doesNotMatch(push, /serviceWorker\.register\(/);
  assert.match(push, /if \(!contract \|\| !pushSupported/);
  assert.match(source('src/services/customerNotifications.ts'), /httpCustomerNotificationsClient/);
  assert.match(source('src/components/auth/NotificationSettings.tsx'), /client = httpCustomerNotificationsClient/);
  assert.match(push,/register\('\/push-sw.js',\{scope:'\/',updateViaCache:'none'\}\)/);
  assert.doesNotMatch(source('public/push-sw.js'),/addEventListener\(['"]fetch|caches\.open/);
  const optIn = source('src/components/pwa/NotificationOptIn.tsx');
  assert.match(optIn, /onClick=\{\(\) => \{ void enable\(\); \}\}/, 'requested from the button');
  assert.match(optIn, /Alerts are not switched on yet/); assert.match(optIn, /Nothing is sent yet/);
  assert.doesNotMatch(optIn, /you will (now )?receive|subscribed/i);
});

test('install card copy is honest and the homepage change is one slot', () => {
  const promo = source('src/components/pwa/InstallAppPromo.tsx');
  assert.match(promo, /Mystery Hub, on your phone\./); assert.match(promo, /One tap away from data, orders, Wallet and more\./);
  assert.match(promo, /Install Mystery Hub/); assert.match(promo, /no app store needed/); assert.match(promo, /no Play Store or App Store download/); assert.match(promo, /Free/);
  assert.doesNotMatch(promo, /Get it on Google Play|Download on the App Store|play\.google\.com|apps\.apple\.com/);
  const home = source('src/components/home/HomePage.tsx');
  assert.equal((home.match(/<InstallAppPromo/g) || []).length, 1, 'one placement');
});

test('installed app stays signed in by default; system bars are dark; manifest identity unchanged', () => {
  assert.match(source('src/components/auth/AuthModal.tsx'), /useState\(isInstalledApp\)/);
  const manifest = JSON.parse(source('public/manifest.json'));
  assert.equal(manifest.id, '/'); assert.equal(manifest.start_url, '/'); assert.equal(manifest.scope, '/'); assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.background_color, '#070b0e', 'approved splash background unchanged');
  assert.equal(manifest.theme_color, '#0a0e11');
  assert.match(source('index.html'), /<meta name="theme-color" content="#0a0e11" \/>/);
  const context = source('src/context/AppContext.tsx');
  assert.match(context, /if \(!trigger && document\.visibilityState === 'hidden'\) return;/);
  assert.match(context, /addEventListener\('visibilitychange', visible\)/);
});

test('welcome cannot cover checkout/auth or a navigated route; member install uses one compact slot', () => {
  const layer = source('src/components/pwa/AppLaunchLayer.tsx');
  assert.match(layer, /if \(!installed \|\| welcomeOpen \|\| busy \|\| activePage !== 'home'\) return;/);
  assert.match(layer, /welcomeOpen && !user && !busy && activePage === 'home'/);
  const member = source('src/components/home/MemberHome.tsx');
  assert.equal((member.match(/promotion=\{<InstallAppPromo variant="compact"\/>\}/g) || []).length, 1);
});
