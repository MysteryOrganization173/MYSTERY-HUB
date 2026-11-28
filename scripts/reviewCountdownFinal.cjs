/*
 * Mystery Countdown 3.7 final: founder review evidence. LOCAL ONLY, synthetic time only.
 *
 * Runs Playwright Chromium against a LOCAL production build with the recordings staged beside it
 * (`npm run build`, copy the audio into dist/countdown-audio/v1/, `npx vite preview --port 4173`). The server's clock is a
 * controlled answer from /api/experiences/countdown (intercepted in the browser); nothing reaches production and no
 * real time override exists anywhere.
 *
 *   node scripts/reviewCountdownFinal.cjs shots [filter]   responsive screenshots: every required size and state
 *   node scripts/reviewCountdownFinal.cjs record           audio-visual recordings with the page's real audio
 *
 *   COUNTDOWN_REVIEW_BASE_URL  default http://localhost:4173 (must be loopback)
 *   COUNTDOWN_REVIEW_OUT       output folder (default /tmp/countdown-final-review)
 *   COUNTDOWN_REVIEW_MARK      optional PNG served in place of the Cloudinary brand mark (offline sandboxes)
 *
 * The audio tap (a MediaStreamDestination beside the page's own output, recorded with MediaRecorder) is injected by
 * this script only; the page itself never records anything. Requires Playwright and ffmpeg (not project dependencies).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = (process.env.COUNTDOWN_REVIEW_BASE_URL || 'http://localhost:4173').replace(/\/$/, '');
const OUT = process.env.COUNTDOWN_REVIEW_OUT || '/tmp/countdown-final-review';
const MARK = process.env.COUNTDOWN_REVIEW_MARK || '';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('Refusing a non-loopback server.');
fs.mkdirSync(OUT, { recursive: true });

const T = Date.parse('2027-01-01T00:00:00.000Z');
const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;
const ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SIZES = [
  ['phone-se', 320, 568], ['phone-small', 360, 640], ['phone', 390, 844], ['phone-large', 430, 932],
  ['tablet-portrait', 768, 1024], ['tablet-landscape', 1024, 768], ['laptop', 1280, 800], ['laptop-hd', 1366, 768],
  ['desktop', 1440, 900], ['tv-fhd', 1920, 1080], ['desktop-qhd', 2560, 1440], ['ultrawide', 3440, 1440], ['tv-4k', 3840, 2160],
];
const STATES = [
  ['days', T - (34 * DAY + 5 * HOUR + 12 * MIN + 9 * SEC)],
  ['eve', T - (6 * HOUR + 14 * MIN + 30 * SEC)],
  ['hour', T - (23 * MIN + 41 * SEC)],
  ['minute', T - 47 * SEC],
  ['final', T - 7.4 * SEC],
  ['celebration', T - 1.2 * SEC],
  ['welcome', T + 3 * HOUR],
  ['commemorative', Date.parse('2027-02-10T12:00:00Z')],
];

/** The audio tap: everything the page sends to the speakers is also sent to a recorder stream. */
const AUDIO_TAP = () => {
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const result = connect.call(this, dest, ...rest);
    if (typeof AudioDestinationNode !== 'undefined' && dest instanceof AudioDestinationNode) {
      const c = this.context;
      if (!c.__tap) { c.__tap = c.createMediaStreamDestination(); window.__taps = (window.__taps || []).concat(c.__tap); }
      connect.call(this, c.__tap);
    }
    return result;
  };
};

