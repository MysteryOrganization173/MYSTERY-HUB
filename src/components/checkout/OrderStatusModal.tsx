import './receipt.css';
import { OrderShield } from './OrderShield';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { dataOrderPresentation, dataRecipientDisplay } from '../../utils/dataPurchasePresentation';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import { lookupOrderOnServer } from '../../services/apiClient';
import { clearPendingCheckout, isSettledForRecovery } from '../../utils/checkoutRecovery';
import { NetworkBrandBadge } from '../common/NetworkBrandBadge';
import { customerOrderNetwork, customerOrderTitle, orderDateLabel } from '../../utils/customerOrderPresentation';
import { orderReceiptView, orderSaving, type ReceiptService } from '../../utils/orderReceiptPresentation';
import { OrderRecord } from '../../types';
import { PostPurchaseInvite } from './PostPurchaseInvite';
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, GraduationCap, MessageSquare, RefreshCw, RotateCcw, ShieldCheck, ShoppingBag, X, XCircle } from 'lucide-react';
import { SeasonalOrders } from '../../seasonal/Seasonal';
import { useSeason } from '../../seasonal/SeasonProvider';
import { ordersSeasonAttributes } from '../../seasonal/ordersSeason';
import { useBuyAgain } from '../../hooks/useBuyAgain';

const SERVICE_LINE: Record<ReceiptService, string> = {
  data: 'Data bundle', airtime: 'Airtime', instant: 'Instant Bundle', afa: 'AFA registration', marketplace: 'Marketplace', results_checker: 'Results Checker',
};
const SEAL = { pending: Clock, progress: RefreshCw, success: CheckCircle2, attention: AlertTriangle, refund: RotateCcw, resolved: ShieldCheck, closed: XCircle } as const;

/**
 * Mystery Hub 3.6.2 · the digital receipt. One sheet for every way an order is opened (after checkout, from Orders, by
 * reference). What it says comes from `orderReceiptView` (server status, manual review, customer resolution, payment
 * basis and Marketplace stage); while it is open it checks the server on the existing schedule and carries what it
 * learns into the shared order state, so the Orders list never contradicts it.
 */
