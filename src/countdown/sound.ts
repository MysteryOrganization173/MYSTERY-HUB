/**
 * Mystery Countdown 3.7 final: the soundtrack and the countdown's own sounds. Off by default; nothing is created or
 * downloaded until the visitor taps to start, and never from a shared link on its own.
 *
 * - Music: solo piano recordings (music.ts), one track at a time through an audio element, with the next one fetched
 *   shortly before it is needed. Two playlist decks crossfade between tracks; a third carries the final-minute build.
 *   Every deck is routed through Web Audio, so the volume works everywhere (iPhones ignore an element's own volume).
 * - Countdown sounds (effects): the ten second cues and the midnight impact and fireworks, small files decoded once the
 *   final hour begins (or for a replay). They play whether music is on or off, and can be turned off on their own.
 *
 * The clock is authoritative (audioPlan.ts): the page calls sync() whenever the shown second changes, and every sound
 * is started at the offset the clock calls for. Audio never holds the page back: anything not ready simply joins late
 * or stays silent. Everything pauses while the page is hidden and stops for good when the page closes.
 */
import {
  BUILD_AT, CROSSFADE, CUES_FROM_SECONDS, LAST_TICK_FADE, MIDNIGHT_MUSIC_FADE_SECONDS, NEW_YEAR_AT, PLAYLIST_FADE_AT,
  PREFETCH_BEFORE_END, TICK_SLOT, buildOffset, tickOffset,
} from './audioPlan';
import {
  AUDIO_BASE, CUES, PLAYLISTS, SEASON_LABEL, audioUrl, nextTrack, pickFormat, previousTrack, seasonFor, trackById,
  type AudioFormat, type Season,
} from './music';
import type { Stage } from './stage';

export type SoundNote = '' | 'blocked' | 'lost' | 'music-failed' | 'cues-failed';
export type Segment = 'idle' | 'playlist' | 'fade' | 'build' | 'midnight';

export interface PlayerState {
  /** The visitor tapped to start sound during this visit. */
  started: boolean;
  /** Music is on (not paused). */
  playing: boolean;
  /** Countdown sounds are on. */
  effects: boolean;
  volume: number;
  shuffle: boolean;
  segment: Segment;
  trackId: string | null;
  title: string;
  detail: string;
  /** Previous and next are unavailable (the final minute and midnight follow the clock). */
  locked: boolean;
  /** Waiting for audio to arrive. */
  waiting: boolean;
  note: SoundNote;
}

/** What the page shows now: called on every change of the shown second, and whenever the stage changes. */
export interface Moment {
  stage: Stage;
  remainingMs: number;
  serverNow: number | null;
  /** Midnight has just arrived live and the celebration is about to begin: music waits for it. */
  holding?: boolean;
}

export interface CountdownSound {
  getState: () => PlayerState;
  subscribe: (listener: (state: PlayerState) => void) => () => void;
  /** From the tap itself. Resolves whether sound really started (false when the browser refused). */
  start: () => Promise<boolean>;
  /** All sound off (the player closes). */
  stop: () => void;
  play: () => Promise<boolean>;
  pause: () => void;
  next: () => void;
  previous: () => void;
  setEffects: (on: boolean) => void;
  setVolume: (volume: number) => void;
  setShuffle: (on: boolean) => void;
  sync: (moment: Moment) => void;
  /** The celebration began (live at midnight, or a replay the visitor asked for). */
  celebrate: (kind: 'live' | 'replay') => void;
  hide: () => void;
  show: () => Promise<void>;
  close: () => void;
}

/* ───────────────────────── The browser, injectable for tests ───────────────────────── */

type AudioCtor = typeof AudioContext;
export interface SoundDeps {
  AudioContext: AudioCtor;
  createAudio: () => HTMLAudioElement;
  fetch: (url: string) => Promise<{ ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }>;
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** Milliseconds, monotonic. */
  now: () => number;
  random: () => number;
  saveData: () => boolean;
  setTimer: (run: () => void, ms: number) => unknown;
  clearTimer: (timer: unknown) => void;
  base?: string;
}

