import React, { useState, useEffect } from 'react';
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

export interface MysteryEarnPageProps {
  highestActiveReferralRewardMinor?: number | null;
}

export const MysteryEarnPage: React.FC<MysteryEarnPageProps> = () => {
  const { user, sessionToken, isAuthChecking, openAuth, showToast } = useApp();

  // Media loading
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);

  // Authenticated Referral Data
  const [summary, setSummary] = useState<ReferralSummaryResponse['summary'] | null>(null);
  const [ledger, setLedger] = useState<RewardLedgerItem[]>([]);
  const [rules, setRules] = useState<PublicRewardRule[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
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
      return;
    }

    let isMounted = true;
    setIsLoadingDashboard(true);

    Promise.allSettled([
      getMyReferralSummary(sessionToken),
      getMyRewardLedger(sessionToken, 50),
    ])
      .then(([summaryResult, ledgerResult]) => {
        if (!isMounted) return;

        if (summaryResult.status === 'fulfilled' && summaryResult.value.success) {
          setSummary(summaryResult.value.summary);
        }
        if (ledgerResult.status === 'fulfilled' && ledgerResult.value.success) {
          setLedger(ledgerResult.value.ledger || []);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingDashboard(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user, sessionToken]);

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
          {/* 1. Member Command Panel Hero */}
          <div className="relative rounded-3xl bg-gradient-to-br from-[#0a1410] via-[#070b0e] to-[#0d1612] border border-[#00c365]/30 overflow-hidden shadow-2xl p-6 sm:p-8 lg:p-10">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#00c365]/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-amber-500/5 rounded-full blur-[90px] pointer-events-none" />

            <div className="relative z-10 space-y-5 sm:space-y-6">
              {/* Header Meta */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00c365]/10 border border-[#00c365]/30 text-xs font-bold text-[#00c365]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>MYSTERY EARN · ACTIVE PARTNER</span>
                </div>

                {summary?.code && (
                  <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/80 border border-slate-800 px-3 py-1 rounded-full">
                    <span className="text-slate-400 font-medium">Referral Code:</span>
                    <span className="font-mono font-bold text-[#00c365] tracking-wider">{summary.code}</span>
                  </div>
                )}
              </div>

              {/* Title & Copy */}
              <div className="space-y-2 max-w-2xl text-left">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                  Welcome, {firstName} 👋
                </h1>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Share Mystery Hub once. When people become linked to your referral account, eligible purchases keep rewarding you when they return.
                </p>
              </div>

              {/* Personal Link Command Box */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider text-left">
                  Your Personal Referral Link
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 max-w-3xl">
                  {/* Readonly Link Box */}
                  <div className="flex-1 flex items-center bg-[#070b0e] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-200 overflow-hidden shadow-inner">
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
                      className="px-3.5 py-2.5 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNativeShare}
                      aria-label="Share referral link"
                      className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
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
              {isLoadingDashboard && (
                <span className="text-[11px] text-[#00c365] animate-pulse font-medium">Syncing live ledger...</span>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Stat 1: Clicks */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0b1015] border border-slate-800/80 shadow-sm space-y-1.5 text-left">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold">Total Clicks</span>
                  <MousePointerClick className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {summary ? summary.clicksCount.toLocaleString() : '0'}
                </div>
                <p className="text-[11px] text-slate-400">Unique referral link visits</p>
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

          {/* 5. Active Reward Opportunities (Live Rules Transparency) */}
          <div className="space-y-3 text-left">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Earning Rules</h2>
              <span className="text-[11px] text-slate-500">Live Server Rules</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              {rules.length > 0 ? (
                rules.map((rule) => {
                  let rewardDescription = '';
                  if (rule.reward_type === 'fixed_minor' && rule.reward_minor) {
                    rewardDescription = `GH₵${(rule.reward_minor / 100).toFixed(2)} per delivered order`;
                  } else if (rule.reward_type === 'percent_bps' && rule.reward_percent_bps) {
                    rewardDescription = `${(rule.reward_percent_bps / 100).toFixed(1)}% of order total`;
                  }

                  const title =
                    rule.service_type === 'data'
                      ? `${(rule.network || 'Telecom').toUpperCase()} Data Bundles`
                      : rule.service_type === 'instant_bundle'
                      ? 'Instant Bundles'
                      : rule.service_type === 'airtime'
                      ? 'Airtime Top-Up'
                      : rule.service_type === 'marketplace'
                      ? 'Marketplace Sourcing'
                      : 'All Services';

                  return (
                    <div
                      key={rule.id}
                      className="p-4 rounded-2xl bg-[#0b1015] border border-slate-800/80 space-y-2 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{title}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00c365]/10 text-[#00c365] border border-[#00c365]/30">
                          Active
                        </span>
                      </div>
                      <div className="text-sm font-extrabold text-[#00c365] font-mono">
                        {rewardDescription || 'Active Referral Reward'}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Credited automatically to your ledger upon terminal order delivery.
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full p-5 rounded-2xl bg-[#0b1015] border border-slate-800 text-xs text-slate-400 text-center">
                  New earning opportunities are being prepared.
                </div>
              )}
            </div>
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
            {/* Category 1 */}
            <div className="p-5 rounded-2xl bg-[#0b1015] border border-slate-800/80 space-y-2.5 text-left">
              <div className="w-9 h-9 rounded-xl bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365]">
                <Smartphone className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-white text-sm">Data & Digital Services</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Share Mystery Hub services. Eligible repeat purchases from referred customers can continue generating rewards.
              </p>
            </div>

            {/* Category 2 */}
            <div className="p-5 rounded-2xl bg-[#0b1015] border border-slate-800/80 space-y-2.5 text-left">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-white text-sm">Marketplace Sourcing</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Selected marketplace products may offer larger fixed referral rewards when buyers complete qualifying purchases.
              </p>
            </div>

            {/* Category 3 */}
            <div className="p-5 rounded-2xl bg-[#0b1015] border border-slate-800/80 space-y-2.5 text-left">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Globe className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-white text-sm">Website Builder</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Referral rewards for paid Website Builder plans are planned for a future phase.
              </p>
            </div>
          </div>
        </div>

        {/* 4. ACTIVE REWARD RULES TRANSPARENCY */}
        {rules.length > 0 && (
          <div className="space-y-3 text-left">
            <div className="space-y-1">
              <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">Current Opportunities</span>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Active Earning Rates
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {rules.map((rule) => {
                let rewardDesc = '';
                if (rule.reward_type === 'fixed_minor' && rule.reward_minor) {
                  rewardDesc = `GH₵${(rule.reward_minor / 100).toFixed(2)} per order`;
                } else if (rule.reward_type === 'percent_bps' && rule.reward_percent_bps) {
                  rewardDesc = `${(rule.reward_percent_bps / 100).toFixed(1)}% of total`;
                }

                const ruleTitle =
                  rule.service_type === 'data'
                    ? `${(rule.network || 'MTN/Telecel/AT').toUpperCase()} Data Bundles`
                    : rule.service_type === 'instant_bundle'
                    ? 'Instant Bundles'
                    : rule.service_type === 'airtime'
                    ? 'Airtime Top-Up'
                    : 'Digital Services';

                return (
                  <div key={rule.id} className="p-4 rounded-xl bg-[#0b1015] border border-slate-800/80 space-y-1">
                    <span className="font-bold text-xs text-white">{ruleTitle}</span>
                    <div className="text-sm font-extrabold text-[#00c365] font-mono">{rewardDesc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
