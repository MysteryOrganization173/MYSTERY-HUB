// LOCAL ONLY. Mystery Hub 3.4.1 Release 1 browser acceptance: one menu, the My Account sheet, the registration email,
// the receipt email and Smart Buy Again. Drives a local production build (default http://localhost:3111) against a
// disposable database with SYNTHETIC accounts and orders. No payment is ever initialized: the payment request is
// blocked in the browser, and a check fails if Buy Again sends one by itself.
//   REVIEW_DB=postgresql://... AXE_PATH=.../axe.min.js node scripts/reviewCustomerExperience341.cjs [outDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pg = require('pg');

const BASE = process.env.REVIEW_BASE || 'http://localhost:3111';
const OUT = process.argv[2] || path.join(process.cwd(), 'tmp-review-341');
fs.mkdirSync(OUT, { recursive: true });
const AXE = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : null;
const db = new pg.Pool({ connectionString: process.env.REVIEW_DB, ssl: false });
const results = [];
const ok = (name, pass, detail = '') => { results.push(!!pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + String(detail).slice(0, 240) : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const settle = async p => { await p.waitForLoadState('networkidle').catch(() => {}); await sleep(600); };
const axe = async (p, selector) => {
  if (!AXE) return null;
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async sel => { const r = await window.axe.run(document.querySelector(sel) || document, { resultTypes: ['violations'] }); return r.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id); }, selector);
};
const noOverflow = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const shot = (p, name, full = false) => p.screenshot({ path: path.join(OUT, name), fullPage: full });

