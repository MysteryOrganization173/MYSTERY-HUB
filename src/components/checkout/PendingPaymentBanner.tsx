import React, { useEffect, useState, useRef } from 'react';
import { RefreshCw, X, Smartphone } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { checkPendingPayment } from '../../services/apiClient';
import { dataOrderPresentation } from '../../utils/dataPurchasePresentation';
import {
  clearPendingCheckout,
  isSettledForRecovery,
  orderRecordFromLookup,
  readPendingCheckout,
  subscribePendingCheckout,
  type PendingCheckout,
} from '../../utils/checkoutRecovery';

/**
 * Shown when this device opened a payment that never reached a confirmed receipt here, for
 * example after leaving for the MoMo prompt or a reload. Checking is customer-initiated and
 * reads server status only; nothing is retried or assumed paid.
 */
export const PendingPaymentBanner: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { openOrderStatus, isCheckoutOpen, isStatusModalOpen } = useApp();
  const [pending, setPending] = useState<PendingCheckout | null>(() => readPendingCheckout());
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState('');
  const inFlight=useRef(false);
  const generation=useRef(0);
  useEffect(()=>()=>{generation.current++;},[]);

  useEffect(() => subscribePendingCheckout(() => { setPending(readPendingCheckout()); setNote(''); }), []);
  // Re-read after checkout or receipt closes; those flows clear or create the record.
  useEffect(() => { setPending(readPendingCheckout()); }, [isCheckoutOpen, isStatusModalOpen]);

  if (!pending || isCheckoutOpen) return null;

  const started = new Date(pending.startedAt);
  const sameDay = started.toDateString() === new Date().toDateString();
  const when = `${sameDay ? 'today' : started.toLocaleDateString([], { day: 'numeric', month: 'short' })} at ${started.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const check = async () => {
    if(inFlight.current)return;
    inFlight.current=true;const ticket=++generation.current;
    const current=()=>ticket===generation.current&&readPendingCheckout()?.orderRef===pending.orderRef;
    setChecking(true);
    setNote('');
    try {
      const res = await checkPendingPayment(pending.orderRef);
      if(!current())return;
      if (!res.success || !res.order) throw Object.assign(new Error('missing'),{status:404});
      const view = dataOrderPresentation(res.order.status, res.order.manual_review, res.order.customer_resolution);
      if (view.paymentConfirmed || isSettledForRecovery(res.order.status)) {
        clearPendingCheckout(pending.orderRef);
        openOrderStatus({ ...orderRecordFromLookup(res.order), buyerRecipientVisible: false });
        return;
      }
      setNote('No payment has been confirmed for this order yet. If you approved the prompt, check again in a minute before paying again.');
    } catch (error) {
      if(current())setNote((error as {status?:number}).status===404
        ? 'This reference could not be found. If you approved a payment, keep your payment proof and contact support before buying again.'
        : 'We couldn’t reach Mystery Hub. Keep your reference and check again before paying.');
    } finally {
      if(ticket===generation.current){inFlight.current=false;setChecking(false);}
    }
  };

  return (
    <section aria-label="Your last payment" className={`rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-3.5 sm:p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
          <Smartphone className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Did your last payment go through?</p>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
            You started paying for {pending.label} {when}. Check its status before buying it again.
          </p>
          {note && <p role="status" className="text-xs text-amber-100/90 mt-2 leading-relaxed">{note}</p>}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={check} disabled={checking} aria-busy={checking} className="min-h-11 px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-70">
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking…' : 'Check status'}
            </button>
            <span className="font-mono text-[11px] text-slate-400 break-all">{pending.orderRef}</span>
          </div>
        </div>
        <button type="button" onClick={() => {generation.current++;inFlight.current=false;setChecking(false);clearPendingCheckout(pending.orderRef);}} aria-label="Dismiss last payment reminder" className="min-w-11 min-h-11 -mt-2 -mr-2 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};
