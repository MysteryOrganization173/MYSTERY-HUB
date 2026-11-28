/**
 * 3.7.3 Performance & Mobile Excellence: the behaviour behind the measured changes (docs/performance-mobile-excellence-3-7-3.md).
 * The lab numbers come from scripts/reviewPerformance373.cjs; these tests pin what must stay true while they improve.
 */
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EARLY_SEASON_KEY, NO_APP_PATHS, earlySeasonAnswer, startupHintsScript, type StartupHintsInput } from '../../../src/utils/startupHints.js';
import { getPageFromPath } from '../../../src/utils/routing.js';
import { CLOSED_PAYMENT_MAX_MS, OPEN_ORDER_CHECK_MS, closedPaymentDelay, isClosedPayment, startReceiptChecks } from '../../../src/utils/receiptChecks.js';
import { SEASONAL_SERIF_HREF } from '../../../src/seasonal/christmas/font.js';
import { Dial } from '../../../src/countdown/Dial.js';

const read = (file: string) => readFileSync(file, 'utf8');
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

// ---------------------------------------------------------------- the page's first script (startupHints)

const INPUT: StartupHintsInput = {
  app: { js: ['assets/App-a.js', 'assets/vendor-b.js'], css: ['assets/App-c.css'] },
  seasons: {
    'christmas-2026': {
      shell: { js: ['assets/ChristmasShell-1.js', 'assets/vendor-b.js'], css: ['assets/ChristmasShell-2.css'] },
      pack: { js: ['assets/ChristmasPack-3.js'], css: ['assets/ChristmasPack-4.css'] },
      home: { js: ['assets/ChristmasHome-5.js', 'assets/vendor-b.js', 'assets/copy-6.js'], css: ['assets/ChristmasHome-6.css'] },
      member: { js: ['assets/ChristmasMemberHome-7.js', 'assets/copy-6.js'], css: [] },
    },
  },
  serifHref: SEASONAL_SERIF_HREF,
  apiBase: 'https://api.example.test/',
};

interface Link { rel: string; href: string; as?: string; crossOrigin?: string }
type SignedIn = boolean | 'session' | 'blocked';
function runHints(url: string, { signedIn = false, answer, ok = true, noFetch = false }: { signedIn?: SignedIn; answer?: unknown; ok?: boolean; noFetch?: boolean } = {}) {
  const { pathname, search } = new URL(url, 'https://www.example.test');
  const links: Link[] = [], requests: { url: string; init: unknown }[] = [];
  const sandbox: Record<string, unknown> = {
    location: { pathname, search },
    document: { head: { appendChild: (l: Link) => { links.push(l); } }, createElement: () => ({}) },
    // "Remember me" keeps the session in localStorage, otherwise in sessionStorage (AppContext); storage can also throw.
    localStorage: { getItem: (key: string) => { if (signedIn === 'blocked') throw new Error('SecurityError'); return signedIn === true && key === 'mystery_hub_session_token' ? 'token' : null; } },
    sessionStorage: { getItem: (key: string) => { if (signedIn === 'blocked') throw new Error('SecurityError'); return signedIn === 'session' && key === 'mystery_hub_session_token' ? 'token' : null; } },
  };
  if (!noFetch) sandbox.fetch = (u: string, init: unknown) => { requests.push({ url: u, init }); return Promise.resolve({ ok, json: async () => answer }); };
  sandbox.window = sandbox;
  vm.runInNewContext(startupHintsScript(INPUT), sandbox);
  return { links, requests, sandbox, done: async () => { await (sandbox[EARLY_SEASON_KEY] as Promise<unknown> | undefined); await flush(); } };
}
const hrefs = (links: Link[], rel?: string) => links.filter(l => !rel || l.rel === rel).map(l => l.href);
const ACTIVE = { active: true, scheduledPack: 'christmas-2026', serverTime: '2026-12-10T09:00:00Z' };

