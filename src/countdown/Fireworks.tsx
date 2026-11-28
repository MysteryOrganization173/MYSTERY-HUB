import { memo, useEffect, useRef } from 'react';
import { FIREWORKS, type Burst } from './audioPlan';

/**
 * Midnight's golden fireworks: one canvas, drawn only during the celebration and never with reduced motion. Each burst
 * follows the shared timeline (audioPlan.ts), so a firework blooms exactly when its sound does.
 *
 * Every particle's position is worked out from the time since its burst (not stepped frame by frame), so the show looks
 * the same on a slow phone and a fast TV, and a dropped frame never makes it run late. Cost is bounded: particles scale
 * with the screen's area up to a cap, the canvas resolution is capped (lower on very large screens), and the loop stops
 * by itself when the last spark fades. Gentle twinkle only: nothing flashes.
 */
const PALETTE = ['#fff6dc', '#f6e3b0', '#e3c27a', '#f1d38f', '#c9cde0', '#ffe9c2'];
const SHELL_RISE = 0.6;
const LIFE = 2.4;
export const FIREWORKS_END = Math.max(...FIREWORKS.map(b => b.at)) + LIFE + 0.2;

interface Particle { angle: number; speed: number; life: number; color: string; width: number; phase: number }
interface Prepared extends Burst { particles: Particle[] }

/** Small, fast and seeded, so every visit (and every recording) draws the same show. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function prepareBursts(area: number, bursts: readonly Burst[] = FIREWORKS): Prepared[] {
  const random = seeded(2027);
  const per = Math.max(50, Math.min(120, Math.round(area / 7000)));
  return bursts.map(b => ({
    ...b,
    particles: Array.from({ length: Math.round(per * b.size) }, (_, i) => ({
      angle: (i / Math.round(per * b.size)) * Math.PI * 2 + random() * 0.35,
      speed: 0.55 + random() * 0.45,
      life: LIFE * (0.65 + random() * 0.35),
      color: PALETTE[Math.floor(random() * PALETTE.length)],
      width: 0.9 + random() * 1.1,
      phase: random() * Math.PI * 2,
    })),
  }));
}

export const Fireworks = memo(function Fireworks({ startedAt }: { startedAt: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    let width = 0, height = 0, scale = 1, bursts: Prepared[] = [];
    const resize = () => {
      width = window.innerWidth; height = window.innerHeight;
      // Sharp enough, never costly: at most 1.5× on ordinary screens, 1× on very large ones (TVs, 4K).
      scale = Math.min(window.devicePixelRatio || 1, width * height > 2_600_000 ? 1 : 1.5);
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      bursts = prepareBursts(width * height);
    };
    resize();
    window.addEventListener('resize', resize);
    let frame = 0;
    const draw = (now: number) => {
      const t = (now - startedAt) / 1000;
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.clearRect(0, 0, width, height);
      if (t > FIREWORKS_END) return;
      g.globalCompositeOperation = 'lighter';
      const reach = Math.min(width, height) * 0.36;
      // Streaks thicken on big screens (a TV across the room), within reason.
      const weight = Math.max(1, Math.min(3.2, Math.min(width, height) / 420));
      const portrait = height > width;
      for (const b of bursts) {
        // On a tall screen the bursts spread from top to bottom, around the dial rather than behind it.
        const x0 = b.x * width, y0 = (portrait ? 0.12 + (b.y - 0.18) * 2.45 : b.y) * height, since = t - b.at;
        if (since < -SHELL_RISE || since > LIFE) continue;
        if (since < 0) {
          // The shell climbs from below the screen, slowing as it rises.
          const p = 1 - (-since / SHELL_RISE), ease = 1 - (1 - p) * (1 - p);
          const y = height * 1.04 + (y0 - height * 1.04) * ease;
          g.globalAlpha = 0.7; g.fillStyle = '#ffe9c2';
          g.beginPath(); g.arc(x0, y, 1.8 * weight, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 0.22; g.fillRect(x0 - 0.7 * weight, y, 1.4 * weight, Math.min(48 * weight, height * 0.06));
          continue;
        }
        // The bloom: a soft glow that fades in half a second.
        if (since < 0.5) {
          const glow = g.createRadialGradient(x0, y0, 0, x0, y0, reach * 0.42 * b.size);
          glow.addColorStop(0, `rgba(246,227,176,${0.34 * (1 - since / 0.5)})`); glow.addColorStop(1, 'rgba(246,227,176,0)');
          g.globalAlpha = 1; g.fillStyle = glow; g.fillRect(x0 - reach, y0 - reach, reach * 2, reach * 2);
        }
        const drag = 2.2, gravity = reach * 0.42;
        for (const p of b.particles) {
          if (since > p.life) continue;
          const fade = Math.pow(1 - since / p.life, 1.5) * (0.82 + 0.18 * Math.sin(since * 9 + p.phase));
          const at = (s: number) => {
            const d = (1 - Math.exp(-drag * s)) / drag, v = p.speed * reach * b.size * 1.6;
            return [x0 + Math.cos(p.angle) * v * d, y0 + Math.sin(p.angle) * v * d + gravity * s * s * 0.5] as const;
          };
          const [x, y] = at(since), [px, py] = at(Math.max(0, since - 0.11));
          g.globalAlpha = Math.min(1, Math.max(0, fade * 1.15));
          g.strokeStyle = p.color; g.lineWidth = p.width * weight * (since < 0.3 ? 1.5 : 1.1);
          g.lineCap = 'round'; g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
        }
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, [startedAt]);
  return <canvas ref={ref} className="cd-fireworks" aria-hidden="true" />;
});
