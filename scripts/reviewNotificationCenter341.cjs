// LOCAL ONLY. Mystery Hub 3.4.1 Release 2 browser acceptance: the header bell and Notification Center, the one
// "Allow Notifications" experience (Notification Center, My Account), settings polish, and visitors without an inbox.
// Drives a local production build (default http://localhost:3111) started with SYNTHETIC push keys and the simulated
// push service, against a disposable database, with synthetic accounts only. Chromium automation cannot reach a real
// push service, so the browser's permission answer and PushManager.subscribe are SIMULATED (as in the 3.4-C review).
//   REVIEW_DB=postgresql://... AXE_PATH=.../axe.min.js node scripts/reviewNotificationCenter341.cjs [outDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pg = require('pg');

const BASE = process.env.REVIEW_BASE || 'http://localhost:3111';
const OUT = process.argv[2] || path.join(process.cwd(), 'tmp-review-341-r2');
fs.mkdirSync(OUT, { recursive: true });
const AXE = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : null;
const db = new pg.Pool({ connectionString: process.env.REVIEW_DB, ssl: false });
const N = 'mysteryhub_notifications';
const results = [];
const ok = (name, pass, detail = '') => { results.push(!!pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + String(detail).slice(0, 240) : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const settle = async p => { await p.waitForLoadState('networkidle').catch(() => {}); await sleep(700); };
const axe = async (p, selector) => {
  if (!AXE) return null;
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async sel => { const r = await window.axe.run(document.querySelector(sel) || document, { resultTypes: ['violations'] }); return r.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id); }, selector);
};

async function member(name) {
  const id = 'usr_qa341n_' + crypto.randomUUID().slice(0, 12), at = new Date().toISOString();
  const local = '024' + String(Date.now() + Math.floor(Math.random() * 100000)).slice(-7), phone = '+233' + local.slice(1);
  await db.query(`INSERT INTO users (id,name,email,phone,password_hash,role,status,created_at,updated_at) VALUES ($1,$2,NULL,$3,'synthetic-no-password','customer','active',$4,$4)`, [id, name, phone, at]);
  const token = 'qa341n-' + crypto.randomBytes(24).toString('hex');
  await db.query(`INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES ($1,$2,$3,NOW() + interval '1 day')`, ['ses_qa341n_' + crypto.randomUUID().slice(0, 12), id, crypto.createHash('sha256').update(token).digest('hex')]);
  return { token, phone: local, user: { id, name, email: null, phone, role: 'customer', status: 'active', createdAt: at, lastLoginAt: null, mustChangePassword: false, passwordChangedAt: null, receiptEmail: null } };
}
async function deliveredOrder(m) {
  const id = 'ord_qa341n_' + crypto.randomUUID().slice(0, 10), ref = 'MH-QA341N' + crypto.randomUUID().slice(0, 6).toUpperCase(), at = new Date(Date.now() - 600_000).toISOString();
  await db.query(`INSERT INTO orders (id,user_id,public_reference,customer_name,customer_email,customer_phone,recipient_phone,network,service_type,product_id,product_name_snapshot,bundle_size_snapshot,amount,currency,status,payment_provider,payment_reference,payment_status,paid_at,delivered_at,created_at,updated_at)
    VALUES ($1,$2,$3,'Synthetic','qa@example.test',$4,'0241234567','mtn','data','mtn-2gb','MTN 2GB','2GB',1150,'GHS','delivered','paystack',$5,'success',$6,$6,$6,$6)`, [id, m.user.id, ref, m.phone, 'MH_QA341N_' + crypto.randomUUID(), at]);
  return ref;
}
async function announcement(m, ageHours = 2, title = 'Weekend data deals') {
  await db.query(`INSERT INTO ${N}.templates(id,title,body,category,enabled) VALUES('qa341_news','Weekend data deals','Fresh MTN and Telecel bundles are in. Have a look before Sunday.','marketing',true) ON CONFLICT (id) DO NOTHING`);
  await db.query(`INSERT INTO ${N}.events(user_id,event_key,template_id,label,destination,created_at) VALUES($1,$2,'qa341_news',$3,'/data',NOW() - make_interval(hours => $4))`, [m.user.id, 'qa341n-' + crypto.randomUUID(), title.slice(0, 100), ageHours]);
}
// SIMULATED browser permission and push subscription (headless Chromium always reports "denied").
const simulatePush = (ctx, answer) => ctx.addInitScript(answer => {
  const FakeNotification = function () {};
  Object.defineProperty(FakeNotification, 'permission', { get: () => localStorage.getItem('qa-permission') || 'default' });
  FakeNotification.requestPermission = async () => { localStorage.setItem('qa-permission', answer); return answer; };
  window.Notification = FakeNotification;
  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const wrap = json => ({ endpoint: json.endpoint, toJSON: () => json, unsubscribe: async () => { localStorage.removeItem('qa-push-sub'); return true; } });
  PushManager.prototype.getSubscription = async function () { const s = localStorage.getItem('qa-push-sub'); return s ? wrap(JSON.parse(s)) : null; };
  PushManager.prototype.subscribe = async function () {
    const existing = localStorage.getItem('qa-push-sub'); if (existing) return wrap(JSON.parse(existing));
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const json = { endpoint: 'https://fcm.googleapis.com/fcm/send/QA-' + crypto.randomUUID(), expirationTime: null, keys: { p256dh: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)), auth: b64u(crypto.getRandomValues(new Uint8Array(16))) } };
    localStorage.setItem('qa-push-sub', JSON.stringify(json)); return wrap(json);
  };
}, answer);
async function context(b, viewport, m, { answer, mobile = false, scale = 1 } = {}) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: scale, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.route(/whatsapp\.com|wa\.me|t\.me|paystack\.co|fcm\.googleapis\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('mh-install-dismissed', '1'); } catch {} });
  if (answer) await simulatePush(ctx, answer);
  if (m) await ctx.addInitScript(([t, u]) => { localStorage.setItem('mystery_hub_session_token', t); localStorage.setItem('mystery_hub_user', u); }, [m.token, JSON.stringify(m.user)]);
  return ctx;
}
const bell = p => p.locator('header').getByRole('button', { name: 'Notifications', exact: true });
const center = p => p.getByRole('dialog', { name: 'Notifications' });
const setPaused = paused => db.query(`UPDATE ${N}.settings SET paused=$1 WHERE id=TRUE`, [paused]);

