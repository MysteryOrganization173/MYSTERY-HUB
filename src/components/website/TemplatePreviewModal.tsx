import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Monitor,
  Smartphone,
  Tablet,
  Sparkles,
  ShieldCheck,
  Check,
  Building,
  Utensils,
  HardHat,
  Scissors,
  Camera,
  Cpu,
  Palmtree,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import { RestaurantTemplateView } from './templates/RestaurantTemplateView';
import { ConstructionTemplateView } from './templates/ConstructionTemplateView';
import { SalonTemplateView } from './templates/SalonTemplateView';
import { RealEstateTemplateView } from './templates/RealEstateTemplateView';
import { PortfolioTemplateView } from './templates/PortfolioTemplateView';
import { TechAgencyTemplateView } from './templates/TechAgencyTemplateView';
import { HotelTemplateView } from './templates/HotelTemplateView';
import { EcommerceTemplateView } from './templates/EcommerceTemplateView';
import { DynamicTemplateRenderer } from './DynamicTemplateRenderer';

export const TemplatePreviewModal: React.FC = () => {
  const { selectedTemplatePreview, closeTemplatePreview, showToast, openWaitlist } = useApp();
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  // Detect real device screen width to ensure optimal mobile experience
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 640;
      setIsMobileScreen(mobile);
      if (mobile) {
        setDeviceView('mobile');
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!selectedTemplatePreview) return null;

  const t = selectedTemplatePreview;

  // Extract dynamic color configuration
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

  const isDarkBackground =
    palette.background === '#09090b' ||
    palette.background === '#070a0f' ||
    palette.background === '#0b1118' ||
    palette.background.toLowerCase().startsWith('#0');

  const siteSlug = t.demoBusinessName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16);

  const handleStartBuilding = () => {
    closeTemplatePreview();
    openWaitlist(`Website Builder (${t.title})`);
    showToast(`Template "${t.title}" selected! Reserve your free launch access.`, 'success');
  };

  // Industry-specific icon
  const getIndustryIcon = () => {
    switch (t.layoutType || t.category) {
      case 'restaurant':
        return <Utensils className="w-3.5 h-3.5" />;
      case 'construction':
        return <HardHat className="w-3.5 h-3.5" />;
      case 'salon':
      case 'beauty':
        return <Scissors className="w-3.5 h-3.5" />;
      case 'realestate':
        return <Building className="w-3.5 h-3.5" />;
      case 'portfolio':
        return <Camera className="w-3.5 h-3.5" />;
      case 'agency':
        return <Cpu className="w-3.5 h-3.5" />;
      case 'hotel':
        return <Palmtree className="w-3.5 h-3.5" />;
      case 'ecommerce':
      case 'retail':
        return <ShoppingBag className="w-3.5 h-3.5" />;
      default:
        return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  // Flexible Component Renderer: renders tailored layouts while dynamically passing configuration
  const renderTemplateContent = () => {
    const layout = t.layoutType || t.category;

    switch (layout) {
      case 'restaurant':
        return <RestaurantTemplateView template={t} onCtaClick={handleStartBuilding} />;
      case 'construction':
        return <ConstructionTemplateView template={t} onCtaClick={handleStartBuilding} />;
      case 'salon':
      case 'beauty':
        return <SalonTemplateView template={t} onCtaClick={handleStartBuilding} />;
      case 'realestate':
        return <RealEstateTemplateView template={t} onCtaClick={handleStartBuilding} />;
      case 'portfolio':
        return <PortfolioTemplateView template={t} onCtaClick={handleStartBuilding} />;
      case 'agency':
        return <TechAgencyTemplateView template={t} onCtaClick={handleStartBuilding} />;
      case 'hotel':
        return <HotelTemplateView template={t} onCtaClick={handleStartBuilding} />;
      case 'ecommerce':
      case 'retail':
        return <EcommerceTemplateView template={t} onCtaClick={handleStartBuilding} />;
      default:
        return (
          <DynamicTemplateRenderer
            template={t}
            onCtaClick={handleStartBuilding}
            isMobileView={deviceView === 'mobile'}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-3 md:p-5 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden">
      {/* Dynamic Ambient Background Glow customized to template colors */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20 blur-[120px] transition-colors duration-500"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${palette.primary}, ${palette.secondary}, transparent 70%)`,
        }}
      />

      {/* Main Modal Container: Full Screen on Mobile, Windowed on Desktop */}
      <div className="relative w-full h-[100dvh] sm:h-[94vh] sm:max-w-6xl bg-[#0a0f14] border-0 sm:border border-slate-800 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 z-10">
        {/* Top Control Bar: Highly optimized for mobile and desktop */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-[#080d12] border-b border-slate-800/90 flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-20">
          {/* Template Identity */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span
              className="w-3 h-3 rounded-full shrink-0 shadow-sm"
              style={{ backgroundColor: palette.secondary }}
            />
            <div className="leading-tight min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-extrabold text-xs sm:text-sm text-white truncate max-w-[130px] sm:max-w-xs">
                  {t.title}
                </h3>
                <span className="hidden md:inline-flex text-[10px] text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded font-normal shrink-0">
                  {t.categoryLabel}
                </span>
                {t.badgeText && (
                  <span
                    className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: `${palette.secondary}25`,
                      color: palette.secondary,
                      border: `1px solid ${palette.secondary}40`,
                    }}
                  >
                    {t.badgeText}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block truncate max-w-sm mt-0.5">
                {t.industry}
              </p>
            </div>
          </div>

          {/* Device Responsive Switcher */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setDeviceView('desktop')}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceView === 'desktop'
                  ? 'bg-[#00c365] text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Desktop View (1024px+)"
              aria-label="Desktop View"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden lg:inline text-[11px]">Desktop</span>
            </button>
            <button
              onClick={() => setDeviceView('tablet')}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceView === 'tablet'
                  ? 'bg-[#00c365] text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Tablet View (iPad 768px)"
              aria-label="Tablet View"
            >
              <Tablet className="w-3.5 h-3.5" />
              <span className="hidden lg:inline text-[11px]">Tablet</span>
            </button>
            <button
              onClick={() => setDeviceView('mobile')}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceView === 'mobile'
                  ? 'bg-[#00c365] text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Mobile View (375px)"
              aria-label="Mobile View"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden lg:inline text-[11px]">Mobile</span>
            </button>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={handleStartBuilding}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs transition-all shadow-[0_0_15px_rgba(0,195,101,0.35)] active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Use This Template</span>
              <span className="sm:hidden text-[11px]">Use</span>
            </button>

            <button
              onClick={closeTemplatePreview}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Preview"
              aria-label="Close Preview"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Canvas Area: Zero extra padding on mobile, beautiful framed preview on desktop */}
        <div className="flex-1 bg-[#05080c] p-0 sm:p-4 overflow-y-auto flex items-center justify-center relative">
          {/* Framed Device Mockup Canvas */}
          <div
            className={`transition-all duration-300 flex flex-col ${
              deviceView === 'desktop'
                ? 'w-full max-w-5xl h-full border-0 sm:border border-slate-800 sm:rounded-2xl overflow-hidden shadow-2xl'
                : deviceView === 'tablet'
                ? 'w-full sm:w-[740px] max-w-full h-full border-0 sm:border border-slate-800 sm:rounded-2xl overflow-hidden shadow-2xl'
                : isMobileScreen
                ? 'w-full h-full border-0 overflow-hidden'
                : 'w-[375px] max-w-full h-full max-h-[720px] rounded-3xl border-4 border-slate-800 shadow-2xl overflow-hidden ring-1 ring-slate-700/50'
            }`}
          >
            {/* Dynamic Adaptive Browser / Device Shell Header */}
            <div
              className="border-b px-3 sm:px-4 py-2 flex items-center justify-between text-xs shrink-0 select-none"
              style={{
                backgroundColor: isDarkBackground ? '#0d1319' : '#f8fafc',
                borderColor: isDarkBackground ? '#1e293b' : '#e2e8f0',
                color: isDarkBackground ? '#94a3b8' : '#475569',
              }}
            >
              {/* Traffic Lights / Smartphone Speaker Notch */}
              {deviceView === 'mobile' && !isMobileScreen ? (
                <div className="flex items-center justify-center w-full relative">
                  <div className="w-12 h-3.5 bg-slate-900 rounded-full flex items-center justify-center gap-1.5 px-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                    <span className="w-2 h-1 rounded-full bg-slate-800" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>

                  {/* Dynamic Domain Bar */}
                  <div
                    className="px-2.5 py-0.5 rounded-lg border text-[10px] sm:text-[11px] font-mono flex items-center gap-1.5 max-w-[200px] sm:max-w-xs truncate mx-2"
                    style={{
                      backgroundColor: isDarkBackground ? '#070b10' : '#ffffff',
                      borderColor: isDarkBackground ? '#1e293b' : '#cbd5e1',
                    }}
                  >
                    <span style={{ color: palette.secondary }} className="font-bold shrink-0">
                      https://
                    </span>
                    <span
                      className="truncate font-semibold"
                      style={{ color: isDarkBackground ? '#f8fafc' : '#0f172a' }}
                    >
                      {siteSlug}.mysteryhub.site
                    </span>
                  </div>

                  {/* Security / Industry Indicator */}
                  <div className="flex items-center gap-1.5 text-[10px] shrink-0 font-medium">
                    <span style={{ color: palette.secondary }}>{getIndustryIcon()}</span>
                    <span className="hidden sm:inline" style={{ color: palette.secondary }}>
                      Verified Site
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Template Rendered Website Content Container */}
            <div
              className="flex-1 overflow-y-auto scrollbar-thin"
              style={{ backgroundColor: palette.background }}
            >
              {renderTemplateContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
