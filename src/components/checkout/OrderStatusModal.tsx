import React from 'react';
import { useApp } from '../../context/AppContext';
import { GHANA_NETWORKS } from '../../data/bundles';
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

  const [copied, setCopied] = React.useState(false);

  if (!isStatusModalOpen || !activeOrder) return null;

  const currentNetwork = GHANA_NETWORKS[activeOrder.network];

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(activeOrder.id);
    setCopied(true);
    showToast('Order ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig = {
    placed: {
      label: 'Order Placed',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      description: 'Your order has been queued and sent to our telecom gateway.',
      icon: Clock,
      step: 1,
    },
    processing: {
      label: 'Processing',
      badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
      description: 'Telecom provider is provisioning your bundle. Usually takes 30–60 seconds.',
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
      label: 'Failed',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      description: 'The telecom provider rejected the request. Please check phone number or retry.',
      icon: AlertTriangle,
      step: 0,
    },
  }[activeOrder.status];

  const Icon = statusConfig.icon;

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
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
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
              {activeOrder.status === 'delivered'
                ? 'Order Placed Successfully!'
                : activeOrder.status === 'processing'
                ? 'Processing Your Data Bundle'
                : activeOrder.status === 'failed'
                ? 'Delivery Issue'
                : 'Order Received'}
            </h3>
            <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
              {statusConfig.description}
            </p>
          </div>

          {/* Live Progress Bar */}
          <div className="bg-[#090d10] p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>Order Received</span>
              <span>Network Dispatch</span>
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
              <div className="text-[11px] text-slate-400">Order ID</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-sm font-semibold text-white">
                  #{activeOrder.id}
                </span>
                <button
                  onClick={handleCopyOrderId}
                  className="text-slate-400 hover:text-white"
                  title="Copy ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#00c365]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="bg-[#0a0e12] p-3 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Product</div>
              <div className="font-semibold text-sm text-white truncate mt-0.5">
                {activeOrder.bundle.network.toUpperCase()} {activeOrder.bundle.dataAmount} ({activeOrder.bundle.validity})
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
          </div>

          {/* Test Status Simulator (allows user to preview delivered / failed states) */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Preview status:</span>
            <button
              onClick={() => updateOrderStatus(activeOrder.id, 'processing')}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                activeOrder.status === 'processing' ? 'border-sky-400 text-sky-400 bg-sky-400/10' : 'border-slate-800 text-slate-400'
              }`}
            >
              Processing
            </button>
            <button
              onClick={() => updateOrderStatus(activeOrder.id, 'delivered')}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                activeOrder.status === 'delivered' ? 'border-[#00c365] text-[#00c365] bg-[#00c365]/10' : 'border-slate-800 text-slate-400'
              }`}
            >
              Delivered
            </button>
            <button
              onClick={() => updateOrderStatus(activeOrder.id, 'failed')}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                activeOrder.status === 'failed' ? 'border-rose-400 text-rose-400 bg-rose-400/10' : 'border-slate-800 text-slate-400'
              }`}
            >
              Failed
            </button>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => {
                closeOrderStatus();
                setActivePage('orders');
              }}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
            >
              View All Orders
            </button>
            <button
              onClick={() => {
                closeOrderStatus();
                setActivePage('home');
              }}
              className="py-3 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs transition-all shadow-[0_0_15px_rgba(0,195,101,0.25)] flex items-center justify-center gap-1.5"
            >
              <span>Back to Home</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* WhatsApp Support Assistance */}
          <div className="pt-2">
            <a
              href={`https://wa.me/233550000000?text=Hi%20Mystery%20Hub,%20inquiring%20about%20Order%20%23${activeOrder.id}%20for%20${activeOrder.recipientPhone}`}
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
