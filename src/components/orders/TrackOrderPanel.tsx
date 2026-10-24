import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, PackageSearch, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { lookupOrderOnServer } from '../../services/apiClient';
import { orderRecordFromLookup } from '../../utils/checkoutRecovery';
import { classifyTrackInput } from '../../utils/customerOrderPresentation';

type LookupState = 'idle' | 'checking' | 'empty' | 'phone' | 'invalid' | 'not_found' | 'unavailable';

const MESSAGES: Partial<Record<LookupState, string>> = {
  empty: 'Enter the order reference from your receipt.',
  phone: 'That looks like a phone number. For privacy, an order can only be tracked with its order reference.',
  invalid: 'Order references use letters, numbers and dashes, like MH-20261024-1A2B3C.',
  not_found: 'We couldn’t find an order with that reference. Check it and try again.',
  unavailable: 'We couldn’t check this order right now. Check your connection and try again.',
};

/**
 * Looks up one order by its public reference through the existing server lookup. The receipt it
 * opens keeps the recipient masked, because a reference holder is not necessarily the buyer.
 */
export const TrackOrderPanel: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; prefill?: string }> = ({ open, onOpenChange, prefill }) => {
  const { openOrderStatus } = useApp();
  const [value, setValue] = useState('');
  const [state, setState] = useState<LookupState>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId(), hintId = useId(), messageId = useId();

  useEffect(() => {
    if (prefill === undefined) return;
    setValue(prefill);
    setState('idle');
  }, [prefill]);

  const track = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state === 'checking') return;
    const input = classifyTrackInput(value);
    if (input.kind !== 'reference') {
      setState(input.kind);
      inputRef.current?.focus();
      return;
    }
    setState('checking');
    try {
      const res = await lookupOrderOnServer(input.reference);
      if (!res.success || !res.order) throw new Error('Order not found.');
      setState('idle');
      openOrderStatus(orderRecordFromLookup(res.order));
    } catch (error) {
      setState((error as Error).message === 'Order not found.' ? 'not_found' : 'unavailable');
    }
  };

  const message = MESSAGES[state];
  const checking = state === 'checking';

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0f151b]">
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            onOpenChange(!open);
            if (!open) requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="w-full min-h-12 flex items-center gap-3 px-3.5 sm:px-4 py-2.5 text-left cursor-pointer rounded-2xl"
        >
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00c365]/10 text-[#44df95]">
            <PackageSearch className="w-4 h-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">Track another order</span>
            <span className="block text-xs text-slate-400">Use the order reference from a receipt</span>
          </span>
          <ChevronDown aria-hidden="true" className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h2>
      {open && (
        <form id={panelId} onSubmit={track} noValidate className="px-3.5 sm:px-4 pb-4 pt-1 space-y-2">
          <label htmlFor={`${panelId}-ref`} className="block text-xs font-semibold text-slate-300">Order reference</label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id={`${panelId}-ref`}
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => { setValue(e.target.value); if (state !== 'checking') setState('idle'); }}
              placeholder="MH-20261024-1A2B3C"
              aria-describedby={`${hintId} ${messageId}`}
              aria-invalid={Boolean(message) || undefined}
              className="mh-field min-w-0 flex-1 font-mono text-sm placeholder:font-sans placeholder:text-slate-500 focus:outline-none focus:border-[#00c365]"
            />
            <button type="submit" disabled={checking} aria-busy={checking} className="mh-button shrink-0 px-4">
              {checking ? <><RefreshCw aria-hidden="true" className="w-4 h-4 animate-spin" /><span>Checking</span></> : 'Track'}
            </button>
          </div>
          <p id={hintId} className="text-xs text-slate-400 leading-relaxed">Phone numbers can’t be used to look up orders.</p>
          <p id={messageId} role="status" aria-live="polite" className={`text-xs leading-relaxed ${state === 'unavailable' || state === 'not_found' ? 'text-amber-300' : 'text-rose-300'} ${message ? '' : 'sr-only'}`}>
            {checking ? 'Checking this order…' : message || ''}
          </p>
        </form>
      )}
    </section>
  );
};
