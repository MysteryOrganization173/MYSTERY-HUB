import {HomeWalletSummary} from './HomeWalletSummary';
import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getAccountOrdersOnServer } from '../../services/apiClient';
import { SafePublicOrderDetails } from '../../../server/types/orders';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';
import {
  Wifi,
  Smartphone,
  Globe,
  ShoppingBag,
  Gift,
  Grid2X2,
  Zap,
  ArrowRight,
  Clock,
  Sparkles,
  ShieldCheck,
  Package,
} from 'lucide-react';

const MEMBER_HERO_ARTWORK_URL =
  'https://res.cloudinary.com/da6oeat7m/image/upload/v1790940772/61009651-f075-49c5-a7b9-83c450f6aa3c_tf4x36.png';

export const MemberHome: React.FC = () => {
  const { user, sessionToken, openDataPage, setActivePage, openOrderStatus } = useApp();
  const [recentOrders, setRecentOrders] = useState<SafePublicOrderDetails[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [heroImageFailed, setHeroImageFailed] = useState(false);

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
      accentText: 'text-amber-400',
      accentBg: 'bg-amber-400/10 group-hover:bg-amber-400/15',
      accentBorder: 'border-amber-400/25 group-hover:border-amber-400/50',
      cardBorder: 'border border-amber-500/20 hover:border-amber-400/50',
      badgeAccent: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      action: () => openDataPage('data'),
      tag: 'Available',
    },
    {
      id: 'airtime',
      title: 'Airtime Top-Up',
      desc: 'Top up airtime',
      icon: Smartphone,
      accentText: 'text-emerald-400',
      accentBg: 'bg-emerald-400/10 group-hover:bg-emerald-400/15',
      accentBorder: 'border-emerald-400/25 group-hover:border-emerald-400/50',
      cardBorder: 'border border-emerald-500/20 hover:border-emerald-400/50',
      badgeAccent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      action: () => openDataPage('airtime'),
      tag: 'Available',
    },
    {
      id: 'afa',
      title: 'AFA Registration',
      desc: 'Check availability',
      icon: ShieldCheck,
      accentText: 'text-teal-400',
      accentBg: 'bg-teal-400/10 group-hover:bg-teal-400/15',
      accentBorder: 'border-teal-400/25 group-hover:border-teal-400/50',
      cardBorder: 'border border-teal-500/20 hover:border-teal-400/50',
      badgeAccent: 'text-teal-400 border-teal-500/30 bg-teal-500/10',
      action: () => setActivePage('afa'),
      tag: 'Check Status',
    },
    {
      id: 'website',
      title: 'Website Builder',
      desc: 'Create a free website',
      icon: Globe,
      accentText: 'text-sky-400',
      accentBg: 'bg-sky-400/10 group-hover:bg-sky-400/15',
      accentBorder: 'border-sky-400/25 group-hover:border-sky-400/50',
      cardBorder: 'border border-sky-500/20 hover:border-sky-400/50',
      badgeAccent: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
      action: () => setActivePage('website'),
      tag: 'Beta',
    },
    {
      id: 'marketplace',
      title: 'Marketplace',
      desc: 'Phones, POS & Tech',
      icon: ShoppingBag,
      accentText: 'text-[#00c365]',
      accentBg: 'bg-[#00c365]/10 group-hover:bg-[#00c365]/15',
      accentBorder: 'border-[#00c365]/25 group-hover:border-[#00c365]/50',
      cardBorder: 'border border-emerald-500/20 hover:border-emerald-400/50',
      badgeAccent: 'text-[#00c365] border-emerald-500/30 bg-emerald-500/10',
      action: () => setActivePage('marketplace'),
      tag: 'New',
    },
    {
      id: 'earn',
      title: 'Mystery Earn',
      desc: 'Qualifying purchase rewards',
      icon: Gift,
      accentText: 'text-yellow-400',
      accentBg: 'bg-yellow-400/10 group-hover:bg-yellow-400/15',
      accentBorder: 'border-yellow-400/25 group-hover:border-yellow-400/50',
      cardBorder: 'border border-yellow-500/20 hover:border-yellow-400/50',
      badgeAccent: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
      action: () => setActivePage('earn'),
      tag: 'Available',
    },
    {
      id: 'services',
      title: 'More Services',
      desc: 'Utilities & bills',
      icon: Grid2X2,
      accentText: 'text-purple-400',
      accentBg: 'bg-purple-400/10 group-hover:bg-purple-400/15',
      accentBorder: 'border-purple-400/25 group-hover:border-purple-400/50',
      cardBorder: 'border border-purple-500/20 hover:border-purple-400/50',
      badgeAccent: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
      action: () => setActivePage('services'),
      tag: 'Coming soon',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-6 space-y-5">
      {/* 1. Header Greeting Panel */}
      <div className="relative rounded-2xl sm:rounded-3xl bg-[#090d11] border border-slate-800/90 overflow-hidden p-5 sm:p-7 shadow-xl group">
        {/* Background Artwork Layer */}
        {!heroImageFailed && (
          <img
            src={getCloudinaryUrl(MEMBER_HERO_ARTWORK_URL, { width: 960, quality: 'auto', format: 'auto' })}
            srcSet={getCloudinarySrcSet(MEMBER_HERO_ARTWORK_URL, [480, 640, 768, 960, 1200, 1440])}
            sizes="(max-width: 1024px) 100vw, 80vw"
            alt=""
            aria-hidden="true"
            loading="eager"
            // @ts-ignore
            fetchPriority="high"
            decoding="async"
            onLoad={() => setHeroImageLoaded(true)}
            onError={() => setHeroImageFailed(true)}
            className={`absolute inset-0 w-full h-full object-cover object-[70%_center] sm:object-[75%_center] lg:object-right transition-all duration-700 ease-out z-0 ${
              heroImageLoaded ? 'opacity-65 sm:opacity-75 lg:opacity-85 scale-100 group-hover:scale-[1.02]' : 'opacity-0'
            }`}
          />
        )}

        {/* Readability Gradient Overlays: Dark near-black on left/middle, fading on right */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#090d11] via-[#090d11]/90 to-[#090d11]/30 sm:via-[#090d11]/85 sm:to-[#090d11]/20 pointer-events-none z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090d11] via-transparent to-transparent opacity-80 sm:opacity-40 pointer-events-none z-10" />

        {/* Ambient Background Emerald Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#00c365]/15 rounded-full blur-[90px] pointer-events-none z-10" />

        {/* Real Content Layer */}
        <div className="relative z-20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#112019]/90 border border-[#00c365]/35 text-xs font-semibold text-[#00c365] shadow-sm backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Your Mystery Hub Home</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
              {getGreeting()}, {firstName} 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal drop-shadow-sm">
              Buy data, build websites, track orders, and discover services from one place.
            </p>
          </div>

          {/* Account Benefits Chip Line */}
          <div className="flex flex-wrap gap-2 pt-1 md:pt-0 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#090d11]/90 border border-slate-700/80 text-[11px] font-medium text-slate-200 backdrop-blur-md shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-[#00c365]" />
              Account-Linked Orders
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#090d11]/90 border border-slate-700/80 text-[11px] font-medium text-slate-200 backdrop-blur-md shadow-sm">
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              Website Builder Access
            </span>
          </div>
        </div>
      </div>

      <HomeWalletSummary />
      {!loadingOrders && cleanRecentOrders[0] && <section className="mh-surface flex flex-wrap justify-between items-center gap-3" aria-label="Latest order"><div><p className="text-sm text-slate-400">Latest order</p><h2 className="text-lg font-semibold mt-1">{cleanRecentOrders[0].product_name_snapshot||cleanRecentOrders[0].bundle_size_snapshot}</h2><p className="mt-1">{getStatusBadge(cleanRecentOrders[0].status)}</p></div><button className="mh-button-secondary" onClick={()=>setActivePage('orders')}>View order</button></section>}

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

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-2.5 p-2 sm:p-3 rounded-2xl bg-[#0c1217]/95 border border-slate-800/90 backdrop-blur-md shadow-xl">
          {quickServices.map((s, idx) => {
            const Icon = s.icon;
            const isLastOnMobileOdd = idx === 6;

            return (
              <button
                key={s.id}
                onClick={s.action}
                className={`relative p-2.5 sm:p-3 rounded-xl bg-[#090e12] text-left transition-all duration-200 group cursor-pointer overflow-hidden active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365]/50 shadow-sm ${s.cardBorder} ${
                  isLastOnMobileOdd
                    ? 'col-span-2 sm:col-span-1 flex flex-row sm:flex-col items-center sm:items-stretch justify-between'
                    : 'flex flex-col justify-between'
                }`}
              >
                {/* Header Row: Icon + Status Badge */}
                <div className={`flex items-center justify-between w-full gap-1.5 ${isLastOnMobileOdd ? 'sm:flex hidden' : 'flex'}`}>
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center transition-all duration-200 shadow-xs ${s.accentBg} ${s.accentBorder} ${s.accentText}`}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>

                  <span
                    className={`text-[8.5px] font-bold tracking-wide uppercase border px-1.5 py-0.5 rounded-md whitespace-nowrap ${s.badgeAccent}`}
                  >
                    {s.tag}
                  </span>
                </div>

                {/* Mobile-only horizontal layout for 7th spanning item */}
                {isLastOnMobileOdd && (
                  <div className="flex sm:hidden items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all duration-200 shadow-xs shrink-0 ${s.accentBg} ${s.accentBorder} ${s.accentText}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-white group-hover:text-[#00c365] transition-colors tracking-tight truncate">
                        {s.title}
                      </div>
                      <div className="text-[10.5px] text-slate-400 truncate font-normal">
                        {s.desc}
                      </div>
                    </div>
                  </div>
                )}

                {/* Typography: Title + Subtitle (standard view) */}
                <div className={`mt-2.5 sm:mt-3 ${isLastOnMobileOdd ? 'hidden sm:block' : 'block'}`}>
                  <div className="font-bold text-xs text-white group-hover:text-[#00c365] transition-colors tracking-tight truncate">
                    {s.title}
                  </div>
                  <div className="text-[10.5px] text-slate-400 truncate mt-0.5 font-normal">
                    {s.desc}
                  </div>
                </div>

                {/* Mobile-only badge/action indicator for 7th spanning item */}
                {isLastOnMobileOdd && (
                  <div className="flex sm:hidden items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[8.5px] font-bold tracking-wide uppercase border px-1.5 py-0.5 rounded-md whitespace-nowrap ${s.badgeAccent}`}
                    >
                      {s.tag}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#00c365] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                )}
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

        {/* Mystery Earn (1 Col on Desktop) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Mystery Earn</h2>
            <span className="px-2 py-0.5 rounded-md bg-[#00c365]/10 text-[#00c365] border border-[#00c365]/30 text-[10px] font-semibold">
              Live Rewards
            </span>
          </div>

          <div
            onClick={() => setActivePage('earn')}
            className="p-4 sm:p-5 rounded-2xl bg-[#0f151b] border border-slate-800 hover:border-[#00c365]/50 transition-all space-y-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365] group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-white group-hover:text-[#00c365] transition-colors flex items-center justify-between">
                <span>My Referrals & Rewards</span>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#00c365] group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Share your referral link, view linked customers and check your reward history.
              </p>
            </div>
            <div className="pt-1">
              <span className="inline-block text-[11px] text-[#00c365] font-semibold">
                View My Referrals &rarr;
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

