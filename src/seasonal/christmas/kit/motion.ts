import React, { useLayoutEffect, useSyncExternalStore } from 'react';

/**
 * Motion rules shared by the seasonal homepages (guest and member). The aim is motion that is predictable:
 * - every element has one owner for its motion: an entrance plays on one element, a press reaction on another, so
 *   they can never replace (and so restart) each other;
 * - an entrance plays once per visit, then is removed, so a re-render, a press or Back to the page never replays it;
 * - nothing is ever left hidden: without IntersectionObserver, or with reduced motion, everything is simply shown.
 */

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Moments already seen in this visit (module memory: it survives remounts, such as Back to the homepage). */
const seen = new Set<string>();
export const seenThisVisit = (key: string) => seen.has(key);
export const markSeen = (key: string) => { seen.add(key); };

/**
 * Compositions marked `data-xh-reveal="<name>"` settle in once per visit as they scroll into view.
 * - armed (`data-xh-armed`): held back, waiting to arrive; in (`data-xh-in`): the entrance plays;
 * - done (`data-xh-done`): the entrance has had time to finish and its animation is removed for good.
 * Anything already seen this visit, or already scrolled past (a restored scroll position), appears settled at once.
 */
export function useReveal(root: React.RefObject<HTMLElement | null>, scope: string, settleMs = 1900) {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-xh-reveal]'));
    const timers: number[] = [];
    const key = (item: HTMLElement) => `${scope}:${item.dataset.xhReveal || ''}`;
    const settle = (item: HTMLElement) => { item.removeAttribute('data-xh-armed'); item.setAttribute('data-xh-in', ''); item.setAttribute('data-xh-done', ''); };
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') { items.forEach(settle); return; }
    const io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const item = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          item.setAttribute('data-xh-in', ''); markSeen(key(item)); io.unobserve(item);
          timers.push(window.setTimeout(() => item.setAttribute('data-xh-done', ''), settleMs));
        } else if (entry.boundingClientRect.bottom <= 0) {
          settle(item); markSeen(key(item)); io.unobserve(item);
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
    for (const item of items) {
      if (seenThisVisit(key(item))) settle(item);
      else { item.setAttribute('data-xh-armed', ''); io.observe(item); }
    }
    return () => { io.disconnect(); timers.forEach(t => window.clearTimeout(t)); };
  }, [root, scope, settleMs]);
}

/**
 * Plays a card's one-shot press reaction (touch, mouse, or Enter/Space). The reaction lives on the card's inner
 * artwork, never on the card itself, so it cannot disturb the card's entrance or its navigation.
 */
export const press = (e: React.PointerEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
  if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.currentTarget; el.removeAttribute('data-press'); void el.offsetWidth; el.setAttribute('data-press', '');
};
/** Clears the press once its last reaction has finished (a card can play several of different lengths). */
export const pressEnd = (e: React.AnimationEvent<HTMLElement>) => {
  if (!e.animationName.startsWith('xh-press')) return;
  const el = e.currentTarget;
  const still = typeof el.getAnimations === 'function' && el.getAnimations({ subtree: true }).some(a => a.playState === 'running' && String((a as Animation & { animationName?: string }).animationName || '').startsWith('xh-press'));
  if (!still) el.removeAttribute('data-press');
};

/**
 * A controlled swing for something hanging (a pegged design, a gift tag). It runs on the element itself through the
 * Web Animations API, independent of any CSS entrance; a tap while it is still swinging is ignored rather than
 * restarting it, so it never jumps.
 */
export function swing(el: HTMLElement | SVGElement | null, amplitude = 7, duration = 1200) {
  if (!el || prefersReducedMotion() || typeof (el as HTMLElement).animate !== 'function') return;
  if ((el as HTMLElement).getAnimations?.().some(a => a.id === 'xh-swing' && a.playState === 'running')) return;
  const a = (el as HTMLElement).animate([
    { transform: 'rotate(0deg)' }, { transform: `rotate(${amplitude}deg)` }, { transform: `rotate(${-amplitude * 0.7}deg)` },
    { transform: `rotate(${amplitude * 0.38}deg)` }, { transform: `rotate(${-amplitude * 0.14}deg)` }, { transform: 'rotate(0deg)' },
  ], { duration, easing: 'cubic-bezier(.3,.6,.3,1)' });
  a.id = 'xh-swing';
}

/** A media query as React state (no flicker: the first render already knows the answer). */
export function useMedia(query: string) {
  return useSyncExternalStore(
    notify => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const m = window.matchMedia(query); m.addEventListener?.('change', notify);
      return () => m.removeEventListener?.('change', notify);
    },
    () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches,
    () => false,
  );
}

/**
 * Keeps SVG words inside their tag. Each `<text data-fit="<max width>">` is measured; a line that is wider than its
 * room (a longer New Year greeting, or a fallback font while the serif loads) is condensed to fit instead of
 * spilling over the edge. Measured again once web fonts have loaded.
 */
export function useFitSvgText(ref: React.RefObject<SVGSVGElement | null>, deps: React.DependencyList) {
  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    let alive = true;
    const fit = () => {
      if (!alive) return;
      for (const t of Array.from(svg.querySelectorAll<SVGTextElement>('text[data-fit]'))) {
        t.removeAttribute('textLength'); t.removeAttribute('lengthAdjust');
        const max = Number(t.dataset.fit);
        if (Number.isFinite(max) && t.getComputedTextLength() > max) { t.setAttribute('textLength', String(max)); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
      }
    };
    fit();
    void document.fonts?.ready?.then(fit).catch(() => undefined);
    return () => { alive = false; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
