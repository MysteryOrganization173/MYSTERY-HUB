import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { GiftArt, PALETTES } from './GiftArt';
import { MYSTERY_SENDER, OCCASION_COPY, nameScale, type Occasion, type Variant } from './model';

export interface StageGreeting { occasion: Occasion; variant: Variant; recipientName: string; senderName: string | null; message: string }
export type StageState = 'sealed' | 'opening' | 'open';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
export const OPEN_MS = 1700, OPEN_REDUCED_MS = 240;

/** Deterministic sparks for the reveal: an upward fan at Christmas, a firework ring for the New Year starlight gift. */
export function sparkLayout(occasion: Occasion, variant: Variant) {
  const starlight = variant === 'gift-starlight-v1', ring = starlight && occasion === 'new-year-2027';
  const p = PALETTES[`${occasion}:${variant}`];
  const colors = occasion === 'christmas-2026' ? [p.ribbon[0], p.ribbon[1], '#fff6df', '#e05473'] : [p.ribbon[0], p.ribbon[1], '#ffffff', '#f2d58c'];
  const count = starlight ? 18 : 12;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const angle = ring ? (i / count) * Math.PI * 2 : (-160 + t * 140) * Math.PI / 180;
    const reach = (ring ? 92 : 78) + ((i * 37) % 5) * 11;
    return {
      dx: Math.round(Math.cos(angle) * reach), dy: Math.round(Math.sin(angle) * reach * (ring ? .9 : 1.05)),
      delay: 360 + ((i * 53) % 7) * 34, size: starlight ? 7 + ((i * 29) % 3) * 3 : 5 + ((i * 31) % 3) * 2,
      color: colors[i % colors.length], star: starlight && i % 3 !== 2,
    };
  });
}

/**
 * The sealed gift, the reveal and the letter, shared by the recipient page and the creator's preview so the preview
 * is exactly what the recipient will see. One obvious action opens it; the letter is real text in the document
 * (screen readers, zoom, translation) and only appears once the gift is opened. Without motion it simply cross-fades.
 */
