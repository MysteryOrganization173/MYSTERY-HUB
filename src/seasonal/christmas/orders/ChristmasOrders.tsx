import React, { useId } from 'react';
import './orders.css';
import type { SeasonStatus } from '../../../../shared/seasonal';
import { CONFIRMED_LINE, ORDERS_LINE, isChristmasTime } from '../copy';
import { ordersLook, type OrdersLook } from '../../ordersSeason';
import { loadSeasonalSerif } from '../font';

/**
 * Orders and the receipt for Christmas and New Year (Mystery Hub 3.6.2): one lazy chunk for guests and signed-in
 * customers alike. It brings original artwork drawn in code, a line above the Orders title and a stylesheet that
 * re-tones the page's and the receipt's own tokens while `data-or-season` is present. It never states, changes or
 * hides a status: the receipt decides when a flourish may show (only while an order is going well) and when the one
 * celebration may play (only for a supplier delivery the receipt saw happen). Every piece is decorative (aria-hidden).
 */

loadSeasonalSerif();

const uid = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, '');
const TONES: Record<OrdersLook, { ribbon: [string, string, string]; bow: [string, string, string]; glow: string; charm: string }> = {
  christmas: { ribbon: ['#b98326', '#ffeebe', '#a87420'], bow: ['#fff3c9', '#f0c766', '#9c6b1c'], glow: '#ffe3a0', charm: '#b3263f' },
  'christmas-day': { ribbon: ['#b98326', '#ffeebe', '#a87420'], bow: ['#fff3c9', '#f0c766', '#9c6b1c'], glow: '#ffe9b0', charm: '#c42d47' },
  'new-year': { ribbon: ['#8a95a8', '#f4f7fb', '#9aa6bb'], bow: ['#ffffff', '#e7d9b0', '#a8925a'], glow: '#e7d9b0', charm: '#6b3f8f' },
};

/** Four-point sparkle. */
const Spark = ({ x, y, r, i, fill }: { x: number; y: number; r: number; i: number; fill: string }) => (
  <g transform={`translate(${x} ${y}) scale(${r / 10})`}>
    <path className="mh-orx-spark" style={{ '--i': i } as React.CSSProperties} fill={fill} d="M0 -10 C 1 -3 3 -1 10 0 C 3 1 1 3 0 10 C -1 3 -3 1 -10 0 C -3 -1 -1 -3 0 -10 Z" />
  </g>
);

