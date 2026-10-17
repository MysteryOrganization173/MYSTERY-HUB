import { useDialogFocus } from '../../hooks/useDialogFocus';
import { dataOrderPresentation, dataRecipientDisplay } from '../../utils/dataPurchasePresentation';
import { afaStatusLabel } from '../../../shared/afa';
import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GHANA_NETWORKS } from '../../data/bundles';
import { BUSINESS_CONFIG } from '../../config/business';
import { lookupOrderOnServer } from '../../services/apiClient';
import { clearPendingCheckout, isSettledForRecovery } from '../../utils/checkoutRecovery';
import { NetworkBrandBadge } from '../common/NetworkBrandBadge';
import { getInstantBundlePresentation } from '../../utils/instantBundleUtils';
import { OrderRecord } from '../../types';
import { CheckCircle2, Clock, AlertTriangle, ArrowRight, MessageSquare, Copy, Check, RefreshCw, X, ShieldAlert, Phone as PhoneIcon } from 'lucide-react';

export const OrderStatusModal: React.FC = () => {
  const {
    isStatusModalOpen,
    closeOrderStatus,
    activeOrder,
    setActivePage,
    updateOrderStatus,
    showToast,
    user,
    openAuth,
  } = useApp();

  const [copied, setCopied] = useState(false);
  // Shown so customers on weak connections know whether the status they see is current.
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);

  // Authoritative reference: Real backend public order reference takes precedence
  const lookupReference = activeOrder?.publicReference || activeOrder?.id;

  // Poll server for status updates if order is pending or in-progress
  useEffect(() => { setLastChecked(null); setCheckFailed(false); }, [lookupReference]);

  useEffect(() => {
    if (!isStatusModalOpen || !lookupReference) return;

    // Stop aggressive polling when terminal status is reached
    const isTerminal = ['manual_fulfillment','external_compensation'].includes(activeOrder?.customerResolution||'') || activeOrder?.status === 'delivered' || activeOrder?.status === 'failed'&&(!activeOrder.customerResolution||activeOrder.customerResolution==='refund_confirmed');
    if (isTerminal) return;

    const fetchServerStatus = async () => {
      try {
        const res = await lookupOrderOnServer(lookupReference);
        setCheckFailed(false);
        setLastChecked(new Date());
        if (res.success && res.order) {
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
            statusMessage = res.order.service_type === 'afa' ? 'Registration needs support review. Do not start another registration until support confirms it is safe.' : 'The mobile network was unable to complete the delivery. Please contact support or retry.';
          } else if (serverStatus === 'pending_payment') {
            mappedStatus = 'verifying';
          }

          if(res.order.customer_resolution)statusMessage=dataOrderPresentation(serverStatus,res.order.manual_review,res.order.customer_resolution,res.order.payment_basis).next;
          if (
            mappedStatus !== activeOrder?.status ||
            serverStatus !== activeOrder?.serverStatus ||
            res.order.manual_review !== activeOrder?.manualReview ||
            res.order.customer_resolution !== activeOrder?.customerResolution ||
            res.order.payment_basis !== activeOrder?.paymentBasis ||
            statusMessage !== activeOrder?.statusMessage
          ) {
            updateOrderStatus(activeOrder!.id, mappedStatus, {
              serverStatus,
              manualReview: res.order.manual_review,
              customerResolution:res.order.customer_resolution,
              paymentBasis:res.order.payment_basis,
              statusMessage,
            });
          }
        }
      } catch (err) {
        setCheckFailed(true);
        if (import.meta.env.DEV) {
          console.warn('[OrderStatusModal] Polling error for reference:', lookupReference, err);
        }
      }
    };

    fetchServerStatus();
    const interval = setInterval(fetchServerStatus, 3000);
    return () => clearInterval(interval);
  }, [
    isStatusModalOpen,
    lookupReference,
    activeOrder?.status,
    activeOrder?.serverStatus,
    activeOrder?.manualReview,
    activeOrder?.statusMessage,
    updateOrderStatus,
  ]);

  const dialogRef = useDialogFocus(isStatusModalOpen && !!activeOrder, closeOrderStatus);

  if (!isStatusModalOpen || !activeOrder) return null;

  const currentNetwork = GHANA_NETWORKS[activeOrder.network];
  const displayRef = activeOrder.publicReference || activeOrder.id;
  const isDataOrder = Boolean(activeOrder.customerResolution) || activeOrder.serviceType === 'data' || (!activeOrder.serviceType && !/^(airtime|instant|marketplace)/.test(activeOrder.bundle.id));
  const dataView = dataOrderPresentation(activeOrder.serverStatus, activeOrder.manualReview,activeOrder.customerResolution,activeOrder.paymentBasis);
  const isRefundIssue = activeOrder.serverStatus === 'refund_pending' || activeOrder.serverStatus === 'refunded';

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(displayRef);
    setCopied(true);
    showToast('Order reference copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig = {
    verifying: {
      label: 'Verifying Payment',
      badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      description: 'Checking your payment with Paystack…',
      icon: RefreshCw,
      step: 1,
    },
    placed: {
      label: 'Order Placed',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      description: 'Your order is queued for delivery. Payment confirmation does not mean it has been delivered.',
      icon: Clock,
      step: 1,
    },
    processing: {
      label: 'Processing',
      badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
      description: 'The mobile network is processing your bundle. Track this order for updates; delivery times vary.',
      icon: RefreshCw,
      step: 2,
    },
    delivered: {
      label: 'Delivered',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      description: 'Data has been loaded directly onto your SIM card. Enjoy browsing!',
      icon: CheckCircle2,
      step: 3,
    },
    failed: {
      label: isRefundIssue ? 'Refund Pending' : 'Failed',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      description:
        activeOrder.statusMessage ||
        (isRefundIssue
          ? 'Delivery could not be completed. Your payment is being reviewed for refund.'
          : 'The mobile network was unable to process the request. Please check phone number or retry.'),
      icon: AlertTriangle,
      step: 0,
    },
  }[activeOrder.status];

  const isAfa = activeOrder.serviceType === 'afa';
  if (isAfa) statusConfig.label = afaStatusLabel(activeOrder.serverStatus, activeOrder.manualReview);
  if(activeOrder.customerResolution)statusConfig.label=dataView.label;

  const headingText = isDataOrder ? dataView.title : isAfa
    ? afaStatusLabel(activeOrder.serverStatus, activeOrder.manualReview)
    : activeOrder.status === 'delivered'
    ? 'Order delivered successfully'
    : activeOrder.status === 'verifying'
    ? 'Confirming your payment'
    : activeOrder.status === 'processing'
    ? 'Your order is being processed'
    : activeOrder.status === 'placed'
    ? 'Order placed successfully'
    : isRefundIssue
    ? 'Refund in progress'
    : activeOrder.status === 'failed'
    ? 'Delivery issue'
    : 'Order placed successfully';

  const descriptionText = isDataOrder ? dataView.next : isAfa
    ? activeOrder.serverStatus === 'delivered'
      ? 'Your MTN AFA registration is confirmed. MTN packages are purchased separately.'
      : activeOrder.status === 'failed'
      ? activeOrder.statusMessage || 'Registration could not be completed. Please contact support.'
      : "Payment and registration are separate stages. Follow this order for registration updates; contact support if it needs attention."
    : activeOrder.statusMessage ||
      (isRefundIssue
        ? 'Delivery could not be completed. Your payment is being reviewed for refund.'
        : statusConfig.description);

  const productName = (() => {
    const isInst =
      activeOrder.serviceType === 'instant_bundle' ||
      (activeOrder.bundle.id && activeOrder.bundle.id.startsWith('instant-'));
    if (isInst) {
      const info = getInstantBundlePresentation({
        category: activeOrder.bundle.category,
        name: activeOrder.bundle.description || activeOrder.bundle.dataAmount,
        dataAmount: activeOrder.bundle.dataAmount,
        isFlexi: activeOrder.bundle.isFlexi,
      });
      return `${currentNetwork?.name || activeOrder.network.toUpperCase()} ${info.formattedAmount} ${info.categoryLabel} ⚡`;
    }
    if (isAfa) {
      return 'MTN AFA Registration';
    }
    if (activeOrder.serviceType === 'marketplace' || (activeOrder.bundle.id && activeOrder.bundle.id.startsWith('marketplace-'))) {
      return activeOrder.bundle.description || activeOrder.bundle.dataAmount || 'Marketplace Item';
    }
    if (
      activeOrder.serviceType === 'airtime' ||
      (activeOrder.bundle.id && activeOrder.bundle.id.startsWith('airtime-'))
    ) {
      return `${currentNetwork?.name || activeOrder.network.toUpperCase()} ${activeOrder.bundle.dataAmount}`;
    }
    return `${currentNetwork?.name || activeOrder.network.toUpperCase()} ${activeOrder.bundle.dataAmount} Data`;
  })();

  // Data journey steps come only from verified server state; a stopped order marks where it stopped.
  const stopped = Boolean(activeOrder.manualReview) || ['failed', 'refund_pending', 'refunded', 'cancelled', 'expired'].includes(activeOrder.serverStatus || '') || Boolean(activeOrder.customerResolution && !dataView.delivered);
  const journey: { label: string; detail: string; complete: boolean }[] = [
    { label: dataView.paymentLabel, detail: activeOrder.paymentBasis === 'complimentary' ? 'No customer payment required' : activeOrder.paymentBasis === 'operator_recorded' ? 'Collection recorded by support' : dataView.paymentConfirmed ? 'Confirmed by Paystack' : 'Waiting for Paystack to confirm', complete: dataView.paymentStageComplete },
    { label: 'Processing', detail: dataView.processing || dataView.delivered ? 'Sent to the network' : 'Queued after payment', complete: dataView.delivered },
    { label: 'Delivered', detail: dataView.delivered ? 'Check the recipient’s balance' : 'Timing depends on the network', complete: dataView.delivered },
  ];
  const currentStep = journey.findIndex(step => !step.complete);
  const tone = activeOrder.status === 'delivered' || dataView.delivered ? 'success' : stopped || activeOrder.status === 'failed' ? 'attention' : 'progress';

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Order status and receipt" className="mh-sheet-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="mh-sheet relative w-full max-w-[calc(100vw-1rem)] mx-auto sm:max-w-md bg-[#0f151b] border border-slate-700/70 border-b-0 sm:border-b rounded-t-[1.5rem] sm:rounded-[1.5rem] shadow-2xl overflow-hidden text-slate-100 max-h-[calc(100dvh-0.75rem)] sm:max-h-[92dvh] flex flex-col">
        {/* Header with Close */}
        <div className="relative flex items-center justify-between gap-3 px-4 sm:px-5 pt-3 pb-1 shrink-0">
          <span aria-hidden="true" className="sm:hidden absolute left-1/2 top-1.5 -translate-x-1/2 h-1 w-10 rounded-full bg-slate-700" />
          <span className="pt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Order status</span>
          <button
            onClick={closeOrderStatus}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close status"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 sm:px-5 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4 overscroll-contain">
          {/* Status hero */}
          <div className="flex items-start gap-3.5 pt-1">
            {activeOrder.status === 'delivered' || isDataOrder && dataView.paymentConfirmed && !activeOrder.manualReview && ['paid','queued'].includes(activeOrder.serverStatus || '') ? (
              <div className="w-12 h-12 shrink-0 rounded-full bg-[#00c365]/15 border border-[#00c365]/60 flex items-center justify-center text-[#00c365] motion-safe:animate-[checkout-success_240ms_ease-out] motion-reduce:animate-none">
                <CheckCircle2 className="w-7 h-7" />
              </div>
            ) : activeOrder.status === 'processing' ? (
              <div className="w-12 h-12 shrink-0 rounded-full bg-sky-500/15 border border-sky-400/60 flex items-center justify-center text-sky-300">
                <RefreshCw className="w-6 h-6 motion-safe:animate-spin [animation-duration:2.4s]" />
              </div>
            ) : activeOrder.status === 'failed' ? (
              <div className="w-12 h-12 shrink-0 rounded-full bg-rose-500/15 border border-rose-500/60 flex items-center justify-center text-rose-300">
                <AlertTriangle className="w-6 h-6" />
              </div>
            ) : (
              <div className="w-12 h-12 shrink-0 rounded-full bg-amber-500/15 border border-amber-400/60 flex items-center justify-center text-amber-300">
                <Clock className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
                {headingText}
              </h3>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                {descriptionText}
              </p>
            </div>
          </div>

          {/* Only verified server states advance the Data journey; no percentage estimates. */}
          {isDataOrder ? <div className="rounded-2xl border border-slate-800 bg-[#0a0f14] p-4 space-y-3" aria-label="Order journey">
            <p role="status" className="text-sm font-semibold text-white">Current status: <span className={tone === 'success' ? 'text-[#44df95]' : tone === 'attention' ? 'text-rose-300' : 'text-amber-200'}>{dataView.label}</span></p>
            <ol className="space-y-0">
              {journey.map((step, index) => {
                const isCurrent = index === currentStep;
                const halted = isCurrent && stopped;
                return <li key={step.label} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < journey.length - 1 && <span aria-hidden="true" className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${step.complete ? 'bg-[#00c365]/70' : 'bg-slate-800'}`} />}
                  <span aria-hidden="true" className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${step.complete ? 'border-[#00c365] bg-[#00c365] text-[#03160c]' : halted ? 'border-rose-400 bg-rose-500/15 text-rose-300' : isCurrent ? 'border-amber-300 bg-amber-400/10 text-amber-200' : 'border-slate-700 bg-[#0a0f14] text-slate-600'}`}>
                    {step.complete ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : halted ? '!' : isCurrent ? <span className="h-2 w-2 rounded-full bg-amber-300 motion-safe:animate-pulse" /> : ''}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${step.complete ? 'text-white' : isCurrent ? halted ? 'text-rose-200' : 'text-amber-100' : 'text-slate-500'}`}>{step.label}<span className="sr-only">{step.complete?' — confirmed':' — not confirmed'}</span></p>
                    <p className={`text-xs ${step.complete || isCurrent ? 'text-slate-400' : 'text-slate-600'}`}>{halted ? dataView.label : step.detail}</p>
                  </div>
                </li>;
              })}
            </ol>
          </div> : <div className="bg-[#0a0f14] p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>Order Received</span>
              <span>{isAfa ? 'Registration Progress' : 'Delivery Progress'}</span>
              <span>{isAfa ? 'Registered' : 'Delivered'}</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-700 ${
                  activeOrder.status === 'failed'
                    ? 'w-full bg-rose-500'
                    : activeOrder.status === 'delivered'
                    ? 'w-full bg-[#00c365]'
                    : activeOrder.status === 'processing'
                    ? 'w-2/3 bg-sky-400'
                    : 'w-1/3 bg-amber-400'
                }`}
              />
            </div>
            <p className="text-xs text-slate-400">{statusConfig.label}</p>
          </div>

          }

          {/* Freshness: customers on weak connections see whether this is live. */}
          {!(activeOrder.status === 'delivered') && (
            <p aria-live="polite" className={`flex items-center gap-1.5 text-xs ${checkFailed ? 'text-amber-300' : 'text-slate-500'}`}>
              {checkFailed ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <RefreshCw className="w-3.5 h-3.5 shrink-0" />}
              {checkFailed
                ? 'Can’t reach Mystery Hub right now. Your order is safe; we’ll keep checking when you’re back online.'
                : lastChecked
                ? `Updates automatically · last checked ${lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Checking the latest status…'}
            </p>
          )}

          {/* Receipt */}
          <div className="rounded-2xl border border-slate-800 bg-[#0a0f14] divide-y divide-slate-800/80 text-sm">
            <div className="flex items-center gap-3 p-3.5">
              {!isAfa && activeOrder.serviceType !== 'marketplace' && <NetworkBrandBadge network={activeOrder.network} size="md" />}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-400">Product</div>
                <div className="font-semibold text-white break-words">{productName}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-slate-400">{activeOrder.paymentBasis==='complimentary'?'Complimentary':activeOrder.paymentBasis==='operator_recorded'?'Recorded amount':isDataOrder&&!dataView.paymentConfirmed?'Order Total':'Amount Paid'}</div>
                <div className="font-bold text-white tabular-nums">GH₵{activeOrder.amountGhc.toFixed(2)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-3.5 py-3">
              <span className="text-slate-400">Recipient Phone</span>
              <span className="font-semibold text-white tabular-nums">{isDataOrder ? dataRecipientDisplay(activeOrder.recipientPhone, activeOrder.buyerRecipientVisible) : activeOrder.recipientPhone}</span>
            </div>
            <div className="flex items-center justify-between gap-2 pl-3.5 pr-1 py-1">
              <span className="text-slate-400 shrink-0">Order Reference</span>
              <span className="flex items-center min-w-0">
                <span className="font-mono text-xs sm:text-sm font-semibold text-white break-all text-right">{displayRef}</span>
                <button
                  onClick={handleCopyOrderId}
                  aria-label="Copy order reference"
                  className="min-w-11 min-h-11 flex items-center justify-center text-slate-400 hover:text-white shrink-0 cursor-pointer"
                  title="Copy Reference"
                >
                  {copied ? <Check className="w-4 h-4 text-[#00c365]" /> : <Copy className="w-4 h-4" />}
                </button>
              </span>
            </div>
            {activeOrder.paymentReference && (
              <details className="px-3.5 text-left">
                <summary className="cursor-pointer min-h-11 flex items-center text-sm text-slate-400">View payment details</summary>
                <div className="flex items-center justify-between gap-2 pb-3">
                  <div className="font-mono text-[11px] text-slate-400 min-w-0 break-all" title={`Paystack Reference: ${activeOrder.paymentReference}`}>
                    {activeOrder.paymentMethod==='wallet'?'Wallet':'Payment'} Ref: {activeOrder.paymentReference}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium shrink-0 border ${isDataOrder&&!dataView.paymentConfirmed?'text-amber-300 bg-amber-500/10 border-amber-500/20':'text-emerald-400/90 bg-emerald-500/10 border-emerald-500/20'}`}>
                    {activeOrder.paymentBasis ? dataView.paymentLabel : isDataOrder ? dataView.paymentConfirmed?'Confirmed':'Awaiting confirmation' : 'Verified'}
                  </span>
                </div>
              </details>
            )}
          </div>

          {/* AFA USSD Card when Registered (Requirement 7 & 4) */}
          {isAfa && activeOrder.serverStatus === 'delivered' && (
            <div className="bg-[#090d10] p-4 rounded-xl border border-emerald-500/30 text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  AFTER REGISTRATION
                </span>
                <span className="text-[10px] text-slate-400 font-mono">MTN USSD</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-slate-300">Dial:</span>
                <span className="font-mono text-base font-extrabold text-white bg-slate-900 border border-emerald-500/30 px-2.5 py-0.5 rounded tracking-wider">
                  *1848#
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Then follow the MTN AFA menu to view or purchase the offers available to your registered number.
              </p>
              <p className="text-[10px] text-slate-400 leading-normal border-t border-slate-800/80 pt-1.5">
                The registration fee paid to Mystery Hub covers AFA registration only. Future AFA voice/data packages are purchased directly through MTN.
              </p>
            </div>
          )}

          {/* AFA Guidance when still in progress (Requirement 8 & 6) */}
          {isAfa && activeOrder.status !== 'delivered' && activeOrder.status !== 'failed' && (
            <div className="bg-[#090d10] p-3.5 sm:p-4 rounded-xl border border-slate-800 text-left space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                <Clock className="w-3.5 h-3.5" />
                <span>Registration Status: In Progress</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Your registration is still being processed. We&apos;ll update this order when registration is confirmed.
              </p>
              <p className="text-[10px] text-slate-400 leading-normal">
                Wait until your order shows Registered before accessing MTN AFA packages.
              </p>
              <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                The registration fee paid to Mystery Hub covers AFA registration only. Future AFA voice/data packages are purchased directly through MTN.
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => {
                closeOrderStatus();
                setActivePage('orders');
              }}
              className="mh-button-secondary"
            >
              All orders
            </button>
            <button
              onClick={() => {
                closeOrderStatus();
                setActivePage(isAfa ? 'home' : 'data');
              }}
              className="mh-button"
            >
              <span>{isAfa ? 'Back to Home' : tone === 'success' ? 'Buy again' : 'Done'}</span>
            </button>
          </div>

          {/* WhatsApp Support Assistance */}
          <a
            href={BUSINESS_CONFIG.getOrderSupportWhatsAppUrl(displayRef, activeOrder.recipientPhone)}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center justify-center gap-2 min-h-11 rounded-xl text-sm transition-colors ${tone === 'attention' ? 'border border-[#00c365]/40 text-white bg-[#00c365]/10 hover:bg-[#00c365]/15' : 'text-slate-400 hover:text-white'}`}
          >
            <MessageSquare className="w-4 h-4 text-[#00c365]" />
            <span>{tone === 'attention' ? 'Get help on WhatsApp with this reference' : 'Need help with this order? Contact us on WhatsApp'}</span>
          </a>

          {/* Development Status Simulator (only visible in dev mode) */}
          {import.meta.env.DEV && (
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Dev preview:</span>
              <button
                onClick={() => updateOrderStatus(activeOrder.id, 'placed')}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  activeOrder.status === 'placed' ? 'border-amber-400 text-amber-400 bg-amber-400/10' : 'border-slate-800 text-slate-400'
                }`}
              >
                Placed
              </button>
              <button
                onClick={() => updateOrderStatus(activeOrder.id, 'processing')}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  activeOrder.status === 'processing' ? 'border-sky-400 text-sky-400 bg-sky-400/10' : 'border-slate-800 text-slate-400'
                }`}
              >
                Processing
              </button>
              <button
                onClick={() => updateOrderStatus(activeOrder.id, 'delivered')}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  activeOrder.status === 'delivered' ? 'border-[#00c365] text-[#00c365] bg-[#00c365]/10' : 'border-slate-800 text-slate-400'
                }`}
              >
                Delivered
              </button>
              <button
                onClick={() =>
                  updateOrderStatus(activeOrder.id, 'failed', {
                    serverStatus: 'refund_pending',
                    statusMessage: 'Delivery could not be completed. Your payment is being reviewed for refund.',
                  })
                }
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  activeOrder.serverStatus === 'refund_pending' ? 'border-rose-400 text-rose-400 bg-rose-400/10' : 'border-slate-800 text-slate-400'
                }`}
              >
                Refund Pending
              </button>
            </div>
          )}

          {/* Guest Account Conversion Banner */}
          {!user && (
            <div className="p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5 min-w-0">
                <p className="font-semibold text-slate-200">Keep your orders across devices</p>
                <p className="text-slate-400 text-[11px]">A free Mystery Hub account links and tracks every purchase.</p>
              </div>
              <button
                onClick={() => {
                  closeOrderStatus();
                  openAuth('signup');
                }}
                className="min-h-11 px-3 rounded-xl border border-[#00c365]/40 text-[#44df95] hover:bg-[#00c365]/10 font-semibold shrink-0 transition-colors cursor-pointer"
              >
                Create Account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
