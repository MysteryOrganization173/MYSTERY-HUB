// Mystery Hub 3.6.4 · Christmas Grand Finale. Seasonal lifecycle across Accra boundaries, finite motion, scope, status-
// sensitive decoration, availability-aware service copy and the Admin readiness panel. Synthetic data only.
import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { seasonalRouter } from '../../routes/seasonalApi.js';
import { CHRISTMAS_2026, serverSeasonStatus, previewSeasonStatus, parsePreviewDate } from '../../../shared/seasonal.js';
import { normalizeControls, publicControls } from '../../../shared/serviceControls.js';
import {
  FOREGROUND_REFRESH_MS, LAST_KNOWN_MS, SKEW_TRUST_MS, VISIBLE_REFRESH_MS, clockSkew, msUntilNextAccraDay, retryDelayMs, scheduledPackFrom, usableStoredSeason,
} from '../../../src/seasonal/seasonClock.js';
import { startSeasonSync } from '../../../src/seasonal/seasonSync.js';
import { airtimeCardLine, openNetworksLabel, pausedLabel, setServiceStatusForTests } from '../../../src/hooks/useServiceStatus.js';
import { MemberHomeView, type MemberHomeViewProps } from '../../../src/components/home/MemberHomeView.js';
import { settingState } from '../../../src/components/admin/sections/AdminSeasonalPanel.js';
import { HELP_CATEGORIES } from '../../../src/data/helpFaqs.js';

const read = (file: string) => readFileSync(file, 'utf8');
const code = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const T = (iso: string) => Date.parse(iso);

let server: Server, base: string;
before(async () => {
  const app = express(); app.use('/api/seasonal', seasonalRouter);
  server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  delete process.env.SEASONAL_EXPERIENCE;
  setServiceStatusForTests({ version: 'test-empty', serverDate: '2026-11-27', controls: [], announcements: [], confirmed: false });
  await new Promise<void>(resolve => server.close(() => resolve()));
});

// ───────────────────────── Lifecycle ─────────────────────────

test('the status says which pack is switched on even before its first day, and gives the server time', async () => {
  delete process.env.SEASONAL_EXPERIENCE;
  const off = await (await fetch(`${base}/api/seasonal/status`)).json();
  assert.equal(off.scheduledPack, null);
  assert.ok(Math.abs(Date.parse(off.serverTime) - Date.now()) < 5_000, 'serverTime is the server clock now, ISO');
  process.env.SEASONAL_EXPERIENCE = 'christmas-2026';
  const set = await (await fetch(`${base}/api/seasonal/status`)).json();
  assert.equal(set.scheduledPack, 'christmas-2026', 'the setting is visible whatever today is');
  assert.equal(set.active, serverSeasonStatus('christmas-2026').active, 'active still follows the Accra calendar');
  process.env.SEASONAL_EXPERIENCE = 'christmas-2027-typo';
  assert.equal((await (await fetch(`${base}/api/seasonal/status`)).json()).scheduledPack, null, 'only an exact known pack id');
  delete process.env.SEASONAL_EXPERIENCE;
});

test('an inactive answer on 30 November is not read as "off": the scheduled pack turns on at Accra midnight', () => {
  const nov30 = { active: false, pack: null, phase: 'before', scheduledPack: 'christmas-2026' };
  assert.equal(scheduledPackFrom(nov30), 'christmas-2026');
  assert.equal(scheduledPackFrom({ active: false, pack: null, scheduledPack: null }), null, 'switched off is off');
  assert.equal(scheduledPackFrom({ active: true, pack: 'christmas-2026', scheduledPack: null }), null, 'the explicit field wins');
  assert.equal(scheduledPackFrom({ active: true, pack: 'christmas-2026' }), 'christmas-2026', 'an older server is still read');
  for (const bad of [null, 'x', 42, { scheduledPack: 'easter-2027' }]) assert.equal(scheduledPackFrom(bad), null);
  // The page computes the same calendar as the server, on each side of every boundary.
  const pack = 'christmas-2026';
  const at = (iso: string) => serverSeasonStatus(pack, new Date(iso));
  assert.equal(at('2026-11-30T23:59:59Z').active, false);
  assert.deepEqual([at('2026-12-01T00:00:00Z').active, at('2026-12-01T00:00:00Z').phase], [true, 'christmas-season']);
  assert.equal(at('2026-12-24T23:59:59Z').phase, 'christmas-season');
  assert.equal(at('2026-12-25T00:00:00Z').phase, 'christmas-day');
  assert.equal(at('2026-12-26T00:00:00Z').phase, 'boxing-day');
  assert.equal(at('2026-12-27T00:00:00Z').phase, 'year-end');
  assert.equal(at('2026-12-31T00:00:00Z').phase, 'new-years-eve');
  assert.equal(at('2027-01-01T00:00:00Z').phase, 'new-years-day');
  assert.deepEqual([at('2027-01-05T23:59:59Z').active, at('2027-01-05T23:59:59Z').phase], [true, 'new-year']);
  assert.deepEqual([at('2027-01-06T00:00:00Z').active, at('2027-01-06T00:00:00Z').phase], [false, 'after'], 'ordinary on 6 January, setting still present');
  // A forced preview of 6 January still shows New Year for review; that is not the public lifecycle.
  assert.equal(previewSeasonStatus(pack, '2027-01-06').phase, 'new-year');
  assert.equal(parsePreviewDate('2027-01-06'), '2027-01-06');
});

