/**
 * Optional sound, off by default, made in the browser (Web Audio). Nothing is downloaded: no audio file, sample or
 * recording, and no existing music. Two parts, both started only by a tap on the sound button (browsers require that):
 * - Music: an original ambient soundtrack (score.ts, loaded only when it is wanted) that builds gently towards
 *   midnight. It can be turned off on its own.
 * - Countdown sounds: rising notes for each of the final ten seconds and a midnight celebration of bells and chimes.
 * Everything pauses whenever the page is hidden and stops for good when the page closes.
 */
import type { Mood, Score } from './score';
import { bell, hz, piano } from './voices';

type AudioWindow = Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
const audioConstructor = (win: Window | undefined = typeof window === 'undefined' ? undefined : window) =>
  win ? ((win as AudioWindow).AudioContext || (win as AudioWindow).webkitAudioContext || null) : null;
export const soundSupported = (win?: Window) => audioConstructor(win) !== null;

/** The final ten seconds climb the F major pentatonic, one step a second (never one repeated note). */
export const TICK_NOTES = [60, 62, 65, 67, 69, 72, 74, 77, 79, 81];
export const tickNote = (secondsLeft: number) => TICK_NOTES[Math.min(9, Math.max(0, 10 - Math.round(secondsLeft)))];
export type { Mood };

export interface CountdownSound {
  /** From the tap itself. Resolves whether sound is really on (false when the browser refused to start audio). */
  enable: () => Promise<boolean>;
  disable: () => void;
  /** The ambient music, on by default once sound is on. Countdown sounds play either way. */
  setMusic: (on: boolean) => void;
  setMood: (mood: Mood, progress?: number) => void;
  tick: (secondsLeft: number) => void;
  midnight: () => void;
  pause: () => void;
  resume: () => void;
  close: () => void;
  readonly on: boolean;
  readonly music: boolean;
}

type ScoreModule = { startScore: (ctx: AudioContext, out: AudioNode, mood: Mood) => Score };

export function createCountdownSound(win?: Window, loadScore: () => Promise<ScoreModule> = () => import('./score')): CountdownSound | null {
  const Ctor = audioConstructor(win);
  if (!Ctor) return null;
  let ctx: AudioContext | null = null, master: GainNode | null = null, on = false, music = true, hidden = false;
  let score: Score | null = null, loading = false, mood: Mood = 'calm', progress = 0;
  const ready = (): AudioContext => {
    if (ctx) return ctx;
    const created = new Ctor(), gain = created.createGain();
    gain.gain.value = 0.55;
    // A gentle limiter: midnight's chord and chimes together never get loud or harsh.
    const limit = created.createDynamicsCompressor?.();
    if (limit) { limit.threshold.value = -18; limit.ratio.value = 4; limit.attack.value = 0.01; limit.release.value = 0.3; gain.connect(limit).connect(created.destination); }
    else gain.connect(created.destination);
    ctx = created; master = gain;
    return created;
  };
  const play = (draw: (ctx: AudioContext, out: AudioNode, t: number) => void) => {
    if (!on || !ctx || !master || ctx.state !== 'running') return;
    try { draw(ctx, master, ctx.currentTime + 0.01); } catch { /* sound never interrupts the countdown */ }
  };
  const stopScore = () => { score?.stop(); score = null; };
  const startMusic = () => {
    if (!on || !music || score || loading || !ctx || !master) return;
    loading = true;
    loadScore().then(module => {
      loading = false;
      if (!on || !music || score || !ctx || !master) return;
      try { score = module.startScore(ctx, master, mood); score.setMood(mood, progress); if (hidden) score.hold(); } catch { score = null; }
    }, () => { loading = false; /* the music could not load; countdown sounds still work */ });
  };
  return {
    get on() { return on; },
    get music() { return music; },
    async enable() {
      on = true;
      try {
        const c = ready();
        await c.resume();
        if (c.state !== 'running') { on = false; return false; }
        // A soft two-note welcome says it works, then the music fades in.
        play((c2, out, t) => { bell(c2, out, 698.5, t, 1.2, 0.04); bell(c2, out, 1046.5, t + 0.12, 1.4, 0.035); });
        startMusic();
        return on;
      } catch { on = false; return false; }
    },
    disable() { on = false; stopScore(); void ctx?.suspend().catch(() => undefined); },
    setMusic(value) { music = value; if (!value) stopScore(); else startMusic(); },
    setMood(next, value = 0) {
      mood = next; progress = value;
      score?.setMood(next, value);
    },
    tick(secondsLeft) {
      const last = Math.round(secondsLeft) <= 1, midi = tickNote(secondsLeft);
      play((c, out, t) => {
        piano(c, out, midi, t, last ? 0.2 : 0.15, last ? 2.2 : 1.1);
        bell(c, out, hz(midi + 12), t, last ? 1.4 : 0.5, last ? 0.04 : 0.022);
      });
    },
    midnight() {
      score?.celebrate();
      play((c, out, t) => {
        // A warm low swell under a rising bell chord (F A C F), then a scatter of chimes, like sparks, that fades.
        const low = c.createOscillator(), env = c.createGain();
        low.type = 'sine'; low.frequency.value = 87.3;
        env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.12, t + 0.08); env.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
        low.connect(env).connect(out); low.start(t); low.stop(t + 3.6);
        [698.5, 880, 1046.5, 1396.9].forEach((f, i) => bell(c, out, f, t + i * 0.11, 3.4, 0.085));
        const sparks = [1760, 2093, 2349, 2637, 3136, 2793, 3520, 2349, 2093, 2637, 1760, 3136];
        sparks.forEach((f, i) => bell(c, out, f, t + 0.7 + i * 0.27 + (i % 3) * 0.05, 1.1, 0.026 * (1 - i / 16)));
      });
    },
    pause() { hidden = true; score?.hold(); void ctx?.suspend().catch(() => undefined); },
    resume() { hidden = false; if (!on) return; void ctx?.resume().then(() => score?.release(), () => undefined); },
    close() { on = false; stopScore(); void ctx?.close().catch(() => undefined); ctx = null; master = null; },
  };
}

/** The music's section for the page's stage (the build follows the final minute's progress). */
export function moodFor(stage: string): Mood {
  return stage === 'hour' ? 'hour' : stage === 'minute' ? 'minute' : stage === 'final' ? 'final' : stage === 'welcome' || stage === 'commemorative' ? 'welcome' : 'calm';
}
