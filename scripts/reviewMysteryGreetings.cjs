/*
 * Mystery Greetings V1: end-to-end acceptance review. LOCAL ONLY, synthetic data only.
 *
 * Runs real browsers (Playwright Chromium) against a LOCAL production build of the server, backed by a DISPOSABLE
 * PostgreSQL database with server/db/mysteryExperiences.sql installed. It refuses any non-loopback server or a
 * database whose name does not end in _test. It creates, opens, reports and removes synthetic greetings only.
 *
 *   GREETINGS_REVIEW_BASE_URL      default http://localhost:3110 (must be loopback)
 *   GREETINGS_REVIEW_DATABASE_URL  postgres://…@127.0.0.1:…/<name>_test (the same database the server uses)
 *   GREETINGS_REVIEW_ADMIN         "email:password" of the server's synthetic bootstrap Admin
 *   GREETINGS_REVIEW_OUT           screenshots folder (default /tmp/mystery-greetings-review)
 *   GREETINGS_REVIEW_AXE           optional path to axe.min.js for the accessibility audit
 *
 * Phases (start the server with matching gates first):
 *   node scripts/reviewMysteryGreetings.cjs open     MYSTERY_GREETING_LINKS_ENABLED=true, MYSTERY_GREETINGS_ENABLED=true
 *   node scripts/reviewMysteryGreetings.cjs closed   links on, creation off (existing links must still open)
 *   node scripts/reviewMysteryGreetings.cjs dark     both off (nothing opens)
 * Requires Playwright (not a project dependency). Exit code 1 if any check fails.
 */
const { chromium } = require('playwright');
const { Pool } = require('pg');
const fs = require('fs');
const crypto = require('crypto');

const BASE = (process.env.GREETINGS_REVIEW_BASE_URL || 'http://localhost:3110').replace(/\/$/, '');
const DB_URL = process.env.GREETINGS_REVIEW_DATABASE_URL || '';
const OUT = process.env.GREETINGS_REVIEW_OUT || '/tmp/mystery-greetings-review';
const PHASE = process.argv[2] || 'open';
const [ADMIN_EMAIL, ADMIN_PASSWORD] = (process.env.GREETINGS_REVIEW_ADMIN || '').split(/:(.*)/s);
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('Refusing a non-loopback server.');
const dbu = new URL(DB_URL);
if (!['127.0.0.1', 'localhost'].includes(dbu.hostname) || !/_test$/.test(dbu.pathname)) throw new Error('Refusing a database that is not a loopback *_test database.');
fs.mkdirSync(OUT, { recursive: true });
const db = new Pool({ connectionString: DB_URL, ssl: false });
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const results = [];
const tag = () => crypto.randomBytes(3).toString('hex').replace(/[0-9]/g, d => 'ghijklmnop'[d]);
const ONLY = process.env.GREETINGS_REVIEW_ONLY ? new RegExp(process.env.GREETINGS_REVIEW_ONLY) : null;
async function check(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  try { await fn(); results.push([true, name]); console.log(`PASS  ${name}`); }
  catch (e) { results.push([false, name]); console.log(`FAIL  ${name}\n      ${String(e && e.stack || e).split('\n').slice(0, 3).join('\n      ')}`); }
}
function ok(condition, message) { if (!condition) throw new Error(message); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

let browser;
async function context(opts = {}) {
  const { width = 390, height = 844, ua = ANDROID, ...rest } = opts;
  return browser.newContext({ viewport: { width, height }, userAgent: ua, deviceScaleFactor: 1, ...rest });
}
async function waitStep(page, title) { await page.getByRole('heading', { name: title }).first().waitFor({ timeout: 15000 }); }
const overflow = page => page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1);

/** Drive the real creator UI from /greetings to the share screen. Returns the canonical link and its ID. */
/** Every review creation comes from one local address, so the synthetic quota rows are cleared first (disposable DB only). */
const freshQuota = () => db.query("DELETE FROM mysteryhub_experiences.budgets WHERE scope LIKE 'create%'");
/** The server also allows 15 creation requests a minute per address (in memory): the review paces itself under that. */
const recent = [];
async function pace() { while (recent.length >= 7 && Date.now() - recent[0] < 61000) await sleep(61000 - (Date.now() - recent[0])); recent.push(Date.now()); while (recent.length > 7) recent.shift(); }
async function createViaUI(page, o) {
  if (!o.keepQuota) await freshQuota();
  await pace();
  await page.goto(`${BASE}/greetings?occasion=${o.occasion || 'christmas-2026'}`);
  await waitStep(page, 'Wrap a little surprise');
  if (o.variant === 'gift-starlight-v1') await page.getByRole('radio', { name: /Starlight/ }).check({ force: true });
  await page.getByRole('button', { name: 'Continue' }).click();
  await waitStep(page, 'Your message');
  await page.getByLabel('Who is it for?').fill(o.to);
  // Tap the visible option, as a person does (a forced check on the hidden input can land under the sticky actions at 320 px).
  if (o.message !== undefined) { await page.getByText('Write my own', { exact: true }).click(); if (!(await page.getByRole('radio', { name: 'Write my own' }).isChecked())) throw new Error('Write my own did not select'); await page.getByRole('textbox', { name: 'Write your own message' }).fill(o.message); }
  else await page.getByRole('radio', { name: new RegExp(o.template || 'Heartwarming') }).first().check({ force: true });
  if (o.from) await page.getByLabel(/Your name/).fill(o.from);
  if (o.hidden) await page.getByRole('checkbox', { name: 'Keep me a mystery' }).check({ force: true });
  await page.getByRole('button', { name: /^Preview/ }).click();
  await waitStep(page, 'Preview');
  if (o.beforeCreate) await o.beforeCreate(page);
  if (!(await page.locator('#mg-done-title').count())) await page.getByRole('button', { name: 'Wrap my greeting' }).click();
  await settle(page);
  const url = await page.locator('#mg-link').inputValue();
  return { url, shareId: url.split('/g/')[1] };
}
/** Wait for the confirmed link. If the server's per-minute limit answers first, wait a minute and tap Try again, as a
 *  person would; the same idempotency key is reused, so this can never make a second greeting. */
