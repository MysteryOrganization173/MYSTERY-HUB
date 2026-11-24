import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, CircleHelp, Info, LifeBuoy, PackageSearch, ReceiptText, RefreshCw, Search, Truck } from 'lucide-react';
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
const KIND: Partial<Record<LookupState, 'error' | 'warn' | 'info'>> = { empty: 'info', phone: 'warn', invalid: 'error', not_found: 'warn', unavailable: 'warn' };

/** A small sideways nudge on the field after an entry that cannot be tracked (skipped when motion is reduced). */
function nudge(el: HTMLElement | null) {
  if (!el || typeof el.animate !== 'function' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  el.animate([{ transform: 'none' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'none' }], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' });
}

/**
 * Looks up one order by its public reference through the existing server lookup. The receipt it opens keeps the
 * recipient masked, because a reference holder is not necessarily the buyer. Nothing is claimed about a reference
 * until the server answers.
 * - `primary`: the page's main action (a guest with nothing saved here): always open, with a short explanation.
 * - otherwise a compact "Track another order" row that opens on request.
 */
export const TrackOrderPanel: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; prefill?: string; primary?: boolean }> = ({ open, onOpenChange, prefill, primary = false }) => {
  const { openOrderStatus, isStatusModalOpen } = useApp();
  const [value, setValue] = useState('');
  const [state, setState] = useState<LookupState>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true), ticket = useRef(0), receiptOpen = useRef(isStatusModalOpen);
  receiptOpen.current = isStatusModalOpen;
  const panelId = useId(), hintId = useId(), messageId = useId(), headingId = useId();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

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
      nudge(inputRef.current);
      return;
    }
    setState('checking');
    // Only the latest lookup may open a receipt, and never over a receipt the customer opened meanwhile.
    const mine = ++ticket.current;
    try {
      const res = await lookupOrderOnServer(input.reference);
      if (!res.success || !res.order) throw new Error('Order not found.');
      if (!alive.current || mine !== ticket.current) return;
      setState('idle');
      if (receiptOpen.current) return;
      openOrderStatus(orderRecordFromLookup(res.order));
    } catch (error) {
      if (!alive.current || mine !== ticket.current) return;
      setState((error as Error).message === 'Order not found.' ? 'not_found' : 'unavailable');
    }
  };

  const message = MESSAGES[state];
  const checking = state === 'checking';
  const expanded = primary || open;

  const form = (
    <form id={panelId} onSubmit={track} noValidate className="mh-or-track-form" aria-labelledby={headingId}>
      <label htmlFor={`${panelId}-ref`}>Order reference</label>
      <div className="mh-or-track-row">
        <input
          ref={inputRef}
          id={`${panelId}-ref`}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          value={value}
          onChange={(e) => { setValue(e.target.value); if (state !== 'checking') setState('idle'); }}
          placeholder="MH-20261024-1A2B3C"
          aria-describedby={`${hintId} ${messageId}`}
          aria-invalid={Boolean(message && state !== 'unavailable') || undefined}
          className="mh-or-field"
        />
        <button type="submit" disabled={checking} aria-busy={checking} className="mh-or-track-go">
          {checking ? <><RefreshCw aria-hidden="true" className="animate-spin" /><span>Checking</span></> : <><Search aria-hidden="true" /><span>Track</span></>}
        </button>
      </div>
      <p id={hintId} className="mh-or-hint">Phone numbers can’t be used to look up orders.</p>
      <p id={messageId} role="status" aria-live="polite" className={message || checking ? 'mh-or-msg' : 'sr-only'} data-kind={checking ? 'info' : KIND[state]}>
        {message && (state === 'not_found' || state === 'unavailable' || state === 'phone' ? <AlertTriangle aria-hidden="true" /> : <Info aria-hidden="true" />)}
        <span>{checking ? 'Checking this order…' : message || ''}</span>
      </p>
      {primary && (
        <>
          <details className="mh-or-where">
            <summary><CircleHelp aria-hidden="true" /><span className="flex-1">Where do I find my order reference?</span><ChevronDown aria-hidden="true" /></summary>
            <div className="mh-or-where-body">
              <div className="mh-or-mini" aria-hidden="true"><span>Order reference</span><b>MH-20261024-1A2B3C</b></div>
              <p>It starts with <strong>MH-</strong> and is shown on the receipt that opens after you pay. If you paid on another phone, open My Orders there, or ask the person who paid for you to share it.</p>
              <p>For privacy, orders can’t be found with a phone number. A reference shows one order, with the recipient’s number partly hidden.</p>
            </div>
          </details>
          <ul className="mh-or-steps" aria-label="What tracking shows">
            <li><ReceiptText aria-hidden="true" />Whether payment is confirmed</li>
            <li><Truck aria-hidden="true" />Where delivery stands</li>
            <li><LifeBuoy aria-hidden="true" />Help with that order</li>
          </ul>
        </>
      )}
    </form>
  );

  if (primary) {
    return (
      <section className="mh-or-track" data-primary="">
        <div className="mh-or-track-head">
          <h2 id={headingId}>Track an order</h2>
          <p>Enter the order reference from your receipt to see its payment and delivery status. No sign-in needed.</p>
        </div>
        {form}
      </section>
    );
  }

  return (
    <section className="mh-or-track">
      <h2 className="m-0" id={headingId}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => {
            onOpenChange(!open);
            if (!open) requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="mh-or-track-toggle"
        >
          <span aria-hidden="true" className="mh-or-track-icon"><PackageSearch /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">Track another order</span>
            <span className="block text-xs text-slate-400">Use the order reference from a receipt</span>
          </span>
          <ChevronDown aria-hidden="true" className="mh-or-track-chevron" />
        </button>
      </h2>
      {expanded && form}
    </section>
  );
};
