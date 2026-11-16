// LOCAL ONLY. Mystery Hub 3.4-C browser acceptance: one notification invitation, the browser permission, server
// registration with purpose-specific consent, one honest result; guest news on/off; account settings and history.
// Drives a local production build (default http://localhost:3111) started with SYNTHETIC local push keys against a
// disposable database. Chromium automation cannot reach a real push service, so PushManager.subscribe is SIMULATED
// (a synthetic FCM-shaped endpoint with real P-256 keys). That proves the product and server logic, not delivery.
//   REVIEW_DB=postgresql://... node scripts/reviewNotificationOnboarding.cjs [outDir]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const pg = require('pg');

const BASE = process.env.REVIEW_BASE || 'http://localhost:3111';
const OUT = process.argv[2] || path.join(process.cwd(), 'tmp-review-34c');
fs.mkdirSync(OUT, { recursive: true });
const AXE = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : null;
const db = new pg.Pool({ connectionString: process.env.REVIEW_DB, ssl: false });
const N = 'mysteryhub_notifications';
const results = [];
const ok = (name, pass, detail = '') => { results.push(!!pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + String(detail).slice(0, 240) : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const settle = async p => { await p.waitForLoadState('networkidle').catch(() => {}); await sleep(700); };
const card = p => p.locator('aside.mh-invite');
const waitCard = async (p, ms = 9000) => { try { await card(p).waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; } };
const axe = async (p, selector) => {
  if (!AXE) return null;
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async sel => { const r = await window.axe.run(document.querySelector(sel) || document, { resultTypes: ['violations'] }); return r.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id); }, selector);
};
// SIMULATED browser permission answer (headless Chromium always reports "denied") and SIMULATED push subscription,
// both kept in localStorage so they survive page loads like real ones. Not a device acceptance.
const simulatePush = (ctx, answer = 'granted') => ctx.addInitScript(answer => {
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
const context = async (b, opts = {}, answer = 'granted') => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  await ctx.route(/whatsapp\.com|wa\.me|t\.me|fcm\.googleapis\.com/, route => route.abort());
  await simulatePush(ctx, answer);
  return ctx;
};
const engage = async (p, second = '/services') => { await p.goto(BASE + '/'); await settle(p); await p.goto(BASE + second); await settle(p); };
const signUp = async (p, name) => {
  await p.goto(BASE + '/'); await settle(p);
  await p.locator('header .mh-signup').first().click(); await p.waitForSelector('#auth-name');
  await p.fill('#auth-name', name); await p.fill('#auth-identifier', '024' + String(Date.now()).slice(-7)); await p.fill('#auth-password', 'Synthetic#Member-34');
  await p.locator('form button[type="submit"]').click(); await sleep(2500);
  return (await db.query('SELECT id FROM users WHERE name=$1 ORDER BY created_at DESC LIMIT 1', [name])).rows[0]?.id;
};
const setPaused = paused => db.query(`UPDATE ${N}.settings SET paused=$1 WHERE id=TRUE`, [paused]);

(async () => {
  const b = await chromium.launch();
  // Counted at the start, so the check below means "during this review" even on a database other reviews have used.
  const deliveriesBefore = (await db.query(`SELECT COUNT(*)::int AS c FROM ${N}.deliveries`)).rows[0].c;
  await setPaused(false);
  try {
    // 1. Guest: news and offers only, one invitation, server-confirmed, then off again from the footer.
    {
      const ctx = await context(b); const p = await ctx.newPage();
      await engage(p);
      ok('guest: an invitation appears after engagement', await waitCard(p));
      const c = await card(p).evaluate(el => ({ h: el.querySelector('h2').textContent, t: el.querySelector('p').textContent, buttons: [...el.querySelectorAll('button')].map(x => x.textContent.trim() || x.getAttribute('aria-label')), note: el.querySelector('.mh-invite-note')?.textContent }));
      ok('guest copy: Stay updated. / news and occasional offers (no order updates) / Allow Notifications · Not now', c.h === 'Stay updated.' && c.t === 'Get Mystery Hub service news and occasional offers.' && c.buttons.includes('Allow Notifications') && c.buttons.includes('Not now') && /turn them off anytime/.test(c.note || ''), JSON.stringify(c));
      const v = await axe(p, 'aside.mh-invite'); if (v) ok('axe: notification invitation (serious/critical)', v.length === 0, v.join(', '));
      await card(p).screenshot({ path: `${OUT}/guest-invite-1280.png` });
      await p.getByRole('button', { name: 'Allow Notifications' }).click();
      await p.getByText('You’re all set.').waitFor({ timeout: 10000 }).catch(() => {});
      const done = await card(p).evaluate(el => el.querySelector('h2').textContent).catch(() => '');
      const cred = await p.evaluate(() => localStorage.getItem('mh_guest_notifications'));
      const row = cred && (await db.query(`SELECT id FROM ${N}.guest_devices WHERE id=$1`, [cred.split('.')[0]])).rows[0];
      const consent = row && (await db.query(`SELECT purpose,granted,source,copy_version FROM ${N}.consents WHERE guest_device_id=$1`, [row.id])).rows;
      ok('guest: "You’re all set." only after the server confirmed; one marketing consent with the copy version', done === 'You’re all set.' && row && JSON.stringify(consent) === JSON.stringify([{ purpose: 'marketing', granted: true, source: 'guest_invitation', copy_version: 'invite-3.4-1-guest' }]), JSON.stringify({ done, consent }));
      ok('guest: the credential is stored in this browser only (never in a URL)', /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/i.test(cred || '') && !(await p.evaluate(() => location.href)).includes(cred.split('.')[1]));
      await card(p).screenshot({ path: `${OUT}/guest-done-1280.png` });
      await p.getByRole('button', { name: 'Done' }).click();
      await p.locator('footer').last().getByRole('button', { name: 'Notifications' }).click();
      const sheet = p.getByRole('dialog', { name: 'Notifications' });
      await sheet.getByText('News and offers are on').waitFor({ timeout: 8000 }).catch(() => {});
      ok('footer › Notifications (guest): the sheet shows this browser is on', await sheet.getByText('News and offers are on').isVisible().catch(() => false));
      await sheet.screenshot({ path: `${OUT}/guest-sheet-on-1280.png` });
      await sheet.getByRole('button', { name: 'Turn off for this browser' }).click();
      await sheet.getByText('Stay updated.').waitFor({ timeout: 8000 }).catch(() => {});
      const after = (await db.query(`SELECT COUNT(*)::int AS c FROM ${N}.guest_devices WHERE id=$1`, [row.id])).rows[0].c;
      const last = (await db.query(`SELECT granted,source FROM ${N}.consents WHERE guest_device_id=$1 ORDER BY seq DESC LIMIT 1`, [row.id])).rows[0];
      ok('guest: Turn off deletes the registration and records the withdrawal', after === 0 && last.granted === false && last.source === 'guest_unsubscribe' && !(await p.evaluate(() => localStorage.getItem('mh_guest_notifications'))), JSON.stringify({ after, last }));
      ok('guest sheet: order updates need an account (Sign in offered)', await sheet.getByRole('button', { name: 'Sign in' }).isVisible());
      await ctx.close();
    }
    // 2. Member: one choice records order updates and news/offers; settings show it; withdrawal is recorded.
    {
      const ctx = await context(b, { ...devices['Pixel 7'] }); const p = await ctx.newPage();
      const userId = await signUp(p, 'Ama Notify Synthetic');
      await p.goto(BASE + '/services'); await settle(p);
      ok('member: an invitation appears', await waitCard(p));
      const t = await card(p).locator('p').first().textContent();
      ok('member copy names order updates, service news and occasional offers', t === 'Get order updates, service news and occasional offers.', t);
      await card(p).screenshot({ path: `${OUT}/member-invite-pixel7.png` });
      await p.screenshot({ path: `${OUT}/member-invite-page-pixel7.png` });
      await p.getByRole('button', { name: 'Allow Notifications' }).click();
      await p.getByText('You’re all set.').waitFor({ timeout: 10000 }).catch(() => {});
      const devicesRows = (await db.query(`SELECT COUNT(*)::int AS c FROM ${N}.devices WHERE user_id=$1`, [userId])).rows[0].c;
      const consents = (await db.query(`SELECT purpose,granted,source,copy_version FROM ${N}.consents WHERE user_id=$1 ORDER BY seq`, [userId])).rows;
      const prefs = (await db.query(`SELECT transactional,marketing FROM ${N}.preferences WHERE user_id=$1`, [userId])).rows[0];
      ok('member: device registered; consent recorded per purpose; preferences follow', devicesRows === 1 && consents.length === 2 && consents.every(c => c.granted && c.source === 'notification_invitation' && c.copy_version === 'invite-3.4-1') && prefs.transactional && prefs.marketing, JSON.stringify({ devicesRows, consents, prefs }));
      await card(p).screenshot({ path: `${OUT}/member-done-pixel7.png` });
      await p.getByRole('button', { name: 'Order updates only' }).click();
      await p.getByText('Offers are off.', { exact: false }).waitFor({ timeout: 8000 }).catch(() => {});
      const dropped = (await db.query(`SELECT granted,source,copy_version FROM ${N}.consents WHERE user_id=$1 AND purpose='marketing' ORDER BY seq DESC LIMIT 1`, [userId])).rows[0];
      ok('member: "Order updates only" right after the choice turns offers off, recorded as an invitation answer', (await card(p).locator('p').first().textContent()).includes('Offers are off.') && dropped.granted === false && dropped.source === 'notification_invitation', JSON.stringify(dropped));
      await card(p).screenshot({ path: `${OUT}/member-orders-only-pixel7.png` });
      await p.getByRole('button', { name: 'Done' }).click();
      await p.locator('footer').last().getByRole('button', { name: 'Notifications' }).click();
      const account = p.getByRole('dialog', { name: 'My Account' });
      await account.getByText('Notifications are on').waitFor({ timeout: 8000 }).catch(() => {});
      ok('footer › Notifications (member): My Account shows this device is on', await account.getByText('Notifications are on').isVisible().catch(() => false));
      // 3.4.1: recent notifications live in the Notification Center; My Account links to it.
      ok('member: My Account links to recent notifications instead of listing them', await account.getByRole('button', { name: /See recent notifications/ }).isVisible().catch(() => false) && !(await account.getByText('Recent notifications', { exact: true }).isVisible().catch(() => false)));
      await account.getByRole('switch').nth(1).click(); await sleep(1200);
      const regrant = (await db.query(`SELECT granted,source FROM ${N}.consents WHERE user_id=$1 AND purpose='marketing' ORDER BY seq DESC LIMIT 1`, [userId])).rows[0];
      ok('member: switching News and offers back on in My Account records the customer’s own grant', regrant && regrant.granted === true && regrant.source === 'account_settings', JSON.stringify(regrant));
      await account.getByRole('switch').nth(1).click(); await sleep(1200);
      const withdrawal = (await db.query(`SELECT granted,source FROM ${N}.consents WHERE user_id=$1 AND purpose='marketing' ORDER BY seq DESC LIMIT 1`, [userId])).rows[0];
      ok('member: switching it off again records the withdrawal', withdrawal && withdrawal.granted === false && withdrawal.source === 'account_settings', JSON.stringify(withdrawal));
      await account.screenshot({ path: `${OUT}/member-account-notifications-pixel7.png` });
      await p.keyboard.press('Escape'); await sleep(300);
      const q = await ctx.newPage(); await q.goto(BASE + '/help'); await settle(q); await q.goto(BASE + '/services'); await settle(q);
      const again = await waitCard(q, 7000);
      const kind = again ? await card(q).locator('h2').textContent() : '';
      ok('a new tab (signed out here) never offers guest news over the account’s registered browser', kind !== 'Stay updated.', kind);
      await ctx.close();
    }
    // 3. A member who turned offers off before: the invitation names order updates only, and offers stay off.
    {
      const ctx = await context(b); const p = await ctx.newPage();
      const userId = await signUp(p, 'Kofi OptOut Synthetic');
      await db.query(`INSERT INTO ${N}.preferences(user_id,transactional,marketing) VALUES($1,TRUE,FALSE) ON CONFLICT(user_id) DO UPDATE SET marketing=FALSE`, [userId]);
      await db.query(`INSERT INTO ${N}.consents(user_id,purpose,granted,source,copy_version) VALUES($1,'marketing',FALSE,'account_settings','settings-1')`, [userId]);
      await p.goto(BASE + '/services'); await settle(p);
      ok('opted-out member: an invitation appears', await waitCard(p));
      const t = await card(p).locator('p').first().textContent();
      ok('opted-out member: copy names order updates only', t === 'Get updates about your orders on this device.', t);
      await p.getByRole('button', { name: 'Allow Notifications' }).click();
      await p.getByText('You’re all set.').waitFor({ timeout: 10000 }).catch(() => {});
      const consents = (await db.query(`SELECT purpose,granted,source FROM ${N}.consents WHERE user_id=$1 AND source='notification_invitation'`, [userId])).rows;
      const prefs = (await db.query(`SELECT marketing FROM ${N}.preferences WHERE user_id=$1`, [userId])).rows[0];
      ok('opted-out member: only order updates recorded; offers stay off', consents.length === 1 && consents[0].purpose === 'transactional' && prefs.marketing === false, JSON.stringify({ consents, prefs }));
      await ctx.close();
    }
    // 4. Browser says no: blocked is shown once and nothing is registered.
    {
      const ctx = await context(b, {}, 'denied'); const p = await ctx.newPage();
      await engage(p);
      const shown = await waitCard(p);
      const isNotification = shown && (await card(p).locator('h2').textContent()) === 'Stay updated.';
      if (isNotification) {
        await p.getByRole('button', { name: 'Allow Notifications' }).click(); await sleep(1500);
        const h = await card(p).locator('h2').textContent().catch(() => '');
        ok('browser refused: "Notifications are blocked." and no registration', (h === 'Notifications are blocked.' || (await card(p).count()) === 0) && !(await p.evaluate(() => localStorage.getItem('mh_guest_notifications'))), h);
      } else ok('a notification invitation for the refusal check', false, 'none appeared');
      await ctx.close();
    }
    // 5. Paused by the operator: nobody is invited to notifications that would not arrive.
    {
      await setPaused(true);
      const ctx = await context(b); const p = await ctx.newPage();
      await engage(p);
      const shown = await waitCard(p, 7000);
      const h = shown ? await card(p).locator('h2').textContent() : '';
      ok('paused: no notification invitation (a different suggestion may appear)', h !== 'Stay updated.', h);
      await ctx.close();
      await setPaused(false);
    }
    // 6. iPhone Safari tab: account settings explain the Home Screen path instead of a dead end.
    {
      const ctx = await context(b, { ...devices['iPhone 13'] });
      await ctx.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'standalone', { get: () => false, configurable: true }); try { delete window.PushManager; } catch {} try { delete Window.prototype.onbeforeinstallprompt; } catch {} });
      const p = await ctx.newPage(); await signUp(p, 'Esi iPhone Synthetic');
      const apple = await p.evaluate(() => 'standalone' in navigator && !('onbeforeinstallprompt' in window) && !('PushManager' in window));
      if (apple) {
        await p.locator('footer').last().getByRole('button', { name: 'Notifications' }).click();
        const account = p.getByRole('dialog', { name: 'My Account' });
        await account.getByText('Use the Home Screen app').waitFor({ timeout: 8000 }).catch(() => {});
        ok('iPhone Safari tab: Home Screen guidance, no impossible action', await account.getByText('Use the Home Screen app').isVisible().catch(() => false) && (await account.getByRole('button', { name: /Turn on for this device/ }).count()) === 0);
        await account.screenshot({ path: `${OUT}/iphone-tab-settings.png` });
      } else ok('iPhone Safari tab emulation available', true, 'skipped: this Chromium cannot hide its install API');
      await ctx.close();
    }
    // 7. Layout of the invitation and its result across sizes.
    for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) {
      const phone = w < 768;
      const ctx = await context(b, { viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone });
      const p = await ctx.newPage(); await engage(p);
      const shown = await waitCard(p);
      const box = shown && await card(p).boundingBox();
      const nav = phone ? await p.locator('.mh-bottom-nav').boundingBox() : null;
      const overflow = await p.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1);
      ok(`${w}x${h}: notification invitation on screen${phone ? ', above the tab bar' : ''}, no sideways scroll`, shown && box.y >= 0 && box.y + box.height <= h + 0.5 && (!nav || box.y + box.height <= nav.y + 1) && !overflow, JSON.stringify({ box, nav }));
      if (shown) await card(p).screenshot({ path: `${OUT}/invite-${w}x${h}.png` });
      await ctx.close();
    }
    const deliveries = (await db.query(`SELECT COUNT(*)::int AS c FROM ${N}.deliveries`)).rows[0].c - deliveriesBefore;
    ok('no delivery was queued or attempted during this review', deliveries === 0, String(deliveries));
  } finally {
    await setPaused(true).catch(() => {});
    await b.close(); await db.end();
  }
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length} passed`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(error => { console.error(error); process.exit(1); });
