import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GHANA_NETWORKS } from '../../data/bundles';
import { lookupOrderOnServer } from '../../services/apiClient';
import { Clock, Search, ArrowRight, CheckCircle2, RefreshCw, AlertTriangle, Smartphone } from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const { orders, openOrderStatus, setActivePage, showToast } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingServer, setIsSearchingServer] = useState(false);

  const handleServerLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearchingServer(true);
    try {
      const res = await lookupOrderOnServer(query);
      if (res.success && res.order) {
        const orderData = res.order;
        const isDelivered = orderData.status === 'delivered';
        const isProcessing = orderData.status === 'processing' || orderData.status === 'submitted';
        const isPlaced = orderData.status === 'paid' || orderData.status === 'queued';
        const isFailed =
          orderData.status === 'failed' ||
          orderData.status === 'refund_pending' ||
          orderData.status === 'refunded';

        openOrderStatus({
          id: orderData.public_reference,
          publicReference: orderData.public_reference,
          serverReference: orderData.public_reference,
          serverStatus: orderData.status,
          statusMessage:
            orderData.status === 'refund_pending' || orderData.status === 'refunded'
              ? 'Delivery could not be completed. Your payment is being reviewed for refund.'
              : undefined,
          bundle: {
            id: 'lookup-bundle',
            network: orderData.network,
            dataAmount: orderData.bundle_size_snapshot,
            dataBytesValue: 0,
            validity: 'Standard',
            validityCategory: 'Daily',
            priceGhc: orderData.amount_ghc,
            description: orderData.product_name_snapshot,
          },
          recipientPhone: orderData.recipient_phone,
          network: orderData.network,
          paymentMethod: 'paystack',
          amountGhc: orderData.amount_ghc,
          status: isDelivered
            ? 'delivered'
            : isProcessing
            ? 'processing'
            : isPlaced
            ? 'placed'
            : isFailed
            ? 'failed'
            : 'verifying',
          paymentReference: orderData.public_reference,
          createdAt: orderData.created_at,
          updatedAt: orderData.created_at,
        });
      } else {
        showToast('Order reference not found on server.', 'warning');
      }
    } catch {
      showToast('Order lookup failed. Please check the order reference.', 'warning');
    } finally {
      setIsSearchingServer(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const pubRef = o.publicReference ? o.publicReference.toLowerCase() : '';
    return (
      pubRef.includes(q) ||
      o.id.toLowerCase().includes(q) ||
      o.recipientPhone.includes(q) ||
      o.bundle.dataAmount.toLowerCase().includes(q) ||
      o.network.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/30 text-xs font-semibold text-[#00c365] mb-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Order Tracking</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Order History & Tracking
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Track real-time bundle delivery and view transaction receipts.
            </p>
          </div>

          <button
            onClick={() => setActivePage('data')}
            className="px-4 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all self-start sm:self-auto cursor-pointer"
          >
            Buy New Bundle
          </button>
        </div>

        {/* Search Filter & Server Lookup Form */}
        <form onSubmit={handleServerLookup} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID (e.g. MH-20260929-123456) or recipient phone..."
              className="w-full bg-[#0e141a] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c365]"
            />
          </div>
          <button
            type="submit"
            disabled={isSearchingServer || !searchQuery.trim()}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors shrink-0 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isSearchingServer ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#00c365]" />
            ) : (
              'Track Order'
            )}
          </button>
        </form>

        {/* Orders List */}
        {filteredOrders.length > 0 ? (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const net = GHANA_NETWORKS[order.network];

              const statusBadge = {
                verifying: (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Verifying
                  </span>
                ),
                delivered: (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    Delivered
                  </span>
                ),
                processing: (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-full animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Processing
                  </span>
                ),
                placed: (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                    <Clock className="w-3 h-3" />
                    Queued
                  </span>
                ),
                failed: (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full">
                    <AlertTriangle className="w-3 h-3" />
                    Failed
                  </span>
                ),
              }[order.status];

              return (
                <div
                  key={order.id}
                  onClick={() => openOrderStatus(order)}
                  className="p-4 sm:p-5 rounded-2xl bg-[#0f151b] border border-slate-800 hover:border-[#00c365]/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm"
                      style={{
                        backgroundColor: net.brandColor,
                        color: order.network === 'mtn' ? '#000' : '#fff',
                      }}
                    >
                      {order.network === 'mtn' ? 'MTN' : order.network === 'telecel' ? 'Telecel' : 'AT'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base group-hover:text-[#00c365] transition-colors">
                          {order.bundle.dataAmount} Data Bundle
                        </span>
                        <span className="font-mono text-xs text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded truncate max-w-[150px] sm:max-w-none">
                          #{order.publicReference || order.id}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>Recipient: {order.recipientPhone}</span>
                        <span>·</span>
                        <span>{new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-white tabular-nums">
                        GH₵{order.amountGhc.toFixed(2)}
                      </div>
                      <div className="mt-1">{statusBadge}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#00c365] group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-[#0f151b] rounded-2xl border border-slate-800 space-y-4">
            <Smartphone className="w-10 h-10 text-slate-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">No orders found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You haven&apos;t placed any data orders yet or your search filter didn&apos;t match.
            </p>
            <button
              onClick={() => setActivePage('data')}
              className="px-5 py-2.5 rounded-xl bg-[#00c365] text-black font-bold text-xs uppercase tracking-wider"
            >
              Browse Data Bundles
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
