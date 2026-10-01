import React from 'react';
import { useApp } from '../../context/AppContext';
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
} from 'lucide-react';

export const MysteryEarnPage: React.FC = () => {
  const { user, openAuth, setActivePage, openWaitlist } = useApp();

  return (
    <div className="min-h-screen py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {/* Hero Banner */}
        <div className="relative rounded-3xl bg-[#070b0e] border border-slate-800/80 p-6 sm:p-10 lg:p-12 overflow-hidden shadow-2xl text-left">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#00c365]/10 rounded-full blur-[110px] pointer-events-none" />

          <div className="relative z-10 space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#112019] border border-[#00c365]/30 text-xs font-semibold text-[#00c365]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mystery Earn · Coming Soon</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Share Mystery Hub. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#38bdf8]">
                Get Rewarded.
              </span>
            </h1>

            <p className="text-xs sm:text-sm lg:text-base text-slate-300 leading-relaxed">
              Mystery Earn is being built to reward members for bringing new customers to Mystery Hub. Share services and selected Marketplace products, track qualifying referrals, and earn rewards when eligible referrals convert.
            </p>

            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={() => openWaitlist('Mystery Earn')}
                className="px-5 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span>Notify Me When Launches</span>
              </button>

              {!user ? (
                <button
                  onClick={() => openAuth('signup')}
                  className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700 transition-colors cursor-pointer"
                >
                  Create Free Account
                </button>
              ) : (
                <button
                  onClick={() => setActivePage('marketplace')}
                  className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-amber-400" />
                  <span>Explore Marketplace</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3 Future Earning Types */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            What Mystery Earn Will Offer
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365]">
                <Share2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white">Share Mystery Hub</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Get a personal referral link you can share across WhatsApp, social media, campuses, and with business friends.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white">Service Referrals</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Earn from qualifying referrals across eligible Mystery Hub digital services, data bundles, and website projects.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white">Product-Specific Rewards</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Selected Marketplace products may offer their own referral reward when a successful sale or sourcing inquiry is confirmed.
              </p>
            </div>
          </div>
        </div>

        {/* 3-Step Explanation: How It Will Work */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0e141a] border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">How It Will Work</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-0.5">
                Simple 3-Step Referral Process
              </h2>
            </div>
            <span className="self-start sm:self-auto px-2.5 py-1 rounded-full bg-[#00c365]/10 border border-[#00c365]/30 text-[#00c365] text-[11px] font-semibold">
              Coming Soon · Under Development
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-[#090d11] border border-slate-800 space-y-2">
              <span className="inline-flex w-7 h-7 rounded-lg bg-[#00c365]/20 text-[#00c365] items-center justify-center font-bold text-xs">
                1
              </span>
              <h3 className="font-bold text-sm text-white">Share</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Get your unique personal Mystery Hub referral link.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#090d11] border border-slate-800 space-y-2">
              <span className="inline-flex w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 items-center justify-center font-bold text-xs">
                2
              </span>
              <h3 className="font-bold text-sm text-white">Someone Converts</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                A qualifying customer uses your referral link to purchase data, build a site, or request gear.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#090d11] border border-slate-800 space-y-2">
              <span className="inline-flex w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 items-center justify-center font-bold text-xs">
                3
              </span>
              <h3 className="font-bold text-sm text-white">Earn</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Eligible rewards are added to your Mystery Earn history after verification.
              </p>
            </div>
          </div>
        </div>

        {/* Member vs Guest Account Card */}
        <div className="p-6 rounded-3xl bg-[#0f151b] border border-slate-800 text-center space-y-4 max-w-2xl mx-auto shadow-lg">
          {!user ? (
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365] mx-auto">
                <Users className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Ready to start earning when we launch?</h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
                  Create your Mystery Hub account now so you&apos;re ready when Mystery Earn launches.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => openAuth('signup')}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
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
                <span>Member Status Verified</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">You&apos;re already a Mystery Hub member.</h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
                  Mystery Earn will appear in your account when referrals launch. In the meantime, explore our live services and Marketplace.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setActivePage('marketplace')}
                  className="px-6 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 mx-auto cursor-pointer"
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
