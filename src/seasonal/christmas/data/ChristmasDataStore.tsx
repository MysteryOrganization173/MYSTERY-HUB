import React, { useId } from 'react';
import './dataStore.css';
import type { SeasonStatus } from '../../../../shared/seasonal';
import { DATA_LINE, seasonCountdown } from '../copy';
import { dataStoreLook, type DataStoreLook } from '../../dataStoreSeason';
import { loadSeasonalSerif } from '../font';

/**
 * The Data page's seasonal appearance (Mystery Hub 3.6), one lazy chunk for guests and signed-in customers alike.
 * The page itself is unchanged: this chunk only brings an illustration, a line above the title and a stylesheet that
 * re-tones the page's own design tokens while `data-ds-season` is on the page root. Prices, conditions, notices and
 * errors are never touched. Artwork is original SVG drawn in code; every piece is decorative (aria-hidden).
 */

loadSeasonalSerif();

type Look = DataStoreLook;
const lookOf = dataStoreLook;
const uid = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, '');

const TONES: Record<Look, { body: [string, string]; edge: string; screen: string; ribbon: [string, string, string]; bow: [string, string, string]; glow: string; signal: string }> = {
  christmas: { body: ['#1c7f59', '#0a3626'], edge: '#062218', screen: '#04140e', ribbon: ['#b98326', '#ffeebe', '#a87420'], bow: ['#fff3c9', '#f0c766', '#9c6b1c'], glow: '#ffe3a0', signal: '#f7dc8f' },
  'christmas-day': { body: ['#1c7f59', '#0a3626'], edge: '#062218', screen: '#0a2018', ribbon: ['#b98326', '#ffeebe', '#a87420'], bow: ['#fff3c9', '#f0c766', '#9c6b1c'], glow: '#ffe9b0', signal: '#fff0c4' },
  'new-year': { body: ['#2b4682', '#0e1a36'], edge: '#08122a', screen: '#060b1d', ribbon: ['#9aa6bb', '#f4f7fb', '#8a95a8'], bow: ['#ffffff', '#e7d9b0', '#a8925a'], glow: '#e7d9b0', signal: '#f4f7fb' },
};

/** Four-point sparkle, the season's star. */
const Spark = ({ x, y, r, i, fill }: { x: number; y: number; r: number; i: number; fill: string }) => (
  <g transform={`translate(${x} ${y}) scale(${r / 10})`}>
    <path className="mh-dsx-spark" style={{ '--i': i } as React.CSSProperties} fill={fill} d="M0 -10 C 1 -3 3 -1 10 0 C 3 1 1 3 0 10 C -1 3 -3 1 -10 0 C -3 -1 -1 -3 0 -10 Z" />
  </g>
);

/**
 * A phone wrapped as a present: satin ribbon, a bow, a tag, and the signal glowing on its screen. Connection as the
 * gift. Christmas: evergreen velvet with gold satin and two hanging baubles. Christmas Day: a warm light opens behind
 * it. From 27 December: midnight velvet, silver satin, a crescent and two small bursts.
 */
