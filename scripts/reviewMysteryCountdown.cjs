/*
 * Mystery Countdown 3.7.1 (/countdown): real-browser review. LOCAL ONLY, synthetic time only.
 *
 * Runs Playwright Chromium against a LOCAL production build (`npm run build && npx vite preview --port 4173`). The
 * server's clock is a controlled answer from /api/experiences/countdown (intercepted in the browser), and the device
 * clock is controlled with Playwright's clock (deliberately wrong, months off). Nothing reaches production, no real
 * time override exists anywhere, analytics writes are answered locally and recorded, and nothing is sent.
 *
 *   COUNTDOWN_REVIEW_BASE_URL  default http://localhost:4173 (must be loopback)
 *   COUNTDOWN_REVIEW_OUT       screenshots folder (default /tmp/mystery-countdown-review)
 *   COUNTDOWN_REVIEW_MARK      optional PNG served in place of the Cloudinary brand mark (offline sandboxes)
 *   COUNTDOWN_REVIEW_AXE       optional path to axe.min.js for the accessibility audit
 *   COUNTDOWN_REVIEW_ONLY      optional regular expression to run some checks only
 *
 * Requires Playwright (not a project dependency). This is browser emulation, not physical-device testing. Exit code 1 if
 * any check fails.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BASE = (process.env.COUNTDOWN_REVIEW_BASE_URL || 'http://localhost:4173').replace(/\/$/, '');
const OUT = process.env.COUNTDOWN_REVIEW_OUT || '/tmp/mystery-countdown-review';
const MARK = process.env.COUNTDOWN_REVIEW_MARK || '';
const AXE = process.env.COUNTDOWN_REVIEW_AXE || '';
const ONLY = process.env.COUNTDOWN_REVIEW_ONLY ? new RegExp(process.env.COUNTDOWN_REVIEW_ONLY) : null;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('Refusing a non-loopback server.');
fs.mkdirSync(OUT, { recursive: true });

const T = Date.parse('2027-01-01T00:00:00.000Z');
const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;
const WRONG_DEVICE_CLOCK = new Date('2026-06-01T10:00:00Z');
const ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const results = [];
const notes = [];
async function check(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  try { await fn(); results.push([true, name]); console.log(`PASS  ${name}`); }
  catch (e) { results.push([false, name]); console.log(`FAIL  ${name}\n      ${String(e && e.stack || e).split('\n').slice(0, 4).join('\n      ')}`); }
}
function ok(condition, message) { if (!condition) throw new Error(message); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

let browser;
/**
 * A page on /countdown whose server says the time is `serverAt` when the page opens. `reply` may be changed while the
 * page runs: 'ok', 'fail' (503), 'slow' (answers after `delay`), 'abort' (the network drops the request).
 */
async function open(opts = {}) {
  const { serverAt = T - 10 * DAY, width = 390, height = 844, ua = ANDROID, clock = true, reduced = false, path: route = '/countdown', init, permissions, wait = true, ...rest } = opts;
  const context = await browser.newContext({ viewport: { width, height }, userAgent: ua, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference', ...rest });
  if (permissions) await context.grantPermissions(permissions, { origin: BASE });
  const page = await context.newPage();
  const state = { reply: 'ok', delay: 6_000, calls: 0, analytics: [], requests: [], errors: [], served: [] };
  page.on('pageerror', e => state.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) state.errors.push(m.text()); });
  page.on('request', r => state.requests.push(r.url()));
  // The device clock is wrong and paused: it moves only when a check moves it, so every second is deterministic.
  if (clock) { await page.clock.install({ time: WRONG_DEVICE_CLOCK }); await page.clock.pauseAt(new Date(WRONG_DEVICE_CLOCK.getTime() + 1_000)); }
  if (init) await page.addInitScript(init);
  await page.addInitScript(() => {
    // Lets a check say the page is hidden or visible, as switching apps does.
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis || 'visible' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => (window.__vis || 'visible') === 'hidden' });
  });
  await page.route('**/api/experiences/countdown', async r => {
    state.calls++;
    const mode = state.reply;
    if (mode === 'abort') return r.abort('internetdisconnected');
    if (mode === 'fail') return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"code":"EXPERIENCE_UNAVAILABLE"}}' });
    if (mode === 'slow') await sleep(state.delay);
    let elapsed = 0;
    try { elapsed = await page.evaluate(() => performance.now()); } catch { /* closing */ }
    const now = serverAt + elapsed;
    state.served.push(now);
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store, private' }, body: JSON.stringify({ schemaVersion: 1, timeZone: 'Africa/Accra', target: '2027-01-01T00:00:00.000Z', serverTime: new Date(now).toISOString(), remainingMs: Math.max(0, T - now), passed: now >= T }) }).catch(() => undefined);
  });
  if (MARK) await page.route('https://res.cloudinary.com/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(MARK) }));
  await page.route('**/api/analytics/**', r => { state.analytics.push(r.request().url()); return r.fulfill({ status: 204, body: '' }); });
  await page.route('**/api/experiences/events', r => { state.analytics.push(r.request().url()); return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"code":"EXPERIENCES_DISABLED"}}' }); });
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  if (wait) await page.waitForSelector('.cd-page', { timeout: 15_000 });
  return { page, context, state };
}
const stage = page => page.getAttribute('.cd-page', 'data-stage');
/**
 * Wider than the screen, either as page scroll or as content cut off by the page's own overflow guard (decorations such
 * as the midnight sparks and screen-reader-only text excepted).
 */