test('the boundary timer, clock correction, cache freshness and retries', () => {
  assert.equal(msUntilNextAccraDay(T('2026-11-30T23:59:30Z')), 30_000);
  assert.equal(msUntilNextAccraDay(T('2026-12-01T00:00:00Z')), 86_400_000);
  assert.equal(msUntilNextAccraDay(T('2026-12-31T12:00:00Z')), 12 * 3_600_000);
  // A phone a few minutes out (or a briefly cached answer) is not second-guessed; a phone a day out is corrected.
  const sent = T('2026-11-30T23:50:00Z');
  assert.equal(clockSkew('2026-11-30T23:53:00Z', sent, sent + 400), 0);
  assert.equal(clockSkew('2026-12-01T23:50:00Z', sent, sent + 400), 86_400_000 - 200);
  assert.equal(clockSkew('2026-11-29T23:50:00.200Z', sent, sent + 400), -86_400_000);
  for (const bad of [undefined, 'not a date', 123]) assert.equal(clockSkew(bad, sent, sent + 10), 0);
  assert.equal(clockSkew('2026-12-05T00:00:00Z', sent + 10, sent), 0, 'a nonsensical round trip is ignored');
  assert.equal(clockSkew('1970-01-01T00:00:00Z', sent, sent + 10), 0, 'a broken server time (more than a year out) is ignored');
  assert.ok(SKEW_TRUST_MS >= 6 * 60_000, 'larger than the status answer can be cached (five minutes)');
  // Stored answers: the old format is ignored; a recent one is used; one older than seven days or from the future is not.
  const now = T('2026-12-10T10:00:00Z');
  assert.equal(usableStoredSeason({ pack: 'christmas-2026' }, now), null, 'pre-3.6.4 format: start ordinary and ask');
  assert.deepEqual(usableStoredSeason({ pack: 'christmas-2026', at: now - 3_600_000, skew: 0 }, now), { pack: 'christmas-2026', at: now - 3_600_000, skew: 0 });
  assert.equal(usableStoredSeason({ pack: 'christmas-2026', at: now - LAST_KNOWN_MS - 1, skew: 0 }, now), null);
  assert.equal(usableStoredSeason({ pack: 'christmas-2026', at: now + 3_600_000, skew: 0 }, now), null);
  assert.equal(usableStoredSeason({ pack: 'nope', at: now, skew: 0 }, now)?.pack, null);
  assert.equal(usableStoredSeason('garbage', now), null);
  assert.equal(LAST_KNOWN_MS, 7 * 86_400_000);
  assert.deepEqual([retryDelayMs(1), retryDelayMs(2), retryDelayMs(3), retryDelayMs(9)], [30_000, 60_000, 120_000, 600_000]);
  assert.ok(VISIBLE_REFRESH_MS >= 30 * 60_000 && FOREGROUND_REFRESH_MS >= 5 * 60_000, 'no frequent polling');
});

// ── The scheduler itself, driven by mock timers (seasonSync.ts): behaviour, not source text. ──

