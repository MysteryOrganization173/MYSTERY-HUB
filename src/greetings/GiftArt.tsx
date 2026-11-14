import { useId } from 'react';
import type { Occasion, Variant } from './model';

/**
 * The Mystery Greetings gift: one drawing, four looks (occasion × design). Plain SVG with gradients only (no filters),
 * so it stays crisp and cheap on modest Android phones. Parts carry class names for the reveal: the bow unties, the lid
 * lifts away and light rises from inside. Purely decorative: the button around it carries the words.
 */
export const PALETTES = {
  'christmas-2026:gift-classic-v1': { box: ['#c3304f', '#8a1834', '#5c0f24'], lid: ['#d7486a', '#a52042'], ribbon: ['#fbe7a6', '#e2b44a', '#a8771d'], pattern: null, tag: '#fbf4e6', mark: '#b3263f' },
  'christmas-2026:gift-starlight-v1': { box: ['#1d6b4f', '#0f4533', '#082a1f'], lid: ['#2a7d5d', '#145238'], ribbon: ['#fff3cf', '#eac46a', '#b0832a'], pattern: '#f7dc8f', tag: '#fbf4e6', mark: '#0f4533' },
  'new-year-2027:gift-classic-v1': { box: ['#35569c', '#1f3768', '#111f40'], lid: ['#4467b0', '#253f78'], ribbon: ['#fbf3dc', '#dcc489', '#9a8146'], pattern: null, tag: '#fbf7ec', mark: '#1f3768' },
  'new-year-2027:gift-starlight-v1': { box: ['#262c55', '#151a3a', '#0a0d24'], lid: ['#323a6c', '#1b2147'], ribbon: ['#ffffff', '#cdd3e6', '#8d96b3'], pattern: '#e9ddb8', tag: '#f6f4ee', mark: '#262c55' },
} as const;

