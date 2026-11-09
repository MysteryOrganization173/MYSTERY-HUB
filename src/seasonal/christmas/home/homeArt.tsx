import React from 'react';

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

/** A satin ribbon around a card corner with a bow, used where a section is presented as a gift. */
export const CornerBow = ({ tone = 'gold' }: { tone?: 'gold' | 'berry' | 'cream' }) => {
  const c = tone === 'gold' ? ['#f6d683', '#c99230', '#fff1c1'] : tone === 'berry' ? ['#c93a53', '#7d1b33', '#e2566d'] : ['#fff6e6', '#d9c39b', '#ffffff'];
  return (
    <svg viewBox="0 0 120 120" className="xh-corner-bow" aria-hidden="true" focusable="false">
      <path d="M0 22 L98 120 L120 120 L120 98 L22 0 L0 0 Z" fill={c[0]} opacity=".95" />
      <path d="M0 22 L98 120" stroke={c[1]} strokeOpacity=".5" />
      <g transform="translate(60 60) rotate(45)">
        <path d="M0 0 C -14 -24 -34 -20 -30 -6 C -27 4 -12 4 0 0 Z M0 0 C 14 -24 34 -20 30 -6 C 27 4 12 4 0 0 Z" fill={c[0]} stroke={c[1]} strokeOpacity=".55" />
        <path d="M-3 3 L -12 26 L -5 22 L -2 30 L 2 4 Z M3 3 L 12 26 L 5 22 L 2 30 L -2 4 Z" fill={c[1]} />
        <ellipse rx="6" ry="5" fill={c[2]} />
      </g>
    </svg>
  );
};

/** A wooden peg that holds a card on the twine. */
export const Peg = () => (
  <svg viewBox="0 0 22 46" className="xh-peg" aria-hidden="true" focusable="false">
    <rect x="3" y="0" width="7" height="44" rx="2" fill="#c89a62" />
    <rect x="12" y="0" width="7" height="44" rx="2" fill="#b48451" />
    <rect x="1" y="16" width="20" height="6" rx="1.5" fill="#8f939a" />
  </svg>
);

/** Mystery Greetings preview: an open envelope (back with its raised flap, then the front pocket). The letter card
 *  is real HTML between the two layers, so it can rise out of the pocket. */
export const EnvelopeBack = () => (
  <svg viewBox="0 0 400 320" className="xh-env-back" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="xa-e-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a0f1f" /><stop offset="1" stopColor="#2e0813" /></linearGradient>
      <linearGradient id="xa-e-flap" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#6f1430" /><stop offset="1" stopColor="#8e1d35" /></linearGradient>
    </defs>
    <path className="xh-env-flap" d="M6 118 L186 30 Q200 23 214 30 L394 118 Z" fill="url(#xa-e-flap)" />
    <path d="M6 118 L186 30 Q200 23 214 30 L394 118" fill="none" stroke="#e9b949" strokeOpacity=".3" strokeWidth="1.2" />
    <rect x="0" y="112" width="400" height="208" rx="16" fill="url(#xa-e-back)" />
  </svg>
);
export const EnvelopeFront = () => (
  <svg viewBox="0 0 400 320" className="xh-env-front" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="xa-e-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a8264a" /><stop offset="1" stopColor="#6f1430" /></linearGradient>
      <linearGradient id="xa-e-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8e1d35" /><stop offset="1" stopColor="#7a1830" /></linearGradient>
      <radialGradient id="xa-e-seal" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#fbe7a6" /><stop offset=".5" stopColor="#e9b949" /><stop offset="1" stopColor="#a8771d" /></radialGradient>
    </defs>
    <path d="M0 132 L176 226 Q200 238 224 226 L400 132 V304 Q400 320 384 320 H16 Q0 320 0 304 Z" fill="url(#xa-e-front)" />
    <path d="M0 304 L170 214 M400 304 L230 214" stroke="#4a0f1f" strokeOpacity=".35" strokeWidth="1.5" />
    <path d="M0 132 L176 226 Q200 238 224 226 L400 132" fill="none" stroke="#f3d79a" strokeOpacity=".45" strokeWidth="1.4" />
    <g transform="translate(200 228)">
      <circle r="27" fill="#a8771d" opacity=".55" transform="translate(1.5 2)" />
      <path d="M0 -26 C 8 -26 12 -22 17 -19 C 24 -15 27 -8 26 0 C 27 9 22 15 17 19 C 11 24 6 27 0 26 C -8 27 -13 23 -18 19 C -24 14 -27 8 -26 0 C -27 -9 -23 -15 -17 -19 C -12 -23 -7 -27 0 -26 Z" fill="url(#xa-e-seal)" />
      <circle r="17" fill="none" stroke="#fff1c1" strokeOpacity=".55" />
      <path d="M-9 7 V-7 L0 2 L9 -7 V7" fill="none" stroke="#7a4f12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

/** The Marketplace stack: three kraft parcels, twine and a red tag carrying the season's greeting. */
export const ParcelStack = ({ label }: { label: string }) => (
  <svg viewBox="0 0 360 260" className="xh-parcels" aria-hidden="true" focusable="false">
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
          <text x="6" y="20.5" className="xh-parcel-tag-text">{label}</text>
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
