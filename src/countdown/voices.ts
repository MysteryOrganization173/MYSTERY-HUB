/** The two instruments the countdown's sound uses, synthesised in the browser (shared by sound.ts and score.ts). */
export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A soft piano-like note: a few harmonic partials, a quick touch and a natural decay (upper partials fade first). */
export function piano(ctx: BaseAudioContext, out: AudioNode, midi: number, at: number, velocity: number, length = 2.6) {
  const f = hz(midi);
  for (const [ratio, gain, decay] of [[1, 1, 1], [2, .42, .55], [3, .16, .35], [4.01, .07, .22]] as const) {
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = f * ratio;
    const end = at + length * decay;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, velocity * gain), at + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(env).connect(out);
    osc.start(at); osc.stop(end + 0.05);
  }
}

/** A bell-like chime: inharmonic partials, quick attack and a long, natural ring. */
export function bell(ctx: BaseAudioContext, out: AudioNode, frequency: number, at: number, length: number, level: number) {
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