test('head script: business websites, previews, Greetings and Countdown download nothing and ask nothing', async () => {
  for (const url of ['/sites/kofi-bakes', '/sites/kofi-bakes/menu', '/g/abc123', '/g', '/G/abc', '/greetings', '/greetings/', '/countdown', '/Countdown/', '/?isolated_template_preview=t1', '/?x=1&preview_template_id=t2', '/data?preview_template_id=t3#top']) {
    const run = runHints(url, { answer: ACTIVE });
    await run.done();
    assert.deepEqual(run.links, [], url);
    assert.deepEqual(run.requests, [], url);
    assert.equal(run.sandbox[EARLY_SEASON_KEY], undefined, url);
  }
  // Paths that only look similar, and the edges where main.tsx still serves the app (no site name, an empty preview
  // id), are app pages. Campaign short links forward into the app, so the app download is kept there.
  for (const url of ['/gifts', '/greetings-help', '/countdowns', '/site/x', '/sites/', '/?preview_template_id=', '/?isolated_template_preview=&x=1', '/c/MH-WIN']) assert.ok(runHints(url).links.length > 0, url);
});

test('head script: the rules are the same ones main.tsx uses to serve those pages without the app', () => {
  const main = read('src/main.tsx');
  // Every surface main.tsx serves without App.tsx is listed here (both directions), apart from campaign links.
  const surfaces = [...main.matchAll(/import\('\.\/([^']+)'\)/g)].map(m => m[1]).filter(f => !/\.css$/.test(f)).sort();
  assert.deepEqual(surfaces, ['App.tsx', 'components/common/CampaignRedirect', 'components/website/IsolatedTemplatePreview', 'components/website/PublicPublishedSite', 'countdown/CountdownPage', 'greetings/CreatorPage', 'greetings/RecipientPage'], 'a new surface in main.tsx needs a rule in NO_APP_PATHS');
  for (const rule of [NO_APP_PATHS.greeting, NO_APP_PATHS.creator, NO_APP_PATHS.countdown]) assert.ok(main.includes(String(rule).replace(/\/i$/, '/i.test(window.location.pathname)')), String(rule));
  assert.ok(main.includes("pathname.match(/^\\/sites\\/([^/?#]+)/)"), 'business websites');
  for (const name of ['isolated_template_preview', 'preview_template_id']) { assert.ok(main.includes(`params.get('${name}')`), name); assert.ok(NO_APP_PATHS.templatePreview.source.includes(name), name); }
});

test('head script: only the homepage asks for the season early; other app pages download the app and nothing else', async () => {
  for (const url of ['/', '/index.html', '/INDEX.HTML', '/index.html/', '/?ref=MH-123']) {
    assert.equal(getPageFromPath(new URL(url, 'https://x.test').pathname), 'home', url);
    const run = runHints(url, { answer: ACTIVE }); await run.done();
    assert.equal(run.requests.length, 1, url);
    assert.ok(run.links.length > 3, `${url}: the seasonal homepage is warmed`);
  }
  // Elsewhere the page asks for itself, as before, so its own download keeps the connection (see the release document).
  for (const [url, signedIn] of [['/data', false], ['/data/', false], ['/orders', true], ['/wallet', true], ['/services', false], ['/earn', true], ['/app', false], ['/unknown', false]] as const) {
    const run = runHints(url, { answer: ACTIVE, signedIn }); await run.done();
    assert.deepEqual(run.requests, [], url);
    assert.deepEqual(hrefs(run.links), ['/assets/App-a.js', '/assets/vendor-b.js', '/assets/App-c.css'], url);
    assert.equal(run.sandbox[EARLY_SEASON_KEY], undefined, url);
  }
});

test('head script: on app pages it downloads the app (crossorigin, like Vite\'s own tags) and asks for the season once', async () => {
  const run = runHints('/', { answer: { active: false, scheduledPack: null } });
  assert.deepEqual(run.links.slice(0, 3), [
    { rel: 'modulepreload', href: '/assets/App-a.js', crossOrigin: '' },
    { rel: 'modulepreload', href: '/assets/vendor-b.js', crossOrigin: '' },
    { rel: 'preload', as: 'style', href: '/assets/App-c.css', crossOrigin: '' },
  ]);
  assert.equal(run.requests.length, 1);
  assert.equal(run.requests[0].url, 'https://api.example.test/api/seasonal/status', 'the same URL the app asks (so the app\'s own check is served from it)');
  assert.deepEqual(JSON.parse(JSON.stringify(run.requests[0].init)), { headers: { Accept: 'application/json' } });
  await run.done();
  // No pack today: nothing seasonal is downloaded, but the answer is kept for SeasonProvider.
  assert.equal(run.links.length, 3);
  const kept = run.sandbox[EARLY_SEASON_KEY + 'Answer'] as { data: unknown; at: number };
  assert.deepEqual(kept.data, { active: false, scheduledPack: null });
  assert.equal(typeof kept.at, 'number');
});

test('head script: when a pack applies, only the homepage warms seasonal parts (they are its main content), and the serif is the pack\'s own stylesheet', async () => {
  const seasonal = async (url: string, signedIn: SignedIn = false) => { const run = runHints(url, { answer: ACTIVE, signedIn }); await run.done(); return run.links.slice(3); };
  const guestHome = await seasonal('/');
  assert.deepEqual(hrefs(guestHome, 'modulepreload'), ['/assets/ChristmasShell-1.js', '/assets/ChristmasPack-3.js', '/assets/ChristmasHome-5.js', '/assets/copy-6.js'], 'vendor-b (already warm with the app) is not added twice');
  assert.deepEqual(hrefs(guestHome, 'preload'), ['/assets/ChristmasShell-2.css', '/assets/ChristmasPack-4.css', '/assets/ChristmasHome-6.css']);
  const serif = guestHome.filter(l => l.rel === 'stylesheet');
  assert.deepEqual(serif, [{ rel: 'stylesheet', href: SEASONAL_SERIF_HREF }], 'a real stylesheet without crossorigin: loadSeasonalSerif finds it by href and never adds a second');
  assert.deepEqual(hrefs(await seasonal('/', true), 'modulepreload'), ['/assets/ChristmasShell-1.js', '/assets/ChristmasMemberHome-7.js', '/assets/copy-6.js'], 'a member: no guest pack, the member homepage');
  assert.deepEqual(hrefs(await seasonal('/', 'session'), 'modulepreload'), ['/assets/ChristmasShell-1.js', '/assets/ChristmasMemberHome-7.js', '/assets/copy-6.js'], 'a member signed in for this session only');
  assert.deepEqual(hrefs(await seasonal('/', 'blocked'), 'modulepreload'), ['/assets/ChristmasShell-1.js', '/assets/ChristmasPack-3.js', '/assets/ChristmasHome-5.js', '/assets/copy-6.js'], 'storage that throws: treated as a guest, nothing breaks');
  assert.deepEqual(hrefs(await seasonal('/index.html'), 'modulepreload'), ['/assets/ChristmasShell-1.js', '/assets/ChristmasPack-3.js', '/assets/ChristmasHome-5.js', '/assets/copy-6.js']);
  // A pack this build does not know, a failed answer or something that is not an object: nothing seasonal.
  for (const options of [{ answer: { active: true, scheduledPack: 'unknown-pack' } }, { answer: { active: true, scheduledPack: 'constructor' } }, { answer: { active: true, scheduledPack: 'toString' } }, { answer: { active: 'true', scheduledPack: 'christmas-2026' } }, { answer: ACTIVE, ok: false }, { answer: 'active' }, { answer: null }]) {
    const run = runHints('/', options); await run.done();
    assert.equal(run.links.length, 3, JSON.stringify(options));
  }
  const failed = runHints('/', { ok: false, answer: ACTIVE }); await failed.done();
  assert.equal(failed.sandbox[EARLY_SEASON_KEY + 'Answer'], undefined, 'a failed answer is never kept');
  // A browser without fetch still gets the app download and nothing else.
  const old = runHints('/', { noFetch: true });
  assert.equal(old.links.length, 3); assert.equal(old.sandbox[EARLY_SEASON_KEY], undefined);
});

test('head script: the early answer is read only in its own shape', () => {
  assert.equal(earlySeasonAnswer(undefined), null);
  assert.equal(earlySeasonAnswer({}), null);
  assert.equal(earlySeasonAnswer({ [EARLY_SEASON_KEY + 'Answer']: { data: null, at: 1 } }), null);
  assert.equal(earlySeasonAnswer({ [EARLY_SEASON_KEY + 'Answer']: { data: { active: true }, at: Number.NaN } }), null);
  assert.equal(earlySeasonAnswer({ [EARLY_SEASON_KEY + 'Answer']: { data: 'christmas', at: 1 } }), null);
  assert.deepEqual(earlySeasonAnswer({ [EARLY_SEASON_KEY + 'Answer']: { data: { active: true }, at: 5 } }), { data: { active: true }, at: 5 });
  // SeasonProvider starts from it like a stored answer, keeps this device's own clock correction, and still asks itself.
  const provider = read('src/seasonal/SeasonProvider.tsx');
  assert.match(provider, /const \[initial\] = useState\(startingSeason\);/);
  assert.match(provider, /if \(!early \|\| \(stored && stored\.at > early\.at\)\) return stored;/, 'the newer of the two answers wins');
  assert.match(provider, /usableStoredSeason\(\{ pack: scheduledPackFrom\(early\.data\), at: early\.at, skew: stored\?\.skew \?\? 0 \}, Date\.now\(\)\) \?\? stored/);
  assert.match(read('src/seasonal/seasonSync.ts'), /void ask\(false\); armBoundary\(\);/);
});

test('build: the script is the first thing in the head that can wait, before any stylesheet, on both app pages', () => {
  assert.match(read('vite.config.ts'), /\/\/ Before the first stylesheet, so nothing holds it up\.\s*const at = html\.search\(/);
  for (const file of ['dist/index.html', 'dist/app/index.html']) {
    if (!existsSync(file)) continue;
    const html = read(file);
    const script = html.indexOf('<script>(function(){var p=location.pathname');
    assert.ok(script > 0, file);
    assert.ok(script < html.search(/<link\b[^>]*\brel=["']?stylesheet/i), `${file}: before the first stylesheet`);
    assert.ok(script < html.indexOf('<script type="module"'), `${file}: before the entry script`);
    const app = /modulepreload','\/'\+f/.test(html) && html.match(/warm\((\{"js":\[[^\]]*\],"css":\[[^\]]*\]\})\)/);
    assert.ok(app, file);
    const assets = JSON.parse(app[1]) as { js: string[]; css: string[] };
    assert.ok(assets.js.some(f => /^assets\/App-/.test(f)), 'the app chunk');
    assert.ok(!assets.js.some(f => /^assets\/index-/.test(f)) && !assets.css.some(f => /^assets\/index-/.test(f)), 'never the entry or its stylesheet again');
    assert.equal(new Set(assets.js).size, assets.js.length);
  }
});

// ---------------------------------------------------------------- receipt checks (receiptChecks)

function receiptHarness(initialStatus: string) {
  let status = initialStatus, hidden = false, listener: (() => void) | null = null, removed = 0;
  const pending: (() => void)[] = [];
  let checks = 0;
  const stop = startReceiptChecks({
    check: () => { checks++; return new Promise<void>(resolve => pending.push(resolve)); },
    serverStatus: () => status,
    isHidden: () => hidden,
    onVisibility: l => { listener = l; return () => { listener = null; removed++; }; },
  });
  return {
    get checks() { return checks; },
    get removed() { return removed; },
    set status(s: string) { status = s; },
    set hidden(h: boolean) { hidden = h; },
    async answer() { pending.shift()?.(); await flush(); },
    async wait(ms: number) { mock.timers.tick(ms); await flush(); },
    async visibility() { listener?.(); await flush(); },
    stop,
  };
}

test('receipt: an order that can still move is checked every 3 s as before, and never twice at once', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    assert.equal(OPEN_ORDER_CHECK_MS, 3000);
    const r = receiptHarness('pending_payment');
    assert.equal(r.checks, 1, 'checked at once on opening');
    await r.answer();
    await r.wait(2999); assert.equal(r.checks, 1);
    await r.wait(1); assert.equal(r.checks, 2);
    // A slow answer: nothing else starts while it is outstanding, however long it takes, even on returning to the app.
    await r.wait(20_000); await r.visibility(); assert.equal(r.checks, 2);
    await r.answer();
    await r.wait(3000); assert.equal(r.checks, 3);
    for (const s of ['paid', 'queued', 'submitted', 'processing', 'failed', 'refund_pending']) { r.status = s; await r.answer(); await r.wait(3000); }
    assert.equal(r.checks, 9, 'the same 3 s for every moving state');
    r.stop();
  } finally { mock.timers.reset(); }
});

test('receipt: a cancelled or expired payment keeps being checked, more gently, and a late approval returns to 3 s', async () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(closedPaymentDelay), [6000, 12_000, 24_000, 30_000, 30_000, 30_000]);
  assert.equal(CLOSED_PAYMENT_MAX_MS, 30_000);
  assert.deepEqual(['cancelled', 'expired', 'pending_payment', 'paid', null, undefined].map(isClosedPayment), [true, true, false, false, false, false]);
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const r = receiptHarness('cancelled');
    for (const [delay, n] of [[6000, 2], [12_000, 3], [24_000, 4], [30_000, 5], [30_000, 6]] as const) {
      await r.answer();
      await r.wait(delay - 1); assert.equal(r.checks, n - 1, `not before ${delay}`);
      await r.wait(1); assert.equal(r.checks, n, `at ${delay}`);
    }
    r.status = 'paid'; // a late Mobile Money approval
    await r.answer(); await r.wait(3000); assert.equal(r.checks, 7);
    r.status = 'expired';
    await r.answer(); await r.wait(5999); assert.equal(r.checks, 7); await r.wait(1); assert.equal(r.checks, 8, 'the gentle schedule starts again');
    r.stop();
  } finally { mock.timers.reset(); }
});

