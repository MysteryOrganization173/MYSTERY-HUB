import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GHANA_NETWORKS } from '../../data/bundles';
import { BUSINESS_CONFIG } from '../../config/business';
import { lookupOrderOnServer } from '../../services/apiClient';
import { OrderRecord } from '../../types';
import { CheckCircle2, Clock, AlertTriangle, ArrowRight, MessageSquare, Copy, Check, RefreshCw, X } from 'lucide-react';

export const OrderStatusModal: React.FC = () => {
  const {
    isStatusModalOpen,
    closeOrderStatus,
    activeOrder,
    setActivePage,
    updateOrderStatus,
    showToast,
  } = useApp();

  const [copied, setCopied] = useState(false);

  // Authoritative reference: Real backend public order reference takes precedence
  const lookupReference = activeOrder?.publicReference || activeOrder?.id;

  // Poll server for status updates if order is pending or in-progress
  useEffect(() => {
    if (!isStatusModalOpen || !lookupReference) return;

    // Stop aggressive polling when terminal status is reached
    const isTerminal = activeOrder?.status === 'delivered' || activeOrder?.status === 'failed';
    if (isTerminal) return;

    const fetchServerStatus = async () => {
      try {
        const res = await lookupOrderOnServer(lookupReference);
        if (res.success && res.order) {
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
            statusMessage = 'Delivery could not be completed. Your payment is being reviewed for refund.';
          } else if (serverStatus === 'failed') {
            mappedStatus = 'failed';
            statusMessage = 'The mobile network was unable to complete the delivery. Please contact support or retry.';
          } else if (serverStatus === 'pending_payment') {
            mappedStatus = 'verifying';
          }

          if (
            mappedStatus !== activeOrder?.status ||
            serverStatus !== activeOrder?.serverStatus ||
            statusMessage !== activeOrder?.statusMessage
          ) {
            updateOrderStatus(activeOrder!.id, mappedStatus, {
              serverStatus,
              statusMessage,
            });
          }
        }
      } catch (err) {
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
    activeOrder?.statusMessage,
    updateOrderStatus,
  ]);

  if (!isStatusModalOpen || !activeOrder) return null;

  const currentNetwork = GHANA_NETWORKS[activeOrder.network];
  const displayRef = activeOrder.publicReference || activeOrder.id;
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
      description: 'Confirming your payment reference with Paystack...',
      icon: RefreshCw,
      step: 1,
    },
    placed: {
      label: 'Order Placed',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      description: 'Your order has been queued for automated delivery.',
      icon: Clock,
      step: 1,
    },
    processing: {
      label: 'Processing',
      badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
      description: 'The mobile network is processing your bundle. Usually completes in just a few minutes.',
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

  const headingText =
    activeOrder.status === 'delivered'
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

  const descriptionText =
    activeOrder.statusMessage ||
    (isRefundIssue
      ? 'Delivery could not be completed. Your payment is being reviewed for refund.'
      : statusConfig.description);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0f151b] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header with Close */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0c1116]">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Order Status & Receipt
          </span>
          <button
            onClick={closeOrderStatus}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close status"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 text-center space-y-6">
          {/* Animated Central Icon */}
          <div className="flex justify-center">
            {activeOrder.status === 'delivered' ? (
              <div className="w-16 h-16 rounded-full bg-[#00c365]/20 border-2 border-[#00c365] flex items-center justify-center text-[#00c365] shadow-[0_0_25px_rgba(0,195,101,0.4)] animate-in zoom-in duration-300">
                <CheckCircle2 className="w-9 h-9" />
              </div>
            ) : activeOrder.status === 'processing' ? (
              <div className="w-16 h-16 rounded-full bg-sky-500/20 border-2 border-sky-400 flex items-center justify-center text-sky-400 animate-pulse">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
            ) : activeOrder.status === 'failed' ? (
              <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-8 h-8" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400">
                <Clock className="w-8 h-8" />
              </div>
            )}
          </div>

          {/* Heading */}
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {headingText}
            </h3>
            <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
              {descriptionText}
            </p>
          </div>

          {/* Live Progress Bar */}
          <div className="bg-[#090d10] p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>Order Received</span>
              <span>Delivery Progress</span>
              <span>Delivered</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-700 ${
                  activeOrder.status === 'failed'
                    ? 'w-full bg-rose-500'
                    : activeOrder.status === 'delivered'
                    ? 'w-full bg-[#00c365]'
                    : activeOrder.status === 'processing'
                    ? 'w-2/3 bg-sky-400 animate-pulse'
                    : 'w-1/3 bg-amber-400'
                }`}
              />
            </div>
          </div>

          {/* Key Information Grid */}
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="bg-[#0a0e12] p-3 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Order Reference</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-sm font-semibold text-white truncate max-w-[140px] sm:max-w-none">
                  #{displayRef}
                </span>
                <button
                  onClick={handleCopyOrderId}
                  className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
                  title="Copy Reference"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#00c365]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="bg-[#0a0e12] p-3 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Product</div>
              <div className="font-semibold text-sm text-white truncate mt-0.5">
                {activeOrder.serviceType === 'instant_bundle' ||
                (activeOrder.bundle.id && activeOrder.bundle.id.startsWith('instant-'))
                  ? `${currentNetwork?.name || activeOrder.network.toUpperCase()} ${activeOrder.bundle.dataAmount} Instant ⚡`
                  : activeOrder.serviceType === 'airtime' ||
                    (activeOrder.bundle.id && activeOrder.bundle.id.startsWith('airtime-'))
                  ? `${currentNetwork?.name || activeOrder.network.toUpperCase()} ${activeOrder.bundle.dataAmount}`
                  : `${currentNetwork?.name || activeOrder.network.toUpperCase()} ${activeOrder.bundle.dataAmount} Data`}
              </div>
            </div>

            <div className="bg-[#0a0e12] p-3 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Recipient Phone</div>
              <div className="font-medium text-sm text-white mt-0.5">
                {activeOrder.recipientPhone}
              </div>
            </div>

            <div className="bg-[#0a0e12] p-3 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Amount Paid</div>
              <div className="font-bold text-sm text-[#00c365] mt-0.5 tabular-nums">
                GH₵{activeOrder.amountGhc.toFixed(2)}
              </div>
            </div>

            {activeOrder.paymentReference && (
              <div className="col-span-2 bg-[#0a0e12] p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400">Paystack Reference</div>
                  <div className="font-mono text-xs text-slate-300 mt-0.5 truncate max-w-xs">
                    {activeOrder.paymentReference}
                  </div>
                </div>
                <span className="text-[10px] text-[#00c365] bg-[#00c365]/10 px-2 py-0.5 rounded font-semibold shrink-0">
                  Verified Payment
                </span>
              </div>
            )}
          </div>

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

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => {
                closeOrderStatus();
                setActivePage('orders');
              }}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              View All Orders
            </button>
            <button
              onClick={() => {
                closeOrderStatus();
                setActivePage('home');
              }}
              className="py-3 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs transition-all shadow-[0_0_15px_rgba(0,195,101,0.25)] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Back to Home</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* WhatsApp Support Assistance */}
          <div className="pt-2">
            <a
              href={BUSINESS_CONFIG.getOrderSupportWhatsAppUrl(displayRef, activeOrder.recipientPhone)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-[#00c365]" />
              <span>Need help with this order? Contact us on WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
