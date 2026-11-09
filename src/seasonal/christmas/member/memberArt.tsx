import React, { useId } from 'react';
import type { MemberWebsiteSummary } from '../../../components/home/MemberHomeView';

/**
 * Illustrations for the signed-in Christmas homepage, lit like the guest homepage (evergreen velvet, champagne satin,
 * cream paper) but drawn for a personal dashboard. All decorative (aria-hidden); the words they sit beside carry the
 * meaning. Ids come from useId so two copies on one page never share a gradient.
 */

const uid = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, '');

export type GiftLook = 'christmas' | 'christmas-day' | 'new-year';

const GIFT_TONES: Record<GiftLook, { top: string; bottom: string; side1: string; side2: string; lid1: string; lid2: string; rim: string; lidSide: string; band: [string, string, string]; bow: [string, string, string] }> = {
  christmas: { top: '#18734f', bottom: '#0a3626', side1: '#0d3d2c', side2: '#052117', lid1: '#1c7f59', lid2: '#2a9a6d', rim: '#1f8460', lidSide: '#11573e', band: ['#b98326', '#ffeebe', '#a87420'], bow: ['#fff3c9', '#f0c766', '#9c6b1c'] },
  'christmas-day': { top: '#18734f', bottom: '#0a3626', side1: '#0d3d2c', side2: '#052117', lid1: '#1c7f59', lid2: '#2a9a6d', rim: '#1f8460', lidSide: '#11573e', band: ['#b98326', '#ffeebe', '#a87420'], bow: ['#fff3c9', '#f0c766', '#9c6b1c'] },
  'new-year': { top: '#22386a', bottom: '#0e1a36', side1: '#14254a', side2: '#08122a', lid1: '#2b4682', lid2: '#3a5aa0', rim: '#2a447c', lidSide: '#172b55', band: ['#9aa6bb', '#f4f7fb', '#8a95a8'], bow: ['#ffffff', '#e7d9b0', '#a8925a'] },
};

/**
 * The welcome gift. Christmas: evergreen velvet and gold satin. Christmas Day: the lid already lifted and light inside.
 * New Year: midnight velvet, silver satin and two small bursts. A press lifts the lid and lets the sparks out.
 */
