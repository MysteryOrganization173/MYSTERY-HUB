/*
 * Mystery Hub 3.7.3 Performance & Mobile: repeatable LOCAL laboratory measurements. Not field data.
 *
 * Serves a production build (`npm run build`) the way the web service does (hashed assets immutable, HTML no-store),
 * over HTTP/2 and Brotli-compressed like the live hosts (a throwaway self-signed certificate for localhost), and
 * forwards /api to a LOCAL API server started with no database (its in-memory store), e.g.:
 *
 *   PORT=3911 DISABLE_HMR=true SEASONAL_EXPERIENCE=christmas-2026 npx tsx server.ts      # loopback only, no DATABASE_URL
 *   PERF_DIST=dist PERF_RUNS=5 node scripts/reviewPerformance373.cjs
 *
 * Every run is a fresh browser context (cold cache) on the same emulated phone: 390 × 844, 4× CPU slowdown, 150 ms
 * round trip, 1.6 Mbit/s down, 750 kbit/s up (the conditions the 3.6.4 Grand Finale used). Google Fonts is reached for
 * real through the same throttle. Hosts this sandbox cannot reach (Cloudinary images, Paystack's script) are blocked
 * before they leave the browser and counted separately, so image bytes are NOT part of the totals.
 *
 * The seasonal pages need the Christmas pack scheduled on the local API (SEASONAL_EXPERIENCE above). Those runs move
 * the page's Date and the API's clock answer to the same December day (timers and performance clocks untouched), so
 * the page is in season exactly as a visitor's would be, with no clock correction involved.
 *
 *   PERF_DIST     build folder to serve (default dist)
 *   PERF_API      local API origin (default http://localhost:3911, must be loopback)
 *   PERF_RUNS     runs per page (default 5); the median is reported
 *   PERF_PAGES    optional regular expression selecting page ids
 *   PERF_OUT      JSON results file (default /tmp/mh-perf-373.json)
 *   PERF_PORT     port for the build (default 4373)
 *
 * Requires Playwright (machine-level, not a project dependency). Chromium only. Browser emulation, not a real phone.
 */
const { chromium } = require('playwright');
const http = require('http');
const http2 = require('http2');
const os = require('os');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIST = path.resolve(process.env.PERF_DIST || 'dist');
const API = (process.env.PERF_API || 'http://localhost:3911').replace(/\/$/, '');
const RUNS = Number(process.env.PERF_RUNS || 5);
const ONLY = process.env.PERF_PAGES ? new RegExp(process.env.PERF_PAGES) : null;
const OUT = process.env.PERF_OUT || '/tmp/mh-perf-373.json';
const PORT = Number(process.env.PERF_PORT || 4373);
const BASE = `https://localhost:${PORT}`;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API)) throw new Error('Refusing a non-loopback API.');
if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`No build at ${DIST}`);

const BLOCKED = ['*res.cloudinary.com*', '*js.paystack.co*', '*fcm.googleapis.com*', '*wa.me*', '*whatsapp.com*'];
const NETWORK = { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 };
const CPU = 4;
const SEASON_DAY = '2026-12-10';
/** Milliseconds from now to the same time of day on SEASON_DAY (Accra is UTC). */
const seasonOffset = () => Date.parse(`${SEASON_DAY}T${new Date().toISOString().slice(11)}`) - Date.now();

