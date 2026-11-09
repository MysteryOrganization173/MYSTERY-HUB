import React, { useId, useRef } from 'react';
import { useFitSvgText } from '../kit/motion';

/**
 * Christmas homepage illustrations, drawn for each service's purpose (no images). They are decorative
 * (aria-hidden); the card or section around them carries the words and the action. Parts that move on a press,
 * hover or focus have their own class, so CSS can play one short reaction without touching layout.
 */

const svgProps = { 'aria-hidden': true as const, focusable: 'false' as const };

/** Data Bundles: a phone sending warm signal waves, a ribbon tied across it. Waves pulse on press. */
export const DataArt = () => (
  <svg viewBox="0 0 132 92" className="xh-art xh-art-data" {...svgProps}>
    <defs>
      <linearGradient id="xa-d-phone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1d3f33" /><stop offset="1" stopColor="#0a1b15" /></linearGradient>
      <linearGradient id="xa-d-screen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f6b4c" /><stop offset="1" stopColor="#0d3426" /></linearGradient>
    </defs>
    <g className="xh-art-float">
      <rect x="34" y="12" width="40" height="72" rx="9" fill="url(#xa-d-phone)" stroke="#e9c97a" strokeOpacity=".55" />
      <rect x="38" y="19" width="32" height="56" rx="4" fill="url(#xa-d-screen)" />
      <rect x="49" y="15" width="10" height="2" rx="1" fill="#e9c97a" opacity=".5" />
      <g fill="#f7dc8f"><rect x="44" y="58" width="4" height="9" rx="1" /><rect x="50" y="53" width="4" height="14" rx="1" /><rect x="56" y="47" width="4" height="20" rx="1" /><rect x="62" y="41" width="4" height="26" rx="1" opacity=".55" /></g>
      <path d="M30 60 L78 34 L80 40 L32 66 Z" fill="#b3263f" />
      <path d="M78 34 c 8 -10 18 -8 14 -2 c -2 3 -8 3 -14 2 Z M78 34 c 2 -12 12 -16 13 -10 c 0 4 -6 7 -13 10 Z" fill="#d6455b" />
      <circle cx="79" cy="36" r="3" fill="#e2566d" />
    </g>
    <g className="xh-waves" fill="none" stroke="#f7dc8f" strokeLinecap="round" strokeWidth="2.4">
      <path className="xh-wave xh-wave-1" d="M88 28 a10 10 0 0 1 0 14" />
      <path className="xh-wave xh-wave-2" d="M95 22 a18 18 0 0 1 0 26" />
      <path className="xh-wave xh-wave-3" d="M102 16 a26 26 0 0 1 0 38" />
    </g>
    <path className="xh-spark" d="M18 26 c .6 3 1.6 4 4.6 4.6 c -3 .6 -4 1.6 -4.6 4.6 c -.6 -3 -1.6 -4 -4.6 -4.6 c 3 -.6 4 -1.6 4.6 -4.6 Z" fill="#f7dc8f" />
  </svg>
);

