import { SafeImage } from './SafeImage.js';
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
  CheckCircle2,
  ArrowRight,
  Layout,
  Plus,
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
  const isStartBlank = t.id === 'tmpl-start-blank';

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

  const domainSlug = (t.demoBusinessName || t.title)
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

  // Determine concise badge text
  const primaryBadge = t.badgeText || (t.isFreeTier ? 'Free' : 'Pro');
  const secondaryBadge = t.id === 'tmpl-data-reseller'
    ? 'Great for resellers'
    : t.id === 'tmpl-start-blank'
    ? 'Custom Layout'
    : t.categoryLabel || t.industry;

  return (
    <div
      onClick={isStartBlank ? (onUseTemplate || onPreview) : onPreview}
      className={`group rounded-2xl bg-[#0e141a] border overflow-hidden transition-all duration-300 flex flex-col justify-between shadow-sm hover:shadow-2xl hover:-translate-y-1 cursor-pointer ${
        isStartBlank
          ? 'border-emerald-500/40 hover:border-[#00c365] bg-gradient-to-b from-[#0a1510] to-[#0a1118]'
          : 'border-slate-800 hover:border-[#00c365]/60'
      }`}
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
            <span
              className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
                isStartBlank
                  ? 'bg-emerald-500/15 text-[#00c365] border-emerald-500/30'
                  : t.badgeText
                  ? 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                  : t.isFreeTier
                  ? 'bg-[#00c365]/15 text-[#00c365] border-[#00c365]/30'
                  : 'bg-purple-400/15 text-purple-300 border-purple-400/30'
              }`}
            >
              {primaryBadge}
            </span>
          </div>

          {/* Miniature Website Body Viewport */}
          {isStartBlank ? (
            /* Schematic Architectural Blueprint for Start Blank */
            <div className="relative h-48 sm:h-52 w-full p-3.5 flex flex-col justify-between bg-[#08120e] text-left select-none overflow-hidden">
              {/* Wireframe Grid Blueprint Background */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, #00c365 1px, transparent 0)',
                  backgroundSize: '16px 16px',
                }}
              />

              {/* Wireframe Header */}
              <div className="relative z-10 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-emerald-500/30 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-xs bg-[#00c365]" />
                  <span className="text-[9px] font-mono text-emerald-400 font-bold tracking-tight">HEADER</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-1 rounded-full bg-slate-700" />
                  <div className="w-4 h-1 rounded-full bg-slate-700" />
                  <div className="w-6 h-2 rounded bg-emerald-500/20" />
                </div>
              </div>

              {/* Wireframe Hero Banner */}
              <div className="relative z-10 p-2.5 rounded-lg bg-[#0e1d17] border border-emerald-500/35 space-y-1 shadow-sm">
                <div className="flex items-center gap-1">
                  <span className="text-[8px] font-mono uppercase px-1 rounded bg-[#00c365]/20 text-[#00c365] font-bold">
                    HERO
                  </span>
                  <div className="w-24 h-1.5 rounded bg-slate-400/60" />
                </div>
                <div className="w-36 h-1 rounded bg-slate-600/70" />
                <div className="w-12 h-2.5 rounded bg-[#00c365] mt-1" />
              </div>

              {/* Wireframe Sections Row */}
              <div className="relative z-10 grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-700/80 space-y-1">
                  <span className="text-[8px] font-mono text-slate-400">SECTION · 01</span>
                  <div className="w-16 h-1 rounded bg-slate-700" />
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-700/80 space-y-1">
                  <span className="text-[8px] font-mono text-slate-400">SECTION · 02</span>
                  <div className="w-16 h-1 rounded bg-slate-700" />
                </div>
              </div>

              {/* Wireframe Footer */}
              <div className="relative z-10 px-2.5 py-1 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between text-[8px] font-mono text-slate-500">
                <span>FOOTER</span>
                <span>© {new Date().getFullYear()}</span>
              </div>

              {/* Hover Live Overlay */}
              <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1.5 text-center p-4">
                <div className="w-10 h-10 rounded-full bg-[#00c365] text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <span className="font-extrabold text-xs text-white tracking-wide">
                  Start Blank Project
                </span>
                <span className="text-[10px] text-slate-300">
                  Build custom layout from scratch
                </span>
              </div>
            </div>
          ) : (
            /* Regular Visual Template Canvas */
            <div className="relative h-48 sm:h-52 w-full overflow-hidden flex flex-col justify-between text-left select-none">
              {/* Background Image Layer */}
              {t.heroImage ? (
                <SafeImage
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  src={t.heroImage}
                  alt={t.demoBusinessName}
                  loading="lazy"
                />
              ) : null}

              {/* Layout-Specific Gradient Filter Overlay */}
              <div
                className="absolute inset-0 transition-opacity duration-300"
                style={{
                  background:
                    layout === 'restaurant'
                      ? `linear-gradient(135deg, rgba(122, 28, 40, 0.65) 0%, rgba(20, 10, 12, 0.75) 100%)`
                      : layout === 'construction'
                      ? `linear-gradient(135deg, rgba(15, 23, 42, 0.65) 0%, rgba(20, 20, 24, 0.75) 100%)`
                      : layout === 'salon' || layout === 'beauty'
                      ? `linear-gradient(135deg, rgba(13, 27, 24, 0.65) 0%, rgba(6, 15, 13, 0.75) 100%)`
                      : layout === 'realestate'
                      ? `linear-gradient(135deg, rgba(15, 28, 44, 0.65) 0%, rgba(6, 12, 20, 0.75) 100%)`
                      : layout === 'agency'
                      ? `linear-gradient(135deg, rgba(10, 18, 30, 0.65) 0%, rgba(5, 8, 15, 0.75) 100%)`
                      : layout === 'portfolio'
                      ? `linear-gradient(135deg, rgba(20, 20, 25, 0.65) 0%, rgba(8, 8, 10, 0.75) 100%)`
                      : layout === 'hotel'
                      ? `linear-gradient(135deg, rgba(12, 30, 36, 0.65) 0%, rgba(5, 15, 18, 0.75) 100%)`
                      : layout === 'retail' || layout === 'ecommerce'
                      ? t.id === 'tmpl-data-reseller'
                        ? `linear-gradient(135deg, rgba(15, 23, 42, 0.68) 0%, rgba(10, 15, 29, 0.8) 100%)`
                        : `linear-gradient(135deg, rgba(22, 18, 32, 0.65) 0%, rgba(10, 8, 16, 0.75) 100%)`
                      : layout === 'church'
                      ? `linear-gradient(135deg, rgba(30, 20, 15, 0.65) 0%, rgba(12, 8, 5, 0.75) 100%)`
                      : `linear-gradient(135deg, ${palette.primary}bb 0%, #080c1090 100%)`,
                }}
              />

              {/* MINI WEBSITE NAVBAR */}
              <div className="relative z-10 px-3 py-2 flex items-center justify-between border-b border-white/10 bg-black/35 backdrop-blur-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="w-4 h-4 rounded-md flex items-center justify-center text-white shrink-0 shadow-sm"
                    style={{ backgroundColor: palette.secondary }}
                  >
                    {getMiniIcon()}
                  </div>
                  <span className="font-extrabold text-[10px] text-white tracking-tight truncate max-w-[120px]">
                    {t.demoBusinessName}
                  </span>
                </div>

                {/* Mini Header CTA */}
                <div
                  className="px-1.5 py-0.5 rounded text-[8px] font-bold shadow-xs shrink-0"
                  style={{
                    backgroundColor: palette.secondary,
                    color: t.id === 'tmpl-data-reseller' ? '#ffffff' : '#000000',
                  }}
                >
                  {layout === 'restaurant'
                    ? 'Order'
                    : layout === 'reseller' || t.id === 'tmpl-data-reseller'
                    ? 'Buy Data'
                    : layout === 'construction'
                    ? 'Estimate'
                    : layout === 'beauty' || layout === 'salon'
                    ? 'Book'
                    : layout === 'realestate'
                    ? 'Browse'
                    : 'Contact'}
                </div>
              </div>

              {/* MINI HERO CONTENT */}
              <div className="relative z-10 p-3 space-y-1.5">
                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/10 backdrop-blur-xs text-[8px] font-semibold text-white/90 border border-white/15 w-fit">
                  <span>{t.categoryLabel}</span>
                </div>

                <div className="space-y-0.5">
                  <h4 className="font-extrabold text-xs text-white leading-tight drop-shadow line-clamp-1">
                    {t.demoHeroTagline || t.title}
                  </h4>
                  <p className="text-[9px] text-slate-300/80 line-clamp-1">
                    {t.demoSubtext || t.industry}
                  </p>
                </div>
              </div>

              {/* MINI HERO BUTTON STRIP */}
              <div className="relative z-10 px-3 pb-2.5 flex items-center gap-1.5">
                <div
                  className="px-2 py-0.5 rounded-md text-[8px] font-bold flex items-center gap-1 shadow-sm"
                  style={{
                    backgroundColor: palette.secondary,
                    color: t.id === 'tmpl-data-reseller' ? '#ffffff' : '#000000',
                  }}
                >
                  <span>Preview</span>
                </div>
                <div className="px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-xs text-[8px] font-medium text-white border border-white/15">
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
          )}
        </div>

        {/* =========================================================
            2. TEMPLATE METADATA (CLEAN COMMERCIAL SCAN)
            ========================================================= */}
        <div className="p-4 space-y-2 text-left">
          <div className="space-y-0.5">
            <h3 className="font-extrabold text-sm sm:text-base text-white group-hover:text-[#00c365] transition-colors leading-snug">
              {isStartBlank ? 'Start Blank' : t.demoBusinessName || t.title}
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              {isStartBlank ? 'Clean Essentials Foundation' : t.categoryLabel || t.industry}
            </p>
          </div>

          {/* Concise Badges Strip */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-0.5">
            <span className="inline-flex items-center gap-1 text-[#00c365] font-semibold">
              <CheckCircle2 className="w-3 h-3" />
              <span>Free tier</span>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-slate-300 truncate">
              {isStartBlank ? 'Start with essentials' : secondaryBadge}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer Bar */}
      <div className="p-4 pt-0 flex items-center gap-2">
        {isStartBlank ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onUseTemplate) onUseTemplate();
              else onPreview();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Start Blank</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 group-hover:bg-slate-800 text-white text-xs font-bold border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
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
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                title={`Use ${t.demoBusinessName || t.title}`}
              >
                <span>Use Template</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