type AudioWindow = Window & { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
const audioConstructor = (win: Window | undefined) => win ? ((win as AudioWindow).AudioContext || (win as AudioWindow).webkitAudioContext || null) : null;
export const soundSupported = (win: Window | undefined = typeof window === 'undefined' ? undefined : window) =>
  audioConstructor(win) !== null && typeof (win as Window & { Audio?: unknown }).Audio === 'function';

export function browserDeps(win: Window = window): SoundDeps | null {
  const Ctor = audioConstructor(win);
  if (!Ctor) return null;
  let storage: SoundDeps['storage'] = null;
  try { storage = win.localStorage; } catch { /* private mode: preferences are simply not kept */ }
  const nav = win.navigator as Navigator & { connection?: { saveData?: boolean } };
  return {
    AudioContext: Ctor,
    createAudio: () => new (win as Window & { Audio: typeof Audio }).Audio(),
    fetch: url => win.fetch(url, { credentials: 'omit' }),
    storage,
    now: () => win.performance.now(),
    random: Math.random,
    saveData: () => nav.connection?.saveData === true,
    setTimer: (run, ms) => win.setTimeout(run, ms),
    clearTimer: timer => win.clearTimeout(timer as number),
  };
}

/* ───────────────────────── Preferences (this browser only) ───────────────────────── */

export const PREFS_KEY = 'mh-countdown-sound-v1';
export interface SoundPrefs { effects: boolean; volume: number; shuffle: boolean }
export const DEFAULT_PREFS: SoundPrefs = { effects: true, volume: 0.85, shuffle: false };
export function readPrefs(storage: SoundDeps['storage']): SoundPrefs {
  try {
    const raw = JSON.parse(storage?.getItem(PREFS_KEY) ?? 'null') as Partial<SoundPrefs> | null;
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFS };
    const volume = typeof raw.volume === 'number' && Number.isFinite(raw.volume) ? Math.min(1, Math.max(0, raw.volume)) : DEFAULT_PREFS.volume;
    return { effects: raw.effects !== false, volume, shuffle: raw.shuffle === true };
  } catch { return { ...DEFAULT_PREFS }; }
}

/** A tiny silent clip: played on each deck within the first tap, so phones let the decks play later without one. */
const SILENCE = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
const BUILD_ID = CUES.build.id, MIDNIGHT_ID = CUES.midnightMusic.id;
/** Track failures in a row before the music gives up for this visit (countdown sounds carry on). */
const MAX_FAILURES = 3;

interface Deck {
  el: HTMLAudioElement;
  gain: GainNode;
  id: string | null;
  seekTo: number | null;
  /** Bumped on every load, so a late event from an earlier source is ignored. */
  version: number;
}