test('receipt: no checks in the background; coming back checks at once and restarts the schedule; closing stops everything', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const r = receiptHarness('cancelled');
    await r.answer(); await r.wait(6000); assert.equal(r.checks, 2);
    r.hidden = true;
    await r.answer(); await r.wait(10 * 60_000); assert.equal(r.checks, 2, 'nothing while hidden');
    await r.visibility(); assert.equal(r.checks, 2, 'a hidden-state event changes nothing');
    r.hidden = false; await r.visibility(); assert.equal(r.checks, 3, 'at once on return');
    await r.answer(); await r.wait(6000); assert.equal(r.checks, 4, 'the gentle schedule starts from the beginning');
    // Returning while a timer is armed replaces it rather than adding a second.
    await r.answer(); await r.visibility(); assert.equal(r.checks, 5);
    await r.answer(); await r.wait(6000); assert.equal(r.checks, 6);
    await r.wait(12_000); assert.equal(r.checks, 6, 'only one schedule');
    // Hidden while the next check is already armed (switching to the Mobile Money prompt): that check is dropped too.
    await r.answer();
    r.hidden = true; await r.visibility();
    await r.wait(10 * 60_000); assert.equal(r.checks, 6, 'not even the armed check runs in the background');
    r.hidden = false; await r.visibility(); assert.equal(r.checks, 7, 'the return checks at once');
    // A timer that fires while hidden (no hidden event seen yet) asks nothing either.
    await r.answer(); r.hidden = true; await r.wait(6000); assert.equal(r.checks, 7, 'a due check waits for the page to be visible');
    r.hidden = false; await r.visibility(); assert.equal(r.checks, 8);
    // Closing: the armed timer is cleared, the listener removed, and an answer that arrives later schedules nothing.
    r.stop(); assert.equal(r.removed, 1);
    await r.answer(); await r.wait(10 * 60_000); assert.equal(r.checks, 8);
  } finally { mock.timers.reset(); }
});

