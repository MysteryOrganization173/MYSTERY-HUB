import React from 'react';
import { WebsiteTemplate } from '../../types';
import {
  Utensils,
  HardHat,
  Scissors,
  Building,
  Camera,
  Cpu,
  Palmtree,
  ShoppingBag,
  GraduationCap,
  Church,
  Shirt,
  Briefcase,
  Sparkles,
  Eye,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';

interface TemplateCardPreviewProps {
  template: WebsiteTemplate;
  onPreview: () => void;
  onUseTemplate?: () => void;
  compact?: boolean;
}

export const TemplateCardPreview: React.FC<TemplateCardPreviewProps> = ({
  template: t,
  onPreview,
  onUseTemplate,
  compact = false,
}) => {
  const palette = t.colorScheme || {
    primary: '#0f172a',
    secondary: t.accentColor || '#00c365',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    mutedText: '#64748b',
    accent: t.accentColor || '#00c365',
    border: '#e2e8f0',
  };

  const domainSlug = t.demoBusinessName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 14);

  const layout = (t.layoutType || t.category || 'generic').toLowerCase();

  // Helper for industry icon
  const getMiniIcon = () => {
    switch (layout) {
      case 'restaurant':
        return <Utensils className="w-2.5 h-2.5" />;
      case 'construction':
        return <HardHat className="w-2.5 h-2.5" />;
      case 'salon':
      case 'beauty':
        return <Scissors className="w-2.5 h-2.5" />;
      case 'realestate':
        return <Building className="w-2.5 h-2.5" />;
      case 'portfolio':
        return <Camera className="w-2.5 h-2.5" />;
      case 'agency':
        return <Cpu className="w-2.5 h-2.5" />;
      case 'hotel':
        return <Palmtree className="w-2.5 h-2.5" />;
      case 'retail':
      case 'ecommerce':
        return <ShoppingBag className="w-2.5 h-2.5" />;
      case 'education':
        return <GraduationCap className="w-2.5 h-2.5" />;
      case 'church':
        return <Church className="w-2.5 h-2.5" />;
      case 'fashion':
        return <Shirt className="w-2.5 h-2.5" />;
      case 'services':
        return <Briefcase className="w-2.5 h-2.5" />;
      default:
        return <Sparkles className="w-2.5 h-2.5" />;
    }
  };

  return (
    <div
      onClick={onPreview}
      className="group rounded-2xl bg-[#0e141a] border border-slate-800 hover:border-[#00c365]/60 overflow-hidden transition-all duration-300 flex flex-col justify-between shadow-sm hover:shadow-2xl hover:-translate-y-1 cursor-pointer"
    >
      <div>
        {/* =========================================================
            1. BROWSER WINDOW CONTAINER (Miniature Website Canvas)
            ========================================================= */}
        <div className="relative bg-[#070a0d] border-b border-slate-800 overflow-hidden">
          {/* Top Browser URL Chrome */}
          <div className="px-3 py-1.5 bg-[#090d12] border-b border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400 select-none">
            {/* Window Dots */}
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500/80" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
            </div>

            {/* URL Pill */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#121921] border border-slate-800 text-[9px] font-mono text-slate-300 truncate max-w-[150px] sm:max-w-[180px]">
              <span className="w-1 h-1 rounded-full bg-[#00c365]" />
              <span className="truncate">{domainSlug}.mysteryhub.site</span>
            </div>

            {/* Tier Badge */}
            {t.badgeText ? (
              <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
                {t.badgeText}
              </span>
            ) : t.isFreeTier ? (
              <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-[#00c365]/15 text-[#00c365] border border-[#00c365]/30">
                Free
              </span>
            ) : (
              <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-purple-400/15 text-purple-300 border border-purple-400/30">
                Pro
              </span>
            )}
          </div>

          {/* Miniature Website Body Viewport */}
          <div className="relative h-48 sm:h-52 w-full overflow-hidden flex flex-col justify-between text-left select-none">
            {/* Background Image Layer */}
            {t.heroImage ? (
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url(${t.heroImage})` }}
              />
            ) : null}

            {/* Layout-Specific Gradient Filter Overlay */}
            <div
              className="absolute inset-0 transition-opacity duration-300"
              style={{
                background:
                  layout === 'restaurant'
                    ? `linear-gradient(135deg, rgba(122, 28, 40, 0.94) 0%, rgba(20, 10, 12, 0.96) 100%)`
                    : layout === 'construction'
                    ? `linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(20, 20, 24, 0.96) 100%)`
                    : layout === 'salon' || layout === 'beauty'
                    ? `linear-gradient(135deg, rgba(13, 27, 24, 0.95) 0%, rgba(6, 15, 13, 0.97) 100%)`
                    : layout === 'realestate'
                    ? `linear-gradient(135deg, rgba(15, 28, 44, 0.95) 0%, rgba(6, 12, 20, 0.97) 100%)`
                    : layout === 'agency'
                    ? `linear-gradient(135deg, rgba(10, 18, 30, 0.95) 0%, rgba(5, 8, 15, 0.98) 100%)`
                    : layout === 'portfolio'
                    ? `linear-gradient(135deg, rgba(20, 20, 25, 0.95) 0%, rgba(8, 8, 10, 0.98) 100%)`
                    : layout === 'hotel'
                    ? `linear-gradient(135deg, rgba(12, 30, 36, 0.95) 0%, rgba(5, 15, 18, 0.98) 100%)`
                    : layout === 'retail' || layout === 'ecommerce'
                    ? `linear-gradient(135deg, rgba(22, 18, 32, 0.95) 0%, rgba(10, 8, 16, 0.98) 100%)`
                    : layout === 'church'
                    ? `linear-gradient(135deg, rgba(30, 20, 15, 0.95) 0%, rgba(12, 8, 5, 0.98) 100%)`
                    : `linear-gradient(135deg, ${palette.primary} 0%, #080c10 100%)`,
              }}
            />

            {/* MINI WEBSITE NAVBAR */}
            <div className="relative z-10 px-3 py-2 flex items-center justify-between border-b border-white/10 bg-black/30 backdrop-blur-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className="w-4 h-4 rounded-md flex items-center justify-center text-white shrink-0 shadow-sm"
                  style={{ backgroundColor: palette.secondary }}
                >
                  {getMiniIcon()}
                </div>
                <span className="font-extrabold text-[10px] text-white tracking-tight truncate max-w-[110px]">
                  {t.demoBusinessName}
                </span>
              </div>

              {/* Mini Nav Links */}
              <div className="hidden sm:flex items-center gap-2 text-[8px] font-medium text-slate-300/80">
                {layout === 'restaurant' ? (
                  <>
                    <span>Menu</span>
                    <span>Specials</span>
                  </>
                ) : layout === 'construction' ? (
                  <>
                    <span>Civil</span>
                    <span>Projects</span>
                  </>
                ) : layout === 'realestate' ? (
                  <>
                    <span>Listings</span>
                    <span>Lands</span>
                  </>
                ) : layout === 'beauty' || layout === 'salon' ? (
                  <>
                    <span>Services</span>
                    <span>Lookbook</span>
                  </>
                ) : (
                  <>
                    <span>About</span>
                    <span>Services</span>
                  </>
                )}
              </div>

              {/* Mini Header CTA */}
              <div
                className="px-1.5 py-0.5 rounded text-[8px] font-bold text-black shadow-xs shrink-0"
                style={{ backgroundColor: palette.secondary }}
              >
                {layout === 'restaurant'
                  ? 'Order'
                  : layout === 'construction'
                  ? 'Estimate'
                  : layout === 'beauty' || layout === 'salon'
                  ? 'Book'
                  : layout === 'realestate'
                  ? 'Browse'
                  : 'Contact'}
              </div>
            </div>

            {/* MINI HERO CONTENT - TAILORED BY TEMPLATE TYPE */}
            <div className="relative z-10 p-3 space-y-2">
              {/* Category Pill */}
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/10 backdrop-blur-xs text-[8px] font-semibold text-white/90 border border-white/15 w-fit">
                <span>{t.categoryLabel}</span>
              </div>

              {/* Hero Headline */}
              <div className="space-y-0.5">
                <h4 className="font-extrabold text-xs text-white leading-tight drop-shadow line-clamp-2">
                  {t.demoHeroTagline || t.title}
                </h4>
                <p className="text-[9px] text-slate-300/80 line-clamp-1">
                  {t.demoSubtext || t.industry}
                </p>
              </div>

              {/* Category-Specific Visual Feature Chip */}
              {layout === 'restaurant' && (
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-black/40 border border-white/10 text-[9px]">
                  <span className="text-amber-300 font-medium truncate">Tilapia & Banku Special</span>
                  <span className="text-white font-bold font-mono shrink-0">GH₵85</span>
                </div>
              )}

              {layout === 'construction' && (
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-black/40 border border-white/10 text-[9px]">
                  <span className="text-orange-300 font-medium">148+ Civil Projects</span>
                  <span className="text-white font-bold font-mono">Accra & Tema</span>
                </div>
              )}

              {(layout === 'salon' || layout === 'beauty') && (
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-black/40 border border-white/10 text-[9px]">
                  <span className="text-emerald-300 font-medium">Braids · Cut · Styling</span>
                  <span className="text-white font-bold font-mono">Book Slot</span>
                </div>
              )}

              {layout === 'realestate' && (
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-black/40 border border-white/10 text-[9px]">
                  <span className="text-sky-300 font-medium">4-Bed Townhouse</span>
                  <span className="text-white font-bold font-mono">East Legon</span>
                </div>
              )}

              {layout === 'agency' && (
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-black/40 border border-white/10 text-[9px]">
                  <span className="text-cyan-300 font-medium">99.9% Cloud Uptime</span>
                  <span className="text-white font-bold font-mono">SaaS API</span>
                </div>
              )}

              {layout === 'hotel' && (
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-black/40 border border-white/10 text-[9px]">
                  <span className="text-teal-300 font-medium">Oceanview Suites</span>
                  <span className="text-white font-bold font-mono">Ada Foah</span>
                </div>
              )}

              {(layout === 'retail' || layout === 'ecommerce') && (
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-black/40 border border-white/10 text-[9px]">
                  <span className="text-pink-300 font-medium">MoMo Instant Checkout</span>
                  <span className="text-white font-bold font-mono">GH₵340</span>
                </div>
              )}
            </div>

            {/* MINI HERO BUTTON STRIP */}
            <div className="relative z-10 px-3 pb-2.5 flex items-center gap-1.5">
              <div
                className="px-2 py-1 rounded-md text-[9px] font-bold text-black flex items-center gap-1 shadow-sm"
                style={{ backgroundColor: palette.secondary }}
              >
                <span>Preview Site</span>
              </div>
              <div className="px-2 py-1 rounded-md bg-white/15 backdrop-blur-xs text-[9px] font-medium text-white border border-white/15">
                <span>WhatsApp MoMo</span>
              </div>
            </div>

            {/* Hover Live Overlay */}
            <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1.5 text-center p-4">
              <div className="w-10 h-10 rounded-full bg-[#00c365] text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Eye className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xs text-white tracking-wide">
                Interactive Preview
              </span>
              <span className="text-[10px] text-slate-300">
                Test mobile, tablet & desktop
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================
            2. TEMPLATE METADATA & SPECS FOOTER
            ========================================================= */}
        <div className="p-4 space-y-2 text-left">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-bold text-sm text-white group-hover:text-[#00c365] transition-colors leading-tight">
                {t.title}
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                {t.industry}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {t.description}
          </p>

          {/* Key Feature Bullets */}
          {t.features && t.features.length > 0 && !compact && (
            <div className="pt-1.5 flex flex-wrap gap-1">
              {t.features.slice(0, 2).map((feat, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-[10px] text-slate-300 bg-[#121921] border border-slate-800 px-2 py-0.5 rounded-md"
                >
                  <CheckCircle className="w-2.5 h-2.5 text-[#00c365]" />
                  <span>{feat}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer Bar */}
      <div className="p-4 pt-0 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 group-hover:bg-slate-800 text-white text-xs font-bold border border-slate-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Eye className="w-3.5 h-3.5 text-slate-400" />
          <span>Preview</span>
        </button>

        {onUseTemplate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUseTemplate();
            }}
            className="py-2.5 px-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="Use this template"
          >
            <span>Use</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
