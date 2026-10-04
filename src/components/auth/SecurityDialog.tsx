import React, { useEffect, useId, useRef } from 'react';

export const accountInput = 'w-full min-w-0 rounded-xl border border-slate-700 bg-[#0a0e12] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c365]';
export const accountButton = 'min-h-11 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
let activeDialogs = 0;
let originalOverflow = '';

export function SecurityDialog({ title, children, onClose, mandatory = false, wide = false }: {
  title: string; children: React.ReactNode; onClose?: () => void; mandatory?: boolean; wide?: boolean;
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
    if (activeDialogs++ === 0) originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.removeEventListener('keydown', onKey); if (--activeDialogs === 0) document.body.style.overflow = originalOverflow; previous?.focus(); };
  }, [mandatory]);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-5">
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`w-full min-w-0 ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-700 bg-[#0f171d] p-4 sm:p-6 text-slate-100 shadow-2xl`}>
      <div className="mb-4 flex items-start justify-between gap-3"><h2 id={titleId} className="text-lg font-bold">{title}</h2>
        {!mandatory && onClose && <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="min-h-10 min-w-10 rounded-lg bg-slate-800">×</button>}
      </div>{children}
    </div>
  </div>;
}