test('receipt: the modal uses the schedule with its own guards, and terminal orders are still never checked', () => {
  const modal = read('src/components/checkout/OrderStatusModal.tsx');
  assert.match(modal, /if \(!isStatusModalOpen \|\| !lookupReference \|\| isTerminal\) return;/);
  assert.match(modal, /let alive = true, inFlight = false;/);
  assert.match(modal, /startReceiptChecks\(\{\s*check: fetchServerStatus,\s*serverStatus: \(\) => latest\.current\.activeOrder\?\.serverStatus,\s*isHidden: \(\) => document\.visibilityState === 'hidden',/);
  assert.match(modal, /return \(\) => \{ alive = false; stop\(\); \};/);
  assert.doesNotMatch(modal, /setInterval\(/);
});

// ---------------------------------------------------------------- catalogue refresh (useDirectCatalog)

test('catalogue: one schedule for the page however many parts show it; a fresh answer is reused; nothing in the background', async () => {
  const listeners: Record<string, Set<() => void>> = {};
  const target = () => ({ addEventListener: (t: string, l: () => void) => { (listeners[t] ||= new Set()).add(l); }, removeEventListener: (t: string, l: () => void) => { listeners[t]?.delete(l); } });
  const g = globalThis as Record<string, unknown>;
  const saved = { window: g.window, document: g.document, fetch: g.fetch };
  const doc = { visibilityState: 'visible', ...target() };
  g.window = target(); g.document = doc;
  let requests = 0;
  g.fetch = async () => { requests++; return { ok: true, json: async () => ({ products: [{ id: 'mtn-1gb', network: 'mtn', dataAmount: '1GB', priceGhc: 5 }], campaign: null }) }; };
  mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: Date.parse('2026-12-01T10:00:00Z') });
  const fire = async (type: string) => { for (const l of [...(listeners[type] || [])]) l(); await flush(); };
  try {
    const { startCatalogSchedule, directCatalogConfirmed, CATALOG_REFRESH_MS, CATALOG_REUSE_MS } = await import('../../../src/hooks/useDirectCatalog.js');
    assert.deepEqual([CATALOG_REFRESH_MS, CATALOG_REUSE_MS], [60_000, 30_000]);
    const homepage = startCatalogSchedule(); await flush();
    assert.equal(requests, 1); assert.equal(directCatalogConfirmed(), true);
    mock.timers.tick(10_000);
    const offerCard = startCatalogSchedule(), checkout = startCatalogSchedule(); await flush();
    assert.equal(requests, 1, 'parts shown within 30 s reuse the answer');
    await fire('focus'); assert.equal(requests, 1, 'a return within 30 s reuses it too');
    mock.timers.tick(50_000); await flush();
    assert.equal(requests, 2, 'one refresh a minute for the whole page, not one per part');
    mock.timers.tick(31_000); await fire('focus'); assert.equal(requests, 3, 'a return after 30 s asks again');
    doc.visibilityState = 'hidden';
    mock.timers.tick(5 * 60_000); await flush(); assert.equal(requests, 3, 'nothing in the background');
    await fire('visibilitychange'); assert.equal(requests, 3);
    doc.visibilityState = 'visible'; await fire('visibilitychange'); assert.equal(requests, 4, 'at once on return');
    // The minute tick that comes 29 s after that return reuses its answer; the next one asks.
    mock.timers.tick(29_000); await flush(); assert.equal(requests, 4, 'a tick just after a return answer reuses it');
    homepage(); offerCard(); mock.timers.tick(60_000); await flush(); assert.equal(requests, 5, 'still running while one part remains');
    checkout(); mock.timers.tick(10 * 60_000); await fire('focus'); await fire('visibilitychange');
    assert.equal(requests, 5, 'stopped with the last part, listeners removed');
    assert.equal((listeners.focus?.size || 0) + (listeners.visibilitychange?.size || 0), 0);
    // A failed read is never treated as a fresh answer: a return a second later asks again.
    g.fetch = async () => { requests++; return { ok: false, status: 503, json: async () => ({ error: 'down' }) }; };
    const again = startCatalogSchedule(); await flush(); assert.equal(requests, 6, 'the page asks when it shows the catalogue again');
    mock.timers.tick(1000); await fire('focus'); assert.equal(requests, 7, 'the failure did not count as an answer');
    again();
  } finally {
    mock.timers.reset();
    Object.assign(g, saved);
  }
});

test('welcome offer: asked once the server catalogue is on the page, so the notice appears once instead of flickering', () => {
  const hook = read('src/hooks/useWelcomeOffer.ts');
  assert.match(hook, /const catalogConfirmed = directCatalogConfirmed\(\);/);
  assert.match(hook, /const key = JSON\.stringify\(\[catalogConfirmed, sessionToken, user\?\.id, user\?\.phone,/);
  assert.match(hook, /productIds: !catalogConfirmed \|\| \(sessionToken && \(!user \|\| user\.mustChangePassword\)\) \? \[\] : productIds/);
  assert.match(hook, /const periodic = \(\) => \{ if \(document\.visibilityState !== 'hidden'\) void cache\.refresh\(context\); \};/, 'nothing in the background');
  assert.match(hook, /const refresh = \(\) => \{ void cache\.refresh\(context, true\); \};/, 'a return still revalidates (and discards stale eligibility)');
  assert.match(hook, /window\.addEventListener\('focus', onReturn\);\s*document\.addEventListener\('visibilitychange', onReturn\);/, 'on focus, or on a phone\'s visibilitychange');
  assert.match(hook, /if \(document\.visibilityState === 'hidden' \|\| Date\.now\(\) - lastReturn < 1000\) return;\s*lastReturn = Date\.now\(\); refresh\(\);/, 'one re-read per return');
  // An empty product list asks nothing and shows nothing (welcomeOfferCache), so the notice never shows unconfirmed.
  assert.match(read('src/utils/welcomeOfferCache.ts'), /if \(!context\.productIds\.length\) return Promise\.resolve\(\);/);
});

// ---------------------------------------------------------------- countdown dial

const MIN = 60_000;
test('countdown: the seconds light turns on its own layer (the compositor moves it), and the ring only eases in the last minute', () => {
  const html = renderToStaticMarkup(React.createElement(Dial, { stage: 'hour', remainingMs: 15 * MIN + 20_000, celebrating: false, motion: true, children: null }));
  const layer = html.match(/<svg[^>]*class="cd-second-layer"[^>]*>/);
  assert.ok(layer, 'a separate svg for the seconds light');
  assert.match(layer[0], /style="transform:rotate\(-?\d+(\.\d+)?deg\)"/);
  assert.match(layer[0], /aria-hidden="true"/);
  assert.equal((html.match(/class="cd-second-layer"/g) || []).length, 1);
  // A second later the light's layer turns and the ring shortens (one step, no easing outside the last minute); nothing
  // else in the drawing changes.
  const later = renderToStaticMarkup(React.createElement(Dial, { stage: 'hour', remainingMs: 15 * MIN + 19_000, celebrating: false, motion: true, children: null }));
  const main = (markup: string) => markup.slice(0, markup.indexOf('<svg class="cd-second-layer"')).replace(/stroke-dashoffset="[^"]*"/, '');
  assert.equal(main(later), main(html));
  assert.notEqual(later.match(/<svg[^>]*class="cd-second-layer"[^>]*>/)![0], layer[0]);
  const settled = renderToStaticMarkup(React.createElement(Dial, { stage: 'welcome', remainingMs: 0, celebrating: false, motion: true, children: null }));
  assert.doesNotMatch(settled, /cd-second-layer/, 'no seconds light once the moment has come');
  const css = read('src/countdown/countdown.css');
  assert.match(css, /\.cd-second-layer \{[^}]*transition: transform \.5s var\(--cd-ease\);[^}]*will-change: transform;/);
  assert.doesNotMatch(css.match(/\.cd-ring-lit \{[^}]*\}/)![0], /transition/, 'the ring does not repaint for a second each second');
  assert.match(css, /\.cd-page\[data-stage="minute"\] \.cd-ring-lit \{[^}]*transition: stroke-dashoffset \.95s linear;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.cd-page \*, \.cd-page \*::before, \.cd-page \*::after \{ animation: none !important; transition: none !important; \}/);
});

// ---------------------------------------------------------------- layout stability

test('layout: loading states keep the room their content takes, and keep their announcements', () => {
  assert.match(read('src/index.css'), /\.mh-route-fallback \{ min-height: 100vh; min-height: 100svh;/, 'a loading page keeps the footer below the fold');
  assert.match(read('src/index.css'), /\.mh-season-home-wait \{ min-height: 100vh; min-height: 100svh;/, 'so does the seasonal homepage placeholder');
  assert.doesNotMatch(read('src/index.css'), /\.mh-season-home-wait\.is-member \{[^}]*min-height/, 'for members too');
  const wallet = read('src/components/finance/FinancialPanel.tsx');
  assert.match(wallet, /<div className="min-h-\[22rem\] space-y-5"><p role="status">Loading your balance…<\/p><div aria-hidden="true"/);
  const sharing = read('src/components/earn/EarnSharing.tsx');
  assert.match(sharing, /className=\{`earn-share-panel\$\{loading \? ' is-loading' : ''\}`\} aria-busy=\{loading \|\| undefined\}/);
  assert.match(sharing, /: loading && <p className="earn-referral-identity is-placeholder" aria-hidden="true">/);
  const earnCss = read('src/components/earn/earn.css');
  assert.match(earnCss, /\.earn-share-panel\.is-loading \.earn-message \{ min-height: 8rem; \}/);
  assert.match(earnCss, /\.earn-referral-identity\.is-placeholder \{ visibility: hidden; \}/);
  assert.match(earnCss, /@media \(max-width: 559px\) \{ \.earn-page \.earn-next \{ min-height: 3em; min-height: 2lh; \} \}/);
  // The new-member line fits one line on a 320 px phone, in both homepages, so it no longer pushes the page down.
  for (const file of ['src/components/home/MemberHomeView.tsx', 'src/seasonal/christmas/member/ChristmasMemberView.tsx']) assert.ok(read(file).includes("'Welcome! Let’s get you connected.'"), file);
});