/* ───────────── The build, served like production ───────────── */
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };
const brotli = new Map();
function compressed(file, body) {
  if (!brotli.has(file)) brotli.set(file, zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }));
  return brotli.get(file);
}
function send(req, res, status, headers, body, key) {
  const textual = /text|javascript|json|svg|xml|manifest/.test(headers['content-type'] || '');
  if (textual && body.length > 1024 && /\bbr\b/.test(req.headers['accept-encoding'] || '')) {
    body = key ? compressed(key, body) : zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
    headers['content-encoding'] = 'br'; headers.vary = 'Accept-Encoding';
  }
  headers['content-length'] = body.length;
  res.writeHead(status, headers); res.end(body);
}
function proxy(req, res) {
  // Analytics writes are answered here: they are not part of what is measured, and the local API has no database.
  if (req.method === 'POST' && /^\/api\/(analytics|experiences)\/events/.test(req.url)) { req.resume(); res.writeHead(204); return res.end(); }
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const headers = {}; for (const [k, v] of Object.entries(req.headers)) if (!k.startsWith(':') && !['accept-encoding', 'host', 'connection'].includes(k)) headers[k] = v;
    headers.host = new URL(API).host;
    const upstream = http.request(API + req.url, { method: req.method, headers }, up => {
      const parts = [];
      up.on('data', c => parts.push(c));
      up.on('end', () => {
        let body = Buffer.concat(parts);
        const offset = Number((/(?:^|;\s*)perf-season=(-?\d+)/.exec(req.headers.cookie || '') || [])[1] || 0);
        if (offset && req.url.startsWith('/api/seasonal/status') && up.statusCode === 200) {
          // In season: the API's own answer, its clock moved by the same amount as the page's.
          const answer = JSON.parse(body.toString());
          const at = new Date(Date.parse(answer.serverTime) + offset);
          answer.serverTime = at.toISOString(); answer.date = at.toISOString().slice(0, 10);
          body = Buffer.from(JSON.stringify(answer));
        }
        const out = {}; for (const [k, v] of Object.entries(up.headers)) if (!['content-length', 'transfer-encoding', 'connection', 'keep-alive', 'content-encoding'].includes(k)) out[k] = v;
        send(req, res, up.statusCode, out, body);
      });
    });
    upstream.on('error', () => { res.writeHead(502); res.end(); });
    upstream.end(Buffer.concat(chunks));
  });
}
function handle(req, res) {
  const url = new URL(req.url, BASE);
  if (url.pathname.startsWith('/api/')) return proxy(req, res);
  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST + path.sep)) { res.writeHead(400); return res.end(); }
  const asset = fs.existsSync(file) && fs.statSync(file).isFile();
  if (!asset) {
    if (/\.[^/]+$/.test(url.pathname)) { res.writeHead(404); return res.end('Not found'); }
    file = path.join(DIST, /^\/app\/?$/.test(url.pathname) ? 'app/index.html' : 'index.html');
  }
  const type = TYPES[path.extname(file)] || 'application/octet-stream';
  const cache = !asset ? 'no-store' : file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
  send(req, res, 200, { 'content-type': type, 'cache-control': cache }, fs.readFileSync(file), file);
}
function certificate() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-perf-cert-'));
  const key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '2', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert), allowHTTP1: true };
}
const server = http2.createSecureServer(certificate(), handle);

/* ───────────── What a page reports about itself ───────────── */
const OBSERVE = ready => {
  const p = window.__perf = { lcp: [], cls: 0, shifts: [], long: [], events: [], fcp: null, ready: {}, serif: null };
  // When each named element is first on screen (inserted, laid out, then the next frame).
  const marks = Object.entries(ready || {});
  const look = () => { for (const [name, sel] of marks) if (!(name in p.ready)) { const el = document.querySelector(sel); if (el && el.getClientRects().length) { p.ready[name] = -1; requestAnimationFrame(() => { p.ready[name] = performance.now(); }); } } };
  if (marks.length) new MutationObserver(look).observe(document, { childList: true, subtree: true, attributes: true });
  try { document.fonts.addEventListener('loadingdone', e => { if (p.serif === null && e.fontfaces.some(f => /Fraunces/.test(f.family))) p.serif = performance.now(); }); } catch { /* no font loading API */ }
  const safe = f => { try { f(); } catch { /* unsupported entry type */ } };
  const describe = n => !n ? null : (n.tagName || '').toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  safe(() => new PerformanceObserver(l => l.getEntries().forEach(e => p.lcp.push({ t: e.startTime, size: e.size, el: describe(e.element), url: e.url || '', text: (e.element && !e.url ? (e.element.textContent || '').trim().slice(0, 60) : '') }))).observe({ type: 'largest-contentful-paint', buffered: true }));
  // CLS as Chrome reports it: the largest session window (shifts under 1 s apart, a window at most 5 s long).
  let win = 0, first = 0, prev = 0;
  safe(() => new PerformanceObserver(l => l.getEntries().forEach(e => { if (e.hadRecentInput) return; if (e.startTime - prev > 1000 || e.startTime - first > 5000) { win = 0; first = e.startTime; } win += e.value; prev = e.startTime; p.cls = Math.max(p.cls, win); p.shifts.push({ t: e.startTime, v: e.value, from: (e.sources || []).map(s => describe(s.node)).slice(0, 3) }); })).observe({ type: 'layout-shift', buffered: true }));
  safe(() => new PerformanceObserver(l => l.getEntries().forEach(e => p.long.push({ t: e.startTime, d: e.duration }))).observe({ type: 'longtask', buffered: true }));
  safe(() => new PerformanceObserver(l => l.getEntries().forEach(e => { if (e.name === 'first-contentful-paint') p.fcp = e.startTime; })).observe({ type: 'paint', buffered: true }));
  safe(() => new PerformanceObserver(l => l.getEntries().forEach(e => p.events.push({ name: e.name, t: e.startTime, d: e.duration, id: e.interactionId || 0 }))).observe({ type: 'event', buffered: true, durationThreshold: 16 }));
};

