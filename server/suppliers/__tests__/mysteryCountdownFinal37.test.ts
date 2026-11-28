import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COUNTDOWN_TARGET_MS } from '../../../src/greetings/countdown.js';
import {
  AUDIO_BASE, CUES, MUSIC_CREDITS, PLAYLISTS, TRACKS, audioUrl, nextTrack, pickFormat, previousTrack, seasonFor, trackById, type Season,
} from '../../../src/countdown/music.js';
import {
  BUILD_AT, CELEBRATION_REDUCED_SECONDS, CELEBRATION_SECONDS, CROSSFADE, CUES_FROM_SECONDS, FIREWORKS, LAST_TICK_FADE, NEW_YEAR_AT,
  PLAYLIST_FADE_AT, PLAYLIST_FADE_SECONDS, PREFETCH_BEFORE_END, TICK_SLOT, buildOffset, tickOffset,
} from '../../../src/countdown/audioPlan.js';
import { createCountdownSound, readPrefs, soundSupported, DEFAULT_PREFS, PREFS_KEY, type Moment, type SoundDeps } from '../../../src/countdown/sound.js';
import { FIREWORKS_END, prepareBursts, seeded } from '../../../src/countdown/Fireworks.js';
import { NOTE_TEXT, Player } from '../../../src/countdown/Player.js';
import { CountdownExperience } from '../../../src/countdown/CountdownPage.js';
import { countdownShareText } from '../../../src/countdown/share.js';
import { countdownHead } from '../../../src/utils/socialMetadata.js';

/* Mystery Countdown 3.7 final: the piano soundtrack, the countdown's own sounds, the player and the celebration. */

const read = (file: string) => readFileSync(file, 'utf8');
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const T = COUNTDOWN_TARGET_MS;
const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;
const at = (iso: string) => Date.parse(iso);

/* ───────────────────────── The catalogue and its rights ───────────────────────── */

test('music: solo-piano tracks with their rights recorded, and the manifest agrees with the player', () => {
  assert.equal(TRACKS.length, 11);
  assert.equal(new Set(TRACKS.map(t => t.id)).size, TRACKS.length);
  const manifest = JSON.parse(read('docs/countdown-music/manifest.json'));
  assert.equal(manifest.summary.vocals, false);
  assert.equal(manifest.summary.thirdPartyRecordings, 0);
  assert.equal(manifest.summary.licencesPurchased, 0, 'nothing was bought');
  assert.deepEqual(manifest.tracks.map((t: { id: string }) => t.id), TRACKS.map(t => t.id));
  for (const track of TRACKS) {
    const entry = manifest.tracks.find((t: { id: string }) => t.id === track.id);
    for (const field of ['title', 'composer', 'performer', 'source', 'licence', 'attribution', 'permittedUse', 'modifications', 'files']) assert.ok(entry[field], `${track.id}: ${field}`);
    assert.equal(entry.vocals, false);
    assert.equal(entry.title, track.title);
    assert.equal(entry.files.webm.bytes, track.bytes.webm, `${track.id} webm size`);
    assert.equal(entry.files.mp3.bytes, track.bytes.mp3, `${track.id} mp3 size`);
    assert.ok(Math.abs(entry.files.webm.seconds - track.seconds) < 0.1, `${track.id} duration`);
    assert.ok(entry.loudness.integratedLufs <= -15.5 && entry.loudness.integratedLufs >= -16.5, `${track.id} loudness`);
    assert.ok(entry.loudness.truePeakDb <= -1, `${track.id} true peak`);
    assert.match(entry.licence.pianoSamples, /CC BY 3\.0/);
    assert.ok(track.bytes.webm < 3.5e6 && track.bytes.mp3 < 4.5e6, `${track.id}: one track is a few megabytes`);
  }
  for (const cue of Object.values(CUES)) {
    const entry = manifest.cues.find((c: { id: string }) => c.id === cue.id);
    assert.ok(entry, cue.id);
    assert.equal(entry.files.webm.bytes, cue.bytes.webm); assert.equal(entry.files.mp3.bytes, cue.bytes.mp3);
  }
  // Angels: the hymnal's harmony is still protected in Ghana (life + 70), so the arrangement brings its own.
  assert.match(manifest.tracks.find((t: { id: string }) => t.id === 'angels-we-have-heard').harmony, /not used/);
  assert.match(read('scripts/countdown-music/pieces.py'), /chords=ANGELS_CHORDS/);
  // The countdown's own sounds stay small: well under a megabyte in either format for what the final hour fetches.
  assert.ok(CUES.ticks.bytes.mp3 + CUES.midnightFx.bytes.mp3 < 1_000_000);
  assert.match(MUSIC_CREDITS.piano, /Salamander Grand Piano V3 by Alexander Holm, licensed CC BY 3\.0/);
});

