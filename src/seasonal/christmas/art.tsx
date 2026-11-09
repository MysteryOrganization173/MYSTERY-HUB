import React, { useCallback, useId, useRef } from 'react';

/**
 * Christmas pack artwork: original SVG drawn for Mystery Hub, no images, no network requests.
 * Every piece is decorative (aria-hidden). The interactive ones respond to a tap or click through `useNudge`, which
 * plays one short CSS animation and stops; with reduced motion the CSS keeps them still.
 */

export const XMAS = {
  berry: '#b3263f', berryDeep: '#6f1430', gold: '#e9b949', goldSoft: '#f7dc8f', cream: '#fff4dc',
  pine: '#0f3d2e', pineDeep: '#0a2a20', green: '#00c365', mint: '#7fe3ad',
} as const;

/** Plays the element's one-shot animation (swing, wobble, bounce, sparkle) each time it is tapped. */
export function useNudge<T extends HTMLElement | SVGElement>() {
  const ref = useRef<T | null>(null);
  const nudge = useCallback(() => {
    const el = ref.current; if (!el) return;
    el.removeAttribute('data-nudge');
    // Reading layout restarts the animation when the element is tapped again mid-swing.
    void (el as HTMLElement).getBoundingClientRect();
    el.setAttribute('data-nudge', '');
  }, []);
  const props = {
    ref,
    onPointerDown: nudge,
    onAnimationEnd: (e: React.AnimationEvent) => { if (e.target === e.currentTarget) (e.currentTarget as Element).removeAttribute('data-nudge'); },
  };
  return { props, nudge, ref };
}

type Tone = 'berry' | 'gold' | 'pine' | 'cream';
const TONES: Record<Tone, [string, string, string]> = {
  berry: ['#e2566d', XMAS.berry, XMAS.berryDeep],
  gold: ['#fbe7a6', XMAS.gold, '#a8771d'],
  pine: ['#3fae7c', '#1b6b4c', XMAS.pineDeep],
  cream: ['#ffffff', '#f3e3c2', '#c9ad7d'],
};

/** A glass bauble on a string. `drop` is the string length in px. Swings when tapped. */
export function Ornament({ tone = 'berry', size = 34, drop = 40, className = '', delay = 0 }: { tone?: Tone; size?: number; drop?: number; className?: string; delay?: number }) {
  const id = useId().replace(/:/g, '');
  const [hi, mid, lo] = TONES[tone];
  const { props } = useNudge<HTMLSpanElement>();
  const h = drop + size + 8;
  return (
    <span {...props} className={`xmas-ornament ${className}`} style={{ width: size, height: h, animationDelay: `${delay}ms` } as React.CSSProperties} aria-hidden="true">
      <svg viewBox={`0 0 40 ${h * 40 / size}`} width={size} height={h} focusable="false">
        <defs>
          <radialGradient id={`o${id}`} cx="35%" cy="32%" r="70%">
            <stop offset="0" stopColor={hi} /><stop offset=".45" stopColor={mid} /><stop offset="1" stopColor={lo} />
          </radialGradient>
          <linearGradient id={`c${id}`} x1="0" x2="1"><stop offset="0" stopColor="#a8771d" /><stop offset=".5" stopColor={XMAS.goldSoft} /><stop offset="1" stopColor="#a8771d" /></linearGradient>
        </defs>
        <line x1="20" y1="0" x2="20" y2={drop * 40 / size} stroke="#d9c79a" strokeOpacity=".7" strokeWidth="1" />
        <g transform={`translate(0 ${drop * 40 / size})`}>
          <path d="M17 1.5a3 3 0 0 1 6 0" fill="none" stroke={XMAS.goldSoft} strokeWidth="1.4" />
          <rect x="14" y="3" width="12" height="6" rx="1.5" fill={`url(#c${id})`} />
          <circle cx="20" cy="27" r="18" fill={`url(#o${id})`} />
          <path d="M5 23c5 4 25 4 30 0" fill="none" stroke={tone === 'gold' ? XMAS.berry : XMAS.goldSoft} strokeOpacity=".75" strokeWidth="1.6" />
          <path d="M3.5 30c6 4.5 27 4.5 33 0" fill="none" stroke={tone === 'gold' ? XMAS.berry : XMAS.goldSoft} strokeOpacity=".45" strokeWidth="1" strokeDasharray="1.5 3" />
          <ellipse cx="13" cy="18" rx="4.5" ry="2.6" transform="rotate(-35 13 18)" fill="#fff" fillOpacity=".55" />
        </g>
      </svg>
    </span>
  );
}

