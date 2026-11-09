import React, { useCallback, useRef } from 'react';
import type { SeasonPhase } from '../../../../shared/seasonal';
import { useFitSvgText } from '../kit/motion';

/**
 * "The Gift of Connection": the Christmas homepage hero scene. An evergreen velvet gift with a champagne satin
 * ribbon opens a little and lets light out; Mystery Hub's everyday services rise from it as glass tiles; fairy
 * lights arc across a warm evening sky; a paper tag carries the real calendar day count.
 *
 * One SVG, drawn for this page (no images). Every part is its own group so it can settle in on arrival, react to a
 * tap and change with the calendar: the lid is ajar through December, lifted on Christmas Day and set aside on
 * Boxing Day; from 27 December the lights turn champagne and silver, and fireworks bloom for New Year.
 *
 * Two compositions, not one scaled image: `wide` (tablets and desktop) and `compact` (phones), where the gift sits
 * lower and smaller and the services and lights gather closer around it, so the scene supports the greeting and
 * actions instead of pushing them down. Decorative (aria-hidden): the day count is repeated as real text beside it.
 */

export type SceneLayout = 'wide' | 'compact';
type TokenId = 'data' | 'airtime' | 'web' | 'shop';
interface Composition {
  viewBox: string;
  swag: { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number };
  bulbs: number;
  tokens: { id: TokenId; x: number; y: number; r: number; size: number; from: [number, number] }[];
  streams: string[];
  /** Places the ground (floor, gifts, tag, light beam) within the composition. */
  ground?: string;
  halo: [number, number, number];
  glows: { pine: [number, number, number]; berry: [number, number, number] };
  twinkles: [number, number, number][];
  fireworks: [number, number, number][];
}

const COMPOSITIONS: Record<SceneLayout, Composition> = {
  wide: {
    viewBox: '0 0 640 560',
    swag: { x0: 8, y0: 64, cx: 330, cy: 210, x1: 636, y1: 30 },
    bulbs: 17,
    tokens: [
      { id: 'data', x: 148, y: 164, r: -8, size: 64, from: [198, 92] },
      { id: 'airtime', x: 236, y: 92, r: 6, size: 56, from: [110, 160] },
      { id: 'web', x: 452, y: 98, r: -5, size: 62, from: [-106, 152] },
      { id: 'shop', x: 540, y: 186, r: 8, size: 56, from: [-194, 66] },
    ],
    streams: ['M330 250 C 300 210 220 220 148 196', 'M340 246 C 320 180 270 150 236 124', 'M356 246 C 380 180 420 150 452 132', 'M366 250 C 420 220 480 230 540 214'],
    halo: [350, 250, 250],
    glows: { pine: [90, 150, 170], berry: [590, 470, 150] },
    twinkles: [[96, 250, 9], [596, 112, 11], [404, 40, 7], [262, 186, 6], [604, 300, 7], [52, 352, 6]],
    fireworks: [[150, 96, 40], [522, 64, 32], [404, 168, 22]],
  },
  compact: {
    viewBox: '0 56 640 354',
    swag: { x0: 8, y0: 82, cx: 330, cy: 150, x1: 636, y1: 66 },
    bulbs: 15,
    tokens: [
      { id: 'data', x: 120, y: 218, r: -8, size: 58, from: [200, 10] },
      { id: 'airtime', x: 196, y: 152, r: 6, size: 52, from: [130, 75] },
      { id: 'web', x: 466, y: 154, r: -5, size: 56, from: [-130, 75] },
      { id: 'shop', x: 548, y: 216, r: 8, size: 52, from: [-210, 15] },
    ],
    streams: ['M326 214 C 290 196 210 204 150 220', 'M330 206 C 310 176 250 158 222 156', 'M338 206 C 360 176 420 158 440 158', 'M342 214 C 400 196 480 198 522 216'],
    ground: 'translate(60 14) scale(.78)',
    halo: [334, 236, 210],
    glows: { pine: [70, 176, 150], berry: [592, 392, 130] },
    twinkles: [[58, 252, 8], [604, 120, 9], [412, 92, 6], [262, 116, 5], [610, 300, 6], [30, 330, 5]],
    fireworks: [[112, 124, 30], [560, 108, 26], [398, 98, 18]],
  },
};

