import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import express from 'express';
import {
  anchorFrom, createCountdownClock, embeddedView, estimateServerTime, preferAnchor,
  COUNTDOWN_OVER_AFTER, COUNTDOWN_TARGET_MS, DRIFT_LIMIT, FINAL_CHECK, FINAL_SPREAD, LIVE_GRACE, REFRESH_EVERY, RESYNC_GAP, SLOW_AFTER,
  type ClockView,
} from '../../../src/greetings/countdown.js';
import type { CountdownAnswer, Result } from '../../../src/greetings/api.js';
import { dialModel, remainingSentence, shownSeconds, stageCopy, stageOf, welcomeKicker, STAGE_ANNOUNCEMENT, COUNTING, type Stage } from '../../../src/countdown/stage.js';
import { countdownShareText, countdownWhatsappHref, shareCountdown, COUNTDOWN_URL } from '../../../src/countdown/share.js';
import { requestFullscreen, fullscreenAvailable, keepScreenOn } from '../../../src/countdown/immersive.js';
import { createCountdownSound, soundSupported } from '../../../src/countdown/sound.js';
import { CountdownExperience, STARS } from '../../../src/countdown/CountdownPage.js';
import { Dial, RING_LENGTH } from '../../../src/countdown/Dial.js';
import { countdownHead, COUNTDOWN_SHARE_IMAGE } from '../../../src/utils/socialMetadata.js';
import { resolvePublicSocialMetadata } from '../../services/publicSocialMetadata.js';
import { countdownInvite, COUNTDOWN_HREF } from '../../../src/seasonal/christmas/copy.js';
import { seasonPhase, type SeasonPhase } from '../../../shared/seasonal.js';
import { countdownState, COUNTDOWN_TARGET } from '../../../shared/mysteryExperiences.js';
import { experienceRouter, COUNTDOWN_READS_PER_VISITOR, COUNTDOWN_READS_TOTAL } from '../../routes/experienceApi.js';
import { createClockAdmission } from '../../middleware/clockAdmission.js';
import { ExperienceService } from '../../services/experienceService.js';
import { NewYearCountdown } from '../../../src/greetings/NewYearCountdown.js';

/* Mystery Countdown 3.7.1 (/countdown): the shared clock under controlled time, every phase, sharing, metadata and pins. */

const read = (file: string) => readFileSync(file, 'utf8');
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const T = COUNTDOWN_TARGET_MS;
const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;

/* ───────────────────────── A controlled world: server truth, two device clocks, timers and the network ───────────────────────── */

type Reply = 'ok' | 'fail' | 'hang';
interface Pending { sentMono: number; resolve: (r: Result<CountdownAnswer>) => void; settled: boolean }
const failure: Result<CountdownAnswer> = { ok: false, failure: 'offline', status: 0, code: null };

class World {
  /** Monotonic time since the page opened. */ mono = 0;
  /** The device's wall clock, deliberately wrong unless a test says otherwise. */ wall: number;
  /** The server's true time. */ server: number;
  visible = true;
  reply: Reply = 'ok';
  rtt = 200;
  views: ClockView[] = [];
  /** The server's true time at each view, to measure how far the page is off. */
  truths: number[] = [];
  requests: Pending[] = [];
  private timers = new Map<number, { at: number; run: () => void }>();
  private ids = 0;
  clock: ReturnType<typeof createCountdownClock>;
  constructor(serverNow: number, { wallSkew = -183 * DAY, random = 0.5 }: { wallSkew?: number; random?: number } = {}) {
    this.server = serverNow; this.wall = serverNow + wallSkew;
    this.clock = createCountdownClock({
      fetch: () => this.fetch(),
      mono: () => this.mono, wall: () => this.wall, visible: () => this.visible,
      setTimer: (run, ms) => { const id = ++this.ids; this.timers.set(id, { at: this.mono + ms, run }); return id; },
      clearTimer: id => { this.timers.delete(id as number); },
      onView: v => { this.views.push(v); this.truths.push(this.server); },
      random: () => random,
    });
  }
  /** The page starts out syncing (the hook's first state) until the clock says otherwise. */
  get view(): ClockView { return this.views[this.views.length - 1] ?? { state: 'syncing', slow: false }; }
  /** How far the last running or arrived view was from the truth when it was shown. */
  get error() { const v = this.view; assert.ok('serverNow' in v, JSON.stringify(v)); return Math.abs(v.serverNow - this.truths[this.truths.length - 1]); }
  get pendingTimers() { return this.timers.size; }
  private fetch(): Promise<Result<CountdownAnswer>> {
    return new Promise(resolve => {
      const entry: Pending = { sentMono: this.mono, resolve, settled: false };
      this.requests.push(entry);
      if (this.reply === 'hang') return;
      const mode = this.reply, rtt = this.rtt;
      // The server reads its clock halfway through the round trip.
      const id = ++this.ids;
      this.timers.set(id, { at: this.mono + rtt, run: () => this.answer(entry, mode === 'ok' ? this.server - rtt / 2 : null) });
    });
  }
  /** Settles a request with the server's time `serverAt` (null: a failure). */
  answer(entry: Pending, serverAt: number | null) {
    if (entry.settled) return;
    entry.settled = true;
    entry.resolve(serverAt === null ? failure : { ok: true, status: 200, data: { serverTime: new Date(serverAt).toISOString(), remainingMs: Math.max(0, T - serverAt), passed: serverAt >= T } });
  }
  /** Real time passes: all three clocks move together and due timers run in order. */
  async advance(ms: number) {
    const end = this.mono + ms;
    for (;;) {
      await flush();
      let next: [number, { at: number; run: () => void }] | null = null;
      for (const entry of this.timers) if (entry[1].at <= end && (!next || entry[1].at < next[1].at)) next = entry;
      if (!next) break;
      this.move(next[1].at - this.mono);
      this.timers.delete(next[0]);
      next[1].run();
    }
    this.move(end - this.mono);
    await flush();
  }
  private move(ms: number) { this.mono += ms; this.wall += ms; this.server += ms; }
  /** The device sleeps: the monotonic clock pauses while real time (wall and server) moves on. */
  sleep(ms: number) { this.wall += ms; this.server += ms; }
  async hide() { this.visible = false; this.clock.visibility(); await flush(); }
  async show() { this.visible = true; this.clock.visibility(); await flush(); }
  running() { const v = this.view; assert.equal(v?.state, 'running', `expected running, got ${JSON.stringify(v)}`); return v as Extract<ClockView, { state: 'running' }>; }
}
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };

/* ───────────────────────── The anchor ───────────────────────── */