let member = null;
async function signUpMember() {
  const phone = '024' + String(Date.now()).slice(-7);
  const res = await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Perf Lab', phone, password: 'perf-lab-Pass-373!' }) });
  const body = await res.json();
  if (!body.token) throw new Error('Could not create the synthetic member on the local API: ' + JSON.stringify(body).slice(0, 200));
  return body;
}

/**
 * The pages measured. `season` puts the page in season through the API's own answer (a first visit: nothing stored),
 * `member` signs in a synthetic member, `standalone` emulates the installed app, `act` is an interaction to time.
 */
const HERO = { ordinary: '#home-headline', seasonal: '#xh-hero-title' };
const PAGES = [
  { id: 'home-guest', path: '/', ready: { hero: HERO.ordinary } },
  // A first seasonal visit (nothing stored): `ordinary` records whether the ordinary homepage showed first.
  { id: 'home-guest-season', path: '/', season: true, ready: { hero: HERO.seasonal, ordinary: HERO.ordinary } },
  { id: 'home-member', path: '/', member: true, ready: { hero: 'main h1' } },
  { id: 'home-member-season', path: '/', member: true, season: true, ready: { hero: '.xm-welcome-name' } },
  { id: 'data-guest', path: '/data', act: 'checkout', ready: { hero: '.mh-ds-tile' } },
  { id: 'data-guest-season', path: '/data', season: true, ready: { hero: '.mh-ds-tile' } },
  { id: 'orders-member', path: '/orders', member: true, ready: { hero: 'main h1' } },
  { id: 'services-guest', path: '/services', ready: { hero: 'main h1' } },
  { id: 'wallet-member', path: '/wallet', member: true, ready: { hero: 'main h1' } },
  { id: 'earn-member', path: '/earn', member: true, ready: { hero: 'main h1' } },
  { id: 'greetings-creator', path: '/greetings', ready: { hero: 'h1' } },
  { id: 'greetings-recipient', path: '/g/perf373lab', ready: { hero: 'h1, h2' } },
  { id: 'countdown', path: '/countdown', ready: { hero: '.cd-cell' } },
  { id: 'app-standalone-member', path: '/', member: true, standalone: true, ready: { hero: 'main h1' } },
];