async function settle(page) {
  for (let round = 0; round < 3; round++) {
    const done = page.locator('#mg-done-title'), busy = page.getByText(/Lots of greetings are being wrapped right now/);
    const outcome = await Promise.race([done.waitFor({ timeout: 25000 }).then(() => 'done', () => 'timeout'), busy.waitFor({ timeout: 25000 }).then(() => 'busy', () => 'timeout')]);
    if (outcome === 'done' || await done.count()) return;
    if (outcome !== 'busy') throw new Error('No confirmed link and no explanation');
    console.log('      (the server\'s per-minute creation limit answered; waiting a minute, then Try again)');
    await sleep(61000); await freshQuota();
    await page.getByRole('button', { name: 'Try again' }).click();
  }
  throw new Error('Still limited after three minutes');
}
/** Open a link the way a recipient would, in a different browser (fresh storage), and reveal it. */
async function openAsRecipient(shareId, opts = {}) {
  const ctx = await context({ ua: DESKTOP, width: 390, height: 844, ...opts });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/g/${shareId}`);
  return { ctx, page };
}
async function reveal(page) {
  await page.getByRole('button', { name: /Open your (gift|surprise)/ }).click();
  await page.locator('.mg-stage[data-state="open"]').waitFor({ timeout: 6000 });
}
async function axe(page, label) {
  if (!process.env.GREETINGS_REVIEW_AXE) return;
  await page.addScriptTag({ path: process.env.GREETINGS_REVIEW_AXE });
  const found = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0]?.target })));
  const serious = found.filter(v => v.impact === 'serious' || v.impact === 'critical');
  fs.appendFileSync(`${OUT}/axe.json`, JSON.stringify({ label, found }) + '\n');
  ok(serious.length === 0, `${label}: ${JSON.stringify(serious)}`);
}

async function phaseOpen() {
  const created = {};
  await check('full chain: creator → server save → link → another browser → reveal → Create your own (Christmas, Classic, curated, named sender)', async () => {
    const ctx = await context(); const page = await ctx.newPage();
    const to = `Ama ${tag()}`;
    const { url, shareId } = await createViaUI(page, { to, from: 'Kofi', template: 'Heartwarming' });
    ok(url === `https://mysterybundlehub.com/g/${shareId}`, url);
    const row = await one('SELECT id,recipient_name,sender_name,show_sender,template_id,message,variant,occasion FROM mysteryhub_experiences.greetings WHERE share_id=$1', [shareId]);
    ok(row && row.recipient_name === to && row.sender_name === 'Kofi' && row.template_id === 'christmas-warm-v1' && row.occasion === 'christmas-2026', JSON.stringify(row));
    await page.screenshot({ path: `${OUT}/creator-done-390.png`, fullPage: true });
    created.first = { shareId, id: row.id, to };
    const r = await openAsRecipient(shareId);
    ok(/A Christmas gift for/i.test(await r.page.locator('.mg-sealed').innerText()), 'sealed heading');
    ok((await r.page.locator('.mg-from').innerText()) === 'From Kofi', 'sender shown');
    ok(await r.page.locator('.mg-letter').getAttribute('aria-hidden') === 'true', 'letter waits until opened');
    await reveal(r.page);
    const letter = await r.page.locator('.mg-letter').innerText();
    ok(letter.includes(row.message) && letter.includes(to), letter);
    ok(await r.page.evaluate(() => document.activeElement?.classList.contains('mg-letter-title')), 'focus moves to the letter');
    await r.page.getByRole('button', { name: 'Create your own greeting' }).click();
    await waitStep(r.page, 'Wrap a little surprise');
    ok(await r.page.getByRole('radio', { name: /Christmas/ }).isChecked(), 'same occasion preselected');
    ok(!r.page.url().includes(shareId), 'the received link never appears in the creator URL');
    const remix = await createViaUI(r.page, { to: `Kojo ${tag()}`, message: 'Thank you for the surprise. Merry Christmas!' }).catch(e => { throw e; });
    // createViaUI navigates again with the occasion query, so the remix context is carried by the tab, not the URL.
    const child = await one('SELECT parent_id FROM mysteryhub_experiences.greetings WHERE share_id=$1', [remix.shareId]);
    ok(child, 'remix greeting saved');
    await ctx.close(); await r.ctx.close();
  });

  await check('Create your own carries the received greeting as context (parent) when analytics is allowed, without putting it in the URL', async () => {
    const r = await openAsRecipient(created.first.shareId, { ua: ANDROID });
    await reveal(r.page);
    await r.page.getByRole('button', { name: 'Create your own greeting' }).click();
    await waitStep(r.page, 'Wrap a little surprise');
    ok(!r.page.url().includes(created.first.shareId), r.page.url());
    await r.page.getByRole('button', { name: 'Continue' }).click();
    await r.page.getByLabel('Who is it for?').fill(`Yaa ${tag()}`);
    await r.page.getByRole('radio', { name: /Family/ }).check({ force: true });
    await r.page.getByRole('button', { name: /^Preview/ }).click();
    await r.page.getByRole('button', { name: 'Wrap my greeting' }).click();
    await r.page.locator('#mg-done-title').waitFor();
    const id = (await r.page.locator('#mg-link').inputValue()).split('/g/')[1];
    const child = await one('SELECT parent_id FROM mysteryhub_experiences.greetings WHERE share_id=$1', [id]);
    ok(child.parent_id === created.first.id, JSON.stringify(child));
    await r.ctx.close();
  });

  await check('New Year, Starlight, custom message with line breaks, emoji and Ghanaian names, hidden sender (name typed, then hidden)', async () => {
    const ctx = await context(); const page = await ctx.newPage();
    const to = `Ɛfua Ɔboɔ 🎉 ${tag()}`, message = 'Afehyia pa! 🎆\nMay 2027 bring you peace.\n\nWith love from Accra ❤️';
    const { shareId } = await createViaUI(page, { occasion: 'new-year-2027', variant: 'gift-starlight-v1', to, message, from: 'Kwame Secret', hidden: true });
    const row = await one('SELECT recipient_name,sender_name,show_sender,message,variant FROM mysteryhub_experiences.greetings WHERE share_id=$1', [shareId]);
    ok(row.recipient_name === to && row.sender_name === null && row.show_sender === false && row.message === message && row.variant === 'gift-starlight-v1', JSON.stringify(row));
    const api = await (await fetch(`${BASE}/api/experiences/greetings/${shareId}`)).text();
    ok(!api.includes('Kwame'), 'a hidden sender never leaves the browser');
    const r = await openAsRecipient(shareId);
    ok(/A New Year surprise for/i.test(await r.page.locator('.mg-sealed').innerText()), 'New Year wording');
    ok(await r.page.getByText('From a mystery sender').first().isVisible(), 'mystery sender');
    await r.page.screenshot({ path: `${OUT}/recipient-newyear-sealed-390.png` });
    await reveal(r.page);
    const shown = await r.page.locator('.mg-letter-message').innerText();
    ok(shown === message, `line breaks preserved: ${JSON.stringify(shown)}`);
    await r.page.locator('.mg-countdown-grid').waitFor({ timeout: 8000 });
    ok(!(await r.page.content()).includes('Kwame'), 'no hidden sender in the page');
    await r.page.waitForTimeout(400);
    await r.page.screenshot({ path: `${OUT}/recipient-newyear-open-390.png`, fullPage: true });
    created.newYear = { shareId };
    await ctx.close(); await r.ctx.close();
  });

  await check('a 600-character message with paragraphs is readable in full, never clipped, at 320 px', async () => {
    const paragraph = 'Near or far, you are close to my heart and I am grateful for every laugh we shared this year. ';
    let message = ''; while (Array.from(message + paragraph).length < 590) message += paragraph;
    message = (message.trim() + '\n\nAyekoo!').slice(0, 600);
    const ctx = await context({ width: 320, height: 568 }); const page = await ctx.newPage();
    const { shareId } = await createViaUI(page, { to: `Nana Akosua Serwaa Boatemaa ${tag()}`, message, from: 'Auntie Esi' });
    ok(Array.from((await one('SELECT message FROM mysteryhub_experiences.greetings WHERE share_id=$1', [shareId])).message).length <= 600, 'stored within bounds');
    const r = await openAsRecipient(shareId, { width: 320, height: 568 });
    await reveal(r.page);
    const clip = await r.page.evaluate(() => { const l = document.querySelector('.mg-letter'); const m = document.querySelector('.mg-letter-message'); return { letter: l.scrollHeight - l.clientHeight, msgW: m.scrollWidth - m.clientWidth, page: document.scrollingElement.scrollWidth - innerWidth }; });
    ok(clip.letter <= 1 && clip.msgW <= 1 && clip.page <= 1, JSON.stringify(clip));
    await r.page.screenshot({ path: `${OUT}/recipient-long-320.png`, fullPage: true });
    await ctx.close(); await r.ctx.close();
  });

  await check('empty and invalid fields: specific messages, focus on the first problem, nothing typed is lost', async () => {
    const ctx = await context({ width: 360, height: 640 }); const page = await ctx.newPage();
    await page.goto(`${BASE}/greetings`); await waitStep(page, 'Wrap a little surprise');
    await page.getByRole('button', { name: 'Continue' }).click(); await waitStep(page, 'Your message');
    await page.getByRole('button', { name: /^Preview/ }).click();
    ok(await page.getByText('Add the name of the person this greeting is for.').isVisible(), 'empty name');
    ok(await page.waitForFunction(() => document.activeElement?.id === 'mg-field-recipient', null, { timeout: 2000 }).then(() => true, () => false), 'focus on the name');
    await page.getByLabel('Who is it for?').fill('<b>Ama</b>');
    await page.getByRole('radio', { name: 'Write my own' }).check({ force: true });
    await page.getByRole('textbox', { name: 'Write your own message' }).fill('Visit www.example.com for more');
    await page.getByRole('button', { name: /^Preview/ }).click();
    ok(await page.getByText(/Remove the < and > signs from their name/).isVisible(), 'markup');
    ok(await page.getByText(/Links can’t be included/).isVisible(), 'link');
    await page.getByRole('textbox', { name: 'Write your own message' }).fill('x'.repeat(601));
    ok(/601 \/ 600/.test(await page.locator('#mg-count').innerText()), 'counter');
    await page.getByLabel('Who is it for?').fill('Ama');
    await page.getByRole('button', { name: /^Preview/ }).click();
    ok(await page.getByText(/Keep your message to 600 characters/).isVisible(), 'too long');
    ok((await page.getByRole('textbox', { name: 'Write your own message' }).inputValue()).length === 601, 'kept what was typed');
    await page.getByRole('textbox', { name: 'Write your own message' }).fill('Merry Christmas, my friend!');
    await page.getByRole('button', { name: /^Preview/ }).click(); await waitStep(page, 'Preview');
    await page.screenshot({ path: `${OUT}/creator-preview-360.png`, fullPage: true });
    await ctx.close();
  });

  await check('combined emoji are split (as the server requires) and the creator is told', async () => {
    const ctx = await context(); const page = await ctx.newPage();
    await page.goto(`${BASE}/greetings`); await waitStep(page, 'Wrap a little surprise');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Who is it for?').fill('The Mensahs 👨‍👩‍👧');
    await page.getByRole('radio', { name: /Family/ }).check({ force: true });
    await page.getByRole('button', { name: /^Preview/ }).click(); await waitStep(page, 'Preview');
    ok((await page.locator('.mg-name').first().innerText()).includes('👨👩👧'), 'split in preview');
    await page.getByRole('button', { name: 'Back' }).click(); await waitStep(page, 'Your message');
    ok(await page.getByText(/combined emoji/).isVisible(), 'notice');
    await ctx.close();
  });

  await check('browser Back and on-screen Back move between steps and keep the draft; refresh keeps it too', async () => {
    const ctx = await context(); const page = await ctx.newPage();
    await page.goto(`${BASE}/greetings?occasion=new-year-2027`); await waitStep(page, 'Wrap a little surprise');
    await page.getByRole('radio', { name: /Starlight/ }).check({ force: true });
    await page.getByRole('button', { name: 'Continue' }).click(); await waitStep(page, 'Your message');
    await page.getByLabel('Who is it for?').fill('Esi');
    await page.getByRole('radio', { name: 'Write my own' }).check({ force: true });
    await page.getByRole('textbox', { name: 'Write your own message' }).fill('Line one\nLine two');
    await page.getByLabel(/Your name/).fill('Kwame');
    await page.getByRole('button', { name: /^Preview/ }).click(); await waitStep(page, 'Preview');
    await page.goBack(); await waitStep(page, 'Your message');
    ok(await page.getByLabel('Who is it for?').inputValue() === 'Esi' && await page.getByRole('textbox', { name: 'Write your own message' }).inputValue() === 'Line one\nLine two', 'kept after Back');
    await page.goBack(); await waitStep(page, 'Wrap a little surprise');
    ok(await page.getByRole('radio', { name: /Starlight/ }).isChecked() && await page.getByRole('radio', { name: /New Year/ }).isChecked(), 'design kept');
    await page.goForward(); await waitStep(page, 'Your message');
    await page.reload(); await waitStep(page, 'Your message');
    ok(await page.getByLabel(/Your name/).inputValue() === 'Kwame', 'kept after refresh');
    await page.getByRole('button', { name: /^Preview/ }).click(); await waitStep(page, 'Preview');
    await page.reload(); await waitStep(page, 'Preview');
    await page.getByRole('button', { name: 'Back' }).click(); await waitStep(page, 'Your message');
    ok(await page.getByRole('textbox', { name: 'Write your own message' }).inputValue() === 'Line one\nLine two', 'on-screen Back after refresh');
    await ctx.close();
  });

  await check('a draft follows the occasion of the link that opened the creator, keeping what was typed', async () => {
    const ctx = await context(); const page = await ctx.newPage();
    await page.goto(`${BASE}/greetings?occasion=christmas-2026`); await waitStep(page, 'Wrap a little surprise');
    await page.getByRole('button', { name: 'Continue' }).click(); await waitStep(page, 'Your message');
    await page.getByLabel('Who is it for?').fill('Kojo');
    await page.getByRole('radio', { name: /Family/ }).check({ force: true });
    await page.goto(`${BASE}/greetings?occasion=new-year-2027`); await waitStep(page, 'Wrap a little surprise');
    ok(await page.getByRole('radio', { name: /New Year/ }).isChecked(), 'the link’s occasion wins');
    await page.getByRole('button', { name: 'Continue' }).click(); await waitStep(page, 'Your message');
    ok(await page.getByLabel('Who is it for?').inputValue() === 'Kojo', 'the name is kept');
    ok(!(await page.locator('input[name="mg-template"]:checked').count()), 'a Christmas message is not carried into New Year');
    await page.goto(`${BASE}/greetings`); await waitStep(page, 'Your message');
    ok(await page.getByRole('radiogroup', { name: 'New Year messages' }).isVisible() && await page.getByLabel('Who is it for?').inputValue() === 'Kojo', 'a plain visit restores the draft where it was');
    await ctx.close();
  });

  await check('network interruption: offline create shows no success; retry creates exactly one greeting', async () => {
    const ctx = await context(); const page = await ctx.newPage(); const to = `Offline ${tag()}`;
    const result = await createViaUI(page, { to, template: 'Friendship', beforeCreate: async p => {
      await ctx.setOffline(true);
      await p.getByRole('button', { name: 'Wrap my greeting' }).click();
      await p.getByText(/We couldn’t confirm your greeting/).waitFor();
      ok(!(await p.locator('#mg-done-title').count()), 'no success while offline');
      ok((await one('SELECT count(*)::int n FROM mysteryhub_experiences.greetings WHERE recipient_name=$1', [to])).n === 0, 'nothing saved');
      await ctx.setOffline(false);
      await p.getByRole('button', { name: 'Try again' }).click();
      await p.locator('#mg-done-title').waitFor();
    } }).catch(async e => { if (await page.locator('#mg-done-title').count()) return null; throw e; });
    ok(result === null || result, 'flow');
    ok((await one('SELECT count(*)::int n FROM mysteryhub_experiences.greetings WHERE recipient_name=$1', [to])).n === 1, 'exactly one');
    await ctx.close();
  });

  await check('lost response: the server saved it, the answer never arrived; Try again returns the same greeting (no duplicate)', async () => {
    const ctx = await context(); const page = await ctx.newPage(); const to = `Lost ${tag()}`;
    let lost = null, second = null;
    await page.route('**/api/experiences/greetings', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      if (!lost) { const resp = await route.fetch(); lost = await resp.json(); return route.abort('connectionreset'); }
      const resp = await route.fetch(); second = { status: resp.status(), body: await resp.json() }; return route.fulfill({ response: resp, json: second.body });
    });
    await page.goto(`${BASE}/greetings`); await waitStep(page, 'Wrap a little surprise');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Who is it for?').fill(to);
    await page.getByRole('radio', { name: /Funny/ }).check({ force: true });
    await page.getByRole('button', { name: /^Preview/ }).click(); await waitStep(page, 'Preview');
    await page.getByRole('button', { name: 'Wrap my greeting' }).click();
    await page.getByText(/We couldn’t confirm your greeting/).waitFor();
    ok(lost && lost.shareId, 'the server did save it');
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.locator('#mg-done-title').waitFor();
    ok(second.status === 200 && second.body.duplicate === true && second.body.shareId === lost.shareId, JSON.stringify(second));
    ok((await page.locator('#mg-link').inputValue()).endsWith(lost.shareId), 'same link');
    ok((await one('SELECT count(*)::int n FROM mysteryhub_experiences.greetings WHERE recipient_name=$1', [to])).n === 1, 'exactly one');
    await ctx.close();
  });

  await check('multiple rapid taps send one request and save one greeting', async () => {
    const ctx = await context(); const page = await ctx.newPage(); const to = `Rapid ${tag()}`; let posts = 0;
    page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/api/experiences/greetings')) posts++; });
    await createViaUI(page, { to, template: 'Romantic', beforeCreate: async p => {
      await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Wrap my greeting/.test(x.textContent)); for (let i = 0; i < 6; i++) b.click(); });
      await p.locator('#mg-done-title').waitFor();
    } }).catch(async e => { if (await page.locator('#mg-done-title').count()) return; throw e; });
    ok(posts === 1, `posts=${posts}`);
    ok((await one('SELECT count(*)::int n FROM mysteryhub_experiences.greetings WHERE recipient_name=$1', [to])).n === 1, 'one row');
    await ctx.close();
  });

  await check('duplicate prevention: the same greeting again (new attempt) within ten minutes is refused, kindly', async () => {
    const ctx = await context(); const page = await ctx.newPage(); const to = `Twice ${tag()}`;
    await createViaUI(page, { to, template: 'Family', from: 'Kofi' });
    await page.getByRole('button', { name: 'Create another' }).click();
    await waitStep(page, 'Wrap a little surprise');
    await page.getByRole('button', { name: 'Continue' }).click();
    ok(await page.getByLabel(/Your name/).inputValue() === 'Kofi', 'sender name kept for the next greeting');
    await page.getByLabel('Who is it for?').fill(to);
    await page.getByRole('radio', { name: /Family/ }).check({ force: true });
    await page.getByRole('button', { name: /^Preview/ }).click(); await waitStep(page, 'Preview');
    await page.getByRole('button', { name: 'Wrap my greeting' }).click();
    await page.getByText(/You just made this exact greeting/).waitFor();
    ok((await one('SELECT count(*)::int n FROM mysteryhub_experiences.greetings WHERE recipient_name=$1', [to])).n === 1, 'still one');
    await ctx.close();
  });

  await check('anonymous creation is bounded: over the hourly limit the creator is asked to wait, nothing is saved, and the draft is kept', async () => {
    const ctx = await context(); const page = await ctx.newPage(); const to = `Limit ${tag()}`;
    await createViaUI(page, { to: `Warm-up ${tag()}`, template: 'Heartwarming' });
    await createViaUI(page, { to, template: 'Heartwarming', keepQuota: true, beforeCreate: async p => {
      // This browser's durable hourly creation budget (20) is filled in the disposable database.
      ok((await db.query("UPDATE mysteryhub_experiences.budgets SET hits=20 WHERE scope LIKE 'create:%'")).rowCount >= 1, 'budget row present');
      await p.getByRole('button', { name: 'Wrap my greeting' }).click();
      await p.getByText(/Lots of greetings are being wrapped right now/).waitFor();
      ok((await one('SELECT count(*)::int n FROM mysteryhub_experiences.greetings WHERE recipient_name=$1', [to])).n === 0, 'nothing saved');
      await freshQuota();
      await p.getByRole('button', { name: 'Try again' }).click();
      await p.locator('#mg-done-title').waitFor();
    } }).catch(async e => { if (await page.locator('#mg-done-title').count()) return; throw e; });
    ok((await one('SELECT count(*)::int n FROM mysteryhub_experiences.greetings WHERE recipient_name=$1', [to])).n === 1, 'one after waiting');
    await ctx.close();
  });

  await check('private browsing with blocked storage: creation works, and the page says management lasts only this visit', async () => {
    const ctx = await context();
    await ctx.addInitScript(() => { for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { get() { throw new DOMException('blocked', 'SecurityError'); } }); });
    const page = await ctx.newPage();
    const { shareId } = await createViaUI(page, { to: `Private ${tag()}`, template: 'Heartwarming' });
    ok(await page.getByText(/isn’t keeping site data, so you can remove it only until you close this page/).isVisible(), 'honest caveat');
    await page.getByRole('button', { name: 'Remove this greeting' }).click();
    await page.getByRole('dialog', { name: 'Remove this greeting?' }).getByRole('button', { name: 'Remove greeting' }).click();
    await page.getByText('Removed. The link no longer opens.').waitFor();
    ok((await fetch(`${BASE}/api/experiences/greetings/${shareId}`)).status === 404, 'removed');
    await ctx.close();
  });

  await check('copy link: copied when allowed (clipboard holds the link); when denied the link is selected and nothing claims success', async () => {
    const ctx = await context({ permissions: ['clipboard-read', 'clipboard-write'] }); const page = await ctx.newPage();
    const { url } = await createViaUI(page, { to: `Copy ${tag()}`, template: 'Heartwarming' });
    await page.getByRole('button', { name: 'Copy link' }).click();
    await page.getByText('Link copied.').waitFor();
    ok(await page.evaluate(() => navigator.clipboard.readText()) === url, 'clipboard');
    await ctx.close();
    const denied = await context();
    await denied.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) } }); document.execCommand = () => false; });
    const p2 = await denied.newPage();
    await createViaUI(p2, { to: `Denied ${tag()}`, template: 'Heartwarming' });
    await p2.getByRole('button', { name: 'Copy link' }).click();
    await p2.getByText(/Copying is blocked in this browser/).waitFor();
    ok(!(await p2.getByText('Link copied.').count()), 'no false claim');
    ok(await p2.evaluate(() => { const i = document.getElementById('mg-link'); return i.selectionStart === 0 && i.selectionEnd === i.value.length; }), 'link selected for manual copy');
    await denied.close();
  });

  await check('native share: hidden where unsupported; a cancelled share is never reported as sent', async () => {
    const ctx = await context(); const page = await ctx.newPage();
    await createViaUI(page, { to: `Share ${tag()}`, template: 'Heartwarming' });
    const supported = await page.evaluate(() => typeof navigator.share === 'function');
    ok(supported || !(await page.getByRole('button', { name: 'More ways to share' }).count()), 'no share button without Web Share');
    await ctx.close();
    const ctx2 = await context();
    await ctx2.addInitScript(() => { window.__shares = []; navigator.share = d => { window.__shares.push(d); return Promise.reject(new DOMException('cancelled', 'AbortError')); }; navigator.canShare = () => true; });
    const p2 = await ctx2.newPage();
    const { url } = await createViaUI(p2, { occasion: 'new-year-2027', to: `Share ${tag()}`, template: 'Elegant' });
    await p2.getByRole('button', { name: 'More ways to share' }).click(); await p2.waitForTimeout(300);
    const shares = await p2.evaluate(() => window.__shares);
    ok(shares.length === 1 && shares[0].url === url && !/Elegant|possibility/.test(shares[0].text), JSON.stringify(shares));
    ok(!(await p2.getByText(/\b(was sent|has been sent|delivered|Sent!|Shared!)/i).count()), 'nothing claims it was sent');
    await ctx2.close();
  });

  await check('WhatsApp: a tap-only wa.me link with a warm teaser and the encoded link, never the message, names or secret', async () => {
    const ctx = await context(); const page = await ctx.newPage(); let popups = 0; ctx.on('page', () => popups++);
    const to = `Akua ${tag()}`;
    const { url } = await createViaUI(page, { to, from: 'Kofi', message: 'A private note & a #hashtag?' });
    await page.waitForTimeout(800);
    ok(popups === 0, 'nothing opens by itself');
    const link = page.getByRole('link', { name: 'Share on WhatsApp' });
    const href = await link.getAttribute('href');
    ok(href.startsWith('https://wa.me/?text=') && await link.getAttribute('target') === '_blank' && /noopener/.test(await link.getAttribute('rel')), href);
    const text = decodeURIComponent(href.slice('https://wa.me/?text='.length));
    ok(text.endsWith(` ${url}`) && /Christmas surprise/.test(text), text);
    const secret = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_greetings_creator_v1')).token);
    for (const leak of [to, 'Kofi', 'private note', secret]) ok(!text.includes(leak) && !href.includes(encodeURIComponent(leak)), `leak: ${leak}`);
    await ctx.close();
  });

  await check('creator removal: only this browser can remove it; another browser cannot; the link then says unavailable', async () => {
    const ctx = await context(); const page = await ctx.newPage();
    const { shareId } = await createViaUI(page, { to: `Remove ${tag()}`, template: 'Heartwarming' });
    const stranger = crypto.randomBytes(32).toString('base64url');
    ok((await fetch(`${BASE}/api/experiences/greetings/${shareId}/revoke`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Greeting ${stranger}` }, body: '{}' })).status === 404, 'stranger refused');
    ok((await fetch(`${BASE}/api/experiences/greetings/${shareId}`)).status === 200, 'still open');
    await page.getByRole('button', { name: 'Remove this greeting' }).click();
    const dialog = page.getByRole('dialog', { name: 'Remove this greeting?' });
    await dialog.getByRole('button', { name: 'Keep it' }).click();
    ok((await fetch(`${BASE}/api/experiences/greetings/${shareId}`)).status === 200, 'Keep it keeps it');
    await page.getByRole('button', { name: 'Remove this greeting' }).click();
    await dialog.getByRole('button', { name: 'Remove greeting' }).click();
    await page.getByText('Removed. The link no longer opens.').waitFor();
    const r = await openAsRecipient(shareId);
    await r.page.getByRole('heading', { name: 'This greeting isn’t available' }).waitFor();
    ok(!(await r.page.content()).includes('Remove'), 'nothing personal on the error page');
    await r.page.screenshot({ path: `${OUT}/recipient-unavailable-390.png` });
    await ctx.close(); await r.ctx.close();
  });

  await check('removal with another browser’s secret never claims success, and offers to forget it on this device', async () => {
    const ctx = await context(); const page = await ctx.newPage();
    const { shareId } = await createViaUI(page, { to: `Mine ${tag()}`, template: 'Heartwarming' });
    await page.evaluate(token => localStorage.setItem('mh_greetings_creator_v1', JSON.stringify({ token })), crypto.randomBytes(32).toString('base64url'));
    await page.reload(); await page.locator('#mg-done-title').waitFor();
    await page.getByRole('button', { name: 'Remove this greeting' }).click();
    const dialog = page.getByRole('dialog', { name: 'Remove this greeting?' });
    await dialog.getByRole('button', { name: 'Remove greeting' }).click();
    await dialog.getByText(/This browser can’t remove it/).waitFor();
    ok(!(await page.getByText('Removed. The link no longer opens.').count()), 'never "Removed"');
    ok((await fetch(`${BASE}/api/experiences/greetings/${shareId}`)).status === 200, 'still open');
    await dialog.getByRole('button', { name: 'Forget it on this device' }).click();
    await page.getByText('Forgotten on this device. The link itself was not changed.').waitFor();
    await ctx.close();
  });

  await check('invalid, unknown and expired links: calm pages with a way back, and 404 heads without personal data', async () => {
    const ctx = await context(); const page = await ctx.newPage();
    for (const [path, title] of [['/g/short', 'This link looks incomplete'], ['/g', 'This link looks incomplete'], [`/g/${crypto.randomBytes(18).toString('base64url')}`, 'This greeting isn’t available']]) {
      const response = await page.goto(BASE + path);
      ok(response.status() === 404, `${path} → ${response.status()}`);
      await page.getByRole('heading', { name: title }).waitFor();
      ok(await page.getByRole('link', { name: 'Visit Mystery Hub' }).isVisible(), 'way back');
      ok(await page.getByRole('link', { name: 'Create a greeting' }).isVisible(), 'creator offered while creation is open');
    }
    await page.screenshot({ path: `${OUT}/recipient-malformed-390.png` });
    const c2 = await context(); const p2 = await c2.newPage();
    const { shareId } = await createViaUI(p2, { to: `Expired ${tag()}`, template: 'Heartwarming' });
    await db.query("UPDATE mysteryhub_experiences.greetings SET created_at=now()-interval '400 days',expires_at=now()-interval '1 day' WHERE share_id=$1", [shareId]);
    const html = await (await fetch(`${BASE}/g/${shareId}`)).text();
    ok(/<title>Greeting unavailable — Mystery Hub<\/title>/.test(html) && !/Expired/.test(html), 'expired head');
    await page.goto(`${BASE}/g/${shareId}`); await page.getByRole('heading', { name: 'This greeting isn’t available' }).waitFor();
    // Retention: an expired greeting older than 30 days makes the server refuse new ones until clean-up (Admin).
    await db.query("UPDATE mysteryhub_experiences.greetings SET expires_at=now()-interval '31 days' WHERE share_id=$1", [shareId]);
    created.retentionDue = shareId;
    await ctx.close(); await c2.close();
  });

  await check('Admin: readiness, totals, a reported greeting reviewed and removed with acknowledgement, clean-up run and audited', async () => {
    // A recipient reports a live greeting (reports never remove it by themselves).
    const g = await (async () => { await db.query("UPDATE mysteryhub_experiences.greetings SET revoked_at=coalesce(revoked_at,now()) WHERE share_id=$1", [created.retentionDue]); return created.first; })();
    await db.query("DELETE FROM mysteryhub_experiences.greetings WHERE share_id=$1", [created.retentionDue]);
    const r = await openAsRecipient(g.shareId);
    await reveal(r.page);
    await r.page.getByRole('button', { name: 'Report this greeting' }).click();
    const dialog = r.page.getByRole('dialog', { name: 'Report this greeting' });
    await dialog.getByRole('radio', { name: /spam or a scam/ }).check();
    await dialog.getByRole('button', { name: 'Send report' }).click();
    await dialog.getByText(/Thank you\. Mystery Hub will review this greeting\./).waitFor();
    ok((await one('SELECT count(*)::int n FROM mysteryhub_experiences.reports r JOIN mysteryhub_experiences.greetings g ON g.id=r.greeting_id WHERE g.share_id=$1', [g.shareId])).n === 1, 'report stored');
    ok((await fetch(`${BASE}/api/experiences/greetings/${g.shareId}`)).status === 200, 'still open after a report');
    await r.ctx.close();
    ok(ADMIN_EMAIL && ADMIN_PASSWORD, 'GREETINGS_REVIEW_ADMIN is required');
    const ctx = await context({ width: 1280, height: 900, ua: DESKTOP }); const page = await ctx.newPage();
    await page.goto(`${BASE}/admin`); await page.waitForLoadState('networkidle');
    await page.locator('input').first().fill(ADMIN_EMAIL); await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').first().click(); await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /System Health|^System$/ }).first().click();
    const panel = page.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Mystery Greetings' }) }).last();
    await page.getByText('Shared links working now').waitFor({ timeout: 15000 });
    const body = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    // 3.6.1: one verdict from what actually works, then the switches and the working-now checks, separately.
    ok(/Status: Live/.test(body) && /Links switch \(MYSTERY_GREETING_LINKS_ENABLED\) On/.test(body) && /Creation switch \(MYSTERY_GREETINGS_ENABLED\) On/.test(body)
      && /Shared links working now Yes/.test(body) && /New greetings accepted now Yes/.test(body)
      && /Abuse protection secret Configured/.test(body) && /Storage \(optional schema\) Installed/.test(body), body.slice(body.indexOf('Mystery Greetings'), body.indexOf('Mystery Greetings') + 600));
    ok(/Greetings created \d+/.test(body), 'totals');
    ok(!body.includes(g.to), 'no names or messages in Admin');
    await page.getByText(g.shareId).waitFor();
    await page.screenshot({ path: `${OUT}/admin-greetings-1280.png`, fullPage: true });
    const row = page.locator('li').filter({ hasText: g.shareId });
    await row.getByRole('button', { name: 'Remove' }).click();
    const confirm = page.getByRole('dialog');
    ok(await confirm.getByRole('button', { name: 'Remove greeting' }).isDisabled(), 'needs the acknowledgement');
    await confirm.getByRole('checkbox').check();
    await confirm.getByRole('button', { name: 'Remove greeting' }).click();
    await page.getByText(new RegExp(`Greeting ${g.shareId} was removed`)).waitFor();
    ok((await fetch(`${BASE}/api/experiences/greetings/${g.shareId}`)).status === 404, 'removed for everyone');
    ok((await one("SELECT count(*)::int n FROM admin_audit_log WHERE action='greeting_revoked'")).n >= 1, 'audited');
    await page.getByRole('button', { name: 'Run clean-up' }).click();
    await page.getByRole('dialog').getByRole('checkbox').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Run clean-up' }).click();
    await page.getByText(/Clean-up finished/).waitFor();
    ok((await one("SELECT count(*)::int n FROM admin_audit_log WHERE action='experience_retention'")).n >= 1, 'clean-up audited');
    await ctx.close();
  });

  await check('reduced motion: no idle or flying motion, the letter simply appears', async () => {
    const r = await openAsRecipient(created.newYear.shareId, { reducedMotion: 'reduce' });
    await r.page.getByRole('button', { name: /Open your surprise/ }).waitFor();
    ok(await r.page.evaluate(() => getComputedStyle(document.querySelector('.mg-gift-art')).animationName) === 'none', 'no idle bob');
    const t0 = Date.now();
    await reveal(r.page);
    ok(Date.now() - t0 < 1500, `opened in ${Date.now() - t0} ms`);
    await r.ctx.close();
  });

  await check('keyboard and screen reader: one labelled button opens it, focus lands on the greeting, dialogs trap focus', async () => {
    const r = await openAsRecipient(created.newYear.shareId);
    const gift = r.page.getByRole('button', { name: 'Open your surprise' });
    await gift.waitFor();
    for (let i = 0; i < 4 && !(await gift.evaluate(el => el === document.activeElement)); i++) await r.page.keyboard.press('Tab');
    ok(await gift.evaluate(el => el === document.activeElement), 'Tab reaches the gift');
    await r.page.keyboard.press('Enter');
    await r.page.locator('.mg-stage[data-state="open"]').waitFor();
    const focused = await r.page.evaluate(() => ({ tag: document.activeElement.tagName, text: document.activeElement.textContent }));
    ok(focused.tag === 'H1' || focused.tag === 'H2', JSON.stringify(focused));
    ok(/Happy New Year,/.test(focused.text), focused.text);
    await r.page.getByRole('button', { name: 'Report this greeting' }).click();
    await r.page.keyboard.press('Escape');
    ok(!(await r.page.getByRole('dialog').count()), 'Escape closes the dialog');
    await axe(r.page, 'recipient open');
    await r.ctx.close();
    const ctx = await context(); const page = await ctx.newPage();
    await page.goto(`${BASE}/greetings`); await waitStep(page, 'Wrap a little surprise');
    await axe(page, 'creator design');
    await page.getByRole('radio', { name: /Christmas/ }).focus(); await page.keyboard.press('ArrowRight');
    ok(await page.getByRole('radio', { name: /New Year/ }).isChecked(), 'arrow keys move between occasions');
    await page.getByRole('button', { name: 'Continue' }).focus(); await page.keyboard.press('Enter'); await waitStep(page, 'Your message');
    await page.getByLabel('Who is it for?').fill('Ama'); await page.keyboard.press('Enter');
    ok(await page.getByText('Pick a message, or write your own.').isVisible(), 'Enter submits and explains');
    await axe(page, 'creator message with errors');
    await ctx.close();
  });

  await check('keyboard never covers the step actions: they join the page flow while a field has focus (360 × 640)', async () => {
    const ctx = await context({ width: 360, height: 640 }); const page = await ctx.newPage();
    await page.goto(`${BASE}/greetings`); await waitStep(page, 'Wrap a little surprise');
    ok(await page.locator('.mg-step-actions').evaluate(el => getComputedStyle(el).position) === 'sticky', 'sticky while browsing');
    await page.getByRole('button', { name: 'Continue' }).click(); await waitStep(page, 'Your message');
    await page.getByLabel('Who is it for?').focus();
    ok(await page.locator('.mg-step-actions').evaluate(el => getComputedStyle(el).position) === 'static', 'in flow while typing');
    await page.getByLabel('Who is it for?').blur();
    ok(await page.locator('.mg-step-actions').evaluate(el => getComputedStyle(el).position) === 'sticky', 'back after typing');
    await ctx.close();
  });

  await check('analytics: interaction counts only, no personal data; Do Not Track sends nothing', async () => {
    const before = (await one("SELECT count(*)::int n FROM analytics_events WHERE entity_type='experience'")).n;
    const r = await openAsRecipient(created.newYear.shareId, { ua: ANDROID });
    await reveal(r.page); await r.page.waitForTimeout(800);
    const rows = (await db.query("SELECT event_name,visitor_id,metadata_json FROM analytics_events WHERE entity_type='experience' ORDER BY created_at DESC LIMIT 10")).rows;
    ok(rows.some(x => x.event_name === 'experience_greeting_open') && rows.some(x => x.event_name === 'experience_greeting_reveal'), JSON.stringify(rows.map(x => x.event_name)));
    ok(rows.every(x => JSON.stringify(x.metadata_json) === '{}' || x.metadata_json === '{}' || x.event_name === 'experience_greeting_created'), JSON.stringify(rows));
    await r.ctx.close();
    const mid = (await one("SELECT count(*)::int n FROM analytics_events WHERE entity_type='experience'")).n;
    ok(mid > before, 'counted');
    const dnt = await openAsRecipient(created.newYear.shareId, { ua: ANDROID, extraHTTPHeaders: { DNT: '1' } });
    await dnt.ctx.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { value: '1' }));
    await dnt.page.reload(); await reveal(dnt.page); await dnt.page.waitForTimeout(800);
    ok((await one("SELECT count(*)::int n FROM analytics_events WHERE entity_type='experience'")).n === mid, 'nothing with Do Not Track');
    await dnt.ctx.close();
  });

  await check('countdown: server time, re-synced on return to the page and on reconnect, after the reveal only', async () => {
    const r = await openAsRecipient(created.newYear.shareId, { ua: ANDROID });
    let syncs = 0; r.page.on('request', q => { if (q.url().endsWith('/api/experiences/countdown')) syncs++; });
    await r.page.getByRole('button', { name: 'Open your surprise' }).waitFor();
    ok(!(await r.page.locator('.mg-countdown').count()) && syncs === 0, 'nothing before the reveal');
    await reveal(r.page); await r.page.locator('.mg-countdown-grid').waitFor();
    const server = await (await fetch(`${BASE}/api/experiences/countdown`)).json();
    const shown = await r.page.locator('.mg-countdown-cell b').allInnerTexts();
    ok(Number(shown[0]) === Math.floor(Math.ceil(server.remainingMs / 1000) / 86400), `${shown} vs ${server.remainingMs}`);
    const n = syncs;
    await r.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await r.ctx.setOffline(true); await r.ctx.setOffline(false); await r.page.waitForTimeout(600);
    ok(syncs >= n + 2, `syncs ${n} → ${syncs}`);
    await r.ctx.close();
  });

  await check('public routes: /g head, OG image, canonical host, no personal data, recipient app, /greetings head, other routes intact', async () => {
    const id = created.newYear.shareId;
    const res = await fetch(`${BASE}/g/${id}`, { headers: { 'User-Agent': 'WhatsApp/2.23.20.0 A' } });
    const html = await res.text();
    ok(res.status === 200 && /no-store/.test(res.headers.get('cache-control')) && /noindex/.test(res.headers.get('x-robots-tag')), `${res.status} ${res.headers.get('cache-control')}`);
    const meta = k => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)"`)) || [])[1];
    ok(/<title>🎁 A special surprise is waiting for you\.<\/title>/.test(html), 'title');
    ok(meta('og:image') === 'https://mysterybundlehub.com/og/mystery-greetings-v1.jpg' && meta('og:image:width') === '1200' && meta('og:image:height') === '630', meta('og:image'));
    ok(meta('og:url') === `https://mysterybundlehub.com/g/${id}` && html.includes(`<link rel="canonical" href="https://mysterybundlehub.com/g/${id}" />`), 'canonical host');
    ok(meta('robots') === 'noindex, nofollow', 'noindex');
    const row = await one('SELECT recipient_name,message FROM mysteryhub_experiences.greetings WHERE share_id=$1', [id]);
    ok(!html.includes(row.recipient_name) && !html.includes(row.message.split('\n')[0]) && !html.includes('Kwame'), 'no personal data in the head');
    ok(/<div id="root"><\/div>/.test(html) && /<script type="module"[^>]+src="\/assets\/index-[^"]+\.js"/.test(html), 'the app loads');
    const img = await fetch(`${BASE}/og/mystery-greetings-v1.jpg`);
    const bytes = Buffer.from(await img.arrayBuffer());
    ok(img.status === 200 && img.headers.get('content-type') === 'image/jpeg' && bytes.length < 300000, `${img.status} ${img.headers.get('content-type')} ${bytes.length}`);
    const creator = await (await fetch(`${BASE}/greetings?occasion=new-year-2027`)).text();
    ok(/<title>Mystery Greetings — Wrap a Christmas or New Year greeting<\/title>/.test(creator) && creator.includes('<link rel="canonical" href="https://mysterybundlehub.com/greetings" />'), 'creator head');
    const missing = await fetch(`${BASE}/g/${crypto.randomBytes(18).toString('base64url')}`);
    ok(missing.status === 404 && /Greeting unavailable/.test(await missing.text()), 'unknown → 404');
    const site = await fetch(`${BASE}/sites/greetings-review-missing`);
    ok(site.status === 404 && /Website unavailable/.test(await site.text()), 'published-site route unchanged');
    const data = await fetch(`${BASE}/data`);
    ok(data.status === 200 && /Data &amp; Airtime — Mystery Hub Ghana/.test(await data.text()), 'other pages unchanged');
    const api = await (await fetch(`${BASE}/api/experiences/greetings/${id}`)).json();
    ok(JSON.stringify(Object.keys(api).sort()) === JSON.stringify(['expiresAt', 'message', 'occasion', 'recipientName', 'schemaVersion', 'senderName', 'shareId', 'variant']), Object.keys(api).join());
  });

  await check('responsive: every screen at eight sizes renders without sideways scrolling, hidden actions, clipping or broken art', async () => {
    const sizes = [[320, 568], [360, 640], [375, 667], [390, 844], [430, 932], [768, 1024], [1024, 768], [1440, 900]];
    const problems = [];
    for (const [w, h] of sizes) {
      const ctx = await context({ width: w, height: h, ua: w >= 768 ? DESKTOP : ANDROID }); const page = await ctx.newPage();
      const shot = async (name, full = false) => page.screenshot({ path: `${OUT}/matrix-${name}-${w}x${h}.png`, fullPage: full });
      const inView = async locator => locator.evaluate(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; });
      await page.goto(`${BASE}/greetings?occasion=christmas-2026`); await waitStep(page, 'Wrap a little surprise');
      if (await overflow(page)) problems.push(`${w} design overflow`);
      if (!(await inView(page.getByRole('button', { name: 'Continue' })))) problems.push(`${w} Continue not visible`);
      if ((await page.locator('.mg-design-art svg').first().boundingBox()).width < 40) problems.push(`${w} art`);
      await shot('creator-design');
      await page.getByRole('button', { name: 'Continue' }).click(); await waitStep(page, 'Your message');
      await page.getByLabel('Who is it for?').fill('Nana Akosua Serwaa'); await page.getByLabel('Who is it for?').blur();
      await page.getByRole('radio', { name: /Ghanaian/ }).check({ force: true });
      if (await overflow(page)) problems.push(`${w} message overflow`);
      if (!(await inView(page.getByRole('button', { name: /^Preview/ })))) problems.push(`${w} Preview not visible`);
      await shot('creator-message');
      await page.getByRole('button', { name: /^Preview/ }).click(); await waitStep(page, 'Preview');
      if (await overflow(page)) problems.push(`${w} preview overflow`);
      if (!(await inView(page.getByRole('button', { name: 'Wrap my greeting' })))) problems.push(`${w} Wrap not visible`);
      await shot('creator-preview');
      await page.getByRole('button', { name: 'Wrap my greeting' }).click(); await page.locator('#mg-done-title').waitFor();
      if (await overflow(page)) problems.push(`${w} done overflow`);
      await shot('creator-done', true);
      const id = (await page.locator('#mg-link').inputValue()).split('/g/')[1];
      const r = await ctx.newPage(); await r.goto(`${BASE}/g/${id}`);
      const pill = r.getByRole('button', { name: 'Open your gift' }); await pill.waitFor();
      await r.waitForTimeout(500);
      if (await overflow(r)) problems.push(`${w} sealed overflow`);
      if (!(await inView(r.locator('.mg-open-pill')))) problems.push(`${w} open button below the fold`);
      await r.screenshot({ path: `${OUT}/matrix-recipient-sealed-${w}x${h}.png` });
      await reveal(r); await r.waitForTimeout(400);
      if (await overflow(r)) problems.push(`${w} open overflow`);
      const clip = await r.evaluate(() => { const l = document.querySelector('.mg-letter'); return l.scrollHeight - l.clientHeight + (l.scrollWidth - l.clientWidth); });
      if (clip > 1) problems.push(`${w} letter clipped ${clip}`);
      await r.screenshot({ path: `${OUT}/matrix-recipient-open-${w}x${h}.png`, fullPage: true });
      await ctx.close();
    }
    ok(problems.length === 0, problems.join('; '));
  });
}