test('anchor: server time pinned at the request midpoint; untrustworthy samples are rejected', () => {
  const a = anchorFrom('2026-12-31T12:00:00.000Z', { mono: 1_000, wall: 50_000 }, { mono: 1_400, wall: 50_400 })!;
  assert.deepEqual(a, { server: Date.parse('2026-12-31T12:00:00.000Z'), mono: 1_200, wall: 50_200, rtt: 400 });
  assert.equal(anchorFrom('not a time', { mono: 0, wall: 0 }, { mono: 10, wall: 10 }), null, 'malformed time');
  assert.equal(anchorFrom('2026-12-31T12:00:00.000Z', { mono: 10, wall: 0 }, { mono: 5, wall: 0 }), null, 'negative round trip');
  assert.equal(anchorFrom('2026-12-31T12:00:00.000Z', { mono: 0, wall: 0 }, { mono: 300, wall: 300 + DRIFT_LIMIT + 1 }), null, 'straddled a sleep or clock change');
  assert.ok(anchorFrom('2026-12-31T12:00:00.000Z', { mono: 0, wall: 0 }, { mono: 300, wall: 300 + DRIFT_LIMIT }), 'ordinary jitter is fine');
});

test('estimate: the monotonic clock normally; the wall clock after a sleep; either way a jump is flagged', () => {
  const a = { server: 1_000_000, mono: 0, wall: 5_000, rtt: 100 };
  assert.deepEqual(estimateServerTime(a, 60_000, 65_000), { server: 1_060_000, suspect: false });
  assert.deepEqual(estimateServerTime(a, 60_000, 65_000 + 3_600_000), { server: 1_000_000 + 3_660_000, suspect: true }, 'slept: wall ran ahead');
  assert.deepEqual(estimateServerTime(a, 60_000, 65_000 - 3_600_000), { server: 1_060_000, suspect: true }, 'wall set back');
  assert.equal(preferAnchor(null, a), true);
  assert.equal(preferAnchor(a, { ...a, rtt: 400, mono: 1 }), true, 'comparable');
  assert.equal(preferAnchor(a, { ...a, rtt: 5_000, mono: 1 }), false, 'a much slower sample does not replace a good one');
  assert.equal(preferAnchor(a, { ...a, rtt: 5_000, mono: 11 * MIN }), true, 'unless the anchor is old');
  assert.equal(preferAnchor(a, { ...a, rtt: 5_000, mono: 1 }, true), true, 'or suspect');
});

/* ───────────────────────── The clock under controlled time ───────────────────────── */

test('a wrong device clock never matters: months off, the count is the server’s', async () => {
  for (const wallSkew of [-183 * DAY, 400 * DAY, 0]) {
    const w = new World(T - 20 * DAY - 5 * HOUR, { wallSkew });
    w.clock.start();
    await w.advance(1_000);
    const v = w.running();
    assert.ok(w.error <= 1, `skew ${wallSkew}: ${w.error} ms off`);
    assert.equal(stageOf(v), 'days');
    assert.equal(v.checking, false);
  }
});

test('no countdown is ever invented: syncing, then a slow note, then unavailable with spread retries', async () => {
  const w = new World(T - 3 * DAY);
  w.reply = 'hang';
  w.clock.start();
  await w.advance(10);
  assert.deepEqual(w.view, { state: 'syncing', slow: false });
  await w.advance(SLOW_AFTER);
  assert.deepEqual(w.view, { state: 'syncing', slow: true }, 'slow connection is said plainly');
  w.answer(w.requests[0], null);
  await w.advance(1);
  assert.deepEqual(w.view, { state: 'unavailable' });
  assert.ok(!w.views.some(v => v.state === 'running'), 'never a countdown without the server');
  // Retries back off (5 s, 15 s, …), spread ±20% (pinned to the middle here), and stop once one succeeds.
  w.reply = 'fail';
  const shown = w.views.length;
  await w.advance(4_980); assert.equal(w.requests.length, 1);
  await w.advance(40); assert.equal(w.requests.length, 2);
  await w.advance(w.rtt + 15_000); assert.equal(w.requests.length, 3);
  await w.advance(w.rtt + 1);
  assert.equal(w.views.length, shown, 'automatic retries leave the message alone (no flicker, no repeated alert)');
  // "Try again" while an automatic retry is on its way: it says it is checking, without a second request.
  w.reply = 'hang';
  await w.advance(30_000 - 1);
  assert.equal(w.requests.length, 4);
  w.clock.retry(); w.clock.retry();
  assert.deepEqual(w.view, { state: 'syncing', slow: false });
  assert.equal(w.requests.length, 4);
  w.answer(w.requests[3], null);
  await w.advance(1);
  assert.deepEqual(w.view, { state: 'unavailable' });
  w.reply = 'ok';
  w.clock.retry();
  await w.advance(w.rtt);
  assert.equal(w.requests.length, 5);
  assert.equal(w.running().checking, false);
  await w.advance(10 * MIN);
  assert.equal(w.requests.length, 5, 'no further asking once trusted');
});

test('offline after one good answer: it keeps counting from that answer and does not keep retrying', async () => {
  const w = new World(T - 90 * MIN);
  w.clock.start();
  await w.advance(500);
  w.reply = 'fail';
  w.clock.online(); // a flapping connection
  await w.advance(40 * MIN);
  const v = w.running();
  assert.ok(w.error <= 1, 'still accurate');
  assert.equal(stageOf(v), 'hour');
  assert.ok(w.requests.length <= 3, `${w.requests.length} requests in 40 minutes`);
  // Reconnection: one quiet check when due, never a burst.
  w.reply = 'ok';
  w.clock.online(); w.clock.online(); w.clock.online();
  await w.advance(1_000);
  assert.ok(w.requests.length <= 4);
});

test('no polling: an hour of watching costs a handful of requests, not one a second', async () => {
  const w = new World(T - 10 * HOUR);
  w.clock.start();
  await w.advance(HOUR);
  assert.ok(w.requests.length >= 2 && w.requests.length <= 3, `${w.requests.length} requests`);
  assert.ok(w.pendingTimers <= 2, 'one tick timer (and no pile-up)');
  assert.ok(w.views.length >= 3_500, 'the display still changes every second');
});

test('foreground return: the estimate shows at once; quick app switches ask nothing; a long absence asks once', async () => {
  const w = new World(T - 5 * HOUR);
  w.clock.start();
  await w.advance(500);
  await w.hide();
  const before = w.views.length;
  await w.advance(2 * MIN);
  assert.equal(w.views.length, before, 'no work at all while hidden');
  assert.equal(w.pendingTimers, 0, 'no timers while hidden');
  await w.show();
  w.running();
  assert.ok(w.error <= 1, 'shown at once, accurate');
  assert.equal(w.requests.length, 1, 'a quick switch back asks nothing');
  for (let i = 0; i < 20; i++) { await w.hide(); await w.advance(3 * SEC); await w.show(); }
  assert.equal(w.requests.length, 1, 'rapid switching asks nothing');
  await w.hide(); await w.advance(RESYNC_GAP); await w.show(); await w.advance(w.rtt);
  assert.equal(w.requests.length, 2, 'back after a long absence: one check');
});

