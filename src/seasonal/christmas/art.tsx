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

/** A small Christmas hat, sized to sit on a 22px icon. Wobbles when its tab is tapped. */
export const Hat = React.forwardRef<HTMLSpanElement, { className?: string }>(({ className = '' }, ref) => (
  <span ref={ref} className={`xmas-hat ${className}`} aria-hidden="true">
    <svg viewBox="0 0 32 26" width="22" height="18" focusable="false">
      <path d="M4 19C7 9 13 3.5 21 3c3.6-.2 6.2 2.2 6.6 6.4L26 12c-1-3-3-4.2-5.2-3.4C17 10 14.6 14 13.7 19z" fill="#d23548" />
      <path d="M8 13.5C11 8 15 5 20.5 4.6" fill="none" stroke="#ff8a98" strokeOpacity=".45" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="2" y="17.5" width="16.5" height="6" rx="3" fill="#fff6ea" />
      <circle cx="27" cy="13.6" r="3.4" fill="#fff6ea" />
    </svg>
  </span>
));
Hat.displayName = 'Hat';

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
