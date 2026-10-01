import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';
import {
  Gift,
  Share2,
  Zap,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  Bell,
  ArrowRight,
  ShieldCheck,
  Users,
  MousePointerClick,
  TrendingUp,
  Clock,
  Coins,
  Layers,
  Link,
  Laptop,
  Globe,
  Award,
} from 'lucide-react';

export interface MysteryEarnPageProps {
  highestActiveReferralRewardMinor?: number | null;
}

export const MysteryEarnPage: React.FC<MysteryEarnPageProps> = ({
  highestActiveReferralRewardMinor,
}) => {
  const { user, openAuth, setActivePage, openWaitlist } = useApp();
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);

  // Official Hero Artwork Assets
  // Desktop/Tablet Hero Artwork (min-width: 640px)
  const desktopArtworkUrl =
    'https://res.cloudinary.com/da6oeat7m/image/upload/v1790877120/a4e9ca0a-8a11-43a4-930f-7252e97d01c8_i9bmqs.png';
  const desktopHeroSrc = getCloudinaryUrl(desktopArtworkUrl, { format: 'auto', quality: 'auto' });
  const desktopHeroSrcSet = getCloudinarySrcSet(desktopArtworkUrl, [768, 1024, 1280, 1600]);

  // Mobile Hero Artwork (max-width: 639px)
  const mobileArtworkUrl =
    'https://res.cloudinary.com/da6oeat7m/image/upload/v1790877287/72fcc9b0-5ea3-4d4f-92fe-bfd1e3b8ac52_xe8gdu.png';
  const mobileHeroSrc = getCloudinaryUrl(mobileArtworkUrl, { format: 'auto', quality: 'auto' });
  const mobileHeroSrcSet = getCloudinarySrcSet(mobileArtworkUrl, [360, 430, 640]);

  // Format max reward if configured dynamically
  const maxRewardGhc =
    typeof highestActiveReferralRewardMinor === 'number' && highestActiveReferralRewardMinor > 0
      ? (highestActiveReferralRewardMinor / 100).toFixed(2)
      : null;

  return (
    <div className="min-h-screen py-6 sm:py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {/* 1. Official Hero Banner Panel */}
        {/* DESKTOP & TABLET HERO (sm and above): Unchanged Premium Composition */}
        <div className="hidden sm:flex relative rounded-3xl bg-[#070b0e] border border-slate-800/90 overflow-hidden shadow-2xl min-h-[370px] lg:min-h-[410px] items-center">
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
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#112019]/90 border border-[#00c365]/40 text-xs font-bold text-[#00c365] backdrop-blur-sm shadow-sm" data-badge="Mystery Earn · Coming Soon">
              <Sparkles className="w-3.5 h-3.5" />
              <span>MYSTERY EARN · COMING SOON</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight" data-title="Share Mystery Hub. Get Rewarded.">
              Share Mystery Hub. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#f59e0b]">
                Get Rewarded.
              </span>
            </h1>

            <p className="text-xs sm:text-sm lg:text-base text-slate-300 leading-relaxed">
              Create your account free, share eligible Mystery Hub services and products, and earn rewards when qualifying referrals convert.
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-3 text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00c365]" />
                No inventory
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00c365]" />
                No complicated setup
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00c365]" />
                Just share & track
              </span>
            </div>

            <div className="pt-3 flex flex-wrap gap-3">
              <button
                onClick={() => openWaitlist('Mystery Earn')}
                className="px-5 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span>Notify Me at Launch</span>
              </button>

              {!user ? (
                <button
                  onClick={() => openAuth('signup')}
                  className="px-5 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700/80 backdrop-blur-sm transition-colors cursor-pointer"
                >
                  Create Free Account
                </button>
              ) : (
                <button
                  onClick={() => setActivePage('marketplace')}
                  className="px-5 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700/80 backdrop-blur-sm transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-amber-400" />
                  <span>Explore Marketplace</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MOBILE HERO (< sm): Dedicated Stacked Composition with 100% Full Uncropped Artwork */}
        <div className="block sm:hidden rounded-3xl bg-[#070b0e] border border-slate-800/90 overflow-hidden shadow-xl p-4.5 space-y-4 text-left">
          {/* Top Crisp Text Region */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/40 text-[11px] font-bold text-[#00c365]" data-badge="Mystery Earn · Coming Soon">
              <Sparkles className="w-3.5 h-3.5" />
              <span>MYSTERY EARN · COMING SOON</span>
            </div>

            <h1 className="text-2xl font-extrabold text-white tracking-tight leading-snug" data-title="Share Mystery Hub. Get Rewarded.">
              Share Mystery Hub. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#f59e0b]">
                Get Rewarded.
              </span>
            </h1>

            <p className="text-xs text-slate-300 leading-relaxed">
              Create your account free, share eligible Mystery Hub services and products, and earn rewards when qualifying referrals convert.
            </p>
          </div>

          {/* Mobile Artwork Container: Full-Width Cinematic Container (~215-235px height) */}
          <div className="relative w-full h-[215px] min-[412px]:h-[235px] rounded-2xl overflow-hidden border border-slate-800/80 bg-[#070b0e] shadow-lg">
            <picture className="w-full h-full block">
              <source
                media="(max-width: 639px)"
                srcSet={mobileHeroSrcSet}
                sizes="100vw"
              />
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
            {/* Subtle Ambient Edge Fades */}
            <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-[#070b0e]/60 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-[#070b0e]/60 to-transparent pointer-events-none" />
          </div>

          {/* Benefit Chips & Mobile CTAs */}
          <div className="pt-0.5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-300 font-medium gap-y-1.5 gap-x-2">
              <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/80 px-2.5 py-1 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>No inventory</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/80 px-2.5 py-1 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>No complex setup</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/80 px-2.5 py-1 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Just share & track</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-0.5">
              <button
                onClick={() => openWaitlist('Mystery Earn')}
                className="w-full py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Notify Me at Launch</span>
              </button>

              {!user ? (
                <button
                  onClick={() => openAuth('signup')}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700/80 transition-colors cursor-pointer text-center"
                >
                  Create Free Account
                </button>
              ) : (
                <button
                  onClick={() => setActivePage('marketplace')}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700/80 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                  <span>Explore Marketplace</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. WHY MYSTERY EARN? — 6 Core Feature Tiles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">Opportunity Overview</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-0.5">
                Why Join Mystery Earn?
              </h2>
            </div>
            <span className="hidden sm:inline-block text-xs text-slate-400 font-medium">
              Free Ambassador Layer
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#0f151b] border border-slate-800/90 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365]">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white">START FREE</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Create a Mystery Hub account without paying to join the referral program.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0f151b] border border-slate-800/90 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white">NO INVENTORY</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                You won&apos;t need to purchase or hold products before sharing eligible offers.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0f151b] border border-slate-800/90 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Share2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white">SHARE ANYWHERE</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Share eligible links through WhatsApp, social media or directly with people you know.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0f151b] border border-slate-800/90 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Coins className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white">CASH REWARDS</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {maxRewardGhc
                  ? `Earn up to GH₵${maxRewardGhc} on active eligible offers.`
                  : 'Selected offers can carry cash rewards for qualifying conversions.'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0f151b] border border-slate-800/90 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white">ONE DASHBOARD</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Track referral activity, qualifying conversions and reward history from one place.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0f151b] border border-slate-800/90 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white">MORE THAN DATA</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Eligible offers can eventually include Marketplace products, digital services and other Mystery Hub products.
              </p>
            </div>
          </div>
        </div>

        {/* 3. PRODUCT REWARD SPOTLIGHT & GENERAL REFERRALS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Spotlight Card: Marketplace Rewards */}
          <div className="p-6 rounded-3xl bg-[#0e141a] border border-slate-800 space-y-4 text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>SELECTED PRODUCTS. BIGGER OPPORTUNITIES.</span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              High-Value Product-Specific Rewards
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Some Marketplace products will have their own referral reward. When a product is eligible, Mystery Earn will show the reward before you share it.
            </p>

            {/* Mock Product Card Preview */}
            <div className="p-4 rounded-2xl bg-[#090d11] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Laptop className="w-5 h-5 text-[#00c365]" />
                  <span className="font-bold text-xs text-white">Business Laptop / Creator Gear</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                  Eligible Offer Preview
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">Referral Reward:</span>
                <span className="font-bold text-[#00c365] bg-[#00c365]/10 px-2 py-0.5 rounded border border-[#00c365]/20">
                  Set per eligible offer
                </span>
              </div>

              <button
                disabled
                className="w-full py-2 text-center text-xs font-bold text-slate-400 bg-slate-900 rounded-xl border border-slate-800 cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <span>Share & Earn</span>
                <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 bg-amber-500/10 text-amber-400 rounded">Soon</span>
              </button>
            </div>
          </div>

          {/* Spotlight Card: One Link Platform Referrals */}
          <div className="p-6 rounded-3xl bg-[#0e141a] border border-slate-800 space-y-4 text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold">
              <Link className="w-3.5 h-3.5" />
              <span>ONE LINK. MORE OF MYSTERY HUB.</span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Unified Platform Attribution
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Your personal Mystery Hub referral link is being designed to help attribute qualifying activity across eligible parts of the platform.
            </p>

            <div className="pt-2 flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-[#090d11] border border-slate-800 text-xs text-slate-300 font-medium">
                ⚡ Data Bundles
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-[#090d11] border border-slate-800 text-xs text-slate-300 font-medium">
                📱 Airtime Top-Up
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-[#090d11] border border-slate-800 text-xs text-slate-300 font-medium">
                🌐 Website Builder
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-[#090d11] border border-slate-800 text-xs text-slate-300 font-medium">
                💻 Marketplace Sourcing
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-[#090d11] border border-slate-800 text-xs text-slate-300 font-medium">
                🛠️ Service Referrals
              </span>
            </div>
          </div>
        </div>

        {/* 4. DASHBOARD PREVIEW & CAPABILITIES */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0e141a] border border-slate-800/90 space-y-6 relative overflow-hidden shadow-xl">
          {/* Subtle Ambient Emerald Glow & Background Graph Lines */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#00c365]/10 rounded-full blur-[90px] pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-56 h-56 bg-sky-500/5 rounded-full blur-[80px] pointer-events-none" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none stroke-[#00c365]" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="30%" x2="100%" y2="30%" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1="70%" x2="100%" y2="70%" strokeWidth="1" strokeDasharray="4 4" />
            <path d="M 0 120 Q 100 80, 200 110 T 400 60 T 600 90 T 800 40 T 1000 70" fill="none" strokeWidth="1.5" />
          </svg>

          {/* Header & Subtitle */}
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-left">
            <div className="space-y-1 max-w-xl">
              <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">Interface Teaser</span>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                Your Mystery Earn Dashboard
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-0.5">
                Share eligible Mystery Hub services and products, track referrals, and earn rewards when qualifying conversions happen.
              </p>
            </div>
            <span className="self-start sm:self-auto shrink-0 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold tracking-wide">
              Preview · Coming Soon
            </span>
          </div>

          {/* Opportunity Metrics Grid (5 KPI Cards with Teaser Example Values) */}
          <div className="relative z-10 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Card 1: Clicks */}
              <div className="p-3.5 rounded-2xl bg-[#090d11]/90 border border-slate-800/90 text-left space-y-1.5 shadow-sm hover:border-slate-700/80 transition-colors">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MousePointerClick className="w-3.5 h-3.5 text-sky-400" /> Clicks
                  </span>
                  <span className="text-[9px] text-slate-500 font-normal">Est.</span>
                </span>
                <p className="text-xl sm:text-2xl font-black text-white tracking-tight tabular-nums">120+</p>
                <p className="text-[10px] text-slate-400">Total link visits</p>
              </div>

              {/* Card 2: Referrals */}
              <div className="p-3.5 rounded-2xl bg-[#090d11]/90 border border-slate-800/90 text-left space-y-1.5 shadow-sm hover:border-slate-700/80 transition-colors">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-[#00c365]" /> Referrals
                  </span>
                  <span className="text-[9px] text-slate-500 font-normal">Est.</span>
                </span>
                <p className="text-xl sm:text-2xl font-black text-[#00c365] tracking-tight tabular-nums">8</p>
                <p className="text-[10px] text-slate-400">Conversions</p>
              </div>

              {/* Card 3: Pending Rewards */}
              <div className="p-3.5 rounded-2xl bg-[#090d11]/90 border border-slate-800/90 text-left space-y-1.5 shadow-sm hover:border-slate-700/80 transition-colors">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> Pending
                  </span>
                  <span className="text-[9px] text-slate-500 font-normal">Est.</span>
                </span>
                <p className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight tabular-nums">GH₵400</p>
                <p className="text-[10px] text-slate-400">Under verification</p>
              </div>

              {/* Card 4: Approved Rewards */}
              <div className="p-3.5 rounded-2xl bg-[#090d11]/90 border border-slate-800/90 text-left space-y-1.5 shadow-sm hover:border-slate-700/80 transition-colors">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> Approved
                  </span>
                  <span className="text-[9px] text-slate-500 font-normal">Est.</span>
                </span>
                <p className="text-xl sm:text-2xl font-black text-purple-300 tracking-tight tabular-nums">GH₵700</p>
                <p className="text-[10px] text-slate-400">Ready for payout</p>
              </div>

              {/* Card 5: Potential Monthly Earnings */}
              <div className="p-3.5 rounded-2xl bg-[#090d11]/90 border border-[#00c365]/30 text-left space-y-1.5 col-span-2 sm:col-span-1 shadow-sm hover:border-[#00c365]/50 transition-colors">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-[#00c365]" /> Monthly Target
                  </span>
                  <span className="text-[9px] text-[#00c365] font-semibold">Goal</span>
                </span>
                <p className="text-lg sm:text-xl font-black text-white tracking-tight tabular-nums">GH₵300 – GH₵900+</p>
                <p className="text-[10px] text-slate-400">Based on active sharing</p>
              </div>
            </div>

            {/* Illustrative Preview Note */}
            <p className="text-[11px] text-slate-400 text-left pt-1">
              * Illustrative preview based on successful qualifying referrals.
            </p>
          </div>

          {/* Benefit Grid / Value Props (8 Core Items) */}
          <div className="relative z-10 pt-4 border-t border-slate-800/80 space-y-3 text-left">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Core Dashboard Capabilities
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2 bg-[#090d11]/60 p-2.5 rounded-xl border border-slate-800/80">
                <CheckCircle2 className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Personal referral link</span>
              </div>
              <div className="flex items-center gap-2 bg-[#090d11]/60 p-2.5 rounded-xl border border-slate-800/80">
                <CheckCircle2 className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Product-specific share links</span>
              </div>
              <div className="flex items-center gap-2 bg-[#090d11]/60 p-2.5 rounded-xl border border-slate-800/80">
                <CheckCircle2 className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Service referral opportunities</span>
              </div>
              <div className="flex items-center gap-2 bg-[#090d11]/60 p-2.5 rounded-xl border border-slate-800/80">
                <CheckCircle2 className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Click & conversion analytics</span>
              </div>
              <div className="flex items-center gap-2 bg-[#090d11]/60 p-2.5 rounded-xl border border-slate-800/80">
                <CheckCircle2 className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Pending & approved rewards</span>
              </div>
              <div className="flex items-center gap-2 bg-[#090d11]/60 p-2.5 rounded-xl border border-slate-800/80">
                <CheckCircle2 className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Reward history</span>
              </div>
              <div className="flex items-center gap-2 bg-[#090d11]/60 p-2.5 rounded-xl border border-slate-800/80">
                <CheckCircle2 className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Free to join</span>
              </div>
              <div className="flex items-center gap-2 bg-[#090d11]/60 p-2.5 rounded-xl border border-slate-800/80">
                <CheckCircle2 className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>No inventory needed</span>
              </div>
            </div>
          </div>

          {/* Section CTAs & Truthful Disclaimer */}
          <div className="relative z-10 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => openWaitlist('Mystery Earn')}
                  className="px-5 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Notify Me at Launch</span>
                </button>
                {!user ? (
                  <button
                    onClick={() => openAuth('signup')}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700/80 transition-colors cursor-pointer"
                  >
                    Create Free Account
                  </button>
                ) : (
                  <button
                    onClick={() => setActivePage('marketplace')}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700/80 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                    <span>Explore Marketplace</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-medium pt-1">
                Be ready when Mystery Earn goes live.
              </p>
            </div>

            <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed">
              Example preview only. Final reward structure may vary by service or product.
            </p>
          </div>
        </div>

        {/* 5. 4-STEP HOW IT WORKS */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0e141a] border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">Workflow</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-0.5">
                How It Works
              </h2>
            </div>
            <span className="self-start sm:self-auto px-2.5 py-1 rounded-full bg-[#00c365]/10 border border-[#00c365]/30 text-[#00c365] text-[11px] font-semibold">
              COMING SOON
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
            <div className="p-4 rounded-2xl bg-[#090d11] border border-slate-800 space-y-2">
              <span className="inline-flex w-8 h-8 rounded-xl bg-[#00c365]/20 text-[#00c365] items-center justify-center font-bold text-xs">
                01
              </span>
              <h3 className="font-bold text-sm text-white">JOIN</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Create your Mystery Hub account free.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#090d11] border border-slate-800 space-y-2">
              <span className="inline-flex w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 items-center justify-center font-bold text-xs">
                02
              </span>
              <h3 className="font-bold text-sm text-white">SHARE</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose an eligible product/service and share your personal link.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#090d11] border border-slate-800 space-y-2">
              <span className="inline-flex w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 items-center justify-center font-bold text-xs">
                03
              </span>
              <h3 className="font-bold text-sm text-white">CONVERT</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your referral completes the required qualifying action.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#090d11] border border-slate-800 space-y-2">
              <span className="inline-flex w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 items-center justify-center font-bold text-xs">
                04
              </span>
              <h3 className="font-bold text-sm text-white">EARN</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                An eligible reward is recorded after verification.
              </p>
            </div>
          </div>
        </div>

        {/* 6. CONVERSION / START SMALL BLOCK */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0f151b] border border-slate-800 text-center space-y-4 max-w-2xl mx-auto shadow-lg">
          {!user ? (
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365] mx-auto">
                <Users className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-bold text-white">Start Free. Share What People Already Need.</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                  You don&apos;t need inventory or a separate storefront. Mystery Hub handles the platform while you focus on sharing eligible offers.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => openAuth('signup')}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Create Free Account
                </button>
                <button
                  onClick={() => openAuth('login')}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Already have an account? Log in
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>You&apos;re Already In</span>
              </div>
              <div className="space-y-1" data-member-text="You're already a Mystery Hub member.">
                <h3 className="text-lg sm:text-xl font-bold text-white">You&apos;re already a Mystery Hub member.</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                  Your current Mystery Hub account will become your Mystery Earn dashboard when referrals launch.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setActivePage('marketplace')}
                  className="px-6 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <span>Explore Marketplace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