test('a phone that slept: the wall clock carries the estimate, it says it is re-checking, then the server settles it', async () => {
  const w = new World(T - 6 * HOUR);
  w.clock.start();
  await w.advance(500);
  await w.hide();
  w.sleep(2 * HOUR); // monotonic clock paused
  await w.show();
  const v = w.running();
  assert.equal(v.checking, true, 'honest about the jump');
  assert.ok(w.error <= 1, 'the wall clock’s elapsed time is the better guess');
  assert.equal(w.requests.length, 2, 'asks at once');
  await w.advance(w.rtt);
  assert.equal(w.running().checking, false);
  assert.ok(w.error <= 1);
});

test('someone sets the device clock back an hour: the count is unchanged, then re-checked', async () => {
  const w = new World(T - 3 * DAY);
  w.clock.start();
  await w.advance(500);
  const before = w.running().remainingMs;
  w.wall -= HOUR;
  await w.advance(1_000);
  assert.ok(w.views.some(v => v.state === 'running' && v.checking), 'flagged while it re-checked');
  assert.ok(w.error <= 1, 'monotonic count kept');
  assert.ok(w.running().remainingMs < before);
  await w.advance(w.rtt + 1_000);
  assert.equal(w.running().checking, false);
  assert.ok(w.error <= 1);
});

test('out of order: an answer that straddled a sleep is abandoned for the fresh one', async () => {
  const w = new World(T - 8 * HOUR);
  w.clock.start();
  await w.advance(500);
  w.reply = 'hang';
  await w.advance(REFRESH_EVERY + 1_000); // the 30-minute refresh is now pending
  assert.equal(w.requests.length, 2);
  const stale = w.requests[1];
  await w.hide(); w.sleep(HOUR); await w.show(); // woke up: a forced check replaces the pending one
  assert.equal(w.requests.length, 3);
  w.answer(w.requests[2], w.server);
  await w.advance(1);
  const good = w.running();
  assert.equal(good.checking, false);
  w.answer(stale, w.server - 3 * HOUR); // the old answer finally arrives, far off
  await w.advance(2_000);
  assert.ok(w.error <= 1, 'the abandoned answer changed nothing');
});

test('slow round trips are used, then refined twice at most', async () => {
  const w = new World(T - 4 * DAY);
  w.rtt = 4_000;
  w.clock.start();
  await w.advance(4_001);
  w.running();
  assert.ok(w.error <= 1, 'a symmetric slow trip is still exact at its midpoint');
  await w.advance(5 * MIN);
  assert.equal(w.requests.length, 3, 'two refinements, then no more');
});

test('phases: days, eve, hour, minute, final ten seconds, by the displayed second', () => {
  const at = (ms: number) => stageOf({ state: 'running', remainingMs: ms, serverNow: T - ms, checking: false });
  assert.equal(at(3 * DAY), 'days');
  assert.equal(at(DAY + 1), 'days', 'shows 1 day 00:00:01');
  assert.equal(at(DAY), 'eve');
  assert.equal(at(HOUR + 1), 'eve');
  assert.equal(at(HOUR), 'hour');
  assert.equal(at(MIN + 1), 'hour');
  assert.equal(at(MIN), 'minute');
  assert.equal(at(10 * SEC + 1), 'minute', 'shows 11');
  assert.equal(at(10 * SEC), 'final');
  assert.equal(at(1), 'final');
  assert.equal(stageOf({ state: 'arrived', serverNow: T, live: true }), 'welcome');
  assert.equal(stageOf({ state: 'arrived', serverNow: COUNTDOWN_OVER_AFTER - 1, live: false }), 'welcome');
  assert.equal(stageOf({ state: 'arrived', serverNow: COUNTDOWN_OVER_AFTER, live: false }), 'commemorative');
  assert.equal(shownSeconds(-5_000), 0, 'never negative');
});

test('the final day: the eve begins exactly at 00:00 on 31 December (Accra is UTC)', async () => {
  const w = new World(Date.parse('2026-12-30T23:59:58.000Z'));
  w.clock.start();
  await w.advance(w.rtt + 10);
  assert.equal(stageOf(w.running()), 'days');
  await w.advance(3_000);
  assert.equal(stageOf(w.running()), 'eve');
});