test('music: recordings are versioned files served from one place, Opus where the browser plays it and MP3 otherwise', () => {
  assert.equal(AUDIO_BASE, '/countdown-audio/v1/');
  assert.equal(audioUrl('silent-night', 'webm'), '/countdown-audio/v1/silent-night.webm');
  assert.equal(audioUrl('ticks', 'mp3', 'https://cdn.example/x/'), 'https://cdn.example/x/ticks.mp3');
  assert.equal(pickFormat(type => type.includes('opus') ? 'probably' : ''), 'webm');
  assert.equal(pickFormat(() => ''), 'mp3', 'Safari without Opus');
  assert.equal(pickFormat(() => { throw new Error('no'); }), 'mp3');
  // Nothing about the audio is bundled into the page's JavaScript.
  for (const file of readdirSync('src/countdown')) assert.doesNotMatch(read(`src/countdown/${file}`), /data:audio\/(mpeg|webm|ogg)|\.mp3['"]|\.webm['"]/, file);
});

test('seasons: Christmas, the turn, the eve, the final hour, New Year, then a short set, by the Ghana date', () => {
  const cases: [string | null, boolean, Season][] = [
    ['2026-12-01T09:00:00Z', false, 'christmas'], ['2026-12-26T23:59:59Z', false, 'christmas'],
    ['2026-12-27T00:00:00Z', false, 'turn'], ['2026-12-30T23:59:59Z', false, 'turn'],
    ['2026-12-31T00:00:00Z', false, 'eve'], ['2026-12-31T22:59:59Z', false, 'eve'],
    ['2026-12-31T23:30:00Z', true, 'hour'],
    ['2027-01-01T00:00:00Z', false, 'newyear'], ['2027-01-07T23:59:59Z', false, 'newyear'],
    ['2027-01-08T00:00:00Z', false, 'after'], [null, false, 'christmas'],
  ];
  for (const [iso, finalHour, season] of cases) assert.equal(seasonFor(iso === null ? null : at(iso), finalHour), season, `${iso}`);
  for (const [season, list] of Object.entries(PLAYLISTS)) {
    assert.equal(new Set(list).size, list.length, `${season}: no duplicates`);
    for (const id of list) assert.ok(trackById(id), `${season}: ${id}`);
  }
  for (const season of ['christmas', 'turn', 'eve', 'newyear'] as Season[]) assert.ok(PLAYLISTS[season].length >= 6 && PLAYLISTS[season].length <= 10, season);
  assert.ok(!PLAYLISTS.christmas.includes('auld-lang-syne') && !PLAYLISTS.christmas.includes('ode-to-joy'), 'Christmas stays Christmas');
  assert.equal(PLAYLISTS.eve[0], 'auld-lang-syne');
  assert.equal(PLAYLISTS.hour[0], 'auld-lang-syne');
  assert.equal(PLAYLISTS.newyear[0], 'ode-to-joy');
});

test('order: in order it continues and wraps; shuffled it never repeats the current track and avoids recent ones', () => {
  const list = PLAYLISTS.christmas;
  assert.equal(nextTrack(list, null, { shuffle: false, recent: [] }), list[0]);
  assert.equal(nextTrack(list, list[3], { shuffle: false, recent: [] }), list[4]);
  assert.equal(nextTrack(list, list[list.length - 1], { shuffle: false, recent: [] }), list[0]);
  assert.equal(nextTrack(list, list[0], { shuffle: false, recent: [], failed: new Set([list[1]]) }), list[2], 'a failed track is skipped');
  assert.equal(nextTrack(list, null, { shuffle: true, recent: [], failed: new Set(list) }), null);
  assert.equal(nextTrack(['a'], 'a', { shuffle: true, recent: ['a'] }), 'a', 'a single track may repeat');
  const random = seeded(5);
  let current: string | null = list[0];
  const history: string[] = [current];
  for (let i = 0; i < 500; i++) {
    const next = nextTrack(list, current, { shuffle: true, recent: history, random });
    assert.ok(next && next !== current, 'never the same track twice in a row');
    const recent = history.slice(-Math.floor(list.length / 2));
    assert.ok(!recent.includes(next), `${next} was played in the last ${recent.length}`);
    history.push(next); current = next;
  }
  assert.equal(new Set(history).size, list.length, 'every track comes round');
  assert.equal(previousTrack(list, 'first-noel', ['silent-night', 'first-noel']), 'silent-night');
  assert.equal(previousTrack(list, list[0], []), list[list.length - 1]);
});

/* ───────────────────────── The timeline (shared with the previews and the visuals) ───────────────────────── */

test('timeline: one set of numbers for the page, the previews and the fireworks', () => {
  assert.equal(tickOffset(10), 0); assert.equal(tickOffset(1), 18);
  assert.equal(buildOffset(BUILD_AT * 1000), 0);
  assert.equal(buildOffset(45 * SEC), 15, 'a late arrival joins the build where it is');
  assert.equal(buildOffset(61 * SEC), null); assert.equal(buildOffset(0), null);
  assert.ok(PLAYLIST_FADE_AT - PLAYLIST_FADE_SECONDS < BUILD_AT && PLAYLIST_FADE_AT > BUILD_AT, 'the playlist has gone quiet as the build starts');
  const previews = read('scripts/countdown-music/previews.py');
  const num = (name: string) => Number(previews.match(new RegExp(`^${name} = \\(?(-?[\\d.]+)`, 'm'))![1]);
  assert.equal(num('BUILD_AT'), -BUILD_AT);
  assert.equal(num('PLAYLIST_FADE'), -PLAYLIST_FADE_AT);
  assert.equal(num('TICK_SLOT'), TICK_SLOT);
  assert.equal(num('NEW_YEAR_AT'), NEW_YEAR_AT);
  assert.equal(num('CROSSFADE'), CROSSFADE);
  assert.equal(num('LAST_TICK_FADE'), LAST_TICK_FADE);
  // The fireworks burst exactly when their sound does (cues.py places the sound; the page draws it).
  const cues = read('scripts/countdown-music/cues.py');
  const list = cues.match(/^FIREWORKS = \[[^\n]*\n([\s\S]*?)\]/m)![0];
  const sounds = [...list.matchAll(/\((-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\)/g)].map(m => m.slice(1).map(Number));
  assert.equal(sounds.length, FIREWORKS.length);
  sounds.forEach(([when, pan, size, height], i) => {
    assert.equal(FIREWORKS[i].at, when); assert.equal(FIREWORKS[i].size, size);
    assert.ok(Math.abs(FIREWORKS[i].x - (0.5 + pan * 0.42)) < 0.002, `burst ${i} x`);
    assert.ok(Math.abs(FIREWORKS[i].y - (1 - height)) < 0.002, `burst ${i} y`);
  });
  // A finite celebration of 15 to 25 seconds; the last spark fades before it ends.
  assert.ok(CELEBRATION_SECONDS >= 15 && CELEBRATION_SECONDS <= 25);
  assert.ok(FIREWORKS_END < CELEBRATION_SECONDS);
  assert.ok(CELEBRATION_REDUCED_SECONDS < CELEBRATION_SECONDS);
  assert.ok(NEW_YEAR_AT >= CELEBRATION_SECONDS, 'New Year music begins once the page is calm again');
});

test('fireworks: the same show on every visit, bounded by the screen, drawn only with motion allowed', () => {
  const a = prepareBursts(390 * 844), b = prepareBursts(390 * 844);
  assert.deepEqual(a, b, 'seeded: every visit and every recording draws the same');
  const count = (area: number) => prepareBursts(area).reduce((n, burst) => n + burst.particles.length, 0);
  assert.ok(count(320 * 568) >= 50 * FIREWORKS.length * 0.7, 'enough sparks on a small phone');
  assert.ok(count(3840 * 2160) <= 120 * FIREWORKS.reduce((n, burst) => n + burst.size, 0) + FIREWORKS.length, 'a cap on a 4K TV');
  const src = code(read('src/countdown/Fireworks.tsx'));
  assert.match(src, /if \(t > FIREWORKS_END\) return;/, 'the loop stops by itself');
  assert.match(src, /cancelAnimationFrame\(frame\)/);
  assert.match(src, /width \* height > 2_600_000 \? 1 : 1\.5/, 'resolution is capped');
  assert.match(code(read('src/countdown/CountdownPage.tsx')), /\{igniting && motion && <Fireworks /, 'never with reduced motion');
  assert.doesNotMatch(src, /Math\.random|Date\.now/);
});

/* ───────────────────────── The sound controller, in a fake browser ───────────────────────── */

type Listener = () => void;
class FakeAudio {
  static all: FakeAudio[] = [];
  src = ''; preload = ''; crossOrigin: string | null = null; currentTime = 0; duration = NaN; paused = true; readyState = 0;
  plays: string[] = []; loads = 0;
  refuse: string | null = null;
  private listeners = new Map<string, Listener[]>();
  constructor() { FakeAudio.all.push(this); }
  canPlayType(type: string) { return type.includes('opus') ? 'probably' : ''; }
  addEventListener(name: string, fn: Listener) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]); }
  emit(name: string) { (this.listeners.get(name) ?? []).forEach(fn => fn()); }
  play() {
    if (this.refuse) return Promise.reject(Object.assign(new Error('no'), { name: this.refuse }));
    this.plays.push(this.src);
    // The unlocking clip is a few milliseconds long: it has ended (and paused itself) by the time anything looks.
    if (!this.src.startsWith('data:')) this.paused = false;
    return Promise.resolve();
  }
  pause() { this.paused = true; }
  /** As in browsers, loading a new source pauses the element. */
  load() { this.loads++; this.currentTime = 0; this.readyState = 0; this.paused = true; }
  removeAttribute(name: string) { if (name === 'src') this.src = ''; }
  getAttribute(name: string) { return name === 'src' && this.src ? this.src : null; }
  get track() { const m = this.src.match(/\/([^/]+)\.(webm|mp3)$/); return m ? m[1] : null; }
}

interface Voice { offset: number; duration?: number; stopped: boolean }
function fakeBrowser({ resumeTo = 'running', saved = null as string | null } = {}) {
  FakeAudio.all = [];
  const log = { contexts: 0, fetches: [] as string[], voices: [] as Voice[], suspended: 0, closed: 0 };
  let clock = 0;
  const timers: { at: number; run: () => void; id: number }[] = [];
  let ids = 0;
  const store = new Map<string, string>(saved ? [[PREFS_KEY, saved]] : []);
  const param = () => ({ value: 1, cancelScheduledValues() {}, setValueAtTime(v: number) { this.value = v; }, linearRampToValueAtTime(v: number) { this.value = v; }, setTargetAtTime(v: number) { this.value = v; } });
  const node = () => ({ connect(next: unknown) { return next ?? {}; }, disconnect() {} });
  class Ctx {
    state = 'suspended'; currentTime = 0; destination = node();
    constructor() { log.contexts++; }
    createGain() { return { ...node(), gain: param() }; }
    createDynamicsCompressor() { return { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; }
    createMediaElementSource() { return node(); }
    createBufferSource() {
      const voice: Voice = { offset: -1, stopped: false };
      return { ...node(), buffer: null, onended: null, start: (_t: number, offset: number, duration?: number) => { voice.offset = offset; voice.duration = duration; log.voices.push(voice); }, stop: () => { voice.stopped = true; } };
    }
    decodeAudioData(_data: ArrayBuffer, ok: (b: unknown) => void) { const buffer = { duration: 20 }; ok(buffer); return Promise.resolve(buffer); }
    resume() { this.state = resumeTo; return Promise.resolve(); }
    suspend() { log.suspended++; this.state = 'suspended'; return Promise.resolve(); }
    close() { log.closed++; this.state = 'closed'; return Promise.resolve(); }
  }
  const deps: SoundDeps = {
    AudioContext: Ctx as unknown as typeof AudioContext,
    createAudio: () => new FakeAudio() as unknown as HTMLAudioElement,
    fetch: async url => { log.fetches.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; },
    storage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); } },
    now: () => clock,
    random: seeded(9),
    saveData: () => false,
    setTimer: (run, ms) => { const id = ++ids; timers.push({ at: clock + ms, run, id }); return id; },
    clearTimer: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
  };
  const advance = async (ms: number) => {
    const end = clock + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > end) break;
      timers.shift(); clock = next.at; next.run();
      await flush();
    }
    clock = end; await flush();
  };
  return { deps, log, store, advance, decks: () => FakeAudio.all };
}
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };
const days = (ms = 20 * DAY): Moment => ({ stage: 'days', remainingMs: ms, serverNow: T - ms });
const playing = () => FakeAudio.all.filter(a => !a.paused && a.track).map(a => a.track);

