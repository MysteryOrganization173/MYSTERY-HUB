/*
 * Mystery Gifts 3.7.2: real-browser review of the DORMANT gift components. LOCAL ONLY, SYNTHETIC DATA ONLY.
 *
 * Runs Playwright Chromium against the review fixture (scripts/review/giftsReview.html) served by a LOCAL Vite dev
 * server:  DISABLE_HMR=true npx vite --port 5174 --strictPort --host 127.0.0.1
 * The fixture makes no server calls; its catalogue and price quote are fixed synthetic answers. No payment, order,
 * greeting or supplier request exists anywhere in this review. This is browser emulation, not physical-device testing.
 *
 *   GIFTS_REVIEW_BASE_URL  default http://127.0.0.1:5174 (must be loopback)
 *   GIFTS_REVIEW_OUT       screenshots folder (default /tmp/mystery-gifts-review)
 *   GIFTS_REVIEW_MARK      optional PNG served in place of the Cloudinary brand mark (offline sandboxes)
 *   GIFTS_REVIEW_AXE       optional path to axe.min.js for the accessibility audit
 *   GIFTS_REVIEW_ONLY      optional regular expression to run some checks only
 *
 * Requires Playwright (not a project dependency). Exit code 1 if any check fails.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = (process.env.GIFTS_REVIEW_BASE_URL || 'http://127.0.0.1:5174').replace(/\/$/, '');
const OUT = process.env.GIFTS_REVIEW_OUT || '/tmp/mystery-gifts-review';
const MARK = process.env.GIFTS_REVIEW_MARK || '';
const AXE = process.env.GIFTS_REVIEW_AXE || '';
const ONLY = process.env.GIFTS_REVIEW_ONLY ? new RegExp(process.env.GIFTS_REVIEW_ONLY) : null;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('Refusing a non-loopback server.');
fs.mkdirSync(OUT, { recursive: true });
const FIXTURE = `${BASE}/scripts/review/giftsReview.html`;
const ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const STATUSES = ['pending', 'delivered', 'review', 'undeliverable', 'status_unavailable'];
const results = [];
async function check(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  try { await fn(); results.push([true, name]); console.log(`PASS  ${name}`); }
  catch (e) { results.push([false, name]); console.log(`FAIL  ${name}\n      ${String(e && e.message || e).split('\n')[0]}`); }
}
const assert = (ok, message) => { if (!ok) throw new Error(message); };
/** Focus moves on the next frame; wait briefly for it instead of racing it. */
const focused = (page, test) => page.waitForFunction(test, null, { timeout: 2000 }).then(() => true, () => false);