export function createCountdownSound(given: SoundDeps | null = typeof window === 'undefined' ? null : browserDeps()): CountdownSound | null {
  if (!given) return null;
  const deps: SoundDeps = given;
  const base = deps.base ?? AUDIO_BASE;
  const prefs = readPrefs(deps.storage);
  let ctx: AudioContext | null = null, master: GainNode | null = null, fxBus: GainNode | null = null;
  let decks: Deck[] = [];              // [playlist A, playlist B, build]
  let cur = 0;                         // the playlist deck that holds the current track
  let midnightDeck: Deck | null = null;
  let format: AudioFormat = 'mp3';
  let started = false, playing = false, effects = prefs.effects, volume = prefs.volume, shuffle = prefs.shuffle;
  let segment: Segment = 'idle', note: SoundNote = '', waiting = false, hidden = false, closed = false;
  let trackId: string | null = null, queued: string | null = null, advancing = false, freshAfter = false;
  let season: Season = 'christmas';
  const history: string[] = [];
  const failed = new Set<string>();
  let failures = 0;
  let moment: (Moment & { at: number }) | null = null;
  let celebration: { kind: 'live' | 'replay'; at: number } | null = null, celebrationTimer: unknown;
  let lastTick: number | null = null;
  let cues: { ticks: AudioBuffer | null; fx: AudioBuffer | null; loading: Promise<void> | null; failedAt: number | null } = { ticks: null, fx: null, loading: null, failedAt: null };
  const voices = new Set<AudioBufferSourceNode>();
  const listeners = new Set<(s: PlayerState) => void>();

  /* ── state ── */
  const remaining = () => {
    if (!moment) return null;
    if (moment.stage !== 'days' && moment.stage !== 'eve' && moment.stage !== 'hour' && moment.stage !== 'minute' && moment.stage !== 'final') return null;
    return Math.max(0, moment.remainingMs - (deps.now() - moment.at)) / 1000;
  };
  const sinceCelebration = () => celebration ? (deps.now() - celebration.at) / 1000 : null;
  const list = () => PLAYLISTS[season];
  function describe(): Pick<PlayerState, 'title' | 'detail'> {
    if (segment === 'fade' || segment === 'build') return { title: 'The final minute', detail: 'Counting down with you' };
    if (segment === 'midnight') return { title: 'Midnight · Auld Lang Syne', detail: celebration?.kind === 'replay' ? 'Replay' : 'Happy New Year' };
    const track = trackId ? trackById(trackId) : null;
    if (!track) return { title: 'Piano music', detail: SEASON_LABEL[season] };
    const at = list().indexOf(track.id);
    return { title: track.title, detail: shuffle ? `${SEASON_LABEL[season]} · Shuffle` : at < 0 ? SEASON_LABEL[season] : `${SEASON_LABEL[season]} · ${at + 1} of ${list().length}` };
  }
  const getState = (): PlayerState => ({
    started, playing, effects, volume, shuffle, segment, trackId, ...describe(),
    locked: segment === 'fade' || segment === 'build' || segment === 'midnight',
    waiting: waiting || (started && playing && (moment?.stage === 'syncing' || moment?.stage === 'confirming')), note,
  });
  const emit = () => { const s = getState(); listeners.forEach(fn => { try { fn(s); } catch { /* a listener never breaks sound */ } }); };
  // Kept: countdown sounds on or off, the volume and shuffle. Music itself always starts from a tap.
  const save = () => { try { deps.storage?.setItem(PREFS_KEY, JSON.stringify({ effects, volume, shuffle })); } catch { /* not kept */ } };

  /* ── the audio graph, created on the first tap ── */
  function ensureGraph(): AudioContext {
    if (ctx) return ctx;
    const c = new deps.AudioContext();
    const m = c.createGain(), mb = c.createGain(), fb = c.createGain();
    m.gain.value = volume * volume;
    fb.gain.value = effects ? 1 : 0;
    // A safety limiter only: the recordings are mastered, this just guards their sum (a tick under the build).
    const limiter = c.createDynamicsCompressor?.();
    if (limiter) { limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.2; m.connect(limiter).connect(c.destination); }
    else m.connect(c.destination);
    mb.connect(m); fb.connect(m);
    ctx = c; master = m; fxBus = fb;
    decks = [0, 1, 2].map(() => makeDeck(c, mb));
    format = pickFormat(type => decks[0].el.canPlayType(type));
    return c;
  }
  function makeDeck(c: AudioContext, out: AudioNode): Deck {
    const el = deps.createAudio();
    el.preload = 'none';
    el.crossOrigin = 'anonymous';
    const gain = c.createGain();
    try { c.createMediaElementSource(el).connect(gain); } catch { /* an element can join a graph only once */ }
    gain.connect(out);
    const deck: Deck = { el, gain, id: null, seekTo: null, version: 0 };
    el.addEventListener('loadedmetadata', () => { if (deck.seekTo !== null) { try { el.currentTime = deck.seekTo; } catch { /* not seekable yet */ } deck.seekTo = null; } });
    el.addEventListener('timeupdate', () => onProgress(deck));
    el.addEventListener('ended', () => onEnded(deck));
    el.addEventListener('error', () => onError(deck));
    el.addEventListener('waiting', () => { if (isAudible(deck)) { waiting = true; emit(); } });
    el.addEventListener('playing', () => { if (waiting) { waiting = false; emit(); } realign(deck); });
    return deck;
  }
  const isAudible = (deck: Deck) => deck === decks[cur] || deck === decks[2] || deck === midnightDeck;

  function load(deck: Deck, id: string, offset = 0, preload: 'auto' | 'metadata' = 'auto') {
    deck.version++;
    deck.id = id;
    deck.seekTo = offset > 0 ? offset : null;
    deck.el.preload = preload;
    deck.el.src = audioUrl(id, format, base);
    try { deck.el.load(); } catch { /* the source is set; the browser loads it */ }
  }
  function unload(deck: Deck) {
    deck.version++;
    deck.id = null; deck.seekTo = null;
    try { deck.el.pause(); deck.el.removeAttribute('src'); deck.el.load(); } catch { /* already empty */ }
  }
  function ramp(deck: Deck, to: number, seconds: number) {
    if (!ctx) return;
    const g = deck.gain.gain, t = ctx.currentTime;
    try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + Math.max(0.01, seconds)); } catch { g.value = to; }
  }
  /** Plays a deck. Resolves false when the browser refused (the note says so, and music is off). */
  function start(deck: Deck, fade = 0.4, offset: number | null = null): Promise<boolean> {
    if (offset !== null) {
      if (deck.el.readyState >= 1) { try { deck.el.currentTime = offset; } catch { deck.seekTo = offset; } }
      else deck.seekTo = offset;
    }
    if (ctx) { deck.gain.gain.cancelScheduledValues(ctx.currentTime); deck.gain.gain.setValueAtTime(fade > 0 ? 0 : 1, ctx.currentTime); }
    ramp(deck, 1, fade);
    const version = deck.version;
    let attempt: Promise<void> | undefined;
    try { attempt = deck.el.play(); } catch (error) { return Promise.resolve(refused(error)); }
    return Promise.resolve(attempt).then(() => true, error => version === deck.version ? refused(error) : true);
  }
  function refused(error: unknown) {
    const name = (error as { name?: string } | null)?.name;
    if (name === 'AbortError') return true; // replaced by a newer source: not a failure
    if (name === 'NotAllowedError') { playing = false; note = 'blocked'; pauseAll(); emit(); return false; }
    return true; // a load error arrives as the element's own error event
  }
  const pauseDeck = (deck: Deck) => { try { deck.el.pause(); } catch { /* already paused */ } };
  function pauseAll() { decks.forEach(pauseDeck); }
  function fadeAndPause(deck: Deck, seconds: number, then?: () => void) {
    ramp(deck, 0, seconds);
    const version = deck.version;
    deps.setTimer(() => { if (deck.version === version && !(deck === decks[cur] && segment === 'playlist' && playing && !advancing)) { pauseDeck(deck); then?.(); } }, seconds * 1000 + 60);
  }

  /** Keeps the build and the midnight music where the clock says they should be (after a slow start or a resume). */
  function realign(deck: Deck) {
    const want = deck === decks[2] ? (() => { const r = remaining(); return r === null ? null : buildOffset(r * 1000); })()
      : deck === midnightDeck ? sinceCelebration() : null;
    if (want === null || want < 0) return;
    if (Math.abs(deck.el.currentTime - want) > 0.3) { try { deck.el.currentTime = want; } catch { /* not seekable */ } }
  }

  /* ── the playlist ── */
  function startTrack(id: string, fade: number) {
    const deck = decks[cur];
    if (deck.id !== id) load(deck, id);
    trackId = id; queued = null; advancing = false;
    if (history[history.length - 1] !== id) history.push(id);
    if (history.length > 20) history.shift();
    void start(deck, fade);
  }
  function pick(): string | null {
    return nextTrack(list(), trackId, { shuffle, recent: history, random: deps.random, failed });
  }
  /** On to another track: crossfading at a track's end, quickly for a tap. */
  function advance(to: string | null, fade: number) {
    if (!to || advancing) return;
    advancing = true;
    const from = decks[cur], other = 1 - cur, deck = decks[other];
    if (deck.id !== to) load(deck, to);
    cur = other;
    fadeAndPause(from, fade, () => { if (from !== decks[cur]) unload(from); });
    trackId = to; queued = null;
    if (history[history.length - 1] !== to) history.push(to);
    void start(deck, from.el.paused ? 0.3 : fade).finally(() => { advancing = false; });
    emit();
  }
  function onProgress(deck: Deck) {
    if (deck !== decks[cur] || segment !== 'playlist' || !playing || advancing) return;
    const left = (deck.el.duration || Infinity) - deck.el.currentTime;
    if (!Number.isFinite(left)) return;
    // Fetch the next track shortly before it is needed (never on data saver: it then loads when it starts).
    if (left <= PREFETCH_BEFORE_END && !queued && !deps.saveData()) {
      queued = pick();
      const other = decks[1 - cur];
      if (queued && other.id !== queued) load(other, queued);
    }
    if (left <= CROSSFADE) advance(queued ?? pick(), CROSSFADE);
  }
  function onEnded(deck: Deck) {
    if (deck === decks[cur] && segment === 'playlist' && playing && !advancing) advance(queued ?? pick(), 0.3);
  }
  function onError(deck: Deck) {
    if (!deck.id || deck.el.getAttribute('src') === null) return;
    const id = deck.id;
    if (deck === decks[cur] && segment === 'playlist') {
      failed.add(id); failures++;
      if (failures >= MAX_FAILURES || !pick()) { playing = false; note = 'music-failed'; pauseAll(); emit(); return; }
      advance(pick(), 0.2);
      return;
    }
    if (id === BUILD_ID || id === MIDNIGHT_ID) { unload(deck); return; } // the countdown simply carries on
    if (deck !== decks[cur]) { failed.add(id); queued = null; unload(deck); }
  }
  // A track that plays resets the failure count.
  const okPlaying = () => { failures = 0; };

  /* ── what should be sounding now ── */
  function wanted(): Segment {
    if (!started || !playing || hidden) return 'idle';
    const since = sinceCelebration();
    if (since !== null && since < NEW_YEAR_AT) return 'midnight';
    // Music waits for the server's word (the first answer, or a midnight that a sleep or a jumped clock made uncertain).
    if (moment?.holding || moment?.stage === 'syncing' || moment?.stage === 'confirming') return 'idle';
    const r = remaining();
    if (r !== null && r > 0 && r <= BUILD_AT) return 'build';
    if (r !== null && r > 0 && r <= PLAYLIST_FADE_AT) return 'fade';
    if (r !== null && r === 0 && moment && moment.stage === 'final') return 'idle';
    return 'playlist';
  }
  function reconcile() {
    if (!ctx || closed) return;
    const want = wanted(), was = segment;
    if (want === 'idle') {
      if (!playing || hidden) pauseAll();
      // Waiting on the clock (syncing, confirming): the playlist steps aside. The build may ring on into midnight.
      else decks.slice(0, 2).forEach(d => { if (!d.el.paused && d !== midnightDeck) fadeAndPause(d, 0.6); });
      if (want !== was && playing) segment = 'idle';
      emit();
      return;
    }
    const build = decks[2];
    if (want === 'playlist') {
      if (was === 'build' || build.id) { if (!build.el.paused) fadeAndPause(build, 0.2, () => unload(build)); else unload(build); }
      if (midnightDeck && was === 'midnight') {
        const deck = midnightDeck; midnightDeck = null;
        fadeAndPause(deck, MIDNIGHT_MUSIC_FADE_SECONDS, () => unload(deck));
        if (deck === decks[cur]) cur = 1 - cur;
      }
      segment = 'playlist';
      const deck = decks[cur];
      if (freshAfter || !trackId || !deck.id || deck.id === BUILD_ID || deck.id === MIDNIGHT_ID) {
        freshAfter = false;
        // After midnight the New Year opens with its first track (Ode to Joy), whatever the shuffle.
        const first = list().find(id => !failed.has(id)) ?? null;
        const id = was === 'midnight' && celebration?.kind === 'live' ? first : (trackId && !failed.has(trackId) && list().includes(trackId) && deck.id === trackId ? trackId : pick() ?? first);
        if (id) startTrack(id, was === 'idle' ? 0.6 : 1.5);
      } else if (deck.el.paused) void start(deck, 0.5);
      else ramp(deck, 1, 0.3);
      emit();
      return;
    }
    if (want === 'fade') {
      // The playlist steps aside for the final minute (nothing new starts now).
      if (was === 'playlist') { const r = remaining() ?? BUILD_AT; decks.slice(0, 2).forEach(d => { if (!d.el.paused) fadeAndPause(d, Math.min(4, Math.max(0.5, r - (BUILD_AT - 2)))); }); }
      segment = 'fade';
      prepareBuild();
      emit();
      return;
    }
    if (want === 'build') {
      if (was === 'playlist') decks.slice(0, 2).forEach(d => { if (!d.el.paused) fadeAndPause(d, 1); });
      segment = 'build';
      freshAfter = true;
      const offset = buildOffset((remaining() ?? 0) * 1000) ?? 0;
      if (build.id !== BUILD_ID) load(build, BUILD_ID, offset);
      if (build.el.paused) void start(build, offset > 0.5 ? 0.5 : 0, offset);
      prepareMidnight();
      emit();
      return;
    }
    if (want === 'midnight') {
      if (!build.el.paused) fadeAndPause(build, 0.08, () => unload(build));
      if (was === 'playlist') { const deck = decks[cur]; if (!deck.el.paused) fadeAndPause(deck, 0.8); }
      segment = 'midnight';
      const since = sinceCelebration() ?? 0;
      if (!midnightDeck) prepareMidnight();
      const deck = midnightDeck!;
      if (deck.id !== MIDNIGHT_ID) load(deck, MIDNIGHT_ID, since);
      if (deck.el.paused) void start(deck, since > 0.5 ? 0.4 : 0, since);
      emit();
    }
  }
  function prepareBuild() {
    const build = decks[2];
    if (build.id !== BUILD_ID) load(build, BUILD_ID, 0);
  }
  /** The midnight music waits on a playlist deck that is free (the other one keeps a paused track for a replay). */
  function prepareMidnight() {
    if (midnightDeck) return;
    const free = decks[1 - cur];
    midnightDeck = free; queued = null;
    if (free.id !== MIDNIGHT_ID) load(free, MIDNIGHT_ID, 0);
  }

  /* ── the countdown's own sounds ── */
  function ensureCues(): Promise<void> {
    if (!ctx || (cues.ticks && cues.fx)) return Promise.resolve();
    if (cues.loading) return cues.loading;
    if (cues.failedAt !== null && deps.now() - cues.failedAt < 30_000) return Promise.resolve();
    const c = ctx;
    const get = async (id: string) => {
      const response = await deps.fetch(audioUrl(id, format, base));
      if (!response.ok) throw new Error(`cue ${id}`);
      const data = await response.arrayBuffer();
      return await new Promise<AudioBuffer>((resolve, reject) => {
        const done = c.decodeAudioData(data, resolve, reject);
        if (done && typeof (done as Promise<AudioBuffer>).then === 'function') (done as Promise<AudioBuffer>).then(resolve, reject);
      });
    };
    cues.loading = Promise.all([get(CUES.ticks.id), get(CUES.midnightFx.id)]).then(([ticks, fx]) => { cues.ticks = ticks; cues.fx = fx; cues.failedAt = null; }, () => {
      cues.failedAt = deps.now();
      if (effects && note === '') { note = 'cues-failed'; emit(); }
    }).finally(() => { cues.loading = null; });
    return cues.loading;
  }
  function voice(buffer: AudioBuffer, offset: number, duration?: number, fadeAt?: number) {
    if (!ctx || !fxBus || ctx.state !== 'running') return;
    try {
      const source = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
      source.buffer = buffer;
      source.connect(g).connect(fxBus);
      if (fadeAt !== undefined) { g.gain.setValueAtTime(1, t + fadeAt); g.gain.linearRampToValueAtTime(0, t + fadeAt + LAST_TICK_FADE); }
      source.onended = () => voices.delete(source);
      voices.add(source);
      if (duration !== undefined) source.start(t, offset, duration); else source.start(t, offset);
    } catch { /* a sound never interrupts the countdown */ }
  }
  function tick(shown: number, into: number) {
    if (!cues.ticks || into > 0.3) return;
    // Second 1 rings until the clock reaches midnight, then gives way to the impact.
    if (shown === 1) voice(cues.ticks, tickOffset(1) + into, 1 - into + LAST_TICK_FADE, Math.max(0, 1 - into));
    else voice(cues.ticks, tickOffset(shown) + into, TICK_SLOT - into);
  }
  function midnightEffects() {
    const since = sinceCelebration() ?? 0;
    if (cues.fx) { if (since < 20) voice(cues.fx, since); return; }
    // Not ready yet: it joins at the right moment when it arrives (or not at all, after the fireworks).
    void ensureCues().then(() => { const later = sinceCelebration(); if (cues.fx && effects && later !== null && later < 15 && !hidden) voice(cues.fx, later); });
  }
  const stopVoices = () => { voices.forEach(v => { try { v.stop(); } catch { /* already stopped */ } }); voices.clear(); };

  /* ── the controller ── */
  return {
    getState,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async start() {
      if (closed) return false;
      const c = ensureGraph();
      // Everything below runs inside the tap, before anything waits: that is what lets phones play later.
      const resuming = c.resume?.().catch(() => undefined);
      decks.forEach(deck => { if (!deck.id) { try { deck.el.src = SILENCE; void deck.el.play()?.catch(() => undefined); } catch { /* unlocked or not, it still works on desktops */ } } });
      started = true; note = ''; hidden = false; playing = true;
      reconcile();
      const since = sinceCelebration();
      if (effects && since !== null && since < 15) midnightEffects();
      await resuming;
      if (c.state !== 'running') { started = false; playing = false; note = 'blocked'; pauseAll(); emit(); return false; }
      const r = remaining();
      if (effects && r !== null && r <= CUES_FROM_SECONDS) void ensureCues();
      emit();
      return true;
    },
    stop() {
      started = false; playing = false; segment = 'idle'; note = '';
      stopVoices(); pauseAll();
      void ctx?.suspend?.().catch(() => undefined);
      emit();
    },
    async play() {
      if (!started) return this.start();
      if (ctx && ctx.state !== 'running') { try { await ctx.resume(); } catch { /* checked below */ } }
      if (!ctx || ctx.state !== 'running') { note = 'blocked'; emit(); return false; }
      playing = true; note = note === 'music-failed' ? '' : note;
      if (note === 'blocked' || note === 'lost') note = '';
      failures = 0;
      save(); reconcile();
      return true;
    },
    pause() {
      playing = false; save();
      decks.forEach(deck => { if (!deck.el.paused) fadeAndPause(deck, 0.25); });
      emit();
    },
    next() {
      if (!started || segment !== 'playlist') return;
      if (!playing) { playing = true; save(); }
      advance(pick(), 0.5);
    },
    previous() {
      if (!started || segment !== 'playlist') return;
      const deck = decks[cur];
      // A few seconds in, Previous starts the track again (as players do); otherwise it goes back one.
      if (deck.el.currentTime > 4) { try { deck.el.currentTime = 0; } catch { /* not seekable */ } if (deck.el.paused && playing) void start(deck, 0.2); return; }
      if (!playing) { playing = true; save(); }
      const before = previousTrack(list(), trackId, history.slice(0, -1));
      if (!before) return;
      history.pop();
      if (history[history.length - 1] === before) history.pop();
      advance(before, 0.5);
    },
    setEffects(on) {
      effects = on; save();
      if (fxBus && ctx) fxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
      if (!on) { stopVoices(); if (note === 'cues-failed') note = ''; }
      else { const r = remaining(); if (started && r !== null && r <= CUES_FROM_SECONDS) void ensureCues(); }
      emit();
    },
    setVolume(value) {
      volume = Math.min(1, Math.max(0, Number.isFinite(value) ? value : volume)); save();
      if (master && ctx) master.gain.setTargetAtTime(volume * volume, ctx.currentTime, 0.04);
      emit();
    },
    setShuffle(on) { shuffle = on; queued = null; save(); emit(); },
    sync(next) {
      const before = moment;
      moment = { ...next, at: deps.now() };
      const finalHour = next.stage === 'hour' || next.stage === 'minute' || next.stage === 'final';
      // Without a server time (syncing, confirming, unavailable) the season stays as it was.
      const nextSeason = next.serverNow === null && !finalHour ? season : seasonFor(next.serverNow, finalHour);
      if (nextSeason !== season) { season = nextSeason; queued = null; }
      if (!started || closed) return;
      const r = remaining();
      if (effects && r !== null && r > 0 && r <= CUES_FROM_SECONDS) void ensureCues();
      if (playing && r !== null && r > 0 && r <= 300) prepareBuild();
      // The ten seconds: each cue once, when its second appears, from where that second already is.
      if (effects && next.stage === 'final' && r !== null && r > 0 && !hidden) {
        const shown = Math.ceil(r - 1e-6);
        if (shown >= 1 && shown <= 10 && shown !== lastTick) { lastTick = shown; tick(shown, Math.max(0, shown - r)); }
      }
      if (before?.stage !== next.stage || segment !== wanted() || (segment === 'playlist' && decks[cur]?.el.paused && playing)) reconcile();
      if (segment === 'playlist' && decks[cur] && !decks[cur].el.paused) okPlaying();
      emit();
    },
    celebrate(kind) {
      celebration = { kind, at: deps.now() };
      deps.clearTimer(celebrationTimer);
      if (started && effects && !hidden) midnightEffects();
      if (started) reconcile();
      // Back to the playlist when the midnight music has settled.
      celebrationTimer = deps.setTimer(() => { if (!closed) { reconcile(); emit(); } }, NEW_YEAR_AT * 1000 + 20);
      emit();
    },
    hide() {
      hidden = true;
      stopVoices(); pauseAll();
      void ctx?.suspend?.().catch(() => undefined);
    },
    async show() {
      if (!hidden) return;
      hidden = false;
      if (!started || !ctx) return;
      try { await ctx.resume(); } catch { /* checked below */ }
      if (hidden) return;
      if (ctx.state !== 'running') { playing = false; note = 'lost'; emit(); return; }
      reconcile();
      emit();
    },
    close() {
      closed = true; started = false; playing = false;
      deps.clearTimer(celebrationTimer);
      stopVoices();
      decks.forEach(unload);
      listeners.clear();
      void ctx?.close?.().catch(() => undefined);
      ctx = null; master = null; fxBus = null;
    },
  };
}

/** Data use for the credits note: a typical track, and the countdown's own sounds. */
export const TYPICAL_TRACK_MB = 2.3;