test('sound: nothing is created, fetched or played before the tap, and never from a shared link on its own', async () => {
  assert.equal(soundSupported({} as Window), false);
  const world = fakeBrowser();
  const sound = createCountdownSound(world.deps)!;
  sound.sync(days()); sound.sync({ stage: 'final', remainingMs: 5 * SEC, serverNow: T - 5 * SEC }); sound.celebrate('live');
  assert.equal(world.log.contexts, 0);
  assert.equal(world.decks().length, 0, 'no audio elements');
  assert.equal(world.log.fetches.length, 0);
  assert.equal(sound.getState().started, false);
  assert.equal(sound.getState().playing, false);
  sound.close();
});

test('sound: the tap starts one track (the season’s first), with the next fetched only near the end, then a crossfade', async () => {
  const world = fakeBrowser();
  const sound = createCountdownSound(world.deps)!;
  sound.sync({ stage: 'days', remainingMs: T - at('2026-12-20T20:00:00Z'), serverNow: at('2026-12-20T20:00:00Z') });
  assert.equal(await sound.start(), true);
  assert.equal(world.log.contexts, 1);
  assert.equal(world.decks().length, 3, 'two playlist decks and the final-minute deck');
  assert.ok(world.decks().every(d => d.plays[0]?.startsWith('data:audio/wav')), 'every deck unlocked inside the tap');
  assert.ok(world.decks().every(d => d.preload !== 'auto' || d.track), 'nothing else preloads');
  assert.deepEqual(playing(), ['silent-night']);
  const [a, b] = world.decks();
  assert.equal(a.src, '/countdown-audio/v1/silent-night.webm');
  assert.equal(b.track, null, 'one track at a time');
  assert.equal(world.log.fetches.length, 0, 'no countdown sounds weeks before midnight');
  assert.deepEqual({ ...sound.getState(), detail: undefined }, { ...sound.getState(), title: 'Silent Night', segment: 'playlist', playing: true, started: true, detail: undefined });
  assert.equal(sound.getState().detail, 'Christmas · 1 of 9');
  a.duration = 159.8; a.currentTime = 100; a.emit('timeupdate');
  assert.equal(b.track, null, 'not yet');
  a.currentTime = 159.8 - PREFETCH_BEFORE_END + 0.1; a.emit('timeupdate');
  assert.equal(b.track, 'first-noel', 'the next one, 30 seconds before the end');
  assert.equal(b.paused, true);
  a.currentTime = 159.8 - CROSSFADE + 0.1; a.emit('timeupdate');
  await flush();
  assert.equal(b.paused, false, 'the crossfade begins');
  assert.equal(sound.getState().title, 'The First Noel');
  await world.advance(CROSSFADE * 1000 + 100);
  assert.equal(a.paused, true); assert.equal(a.track, null, 'the finished track is let go');
  sound.close();
});

