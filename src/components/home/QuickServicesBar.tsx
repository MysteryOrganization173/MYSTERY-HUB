import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Wifi,
  Smartphone,
  ShieldCheck,
  Globe,
  ShoppingBag,
  Gift,
  Grid2X2,
  ArrowRight,
} from 'lucide-react';

export const QuickServicesBar: React.FC = () => {
  const { setActivePage, openDataPage } = useApp();

  const services = [
    {
      id: 'data',
      title: 'Data Bundles',
      desc: 'MTN, Telecel & AT',
      icon: Wifi,
      accentText: 'text-amber-400',
      accentBg: 'bg-amber-400/10 group-hover:bg-amber-400/15',
      accentBorder: 'border-amber-400/25 group-hover:border-amber-400/50',
      cardBorder: 'border border-amber-500/20 hover:border-amber-400/50',
      badgeAccent: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      action: () => openDataPage('data'),
      tag: 'Available',
    },
    {
      id: 'airtime',
      title: 'Airtime Top-Up',
      desc: 'Top up your number',
      icon: Smartphone,
      accentText: 'text-emerald-400',
      accentBg: 'bg-emerald-400/10 group-hover:bg-emerald-400/15',
      accentBorder: 'border-emerald-400/25 group-hover:border-emerald-400/50',
      cardBorder: 'border border-emerald-500/20 hover:border-emerald-400/50',
      badgeAccent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      action: () => openDataPage('airtime'),
      tag: 'Available',
    },
    {
      id: 'afa',
      title: 'AFA Registration',
      desc: 'Check availability',
      icon: ShieldCheck,
      accentText: 'text-teal-400',
      accentBg: 'bg-teal-400/10 group-hover:bg-teal-400/15',
      accentBorder: 'border-teal-400/25 group-hover:border-teal-400/50',
      cardBorder: 'border border-teal-500/20 hover:border-teal-400/50',
      badgeAccent: 'text-teal-400 border-teal-500/30 bg-teal-500/10',
      action: () => setActivePage('afa'),
      tag: 'Check Status',
    },
    {
      id: 'website',
      title: 'Website Builder',
      desc: 'Create a free website',
      icon: Globe,
      accentText: 'text-sky-400',
      accentBg: 'bg-sky-400/10 group-hover:bg-sky-400/15',
      accentBorder: 'border-sky-400/25 group-hover:border-sky-400/50',
      cardBorder: 'border border-sky-500/20 hover:border-sky-400/50',
      badgeAccent: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
      action: () => setActivePage('website'),
      tag: 'Beta',
    },
    {
      id: 'marketplace',
      title: 'Marketplace',
      desc: 'Phones, POS & Tech',
      icon: ShoppingBag,
      accentText: 'text-[#00c365]',
      accentBg: 'bg-[#00c365]/10 group-hover:bg-[#00c365]/15',
      accentBorder: 'border-[#00c365]/25 group-hover:border-[#00c365]/50',
      cardBorder: 'border border-emerald-500/20 hover:border-emerald-400/50',
      badgeAccent: 'text-[#00c365] border-emerald-500/30 bg-emerald-500/10',
      action: () => setActivePage('marketplace'),
      tag: 'Available',
    },
    {
      id: 'earn',
      title: 'Mystery Earn',
      desc: 'Refer friends & earn',
      icon: Gift,
      accentText: 'text-yellow-400',
      accentBg: 'bg-yellow-400/10 group-hover:bg-yellow-400/15',
      accentBorder: 'border-yellow-400/25 group-hover:border-yellow-400/50',
      cardBorder: 'border border-yellow-500/20 hover:border-yellow-400/50',
      badgeAccent: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
      action: () => setActivePage('earn'),
      tag: 'Available',
    },
    {
      id: 'services',
      title: 'More Services',
      desc: 'See what’s coming',
      icon: Grid2X2,
      accentText: 'text-purple-400',
      accentBg: 'bg-purple-400/10 group-hover:bg-purple-400/15',
      accentBorder: 'border-purple-400/25 group-hover:border-purple-400/50',
      cardBorder: 'border border-purple-500/20 hover:border-purple-400/50',
      badgeAccent: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
      action: () => setActivePage('services'),
      tag: 'Coming Soon',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-2 sm:-mt-4 mb-6 sm:mb-8 lg:mb-10 relative z-20">
      <div className="p-3 sm:p-4 rounded-2xl bg-[#0c1217]/95 border border-slate-800/90 backdrop-blur-md shadow-xl space-y-2.5">
        {/* Compact Bar Header */}
        <div className="flex items-center justify-between px-1 text-left">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00c365]" />
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">
              Explore Mystery Hub
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setActivePage('services')}
            className="text-[11px] font-semibold text-slate-400 hover:text-[#00c365] transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>All Services</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* 7 Services Grid: 2-col on small mobile, 3-col on sm, 4-col on md, 7-col on xl */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-2.5">
          {services.map((s, idx) => {
            const Icon = s.icon;
            const isLastOnMobileOdd = idx === 6;

            return (
              <button
                key={s.id}
                onClick={s.action}
                className={`relative p-2.5 sm:p-3 rounded-xl bg-[#090e12] text-left transition-all duration-200 group cursor-pointer overflow-hidden active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365]/50 shadow-sm ${s.cardBorder} ${
                  isLastOnMobileOdd
                    ? 'col-span-2 sm:col-span-1 flex flex-row sm:flex-col items-center sm:items-stretch justify-between'
                    : 'flex flex-col justify-between'
                }`}
              >
                {/* Header Row: Icon + Status Badge */}
                <div className={`flex items-center justify-between w-full gap-1.5 ${isLastOnMobileOdd ? 'sm:flex hidden' : 'flex'}`}>
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center transition-all duration-200 shadow-xs ${s.accentBg} ${s.accentBorder} ${s.accentText}`}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>

                  <span
                    className={`text-[8.5px] font-bold tracking-wide uppercase border px-1.5 py-0.5 rounded-md whitespace-nowrap ${s.badgeAccent}`}
                  >
                    {s.tag}
                  </span>
                </div>

                {/* Mobile-only horizontal layout for 7th spanning item */}
                {isLastOnMobileOdd && (
                  <div className="flex sm:hidden items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all duration-200 shadow-xs shrink-0 ${s.accentBg} ${s.accentBorder} ${s.accentText}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-white group-hover:text-[#00c365] transition-colors tracking-tight truncate">
                        {s.title}
                      </div>
                      <div className="text-[10.5px] text-slate-400 truncate font-normal">
                        {s.desc}
                      </div>
                    </div>
                  </div>
                )}

                {/* Typography: Title + Subtitle (standard view) */}
                <div className={`mt-2.5 sm:mt-3 ${isLastOnMobileOdd ? 'hidden sm:block' : 'block'}`}>
                  <div className="font-bold text-xs text-white group-hover:text-[#00c365] transition-colors tracking-tight truncate">
                    {s.title}
                  </div>
                  <div className="text-[10.5px] text-slate-400 truncate mt-0.5 font-normal">
                    {s.desc}
                  </div>
                </div>

                {/* Mobile-only badge/action indicator for 7th spanning item */}
                {isLastOnMobileOdd && (
                  <div className="flex sm:hidden items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[8.5px] font-bold tracking-wide uppercase border px-1.5 py-0.5 rounded-md whitespace-nowrap ${s.badgeAccent}`}
                    >
                      {s.tag}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#00c365] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
