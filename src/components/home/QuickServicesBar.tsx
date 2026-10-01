import React from 'react';
import { useApp } from '../../context/AppContext';
import { Wifi, Globe, ShoppingBag, Grid2X2 } from 'lucide-react';

export const QuickServicesBar: React.FC = () => {
  const { setActivePage } = useApp();

  const services = [
    {
      id: 'data',
      title: 'Data Bundles',
      desc: 'MTN, Telecel, AT',
      icon: Wifi,
      accent: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
      action: () => setActivePage('data'),
      tag: 'Live',
    },
    {
      id: 'website',
      title: 'Website Builder',
      desc: 'For Ghanaian business',
      icon: Globe,
      accent: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
      action: () => setActivePage('website'),
      tag: 'Beta',
    },
    {
      id: 'marketplace',
      title: 'Tech Marketplace',
      desc: 'Laptops, tools & software',
      icon: ShoppingBag,
      accent: 'text-[#00c365] bg-[#00c365]/10 border-[#00c365]/20',
      action: () => setActivePage('marketplace'),
      tag: 'New',
    },
    {
      id: 'services',
      title: 'More Utilities',
      desc: 'Bills & future ecosystem',
      icon: Grid2X2,
      accent: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
      action: () => setActivePage('services'),
      tag: 'Coming Soon',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-3 sm:-mt-5 mb-5 sm:mb-8 lg:mb-10 relative z-20">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 p-2 sm:p-3 rounded-2xl bg-[#0c1217]/90 border border-slate-800/90 backdrop-blur-md shadow-xl">
        {services.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={s.action}
              className="p-3 sm:p-4 rounded-xl bg-[#10171e]/70 hover:bg-[#16212b] border border-slate-800/60 hover:border-slate-700 text-left transition-all duration-200 group flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center ${s.accent}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
                  {s.tag}
                </span>
              </div>
              <div className="mt-2.5">
                <div className="font-bold text-xs sm:text-sm text-white group-hover:text-[#00c365] transition-colors">
                  {s.title}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-400 truncate mt-0.5">
                  {s.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