export const OrderStatusModal: React.FC = () => {
  const {
    isStatusModalOpen,
    closeOrderStatus,
    activeOrder,
    setActivePage,
    openDataPage,
    updateOrderStatus,
    showToast,
    user,
    sessionToken,
    openAuth,
  } = useApp();
  const season = useSeason();
  const { buyAgain, pending: buyAgainPending, cancel: cancelBuyAgain } = useBuyAgain();
  const titleId = useId();

  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  // Shown so customers on weak connections know whether the status they see is current.
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);

  // Authoritative reference: Real backend public order reference takes precedence
  const lookupReference = activeOrder?.publicReference || activeOrder?.id;
  // Closing the sheet, or showing another order, abandons a Buy again lookup still in flight.
  const shownReference = useRef<string | null>(null);
  shownReference.current = isStatusModalOpen ? lookupReference ?? null : null;
  useEffect(() => () => cancelBuyAgain(), [isStatusModalOpen, lookupReference, cancelBuyAgain]);

  useEffect(() => { setLastChecked(null); setCheckFailed(false); setCopied('idle'); }, [lookupReference]);

  // Stop checking once nothing more can change for the customer (unchanged rule).
  const isTerminal = ['manual_fulfillment','external_compensation'].includes(activeOrder?.customerResolution||'') || activeOrder?.status === 'delivered' || activeOrder?.status === 'failed'&&(!activeOrder.customerResolution||activeOrder.customerResolution==='refund_confirmed');

  // The loop reads the latest order through a ref, so it starts once per open order instead of again on every render.
  const latest = useRef({ activeOrder, updateOrderStatus });
  latest.current = { activeOrder, updateOrderStatus };

  // Poll server for status updates if order is pending or in-progress
  useEffect(() => {
    if (!isStatusModalOpen || !lookupReference || isTerminal) return;
    // `alive` ends with this order: an answer that arrives after the sheet closed, or after another order opened,
    // is dropped instead of being written into whatever is showing now. One request at a time on slow networks.
    let alive = true, inFlight = false;

    const fetchServerStatus = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await lookupOrderOnServer(lookupReference);
        if (!alive) return;
        setCheckFailed(false);
        setLastChecked(new Date());
        const shown = latest.current.activeOrder;
        if (res.success && res.order && shown && (shown.publicReference || shown.id) === lookupReference) {
          if (isSettledForRecovery(res.order.status)) clearPendingCheckout(res.order.public_reference);
          const serverStatus = res.order.status;

          // Status mapping:
          // pending_payment -> verifying
          // paid -> placed
          // queued -> placed
          // submitted -> processing
          // processing -> processing
          // delivered -> delivered
          // failed -> failed
          // refund_pending -> failed
          // refunded -> failed
          let mappedStatus: OrderRecord['status'] = 'verifying';
          let statusMessage: string | undefined;

          if (serverStatus === 'delivered') {
            mappedStatus = 'delivered';
          } else if (serverStatus === 'processing' || serverStatus === 'submitted') {
            mappedStatus = 'processing';
          } else if (serverStatus === 'paid' || serverStatus === 'queued') {
            mappedStatus = 'placed';
          } else if (serverStatus === 'refund_pending' || serverStatus === 'refunded') {
            mappedStatus = 'failed';
            statusMessage = dataOrderPresentation(serverStatus,res.order.manual_review,res.order.customer_resolution,res.order.payment_basis).next;
          } else if (serverStatus === 'failed') {
            mappedStatus = 'failed';
            statusMessage = res.order.service_type === 'afa' ? 'Registration needs support review. Do not start another registration until support confirms it is safe.' : 'This order could not be completed. Contact support with your order reference before placing the same order again.';
          } else if (serverStatus === 'pending_payment') {
            mappedStatus = 'verifying';
          }

          if(res.order.customer_resolution)statusMessage=dataOrderPresentation(serverStatus,res.order.manual_review,res.order.customer_resolution,res.order.payment_basis).next;
          const marketplaceStatus = res.order.marketplace_status ?? null;
          if (
            mappedStatus !== shown.status ||
            serverStatus !== shown.serverStatus ||
            res.order.manual_review !== shown.manualReview ||
            res.order.customer_resolution !== shown.customerResolution ||
            res.order.payment_basis !== shown.paymentBasis ||
            marketplaceStatus !== (shown.marketplaceStatus ?? null) ||
            statusMessage !== shown.statusMessage
          ) {
            latest.current.updateOrderStatus(shown.id, mappedStatus, {
              serverStatus,
              manualReview: res.order.manual_review,
              customerResolution:res.order.customer_resolution,
              paymentBasis:res.order.payment_basis,
              marketplaceStatus,
              statusMessage,
            });
          }
        }
      } catch (err) {
        if (alive) setCheckFailed(true);
        if (import.meta.env.DEV) {
          console.warn('[OrderStatusModal] Polling error for reference:', lookupReference, err);
        }
      } finally {
        inFlight = false;
      }
    };

    fetchServerStatus();
    const interval = setInterval(fetchServerStatus, 3000);
    return () => { alive = false; clearInterval(interval); };
  }, [isStatusModalOpen, lookupReference, isTerminal]);

  const dialogRef = useDialogFocus(isStatusModalOpen && !!activeOrder, closeOrderStatus);
  const view = useMemo(() => (activeOrder ? orderReceiptView(activeOrder) : null), [activeOrder]);

  // Remember how each order looked when its receipt opened: only a delivery seen happening here is celebrated.
  const openedAs = useRef<{ ref: string; delivered: boolean } | null>(null);
  if (!isStatusModalOpen || !lookupReference) openedAs.current = null;
  else if (view && openedAs.current?.ref !== lookupReference) openedAs.current = { ref: lookupReference, delivered: view.group === 'delivered' };
  const justDelivered = Boolean(view?.supplierDelivered && openedAs.current && !openedAs.current.delivered);

  if (!isStatusModalOpen || !activeOrder || !view) return null;

  const displayRef = activeOrder.publicReference || activeOrder.id;

  // Copies the public order reference only, never recipient or account details.
  const handleCopyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(displayRef);
      setCopied('copied');
      showToast('Order reference copied');
      window.setTimeout(() => setCopied((state) => (state === 'copied' ? 'idle' : state)), 2000);
    } catch {
      showToast('Couldn’t copy. Press and hold the reference to copy it.', 'warning');
      setCopied('failed');
    }
  };

  const isAfa = view.service === 'afa';
  const Seal = SEAL[view.tone];
  const recipient = view.service === 'marketplace' || !activeOrder.recipientPhone ? ''
    : view.service === 'data' ? dataRecipientDisplay(activeOrder.recipientPhone, activeOrder.buyerRecipientVisible)
    : dataRecipientDisplay(activeOrder.recipientPhone, true);
  const network = customerOrderNetwork(activeOrder);
  const saving = orderSaving(activeOrder, view.group);
  const delivered = view.group === 'delivered';
  const currentStep = view.steps.find((step) => step.state === 'current' || step.state === 'halted');

  // 3.4.1 Smart Buy Again for a signed-in customer's delivered Data, Airtime or Instant order. The server confirms the
  // order is theirs and what it can be bought as today; anything else keeps the plain catalogue link.
  const repeatable = !activeOrder.serviceType || ['data', 'airtime', 'instant_bundle'].includes(activeOrder.serviceType);
  const smartBuyAgain = delivered && Boolean(sessionToken && user && activeOrder.publicReference) && repeatable;
  // One primary action, chosen by the customer's situation: a problem is resolved before anything is sold.
  const needsHelp = view.tone === 'attention' || view.tone === 'refund';
  const primary = activeOrder.serviceType === 'results_checker' ? 'results' : needsHelp ? 'help' : delivered && repeatable ? 'buy' : 'done';
  const supportUrl = BUSINESS_CONFIG.getOrderSupportWhatsAppUrl(displayRef, activeOrder.recipientPhone);
  const mode = activeOrder.serviceType === 'airtime' ? 'airtime' : activeOrder.serviceType === 'instant_bundle' ? 'instant' : 'data';

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Order status and receipt" className="mh-sheet-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm">
      <div
        className="mh-sheet mh-rc relative w-full max-w-[calc(100vw-1rem)] mx-auto sm:max-w-md border border-slate-700/70 border-b-0 sm:border-b rounded-t-[1.5rem] sm:rounded-[1.5rem] shadow-2xl overflow-hidden max-h-[calc(100dvh-0.75rem)] sm:max-h-[92dvh] flex flex-col"
        data-rc-tone={view.tone}
        data-rc-mood={view.festive ? 'bright' : 'serious'}
        {...(view.festive ? ordersSeasonAttributes(season) : {})}
      >
        <div className="mh-rc-head">
          <span aria-hidden="true" className="sm:hidden absolute left-1/2 top-1.5 -translate-x-1/2 h-1 w-10 rounded-full bg-slate-700" />
          <span className="mh-rc-kicker"><i aria-hidden="true" />Receipt · {SERVICE_LINE[view.service]}</span>
          <button onClick={closeOrderStatus} className="mh-rc-close" aria-label="Close status">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mh-rc-body">
          {/* Seasonal flourish only while the order is going well; a celebration only for a supplier delivery the
              server reported while this receipt was open. Never for a payment, a manual remedy or a reopened receipt. */}
          {view.festive && <SeasonalOrders part={view.supplierDelivered && justDelivered ? 'celebrate' : 'flourish'} />}

          <section key={view.group} className="mh-rc-status" aria-labelledby={titleId}>
            <span className={`mh-rc-seal${justDelivered ? ' is-fresh' : ''}`} aria-hidden="true" {...(view.tone === 'progress' ? { 'data-breathe': '' } : {})}>
              <Seal />
            </span>
            <h2 id={titleId} className="mh-rc-title">{view.title}</h2>
            <p role="status" className="mh-rc-chip"><i aria-hidden="true" /><span className="sr-only">Current status: </span>{view.label}</p>
            <p className="mh-rc-next">{view.next}</p>
          </section>

          {/* Only verified server states advance the journey; no percentage, timer or estimate. */}
          {view.journeyKind !== 'closed' && (
            <div className="mh-rc-journey" aria-label={view.journeyKind === 'resolution' ? 'Resolution steps' : 'Order journey'} role="group">
              <ol className="mh-rc-steps">
                {view.steps.map((step, index) => (
                  <li key={step.key} className="mh-rc-step" data-state={step.state}>
                    <span className="mh-rc-node" aria-hidden="true">
                      {step.state === 'done' ? <Check strokeWidth={3} /> : step.state === 'halted' ? '!' : step.state === 'current' ? null : index + 1}
                    </span>
                    <span className="mh-rc-step-label">
                      {step.label}
                      <span className="sr-only">{step.state === 'done' ? ' — confirmed' : step.state === 'halted' ? ` — stopped: ${step.detail}` : step.state === 'current' ? ` — now: ${step.detail}` : ' — not confirmed'}</span>
                    </span>
                  </li>
                ))}
              </ol>
              {currentStep && (
                <p className="mh-rc-now" aria-hidden="true"><b>{currentStep.label}:</b> {currentStep.detail}</p>
              )}
            </div>
          )}

          {/* Freshness: customers on weak connections see whether this is live. */}
          {!delivered && !isTerminal && (
            <p aria-live="polite" className="mh-rc-fresh" {...(checkFailed ? { 'data-failed': '' } : {})}>
              {checkFailed ? <AlertTriangle aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              <span>
                {checkFailed
                  ? 'Can’t reach Mystery Hub right now. Your order is safe; we’ll keep checking when you’re back online.'
                  : lastChecked
                  ? `Updates automatically · last checked ${lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Checking the latest status…'}
                {view.tone === 'progress' && view.paymentConfirmed && ' Payment confirmation does not mean it has been delivered.'}
              </span>
            </p>
          )}

          {/* The receipt itself: reference first, then what was bought, for whom, and the money as it really stands. */}
          <article className="mh-rc-slip" aria-label="Receipt details">
            <div className="mh-rc-ref">
              <span className="mh-rc-ref-label">Order reference</span>
              <span className="mh-rc-ref-value" translate="no">{displayRef}</span>
              <button type="button" onClick={handleCopyOrderId} className="mh-rc-copy" aria-label={copied === 'copied' ? 'Order reference copied' : 'Copy order reference'} {...(copied === 'copied' ? { 'data-copied': '' } : {})}>
                {copied === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                <span aria-hidden="true">{copied === 'copied' ? 'Copied' : 'Copy'}</span>
              </button>
              {copied === 'failed' && <span className="mh-rc-copy-note" role="status">Press and hold the reference to copy it.</span>}
            </div>
            <div className="mh-rc-tear" aria-hidden="true" />
            <div className="mh-rc-product">
              <span className="mh-rc-mark" aria-hidden="true">
                {view.service === 'marketplace' ? <span className="mh-rc-mark-icon"><ShoppingBag /></span>
                  : view.service === 'results_checker' ? <span className="mh-rc-mark-icon"><GraduationCap /></span>
                  : <NetworkBrandBadge network={activeOrder.network} size="md" />}
              </span>
              <div className="min-w-0">
                <p className="mh-rc-product-name">{customerOrderTitle(activeOrder)}</p>
                <p className="mh-rc-product-sub">{view.service === 'marketplace' || view.service === 'results_checker' ? SERVICE_LINE[view.service] : `${network} · ${SERVICE_LINE[view.service]}`}</p>
              </div>
            </div>
            <dl className="mh-rc-rows">
              {recipient && <div className="mh-rc-row"><dt>{isAfa ? 'Number' : 'Recipient'}</dt><dd className="tabular-nums">{recipient}</dd></div>}
              <div className="mh-rc-row"><dt>Ordered</dt><dd>{orderDateLabel(activeOrder.createdAt)}</dd></div>
              {activeOrder.deliveredAt && view.showDoneDate && (
                <div className="mh-rc-row"><dt>{activeOrder.customerResolution === 'manual_fulfillment' ? 'Completed' : view.doneWord}</dt><dd>{orderDateLabel(activeOrder.deliveredAt)}</dd></div>
              )}
              <div className="mh-rc-row"><dt>Payment</dt><dd>{view.paymentLine}</dd></div>
              {saving > 0 && <div className="mh-rc-row"><dt>Saving</dt><dd className="text-emerald-300">GH₵{saving.toFixed(2)}</dd></div>}
            </dl>
            <div className="mh-rc-tear" aria-hidden="true" />
            <div className="mh-rc-total" {...(view.paymentConfirmed || activeOrder.paymentBasis ? {} : { 'data-unpaid': '' })}>
              <span className="mh-rc-total-label">{view.amountLabel}</span>
              <span className="mh-rc-total-value">GH₵{activeOrder.amountGhc.toFixed(2)}</span>
              {view.amountNote && <span className="mh-rc-total-note">{view.amountNote}</span>}
            </div>
          </article>

          {/* AFA USSD Card when Registered (Requirement 7 & 4) */}
          {isAfa && activeOrder.serverStatus === 'delivered' && (
            <div className="mh-rc-note" data-good="">
              <span className="mh-rc-note-kicker">After registration · MTN USSD</span>
              <p className="m-0">Dial <span className="mh-rc-ussd">*1848#</span> then follow the MTN AFA menu to view or purchase the offers available to your registered number.</p>
              <small>The registration fee paid to Mystery Hub covers AFA registration only. Future AFA voice/data packages are purchased directly through MTN.</small>
            </div>
          )}

          {/* AFA Guidance when still in progress (Requirement 8 & 6) */}
          {isAfa && view.group === 'in_progress' && (
            <div className="mh-rc-note">
              <p className="m-0">Wait until your order shows Registered before accessing MTN AFA packages.</p>
              <small>The registration fee paid to Mystery Hub covers AFA registration only. Future AFA voice/data packages are purchased directly through MTN.</small>
            </div>
          )}

          {/* Buttons */}
          <div className="mh-rc-actions">
            <button
              onClick={() => {
                closeOrderStatus();
                setActivePage('orders');
              }}
              className="mh-button-secondary"
            >
              All orders
            </button>
            {primary === 'help' ? (
              <a href={supportUrl} target="_blank" rel="noreferrer" className="mh-button">
                <MessageSquare aria-hidden="true" className="w-4 h-4" />
                <span>Get help</span>
              </a>
            ) : (
              <button
                onClick={() => {
                  if (primary === 'buy' && smartBuyAgain) {
                    const reference = activeOrder.publicReference!;
                    void buyAgain(reference, { beforeOpen: closeOrderStatus, stillWanted: () => shownReference.current === reference, notMine: { mode, network: activeOrder.network } });
                    return;
                  }
                  closeOrderStatus();
                  if (primary === 'results') { window.location.assign(`/results-checkers?order=${encodeURIComponent(activeOrder.publicReference || activeOrder.id)}`); return; }
                  // A guest (or an order this account cannot repeat) chooses again from today's catalogue and prices.
                  if (primary === 'buy') openDataPage(mode, activeOrder.network);
                }}
                className="mh-button"
                aria-disabled={smartBuyAgain && buyAgainPending ? true : undefined}
                aria-busy={smartBuyAgain && buyAgainPending ? true : undefined}
              >
                <span>{primary === 'results' ? 'Open your receipt' : primary === 'buy' ? (smartBuyAgain && buyAgainPending ? 'Checking…' : 'Buy again') : 'Done'}</span>
              </button>
            )}
          </div>

          {/* Optional referral discovery: only after a confirmed first-party delivery, below tracking actions. */}
          {sessionToken && user?.role === 'customer' && activeOrder.network === 'mtn' && view.service === 'data' && lookupReference && (
            <OrderShield key={sessionToken + lookupReference} token={sessionToken} reference={lookupReference} />
          )}
          <PostPurchaseInvite order={activeOrder} onExplore={() => { closeOrderStatus(); setActivePage('earn'); }} />

          {/* WhatsApp Support Assistance (the main action already, when the order needs help) */}
          {primary !== 'help' && (
            <a href={supportUrl} target="_blank" rel="noreferrer" className="mh-rc-help">
              <MessageSquare aria-hidden="true" />
              <span>Need help with this order? Contact us on WhatsApp</span>
            </a>
          )}

          {/* Development Status Simulator (only visible in dev mode) */}
          {import.meta.env.DEV && (
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Dev preview:</span>
              <button onClick={() => updateOrderStatus(activeOrder.id, 'placed', { serverStatus: 'queued' })} className="text-[10px] px-2 py-0.5 rounded border border-slate-800 text-slate-400 cursor-pointer">Placed</button>
              <button onClick={() => updateOrderStatus(activeOrder.id, 'processing', { serverStatus: 'processing' })} className="text-[10px] px-2 py-0.5 rounded border border-slate-800 text-slate-400 cursor-pointer">Processing</button>
              <button onClick={() => updateOrderStatus(activeOrder.id, 'delivered', { serverStatus: 'delivered' })} className="text-[10px] px-2 py-0.5 rounded border border-slate-800 text-slate-400 cursor-pointer">Delivered</button>
              <button
                onClick={() => updateOrderStatus(activeOrder.id, 'failed', { serverStatus: 'refund_pending', statusMessage: 'Delivery could not be completed. Your payment is being reviewed for refund.' })}
                className="text-[10px] px-2 py-0.5 rounded border border-slate-800 text-slate-400 cursor-pointer"
              >
                Refund Pending
              </button>
            </div>
          )}

          {/* Guest account invitation, after everything the customer needs about this order. */}
          {!user && (
            <div className="mh-rc-invite">
              <p>
                <strong>Keep your orders across devices</strong>
                <span>With a free account, purchases you make while signed in are saved to it and can be tracked on any device.</span>
              </p>
              <button
                onClick={() => {
                  closeOrderStatus();
                  openAuth('signup');
                }}
              >
                Create account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
