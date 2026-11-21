// LOCAL ONLY. Mystery Hub 3.4 — Notification Onboarding V2 browser acceptance: the five-second appearance on a first
// page, the ~12-second auto-hide (ignored, not dismissed) and what holds it, the three-day "Not now", old two-strike
// records, turn-taking with the Channel, the operator pause, the granted-but-unregistered repair, a blocked browser,
// typing, dialogs, a hidden tab, reduced motion, the in-page install card, and the layout from 320 px to 1280 px.
// Drives a local production build (default http://localhost:3111) with SYNTHETIC push keys against a disposable
// database. The browser permission and the push subscription are SIMULATED (headless Chromium has no push service),
// so this proves product and server logic, not delivery to a physical phone.
//   REVIEW_DB=postgresql://... node scripts/reviewNotificationOnboardingV2.cjs [outDir]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pg = require('pg');

const BASE = process.env.REVIEW_BASE || 'http://localhost:3111';
const OUT = process.argv[2] || path.join(process.cwd(), 'tmp-review-notif-v2');
fs.mkdirSync(OUT, { recursive: true });
const AXE = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : null;
const db = new pg.Pool({ connectionString: process.env.REVIEW_DB, ssl: false });
const N = 'mysteryhub_notifications';
const results = [];
const ok = (name, pass, detail = '') => { results.push(!!pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + String(detail).slice(0, 260) : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const card = p => p.locator('aside.mh-invite');
const DAY = 86_400_000, HOUR = 3_600_000;

// SIMULATED permission and subscription (kept in localStorage so they survive reloads like real ones). Every
// permission request is counted, so "no new prompt" can be checked. Also logs when the card appears and leaves.
const instrument = (ctx, answer) => ctx.addInitScript(answer => {
  const FakeNotification = function () {};
  Object.defineProperty(FakeNotification, 'permission', { get: () => localStorage.getItem('qa-permission') || 'default' });
  FakeNotification.requestPermission = async () => { localStorage.setItem('qa-asks', String(Number(localStorage.getItem('qa-asks') || 0) + 1)); localStorage.setItem('qa-permission', answer); return answer; };
  window.Notification = FakeNotification;
  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const wrap = json => ({ endpoint: json.endpoint, toJSON: () => json, unsubscribe: async () => { localStorage.removeItem('qa-push-sub'); return true; } });
  PushManager.prototype.getSubscription = async function () { const s = localStorage.getItem('qa-push-sub'); return s ? wrap(JSON.parse(s)) : null; };
  PushManager.prototype.subscribe = async function () {
    const existing = localStorage.getItem('qa-push-sub'); if (existing) return wrap(JSON.parse(existing));
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const json = { endpoint: 'https://fcm.googleapis.com/fcm/send/QA-V2-' + crypto.randomUUID(), expirationTime: null, keys: { p256dh: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)), auth: b64u(crypto.getRandomValues(new Uint8Array(16))) } };
    localStorage.setItem('qa-push-sub', JSON.stringify(json)); return wrap(json);
  };
  window.__invite = []; window.__leaving = null;
  const watch = () => {
    const el = document.querySelector('aside.mh-invite');
    const last = window.__invite[window.__invite.length - 1];
    if (el && (!last || last.type === 'remove')) window.__invite.push({ type: 'add', t: performance.now(), h: el.querySelector('h2')?.textContent || '' });
    if (!el && last && last.type === 'add') window.__invite.push({ type: 'remove', t: performance.now() });
    if (el && el.classList.contains('mh-invite-leaving') && window.__leaving === null) window.__leaving = performance.now();
  };
  document.addEventListener('DOMContentLoaded', () => new MutationObserver(watch).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }));
}, answer);

