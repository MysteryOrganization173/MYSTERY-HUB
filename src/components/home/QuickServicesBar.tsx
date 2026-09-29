import React from 'react';
import { useApp } from '../../context/AppContext';
import { Wifi, Smartphone, Globe, Grid2X2, ArrowRight } from 'lucide-react';

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
      tag: 'Instant',
    },
    {
      id: 'airtime',
      title: 'Airtime',
      desc: 'Top up anytime',
      icon: Smartphone,
      accent: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
      action: () => setActivePage('data'),
      tag: '24/7',
    },
    {
      id: 'website',
      title: 'Website Builder',
      desc: 'For your business',
      icon: Globe,
      accent: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
      action: () => setActivePage('website'),
      tag: 'Popular',
    },
    {
      id: 'services',
      title: 'More Services',
      desc: 'Coming soon',
      icon: Grid2X2,
      accent: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
      action: () => setActivePage('services'),
      tag: 'New',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 mb-16 relative z-20">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 p-2 sm:p-3 rounded-2xl bg-[#0c1217]/90 border border-slate-800/90 backdrop-blur-md shadow-xl">
        {services.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={s.action}
              className="p-3.5 sm:p-4 rounded-xl bg-[#10171e]/70 hover:bg-[#16212b] border border-slate-800/60 hover:border-slate-700 text-left transition-all duration-200 group flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${s.accent}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-slate-400 group-hover:text-white transition-colors bg-slate-800/80 px-2 py-0.5 rounded">
                  {s.tag}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-white group-hover:text-[#00c365] transition-colors">
                    {s.title}
                  </h4>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#00c365] group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