async function open(browser, { serverAt, width, height, ua, clock = true, reduced = false, scale = 1, init }) {
  const context = await browser.newContext({ viewport: { width, height }, userAgent: ua || (width >= 1000 ? DESKTOP : ANDROID), deviceScaleFactor: scale, reducedMotion: reduced ? 'reduce' : 'no-preference', isMobile: width < 1000 && !ua, hasTouch: width < 1000 });
  const page = await context.newPage();
  const state = { errors: [], requests: [] };
  page.on('pageerror', e => state.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) state.errors.push(m.text()); });
  page.on('request', r => state.requests.push(r.url()));
  if (clock) { await page.clock.install({ time: new Date('2026-06-01T10:00:00Z') }); await page.clock.pauseAt(new Date('2026-06-01T10:00:01Z')); }
  if (init) await page.addInitScript(init);
  await page.route('**/api/experiences/countdown', async r => {
    let elapsed = 0;
    try { elapsed = await page.evaluate(() => performance.now()); } catch { /* closing */ }
    const now = serverAt + elapsed;
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ schemaVersion: 1, timeZone: 'Africa/Accra', target: '2027-01-01T00:00:00.000Z', serverTime: new Date(now).toISOString(), remainingMs: Math.max(0, T - now), passed: now >= T }) }).catch(() => undefined);
  });
  if (MARK) await page.route('https://res.cloudinary.com/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(MARK) }));
  await page.route('**/api/analytics/**', r => r.fulfill({ status: 204, body: '' }));
  await page.route('**/api/experiences/events', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto(BASE + '/countdown', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.cd-page', { timeout: 15_000 });
  return { page, context, state };
}

/** Horizontal overflow, and whether the essentials (title, dial, time) fit on the first screen. */
const measure = page => page.evaluate(() => {
  const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? { top: b.top, bottom: b.bottom, left: b.left, right: b.right } : null; };
  const wide = document.scrollingElement.scrollWidth > innerWidth + 1
    || [...document.querySelectorAll('.cd-shell *')].filter(e => !e.closest('.cd-burst, .cd-sr, .cd-credits-body')).some(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1); });
  return { wide, scrolls: document.scrollingElement.scrollHeight > innerHeight + 1, h1: r('h1'), dial: r('.cd-dial'), cells: r('.cd-cells'), player: r('.cd-player-bar'), vw: innerWidth, vh: innerHeight };
});

async function shots(filter) {
  const browser = await chromium.launch();
  const report = [];
  for (const [label, width, height] of SIZES) {
    if (filter && !new RegExp(filter).test(label)) continue;
    for (const [name, serverAt] of STATES) {
      const { page, context, state } = await open(browser, { serverAt, width, height });
      const want = name === 'celebration' ? 'welcome' : name;
      await page.waitForSelector(`.cd-page[data-stage="${want}"]`, { timeout: 10_000 }).catch(() => undefined);
      if (name === 'celebration') { for (let i = 0; i < 14; i++) await page.clock.runFor(400); }
      await page.evaluate(() => document.fonts.ready);
      await sleep(name === 'celebration' ? 300 : 700);
      const m = await measure(page);
      await page.screenshot({ path: path.join(OUT, `${label}-${width}x${height}-${name}.png`) });
      report.push({ label, width, height, state: name, ...m, errors: state.errors.length });
      console.log(`${label} ${width}x${height} ${name}: overflow ${m.wide ? 'YES' : 'no'}, scrolls ${m.scrolls ? 'yes' : 'no'}${m.dial && m.dial.bottom > m.vh + 1 ? ' DIAL OFF SCREEN' : ''}${m.cells && m.cells.bottom > m.vh + 1 ? ' TIME OFF SCREEN' : ''}${state.errors.length ? ' ERRORS ' + state.errors.join(' | ') : ''}`);
      await context.close();
    }
    // The player, started (sound needs a real tap; the clock is real here so audio can flow).
    const { page, context } = await open(browser, { serverAt: T - 3 * DAY, width, height, clock: false });
    await page.waitForSelector('.cd-page[data-stage="days"]');
    await page.getByRole('button', { name: 'Play music' }).click();
    await page.waitForSelector('.cd-player', { timeout: 5_000 });
    await sleep(1_500);
    const more = page.getByRole('button', { name: 'More sound controls' });
    if (await more.isVisible().catch(() => false)) await more.click();
    await sleep(400);
    const m = await measure(page);
    await page.screenshot({ path: path.join(OUT, `${label}-${width}x${height}-player.png`) });
    console.log(`${label} ${width}x${height} player: overflow ${m.wide ? 'YES' : 'no'}, scrolls ${m.scrolls ? 'yes' : 'no'}`);
    report.push({ label, width, height, state: 'player', ...m });
    await context.close();
  }
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(report, null, 2));
  await browser.close();
}

/**
 * One recording: the page from `from` (ms before midnight, negative) for `seconds`, sound started with a real tap,
 * screencast frames with their timestamps and the page's own audio, muxed into an MP4.
 */