test('sound: pause, play, next, previous, shuffle and volume; preferences (never the music itself) are remembered', async () => {
  const world = fakeBrowser();
  const sound = createCountdownSound(world.deps)!;
  sound.sync(days());
  await sound.start();
  sound.next(); await flush();
  assert.equal(sound.getState().trackId, 'first-noel');
  sound.next(); await flush();
  assert.equal(sound.getState().trackId, 'away-in-a-manger');
  sound.previous(); await flush();
  assert.equal(sound.getState().trackId, 'first-noel');
  sound.pause(); await world.advance(500);
  assert.equal(sound.getState().playing, false);
  assert.deepEqual(playing(), []);
  assert.equal(await sound.play(), true);
  assert.deepEqual(playing(), ['first-noel']);
  sound.setShuffle(true); sound.setVolume(1.7); sound.setEffects(false);
  assert.equal(sound.getState().volume, 1, 'clamped');
  assert.deepEqual(JSON.parse(world.store.get(PREFS_KEY)!), { effects: false, volume: 1, shuffle: true });
  assert.deepEqual(readPrefs({ getItem: () => '{"volume":"loud","effects":0}', setItem() {} }), { effects: true, volume: DEFAULT_PREFS.volume, shuffle: false }, 'odd values fall back');
  assert.deepEqual(readPrefs({ getItem: () => { throw new Error('blocked'); }, setItem() {} }), DEFAULT_PREFS);
  sound.close();
  // A later visit keeps the preferences but still waits for a tap.
  const again = createCountdownSound(fakeBrowser({ saved: world.store.get(PREFS_KEY)! }).deps)!;
  assert.deepEqual([again.getState().effects, again.getState().shuffle, again.getState().started], [false, true, false]);
  again.close();
});

