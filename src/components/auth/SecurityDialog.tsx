import React, { useEffect, useId, useRef } from 'react';
import { acquireOverlay } from '../../utils/overlayStack';

export const accountInput = 'w-full min-w-0 rounded-xl border border-slate-700 bg-[#0a0e12] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c365]';
export const accountButton = 'min-h-11 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export function SecurityDialog({ title, children, onClose, mandatory = false, wide = false, decoration, variant, layout = 'dialog' }: {
  title: string; children: React.ReactNode; onClose?: () => void; mandatory?: boolean; wide?: boolean;
  /**
   * 'sheet' (3.4.1 My Account): full screen on phones with a title bar that stays put; a centred panel from 640px.
   * 'panel' (3.4.1 Notification Center): the same on phones; from 640px a panel under the header, at the right.
   */
  layout?: 'dialog' | 'sheet' | 'panel';
  /** Optional purely decorative layer (no focusable content), e.g. a seasonal ornament. */
  decoration?: React.ReactNode;
  /** Optional presentation hook (data-dialog-variant) so a dialog can be styled on its own; no behaviour attached. */
  variant?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]')).filter(el => el.getClientRects().length);
    (focusable()[0] ?? dialog).focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!mandatory) closeRef.current?.(); }
      if (event.key === 'Tab') {
        const items = focusable(), first = items[0], last = items[items.length - 1];
        if (!items.length) { event.preventDefault(); dialog.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    dialog.addEventListener('keydown', onKey);
    const release = acquireOverlay(dialog);
    return () => { dialog.removeEventListener('keydown', onKey); release(); previous?.focus(); };
  }, [mandatory]);
  const sheet = layout === 'sheet' || layout === 'panel', panel = layout === 'panel';
  return <div className={panel ? 'fixed inset-0 z-[100] flex items-stretch sm:items-start justify-center sm:justify-end bg-black/85 sm:bg-black/50 p-0 sm:pt-[4.5rem] sm:pr-4 sm:pl-4' : sheet ? 'fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center bg-black/85 p-0 sm:p-5' : 'fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-5'}>
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} data-dialog-variant={variant} data-dialog-layout={layout}
      className={panel
        ? 'relative w-full min-w-0 sm:w-[26rem] h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain sm:rounded-2xl sm:border border-slate-700 bg-[#0f171d] px-4 sm:px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5 text-slate-100 shadow-2xl'
        : sheet
        ? 'relative w-full min-w-0 sm:max-w-2xl h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain sm:rounded-2xl sm:border border-slate-700 bg-[#0f171d] px-4 sm:px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 text-slate-100 shadow-2xl'
        : `relative w-full min-w-0 ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-700 bg-[#0f171d] p-4 sm:p-6 text-slate-100 shadow-2xl`}>
      {decoration}
      <div className={panel ? 'sticky top-0 z-10 -mx-4 sm:-mx-5 mb-4 flex items-center justify-between gap-3 border-b border-slate-800 bg-[#0f171d]/95 px-4 sm:px-5 py-3 backdrop-blur' : sheet ? 'sticky top-0 z-10 -mx-4 sm:-mx-6 mb-4 flex items-center justify-between gap-3 border-b border-slate-800 bg-[#0f171d]/95 px-4 sm:px-6 py-3 sm:pt-5 backdrop-blur' : 'mb-4 flex items-start justify-between gap-3'}><h2 id={titleId} className="text-lg font-bold">{title}</h2>
        {!mandatory && onClose && <button type="button" onClick={onClose} aria-label={`Close ${title}`} className={sheet ? 'min-h-11 min-w-11 rounded-xl bg-slate-800 text-lg' : 'min-h-10 min-w-10 rounded-lg bg-slate-800'}>×</button>}
      </div>{children}
    </div>
  </div>;
}