test('midnight, live: minute → final ten → one live arrival; never negative, never twice, no request at midnight', async () => {
  const w = new World(T - 75 * SEC);
  w.clock.start();
  await w.advance(90 * SEC);
  const stages = w.views.map(v => stageOf(v));
  const order = stages.filter((s, i) => s !== stages[i - 1]);
  assert.deepEqual(order, ['hour', 'minute', 'final', 'welcome'], 'from syncing (the first state) straight to the right stage');
  const arrivals = w.views.filter(v => v.state === 'arrived');
  assert.ok(arrivals.every(v => v.state === 'arrived' && v.live), 'seen live');
  assert.ok(w.views.every(v => v.state !== 'running' || v.remainingMs > 0), 'running never shows zero or less');
  const finals = w.views.filter(v => v.state === 'running' && stageOf(v) === 'final').map(v => shownSeconds((v as { remainingMs: number }).remainingMs));
  assert.deepEqual([...new Set(finals)], [10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 'each of the final ten seconds, in order');
  assert.equal(w.requests.length, 1, 'nothing asked at midnight (the anchor was fresh)');
  // Afterwards: re-renders, foreground returns and reconnects keep the same single arrival.
  for (let i = 0; i < 5; i++) { await w.hide(); await w.show(); w.clock.online(); }
  await w.advance(10 * MIN);
  assert.equal(w.view?.state, 'arrived');
  assert.equal(w.pendingTimers, 0, 'the clock rests after midnight');
});

test('the final check: one request between T-3:00 and T-2:00, at a moment of each page’s own', async () => {
  for (const [random, at] of [[0, FINAL_CHECK], [0.5, FINAL_CHECK + FINAL_SPREAD / 2], [0.999, FINAL_CHECK + FINAL_SPREAD - 60]] as const) {
    const w = new World(T - 20 * MIN, { random });
    w.clock.start();
    await w.advance(T - at - w.server - 2_000);
    assert.equal(w.requests.length, 1);
    await w.advance(3_000);
    assert.equal(w.requests.length, 2, `random ${random}`);
    await w.advance(5 * MIN);
    assert.equal(w.requests.length, 2);
    assert.equal(w.view?.state, 'arrived');
  }
});

test('hidden at midnight: back within a minute still celebrates; later it is a calm welcome', async () => {
  for (const [away, live] of [[30 * SEC, true], [LIVE_GRACE + 30 * SEC, false]] as const) {
    const w = new World(T - 20 * SEC);
    w.clock.start();
    await w.advance(w.rtt);
    await w.hide();
    await w.advance(20 * SEC + away);
    assert.notEqual(w.view?.state, 'arrived', 'no work while hidden');
    await w.show();
    assert.deepEqual({ state: w.view?.state, live: (w.view as { live?: boolean }).live }, { state: 'arrived', live });
  }
});

test('opened just after midnight, or days later: welcome (not live), then commemorative from 8 January', async () => {
  const just = new World(T + 20 * SEC);
  just.clock.start();
  await just.advance(just.rtt);
  assert.equal(just.view?.state, 'arrived');
  assert.equal((just.view as { live: boolean }).live, false, 'someone who missed midnight never gets it as if live');
  const later = new World(Date.parse('2027-01-03T15:00:00Z'));
  later.clock.start();
  await later.advance(later.rtt);
  assert.equal(stageOf(later.view!), 'welcome');
  assert.equal(welcomeKicker((later.view as { serverNow: number }).serverNow), '3 January 2027 · Accra');
  const week = new World(Date.parse('2027-02-14T09:00:00Z'));
  week.clock.start();
  await week.advance(week.rtt);
  assert.equal(stageOf(week.view!), 'commemorative');
  assert.equal(embeddedView(week.view!).state, 'over');
});

test('a sleep across midnight: never zero on a guess; only the server confirms, and two hours late is not live', async () => {
  for (const reply of ['ok', 'fail'] as const) {
    const w = new World(T - 30 * MIN);
    w.clock.start();
    await w.advance(w.rtt);
    await w.hide();
    w.sleep(2 * HOUR);
    w.reply = reply === 'ok' ? 'hang' : 'fail';
    await w.show();
    assert.deepEqual(w.view, { state: 'confirming', failed: false }, 'a check, never a celebration on a guess');
    if (reply === 'ok') w.answer(w.requests[w.requests.length - 1], w.server);
    await w.advance(w.rtt + 1);
    if (reply === 'fail') {
      // Offline on waking: it says it can't confirm yet and keeps trying; it never declares midnight on its own.
      assert.deepEqual(w.view, { state: 'confirming', failed: true });
      await w.advance(10 * MIN);
      assert.deepEqual(w.view, { state: 'confirming', failed: true });
      assert.ok(w.requests.length >= 5 && w.requests.length <= 16, `${w.requests.length} spaced retries (about one a minute)`);
      w.reply = 'ok';
      await w.advance(2 * MIN);
    }
    assert.equal(w.view.state, 'arrived', reply);
    assert.equal((w.view as { live: boolean }).live, false, `${reply}: two hours late is not live`);
  }
});

test('a device clock moved past midnight while offline never brings an early Welcome 2027 (review finding)', async () => {
  const w = new World(T - 2 * DAY);
  w.clock.start();
  await w.advance(w.rtt);
  w.reply = 'fail';
  w.wall += 3 * DAY; // someone moves the phone's clock forward past midnight, with no connection
  await w.advance(2_000);
  assert.deepEqual(w.view, { state: 'confirming', failed: true }, 'a check, not a welcome');
  assert.ok(!w.views.some(v => v.state === 'arrived'));
  await w.advance(5 * MIN);
  assert.ok(!w.views.some(v => v.state === 'arrived'), 'still no welcome while it cannot confirm');
  // Back online: the server says two days are left, and the countdown resumes.
  w.reply = 'ok';
  await w.advance(2 * MIN);
  const v = w.running();
  assert.equal(stageOf(v), 'days');
  assert.ok(w.error <= 1);
  // …and the real midnight, two days later, is still celebrated live.
  await w.advance(T - w.server + 2_000);
  assert.deepEqual({ state: w.view.state, live: (w.view as { live?: boolean }).live }, { state: 'arrived', live: true });
});

test('the embedded card renders through the shared engine (first state: its quiet placeholder)', () => {
  const html = renderToStaticMarkup(React.createElement(NewYearCountdown, {}));
  assert.match(html, /<section class="mg-countdown" aria-hidden="true"><p class="mg-countdown-title">Counting down to 2027…<\/p><\/section>/);
});

test('the embedded card under New Year greetings keeps its 3.6 states', () => {
  assert.deepEqual(embeddedView({ state: 'syncing', slow: true }), { state: 'syncing' });
  assert.deepEqual(embeddedView({ state: 'confirming', failed: true }), { state: 'syncing' });
  assert.deepEqual(embeddedView({ state: 'unavailable' }), { state: 'unavailable' });
  assert.deepEqual(embeddedView({ state: 'running', remainingMs: 5_000, serverNow: T - 5_000, checking: true }), { state: 'running', remainingMs: 5_000 });
  assert.deepEqual(embeddedView({ state: 'arrived', serverNow: T + 1, live: true }), { state: 'arrived' });
  assert.deepEqual(embeddedView({ state: 'arrived', serverNow: COUNTDOWN_OVER_AFTER, live: false }), { state: 'over' });
  const card = code(read('src/greetings/NewYearCountdown.tsx'));
  assert.match(card, /const view = useNewYearCountdown\(true\);/);
  assert.match(card, /<a className="mg-countdown-link" href="\/countdown">Watch the full countdown/);
  assert.ok(card.indexOf('mg-countdown-link') > card.indexOf("view.state === 'syncing'"), 'the link only while counting');
  assert.match(read('src/greetings/RecipientPage.tsx'), /NewYearCountdown/);
});

/* ───────────────────────── The dial and the words ───────────────────────── */

test('dial: the lit ring is the time left in its span and ends at midnight; the seconds light never sweeps back', () => {
  assert.equal(dialModel('days', 2.5 * DAY).lit, 0.5);
  assert.equal(dialModel('days', 3 * DAY).lit, 1, 'a whole day left in the span');
  assert.equal(dialModel('eve', 6 * HOUR).lit, 0.25);
  assert.equal(dialModel('hour', 15 * MIN).lit, 0.25);
  assert.equal(dialModel('minute', 30 * SEC).lit, 0.5);
  assert.deepEqual([dialModel('final', 7_000).segments, dialModel('final', 7_000).litSegments], [10, 7]);
  assert.equal(dialModel('final', 0).litSegments, 0);
  let last = -Infinity;
  for (let ms = 5 * MIN; ms > 0; ms -= 997) { const a = dialModel('hour', ms).secondAngle!; assert.ok(a >= last && a <= 0, `${ms}: one direction only`); last = a; }
  for (const ms of [1, 999, 10_000, 59_999, 60_000, 3_599_999, 3_600_000, 86_399_999, 86_400_000, 30 * DAY]) {
    const stage = stageOf({ state: 'running', remainingMs: ms, serverNow: T - ms, checking: false }), m = dialModel(stage, ms);
    assert.ok(m.lit >= 0 && m.lit <= 1 && m.litSegments >= 0 && m.litSegments <= 10, `${stage} ${ms}`);
  }
  for (const stage of ['welcome', 'commemorative', 'syncing', 'unavailable', 'confirming'] as Stage[]) assert.equal(dialModel(stage, 0).secondAngle, null);
  const svg = renderToStaticMarkup(React.createElement(Dial, { stage: 'hour', remainingMs: 15 * MIN, celebrating: false, motion: true, children: null }));
  assert.match(svg, new RegExp(`stroke-dashoffset="${(-(0.75) * RING_LENGTH).toString().slice(0, 8)}`));
  assert.match(svg, /aria-hidden="true"/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Dial, { stage: 'welcome', remainingMs: 0, celebrating: true, motion: false, children: null })), /cd-spark|cd-ray/, 'no burst with reduced motion');
});