test('sound: hidden pauses everything, back resumes; a refused start or restart says so; closing lets everything go', async () => {
  const world = fakeBrowser();
  const sound = createCountdownSound(world.deps)!;
  sound.sync(days());
  await sound.start();
  sound.hide();
  assert.deepEqual(playing(), []);
  assert.equal(world.log.suspended, 1);
  await sound.show();
  assert.deepEqual(playing(), ['silent-night']);
  sound.close();
  assert.equal(world.log.closed, 1);
  assert.ok(world.decks().every(d => d.paused && d.track === null));

  const refused = fakeBrowser({ resumeTo: 'suspended' });
  const quiet = createCountdownSound(refused.deps)!;
  quiet.sync(days());
  assert.equal(await quiet.start(), false);
  assert.equal(quiet.getState().started, false);
  assert.equal(quiet.getState().note, 'blocked');
  assert.match(NOTE_TEXT.blocked, /didn’t allow sound/);
  quiet.close();

  const blocked = fakeBrowser();
  const element = createCountdownSound(blocked.deps)!;
  element.sync(days());
  await element.start();
  blocked.decks().forEach(d => { d.refuse = 'NotAllowedError'; });
  element.next(); await flush();
  assert.equal(element.getState().playing, false);
  assert.equal(element.getState().note, 'blocked');
  element.close();
});