const median = xs => { const s = xs.filter(x => typeof x === 'number' && isFinite(x)).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const range = xs => { const s = xs.filter(x => typeof x === 'number' && isFinite(x)).sort((a, b) => a - b); return s.length ? [s[0], s[s.length - 1]] : null; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function measure(browser, spec) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' });
  if (spec.season) {
    const offset = seasonOffset();
    await context.addCookies([{ name: 'perf-season', value: String(offset), url: BASE }]);
    // Only Date moves; timers, animation frames and performance.now() keep real time.
    await context.addInitScript(offset => {
      const Real = Date;
      class SeasonDate extends Real { constructor(...a) { if (a.length) super(...a); else super(Real.now() + offset); } static now() { return Real.now() + offset; } }
      window.Date = SeasonDate;
    }, offset);
  }
  await context.addInitScript(OBSERVE, spec.ready || {});
  // The install and notification invitations are left as they are: they belong to the measured experience.
  if (spec.member) await context.addInitScript(([t, u]) => { try { localStorage.setItem('mystery_hub_session_token', t); localStorage.setItem('mystery_hub_user', u); } catch { /* blocked */ } }, [member.token, JSON.stringify(member.user)]);
  if (spec.standalone) await context.addInitScript(() => { const original = window.matchMedia.bind(window); window.matchMedia = q => /display-mode: standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : original(q); });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setBlockedURLs', { urls: BLOCKED });
  await cdp.send('Network.emulateNetworkConditions', NETWORK);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await cdp.send('Performance.enable');
  const reqs = new Map();
  let last = Date.now(), inflight = 0;
  cdp.on('Network.requestWillBeSent', e => { if (!reqs.has(e.requestId)) inflight++; reqs.set(e.requestId, { url: e.request.url, type: e.type, start: e.timestamp, method: e.request.method, initiator: e.initiator?.type }); last = Date.now(); });
  cdp.on('Network.responseReceived', e => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.cached = e.response.fromDiskCache || e.response.fromServiceWorker; r.mime = e.response.mimeType; } });
  cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.end = e.timestamp; inflight--; } last = Date.now(); });
  cdp.on('Network.loadingFailed', e => { const r = reqs.get(e.requestId); if (r) { r.failed = e.blockedReason || e.errorText; r.end = e.timestamp; inflight--; } last = Date.now(); });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));

  const t0 = Date.now();
  await page.goto(BASE + spec.path, { waitUntil: 'load', timeout: 90_000 });
  // Settled: nothing new on the network for 3 s (long-lived waits such as a 30-minute refresh never start inside it).
  while (Date.now() - t0 < 45_000 && (inflight > 0 || Date.now() - last < 3_000)) await sleep(200);
  const navStart = await page.evaluate(() => performance.timeOrigin);
  let interaction = null;
  if (spec.act === 'checkout') interaction = await openCheckout(page);
  const perf = await page.evaluate(() => window.__perf);
  const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const firstTs = Math.min(...[...reqs.values()].map(r => r.start));
  const list = [...reqs.values()].map(r => ({ ...r, startMs: Math.round((r.start - firstTs) * 1000), endMs: r.end ? Math.round((r.end - firstTs) * 1000) : null }));
  const lcp = perf.lcp[perf.lcp.length - 1] || null;
  const kind = r => r.failed ? 'blocked' : r.type === 'Script' ? 'js' : r.type === 'Stylesheet' ? 'css' : r.type === 'Font' ? 'font' : r.type === 'Image' ? 'image' : r.type === 'Document' ? 'html' : r.type === 'Fetch' || r.type === 'XHR' ? 'api' : 'other';
  const bytes = {}, count = {};
  for (const r of list) { const k = kind(r); bytes[k] = (bytes[k] || 0) + (r.bytes || 0); count[k] = (count[k] || 0) + 1; }
  const tbt = perf.long.filter(l => l.t > (perf.fcp || 0)).reduce((s, l) => s + Math.max(0, l.d - 50), 0);
  const result = {
    id: spec.id, lcp: lcp?.t ?? null, lcpElement: lcp ? (lcp.url ? 'image ' + lcp.url.slice(0, 90) : `${lcp.el} “${lcp.text}”`) : null, fcp: perf.fcp,
    ready: perf.ready, serif: perf.serif, cls: perf.cls, shifts: perf.shifts.slice(0, 6), longTasks: perf.long.length, tbt, mainThreadMs: Math.round((metrics.TaskDuration || 0) * 1000), scriptMs: Math.round((metrics.ScriptDuration || 0) * 1000),
    bytes, count, totalBytes: list.reduce((s, r) => s + (r.bytes || 0), 0), requests: list.filter(r => !r.failed).length, blocked: list.filter(r => r.failed).map(r => r.url.slice(0, 120)),
    interaction, errors, requestsList: list.map(r => ({ k: kind(r), url: r.url.replace(BASE, ''), s: r.startMs, e: r.endMs, b: r.bytes || 0, st: r.status })),
  };
  await context.close();
  return result;
}