const CHRISTMAS_TONES = ['#ffe9b3', '#f7d27a', '#ffe9b3', '#e2566d', '#ffe9b3', '#7fe3ad', '#f7d27a', '#ffe9b3'];
const NEW_YEAR_TONES = ['#fff1c9', '#f7d27a', '#e9eef7', '#f7d27a', '#fff1c9', '#dfe7f3'];
const NEW_YEAR_PHASES: SeasonPhase[] = ['year-end', 'new-years-eve', 'new-years-day', 'new-year'];
const FIREWORK_PHASES: SeasonPhase[] = ['new-years-eve', 'new-years-day', 'new-year'];

function TokenIcon({ id }: { id: TokenId }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (id) {
    case 'data': return <g {...common}><path d="M-13 -3 Q0 -15 13 -3" /><path d="M-8.5 2 Q0 -6 8.5 2" /><path d="M-4 7 Q0 4 4 7" /><circle cx="0" cy="11" r="1.6" fill="currentColor" stroke="none" /></g>;
    case 'airtime': return <g {...common}><rect x="-8" y="-13" width="16" height="26" rx="3.5" /><path d="M-2.5 -9.5 H2.5" /><path d="M14 -10 v6 M11 -7 h6" strokeWidth={2.2} /></g>;
    case 'web': return <g {...common}><circle r="12" /><ellipse rx="5.2" ry="12" /><path d="M-12 0 H12 M-10 -6 H10 M-10 6 H10" strokeWidth={1.8} /></g>;
    default: return <g {...common}><path d="M-11 -4 H11 L9 12 H-9 Z" /><path d="M-5 -4 V-7 A5 5 0 0 1 5 -7 V-4" /></g>;
  }
}