async function context(b, opts = {}, { answer = 'granted', member = null, storage = {} } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  await ctx.route(/whatsapp\.com|wa\.me|t\.me|fcm\.googleapis\.com|paystack\.co/, route => route.abort());
  await instrument(ctx, answer);
  if (member) await ctx.addInitScript(([t, u]) => { if (!localStorage.getItem('qa-signed-out')) { localStorage.setItem('mystery_hub_session_token', t); localStorage.setItem('mystery_hub_user', u); } }, [member.token, JSON.stringify(member.user)]);
  // Storage set once per context (the first page), like a returning browser.
  await ctx.addInitScript(entries => { if (localStorage.getItem('qa-seeded')) return; for (const [k, v] of entries) localStorage.setItem(k, v); localStorage.setItem('qa-seeded', '1'); }, Object.entries(storage));
  return ctx;
}
// The WhatsApp Channel already followed: isolates notification rules from turn-taking where a check needs that.
const FOLLOWING = { mh_channel_invite: JSON.stringify({ later: 0, laterAt: null, following: true, openedAt: null }) };

async function member(name) {
  const id = 'usr_qav2_' + crypto.randomUUID().slice(0, 12), at = new Date().toISOString();
  const local = '024' + String(Date.now() + Math.floor(Math.random() * 100000)).slice(-7), phone = '+233' + local.slice(1);
  await db.query(`INSERT INTO users (id,name,email,phone,password_hash,role,status,created_at,updated_at) VALUES ($1,$2,NULL,$3,'synthetic-no-password','customer','active',$4,$4)`, [id, name, phone, at]);
  const token = 'qav2-' + crypto.randomBytes(24).toString('hex');
  await db.query(`INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES ($1,$2,$3,NOW() + interval '1 day')`, ['ses_qav2_' + crypto.randomUUID().slice(0, 12), id, crypto.createHash('sha256').update(token).digest('hex')]);
  return { token, user: { id, name, email: null, phone, role: 'customer', status: 'active', createdAt: at, lastLoginAt: null, mustChangePassword: false, passwordChangedAt: null, receiptEmail: null } };
}
const setPaused = paused => db.query(`UPDATE ${N}.settings SET paused=$1 WHERE id=TRUE`, [paused]);
const log = p => p.evaluate(() => ({ events: window.__invite, leaving: window.__leaving, load: performance.getEntriesByType('navigation')[0]?.loadEventEnd || 0, now: performance.now() }));
const waitCard = async (p, ms = 10000) => { try { await card(p).waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; } };
const waitGone = async (p, ms) => { try { await card(p).waitFor({ state: 'detached', timeout: ms }); return true; } catch { return false; } };
const storage = (p, key) => p.evaluate(k => localStorage.getItem(k), key);
const session = p => p.evaluate(() => JSON.parse(sessionStorage.getItem('mh_invitation_session') || 'null'));
const axe = async (p, selector) => {
  if (!AXE) return null;
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async sel => { const r = await window.axe.run(document.querySelector(sel) || document, { resultTypes: ['violations'] }); return r.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id); }, selector);
};
const nothingFor = async (p, ms) => { await sleep(ms); return (await card(p).count()) === 0; };