export function GreetingStage({ greeting, preview = false, headingLevel = 1, onReveal, after, onStateChange }: {
  greeting: StageGreeting; preview?: boolean; headingLevel?: 1 | 2; onReveal?: () => void;
  after?: (replay: () => void) => ReactNode; onStateChange?: (state: StageState) => void;
}) {
  const [state, setState] = useState<StageState>('sealed');
  const [fromY, setFromY] = useState(160);
  const stage = useRef<HTMLDivElement>(null), gift = useRef<HTMLButtonElement>(null), letterHeading = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusAfter = useRef<'letter' | 'gift' | null>(null);
  const copy = OCCASION_COPY[greeting.occasion];
  // Once opened, the sealed heading is gone, so the letter's greeting takes over as the page's top heading (one h1).
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const LetterHeading = state === 'open' ? Heading : headingLevel === 1 ? 'h2' : 'h3';
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { onStateChange?.(state); }, [state, onStateChange]);
  useLayoutEffect(() => {
    if (state === 'open' && focusAfter.current === 'letter') letterHeading.current?.focus({ preventScroll: true });
    if (state === 'sealed' && focusAfter.current === 'gift') gift.current?.focus({ preventScroll: true });
    focusAfter.current = null;
  }, [state]);

  const open = useCallback(() => {
    if (state !== 'sealed') return;
    const box = gift.current?.getBoundingClientRect(), top = stage.current?.getBoundingClientRect();
    if (box && top) setFromY(Math.max(0, Math.round(box.top - top.top + box.height * .36)));
    // Bring the whole scene into view first on short screens, so the reveal is seen from its start.
    if (top && top.top < 0) stage.current?.scrollIntoView({ block: 'start' });
    setState('opening');
    onReveal?.();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { focusAfter.current = 'letter'; setState('open'); }, reducedMotion() ? OPEN_REDUCED_MS : OPEN_MS);
  }, [state, onReveal]);
  const replay = useCallback(() => {
    clearTimeout(timer.current);
    focusAfter.current = 'gift';
    setState('sealed');
    stage.current?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, []);

  const sender = greeting.senderName;
  const sparks = sparkLayout(greeting.occasion, greeting.variant);
  return (
    <div ref={stage} className="mg-stage" data-state={state} data-preview={preview || undefined} style={{ '--mg-from-y': `${fromY}px` } as CSSProperties}>
      <div className="mg-sealed" aria-hidden={state === 'open' || undefined}>
        <header className="mg-sealed-head">
          <Heading className="mg-sealed-title">
            <span className="mg-sealed-kicker">{copy.sealedKicker}</span>{' '}
            <span className="mg-name" data-scale={nameScale(greeting.recipientName)}>{greeting.recipientName}</span>
          </Heading>
          <p className="mg-from">From <span className="mg-from-name">{sender || MYSTERY_SENDER}</span></p>
        </header>
        <button ref={gift} type="button" className="mg-gift-button" onClick={open} disabled={state !== 'sealed'}>
          <span className="mg-gift" data-state={state}>
            <span className="mg-gift-halo" aria-hidden="true" />
            <GiftArt occasion={greeting.occasion} variant={greeting.variant} />
            <span className="mg-sparks" aria-hidden="true">
              {sparks.map((s, i) => <span key={i} className={`mg-spark${s.star ? ' mg-spark-star' : ''}`} style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, '--d': `${s.delay}ms`, '--s': `${s.size}px`, '--c': s.color } as CSSProperties} />)}
            </span>
          </span>
          <span className="mg-open-pill">{copy.open}</span>
        </button>
        {preview && <p className="mg-preview-hint">This is a preview. Nothing is saved yet.</p>}
      </div>
      <span className="mg-bloom" aria-hidden="true" />
      <article className="mg-letter" aria-hidden={state !== 'open' || undefined}>
        <span className="mg-letter-ornament" aria-hidden="true">{greeting.occasion === 'new-year-2027' ? <NewYearOrnament /> : <HollyOrnament />}</span>
        <LetterHeading ref={letterHeading} tabIndex={-1} className="mg-letter-title">
          <span className="mg-letter-kicker">{copy.greeting},</span>{' '}
          <span className="mg-letter-name" data-scale={nameScale(greeting.recipientName)}>{greeting.recipientName}</span>
        </LetterHeading>
        <p className="mg-letter-message">{greeting.message}</p>
        <p className="mg-letter-sign"><span className="mg-sign-label">From</span> <span className="mg-sign-name">{sender || MYSTERY_SENDER}</span></p>
        <p className="mg-letter-foot">{copy.short}</p>
      </article>
      {state === 'open' && after && <div className="mg-after">{after(replay)}</div>}
    </div>
  );
}

function HollyOrnament() {
  return (
    <svg viewBox="0 0 64 28" width="64" height="28" focusable="false">
      <path d="M31 15 C 24 4, 10 4, 6 11 C 12 11, 13 16, 9 19 C 17 22, 26 21, 31 15 Z" fill="#2f6b4b" />
      <path d="M33 15 C 40 4, 54 4, 58 11 C 52 11, 51 16, 55 19 C 47 22, 38 21, 33 15 Z" fill="#245a3e" />
      <path d="M31 15 C 22 12, 14 11, 8 12 M33 15 C 42 12, 50 11, 56 12" stroke="#173d2a" strokeWidth=".9" fill="none" />
      <circle cx="28.5" cy="17" r="4.2" fill="#b3263f" /><circle cx="35.5" cy="17" r="4.2" fill="#9c1f37" /><circle cx="32" cy="12.5" r="4.2" fill="#c3304f" />
      <circle cx="31" cy="11.3" r="1.2" fill="#fff" opacity=".6" />
    </svg>
  );
}
function NewYearOrnament() {
  return (
    <svg viewBox="0 0 64 28" width="64" height="28" focusable="false">
      <path d="M32 2 L34.6 11.4 L44 14 L34.6 16.6 L32 26 L29.4 16.6 L20 14 L29.4 11.4 Z" fill="#c9a24c" />
      <path d="M12 9 L13 12 L16 13 L13 14 L12 17 L11 14 L8 13 L11 12 Z M52 9 L53 12 L56 13 L53 14 L52 17 L51 14 L48 13 L51 12 Z" fill="#d8bf7c" />
      <circle cx="4" cy="14" r="1.3" fill="#d8bf7c" /><circle cx="60" cy="14" r="1.3" fill="#d8bf7c" />
    </svg>
  );
}
