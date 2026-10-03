import React, { useState, useEffect, useRef } from 'react';
import { describeReferralReward } from '../../utils/referralRewardCopy';
import { createEarnDashboardRefresh } from '../../utils/earnDashboardRefresh';
import { useApp } from '../../context/AppContext';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';
import {
  getMyReferralSummary,
  getMyRewardLedger,
  getActiveRewardRules,
  ReferralSummaryResponse,
  RewardLedgerItem,
  PublicRewardRule,
} from '../../services/apiClient';
import { buildReferralUrl } from '../../utils/referralUrl';
import {
  Gift,
  Share2,
  Zap,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Users,
  MousePointerClick,
  TrendingUp,
  Clock,
  Layers,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  HelpCircle,
  Smartphone,
  Globe,
  Award,
  AlertCircle,
} from 'lucide-react';

const MYSTERY_EARN_ARTWORK_URL =
  'https://res.cloudinary.com/da6oeat7m/image/upload/v1790940221/Neon_Rewards_Network_with_Gift_Box_ueitrt.png';

export interface MysteryEarnPageProps {
  highestActiveReferralRewardMinor?: number | null;
}

export const MysteryEarnPage: React.FC<MysteryEarnPageProps> = () => {
  const { user, sessionToken, isAuthChecking, openAuth, showToast, setActivePage } = useApp();

  // Media loading
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);

  // Authenticated Referral Data
  const [summary, setSummary] = useState<ReferralSummaryResponse['summary'] | null>(null);
  const [ledger, setLedger] = useState<RewardLedgerItem[]>([]);
  const [rules, setRules] = useState<PublicRewardRule[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshDashboard = useRef<(() => Promise<void>) | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Official Hero Artwork Assets
  const desktopArtworkUrl =
    'https://res.cloudinary.com/da6oeat7m/image/upload/v1790877120/a4e9ca0a-8a11-43a4-930f-7252e97d01c8_i9bmqs.png';
  const desktopHeroSrc = getCloudinaryUrl(desktopArtworkUrl, { format: 'auto', quality: 'auto' });
  const desktopHeroSrcSet = getCloudinarySrcSet(desktopArtworkUrl, [768, 1024, 1280, 1600]);

  const mobileArtworkUrl =
    'https://res.cloudinary.com/da6oeat7m/image/upload/v1790877287/72fcc9b0-5ea3-4d4f-92fe-bfd1e3b8ac52_xe8gdu.png';
  const mobileHeroSrc = getCloudinaryUrl(mobileArtworkUrl, { format: 'auto', quality: 'auto' });
  const mobileHeroSrcSet = getCloudinarySrcSet(mobileArtworkUrl, [360, 430, 640]);

  // Load active reward rules (publicly accessible)
  useEffect(() => {
    let isMounted = true;
    getActiveRewardRules()
      .then((res) => {
        if (isMounted && res.success && Array.isArray(res.rules)) {
          setRules(res.rules.filter((r) => r.enabled));
        }
      })
      .catch((err) => {
        console.warn('[MysteryEarn] Failed to fetch reward rules:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Load authenticated summary and reward ledger
  useEffect(() => {
    if (!user || !sessionToken) {
      setSummary(null);
      setLedger([]);
      setRefreshError(null);
      setIsLoadingDashboard(false);
      setIsRefreshing(false);
      return;
    }

    setSummary(null);
    setLedger([]);
    setIsLoadingDashboard(true);
    const controller = createEarnDashboardRefresh({
      loadSummary: () => getMyReferralSummary(sessionToken),
      loadLedger: () => getMyRewardLedger(sessionToken, 50),
      onSummary: setSummary,
      onLedger: setLedger,
      onState: state => {
        setIsRefreshing(state.refreshing);
        setRefreshError(state.error);
        if (!state.refreshing) setIsLoadingDashboard(false);
      },
      window, document,
    });
    refreshDashboard.current = controller.refresh;
    void controller.refresh();
    return () => {
      controller.dispose();
      refreshDashboard.current = null;
    };
  }, [user?.id, sessionToken]);

  // Handle Share Actions
  const shareUrl =
    summary?.shareUrl ||
    (summary?.code ? buildReferralUrl('/', summary.code) : typeof window !== 'undefined' ? window.location.origin : 'https://mysterybundlehub.com');

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      showToast('Referral link copied to clipboard!', 'success');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast('Please copy the link directly.', 'info');
    }
  };

  const handleWhatsAppShare = () => {
    const text = `Check out Mystery Hub 💚\nBuy data, build a website and access digital services in one place.\nUse my link:\n${shareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const getDestinationUrl = (path: string) => {
    return summary?.code ? buildReferralUrl(path, summary.code) : shareUrl;
  };

  const [copiedDestPath, setCopiedDestPath] = useState<string | null>(null);

  const handleCopyDestination = async (path: string, label: string) => {
    const url = getDestinationUrl(path);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedDestPath(path);
      showToast(`${label} referral link copied!`, 'success');
      setTimeout(() => setCopiedDestPath(null), 2500);
    } catch {
      showToast('Please copy the link directly.', 'info');
    }
  };

  const handleWhatsAppDestination = (path: string, label: string, desc: string) => {
    const url = getDestinationUrl(path);
    const text = `Check out ${label} on Mystery Hub 💚\n${desc}\n${url}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleNativeShare = async () => {
    if (navigator?.share) {
      try {
        await navigator.share({
          title: 'Mystery Hub',
          text: 'Buy data, build websites, and access digital services on Mystery Hub.',
          url: shareUrl,
        });
        showToast('Shared successfully!', 'success');
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const scrollToHowItWorks = () => {
    const el = document.getElementById('how-it-works-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 0. AUTH HYDRATION SKELETON (Prevents flash of guest page)
  if (isAuthChecking) {
    return (
      <div className="min-h-screen py-6 sm:py-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 animate-pulse">
        <div className="h-64 sm:h-80 bg-slate-900/60 rounded-3xl border border-slate-800" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-slate-900/40 rounded-2xl border border-slate-800" />
          <div className="h-28 bg-slate-900/40 rounded-2xl border border-slate-800" />
          <div className="h-28 bg-slate-900/40 rounded-2xl border border-slate-800" />
          <div className="h-28 bg-slate-900/40 rounded-2xl border border-slate-800" />
        </div>
      </div>
    );
  }

  // =========================================================================
  // EXPERIENCE A: AUTHENTICATED MEMBER DASHBOARD
  // =========================================================================
  if (user) {
    const firstName = user.name ? user.name.trim().split(' ')[0] : 'Partner';

    return (
      <div className="min-h-screen py-6 sm:py-10 text-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
          {/* 1. Member Command Panel Hero (Unified Card with Seamless Artwork Integration) */}
          <div className="relative rounded-3xl bg-gradient-to-br from-[#0a1410] via-[#070b0e] to-[#0d1612] border border-[#00c365]/35 overflow-hidden shadow-2xl p-5 sm:p-7 lg:p-8">
            {/* Integrated Artwork Layer (Background on Mobile, Seamless Right Wing on Desktop) */}
            <div className="absolute inset-y-0 right-0 w-full sm:w-2/3 lg:w-1/2 pointer-events-none select-none z-0 overflow-hidden">
              <img
                src={getCloudinaryUrl(MYSTERY_EARN_ARTWORK_URL, { width: 960, quality: 'auto', format: 'auto' })}
                srcSet={getCloudinarySrcSet(MYSTERY_EARN_ARTWORK_URL, [480, 640, 768, 960, 1200])}
                sizes="(max-width: 640px) 100vw, 50vw"
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover object-[85%_center] opacity-35 sm:opacity-65 lg:opacity-85"
              />
              {/* Desktop smooth gradient mask */}
              <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#070b0e] via-[#070b0e]/75 to-transparent" />
              {/* Mobile gradient overlay for strong text readability */}
              <div className="lg:hidden absolute inset-0 bg-gradient-to-r from-[#070b0e]/95 via-[#070b0e]/85 to-[#070b0e]/50" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070b0e] via-transparent to-[#070b0e]/30" />
            </div>

            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#00c365]/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-amber-500/5 rounded-full blur-[90px] pointer-events-none" />

            <div className="relative z-10 max-w-xl lg:max-w-2xl space-y-4 sm:space-y-5">
              {/* Header Meta */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00c365]/15 border border-[#00c365]/40 text-xs font-bold text-[#00c365] backdrop-blur-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>MYSTERY EARN · ACTIVE PARTNER</span>
                </div>

                {summary?.code && (
                  <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/90 border border-slate-700/80 px-3 py-1 rounded-full backdrop-blur-sm">
                    <span className="text-slate-400 font-medium">Referral Code:</span>
                    <span className="font-mono font-bold text-[#00c365] tracking-wider">{summary.code}</span>
                  </div>
                )}
              </div>

              {/* Title & Simplified Copy */}
              <div className="space-y-1.5 text-left">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                  Welcome, {firstName} 👋
                </h1>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-normal">
                  Refer once. Earn from qualifying purchases when they return.
                </p>
              </div>

              {/* Personal Link Command Box */}
              <div className="space-y-2.5 pt-1">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider text-left">
                  Your Personal Referral Link
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {/* Readonly Link Box */}
                  <div className="flex-1 flex items-center bg-[#070b0e]/95 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-200 overflow-hidden shadow-inner backdrop-blur-sm">
                    <span className="truncate select-all">{shareUrl}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      aria-label="Copy referral link"
                      className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleWhatsAppShare}
                      aria-label="Share referral link on WhatsApp"
                      className="px-3.5 py-2.5 rounded-xl bg-[#25D366]/25 hover:bg-[#25D366]/35 text-[#25D366] border border-[#25D366]/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer backdrop-blur-sm"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNativeShare}
                      aria-label="Share referral link"
                      className="px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer backdrop-blur-sm"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Real Referral Statistics */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Performance Metrics</h2>
              <button type="button" disabled={isRefreshing} onClick={() => void refreshDashboard.current?.()}
                className="text-xs text-[#00c365] disabled:opacity-50">{isRefreshing ? 'Refreshing…' : 'Refresh'}</button>
              {isLoadingDashboard && (
                <span className="text-[11px] text-[#00c365] animate-pulse font-medium">Syncing live ledger...</span>
              )}
            </div>
            {refreshError && <p role="status" className="text-xs text-amber-300">{refreshError}</p>}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Stat 1: Clicks */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0b1015] border border-slate-800/80 shadow-sm space-y-1.5 text-left">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold">Unique Visitors</span>
                  <MousePointerClick className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {summary?.uniqueVisitorsCount != null ? summary.uniqueVisitorsCount.toLocaleString() : '—'}
                </div>
                <p className="text-[11px] text-slate-400">Distinct browsers that opened your referral links</p>
              </div>

              {/* Stat 2: Referred Customers */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0b1015] border border-slate-800/80 shadow-sm space-y-1.5 text-left">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold">People Referred</span>
                  <Users className="w-4 h-4 text-[#00c365]" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {summary ? summary.referredCustomersCount.toLocaleString() : '0'}
                </div>
                <p className="text-[11px] text-slate-400">Bound lifetime customers</p>
              </div>

              {/* Stat 3: Pending Rewards */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0b1015] border border-slate-800/80 shadow-sm space-y-1.5 text-left">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold">Pending Rewards</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-tight">
                  GH₵{summary ? summary.pendingRewardsGhc.toFixed(2) : '0.00'}
                </div>
                <p className="text-[11px] text-slate-400">Awaiting order verification</p>
              </div>

              {/* Stat 4: Total Approved Earned */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0b1015] border border-[#00c365]/30 bg-gradient-to-br from-[#0b1015] to-[#0c1813] shadow-sm space-y-1.5 text-left">
                <div className="flex items-center justify-between text-[#00c365]">
                  <span className="text-xs font-semibold">Total Earned</span>
                  <Award className="w-4 h-4 text-[#00c365]" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#00c365] tracking-tight">
                  GH₵{summary ? summary.approvedRewardsGhc.toFixed(2) : '0.00'}
                </div>
                <p className="text-[11px] text-slate-400">Approved lifetime rewards</p>
              </div>
            </div>
          </div>

          {/* 3. Core Differentiator: "REFER ONCE. EARN WHEN THEY RETURN." */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#0d1612] via-[#09110d] to-[#0b1015] border border-[#00c365]/40 shadow-md text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#00c365] shrink-0" />
                <h3 className="font-extrabold text-white text-sm sm:text-base tracking-tight">
                  REFER ONCE. EARN WHEN THEY RETURN.
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                When someone becomes linked to your Mystery Earn referral, eligible future purchases can continue generating rewards without them reopening your link every time.
              </p>
              <p className="text-[11px] text-slate-400">
                Rewards depend on the active reward rules for each qualifying service or product.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#00c365] border border-[#00c365]/40 font-bold text-xs uppercase tracking-wider transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Link</span>
            </button>
          </div>

          {/* 3B. 3-Level Network Lineage (Real Figures) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#00c365]" />
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">3-Level Referral Network</h2>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Auto-Attributed Network</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {/* Level 1: Direct */}
              <div className="p-4 rounded-2xl bg-[#0b1015] border border-slate-800/80 space-y-1 text-left">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold text-slate-300">Level 1 (Direct)</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#00c365]/10 text-[#00c365] border border-[#00c365]/30">Direct</span>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-white">
                  {summary?.networkLevel1Count ?? summary?.referredCustomersCount ?? 0}
                </div>
                <p className="text-[11px] text-slate-400">Personally referred members</p>
              </div>

              {/* Level 2: Secondary */}
              <div className="p-4 rounded-2xl bg-[#0b1015] border border-slate-800/80 space-y-1 text-left">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold text-slate-300">Level 2 (Tier 2)</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">Tier 2</span>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-white">
                  {summary?.networkLevel2Count ?? 0}
                </div>
                <p className="text-[11px] text-slate-400">Referred by your Level 1 partners</p>
              </div>

              {/* Level 3: Tertiary */}
              <div className="p-4 rounded-2xl bg-[#0b1015] border border-slate-800/80 space-y-1 text-left">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold text-slate-300">Level 3 (Tier 3)</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">Tier 3</span>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-white">
                  {summary?.networkLevel3Count ?? 0}
                </div>
                <p className="text-[11px] text-slate-400">Referred by your Level 2 partners</p>
              </div>
            </div>
          </div>

          {/* 3C. Share Hub (Target Page Referral Links) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#00c365]" />
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Share Hub · Targeted Referral Links</h2>
              </div>
              <span className="text-[11px] text-[#00c365] font-medium">Lifetime Attribution</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {[
                {
                  id: 'data',
                  title: 'Data Bundles',
                  path: '/data',
                  desc: 'MTN, Telecel, and AT data packages at affordable rates.',
                  badge: 'High Conversion',
                  icon: Smartphone,
                  color: 'text-[#00c365]',
                  bg: 'bg-[#00c365]/10',
                  border: 'border-[#00c365]/20',
                },
                {
                  id: 'marketplace',
                  title: 'Marketplace Sourcing',
                  path: '/marketplace',
                  desc: 'Verified phones, electronics, and hardware with direct cash rewards.',
                  badge: 'Cash Rewards',
                  icon: ShoppingBag,
                  color: 'text-amber-400',
                  bg: 'bg-amber-500/10',
                  border: 'border-amber-500/20',
                },
                {
                  id: 'website',
                  title: 'Website Builder',
                  path: '/website',
                  desc: 'Professional instant business website creation for Ghanaian businesses.',
                  badge: 'Business',
                  icon: Globe,
                  color: 'text-purple-400',
                  bg: 'bg-purple-500/10',
                  border: 'border-purple-500/20',
                },
                {
                  id: 'earn',
                  title: 'Mystery Earn Program',
                  path: '/earn',
                  desc: 'Invite friends and partners to join Mystery Earn and build a team.',
                  badge: 'Partner Invite',
                  icon: Gift,
                  color: 'text-emerald-400',
                  bg: 'bg-emerald-500/10',
                  border: 'border-emerald-500/20',
                },
                {
                  id: 'home',
                  title: 'Mystery Hub Main Portal',
                  path: '/',
                  desc: 'Universal landing page featuring all digital products and services.',
                  badge: 'All Services',
                  icon: Sparkles,
                  color: 'text-sky-400',
                  bg: 'bg-sky-500/10',
                  border: 'border-sky-500/20',
                },
              ].map((target) => {
                const isCopied = copiedDestPath === target.path;
                const TargetIcon = target.icon;

                return (
                  <div
                    key={target.id}
                    className="p-4 rounded-2xl bg-[#0b1015] border border-slate-800/90 flex flex-col justify-between gap-3 text-left hover:border-slate-700/80 transition-all shadow-sm"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg ${target.bg} flex items-center justify-center ${target.color}`}>
                            <TargetIcon className="w-4 h-4" />
                          </div>
                          <h4 className="font-bold text-xs sm:text-sm text-white">{target.title}</h4>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${target.bg} ${target.color} border ${target.border}`}>
                          {target.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{target.desc}</p>
                    </div>

                    <div className="pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyDestination(target.path, target.title)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-[#00c365]" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                        <span className={isCopied ? 'text-[#00c365]' : ''}>{isCopied ? 'Copied' : 'Copy Link'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleWhatsAppDestination(target.path, target.title, target.desc)}
                        aria-label={`Share ${target.title} on WhatsApp`}
                        className="py-1.5 px-2.5 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] text-xs font-semibold transition-all flex items-center justify-center cursor-pointer active:scale-95"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Recent Reward Activity Ledger */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reward Ledger Activity</h2>
              <span className="text-[11px] text-slate-500 font-medium">Immutable Record</span>
            </div>

            <div className="rounded-2xl bg-[#0b1015] border border-slate-800/90 overflow-hidden shadow-sm">
              {ledger.length > 0 ? (
                <div className="divide-y divide-slate-800/80">
                  {ledger.map((item) => {
                    const statusConfig =
                      item.status === 'approved'
                        ? { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Approved' }
                        : item.status === 'pending'
                        ? { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Pending' }
                        : item.status === 'reversed'
                        ? { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', label: 'Reversed' }
                        : { bg: 'bg-slate-800', text: 'text-slate-400', border: 'border-slate-700', label: item.status };

                    const serviceLabel =
                      item.service_type === 'instant_bundle'
                        ? 'Instant Bundle'
                        : item.service_type === 'airtime'
                        ? 'Airtime Top-Up'
                        : item.service_type === 'marketplace'
                        ? 'Marketplace Product'
                        : item.service_type === 'website_builder'
                        ? 'Website Builder Plan'
                        : 'Data Bundle';

                    const formattedDate = new Date(item.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });

                    return (
                      <div
                        key={item.id}
                        className="p-4 sm:p-4.5 flex items-center justify-between gap-3 text-left hover:bg-slate-900/30 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-white truncate">{serviceLabel}</span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                            >
                              {statusConfig.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate max-w-md sm:max-w-xl">
                            {item.reason || `Reward for delivered ${serviceLabel.toLowerCase()}`}
                          </p>
                          <span className="text-[10px] text-slate-500">{formattedDate}</span>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`text-sm sm:text-base font-extrabold font-mono ${
                              item.status === 'approved'
                                ? 'text-[#00c365]'
                                : item.status === 'pending'
                                ? 'text-amber-400'
                                : 'text-slate-400 line-through'
                            }`}
                          >
                            +GH₵{item.amount_ghc.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 sm:p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                    <Gift className="w-6 h-6 text-[#00c365]" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm">No rewards recorded yet</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Share your link and your first qualifying referral will appear here when they complete an eligible order.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-4 py-2 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow cursor-pointer"
                    >
                      Share My Link
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 5. Qualifying Purchases & Reward Transparency */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#0b1015] border border-slate-800 text-left space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#00c365]" />
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Earn From Qualifying Purchases
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              Rewards vary by eligible product and order value. When a referred customer completes a qualifying purchase, your reward is credited automatically.
            </p>
            <p className="text-[11px] text-slate-400">
              Every reward credited to your account is tracked with full transaction details in your Reward Ledger Activity above.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // EXPERIENCE B: PUBLIC / GUEST OPPORTUNITY PAGE
  // =========================================================================
  return (
    <div className="min-h-screen py-6 sm:py-10 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {/* 1. Official Hero Banner Panel */}
        {/* DESKTOP & TABLET HERO (sm and above) */}
        <div className="hidden sm:flex relative rounded-3xl bg-[#070b0e] border border-slate-800/90 overflow-hidden shadow-2xl min-h-[380px] lg:min-h-[420px] items-center">
          {/* Ambient Glows */}
          <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00c365]/15 rounded-full blur-[120px] pointer-events-none z-0" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none z-0" />

          {/* Official Visual Artwork Layer */}
          <div className="absolute inset-0 z-0 select-none overflow-hidden bg-[#070b0e]">
            <picture className="w-full h-full block">
              <source
                media="(min-width: 640px)"
                srcSet={desktopHeroSrcSet}
                sizes="(max-width: 1024px) 100vw, 1280px"
              />
              <img
                src={desktopHeroSrc}
                alt="Mystery Hub Referral Rewards"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onLoad={() => setHeroImageLoaded(true)}
                className={`w-full h-full object-cover object-right lg:object-[82%_center] transition-opacity duration-300 ease-out ${
                  heroImageLoaded ? 'opacity-85 sm:opacity-90 lg:opacity-95' : 'opacity-0'
                }`}
              />
            </picture>
          </div>

          {/* Readability Gradient Overlays */}
          <div className="hidden lg:block absolute inset-0 z-10 bg-gradient-to-r from-[#070b0e] via-[#070b0e]/95 via-48% to-transparent pointer-events-none" />
          <div className="lg:hidden absolute inset-0 z-10 bg-gradient-to-r from-[#070b0e]/95 via-[#070b0e]/85 to-[#070b0e]/35 pointer-events-none" />

          {/* Hero Foreground Content */}
          <div className="relative z-20 w-full max-w-xl lg:max-w-2xl p-10 lg:p-12 space-y-4 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#112019]/90 border border-[#00c365]/40 text-xs font-bold text-[#00c365] backdrop-blur-sm shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>MYSTERY EARN · LIFETIME REFERRALS</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Share Mystery Hub. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#f59e0b]">
                Get Rewarded.
              </span>
            </h1>

            <p className="text-xs sm:text-sm lg:text-base text-slate-300 leading-relaxed">
              Create your free Mystery Hub account, share eligible services and products, and earn rewards when qualifying referrals convert.
            </p>

            <div className="p-3 rounded-xl bg-[#0f1714]/80 border border-[#00c365]/30 text-xs text-slate-300 space-y-1">
              <span className="font-bold text-[#00c365] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Refer once. Earn when they return.
              </span>
              <p className="text-[11px] text-slate-400">
                When a customer is linked to your referral account, eligible future purchases can continue generating rewards while the referral remains valid.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openAuth('signup')}
                className="px-5 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <span>Create Free Account & Start Earning</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={scrollToHowItWorks}
                className="px-5 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700/80 backdrop-blur-sm transition-colors cursor-pointer"
              >
                How Mystery Earn Works
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE HERO (< sm) */}
        <div className="block sm:hidden rounded-3xl bg-[#070b0e] border border-slate-800/90 overflow-hidden shadow-xl p-4.5 space-y-4 text-left">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/40 text-[11px] font-bold text-[#00c365]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>MYSTERY EARN</span>
            </div>

            <h1 className="text-2xl font-extrabold text-white tracking-tight leading-snug">
              Share Mystery Hub. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#f59e0b]">
                Get Rewarded.
              </span>
            </h1>

            <p className="text-xs text-slate-300 leading-relaxed">
              Create your free Mystery Hub account, share eligible services and products, and earn rewards when qualifying referrals convert.
            </p>
          </div>

          {/* Mobile Artwork Container */}
          <div className="relative w-full h-[215px] min-[412px]:h-[235px] rounded-2xl overflow-hidden border border-slate-800/80 bg-[#070b0e] shadow-lg">
            <picture className="w-full h-full block">
              <source media="(max-width: 639px)" srcSet={mobileHeroSrcSet} sizes="100vw" />
              <img
                src={mobileHeroSrc}
                alt="Mystery Hub Referral Rewards"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onLoad={() => setHeroImageLoaded(true)}
                className={`w-full h-full object-cover object-[50%_40%] transition-opacity duration-300 ease-out ${
                  heroImageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </picture>
            <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-[#070b0e]/60 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-[#070b0e]/60 to-transparent pointer-events-none" />
          </div>

          <div className="p-3 rounded-xl bg-[#0f1714] border border-[#00c365]/30 text-xs text-slate-300 space-y-1">
            <span className="font-bold text-[#00c365] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Refer once. Earn when they return.
            </span>
            <p className="text-[11px] text-slate-400">
              When a customer is linked to your referral account, eligible future purchases can continue generating rewards while the referral remains valid.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="w-full py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Create Free Account & Start Earning</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={scrollToHowItWorks}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-xs uppercase tracking-wider border border-slate-700/80 transition-colors cursor-pointer text-center"
            >
              How It Works
            </button>
          </div>
        </div>

        {/* 2. COMPACT 3-STEP "HOW IT WORKS" SECTION */}
        <div id="how-it-works-section" className="space-y-4 text-left scroll-mt-6">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">Simple Process</span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              How Mystery Earn Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
            {/* Step 1 */}
            <div className="p-5 rounded-2xl bg-[#0b1015] border border-slate-800/90 relative overflow-hidden space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#00c365] font-mono">STEP 1</span>
                <Users className="w-4 h-4 text-[#00c365]" />
              </div>
              <h3 className="font-bold text-white text-sm">Create your free account</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sign up in seconds to receive your permanent personal Mystery Hub referral code and share links.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-2xl bg-[#0b1015] border border-slate-800/90 relative overflow-hidden space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#00c365] font-mono">STEP 2</span>
                <Share2 className="w-4 h-4 text-[#00c365]" />
              </div>
              <h3 className="font-bold text-white text-sm">Share your referral links</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Share any Mystery Hub service, data packages, or products on WhatsApp, social media, or directly with friends.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-2xl bg-[#0b1015] border border-slate-800/90 relative overflow-hidden space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#00c365] font-mono">STEP 3</span>
                <Award className="w-4 h-4 text-[#00c365]" />
              </div>
              <h3 className="font-bold text-white text-sm">Earn qualifying rewards</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                When eligible referred orders are delivered, immutable rewards are credited directly to your reward ledger.
              </p>
            </div>
          </div>
        </div>

        {/* 3. OPPORTUNITY TYPES */}
        <div className="space-y-4 text-left">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">Reward Channels</span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Where Rewards Come From
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
            {/* Category 1: Telecom */}
            <div className="p-5 rounded-2xl bg-[#0b1015] border border-slate-800/80 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365]">
                  <Smartphone className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00c365]/10 text-[#00c365] border border-[#00c365]/30">
                  Active Channel
                </span>
              </div>
              <h3 className="font-bold text-white text-sm">Data & Digital Services</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Share daily data bundles and airtime top-ups. When your referred customers complete qualifying telecom orders, your reward is attributed automatically.
              </p>
            </div>

            {/* Category 2: Marketplace */}
            <div className="p-5 rounded-2xl bg-[#0b1015] border border-slate-800/80 space-y-3 text-left flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    Active Channel
                  </span>
                </div>
                <h3 className="font-bold text-white text-sm">Marketplace Sourcing</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Share verified hardware, phones, and sourced products from the Marketplace. Eligible products credit referral rewards upon successful order delivery.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActivePage('marketplace')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <span>Browse Marketplace Opportunities</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Category 3: Website Builder */}
            <div className="p-5 rounded-2xl bg-[#0b1015] border border-slate-800/80 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Globe className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  Coming Later
                </span>
              </div>
              <h3 className="font-bold text-white text-sm">Website Builder</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Refer businesses to the Mystery Hub Website Studio. Referral rewards for professional plans will activate in an upcoming phase.
              </p>
            </div>
          </div>
        </div>

        {/* 4. BENEFIT-FOCUSED EARNING JOURNEY (Zero Fixed-Rate Promises) */}
        <div className="space-y-4 text-left">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">How Earning Works</span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Earn From Qualifying Purchases
            </h2>
            <p className="text-xs text-slate-400">
              Rewards vary by eligible product and order value. Here is how your referrals generate rewards:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4.5 rounded-2xl bg-[#0b1015] border border-slate-800/80 space-y-2">
              <span className="text-[10px] font-mono font-bold text-[#00c365] bg-[#00c365]/10 px-2 py-0.5 rounded border border-[#00c365]/20">
                01 · SHARE
              </span>
              <h3 className="font-bold text-sm text-white pt-1">Share Mystery Hub</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Invite friends and customers using your personal link or direct product shares.
              </p>
            </div>

            <div className="p-4.5 rounded-2xl bg-[#0b1015] border border-slate-800/80 space-y-2">
              <span className="text-[10px] font-mono font-bold text-[#00c365] bg-[#00c365]/10 px-2 py-0.5 rounded border border-[#00c365]/20">
                02 · QUALIFY
              </span>
              <h3 className="font-bold text-sm text-white pt-1">Customer Purchases</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your referred customer completes a qualifying purchase across eligible services.
              </p>
            </div>

            <div className="p-4.5 rounded-2xl bg-[#0b1015] border border-slate-800/80 space-y-2">
              <span className="text-[10px] font-mono font-bold text-[#00c365] bg-[#00c365]/10 px-2 py-0.5 rounded border border-[#00c365]/20">
                03 · REWARD
              </span>
              <h3 className="font-bold text-sm text-white pt-1">You Earn a Reward</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                When order fulfillment is delivered, your earned reward is credited automatically to your ledger.
              </p>
            </div>

            <div className="p-4.5 rounded-2xl bg-[#0b1015] border border-slate-800/80 space-y-2">
              <span className="text-[10px] font-mono font-bold text-[#00c365] bg-[#00c365]/10 px-2 py-0.5 rounded border border-[#00c365]/20">
                04 · LIFETIME
              </span>
              <h3 className="font-bold text-sm text-white pt-1">Ongoing Purchases</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Future qualifying purchases from your linked customers may keep earning rewards.
              </p>
            </div>
          </div>
        </div>

        {/* 5. Bottom Guest CTA Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#0c1813] to-[#070b0e] border border-[#00c365]/30 text-center space-y-4">
          <div className="space-y-1 max-w-lg mx-auto">
            <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Ready to start earning with Mystery Hub?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              Create your account free. No subscriptions, no fees to join.
            </p>
          </div>

          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="px-6 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Create Free Account & Start Earning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