(async () => {
  const b = await chromium.launch();
  const pausedBefore = (await db.query(`SELECT paused FROM ${N}.settings WHERE id=TRUE`)).rows[0].paused;
  const deliveriesBefore = (await db.query(`SELECT COUNT(*)::int AS c FROM ${N}.deliveries`)).rows[0].c;
  try {
    await setPaused(false);
    // 1. A first-time visitor on the landing page: about five seconds after it settles, then gone ~12 s later, untouched.
    {
      const ctx = await context(b); const p = await ctx.newPage();
      await p.goto(BASE + '/'); await p.waitForLoadState('load');
      ok('first visit: nothing in the first three seconds', await nothingFor(p, 3000));
      ok('first visit: the notification card appears on the landing page (no second page, no 25 s of use)', await waitCard(p, 7000));
      const l1 = await log(p); const appear = l1.events[0]?.t - l1.load;
      ok('it appears about five seconds after the page settled', appear >= 4800 && appear <= 7800, `${Math.round(appear)} ms after load`);
      const c = await card(p).evaluate(el => ({ h: el.querySelector('h2').textContent, t: el.querySelector('.mh-invite-copy p').textContent, buttons: [...el.querySelectorAll('button')].map(x => x.textContent.trim() || x.getAttribute('aria-label')), notes: [...el.querySelectorAll('.mh-invite-note')].map(n => n.textContent), focusInside: el.contains(document.activeElement) }));
      ok('visitor copy and actions: Stay updated. / news and occasional offers / Allow Notifications · Not now · Close', c.h === 'Stay updated.' && c.t === 'Get Mystery Hub service news and occasional offers.' && ['Allow Notifications', 'Not now', 'Close'].every(x => c.buttons.includes(x)) && c.notes.join(' ') === 'You can turn them off anytime.', JSON.stringify(c));
      ok('it never takes focus when it appears', !c.focusInside);
      const v = await axe(p, 'aside.mh-invite'); if (v) ok('axe: the invitation (serious/critical)', v.length === 0, v.join(', '));
      await card(p).screenshot({ path: `${OUT}/v2-invite-guest-1280.png` });
      const focusBefore = await p.evaluate(() => document.activeElement?.tagName);
      ok('untouched, it leaves by itself', await waitGone(p, 15000));
      const l2 = await log(p); const visibleFor = l2.events[1]?.t - l2.events[0]?.t;
      ok('…about 12 seconds after it became visible, with a gentle exit', visibleFor >= 11800 && visibleFor <= 13500 && l2.leaving !== null, `${Math.round(visibleFor)} ms; exit at ${Math.round((l2.leaving || 0) - l2.events[0]?.t)} ms`);
      ok('…without moving focus', await p.evaluate(() => document.activeElement?.tagName) === focusBefore);
      const s = await session(p);
      ok('ignored is not dismissed: no snooze, no "Not now" count, the visit not marked as dismissed', !(await storage(p, 'mh_notification_optin')) && s && s.dismissed === false && s.shown === 'notifications', JSON.stringify(s));
      ok('not replaced by an Install or Channel card on the same page', await nothingFor(p, 6000));
      await p.goto(BASE + '/services'); await p.waitForLoadState('load');
      ok('nothing on the next page of the same visit', await nothingFor(p, 9000));
      // Later visits in the same browser (new tabs share local storage, not the visit).
      const t2 = await ctx.newPage(); await t2.goto(BASE + '/'); await t2.waitForLoadState('load');
      ok('a new tab straight away: not shown again (12-hour rest, any tab)', await nothingFor(t2, 8000));
      await t2.close();
      await p.evaluate(() => { const seen = JSON.parse(localStorage.getItem('mh_invitation_seen') || '{}'); seen.notifications = Date.now() - 13 * 3600_000; localStorage.setItem('mh_invitation_seen', JSON.stringify(seen)); });
      const t3 = await ctx.newPage(); await t3.goto(BASE + '/'); await t3.waitForLoadState('load');
      ok('a later visit after it was last shown: the Channel gets this turn, so no notification card on arrival', await nothingFor(t3, 8000));
      await t3.goto(BASE + '/services'); await t3.waitForLoadState('load');
      const channel = await waitCard(t3, 9000) && await card(t3).locator('h2').textContent();
      ok('…and after engagement the Channel card appears instead (notifications do not starve it)', /Stay in the Mystery/.test(channel || ''), channel);
      if (channel) await t3.getByRole('button', { name: 'Maybe later' }).click();
      await t3.close();
      const t4 = await ctx.newPage(); await t4.goto(BASE + '/'); await t4.waitForLoadState('load');
      ok('straight after that Channel card, another tab gets no notification card (30-minute gap)', await nothingFor(t4, 8000));
      await t4.evaluate(() => { const seen = JSON.parse(localStorage.getItem('mh_invitation_seen') || '{}'); seen.channel = Date.now() - 31 * 60_000; localStorage.setItem('mh_invitation_seen', JSON.stringify(seen)); });
      await t4.close();
      const t5 = await ctx.newPage(); await t5.goto(BASE + '/'); await t5.waitForLoadState('load');
      ok('the next visit: notifications lead again (no starvation either way)', await waitCard(t5, 9000) && (await card(t5).locator('h2').textContent()) === 'Stay updated.');
      await ctx.close();
    }
    // 2. Hover holds it; leaving the card gives at least four more seconds.
    {
      const ctx = await context(b, {}, { storage: FOLLOWING }); const p = await ctx.newPage();
      await p.goto(BASE + '/help');
      ok('hover: the card appears', await waitCard(p, 11000));
      // Late in its 12 seconds, so the "at least four more seconds" rule (not the time left) decides.
      await sleep(10000);
      const box = await card(p).boundingBox();
      await p.mouse.move(box.x + box.width / 2, box.y + 20); await sleep(16000);
      ok('hover: still there after 16 s while the pointer rests on it', (await card(p).count()) === 1);
      await p.mouse.move(10, 10); const left = Date.now();
      const gone = await waitGone(p, 9000); const after = Date.now() - left;
      ok('hover: once the pointer moves away, at least four more seconds before it leaves', gone && after >= 3800 && after <= 6500, `${after} ms`);
      await ctx.close();
    }
    // 2b. Moving by keyboard holds it until focus has been inside the card and left again.
    {
      const ctx = await context(b, {}, { storage: FOLLOWING }); const p = await ctx.newPage();
      await p.goto(BASE + '/help');
      ok('keyboard: the card appears', await waitCard(p, 11000));
      await p.keyboard.press('Tab'); await sleep(16000);
      ok('keyboard: someone moving by Tab is not raced to the end of the page (still there after 16 s)', (await card(p).count()) === 1);
      const note = await p.locator('p[role="status"][aria-live="polite"]').first().textContent();
      ok('screen-reader note names the permanent entry', /for a few seconds\. Notifications in the footer is always there\./.test(note || ''), note);
      await card(p).getByRole('button', { name: 'Not now' }).focus();
      await p.evaluate(() => document.getElementById('main-content')?.focus());
      const left = Date.now();
      // Tab was pressed right after it appeared, so nearly all of its 12 seconds remain once focus has left it.
      const gone = await waitGone(p, 15000);
      ok('keyboard: after visiting the card and leaving it, the rest of its time runs (at least four seconds)', gone && Date.now() - left >= 3800, `${Date.now() - left} ms`);
      await ctx.close();
    }
    // 3. Keyboard focus inside holds it; a tap holds it for good; "Not now" rests three days; an old record does not.
    {
      const ctx = await context(b, {}, { storage: FOLLOWING }); const p = await ctx.newPage();
      await p.goto(BASE + '/about');
      ok('focus: the card appears', await waitCard(p, 11000));
      await p.keyboard.press('Tab'); // the page's own first control: focus is not inside the card
      await card(p).getByRole('button', { name: 'Allow Notifications' }).focus(); await sleep(15000);
      ok('focus: still there after 15 s while keyboard focus is inside', (await card(p).count()) === 1);
      await p.keyboard.press('Escape');
      ok('Escape inside the card answers "Not now"', await waitGone(p, 2000));
      const snooze = JSON.parse(await storage(p, 'mh_notification_optin') || 'null');
      ok('"Not now" records one answer with its time', snooze && snooze.count === 1 && Math.abs(Date.now() - snooze.lastAt) < 60_000, JSON.stringify(snooze));
      const t2 = await ctx.newPage(); await t2.goto(BASE + '/');
      ok('within three days: not shown in a later visit', await nothingFor(t2, 9000));
      await t2.evaluate(() => { localStorage.setItem('mh_notification_optin', JSON.stringify({ count: 1, lastAt: Date.now() - 3 * 86_400_000 - 60_000 })); localStorage.removeItem('mh_invitation_seen'); });
      await t2.close();
      const t3 = await ctx.newPage(); await t3.goto(BASE + '/');
      ok('after three days: shown again', await waitCard(t3, 10000));
      await ctx.close();
    }
    {
      const ctx = await context(b, { ...devices['Pixel 7'] }, { storage: { ...FOLLOWING, mh_notification_optin: JSON.stringify({ count: 2, lastAt: Date.now() - 30 * DAY }) } });
      const p = await ctx.newPage(); await p.goto(BASE + '/');
      ok('an old two-dismissal record (the previous permanent "no") does not suppress it', await waitCard(p, 10000));
      await card(p).locator('.mh-invite-copy p').tap(); await sleep(15000);
      ok('touch: a tap on the card holds it for good', (await card(p).count()) === 1);
      await card(p).getByRole('button', { name: 'Close' }).tap();
      const snooze = JSON.parse(await storage(p, 'mh_notification_optin') || 'null');
      ok('the close button follows the same three-day rest (count kept, never final)', snooze && snooze.count === 3 && Date.now() - snooze.lastAt < 60_000, JSON.stringify(snooze));
      await ctx.close();
    }
    // 4. Paused by the operator: still invited, says when they arrive; registering works; "on" only after the server.
    {
      await setPaused(true);
      const m = await member('Abena Paused Synthetic');
      const ctx = await context(b, { ...devices['Pixel 7'] }, { member: m, storage: FOLLOWING }); const p = await ctx.newPage();
      await p.goto(BASE + '/services');
      ok('paused: the member invitation still appears', await waitCard(p, 11000));
      const notes = await card(p).locator('.mh-invite-note').allTextContents();
      ok('paused: "Notifications will arrive once sending resumes." and no date', notes[0] === 'Notifications will arrive once sending resumes.' && !/\d/.test(notes.join(' ')), JSON.stringify(notes));
      ok('paused: member copy names order updates, service news and occasional offers', (await card(p).locator('.mh-invite-copy p').textContent()) === 'Get order updates, service news and occasional offers.');
      await card(p).screenshot({ path: `${OUT}/v2-invite-paused-member-pixel7.png` });
      await p.screenshot({ path: `${OUT}/v2-invite-paused-member-page-pixel7.png` });
      await card(p).getByRole('button', { name: 'Allow Notifications' }).tap();
      await p.getByText('You’re all set.').waitFor({ timeout: 10000 }).catch(() => {});
      const rows = (await db.query(`SELECT COUNT(*)::int AS c FROM ${N}.devices WHERE user_id=$1`, [m.user.id])).rows[0].c;
      const consents = (await db.query(`SELECT purpose,source,copy_version FROM ${N}.consents WHERE user_id=$1 ORDER BY seq`, [m.user.id])).rows;
      const doneNotes = await card(p).locator('.mh-invite-note').allTextContents().catch(() => []);
      ok('paused: registration accepted by the server; "You’re all set." with the paused note', rows === 1 && consents.length === 2 && consents.every(c => c.source === 'notification_invitation') && doneNotes.includes('Notifications will arrive once sending resumes.'), JSON.stringify({ rows, consents, doneNotes }));
      ok('paused: one real permission request, from the tap', await storage(p, 'qa-asks') === '1');
      await card(p).screenshot({ path: `${OUT}/v2-done-paused-pixel7.png` });
      await sleep(15000);
      ok('the success state never leaves by itself (it waits for Done)', (await card(p).count()) === 1);
      await card(p).getByRole('button', { name: 'Done' }).tap();
      const t2 = await ctx.newPage(); await t2.goto(BASE + '/');
      await t2.evaluate(() => localStorage.removeItem('mh_invitation_seen'));
      await t2.goto(BASE + '/help');
      ok('a registered device (confirmed by the server) is never invited again', await nothingFor(t2, 10000));
      await ctx.close();
      await setPaused(false);
    }
    // 5. Granted before, never registered: one tap repairs it, without a new browser question.
    {
      const m = await member('Yaw Repair Synthetic');
      const ctx = await context(b, {}, { member: m, storage: { ...FOLLOWING, 'qa-permission': 'granted' } }); const p = await ctx.newPage();
      await p.goto(BASE + '/marketplace');
      ok('repair: the card appears for a browser that already allows notifications', await waitCard(p, 11000));
      const notes = await card(p).locator('.mh-invite-note').allTextContents();
      ok('repair: says the browser already allows them (no paused note: sending is live)', notes.length === 1 && notes[0] === 'Your browser already allows them. You can turn them off anytime.', JSON.stringify(notes));
      await card(p).screenshot({ path: `${OUT}/v2-invite-repair-1280.png` });
      await card(p).getByRole('button', { name: 'Allow Notifications' }).click();
      await p.getByText('You’re all set.').waitFor({ timeout: 10000 }).catch(() => {});
      const rows = (await db.query(`SELECT COUNT(*)::int AS c FROM ${N}.devices WHERE user_id=$1`, [m.user.id])).rows[0].c;
      ok('repair: registered and confirmed, with no new permission request', rows === 1 && !(await storage(p, 'qa-asks')), JSON.stringify({ rows, asks: await storage(p, 'qa-asks') }));
      await card(p).screenshot({ path: `${OUT}/v2-done-1280.png` });
      await ctx.close();
    }
    // 6. The browser says no: shown once, then respected.
    {
      const ctx = await context(b, {}, { answer: 'denied', storage: FOLLOWING }); const p = await ctx.newPage();
      await p.goto(BASE + '/');
      await waitCard(p, 11000);
      await card(p).getByRole('button', { name: 'Allow Notifications' }).click();
      await p.getByText('Notifications are blocked.').waitFor({ timeout: 8000 }).catch(() => {});
      ok('blocked: "Notifications are blocked." with directions, nothing registered', await p.getByText('Your browser is blocking them.', { exact: false }).isVisible().catch(() => false) && !(await storage(p, 'mh_guest_notifications')));
      await card(p).screenshot({ path: `${OUT}/v2-blocked-1280.png` });
      await card(p).getByRole('button', { name: 'Done' }).click();
      const t2 = await ctx.newPage(); await t2.goto(BASE + '/');
      await t2.evaluate(() => localStorage.removeItem('mh_invitation_seen')); await t2.goto(BASE + '/help');
      ok('blocked: never asked again', await nothingFor(t2, 9000) && await storage(t2, 'qa-asks') === '1');
      await ctx.close();
    }
    // 7. Calm only: typing in a form, a dialog and a hidden tab postpone it; the settle starts again afterwards.
    {
      const ctx = await context(b, { ...devices['Pixel 7'] }, { storage: FOLLOWING }); const p = await ctx.newPage();
      await p.goto(BASE + '/help'); await p.waitForLoadState('load');
      // A real search or contact field where the page has one; otherwise a plain text field added for the check.
      const field = p.locator('main input[type="text"], main input[type="search"], main input[type="tel"], main input:not([type]), main textarea').first();
      const real = await field.count() > 0;
      if (!real) await p.evaluate(() => { const i = document.createElement('input'); i.id = 'qa-field'; i.type = 'text'; i.setAttribute('aria-label', 'QA field'); document.querySelector('main').prepend(i); });
      const input = real ? field : p.locator('#qa-field');
      await input.focus();
      ok(`typing: no card while a field has focus (${real ? 'the page’s own field' : 'a test field'})`, await nothingFor(p, 9000));
      await input.blur(); const blurred = Date.now();
      const shown = await waitCard(p, 10000);
      ok('typing: once the field is left, it appears after the page settles again', shown && Date.now() - blurred >= 4500, `${Date.now() - blurred} ms`);
      await input.focus();
      ok('typing: a card on screen steps aside when a field is focused (the keyboard never ends up under it)', await waitGone(p, 2000));
      await ctx.close();
    }
    {
      const ctx = await context(b, {}, { storage: FOLLOWING }); const p = await ctx.newPage();
      await p.goto(BASE + '/'); await p.waitForLoadState('load'); await sleep(800);
      await p.locator('header .mh-login').first().click().catch(() => {});
      const dialog = await p.getByRole('dialog').first().isVisible().catch(() => false);
      ok('sign-in open: no card over it', dialog && await nothingFor(p, 9000), String(dialog));
      await p.keyboard.press('Escape'); await sleep(300);
      ok('after the dialog closes it can appear', await waitCard(p, 10000));
      await ctx.close();
    }
    {
      const ctx = await context(b, {}, { storage: FOLLOWING }); const p = await ctx.newPage();
      await p.goto(BASE + '/'); await p.waitForLoadState('load'); await sleep(500);
      await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
      ok('hidden tab: nothing appears in the background', await nothingFor(p, 9000));
      await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
      ok('back in the foreground: it appears after the page settles', await waitCard(p, 10000));
      await ctx.close();
    }
    // 8. Reduced motion: no exit motion, it simply goes.
    {
      const ctx = await context(b, { reducedMotion: 'reduce' }, { storage: FOLLOWING }); const p = await ctx.newPage();
      await p.goto(BASE + '/');
      await waitCard(p, 11000);
      const gone = await waitGone(p, 15000);
      const l = await log(p);
      ok('reduced motion: leaves without the exit animation', gone && l.leaving === null, JSON.stringify(l.leaving));
      await ctx.close();
    }
    // 9. The in-page install card (Chromium's install prompt simulated): no floating card beside it on screen.
    {
      const ctx = await context(b, { ...devices['Pixel 7'] }, { storage: FOLLOWING }); const p = await ctx.newPage();
      await p.goto(BASE + '/'); await p.waitForLoadState('load');
      await p.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => {}; Object.defineProperty(e, 'userChoice', { value: Promise.resolve({ outcome: 'dismissed' }) }); window.dispatchEvent(e); });
      await p.locator('.mh-install-promo').first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
      const inline = p.locator('.mh-install-promo').first();
      const present = await inline.count() > 0;
      const below = present && await inline.evaluate(el => el.getBoundingClientRect().top > innerHeight);
      ok('install offered: the Home install card is in the page, below the first screen', present && below, JSON.stringify({ present, below }));
      const shown = await waitCard(p, 11000);
      const kind = shown ? await card(p).locator('h2').textContent() : '';
      ok('with that card off screen, the notification card can appear (never a floating install card on its page)', kind === 'Stay updated.', kind);
      await inline.scrollIntoViewIfNeeded();
      ok('scrolling the install card into view: the floating card steps aside (never two on screen)', await waitGone(p, 3000));
      await sleep(4000);
      ok('and nothing floats beside the install card afterwards', (await card(p).count()) === 0);
      await ctx.close();
    }
    // 10. Layout from 320 px to 1280 px, and short Android screens: on screen, above the tab bar, no sideways scroll.
    for (const [w, h, label] of [[320, 568, '320x568'], [360, 640, '360x640'], [360, 560, '360x560-short-android'], [390, 844, '390x844'], [430, 932, '430x932'], [768, 1024, '768x1024'], [1280, 800, '1280x800']]) {
      const phone = w < 768;
      const ctx = await context(b, { viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, deviceScaleFactor: 2 }, { storage: FOLLOWING });
      const p = await ctx.newPage(); await p.goto(BASE + '/data');
      const shown = await waitCard(p, 11000);
      const box = shown && await card(p).boundingBox();
      const nav = phone ? await p.locator('.mh-bottom-nav').boundingBox().catch(() => null) : null;
      const header = await p.locator('header').first().boundingBox().catch(() => null);
      const overflow = await p.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1);
      const targets = shown ? await card(p).evaluate(el => [...el.querySelectorAll('button, a')].map(x => { const r = x.getBoundingClientRect(); return { name: x.textContent.trim() || x.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height) }; })) : [];
      const small = targets.filter(t => t.h < 40 || t.w < 40);
      ok(`${label}: on screen${phone ? ', above the tab bar' : ''}, below the header, no sideways scroll, touch targets ≥ 40 px`, shown && box.y >= (header ? header.y + header.height - 1 : 0) && box.y + box.height <= h + 0.5 && (!nav || box.y + box.height <= nav.y + 1) && !overflow && small.length === 0, JSON.stringify({ box, nav, small }));
      if (shown) { await card(p).screenshot({ path: `${OUT}/v2-card-${label}.png` }); if ([320, 390].includes(w) || label.includes('short')) await p.screenshot({ path: `${OUT}/v2-page-${label}.png` }); }
      await ctx.close();
    }
    const deliveries = (await db.query(`SELECT COUNT(*)::int AS c FROM ${N}.deliveries`)).rows[0].c - deliveriesBefore;
    ok('no delivery was queued or attempted during this review', deliveries === 0, String(deliveries));
  } finally {
    await setPaused(pausedBefore).catch(() => {});
    await b.close(); await db.end();
  }
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length} passed`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(error => { console.error(error); process.exit(1); });