test('sound: three tracks failing in a row turns the music off for the visit; countdown sounds are unaffected', async () => {
  const world = fakeBrowser();
  const sound = createCountdownSound(world.deps)!;
  sound.sync(days());
  await sound.start();
  for (let i = 0; i < 3; i++) {
    const deck = world.decks().find(d => d.track === sound.getState().trackId)!;
    deck.emit('error'); await flush();
  }
  assert.equal(sound.getState().note, 'music-failed');
  assert.equal(sound.getState().playing, false);
  assert.equal(sound.getState().effects, true);
  sound.close();
});

test('sound: the final hour fetches the countdown sounds; the final minute builds; each second rings once, at its moment', async () => {
  const world = fakeBrowser();
  const sound = createCountdownSound(world.deps)!;
  const moment = (remainingMs: number, extra: Partial<Moment> = {}): Moment => ({
    stage: remainingMs > HOUR ? 'eve' : remainingMs > MIN ? 'hour' : remainingMs > 10 * SEC ? 'minute' : 'final', remainingMs, serverNow: T - remainingMs, ...extra,
  });
  sound.sync(moment(2 * HOUR));
  await sound.start();
  assert.deepEqual(playing(), ['auld-lang-syne'], 'New Year’s Eve opens with Auld Lang Syne');
  assert.equal(world.log.fetches.length, 0);
  sound.sync(moment(CUES_FROM_SECONDS * 1000 - SEC)); await flush();
  assert.deepEqual(world.log.fetches.sort(), ['/countdown-audio/v1/midnight-fx.webm', '/countdown-audio/v1/ticks.webm']);
  // T-62: the playlist steps aside; T-60: the build, from its start.
  for (const ms of [63 * SEC, 62 * SEC, 61 * SEC]) { sound.sync(moment(ms)); await world.advance(SEC); }
  assert.equal(sound.getState().segment, 'fade');
  assert.equal(sound.getState().locked, true, 'previous and next wait until the New Year');
  sound.sync(moment(60 * SEC)); await flush();
  assert.equal(sound.getState().segment, 'build');
  assert.ok(playing().includes('final-minute'));
  assert.ok(!playing().includes('midnight-music'), 'the midnight music waits, loaded, on the free deck');
  for (const ms of [59 * SEC, 58 * SEC]) { sound.sync(moment(ms)); await world.advance(SEC); }
  await world.advance(100);
  assert.deepEqual(playing(), ['final-minute'], 'the playlist has faded out by T-58');
  assert.equal(sound.getState().title, 'The final minute');
  // The ten seconds: each cue once, from its own slot.
  for (let k = 10; k >= 1; k--) {
    sound.sync(moment(k * SEC)); sound.sync(moment(k * SEC - 400)); // a re-render within the same second rings nothing
    await world.advance(SEC);
  }
  const ticks = world.log.voices.map(v => v.offset);
  assert.deepEqual(ticks, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(tickOffset));
  assert.ok(Math.abs(world.log.voices[9].duration! - (1 + LAST_TICK_FADE)) < 1e-9, 'second 1 gives way to midnight');
  // Midnight, live: the page holds for an instant, then celebrates.
  sound.sync({ stage: 'welcome', remainingMs: 0, serverNow: T, holding: true });
  sound.celebrate('live'); sound.sync({ stage: 'welcome', remainingMs: 0, serverNow: T });
  await flush();
  assert.equal(sound.getState().segment, 'midnight');
  assert.equal(world.log.voices[10].offset, 0, 'the impact and fireworks, from the first instant');
  assert.ok(playing().includes('midnight-music'));
  await world.advance(NEW_YEAR_AT * 1000 + 100);
  sound.sync({ stage: 'welcome', remainingMs: 0, serverNow: T + 26 * SEC });
  assert.equal(sound.getState().segment, 'playlist');
  assert.equal(sound.getState().trackId, 'ode-to-joy', 'the New Year opens with Ode to Joy');
  await world.advance(5 * SEC);
  assert.deepEqual(playing(), ['ode-to-joy']);
  sound.close();
});

