import {useLayoutEffect, useRef} from 'react';
let locks = 0;
let savedOverflow = '';
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
    if (locks++ === 0) savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = controls(); const first = items[0]; const last = items.at(-1);
      if (!first || !last) { event.preventDefault(); surface.focus(); return; }
      if (!surface.contains(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    surface.addEventListener('keydown', keydown);
    return () => { surface.removeEventListener('keydown', keydown); if (--locks === 0) document.body.style.overflow = savedOverflow; if (previous?.isConnected) previous.focus(); };
  }, [active]);
  return ref;
}