async function phaseClosed() {
  await check('creation off, links on: existing links still open; no creator offered; creating is refused by the server', async () => {
    const id = (await one("SELECT share_id FROM mysteryhub_experiences.greetings WHERE revoked_at IS NULL AND expires_at>now() ORDER BY created_at LIMIT 1")).share_id;
    const r = await openAsRecipient(id);
    await reveal(r.page);
    ok(!(await r.page.getByRole('button', { name: 'Create your own greeting' }).count()), 'no Create your own');
    ok(await r.page.getByRole('button', { name: 'Replay the surprise' }).isVisible(), 'replay still there');
    await r.page.screenshot({ path: `${OUT}/closed-recipient-open-390.png`, fullPage: true });
    await r.page.goto(`${BASE}/g/short`); await r.page.getByRole('heading', { name: 'This link looks incomplete' }).waitFor();
    ok(!(await r.page.getByRole('link', { name: 'Create a greeting' }).count()), 'no creator link on errors');
    await r.page.goto(`${BASE}/greetings`);
    await r.page.getByRole('heading', { name: 'Mystery Greetings isn’t open right now' }).waitFor();
    ok(!(await r.page.getByRole('button', { name: 'Continue' }).count()), 'no form');
    await r.page.screenshot({ path: `${OUT}/closed-creator-390.png` });
    const res = await fetch(`${BASE}/api/experiences/greetings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ occasion: 'christmas-2026', recipientName: 'Ama', showSender: false, templateId: 'christmas-warm-v1', variant: 'gift-classic-v1', creatorToken: crypto.randomBytes(32).toString('base64url'), idempotencyKey: crypto.randomUUID() }) });
    ok(res.status === 503 && (await res.json()).error.code === 'CREATION_DISABLED', 'refused');
    ok((await (await fetch(`${BASE}/api/seasonal/status`)).json()).greetings.createPath === null, 'homepages show Coming soon');
    await r.ctx.close();
  });
}

async function phaseDark() {
  await check('both gates off: no greeting opens (404 page and head), the creator is closed, nothing is offered', async () => {
    const id = (await one("SELECT share_id FROM mysteryhub_experiences.greetings WHERE revoked_at IS NULL AND expires_at>now() ORDER BY created_at LIMIT 1")).share_id;
    const head = await fetch(`${BASE}/g/${id}`);
    ok(head.status === 404 && /Greeting unavailable/.test(await head.text()), 'head 404');
    const r = await openAsRecipient(id);
    await r.page.getByRole('heading', { name: 'This greeting isn’t available' }).waitFor();
    await r.page.goto(`${BASE}/greetings`); await r.page.getByRole('heading', { name: 'Mystery Greetings isn’t open right now' }).waitFor();
    await r.ctx.close();
  });
}

(async () => {
  browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY || 'http://none', bypass: 'localhost,127.0.0.1' } });
  try { if (PHASE === 'open') await phaseOpen(); else if (PHASE === 'closed') await phaseClosed(); else if (PHASE === 'dark') await phaseDark(); else throw new Error('Unknown phase'); }
  finally { await browser.close(); await db.end(); }
  const passed = results.filter(([p]) => p).length;
  console.log(`\n${passed}/${results.length} checks passed (${PHASE}). Screenshots: ${OUT}`);
  process.exitCode = passed === results.length ? 0 : 1;
})().catch(e => { console.error(e); process.exit(1); });
