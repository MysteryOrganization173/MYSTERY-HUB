import { dataOrderPresentation, dataRecipientDisplay } from '../../utils/dataPurchasePresentation';
import { afaStatusLabel } from '../../../shared/afa';
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { GHANA_NETWORKS } from '../../data/bundles';
import { lookupOrderOnServer, getAccountOrdersOnServer } from '../../services/apiClient';
import { getInstantBundlePresentation } from '../../utils/instantBundleUtils';
import { OrderRecord } from '../../types';
import { NetworkBrandBadge } from '../common/NetworkBrandBadge';
import { Clock, Search, ArrowRight, CheckCircle2, RefreshCw, AlertTriangle, Smartphone, ShieldCheck, ShoppingBag, X } from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const { orders: localOrders, openOrderStatus, setActivePage, showToast, user, sessionToken } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [serverOrders, setServerOrders] = useState<OrderRecord[]>([]);
  const [accountLoading,setAccountLoading]=useState(false),[accountError,setAccountError]=useState(''),[refresh,setRefresh]=useState(0);

  // Fetch account-linked orders when authenticated
  useEffect(() => {
    if (!user || !sessionToken) {
      setServerOrders([]);
      setAccountLoading(false);
      setAccountError('');
      return;
    }

    let isMounted = true;
    setAccountLoading(true);setAccountError('');
    getAccountOrdersOnServer(sessionToken, 50)
      .then((res) => {
        if (isMounted && res.success && Array.isArray(res.orders)) {
          const mapped: OrderRecord[] = res.orders.map((o) => {
            const isDelivered = o.status === 'delivered';
            const isProcessing = o.status === 'processing' || o.status === 'submitted';
            const isPlaced = o.status === 'paid' || o.status === 'queued';
            const isFailed = o.status === 'failed' || o.status === 'refund_pending' || o.status === 'refunded';

            return {
              id: o.public_reference,
              publicReference: o.public_reference,
              serverReference: o.public_reference,
              serverStatus: o.status,
              manualReview: o.manual_review,
              commercialPricing: o.commercial_pricing,
              serviceType: o.service_type || (o.product_name_snapshot?.toLowerCase().includes('airtime') ? 'airtime' : 'data'),
              bundle: {
                id: 'server-bundle-' + o.public_reference,
                network: o.network,
                dataAmount: o.bundle_size_snapshot || o.product_name_snapshot || 'Data Order',
                dataBytesValue: 0,
                validity: 'Standard',
                validityCategory: 'Daily',
                priceGhc: o.amount_ghc,
                description: o.product_name_snapshot,
              },
              recipientPhone: o.recipient_phone,
              buyerRecipientVisible: true,
              network: o.network,
              paymentMethod: 'paystack',
              amountGhc: o.amount_ghc,
              status: isDelivered ? 'delivered' : isProcessing ? 'processing' : isPlaced ? 'placed' : isFailed ? 'failed' : 'verifying',
              paymentReference: o.public_reference,
              createdAt: o.created_at,
              updatedAt: o.created_at,
            };
          });
          setServerOrders(mapped);
        }
      })
      .catch(() => {if(isMounted)setAccountError('We couldn’t load your account orders. Saved orders on this device are still shown.');})
      .finally(()=>{if(isMounted)setAccountLoading(false);});

    return () => {
      isMounted = false;
    };
  }, [user, sessionToken, refresh]);

  // Combine server orders with local orders without duplicates
  const allOrders = React.useMemo(() => {
    const combined = [...serverOrders];
    for (const localOrd of localOrders) {
      const ref = localOrd.publicReference || localOrd.id;
      if (!combined.some((s) => s.publicReference === ref || s.id === ref || s.id === localOrd.id)) {
        combined.push(localOrd);
      }
    }
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [serverOrders, localOrders]);

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
          serviceType: orderData.service_type,
          manualReview: orderData.manual_review,
          commercialPricing: orderData.commercial_pricing,
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

  const filteredOrders = allOrders.filter((o) => {
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
    <div className="py-6 sm:py-10 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/30 text-xs font-semibold text-[#00c365] mb-2">
              {user ? <ShieldCheck className="w-3.5 h-3.5 text-[#00c365]" /> : <Clock className="w-3.5 h-3.5" />}
              <span>{user ? 'Account Orders' : 'Order Tracking'}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              {user ? 'Your Orders' : 'Order History & Tracking'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {user
                ? 'Your purchases linked to this Mystery Hub account.'
                : 'Check delivery progress and view your order details.'}
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
              aria-label="Order reference or saved recipient phone"
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
        <p className="text-xs text-slate-400">Enter your Mystery Hub reference to check the latest status. A phone-number search filters orders already shown here.</p>

<div aria-live="polite">{accountLoading&&<p className="text-sm text-slate-400">Loading your account orders…</p>}{accountError&&<div className="mh-surface text-sm"><p role="alert" className="text-amber-300">{accountError}</p><button className="mh-button-secondary mt-3" onClick={()=>setRefresh(x=>x+1)}>Try again</button></div>}</div>
        {/* Orders List */}
        {filteredOrders.length > 0 ? (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const net = GHANA_NETWORKS[order.network] || GHANA_NETWORKS['mtn'];

              const isAfa = order.serviceType === 'afa';

              const statusBadge = isAfa ? (
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold border px-2.5 py-1 rounded-full ${order.serverStatus === 'delivered' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                  {order.serverStatus === 'delivered' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {afaStatusLabel(order.serverStatus, order.manualReview)}
                </span>
              ) : {
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

              const isInstantBundle =
                order.serviceType === 'instant_bundle' ||
                (order.bundle.id && order.bundle.id.startsWith('instant-')) ||
                (order.bundle.packageId && order.bundle.packageId.length > 0);
              const isAirtime =
                order.serviceType === 'airtime' ||
                (order.bundle.id && order.bundle.id.startsWith('airtime-'));
              const isMarketplace =
                order.serviceType === 'marketplace' ||
                (order.bundle.id && order.bundle.id.startsWith('marketplace-'));
              const instantInfo = isInstantBundle
                ? getInstantBundlePresentation({
                    category: order.bundle.category,
                    name: order.bundle.description || order.bundle.dataAmount,
                    dataAmount: order.bundle.dataAmount,
                    isFlexi: order.bundle.isFlexi,
                  })
                : null;

              return (
                <div
                  key={order.id}
                  role="button" tabIndex={0} aria-label={`Track order ${order.publicReference||order.id}`}
                  onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openOrderStatus(order);}}}
                  onClick={() => openOrderStatus(order)}
                  className="p-4 sm:p-5 rounded-2xl bg-[#0f151b] border border-slate-800 hover:border-[#00c365]/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365]"
                >
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                    {isMarketplace ? (
                      <div className="w-8 h-8 rounded-lg bg-[#00c365]/15 border border-[#00c365]/30 text-[#00c365] flex items-center justify-center shrink-0 shadow-sm">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                    ) : (
                      <NetworkBrandBadge network={order.network} size="md" />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm sm:text-base group-hover:text-[#00c365] transition-colors truncate max-w-[240px] sm:max-w-none">
                          {isAfa
                            ? 'AFA Registration'
                            : isMarketplace
                            ? order.bundle.description || order.bundle.dataAmount || 'Marketplace Item'
                            : isInstantBundle && instantInfo
                            ? `${instantInfo.formattedAmount} ${instantInfo.categoryLabel} ⚡`
                            : isAirtime
                            ? order.bundle.dataAmount
                            : `${order.bundle.dataAmount} Data Bundle`}
                        </span>
                        <span className="font-mono text-[11px] text-slate-300 break-all">
                          #{order.publicReference || order.id}
                        </span>
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-2.5 sm:gap-x-3 gap-y-1">
                        <span>Recipient: {order.serviceType==='data'?dataRecipientDisplay(order.recipientPhone,order.buyerRecipientVisible):order.recipientPhone}</span>
                        <span>·</span>
                        <span>
                          {new Date(order.createdAt).toLocaleDateString()}{' '}
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {instantInfo?.restrictionNote && (
                          <>
                            <span>·</span>
                            <span
                              className={`text-[11px] font-semibold ${
                                instantInfo.isMidnight
                                  ? 'text-amber-400'
                                  : instantInfo.isVideo
                                  ? 'text-indigo-400'
                                  : instantInfo.isIdd
                                  ? 'text-emerald-400'
                                  : 'text-slate-300'
                              }`}
                            >
                              {instantInfo.badgeEmoji ? `${instantInfo.badgeEmoji} ` : ''}
                              {instantInfo.restrictionNote}
                            </span>
                          </>
                        )}
                      </div>
                      {order.serviceType==='data'&&<p className="text-xs text-slate-400 mt-2 leading-relaxed">{dataOrderPresentation(order.serverStatus,order.manualReview).next}</p>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 shrink-0">
                    <div className="text-left sm:text-right">
                      <div className="text-sm sm:text-base font-extrabold text-white tabular-nums">
                        GH₵{order.amountGhc.toFixed(2)}
                      </div>
                      {Boolean(order.commercialPricing?.discountMinor)&&<p className="text-xs text-emerald-300">Welcome saving GH₵{(order.commercialPricing!.discountMinor/100).toFixed(2)} from GH₵{(order.commercialPricing!.regularMinor/100).toFixed(2)}</p>}
                      <div className="mt-1">{order.serviceType==='data'?<span className="text-xs font-semibold text-slate-200">{dataOrderPresentation(order.serverStatus,order.manualReview).label}</span>:statusBadge}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#00c365] group-hover:translate-x-1 transition-all shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : searchQuery.trim() ? (
          <div className="text-center py-12 px-4 bg-[#0f151b] rounded-2xl border border-slate-800 space-y-3 max-w-md mx-auto shadow-sm">
            <Search className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-base font-bold text-white">No matching orders</h3>
            <p className="text-xs text-slate-400">
              No orders matched &ldquo;{searchQuery}&rdquo;. Check the reference or phone number.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filter</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-14 px-4 bg-[#0f151b] rounded-2xl border border-slate-800 space-y-3.5 max-w-md mx-auto shadow-sm">
            <Smartphone className="w-9 h-9 text-slate-500 mx-auto" />
            <h3 className="text-base sm:text-lg font-bold text-white">No orders found</h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              You haven&apos;t placed any orders yet. Buy data, airtime, or marketplace products to track them here.
            </p>
            <div className="pt-1">
              <button
                onClick={() => setActivePage('data')}
                className="px-5 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95"
              >
                Browse Data Bundles
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
