import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Zap, DollarSign, Clock, ArrowRight } from 'lucide-react';

export const WhyMysteryHub: React.FC = () => {
  const { setActivePage } = useApp();

  const reasons = [
    {
      icon: Zap,
      title: 'Reliable Automated Delivery',
      desc: 'Fast automated delivery directly to your SIM promptly after Mobile Money payment authorization.',
      accent: 'text-[#00c365] bg-[#00c365]/10',
    },
    {
      icon: DollarSign,
      title: 'Competitive Bundle Pricing',
      desc: 'Affordable, transparent pricing designed to give you more megabytes for your Cedis across all networks.',
      accent: 'text-amber-400 bg-amber-400/10',
    },
    {
      icon: ShieldCheck,
      title: 'Safe MoMo Transactions',
      desc: 'Protected by official telecom authorization prompts. We never store your credentials or PIN.',
      accent: 'text-sky-400 bg-sky-400/10',
    },
    {
      icon: Clock,
      title: 'Always-On Availability',
      desc: 'Top up whenever you need data. Order directly from any browser on phone, tablet, or laptop.',
      accent: 'text-purple-400 bg-purple-400/10',
    },
  ];

  return (
    <section className="py-6 sm:py-10 lg:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5 sm:space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">
            Why Mystery Hub
          </span>
          <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
            Built for Speed, Reliability, & Everyday Value
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            We are engineering Ghana’s primary digital utility platform to bridge the gap between everyday consumers and essential digital tools.
          </p>
        </div>

        {/* 4 Reasons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {reasons.map((r, i) => {
            const Icon = r.icon;
            return (
              <div
                key={i}
                className="p-4 sm:p-5 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-2.5 hover:border-slate-700 transition-colors"
              >
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${r.accent}`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="font-bold text-sm text-white">{r.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{r.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA bar */}
        <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-[#0c1613] via-[#09110e] to-[#0c1613] border border-[#00c365]/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white">Ready to experience reliable Ghana digital services?</h3>
            <p className="text-xs text-slate-400 mt-0.5">Top up your mobile bundle or create your business website in under 3 minutes.</p>
          </div>
          <button
            onClick={() => setActivePage('data')}
            className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>Buy Data Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
