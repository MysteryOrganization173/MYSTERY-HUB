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
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
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
        {/* Hero Section */}
        <div className="relative rounded-3xl bg-[#070b0e] border border-slate-800/80 p-6 sm:p-12 lg:p-16 overflow-hidden shadow-2xl">
          {/* Backdrop Artwork Layer */}
          <div
            className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0"
            aria-hidden="true"
            role="presentation"
          >
            {/* Responsive Cloudinary Image */}
            <picture>
              <source
                media="(max-width: 767px)"
                srcSet="https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_800,c_fill,g_east/v1790790255/ChatGPT_Image_Sep_30_2026_05_44_04_PM_jldinc.png 800w"
                sizes="100vw"
              />
              <source
                media="(max-width: 1023px)"
                srcSet="https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_1200,c_fill,g_east/v1790790255/ChatGPT_Image_Sep_30_2026_05_44_04_PM_jldinc.png 1200w"
                sizes="100vw"
              />
              <img
                src="https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_1600/v1790790255/ChatGPT_Image_Sep_30_2026_05_44_04_PM_jldinc.png"
                srcSet="https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_1280/v1790790255/ChatGPT_Image_Sep_30_2026_05_44_04_PM_jldinc.png 1280w,
                        https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_1600/v1790790255/ChatGPT_Image_Sep_30_2026_05_44_04_PM_jldinc.png 1600w"
                sizes="100vw"
                alt=""
                fetchPriority="high"
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover object-[92%_top] sm:object-[88%_center] lg:object-right opacity-80 sm:opacity-85 lg:opacity-90"
              />
            </picture>

            {/* Desktop Overlay Gradient */}
            <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#070b0e] via-[#070b0e]/85 to-transparent from-0% via-42% to-75%" />

            {/* Mobile / Tablet Overlay Gradients */}
            <div className="lg:hidden absolute inset-0 bg-gradient-to-r from-[#070b0e]/95 via-[#070b0e]/70 to-[#070b0e]/25 from-0% via-48% to-100%" />
            <div className="lg:hidden absolute inset-0 bg-gradient-to-b from-[#070b0e]/30 via-transparent to-[#070b0e] from-0% via-60% to-98%" />
          </div>

          {/* Ambient Glow */}
          <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00c365]/15 rounded-full blur-[100px] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#111c16]/90 border border-[#00c365]/30 text-xs font-semibold text-[#00c365] backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Digital Utilities Ecosystem</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
                More Services & <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#34d399]">Everyday Utilities</span>
              </h1>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl">
                Mystery Hub is expanding into an all-in-one digital operating hub for everyday life and business in Ghana. Browse active services, buy data & airtime, and preview upcoming digital features.
              </p>

              {/* CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={() => setActivePage('data')}
                  className="px-6 py-3.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,195,101,0.35)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Wifi className="w-4 h-4" />
                  <span>Buy Data & Airtime</span>
                </button>
                <button
                  onClick={() => setActivePage('website')}
                  className="px-6 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700/80 backdrop-blur-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-[#00c365]" />
                  <span>Website Builder</span>
                </button>
              </div>

              {/* Trust Signals */}
              <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#00c365]" />
                  <span>Instant Delivery Active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#00c365]" />
                  <span>Verified MoMo Checkout</span>
                </div>
              </div>
            </div>

            {/* Right Column: Open canvas for the artwork */}
            <div className="hidden lg:block lg:col-span-5 pointer-events-none min-h-[300px] lg:min-h-[380px]" aria-hidden="true" />
          </div>
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
                      <span>{service.id === 'srv-website' ? 'Explore Templates' : 'Preview Feature'}</span>
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