export function GiftArt({ occasion, variant, className = '' }: { occasion: Occasion; variant: Variant; className?: string }) {
  const p = PALETTES[`${occasion}:${variant}`];
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const u = (name: string) => `url(#${id}${name})`;
  const newYear = occasion === 'new-year-2027';
  return (
    <svg className={`mg-gift-art ${className}`} viewBox="0 0 260 260" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}box`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.box[0]} /><stop offset=".55" stopColor={p.box[1]} /><stop offset="1" stopColor={p.box[2]} /></linearGradient>
        <linearGradient id={`${id}side`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity=".16" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /><stop offset=".8" stopColor="#000" stopOpacity=".12" /><stop offset="1" stopColor="#000" stopOpacity=".32" /></linearGradient>
        <linearGradient id={`${id}lid`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.lid[0]} /><stop offset="1" stopColor={p.lid[1]} /></linearGradient>
        <linearGradient id={`${id}top`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.lid[0]} /><stop offset="1" stopColor={p.box[0]} /></linearGradient>
        <linearGradient id={`${id}rib`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={p.ribbon[2]} /><stop offset=".3" stopColor={p.ribbon[0]} /><stop offset=".55" stopColor={p.ribbon[1]} /><stop offset="1" stopColor={p.ribbon[2]} /></linearGradient>
        <linearGradient id={`${id}ribv`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.ribbon[0]} /><stop offset=".6" stopColor={p.ribbon[1]} /><stop offset="1" stopColor={p.ribbon[2]} /></linearGradient>
        <radialGradient id={`${id}knot`} cx="40%" cy="35%" r="70%"><stop offset="0" stopColor={p.ribbon[0]} /><stop offset=".6" stopColor={p.ribbon[1]} /><stop offset="1" stopColor={p.ribbon[2]} /></radialGradient>
        <radialGradient id={`${id}shadow`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#000" stopOpacity=".55" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}light`} cx="50%" cy="100%" r="100%"><stop offset="0" stopColor="#fff8e0" stopOpacity=".95" /><stop offset=".35" stopColor={p.ribbon[0]} stopOpacity=".55" /><stop offset="1" stopColor={p.ribbon[0]} stopOpacity="0" /></radialGradient>
        {p.pattern && (
          <pattern id={`${id}stars`} width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M7 3 L8.2 6.8 L12 8 L8.2 9.2 L7 13 L5.8 9.2 L2 8 L5.8 6.8 Z" fill={p.pattern} opacity=".7" />
            <path d="M21 16 L21.7 18.3 L24 19 L21.7 19.7 L21 22 L20.3 19.7 L18 19 L20.3 18.3 Z" fill={p.pattern} opacity=".55" />
            <circle cx="18" cy="5" r=".9" fill={p.pattern} opacity=".6" /><circle cx="5" cy="22" r=".7" fill={p.pattern} opacity=".5" />
          </pattern>
        )}
      </defs>
      <ellipse className="mg-art-shadow" cx="130" cy="232" rx="96" ry="13" fill={u('shadow')} />
      {/* Light that rises from inside when the lid comes off. */}
      <path className="mg-art-rays" d="M58 116 L20 0 H240 L202 116 Z" fill={u('light')} />
      <g className="mg-art-box">
        <rect x="48" y="114" width="164" height="114" rx="7" fill={u('box')} />
        {p.pattern && <rect x="48" y="114" width="164" height="114" rx="7" fill={u('stars')} />}
        <rect x="48" y="114" width="164" height="114" rx="7" fill={u('side')} />
        <ellipse className="mg-art-glow" cx="130" cy="116" rx="74" ry="9" fill="#fff6d8" />
        <rect x="118" y="114" width="24" height="114" fill={u('ribv')} />
        <rect x="48" y="158" width="164" height="22" fill={u('rib')} opacity=".96" />
        <rect x="118" y="158" width="24" height="22" fill={p.ribbon[1]} />
        <path d="M48 228 H212" stroke="#000" strokeOpacity=".25" strokeWidth="2" />
      </g>
      <g className="mg-art-lid">
        <path d="M50 78 H210 L220 92 H40 Z" fill={u('top')} />
        {p.pattern && <path d="M50 78 H210 L220 92 H40 Z" fill={u('stars')} />}
        <rect x="38" y="90" width="184" height="32" rx="6" fill={u('lid')} />
        {p.pattern && <rect x="38" y="90" width="184" height="32" rx="6" fill={u('stars')} />}
        <rect x="38" y="90" width="184" height="32" rx="6" fill={u('side')} />
        <path d="M121 78 H139 L143 92 H117 Z" fill={u('ribv')} />
        <rect x="116" y="90" width="28" height="32" fill={u('ribv')} />
        <path d="M40 92 H220" stroke="#fff" strokeOpacity=".22" strokeWidth="1.2" />
        <path d="M38 122 H222" stroke="#000" strokeOpacity=".28" strokeWidth="2" />
      </g>
      <g className="mg-art-bow">
        <path d="M127 86 L109 116 L117 113 L120 121 L133 89 Z" fill={u('ribv')} />
        <path d="M133 86 L151 116 L143 113 L140 121 L127 89 Z" fill={u('ribv')} />
        <path d="M130 82 C 110 56, 78 54, 81 72 C 84 89, 112 89, 130 82 Z" fill={u('knot')} />
        <path d="M130 82 C 150 56, 182 54, 179 72 C 176 89, 148 89, 130 82 Z" fill={u('knot')} />
        <path d="M127 80 C 113 66, 94 65, 94 73 C 95 81, 112 83, 127 80 Z" fill={p.ribbon[2]} opacity=".55" />
        <path d="M133 80 C 147 66, 166 65, 166 73 C 165 81, 148 83, 133 80 Z" fill={p.ribbon[2]} opacity=".55" />
        <path d="M84 70 C 92 62, 106 62, 114 70" stroke="#fff" strokeOpacity=".45" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <ellipse cx="130" cy="83" rx="10" ry="8.5" fill={u('knot')} />
        <path d="M124 80 C 127 77, 133 77, 136 80" stroke="#fff" strokeOpacity=".5" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {/* The tag: a holly sprig at Christmas, a small star for the New Year. */}
        <path d="M168 76 C 178 84, 184 96, 186 106" stroke={p.ribbon[1]} strokeWidth="1.3" fill="none" />
        <g transform="rotate(14 192 118)">
          <path d="M178 106 H206 V130 H178 L172 118 Z" fill={p.tag} />
          <circle cx="180" cy="118" r="2.2" fill={p.ribbon[2]} />
          {newYear
            ? <path d="M193 110.5 L195 116 L200.5 118 L195 120 L193 125.5 L191 120 L185.5 118 L191 116 Z" fill={p.mark} />
            : <g><path d="M188 117 C 190 111, 196 111, 197 115 C 199 112, 203 114, 201 118 C 203 121, 199 124, 197 121 C 196 125, 190 124, 188 117 Z" fill="#1f5a3f" /><circle cx="194" cy="121" r="2" fill={p.mark} /><circle cx="197.5" cy="122.5" r="1.7" fill={p.mark} /></g>}
        </g>
      </g>
    </svg>
  );
}
