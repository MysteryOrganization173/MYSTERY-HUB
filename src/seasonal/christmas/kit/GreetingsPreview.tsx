import React, { useId } from 'react';
// Styles: kit.css, loaded by each seasonal homepage's chunk (this file stays importable by the pure, testable views).
import { ArrowRight, Lock } from 'lucide-react';
import { GREETINGS_ENTRY, type GreetingsEntry } from './greetings';

/**
 * The Mystery Greetings entry, built for any seasonal page (it takes no account data). While the feature is not open it
 * is an honest preview: what a greeting will be, the three steps, and "Not open yet", with no button that pretends to
 * create anything. Once `entry` is open it becomes a link to the shared creator, for guests and members alike.
 */
export function GreetingsPreview({ newYear = false, headingId, entry = GREETINGS_ENTRY }: { newYear?: boolean; headingId: string; entry?: GreetingsEntry }) {
  return (
    <section className="xk-greet" aria-labelledby={headingId}>
      <div className="xk-greet-text">
        <p className="xk-greet-badge">{entry.state === 'open' ? 'New this season' : 'Coming soon'}</p>
        <h2 id={headingId}>Mystery Greetings</h2>
        <p className="xk-greet-lede">Wrap a personal {newYear ? 'New Year' : 'Christmas'} greeting as a digital gift. They open it, and your words are revealed.</p>
        <ol className="xk-greet-steps">
          <li><b aria-hidden="true">1</b>Choose a design</li>
          <li><b aria-hidden="true">2</b>Write your message</li>
          <li><b aria-hidden="true">3</b>Share the link</li>
        </ol>
        {entry.state === 'open'
          ? <a className="xk-greet-cta" href={entry.createHref}>Create a greeting<ArrowRight className="size-4" aria-hidden="true" /></a>
          : <p className="xk-greet-note"><Lock className="size-3.5" aria-hidden="true" />Not open yet. It will appear right here when it is ready.</p>}
      </div>
      <div className="xk-greet-art" aria-hidden="true"><GreetingEnvelope newYear={newYear} /></div>
    </section>
  );
}

/** A velvet envelope with a cream letter waiting inside (berry for Christmas, midnight for New Year). */
function GreetingEnvelope({ newYear }: { newYear: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg viewBox="0 0 160 120" className="xk-env" focusable="false">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={newYear ? '#2b4682' : '#a8264a'} /><stop offset="1" stopColor={newYear ? '#14254a' : '#6f1430'} /></linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffaf0" /><stop offset="1" stopColor="#f1e5cc" /></linearGradient>
        <radialGradient id={`${id}s`} cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#fbe7a6" /><stop offset=".55" stopColor="#e9b949" /><stop offset="1" stopColor="#a8771d" /></radialGradient>
      </defs>
      <ellipse cx="80" cy="112" rx="58" ry="5" fill="#000" opacity=".35" />
      <g transform="rotate(-5 80 70)">
        <rect x="18" y="44" width="124" height="66" rx="7" fill={`url(#${id}b)`} />
        <g className="xk-env-letter">
          <rect x="30" y="16" width="100" height="70" rx="4" fill={`url(#${id}l)`} stroke="#e2d1ad" />
          <path d="M42 30 h40" stroke="#8e1d35" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M42 42 h76 M42 51 h70 M42 60 h58" stroke="#c9b48a" strokeWidth="2" strokeLinecap="round" />
        </g>
        <path d="M18 51 L80 86 L142 51 V110 H18 Z" fill={`url(#${id}b)`} />
        <path d="M18 110 L66 78 M142 110 L94 78" stroke="#000" strokeOpacity=".22" strokeWidth="1.2" />
        <path d="M18 51 L80 86 L142 51" fill="none" stroke="#f3d79a" strokeOpacity=".45" strokeWidth="1.3" />
        <circle cx="80" cy="86" r="10" fill={`url(#${id}s)`} />
        <path d="M75.5 89 V83 L80 87.4 L84.5 83 V89" fill="none" stroke="#7a4f12" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