test('sound: with the music off, the countdown sounds still play; with them off, the music carries on alone', async () => {
  const world = fakeBrowser();
  const sound = createCountdownSound(world.deps)!;
  sound.sync({ stage: 'hour', remainingMs: 20 * MIN, serverNow: T - 20 * MIN });
  await sound.start(); await flush();
  sound.pause(); await world.advance(SEC);
  for (const k of [3, 2, 1]) { sound.sync({ stage: 'final', remainingMs: k * SEC, serverNow: T - k * SEC }); await world.advance(SEC); }
  assert.equal(world.log.voices.length, 3, 'ticks with the music paused');
  assert.deepEqual(playing(), [], 'and no music');
  sound.sync({ stage: 'welcome', remainingMs: 0, serverNow: T }); sound.celebrate('live'); await flush();
  assert.equal(world.log.voices.length, 4, 'the midnight effects too');
  sound.close();

  const other = fakeBrowser();
  const music = createCountdownSound(other.deps)!;
  music.setEffects(false);
  music.sync({ stage: 'hour', remainingMs: 20 * MIN, serverNow: T - 20 * MIN });
  await music.start(); await flush();
  assert.equal(other.log.fetches.length, 0, 'nothing fetched for sounds that are off');
  for (const k of [3, 2, 1]) { music.sync({ stage: 'final', remainingMs: k * SEC, serverNow: T - k * SEC }); await other.advance(SEC); }
  assert.equal(other.log.voices.length, 0);
  music.close();
});

test('sound: arriving late joins the build where the clock is; a replay after midnight is labelled and resumes the track', async () => {
  const world = fakeBrowser();
  const sound = createCountdownSound(world.deps)!;
  sound.sync({ stage: 'minute', remainingMs: 45 * SEC, serverNow: T - 45 * SEC });
  await sound.start(); await flush();
  const build = world.decks()[2];
  assert.equal(build.track, 'final-minute');
  build.readyState = 1; build.emit('loadedmetadata');
  assert.ok(Math.abs(build.currentTime - 15) < 0.01, 'fifteen seconds into the build');
  sound.close();

  const after = fakeBrowser();
  const replay = createCountdownSound(after.deps)!;
  replay.sync({ stage: 'welcome', remainingMs: 0, serverNow: T + 2 * HOUR });
  await replay.start(); await flush();
  assert.deepEqual(playing(), ['ode-to-joy']);
  replay.celebrate('replay'); await flush();
  assert.equal(replay.getState().detail, 'Replay');
  assert.ok(after.log.fetches.length === 2, 'the effects are fetched for the replay');
  await after.advance(NEW_YEAR_AT * 1000 + 100);
  replay.sync({ stage: 'welcome', remainingMs: 0, serverNow: T + 2 * HOUR + 30 * SEC });
  await after.advance(5 * SEC);
  assert.equal(replay.getState().trackId, 'ode-to-joy', 'back to the track that was playing');
  replay.close();
});

test('sound: music waits while the time is being checked, and the season never falls back without a server time', async () => {
  const world = fakeBrowser();
  const sound = createCountdownSound(world.deps)!;
  sound.sync({ stage: 'syncing', remainingMs: 0, serverNow: null });
  await sound.start(); await flush();
  assert.deepEqual(playing(), []);
  assert.equal(sound.getState().waiting, true, 'the player shows it is waiting');
  sound.sync({ stage: 'eve', remainingMs: 5 * HOUR, serverNow: T - 5 * HOUR }); await flush();
  assert.deepEqual(playing(), ['auld-lang-syne']);
  sound.sync({ stage: 'confirming', remainingMs: 0, serverNow: null }); await world.advance(SEC);
  assert.deepEqual(playing(), [], 'a midnight that needs confirming is not guessed at');
  assert.match(sound.getState().detail, /New Year’s Eve/);
  sound.close();
});