/** A five-point star with a soft glow. Sparkles when tapped. */
export function Star({ size = 28, className = '', glow = true }: { size?: number; className?: string; glow?: boolean }) {
  const id = useId().replace(/:/g, '');
  const { props } = useNudge<HTMLSpanElement>();
  return (
    <span {...props} className={`xmas-star ${glow ? 'xmas-star-glow' : ''} ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 40 40" width={size} height={size} focusable="false">
        <defs><linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3c4" /><stop offset=".5" stopColor={XMAS.gold} /><stop offset="1" stopColor="#c48a1e" /></linearGradient></defs>
        <path d="M20 2.5l5.1 11.2 12.2 1.3-9.1 8.2 2.6 12-10.8-6.2-10.8 6.2 2.6-12-9.1-8.2 12.2-1.3z" fill={`url(#s${id})`} stroke="#fff6d6" strokeOpacity=".6" strokeWidth=".8" strokeLinejoin="round" />
      </svg>
      <i className="xmas-sparkle xmas-sparkle-a" /><i className="xmas-sparkle xmas-sparkle-b" /><i className="xmas-sparkle xmas-sparkle-c" />
    </span>
  );
}

/** A four-point twinkle, for scattering. */
export const Twinkle = ({ size = 10, className = '', style }: { size?: number; className?: string; style?: React.CSSProperties }) => (
  <svg className={`xmas-twinkle ${className}`} style={style} viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" focusable="false">
    <path d="M10 0c.9 5.6 4.4 9.1 10 10-5.6.9-9.1 4.4-10 10-.9-5.6-4.4-9.1-10-10 5.6-.9 9.1-4.4 10-10z" fill={XMAS.goldSoft} />
  </svg>
);

/** A wrapped gift with a ribbon bow. Bounces when tapped. */
export function Gift({ size = 64, tone = 'berry', className = '' }: { size?: number; tone?: 'berry' | 'pine' | 'cream'; className?: string }) {
  const id = useId().replace(/:/g, '');
  const { props } = useNudge<HTMLSpanElement>();
  const box = tone === 'berry' ? ['#c93b52', XMAS.berryDeep] : tone === 'pine' ? ['#23805a', XMAS.pineDeep] : ['#fff6e4', '#d9c39b'];
  const ribbon = tone === 'cream' ? XMAS.berry : XMAS.gold;
  return (
    <span {...props} className={`xmas-gift ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size} focusable="false">
        <defs>
          <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={box[0]} /><stop offset="1" stopColor={box[1]} /></linearGradient>
          <linearGradient id={`l${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={box[0]} stopOpacity=".95" /><stop offset="1" stopColor={box[1]} /></linearGradient>
        </defs>
        <ellipse cx="32" cy="61" rx="22" ry="2.5" fill="#000" fillOpacity=".28" />
        <rect x="9" y="27" width="46" height="32" rx="3" fill={`url(#b${id})`} />
        <rect x="6" y="19" width="52" height="11" rx="2.5" fill={`url(#l${id})`} />
        <rect x="28.5" y="19" width="7" height="40" fill={ribbon} />
        <rect x="6" y="22" width="52" height="4" fill={ribbon} fillOpacity=".35" />
        <path d="M32 19c-4-9-15-10-14-3 .6 3.6 8 4 14 3zM32 19c4-9 15-10 14-3-.6 3.6-8 4-14 3z" fill={ribbon} stroke="#8a5a12" strokeOpacity=".35" strokeWidth=".8" />
        <circle cx="32" cy="19" r="3.2" fill={ribbon} stroke="#8a5a12" strokeOpacity=".4" strokeWidth=".8" />
        <rect x="11" y="31" width="5" height="24" rx="2" fill="#fff" fillOpacity=".12" />
      </svg>
    </span>
  );
}

/** A golden bell with a bow. Rings (swings) when tapped. */
export function Bell({ size = 36, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const { props } = useNudge<HTMLSpanElement>();
  return (
    <span {...props} className={`xmas-bell ${className}`} style={{ width: size, height: size * 1.15 }} aria-hidden="true">
      <svg viewBox="0 0 40 46" width={size} height={size * 1.15} focusable="false">
        <defs><linearGradient id={`g${id}`} x1="0" x2="1"><stop offset="0" stopColor="#a8771d" /><stop offset=".4" stopColor={XMAS.goldSoft} /><stop offset="1" stopColor="#b9862a" /></linearGradient></defs>
        <path d="M20 9c-7.5 0-11 6-11 13v8l-4 6h30l-4-6v-8c0-7-3.5-13-11-13z" fill={`url(#g${id})`} />
        <circle cx="20" cy="39.5" r="3.6" fill="#a8771d" />
        <path d="M20 9c-3-5-10-6-9.5-2 .4 2.6 5 3 9.5 2zM20 9c3-5 10-6 9.5-2-.4 2.6-5 3-9.5 2z" fill={XMAS.berry} />
        <path d="M13 18c1-3 3-5 5.5-5.5" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** A paper gift tag on a string, with its own short message. */
export function GiftTag({ text, className = '' }: { text: string; className?: string }) {
  const { props } = useNudge<HTMLSpanElement>();
  return (
    <span {...props} className={`xmas-tag ${className}`} aria-hidden="true">
      <svg className="xmas-tag-string" viewBox="0 0 30 40" width="30" height="40" focusable="false"><path d="M28 0C20 14 10 20 6 38" fill="none" stroke="#d9c79a" strokeWidth="1.2" /></svg>
      <span className="xmas-tag-card"><i className="xmas-tag-hole" />{text}</span>
    </span>
  );
}

const BULB_TONES = [XMAS.gold, XMAS.berry, '#ffe9b8', '#2fbf7f', XMAS.gold, '#f2766f'];

/**
 * A string of warm lights draped across its container. The wire is drawn to the container's width; the bulbs are
 * placed along the same curve, so they never stretch. A few bulbs twinkle slowly; reduced motion keeps them lit.
 */
export function StringLights({ count = 12, sag = 22, className = '', swags = 2 }: { count?: number; sag?: number; className?: string; swags?: number }) {
  // Each swag is a parabola from 0 to 100% of its share of the width.
  const y = (t: number) => { const local = (t * swags) % 1; return 4 + sag * 4 * local * (1 - local); };
  const bulbs = Array.from({ length: count }, (_, i) => (i + 0.5) / count);
  const path = Array.from({ length: swags }, (_, s) => {
    const x0 = (s / swags) * 1000, x1 = ((s + 1) / swags) * 1000;
    return `${s === 0 ? `M${x0} 4` : ''} Q${(x0 + x1) / 2} ${4 + sag * 2} ${x1} 4`;
  }).join(' ');
  return (
    <div className={`xmas-lights ${className}`} style={{ height: sag + 26 } as React.CSSProperties} aria-hidden="true">
      <svg className="xmas-lights-wire" viewBox={`0 0 1000 ${sag + 26}`} preserveAspectRatio="none" focusable="false"><path d={path} fill="none" stroke="#3b4a3f" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
      {bulbs.map((t, i) => (
        <i key={i} className={`xmas-bulb ${i % 3 === 1 ? 'xmas-bulb-twinkle' : ''}`}
          style={{ left: `${t * 100}%`, top: y(t), '--bulb': BULB_TONES[i % BULB_TONES.length], animationDelay: `${(i * 0.7) % 4}s` } as React.CSSProperties} />
      ))}
    </div>
  );
}

/**
 * A short burst of stars and ribbons for a genuinely confirmed outcome (verified payment, delivered order). Plays
 * once; with reduced motion it is a single still star.
 */
export function Celebrate({ className = '' }: { className?: string }) {
  const pieces = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
    const dist = 46 + (i % 3) * 16;
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 10, tone: [XMAS.gold, XMAS.berry, '#2fbf7f', XMAS.goldSoft][i % 4], round: i % 3 === 0, delay: (i % 4) * 30 };
  });
  return (
    <span className={`xmas-celebrate ${className}`} aria-hidden="true">
      {pieces.map((p, i) => <i key={i} className={p.round ? 'xmas-confetti xmas-confetti-dot' : 'xmas-confetti'} style={{ '--x': `${p.x}px`, '--y': `${p.y}px`, '--c': p.tone, animationDelay: `${p.delay}ms` } as React.CSSProperties} />)}
    </span>
  );
}

/**
 * The header band of the sign-up / sign-in sheet: an evening scene with one strand of lights, a wrapped gift and a
 * sealed envelope, like the top of an invitation card. Decorative; it scales to the sheet's width.
 */
export function InviteBanner({ newYear = false }: { newYear?: boolean }) {
  const bulbs = Array.from({ length: 11 }, (_, i) => {
    const t = (i + 0.5) / 11, x = -10 + t * 500, y = (1 - t) ** 2 * 16 + 2 * (1 - t) * t * 62 + t ** 2 * 12;
    return { x, y, tone: newYear ? ['#fff1c9', '#f7d27a', '#e9eef7'][i % 3] : ['#f7d27a', '#e2566d', '#ffe9b3', '#7fe3ad'][i % 4] };
  });
  return (
    <svg className="xmas-invite-art" viewBox="0 0 480 116" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="xi-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0f3527" /><stop offset=".55" stopColor="#0a2219" /><stop offset="1" stopColor="#2a0b17" /></linearGradient>
        <radialGradient id="xi-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ffe3a0" stopOpacity=".45" /><stop offset="1" stopColor="#e9b949" stopOpacity="0" /></radialGradient>
        <radialGradient id="xi-bulb" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#fff6dc" stopOpacity=".85" /><stop offset="1" stopColor="#f7d27a" stopOpacity="0" /></radialGradient>
        <linearGradient id="xi-env" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffaf1" /><stop offset="1" stopColor="#ead9b8" /></linearGradient>
        <linearGradient id="xi-gift" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c5334c" /><stop offset="1" stopColor="#6f1430" /></linearGradient>
        <linearGradient id="xi-gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#b98326" /><stop offset=".45" stopColor="#ffeebe" /><stop offset="1" stopColor="#a87420" /></linearGradient>
        <radialGradient id="xi-seal" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#fbe7a6" /><stop offset=".55" stopColor="#e9b949" /><stop offset="1" stopColor="#a8771d" /></radialGradient>
      </defs>
      <rect width="480" height="116" fill="url(#xi-bg)" />
      <circle cx="300" cy="70" r="150" fill="url(#xi-glow)" />
      <path d="M-10 16 Q240 108 490 12" fill="none" stroke="#2f4a3b" strokeWidth="1.4" />
      {bulbs.map((b, i) => <g key={i}><circle cx={b.x} cy={b.y + 6} r="9" fill="url(#xi-bulb)" /><circle cx={b.x} cy={b.y + 6} r="2.6" fill={b.tone} /></g>)}
      {/* A wrapped gift, left of centre. */}
      <g transform="translate(176 52)">
        <ellipse cx="22" cy="46" rx="30" ry="4" fill="#000" opacity=".35" />
        <rect x="0" y="12" width="44" height="34" rx="2" fill="url(#xi-gift)" />
        <rect x="-2" y="6" width="48" height="9" rx="2" fill="#d4465e" />
        <rect x="18" y="6" width="8" height="40" fill="url(#xi-gold)" />
        <path d="M22 6 C 12 -6 2 -2 6 4 C 9 8 16 8 22 6 Z M22 6 C 32 -6 42 -2 38 4 C 35 8 28 8 22 6 Z" fill="#f0c766" />
        <circle cx="22" cy="6" r="3" fill="#f6d683" />
      </g>
      {/* A sealed envelope, tilted, right of centre. */}
      <g transform="translate(252 36) rotate(-7)">
        <rect x="0" y="0" width="112" height="70" rx="6" fill="url(#xi-env)" />
        <path d="M0 6 L56 42 L112 6" fill="none" stroke="#c9b48d" strokeWidth="1.4" />
        <path d="M0 70 L44 36 M112 70 L68 36" fill="none" stroke="#d9c7a2" strokeWidth="1" />
        <circle cx="56" cy="42" r="10" fill="url(#xi-seal)" />
        <path d="M51.5 45.5 V38.5 L56 43 L60.5 38.5 V45.5" fill="none" stroke="#7a4f12" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path d="M118 30 c .6 3 1.6 4 4.6 4.6 c -3 .6 -4 1.6 -4.6 4.6 c -.6 -3 -1.6 -4 -4.6 -4.6 c 3 -.6 4 -1.6 4.6 -4.6 Z" fill="#f7dc8f" />
      <path d="M398 74 c .5 2.4 1.3 3.2 3.7 3.7 c -2.4 .5 -3.2 1.3 -3.7 3.7 c -.5 -2.4 -1.3 -3.2 -3.7 -3.7 c 2.4 -.5 3.2 -1.3 3.7 -3.7 Z" fill="#fff4dc" />
    </svg>
  );
}