// Synthetic members are written straight into the disposable database with a review session, so a run never meets
// the sign-up rate limit. They cannot sign in by password (the stored hash is not a valid password hash). The
// registration form itself is exercised separately below.
async function member(name, email = null) {
  const id = 'usr_qa341_' + crypto.randomUUID().slice(0, 12), at = new Date().toISOString();
  const local = '024' + String(Date.now() + Math.floor(Math.random() * 100000)).slice(-7), phone = '+233' + local.slice(1);
  await db.query(`INSERT INTO users (id,name,email,phone,password_hash,role,status,created_at,updated_at) VALUES ($1,$2,$3,$4,'synthetic-no-password','customer','active',$5,$5)`, [id, name, email, phone, at]);
  const token = 'qa341-' + crypto.randomBytes(24).toString('hex');
  await db.query(`INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES ($1,$2,$3,NOW() + interval '1 day')`, ['ses_qa341_' + crypto.randomUUID().slice(0, 12), id, crypto.createHash('sha256').update(token).digest('hex')]);
  const user = { id, name, email, phone, role: 'customer', status: 'active', createdAt: at, lastLoginAt: null, mustChangePassword: false, passwordChangedAt: null, receiptEmail: null };
  return { token, user, phone: local };
}
async function order(m, o) {
  const id = 'ord_qa341_' + crypto.randomUUID().slice(0, 10), ref = 'MH-QA341' + crypto.randomUUID().slice(0, 6).toUpperCase(), at = new Date(Date.now() - (o.ageMs || 60_000)).toISOString();
  await db.query(`INSERT INTO orders (id,user_id,public_reference,customer_name,customer_email,customer_phone,recipient_phone,network,service_type,product_id,product_name_snapshot,bundle_size_snapshot,amount,currency,status,payment_provider,payment_reference,payment_status,paid_at,delivered_at,created_at,updated_at,face_value_minor,service_fee_minor)
    VALUES ($1,$2,$3,'Synthetic',$4,$5,$6,$7,$8,$9,$10,$11,$12,'GHS',$13,'paystack',$14,$15,$16,$17,$16,$16,$18,0)`,
    [id, m.user.id, ref, m.phone + '@customer.example.test', m.phone, o.recipient || '0241234567', o.network || 'mtn', o.service || 'data', o.productId, o.name, o.size, o.amount || 1150, o.status || 'delivered', 'MH_QA341_' + crypto.randomUUID(), o.paymentStatus || 'success', at, (o.status || 'delivered') === 'delivered' ? at : null, o.faceMinor ?? null]);
  return ref;
}
async function context(b, viewport, m, extra = {}) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: extra.scale || 1, ...extra.options });
  await ctx.route(/whatsapp\.com|wa\.me|t\.me|paystack\.co|fcm\.googleapis\.com/, r => r.abort());
  ctx.initializeCalls = 0;
  await ctx.route('**/api/payments/initialize', r => { ctx.initializeCalls++; return r.abort(); });
  await ctx.addInitScript(() => { try { localStorage.setItem('mh-install-dismissed', '1'); } catch {} });
  if (extra.standalone) await ctx.addInitScript(() => { const original = window.matchMedia.bind(window); window.matchMedia = q => /display-mode: standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : original(q); });
  if (m) await ctx.addInitScript(([t, u]) => { localStorage.setItem('mystery_hub_session_token', t); localStorage.setItem('mystery_hub_user', u); }, [m.token, JSON.stringify(m.user)]);
  return ctx;
}
const visibleTriggers = p => p.evaluate(() => [...document.querySelectorAll('header .mh-menu-trigger, header [aria-controls="account-navigation"]')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').length);

(async () => {
  const b = await chromium.launch();
  try {
    const ama = await member('Ama Synthetic');
    const dataRef = await order(ama, { productId: 'mtn-2gb', name: 'MTN 2GB', size: '2GB', amount: 99999 });

    // 1. One menu button at every width; the menu fits, scrolls on short phones, and closes by Escape, outside tap and Back.
    const sizes = [[320, 640], [360, 640], [390, 844], [430, 932], [768, 1024], [1280, 800], [1440, 900]];
    for (const [w, h] of sizes) {
      for (const who of ['guest', 'member']) {
        const ctx = await context(b, { width: w, height: h }, who === 'member' ? ama : null), p = await ctx.newPage();
        await p.goto(BASE + '/'); await settle(p);
        const triggers = await visibleTriggers(p);
        const desktop = w >= 1280;
        ok(`${who} ${w}×${h}: ${desktop ? (who === 'member' ? 'one account dropdown button' : 'no menu button beside the full header') : 'exactly one menu button'}`, triggers === (desktop ? (who === 'member' ? 1 : 0) : 1), `visible ${triggers}`);
        ok(`${who} ${w}×${h}: no sideways scrolling`, await noOverflow(p));
        if (!desktop) {
          const trigger = p.locator('header .mh-menu-trigger');
          await trigger.click(); await sleep(350);
          const panel = p.locator('#mobile-menu');
          ok(`${who} ${w}: the menu opens under the header`, await panel.isVisible());
          ok(`${who} ${w}: the menu fits the width`, await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= window.innerWidth + 1));
          ok(`${who} ${w}: the bottom bar steps aside while the menu is open`, await p.evaluate(() => { const n = document.querySelector('.mh-bottom-nav'); return !n || getComputedStyle(n).visibility === 'hidden' || !n.getClientRects().length; }));
          const wideShown = await panel.getByRole('link', { name: 'Data & Airtime' }).isVisible().catch(() => false);
          ok(`${who} ${w}: bottom-nav pages ${w >= 768 ? 'appear' : 'are not repeated'} in the menu`, wideShown === (w >= 768));
          const last = who === 'member' ? panel.getByRole('button', { name: 'Sign Out' }) : panel.getByRole('button', { name: 'Sign Up' });
          await last.scrollIntoViewIfNeeded(); const box = await last.boundingBox();
          ok(`${who} ${w}×${h}: the last item can be reached`, box && box.y + box.height <= h + 1 && box.y >= 0, JSON.stringify(box));
          if (who === 'member') ok(`member ${w}: one Sign Out in the open menu`, await p.getByRole('button', { name: 'Sign Out' }).count() === 1);
          if (w === 390) { const v = await axe(p, '#mobile-menu'); ok(`${who} 390: menu has no serious accessibility issues`, v === null || v.length === 0, v); await shot(p, `menu-${who}-390.png`); }
          if (w === 768) await shot(p, `menu-${who}-768.png`);
          if (w === 320 || w === 360) await shot(p, `menu-${who}-${w}x${h}.png`);
          await p.keyboard.press('Escape'); await sleep(250);
          ok(`${who} ${w}: Escape closes and returns focus to the menu button`, !(await panel.isVisible().catch(() => false)) && await trigger.evaluate(el => el === document.activeElement));
          await trigger.click(); await sleep(300);
          await p.mouse.click(Math.round(w / 2), h - 8); await sleep(300);
          ok(`${who} ${w}: tapping outside closes it`, !(await panel.isVisible().catch(() => false)));
          await trigger.click(); await sleep(300);
          await p.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate'))); await sleep(300);
          ok(`${who} ${w}: Back closes it`, !(await panel.isVisible().catch(() => false)));
        } else if (who === 'member') {
          const trigger = p.locator('header [aria-controls="account-navigation"]');
          await trigger.click(); await sleep(300);
          const menu = p.locator('#account-navigation');
          ok(`member ${w}: compact account dropdown`, await menu.isVisible() && (await menu.boundingBox()).width <= 300);
          if (w === 1280) { const v = await axe(p, '#account-navigation'); ok('member 1280: dropdown has no serious accessibility issues', v === null || v.length === 0, v); await p.screenshot({ path: path.join(OUT, 'dropdown-member-1280.png'), clip: { x: 640, y: 0, width: 640, height: 560 } }); }
          await p.keyboard.press('Escape'); await sleep(200);
          ok(`member ${w}: Escape closes the dropdown and returns focus`, !(await menu.isVisible().catch(() => false)) && await trigger.evaluate(el => el === document.activeElement));
          await trigger.click(); await sleep(200); await p.mouse.click(100, h - 50); await sleep(200);
          ok(`member ${w}: clicking elsewhere closes it`, !(await menu.isVisible().catch(() => false)));
        }
        await ctx.close();
      }
    }

    // 2. Installed app and the December shell keep the single menu.
    for (const [label, extra, url] of [['installed app', { standalone: true }, '/'], ['December shell', {}, '/?season-preview=christmas-2026&season-date=2026-12-10']]) {
      const ctx = await context(b, { width: 390, height: 844 }, ama, extra), p = await ctx.newPage();
      await p.goto(BASE + url); await settle(p);
      ok(`${label} 390: one menu button`, await visibleTriggers(p) === 1);
      await p.locator('header .mh-menu-trigger').click(); await sleep(400);
      ok(`${label} 390: the menu opens and fits`, await p.locator('#mobile-menu').isVisible() && await noOverflow(p));
      if (label === 'December shell') { ok('December shell: the season styles the menu', await p.evaluate(() => !!document.querySelector('.mh-app[data-season-shell="christmas"] .mh-mobile-menu-panel'))); await shot(p, 'menu-member-december-390.png'); }
      await ctx.close();
    }

    // 3. My Account: a sheet of short sections; forms open in place; the receipt email is separate from sign-in.
    for (const [w, h] of [[390, 844], [1280, 800]]) {
      // Phones get overlay scrollbars, as on a real phone (desktop Chromium keeps a scrollbar gutter while locked).
      const ctx = await context(b, { width: w, height: h }, ama, { scale: 2, options: w < 640 ? { isMobile: true, hasTouch: true } : {} }), p = await ctx.newPage();
      await p.goto(BASE + '/'); await settle(p);
      if (w < 1280) { await p.locator('header .mh-menu-trigger').click(); await sleep(300); await p.locator('#mobile-menu').getByRole('button', { name: 'My Account' }).click(); }
      else { await p.locator('header [aria-controls="account-navigation"]').click(); await sleep(200); await p.locator('#account-navigation').getByRole('button', { name: 'My Account' }).click(); }
      await sleep(600);
      const sheet = p.getByRole('dialog', { name: 'My Account' });
      ok(`account ${w}: opens as one sheet`, await sheet.isVisible() && await p.getByRole('dialog').count() === 1);
      const rect = await sheet.boundingBox();
      // Measured against the page's own width: a desktop-style scrollbar keeps its gutter while the page is locked.
      const pageWidth = await p.evaluate(() => document.documentElement.clientWidth);
      ok(`account ${w}: ${w < 640 ? 'fills the phone screen' : 'a centred panel'}`, w < 640 ? Math.abs(rect.height - h) <= 2 && rect.width >= pageWidth - 1 : rect.width <= 680, JSON.stringify({ ...rect, pageWidth }));
      for (const heading of ['Personal details', 'Security', 'Notifications', 'Rewards']) ok(`account ${w}: ${heading} section`, await sheet.getByRole('heading', { name: heading }).isVisible().catch(() => false) || await sheet.getByRole('heading', { name: heading }).count() === 1);
      ok(`account ${w}: no form is open at first`, await sheet.locator('form').count() === 0);
      const v = await axe(p, '[role="dialog"]'); ok(`account ${w}: no serious accessibility issues`, v === null || v.length === 0, v);
      await shot(p, `account-${w}.png`);
      if (w === 390) {
        await sheet.evaluate(el => { el.scrollTop = el.scrollHeight; }); await sleep(250); await shot(p, 'account-390-lower.png');
        await sheet.evaluate(el => { el.scrollTop = 0; }); await sleep(150);
        const edit = sheet.getByRole('button', { name: 'Edit details' });
        await edit.click(); await sleep(200);
        ok('account: Edit details opens one form with the name focused', await sheet.locator('form').count() === 1 && await p.evaluate(() => document.activeElement?.getAttribute('autocomplete') === 'name'));
        await shot(p, 'account-390-edit.png');
        await sheet.getByRole('button', { name: 'Cancel' }).click(); await sleep(200);
        ok('account: Cancel closes it and returns focus to Edit details', await sheet.locator('form').count() === 0 && await sheet.getByRole('button', { name: 'Edit details' }).evaluate(el => el === document.activeElement));
        await sheet.getByRole('button', { name: 'Add a receipt email' }).click(); await sleep(150);
        await sheet.getByLabel('Email for receipts').fill('ama.receipts@example.test');
        await sheet.getByRole('button', { name: 'Save', exact: true }).click(); await sleep(800);
        const row = (await db.query('SELECT email, receipt_email FROM users WHERE id=$1', [ama.user.id])).rows[0];
        ok('account: a receipt email is saved separately; the sign-in email is unchanged', row.receipt_email === 'ama.receipts@example.test' && row.email === null, JSON.stringify(row));
        ok('account: the sheet confirms it in words', await sheet.getByText('Receipts will go to this email.').isVisible());
        await sheet.getByRole('button', { name: 'Remove' }).click(); await sleep(800);
        ok('account: Remove forgets it', (await db.query('SELECT receipt_email FROM users WHERE id=$1', [ama.user.id])).rows[0].receipt_email === null);
        await sheet.getByRole('button', { name: 'Change password' }).click(); await sleep(150);
        ok('account: Change password opens in place with the current password focused', await p.evaluate(() => document.activeElement?.getAttribute('autocomplete') === 'current-password'));
        await sheet.getByRole('button', { name: 'Cancel' }).click(); await sleep(150);
        await sheet.getByRole('button', { name: 'Sign out of all devices' }).click(); await sleep(150);
        ok('account: signing out everywhere asks first', await sheet.getByText('Sign out of all devices? This signs out this device too.').isVisible());
        await sheet.getByRole('button', { name: 'Cancel' }).click(); await sleep(150);
        ok('account: Cancel keeps the session', !!(await db.query('SELECT 1 FROM sessions WHERE user_id=$1', [ama.user.id])).rows.length);
        await sheet.getByRole('button', { name: 'Notification settings' }).click(); await sleep(500);
        ok('account: notification settings open inside the sheet', await p.getByRole('dialog').count() === 1 && await sheet.getByRole('button', { name: 'Hide notification settings' }).isVisible());
        await p.keyboard.press('Escape'); await sleep(300);
        ok('account: Escape closes the sheet and focus returns to the menu button', !(await sheet.isVisible().catch(() => false)) && await p.locator('header .mh-menu-trigger').evaluate(el => el === document.activeElement));
      }
      await ctx.close();
    }

    // 3b. Back closes My Account and only My Account; My Business › More › My account keeps it open.
    {
      const ctx = await context(b, { width: 390, height: 844 }, ama, { options: { isMobile: true, hasTouch: true } }), p = await ctx.newPage();
      await p.goto(BASE + '/data'); await settle(p);
      await p.locator('header .mh-menu-trigger').click(); await sleep(300);
      await p.locator('#mobile-menu').getByRole('button', { name: 'My Account' }).click(); await sleep(600);
      await p.goBack(); await sleep(700);
      ok('account: Back closes the sheet and leaves the page where it was', !(await p.getByRole('dialog', { name: 'My Account' }).isVisible().catch(() => false)) && /\/data$/.test(new URL(p.url()).pathname), p.url());
      await p.locator('header .mh-menu-trigger').click(); await sleep(300);
      await p.locator('#mobile-menu').getByRole('button', { name: 'My Account' }).click(); await sleep(600);
      await p.getByRole('button', { name: 'Close My Account' }).click(); await sleep(600);
      ok('account: closing with × removes its history entry and stays on the page', (await p.evaluate(() => history.state?.mhAccount)) !== true && /\/data$/.test(new URL(p.url()).pathname), p.url());
      await ctx.close();
      const owner = await member('Owner Synthetic');
      const site = await fetch(BASE + '/api/websites', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + owner.token }, body: JSON.stringify({ templateId: 'tmpl-start-blank', name: 'Synthetic Data Shop' }) });
      ok('setup: a synthetic website for My Business', site.status === 201 || site.status === 200, site.status);
      const c2 = await context(b, { width: 390, height: 844 }, owner, { options: { isMobile: true, hasTouch: true } }), q = await c2.newPage();
      await q.goto(BASE + '/my-business'); await settle(q); await sleep(1200);
      const more = q.getByRole('button', { name: /^More/ });
      if (await more.isVisible().catch(() => false)) {
        await more.click(); await sleep(500);
        await q.locator('dialog.bw-drawer').getByRole('button', { name: /My account/ }).click(); await sleep(1200);
        ok('My Business › More › My account opens the account sheet and keeps it open', await q.getByRole('dialog', { name: 'My Account' }).isVisible().catch(() => false));
      } else ok('My Business › More › My account opens the account sheet and keeps it open', false, 'More button not shown');
      await c2.close();
    }

    // 4. Registration: the email is visible, recommended and optional.
    {
      const ctx = await context(b, { width: 390, height: 844 }, null, { scale: 2 }), p = await ctx.newPage();
      await p.goto(BASE + '/'); await settle(p);
      await p.locator('header .mh-signup').first().click(); await p.waitForSelector('#auth-email');
      ok('register: the email field is shown without a reveal step', await p.locator('#auth-email').isVisible());
      ok('register: labelled "Email address (recommended)" with its purpose', /Email address\s*\(recommended\)/.test(await p.locator('label[for="auth-email"]').innerText()) && await p.getByText('For payment receipts and easier future checkouts.').isVisible());
      const v = await axe(p, '[role="dialog"]'); ok('register: no serious accessibility issues', v === null || v.length === 0, v);
      await shot(p, 'register-390.png');
      const phone = '024' + String(Date.now()).slice(-7), email = `reg${Date.now()}@example.test`;
      await p.fill('#auth-name', 'Esi Synthetic'); await p.fill('#auth-identifier', phone); await p.fill('#auth-email', email); await p.fill('#auth-password', 'Synthetic#Member-341');
      await p.locator('form button[type="submit"]').click(); await sleep(2000);
      const row = (await db.query('SELECT email FROM users WHERE email=$1', [email])).rows[0];
      ok('register: an entered email is saved with the account', !!row);
      await ctx.close();
      const res = await fetch(BASE + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Yaw Synthetic', identifier: '024' + String(Date.now() + 7).slice(-7), password: 'Synthetic#Member-341' }) });
      ok('register: still works without an email', res.status === 200 || res.status === 201, res.status);
    }

    // 5. Smart Buy Again: today's product and a review, never a payment; anything else explained.
    {
      const kojo = await member('Kojo Synthetic');
      const ref = await order(kojo, { productId: 'mtn-2gb', name: 'MTN 2GB', size: '2GB', amount: 99999, recipient: '0241234567' });
      const ctx = await context(b, { width: 390, height: 844 }, kojo, { scale: 2 }), p = await ctx.newPage();
      const quotes = []; p.on('request', r => { if (/\/api\/commercial\/quote\//.test(r.url())) quotes.push(r.url()); });
      await p.goto(BASE + '/'); await settle(p);
      await p.getByRole('button', { name: 'Buy again' }).first().click();
      await p.waitForSelector('#checkout-phone', { timeout: 8000 }).catch(() => {});
      await sleep(1500);
      ok('Buy again (Data): the checkout review opens', await p.locator('#checkout-phone').isVisible());
      ok('Buy again (Data): the previous recipient is filled in', (await p.locator('#checkout-phone').inputValue()) === '024 123 4567');
      ok('Buy again (Data): the same product, MTN 2GB', /2GB/.test(await p.locator('[role="dialog"]').first().innerText()));
      ok('Buy again (Data): today’s server quote is fetched for it', quotes.some(u => /quote\/mtn-2gb/.test(u)), quotes.join(' '));
      const text = await p.locator('[role="dialog"]').first().innerText();
      ok('Buy again (Data): the old order amount is not used', !/999\.99|99,999/.test(text));
      ok('Buy again: nothing starts a payment by itself', ctx.initializeCalls === 0, ctx.initializeCalls);
      // Remember this email: shown for a new address, saved only when ticked, separately from sign-in.
      const receipt = p.getByPlaceholder('you@example.com');
      await receipt.fill('kojo.receipts@example.test'); await sleep(200);
      const remember = p.getByLabel(/Remember this email for future receipts/);
      ok('checkout: "Remember this email for future receipts" is offered, unticked', await remember.isVisible() && !(await remember.isChecked()));
      await shot(p, 'buy-again-checkout-390.png');
      await remember.check();
      // A payment attempt the server does not accept (blocked here) remembers nothing.
      const initialized = []; p.on('request', r => { if (/\/api\/payments\/initialize/.test(r.url())) initialized.push(r.postDataJSON()); });
      await p.getByRole('button', { name: /^Pay GH₵/ }).click(); await sleep(1500);
      let row = (await db.query('SELECT email, receipt_email FROM users WHERE id=$1', [kojo.user.id])).rows[0];
      ok('checkout: a payment attempt that never reached an order remembers nothing', row.receipt_email === null && row.email === null, JSON.stringify(row));
      ok('checkout: the payment request carried the typed receipt email', initialized.length === 1 && initialized[0]?.customerEmail === 'kojo.receipts@example.test', JSON.stringify(initialized[0] || {}).slice(0, 120));
      await ctx.close();
      // When the server creates the order, the ticked address is remembered, separately from sign-in. The order
      // response is SIMULATED in the browser (no access code, so no payment window opens and nothing is charged).
      const abena = await member('Abena Synthetic');
      await order(abena, { productId: 'mtn-2gb', name: 'MTN 2GB', size: '2GB' });
      const ctxA = await context(b, { width: 390, height: 844 }, abena), a = await ctxA.newPage();
      await ctxA.unroute('**/api/payments/initialize');
      await ctxA.route('**/api/payments/initialize', r => { ctxA.initializeCalls++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, orderRef: 'MH-QA341-SIMULATED', reference: 'MH_QA341_SIMULATED' }) }); });
      await a.goto(BASE + '/'); await settle(a);
      await a.getByRole('button', { name: 'Buy again' }).first().click(); await a.waitForSelector('#checkout-phone', { timeout: 8000 }).catch(() => {}); await sleep(1500);
      await a.getByPlaceholder('you@example.com').fill('abena.receipts@example.test');
      await a.getByLabel(/Remember this email for future receipts/).check();
      await a.getByPlaceholder('you@example.com').fill('');
      ok('checkout: the Remember box disappears and unticks when the address is cleared', !(await a.getByLabel(/Remember this email for future receipts/).isVisible().catch(() => false)));
      await a.getByPlaceholder('you@example.com').fill('abena.receipts@example.test');
      ok('checkout: it comes back unticked', !(await a.getByLabel(/Remember this email for future receipts/).isChecked()));
      await a.getByLabel(/Remember this email for future receipts/).check();
      await a.getByRole('button', { name: /^Pay GH₵/ }).click(); await sleep(1800);
      row = (await db.query('SELECT email, receipt_email FROM users WHERE id=$1', [abena.user.id])).rows[0];
      ok('checkout: once the order exists, the ticked receipt email is saved, not as a sign-in email', row.receipt_email === 'abena.receipts@example.test' && row.email === null, JSON.stringify(row));
      ok('checkout: one payment request, from the Pay tap only', ctxA.initializeCalls === 1, ctxA.initializeCalls);
      await ctxA.close();

      // Order status sheet → Buy again; airtime; discontinued; instant; another customer's order.
      const ctx2 = await context(b, { width: 390, height: 844 }, kojo), q = await ctx2.newPage();
      await q.goto(BASE + '/'); await settle(q);
      await q.getByRole('button', { name: 'Track Order' }).first().click(); await sleep(1500);
      const sheetBuy = q.getByRole('button', { name: 'Buy again' }).last();
      if (await sheetBuy.isVisible().catch(() => false)) { await sheetBuy.click(); await sleep(1500); ok('order status → Buy again opens the checkout review', await q.locator('#checkout-phone').isVisible() && ctx2.initializeCalls === 0); }
      else ok('order status → Buy again opens the checkout review', false, 'button not shown');
      await ctx2.close();

      const cases = [
        ['Airtime', { service: 'airtime', productId: 'airtime-telecel-10', network: 'telecel', name: 'Telecel Airtime', size: 'GH₵10', faceMinor: 1000, recipient: '0201234567' }, async p => (await p.locator('#checkout-phone').isVisible().catch(() => false)) && /GH₵10\.00 Airtime/.test(await p.locator('[role="dialog"]').first().innerText())],
        ['a retired bundle', { productId: 'mtn-retired-qa', name: 'MTN 9GB', size: '9GB' }, async p => (await p.getByText('That bundle is no longer sold. Here are today’s MTN bundles.').isVisible().catch(() => false)) && /\/data/.test(p.url()) && !(await p.locator('#checkout-phone').isVisible().catch(() => false))],
        ['an Instant Bundle', { service: 'instant_bundle', productId: 'instant-qa-pkg', name: 'MTN Instant', size: '1GB' }, async p => !(await p.locator('#checkout-phone').isVisible().catch(() => false)) && /\/data/.test(p.url()) && await p.getByText(/Instant Bundles can’t be checked right now|That bundle is no longer sold/).first().isVisible().catch(() => false)],
      ];
      for (const [label, o, check] of cases) {
        const who = await member('Buy Again ' + label); await order(who, o);
        const c = await context(b, { width: 390, height: 844 }, who), p = await c.newPage();
        await p.goto(BASE + '/'); await settle(p);
        await p.getByRole('button', { name: 'Buy again' }).first().click(); await sleep(2200);
        ok(`Buy again (${label}): ${label === 'Airtime' ? 'review with the same amount' : 'explained, and the catalogue opens instead'}`, await check(p));
        ok(`Buy again (${label}): no payment started`, c.initializeCalls === 0);
        if (label === 'a retired bundle') await shot(p, 'buy-again-retired-390.png');
        await c.close();
      }
      const failed = await member('Buy Again failed'); await order(failed, { productId: 'mtn-2gb', name: 'MTN 2GB', size: '2GB', status: 'failed' });
      const c3 = await context(b, { width: 390, height: 844 }, failed), p3 = await c3.newPage();
      await p3.goto(BASE + '/'); await settle(p3);
      ok('a failed order offers no Buy again', await p3.getByRole('button', { name: 'Buy again' }).count() === 0);
      await c3.close();
      const theirs = await fetch(`${BASE}/api/account/orders/${dataRef}/reorder`, { headers: { Authorization: 'Bearer ' + kojo.token } });
      // Signed in, but tracking an order that isn't this account's: Buy again quietly opens that service's catalogue.
      {
        const ctx4 = await context(b, { width: 390, height: 844 }, kojo), r4 = await ctx4.newPage();
        await r4.goto(BASE + '/orders'); await settle(r4);
        await r4.getByRole('button', { name: /Track another order/ }).click();
        await r4.getByLabel('Order reference').fill(dataRef);
        await r4.getByLabel('Order reference').press('Enter'); await sleep(1800);
        const again = r4.getByRole('button', { name: 'Buy again' }).last();
        const shown = await again.isVisible().catch(() => false);
        if (shown) { await again.click(); await sleep(1800); }
        ok('tracking another customer’s order: Buy again opens the catalogue quietly, with no “not found” message and no checkout',
          shown && /\/data/.test(r4.url()) && !(await r4.locator('#checkout-phone').isVisible().catch(() => false)) && !(await r4.getByText('We couldn’t find that order in your account').isVisible().catch(() => false)), `shown ${shown} url ${r4.url()}`);
        ok('tracking another customer’s order: no payment started', ctx4.initializeCalls === 0);
        await ctx4.close();
      }
      ok('another customer’s order reads as not found', theirs.status === 404, theirs.status);
    }
  } catch (error) {
    ok('review completed without an exception', false, error.stack || error.message);
  } finally {
    await b.close(); await db.end();
  }
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed. Screenshots: ${OUT}`);
  process.exit(passed === results.length ? 0 : 1);
})();