/* ───────────────────────── The player and the page ───────────────────────── */

test('player: labelled controls, credits with the licence, the data note; compact by default', () => {
  const world = fakeBrowser();
  const sound = createCountdownSound(world.deps)!;
  const state = { ...sound.getState(), started: true, playing: true, title: 'Silent Night', detail: 'Christmas · 1 of 9', trackId: 'silent-night', segment: 'playlist' as const };
  const html = renderToStaticMarkup(React.createElement(Player, { sound, state, immersive: false }));
  for (const label of ['Music player', 'Pause music', 'Next track', 'Previous track', 'More sound controls', 'Turn sound off']) assert.match(html, new RegExp(`aria-label="${label}"`), label);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-pressed="true"[^>]*><svg[^]*?Countdown sounds/);
  assert.match(html, /aria-pressed="false"[^>]*><svg[^]*?Shuffle/);
  assert.match(html, /type="range"[^>]*aria-valuetext="85%"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="status"/);
  const words = text(html);
  for (const track of TRACKS) assert.ok(words.includes(track.title), track.title);
  assert.match(words, /Salamander Grand Piano V3 by Alexander Holm, licensed CC BY 3\.0/);
  assert.match(words, /about 2 to 3 MB each/);
  assert.match(html, /href="https:\/\/creativecommons\.org\/licenses\/by\/3\.0\/" target="_blank" rel="noopener noreferrer"/);
  const locked = renderToStaticMarkup(React.createElement(Player, { sound, state: { ...state, locked: true }, immersive: true }));
  assert.match(locked, /aria-disabled="true"/);
  assert.match(locked, /data-immersive="true"/);
  sound.close();
});

test('page: the music button is labelled, the celebration hides sharing, and the final ten seconds are big and calm', () => {
  const page = code(read('src/countdown/CountdownPage.tsx'));
  assert.match(page, /<span className="cd-tool-label">Play music<\/span>/);
  assert.match(page, /\{!immersive && celebration !== 'live' && <Actions /);
  assert.match(page, /const focus = stage === 'minute' \|\| stage === 'final' \|\| igniting;/);
  const final = renderToStaticMarkup(React.createElement(CountdownExperience, { view: { state: 'running', remainingMs: 3 * SEC, serverNow: T - 3 * SEC, checking: false }, retry: () => undefined }));
  assert.match(final, /data-focus="true"/);
  assert.match(final, /cd-final-number" aria-hidden="true">3</);
  const css = read('src/countdown/countdown.css');
  assert.doesNotMatch(css, /animation[^;]*infinite/, 'every animation is finite');
  assert.match(css, /\.cd-fireworks \{/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('words: Ghana everywhere a visitor reads, while the clock keeps Africa/Accra and GMT', () => {
  const visible = ['src/countdown/CountdownPage.tsx', 'src/countdown/stage.ts', 'src/countdown/share.ts', 'src/countdown/Player.tsx', 'src/countdown/sound.ts', 'src/countdown/music.ts',
    'src/greetings/NewYearCountdown.tsx', 'src/utils/socialMetadata.ts', 'scripts/renderCountdownShareImage.tsx'];
  for (const file of visible) {
    const strings = [...code(read(file)).matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`|>([^<>{}\n]+)</g)].map(m => m.slice(1).find(Boolean) ?? '').join(' | ');
    assert.doesNotMatch(strings, /Accra/, file);
  }
  for (const words of [countdownShareText(false), countdownShareText(true)]) assert.doesNotMatch(words, /Accra/);
  const head = countdownHead(new Date('2026-12-31T20:00:00Z'));
  assert.match(head.title, /Midnight in Ghana/);
  assert.match(read('shared/mysteryExperiences.ts'), /'Africa\/Accra'/, 'the time zone itself is unchanged');
  assert.equal(new Date(T).toISOString(), '2027-01-01T00:00:00.000Z');
});

test('greetings and gifts: nothing activated by this release', () => {
  if (!existsSync('docs/countdown-final-experience-3-7.md')) return;
  const report = read('docs/countdown-final-experience-3-7.md');
  assert.match(report, /Mystery Greetings[^\n]*not activated/i);
  assert.match(report, /Mystery Gifts[^\n]*not activated/i);
});
