import React, { useEffect, useState } from 'react';
import { getAfaConfig } from '../../services/afaApi';
import { useApp } from '../../context/AppContext';
import { DIGITAL_SERVICES, SAMPLE_SERVICE_ARTWORK } from '../../data/services';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';
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
  const [afaAvailable, setAfaAvailable] = useState(false);
  useEffect(() => {let active=true;getAfaConfig().then(config=>{if(active)setAfaAvailable(config.available);}).catch(()=>{});return()=>{active=false;};},[]);

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
    <div className="py-4 sm:py-8 lg:py-10 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5 sm:space-y-8 lg:space-y-10">
        {/* Compact Hero Section */}
        <div className="relative rounded-2xl sm:rounded-3xl bg-[#070b0e] border border-slate-800/80 p-4 sm:p-8 lg:p-10 overflow-hidden shadow-2xl">
          {/* Backdrop Artwork Layer */}
          <div
            className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0"
            aria-hidden="true"
            role="presentation"
          >
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
            <div className="lg:hidden absolute inset-0 bg-gradient-to-r from-[#070b0e]/95 via-[#070b0e]/75 to-[#070b0e]/30 from-0% via-48% to-100%" />
            <div className="lg:hidden absolute inset-0 bg-gradient-to-b from-[#070b0e]/30 via-transparent to-[#070b0e] from-0% via-60% to-98%" />
          </div>

          {/* Ambient Glow */}
          <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#00c365]/15 rounded-full blur-[90px] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-center relative z-10">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-3.5 text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#111c16]/90 border border-[#00c365]/30 text-[11px] font-semibold text-[#00c365] backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Digital Utilities Ecosystem</span>
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
                More Services & <br className="hidden xs:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E575] via-[#00c365] to-[#34d399]">Everyday Utilities</span>
              </h1>

              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-xl">
                Explore Mystery Hub services for connectivity, business and everyday digital needs. Live services are ready now, with more on the way.
              </p>

              {/* Compact CTAs */}
              <div className="pt-1 flex flex-row items-center gap-2.5">
                <button
                  onClick={() => setActivePage('data')}
                  className="px-4 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Buy Data</span>
                </button>
                <button
                  onClick={() => setActivePage('website')}
                  className="px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700/80 backdrop-blur-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Globe className="w-3.5 h-3.5 text-[#00c365]" />
                  <span>Build Website</span>
                </button>
              </div>

              {/* Compact Single Trust Line */}
              <div className="pt-1 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00c365]" />
                <span>Secure checkout powered by Paystack</span>
              </div>
            </div>

            {/* Right Column Canvas */}
            <div className="hidden lg:block lg:col-span-5 pointer-events-none min-h-[220px]" aria-hidden="true" />
          </div>
        </div>

        {/* Compact Filter and Search Bar */}
        <div className="p-2.5 rounded-xl bg-[#0e141a] border border-slate-800 space-y-2.5 md:space-y-0 md:flex md:items-center md:justify-between gap-3">
          {/* Category Badges Horizontal Scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  filterCategory === cat
                    ? 'bg-[#00c365] text-black'
                    : 'text-slate-400 hover:text-white bg-slate-900/80 border border-slate-800'
                }`}
              >
                {cat === 'all' ? 'All Services' : cat}
              </button>
            ))}
          </div>

          {/* Compact Search Box */}
          <div className="relative min-w-[200px] md:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services..."
              className="w-full bg-[#090d10] border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
            />
          </div>
        </div>

        {/* 1. Mobile Compact Horizontal Rows (< sm viewports) */}
        <div className="block sm:hidden space-y-2.5">
          {filteredServices.map((service) => {
            const Icon = ICON_MAP[service.iconName] || Zap;
            const isAfa = service.id === 'srv-afa';
            const isLive = isAfa ? afaAvailable : service.status === 'active';
            const isBeta = service.status === 'beta';

            return (
              <div
                key={service.id}
                role={isAfa ? 'button' : undefined}
                tabIndex={isAfa ? 0 : undefined}
                onKeyDown={isAfa ? e => {if(e.key === 'Enter' || e.key === ' ') {e.preventDefault();setActivePage('afa');}} : undefined}
                onClick={() => {
                  if (isAfa) {setActivePage('afa');}
                  else if (service.id === 'srv-rewards') {
                    setActivePage('earn');
                  } else if ((isLive || isBeta) && service.targetPage) {
                    setActivePage(service.targetPage);
                  } else if (!isLive && !isBeta) {
                    openWaitlist(service.title);
                  }
                }}
                className="p-3 rounded-xl bg-[#0f151b] border border-slate-800/90 hover:border-slate-700 transition-all flex items-center justify-between gap-3 shadow-sm cursor-pointer active:bg-slate-900"
              >
                {/* Left side: Icon + Content */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 shadow-sm"
                    style={{
                      backgroundColor: `${service.accentColor}15`,
                      borderColor: `${service.accentColor}40`,
                      color: service.accentColor,
                    }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xs text-white truncate">{service.title}</h3>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                      {service.description}
                    </p>
                  </div>
                </div>

                {/* Right side: Badge + Action */}
                <div className="flex items-center gap-2 shrink-0">
                  {isLive ? (
                    <span className="text-[9px] font-bold text-[#00c365] bg-[#00c365]/10 border border-[#00c365]/30 px-2 py-0.5 rounded uppercase">
                      Live
                    </span>
                  ) : isBeta ? (
                    <span className="text-[9px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded uppercase">
                      Beta
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded uppercase">{isAfa ? 'Unavailable' : 'Soon'}</span>
                  )}

                  {isLive || isBeta || isAfa ? (
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openWaitlist(service.title);
                      }}
                      className="p-1 text-slate-400 hover:text-[#00c365] cursor-pointer"
                      title="Notify Me"
                      aria-label={`Notify me when ${service.title} launches`}
                    >
                      <Bell className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 2. Tablet & Desktop Grid (sm and lg viewports) */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {filteredServices.map((service) => {
            const Icon = ICON_MAP[service.iconName] || Zap;
            const isAfa = service.id === 'srv-afa';
            const isLive = isAfa ? afaAvailable : service.status === 'active';
            const isBeta = service.status === 'beta';
            const artwork = SAMPLE_SERVICE_ARTWORK[service.id];

            return (
              <div
                key={service.id}
                className="rounded-2xl bg-[#0f151b] border border-slate-800 p-5 flex flex-col justify-between hover:border-slate-700 transition-all duration-200 group shadow-sm hover:shadow-xl relative overflow-hidden"
              >
                {/* Absolute Background Artwork Layer (Sample Services Only: ECG, Water, TV) */}
                {artwork && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none select-none rounded-2xl" aria-hidden="true">
                    {/* Artwork on the right 50-55% */}
                    <div className="absolute right-0 bottom-0 top-0 w-3/4 sm:w-3/5 lg:w-[55%] flex items-end justify-end overflow-hidden">
                      <img
                        src={getCloudinaryUrl(artwork.url, { format: 'auto', quality: 'auto', width: 640 })}
                        srcSet={getCloudinarySrcSet(artwork.url, [360, 480, 640]) || undefined}
                        sizes="(max-width: 1024px) 55vw, 420px"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className={`w-full h-full object-cover ${artwork.objectPosition} ${artwork.opacity} transition-transform duration-500 group-hover:scale-105`}
                      />
                    </div>

                    {/* Directional Text Protection Gradient:
                        LEFT: strong dark protection (90-95%)
                        CENTER: medium fade (50-65%)
                        RIGHT: light overlay only (10-20%) so artwork is clearly recognized
                    */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0f151b] from-25% via-[#0f151b]/65 via-50% to-[#0f151b]/10 pointer-events-none" />

                    {/* Subtle bottom grounding gradient behind Notify Me button */}
                    <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#0f151b]/85 via-transparent to-transparent pointer-events-none" />
                  </div>
                )}

                <div className="relative z-10">
                  {/* Top row */}
                  <div className="flex items-center justify-between">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center border shadow-sm"
                      style={{
                        backgroundColor: `${service.accentColor}15`,
                        borderColor: `${service.accentColor}40`,
                        color: service.accentColor,
                      }}
                    >
                      <Icon className="w-5 h-5" />
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
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full uppercase tracking-wider">{isAfa ? 'Unavailable' : 'Coming Soon'}</span>
                    )}
                  </div>

                  {/* Title & Category */}
                  <div className="mt-3.5 space-y-1">
                    <span className="text-[11px] font-medium text-slate-400">
                      {service.category}
                    </span>
                    <h3 className="font-bold text-base text-white group-hover:text-[#00c365] transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed pt-1 line-clamp-3">
                      {service.description}
                    </p>
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="mt-5 pt-3.5 border-t border-slate-800/80 relative z-10">
                  {isAfa ? (<button onClick={() => setActivePage('afa')} className="w-full rounded-xl border border-amber-500 px-4 py-2.5 text-xs font-semibold text-amber-300">View AFA Registration</button>) : service.id === 'srv-rewards' ? (
                    <button
                      onClick={() => setActivePage('earn')}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#00c365] font-semibold text-xs border border-[#00c365]/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Gift className="w-3.5 h-3.5" />
                      <span>Learn About Mystery Earn</span>
                    </button>
                  ) : isLive ? (
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
