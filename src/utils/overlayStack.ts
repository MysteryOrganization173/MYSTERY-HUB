import { useLayoutEffect, type RefObject } from 'react';

/**
 * One page-scroll lock and one modal stack shared by every blocking overlay (dialogs, sheets, the phone menu).
 *
 * V5.2 root cause: `html` has `overflow-x: clip`, so `body { overflow: hidden }` is never propagated to the
 * viewport. Every overlay locked only <body>, while the viewport (the real page scroller) kept scrolling under
 * touch and wheel input, including scroll chained out of the template preview iframe. The lock therefore sits on
 * the root element (`html.mh-scroll-locked`, see index.css). An overflow lock keeps the page exactly where it was,
 * so nothing has to be restored on release and route changes are never fought.
 *
 * The topmost modal entry makes the rest of the app `inert`. Only nodes inside #root are touched, so a third-party
 * payment window (Paystack appends its iframe to <body>) is never blocked. Native <dialog>.showModal() keeps its
 * own top-layer inertness; index.css locks the page for those with `html:has(dialog:modal)`.
 */
type Entry = { surface: HTMLElement | null; modal: boolean };
const stack: Entry[] = [];
let marked: HTMLElement[] = [];
let savedBodyOverflow = '';

/** The overlay's own layer: its outermost fixed-position ancestor, so a backdrop beside the surface stays usable. */
function overlayLayer(surface: HTMLElement, root: HTMLElement) {
  let layer = surface;
  for (let node = surface.parentElement; node && node !== root; node = node.parentElement) {
    if (getComputedStyle(node).position === 'fixed') layer = node;
  }
  return layer;
}

function applyInert() {
  for (const node of marked) node.removeAttribute('inert');
  marked = [];
  const root = document.getElementById('root');
  const top = [...stack].reverse().find(entry => entry.modal && entry.surface?.isConnected);
  if (!root || !top?.surface || !root.contains(top.surface)) return;
  for (let node: HTMLElement = overlayLayer(top.surface, root); node !== root && node.parentElement; node = node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (sibling === node || !(sibling instanceof HTMLElement) || sibling.hasAttribute('inert')) continue;
      // Status messages stay announced, and an open native dialog must never end up inside an inert subtree.
      if (sibling.hasAttribute('data-overlay-exempt') || sibling.querySelector('dialog[open]')) continue;
      sibling.setAttribute('inert', '');
      marked.push(sibling);
    }
  }
}

function lockPage() {
  const html = document.documentElement;
  savedBodyOverflow = document.body.style.overflow;
  // Desktop: keep the scrollbar's space so the page does not shift sideways while locked.
  html.classList.toggle('mh-scroll-gutter', html.scrollHeight > html.clientHeight);
  html.classList.add('mh-scroll-locked');
  document.body.style.overflow = 'hidden'; // kept as the "a sheet is open" signal older code reads
}

function unlockPage() {
  document.documentElement.classList.remove('mh-scroll-locked', 'mh-scroll-gutter');
  document.body.style.overflow = savedBodyOverflow;
}

/** Registers an open overlay. The returned release is idempotent, so a double cleanup can never unlock early. */
export function acquireOverlay(surface: HTMLElement | null, { modal = true }: { modal?: boolean } = {}) {
  const entry: Entry = { surface, modal };
  stack.push(entry);
  if (stack.length === 1) lockPage();
  applyInert();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const index = stack.indexOf(entry);
    if (index >= 0) stack.splice(index, 1);
    applyInert();
    if (!stack.length) unlockPage();
  };
}

export function openOverlayCount() { return stack.length; }

/** Locks the page and makes the background inert while `active`; released on close, unmount or route change. */
export function useOverlayLock(active: boolean, ref?: RefObject<HTMLElement | null>, options?: { modal?: boolean }) {
  useLayoutEffect(() => {
    if (!active) return;
    return acquireOverlay(ref?.current ?? null, options);
  }, [active]);
}