/** Airtime: a gold coin drops into a phone. Plays on press. */
export const AirtimeArt = () => (
  <svg viewBox="0 0 132 92" className="xh-art xh-art-airtime" {...svgProps}>
    <defs>
      <linearGradient id="xa-a-coin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1c1" /><stop offset=".5" stopColor="#e9b949" /><stop offset="1" stopColor="#a8771d" /></linearGradient>
      <linearGradient id="xa-a-phone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff2f4" /><stop offset="1" stopColor="#f2cfd6" /></linearGradient>
    </defs>
    <g className="xh-art-float">
      <rect x="54" y="26" width="38" height="62" rx="8" fill="url(#xa-a-phone)" stroke="#fff" strokeOpacity=".6" />
      <rect x="58" y="33" width="30" height="44" rx="4" fill="#5a1426" className="xh-airtime-screen" />
      <path d="M66 55 h14 M73 48 v14" stroke="#f7dc8f" strokeWidth="3" strokeLinecap="round" />
      <rect x="67" y="29" width="12" height="2" rx="1" fill="#b3263f" opacity=".5" />
    </g>
    <g className="xh-coin">
      <circle cx="73" cy="14" r="11" fill="url(#xa-a-coin)" stroke="#8f6118" strokeOpacity=".5" />
      <circle cx="73" cy="14" r="7.5" fill="none" stroke="#fff3c9" strokeOpacity=".7" />
      <path d="M73 9.5 v9 M68.5 14 h9" stroke="#8f6118" strokeWidth="2" strokeLinecap="round" />
    </g>
    <path d="M30 40 c .7 3.5 1.9 4.7 5.4 5.4 c -3.5 .7 -4.7 1.9 -5.4 5.4 c -.7 -3.5 -1.9 -4.7 -5.4 -5.4 c 3.5 -.7 4.7 -1.9 5.4 -5.4 Z" fill="#f7dc8f" className="xh-spark" />
    <path d="M108 58 c .5 2.5 1.4 3.4 3.9 3.9 c -2.5 .5 -3.4 1.4 -3.9 3.9 c -.5 -2.5 -1.4 -3.4 -3.9 -3.9 c 2.5 -.5 3.4 -1.4 3.9 -3.9 Z" fill="#fff4dc" className="xh-spark" />
  </svg>
);

