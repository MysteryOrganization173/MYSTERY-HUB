import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getAccountOrdersOnServer } from '../../services/apiClient';
import { SafePublicOrderDetails } from '../../../server/types/orders';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';
import {
  Wifi,
  Globe,
  ShoppingBag,
  Grid2X2,
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
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

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
    getAccountOrdersOnServer(sessionToken, 5)
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

  // Cleaned recent orders: strictly exclude unpaid checkouts or cancelled attempts
  const cleanRecentOrders = recentOrders.filter(
    (ord) =>
      ord.status !== 'pending_payment' &&
      ord.status !== 'cancelled' &&
      ord.status !== 'expired'
  );

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
            Delivered
          </span>
        );
      case 'processing':
      case 'submitted':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold">
            Processing
          </span>
        );
      case 'paid':
      case 'queued':
        return (
          <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-semibold">
            Placed
          </span>
        );
      case 'failed':
      case 'refund_pending':
      case 'refunded':
        return (
          <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-semibold">
            Attention
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[10px] font-semibold">
            Processing
          </span>
        );
    }
  };

  const quickServices = [
    {
      id: 'data',
      title: 'Data Bundles',
      desc: 'MTN, Telecel & AT',
      icon: Wifi,
      image:
        'https://res.cloudinary.com/da6oeat7m/image/upload/v1790888903/ChatGPT_Image_Oct_1_2026_09_04_50_PM-1_wam5ps.png',
      accentText: 'text-amber-400',
      accentBg: 'bg-amber-400/10 group-hover:bg-amber-400/15',
      accentBorder: 'border-amber-400/20 group-hover:border-amber-400/45',
      cardBorder: 'border border-amber-500/15 hover:border-amber-400/40',
      badgeAccent: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
      glowAccent: 'shadow-amber-500/5 hover:shadow-amber-500/10',
      objectPosition: '50% 30%',
      action: () => openDataPage('data'),
      tag: 'Live',
    },
    {
      id: 'website',
      title: 'Website Builder',
      desc: 'For Ghanaian businesses',
      icon: Globe,
      image:
        'https://res.cloudinary.com/da6oeat7m/image/upload/v1790888916/ChatGPT_Image_Oct_1_2026_09_05_01_PM-2_gqtzsj.png',
      accentText: 'text-sky-400',
      accentBg: 'bg-sky-400/10 group-hover:bg-sky-400/15',
      accentBorder: 'border-sky-400/20 group-hover:border-sky-400/45',
      cardBorder: 'border border-sky-500/15 hover:border-sky-400/40',
      badgeAccent: 'text-sky-400 border-sky-500/20 bg-sky-500/10',
      glowAccent: 'shadow-sky-500/5 hover:shadow-sky-500/10',
      objectPosition: '50% 50%',
      action: () => setActivePage('website'),
      tag: 'Beta',
    },
    {
      id: 'marketplace',
      title: 'Tech Marketplace',
      desc: 'Laptops, tools & more',
      icon: ShoppingBag,
      image:
        'https://res.cloudinary.com/da6oeat7m/image/upload/v1790888926/ChatGPT_Image_Oct_1_2026_09_05_06_PM-3_kgmhjj.png',
      accentText: 'text-[#00c365]',
      accentBg: 'bg-[#00c365]/10 group-hover:bg-[#00c365]/15',
      accentBorder: 'border-[#00c365]/20 group-hover:border-[#00c365]/45',
      cardBorder: 'border border-emerald-500/15 hover:border-emerald-400/40',
      badgeAccent: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
      glowAccent: 'shadow-[#00c365]/5 hover:shadow-[#00c365]/10',
      objectPosition: '50% 45%',
      action: () => setActivePage('marketplace'),
      tag: 'New',
    },
    {
      id: 'services',
      title: 'More Utilities',
      desc: 'Bills, utilities & more',
      icon: Grid2X2,
      image:
        'https://res.cloudinary.com/da6oeat7m/image/upload/v1790888944/ChatGPT_Image_Oct_1_2026_09_05_09_PM-4_aiazfw.png',
      accentText: 'text-purple-400',
      accentBg: 'bg-purple-400/10 group-hover:bg-purple-400/15',
      accentBorder: 'border-purple-400/20 group-hover:border-purple-400/45',
      cardBorder: 'border border-purple-500/15 hover:border-purple-400/40',
      badgeAccent: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
      glowAccent: 'shadow-purple-500/5 hover:shadow-purple-500/10',
      objectPosition: '50% 50%',
      action: () => setActivePage('services'),
      tag: 'Coming Soon',
    },
  ];

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

      {/* 2. Primary Quick Actions — 100% Visual Parity with Homepage Quick Services Tiles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Quick Services
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openDataPage('airtime')}
              className="text-xs text-sky-400 hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Top Up Airtime</span>
            </button>
            <button
              onClick={() => openDataPage('instant')}
              className="text-xs text-[#00c365] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Instant Bundles</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 p-2 sm:p-3 rounded-2xl bg-[#0c1217]/90 border border-slate-800/90 backdrop-blur-md shadow-xl">
          {quickServices.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={s.action}
                className={`relative p-3 sm:p-4 rounded-xl bg-[#0b0f13]/95 text-left transition-all duration-300 group flex flex-col justify-between cursor-pointer overflow-hidden active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365]/50 shadow-md ${s.cardBorder} ${s.glowAccent}`}
              >
                {/* Cinematic Background Image with Cloudinary Optimization */}
                <img
                  src={getCloudinaryUrl(s.image, { width: 480, crop: 'fill', gravity: 'center' })}
                  srcSet={getCloudinarySrcSet(s.image, [320, 480, 640], { crop: 'fill', gravity: 'center' })}
                  sizes="(max-width: 640px) 50vw, 25vw"
                  alt={s.title}
                  loading="lazy"
                  decoding="async"
                  onLoad={() => setLoadedImages((prev) => ({ ...prev, [s.id]: true }))}
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-out transform scale-100 group-hover:scale-[1.03] z-0 ${
                    loadedImages[s.id] ? 'opacity-[0.52] group-hover:opacity-[0.68]' : 'opacity-0'
                  }`}
                  style={{ objectPosition: s.objectPosition }}
                />

                {/* Layered Gradient Overlay System */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#060a0f] via-[#060a0f]/85 to-[#060a0f]/20 transition-all duration-300 z-10" />
                <div className="absolute inset-0 bg-[#060a0f]/12 group-hover:bg-[#060a0f]/6 transition-all duration-300 z-5" />

                {/* Interactive Content */}
                <div className="relative z-20 flex flex-col justify-between h-full w-full">
                  <div className="flex items-center justify-between w-full gap-2">
                    <div
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center backdrop-blur-md transition-all duration-300 shadow-sm ${s.accentBg} ${s.accentBorder} ${s.accentText}`}
                    >
                      <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      <span
                        className={`text-[8.5px] sm:text-[9.5px] font-extrabold tracking-wide uppercase backdrop-blur-md border px-1.5 sm:px-2 py-0.5 rounded-md transition-all duration-300 shadow-sm whitespace-nowrap ${s.badgeAccent}`}
                      >
                        {s.tag}
                      </span>
                      <div
                        className={`w-5 h-5 rounded-lg backdrop-blur-md bg-white/5 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0 transition-all duration-300 ${s.accentText}`}
                      >
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 sm:mt-6">
                    <div className="font-bold text-xs sm:text-sm text-white group-hover:text-white transition-colors tracking-tight">
                      {s.title}
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-300 truncate mt-0.5 font-medium">
                      {s.desc}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
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
          ) : cleanRecentOrders.length > 0 ? (
            <div className="space-y-2.5">
              {cleanRecentOrders.map((ord) => (
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
                          status:
                            ord.status === 'delivered'
                              ? 'delivered'
                              : ord.status === 'processing' || ord.status === 'submitted'
                              ? 'processing'
                              : 'placed',
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

          <div
            onClick={() => setActivePage('earn')}
            className="p-4 sm:p-5 rounded-2xl bg-[#0f151b] border border-slate-800 hover:border-[#00c365]/50 transition-all space-y-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-white group-hover:text-[#00c365] transition-colors flex items-center justify-between">
                <span>Refer & Earn Program</span>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#00c365] group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your personal referral link, product sharing rewards and referral history are coming to your Mystery Hub account.
              </p>
            </div>
            <div className="pt-1">
              <span className="inline-block text-[11px] text-[#00c365] font-semibold">
                Learn more about Mystery Earn &rarr;
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

