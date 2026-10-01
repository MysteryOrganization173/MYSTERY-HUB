import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getPublicMarketplaceProducts } from '../../services/apiClient';
import { MarketplaceProduct } from '../../types';
import { OptimizedImage } from '../common/OptimizedImage';
import {
  Laptop,
  Mic,
  Cpu,
  Store,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  FileQuestion,
  Image as ImageIcon,
  Star,
} from 'lucide-react';

export const HomeMarketplaceSection: React.FC = () => {
  const { setActivePage, openMarketplaceInquiry } = useApp();
  const [featuredProducts, setFeaturedProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getPublicMarketplaceProducts({ featured: true })
      .then((res) => {
        if (mounted && res.success && res.products && res.products.length > 0) {
          setFeaturedProducts(res.products.slice(0, 4));
        }
      })
      .catch(() => {
        // silently fallback to category spotlights
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const marketplaceSpotlights = [
    {
      icon: Laptop,
      title: 'Laptops & Workstations',
      desc: 'Business ultrabooks, coding workstations, and student laptops sourced on request for customers in Ghana.',
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
              Need the right tools to work, create or grow? Mystery Hub helps you source quality technology and digital solutions with transparent enquiries.
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

        {/* Live Featured Products or Category Spotlights */}
        {featuredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {featuredProducts.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl bg-[#0e141a] border border-slate-800/90 hover:border-slate-700 transition-all flex flex-col justify-between group space-y-3 shadow-sm"
              >
                <div>
                  {/* Thumbnail / Image */}
                  <div className="relative w-full aspect-[16/10] bg-[#090d10] rounded-xl border border-slate-800 overflow-hidden mb-3">
                    <OptimizedImage
                      src={p.imageUrl}
                      alt={p.imageAlt || p.name}
                      aspectRatio="16/10"
                      objectFit="contain"
                      fallbackIcon={<ImageIcon className="w-6 h-6 text-slate-600" />}
                      containerClassName="p-2"
                    />
                    {p.featured && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold text-amber-400 bg-black/70 backdrop-blur-md border border-amber-400/30 px-1.5 py-0.2 rounded z-10">
                        Featured
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-semibold text-[#00c365] bg-[#00c365]/10 px-2 py-0.5 rounded">
                      {p.categoryLabel}
                    </span>
                    <span className="text-[11px] font-bold text-white tabular-nums">
                      {p.priceDisplay}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-white mt-2 group-hover:text-[#00c365] transition-colors line-clamp-1">
                    {p.name}
                  </h3>
                  {p.tagline && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {p.tagline}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => openMarketplaceInquiry(p)}
                    className="w-full py-2 rounded-xl bg-slate-900 hover:bg-[#00c365] text-slate-200 hover:text-black text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileQuestion className="w-3.5 h-3.5" />
                    <span>Inquire Now</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {marketplaceSpotlights.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  onClick={() => setActivePage('marketplace')}
                  className="p-4 sm:p-5 rounded-2xl bg-[#0e141a] border border-slate-800/90 hover:border-slate-700 transition-all flex flex-col justify-between group space-y-3 cursor-pointer"
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
        )}
      </div>
    </section>
  );
};
