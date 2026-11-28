/**
 * Optional sound, off by default, made in the browser (Web Audio): a soft tick for each of the final ten seconds and a
 * short bell chord at midnight. No audio file is downloaded and no music is used. It starts only after a tap on the
 * sound button (browsers require that), pauses whenever the page is hidden and stops for good when the page closes.
 */
type AudioWindow = Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
const audioConstructor = (win: Window | undefined = typeof window === 'undefined' ? undefined : window) =>
  win ? ((win as AudioWindow).AudioContext || (win as AudioWindow).webkitAudioContext || null) : null;
export const soundSupported = (win?: Window) => audioConstructor(win) !== null;

/** A bell-like note: a few inharmonic partials with quick attack and natural decay. */
function bell(ctx: AudioContext, out: AudioNode, frequency: number, at: number, length: number, level: number) {
  for (const [ratio, gain] of [[1, 1], [2.01, .42], [3.0, .22], [4.2, .1]] as const) {
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = frequency * ratio;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(level * gain, at + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length / ratio);
    osc.connect(env).connect(out);
    osc.start(at); osc.stop(at + length / ratio + 0.05);
  }
}

export interface CountdownSound { enable: () => Promise<boolean>; disable: () => void; tick: (last: boolean) => void; midnight: () => void; pause: () => void; resume: () => void; close: () => void; readonly on: boolean }

export function createCountdownSound(win?: Window): CountdownSound | null {
  const Ctor = audioConstructor(win);
  if (!Ctor) return null;
  let ctx: AudioContext | null = null, master: GainNode | null = null, on = false;
  const ready = (): AudioContext => {
    if (ctx) return ctx;
    const created = new Ctor(), gain = created.createGain();
    gain.gain.value = 0.5; gain.connect(created.destination);
    ctx = created; master = gain;
    return created;
  };
  const play = (draw: (ctx: AudioContext, out: AudioNode, t: number) => void) => {
    if (!on || !ctx || !master || ctx.state !== 'running') return;
    try { draw(ctx, master, ctx.currentTime + 0.01); } catch { /* sound never interrupts the countdown */ }
  };
  return {
    get on() { return on; },
    /**
     * Called from the tap itself, so the browser lets audio start. A quiet two-note confirmation says it works. Resolves
     * whether sound is really on: false when the browser refused to start audio.
     */
    async enable() {
      on = true;
      try {
        const c = ready();
        await c.resume();
        if (c.state !== 'running') { on = false; return false; }
        play((c2, out, t) => { bell(c2, out, 1046.5, t, 0.9, 0.05); bell(c2, out, 1568, t + 0.09, 0.9, 0.04); });
        return on;
      } catch { on = false; return false; }
    },
    disable() { on = false; void ctx?.suspend().catch(() => undefined); },
    tick(last) { play((c, out, t) => bell(c, out, last ? 1318.5 : 987.8, t, last ? 0.5 : 0.28, last ? 0.07 : 0.045)); },
    midnight() {
      play((c, out, t) => {
        [784, 987.8, 1174.7, 1568].forEach((f, i) => bell(c, out, f, t + i * 0.11, 3.2, 0.09));
        [2093, 2637, 3136, 2349, 2793].forEach((f, i) => bell(c, out, f, t + 0.6 + i * 0.16, 0.8, 0.025));
      });
    },
    pause() { void ctx?.suspend().catch(() => undefined); },
    resume() { if (on) void ctx?.resume().catch(() => undefined); },
    close() { on = false; void ctx?.close().catch(() => undefined); ctx = null; master = null; },
  };
}