(async () => {
  const b = await chromium.launch();
  const wasPaused = (await db.query(`SELECT paused FROM ${N}.settings WHERE id=TRUE`)).rows[0]?.paused;
  try {
    await setPaused(false);
    const kwesi = await member('Kwesi Synthetic');
    const ref = await deliveredOrder(kwesi);
    await announcement(kwesi, 30);

    // 1. Visitors: no bell, no inbox. The visitor sheet speaks the same words.
    for (const [w, h] of [[390, 844], [1280, 800]]) {
      const ctx = await context(b, { width: w, height: h }, null), p = await ctx.newPage();
      await p.goto(BASE + '/'); await settle(p);
      ok(`visitor ${w}: no bell in the header`, await bell(p).count() === 0);
      await ctx.close();
    }
    {
      const ctx = await context(b, { width: 390, height: 844 }, null, { answer: 'granted' }), p = await ctx.newPage();
      await p.goto(BASE + '/'); await settle(p);
      await p.locator('header .mh-menu-trigger').click(); await sleep(300);
      await p.locator('#mobile-menu').getByRole('button', { name: 'Notifications' }).click(); await sleep(1500);
      const sheet = p.getByRole('dialog', { name: 'Notifications' });
      ok('visitor: menu › Notifications opens the browser-news sheet in the shared words', await sheet.getByText('Stay updated.').isVisible().catch(() => false) && await sheet.getByRole('button', { name: 'Allow Notifications' }).isVisible().catch(() => false), await sheet.innerText().catch(() => ''));
      ok('visitor: no account inbox is shown', await sheet.getByRole('list', { name: 'Recent notifications' }).count() === 0 && !(await sheet.getByText('Payment confirmed').isVisible().catch(() => false)));
      await ctx.close();
    }

    // 2. Members: the bell at every width, no count, and one Notification Center.
    for (const [w, h] of [[320, 640], [360, 640], [390, 844], [430, 932], [768, 1024], [1280, 800], [1440, 900]]) {
      const ctx = await context(b, { width: w, height: h }, kwesi, { mobile: w < 640 }), p = await ctx.newPage();
      await p.goto(BASE + '/'); await settle(p);
      ok(`member ${w}: one bell in the header, with no number or dot`, await bell(p).count() === 1 && (await bell(p).innerText()).trim() === '' && await bell(p).locator('span').count() === 0);
      ok(`member ${w}: the header fits`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      await bell(p).click(); await sleep(1300);
      const dialog = center(p), box = await dialog.boundingBox();
      ok(`member ${w}: the Notification Center opens ${w < 640 ? 'full screen' : 'as a panel at the right'}`, box && (w < 640 ? Math.abs(box.height - h) <= 2 : box.width <= 420 && box.x + box.width >= w - 40), JSON.stringify(box));
      const rows = dialog.getByRole('list', { name: 'Recent notifications' }).getByRole('listitem');
      ok(`member ${w}: real records, newest first, with kind and time`, await rows.count() >= 2 && /Order update/.test(await rows.first().innerText()) && /Announcement/.test(await rows.last().innerText()) && await dialog.locator('time').count() >= 2);
      ok(`member ${w}: nothing claims a message was read, seen or delivered`, !/unread|\bseen\b|marked as read|opened by|delivered to your/i.test(await dialog.innerText()));
      if (w === 390 || w === 1280) { const v = await axe(p, '[role="dialog"]'); ok(`member ${w}: no serious accessibility issues`, v === null || v.length === 0, v); await p.screenshot({ path: path.join(OUT, `center-${w}.png`) }); }
      await p.keyboard.press('Escape'); await sleep(300);
      ok(`member ${w}: Escape closes it and focus returns to the bell`, !(await dialog.isVisible().catch(() => false)) && await bell(p).evaluate(el => el === document.activeElement));
      if (w === 390) {
        await bell(p).click(); await sleep(900);
        await p.goBack(); await sleep(700);
        ok('member 390: Back closes the Notification Center and stays on the page', !(await dialog.isVisible().catch(() => false)) && new URL(p.url()).pathname === '/', p.url());
      }
      await ctx.close();
    }

    // 3. Opening a row: an order update opens that order; an announcement opens its approved page.
    {
      const ctx = await context(b, { width: 390, height: 844 }, kwesi, { mobile: true, scale: 2 }), p = await ctx.newPage();
      await p.goto(BASE + '/'); await settle(p);
      await bell(p).click(); await sleep(1300);
      await p.screenshot({ path: path.join(OUT, 'center-390-2x.png') });
      await center(p).getByRole('button', { name: /Order update/ }).first().click(); await sleep(2200);
      ok('an order update opens that order’s status', !(await center(p).isVisible().catch(() => false)) && await p.getByText(ref).first().isVisible().catch(() => false), ref);
      await p.keyboard.press('Escape'); await sleep(400);
      await p.goto(BASE + '/'); await settle(p);
      await bell(p).click(); await sleep(1300);
      await center(p).getByRole('button', { name: /Announcement/ }).first().click(); await sleep(1500);
      ok('an announcement opens its approved page (Data)', new URL(p.url()).pathname === '/data' && !(await center(p).isVisible().catch(() => false)), p.url());
      await p.goBack(); await sleep(800);
      ok('Back from that page returns to the page before, with no stray entry left by the center', new URL(p.url()).pathname === '/' && (await p.evaluate(() => history.state?.mhNotifications)) == null, JSON.stringify(await p.evaluate(() => history.state)));
      await ctx.close();
    }

    // 3b. A press outside the panel closes it (desktop); My Business › My account › See recent notifications opens it.
    {
      const ctx = await context(b, { width: 1280, height: 800 }, kwesi), p = await ctx.newPage();
      await p.goto(BASE + '/'); await settle(p);
      await bell(p).click(); await sleep(1000);
      await p.mouse.click(200, 500); await sleep(500);
      ok('desktop: a press outside the panel closes it and focus returns to the bell', !(await center(p).isVisible().catch(() => false)) && await bell(p).evaluate(el => el === document.activeElement));
      await ctx.close();
      const owner = await member('Owner Synthetic');
      const ownerRef = await deliveredOrder(owner);
      const site = await fetch(BASE + '/api/websites', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + owner.token }, body: JSON.stringify({ templateId: 'tmpl-start-blank', name: 'Synthetic Data Shop' }) });
      ok('setup: a synthetic website for My Business', site.status === 201 || site.status === 200, site.status);
      const c2 = await context(b, { width: 390, height: 844 }, owner, { mobile: true }), q = await c2.newPage();
      await q.goto(BASE + '/my-business'); await settle(q); await sleep(800);
      await q.getByRole('button', { name: /^More/ }).click(); await sleep(500);
      await q.locator('dialog.bw-drawer').getByRole('button', { name: /My account/ }).click(); await sleep(1200);
      const account = q.getByRole('dialog', { name: 'My Account' });
      await account.getByRole('button', { name: 'Notification settings' }).click(); await sleep(1200);
      await account.getByRole('button', { name: /See recent notifications/ }).click(); await sleep(1800);
      ok('My Business › My account › See recent notifications opens the Notification Center', await center(q).isVisible().catch(() => false) && !(await account.isVisible().catch(() => false)));
      // My Business has no order sheet of its own: an order update opens My Orders with that order.
      await center(q).getByRole('button', { name: /Order update/ }).first().click(); await sleep(2500);
      ok('My Business: an order update opens My Orders with that order', new URL(q.url()).pathname === '/orders' && await q.getByText(ownerRef).first().isVisible().catch(() => false), q.url());
      await c2.close();
    }

    // 4. Empty, error with retry, and older pages.
    {
      const empty = await member('Efua Synthetic');
      const ctx = await context(b, { width: 390, height: 844 }, empty, { mobile: true }), p = await ctx.newPage();
      await p.goto(BASE + '/'); await settle(p);
      await bell(p).click(); await sleep(1200);
      ok('empty: an honest empty state', await center(p).getByText('No notifications yet').isVisible() && await center(p).getByText('Order updates and any news you chose will appear here.').isVisible());
      await p.screenshot({ path: path.join(OUT, 'center-empty-390.png') });
      await p.keyboard.press('Escape'); await sleep(300);
      await ctx.route('**/api/notifications/inbox?offset=0', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic outage' }) }));
      await bell(p).click(); await sleep(1200);
      ok('error: says so, with Try again', await center(p).getByText('Your notifications couldn’t be loaded.').isVisible() && await center(p).getByRole('button', { name: 'Try again' }).isVisible());
      await p.screenshot({ path: path.join(OUT, 'center-error-390.png') });
      await ctx.unroute('**/api/notifications/inbox?offset=0');
      await center(p).getByRole('button', { name: 'Try again' }).click(); await sleep(1200);
      ok('error: Try again loads the real state', await center(p).getByText('No notifications yet').isVisible());
      await ctx.close();
      const busy = await member('Kofi Synthetic');
      for (let i = 0; i < 27; i++) await announcement(busy, 3 + i, `Synthetic news ${i + 1}`);
      const c2 = await context(b, { width: 1280, height: 800 }, busy), q = await c2.newPage();
      await q.goto(BASE + '/'); await settle(q);
      await bell(q).click(); await sleep(1300);
      const list = center(q).getByRole('list', { name: 'Recent notifications' }).getByRole('listitem');
      const first = await list.count();
      await center(q).getByRole('button', { name: 'Show older' }).click(); await sleep(1300);
      ok('older pages: 25 first, then Show older adds the rest once', first === 25 && await list.count() === 27 && !(await center(q).getByRole('button', { name: 'Show older' }).isVisible().catch(() => false)), `${first} → ${await list.count()}`);
      await c2.close();
    }

    // 5. One "Allow Notifications": the same words and consent from the Notification Center and My Account.
    {
      const ama = await member('Ama Synthetic');
      const ctx = await context(b, { width: 390, height: 844 }, ama, { answer: 'granted', mobile: true, scale: 2 }), p = await ctx.newPage();
      await p.goto(BASE + '/'); await settle(p);
      await bell(p).click(); await sleep(1800);
      const dialog = center(p);
      ok('Allow (center): the shared card, exactly the invitation’s words', await dialog.getByText('Stay updated.').isVisible().catch(() => false) && await dialog.getByText('Get order updates, service news and occasional offers.').isVisible().catch(() => false) && await dialog.getByRole('button', { name: 'Not now' }).isVisible().catch(() => false));
      await p.screenshot({ path: path.join(OUT, 'center-allow-390.png') });
      await dialog.getByRole('button', { name: 'Allow Notifications' }).click(); await sleep(3000);
      ok('Allow (center): “on” only after the server confirms', await dialog.getByText('You’re all set.').isVisible().catch(() => false));
      const devices = (await db.query(`SELECT COUNT(*)::int c FROM ${N}.devices WHERE user_id=$1`, [ama.user.id])).rows[0].c;
      const consents = (await db.query(`SELECT purpose,granted,source,copy_version FROM ${N}.consents WHERE user_id=$1 ORDER BY seq`, [ama.user.id])).rows;
      ok('Allow (center): one device, consent for exactly the two purposes named, same copy version as the invitation', devices === 1 && consents.length === 2 && consents.every(c => c.granted && c.source === 'notification_invitation' && c.copy_version === 'invite-3.4-1'), JSON.stringify({ devices, consents }));
      await ctx.close();

      // A member who said no to offers before: order updates only, and offers stay off.
      const yaw = await member('Yaw Synthetic');
      for (const marketing of [true, false]) await fetch(`${BASE}/api/notifications/preferences`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + yaw.token }, body: JSON.stringify({ transactional: true, marketing }) });
      const c2 = await context(b, { width: 390, height: 844 }, yaw, { answer: 'granted', mobile: true }), q = await c2.newPage();
      await q.goto(BASE + '/'); await settle(q);
      await q.locator('header .mh-menu-trigger').click(); await sleep(300);
      await q.locator('#mobile-menu').getByRole('button', { name: 'My Account' }).click(); await sleep(700);
      const account = q.getByRole('dialog', { name: 'My Account' });
      await account.getByRole('button', { name: 'Notification settings' }).click(); await sleep(1800);
      ok('Allow (My Account): the same card, offering order updates only after a “no” to offers', await account.getByText('Stay updated.').isVisible().catch(() => false) && await account.getByText('Get updates about your orders on this device.').isVisible().catch(() => false));
      await q.screenshot({ path: path.join(OUT, 'settings-allow-orders-only-390.png') });
      await account.getByRole('button', { name: 'Allow Notifications' }).click(); await sleep(3000);
      const last = (await db.query(`SELECT granted FROM ${N}.consents WHERE user_id=$1 AND purpose='marketing' ORDER BY seq DESC LIMIT 1`, [yaw.user.id])).rows[0];
      const prefs = (await db.query(`SELECT transactional,marketing FROM ${N}.preferences WHERE user_id=$1`, [yaw.user.id])).rows[0];
      ok('Allow (My Account): the withdrawn “no” to offers is kept', last?.granted === false && prefs?.marketing === false && prefs?.transactional === true, JSON.stringify({ last, prefs }));
      ok('Allow (My Account): once the server confirms, the device shows as on', await account.getByText('Notifications are on').isVisible().catch(() => false));
      await account.getByRole('button', { name: /See recent notifications/ }).click(); await sleep(1500);
      ok('My Account › See recent notifications opens the Notification Center (and the account sheet closes)', await center(q).isVisible().catch(() => false) && !(await account.isVisible().catch(() => false)));
      await center(q).getByRole('button', { name: 'Notification settings' }).click(); await sleep(1500);
      ok('Notification Center › Notification settings opens My Account at Notifications', await q.getByRole('dialog', { name: 'My Account' }).getByText('Notifications are on').isVisible().catch(() => false));
      await c2.close();
    }

    // 6. Paused sending is explained, never promised; blocked browsers get directions.
    {
      await setPaused(true);
      const esi = await member('Esi Synthetic');
      const ctx = await context(b, { width: 390, height: 844 }, esi, { answer: 'granted', mobile: true }), p = await ctx.newPage();
      await p.goto(BASE + '/'); await settle(p);
      await bell(p).click(); await sleep(1800);
      ok('paused: the card says sending is paused, without a date', await center(p).getByText('Mystery Hub isn’t sending notifications right now. If you turn them on, this device gets them once sending resumes.').isVisible().catch(() => false));
      await p.screenshot({ path: path.join(OUT, 'center-paused-390.png') });
      await ctx.close();
      await setPaused(false);
      const kojo = await member('Kojo Synthetic');
      const c2 = await context(b, { width: 390, height: 844 }, kojo, { answer: 'denied', mobile: true }), q = await c2.newPage();
      await q.addInitScript(() => localStorage.setItem('qa-permission', 'denied'));
      await q.goto(BASE + '/'); await settle(q);
      await bell(q).click(); await sleep(1500);
      ok('blocked: the center says so and still lists notifications', await center(q).getByText(/blocks notifications from Mystery Hub/).isVisible().catch(() => false) && !(await center(q).getByRole('button', { name: 'Allow Notifications' }).isVisible().catch(() => false)));
      await center(q).getByRole('button', { name: 'Notification settings' }).click(); await sleep(1500);
      ok('blocked: settings give directions in plain words', await q.getByText(/Site settings › Notifications/).isVisible().catch(() => false));
      await c2.close();
    }

    // 7. Signing out closes the center; the next account never sees the previous one's rows.
    {
      const ctx = await context(b, { width: 1280, height: 800 }, kwesi), p = await ctx.newPage();
      await p.goto(BASE + '/'); await settle(p);
      await bell(p).click(); await sleep(1200);
      await p.evaluate(() => window.dispatchEvent(new CustomEvent('mystery-auth-invalid', { detail: { token: localStorage.getItem('mystery_hub_session_token') } }))); await sleep(1200);
      ok('sign-out: the Notification Center closes and the bell goes', !(await center(p).isVisible().catch(() => false)) && await bell(p).count() === 0);
      await ctx.close();
    }
  } catch (error) {
    ok('review completed without an exception', false, error.stack || error.message);
  } finally {
    if (wasPaused !== undefined) await setPaused(wasPaused).catch(() => {});
    await b.close(); await db.end();
  }
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed. Screenshots: ${OUT}`);
  process.exit(passed === results.length ? 0 : 1);
})();