/** Opens the checkout from the first available bundle and times the interaction (Event Timing) and the dialog. */
async function openCheckout(page) {
  // A Telecel bundle: no network is paused for it in the local API's service controls.
  const button = page.locator('.mh-ds-tile[aria-label*="Telecel"]').first();
  if (!(await button.count())) return { skipped: 'no bundle button' };
  await button.scrollIntoViewIfNeeded();
  await page.evaluate(() => { window.__perf.events = []; window.__clickAt = performance.now(); });
  await button.click();
  const shown = await page.waitForSelector('[role="dialog"]', { timeout: 15_000 }).then(() => page.evaluate(() => performance.now() - window.__clickAt)).catch(() => null);
  await sleep(1500);
  const events = await page.evaluate(() => window.__perf.events.filter(e => e.id));
  return { dialogMs: shown && Math.round(shown), inp: events.length ? Math.max(...events.map(e => e.d)) : null };
}

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch();
  const selected = PAGES.filter(p => !ONLY || ONLY.test(p.id));
  if (selected.some(p => p.member)) member = await signUpMember();
  const all = {};
  for (const spec of selected) {
    all[spec.id] = [];
    for (let i = 0; i < RUNS; i++) {
      try { all[spec.id].push(await measure(browser, spec)); }
      catch (e) { all[spec.id].push({ id: spec.id, error: String(e).slice(0, 300) }); }
      const r = all[spec.id][i];
      console.log(`${spec.id} #${i + 1}: LCP ${r.lcp?.toFixed?.(0)} ms, ${(r.totalBytes / 1024 || 0).toFixed(1)} KB, ${r.requests} req${r.error ? ' ERROR ' + r.error : ''}`);
    }
  }
  const summary = {};
  for (const [id, runs] of Object.entries(all)) {
    const ok = runs.filter(r => !r.error);
    const pick = f => ok.map(f);
    summary[id] = {
      runs: ok.length, lcp: median(pick(r => r.lcp)), lcpRange: range(pick(r => r.lcp)), fcp: median(pick(r => r.fcp)), cls: median(pick(r => r.cls)), tbt: median(pick(r => r.tbt)),
      mainThreadMs: median(pick(r => r.mainThreadMs)), scriptMs: median(pick(r => r.scriptMs)), totalKB: median(pick(r => r.totalBytes / 1024)), requests: median(pick(r => r.requests)),
      jsKB: median(pick(r => (r.bytes.js || 0) / 1024)), cssKB: median(pick(r => (r.bytes.css || 0) / 1024)), fontKB: median(pick(r => (r.bytes.font || 0) / 1024)), apiKB: median(pick(r => (r.bytes.api || 0) / 1024)),
      jsCount: median(pick(r => r.count.js || 0)), apiCount: median(pick(r => r.count.api || 0)), blocked: ok[0]?.blocked.length, lcpElement: ok[0]?.lcpElement,
      heroMs: median(pick(r => r.ready?.hero > 0 ? r.ready.hero : null)), ordinaryFirst: ok.filter(r => r.ready && 'ordinary' in r.ready).length, serifMs: median(pick(r => r.serif)),
      dialogMs: median(pick(r => r.interaction?.dialogMs)), inp: median(pick(r => r.interaction?.inp)), errors: [...new Set(ok.flatMap(r => r.errors))],
    };
  }
  fs.writeFileSync(OUT, JSON.stringify({ dist: DIST, runs: RUNS, network: NETWORK, cpu: CPU, summary, all }, null, 1));
  console.table(Object.fromEntries(Object.entries(summary).map(([id, s]) => [id, { lcp: s.lcp && Math.round(s.lcp), fcp: s.fcp && Math.round(s.fcp), hero: s.heroMs && Math.round(s.heroMs), serif: s.serifMs && Math.round(s.serifMs), cls: s.cls?.toFixed(3), tbt: Math.round(s.tbt || 0), mainMs: s.mainThreadMs, KB: s.totalKB?.toFixed(0), req: s.requests, js: s.jsKB?.toFixed(0), css: s.cssKB?.toFixed(0), font: s.fontKB?.toFixed(0), dialog: s.dialogMs, inp: s.inp }])));
  console.log('Results: ' + OUT);
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
