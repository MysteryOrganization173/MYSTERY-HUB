import React from 'react';
import { useApp } from '../../context/AppContext';
import { Laptop, Mic, Cpu, Store, ArrowRight, ShieldCheck } from 'lucide-react';

export const HomeMarketplaceSection: React.FC = () => {
  const { setActivePage } = useApp();

  const marketplaceSpotlights = [
    {
      icon: Laptop,
      title: 'Laptops & Devices',
      desc: 'Business ultrabooks, coding workstations, and student laptops sourced from verified distributors.',
      tag: 'Hardware',
      accent: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    },
    {
      icon: Mic,
      title: 'Creator & Media Tools',
      desc: 'Studio USB microphones, autofocus webcams, and mobile video production gear.',
      tag: 'Creative',
      accent: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
    },
    {
      icon: Cpu,
      title: 'AI & Productivity Tools',
      desc: 'Legitimate creator suites, office productivity setups, and cloud workspace tools.',
      tag: 'Software',
      accent: 'text-[#00c365] bg-[#00c365]/10 border-[#00c365]/20',
    },
    {
      icon: Store,
      title: 'Business Hardware',
      desc: 'Direct thermal receipt printers, wireless barcode scanners, and retail POS peripherals.',
      tag: 'Retail & POS',
      accent: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
  ];

  return (
    <section className="py-6 sm:py-10 lg:py-14 bg-[#070b0e] border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
          <div className="space-y-1.5 text-left">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00c365]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Tech & Digital Marketplace</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
              Quality Technology & Digital Tools Sourced for You
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl leading-relaxed">
              Need the right tools to work, create or grow? Mystery Hub helps you find selected technology and digital products from trusted Ghanaian sources.
            </p>
          </div>

          <a
            href="/marketplace"
            onClick={(e) => {
              e.preventDefault();
              setActivePage('marketplace');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <span>Explore Marketplace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* 4 Spotlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {marketplaceSpotlights.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className="p-4 sm:p-5 rounded-2xl bg-[#0e141a] border border-slate-800/90 hover:border-slate-700 transition-all flex flex-col justify-between group space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center ${item.accent}`}>
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-white mt-3 group-hover:text-[#00c365] transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400 group-hover:text-white">
                  <span>Inquire availability</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
