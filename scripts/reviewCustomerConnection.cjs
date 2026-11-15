// LOCAL ONLY. Mystery Hub 3.4-B browser acceptance: invitation coordination, install and Channel invitations, footers.
// Drives a local production build (default http://localhost:3111) backed by a disposable database. It never contacts
// WhatsApp or Telegram (those requests are aborted) and never pays. Chromium's install dialog cannot be triggered by
// automation, so the install journeys dispatch a SIMULATED `beforeinstallprompt`/`appinstalled`: that proves the
// product logic, not a real device install.
//   node scripts/reviewCustomerConnection.cjs [outDir]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.REVIEW_BASE || 'http://localhost:3111';
const OUT = process.argv[2] || path.join(process.cwd(), 'tmp-review-34b');
fs.mkdirSync(OUT, { recursive: true });
const AXE = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : null;
const CHANNEL = 'https://whatsapp.com/channel/0029Vb97gokADTOKgN8Nzr0s';
const PREVIEW = '/?season-preview=christmas-2026&season-date=2026-12-10';
const results = [];
const ok = (name, pass, detail = '') => { results.push(!!pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + String(detail).slice(0, 240) : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const settle = async p => { await p.waitForLoadState('networkidle').catch(() => {}); await sleep(600); };
const invite = p => p.locator('aside.mh-invite');
const waitInvite = async (p, ms = 6000) => { try { await invite(p).waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; } };
const noInvite = async (p, ms = 4500) => { await sleep(ms); return (await invite(p).count()) === 0; };
const store = (p, kind, key) => p.evaluate(([k, s]) => { try { return JSON.parse((s === 'local' ? localStorage : sessionStorage).getItem(k) || 'null'); } catch { return null; } }, [key, kind]);
const overflow = p => p.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1);
const axe = async (p, selector) => {
  if (!AXE) return null;
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async sel => { const r = await window.axe.run(document.querySelector(sel) || document, { resultTypes: ['violations'] }); return r.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id); }, selector);
};
// Simulated install prompt: dispatched after load, answering with the outcome stored in sessionStorage.
const simulateInstallPrompt = ctx => ctx.addInitScript(() => {
  window.__prompted = 0;
  addEventListener('load', () => setTimeout(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = () => { window.__prompted++; return Promise.resolve(); };
    event.userChoice = new Promise(resolve => setTimeout(() => resolve({ outcome: sessionStorage.getItem('qa-outcome') || 'accepted', platform: 'web' }), 50));
    dispatchEvent(event);
  }, 250));
});
const outbound = [];
const context = async (b, opts = {}) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  await ctx.route(/whatsapp\.com|wa\.me|t\.me/, route => { outbound.push(route.request().url()); return route.abort(); });
  return ctx;
};
// Engagement the way a visitor creates it: a second page in the same tab.
const engage = async (p, second = '/data') => { await p.goto(BASE + '/'); await settle(p); await p.goto(BASE + second); await settle(p); };

