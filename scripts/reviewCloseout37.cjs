/*
 * Mystery Hub 3.7 closeout: real-browser checks for the Welcome Offer placement, layout stability and the Countdown's
 * sound. LOCAL ONLY: a production build served on loopback, its /api proxied to a local in-memory API (never
 * production), synthetic accounts only. No payment is started and nothing is sent.
 *
 *   PORT=3911 DISABLE_HMR=true npx tsx server.ts          # local in-memory API (no DATABASE_URL)
 *   npx vite build && node scripts/reviewCloseout37.cjs
 *
 *   CLOSEOUT_DIST   build folder (default dist)       CLOSEOUT_API  local API (default http://localhost:3911)
 *   CLOSEOUT_OUT    screenshots folder (default /tmp/mh-closeout-37)
 *   CLOSEOUT_SOUND  optional path: also render a WAV preview of the Countdown's sound there
 *
 * Browser emulation, not physical-device testing. Exit code 1 if any check fails.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIST = path.resolve(process.env.CLOSEOUT_DIST || 'dist');
const API = (process.env.CLOSEOUT_API || 'http://localhost:3911').replace(/\/$/, '');
const OUT = process.env.CLOSEOUT_OUT || '/tmp/mh-closeout-37';
const PORT = 4380, BASE = `http://localhost:${PORT}`;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API)) throw new Error('Refusing a non-loopback API.');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

const results = [];
async function check(name, fn) {
  try { await fn(); results.push([true, name]); console.log(`PASS  ${name}`); }
  catch (e) {
    results.push([false, name]); console.log(`FAIL  ${name}\n      ${String(e && e.stack || e).split('\n').slice(0, 3).join('\n      ')}`); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* A static server for the build, with /api proxied to the local API. `quoteDelay` holds back the welcome-offer quote,
   so the offer arrives late (the worst case for layout stability). */
let quoteDelay = 0, quoteOffer = null; // quoteOffer: fields laid over the server's offer answer (e.g. a used offer)
const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
  if (url.pathname.startsWith('/api/')) {
    if (req.method === 'POST' && /^\/api\/(analytics|experiences)\/events/.test(url.pathname)) { req.resume(); res.writeHead(204); return res.end(); }
    const chunks = []; req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      if (url.pathname.startsWith('/api/commercial/quote/') && quoteDelay) await sleep(quoteDelay);
      const headers = { ...req.headers, host: new URL(API).host }; delete headers['accept-encoding'];
      const rewrite = url.pathname.startsWith('/api/commercial/quote/') && quoteOffer;
      const up = http.request(API + req.url, { method: req.method, headers }, r => {
        if (!rewrite) { res.writeHead(r.statusCode, r.headers); return r.pipe(res); }
        const parts = []; r.on('data', c => parts.push(c));
        r.on('end', () => {
          const body = JSON.parse(Buffer.concat(parts).toString() || '{}'); if (body.offer) Object.assign(body.offer, quoteOffer);
          const out = JSON.stringify(body); const h = { ...r.headers, 'content-length': Buffer.byteLength(out) }; res.writeHead(r.statusCode, h); res.end(out);
        });
      });
      up.on('error', () => { res.writeHead(502); res.end(); }); up.end(Buffer.concat(chunks));
    });
    return;
  }
  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(fs.readFileSync(file));
});

async function signUp(name) {
  const phone = '024' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-7);
  const res = await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, phone, password: 'closeout-Lab-37!' }) });
  const body = await res.json(); if (!body.token) throw new Error('signup failed ' + JSON.stringify(body).slice(0, 160));
  return body;
}

const SHIFTS = () => { window.__shifts = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__shifts.push({ t: Math.round(e.startTime), v: e.value, from: (e.sources || []).map(s => s.node && (s.node.className || s.node.nodeName)).slice(0, 3) }); })).observe({ type: 'layout-shift', buffered: true }); } catch { /* unsupported */ } };

