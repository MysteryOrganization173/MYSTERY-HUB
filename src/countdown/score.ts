/**
 * Mystery Countdown 3.7 closeout: the optional ambient soundtrack, composed for the Midnight Dial and played live by
 * the browser (Web Audio). Original: no recording, sample, download or existing melody is used; every note is
 * synthesised here. This module is loaded only after a visitor turns sound on (CountdownPage → sound.ts).
 *
 * The piece, in F major:
 * - calm (days, the eve, before the time is confirmed): warm pads that change chord every eight seconds, a soft piano
 *   line that wanders the pentatonic scale (never one repeated note), and an occasional high chime;
 * - the final hour: a touch brighter and a little more piano;
 * - the final minute: the pulse quickens, the filter opens and the line climbs, a controlled build;
 * - the final ten seconds: the music steps back (the countdown's own rising notes lead, see sound.ts) and the pad
 *   holds the chord that resolves at midnight;
 * - midnight: the pad blooms into the home chord; then a slower, brighter welcome.
 * Levels are low and the output passes a gentle limiter, so it stays comfortable. Nothing here runs while hidden.
 */
import { bell, hz, piano } from './voices';

export type Mood = 'calm' | 'hour' | 'minute' | 'final' | 'welcome';

export interface Score {
  /** progress (0–1) only matters in the final minute, where the build follows it. */
  setMood(mood: Mood, progress?: number): void;
  /** Midnight: the pad blooms into the home chord and the welcome begins. */
  celebrate(): void;
  /** The page is hidden: stop scheduling (the context itself is suspended by sound.ts). */
  hold(): void;
  release(): void;
  /** Fades out and releases everything. */
  stop(): void;
}


/** A small deterministic random source, so the line varies from visit to visit and tests can repeat it. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Chords as MIDI notes. Anticipation: Fmaj7, Dm9, Bbmaj9, Csus2 (which leans home). Welcome: Fmaj9, Am7, Bbmaj9, Fadd9/C.
const ANTICIPATION = [[53, 57, 60, 64], [50, 53, 57, 64], [46, 50, 53, 57, 60], [48, 55, 62, 64]];
const WELCOME = [[41, 53, 57, 60, 64, 67], [45, 52, 55, 60, 64], [46, 53, 57, 60, 62], [48, 53, 57, 62, 65]];
const HOLD = [48, 55, 60, 62, 67];
const HOME = [41, 53, 57, 60, 64, 67, 72];
/** F major pentatonic, the melody's whole vocabulary: no note outside it, so no line can clash. */
export const SCALE = [65, 67, 69, 72, 74, 77, 79, 81, 84];

interface Shape { beat: number; play: number; halves: number; chime: number; cutoff: number; level: number }
const SHAPES: Record<Mood, Shape> = {
  calm: { beat: 1.0, play: .55, halves: 0, chime: .05, cutoff: 900, level: .9 },
  hour: { beat: .91, play: .62, halves: .08, chime: .08, cutoff: 1200, level: .95 },
  minute: { beat: .79, play: .7, halves: .45, chime: .14, cutoff: 1600, level: 1 },
  final: { beat: .79, play: 0, halves: 0, chime: 0, cutoff: 2200, level: .7 },
  welcome: { beat: 1.08, play: .5, halves: .05, chime: .1, cutoff: 1500, level: .9 },
};

/** A short, generated room (decaying noise): the space the notes ring in. Built once, in memory. */
function room(ctx: BaseAudioContext, seconds = 2.6) {
  const rate = ctx.sampleRate, length = Math.floor(rate * seconds), buffer = ctx.createBuffer(2, length, rate), rand = seeded(2027);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (rand() * 2 - 1) * (1 - i / length) ** 3;
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = buffer;
  return convolver;
}