export function MemberGift({ look = 'christmas' }: { look?: GiftLook }) {
  const id = uid(useId());
  const t = GIFT_TONES[look];
  const open = look === 'christmas-day';
  return (
    <svg viewBox="0 0 140 128" className="xm-gift-art" data-look={look} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={t.top} /><stop offset="1" stopColor={t.bottom} /></linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={t.side1} /><stop offset="1" stopColor={t.side2} /></linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor={t.lid1} /><stop offset="1" stopColor={t.lid2} /></linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={t.band[0]} /><stop offset=".45" stopColor={t.band[1]} /><stop offset="1" stopColor={t.band[2]} /></linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={t.bow[0]} /><stop offset=".45" stopColor={t.bow[1]} /><stop offset="1" stopColor={t.bow[2]} /></linearGradient>
        <radialGradient id={`${id}h`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ffe3a0" stopOpacity=".5" /><stop offset="1" stopColor="#e9b949" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}p`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#f3d79a" stopOpacity=".35" /><stop offset="1" stopColor="#f3d79a" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}r`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ffe9b0" stopOpacity=".75" /><stop offset="1" stopColor="#ffe9b0" stopOpacity="0" /></linearGradient>
      </defs>
      {/* Light pool and shadow: the gift stands on something. */}
      <ellipse cx="66" cy="114" rx="58" ry="11" fill={`url(#${id}p)`} />
      <circle cx="68" cy="62" r="60" fill={`url(#${id}h)`} className="xm-gift-halo" />
      <ellipse cx="66" cy="114" rx="40" ry="5" fill="#000" opacity=".5" />
      {/* Light rising from inside, visible when the lid is up (Christmas Day, and during a press). */}
      <path className="xm-gift-beam" d="M38 62 L94 62 L118 2 L16 2 Z" fill={`url(#${id}r)`} />
      <g className="xm-gift-body">
        <rect x="28" y="62" width="66" height="50" fill={`url(#${id}f)`} />
        <polygon points="94,62 110,53 110,103 94,112" fill={`url(#${id}s)`} />
        <rect x="56" y="62" width="11" height="50" fill={`url(#${id}b)`} />
        <polygon points="100,59 104,57 104,107 100,109" fill={t.band[0]} />
        <rect x="29" y="61" width="64" height="3" rx="1.5" fill={t.band[1]} opacity=".8" />
        <path d="M30 70 h18" stroke="#fff" strokeOpacity=".12" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* The open-lid offset lives on this wrapper, so the press animation (on the inner group) never moves it. */}
      <g transform={open ? 'translate(-4 -14) rotate(-9 30 52)' : undefined}>
      <g className="xm-gift-lid">
        <polygon points="24,51 40,42 116,42 100,51" fill={`url(#${id}l)`} />
        <rect x="24" y="51" width="76" height="12" fill={t.rim} />
        <polygon points="100,51 116,42 116,54 100,63" fill={t.lidSide} />
        <polygon points="56,51 67,51 83,42 72,42" fill={t.band[1]} opacity=".9" />
        <rect x="56" y="51" width="11" height="12" fill={`url(#${id}b)`} />
        <path d="M68 46 C 52 28 36 32 40 42 C 42 49 56 49 68 46 Z" fill={`url(#${id}g)`} />
        <path d="M68 46 C 84 28 100 32 96 42 C 94 49 80 49 68 46 Z" fill={`url(#${id}g)`} />
        <path d="M60 44 C 56 34 50 33 47 38" fill="none" stroke="#000" strokeOpacity=".18" strokeWidth="1.2" />
        <path d="M76 44 C 80 34 86 33 89 38" fill="none" stroke="#000" strokeOpacity=".18" strokeWidth="1.2" />
        <path d="M65 48 C 60 57 56 62 50 68 L 56 68 L 58 73 C 63 64 66 57 68 49 Z M71 48 C 76 57 80 62 86 68 L 80 68 L 78 73 C 73 64 70 57 68 49 Z" fill={`url(#${id}g)`} />
        <ellipse cx="68" cy="47" rx="5.5" ry="4.5" fill={t.bow[1]} stroke={t.bow[2]} strokeWidth=".8" />
      </g>
      </g>
      {look === 'new-year' && (
        <g className="xm-gift-bursts" stroke="#f3d79a" strokeWidth="1.6" strokeLinecap="round">
          {[[18, 24, 9], [122, 16, 7]].map(([x, y, r], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>{[0, 45, 90, 135, 180, 225, 270, 315].map(a => <line key={a} x1="0" y1={-r * .35} x2="0" y2={-r} transform={`rotate(${a})`} />)}</g>
          ))}
        </g>
      )}
      <g className="xm-gift-sparks" fill={look === 'new-year' ? '#f4f7fb' : '#f7dc8f'}>
        {[[34, 26, 4], [104, 22, 3.6], [70, 10, 3.2], [14, 56, 2.6], [128, 48, 2.6]].map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${r / 10})`}>
            <path className="xm-spark" style={{ '--i': i } as React.CSSProperties} d="M0 -10 C 1 -3 3 -1 10 0 C 3 1 1 3 0 10 C -1 3 -3 1 -10 0 C -3 -1 -1 -3 0 -10 Z" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** A strand of lights across the top of the welcome. Gold, berry and green; gold and silver from 27 December. */
export function MemberLights({ newYear = false }: { newYear?: boolean }) {
  const bulbs = Array.from({ length: 13 }, (_, i) => {
    const x = 12 + i * 48, y = 14 + Math.sin((i / 12) * Math.PI) * 18;
    return { x, y, i };
  });
  const tone = (i: number) => newYear ? (i % 2 ? '#e9eef7' : '#f7d27a') : ['#f7d27a', '#e2566d', '#7fe3ad'][i % 3];
  return (
    <svg viewBox="0 0 600 46" className="xm-lights" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 10 Q 300 46 600 10" fill="none" stroke="#f3d79a" strokeOpacity=".28" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      {bulbs.map(b => (
        <g key={b.i} className="xm-bulb" style={{ '--i': b.i, color: tone(b.i) } as React.CSSProperties}>
          <ellipse cx={b.x} cy={b.y + 4.5} rx="3.2" ry="4.4" fill="currentColor" />
          <ellipse cx={b.x} cy={b.y + 4.5} rx="9" ry="9" fill="currentColor" opacity=".16" />
        </g>
      ))}
    </svg>
  );
}

/**
 * The account's own website, drawn in its real state: an empty page waiting to be made (none), a page being written
 * with a dashed edge and a pencil (draft), a page with its live light on (published), or a plain page (not loaded).
 */
export function SiteFrame({ state }: { state: MemberWebsiteSummary['state'] | 'unknown' }) {
  const id = uid(useId());
  const live = state === 'published', draft = state === 'draft', none = state === 'none';
  return (
    <svg viewBox="0 0 132 92" className="xm-site-art" data-state={state} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffaf0" /><stop offset="1" stopColor="#f1e5cc" /></linearGradient>
      </defs>
      <ellipse cx="66" cy="86" rx="50" ry="4" fill="#000" opacity=".35" />
      <g className="xm-site-page">
        <rect x="10" y="8" width="112" height="74" rx="9" fill={`url(#${id}p)`} stroke="#e2d1ad" />
        <rect x="10" y="8" width="112" height="14" rx="9" fill="#efe1c3" />
        <rect x="10" y="16" width="112" height="6" fill="#efe1c3" />
        <circle cx="20" cy="15" r="2.3" fill="#e2566d" /><circle cx="27.5" cy="15" r="2.3" fill="#e9b949" /><circle cx="35" cy="15" r="2.3" fill="#00c365" />
        <rect x="44" y="11.5" width="68" height="7" rx="3.5" fill="#fffaf0" />
        {live && <circle className="xm-site-live" cx="50" cy="15" r="2.4" fill="#00c365" />}
        {none
          ? <g>
              <rect x="20" y="30" width="92" height="44" rx="6" fill="none" stroke="#c9b48a" strokeDasharray="4 4" />
              <circle cx="66" cy="52" r="10" fill="#0f3b2c" />
              <path d="M66 46.5 v11 M60.5 52 h11" stroke="#f7dc8f" strokeWidth="2.2" strokeLinecap="round" />
            </g>
          : <g opacity={draft ? .82 : 1}>
              <rect x="18" y="28" width="96" height="10" rx="3" fill="#0f3b2c" />
              <rect x="22" y="31.5" width="20" height="3" rx="1.5" fill="#f7dc8f" />
              <rect x="18" y="42" width="56" height="32" rx="4" fill="#123d2e" />
              <rect x="24" y="48" width="32" height="4" rx="2" fill="#fff4dc" />
              <rect x="24" y="55" width="22" height="3" rx="1.5" fill="#a9c9b9" />
              <rect x="24" y="63" width="20" height="6" rx="3" fill="#00c365" />
              <rect x="78" y="42" width="36" height="14" rx="3" fill="#ead9b8" />
              <rect x="78" y="60" width="36" height="14" rx="3" fill="#ead9b8" />
            </g>}
        {draft && <rect x="14.5" y="25.5" width="103" height="52" rx="6" fill="none" stroke="#b3263f" strokeDasharray="5 4" strokeWidth="1.4" />}
      </g>
      {draft && (
        <g className="xm-site-pencil" transform="translate(104 62) rotate(38)">
          <rect x="-3.5" y="-22" width="7" height="22" rx="1.5" fill="#e9b949" />
          <rect x="-3.5" y="-26" width="7" height="5" rx="1.5" fill="#e2566d" />
          <path d="M-3.5 0 L0 7 L3.5 0 Z" fill="#f6e3bf" /><path d="M-1.2 4.6 L0 7 L1.2 4.6 Z" fill="#1b1510" />
        </g>
      )}
      {live && (
        <g className="xm-site-sparkle" fill="#f7dc8f">
          <path d="M118 6 c .6 3 1.6 4 4.6 4.6 c -3 .6 -4 1.6 -4.6 4.6 c -.6 -3 -1.6 -4 -4.6 -4.6 c 3 -.6 4 -1.6 4.6 -4.6 Z" />
        </g>
      )}
    </svg>
  );
}

/** All services: four tiles in the season's colours, one still sealed (some services are coming soon). */
export function ServicesMark() {
  return (
    <svg viewBox="0 0 48 48" className="xm-services-art" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="18" height="18" rx="5" fill="#00c365" />
      <rect x="26" y="4" width="18" height="18" rx="5" fill="#e9b949" />
      <rect x="4" y="26" width="18" height="18" rx="5" fill="#b3263f" />
      <rect x="26" y="26" width="18" height="18" rx="5" fill="none" stroke="#f3d79a" strokeOpacity=".7" strokeDasharray="3 3" />
      <path className="xm-services-star" d="M35 29 c .5 2.6 1.4 3.5 4 4 c -2.6 .5 -3.5 1.4 -4 4 c -.5 -2.6 -1.4 -3.5 -4 -4 c 2.6 -.5 3.5 -1.4 4 -4 Z" fill="#f7dc8f" />
    </svg>
  );
}