test('words: greetings and time only, Accra named, no offers or promises; spoken once per stage, minute precision', () => {
  const all = (['syncing', 'unavailable', 'confirming', 'days', 'eve', 'hour', 'minute', 'final', 'welcome', 'commemorative'] as Stage[])
    .map(s => stageCopy(s, T + HOUR)).flatMap(c => [c.kicker, c.title, c.lede ?? '']).join(' | ');
  assert.doesNotMatch(all, /discount|free|win|prize|reward|offer|bonus|GH[S₵]|%|promo|giveaway|deliver|guarantee/i);
  assert.match(stageCopy('days').kicker, /Accra/);
  assert.match(stageCopy('unavailable').lede!, /never guess it from your device’s clock/);
  assert.equal(stageCopy('commemorative').title, '2027 began here');
  assert.doesNotMatch(stageCopy('commemorative').lede!, /live|now|join|countdown is on/i, 'nothing suggests it is still running');
  assert.equal(welcomeKicker(T + 5 * HOUR), 'New Year’s Day · Accra');
  assert.equal(welcomeKicker(Date.parse('2027-01-07T23:59:59Z')), '7 January 2027 · Accra');
  assert.deepEqual(Object.keys(STAGE_ANNOUNCEMENT).sort(), ['eve', 'final', 'hour', 'minute', 'welcome']);
  assert.equal(remainingSentence(1_000), '1 second until midnight on 1 January 2027 in Accra.');
  assert.equal(remainingSentence(45_000), '45 seconds until midnight on 1 January 2027 in Accra.');
  assert.equal(remainingSentence(61_000), 'About 2 minutes until midnight on 1 January 2027 in Accra.');
  assert.equal(remainingSentence(DAY + HOUR + MIN), 'About 1 day, 1 hour and 1 minute until midnight on 1 January 2027 in Accra.');
  assert.equal(remainingSentence(3 * DAY), 'About 3 days until midnight on 1 January 2027 in Accra.');
  assert.deepEqual([...COUNTING], ['days', 'eve', 'hour', 'minute', 'final']);
});

/* ───────────────────────── The page in each state (server-rendered markup) ───────────────────────── */

const render = (view: ClockView) => renderToStaticMarkup(React.createElement(CountdownExperience, { view, retry: () => undefined }));
const running = (ms: number, checking = false): ClockView => ({ state: 'running', remainingMs: ms, serverNow: T - ms, checking });

test('page: honest syncing, slow and unavailable states with no invented numbers', () => {
  const syncing = render({ state: 'syncing', slow: false });
  assert.match(text(syncing), /Checking the time in Accra…/);
  assert.doesNotMatch(syncing, /role="timer"/);
  // An empty frame holds the timer's place (so nothing jumps when the time arrives), with dashes and never a number.
  const frame = syncing.match(/<div class="cd-cells"[\s\S]*?<\/div>/)![0];
  assert.match(frame, /aria-hidden="true"/);
  assert.doesNotMatch(text(frame), /\d/);
  assert.match(syncing, /class="cd-lede is-reserve" aria-hidden="true"/, 'the lede’s space is held, invisibly');
  assert.match(text(render({ state: 'syncing', slow: true })), /Still connecting… your connection seems slow\./);
  const down = render({ state: 'unavailable' });
  assert.match(down, /role="alert"/);
  assert.match(text(down), /We can’t check the time in Accra right now\. Try again/);
  assert.doesNotMatch(down, /role="timer"|cd-cell/);
  assert.match(text(render({ state: 'confirming', failed: false })), /Checking the time in Accra…/);
  assert.match(text(render({ state: 'confirming', failed: true })), /We can’t confirm the time in Accra right now\. Trying again…/);
  assert.doesNotMatch(render({ state: 'confirming', failed: true }), /Welcome, 2027|role="timer"/);
});

