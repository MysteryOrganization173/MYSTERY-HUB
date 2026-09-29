import React from 'react';
import { useApp } from '../../context/AppContext';
import { DATA_BUNDLES } from '../../data/bundles';
import { Wifi, Globe, ArrowRight, Sparkles, Smartphone, CheckCircle, ShieldCheck } from 'lucide-react';

export const Hero: React.FC = () => {
  const { setActivePage, openCheckout } = useApp();

  const sampleBundle = DATA_BUNDLES[0]; // MTN 1GB for GH₵4.99

  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-[#00c365]/15 via-[#00a855]/10 to-transparent blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute top-10 right-10 w-96 h-96 bg-emerald-500/5 blur-[100px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Value Proposition & CTAs */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Pill Header Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#11181e] border border-slate-700/60 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-[#00c365] animate-pulse" />
              <span className="text-xs font-medium text-slate-300 tracking-wide">
                Ghana&apos;s Digital Utility Platform
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1] max-w-2xl">
              Your All-in-One <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#34d399]">
                Digital Solution
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
              Buy data, create your own website, and access essential digital services — all in one place. Simple. Fast. Reliable.
            </p>

            {/* Primary & Secondary Action CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <button
                onClick={() => setActivePage('website')}
                className="px-6 py-3.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-sm tracking-wide transition-all shadow-[0_0_25px_rgba(0,195,101,0.35)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Create Your Website</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setActivePage('data')}
                className="px-6 py-3.5 rounded-xl bg-[#141b22] hover:bg-[#1a232c] text-white font-semibold text-sm border border-slate-700/80 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Wifi className="w-4 h-4 text-[#00c365]" />
                <span>Buy Data Bundles</span>
              </button>
            </div>

            {/* Trust and Key Signals */}
            <div className="pt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#00c365]" />
                <span>Instant MoMo Delivery</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#00c365]" />
                <span>MTN · Telecel · AirtelTigo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#00c365]" />
                <span>Free Website Starter</span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Device & Floating Product Mockup */}
          <div className="lg:col-span-5 relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-md">
              {/* Outer decorative halo */}
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#00c365]/30 to-emerald-700/20 blur-xl opacity-70" />

              {/* Main Visual Showcase Card */}
              <div className="relative rounded-2xl bg-[#0e141a] border border-slate-700/80 p-5 shadow-2xl overflow-hidden">
                {/* Visual Top Bar */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#00c365]/20 flex items-center justify-center text-[#00c365]">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Mystery Hub Live</div>
                      <div className="text-[10px] text-slate-400">Accra Server · 24/7 Active</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Ghana 🇬🇭
                  </span>
                </div>

                {/* Simulated Interactive Mobile Interface in Phone Mockup */}
                <div className="my-5 p-4 rounded-xl bg-[#090d11] border border-slate-800/90 shadow-inner relative">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <span className="font-semibold text-white">Popular Bundle</span>
                    <span className="text-[#00c365] text-[11px] font-medium">99.8% Success Rate</span>
                  </div>

                  {/* Interactive Mini Card */}
                  <div className="p-4 rounded-xl bg-[#141b22] border border-slate-700/80 flex items-center justify-between gap-3 shadow-sm hover:border-[#00c365]/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#FFCC00] text-black font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm">
                        MTN
                      </div>
                      <div>
                        <div className="font-bold text-white text-base">1GB Data</div>
                        <div className="text-xs text-slate-400">7 Days Validity</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-extrabold text-[#00c365] tabular-nums">
                        GH₵4.99
                      </div>
                      <button
                        onClick={() => openCheckout(sampleBundle)}
                        className="mt-1 px-3 py-1 rounded-md bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs transition-transform active:scale-95 shadow-sm"
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>

                  {/* Quick features snippet */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex justify-between text-[11px] text-slate-400">
                    <span>MTN MoMo Accepted</span>
                    <span>Delivered in ~30s</span>
                  </div>
                </div>

                {/* Floating Interactive Badges as seen in reference */}
                <div className="space-y-2.5">
                  {/* Floating Action Pill 1: Buy Data */}
                  <button
                    onClick={() => setActivePage('data')}
                    className="w-full p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/70 flex items-center justify-between transition-colors group cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-[#00c365] transition-colors">
                          Buy Data
                        </div>
                        <div className="text-[10px] text-slate-400">MTN · Telecel · AT</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#00c365] group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Floating Action Pill 2: Create Website */}
                  <button
                    onClick={() => setActivePage('website')}
                    className="w-full p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/70 flex items-center justify-between transition-colors group cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-[#00c365] transition-colors">
                          Create Your Website
                        </div>
                        <div className="text-[10px] text-slate-400">In Minutes · No Coding</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#00c365] group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>

                {/* Subtle Made in Ghana badge in script style */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#00c365]" />
                    <span className="text-[11px]">Zero Transaction Fees</span>
                  </div>
                  <span className="font-serif italic text-slate-300 text-xs">
                    Made in Ghana for Ghana 🇬🇭
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