/** Starts the soundtrack on an already running context. `out` is sound.ts's master (behind its limiter). */
export function startScore(ctx: AudioContext, out: AudioNode, mood: Mood, rand: () => number = seeded(Date.now() & 0xffff), setTimer = setInterval, clearTimer = clearInterval): Score {
  const bus = ctx.createGain(), tone = ctx.createBiquadFilter(), wet = ctx.createGain(), reverb = room(ctx);
  bus.gain.setValueAtTime(0.0001, ctx.currentTime);
  tone.type = 'lowpass'; tone.Q.value = 0.4;
  wet.gain.value = 0.42;
  bus.connect(tone).connect(out);
  tone.connect(wet).connect(reverb).connect(out);

  let current: Mood = mood, shape = SHAPES[mood], progress = 0, celebrating = false;
  let next = ctx.currentTime + 0.1, beat = 0, chordAt = 0, chordIndex = 0, note = 2, last = -1, repeats = 0;
  let timer: ReturnType<typeof setInterval> | null = null, stopped = false;

  const level = () => shape.level * (current === 'minute' ? 0.85 + progress * 0.25 : 1) * 0.34;
  const cutoff = () => current === 'minute' ? shape.cutoff + progress * 1800 : shape.cutoff;
  const glide = (param: AudioParam, value: number, seconds: number) => {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t); param.setValueAtTime(Math.max(0.0001, param.value), t); param.linearRampToValueAtTime(value, t + seconds);
  };
  bus.gain.linearRampToValueAtTime(level(), ctx.currentTime + 2.5);
  tone.frequency.value = cutoff();

  /** A pad chord: two softly detuned voices per note, slow swell in and out (overlapping the next chord). */
  const pad = (notes: number[], at: number, length: number, gainLevel: number, attack = 2.4) => {
    const envelopes: GainNode[] = [];
    for (const midi of notes) {
      for (const [type, detune] of [['triangle', -5], ['sine', 6]] as const) {
        const osc = ctx.createOscillator(), env = ctx.createGain();
        osc.type = type; osc.frequency.value = hz(midi); osc.detune.value = detune;
        env.gain.setValueAtTime(0.0001, at);
        env.gain.linearRampToValueAtTime(gainLevel / notes.length, at + attack);
        env.gain.setValueAtTime(gainLevel / notes.length, at + length - 2.5);
        env.gain.linearRampToValueAtTime(0.0001, at + length + 1.5);
        osc.connect(env).connect(bus);
        osc.start(at); osc.stop(at + length + 1.6);
        envelopes.push(env);
      }
    }
    return envelopes;
  };
  let held: GainNode[] = [];

  /** The next melody note: mostly small steps, sometimes a leap, never the same note three times running. */
  const step = () => {
    const r = rand();
    let move = r < .3 ? -1 : r < .6 ? 1 : r < .75 ? -2 : r < .9 ? 2 : (rand() < .5 ? 3 : -3);
    if (current === 'minute' && rand() < .25 + progress * .4) move = Math.abs(move); // the build climbs
    note = Math.min(SCALE.length - 1, Math.max(0, note + move));
    if (note === last && ++repeats >= 2) { note = note > 3 ? note - 1 : note + 1; repeats = 0; } else if (note !== last) repeats = 0;
    last = note;
    return SCALE[note] - (current === 'calm' && note > 6 ? 12 : 0);
  };

  const schedule = () => {
    if (stopped) return;
    const horizon = ctx.currentTime + 1.2;
    if (next < ctx.currentTime) next = ctx.currentTime + 0.05;
    while (next < horizon) {
      const chords = current === 'welcome' ? WELCOME : ANTICIPATION;
      if (next >= chordAt) {
        if (current === 'final') { held = pad(HOLD, next, 12, .5, 4); chordAt = next + 12; }
        else if (!celebrating) {
          const notes = chords[chordIndex++ % chords.length];
          pad(notes, next, 8 * shape.beat, current === 'welcome' ? .55 : .5);
          // The bass note an octave down, very quietly, for warmth.
          pad([notes[0] - 12], next, 8 * shape.beat, .18);
          chordAt = next + 8 * shape.beat;
        }
      }
      if (!celebrating && current !== 'final') {
        const accent = beat % 4 === 0 ? 1 : .8;
        if (rand() < shape.play) piano(ctx, bus, step(), next + (rand() - .5) * .02, (.14 + rand() * .06) * accent);
        if (rand() < shape.halves) piano(ctx, bus, step(), next + shape.beat / 2, .1 + rand() * .04, 1.8);
        if (rand() < shape.chime) bell(ctx, bus, hz(SCALE[5 + Math.floor(rand() * 4)] + 12), next + shape.beat * rand(), 2.4, .018);
      }
      next += shape.beat; beat++;
    }
  };
  let settle: ReturnType<typeof setTimeout> | null = null;
  const run = () => { if (!timer && !stopped) { schedule(); timer = setTimer(schedule, 250); } };
  const halt = () => { if (timer) { clearTimer(timer); timer = null; } };
  run();

  return {
    setMood(mood, value = 0) {
      progress = Math.min(1, Math.max(0, value));
      if (mood === current) { if (mood === 'minute') { glide(bus.gain, level(), .8); tone.frequency.value = cutoff(); } return; }
      const was = current;
      current = mood; shape = SHAPES[mood];
      if (mood === 'welcome' && was !== 'final') { chordIndex = 0; celebrating = false; }
      // A change of section starts on its own chord, a moment from now, rather than waiting out the last one.
      chordAt = Math.min(chordAt, ctx.currentTime + 0.3);
      glide(bus.gain, level(), mood === 'final' ? 1 : 3);
      glide(tone.frequency, cutoff(), 3);
    },
    celebrate() {
      celebrating = true;
      const t = ctx.currentTime + 0.02;
      glide(bus.gain, 0.22, 0.4); glide(tone.frequency, 4200, 0.4);
      // The held chord gives way to home.
      for (const env of held) glide(env.gain, 0.0001, 0.5);
      held = [];
      pad(HOME, t, 7, .9, .35);
      current = 'welcome'; shape = SHAPES.welcome; chordIndex = 1; chordAt = t + 7; next = Math.max(next, t + 6);
      if (settle) clearTimeout(settle);
      settle = setTimeout(() => { settle = null; if (stopped) return; celebrating = false; glide(bus.gain, level(), 4); glide(tone.frequency, cutoff(), 5); }, 6500);
    },
    hold: halt,
    release: run,
    stop() {
      if (stopped) return;
      stopped = true; halt();
      if (settle) { clearTimeout(settle); settle = null; }
      glide(bus.gain, 0.0001, 0.4);
      setTimeout(() => { try { bus.disconnect(); wet.disconnect(); reverb.disconnect(); tone.disconnect(); } catch { /* already gone */ } }, 600);
    },
  };
}