test('page: each counting stage shows its own cells; the final minute and seconds drop sharing for focus', () => {
  const days = render(running(12 * DAY + 3 * HOUR + 4 * MIN + 5 * SEC));
  assert.match(days, /data-stage="days"/);
  assert.match(days, /role="timer" aria-label="Time until 2027 in Accra"/);
  assert.match(days, /data-count="4"/);
  assert.match(text(days), /Counting down to 2027/);
  assert.match(text(days), /About 12 days, 3 hours and 5 minutes until midnight/);
  assert.match(text(days), /Midnight, 1 January 2027 · Accra time \(GMT\)/);
  assert.match(text(days), /WhatsApp \(opens WhatsApp\)/);
  assert.match(days, /Copy link/);
  assert.doesNotMatch(text(days), /\bsent\b/i);
  assert.match(render(running(5 * HOUR)), /data-count="3"/);
  const hour = render(running(30 * MIN));
  assert.match(hour, /data-count="2"/);
  assert.match(hour, /data-quiet="true"/);
  const minute = render(running(42 * SEC));
  assert.match(minute, /cd-minute-number">42</);
  assert.doesNotMatch(minute, /Copy link|WhatsApp/);
  const final = render(running(7 * SEC));
  assert.match(final, /cd-final-number" aria-hidden="true">7</);
  assert.doesNotMatch(final, /Copy link|WhatsApp/);
  assert.match(final, /Visit Mystery Hub/, 'the way back is always there');
  assert.match(text(render(running(3 * DAY, true))), /Re-checking the time…/);
  for (const html of [days, hour, minute, final]) assert.doesNotMatch(text(html), /-\d/, 'no negative numbers');
  // The first second of the eve and of the final hour (review finding): never a row of zeros an hour early.
  const cellsOf = (html: string) => text(html.match(/<div class="cd-cells"[\s\S]*?<\/div>/)![0]);
  assert.equal(cellsOf(render(running(DAY))), '2 4 hours 0 0 minutes 0 0 seconds');
  assert.equal(cellsOf(render(running(DAY - 1))), '2 4 hours 0 0 minutes 0 0 seconds');
  assert.equal(cellsOf(render(running(DAY - SEC))), '2 3 hours 5 9 minutes 5 9 seconds');
  assert.equal(cellsOf(render(running(HOUR))), '6 0 minutes 0 0 seconds');
  assert.equal(cellsOf(render(running(HOUR - 999))), '6 0 minutes 0 0 seconds');
  assert.equal(cellsOf(render(running(HOUR - SEC))), '5 9 minutes 5 9 seconds');
  assert.equal(cellsOf(render(running(DAY + SEC))), '1 day 0 0 hours 0 0 minutes 0 1 second');
});

test('page: welcome after midnight and the commemorative page; replay is offered and labelled, never automatic', () => {
  const welcome = render({ state: 'arrived', serverNow: T + 2 * HOUR, live: false });
  assert.match(welcome, /data-stage="welcome"/);
  assert.doesNotMatch(welcome, /data-celebration/, 'the markup starts calm (whether it celebrates is an effect: see the next test and the browser review)');
  assert.match(text(welcome), /New Year’s Day · Accra Welcome, 2027 Happy New Year from all of us at Mystery Hub\. Afehyia pa!/);
  assert.match(welcome, /Replay midnight/);
  assert.match(text(welcome), /Send New Year wishes with this page\./);
  assert.doesNotMatch(welcome, /role="timer"/);
  const later = render({ state: 'arrived', serverNow: Date.parse('2027-03-01T10:00:00Z'), live: false });
  assert.match(later, /data-stage="commemorative"/);
  assert.match(text(later), /2027 began here/);
  assert.doesNotMatch(later, /WhatsApp|Copy link|role="timer"/);
  assert.match(later, /Visit Mystery Hub/);
  assert.match(read('src/countdown/CountdownPage.tsx'), /celebration === 'replay' && <p className="cd-replay-note">Replay · not live<\/p>/);
});

test('page (source pins; behaviour checked in the browser review): one live celebration per load, finite', () => {
  const page = code(read('src/countdown/CountdownPage.tsx'));
  assert.match(page, /let livePlayed = false;/);
  assert.match(page, /const live = view\.state === 'arrived' && view\.live;/);
  assert.match(page, /if \(!live \|\| livePlayed\) return;\s*livePlayed = true;\s*setCelebration\('live'\);/);
  assert.match(page, /setTimeout\(\(\) => setCelebration\(null\), reducedMotion\(\) \? 1200 : CELEBRATION_MS\)/);
  const css = read('src/countdown/countdown.css');
  assert.doesNotMatch(css, /animation[^;]*infinite/, 'every animation is finite');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.cd-page \*, \.cd-page \*::before, \.cd-page \*::after \{ animation: none !important; transition: none !important; \}/);
});

test('page: accessible structure; announcements once per stage (source pins; spoken behaviour in the browser review)', () => {
  const html = render(running(2 * HOUR));
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.match(html, /<main class="cd-page"/);
  assert.match(html, /aria-live="polite"/);
  assert.equal((html.match(/aria-live=/g) || []).length, 2, 'the stage announcement and the copy note only');
  assert.match(html, /aria-label="Mystery Hub home"/);
  assert.match(html, /aria-label="2027"/);
  const cells = html.match(/class="cd-cells"[^>]*/)![0];
  assert.match(cells, /aria-hidden="true"/, 'the ticking digits are hidden from screen readers');
  const page = code(read('src/countdown/CountdownPage.tsx'));
  assert.match(page, /if \(was === stage \|\| !\(isCounting\(was\) \|\| was === 'confirming'\)\) return;/);
  assert.match(page, /if \(words && \(stage !== 'welcome' \|\| live\)\) setAnnouncement\(words\);/);
  assert.match(page, /aria-pressed=\{sound\.on\}/);
});

/* ───────────────────────── Sharing, sound and the immersive view ───────────────────────── */

test('sharing: one canonical link, nothing personal, never a claim that it was sent', async () => {
  assert.equal(COUNTDOWN_URL, 'https://mysterybundlehub.com/countdown');
  assert.equal(countdownWhatsappHref(false), `https://wa.me/?text=${encodeURIComponent('Counting down to 2027 with Mystery Hub. Join me for midnight in Accra: https://mysterybundlehub.com/countdown')}`);
  assert.match(decodeURIComponent(countdownWhatsappHref(true)), /Happy New Year! 2027 has arrived in Accra\. Afehyia pa! https:\/\/mysterybundlehub\.com\/countdown$/);
  assert.doesNotMatch(countdownWhatsappHref(false), /utm_|ref=|\bid=/);
  const nav = (share?: (d: ShareData) => Promise<void>) => ({ share, canShare: () => true } as unknown as Navigator);
  assert.equal(await shareCountdown(false, nav()), 'unsupported');
  let shared: ShareData | null = null;
  assert.equal(await shareCountdown(false, nav(async d => { shared = d; })), 'opened');
  assert.deepEqual(shared, { title: 'Countdown to 2027 · Mystery Hub', text: countdownShareText(false), url: COUNTDOWN_URL });
  assert.equal(await shareCountdown(true, nav(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); })), 'cancelled');
  assert.equal(await shareCountdown(true, nav(async () => { throw new Error('blocked'); })), 'unsupported');
  for (const file of readdirSync('src/countdown')) assert.doesNotMatch(code(read(path.join('src/countdown', file))), /\bsent\b|delivered/i, file);
});