/** A synthetic status server and page for startSeasonSync, on node:test's mock clock. */
function harness(start: string, opts: { phoneOffsetMs?: number; initial?: ReturnType<typeof usableStoredSeason>; fail?: boolean } = {}) {
  const calls: { fresh: boolean; at: number }[] = [];
  const answers: { pack: string | null; skew: number }[] = [];
  const days: string[] = [];
  let failing = opts.fail ?? false, hidden = false, stale = 0;
  let handlers: { onReturn: () => void; onOnline: () => void } | null = null;
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T(start) });
  const serverNow = () => Date.now() - (opts.phoneOffsetMs ?? 0); // the phone's clock is offset from the server's
  const stop = startSeasonSync({
    fetchStatus: async (fresh) => {
      calls.push({ fresh, at: Date.now() });
      if (failing) throw new Error('offline');
      const now = new Date(serverNow());
      return { ...serverSeasonStatus('christmas-2026', now), scheduledPack: 'christmas-2026', serverTime: now.toISOString(), greetings: { createPath: null } };
    },
    now: () => Date.now(), random: () => 0.5, isHidden: () => hidden,
    listen: (h) => { handlers = h; return () => { handlers = null; }; },
    initial: opts.initial ?? null,
    onAnswer: (a) => answers.push({ pack: a.pack, skew: a.skew }),
    onDay: (corrected) => days.push(new Date(corrected).toISOString().slice(0, 10)),
    onStale: () => { stale++; },
  });
  const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
  const tick = async (ms: number) => { await flush(); mock.timers.tick(ms); await flush(); };
  return { calls, answers, days, tick, flush, stop, get stale() { return stale; }, setFailing: (v: boolean) => { failing = v; }, setHidden: (v: boolean) => { hidden = v; }, fire: (k: 'onReturn' | 'onOnline') => handlers?.[k](), get listening() { return handlers !== null; } };
}

test('scheduler: an open page turns seasonal at Accra midnight on its own, then asks once (spread)', async (t) => {
  t.after(() => mock.timers.reset());
  const h = harness('2026-11-30T23:59:30Z');
  await h.flush();
  assert.equal(h.calls.length, 1, 'one request on load');
  assert.equal(h.answers[0].pack, 'christmas-2026', 'the scheduled pack is known before its first day');
  await h.tick(31_000);
  assert.equal(h.days.at(-1), '2026-12-01', 'the day changes at midnight without a request');
  await h.tick(16_000);
  assert.equal(h.calls.length, 2, 'one spread-out request after midnight');
  await h.tick(25 * 60_000);
  assert.equal(h.calls.length, 2, 'no polling in between');
  h.stop(); assert.equal(h.listening, false, 'listeners removed');
});

test('scheduler: a phone two hours slow is corrected and still changes at the real midnight (timer re-armed)', async (t) => {
  t.after(() => mock.timers.reset());
  // Real time 21:00 on 30 Nov; the phone says 19:00.
  const h = harness('2026-11-30T19:00:00Z', { phoneOffsetMs: -2 * 3_600_000 });
  await h.flush();
  assert.equal(h.calls[0].fresh, false);
  assert.equal(h.calls.length, 2, 'a cached-looking answer that disagrees by hours is confirmed with one fresh request');
  assert.equal(h.calls[1].fresh, true);
  assert.equal(h.answers.at(-1)!.skew, 2 * 3_600_000, 'correction taken from the fresh answer');
  await h.tick(3 * 3_600_000 + 1_000); // the phone reads 22:00:01, the server 00:00:01
  assert.equal(h.days.at(-1), '2026-12-01', 'changes at the server’s midnight, not the phone’s');
  h.stop();
});

test('scheduler: a correct phone is never shifted by a small difference; a cached answer alone never sets the clock', async (t) => {
  t.after(() => mock.timers.reset());
  const h = harness('2026-12-10T10:00:00Z', { phoneOffsetMs: 4 * 60_000 }); // phone 4 minutes fast
  await h.flush();
  assert.equal(h.calls.length, 1, 'within ten minutes: no recheck');
  assert.equal(h.answers[0].skew, 0);
  h.stop();
});

test('scheduler: foreground and reconnect ask only when useful; after a failure the backoff is kept', async (t) => {
  t.after(() => mock.timers.reset());
  const h = harness('2026-12-10T10:00:00Z');
  await h.flush();
  h.fire('onReturn'); await h.flush();
  assert.equal(h.calls.length, 1, 'back within five minutes: no request');
  await h.tick(6 * 60_000); h.fire('onReturn'); await h.flush();
  assert.equal(h.calls.length, 2, 'back after six minutes: one request');
  h.setFailing(true);
  await h.tick(6 * 60_000); h.fire('onReturn'); await h.flush();
  assert.equal(h.calls.length, 3, 'that request fails');
  for (let i = 0; i < 5; i++) { h.fire('onReturn'); await h.flush(); }
  assert.equal(h.calls.length, 3, 'repeated focus after a failure does not bypass the backoff');
  await h.tick(30_000);
  assert.equal(h.calls.length, 4, 'the backoff retry runs after 30 s');
  h.setFailing(false);
  h.fire('onOnline'); await h.flush();
  assert.equal(h.calls.length, 5, 'reconnect asks at once');
  await h.tick(60_000);
  assert.equal(h.calls.length, 5, 'the retry timer was cleared by the success');
  h.stop();
});

