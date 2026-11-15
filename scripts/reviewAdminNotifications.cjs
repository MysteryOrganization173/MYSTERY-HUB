// LOCAL ONLY. Mystery Hub 3.4-D browser review of the Admin Notification Center: status in plain words, the
// operator's own phone test (works while paused), the resume gate, audiences that count people and devices, approved
// pages, the announcement preview, test-before-send, confirmation, duplicate protection, history with filters, and
// laptop and phone layouts. Drives a local production build (default http://localhost:3111) started with SYNTHETIC
// push keys and the SIMULATED push provider (scripts/qa/simulatedPushProvider.cjs) against a disposable *_test
// database. "Tapping the notification" is simulated by the signed-in inbox lookup a real tap performs. Simulated
// acceptance proves the product and server logic, never delivery to or display on a phone.
// Each run creates its own synthetic Admin (signed in by session, like a returning operator) and customers.
//   REVIEW_DB=postgresql://... QA_PUSH_LOG=... [AXE_PATH=...] \
//     node scripts/reviewAdminNotifications.cjs [outDir]
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pg = require('pg');

const BASE = process.env.REVIEW_BASE || 'http://localhost:3111';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('Local review only.');
// Same database rules as the simulated provider (loopback, *_test, no redirecting parameters), without loading it here.
const localTestDatabase = value => { let url; try { url = new URL(value || ''); } catch { return false; } return ['postgres:', 'postgresql:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && /^\/[a-zA-Z0-9_]+_test$/.test(url.pathname) && [...url.searchParams.keys()].every(key => ['sslmode', 'connect_timeout', 'application_name'].includes(key)); };
if (!localTestDatabase(process.env.REVIEW_DB)) throw new Error('REVIEW_DB must be a local, disposable *_test database.');
const LOG = process.env.QA_PUSH_LOG; if (!LOG) throw new Error('QA_PUSH_LOG (the simulated provider log) is required.');
if (!fs.existsSync(`${LOG}.active`)) throw new Error('The server under review has not loaded the simulated push provider (no marker next to QA_PUSH_LOG). Nothing was done.');
const OUT = process.argv[2] || path.join(process.cwd(), 'tmp-review-34d'); fs.mkdirSync(OUT, { recursive: true });
const AXE = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : null;
const db = new pg.Pool({ connectionString: process.env.REVIEW_DB, ssl: false });
const N = 'mysteryhub_notifications';
const results = [];
const ok = (name, pass, detail = '') => { results.push(!!pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + String(detail).slice(0, 260) : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const sha = t => crypto.createHash('sha256').update(t.trim()).digest('hex');
const run = Date.now().toString(36), word = run.replace(/[0-9]/g, d => 'abcdefghij'[d]);
const sub = id => { const ec = crypto.createECDH('prime256v1'); return { endpoint: `https://fcm.googleapis.com/fcm/send/QA-D-${run}-${id}`, keys: { p256dh: ec.generateKeys().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } }; };
const api = async (p, token, method = 'GET', body) => { const r = await fetch(`${BASE}/api/${p}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; };
const pushes = () => fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const waitPushes = async (pred, ms = 30000) => { const start = Date.now(); while (Date.now() - start < ms) { const hits = pushes().filter(pred); if (hits.length) return hits; await sleep(1000); } return []; };
const text = async p => (await p.locator('main').innerText()).replace(/\s+/g, ' ');
const axe = async (p, selector) => {
  if (!AXE) return null;
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async sel => { const r = await window.axe.run(document.querySelector(sel) || document, { resultTypes: ['violations'] }); return r.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 30).map(n => `${n.target.join(' ')} [${(n.any[0]?.message || '').replace(/\s+/g, ' ').slice(0, 90)}]`).join(' | ')}`); }, selector);
};
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const tail = id => `QA-D-${run}-${id}`.slice(-14);

(async () => {
  const b = await chromium.launch();
  const tokens = { c1: crypto.randomBytes(24).toString('hex'), c2: crypto.randomBytes(24).toString('hex'), admin: crypto.randomBytes(24).toString('hex'), browser: crypto.randomBytes(24).toString('hex') };
  try {
    // Fixtures (local disposable database). Sending starts paused and unverified, like production today.
    // Earlier runs' synthetic sessions end (their devices go with them), and no earlier phone check counts.
    await db.query(`UPDATE ${N}.settings SET paused=TRUE WHERE id=TRUE`);
    await db.query("DELETE FROM sessions WHERE id LIKE 'qa-d-%'");
    await db.query(`UPDATE ${N}.events SET opened_at=NULL WHERE operator_test`);
    const admin = { id: `qa-d-${run}-admin` };
    await db.query("INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,'fixture','admin')", [admin.id, `QA Admin ${word}`, `${admin.id}@example.test`]);
    await db.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+interval '1 day')", [`qa-d-${run}-admin-browser`, admin.id, sha(tokens.browser)]);
    const users = { c1: `qa-d-${run}-c1`, c2: `qa-d-${run}-c2` };
    for (const [k, id] of Object.entries(users)) {
      await db.query("INSERT INTO users(id,name,password_hash,role) VALUES($1,$2,'fixture','customer')", [id, `QA customer ${k}`]);
      await db.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+interval '1 day')", [`qa-d-${run}-${k}`, id, sha(tokens[k])]);
    }
    await db.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+interval '1 day')", [`qa-d-${run}-admin-phone`, admin.id, sha(tokens.admin)]);
    const reg = [
      await api('notifications/subscriptions', tokens.c1, 'PUT', { subscription: sub('c1a'), consent: { purposes: ['transactional', 'marketing'], copyVersion: 'invite-3.4-1' } }),
      await api('notifications/subscriptions', tokens.c1, 'PUT', { subscription: sub('c1b') }),
      await api('notifications/subscriptions', tokens.c2, 'PUT', { subscription: sub('c2'), consent: { purposes: ['transactional'], copyVersion: 'invite-3.4-orders' } }),
      await api('notifications/subscriptions', tokens.admin, 'PUT', { subscription: sub('admin') }),
      await api('notifications/guest', null, 'PUT', { subscription: sub('g1'), consent: { purposes: ['marketing'], copyVersion: 'invite-3.4-guest' } }),
      await api('notifications/guest', null, 'PUT', { subscription: sub('GONE-g2'), consent: { purposes: ['marketing'], copyVersion: 'invite-3.4-guest' } }),
    ];
    ok('fixture: synthetic customers, the operator’s phone and two visitor browsers registered through the API', reg.every(r => r.status === 200), reg.map(r => r.status).join(','));
    const health = async () => (await api('admin/notifications/health', tokens.admin)).json;

    ok('resume is refused by the server before any phone check', (await api('admin/notifications/settings', tokens.admin, 'PUT', { paused: false, confirmed: true, reason: 'Trying to resume early' })).status === 409);
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route(/fcm\.googleapis\.com|whatsapp\.com|wa\.me|t\.me/, route => route.abort());
    await ctx.addInitScript(token => { try { localStorage.setItem('mystery_hub_session_token', token); } catch {} }, tokens.browser);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/admin#notifications`); await p.getByRole('heading', { name: 'Status' }).waitFor({ timeout: 20000 });

    // 1. Status: plain words, the server's own numbers, paused, not yet checked on a phone.
    let h = await health(), body = await text(p);
    ok('status: keys and switch in plain words, never the keys', /Push keys are set up/.test(body) && /The sending switch is on/.test(body) && !body.includes(h.publicKey || 'BPUBLIC'), '');
    ok('status: paused, with own tests still allowed', /Sending is paused/.test(body) && /Your own tests still work/.test(body));
    ok('status: devices versus accounts match the server', body.includes(`${h.liveDevices} devices on ${h.liveAccounts} accounts can receive`) || body.includes(`${h.liveDevices} device on`), `${h.liveDevices}/${h.liveAccounts}`);
    ok('status: customers who chose news match the server (people and devices)', body.includes(`${h.announcementCustomers} customer`) && body.includes(`${h.announcementDevices} device`), `${h.announcementCustomers}/${h.announcementDevices}`);
    ok('status: visitor browsers counted separately', body.includes(`${h.guestBrowsers} visitor browser`), String(h.guestBrowsers));
    ok('status: not checked on a phone; resume disabled until it is', /Not checked on a phone yet/.test(body) && await p.getByRole('button', { name: 'Resume sending' }).isDisabled());
    await p.screenshot({ path: `${OUT}/status-paused-unverified-1280.png`, fullPage: false });
    const v1 = await axe(p, 'main'); if (v1) { ok('axe: Notifications page at 1280 (serious/critical)', v1.length === 0, `${v1.length} rule(s)`); if (v1.length) fs.writeFileSync(`${OUT}/axe-1280.txt`, v1.join('\n')); }

    // 2. The operator's test: only their own device, while paused; then a (simulated) tap on that phone.
    const before = pushes().length;
    await p.getByRole('button', { name: 'Send a test to my devices' }).click();
    await p.getByText(/Test sent to your 1 device/).waitFor({ timeout: 10000 });
    ok('test: the server confirms one device (the operator’s own)', true);
    const testPush = await waitPushes(x => x.endpointTail === tail('admin') && x.payload.kind === 'account');
    const after = pushes().slice(before);
    ok('test: the simulated push service got exactly one message, for the operator’s phone only, while paused', testPush.length === 1 && after.length === 1, JSON.stringify(after.map(x => x.endpointTail)));
    ok('test: the lock screen text is generic (the private account path)', testPush[0]?.payload.body === 'An account update is available. Sign in to view it.');
    const open = testPush[0]?.payload.open;
    ok('test: the push carries a one-off open token', /^[A-Za-z0-9_-]{43}$/.test(open || ''));
    ok('test: another account cannot open it, even with the token', (await api(`notifications/inbox/${testPush[0]?.payload.notificationId}?open=${open}`, tokens.c1)).status === 404);
    await api(`notifications/inbox/${testPush[0]?.payload.notificationId}`, tokens.admin);
    await p.getByRole('button', { name: 'Refresh' }).first().click(); await sleep(1500);
    ok('test: opening the link without the token does not count as a phone check', await p.getByRole('button', { name: 'Resume sending' }).isDisabled());
    // The tap: the service worker opens /orders?notification=…&open=…, and the signed-in app looks it up with the token.
    const tapped = await api(`notifications/inbox/${testPush[0]?.payload.notificationId}?open=${open}`, tokens.admin);
    ok('test: tapping it opens "Test notification" for the signed-in operator', tapped.status === 200 && tapped.json.notification.title === 'Test notification', JSON.stringify(tapped.json));
    await p.getByRole('button', { name: 'Refresh' }).first().click(); await p.getByText('Checked on your phone.').waitFor({ timeout: 15000 });
    ok('status: checked on your phone; resume now available', !(await p.getByRole('button', { name: 'Resume sending' }).isDisabled()));
    await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: `${OUT}/status-checked-1280.png` });

    // 3. Resume needs a reason and an explicit approval.
    await p.getByRole('button', { name: 'Resume sending' }).click();
    const dialog = p.getByRole('dialog');
    await dialog.getByText('This turns on live delivery for real customers.').waitFor();
    ok('resume: confirmation explains what happens and is disabled until a reason and approval are given', await dialog.getByRole('button', { name: 'Resume sending' }).isDisabled());
    await dialog.locator('input').first().fill('Phone checked in the local review');
    await dialog.getByRole('checkbox').check();
    await p.screenshot({ path: `${OUT}/resume-confirm-1280.png` });
    await dialog.getByRole('button', { name: 'Resume sending' }).click(); await dialog.waitFor({ state: 'detached', timeout: 10000 });
    await p.getByText('Sending is live').waitFor({ timeout: 10000 });
    ok('resume: the server is live and the change is audited', (await one(`SELECT paused FROM ${N}.settings WHERE id=TRUE`)).paused === false
      && !!(await one("SELECT 1 AS x FROM admin_audit_log WHERE action='notification_pause_changed' AND metadata_safe_json LIKE '%Phone checked in the local review%'")));

    // 4. Compose: save the wording, choose a page and an audience, check the preview, test it on my devices first.
    const title = `Fresh bundles ${word}`, message = 'New data bundles are available in {{appName}} today.';
    await p.locator('#notif-title').fill(title); await p.locator('#notif-body').fill(message);
    await p.getByRole('button', { name: 'Save draft template' }).click(); await p.getByRole('button', { name: new RegExp(title) }).first().waitFor({ timeout: 10000 });
    await p.getByLabel(/Opens when tapped/).selectOption('/data');
    await p.getByRole('radio', { name: /^Customers who chose news and offers/ }).check();
    body = await text(p); h = await health();
    ok('compose: customers and devices counted separately', body.includes(`${h.announcementCustomers} customer${h.announcementCustomers === 1 ? '' : 's'} · ${h.announcementDevices} device`), `${h.announcementCustomers}/${h.announcementDevices}`);
    ok('compose: the preview shows the announcement’s own text and page', (await p.getByLabel('Notification preview').last().innerText()).includes('New data bundles are available in Mystery Hub today.') && /Opens: Data bundles/.test(body));
    ok('compose: only approved pages can be chosen', JSON.stringify(await p.getByLabel(/Opens when tapped/).locator('option').allInnerTexts()) === JSON.stringify(['Home', 'Data bundles', 'All services', 'Marketplace', 'Mystery Earn']));
    const beforeTest = pushes().length;
    await p.getByRole('button', { name: 'Send to my devices first' }).click(); await p.getByText(/Sent to your 1 device only/).waitFor({ timeout: 10000 });
    const announceTest = await waitPushes(x => x.endpointTail === tail('admin') && x.payload.kind === 'announcement' && x.payload.title === title);
    ok('compose: the test of this announcement went to my device only, with its text and page', announceTest.length === 1 && announceTest[0].payload.url === '/data' && pushes().slice(beforeTest).every(x => x.endpointTail === tail('admin')));
    await p.getByRole('button', { name: 'Refresh' }).first().click(); await sleep(1500);
    ok('compose: testing an announcement does not undo the phone check', await p.getByText('Checked on your phone.').isVisible());
    await p.screenshot({ path: `${OUT}/compose-1280.png`, fullPage: true });

    // 5. Review and send: the server's count, the breakdown, the page, an explicit acknowledgement.
    await p.getByRole('button', { name: 'Review and send' }).click();
    const sheet = p.getByRole('dialog', { name: 'Send this notification?' }); await sheet.waitFor();
    const sheetText = (await sheet.innerText()).replace(/\s+/g, ' ');
    ok('confirm: recipients, people and devices, and the page are shown', /Recipients now/.test(sheetText) && /Made up of/.test(sheetText) && /Opens Data bundles/.test(sheetText) && /customer/.test(sheetText), sheetText.slice(0, 220));
    ok('confirm: no claim of personal details in placeholders', !/their own details/.test(sheetText) && /never personal details/.test(sheetText));
    ok('confirm: send is disabled until the acknowledgement is ticked', await sheet.getByRole('button', { name: /^Send to/ }).isDisabled());
    await sheet.getByRole('checkbox').check();
    await p.screenshot({ path: `${OUT}/confirm-1280.png` });
    const beforeSend = pushes().length;
    await sheet.getByRole('button', { name: /^Send to/ }).click();
    await p.getByText('Message handed to the server').waitFor({ timeout: 10000 });
    const sent = await waitPushes(x => x.payload.kind === 'announcement' && x.payload.title === title && x.endpointTail !== tail('admin'));
    await sleep(1500);
    const tails = pushes().slice(beforeSend).filter(x => x.payload.title === title).map(x => x.endpointTail).sort();
    ok('send: only customers who chose news received it, on each of their devices', tails.includes(tail('c1a')) && tails.includes(tail('c1b')) && !tails.includes(tail('c2')) && !tails.includes(tail('g1')), JSON.stringify(tails));
    ok('send: the payload carries the approved page and no personal data', sent.every(x => x.payload.url === '/data' && !/qa-d-|QA customer/.test(JSON.stringify(x.payload))));
    await p.screenshot({ path: `${OUT}/sent-1280.png` });

    // 6. Duplicate protection: the same announcement to the same audience from a fresh preview is refused.
    await p.getByRole('button', { name: 'Write another message' }).click();
    await p.getByRole('button', { name: new RegExp(title) }).first().click();
    await p.getByLabel(/Opens when tapped/).selectOption('/data');
    await p.getByRole('radio', { name: /^Customers who chose news and offers/ }).check();
    await p.getByRole('button', { name: 'Review and send' }).click();
    const again = p.getByRole('dialog', { name: 'Send this notification?' }); await again.waitFor();
    await again.getByRole('checkbox').check(); await again.getByRole('button', { name: /^Send to/ }).click();
    await again.getByText(/already queued from an earlier review|already received this announcement/).waitFor({ timeout: 10000 });
    ok('duplicate: a second send of the same announcement is refused in plain words', true);
    await again.getByRole('button', { name: 'Cancel' }).click();

    // 7. Visitors who chose news: their own count; a browser that unsubscribed is removed and explained.
    await p.getByRole('radio', { name: /^Visitors who chose news/ }).check();
    await p.getByLabel(/Opens when tapped/).selectOption('/marketplace');
    await p.getByRole('button', { name: 'Review and send' }).click();
    const guestSheet = p.getByRole('dialog', { name: 'Send this notification?' }); await guestSheet.waitFor();
    ok('visitors: counted as browsers', /visitor browser/.test((await guestSheet.innerText()).replace(/\s+/g, ' ')));
    await guestSheet.getByRole('checkbox').check(); await guestSheet.getByRole('button', { name: /^Send to/ }).click();
    await p.getByText('Message handed to the server').waitFor({ timeout: 10000 });
    await waitPushes(x => x.endpointTail === tail('GONE-g2') && x.payload.url === '/marketplace');
    await sleep(2500);
    ok('visitors: the unsubscribed browser was removed with evidence', !(await one(`SELECT 1 AS x FROM ${N}.guest_devices WHERE endpoint_hash=$1`, [sha(sub('x').endpoint.replace(/x$/, 'GONE-g2'))]))
      && !!(await one(`SELECT 1 AS x FROM ${N}.consents WHERE source='guest_endpoint_expired' AND created_at>NOW()-interval '5 minutes'`)));

    // 8. History: grouped, filtered, explained per device, never an endpoint.
    await p.goto(`${BASE}/admin#notifications/history`); await p.getByRole('button', { name: 'Announcements' }).waitFor();
    await p.getByText(title).first().waitFor({ timeout: 15000 });
    await p.screenshot({ path: `${OUT}/history-1280.png`, fullPage: true });
    await p.getByLabel('Filter by result').selectOption('invalid'); await sleep(1500);
    const filtered = await text(p);
    ok('history: the result filter keeps only announcements with an expired browser', filtered.includes(title) && /Expired or invalid/.test(filtered));
    await p.locator('li button').filter({ hasText: title }).first().click();
    const detail = p.getByRole('dialog'); await detail.getByText('Each device').waitFor({ timeout: 10000 });
    const detailText = (await detail.innerText()).replace(/\s+/g, ' ');
    ok('history detail: problems explained in plain words', /no longer subscribed, so it was removed/.test(detailText));
    ok('history detail: each device listed, visitor browsers marked', /Visitor browser/.test(detailText), detailText.slice(detailText.indexOf('Each device'), detailText.indexOf('Each device') + 160));
    ok('history detail: no endpoints or customer ids', !/fcm\.googleapis|QA-D-|qa-d-[a-z0-9]+-c\d/.test(detailText));
    await p.screenshot({ path: `${OUT}/history-detail-1280.png` });
    await detail.getByRole('button', { name: 'Done' }).click();
    await p.getByLabel('Filter by result').selectOption('');
    await p.getByRole('button', { name: 'Tests' }).click(); await p.getByText('You opened it from the notification at', { exact: false }).first().waitFor({ timeout: 10000 });
    ok('history: tests show when the operator opened one from its notification', true);
    await p.screenshot({ path: `${OUT}/history-tests-1280.png`, fullPage: true });
    ok('history: no endpoint or customer id anywhere on the page', !/fcm\.googleapis|QA-D-|qa-d-[a-z0-9]+-c\d/.test(await p.content()));

    // 9. Templates: the internal test wording is not offered as a template; automatic ones are locked.
    await p.goto(`${BASE}/admin#notifications/templates`); await p.getByRole('heading', { name: 'Saved templates' }).waitFor();
    const templatesText = await text(p);
    ok('templates: automatic templates are locked; the internal test wording is not listed', /Automatic · locked/.test(templatesText) && !/This is a test from Mystery Hub Admin/.test(templatesText));

    // 10. Laptop and phone layouts, including a short phone with the confirmation open.
    await p.goto(`${BASE}/admin#notifications`); await p.getByRole('heading', { name: 'Status' }).waitFor();
    for (const width of [1440, 1280, 768, 430, 390, 360, 320]) {
      await p.setViewportSize({ width, height: width < 768 ? 844 : 900 }); await sleep(700);
      const extra = await overflow(p);
      ok(`layout ${width}px: no sideways scrolling`, extra <= 1, `${extra}px`);
      await p.screenshot({ path: `${OUT}/notifications-${width}.png`, fullPage: true });
    }
    await p.setViewportSize({ width: 390, height: 640 });
    await p.locator('#notif-title').fill(title); await p.locator('#notif-body').fill(message);
    await p.getByRole('button', { name: new RegExp(title) }).first().click();
    await p.getByRole('radio', { name: /^Visitors who chose news/ }).check();
    await p.getByRole('button', { name: 'Review and send' }).click();
    const short = p.getByRole('dialog', { name: 'Send this notification?' }); await short.waitFor();
    const footerVisible = await short.getByRole('button', { name: 'Cancel' }).isVisible();
    ok('short phone (390×640): the confirmation footer stays on screen', footerVisible);
    await p.screenshot({ path: `${OUT}/confirm-390x640.png` });
    const v2 = await axe(p, 'dialog[open]'); if (v2) ok('axe: confirmation sheet at 390 (serious/critical)', v2.length === 0, v2.join(', '));
    await short.getByRole('button', { name: 'Cancel' }).click();
    await p.setViewportSize({ width: 390, height: 844 });
    const v3 = await axe(p, 'main'); if (v3) { ok('axe: Notifications page at 390 (serious/critical)', v3.length === 0, `${v3.length} rule(s)`); if (v3.length) fs.writeFileSync(`${OUT}/axe-390.txt`, v3.join('\n')); }

    // 11. Pause again; the server is paused and the next test still works.
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.getByRole('button', { name: 'Pause sending' }).click();
    const pause = p.getByRole('dialog'); await pause.locator('input').first().fill('End of the local review'); await pause.getByRole('checkbox').check();
    await pause.getByRole('button', { name: 'Pause sending' }).click();
    const paused = p.getByText('Nothing goes to customers or visitors. Your own tests still work.');
    // Error recovery: if the Admin rate limit answers first, the dialog says so, nothing changes, and a retry works.
    const limited = await Promise.race([paused.waitFor({ timeout: 15000 }).then(() => false), pause.getByText(/Too many requests/).waitFor({ timeout: 15000 }).then(() => true)]).catch(() => null);
    if (limited) {
      ok('pause: a rate-limited attempt is explained in the dialog and changes nothing', (await one(`SELECT paused FROM ${N}.settings WHERE id=TRUE`)).paused === false);
      await p.screenshot({ path: `${OUT}/pause-rate-limited.png` });
      await sleep(61000); await pause.getByRole('button', { name: 'Pause sending' }).click();
    }
    try { await paused.waitFor({ timeout: 15000 }); }
    catch (error) { await p.screenshot({ path: `${OUT}/pause-failed.png` }); throw new Error(`pause did not complete: ${(await pause.innerText().catch(() => 'dialog closed')).replace(/\s+/g, ' ').slice(0, 300)}`); }
    ok('pause: the server is paused again', (await one(`SELECT paused FROM ${N}.settings WHERE id=TRUE`)).paused === true);
    await ctx.close();
  } catch (error) {
    ok('review ran to the end', false, error && error.stack);
  } finally {
    await db.query(`UPDATE ${N}.settings SET paused=TRUE WHERE id=TRUE`).catch(() => {});
    await b.close(); await db.end();
    const passed = results.filter(Boolean).length;
    console.log(`\n${passed}/${results.length} checks passed`);
    process.exit(passed === results.length ? 0 : 1);
  }
})();
