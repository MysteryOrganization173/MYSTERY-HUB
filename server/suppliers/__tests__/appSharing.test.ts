/** App Sharing V1: the /app landing route, its first-response share preview, install guidance and Share Mystery Hub. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AppPhonePreview} from '../../../src/components/app/AppPhonePreview.js';
import {getPageFromPath, ROUTE_PATH_MAP} from '../../../src/utils/routing.js';
import {APP_SHARE_IMAGE, pageIndexingHead, publicPageHead} from '../../../src/utils/socialMetadata.js';
import {injectSocialHead} from '../../../src/utils/socialHtml.js';
import {injectSocialHead as expressInject} from '../../routes/publicHtml.js';
import {resolvePublicSocialMetadata} from '../../services/publicSocialMetadata.js';
import {appLandingState, isInAppBrowser} from '../../../src/pwa/installGuidance.js';
import {APP_SHARE_TEXT, APP_SHARE_URL, copyAppLink, shareApp} from '../../../src/utils/appShare.js';

const source = (file: string) => readFileSync(file, 'utf8');
const readers = {product: async () => { throw new Error('no product read for /app'); }, site: async () => { throw new Error('no site read for /app'); }};
const UA = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-A156E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  whatsappAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-A156E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36',
  facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0]',
  safariIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  firefoxDesktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
};

test('/app is its own route, and existing routes are unchanged', () => {
  assert.equal(ROUTE_PATH_MAP.app, '/app');
  for (const path of ['/app', '/app/', '/APP', '/app/index.html', 'https://mysterybundlehub.com/app?ref=ABC']) assert.equal(getPageFromPath(path), 'app', path);
  assert.equal(getPageFromPath('/apps'), 'home', 'unknown paths keep the intentional Home fallback');
  assert.equal(getPageFromPath('/application'), 'home');
  assert.equal(getPageFromPath('/'), 'home'); assert.equal(getPageFromPath('/data'), 'data'); assert.equal(getPageFromPath('/sites/x'), 'home');
});

test('/app share metadata: canonical, absolute HTTPS 1200x630 JPEG, indexable', () => {
  const head = publicPageHead('app');
  assert.equal(head.title, 'Install Mystery Hub | Everything Digital. One Trusted Place.');
  assert.equal(head.description, 'Buy data, top up airtime, track orders and create your own free business website. Get Mystery Hub on your phone.');
  assert.equal(head.url, 'https://mysterybundlehub.com/app');
  assert.match(head.image, /^https:\/\/res\.cloudinary\.com\/da6oeat7m\/image\/upload\/v\d+\/mystery-hub\/app-share\/[\w-]+\.jpg$/, 'a plain, versioned original: nothing to render on the first crawl');
  assert.deepEqual([head.imageWidth, head.imageHeight, head.imageType], [1200, 630, 'image/jpeg']);
  assert.equal(head.image, APP_SHARE_IMAGE.image);
  assert.ok(head.imageAlt && head.imageAlt !== head.title);
  assert.equal(head.noindex, undefined);
  assert.deepEqual(pageIndexingHead('/app'), head); assert.deepEqual(pageIndexingHead('/app/'), head); assert.deepEqual(pageIndexingHead('/app/index.html'), head);
  assert.equal(pageIndexingHead('/app', '?owner_preview=1').noindex, true, 'preview query strings still never index');
});

test('other pages keep their existing share previews', () => {
  const home = publicPageHead('home');
  assert.equal(home.url, 'https://mysterybundlehub.com/');
  assert.match(home.image, /f_jpg,q_auto,c_pad,w_1200,h_630,b_rgb:ffffff\/v1790859552\/30338777/);
  assert.match(publicPageHead('website').image, /ChatGPT_Image_Sep_30_2026_05_25_38_PM_bbopws/);
  assert.notEqual(publicPageHead('marketplace').image, APP_SHARE_IMAGE.image);
  assert.equal(publicPageHead('nonexistent').url, 'https://mysterybundlehub.com/');
});

test('first HTML response for /app: one set of app tags, nothing from the generic homepage left', () => {
  const index = source('index.html');
  const html = injectSocialHead(index, publicPageHead('app'));
  const count = (pattern: RegExp) => (html.match(pattern) || []).length;
  assert.equal(count(/<title>/g), 1);
  for (const tag of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:width', 'og:image:height', 'og:image:type', 'og:image:alt', 'og:type']) assert.equal(count(new RegExp(`property="${tag}"`, 'g')), 1, tag);
  for (const tag of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'description']) assert.equal(count(new RegExp(`name="${tag}"`, 'g')), 1, tag);
  assert.equal(count(/rel="canonical"/g), 1);
  assert.match(html, /<meta property="og:url" content="https:\/\/mysterybundlehub\.com\/app" \/>/);
  assert.match(html, /<meta property="og:image" content="https:\/\/res\.cloudinary\.com\/[^"]+mystery-hub-app-preview-v1\.jpg" \/>/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);
  assert.doesNotMatch(html, /Digital Services Marketplace in Ghana<\/title>/);
  assert.match(html, /rel="manifest"/, 'still the installable platform page');
  assert.match(html, /<div id="root"><\/div>/);
  assert.equal(expressInject, injectSocialHead, 'Express and the static build share one implementation');
});

test('Express responder answers /app with the same head, without any database read', async () => {
  for (const target of ['/app', '/app/', '/app?ref=QA123', '/app/index.html']) {
    const {head, status, customerSite} = await resolvePublicSocialMetadata(target, readers as never);
    assert.equal(status, 200); assert.equal(customerSite, false);
    assert.deepEqual(head, publicPageHead('app'), target);
  }
});

test('static build writes dist/app/index.html; Render and Netlify rewrite /app to it before the SPA catch-all', () => {
  const vite = source('vite.config.ts');
  assert.match(vite, /fileName: 'app\/index\.html'/);
  assert.match(vite, /publicPageHead\('app'\)/);
  const render = source('render.yaml');
  const app = render.indexOf('source: /app\n'), catchAll = render.indexOf('source: /*');
  assert.ok(app > 0 && app < catchAll, 'render.yaml: /app rule first');
  assert.match(render, /source: \/app\n\s+destination: \/app\/index\.html/);
  const redirects = source('public/_redirects');
  assert.ok(redirects.indexOf('/app   /app/index.html   200') < redirects.indexOf('/*    /index.html   200'));
});

test('install guidance: one honest next step per browser', () => {
  const base = {installed: false, hasPrompt: false, apple: false, userAgent: UA.chromeAndroid, checked: true};
  assert.equal(appLandingState({...base, installed: true, hasPrompt: true}), 'installed', 'never offer to install inside the app');
  assert.equal(appLandingState({...base, hasPrompt: true}), 'prompt');
  assert.equal(appLandingState({...base, userAgent: UA.whatsappAndroid}), 'in-app', 'WhatsApp/WebView cannot install');
  assert.equal(appLandingState({...base, userAgent: UA.whatsappAndroid, checked: false}), 'in-app', 'no waiting needed inside an in-app browser');
  assert.equal(appLandingState({...base, apple: true, userAgent: UA.facebookIos}), 'in-app', 'iPhone in-app browser: open in Safari first');
  assert.equal(appLandingState({...base, apple: true, userAgent: UA.safariIos}), 'apple');
  assert.equal(appLandingState({...base, checked: false}), 'checking', 'give Chromium a moment before suggesting the menu');
  assert.equal(appLandingState(base), 'android');
  assert.equal(appLandingState({...base, userAgent: UA.firefoxDesktop}), 'desktop');
  assert.equal(isInAppBrowser(UA.chromeAndroid), false); assert.equal(isInAppBrowser(UA.safariIos), false);
});

test('landing page reuses the existing install system and loads no account data', () => {
  const page = source('src/components/app/AppLandingPage.tsx');
  assert.match(page, /useAppInstall\(\)/);
  assert.doesNotMatch(page, /beforeinstallprompt|addEventListener\(/, 'no second install system');
  assert.doesNotMatch(page, /apiClient|fetch\(|sessionToken|getMyReferralSummary|walletMinor/, 'marketing page fetches nothing private');
  assert.doesNotMatch(page, /Play Store|Google Play|App Store listing|push notification/i);
  assert.match(source('src/App.tsx'), /lazyPage\(\(\) => import\('\.\/components\/app\/AppLandingPage'\)/, 'downloads only when /app is opened');
  const phone = renderToStaticMarkup(React.createElement(AppPhonePreview)).replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(phone, /GH₵|\d+\s?GB|[Bb]alance|MH-[A-Z0-9]|\b0\d{9}\b/, 'no invented balances, orders, prices or numbers in the phone');
  assert.match(phone, /Everything digital\./);
});

test('Share Mystery Hub: native share, silent cancel, copy fallback, nothing personal', async () => {
  const shared: ShareData[] = [];
  assert.equal(await shareApp(async data => { shared.push(data); }), 'shared');
  assert.deepEqual(shared[0], {title: 'Mystery Hub', text: APP_SHARE_TEXT, url: 'https://mysterybundlehub.com/app'});
  assert.equal(APP_SHARE_URL, 'https://mysterybundlehub.com/app');
  const copied: string[] = [];
  const clipboard = {writeText: async (text: string) => { copied.push(text); }};
  assert.equal(await shareApp(async () => { throw Object.assign(new Error('closed'), {name: 'AbortError'}); }, clipboard), 'cancelled');
  assert.equal(copied.length, 0, 'closing the share sheet never copies');
  assert.equal(await shareApp(async () => { throw new Error('NotAllowedError'); }, clipboard), 'copied');
  assert.equal(await shareApp(undefined, clipboard), 'copied');
  assert.deepEqual(copied, [APP_SHARE_URL, APP_SHARE_URL]);
  assert.equal(await shareApp(undefined, {writeText: async () => { throw new Error('denied'); }}), 'failed');
  assert.equal(await shareApp(undefined, undefined), 'failed');
  assert.equal(await copyAppLink(clipboard), true); assert.equal(await copyAppLink(undefined), false);
  assert.doesNotMatch(APP_SHARE_TEXT + APP_SHARE_URL, /ref=|\?/, 'no referral code or query string');
  const navbar = source('src/components/common/Navbar.tsx');
  assert.equal((navbar.match(/<ShareAppButton /g) || []).length, 2, 'phone menu + account menu only');
  assert.doesNotMatch(source('src/components/app/ShareAppButton.tsx'), /useEffect/, 'never opens by itself');
});