export function HeroScene({ phase, countBig, countSmall, layout = 'wide' }: { phase: SeasonPhase; countBig: string; countSmall: string; layout?: SceneLayout }) {
  const ref = useRef<SVGSVGElement>(null);
  const C = COMPOSITIONS[layout];
  // A tap on the gift lifts the lid for a moment and lets a few sparks out; it restarts if tapped again.
  const nudge = useCallback(() => {
    const el = ref.current; if (!el) return;
    el.removeAttribute('data-nudge'); void el.getBoundingClientRect(); el.setAttribute('data-nudge', '');
  }, []);
  const settle = (e: React.AnimationEvent) => { if (e.animationName === 'xh-lid-hop') ref.current?.removeAttribute('data-nudge'); };
  // The day count always stays inside its paper tag, whatever the words or font.
  useFitSvgText(ref, [countBig, countSmall, layout]);
  const newYear = NEW_YEAR_PHASES.includes(phase);
  const confetti = phase === 'christmas-day' || phase === 'new-years-day';
  const tones = newYear ? NEW_YEAR_TONES : CHRISTMAS_TONES;
  const { swag } = C;
  const swagPoint = (t: number) => ({
    x: (1 - t) ** 2 * swag.x0 + 2 * (1 - t) * t * swag.cx + t ** 2 * swag.x1,
    y: (1 - t) ** 2 * swag.y0 + 2 * (1 - t) * t * swag.cy + t ** 2 * swag.y1,
  });
  const bulbs = Array.from({ length: C.bulbs }, (_, i) => ({ ...swagPoint((i + 0.5) / C.bulbs), tone: tones[i % tones.length], twinkle: i % 4 === 1 }));

  return (
    <svg ref={ref} className="xh-scene" data-phase={phase} data-layout={layout} viewBox={C.viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" onAnimationEnd={settle}>
      <defs>
        <radialGradient id="xh-halo" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ffe3a0" stopOpacity=".55" /><stop offset=".45" stopColor="#e9b949" stopOpacity=".16" /><stop offset="1" stopColor="#e9b949" stopOpacity="0" /></radialGradient>
        <radialGradient id="xh-pine-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#1d7a55" stopOpacity=".5" /><stop offset="1" stopColor="#1d7a55" stopOpacity="0" /></radialGradient>
        <radialGradient id="xh-berry-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#b3263f" stopOpacity=".45" /><stop offset="1" stopColor="#b3263f" stopOpacity="0" /></radialGradient>
        <radialGradient id="xh-floor" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="#f2c46d" stopOpacity=".28" /><stop offset=".5" stopColor="#8a5e17" stopOpacity=".1" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <linearGradient id="xh-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#18734f" /><stop offset=".55" stopColor="#0f4f38" /><stop offset="1" stopColor="#0a3626" /></linearGradient>
        <linearGradient id="xh-front-sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity=".09" /><stop offset=".22" stopColor="#fff" stopOpacity="0" /><stop offset=".8" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".18" /></linearGradient>
        <linearGradient id="xh-side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d3d2c" /><stop offset="1" stopColor="#052117" /></linearGradient>
        <linearGradient id="xh-lid-top" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#1c7f59" /><stop offset="1" stopColor="#2a9a6d" /></linearGradient>
        <linearGradient id="xh-lid-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f8460" /><stop offset="1" stopColor="#11573e" /></linearGradient>
        <linearGradient id="xh-lid-side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#11573e" /><stop offset="1" stopColor="#0a3828" /></linearGradient>
        <linearGradient id="xh-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3c9" /><stop offset=".3" stopColor="#f3cd6d" /><stop offset=".68" stopColor="#c99230" /><stop offset="1" stopColor="#8f6118" /></linearGradient>
        <linearGradient id="xh-gold-band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#b98326" /><stop offset=".35" stopColor="#f6d683" /><stop offset=".55" stopColor="#ffeebe" /><stop offset=".75" stopColor="#e8bb57" /><stop offset="1" stopColor="#a87420" /></linearGradient>
        <linearGradient id="xh-gold-side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c99230" /><stop offset="1" stopColor="#7c5414" /></linearGradient>
        <linearGradient id="xh-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#fff2c7" stopOpacity=".95" /><stop offset=".35" stopColor="#ffe08c" stopOpacity=".38" /><stop offset="1" stopColor="#ffe08c" stopOpacity="0" /></linearGradient>
        <linearGradient id="xh-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity=".2" /><stop offset=".5" stopColor="#ffffff" stopOpacity=".07" /><stop offset="1" stopColor="#ffffff" stopOpacity=".03" /></linearGradient>
        <linearGradient id="xh-berry-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c5334c" /><stop offset="1" stopColor="#6f1430" /></linearGradient>
        <linearGradient id="xh-cream-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff7e8" /><stop offset="1" stopColor="#dcc69f" /></linearGradient>
        <linearGradient id="xh-tag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffaf0" /><stop offset="1" stopColor="#efe0c2" /></linearGradient>
        <radialGradient id="xh-bulb" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#fff6dc" stopOpacity=".9" /><stop offset=".35" stopColor="#f7d27a" stopOpacity=".35" /><stop offset="1" stopColor="#f7d27a" stopOpacity="0" /></radialGradient>
        <linearGradient id="xh-opening" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3c9" /><stop offset=".6" stopColor="#f3c86a" /><stop offset="1" stopColor="#b9802a" /></linearGradient>
        <linearGradient id="xh-stream" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#f7d27a" stopOpacity=".7" /><stop offset="1" stopColor="#7fe3ad" stopOpacity=".55" /></linearGradient>
        {/* The strand of lights fades out at both ends instead of stopping abruptly. */}
        <linearGradient id="xh-lights-fade" x1="0" y1="0" x2="640" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".14" stopColor="#fff" /><stop offset=".88" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <mask id="xh-lights-mask" maskUnits="userSpaceOnUse" x="-20" y="-20" width="680" height="600"><rect x="-20" y="-20" width="680" height="600" fill="url(#xh-lights-fade)" /></mask>
      </defs>

      {/* Evening atmosphere: a warm halo behind the gift, evergreen and berry light at the edges. */}
      <g className="xh-sc-sky">
        <circle cx={C.halo[0]} cy={C.halo[1]} r={C.halo[2]} fill="url(#xh-halo)" className="xh-sc-halo" />
        <circle cx={C.glows.pine[0]} cy={C.glows.pine[1]} r={C.glows.pine[2]} fill="url(#xh-pine-glow)" />
        <circle cx={C.glows.berry[0]} cy={C.glows.berry[1]} r={C.glows.berry[2]} fill="url(#xh-berry-glow)" />
      </g>

      {/* New Year: a few fireworks bloom once in the sky. */}
      {FIREWORK_PHASES.includes(phase) && (
        <g className="xh-sc-fireworks">
          {C.fireworks.map(([x, y, r], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <g className="xh-fw" style={{ animationDelay: `${0.6 + i * 0.45}s` } as React.CSSProperties}>
                {Array.from({ length: 12 }, (_, k) => {
                  const a = (k / 12) * Math.PI * 2;
                  return <line key={k} x1={Math.cos(a) * r * 0.38} y1={Math.sin(a) * r * 0.38} x2={Math.cos(a) * r} y2={Math.sin(a) * r} stroke={['#f7dc8f', '#e9eef7', '#7fe3ad'][(i + k) % 3]} strokeWidth="2" strokeLinecap="round" />;
                })}
                <circle r="2.4" fill="#fff4dc" />
              </g>
            </g>
          ))}
        </g>
      )}

      {/* One swag of fairy lights across the sky. */}
      <g className="xh-sc-lights" mask="url(#xh-lights-mask)">
        <path d={`M${swag.x0} ${swag.y0} Q${swag.cx} ${swag.cy} ${swag.x1} ${swag.y1}`} fill="none" stroke="#2f4a3b" strokeWidth="1.6" />
        {bulbs.map((b, i) => (
          <g key={i} className={`xh-sc-bulb${b.twinkle ? ' xh-sc-bulb-twinkle' : ''}`} style={{ animationDelay: `${0.25 + i * 0.045}s, ${2.5 + i * 0.55}s` } as React.CSSProperties}>
            <circle cx={b.x} cy={b.y + 7} r="13" fill="url(#xh-bulb)" />
            <circle cx={b.x} cy={b.y + 7} r="3.6" fill={b.tone} />
            <rect x={b.x - 1.8} y={b.y + 1} width="3.6" height="3.2" rx=".8" fill="#4b5a4f" />
          </g>
        ))}
      </g>

      {/* Light from inside the gift, strongest on Christmas Day. */}
      <g transform={C.ground}><polygon className="xh-sc-beam" points="236,262 456,262 586,8 106,8" fill="url(#xh-beam)" /></g>

      {/* Fine streams carry the services up from the gift. */}
      <g className="xh-sc-streams" fill="none" stroke="url(#xh-stream)" strokeWidth="1.4" strokeDasharray="2 6" strokeLinecap="round">
        {C.streams.map(d => <path key={d} d={d} />)}
      </g>

      <g transform={C.ground}>
        {/* Floor light and shadow. */}
        <ellipse cx="338" cy="476" rx="292" ry="44" fill="url(#xh-floor)" />
        <ellipse cx="346" cy="458" rx="170" ry="16" fill="#000" opacity=".45" />

        {/* A small berry gift, left. */}
        <g className="xh-sc-gift-l">
          <ellipse cx="166" cy="464" rx="64" ry="7" fill="#000" opacity=".4" />
          <polygon points="104,392 128,378 222,378 198,392" fill="#d4465e" />
          <rect x="104" y="392" width="94" height="72" rx="2" fill="url(#xh-berry-front)" />
          <polygon points="198,392 222,378 222,450 198,464" fill="#5a0f25" />
          <rect x="145" y="392" width="12" height="72" fill="#fbecd0" />
          <polygon points="145,392 157,392 181,378 169,378" fill="#fff6e6" />
          <polygon points="207,387 213,383 213,455 207,459" fill="#e8d6b6" />
          <path d="M163 385 C 146 368 132 372 136 382 C 139 389 152 389 163 385 Z M163 385 C 180 368 194 372 190 382 C 187 389 174 389 163 385 Z" fill="#fff4e0" stroke="#d9c39b" strokeWidth=".8" />
          <circle cx="163" cy="385" r="3.4" fill="#fbecd0" />
        </g>

        {/* The main gift. */}
        <g className="xh-sc-gift" onPointerDown={nudge}>
          <rect x="190" y="230" width="320" height="236" fill="transparent" />
          <g className="xh-sc-body">
            <rect x="210" y="300" width="220" height="152" fill="url(#xh-front)" />
            <rect x="210" y="300" width="220" height="152" fill="url(#xh-front-sheen)" />
            <polygon points="430,300 482,272 482,424 430,452" fill="url(#xh-side)" />
            {/* Ribbon: down the front, and the cross band down the side. */}
            <rect x="304" y="300" width="32" height="152" fill="url(#xh-gold-band)" />
            <polygon points="450,289 462,283 462,435 450,441" fill="url(#xh-gold-side)" />
            {/* The lit inside of the box, seen when the lid is lifted or set aside. */}
            <polygon className="xh-sc-open" points="210,300 262,272 482,272 430,300" fill="url(#xh-opening)" />
            {/* Light escaping from under the lid. */}
            <rect className="xh-sc-slit" x="212" y="296" width="216" height="8" rx="4" fill="#ffe8a6" />
            <path d="M210 452 H430 L482 424" fill="none" stroke="#000" strokeOpacity=".25" />
            <path d="M210 300.5 H430" stroke="#5fd1a0" strokeOpacity=".22" />
            {/* The day-count tag, tied to the box. */}
            <g className="xh-sc-tag">
              <path d="M436 300 C 452 318 462 328 474 336" fill="none" stroke="#e7d3a6" strokeWidth="1.4" />
              <g transform="translate(468 330) rotate(7)">
                <path d="M10 0 H150 a9 9 0 0 1 9 9 V62 a9 9 0 0 1 -9 9 H10 L-6 35.5 Z" fill="url(#xh-tag)" stroke="#caa970" strokeWidth="1" />
                <circle cx="6" cy="35.5" r="4" fill="#0a2a20" stroke="#caa970" strokeWidth="1" />
                <text className="xh-sc-tag-big" x="22" y="36" data-fit="128">{countBig}</text>
                <text className="xh-sc-tag-small" x="23" y="56" data-fit="126">{countSmall}</text>
              </g>
            </g>
          </g>
          <g className="xh-sc-lid">
            <g className="xh-sc-lid-hop">
              <polygon points="198,270 250,242 494,242 442,270" fill="url(#xh-lid-top)" />
              <rect x="198" y="270" width="244" height="34" fill="url(#xh-lid-front)" />
              <polygon points="442,270 494,242 494,276 442,304" fill="url(#xh-lid-side)" />
              <path d="M198 270 H442 L494 242" fill="none" stroke="#7fe3ad" strokeOpacity=".28" strokeWidth="1.2" />
              {/* Ribbon over the lid: front-to-back and side-to-side, crossing under the bow. */}
              <polygon points="304,270 336,270 388,242 356,242" fill="#f6d683" />
              <polygon points="218,259 462,259 474,253 230,253" fill="#f0c766" />
              <rect x="304" y="270" width="32" height="34" fill="url(#xh-gold-band)" />
              <polygon points="462,259 474,253 474,287 462,293" fill="url(#xh-gold-side)" />
              <g className="xh-sc-bow">
                <path d="M346 254 C 300 202 254 214 264 246 C 271 268 316 266 346 254 Z" fill="url(#xh-gold)" />
                <path d="M346 254 C 392 202 438 214 428 246 C 421 268 376 266 346 254 Z" fill="url(#xh-gold)" />
                <path d="M346 254 C 318 226 288 224 286 240 C 300 246 324 250 346 254 Z" fill="#9c6b1c" opacity=".55" />
                <path d="M346 254 C 374 226 404 224 406 240 C 392 246 368 250 346 254 Z" fill="#9c6b1c" opacity=".55" />
                <path d="M338 260 C 326 292 312 306 292 326 L 310 328 L 316 344 C 334 314 344 290 350 262 Z" fill="url(#xh-gold)" />
                <path d="M354 260 C 364 292 378 306 398 324 L 380 327 L 375 343 C 358 314 348 290 344 262 Z" fill="url(#xh-gold)" />
                <ellipse cx="346" cy="256" rx="14" ry="11" fill="#f6d683" stroke="#a8771d" strokeWidth="1" />
                <path d="M276 232 C 290 222 306 222 318 230" fill="none" stroke="#fff8dd" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" />
              </g>
            </g>
          </g>
          {/* Sparks that fly out when the gift is tapped. */}
          <g className="xh-sc-burst">
            {Array.from({ length: 9 }, (_, i) => {
              const a = -Math.PI + (i / 8) * Math.PI, d = 70 + (i % 3) * 22;
              return <circle key={i} cx="346" cy="250" r={i % 2 ? 3 : 4.4} fill={i % 3 === 0 ? '#7fe3ad' : '#f7d27a'} style={{ '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d - 20}px` } as React.CSSProperties} />;
            })}
          </g>
        </g>

        {/* A small cream gift, right, in front (set clear of the day-count tag). */}
        <g transform="translate(40 12)"><g className="xh-sc-gift-r">
          <ellipse cx="514" cy="474" rx="58" ry="7" fill="#000" opacity=".4" />
          <polygon points="470,414 490,402 562,402 542,414" fill="#ffffff" />
          <rect x="470" y="414" width="72" height="58" rx="2" fill="url(#xh-cream-front)" />
          <polygon points="542,414 562,402 562,460 542,472" fill="#c9b089" />
          <rect x="500" y="414" width="11" height="58" fill="#b3263f" />
          <polygon points="500,414 511,414 531,402 520,402" fill="#c93a53" />
          <polygon points="550,409 555,406 555,463 550,466" fill="#8c1b33" />
          <path d="M516 408 C 500 392 488 396 492 405 C 495 412 507 412 516 408 Z M516 408 C 532 392 544 396 540 405 C 537 412 525 412 516 408 Z" fill="#c22d47" />
          <circle cx="516" cy="408" r="3.2" fill="#e2566d" />
        </g></g>
      </g>

      {/* The services rising from the gift. */}
      <g className="xh-sc-tokens">
        {C.tokens.map((t, i) => (
          <g key={t.id} transform={`translate(${t.x} ${t.y}) rotate(${t.r})`}>
            <g className={`xh-token xh-token-${t.id}`} style={{ '--fx': `${t.from[0]}px`, '--fy': `${t.from[1]}px`, animationDelay: `${0.75 + i * 0.12}s, ${2 + i * 0.9}s` } as React.CSSProperties}>
              <rect x={-t.size / 2} y={-t.size / 2} width={t.size} height={t.size} rx="16" fill="#0b2219" fillOpacity=".72" />
              <rect x={-t.size / 2} y={-t.size / 2} width={t.size} height={t.size} rx="16" fill="url(#xh-glass)" stroke="#f3d79a" strokeOpacity=".5" strokeWidth="1.2" />
              <path d={`M${-t.size / 2 + 12} ${-t.size / 2 + 1.5} H${t.size / 2 - 12}`} stroke="#fff" strokeOpacity=".35" strokeWidth="1.2" strokeLinecap="round" />
              <g className="xh-token-icon"><TokenIcon id={t.id} /></g>
            </g>
          </g>
        ))}
      </g>

      {/* Twinkles. */}
      <g className="xh-sc-twinkles" fill="#f7dc8f">
        {C.twinkles.map(([x, y, s], i) => (
          <path key={i} className="xh-sc-tw" style={{ animationDelay: `${1.2 + i * 0.35}s` } as React.CSSProperties} transform={`translate(${x} ${y}) scale(${s / 10})`} d="M0 -10 C 1 -3 3 -1 10 0 C 3 1 1 3 0 10 C -1 3 -3 1 -10 0 C -3 -1 -1 -3 0 -10 Z" />
        ))}
      </g>

      {/* Christmas Day and New Year's Day: confetti in the air, inside the scene and clear of the greeting. */}
      {confetti && (
        <g transform={C.ground}>
          <g className="xh-sc-confetti">
            {Array.from({ length: 22 }, (_, i) => {
              const x = 150 + ((i * 97) % 380), y = 96 + ((i * 53) % 190);
              return <rect key={i} x={x} y={y} width={i % 3 ? 5 : 7} height={i % 3 ? 10 : 7} rx={i % 3 ? 1.5 : 3.5} fill={(newYear ? ['#f7d27a', '#e9eef7', '#7fe3ad', '#fff4dc'] : ['#f7d27a', '#e2566d', '#7fe3ad', '#fff4dc'])[i % 4]} transform={`rotate(${(i * 37) % 180} ${x} ${y})`} style={{ animationDelay: `${0.9 + (i % 7) * 0.08}s` } as React.CSSProperties} />;
            })}
          </g>
        </g>
      )}
    </svg>
  );
}