let browser;
async function open(query, { width = 390, height = 844, scale = 1, reduced = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, userAgent: ANDROID, isMobile: width < 600, hasTouch: width < 600, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const requests = [];
  page.on('request', r => { const u = new URL(r.url()); if (!/^(127\.0\.0\.1|localhost)$/.test(u.hostname) && !/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname) && u.hostname !== 'res.cloudinary.com') requests.push(r.url()); if (/\/api\//.test(u.pathname)) requests.push(r.url()); });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (MARK) await page.route('https://res.cloudinary.com/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(MARK) }));
  await page.goto(`${FIXTURE}?${query}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  page.requests = requests; page.errors = errors;
  return page;
}
const shot = async (page, name, opts = {}) => { await page.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 82, ...opts }); };
const noOverflow = async page => { const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert(o <= 0, `horizontal overflow ${o}px`); };
const clean = page => { assert(!page.errors.length, `page errors: ${page.errors.join('; ')}`); assert(!page.requests.length, `unexpected requests: ${page.requests.join(', ')}`); };
async function axe(page, label) {
  if (!AXE) return;
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes[0]?.target })));
  const bad = r.filter(v => v.impact === 'serious' || v.impact === 'critical');
  assert(!bad.length, `${label}: ${JSON.stringify(bad)}`);
  if (r.length) console.log(`      axe (${label}) minor: ${r.map(v => `${v.id}×${v.n}`).join(', ')}`);
}
async function openLetter(page) {
  await page.locator('.mg-gift-button').click();
  await page.locator('.mg-after').waitFor();
  await page.waitForTimeout(1300); // the letter settles, then what follows it fades in once
}

(async () => {
  browser = await chromium.launch();

  await check('recipient: the gift tag follows the letter and names nothing until opened', async () => {
    const page = await open('view=recipient&status=delivered&sender=Kojo', { scale: 2 });
    await openLetter(page);
    const tag = page.locator('.mgg-tag');
    await tag.scrollIntoViewIfNeeded();
    const t = await page.locator('.mgg-gift').innerText();
    assert(/a little extra surprise/i.test(t) && !/5GB|Delivered|MTN/.test(t), t);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await shot(page, '01-recipient-tag-390.jpg');
    clean(page); await noOverflow(page); await axe(page, 'tag');
    await page.context().close();
  });

  for (const status of STATUSES) await check(`recipient: ${status} card reads accurately, with no private detail`, async () => {
    const sender = status === 'review' || status === 'undeliverable' ? '' : '&sender=Kojo';
    const page = await open(`view=recipient&status=${status}${sender}`, { scale: 2 });
    await openLetter(page);
    await page.getByRole('button', { name: /reveal your extra gift/i }).click();
    const card = page.locator('.mgg-card');
    await card.waitFor();
    assert(await focused(page, () => document.activeElement?.classList.contains('mgg-allowance')), 'focus moves to the gift heading');
    const t = await card.innerText();
    assert(/5GB/.test(t) && /Data Gift/.test(t) && /MTN/.test(t), t);
    assert((/^Delivered$/m.test(t)) === (status === 'delivered'), `"Delivered" only when delivered: ${t}`);
    assert(!/GH₵|refund|payment|paystack|reference|\d{4}/i.test(t), `private or financial detail: ${t}`);
    assert(sender ? /Kojo/.test(t) : /Your mystery sender/.test(t), `sender line: ${t}`);
    await page.waitForTimeout(700);
    await card.evaluate(el => el.scrollIntoView({ block: 'end' }));
    await page.evaluate(() => window.scrollBy(0, 40));
    await shot(page, `02-recipient-${status}-390.jpg`);
    if (status === 'status_unavailable') {
      await page.getByRole('button', { name: /check again/i }).click();
      await page.locator('.mgg-card[data-status="pending"]').waitFor();
    }
    clean(page); await noOverflow(page); await axe(page, status);
    await page.context().close();
  });

  await check('recipient: keyboard opens the gift tag and lands on the gift', async () => {
    const page = await open('view=recipient&status=pending');
    await openLetter(page);
    const button = page.getByRole('button', { name: /reveal your extra gift/i });
    await button.focus();
    await page.keyboard.press('Enter');
    await page.locator('.mgg-card').waitFor();
    assert(await focused(page, () => document.activeElement?.classList.contains('mgg-allowance')), 'focus on heading');
    await page.context().close();
  });

  await check('recipient: New Year starlight and Telecel take on their own look; reduced motion holds still', async () => {
    const page = await open('view=recipient&status=pending&occasion=new-year-2027&variant=gift-starlight-v1&network=telecel&allowance=10GB', { scale: 2, reduced: true });
    await openLetter(page);
    await page.getByRole('button', { name: /reveal your extra gift/i }).click();
    const card = page.locator('.mgg-card');
    await card.waitFor();
    const anim = await card.evaluate(el => getComputedStyle(el).animationName);
    assert(anim === 'none', `reduced motion animation ${anim}`);
    assert(/Telecel/.test(await card.innerText()), 'network');
    await card.evaluate(el => el.scrollIntoView({ block: 'end' }));
    await page.evaluate(() => window.scrollBy(0, 40));
    await shot(page, '03-recipient-newyear-telecel-390.jpg');
    clean(page);
    await page.context().close();
  });

  await check('recipient: 320 px and desktop widths keep the card whole', async () => {
    for (const [w, h, name] of [[320, 640, '04-recipient-320.jpg'], [1280, 900, '05-recipient-1280.jpg']]) {
      const page = await open('view=recipient&status=delivered&sender=Akua%20Serwaa%20Mensah-Boateng&allowance=100GB', { width: w, height: h, scale: w > 600 ? 1 : 2 });
      await openLetter(page);
      await page.getByRole('button', { name: /reveal your extra gift/i }).click();
      await page.locator('.mgg-card').waitFor();
      await page.waitForTimeout(700);
      await noOverflow(page);
      const box = await page.locator('.mgg-card').boundingBox();
      assert(box.x >= 0 && box.x + box.width <= w, `card fits at ${w}`);
      await page.locator('.mgg-card').evaluate(el => el.scrollIntoView({ block: 'end' }));
      await page.evaluate(() => window.scrollBy(0, 40));
      await shot(page, name);
      await page.context().close();
    }
  });

  await check('sender: the choice defaults to free and moves with the keyboard', async () => {
    const page = await open('view=choice', { scale: 2 });
    const free = page.getByRole('radio', { name: /send a free greeting/i }), gift = page.getByRole('radio', { name: /attach a data gift/i });
    assert(await free.isChecked() && !(await gift.isChecked()), 'free by default');
    await page.locator('.mgg-choice').scrollIntoViewIfNeeded();
    await shot(page, '06-sender-choice-390.jpg');
    await free.focus(); await page.keyboard.press('ArrowDown');
    assert(await gift.isChecked(), 'arrow selects the gift option');
    assert(/then choose the gift/.test(await page.locator('[data-fixture-notice]').innerText()), 'fixture follows the choice');
    clean(page); await noOverflow(page); await axe(page, 'choice');
    await page.context().close();
  });

  await check('sender: choosing a bundle, checking the number twice and reviewing the server price', async () => {
    const page = await open('view=picker', { scale: 2 });
    await shot(page, '07-sender-picker-390.jpg', { fullPage: true });
    // Nothing chosen: errors, and focus goes to the first problem.
    await page.getByRole('button', { name: /review gift/i }).click();
    assert(await focused(page, () => document.activeElement?.id === 'mgg-field-product'), 'focus on the bundle choice');
    assert(await page.getByText('Choose a bundle.').isVisible(), 'bundle error');
    await page.locator('.mgg-net-option', { hasText: 'Telecel' }).click();
    const tel = await page.locator('.mgg-bundles').innerText();
    assert(/5GB/.test(tel) && !/10GB/.test(tel), `Telecel bundles only: ${tel}`);
    await page.locator('.mgg-net-option', { hasText: 'MTN' }).click();
    await page.locator('.mgg-bundle', { hasText: '5GB' }).click();
    await page.getByLabel('Their mobile number').fill('0245550187');
    await page.getByLabel('Type their number again').fill('0245550178');
    assert(await page.getByLabel('Their mobile number').inputValue() === '024 555 0187', 'number grouped as typed');
    await page.getByRole('button', { name: /review gift/i }).click();
    assert(await page.getByText(/two numbers don’t match/).isVisible(), 'mismatch caught');
    assert(await focused(page, () => document.activeElement?.id === 'mgg-field-confirm'), 'focus on the confirmation');
    await shot(page, '08-sender-picker-errors-390.jpg', { fullPage: true });
    await page.getByLabel('Type their number again').fill('+233 24 555 0187');
    await page.getByRole('button', { name: /review gift/i }).click();
    await page.getByText(/Checking today’s price/).waitFor();
    assert(await page.getByRole('button', { name: /continue to payment/i }).isDisabled(), 'no payment before the server price');
    await page.getByText('GH₵27.00').waitFor();
    assert(await page.getByRole('button', { name: /continue to payment/i }).isEnabled(), 'enabled after the price');
    assert(await focused(page, () => document.activeElement?.id === 'mgg-review-title'), 'focus on the review heading');
    await page.getByRole('button', { name: /change gift/i }).click();
    assert(await page.getByRole('radio', { name: /5GB/ }).isChecked(), 'the selection is kept');
    assert(await page.getByLabel('Their mobile number').inputValue() === '024 555 0187', 'the number is kept');
    clean(page); await noOverflow(page); await axe(page, 'picker');
    await page.context().close();
  });

  for (const [quote, name] of [['ready', '09-sender-review-390.jpg'], ['changed', '10-sender-review-price-changed-390.jpg']]) await check(`sender: review (${quote})`, async () => {
    const page = await open(`view=review&quote=${quote}&hidden=1`, { scale: 2 });
    const t = await page.locator('.mgg-picker').innerText();
    assert(/Total\s+GH₵2[78]\.00/.test(t), t);
    assert((quote === 'changed') === /price has changed/.test(t), 'price change note');
    assert(/name stays hidden/.test(t), 'anonymity note');
    await page.getByRole('button', { name: /continue to payment/i }).click();
    assert(/Nothing is connected here/.test(await page.locator('[data-fixture-notice]').innerText()), 'fixture notice only');
    await page.locator('[data-fixture-notice]').evaluate(el => el.remove());
    await shot(page, name, { fullPage: true });
    clean(page); await noOverflow(page); await axe(page, `review-${quote}`);
    await page.context().close();
  });

  await check('sender: no bundles or a failed catalogue still leaves the free greeting one tap away', async () => {
    for (const [view, name] of [['empty', '11-sender-no-gifts-390.jpg'], ['failed', '12-sender-catalogue-failed-390.jpg']]) {
      const page = await open(`view=${view}`, { scale: 2 });
      assert(await page.getByRole('button', { name: /send without a gift/i }).isVisible(), 'free path');
      await shot(page, name);
      clean(page); await axe(page, view);
      await page.context().close();
    }
  });

  await check('sender: with the keyboard open (short screen) the focused field stays in view', async () => {
    const page = await open('view=picker', { height: 420 });
    const input = page.getByLabel('Type their number again');
    await input.tap();
    await page.waitForTimeout(600);
    const box = await input.boundingBox();
    assert(box.y >= 0 && box.y + box.height <= 420, `field visible: ${JSON.stringify(box)}`);
    await page.context().close();
  });

  await check('sender: 320 px picker and review fit', async () => {
    for (const view of ['picker', 'review&quote=ready']) {
      const page = await open(`view=${view}`, { width: 320, height: 640 });
      await noOverflow(page);
      await page.context().close();
    }
  });

  await browser.close();
  const failed = results.filter(r => !r[0]);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${OUT}`);
  process.exitCode = failed.length ? 1 : 0;
})().catch(async e => { console.error(e); try { await browser?.close(); } catch {} process.exitCode = 1; });
