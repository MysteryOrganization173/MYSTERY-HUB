import React, { useId } from 'react';

/**
 * The Orders page's own artwork (3.6.2): a Mystery Hub receipt, its torn edge, and a green seal. Original SVG drawn in
 * code, decorative only (aria-hidden), and still: it settles once on arrival and never loops.
 */
export function ReceiptArt({ className = '' }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d2a33" /><stop offset="1" stopColor="#121b22" /></linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3cf39d" /><stop offset="1" stopColor="#00a656" /></linearGradient>
        <radialGradient id={`${id}g`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#00c365" stopOpacity=".35" /><stop offset="1" stopColor="#00c365" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="62" cy="94" rx="40" ry="5" fill="#000" opacity=".35" />
      <g className="mh-or-art-paper">
        <g transform="rotate(-6 60 50)">
          {/* The slip, with a torn lower edge. */}
          <path d="M30 8 h52 a6 6 0 0 1 6 6 V84 l-5 -4 -5 4 -5 -4 -5 4 -5 -4 -5 4 -5 -4 -5 4 -5 -4 -5 4 -5 -4 -4 4 V14 a6 6 0 0 1 6 -6 z" fill={`url(#${id}p)`} stroke="#2e3e4a" strokeWidth="1.2" />
          <rect x="38" y="17" width="12" height="12" rx="3.5" fill="#00c365" />
          <path d="M41 26 V20.5 l3 3.2 3 -3.2 V26" stroke="#03160c" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="54" y="19" width="24" height="3.2" rx="1.6" fill="#c5cfd9" opacity=".75" />
          <rect x="54" y="25" width="15" height="2.6" rx="1.3" fill="#8d9cad" opacity=".6" />
          <path d="M38 37 H80" stroke="#2e3e4a" strokeWidth="1.2" strokeDasharray="2.5 2.5" />
          <rect x="38" y="43" width="20" height="2.6" rx="1.3" fill="#8d9cad" opacity=".55" />
          <rect x="66" y="43" width="14" height="2.6" rx="1.3" fill="#c5cfd9" opacity=".7" />
          <rect x="38" y="50" width="16" height="2.6" rx="1.3" fill="#8d9cad" opacity=".55" />
          <rect x="62" y="50" width="18" height="2.6" rx="1.3" fill="#c5cfd9" opacity=".7" />
          <path d="M38 59 H80" stroke="#2e3e4a" strokeWidth="1.2" strokeDasharray="2.5 2.5" />
          <rect x="38" y="65" width="14" height="3" rx="1.5" fill="#8d9cad" opacity=".55" />
          <rect x="60" y="63.5" width="20" height="6" rx="2" fill="#f3f6f8" opacity=".9" />
        </g>
      </g>
      <g className="mh-or-art-seal">
        <circle cx="90" cy="72" r="20" fill={`url(#${id}g)`} />
        <circle cx="90" cy="72" r="12.5" fill={`url(#${id}s)`} stroke="#0b1217" strokeWidth="2.5" />
        <path d="M84.5 72.4 l3.6 3.6 l7.2 -7.6" stroke="#03160c" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
