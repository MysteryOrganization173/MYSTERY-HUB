import {useLayoutEffect, useRef} from 'react';
import {acquireOverlay} from '../utils/overlayStack';
const focusable = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';
/** Focus/scroll lifecycle for custom overlays; native dialogs retain their native behavior. */
export function useDialogFocus(active: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useLayoutEffect(() => {
    const surface = ref.current;
    if (!active || !surface) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => [...surface.querySelectorAll<HTMLElement>(focusable)].filter(node => node.getClientRects().length);
    (surface.querySelector<HTMLElement>('[data-autofocus]') || controls()[0] || surface).focus();
    const release = acquireOverlay(surface);
    const keydown = (event: KeyboardEvent) => {
      // A sheet opened on top of this overlay (a nested dialog) handles its own Escape and Tab.
      const owner = (event.target as Element | null)?.closest?.('dialog[open], [role="dialog"]');
      if (owner && owner !== surface && surface.contains(owner)) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = controls(); const first = items[0]; const last = items.at(-1);
      if (!first || !last) { event.preventDefault(); surface.focus(); return; }
      if (!surface.contains(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    surface.addEventListener('keydown', keydown);
    return () => { surface.removeEventListener('keydown', keydown); release(); if (previous?.isConnected) previous.focus(); };
  }, [active]);
  return ref;
}
