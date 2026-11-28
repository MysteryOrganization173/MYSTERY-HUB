/*
 * Mystery Hub 3.7.3: mobile and accessibility review in a real browser (Chromium only). LOCAL ONLY.
 *
 * Serves a production build (`npx vite build`) and forwards /api to a local in-memory API (`npm run dev:api` style,
 * default http://localhost:3911, loopback only). Seasonal pages use the founder preview link (?season-preview=…),
 * which changes nothing on the server. Members are synthetic accounts created on the local API.
 *
 *   QA_DIST   build folder (default dist)        QA_API   local API (default http://localhost:3911)
 *   QA_OUT    screenshots and results folder (default /tmp/mh-mobile-373)
 *   QA_AXE    path to axe.min.js (optional; the audit is skipped without it)
 *
 * Checks, per page and viewport: no sideways scrolling of the page, no script errors; at 390 px also axe (WCAG 2.2 A/AA
 * tags), the keyboard order shows a visible focus, and small touch targets are listed. Extra passes: short heights,
 * reduced motion, text enlarged to 150 %, the installed-app display mode, and the PWA files.
 *
 * This is browser emulation in Chromium. It is not physical-device testing, and Firefox and WebKit are not covered.
 * Exit code 1 if any check fails.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.resolve(process.env.QA_DIST || 'dist');
const API = (process.env.QA_API || 'http://localhost:3911').replace(/\/$/, '');
const OUT = process.env.QA_OUT || '/tmp/mh-mobile-373';
const AXE = process.env.QA_AXE || '';
const PORT = 4374;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API)) throw new Error('Refusing a non-loopback API.');
fs.mkdirSync(OUT, { recursive: true });

const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && /analytics|experiences\/events/.test(u.pathname)) { res.writeHead(204); return res.end(); }
  if (u.pathname.startsWith('/api/')) {
    const up = http.request(API + req.url, { method: req.method, headers: req.headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', () => { res.writeHead(502); res.end(); });
    return void req.pipe(up);
  }
  let f = path.join(DIST, decodeURIComponent(u.pathname));
  if (!f.startsWith(DIST + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});

const SEASON = '?season-preview=christmas-2026&season-date=2026-12-10';
const PAGES = [
  { id: 'home', path: '/', ready: '#home-headline' },
  { id: 'home-season', path: '/' + SEASON, ready: '#xh-hero-title' },
  { id: 'home-member', path: '/', member: true, ready: 'main h1' },
  { id: 'home-member-season', path: '/' + SEASON, member: true, ready: '.xm-welcome-name' },
  { id: 'data', path: '/data', ready: '.mh-ds-tile', heading: 'main h1' },
  { id: 'services', path: '/services', ready: 'main h1' },
  { id: 'orders', path: '/orders', member: true, ready: 'main h1' },
  { id: 'wallet', path: '/wallet', member: true, ready: 'main h1' },
  { id: 'earn', path: '/earn', member: true, ready: '.earn-share-panel:not(.is-loading)' },
  { id: 'greetings', path: '/greetings', ready: 'h1' },
  { id: 'countdown', path: '/countdown', ready: '.cd-cell' },
];
const VIEWPORTS = [[320, 640], [360, 780], [390, 844], [430, 932], [768, 1024], [1280, 800], [1440, 900]];
const SHOTS = new Set(['320x640', '390x844', '1280x800']);

const results = [], notes = [];
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
async function check(name, fn) {
  try { await fn(); results.push([true, name]); console.log(`PASS  ${name}`); }
  catch (e) { results.push([false, name]); console.log(`FAIL  ${name}\n      ${String(e && e.message || e).slice(0, 400)}`); }
}

let browser, member;
async function open(p, { width, height, reduced = false, standalone = false, textScale = 1 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  if (p.member) await context.addInitScript(([t, u]) => { localStorage.setItem('mystery_hub_session_token', t); localStorage.setItem('mystery_hub_user', u); }, [member.token, JSON.stringify(member.user)]);
  if (textScale !== 1) await context.addInitScript(s => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${s * 100}%`; }); }, textScale);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  // Third parties the sandbox cannot reach (or must not touch) are blocked; images then show their own fallbacks.
  await cdp.send('Network.setBlockedURLs', { urls: ['*res.cloudinary.com*', '*js.paystack.co*'] });
  // This Chromium ignores display-mode in Emulation.setEmulatedMedia, so the page's own check (matchMedia) is answered
  // as an installed app would answer it, as in reviewPerformance373.cjs. CSS display-mode rules are not emulated.
  if (standalone) await context.addInitScript(() => { const original = window.matchMedia.bind(window); window.matchMedia = q => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : original(q); });
  await page.goto(`http://localhost:${PORT}${p.path}`, { waitUntil: 'load' });
  await page.waitForSelector(p.ready, { timeout: 15_000 });
  await page.waitForTimeout(1200);
  return { page, context, errors };
}
const overflow = page => page.evaluate(() => {
  const w = document.documentElement.clientWidth, wide = [];
  if (document.documentElement.scrollWidth > w + 1) for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (r.width && r.right > w + 1 && s.position !== 'fixed' && !el.closest('[class*="scroll"], [style*="overflow"]')) { wide.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} right=${Math.round(r.right)}`); if (wide.length > 3) break; }
  }
  return { scroll: document.documentElement.scrollWidth, width: w, wide };
});

server.listen(PORT, '127.0.0.1', async () => {
  const exit = code => { server.close(); process.exitCode = code; };
  try {
    const phone = '024' + String(Date.now()).slice(-7);
    member = await (await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Ama Mobile Review', phone, password: 'mobile-review-Pass-373!' }) })).json();
    if (!member.token) throw new Error('Could not create the synthetic member on the local API.');
    browser = await chromium.launch();
    const summary = {};

    // 1. Every page at every width: nothing scrolls sideways, nothing throws; screenshots at three sizes.
    for (const p of PAGES) for (const [width, height] of VIEWPORTS) {
      await check(`${p.id} at ${width}x${height}: no sideways scrolling, no script errors`, async () => {
        const { page, context, errors } = await open(p, { width, height });
        try {
          const o = await overflow(page);
          ok(o.scroll <= o.width + 1, `page is ${o.scroll}px wide in a ${o.width}px viewport: ${o.wide.join(', ')}`);
          ok(!errors.length, errors.join(' | '));
          if (SHOTS.has(`${width}x${height}`)) await page.screenshot({ path: path.join(OUT, `${p.id}-${width}.png`) });
        } finally { await context.close(); }
      });
    }

    // 2. At 390 px: axe, keyboard focus, touch targets.
    for (const p of PAGES) {
      let opened;
      await check(`${p.id}: opens at 390x844 for the accessibility checks`, async () => { opened = await open(p, { width: 390, height: 844 }); });
      if (!opened) continue;
      const { page, context } = opened;
      try {
        if (AXE) await check(`${p.id}: axe (WCAG 2.2 A/AA) finds no violations`, async () => {
          await page.addScriptTag({ content: fs.readFileSync(AXE, 'utf8') });
          const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(x => `${x.id} ×${x.nodes.length}: ${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join('; ')}`));
          ok(!v.length, v.join(' | '));
        });
        await check(`${p.id}: the first 20 Tab stops each show a visible focus`, async () => {
          await page.mouse.click(2, 2).catch(() => {});
          const missing = [];
          for (let i = 0; i < 20; i++) {
            await page.keyboard.press('Tab');
            const f = await page.evaluate(() => {
              const el = document.activeElement;
              if (!el || el === document.body) return null;
              const s = getComputedStyle(el), r = el.getBoundingClientRect();
              const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
              const within = el.querySelector && [...el.querySelectorAll('*')].some(c => { const cs = getComputedStyle(c); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0; });
              return { name: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`, visible: ring || within, size: r.width * r.height };
            });
            if (f && !f.visible) missing.push(f.name);
          }
          ok(!missing.length, `no visible focus on: ${[...new Set(missing)].join(', ')}`);
        });
        const small = await page.evaluate(() => [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [role="button"], [role="tab"], [role="radio"]')].filter(el => {
          const r = el.getBoundingClientRect(), s = getComputedStyle(el);
          if (!r.width || !r.height || s.visibility === 'hidden' || el.closest('[aria-hidden="true"], [inert]')) return false;
          if (el.tagName === 'A' && s.display === 'inline' && el.closest('p, li')) return false; // inline text links are exempt
          if (el.tagName === 'INPUT' && ['radio', 'checkbox'].includes(el.type) && el.closest('label')) return false; // the label is the target
          return r.width < 24 || r.height < 24;
        }).map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`));
        // Images: what is asked of Cloudinary against the size drawn (at up to 3x density), dimensions and priority.
        const images = await page.evaluate(() => [...document.images].map(img => {
          const r = img.getBoundingClientRect();
          const widths = [...(img.getAttribute('srcset') || '').matchAll(/w_(\d+)[^ ]* (\d+)w/g)].map(m => Number(m[2]));
          const own = /w_(\d+)/.exec(img.currentSrc || img.src || '');
          return { src: (img.getAttribute('src') || '').replace(/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//, 'cld:').slice(0, 70), shown: Math.round(r.width), top: Math.round(r.top + scrollY), srcset: widths, w: own ? Number(own[1]) : null, sized: img.hasAttribute('width') && img.hasAttribute('height') || getComputedStyle(img).aspectRatio !== 'auto', loading: img.loading, priority: img.getAttribute('fetchpriority') || '', decorative: img.alt === '' };
        }).filter(i => i.shown > 0));
        summary[p.id] = { smallTargets: small, images };
        if (small.length) notes.push(`${p.id}: targets under 24 px (check spacing exception): ${small.slice(0, 6).join('; ')}`);
      } finally { await context.close(); }
    }

    // 3. Short screens, reduced motion, enlarged text and the installed app.
    for (const [p, w, h] of [[PAGES[1], 390, 568], [PAGES[4], 390, 568], [PAGES[10], 390, 568], [PAGES[10], 844, 390], [PAGES[0], 1280, 600], [PAGES[1], 1280, 600]]) {
      await check(`${p.id} on a short screen ${w}x${h}: no sideways scrolling, the main heading is on screen`, async () => {
        const { page, context, errors } = await open(p, { width: w, height: h });
        try {
          const o = await overflow(page); ok(o.scroll <= o.width + 1, `${o.scroll}px wide: ${o.wide.join(', ')}`);
          const top = await page.evaluate(sel => document.querySelector(sel)?.getBoundingClientRect().top ?? -1, p.heading || p.ready);
          ok(top >= 0 && top < h, `heading at ${top}px`); ok(!errors.length, errors.join(' | '));
          await page.screenshot({ path: path.join(OUT, `${p.id}-short-${w}x${h}.png`) });
        } finally { await context.close(); }
      });
    }
    for (const p of [PAGES[1], PAGES[3], PAGES[10]]) {
      await check(`${p.id} with reduced motion: nothing animates or transitions`, async () => {
        const { page, context } = await open(p, { width: 390, height: 844, reduced: true });
        try {
          const moving = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => { const s = getComputedStyle(el); return s.animationName !== 'none' && parseFloat(s.animationDuration) > 0.01 && s.animationPlayState === 'running' && (s.animationIterationCount === 'infinite' || parseFloat(s.animationDuration) > 1); }).map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`).slice(0, 5));
          const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length);
          ok(!moving.length && !running, `still moving: ${moving.join(', ')} (${running} endless)`);
          await page.screenshot({ path: path.join(OUT, `${p.id}-reduced-motion.png`) });
        } finally { await context.close(); }
      });
    }
    for (const p of [PAGES[0], PAGES[1], PAGES[3], PAGES[4], PAGES[7], PAGES[8], PAGES[10]]) {
      await check(`${p.id} with text at 150 %: no sideways scrolling, no clipped heading`, async () => {
        const { page, context } = await open(p, { width: 390, height: 844, textScale: 1.5 });
        try {
          const o = await overflow(page); ok(o.scroll <= o.width + 1, `${o.scroll}px wide: ${o.wide.join(', ')}`);
          const clipped = await page.evaluate(sel => { const el = document.querySelector(sel); return el ? el.scrollWidth > el.clientWidth + 2 : false; }, p.ready);
          ok(!clipped, 'the heading is clipped');
          await page.screenshot({ path: path.join(OUT, `${p.id}-text150.png`) });
        } finally { await context.close(); }
      });
    }
    await check('installed app (display-mode standalone): the member homepage opens without sideways scrolling or errors', async () => {
      const { page, context, errors } = await open(PAGES[2], { width: 390, height: 844, standalone: true });
      try {
        ok(await page.evaluate(() => matchMedia('(display-mode: standalone)').matches), 'standalone emulation');
        const o = await overflow(page); ok(o.scroll <= o.width + 1, `${o.scroll}px wide`); ok(!errors.length, errors.join(' | '));
        await page.screenshot({ path: path.join(OUT, 'home-member-standalone.png') });
      } finally { await context.close(); }
    });
    await check('PWA files: standalone manifest with 192/512 and maskable icons; the service worker only handles push', async () => {
      const m = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
      ok(m.display === 'standalone' && m.start_url === '/' && m.scope === '/', 'display/start/scope');
      ok(['192x192', '512x512'].every(s => m.icons.some(i => i.sizes === s)), 'icon sizes');
      ok(m.icons.some(i => /maskable/.test(i.purpose)), 'maskable icon');
      const sw = fs.readFileSync(path.join(DIST, 'push-sw.js'), 'utf8');
      ok(!/addEventListener\(\s*['"]fetch['"]/.test(sw) && !/onfetch/.test(sw), 'the service worker must not intercept requests');
      ok(!/caches\.open|cache\.put|caches\.match/.test(sw), 'the service worker must not cache anything');
    });

    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ results, notes, summary }, null, 1));
    const failed = results.filter(r => !r[0]).length;
    console.log(`\n${results.length - failed} passed, ${failed} failed. Notes:\n- ${notes.join('\n- ') || 'none'}`);
    console.log('Chromium only (Firefox and WebKit are not available here). Browser emulation, not physical devices.');
    await browser.close(); exit(failed ? 1 : 0);
  } catch (e) { console.error(e); if (browser) await browser.close(); exit(1); }
});
