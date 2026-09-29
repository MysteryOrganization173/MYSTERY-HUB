import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Zap, DollarSign, Clock, Users, ArrowRight } from 'lucide-react';

export const WhyMysteryHub: React.FC = () => {
  const { setActivePage } = useApp();

  const reasons = [
    {
      icon: Zap,
      title: 'Automated 60-Second Delivery',
      desc: 'Our direct integration with Ghanaian telecom providers dispatches your data bundles within seconds of payment.',
      accent: 'text-[#00c365] bg-[#00c365]/10',
    },
    {
      icon: DollarSign,
      title: 'Real Wholesale Savings',
      desc: 'Save significantly compared to standard telco scratch-card retail pricing. More megabytes for your Cedis.',
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
      title: '24/7 Platform Uptime',
      desc: 'Top up in the middle of the night or on public holidays. Our servers are active around the clock.',
      accent: 'text-purple-400 bg-purple-400/10',
    },
  ];

  return (
    <section className="py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold text-[#00c365] uppercase tracking-wider">
            Why Mystery Hub
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Built for Speed, Reliability, & Everyday Value
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            We are engineering Ghana’s primary digital utility platform to bridge the gap between everyday consumers and essential digital tools.
          </p>
        </div>

        {/* 4 Reasons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {reasons.map((r, i) => {
            const Icon = r.icon;
            return (
              <div
                key={i}
                className="p-6 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.accent}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-white">{r.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{r.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Simple Explanation: How to buy data in 3 steps */}
        <div className="p-8 sm:p-10 rounded-3xl bg-[#0e141a] border border-slate-800 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                How It Works: Buy Data in 3 Steps
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                No app installation required. Works directly in your browser.
              </p>
            </div>
            <button
              onClick={() => setActivePage('data')}
              className="px-5 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <span>Try It Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="text-2xl font-extrabold text-[#00c365]">01.</div>
              <h4 className="font-bold text-sm text-white">Select Your Bundle</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose your network (MTN, Telecel, or AirtelTigo) and desired bundle size (from 500MB to 30GB).
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-2xl font-extrabold text-[#00c365]">02.</div>
              <h4 className="font-bold text-sm text-white">Enter Recipient Number</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Provide the Ghana phone number to credit. Our system auto-detects and confirms the network.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-2xl font-extrabold text-[#00c365]">03.</div>
              <h4 className="font-bold text-sm text-white">Approve Mobile Money</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Confirm the prompt on your phone with your MoMo PIN. Your data arrives within 60 seconds.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
