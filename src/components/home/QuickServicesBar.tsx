import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Wifi, Globe, ShoppingBag, Grid2X2, ArrowRight } from 'lucide-react';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';

export const QuickServicesBar: React.FC = () => {
  const { setActivePage } = useApp();
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  const services = [
    {
      id: 'data',
      title: 'Data Bundles',
      desc: 'MTN, Telecel, AT',
      icon: Wifi,
      image: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1790888903/ChatGPT_Image_Oct_1_2026_09_04_50_PM-1_wam5ps.png',
      accentText: 'text-amber-400',
      accentBg: 'bg-amber-400/10 group-hover:bg-amber-400/15',
      accentBorder: 'border-amber-400/20 group-hover:border-amber-400/40',
      badgeAccent: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
      glowAccent: 'shadow-amber-500/5 hover:shadow-amber-500/10',
      objectPosition: '50% 50%',
      action: () => setActivePage('data'),
      tag: 'Live',
    },
    {
      id: 'website',
      title: 'Website Builder',
      desc: 'For Ghanaian business',
      icon: Globe,
      image: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1790888916/ChatGPT_Image_Oct_1_2026_09_05_01_PM-2_gqtzsj.png',
      accentText: 'text-sky-400',
      accentBg: 'bg-sky-400/10 group-hover:bg-sky-400/15',
      accentBorder: 'border-sky-400/20 group-hover:border-sky-400/40',
      badgeAccent: 'text-sky-400 border-sky-500/20 bg-sky-500/10',
      glowAccent: 'shadow-sky-500/5 hover:shadow-sky-500/10',
      objectPosition: '50% 50%',
      action: () => setActivePage('website'),
      tag: 'Beta',
    },
    {
      id: 'marketplace',
      title: 'Tech Marketplace',
      desc: 'Laptops, tools & software',
      icon: ShoppingBag,
      image: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1790888926/ChatGPT_Image_Oct_1_2026_09_05_06_PM-3_kgmhjj.png',
      accentText: 'text-[#00c365]',
      accentBg: 'bg-[#00c365]/10 group-hover:bg-[#00c365]/15',
      accentBorder: 'border-[#00c365]/20 group-hover:border-[#00c365]/40',
      badgeAccent: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
      glowAccent: 'shadow-[#00c365]/5 hover:shadow-[#00c365]/10',
      objectPosition: '50% 50%',
      action: () => setActivePage('marketplace'),
      tag: 'New',
    },
    {
      id: 'services',
      title: 'More Utilities',
      desc: 'Bills & future ecosystem',
      icon: Grid2X2,
      image: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1790888944/ChatGPT_Image_Oct_1_2026_09_05_09_PM-4_aiazfw.png',
      accentText: 'text-purple-400',
      accentBg: 'bg-purple-400/10 group-hover:bg-purple-400/15',
      accentBorder: 'border-purple-400/20 group-hover:border-purple-400/40',
      badgeAccent: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
      glowAccent: 'shadow-purple-500/5 hover:shadow-purple-500/10',
      objectPosition: '50% 50%',
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
              className={`relative p-3 sm:p-4 rounded-xl bg-[#10171e]/90 border border-slate-800/60 hover:border-slate-700/80 text-left transition-all duration-300 group flex flex-col justify-between cursor-pointer overflow-hidden active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365]/50 shadow-md ${s.glowAccent}`}
            >
              {/* Cinematic Background Image with Cloudinary Optimization & Smooth Fade-In */}
              <img
                src={getCloudinaryUrl(s.image, { width: 480, crop: 'fill', gravity: 'center' })}
                srcSet={getCloudinarySrcSet(s.image, [320, 480, 640], { crop: 'fill', gravity: 'center' })}
                sizes="(max-width: 640px) 50vw, 25vw"
                alt={s.title}
                loading="lazy"
                decoding="async"
                onLoad={() => setLoadedImages((prev) => ({ ...prev, [s.id]: true }))}
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-out transform scale-100 group-hover:scale-[1.03] z-0 ${
                  loadedImages[s.id] ? 'opacity-30 group-hover:opacity-45' : 'opacity-0'
                }`}
                style={{ objectPosition: s.objectPosition }}
              />

              {/* Readability Gradient Overlay - Strongest near text areas at the bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#090d12]/95 via-[#090d12]/75 to-transparent transition-all duration-300 z-10" />

              {/* Interactive Content (Fully above image & overlay) */}
              <div className="relative z-20 flex flex-col justify-between h-full w-full">
                {/* Header Row: Icon and Status Badge */}
                <div className="flex items-center justify-between w-full gap-2">
                  {/* Icon Box with Glassmorphism and color identity */}
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center backdrop-blur-md transition-all duration-300 shadow-sm ${s.accentBg} ${s.accentBorder} ${s.accentText}`}>
                    <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  </div>

                  {/* Status Badge with Glassmorphism and color identity */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className={`text-[9px] sm:text-[10px] font-bold backdrop-blur-md border px-2 py-0.5 rounded-md transition-all duration-300 shadow-sm ${s.badgeAccent}`}>
                      {s.tag}
                    </span>
                    {/* Action Arrow (Glinting on hover) */}
                    <div className={`w-5 h-5 rounded-lg backdrop-blur-md bg-white/5 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300 ${s.accentText}`}>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>

                {/* Typography: Title and Description */}
                <div className="mt-5 sm:mt-6">
                  <div className="font-bold text-xs sm:text-sm text-white group-hover:text-white transition-colors tracking-tight">
                    {s.title}
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-400 truncate mt-0.5 font-medium">
                    {s.desc}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