async function record(browser, { name, width, height, from, seconds, start = true, effectsOnly = false }) {
  const { page, context, state } = await open(browser, { serverAt: T + from, width, height, clock: false, init: AUDIO_TAP });
  const cdp = await context.newCDPSession(page);
  const dir = path.join(OUT, `rec-${name}`);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const file = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    frames.push({ file, t: f.metadata.timestamp });
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined);
  });
  await page.waitForSelector('.cd-dial');
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 82, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  let audioStart = null;
  if (start) {
    await sleep(800);
    await page.getByRole('button', { name: 'Play music' }).click();
    if (effectsOnly) { await sleep(600); await page.getByRole('button', { name: 'Pause music' }).click(); }
    audioStart = await page.evaluate(() => new Promise((resolve, reject) => {
      const tap = (window.__taps || [])[0];
      if (!tap) return reject(new Error('no audio tap'));
      const rec = new MediaRecorder(tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 160_000 });
      window.__chunks = []; window.__rec = rec;
      rec.ondataavailable = e => window.__chunks.push(e.data);
      rec.onstart = () => resolve((performance.timeOrigin + performance.now()) / 1000);
      rec.start(1000);
    }));
  }
  await sleep(seconds * 1000);
  const stopAt = await page.evaluate(() => (performance.timeOrigin + performance.now()) / 1000);
  await cdp.send('Page.stopScreencast');
  let audioFile = null;
  if (start) {
    const b64 = await page.evaluate(() => new Promise(resolve => {
      window.__rec.onstop = async () => { const blob = new Blob(window.__chunks, { type: 'audio/webm' }); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); resolve(btoa(s)); };
      window.__rec.stop();
    }));
    audioFile = path.join(dir, 'audio.webm');
    fs.writeFileSync(audioFile, Buffer.from(b64, 'base64'));
  }
  const audioRequests = state.requests.filter(u => /countdown-audio/.test(u)).map(u => u.replace(/^.*countdown-audio\/v1\//, ''));
  await context.close();
  // A variable-frame-rate list from the real timestamps, then a steady 30 fps H.264 MP4 with the audio in step.
  // The screen only sends a frame when something changes, so the last frame holds until the recording stopped.
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.t ?? Math.max(stopAt, f.t + 1 / 30)) - f.t).toFixed(4)}`).join('\n') + `\nfile '${frames[frames.length - 1].file}'\n`;
  fs.writeFileSync(path.join(dir, 'frames.txt'), list);
  const mp4 = path.join(OUT, `${name}.mp4`);
  const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'frames.txt')];
  if (audioFile) args.push('-itsoffset', (audioStart - frames[0].t).toFixed(3), '-i', audioFile);
  args.push('-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-movflags', '+faststart');
  if (audioFile) args.push('-c:a', 'aac', '-b:a', '160k', '-shortest');
  args.push(mp4);
  execFileSync('ffmpeg', args);
  const info = { name, width, height, from: from / 1000, seconds, frames: frames.length, fps: +(frames.length / (stopAt - frames[0].t)).toFixed(1),
    audioOffset: audioStart ? +(audioStart - frames[0].t).toFixed(3) : null, bytes: fs.statSync(mp4).size, audioRequests, errors: state.errors };
  console.log(JSON.stringify(info));
  return info;
}

(async () => {
  const [mode, filter] = process.argv.slice(2);
  if (mode === 'shots') return shots(filter);
  if (mode === 'record') {
    const browser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
    const plan = [
      { name: 'midnight-mobile-390x844', width: 390, height: 844, from: -75 * SEC, seconds: 118 },
      { name: 'midnight-tv-1920x1080', width: 1920, height: 1080, from: -75 * SEC, seconds: 118 },
      { name: 'final-ten-effects-only-390x844', width: 390, height: 844, from: -16 * SEC, seconds: 36, effectsOnly: true },
    ].filter(p => !filter || new RegExp(filter).test(p.name));
    const results = [];
    for (const p of plan) results.push(await record(browser, p));
    fs.writeFileSync(path.join(OUT, 'recordings.json'), JSON.stringify(results, null, 2));
    await browser.close();
    return;
  }
  console.log('usage: reviewCountdownFinal.cjs shots [filter] | record [filter]');
})().catch(e => { console.error(e); process.exit(1); });