/** The ordinary receipt, tied with satin ribbon and a bow: the record of a gift of connection. */
function WrappedReceipt({ look }: { look: OrdersLook }) {
  const id = uid(useId());
  const t = TONES[look];
  const newYear = look === 'new-year';
  return (
    <svg viewBox="0 0 120 100" className="mh-orx-art-svg" data-look={look} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={newYear ? '#1c2547' : '#173527'} /><stop offset="1" stopColor={newYear ? '#10162e' : '#0e2119'} /></linearGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={t.ribbon[0]} /><stop offset=".45" stopColor={t.ribbon[1]} /><stop offset="1" stopColor={t.ribbon[2]} /></linearGradient>
        <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={t.ribbon[0]} /><stop offset=".5" stopColor={t.ribbon[1]} /><stop offset="1" stopColor={t.ribbon[2]} /></linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={t.bow[0]} /><stop offset=".45" stopColor={t.bow[1]} /><stop offset="1" stopColor={t.bow[2]} /></linearGradient>
        <radialGradient id={`${id}g`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor={t.glow} stopOpacity=".38" /><stop offset="1" stopColor={t.glow} stopOpacity="0" /></radialGradient>
        <clipPath id={`${id}c`}><path d="M30 8 h52 a6 6 0 0 1 6 6 V84 l-5 -4 -5 4 -5 -4 -5 4 -5 -4 -5 4 -5 -4 -5 4 -5 -4 -5 4 -5 -4 -4 4 V14 a6 6 0 0 1 6 -6 z" /></clipPath>
      </defs>
      <circle className="mh-orx-halo" cx="60" cy="50" r="46" fill={`url(#${id}g)`} />
      <ellipse cx="60" cy="94" rx="38" ry="4.5" fill="#000" opacity=".4" />
      <g className="mh-orx-slip" transform="rotate(-5 60 50)">
        <path d="M30 8 h52 a6 6 0 0 1 6 6 V84 l-5 -4 -5 4 -5 -4 -5 4 -5 -4 -5 4 -5 -4 -5 4 -5 -4 -5 4 -5 -4 -4 4 V14 a6 6 0 0 1 6 -6 z" fill={`url(#${id}p)`} stroke={newYear ? '#e7d9b055' : '#e9b94955'} strokeWidth="1.2" />
        <g opacity=".7">
          <rect x="38" y="20" width="14" height="3" rx="1.5" fill="#f3f6f8" />
          <rect x="38" y="44" width="16" height="2.6" rx="1.3" fill="#c5cfd9" />
          <rect x="38" y="51" width="12" height="2.6" rx="1.3" fill="#c5cfd9" />
          <rect x="64" y="65" width="16" height="5" rx="2" fill="#f3f6f8" />
        </g>
        {/* Satin ribbon around the slip. */}
        <g clipPath={`url(#${id}c)`}>
          <rect x="58" y="0" width="9" height="100" fill={`url(#${id}v)`} />
          <rect x="20" y="31" width="80" height="8" fill={`url(#${id}r)`} />
        </g>
      </g>
      {/* The bow, tied where the ribbons cross. */}
      <g className="mh-orx-bow" transform="translate(60 33)">
        <path d="M0 0 C -6 -12 -21 -12 -19 -3 C -18 3 -7 3 0 0 Z" fill={`url(#${id}b)`} />
        <path d="M0 0 C 6 -12 21 -12 19 -3 C 18 3 7 3 0 0 Z" fill={`url(#${id}b)`} />
        <path d="M0 0 L -8 15 L -3 12 L -1 17 Z M0 0 L 8 15 L 3 12 L 1 17 Z" fill={t.ribbon[2]} />
        <circle r="3.6" fill={t.bow[1]} stroke={t.bow[2]} strokeWidth=".8" />
      </g>
      {!newYear ? (
        <g className="mh-orx-charm">
          <line x1="96" y1="2" x2="96" y2="22" stroke="#f3d79a" strokeOpacity=".6" strokeWidth="1" />
          <rect x="93" y="20.5" width="6" height="3.6" rx="1" fill="#c9a24e" />
          <circle cx="96" cy="31" r="7.5" fill={t.charm} />
          <circle cx="93.6" cy="28.4" r="2" fill="#fff" opacity=".45" />
        </g>
      ) : (
        <g className="mh-orx-charm">
          <path d="M100 10 a10 10 0 1 0 8 14 a8 8 0 1 1 -8 -14 z" fill="#efe4c4" opacity=".9" />
        </g>
      )}
      <Spark x={22} y={22} r={5} i={0} fill={t.glow} />
      <Spark x={104} y={58} r={4} i={1} fill={t.glow} />
      {look === 'christmas-day' && <Spark x={16} y={64} r={3.5} i={2} fill={t.glow} />}
      {newYear && <Spark x={14} y={62} r={3.5} i={2} fill="#f4f7fb" />}
    </svg>
  );
}

/** A small ornament rule for a receipt that is going well: a line, a holly sprig or a star, a line. */
function Flourish({ look }: { look: OrdersLook }) {
  return (
    <div className="mh-orx-flourish" aria-hidden="true">
      <svg viewBox="0 0 40 16" width="40" height="16" focusable="false">
        {look === 'new-year'
          ? <path d="M20 1 C 21 6 23 7 28 8 C 23 9 21 10 20 15 C 19 10 17 9 12 8 C 17 7 19 6 20 1 Z" fill="#e7d9b0" />
          : <g><path d="M20 8 C 14 2 7 4 6 8 C 9 7 11 10 13 9 C 14 11 17 11 20 8 Z" fill="#1f7a52" /><path d="M20 8 C 26 2 33 4 34 8 C 31 7 29 10 27 9 C 26 11 23 11 20 8 Z" fill="#1f7a52" /><circle cx="18" cy="9" r="2.4" fill="#c42d47" /><circle cx="22" cy="9.4" r="2.4" fill="#b3263f" /><circle cx="20" cy="6.4" r="2.2" fill="#d23548" /></g>}
      </svg>
    </div>
  );
}

/** One finite celebration beside a delivery the receipt saw happen: sparks once, and one line. */
function Celebrate({ status, look }: { status: SeasonStatus; look: OrdersLook }) {
  return (
    <div className="mh-orx-celebrate" aria-hidden="true">
      <svg viewBox="0 0 120 40" width="120" height="40" focusable="false">
        {[[14, 22, 5], [34, 9, 4], [60, 5, 6], [86, 10, 4], [106, 22, 5], [24, 34, 3], [96, 34, 3]].map(([x, y, r], i) => (
          <Spark key={i} x={x} y={y} r={r} i={i} fill={look === 'new-year' ? (i % 2 ? '#f4f7fb' : '#e7d9b0') : i % 3 === 0 ? '#ff6b81' : '#f3d79a'} />
        ))}
      </svg>
      <span className="mh-orx-celebrate-line">{isChristmasTime(status) ? CONFIRMED_LINE.christmas : CONFIRMED_LINE.newYear}</span>
    </div>
  );
}

export default function ChristmasOrders({ part, status }: { part: 'art' | 'line' | 'flourish' | 'celebrate'; status: SeasonStatus }) {
  const look = ordersLook(status);
  switch (part) {
    case 'art': return <span className="mh-or-art mh-orx-art" aria-hidden="true"><WrappedReceipt look={look} /></span>;
    case 'line': return <p className="mh-orx-line"><svg viewBox="-10 -10 20 20" width="12" height="12" aria-hidden="true" focusable="false"><path fill="currentColor" d="M0 -10 C 1 -3 3 -1 10 0 C 3 1 1 3 0 10 C -1 3 -3 1 -10 0 C -3 -1 -1 -3 0 -10 Z" /></svg>{ORDERS_LINE[status.phase]}</p>;
    case 'flourish': return <Flourish look={look} />;
    case 'celebrate': return <Celebrate status={status} look={look} />;
  }
}