const overflow = page => page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1
  || [...document.querySelectorAll('.cd-shell *')].some(e => { if (e.closest('.cd-burst, .cd-sr')) return false; const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }));
const visibility = (page, v) => page.evaluate(v => { window.__vis = v; document.dispatchEvent(new Event('visibilitychange')); }, v);
async function waitStage(page, name, ms = 10_000) { await page.waitForSelector(`.cd-page[data-stage="${name}"]`, { timeout: ms }); }
/** Lets the fonts and the dial settle before a screenshot. */
async function shot(page, name) { await page.evaluate(() => document.fonts.ready); await sleep(900); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); }

(async () => {
  browser = await chromium.launch();

  /* ───────────── Phases, each with a wrong device clock ───────────── */
  const phases = [
    ['days', T - (34 * DAY + 5 * HOUR + 12 * MIN + 9 * SEC), 'Counting down to 2027'],
    ['eve', T - (6 * HOUR + 14 * MIN + 30 * SEC), 'Tonight we welcome 2027'],
    ['hour', T - (23 * MIN + 41 * SEC), 'Almost 2027'],
    ['minute', T - 47 * SEC, 'Here comes 2027'],
    ['final', T - 7.4 * SEC, 'Ten seconds to 2027'],
    ['welcome', T + 3 * HOUR, 'Welcome, 2027'],
    ['commemorative', Date.parse('2027-02-10T12:00:00Z'), 'Welcome to a beautiful 2027'],
  ];
  for (const [name, serverAt, title] of phases) {
    await check(`phase ${name}: the server’s time decides, months-wrong device clock ignored`, async () => {
      const { page, context, state } = await open({ serverAt });
      await waitStage(page, name);
      ok((await page.textContent('h1')).trim() === title, `title: ${await page.textContent('h1')}`);
      ok(!(await overflow(page)), 'no horizontal overflow');
      ok(state.calls === 1, `${state.calls} time requests`);
      if (name === 'days') {
        const cells = await page.$$eval('.cd-cell', els => els.map(e => e.textContent));
        ok(cells.length === 4 && cells[0].startsWith('34'), `cells ${cells}`);
      }
      if (name === 'final') ok(/^[1-8]$/.test((await page.textContent('.cd-final-number')).trim()), 'final number');
      if (name === 'welcome' || name === 'commemorative') ok(!(await page.getAttribute('.cd-page', 'data-celebration')), 'no celebration for a later visit');
      ok(state.errors.length === 0, state.errors.join('\n'));
      await shot(page, `phase-${name}-390`);
      await context.close();
    });
  }

  await check('first paint while syncing: an empty frame holds the timer’s place, no numbers', async () => {
    const { page, context, state } = await open({ serverAt: T - 3 * DAY, wait: false });
    state.reply = 'slow';
    state.delay = 4_000;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.cd-timer-wrap.is-pending', { timeout: 10_000 });
    ok(!/\d/.test(await page.$eval('.cd-cells', e => e.textContent)), 'no numbers');
    await shot(page, 'syncing-390');
    await context.close();
  });

  /* ───────────── Midnight, live ───────────── */
  await check('midnight live: each of the final ten seconds, one finite celebration, Welcome 2027, labelled replay, never twice', async () => {
    const { page, context, state } = await open({ serverAt: T - 12.5 * SEC });
    await waitStage(page, 'minute');
    const seen = [];
    for (let i = 0; i < 16; i++) {
      const n = await page.$eval('.cd-final-number', e => e.textContent).catch(() => null);
      if (n && seen[seen.length - 1] !== n) seen.push(n);
      if (n === '5') await shot(page, 'midnight-final-390');
      await page.clock.runFor(1_000);
    }
    ok(seen.join(',') === '10,9,8,7,6,5,4,3,2,1', `final seconds ${seen}`);
    ok(await page.waitForSelector('.cd-page[data-celebration="live"]', { timeout: 3_000 }).then(() => true, () => false), 'celebration plays');
    ok((await page.$$('.cd-spark')).length === 28, 'sparks drawn');
    await sleep(1_200);
    await shot(page, 'midnight-celebration-390');
    ok(/Welcome, 2027/.test(await page.textContent('h1')), 'Welcome title');
    // 3.7 final: a 22-second celebration (audioPlan.ts CELEBRATION_SECONDS).
    await page.clock.runFor(21_500);
    ok(!(await page.getAttribute('.cd-page', 'data-celebration')), 'the celebration ends by itself');
    ok(!(await page.$('.cd-spark')), 'sparks removed');
    ok((await stage(page)) === 'welcome', 'welcome');
    ok(/Happy New Year! Welcome to 2027\./.test(await page.textContent('.cd-sr[aria-live]')), 'announced once');
    // Foreground returns, reconnects and a minute of time never bring it back.
    for (let i = 0; i < 3; i++) { await visibility(page, 'hidden'); await visibility(page, 'visible'); await page.evaluate(() => window.dispatchEvent(new Event('online'))); }
    await page.clock.runFor(60_000);
    ok(!(await page.getAttribute('.cd-page', 'data-celebration')), 'not repeated');
    await page.getByRole('button', { name: 'Replay midnight' }).focus();
    await page.keyboard.press('Enter');
    ok((await page.getAttribute('.cd-page', 'data-celebration')) === 'replay', 'replay plays on request');
    ok((await page.evaluate(() => document.activeElement.textContent)) === 'Replay midnight', 'keyboard focus stays on Replay while it plays');
    ok((await page.textContent('.cd-replay-note')) === 'Replay · not live', 'and says it is not live');
    await shot(page, 'midnight-replay-390');
    ok(state.calls <= 2, `${state.calls} time requests across midnight`);
    ok(state.errors.length === 0, state.errors.join('\n'));
    await context.close();
  });

  await check('opened just after midnight: a calm welcome, never the live celebration', async () => {
    const { page, context } = await open({ serverAt: T + 20 * SEC });
    await waitStage(page, 'welcome');
    for (let i = 0; i < 5; i++) { ok(!(await page.getAttribute('.cd-page', 'data-celebration')), 'no celebration'); await page.clock.runFor(1_000); }
    ok(/New Year’s Day · 2027/.test(await page.textContent('.cd-kicker')), 'kicker');
    await context.close();
  });

  await check('opened days later: the real Ghana date; from 8 January commemorative with nothing to share', async () => {
    const a = await open({ serverAt: Date.parse('2027-01-03T15:00:00Z') });
    await waitStage(a.page, 'welcome');
    ok((await a.page.textContent('.cd-kicker')) === '3 January 2027', 'kicker');
    await a.context.close();
    const b = await open({ serverAt: Date.parse('2027-01-08T00:00:01Z') });
    await waitStage(b.page, 'commemorative');
    ok(!(await b.page.$('text=Copy link')), 'no sharing');
    ok(/Welcome to a beautiful 2027/.test(await b.page.title()), 'title');
    await b.context.close();
  });

  await check('reduced motion: no burst, a short quiet moment, everything still and readable', async () => {
    const { page, context } = await open({ serverAt: T - 3 * SEC, reduced: true });
    await waitStage(page, 'final');
    ok((await page.getAttribute('.cd-page', 'data-motion')) === 'reduced', 'flag');
    await page.clock.runFor(3_200);
    ok(await page.waitForSelector('.cd-page[data-celebration="live"]', { timeout: 3_000 }).then(() => true, () => false), 'the moment is still marked');
    ok((await page.$$('.cd-spark, .cd-ray')).length === 0, 'no sparks or rays');
    const anim = await page.$$eval('.cd-page *', els => els.filter(e => getComputedStyle(e).animationName !== 'none').length);
    ok(anim === 0, `${anim} animated elements`);
    await shot(page, 'midnight-reduced-motion-390');
    // 3.7 final: a calm 6-second moment (CELEBRATION_REDUCED_SECONDS), with nothing moving.
    await page.clock.runFor(6_000);
    ok(!(await page.getAttribute('.cd-page', 'data-celebration')), 'short');
    await context.close();
  });

  /* ───────────── Time and network resilience ───────────── */
  await check('slow sync: an honest "still connecting" note, then the countdown', async () => {
    const { page, context, state } = await open({ serverAt: T - 3 * DAY, clock: false, wait: false });
    state.reply = 'slow';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Still connecting… your connection seems slow.', { timeout: 8_000 });
    ok(!/\d/.test(await page.$eval('.cd-cells', e => e.textContent)), 'an empty frame, no numbers before the server answers');
    await waitStage(page, 'days', 12_000);
    await context.close();
  });

  await check('failed sync: says so, offers Try again, never guesses from the device clock', async () => {
    const { page, context, state } = await open({ serverAt: T - 3 * DAY, wait: false });
    state.reply = 'fail';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[role="alert"]', { timeout: 15_000 });
    ok(/We can’t synchronise the countdown right now\./.test(await page.textContent('[role="alert"]')), 'message');
    ok(!(await page.$('.cd-cell')), 'no invented countdown');
    await shot(page, 'unavailable-390');
    state.reply = 'ok';
    await page.getByRole('button', { name: 'Try again' }).click();
    await waitStage(page, 'days');
    await context.close();
  });

  await check('offline after one good answer: it keeps counting accurately; reconnecting asks nothing extra', async () => {
    const { page, context, state } = await open({ serverAt: T - 2 * HOUR });
    await waitStage(page, 'eve');
    state.reply = 'abort';
    await context.setOffline(true);
    await page.clock.runFor(61 * MIN);
    ok((await stage(page)) === 'hour', 'moved into the final hour while offline');
    const cells = await page.$$eval('.cd-cell', els => els.map(e => e.textContent));
    ok(cells[0].startsWith('58') || cells[0].startsWith('59'), `cells ${cells}`);
    ok(!(await page.$('[role="alert"]')), 'no error while it can count');
    await context.setOffline(false);
    state.reply = 'ok';
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.clock.runFor(2_000);
    ok(state.calls <= 4, `${state.calls} requests`);
    await context.close();
  });

  await check('foreground: quick switches ask nothing; back after a while asks once; the count is right at once', async () => {
    const { page, context, state } = await open({ serverAt: T - 3 * DAY });
    await waitStage(page, 'days');
    for (let i = 0; i < 10; i++) { await visibility(page, 'hidden'); await page.clock.runFor(2_000); await visibility(page, 'visible'); }
    ok(state.calls === 1, `${state.calls} requests after quick switches`);
    await visibility(page, 'hidden');
    await page.clock.fastForward(20 * MIN);
    await visibility(page, 'visible');
    await page.clock.runFor(500);
    ok(state.calls === 2, `${state.calls} requests after a long absence`);
    const secs = await page.$$eval('.cd-cell', els => els.map(e => e.textContent));
    ok(secs.length === 4, 'counting');
    await context.close();
  });

  await check('device clock changed while open: re-checked at once, and the count is the server’s again', async () => {
    const { page, context, state } = await open({ serverAt: T - 3 * DAY - 2 * HOUR - 30 * MIN });
    await waitStage(page, 'days');
    const before = await page.$$eval('.cd-cell', els => els.map(e => e.textContent).join(' '));
    await page.evaluate(() => { window.__notes = []; new MutationObserver(() => window.__notes.push(document.querySelector('.cd-when')?.textContent)).observe(document.querySelector('.cd-shell'), { subtree: true, childList: true, characterData: true }); });
    await page.clock.setSystemTime(new Date(WRONG_DEVICE_CLOCK.getTime() + 5 * HOUR));
    await page.clock.runFor(1_500);
    await sleep(700); // the re-check's round trip (real network time)
    await page.clock.runFor(1_000);
    const after = await page.$$eval('.cd-cell', els => els.map(e => e.textContent).join(' '));
    ok(before.split(' ').slice(0, 2).join(' ') === after.split(' ').slice(0, 2).join(' '), `days and hours unchanged: ${before} → ${after}`);
    ok((await page.evaluate(() => window.__notes)).includes('Re-checking the time…'), 'said it was re-checking');
    ok(state.calls === 2, `${state.calls} requests (one re-check)`);
    await context.close();
  });

  await check('rapid refreshes: one request per load, no error, no celebration', async () => {
    const { page, context, state } = await open({ serverAt: T - 30 * SEC, clock: false });
    for (let i = 0; i < 5; i++) { await page.reload({ waitUntil: 'domcontentloaded' }); await waitStage(page, 'minute'); }
    ok(state.calls === 6, `${state.calls} requests for 6 loads`);
    ok(state.errors.length === 0, state.errors.join('\n'));
    await context.close();
  });

  /* ───────────── Full screen, sound, sharing ───────────── */
  await check('full screen: enter, Escape leaves, focus returns', async () => {
    const { page, context } = await open({ serverAt: T - 5 * HOUR });
    await waitStage(page, 'eve');
    await page.getByRole('button', { name: 'Full screen' }).click();
    await page.waitForSelector('.cd-page[data-immersive]');
    let full = false;
    for (let i = 0; i < 30 && !full; i++) { full = await page.evaluate(() => Boolean(document.fullscreenElement)); if (!full) await sleep(100); }
    ok(full, 'browser full screen');
    ok(!(await page.$('.cd-actions')), 'only the countdown');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.cd-page:not([data-immersive])');
    await page.clock.runFor(50); // focus moves on the next frame
    for (let i = 0; i < 30 && full; i++) { full = await page.evaluate(() => Boolean(document.fullscreenElement)); if (full) await sleep(100); }
    ok(!full, 'browser full screen left');
    ok((await page.evaluate(() => document.activeElement && document.activeElement.textContent)) === 'Full screen', 'focus back on the button');
    await context.close();
  });

  await check('full screen unsupported (iPhone Safari): the quiet layout alone, tidy when rotated, with a clear way out', async () => {
    const { page, context } = await open({ serverAt: T - 5 * HOUR, init: () => { Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false }); Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: () => undefined }); } });
    await waitStage(page, 'eve');
    await page.getByRole('button', { name: 'Full screen' }).click();
    await page.waitForSelector('.cd-page[data-immersive]');
    ok(!(await page.evaluate(() => document.fullscreenElement)), 'no browser full screen');
    await shot(page, 'immersive-390');
    await page.setViewportSize({ width: 844, height: 390 });
    await sleep(300);
    ok(!(await overflow(page)), 'landscape: no overflow');
    const dial = await page.$eval('.cd-dial', e => e.getBoundingClientRect().toJSON());
    ok(dial.bottom <= 391 && dial.top >= 0, `landscape: dial on screen ${JSON.stringify(dial)}`);
    await shot(page, 'immersive-landscape-844');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Exit full screen' }).click();
    await page.waitForSelector('.cd-page:not([data-immersive])');
    await context.close();
  });

  await check('screen wake lock: held while immersive, asked again after an app switch, let go on exit', async () => {
    const { page, context } = await open({ serverAt: T - 5 * HOUR, init: () => {
      window.__locks = [];
      Object.defineProperty(navigator, 'wakeLock', { value: { request: async () => { const l = { released: false, release: async () => { l.released = true; } }; window.__locks.push(l); return l; } } });
    } });
    await waitStage(page, 'eve');
    await page.getByRole('button', { name: 'Full screen' }).click();
    let n = 0;
    for (let i = 0; i < 30 && n < 1; i++) { n = await page.evaluate(() => window.__locks.length); if (n < 1) await sleep(100); }
    ok(n === 1, `${n} locks on entering`);
    // The browser drops the lock when the page is hidden; on return it is asked for again.
    await page.evaluate(() => { window.__locks[0].released = true; });
    await visibility(page, 'hidden'); await visibility(page, 'visible');
    await sleep(200);
    ok((await page.evaluate(() => window.__locks.length)) === 2, 'asked again after the app switch');
    await page.getByRole('button', { name: 'Exit full screen' }).click();
    await sleep(200);
    ok(await page.evaluate(() => window.__locks.every(l => l.released)), 'let go on exit');
    await context.close();
  });

  // 3.7 final: piano recordings with a player (scripts/reviewCountdownFinal.cjs records the full experience).
  await check('sound: off by default; nothing downloaded until the tap; then one track and the countdown sounds', async () => {
    const { page, context, state } = await open({ serverAt: T - 30 * SEC });
    await waitStage(page, 'minute');
    ok(!(await page.$('.cd-player')), 'no player before the tap');
    await page.clock.runFor(3_000);
    ok(!state.requests.some(u => /countdown-audio/.test(u)), 'no audio before the tap');
    await page.getByRole('button', { name: 'Play music' }).click();
    await page.waitForSelector('.cd-player');
    await page.clock.runFor(35_000);
    const audio = state.requests.filter(u => /countdown-audio/.test(u));
    ok(audio.some(u => /final-minute\./.test(u)), 'the final-minute build');
    ok(audio.some(u => /ticks\./.test(u)) && audio.some(u => /midnight-fx\./.test(u)), 'the countdown sounds');
    ok(!audio.some(u => /silent-night|first-noel|away-in-a-manger/.test(u)), 'no Christmas tracks in the final minute');
    ok(state.errors.length === 0, state.errors.join('\n'));
    await context.close();
  });

  await check('sharing: copy link, blocked copy, WhatsApp link, native share; never a claim that it was sent', async () => {
    const a = await open({ serverAt: T - 3 * DAY, permissions: ['clipboard-read', 'clipboard-write'], ua: DESKTOP, width: 1440, height: 900 });
    await waitStage(a.page, 'days');
    ok(!(await a.page.$('button:has-text("Share")')) === !(await a.page.evaluate(() => typeof navigator.share === 'function')), 'native Share only where supported');
    await a.page.getByRole('button', { name: 'Copy link' }).click();
    await a.page.waitForSelector('text=Link copied.');
    ok((await a.page.evaluate(() => navigator.clipboard.readText())) === 'https://mysterybundlehub.com/countdown', 'clipboard');
    const wa = a.page.locator('a:has-text("WhatsApp")');
    const href = await wa.getAttribute('href');
    ok(href === `https://wa.me/?text=${encodeURIComponent('Counting down to 2027 with Mystery Hub! ✨\nAnother year, another chance to make beautiful memories. Let’s welcome 2027 together! 🥂💚\nhttps://mysterybundlehub.com/countdown')}`, href);
    ok((await wa.getAttribute('target')) === '_blank' && /noopener/.test(await wa.getAttribute('rel')), 'opens WhatsApp separately');
    ok(!/\bsent\b/i.test(await a.page.textContent('body')), 'no "sent"');
    await a.context.close();
    const b = await open({ serverAt: T - 3 * DAY, init: () => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } }); document.execCommand = () => false; } });
    await waitStage(b.page, 'days');
    await b.page.getByRole('button', { name: 'Copy link' }).click();
    await b.page.waitForSelector('text=This browser didn’t allow copying.');
    ok(/mysterybundlehub\.com\/countdown/.test(await b.page.textContent('.cd-share-note')), 'shows the link instead');
    await b.context.close();
    const c = await open({ serverAt: T + HOUR, init: () => { navigator.canShare = () => true; navigator.share = d => { window.__shared = d; return Promise.resolve(); }; } });
    await waitStage(c.page, 'welcome');
    await c.page.getByRole('button', { name: 'Share', exact: true }).click();
    const shared = await c.page.evaluate(() => window.__shared);
    ok(shared && shared.url === 'https://mysterybundlehub.com/countdown' && /Happy New Year!/.test(shared.text), JSON.stringify(shared));
    ok(!/\bsent\b|shared!/i.test(await c.page.textContent('body')), 'no claim after sharing');
    await c.context.close();
  });

  /* ───────────── Layout at every width ───────────── */
  const sizes = [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1280, 800], [1440, 900], [844, 390], [390, 600], [667, 375]];
  for (const [width, height] of sizes) {
    await check(`layout ${width}×${height}: no overflow, the countdown fits on screen, targets at least 44 px`, async () => {
      for (const [name, serverAt] of [['days', T - (34 * DAY + 5 * HOUR + 12 * MIN + 9 * SEC)], ['final', T - 7.4 * SEC], ['welcome', T + 3 * HOUR]]) {
        const { page, context } = await open({ serverAt, width, height, ua: width >= 1024 ? DESKTOP : ANDROID });
        await waitStage(page, name);
        await page.evaluate(() => document.fonts.ready);
        ok(!(await overflow(page)), `${name}: horizontal overflow`);
        const box = await page.evaluate(() => {
          const r = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; };
          return { dial: r('.cd-dial'), timer: r('.cd-cells'), h1: r('h1'), vh: innerHeight, vw: innerWidth };
        });
        ok(box.dial.top >= 0 && box.dial.bottom <= box.vh + 1 && box.dial.left >= 0 && box.dial.right <= box.vw + 1, `${name}: dial on screen ${JSON.stringify(box.dial)}`);
        if (box.timer) ok(box.timer.bottom <= box.vh + 1, `${name}: timer on screen (${Math.round(box.timer.bottom)} > ${box.vh})`);
        const small = await page.$$eval('.cd-page button, .cd-page a', els => els.filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 44 || r.width < 44); }).map(e => `${e.textContent.trim() || e.getAttribute('aria-label')} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`));
        ok(small.length === 0, `${name}: small targets ${small}`);
        await shot(page, `${name}-${width}x${height}`);
        await context.close();
      }
    });
  }

  /* ───────────── Accessibility ───────────── */
  if (AXE) {
    for (const [name, serverAt, reply] of [['days', T - 3 * DAY], ['final', T - 7.4 * SEC], ['welcome', T + HOUR], ['commemorative', Date.parse('2027-03-01T00:00:00Z')], ['unavailable', T, 'fail']]) {
      await check(`axe (WCAG 2.1 AA) on ${name}: no violations`, async () => {
        // axe schedules its own work on timers, so these pages keep a real (still wrong) device clock.
        const { page, context, state } = await open({ serverAt, wait: !reply, clock: false });
        if (reply) { state.reply = reply; await page.reload(); await page.waitForSelector('[role="alert"]', { timeout: 15_000 }); } else await waitStage(page, name);
        await page.evaluate(() => document.fonts.ready);
        await page.addScriptTag({ path: AXE });
        const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(x => `${x.id}: ${x.nodes.length} (${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join('; ')})`));
        ok(v.length === 0, v.join('\n'));
        await context.close();
      });
    }
    // 3.7 final: the player, open (its More panel and credits too), on a phone and a desktop.
    for (const [label, width, height, ua] of [['phone', 390, 844, ANDROID], ['desktop', 1440, 900, DESKTOP]]) {
      await check(`axe (WCAG 2.1 AA) on the open music player (${label}): no violations`, async () => {
        const { page, context } = await open({ serverAt: T - 3 * DAY, clock: false, ua, width, height });
        await waitStage(page, 'days');
        await page.getByRole('button', { name: 'Play music' }).click();
        await page.waitForSelector('.cd-player');
        const more = page.getByRole('button', { name: 'More sound controls' });
        if (await more.isVisible()) await more.click();
        await page.click('.cd-credits summary');
        await page.addScriptTag({ path: AXE });
        const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(x => `${x.id}: ${x.nodes.length} (${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join('; ')})`));
        ok(v.length === 0, v.join('\n'));
        await context.close();
      });
    }
  } else notes.push('axe not run (COUNTDOWN_REVIEW_AXE not set)');

  await check('keyboard: every control reachable in order, visible focus, no traps', async () => {
    const { page, context } = await open({ serverAt: T - 3 * DAY, ua: DESKTOP, width: 1280, height: 800 });
    await waitStage(page, 'days');
    const order = [];
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Tab');
      order.push(await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const o = getComputedStyle(e).outlineStyle; return `${(e.textContent || e.getAttribute('aria-label') || '').trim()}|${o}`; }));
    }
    ok(order.filter(Boolean).length >= 6, 'focus moves through the page and back out (no trap)');
    order.splice(0, order.length, ...order.filter(Boolean));
    const names = order.map(s => s.split('|')[0]);
    ok(names[0] === 'Mystery Hub' && names.includes('Copy link') && names.includes('Visit Mystery Hub'), names.join(', '));
    ok(order.every(s => s.split('|')[1] !== 'none'), `focus outline: ${order}`);
    await context.close();
  });

  /* ───────────── Discovery and the embedded Greetings card ───────────── */
  await check('discovery: the New Year homepage preview (27 December) links to /countdown; Christmas Day does not', async () => {
    for (const [date, expected] of [['2026-12-27', 'Watch the countdown to 2027'], ['2026-12-31', 'Join the countdown to midnight'], ['2026-12-25', null]]) {
      const { page, context } = await open({ path: `/?season-preview=christmas-2026&season-date=${date}`, clock: false, wait: false, width: 390, height: 844 });
      await page.waitForSelector('.xh-hero, [data-season]', { timeout: 20_000 }).catch(() => undefined);
      await sleep(1_500);
      const link = await page.$('.xh-hero-countdown');
      if (expected === null) ok(!link, `${date}: no countdown link at Christmas`);
      else {
        ok(link, `${date}: link shown`);
        ok((await link.getAttribute('href')) === '/countdown' && (await link.textContent()).includes(expected), `${date}: ${await link.textContent()}`);
        if (date === '2026-12-27') await shot(page, 'discovery-home-2026-12-27-390');
      }
      await context.close();
    }
  });

  await check('embedded Greetings: the New Year card still counts, and links to the full countdown', async () => {
    const id = 'SyntheticReviewGreetin01';
    const { page, context } = await open({ path: `/g/${id}`, clock: false, wait: false, reduced: true, serverAt: T - 3 * DAY - 4 * HOUR });
    await page.route(`**/api/experiences/greetings/${id}`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schemaVersion: 1, shareId: id, occasion: 'new-year-2027', recipientName: 'Ama', senderName: 'Kojo', message: 'Happy New Year! Synthetic review greeting.', variant: 'gift-starlight-v1', expiresAt: '2027-02-01T00:00:00.000Z' }) }));
    await page.route('**/api/seasonal/status', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ active: false, scheduledPack: null, greetings: { state: 'coming-soon' }, serverTime: new Date().toISOString() }) }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.click('.mg-gift-button', { timeout: 15_000 });
    await page.waitForSelector('.mg-countdown-grid', { timeout: 15_000 });
    ok(/Until 2027/.test(await page.textContent('.mg-countdown')), 'card');
    const cells = await page.$$eval('.mg-countdown-cell b', els => els.map(e => e.textContent));
    ok(cells.length === 4 && cells[0] === '03', `cells ${cells}`);
    await shot(page, 'greetings-embedded-390');
    await page.click('a.mg-countdown-link');
    await page.waitForURL('**/countdown');
    await waitStage(page, 'days');
    await context.close();
  });

  /* ───────────── Network and performance (lab, emulated mid-range phone) ───────────── */
  await check('network: /countdown never downloads the commerce app, its account code or Paystack', async () => {
    const { page, context, state } = await open({ serverAt: T - 3 * DAY, clock: false });
    await waitStage(page, 'days');
    await sleep(1_500);
    const assets = state.requests.filter(u => u.startsWith(BASE + '/assets/'));
    const banned = assets.filter(u => /\/(App|AppContext|usePaystack|AppLandingPage)-/.test(u));
    ok(banned.length === 0, banned.join('\n'));
    ok(assets.some(u => /CountdownPage-/.test(u)), 'its own chunk');
    const apis = state.requests.filter(u => u.includes('/api/')).map(u => new URL(u).pathname);
    ok(apis.every(p => ['/api/experiences/countdown', '/api/experiences/events', '/api/analytics/events', '/api/analytics/track'].includes(p) || p.startsWith('/api/analytics/')), apis.join(', '));
    const dist = path.join(__dirname, '../dist/assets');
    const gz = f => fs.existsSync(path.join(dist, f)) ? zlib.gzipSync(fs.readFileSync(path.join(dist, f))).length : 0;
    const files = assets.map(u => path.basename(new URL(u).pathname));
    const js = files.filter(f => f.endsWith('.js')), css = files.filter(f => f.endsWith('.css'));
    notes.push(`/countdown assets: ${js.length} JS (${(js.reduce((s, f) => s + gz(f), 0) / 1024).toFixed(1)} KB gzip), ${css.length} CSS (${(css.reduce((s, f) => s + gz(f), 0) / 1024).toFixed(1)} KB gzip): ${files.join(', ')}`);
    ok(state.analytics.every(u => !/[?&](email|phone|name)=/i.test(u)), 'nothing personal in analytics');
    await context.close();
  });

  await check('performance: 4× CPU slowdown on a slow connection; first paint, stability and per-second work', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: ANDROID, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    if (MARK) await page.route('https://res.cloudinary.com/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(MARK) }));
    await page.route('**/api/analytics/**', r => r.fulfill({ status: 204, body: '' }));
    await page.route('**/api/experiences/events', r => r.fulfill({ status: 503, body: '{}' }));
    const start = Date.now();
    await page.route('**/api/experiences/countdown', r => { const now = T - 3 * DAY + (Date.now() - start); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schemaVersion: 1, timeZone: 'Africa/Accra', target: '2027-01-01T00:00:00.000Z', serverTime: new Date(now).toISOString(), remainingMs: T - now, passed: false }) }); });
    await page.addInitScript(() => {
      window.__perf = { cls: 0, lcp: 0, long: [] };
      new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true });
    });
    await page.goto(BASE + '/countdown', { waitUntil: 'load' });
    await waitStage(page, 'days', 30_000);
    const counting = await page.evaluate(() => performance.now());
    await sleep(6_000);
    const m = await page.evaluate(counting => ({ fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0), lcp: Math.round(window.__perf.lcp), cls: window.__perf.cls, longAfter: window.__perf.long.filter(([s]) => s > counting + 500), longAll: window.__perf.long, counting: Math.round(counting) }), counting);
    notes.push(`lab performance (390 px, 4× CPU, 1.6 Mbps/150 ms): FCP ${m.fcp} ms, LCP ${m.lcp} ms, countdown showing at ${m.counting} ms, CLS ${m.cls.toFixed(3)}, long tasks while loading ${JSON.stringify(m.longAll)}, while ticking ${JSON.stringify(m.longAfter)}`);
    ok(m.cls < 0.1, `CLS ${m.cls}`);
    ok(m.longAfter.length === 0, `long tasks while ticking ${JSON.stringify(m.longAfter)}`);
    await context.close();
  });

  await browser.close();
  const failed = results.filter(([pass]) => !pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  for (const n of notes) console.log(`NOTE  ${n}`);
  process.exitCode = failed.length ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
