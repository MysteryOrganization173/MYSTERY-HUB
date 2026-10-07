import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';
import { OptimizedImage } from '../common/OptimizedImage';
import {
  ShieldCheck,
  Zap,
  TrendingUp,
  Users,
  Building,
  GraduationCap,
  Sparkles,
  MessageSquare,
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  const { setActivePage, openWaitlist } = useApp();

  // Hero image load & error states for smooth reveal
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  // Image 2: About Hero
  const heroBannerUrl =
    'https://res.cloudinary.com/da6oeat7m/image/upload/v1790866633/Futuristic_Accra_Network_Nightscape_zwp9ld.png';
  const heroSrc = getCloudinaryUrl(heroBannerUrl, { format: 'auto', quality: 'auto' });
  const heroSrcSet = getCloudinarySrcSet(heroBannerUrl, [640, 960, 1280, 1600]);

  // Image 1: Connected Futures (Built for Ghana)
  const connectedFuturesUrl =
    'https://res.cloudinary.com/da6oeat7m/image/upload/v1790866217/Neon_Ghana__Connected_Futures_qdf0ek.png';

  return (
    <div className="pt-4 sm:pt-6 lg:pt-8 pb-6 sm:pb-10 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        
        {/* 1. About Hero Panel with Cloudinary Image 2 Artwork */}
        {/* DESKTOP & TABLET HERO (sm and above): Unchanged Premium Composition */}
        <div className="hidden sm:flex relative rounded-3xl bg-[#070b0e] border border-slate-800/80 overflow-hidden shadow-2xl min-h-[350px] lg:min-h-[390px] items-center">
          {/* Ambient Glows */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00c365]/10 rounded-full blur-[120px] pointer-events-none z-0" />

          {/* Official Visual Artwork Layer */}
          {!heroImageFailed && (
            <div className="absolute inset-0 z-0 select-none overflow-hidden bg-[#070b0e]">
              <img
                src={heroSrc}
                srcSet={heroSrcSet}
                sizes="(max-width: 1024px) 100vw, 1280px"
                alt="Mystery Hub Accra Digital Network"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onLoad={() => setHeroImageLoaded(true)}
                onError={() => setHeroImageFailed(true)}
                className={`w-full h-full object-cover object-right lg:object-[85%_center] transition-opacity duration-300 ease-out motion-reduce:transition-none ${
                  heroImageLoaded ? 'opacity-90 sm:opacity-95' : 'opacity-0'
                }`}
              />
            </div>
          )}

          {/* Readability Gradient Overlays */}
          <div className="hidden lg:block absolute inset-0 z-10 bg-gradient-to-r from-[#070b0e] via-[#070b0e]/90 via-45% to-transparent pointer-events-none" />
          <div className="lg:hidden absolute inset-0 z-10 bg-gradient-to-r from-[#070b0e]/95 via-[#070b0e]/80 to-[#070b0e]/40 pointer-events-none" />

          {/* Hero Foreground Content */}
          <div className="relative z-20 w-full max-w-xl lg:max-w-2xl p-10 lg:p-12 space-y-4 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#112019]/90 border border-[#00c365]/30 text-xs font-semibold text-[#00c365] backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>About Mystery Hub</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight scroll-mt-24 sm:scroll-mt-28">
              Your Digital World. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#38bdf8]">
                One Unified Hub.
              </span>
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm lg:text-base leading-relaxed">
              Mystery Hub is a Ghana-focused digital services platform built to make everyday connectivity, digital tools and online business services easier to access from one trusted place. We&apos;re starting with services people already use today and building toward a broader digital ecosystem for individuals, creators and businesses.
            </p>

            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={() => openWaitlist('Mystery Hub VIP Updates')}
                className="px-6 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Get platform updates
              </button>
              <button
                onClick={() => setActivePage('data')}
                className="px-6 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700/80 backdrop-blur-sm transition-colors cursor-pointer"
              >
                Explore available services
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE HERO (< sm): Dedicated Stacked Composition for Clear Text + Clear Accra Network Artwork */}
        <div className="block sm:hidden rounded-3xl bg-[#070b0e] border border-slate-800/80 overflow-hidden shadow-xl p-4 space-y-3.5 text-left">
          {/* Top Crisp Text Region */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#112019] border border-[#00c365]/30 text-[11px] font-semibold text-[#00c365]">
              <Sparkles className="w-3 h-3" />
              <span>About Mystery Hub</span>
            </div>

            <h1 className="text-2xl font-extrabold text-white tracking-tight leading-snug scroll-mt-24">
              Your Digital World. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#38bdf8]">
                One Unified Hub.
              </span>
            </h1>

            <p className="text-slate-300 text-xs leading-relaxed">
              A Ghana-focused digital services platform built to make everyday connectivity, digital tools and online business services easier to access from one trusted place.
            </p>
          </div>

          {/* Clearly Visible Accra Digital Network Artwork Region (~200px height) */}
          <div className="relative w-full h-[200px] rounded-2xl overflow-hidden border border-slate-800/90 bg-[#070b0e] shadow-inner">
            {!heroImageFailed && (
              <img
                src={heroSrc}
                srcSet={heroSrcSet}
                sizes="100vw"
                alt="Mystery Hub Accra Digital Network"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onLoad={() => setHeroImageLoaded(true)}
                onError={() => setHeroImageFailed(true)}
                className={`w-full h-full object-cover object-[75%_center] transition-opacity duration-300 ease-out ${
                  heroImageLoaded ? 'opacity-95' : 'opacity-0'
                }`}
              />
            )}
            {/* Subtle Gradient Overlays for Cinematic Integration */}
            <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#070b0e] to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#070b0e] to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#070b0e]/80 to-transparent pointer-events-none" />
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col gap-2 pt-0.5">
            <button
              onClick={() => openWaitlist('Mystery Hub VIP Updates')}
              className="w-full py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Get platform updates
            </button>
            <button
              onClick={() => setActivePage('data')}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-800 transition-colors cursor-pointer"
            >
              Explore available services
            </button>
          </div>
        </div>

        {/* 2. Core Mission & 3 Pillars */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          <div className="lg:col-span-5 space-y-3.5 text-left">
            <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">
              Our Core Mission
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug scroll-mt-24 sm:scroll-mt-28">
              To provide accessible, affordable and reliable digital services for everyone in Ghana.
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Mystery Hub is being built to bring data, business tools and everyday digital services into one simpler experience — with native Mobile Money checkout, reliable data delivery, and transparent customer support.
            </p>
          </div>

          <div className="lg:col-span-7 space-y-3.5">
            {/* Pillar 1: Convenience */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0f151b] border border-slate-800 flex items-start gap-4 hover:border-slate-700/80 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00c365] shrink-0 mt-0.5">
                <Zap className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-white">Convenience</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Everything you need in one place. One unified hub to manage your data bundles, explore website templates, and source quality tech gear with Mobile Money payments.
                </p>
              </div>
            </div>

            {/* Pillar 2: Trust */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0f151b] border border-slate-800 flex items-start gap-4 hover:border-slate-700/80 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-white">Trust & Reliability</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Secure transactions powered by Paystack and direct Mobile Money authorization. Order tracking, clear pricing and transparent payment processing, backed by direct WhatsApp support.
                </p>
              </div>
            </div>

            {/* Pillar 3: Growth */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0f151b] border border-slate-800 flex items-start gap-4 hover:border-slate-700/80 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-white">Growth</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Supporting individuals, creators, and MSMEs in Ghana. From affordable student data bundles to website-building tools and digital sourcing designed to help Ghanaian businesses establish an online presence.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Built for Ghana — Section with Official Cloudinary Image 1 */}
        <div className="space-y-6 sm:space-y-7">
          <div className="text-center max-w-xl mx-auto space-y-2 scroll-mt-24 sm:scroll-mt-28">
            <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">
              Built for Ghana
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Designed For The People Who Move Ghana Forward
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Whether you need 1GB to complete an assignment or a simple web presence for your business in Accra, Mystery Hub is built for you.
            </p>
          </div>

          {/* Official Image 1: Connected Futures (Visual Bridge with Controlled Geometry) */}
          <div className="relative w-full rounded-2xl sm:rounded-3xl border border-slate-800/90 overflow-hidden shadow-xl bg-[#090d11]">
            <OptimizedImage
              src={connectedFuturesUrl}
              alt="Connected Futures — Designed For The People Who Move Ghana Forward"
              objectFit="cover"
              objectPosition="center"
              containerClassName="w-full h-[210px] sm:h-[295px] lg:h-[330px]"
              className="hover:scale-[1.01] transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070b0e]/50 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* 4 Audience Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0d1217] border border-slate-800 space-y-2 hover:border-slate-700/80 transition-colors">
              <GraduationCap className="w-6 h-6 text-[#00c365]" />
              <h4 className="font-bold text-sm text-white">Students & Campuses</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Affordable data bundles for students nationwide, with validity shown before you pay.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#0d1217] border border-slate-800 space-y-2 hover:border-slate-700/80 transition-colors">
              <Building className="w-6 h-6 text-sky-400" />
              <h4 className="font-bold text-sm text-white">Shops & Small Businesses</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Create a simple professional web presence, showcase products, and connect customers directly via WhatsApp.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#0d1217] border border-slate-800 space-y-2 hover:border-slate-700/80 transition-colors">
              <Users className="w-6 h-6 text-amber-400" />
              <h4 className="font-bold text-sm text-white">Churches & Ministries</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Access digital services, build a simple web presence, and support church media or communications workflows.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#0d1217] border border-slate-800 space-y-2 hover:border-slate-700/80 transition-colors">
              <Sparkles className="w-6 h-6 text-purple-400" />
              <h4 className="font-bold text-sm text-white">Creators & Freelancers</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Showcase your portfolio, access technology gear on demand, and keep all your SIMs loaded with fast data.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Contact / Partnership Section */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0e161c] border border-slate-800 text-center space-y-3.5 max-w-3xl mx-auto shadow-lg">
          <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Have questions or want to partner?
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
            Our team is based in Accra, Ghana. We&apos;d love to hear your feedback or discuss institutional and campus partnerships.
          </p>
          <div className="pt-1">
            <a
              href={BUSINESS_CONFIG.getGeneralWhatsAppUrl("Hi Mystery Hub Team, I'd like to learn more about your services.")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat With The Founders On WhatsApp</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
