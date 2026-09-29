import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DIGITAL_SERVICES } from '../../data/services';
import {
  Wifi,
  Smartphone,
  Globe,
  Zap,
  Droplet,
  Tv,
  GraduationCap,
  FileCheck2,
  Sparkles,
  Cpu,
  Wallet,
  Gift,
  Search,
  Bell,
  ArrowRight
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wifi,
  Smartphone,
  Layout: Globe,
  Zap,
  Droplet,
  Tv,
  GraduationCap,
  FileCheck2,
  Sparkles,
  Cpu,
  Wallet,
  Gift,
};

export const MoreServicesPage: React.FC = () => {
  const { setActivePage, openWaitlist } = useApp();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['all', 'Connectivity', 'Utilities', 'Digital Presence', 'Education', 'Business Services', 'Productivity', 'Fintech Utility', 'Rewards'];

  const filteredServices = DIGITAL_SERVICES.filter((s) => {
    if (filterCategory !== 'all' && s.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = s.title.toLowerCase().includes(q);
      const matchDesc = s.description.toLowerCase().includes(q);
      const matchCat = s.category.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCat) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header Banner */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111c16] border border-[#00c365]/30 text-xs font-semibold text-[#00c365]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Digital Utilities Ecosystem</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            More Services & <br />
            <span className="text-[#00c365]">Everyday Utilities</span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Mystery Hub is expanding into an all-in-one digital operating hub for everyday life and business in Ghana. Browse current services and preview upcoming integrations.
          </p>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-3 rounded-2xl bg-[#0e141a] border border-slate-800">
          {/* Category Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  filterCategory === cat
                    ? 'bg-[#00c365] text-black'
                    : 'text-slate-400 hover:text-white bg-slate-900/60'
                }`}
              >
                {cat === 'all' ? 'All Services' : cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search utilities..."
              className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
            />
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServices.map((service) => {
            const Icon = ICON_MAP[service.iconName] || Zap;
            const isLive = service.status === 'active';
            const isBeta = service.status === 'beta';

            return (
              <div
                key={service.id}
                className="rounded-2xl bg-[#0f151b] border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-all duration-200 group shadow-sm hover:shadow-xl relative"
              >
                <div>
                  {/* Top row */}
                  <div className="flex items-center justify-between">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm"
                      style={{
                        backgroundColor: `${service.accentColor}15`,
                        borderColor: `${service.accentColor}40`,
                        color: service.accentColor,
                      }}
                    >
                      <Icon className="w-6 h-6" />
                    </div>

                    {isLive ? (
                      <span className="text-[10px] font-bold text-[#00c365] bg-[#00c365]/10 border border-[#00c365]/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Active Live
                      </span>
                    ) : isBeta ? (
                      <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Beta Preview
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Coming Soon
                      </span>
                    )}
                  </div>

                  {/* Title & Category */}
                  <div className="mt-4 space-y-1">
                    <span className="text-[11px] font-medium text-slate-400">
                      {service.category}
                    </span>
                    <h3 className="font-bold text-base text-white group-hover:text-[#00c365] transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed pt-1">
                      {service.description}
                    </p>
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="mt-6 pt-4 border-t border-slate-800/80">
                  {isLive ? (
                    <button
                      onClick={() => service.targetPage && setActivePage(service.targetPage)}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <span>Access Now</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : isBeta ? (
                    <button
                      onClick={() => service.targetPage && setActivePage(service.targetPage)}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Explore Templates</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => openWaitlist(service.title)}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-900/80 hover:bg-[#00c365]/10 hover:border-[#00c365]/40 text-slate-300 hover:text-[#00c365] font-semibold text-xs border border-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Notify Me at Launch</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
