import React from 'react';
import { useApp } from '../../context/AppContext';
import { Laptop, Mic, Cpu, Store, ArrowRight, ShieldCheck, ExternalLink } from 'lucide-react';

export const HomeMarketplaceSection: React.FC = () => {
  const { setActivePage } = useApp();

  const marketplaceSpotlights = [
    {
      icon: Laptop,
      title: 'Laptops & Devices',
      desc: 'Business ultrabooks, coding workstations, and student laptops sourced from verified suppliers.',
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
    <section className="py-8 sm:py-12 lg:py-16 bg-[#070b0e] border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8 lg:space-y-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2 text-left">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00c365]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Tech & Digital Marketplace</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
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
            className="px-4 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-sm shrink-0"
          >
            <span>Explore Marketplace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* 4 Category Spotlight Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {marketplaceSpotlights.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                onClick={() => setActivePage('marketplace')}
                className="p-5 rounded-2xl bg-[#0d1217] border border-slate-800/90 hover:border-slate-700 transition-all duration-200 flex flex-col justify-between space-y-4 cursor-pointer group hover:bg-[#0f161d]"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center ${item.accent}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                      {item.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-white group-hover:text-[#00c365] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center text-xs font-semibold text-slate-400 group-hover:text-[#00c365] transition-colors">
                  <span>View Sourced Items</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Marketplace Disclaimer Bar */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-[#0a0f13] border border-slate-800/80 text-[11px] text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span>
            💡 Sourced on request through verified distributors in Ghana. Availability and pricing fluctuate with local market stock.
          </span>
          <button
            onClick={() => setActivePage('marketplace')}
            className="text-[#00c365] hover:underline font-semibold shrink-0 cursor-pointer"
          >
            Request Custom Sourcing →
          </button>
        </div>
      </div>
    </section>
  );
};