function WrappedPhone({ look, tag }: { look: Look; tag: string }) {
  const id = uid(useId());
  const t = TONES[look];
  const newYear = look === 'new-year';
  return (
    <svg viewBox="0 0 240 206" className="mh-dsx-phone" data-look={look} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={t.body[0]} /><stop offset="1" stopColor={t.body[1]} /></linearGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={t.ribbon[0]} /><stop offset=".45" stopColor={t.ribbon[1]} /><stop offset="1" stopColor={t.ribbon[2]} /></linearGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={t.ribbon[0]} /><stop offset=".5" stopColor={t.ribbon[1]} /><stop offset="1" stopColor={t.ribbon[2]} /></linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={t.bow[0]} /><stop offset=".45" stopColor={t.bow[1]} /><stop offset="1" stopColor={t.bow[2]} /></linearGradient>
        <radialGradient id={`${id}p`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor={t.glow} stopOpacity=".42" /><stop offset="1" stopColor={t.glow} stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}s`} cx="50%" cy="62%" r="60%"><stop offset="0" stopColor={t.signal} stopOpacity=".28" /><stop offset="1" stopColor={t.signal} stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}y`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ffe9b0" stopOpacity=".7" /><stop offset="1" stopColor="#ffe9b0" stopOpacity="0" /></linearGradient>
        <clipPath id={`${id}c`}><rect x="92" y="52" width="76" height="134" rx="15" /></clipPath>
      </defs>

      {/* Light: a halo behind, a pool to stand on. Christmas Day opens a warm beam. */}
      <circle className="mh-dsx-halo" cx="130" cy="112" r="88" fill={`url(#${id}p)`} />
      {look === 'christmas-day' && <path className="mh-dsx-beam" d="M100 118 L160 118 L212 0 L48 0 Z" fill={`url(#${id}y)`} />}
      <ellipse cx="130" cy="192" rx="74" ry="10" fill={`url(#${id}p)`} />
      <ellipse cx="130" cy="191" rx="46" ry="5" fill="#000" opacity=".5" />

      {/* Hanging decorations: baubles for Christmas, a crescent and bursts for New Year. */}
      {!newYear ? (
        <g className="mh-dsx-hang">
          <g className="mh-dsx-bauble" style={{ '--i': 0 } as React.CSSProperties}>
            <line x1="34" y1="0" x2="34" y2="42" stroke="#f3d79a" strokeOpacity=".55" strokeWidth="1" />
            <rect x="30" y="40" width="8" height="5" rx="1.2" fill="#c9a24e" />
            <circle cx="34" cy="56" r="12" fill="#b3263f" />
            <path d="M23 54 Q34 49 45 54" stroke="#f3d79a" strokeWidth="1.4" fill="none" opacity=".8" />
            <circle cx="30" cy="51" r="3.2" fill="#fff" opacity=".45" />
          </g>
          <g className="mh-dsx-bauble" style={{ '--i': 1 } as React.CSSProperties}>
            <line x1="212" y1="0" x2="212" y2="22" stroke="#f3d79a" strokeOpacity=".55" strokeWidth="1" />
            <rect x="208.5" y="20" width="7" height="4.5" rx="1" fill="#c9a24e" />
            <circle cx="212" cy="34" r="10" fill="#e9b949" />
            <circle cx="208.5" cy="30" r="2.6" fill="#fff" opacity=".55" />
          </g>
        </g>
      ) : (
        <g className="mh-dsx-hang">
          <path d="M42 22 a16 16 0 1 0 14 26 a12 12 0 1 1 -14 -26 Z" fill="#e7d9b0" opacity=".9" />
          <g className="mh-dsx-burst" stroke="#f3d79a" strokeWidth="1.5" strokeLinecap="round">
            {[[206, 30, 12], [24, 104, 8]].map(([x, y, r], i) => (
              <g key={i} transform={`translate(${x} ${y})`}>{[0, 45, 90, 135, 180, 225, 270, 315].map(a => <line key={a} x1="0" y1={-r * .35} x2="0" y2={-r} transform={`rotate(${a})`} />)}</g>
            ))}
          </g>
        </g>
      )}

      <g className="mh-dsx-gift">
        {/* The phone: velvet body, its thickness, a dark screen with the signal lit on it. */}
        <rect x="97" y="56" width="76" height="134" rx="15" fill={t.edge} />
        <rect x="92" y="52" width="76" height="134" rx="15" fill={`url(#${id}b)`} />
        <rect x="100" y="64" width="60" height="108" rx="9" fill={t.screen} />
        <rect x="100" y="64" width="60" height="108" rx="9" fill={`url(#${id}s)`} />
        <rect x="120" y="58" width="20" height="3" rx="1.5" fill="#000" opacity=".35" />
        <g className="mh-dsx-signal" fill="none" stroke={t.signal} strokeLinecap="round">
          <path d="M116 132 a 20 20 0 0 1 28 0" strokeWidth="3.2" style={{ '--i': 2 } as React.CSSProperties} />
          <path d="M109 124 a 30 30 0 0 1 42 0" strokeWidth="3.2" style={{ '--i': 1 } as React.CSSProperties} />
          <path d="M102 116 a 40 40 0 0 1 56 0" strokeWidth="3.2" style={{ '--i': 0 } as React.CSSProperties} />
        </g>
        <circle cx="130" cy="141" r="4.4" fill={t.signal} />
        {/* Satin ribbon, around the phone both ways. */}
        <g clipPath={`url(#${id}c)`}>
          <rect x="146" y="52" width="11" height="134" fill={`url(#${id}r)`} opacity=".96" />
          <rect x="92" y="150" width="76" height="11" fill={`url(#${id}h)`} opacity=".96" />
          <rect className="mh-dsx-sheen" x="60" y="52" width="16" height="134" fill="#fff" opacity=".16" transform="skewX(-14)" />
        </g>
        {/* The bow on top, where the ribbons cross. */}
        <g transform="translate(21.5 0)">
        <path d="M130 50 C 112 30 94 34 98 46 C 101 54 116 54 130 50 Z" fill={`url(#${id}g)`} />
        <path d="M130 50 C 148 30 166 34 162 46 C 159 54 144 54 130 50 Z" fill={`url(#${id}g)`} />
        <path d="M121 47 C 117 37 110 36 107 41" fill="none" stroke="#000" strokeOpacity=".18" strokeWidth="1.2" />
        <path d="M139 47 C 143 37 150 36 153 41" fill="none" stroke="#000" strokeOpacity=".18" strokeWidth="1.2" />
        <path d="M127 52 C 122 61 118 66 112 72 L 118 72 L 120 77 C 125 68 128 61 130 53 Z M133 52 C 138 61 142 66 148 72 L 142 72 L 140 77 C 135 68 132 61 130 53 Z" fill={`url(#${id}g)`} />
        <ellipse cx="130" cy="51" rx="6" ry="5" fill={t.bow[1]} stroke={t.bow[2]} strokeWidth=".8" />
        </g>
        {/* The tag, tied to the ribbon. */}
        <g transform="translate(166 150) rotate(-10)">
          <path d="M-36 0 C -26 -2 -14 -1 -4 2" fill="none" stroke={t.ribbon[2]} strokeWidth="1" />
          <path d="M0 -9 H46 a4 4 0 0 1 4 4 V9 a4 4 0 0 1 -4 4 H0 L-8 2 Z" fill="#fff4dc" />
          <circle cx="-2" cy="2" r="1.8" fill="#c9ad7d" />
          <text x="22" y="6.5" textAnchor="middle" className="mh-dsx-tag">{tag}</text>
        </g>
      </g>

      <g className="mh-dsx-sparks">
        {[[70, 74, 5], [196, 78, 4], [62, 150, 3.4], [210, 146, 3.6], [154, 22, 3.2]].map(([x, y, r], i) => <Spark key={i} x={x} y={y} r={r} i={i} fill={newYear ? '#f4f7fb' : '#f7dc8f'} />)}
      </g>
    </svg>
  );
}

