import React from 'react';

/**
 * Small illustrations for the signed-in Christmas homepage, drawn in the same light and materials as the guest
 * homepage's hero (evergreen velvet, champagne satin, cream paper). Decorative (aria-hidden).
 */

/** A small velvet gift for the welcome band. A press lifts the lid for a moment and lets a few sparks out. */
export function MemberGift() {
  return (
    <svg viewBox="0 0 120 112" className="xm-gift-art" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="xm-g-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#18734f" /><stop offset="1" stopColor="#0a3626" /></linearGradient>
        <linearGradient id="xm-g-side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d3d2c" /><stop offset="1" stopColor="#052117" /></linearGradient>
        <linearGradient id="xm-g-lid" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#1c7f59" /><stop offset="1" stopColor="#2a9a6d" /></linearGradient>
        <linearGradient id="xm-g-band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#b98326" /><stop offset=".45" stopColor="#ffeebe" /><stop offset="1" stopColor="#a87420" /></linearGradient>
        <linearGradient id="xm-g-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3c9" /><stop offset=".45" stopColor="#f0c766" /><stop offset="1" stopColor="#9c6b1c" /></linearGradient>
        <radialGradient id="xm-g-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ffe3a0" stopOpacity=".55" /><stop offset="1" stopColor="#e9b949" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="58" cy="54" r="54" fill="url(#xm-g-glow)" />
      <ellipse cx="58" cy="102" rx="40" ry="6" fill="#000" opacity=".45" />
      <g className="xm-gift-body">
        <rect x="22" y="52" width="62" height="48" fill="url(#xm-g-front)" />
        <polygon points="84,52 98,44 98,92 84,100" fill="url(#xm-g-side)" />
        <rect x="48" y="52" width="10" height="48" fill="url(#xm-g-band)" />
        <polygon points="89,49 92,47 92,95 89,97" fill="#c99230" />
        <rect x="23" y="51" width="60" height="3" rx="1.5" fill="#ffe8a6" opacity=".85" />
      </g>
      <g className="xm-gift-lid">
        <polygon points="18,42 32,34 102,34 88,42" fill="url(#xm-g-lid)" />
        <rect x="18" y="42" width="70" height="11" fill="#1f8460" />
        <polygon points="88,42 102,34 102,45 88,53" fill="#11573e" />
        <polygon points="48,42 58,42 72,34 62,34" fill="#f6d683" />
        <rect x="48" y="42" width="10" height="11" fill="url(#xm-g-band)" />
        <path d="M60 38 C 46 22 32 26 35 35 C 37 41 49 41 60 38 Z" fill="url(#xm-g-gold)" />
        <path d="M60 38 C 74 22 88 26 85 35 C 83 41 71 41 60 38 Z" fill="url(#xm-g-gold)" />
        <path d="M57 40 C 53 48 49 52 44 58 L 49 58 L 51 62 C 55 54 58 48 60 41 Z M63 40 C 67 48 71 52 76 58 L 71 58 L 69 62 C 65 54 62 48 60 41 Z" fill="url(#xm-g-gold)" />
        <ellipse cx="60" cy="39" rx="5" ry="4" fill="#f6d683" stroke="#a8771d" strokeWidth=".8" />
      </g>
      {/* Each spark is placed by its group, so the press animation (on the inner path) never moves it. */}
      <g className="xm-gift-sparks" fill="#f7dc8f">
        {[[30, 22, 4], [94, 18, 3.5], [60, 8, 3], [16, 46, 2.6], [108, 40, 2.6]].map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${r / 10})`}>
            <path className="xm-spark" style={{ '--i': i } as React.CSSProperties} d="M0 -10 C 1 -3 3 -1 10 0 C 3 1 1 3 0 10 C -1 3 -3 1 -10 0 C -3 -1 -1 -3 0 -10 Z" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** A sealed envelope for the Mystery Greetings teaser (a preview of the feature, not a working action). */
export function MiniEnvelope() {
  return (
    <svg viewBox="0 0 120 84" className="xm-env-art" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="xm-e-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a8264a" /><stop offset="1" stopColor="#6f1430" /></linearGradient>
        <radialGradient id="xm-e-seal" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#fbe7a6" /><stop offset=".55" stopColor="#e9b949" /><stop offset="1" stopColor="#a8771d" /></radialGradient>
      </defs>
      <g transform="rotate(-6 60 42)">
        <rect x="10" y="12" width="100" height="64" rx="7" fill="url(#xm-e-body)" />
        <path d="M10 18 L60 50 L110 18" fill="none" stroke="#f3d79a" strokeOpacity=".5" strokeWidth="1.4" />
        <path d="M10 76 L48 44 M110 76 L72 44" fill="none" stroke="#4a0f1f" strokeOpacity=".4" strokeWidth="1.2" />
        <circle cx="60" cy="50" r="9" fill="url(#xm-e-seal)" />
        <path d="M56 53 V47 L60 51 L64 47 V53" fill="none" stroke="#7a4f12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