test('sound: off until tapped, built in the browser, never a download; quiet when unsupported or refused', async () => {
  assert.equal(soundSupported({} as Window), false);
  assert.equal(createCountdownSound({} as Window), null);
  const created: string[] = [];
  class FakeContext { state = 'suspended'; currentTime = 0; destination = {}; constructor() { created.push('ctx'); } createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({}) }; } createOscillator() { return { type: '', frequency: { value: 0 }, connect: () => ({ connect: () => ({}) }), start() {}, stop() {} }; } resume() { this.state = 'running'; return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); } }
  const sound = createCountdownSound({ AudioContext: FakeContext } as unknown as Window)!;
  assert.equal(sound.on, false);
  sound.tick(false); sound.midnight();
  assert.equal(created.length, 0, 'nothing is created before the tap');
  assert.equal(await sound.enable(), true);
  assert.equal(sound.on, true);
  assert.equal(created.length, 1);
  sound.close();
  assert.equal(sound.on, false);
  class Refusing extends FakeContext { resume() { return Promise.reject(new Error('not allowed')); } }
  const refused = createCountdownSound({ AudioContext: Refusing } as unknown as Window)!;
  assert.equal(await refused.enable(), false, 'a refused start says so');
  assert.equal(refused.on, false);
  class Silent extends FakeContext { resume() { return Promise.resolve(); } }
  assert.equal(await createCountdownSound({ AudioContext: Silent } as unknown as Window)!.enable(), false, 'still suspended: not on');
  const src = code(read('src/countdown/sound.ts'));
  assert.doesNotMatch(src, /\.mp3|\.ogg|\.wav|fetch\(|new Audio\(|decodeAudioData/);
});

test('immersive: unsupported or refused full screen changes nothing; the wake lock is optional', async () => {
  const el = {} as HTMLElement;
  assert.equal(fullscreenAvailable({} as Document), false);
  assert.equal(await requestFullscreen(el, {} as Document), false, 'iPhone Safari: no page full screen');
  const refusing = { fullscreenEnabled: true } as unknown as Document;
  assert.equal(await requestFullscreen({ requestFullscreen: async () => { throw new TypeError('denied'); } } as unknown as HTMLElement, refusing), false);
  const doc = { fullscreenEnabled: true, fullscreenElement: null as unknown } as unknown as Document & { fullscreenElement: unknown };
  assert.equal(await requestFullscreen({ requestFullscreen: async () => { doc.fullscreenElement = el; } } as unknown as HTMLElement, doc), true);
  assert.equal(await keepScreenOn({} as Navigator), null);
  assert.equal(await keepScreenOn({ wakeLock: { request: async () => { throw new Error('battery saver'); } } } as unknown as Navigator), null);
  const page = code(read('src/countdown/CountdownPage.tsx'));
  assert.match(page, /if \(e\.key === 'Escape'\) exit\(\);/);
  assert.match(page, /if \(wentFullscreen\.current && !isFullscreen\(\)\) \{ wentFullscreen\.current = false; exit\(\); \}/);
  assert.match(page, /requestAnimationFrame\(\(\) => enterButton\.current\?\.focus\(\)\)/, 'focus returns to the button');
});

/* ───────────────────────── Link previews, the route, the bundle and the server ───────────────────────── */

test('link preview: words follow the server clock; the canonical /countdown head is meaningful and indexable', async () => {
  const before = countdownHead(new Date('2026-12-31T22:00:00Z'));
  assert.equal(before.title, 'Countdown to 2027 · Midnight in Accra — Mystery Hub');
  assert.equal(before.url, 'https://mysterybundlehub.com/countdown');
  assert.equal(before.image, 'https://mysterybundlehub.com/og/mystery-countdown-2027-v1.jpg');
  assert.equal(before.imageWidth, 1200); assert.equal(before.imageHeight, 630);
  assert.ok(before.imageAlt && before.imageAlt.length > 20);
  const after = countdownHead(new Date(T));
  assert.equal(after.title, 'Welcome 2027 · Happy New Year from Accra — Mystery Hub');
  assert.doesNotMatch(`${after.title} ${after.description}`, /count down to|live countdown/i);
  for (const route of ['/countdown', '/countdown/', '/COUNTDOWN', '/countdown?utm_source=whatsapp']) {
    const { head, status, customerSite } = await resolvePublicSocialMetadata(route);
    assert.equal(status, 200, route);
    assert.equal(customerSite, false);
    assert.equal(head.image, COUNTDOWN_SHARE_IMAGE.image);
    assert.ok(!head.noindex, `${route} is indexable`);
    assert.match(head.title, /2027/);
  }
  assert.notEqual((await resolvePublicSocialMetadata('/countdownx')).head.image, COUNTDOWN_SHARE_IMAGE.image);
});

test('link preview image: a real 1200x630 JPEG, small, with no date or number on it beyond 2027', () => {
  const file = 'public/og/mystery-countdown-2027-v1.jpg';
  const jpeg = readFileSync(file);
  assert.equal(jpeg[0], 0xff); assert.equal(jpeg[1], 0xd8);
  let i = 2, size: [number, number] | null = null;
  while (i < jpeg.length) {
    const marker = jpeg[i + 1], length = jpeg.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc2) { size = [jpeg.readUInt16BE(i + 7), jpeg.readUInt16BE(i + 5)]; break; }
    i += 2 + length;
  }
  assert.deepEqual(size, [1200, 630]);
  assert.ok(statSync(file).size < 150_000, `${statSync(file).size} bytes`);
  const script = read('scripts/renderCountdownShareImage.tsx');
  assert.match(script, /remainingMs: 4 \* 3600_000/, 'drawn from the real dial');
  assert.doesNotMatch(script, /Date\.now\(\)|new Date\(/, 'one fixed image, not tied to a moment');
});

test('route: /countdown is its own small surface and never downloads the commerce app', () => {
  const main = code(read('src/main.tsx'));
  assert.match(main, /const countdownPath = \/\^\\\/countdown\\\/\?\$\/i\.test\(window\.location\.pathname\);/);
  assert.match(main, /countdownPath \? Promise\.all\(\[import\('\.\/countdown\/CountdownPage'\), import\('\.\/countdown\/countdown\.css'\)\]\)/);
  // 3.7.3: the head script (utils/startupHints) leaves /countdown alone, by the same rule as main.tsx (performanceMobile373
  // runs the script for every path).
  assert.match(read('src/utils/startupHints.ts'), /countdown: \/\^\\\/countdown\\\/\?\$\/i,/);
  if (existsSync('dist/index.html')) assert.match(read('dist/index.html'), /\|\|\/\^\\\/countdown\\\/\?\$\/i\.test\(p\)\|\|/);
  // The page's whole static import graph stays clear of the app, accounts, checkout and Paystack.
  const seen = new Set<string>(), queue = ['src/countdown/CountdownPage.tsx'];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, spec] of code(read(file)).matchAll(/^\s*import\s+(?!type\b)[^'"]*?from\s+'(\.[^']+)'/gm)) {
      const base = path.join(path.dirname(file), spec).replace(/\.js$/, '');
      const hit = ['.ts', '.tsx', '/index.ts', '/index.tsx', ''].map(ext => base + ext).find(f => existsSync(f) && statSync(f).isFile());
      if (hit && /\.(ts|tsx)$/.test(hit)) queue.push(hit);
    }
  }
  const files = [...seen].join('\n');
  assert.doesNotMatch(files, /App\.tsx|AppContext|apiClient|usePaystack|checkout|Marketplace|components\/auth/i, files);
  assert.ok(seen.size < 20, `${seen.size} modules`);
});