/** Lights strung across the top of the page's title panel: gold, berry and pine; gold and silver from 27 December. */
function Strand({ newYear }: { newYear: boolean }) {
  const bulbs = Array.from({ length: 15 }, (_, i) => ({ i, x: 10 + i * 41.4, y: 9 + Math.sin((i / 14) * Math.PI) * 14 }));
  const tone = (i: number) => newYear ? (i % 2 ? '#e9eef7' : '#f7d27a') : ['#f7d27a', '#e2566d', '#7fe3ad'][i % 3];
  return (
    <svg viewBox="0 0 600 40" preserveAspectRatio="none" className="mh-dsx-strand" aria-hidden="true" focusable="false">
      <path d="M0 6 Q 300 40 600 6" fill="none" stroke="#f3d79a" strokeOpacity=".3" strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
      {bulbs.map(b => (
        <g key={b.i} className="mh-dsx-bulb" style={{ '--i': b.i, color: tone(b.i) } as React.CSSProperties}>
          <ellipse cx={b.x} cy={b.y + 4} rx="3" ry="4.2" fill="currentColor" />
          <ellipse cx={b.x} cy={b.y + 4} rx="8.5" ry="8.5" fill="currentColor" opacity=".16" />
        </g>
      ))}
    </svg>
  );
}

/** Replays the illustration's one-shot reaction (the phone hops, the sparks flare, the baubles swing). */
const press = (e: React.PointerEvent<HTMLElement>) => {
  const el = e.currentTarget; el.removeAttribute('data-press'); void el.offsetWidth; el.setAttribute('data-press', '');
};
const pressEnd = (e: React.AnimationEvent<HTMLElement>) => { if (e.animationName === 'mh-dsx-hop') e.currentTarget.removeAttribute('data-press'); };

export default function ChristmasDataStore({ part, status }: { part: 'art' | 'line'; status: SeasonStatus }) {
  const look = lookOf(status);
  if (part === 'line') {
    return (
      <p className="mh-dsx-line" data-look={look}>
        <svg viewBox="-10 -10 20 20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M0 -10 C 1 -3 3 -1 10 0 C 3 1 1 3 0 10 C -1 3 -3 1 -10 0 C -3 -1 -1 -3 0 -10 Z" /></svg>
        <em>{DATA_LINE[status.phase]}</em>
      </p>
    );
  }
  const count = seasonCountdown(status);
  return (
    <div className="mh-dsx-art" data-look={look} onPointerDown={press} onAnimationEnd={pressEnd}>
      <Strand newYear={look === 'new-year'} />
      <WrappedPhone look={look} tag={look === 'new-year' ? '2027' : 'For you'} />
      <p className="mh-dsx-count" aria-hidden="true"><em>{count.big}</em><span>{count.small}</span></p>
    </div>
  );
}