(async () => {
  const b = await chromium.launch();

  // 1. Channel (desktop: no install dialog here, so the Channel is the invitation).
  {
    const ctx = await context(b); const p = await ctx.newPage();
    await p.goto(BASE + '/'); await settle(p);
    ok('first look: nothing appears without engagement', await noInvite(p, 5000));
    await p.goto(BASE + '/data'); await settle(p);
    ok('second page: one invitation appears after it settles', await waitInvite(p));
    const card = await invite(p).evaluate(el => ({ h: el.querySelector('h2').textContent, name: el.querySelector('h2').innerText, p: el.querySelector('p').textContent, links: [...el.querySelectorAll('a')].map(a => [a.textContent.trim(), a.getAttribute('href'), a.target, a.rel]), buttons: [...el.querySelectorAll('button')].map(x => x.textContent.trim() || x.getAttribute('aria-label')), focusInside: el.contains(document.activeElement) }));
    ok('Channel copy, link and actions', card.h.startsWith('Stay in the Mystery.') && card.p === 'Follow our official channel for bundle updates, Friday Drops and special offers.'
      && card.links.length === 1 && card.links[0][1] === CHANNEL && card.links[0][2] === '_blank' && /noopener/.test(card.links[0][3])
      && card.buttons.includes('Maybe later') && card.buttons.includes('Already following'), JSON.stringify(card));
    ok('the invitation never takes focus', card.focusInside === false);
    ok('no sideways scroll with the invitation', !(await overflow(p)));
    const v = await axe(p, 'aside.mh-invite'); if (v) ok('axe: invitation (serious/critical)', v.length === 0, v.join(', '));
    await invite(p).screenshot({ path: `${OUT}/channel-invite-1280.png` });
    await p.screenshot({ path: `${OUT}/channel-invite-page-1280.png` });
    await p.getByRole('button', { name: 'Maybe later', exact: true }).click();
    const state = await store(p, 'local', 'mh_channel_invite');
    ok('"Maybe later" closes it and snoozes (30 days)', (await invite(p).count()) === 0 && state && state.later === 1 && state.following === false, JSON.stringify(state));
    await p.goto(BASE + '/help'); await settle(p);
    ok('nothing else for the rest of the visit (no chaining after a dismissal)', await noInvite(p));
    await p.reload(); await settle(p);
    ok('refresh keeps the visit: still nothing', await noInvite(p));
    const p2 = await ctx.newPage(); await engage(p2, '/services');
    ok('a new tab within 12 hours: nothing (browser-wide gap, and the Channel is snoozed)', await noInvite(p2));
    await ctx.close();
  }
  // 2. "Already following" and "Follow Channel" (a click is not a follow).
  {
    const ctx = await context(b); const p = await ctx.newPage(); await engage(p, '/help');
    ok('Channel invitation on Help', await waitInvite(p));
    await p.getByRole('button', { name: 'Already following', exact: true }).click();
    const s = await store(p, 'local', 'mh_channel_invite');
    ok('"Already following" stops automatic Channel invitations in this browser', s && s.following === true, JSON.stringify(s));
    await ctx.close();
    const ctx2 = await context(b); const q = await ctx2.newPage(); await engage(q, '/services');
    ok('Channel invitation on Services', await waitInvite(q));
    const popup = ctx2.waitForEvent('page', { timeout: 5000 }).catch(() => null);
    await q.getByRole('link', { name: /Follow Channel/ }).click();
    const opened = await popup;
    await sleep(300);
    const s2 = await store(q, 'local', 'mh_channel_invite');
    ok('"Follow Channel" opens the official Channel in a new tab and records an outbound click, never a follow',
      opened && outbound.includes(CHANNEL) && s2 && s2.openedAt > 0 && s2.following === false && (await invite(q).count()) === 0, JSON.stringify({ outbound, s2 }));
    await ctx2.close();
  }
  // 3. Install (simulated prompt) on a phone: inline card on Home, floating invitation elsewhere, honest progress.
  {
    const ctx = await context(b, { ...devices['Pixel 7'] }); await simulateInstallPrompt(ctx); const p = await ctx.newPage();
    await p.goto(BASE + '/'); await settle(p); await sleep(800);
    ok('Home shows the in-page install card (approved copy)', await p.locator('.mh-install-promo h2').first().textContent().then(t => t === 'Mystery Hub, one tap away.').catch(() => false));
    await p.evaluate(() => window.scrollBy(0, 400)); await sleep(31_000);
    ok('the floating invitation stays away while the page card is on screen', (await invite(p).count()) === 0);
    await p.goto(BASE + '/data'); await settle(p);
    ok('Data: the install invitation has priority over the Channel', await waitInvite(p) && (await invite(p).locator('h2').textContent()) === 'Mystery Hub, one tap away.');
    const box = await invite(p).boundingBox(), nav = await p.locator('.mh-bottom-nav').boundingBox(), vh = p.viewportSize().height;
    ok('phone: sits above the tab bar, inside the screen, under 40% of its height', box && nav && box.y + box.height <= nav.y + 1 && box.y >= 0 && box.height <= vh * 0.4, JSON.stringify({ box, nav, vh }));
    await invite(p).screenshot({ path: `${OUT}/install-invite-pixel7.png` });
    await p.screenshot({ path: `${OUT}/install-invite-page-pixel7.png` });
    await p.getByRole('button', { name: 'Install App' }).click();
    await sleep(400);
    const pending = await p.evaluate(() => ({ prompted: window.__prompted, pending: localStorage.getItem('mh_install_pending_at'), installed: localStorage.getItem('mh_app_installed_at'), h: document.querySelector('aside.mh-invite h2')?.textContent }));
    ok('accepted is "Installing…", recorded as pending, never as installed', pending.prompted === 1 && pending.pending && !pending.installed && pending.h === 'Installing Mystery Hub…', JSON.stringify(pending));
    await p.evaluate(() => dispatchEvent(new Event('appinstalled')));
    await sleep(300);
    const done = await p.evaluate(() => ({ pending: localStorage.getItem('mh_install_pending_at'), installed: localStorage.getItem('mh_app_installed_at'), h: document.querySelector('aside.mh-invite h2')?.textContent }));
    ok('only the browser confirmation says "installed" (pending cleared)', !done.pending && done.installed && done.h === 'Mystery Hub is installed', JSON.stringify(done));
    await p.getByRole('button', { name: 'Done' }).click();
    await p.goto(BASE + '/'); await settle(p); await sleep(800);
    ok('after a confirmed install, no install card or invitation in this browser', (await p.locator('.mh-install-promo').count()) === 0 && await noInvite(p, 3000));
    await ctx.close();
  }
  // 4. Install declined in the browser dialog: counts as a dismissal, nothing chained.
  {
    const ctx = await context(b, { ...devices['Pixel 7'] }); await simulateInstallPrompt(ctx); const p = await ctx.newPage();
    await p.goto(BASE + '/'); await p.evaluate(() => sessionStorage.setItem('qa-outcome', 'dismissed')); await settle(p);
    await p.goto(BASE + '/help'); await settle(p);
    ok('install invitation on Help', await waitInvite(p));
    await p.getByRole('button', { name: 'Install App' }).click(); await sleep(400);
    const s = await p.evaluate(() => JSON.parse(localStorage.getItem('mh_install_promo') || 'null'));
    ok('declining the browser dialog closes it and starts the 30-day rest', (await invite(p).count()) === 0 && s && s.count === 1, JSON.stringify(s));
    await p.goto(BASE + '/services'); await settle(p);
    ok('no Channel invitation chained after the install was declined', await noInvite(p));
    await ctx.close();
  }
  // 5. Sensitive moments. Pages that never show one, then dialogs that make a visible one step aside for good.
  {
    const ctx = await context(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
    await p.goto(BASE + '/'); await settle(p); await p.goto(BASE + '/?reference=MH-QA-RETURN'); await settle(p);
    ok('payment return (?reference=): nothing appears', await noInvite(p));
    await p.goto(BASE + '/orders'); await settle(p);
    ok('Orders (recovery and status): nothing appears', await noInvite(p));
    await p.goto(BASE + '/app'); await settle(p);
    ok('/app explains installing itself: no invitation on top', await noInvite(p));
    await ctx.close();
  }
  for (const [label, open, close] of [
    ['sign-in', p => p.locator('header .mh-signup').first().click(), p => p.keyboard.press('Escape')],
    ['phone menu', p => p.locator('.mh-menu-trigger').first().click(), p => p.keyboard.press('Escape')],
    ['checkout', p => p.getByRole('button', { name: /^Buy / }).first().click({ timeout: 4000 }), p => p.keyboard.press('Escape')],
  ]) {
    const ctx = await context(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
    await engage(p, '/data');
    const shown = await waitInvite(p);
    let opened = false;
    if (shown) { try { await open(p); opened = true; } catch { /* reported below */ } }
    await sleep(900);
    ok(`${label} opens: a visible invitation steps aside at once`, shown && opened && (await invite(p).count()) === 0, JSON.stringify({ shown, opened }));
    await close(p).catch(() => {}); await sleep(500);
    ok(`${label} closes: the invitation does not come back this visit`, await noInvite(p, 3500));
    await ctx.close();
  }
  // 6. Layout across sizes, Escape, reduced motion.
  for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1280, 800], [1440, 900]]) {
    const phone = w < 768;
    const ctx = await context(b, { viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, reducedMotion: w === 360 ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage(); await engage(p, '/services');
    const shown = await waitInvite(p);
    const box = shown && await invite(p).boundingBox();
    const navBox = phone ? await p.locator('.mh-bottom-nav').boundingBox() : null;
    ok(`${w}x${h}: one invitation, fully on screen, no sideways scroll${phone ? ', above the tab bar' : ''}`,
      shown && box.x >= 0 && box.x + box.width <= w + 0.5 && box.y >= 0 && box.y + box.height <= h + 0.5 && (!navBox || box.y + box.height <= navBox.y + 1) && !(await overflow(p)) && box.height <= h * 0.45,
      JSON.stringify({ box, navBox }));
    if (w === 360) ok('reduced motion: no entrance animation', await invite(p).evaluate(el => getComputedStyle(el).animationName === 'none'));
    if (shown) {
      await invite(p).screenshot({ path: `${OUT}/invite-${w}x${h}.png` });
      if (w === 320 || w === 390) await p.screenshot({ path: `${OUT}/invite-page-${w}x${h}.png` });
      await invite(p).getByRole('button', { name: 'Maybe later', exact: true }).focus();
      await p.keyboard.press('Escape'); await sleep(200);
      ok(`${w}: Escape inside the card closes it (as "Maybe later")`, (await invite(p).count()) === 0 && (await store(p, 'local', 'mh_channel_invite'))?.later === 1);
    }
    await ctx.close();
  }
  // 7. Footers (normal and December): support and community apart, labelled lines, new Channel, Get the app.
  for (const [label, url] of [['normal', '/'], ['december', PREVIEW]]) {
    for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1280, 800], [1440, 900]]) {
      const ctx = await context(b, { viewport: { width: w, height: h } }); const p = await ctx.newPage();
      await p.goto(BASE + url); await settle(p);
      const f = p.locator('footer').last(); await f.scrollIntoViewIfNeeded();
      const info = await f.evaluate(el => {
        const name = a => { const c = a.cloneNode(true); c.querySelectorAll('.sr-only').forEach(n => n.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); };
        const group = sel => { const g = el.querySelector(sel); return g ? [...g.querySelectorAll('a')].map(a => [name(a), a.getAttribute('href')]) : null; };
        // Every phone number on one line (a wrapped number is easy to misdial).
        const numbers = [...el.querySelectorAll('.mh-footer-support small, .xs-footer-help small')].filter(n => /^0\d{2} \d{3} \d{4}$/.test(n.textContent.trim())).map(n => n.getClientRects().length === 1 && n.getBoundingClientRect().height < 24);
        return { support: group('.mh-footer-support, .xs-footer-help'), community: group('.mh-footer-community, .xs-footer-community'), app: [...el.querySelectorAll('a')].some(a => a.getAttribute('href') === '/app' && /Get the app/.test(a.textContent)), numbers };
      });
      const s = info.support || [], c = info.community || [];
      const has = (list, re, href) => list.some(([n, hr]) => re.test(n) && (typeof href === 'string' ? hr === href : href.test(hr)));
      ok(`${label} ${w}x${h}: support group has WhatsApp, SMS, Call and Email; community has the new Channel and Telegram; Get the app; no overflow`,
        has(s, /^WhatsApp support 024 283 6323/, /^https:\/\/wa\.me\/233242836323/) && has(s, /^SMS 059 206 6298$/, 'sms:+233592066298') && has(s, /^Call 059 452 1108$/, 'tel:+233594521108') && has(s, /^Email /, /^mailto:/)
        && has(c, /^WhatsApp Channel$/, CHANNEL) && has(c, /^Telegram$/, 'https://t.me/mysteryhubapp') && !s.some(([, hr]) => hr === CHANNEL) && !c.some(([, hr]) => /wa\.me|sms:|tel:|mailto:/.test(hr)) && info.app && !(await overflow(p)),
        JSON.stringify({ s, c, app: info.app }));
      ok(`${label} ${w}: WhatsApp, SMS and call numbers each on one line`, info.numbers.length >= 2 && info.numbers.every(Boolean), JSON.stringify(info.numbers));
      if ([320, 390, 768, 1280].includes(w)) await f.screenshot({ path: `${OUT}/footer-${label}-${w}.png` });
      if (w === 390) { const v = await axe(p, 'footer:last-of-type'); if (v) ok(`axe: ${label} footer (serious/critical)`, v.length === 0, v.join(', ')); }
      await ctx.close();
    }
  }
  // 8. December guest homepage: its own install section is the page card, so nothing floats over it.
  {
    const ctx = await context(b, { ...devices['Pixel 7'] }); await simulateInstallPrompt(ctx); const p = await ctx.newPage();
    await p.goto(BASE + PREVIEW); await settle(p); await sleep(1200);
    await p.locator('.xh-install').scrollIntoViewIfNeeded().catch(() => {});
    ok('December home: the season’s install section shows the approved copy', await p.locator('.xh-install .mh-install-promo h2').textContent().then(t => t === 'Mystery Hub, one tap away.').catch(() => false));
    await p.locator('.xh-install').screenshot({ path: `${OUT}/december-install-pixel7.png` }).catch(() => {});
    await ctx.close();
  }
  await b.close();
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length} passed`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(error => { console.error(error); process.exit(1); });