test('scheduler: offline, the last answer stands for seven days, then the page is ordinary', async (t) => {
  t.after(() => mock.timers.reset());
  const at = T('2026-12-10T10:00:00Z');
  const recent = harness('2026-12-12T10:00:00Z', { fail: true, initial: { pack: 'christmas-2026', at, skew: 0 } });
  await recent.flush();
  assert.equal(recent.stale, 0, 'two days old: still stands');
  recent.stop(); mock.timers.reset();
  const old = harness('2026-12-17T10:00:01Z', { fail: true, initial: { pack: 'christmas-2026', at, skew: 0 } });
  await old.flush();
  assert.equal(old.stale, 1, 'over seven days: ordinary until the server answers');
  old.stop();
});

test('the provider uses the scheduler, keeps the preview local and the page robust', () => {
  const p = code('src/seasonal/SeasonProvider.tsx');
  assert.match(p, /useEffect\(\(\) => startSeasonSync\(\{/);
  for (const ev of ["document.addEventListener('visibilitychange', onReturn)", "window.addEventListener('focus', onReturn)", "window.addEventListener('pageshow', onReturn)", "window.addEventListener('online', onOnline)", "document.removeEventListener('visibilitychange', onReturn)", "window.removeEventListener('online', onOnline)"]) assert.ok(p.includes(ev), ev);
  assert.match(p, /onStale: \(\) => setScheduled\(null\),/);
  assert.match(p, /const status = preview \? previewSeasonStatus\(preview\.pack, preview\.date \|\| today\) : statusOn\(scheduled, today\);/);
  assert.match(p, /try \{ window\.history\.replaceState\(/, 'a locked-down browser cannot break the page');
  assert.doesNotMatch(p, /fetch\([^)]*season-preview/, 'a preview never reaches the server');
  // A stored correction is reused for a day at most.
  const now = T('2026-12-10T10:00:00Z');
  assert.equal(usableStoredSeason({ pack: 'christmas-2026', at: now - 3_600_000, skew: 7_200_000 }, now)!.skew, 7_200_000);
  assert.equal(usableStoredSeason({ pack: 'christmas-2026', at: now - 2 * 86_400_000, skew: 7_200_000 }, now)!.skew, 0);
});

// ───────────────────────── Motion ─────────────────────────

/**
 * Every animation declaration in a stylesheet: duration, iterations, and its latest start. A `calc(base + var(--i) *
 * step)` stagger is counted at its largest index: 12 for the bulb strings (13 bulbs), 4 for everything else.
 */
function animations(css: string): { where: string; seconds: number; delay: number; count: number | 'infinite' }[] {
  const out: { where: string; seconds: number; delay: number; count: number | 'infinite' }[] = [];
  const sec = (v: string, unit: string) => Number(v) / (unit === 'ms' ? 1000 : 1);
  for (const m of css.matchAll(/([^{}]*)\{[^{}]*?animation:\s*([^;}]+)/g)) {
    const where = m[1].trim().slice(-90);
    for (const part of m[2].split(/,(?![^(]*\))/)) {
      if (/^\s*none\b/.test(part)) continue;
      const plain = part.replace(/calc\([^)]*\)/g, ' ');
      const times = [...plain.matchAll(/(?<![\w-])(\d*\.?\d+)(m?s)\b/g)].map(t => sec(t[1], t[2]));
      if (!times.length) continue;
      let delay = times[1] ?? 0;
      const calc = part.match(/calc\(([^)]*)\)/);
      if (calc) {
        const step = calc[1].match(/var\(--i[^)]*\)\s*\*\s*(-?\d*\.?\d+)(m?s)/), base = calc[1].replace(/var\(--i[^)]*\)\s*\*\s*-?\d*\.?\d+m?s/, '').match(/(-?\d*\.?\d+)(m?s)/);
        const maxI = /bulb/.test(where) ? 12 : 4;
        delay = (base ? sec(base[1], base[2]) : 0) + Math.max(0, step ? sec(step[1], step[2]) * maxI : 0);
      }
      const count = /\binfinite\b/.test(part) ? 'infinite' : Number((plain.match(/\s(\d+)(?=\s|$)/) || [])[1] || 1);
      out.push({ where, seconds: times[0], delay, count });
    }
  }
  return out;
}
const STYLES = [
  ...readdirSync('src/seasonal', { recursive: true }).map(String).filter(f => f.endsWith('.css')).map(f => path.join('src/seasonal', f)),
  'src/components/data/dataStore.css', 'src/components/orders/orders.css', 'src/components/home/member-home.css', 'src/components/service/serviceUpdate.css',
];

test('decorative seasonal motion is finite and settles within about five seconds; only loading indicators loop', () => {
  const loops: string[] = [];
  for (const file of STYLES) {
    for (const a of animations(read(file))) {
      if (a.count === 'infinite') { loops.push(`${file}: ${a.where}`); continue; }
      if (a.count > 1 || a.delay + a.seconds > 3) assert.ok(a.delay + a.seconds * a.count <= 5.2, `${file}: ${a.where} ends at ${(a.delay + a.seconds * a.count).toFixed(2)} s`);
    }
  }
  // The remaining loops are loading or busy indicators that end when the request does.
  for (const loop of loops) assert.match(loop, /skeleton|aria-busy|animate-pulse|busy|refresh/, loop);
  assert.match(read('src/seasonal/christmas/christmas.css'), /\.xmas-bulb-twinkle \{ animation: xmas-twinkle 2\.2s ease-in-out 2; \}/, 'the header strand twinkles twice, then stays lit');
  // The strand's own stagger (inline, so the stylesheet cannot see it) is at most .45 s: the last bulb ends by ~4.9 s.
  assert.match(read('src/seasonal/christmas/art.tsx'), /animationDelay: `\$\{\(i % 4\) \* 0\.15\}s`/);
  // The guest hero's idle moment plays the first time it is seen, never again on scroll.
  assert.match(read('src/seasonal/christmas/home/ChristmasHome.tsx'), /if \(entry\.isIntersecting\) \{ el\.setAttribute\('data-xh-visible', ''\); io\.disconnect\(\); \}/);
  // Two ordinary-page "live" marks now pulse briefly instead of forever.
  assert.match(read('src/index.css'), /\.mh-brief-pulse \{ animation: mh-brief-pulse 1\.6s ease-in-out 3; \}/);
  assert.doesNotMatch(read('src/components/website/WebsitePlansAndUltra.tsx'), /rounded-full bg-\[#00c365\] shrink-0 animate-pulse/);
  assert.doesNotMatch(read('src/components/marketplace/MarketplacePage.tsx'), /<Radio className="[^"]*animate-pulse/);
  assert.match(read('src/components/marketplace/MarketplacePage.tsx'), /<Radio className="[^"]*mh-brief-pulse"/);
});

// ───────────────────────── Scope and serious states ─────────────────────────

test('members get only the accent rules; guest-only parts stay guest-only; nothing reaches Admin or tools', () => {
  const css = read('src/seasonal/christmas/christmas.css');
  const memberRules = css.split('\n').filter(l => l.includes('[data-season-audience="member"]'));
  assert.ok(memberRules.length > 20);
  for (const rule of memberRules) assert.doesNotMatch(rule, /xmas-header|xmas-footer|dialog-variant|xmas-invite|xmas-confirmed|xmas-celebrate|\.help-|xmas-bulb-twinkle/, rule);
  assert.match(css, /^\.mh-app\[data-season="christmas"\] \{ background:/m, 'the page background stays guest-only');
  assert.match(css, /^\.mh-app\[data-season="christmas"\] \.xmas-header-lights \{/m);
  const seasonal = code('src/seasonal/Seasonal.tsx');
  assert.match(seasonal, /const SHARED_SLOTS: readonly ChristmasSlot\[\] = \['page', 'creative-stage'\];/);
  assert.match(seasonal, /const on = SHARED_SLOTS\.includes\(slot\) \? season\.active \|\| season\.memberActive : season\.active;/, 'never while the account is still being checked');
  // No greeting beside an account under review, nor while it is still loading (it could turn out to be under review).
  assert.match(code('src/components/finance/FinancialPanel.tsx'), /\{mode==='wallet'&&data&&!data\.restricted&&<Seasonal slot="page" page="wallet" \/>\}/, 'no greeting beside an account under review');
  assert.match(code('src/components/finance/FinancialPanel.tsx'), /festiveOk:Boolean\(data\)&&!data\.restricted,/);
  assert.match(code('src/components/earn/MysteryEarnPage.tsx'), /\{finance\.festiveOk && <Seasonal slot="page" page="earn" \/>\}/);
});

test('a serious sheet is never dressed: paused, refused, closed or recovering checkout, and receipts that need help', () => {
  // Guests (pack) and members (shared shell): one rule each, both with the same exception.
  for (const file of ['src/seasonal/christmas/christmas.css', 'src/seasonal/christmas/shell/shell.css']) {
    const css = read(file);
    assert.match(css, /\.mh-sheet:not\(\[data-rc-mood="serious"\], \[data-sheet-mood="serious"\]\) \{ box-shadow:/, file);
    assert.match(css, /\.mh-sheet:not\(\[data-rc-mood="serious"\], \[data-sheet-mood="serious"\]\)::after \{/, file);
    assert.doesNotMatch(css, /\.mh-sheet \{|\.mh-sheet::after/, `${file}: no unconditional sheet decoration`);
  }
  assert.match(read('src/seasonal/christmas/shell/shell.css'), /\[data-season-audience="member"\] \.mh-sheet:not/);
  assert.match(read('src/seasonal/christmas/christmas.css'), /^\.mh-app\[data-season="christmas"\] \.mh-sheet:not/m);
  const checkout = code('src/components/checkout/CheckoutModal.tsx');
  assert.match(checkout, /aria-label="Purchases paused"[\s\S]{0,400}<div data-sheet-mood="serious" className="mh-sheet/);
  assert.match(checkout, /data-sheet-mood=\{preflightIssue \|\| serverError \|\| paymentClosed \|\| recoveryOnly \|\| activeMtnConflict \|\| quoteError \|\| flexiError \? 'serious' : undefined\}/, 'including "Price not confirmed"');
  assert.match(code('src/components/checkout/OrderStatusModal.tsx'), /data-rc-mood=\{view\.festive \? 'bright' : 'serious'\}/);
});

// ───────────────────────── Availability-aware copy ─────────────────────────

const status = (controls: ReturnType<typeof publicControls>) => ({ version: 't', serverDate: '2026-12-10', controls, announcements: [], confirmed: true });
const paused = (scope: string, state: 'maintenance' | 'suspended' = 'maintenance') => normalizeControls({ version: 'v', controls: [{ scope, state, title: 'x', message: 'y' }] });

test('service cards name only the networks selling now; a paused network is never advertised', () => {
  assert.equal(openNetworksLabel('data', status([])), 'MTN, Telecel & AirtelTigo');
  assert.equal(openNetworksLabel('data', status(publicControls(normalizeControls(undefined)))), 'Telecel & AirtelTigo', 'the shipped MTN Data pause');
  assert.equal(openNetworksLabel('airtime', status(publicControls(normalizeControls(undefined)))), 'MTN, Telecel & AirtelTigo', 'MTN Airtime is not part of it');
  const two = normalizeControls({ version: 'v', controls: [{ scope: 'data:mtn', state: 'maintenance', title: 'x', message: 'y' }, { scope: 'data:telecel', state: 'suspended', title: 'x', message: 'y' }] });
  assert.equal(openNetworksLabel('data', status(publicControls(two))), 'AirtelTigo');
  const all = normalizeControls({ version: 'v', controls: ['mtn', 'telecel', 'airteltigo'].map(n => ({ scope: `data:${n}`, state: 'suspended', title: 'x', message: 'y' })) });
  assert.equal(openNetworksLabel('data', status(publicControls(all))), null);
  assert.equal(openNetworksLabel('data', status(publicControls(normalizeControls({ version: 'v', controls: [{ scope: 'data:mtn', state: 'delayed', title: 'x', message: 'y' }] })))), 'MTN, Telecel & AirtelTigo', 'a delay does not remove a network');
  // No reason is given that the controls did not give: "for maintenance" only when every paused control says so.
  assert.equal(pausedLabel('data', status(publicControls(all))), 'Paused for now', 'suspended (or an unreadable record) is not "maintenance"');
  const allMaint = normalizeControls({ version: 'v', controls: ['mtn', 'telecel', 'airteltigo'].map(n => ({ scope: `data:${n}`, state: 'maintenance', title: 'x', message: 'y' })) });
  assert.equal(pausedLabel('data', status(publicControls(allMaint))), 'Paused for maintenance');
  assert.equal(pausedLabel('data', status(publicControls(normalizeControls({ controls: 'unreadable' })))), 'Paused for now');
  // Airtime: "any Ghana number" only while every network is open.
  assert.equal(airtimeCardLine(status([])), 'Top up any Ghana number');
  assert.equal(airtimeCardLine(status(publicControls(paused('airtime:mtn')))), 'Top up Telecel & AirtelTigo numbers');
  const airAll = normalizeControls({ version: 'v', controls: ['mtn', 'telecel', 'airteltigo'].map(n => ({ scope: `airtime:${n}`, state: 'suspended', title: 'x', message: 'y' })) });
  assert.equal(airtimeCardLine(status(publicControls(airAll))), 'Paused for now');
  // Rendered: the member homepage's Buy Data and Airtime tiles follow the shared status.
  const noop = () => undefined;
  const props = { name: 'Ama', greeting: 'Good morning', orders: [], loading: false, error: false, assistant: noop, wallet: React.createElement('p', null, 'Wallet'), retry: noop, track: noop, actions: { data: noop, airtime: noop, website: noop, earn: noop, marketplace: noop, afa: noop, wallet: noop, orders: noop } } as unknown as MemberHomeViewProps;
  setServiceStatusForTests(status(publicControls(normalizeControls(undefined))));
  const html = renderToStaticMarkup(React.createElement(MemberHomeView, props));
  assert.match(html, /<strong>Buy Data<\/strong><span>Telecel &amp; AirtelTigo<\/span>/);
  assert.match(html, /<strong>Airtime<\/strong><span>Top up any Ghana number<\/span>/);
  setServiceStatusForTests(status(publicControls(all)));
  assert.match(renderToStaticMarkup(React.createElement(MemberHomeView, props)), /<strong>Buy Data<\/strong><span>Paused for now<\/span>/);
  setServiceStatusForTests({ version: 'test-empty', serverDate: '2026-11-27', controls: [], announcements: [], confirmed: false });
  // The same rule on the ordinary and Christmas guest homepages, the Christmas member homepage and More Services.
  for (const file of ['src/components/home/QuickServicesBar.tsx', 'src/seasonal/christmas/home/ChristmasHome.tsx']) {
    assert.match(code(file), /const dataNetworks = openNetworksLabel\('data', serviceStatus\), airtimeOpen = openNetworksLabel\('airtime', serviceStatus\);/, file);
    assert.match(code(file), /desc: dataNetworks \?\? pausedLabel\('data', serviceStatus\)/, file);
    assert.match(code(file), /desc: airtimeCardLine\(serviceStatus\), [^}]*tag: airtimeOpen \? 'Available' : 'Paused'/, file);
  }
  assert.match(code('src/seasonal/christmas/member/ChristmasMemberView.tsx'), /<strong>Buy Data<\/strong><span>\{dataNetworks \?\? pausedLabel\('data', serviceStatus\)\}<\/span>/);
  assert.match(code('src/seasonal/christmas/member/ChristmasMemberView.tsx'), /<strong>Airtime<\/strong><span>\{airtimeCardLine\(serviceStatus\)\}<\/span>/);
  const services = code('src/components/services/MoreServicesPage.tsx');
  assert.match(services, /service\.dataMode && !openNetworksLabel\(service\.dataMode, serviceStatus\) \? 'unavailable' : serviceAvailability\(service, afa\)/, 'no "Available" badge when no network is open');
  assert.match(services, /service\.id === 'srv-data' \? \(dataNetworks \? `Bundles on \$\{dataNetworks\}` : pausedLabel\('data', serviceStatus\)\)/);
  assert.match(services, /service\.dataMode === 'airtime' \? \(airtimeNetworks === ALL_NETWORKS_LABEL \? service\.tagline : airtimeNetworks \? `\$\{airtimeNetworks\} numbers` : pausedLabel\('airtime', serviceStatus\)\)/);
  assert.match(services, /purchasePaused\(service\.dataMode, id, serviceStatus\)/);
});

// ───────────────────────── Help and Admin readiness ─────────────────────────

test('Help explains a paused service plainly, without guarantees', () => {
  const q = HELP_CATEGORIES.flatMap(c => c.questions).find(x => x.id === 'service-paused')!;
  assert.ok(q, 'a question about paused services');
  assert.match(q.answer, /checkout will not start a payment for it/);
  assert.match(q.answer, /An expected date is an estimate, not a guarantee/);
  assert.doesNotMatch(q.answer, /refunded|nationwide|supplier|Success Biz|Brainiac|will be restored on/i);
  assert.equal(q.link?.href, '/orders');
});

test('the Admin panel tells "set and waiting for 1 December" from "off", and lists every launch preview day', () => {
  const base = { pack: null, phase: 'before' as const, daysToChristmas: 28, daysToNewYear: 35, source: 'off' as const };
  assert.match(settingState({ ...base, active: false, date: '2026-11-27', scheduledPack: 'christmas-2026' }).label, /^Set · starts on its own on 1 December 2026$/);
  assert.equal(settingState({ ...base, active: false, date: '2026-11-27', scheduledPack: null }).label, 'Off (setting not present)');
  assert.match(settingState({ ...base, active: true, pack: 'christmas-2026', phase: 'christmas-season', date: '2026-12-02', source: 'server', scheduledPack: 'christmas-2026' }).label, /^On for everyone/);
  assert.match(settingState({ ...base, active: false, phase: 'after', date: '2027-01-06', scheduledPack: 'christmas-2026' }).label, /season has ended/);
  // An API from before 3.6.4 (the site and API deploy separately) says nothing about the setting: never "Off".
  assert.doesNotMatch(settingState({ ...base, active: false, date: '2026-11-27' }).label, /^Off/);
  assert.match(settingState({ ...base, active: false, date: '2026-11-27' }).label, /does not report whether the setting is present/);
  const panel = read('src/components/admin/sections/AdminSeasonalPanel.tsx');
  for (const day of ['2026-12-01', '2026-12-10', '2026-12-24', '2026-12-25', '2026-12-26', '2026-12-27', '2026-12-31', '2027-01-01', '2027-01-05']) assert.ok(panel.includes(`date: '${day}'`), day);
  assert.match(panel, /does not restore MTN Data, open Mystery Greetings, start the December campaign or turn on storefront\s+payments/);
  assert.match(panel, /ends by itself on 6 January 2027/);
  assert.equal(CHRISTMAS_2026.end, '2027-01-05', 'the approved calendar is unchanged');
});

test('one overlay system: the exceptional pop-up holds the page and makes invitations wait; idle stagger stays short', () => {
  const ui = code('src/components/service/ServiceUpdate.tsx');
  assert.match(ui, /useOverlayLock\(Boolean\(shownKey\), dialogRef\);/);
  assert.match(code('src/components/pwa/InvitationLayer.tsx'), /const busy = overlays > 0 \|\| isAuthChecking \|\| appBusy\(app\);/, 'invitations already wait for any registered overlay');
  // The guest hero's idle twinkle and float start within about two seconds of each other, so the whole moment ends
  // within about five seconds (the per-element stagger used to reach nine).
  const hero = read('src/seasonal/christmas/home/heroArt.tsx');
  assert.match(hero, /animationDelay: `\$\{0\.25 \+ i \* 0\.045\}s, \$\{0\.9 \+ i \* 0\.08\}s`/);
  assert.match(hero, /animationDelay: `\$\{0\.75 \+ i \* 0\.12\}s, \$\{1\.4 \+ i \* 0\.15\}s`/);
  // Accessibility fixes found in the seasonal sweep (they apply all year): readable Wallet activity details, and a
  // disabled Earn share row that wraps rather than scrolling with nothing focusable.
  assert.doesNotMatch(read('src/components/finance/FinancialPanel.tsx'), /text-xs text-slate-500/);
  assert.match(readdirSync('src/components/earn').filter(f => f.endsWith('.css')).map(f => read(path.join('src/components/earn', f))).join('\n'), /\.earn-topics:disabled > div \{ flex-wrap: wrap; overflow: visible; \}/);
  // Phones: one ornament beside each seasonal line, so its words are never cut off.
  assert.match(read('src/seasonal/christmas/christmas.css'), /@media \(max-width: 480px\) \{\s*\.mh-app:is\(\[data-season="christmas"\], \[data-season-audience="member"\]\) \.xmas-page-art > :nth-child\(n\+2\) \{ display: none; \}/);
});