test('security: no HTML sinks, no storage of anything personal, no device-clock countdown', () => {
  for (const file of readdirSync('src/countdown').map(f => path.join('src/countdown', f))) {
    const src = code(read(file));
    assert.doesNotMatch(src, /dangerouslySetInnerHTML|\.innerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, file);
    assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|document\.cookie/, file);
    if (file.endsWith('.tsx')) assert.doesNotMatch(src, /Date\.now\(\)|new Date\(\)/, `${file}: time only from the shared clock`);
  }
  const page = code(read('src/countdown/CountdownPage.tsx'));
  assert.match(page, /if \(analyticsAllowed\(\)\) trackGrowth\('page_view', \{ page: 'countdown' \}\);/, 'existing analytics, consent first');
  assert.match(page, /useEffect\(\(\) => \{ if \(opened\) trackExperience\('countdown_open'\); \}, \[opened\]\);/);
});

test('server: the clock endpoint is unchanged, private, database-free, and outside the shared Greetings budget', async t => {
  assert.deepEqual(countdownState(new Date('2026-12-31T23:59:59.000Z')), { schemaVersion: 1, timeZone: 'Africa/Accra', target: COUNTDOWN_TARGET, serverTime: '2026-12-31T23:59:59.000Z', remainingMs: 1_000, passed: false });
  assert.equal(COUNTDOWN_TARGET, '2027-01-01T00:00:00.000Z');
  assert.deepEqual([COUNTDOWN_READS_PER_VISITOR, COUNTDOWN_READS_TOTAL], [1200, 12000]);
  const state = t.mock.method(ExperienceService, 'state', async () => ({ ok: true }));
  const app = express(); app.use('/api/experiences', experienceRouter);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/experiences`;
  try {
    const first = await fetch(`${base}/countdown`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('cache-control'), 'no-store, private');
    assert.equal(first.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(first.headers.get('x-content-type-options'), 'nosniff');
    const body = await first.json() as { target: string; serverTime: string };
    assert.equal(body.target, COUNTDOWN_TARGET);
    assert.ok(Math.abs(Date.parse(body.serverTime) - Date.now()) < 5_000);
    // A spent shared Greetings budget never stalls the clock, and the clock's reads never spend it.
    for (let i = 0; i < 50; i++) await fetch(`${base}/countdown`);
    let limited = 0;
    for (let i = 0; i < 245; i++) if ((await fetch(`${base}/state`)).status === 429) limited++;
    assert.equal(limited, 5, 'the shared budget is still 240 a minute, untouched by 51 clock reads');
    assert.equal(state.mock.callCount(), 240);
    assert.equal((await fetch(`${base}/countdown`)).status, 200, 'the clock still answers');
  } finally {
    await new Promise<void>(done => server.close(() => done()));
  }
});

test('server: clock admission is bounded per visitor network and for the process, with small memory and no lock-out', () => {
  let now = 1_000_000;
  const admit = createClockAdmission({ perVisitor: 3, total: 10, maxKeys: 4, identify: req => (req as unknown as { who: { key: string; established: boolean } }).who, now: () => now });
  const ask = (key: string, established = true) => {
    let status = 200, retry: string | undefined, passed = false;
    const res = { set(h: string, v: string) { if (h === 'Retry-After') retry = v; return res; }, status(c: number) { status = c; return res; }, json() { return res; } };
    admit({ who: { key, established } } as never, res as never, () => { passed = true; });
    return { status: passed ? 200 : status, retry };
  };
  assert.deepEqual([1, 2, 3, 4].map(() => ask('a').status), [200, 200, 200, 429], 'per visitor network');
  assert.equal(ask('a').retry, '60', 'says when to come back');
  for (const k of ['b', 'c', 'd', 'e', 'f']) assert.equal(ask(k).status, 200, `new visitor ${k} is never locked out by a full key table`);
  assert.equal(ask('g').status, 200);
  assert.equal(ask('h').status, 200, 'the tenth');
  assert.equal(ask('i').status, 429, 'the process ceiling (10 a minute here)');
  now += 30_000;
  assert.equal(ask('i').retry, '30');
  now += 30_000;
  assert.equal(ask('a').status, 200, 'a new window starts clean');
  // Unqualified ingress shares one key: it is held to the process ceiling, not to one visitor's budget.
  now += 60_000;
  const shared = Array.from({ length: 11 }, () => ask('unverified', false).status);
  assert.deepEqual([shared.filter(s => s === 200).length, shared[10]], [10, 429]);
  const src = code(read('server/middleware/clockAdmission.ts'));
  assert.match(src, /counts = new Map\(\)/, 'one number per key, cleared each window');
});

/* ───────────────────────── Discovery ───────────────────────── */

test('discovery: suggested from 27 December to New Year’s Day only, never during Christmas, never a gate', () => {
  const on = (date: string) => countdownInvite(seasonPhase(date));
  assert.equal(on('2026-12-20'), null);
  assert.equal(on('2026-12-25'), null);
  assert.equal(on('2026-12-26'), null);
  assert.equal(on('2026-12-27'), 'Watch the countdown to 2027');
  assert.equal(on('2026-12-30'), 'Watch the countdown to 2027');
  assert.equal(on('2026-12-31'), 'Join the countdown to midnight');
  assert.equal(on('2027-01-01'), 'See Welcome 2027');
  assert.equal(on('2027-01-02'), null);
  assert.equal(on('2027-02-01'), null);
  for (const phase of ['before', 'christmas-season', 'christmas-day', 'boxing-day', 'new-year', 'after'] as SeasonPhase[]) assert.equal(countdownInvite(phase), null, phase);
  assert.equal(COUNTDOWN_HREF, '/countdown');
  const home = code(read('src/seasonal/christmas/home/ChristmasHome.tsx'));
  assert.match(home, /\{invite && <a className="xh-hero-countdown" href=\{COUNTDOWN_HREF\}>/);
  const member = code(read('src/seasonal/christmas/member/ChristmasMemberView.tsx'));
  assert.match(member, /\{tone !== 'attention' && invite && <a className="xm-countdown-link" href=\{COUNTDOWN_HREF\}>/, 'never beside a payment or order that needs attention');
  // The page itself is public and works with every seasonal setting off: no flag, account or pack check in its code.
  const page = code(read('src/countdown/CountdownPage.tsx'));
  assert.doesNotMatch(page, /SEASONAL_EXPERIENCE|seasonStatus|useApp|isAuthenticated|MYSTERY_GREETING/);
  assert.equal(STARS.length, 64);
});