let browser;
async function open({ width = 390, height = 844, member = null, path: route = '/', block = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await context.addInitScript(SHIFTS);
  // Remote images are out of scope (Cloudinary is blocked in this sandbox): answer them empty, instantly.
  if (block) await context.route(/res\.cloudinary\.com|paystack/, r => r.fulfill({ status: 204, body: '' }));
  if (member) await context.addInitScript(([t, u]) => { localStorage.setItem('mystery_hub_session_token', t); localStorage.setItem('mystery_hub_user', u); }, [member.token, JSON.stringify(member.user)]);
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  return { page, context, errors };
}
const shiftTotal = page => page.evaluate(() => window.__shifts.reduce((s, e) => s + e.v, 0));
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  browser = await chromium.launch();
  const newMember = await signUp('Ama Closeout');

  for (const width of [320, 360, 390, 430, 768, 1280]) {
    await check(`Data, guest, ${width}px: the offer fills the fixed line under the title; nothing moves`, async () => {
      quoteDelay = 1500;
      const { page, context, errors } = await open({ width, height: width > 700 ? 900 : 760, path: '/data' });
      const slot = page.locator('.mh-ds-offer-slot');
      await slot.waitFor();
      await page.waitForSelector('.mh-ds-tile');
      const before = await page.evaluate(() => ({ slot: document.querySelector('.mh-ds-offer-slot').getBoundingClientRect().height, hero: document.querySelector('.mh-ds-hero').getBoundingClientRect().height, text: document.querySelector('.mh-ds-offer-slot').textContent }));
      await page.waitForSelector('.mh-ds-offer-slot .mh-wa-line', { timeout: 8000 });
      await sleep(300);
      const after = await page.evaluate(() => ({ slot: document.querySelector('.mh-ds-offer-slot').getBoundingClientRect().height, hero: document.querySelector('.mh-ds-hero').getBoundingClientRect().height, text: document.querySelector('.mh-ds-offer-slot').textContent, line: (() => { const e = document.querySelector('.mh-wa-text'); return e.scrollWidth - e.clientWidth; })() }));
      ok(/Total shown before you pay/.test(before.text), 'before the answer: the reassurance holds the line: ' + before.text);
      ok(/Up to 18% off your first bundle/.test(after.text), after.text);
      // Phones say "sign up", wider screens "create a free account": the action is always named on screen.
      const action = await page.evaluate(() => document.querySelector('.mh-wa-text').innerText);
      ok(width < 640 ? /· sign up$/.test(action.trim()) : /· create a free account$/.test(action.trim()), 'action shown: ' + action);
      ok(before.slot === 28 && after.slot === 28 && before.hero === after.hero, JSON.stringify({ before, after }));
      ok(after.line <= 0, 'the offer line is not cut off: ' + JSON.stringify(await page.evaluate(() => { const e = document.querySelector('.mh-wa-text'), l = document.querySelector('.mh-wa-line'); return { need: e.scrollWidth, have: e.clientWidth, line: l.getBoundingClientRect().width, slot: document.querySelector('.mh-ds-offer-slot').clientWidth }; })));
      const cls = await shiftTotal(page);
      ok(cls < 0.01, 'layout shift ' + cls.toFixed(4) + ' ' + JSON.stringify(await page.evaluate(() => window.__shifts)));
      ok(await overflow(page) <= 0, 'horizontal overflow');
      ok(errors.length === 0, errors.join('\n'));
      await page.locator('.mh-ds-hero').screenshot({ path: path.join(OUT, `data-guest-${width}.png`) });
      if (width === 390) {
        // The pill is 28px tall; its tappable area reaches 44px (a tap 7.5px above or below it still opens signup).
        const hit = await page.evaluate(() => { const b = document.querySelector('.mh-wa-line').getBoundingClientRect(), x = b.left + b.width / 2;
          return [b.top - 7.5, b.bottom + 7.5].map(y => { const e = document.elementFromPoint(x, y); return e?.closest('.mh-wa-line') ? 1 : String(e && (e.className || e.tagName)).slice(0, 60); }); });
        ok(hit.join() === '1,1', 'the tappable area reaches 44px: ' + hit);
        await page.locator('.mh-wa-line').click();
        await page.waitForSelector('[role="dialog"]', { timeout: 4000 });
      }
      await context.close();
    });
  }

  for (const width of [320, 360]) {
    await check(`Data, eligible new member, ${width}px: "Ready: up to 18% off your first bundle", whole, same line height`, async () => {
      quoteDelay = 1200;
      const { page, context } = await open({ width, height: 740, path: '/data', member: newMember });
      await page.waitForSelector('.mh-ds-offer-slot .mh-wa-line', { timeout: 10000 });
      const text = await page.textContent('.mh-ds-offer-slot');
      ok(/Ready: up to 18% off your first bundle/.test(text), text);
      const seen = await page.evaluate(() => { const e = document.querySelector('.mh-wa-text'); return { cut: e.scrollWidth - e.clientWidth, ready: document.querySelector('.mh-wa-ready').getBoundingClientRect().width, h: document.querySelector('.mh-ds-offer-slot').getBoundingClientRect().height }; });
      ok(seen.cut <= 0, 'cut off: ' + JSON.stringify(seen));
      // Below 400px the tick says "ready" and the word itself is for screen readers only, so the line fits whole.
      ok(width < 400 ? seen.ready <= 1 : seen.ready > 10, '"Ready:" visible width ' + seen.ready);
      ok(seen.h === 28, 'height');
      const cls = await shiftTotal(page); ok(cls < 0.01, 'cls ' + cls);
      await page.locator('.mh-ds-hero').screenshot({ path: path.join(OUT, `data-eligible-${width}.png`) });
      await context.close();
    });
  }

  for (const width of [360, 1280]) {
    await check(`Home, guest, ${width}px: the Welcome Offer card fills its kept room`, async () => {
      quoteDelay = 1500;
      const { page, context, errors } = await open({ width, height: width > 700 ? 900 : 760 });
      await page.waitForSelector('.home-welcome-slot');
      const room = await page.evaluate(() => document.querySelector('.home-welcome-slot').getBoundingClientRect().height);
      await page.waitForSelector('.home-welcome-slot .mh-wa-card', { timeout: 10000 });
      await sleep(300);
      const card = await page.evaluate(() => ({ slot: document.querySelector('.home-welcome-slot').getBoundingClientRect().height, card: document.querySelector('.mh-wa-card').getBoundingClientRect().height, text: document.querySelector('.mh-wa-card').innerText }));
      ok(/UP TO 18% OFF/i.test(card.text) && /For new customers/.test(card.text) && /Create a free account/.test(card.text), card.text);
      ok(card.slot === room, `the room kept (${room}) is the room used (${card.slot}); card ${card.card}`);
      ok(await page.evaluate(() => !document.querySelector('.home-welcome-slot').hasAttribute('data-reserve')), 'the room is let go once the server has answered');
      // December: with the combined line, the card still fits the taller room (200px) held for it.
      const tall = await page.evaluate(() => { const c = document.querySelector('.mh-wa-card'), p = document.createElement('p'); p.className = 'mh-wa-combined'; p.textContent = 'Up to 27% with the December Special';
        c.querySelector('.mh-wa-big').after(p); const h = c.getBoundingClientRect().height; p.remove(); return h; });
      ok(tall === 200, 'December card ' + tall + 'px against 200px held');
      const shifts = await page.evaluate(() => window.__shifts.filter(s => s.from.some(f => /home-bundle|home-buy|home-section|home-welcome/.test(String(f)))));
      ok(shifts.length === 0, JSON.stringify(shifts));
      ok(await overflow(page) <= 0, 'overflow');
      ok(errors.length === 0, errors.join('\n'));
      await page.locator('.home-bundles').screenshot({ path: path.join(OUT, `home-guest-${width}.png`) });
      await context.close();
    });
  }

  for (const width of [320, 390]) {
    await check(`Member home, new member, ${width}px: the chip joins the "Start here" row without moving it`, async () => {
      quoteDelay = 1500;
      const { page, context } = await open({ width, height: 760, member: newMember });
      await page.waitForSelector('.member-first .member-order-head');
      const before = await page.evaluate(() => document.querySelector('.member-first .member-order-head').getBoundingClientRect().height);
      await page.waitForSelector('.member-first .mh-wa-chip', { timeout: 10000 });
      await sleep(300);
      const after = await page.evaluate(() => ({ h: document.querySelector('.member-first .member-order-head').getBoundingClientRect().height, text: document.querySelector('.mh-wa-chip').textContent }));
      ok(after.h === before, `row ${before} -> ${after.h}`);
      ok(/Up to 18% off/.test(after.text), after.text);
      ok(await page.isVisible('text=Welcome! Let’s get you connected.'), 'the short welcome line');
      const shifts = await page.evaluate(() => window.__shifts.filter(s => s.t > 0 && s.from.some(f => /member-first|member-order|member-services/.test(String(f)))));
      ok(shifts.length === 0, JSON.stringify(shifts));
      await page.locator('.member-home-primary').screenshot({ path: path.join(OUT, `member-first-${width}.png`) });
      await context.close();
    });
  }

  for (const state of ['redeemed', 'previous_buyer']) {
    await check(`Customer whose offer is ${state}: nothing advertised on Data or Home, no empty room left`, async () => {
      quoteDelay = 0; quoteOffer = { state };
      try {
        const data = await open({ width: 360, height: 740, path: '/data', member: newMember });
        await data.page.waitForSelector('.mh-ds-tile'); await sleep(2500);
        ok(!(await data.page.$('.mh-wa')), 'no advert on Data'); ok(/Total shown before you pay/.test(await data.page.textContent('.mh-ds-offer-slot')), 'reassurance');
        await data.context.close();
        const home = await open({ width: 360, height: 760, member: newMember });
        await home.page.waitForSelector('.member-first .member-order-head', { timeout: 10000 }); await sleep(2500);
        ok(!(await home.page.$('.mh-wa')), 'no chip on the member homepage');
        await home.context.close();
      } finally { quoteOffer = null; }
    });
  }

  await check('Guest, Welcome Offer switched off: the homepage room closes once the server answers (no empty box)', async () => {
    quoteDelay = 800; quoteOffer = { enabled: false };
    try {
      const { page, context } = await open({ width: 1280, height: 900 });
      await page.waitForSelector('.home-welcome-slot');
      await page.waitForFunction(() => !document.querySelector('.home-welcome-slot')?.hasAttribute('data-reserve'), null, { timeout: 10000 });
      await sleep(200);
      const slot = await page.evaluate(() => { const e = document.querySelector('.home-welcome-slot'); return { h: e.getBoundingClientRect().height, display: getComputedStyle(e).display }; });
      ok(slot.display === 'none' || slot.h === 0, JSON.stringify(slot));
      ok(!(await page.$('.mh-wa')), 'nothing advertised');
      await context.close();
    } finally { quoteOffer = null; }
  });

  await check('Countdown: Sound on starts the music only on the tap, Music toggles it, hidden pauses, leaving closes', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      const Real = window.AudioContext; window.__ctx = [];
      window.AudioContext = class extends Real { constructor(...a) { super(...a); window.__ctx.push(this); } };
    });
    const page = await context.newPage();
    const requests = []; page.on('request', r => requests.push(r.url()));
    await page.goto(BASE + '/countdown');
    await page.waitForSelector('button:has-text("Sound off")');
    ok((await page.evaluate(() => window.__ctx.length)) === 0, 'no audio before the tap');
    ok(!requests.some(u => /score-[\w-]+\.js/.test(u)), 'music code not loaded before the tap');
    ok(!(await page.$('button:has-text("Music")')), 'no Music control while sound is off');
    await page.click('button:has-text("Sound off")');
    await page.waitForSelector('button:has-text("Sound on")');
    await page.waitForSelector('text=Music on. Midnight has its own sounds.');
    await sleep(800);
    ok(requests.some(u => /score-[\w-]+\.js/.test(u)), 'music code fetched on the tap: ' + requests.filter(u => /assets/.test(u)).slice(-4).join(' '));
    ok((await page.evaluate(() => window.__ctx[0].state)) === 'running', 'running');
    const music = page.locator('button:has-text("Music on")');
    ok((await music.getAttribute('aria-pressed')) === 'true', 'music pressed');
    await music.click();
    await page.waitForSelector('text=Music off. Countdown sounds stay on.');
    await page.click('button:has-text("Music off")');
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(300);
    ok((await page.evaluate(() => window.__ctx[0].state)) === 'suspended', 'hidden: suspended');
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(300);
    ok((await page.evaluate(() => window.__ctx[0].state)) === 'running', 'visible again: running');
    await page.screenshot({ path: path.join(OUT, 'countdown-sound-on-390.png') });
    await page.click('button:has-text("Sound on")');
    await sleep(200);
    ok((await page.evaluate(() => window.__ctx[0].state)) === 'suspended', 'sound off: suspended');
    ok(!(await page.$('button:has-text("Music")')), 'Music control gone');
    await page.click('a:has-text("Visit Mystery Hub")');
    await page.waitForURL(BASE + '/');
    await context.close();
  });

  if (process.env.CLOSEOUT_SOUND) await check('Countdown sound: an offline render is comfortable (no clipping, gentle level)', async () => {
    // The real score and voices, bundled for the page, rendered offline: 24 s calm, 16 s of the final minute's build,
    // the final ten seconds and 9 s of midnight.
    const bundle = path.join(OUT, 'sound-bundle.js');
    const entry = path.join(OUT, 'sound-entry.ts');
    fs.writeFileSync(entry, `export * from '${path.resolve('src/countdown/score')}';\nexport * from '${path.resolve('src/countdown/voices')}';\n`);
    execFileSync('npx', ['esbuild', entry, '--bundle', '--format=iife', '--global-name=Score', `--outfile=${bundle}`], { stdio: 'ignore' });
    const page = await browser.newPage();
    await page.setContent('<p>render</p>');
    await page.addScriptTag({ content: fs.readFileSync(bundle, 'utf8') });
    const result = await page.evaluate(async () => {
      const rate = 24000, seconds = 60, ctx = new OfflineAudioContext(1, rate * seconds, rate);
      const master = ctx.createGain(); master.gain.value = 0.55;
      const limit = ctx.createDynamicsCompressor(); limit.threshold.value = -18; limit.ratio.value = 4; limit.attack.value = 0.01; limit.release.value = 0.3;
      master.connect(limit).connect(ctx.destination);
      let tick = null;
      const score = Score.startScore(ctx, master, 'calm', Score.seeded(2027), fn => { tick = fn; return 1; }, () => {});
      const at = (t, fn) => ctx.suspend(t).then(() => { fn(); return ctx.resume(); });
      for (let t = 0.25; t < seconds; t += 0.25) {
        at(t, () => {
          if (Math.abs(t - 24) < 0.01) score.setMood('minute', 0.2);
          if (t > 24 && t < 40 && Math.abs(t % 2) < 0.01) score.setMood('minute', 0.2 + (t - 24) / 20);
          if (Math.abs(t - 40) < 0.01) score.setMood('final');
          if (t >= 40 && t < 50 && Math.abs(t % 1) < 0.01) { const left = 50 - t, midi = [60, 62, 65, 67, 69, 72, 74, 77, 79, 81][Math.min(9, 10 - Math.round(left))]; Score.piano(ctx, master, midi, ctx.currentTime + 0.01, left <= 1 ? 0.2 : 0.15, left <= 1 ? 2.2 : 1.1); }
          if (Math.abs(t - 50) < 0.01) { score.celebrate(); [698.5, 880, 1046.5, 1396.9].forEach((f, i) => Score.bell(ctx, master, f, ctx.currentTime + i * 0.11, 3.4, 0.085)); }
          tick && tick();
        });
      }
      const out = await ctx.startRendering(), data = out.getChannelData(0);
      let peak = 0, sum = 0, silent = 0, windows = [];
      for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); peak = Math.max(peak, a); sum += data[i] * data[i]; }
      for (let w = 0; w < seconds; w++) { let s = 0; for (let i = w * rate; i < (w + 1) * rate; i++) s += data[i] * data[i]; const rms = Math.sqrt(s / rate); windows.push(+(20 * Math.log10(rms + 1e-9)).toFixed(1)); if (rms < 0.001) silent++; }
      // 16-bit WAV, for the founder to listen to.
      const bytes = new DataView(new ArrayBuffer(44 + data.length * 2));
      const str = (o, s) => [...s].forEach((c, i) => bytes.setUint8(o + i, c.charCodeAt(0)));
      str(0, 'RIFF'); bytes.setUint32(4, 36 + data.length * 2, true); str(8, 'WAVEfmt '); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true);
      bytes.setUint32(24, rate, true); bytes.setUint32(28, rate * 2, true); bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true); str(36, 'data'); bytes.setUint32(40, data.length * 2, true);
      for (let i = 0; i < data.length; i++) bytes.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 32767, true);
      let binary = ''; const u8 = new Uint8Array(bytes.buffer); for (let i = 0; i < u8.length; i += 32768) binary += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
      return { peak, rmsDb: +(20 * Math.log10(Math.sqrt(sum / data.length))).toFixed(1), silent, windows, wav: btoa(binary) };
    });
    fs.writeFileSync(process.env.CLOSEOUT_SOUND, Buffer.from(result.wav, 'base64'));
    console.log(`      peak ${result.peak.toFixed(3)}, overall ${result.rmsDb} dBFS, silent seconds ${result.silent}; per second: ${result.windows.join(' ')}`);
    ok(result.peak < 0.9, 'no clipping'); ok(result.rmsDb < -16 && result.rmsDb > -42, 'gentle, but audible');
    ok(result.silent <= 2, 'no long silence (the old sound was silent between the chime and the final ticks)');
    await page.close();
  });

  await browser.close(); server.close();
  const failed = results.filter(r => !r[0]);
  console.log(`\n${results.length - failed.length}/${results.length} passed. Screenshots: ${OUT}`);
  process.exitCode = failed.length ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
