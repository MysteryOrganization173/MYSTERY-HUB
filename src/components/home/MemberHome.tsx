import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getAccountOrdersOnServer } from '../../services/apiClient';
import { SafePublicOrderDetails } from '../../../server/types/orders';
import {
  Wifi,
  Smartphone,
  Globe,
  ShoppingBag,
  Zap,
  ArrowRight,
  Clock,
  Sparkles,
  ShieldCheck,
  Package,
} from 'lucide-react';

export const MemberHome: React.FC = () => {
  const { user, sessionToken, openDataPage, setActivePage, openOrderStatus } = useApp();
  const [recentOrders, setRecentOrders] = useState<SafePublicOrderDetails[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Deterministic greeting using local browser time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'Member';

  useEffect(() => {
    if (!sessionToken) {
      setLoadingOrders(false);
      return;
    }

    let isMounted = true;
    getAccountOrdersOnServer(sessionToken, 3)
      .then((res) => {
        if (isMounted && res.success && Array.isArray(res.orders)) {
          setRecentOrders(res.orders);
        }
      })
      .catch(() => {
        // Fallback silently if offline or network error
      })
      .finally(() => {
        if (isMounted) setLoadingOrders(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionToken]);

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">Delivered</span>;
      case 'processing':
      case 'submitted':
        return <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-medium">Processing</span>;
      case 'paid':
      case 'queued':
        return <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-medium">Placed</span>;
      case 'failed':
      case 'refund_pending':
      case 'refunded':
        return <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-medium">Issue</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[10px] font-medium">Pending</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-6 space-y-6">
      {/* 1. Header Greeting Panel */}
      <div className="relative rounded-2xl sm:rounded-3xl bg-[#090d11] border border-slate-800/90 overflow-hidden p-5 sm:p-7 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#00c365]/10 rounded-full blur-[90px] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#112019] border border-[#00c365]/30 text-xs font-semibold text-[#00c365]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Your Mystery Hub Home</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {getGreeting()}, {firstName} 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Buy data, build websites, track orders, and discover services from one place.
            </p>
          </div>

          {/* Account Benefits Chip Line */}
          <div className="flex flex-wrap gap-2 pt-2 md:pt-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-[#00c365]" />
              Account-Linked Orders
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300">
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              Website Builder Access
            </span>
          </div>
        </div>
      </div>

      {/* 2. Primary Quick Actions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Quick Actions
          </h2>
          <button
            onClick={() => openDataPage('instant')}
            className="text-xs text-[#00c365] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Instant Bundles</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <button
            onClick={() => openDataPage('data')}
            className="p-4 rounded-2xl bg-[#0f151b] border border-slate-800/90 hover:border-[#00c365]/50 transition-all text-left group cursor-pointer shadow-sm hover:shadow-md"
          >
            <div className="w-9 h-9 rounded-xl bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365] mb-3 group-hover:scale-105 transition-transform">
              <Wifi className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-[#00c365] transition-colors">Buy Data</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Non-expiring bundles</p>
          </button>

          <button
            onClick={() => openDataPage('airtime')}
            className="p-4 rounded-2xl bg-[#0f151b] border border-slate-800/90 hover:border-sky-500/50 transition-all text-left group cursor-pointer shadow-sm hover:shadow-md"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-3 group-hover:scale-105 transition-transform">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-sky-400 transition-colors">Top Up Airtime</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Instant MoMo top-up</p>
          </button>

          <button
            onClick={() => setActivePage('website')}
            className="p-4 rounded-2xl bg-[#0f151b] border border-slate-800/90 hover:border-purple-500/50 transition-all text-left group cursor-pointer shadow-sm hover:shadow-md"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3 group-hover:scale-105 transition-transform">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-purple-400 transition-colors">Build Website</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Ghana business sites</p>
          </button>

          <button
            onClick={() => setActivePage('marketplace')}
            className="p-4 rounded-2xl bg-[#0f151b] border border-slate-800/90 hover:border-amber-500/50 transition-all text-left group cursor-pointer shadow-sm hover:shadow-md"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-amber-400 transition-colors">Marketplace</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Laptops, tech & gear</p>
          </button>
        </div>
      </div>

      {/* 3. Recent Activity & Mystery Earn Teaser Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Orders (2 Cols on Desktop) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#00c365]" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Your Recent Orders</h2>
            </div>
            <button
              onClick={() => setActivePage('orders')}
              className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loadingOrders ? (
            <div className="p-5 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-3 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-1/3" />
              <div className="h-10 bg-slate-800/60 rounded" />
              <div className="h-10 bg-slate-800/60 rounded" />
            </div>
          ) : recentOrders.length > 0 ? (
            <div className="space-y-2.5">
              {recentOrders.map((ord) => (
                <div
                  key={ord.public_reference}
                  className="p-3.5 rounded-2xl bg-[#0f151b] border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-[#00c365]" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white truncate">
                          {ord.product_name_snapshot || ord.bundle_size_snapshot || 'Data Order'}
                        </span>
                        <span className="uppercase text-[10px] font-semibold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {ord.network}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {ord.recipient_phone} • {ord.public_reference}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-xs text-white">GH₵{ord.amount_ghc.toFixed(2)}</p>
                      {getStatusBadge(ord.status)}
                    </div>
                    <button
                      onClick={() => {
                        openOrderStatus({
                          id: ord.public_reference,
                          publicReference: ord.public_reference,
                          serverReference: ord.public_reference,
                          serverStatus: ord.status,
                          bundle: {
                            id: 'recent-bundle',
                            network: ord.network,
                            dataAmount: ord.bundle_size_snapshot,
                            dataBytesValue: 0,
                            validity: 'Standard',
                            validityCategory: 'Daily',
                            priceGhc: ord.amount_ghc,
                            description: ord.product_name_snapshot,
                          },
                          recipientPhone: ord.recipient_phone,
                          network: ord.network,
                          paymentMethod: 'paystack',
                          amountGhc: ord.amount_ghc,
                          status: ord.status === 'delivered' ? 'delivered' : ord.status === 'processing' || ord.status === 'submitted' ? 'processing' : 'placed',
                          createdAt: ord.created_at,
                          updatedAt: ord.created_at,
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-800 transition-colors cursor-pointer"
                    >
                      Track
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-[#0f151b] border border-slate-800 text-center space-y-3">
              <Package className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="space-y-1">
                <p className="font-semibold text-xs text-white">No purchases on this account yet.</p>
                <p className="text-[11px] text-slate-400">Your orders will be safely tracked here across devices.</p>
              </div>
              <button
                onClick={() => openDataPage('data')}
                className="px-4 py-2 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Buy Data
              </button>
            </div>
          )}
        </div>

        {/* Mystery Earn Teaser (1 Col on Desktop) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Mystery Earn</h2>
            <span className="px-2 py-0.5 rounded-md bg-[#00c365]/10 text-[#00c365] border border-[#00c365]/30 text-[10px] font-semibold">
              Coming Soon
            </span>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-white">Refer & Earn Program</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your personal referral link, product sharing rewards and referral history are coming to your Mystery Hub account.
              </p>
            </div>
            <div className="pt-1">
              <span className="inline-block text-[11px] text-slate-400 italic">
                Stay tuned for updates.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