/** Website Builder: a small browser with a festive page inside, tied with a ribbon. Lights up on press. */
export const WebArt = () => (
  <svg viewBox="0 0 132 92" className="xh-art xh-art-web" {...svgProps}>
    <g className="xh-art-float">
      <rect x="14" y="12" width="98" height="70" rx="8" fill="#ffffff" stroke="#d9c7a3" />
      <rect x="14" y="12" width="98" height="13" rx="8" fill="#efe3cb" />
      <rect x="14" y="20" width="98" height="5" fill="#efe3cb" />
      <circle cx="23" cy="18.5" r="2.2" fill="#e2566d" /><circle cx="30" cy="18.5" r="2.2" fill="#e9b949" /><circle cx="37" cy="18.5" r="2.2" fill="#00c365" />
      <g className="xh-web-page">
        <rect x="20" y="30" width="86" height="8" rx="2" fill="#0f3b2c" />
        <rect x="23" y="32.5" width="16" height="3" rx="1.5" fill="#f7dc8f" />
        <rect x="20" y="42" width="52" height="34" rx="3" fill="#123d2e" />
        <rect x="25" y="48" width="30" height="4" rx="2" fill="#fff4dc" />
        <rect x="25" y="55" width="22" height="3" rx="1.5" fill="#a9c9b9" />
        <rect x="25" y="63" width="20" height="7" rx="3.5" fill="#00c365" />
        <rect x="76" y="42" width="30" height="15" rx="3" fill="#f3e6cc" />
        <rect x="76" y="61" width="30" height="15" rx="3" fill="#f3e6cc" />
      </g>
      <rect className="xh-web-glow" x="14" y="25" width="98" height="57" fill="#fff6d6" opacity="0" />
    </g>
    <rect x="96" y="12" width="7" height="70" fill="#b3263f" />
    <path d="M99.5 13 c -9 -11 -20 -8 -16 -1 c 2 3.5 9 3 16 1 Z M99.5 13 c 9 -11 20 -8 16 -1 c -2 3.5 -9 3 -16 1 Z" fill="#d6455b" />
    <circle cx="99.5" cy="13" r="3" fill="#e2566d" />
    <path className="xh-cursor" d="M74 64 l0 14 l4 -4 l3 7 l3 -1.4 l-3 -6.6 l5.6 0 Z" fill="#1b1510" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

/** Mystery Earn: one gift passes to a friend along a dotted path (referrals, not a giveaway). */
export const EarnArt = () => (
  <svg viewBox="0 0 132 92" className="xh-art xh-art-earn" {...svgProps}>
    <path d="M30 56 C 46 18 86 18 102 50" fill="none" stroke="#f3d79a" strokeOpacity=".7" strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" />
    <path d="M96 42 l7 9 l-11 1" fill="none" stroke="#f3d79a" strokeOpacity=".85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <g className="xh-art-float">
      <rect x="12" y="58" width="36" height="26" rx="2" fill="#b3263f" />
      <rect x="10" y="52" width="40" height="8" rx="2" fill="#c93a53" />
      <rect x="27" y="52" width="6" height="32" fill="#f7dc8f" />
      <path d="M30 52 c -8 -10 -18 -7 -14 0 c 2 3 8 3 14 0 Z M30 52 c 8 -10 18 -7 14 0 c -2 3 -8 3 -14 0 Z" fill="#f7dc8f" />
      <rect x="86" y="62" width="34" height="24" rx="2" fill="#0f4f38" />
      <rect x="84" y="56" width="38" height="8" rx="2" fill="#17714f" />
      <rect x="100" y="56" width="6" height="30" fill="#f7dc8f" />
    </g>
    <g className="xh-hop">
      <rect x="58" y="22" width="16" height="13" rx="1.5" fill="#f3d79a" />
      <rect x="57" y="19" width="18" height="4" rx="1" fill="#fff1c1" />
      <rect x="64.5" y="19" width="3" height="16" fill="#b3263f" />
    </g>
  </svg>
);

/** AFA registration: a SIM card with a shield and a soft shine (no network logo is reproduced). */
export const AfaArt = () => (
  <svg viewBox="0 0 132 92" className="xh-art xh-art-afa" {...svgProps}>
    <defs>
      <linearGradient id="xa-f-sim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6e7c4" /><stop offset="1" stopColor="#d7bd88" /></linearGradient>
      <linearGradient id="xa-f-chip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1c1" /><stop offset="1" stopColor="#b98326" /></linearGradient>
      <linearGradient id="xa-f-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      <clipPath id="xa-f-clip"><path d="M30 14 H86 L100 28 V80 a4 4 0 0 1 -4 4 H30 a4 4 0 0 1 -4 -4 V18 a4 4 0 0 1 4 -4 Z" /></clipPath>
    </defs>
    <g className="xh-art-float">
      <path d="M30 14 H86 L100 28 V80 a4 4 0 0 1 -4 4 H30 a4 4 0 0 1 -4 -4 V18 a4 4 0 0 1 4 -4 Z" fill="url(#xa-f-sim)" stroke="#fff6e0" strokeOpacity=".5" />
      <rect x="40" y="36" width="30" height="24" rx="4" fill="url(#xa-f-chip)" stroke="#8f6118" strokeOpacity=".4" />
      <path d="M40 44 h30 M40 52 h30 M55 36 v24" stroke="#8f6118" strokeOpacity=".45" />
      <g clipPath="url(#xa-f-clip)"><rect className="xh-shine" x="-38" y="10" width="34" height="80" fill="url(#xa-f-shine)" transform="skewX(-18)" /></g>
    </g>
    <g transform="translate(92 54)">
      <path d="M0 -20 L16 -14 V0 C16 10 8 17 0 21 C -8 17 -16 10 -16 0 V-14 Z" fill="#14233f" stroke="#f3d79a" strokeWidth="1.6" />
      <path d="M-6.5 0 L-1.5 5 L7 -4.5" fill="none" stroke="#7fe3ad" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

/** Marketplace: kraft parcels tied with twine, a tag swinging. The front parcel hops on press. */
export const MarketArt = () => (
  <svg viewBox="0 0 132 92" className="xh-art xh-art-market" {...svgProps}>
    <defs>
      <linearGradient id="xa-m-kraft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d4a06a" /><stop offset="1" stopColor="#a8723f" /></linearGradient>
      <linearGradient id="xa-m-kraft-2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c08d58" /><stop offset="1" stopColor="#8f5e31" /></linearGradient>
    </defs>
    <g opacity=".95">
      <polygon points="74,36 86,28 120,28 108,36" fill="#d9ad7c" />
      <rect x="74" y="36" width="34" height="30" fill="url(#xa-m-kraft-2)" />
      <polygon points="108,36 120,28 120,58 108,66" fill="#7e5229" />
      <path d="M91 36 V66 M74 51 H108" stroke="#fff4dc" strokeOpacity=".75" strokeWidth="1.6" />
    </g>
    <g className="xh-parcel">
      <polygon points="18,44 34,34 92,34 76,44" fill="#e2b886" />
      <rect x="18" y="44" width="58" height="42" fill="url(#xa-m-kraft)" />
      <polygon points="76,44 92,34 92,76 76,86" fill="#8a5a2d" />
      <path d="M47 44 V86 M18 65 H76" stroke="#fbf0dc" strokeWidth="2" />
      <polygon points="45.5,44 48.5,44 64,34 61,34" fill="#fbf0dc" />
      <path d="M47 42 c -9 -9 -18 -5 -14 1 c 2.6 3 8 2.6 14 -1 Z M47 42 c 9 -9 18 -5 14 1 c -2.6 3 -8 2.6 -14 -1 Z" fill="#fbf0dc" />
      <g className="xh-tag-swing">
        <path d="M58 66 C 64 70 68 72 70 76" fill="none" stroke="#fbf0dc" strokeWidth="1.2" />
        <g transform="translate(70 76) rotate(-12)"><path d="M0 0 H18 a3 3 0 0 1 3 3 V11 a3 3 0 0 1 -3 3 H0 L-5 7 Z" fill="#b3263f" /><circle cx="-1" cy="7" r="1.4" fill="#fbf0dc" /></g>
      </g>
    </g>
  </svg>
);

const BOW_TONES = {
  gold: { light: '#fff3c9', mid: '#f0c766', deep: '#b98326', shade: '#7c5414' },
  ivory: { light: '#ffffff', mid: '#f5ecdc', deep: '#cdbb98', shade: '#9a8662' },
  berry: { light: '#f0798b', mid: '#c93a53', deep: '#8e1d35', shade: '#5e0918' },
} as const;
const safeId = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, '');

/**
 * A satin bow that sits on a gift's ribbon band: two loops with their inner shadow, a knot, two notched tails, lit
 * from the top-left like everything else on the page. Sized by its wrapper; decorative.
 */
export function Bow({ tone = 'gold' }: { tone?: keyof typeof BOW_TONES }) {
  const c = BOW_TONES[tone], id = `xa-bow-${safeId(useId())}`;
  return (
    <svg viewBox="0 0 72 54" className="xh-bow" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-l`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.light} /><stop offset=".55" stopColor={c.mid} /><stop offset="1" stopColor={c.deep} /></linearGradient>
        <linearGradient id={`${id}-t`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c.mid} /><stop offset="1" stopColor={c.shade} /></linearGradient>
        <radialGradient id={`${id}-k`} cx="38%" cy="32%" r="75%"><stop offset="0" stopColor={c.light} /><stop offset="1" stopColor={c.deep} /></radialGradient>
      </defs>
      <path d="M33 25 C 30 33 25 42 18 51 L 24.5 49 L 26.5 54 C 32 44 35 35 36 26 Z" fill={`url(#${id}-t)`} />
      <path d="M39 25 C 42 33 47 42 54 51 L 47.5 49 L 45.5 54 C 40 44 37 35 36 26 Z" fill={`url(#${id}-t)`} />
      <path d="M36 22 C 26 7 8 3 6 13.5 C 4.2 23 20 27.5 36 23.2 Z" fill={`url(#${id}-l)`} />
      <path d="M36 22 C 46 7 64 3 66 13.5 C 67.8 23 52 27.5 36 23.2 Z" fill={`url(#${id}-l)`} />
      <path d="M34 21.6 C 26.5 13.4 15.5 11 13.2 15.6 C 15 19.4 24 21.4 34 22.2 Z" fill={c.shade} opacity=".42" />
      <path d="M38 21.6 C 45.5 13.4 56.5 11 58.8 15.6 C 57 19.4 48 21.4 38 22.2 Z" fill={c.shade} opacity=".42" />
      <path d="M9 11.5 C 13 6.6 21 7.4 27.4 11.6" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M63 11.5 C 59 6.6 51 7.4 44.6 11.6" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="31" y="17.4" width="10" height="10.4" rx="4.2" fill={`url(#${id}-k)`} stroke={c.shade} strokeOpacity=".5" strokeWidth=".8" />
    </svg>
  );
}

/** A paper gift tag hanging from a string at a card's corner (used where a full ribbon would crowd the design). */
export function HangingTag() {
  return (
    <svg viewBox="0 0 44 66" className="xh-hang-tag" aria-hidden="true" focusable="false">
      <path d="M30 0 C 30.5 8 27 14 22 21" fill="none" stroke="#9c7a4a" strokeWidth="1.4" strokeLinecap="round" />
      <g className="xh-hang-tag-card">
        <path d="M22 19 L 34 26 V 56 a4.5 4.5 0 0 1 -4.5 4.5 H 14.5 a4.5 4.5 0 0 1 -4.5 -4.5 V 26 Z" fill="#b3263f" />
        <path d="M22 19 L 34 26 V 33 H 10 V 26 Z" fill="#000" opacity=".13" />
        <path d="M33 27 V 56 a4.5 4.5 0 0 1 -3.5 4.4" fill="none" stroke="#7d1b33" strokeOpacity=".6" strokeWidth="1" />
        <circle cx="22" cy="26.5" r="2.3" fill="#fbf0dc" stroke="#7d1b33" strokeWidth=".7" />
        <path d="M22 38 c .7 3.2 1.8 4.3 5 5 c -3.2 .7 -4.3 1.8 -5 5 c -.7 -3.2 -1.8 -4.3 -5 -5 c 3.2 -.7 4.3 -1.8 5 -5 Z" fill="#f7dc8f" />
      </g>
    </svg>
  );
}

/** A twine bow for kraft paper: thin twisted loops, no satin. */
export function TwineBow() {
  return (
    <svg viewBox="0 0 48 34" className="xh-twine-bow" aria-hidden="true" focusable="false">
      <g fill="none" stroke="#f3e2bf" strokeWidth="2.2" strokeLinecap="round">
        <path d="M24 14 C 16 2 4 2 6 10 C 7.5 16 17 16.5 24 14.5" />
        <path d="M24 14 C 32 2 44 2 42 10 C 40.5 16 31 16.5 24 14.5" />
        <path d="M23 15 C 21 21 18 26 14 32" /><path d="M25 15 C 27 21 30 26 34 32" />
      </g>
      <g fill="none" stroke="#a37a43" strokeWidth=".8" strokeLinecap="round" strokeDasharray="1.5 2.5">
        <path d="M24 14 C 16 2 4 2 6 10" /><path d="M24 14 C 32 2 44 2 42 10" />
      </g>
      <circle cx="24" cy="14.6" r="3" fill="#e9d2a6" stroke="#a37a43" strokeWidth=".8" />
    </svg>
  );
}

/** A wooden peg that holds a card on the twine. */
export const Peg = () => (
  <svg viewBox="0 0 22 46" className="xh-peg" aria-hidden="true" focusable="false">
    <rect x="3" y="0" width="7" height="44" rx="2" fill="#c89a62" />
    <rect x="12" y="0" width="7" height="44" rx="2" fill="#b48451" />
    <rect x="1" y="16" width="20" height="6" rx="1.5" fill="#8f939a" />
  </svg>
);

/**
 * Mystery Greetings preview: a real envelope in four layers, so the letter can only ever move the way paper does.
 * Back body (behind) → letter (in a box clipped at the envelope's bottom edge) → front pocket → flap, hinged on the
 * body's top edge. The flap is drawn closed (pointing down, sealed); CSS turns it open around its hinge.
 * All coordinates share one 400 × 320 box; the flap spans y 112–252.
 */
export const EnvelopeBack = () => (
  <svg viewBox="0 0 400 320" className="xh-env-back" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="xa-e-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a0f1f" /><stop offset="1" stopColor="#2e0813" /></linearGradient>
    </defs>
    <rect x="0" y="112" width="400" height="208" rx="16" fill="url(#xa-e-back)" />
    {/* The shadowed inside of the opening. */}
    <path d="M0 128 Q0 112 16 112 H384 Q400 112 400 128 V140 H0 Z" fill="#000" opacity=".28" />
  </svg>
);
export const EnvelopeFront = () => (
  <svg viewBox="0 0 400 320" className="xh-env-front" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="xa-e-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a8264a" /><stop offset="1" stopColor="#6f1430" /></linearGradient>
    </defs>
    <path d="M0 132 L176 226 Q200 238 224 226 L400 132 V304 Q400 320 384 320 H16 Q0 320 0 304 Z" fill="url(#xa-e-front)" />
    <path d="M0 304 L170 214 M400 304 L230 214" stroke="#4a0f1f" strokeOpacity=".35" strokeWidth="1.5" />
    <path d="M0 132 L176 226 Q200 238 224 226 L400 132" fill="none" stroke="#f3d79a" strokeOpacity=".45" strokeWidth="1.4" />
  </svg>
);
/** The flap's outside (seen while closed): deep wine with the gold wax seal at its tip. */
export const FlapOutside = () => (
  <svg viewBox="0 0 400 140" className="xh-flap-face" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="xa-e-flap-out" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7c1832" /><stop offset="1" stopColor="#9b2343" /></linearGradient>
      <radialGradient id="xa-e-seal" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#fbe7a6" /><stop offset=".5" stopColor="#e9b949" /><stop offset="1" stopColor="#a8771d" /></radialGradient>
    </defs>
    <path d="M0 0 H400 L214 128 Q200 137 186 128 Z" fill="url(#xa-e-flap-out)" />
    <path d="M0 0 L186 128 Q200 137 214 128 L400 0" fill="none" stroke="#f3d79a" strokeOpacity=".42" strokeWidth="1.4" />
    <g transform="translate(200 116)">
      <circle r="25" fill="#5e0918" opacity=".4" transform="translate(1.5 3)" />
      <path d="M0 -24 C 7.5 -24 11 -20.5 15.5 -17.5 C 22 -14 25 -7.5 24 0 C 25 8.5 20.5 14 15.5 17.5 C 10 22 5.5 25 0 24 C -7.5 25 -12 21.5 -16.5 17.5 C -22 13 -25 7.5 -24 0 C -25 -8.5 -21 -14 -15.5 -17.5 C -11 -21.5 -6.5 -25 0 -24 Z" fill="url(#xa-e-seal)" />
      <circle r="15.5" fill="none" stroke="#fff1c1" strokeOpacity=".55" />
      <path d="M-8.5 6.5 V-6.5 L0 2 L8.5 -6.5 V6.5" fill="none" stroke="#7a4f12" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);
/** The flap's lining (seen once it has opened up). */
export const FlapInside = () => (
  <svg viewBox="0 0 400 140" className="xh-flap-face is-inside" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="xa-e-flap-in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a1225" /><stop offset="1" stopColor="#3e0b19" /></linearGradient>
      <pattern id="xa-e-lining" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="1.1" fill="#f3d79a" opacity=".22" /></pattern>
    </defs>
    <path d="M0 0 H400 L214 128 Q200 137 186 128 Z" fill="url(#xa-e-flap-in)" />
    <path d="M0 0 H400 L214 128 Q200 137 186 128 Z" fill="url(#xa-e-lining)" />
  </svg>
);

/** The Marketplace stack: three kraft parcels, twine and a red tag carrying the season's greeting (always fitted). */
export function ParcelStack({ label }: { label: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useFitSvgText(ref, [label]);
  return (
  <svg ref={ref} viewBox="0 0 360 260" className="xh-parcels" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="xa-p-k1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d7a46c" /><stop offset="1" stopColor="#a56f3c" /></linearGradient>
      <linearGradient id="xa-p-k2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c99660" /><stop offset="1" stopColor="#8f5e31" /></linearGradient>
      <radialGradient id="xa-p-floor" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#f2c46d" stopOpacity=".25" /><stop offset="1" stopColor="#f2c46d" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="180" cy="236" rx="170" ry="22" fill="url(#xa-p-floor)" />
    <ellipse cx="180" cy="232" rx="140" ry="10" fill="#000" opacity=".4" />
    <g className="xh-parcel-back">
      <polygon points="196,88 226,70 330,70 300,88" fill="#e0b583" />
      <rect x="196" y="88" width="104" height="142" fill="url(#xa-p-k2)" />
      <polygon points="300,88 330,70 330,212 300,230" fill="#7b4f27" />
      <path d="M248 88 V230 M196 160 H300" stroke="#fbf0dc" strokeOpacity=".85" strokeWidth="3" />
      <polygon points="245,88 251,88 281,70 275,70" fill="#fbf0dc" />
    </g>
    <g className="xh-parcel-front">
      <polygon points="40,130 76,108 206,108 170,130" fill="#e8c08f" />
      <rect x="40" y="130" width="130" height="100" fill="url(#xa-p-k1)" />
      <polygon points="170,130 206,108 206,208 170,230" fill="#8a5a2d" />
      <path d="M105 130 V230 M40 180 H170" stroke="#fbf0dc" strokeWidth="3.2" />
      <polygon points="102,130 108,130 144,108 138,108" fill="#fbf0dc" />
      <path d="M187 119 V219" stroke="#efe0c2" strokeWidth="3" />
      <path d="M124 119 c -18 -20 -40 -12 -32 2 c 5 7 18 6 32 -2 Z M124 119 c 18 -20 40 -12 32 2 c -5 7 -18 6 -32 -2 Z" fill="#fbf0dc" stroke="#d9c39b" />
      <circle cx="124" cy="119" r="5" fill="#fbf0dc" stroke="#d9c39b" />
      <g className="xh-parcel-tag">
        <path d="M150 170 C 168 178 176 186 180 196" fill="none" stroke="#fbf0dc" strokeWidth="1.6" />
        <g transform="translate(180 196) rotate(-10)">
          <path d="M0 0 H78 a6 6 0 0 1 6 6 V26 a6 6 0 0 1 -6 6 H0 L-10 16 Z" fill="#b3263f" stroke="#7d1b33" />
          <circle cx="-2" cy="16" r="2.6" fill="#fbf0dc" />
          <text x="6" y="20.5" className="xh-parcel-tag-text" data-fit="70">{label}</text>
        </g>
      </g>
    </g>
    <g transform="translate(46 2)"><g className="xh-parcel-small">
      <polygon points="232,196 246,188 300,188 286,196" fill="#fff4df" />
      <rect x="232" y="196" width="54" height="36" fill="#f3e3c3" />
      <polygon points="286,196 300,188 300,224 286,232" fill="#cdb48a" />
      <rect x="255" y="196" width="8" height="36" fill="#0f4f38" />
      <path d="M259 193 c -8 -9 -17 -6 -14 0 c 2 3 7 3 14 0 Z M259 193 c 8 -9 17 -6 14 0 c -2 3 -7 3 -14 0 Z" fill="#17714f" />
    </g></g>
  </svg>
  );
}
