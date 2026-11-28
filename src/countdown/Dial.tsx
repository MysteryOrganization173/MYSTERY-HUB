import { memo, type CSSProperties, type ReactNode } from 'react';
import { dialModel, type Stage } from './stage';

/**
 * The Midnight Dial: an original celestial clock face in SVG. Its lit ring is the time left in the dial's current span
 * and always ends at 12 o'clock, so every stage converges on the same point: midnight. One star marks it.
 *
 * Only a few attributes change each second (the ring's dash offset and the seconds light's rotation); the marks are
 * drawn once per stage. Every motion is a transition on transform, opacity or a dash offset, and stops with reduced
 * motion. 3.7.3: a page left open for hours costs a phone almost nothing between seconds. The seconds light turns on
 * its own compositor layer, and the ring glides only in the final minute, where it moves a visible distance each
 * second (earlier it steps by a fraction of a pixel, so it simply steps: the dial looks the same).
 */
const SIZE = 320, C = SIZE / 2, R = 136;
export const RING_LENGTH = 2 * Math.PI * R;

const Ticks = memo(function Ticks({ count, major }: { count: number; major: number }) {
  if (!count) return null;
  return (
    <g className="cd-ticks">
      {Array.from({ length: count }, (_, i) => {
        const big = i % major === 0, angle = (i / count) * 360;
        return <line key={i} className={big ? 'is-major' : undefined} x1={C} y1={C - R - (big ? 13 : 9)} x2={C} y2={C - R - 5} transform={`rotate(${angle} ${C} ${C})`} />;
      })}
    </g>
  );
});

/** Ten arcs for the final ten seconds; the lit ones are those still to come, the last just before 12 o'clock. */
const Segments = memo(function Segments({ lit }: { lit: number }) {
  const gap = 5, span = 36 - gap;
  return (
    <g className="cd-segments">
      {Array.from({ length: 10 }, (_, i) => {
        const start = (i * 36 + gap / 2 - 90) * Math.PI / 180, end = (i * 36 + gap / 2 + span - 90) * Math.PI / 180;
        const d = `M ${C + R * Math.cos(start)} ${C + R * Math.sin(start)} A ${R} ${R} 0 0 1 ${C + R * Math.cos(end)} ${C + R * Math.sin(end)}`;
        return <path key={i} d={d} className={i >= 10 - lit ? 'is-lit' : undefined} />;
      })}
    </g>
  );
});

/** The one star at 12 o'clock: midnight, where every stage of the ring converges. */
function MidnightStar() {
  return <path className="cd-midnight-star" d={`M ${C} ${C - R - 27} l 3.2 8.8 l 8.8 3.2 l -8.8 3.2 l -3.2 8.8 l -3.2 -8.8 l -8.8 -3.2 l 8.8 -3.2 z`} />;
}

/** Champagne sparks and rays for the one celebration at midnight (not drawn at all with reduced motion). */
export const SPARKS = Array.from({ length: 28 }, (_, i) => ({ angle: (i * 360) / 28 + ((i * 47) % 9) - 4, distance: 120 + ((i * 37) % 70), delay: ((i * 53) % 9) * 0.045, size: 3 + ((i * 29) % 4) }));
export const RAYS = Array.from({ length: 12 }, (_, i) => ({ angle: i * 30 + 15, delay: (i % 3) * 0.08 }));

export function Dial({ stage, remainingMs, celebrating, motion, children }: { stage: Stage; remainingMs: number; celebrating: boolean; motion: boolean; children: ReactNode }) {
  const model = dialModel(stage, remainingMs);
  const lit = Math.min(1, Math.max(0, model.lit));
  return (
    <div className="cd-dial" data-stage={stage} data-celebrating={celebrating || undefined}>
      <svg className="cd-dial-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="cd-face" cx="50%" cy="42%" r="60%">
            <stop offset="0" stopColor="#1d2350" stopOpacity=".55" />
            <stop offset=".7" stopColor="#0b0f2a" stopOpacity=".35" />
            <stop offset="1" stopColor="#050817" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="cd-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fbf0d2" />
            <stop offset=".5" stopColor="#e3c27a" />
            <stop offset="1" stopColor="#b8924a" />
          </linearGradient>
        </defs>
        <circle cx={C} cy={C} r={R + 18} fill="url(#cd-face)" />
        <circle className="cd-ring-hair" cx={C} cy={C} r={R + 17} />
        <circle className="cd-ring-hair is-inner" cx={C} cy={C} r={R - 16} />
        <Ticks key={`${model.ticks}:${model.major}`} count={model.ticks} major={model.major} />
        {model.segments
          ? <Segments lit={model.litSegments} />
          : <>
              <circle className="cd-ring-track" cx={C} cy={C} r={R} />
              {/* Lit from the time already gone to 12 o'clock. Remounted per stage so a new span never sweeps backwards. */}
              <circle key={stage} className="cd-ring-lit" cx={C} cy={C} r={R} transform={`rotate(-90 ${C} ${C})`}
                strokeDasharray={`${RING_LENGTH} ${RING_LENGTH}`} strokeDashoffset={-(1 - lit) * RING_LENGTH} />
            </>}
        {/* Over the seconds light, as before (it passes just under the star at 12 o'clock). */}
        {model.secondAngle === null && <MidnightStar />}
      </svg>
      {model.secondAngle !== null && (
        <>
          {/* 3.7.3: the seconds light is its own layer, so its turn each second is a compositor rotation instead of a
              repaint of the whole dial for every frame of the movement. Same geometry, same timing. */}
          <svg key={`s-${stage}`} className="cd-second-layer" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false" style={{ transform: `rotate(${model.secondAngle}deg)` }}>
            <circle cx={C} cy={C - R} r="9" className="cd-second-glow" />
            <circle cx={C} cy={C - R} r="3.2" className="cd-second-dot" />
          </svg>
          <svg className="cd-dial-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false"><MidnightStar /></svg>
        </>
      )}
      {celebrating && motion && (
        <div className="cd-burst" aria-hidden="true">
          {RAYS.map((r, i) => <i key={`r${i}`} className="cd-ray" style={{ '--a': `${r.angle}deg`, '--d': `${r.delay}s` } as CSSProperties} />)}
          {SPARKS.map((s, i) => <b key={`s${i}`} className="cd-spark" style={{ '--a': `${s.angle}deg`, '--r': `${(s.distance / 5).toFixed(1)}cqi`, '--d': `${s.delay}s`, '--s': `${s.size}px` } as CSSProperties} />)}
        </div>
      )}
      <div className="cd-dial-center">{children}</div>
    </div>
  );
}

/** 2027 in the dial: "202" in ivory and a waiting outlined 7 that fills with light, rising, at midnight. */
export function YearMark({ lit, igniting, small = false }: { lit: boolean; igniting: boolean; small?: boolean }) {
  return (
    <span className="cd-year" data-lit={lit || undefined} data-igniting={igniting || undefined} data-small={small || undefined} role="img" aria-label="2027">
      <span className="cd-year-base" aria-hidden="true">202</span>
      <span className="cd-year-seven" aria-hidden="true">
        <span className="cd-seven-outline">7</span>
        <span className="cd-seven-fill"><span>7</span></span>
      </span>
    </span>
  );
}
