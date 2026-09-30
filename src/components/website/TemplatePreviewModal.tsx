import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Monitor,
  Smartphone,
  Tablet,
  Sparkles,
  Building,
  Utensils,
  HardHat,
  Scissors,
  Camera,
  Cpu,
  Palmtree,
  ShoppingBag,
  GraduationCap,
  Church,
  Shirt,
  Briefcase,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';

export const TemplatePreviewModal: React.FC = () => {
  const { selectedTemplatePreview, closeTemplatePreview, showToast, openWaitlist } = useApp();
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [iframeKey, setIframeKey] = useState(0);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Detect real device screen width and update dimensions
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 640;
      setIsMobileScreen(mobile);
      if (mobile && deviceView === 'desktop') {
        // Default to mobile view on phones for immediate readability, but allow switching
        setDeviceView('mobile');
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Track canvas container dimensions for responsive scaling calculations
  useEffect(() => {
    if (!canvasRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasDimensions({ width, height });
      }
    });

    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [selectedTemplatePreview]);

  // Handle postMessage from isolated iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'MYSTERYHUB_TEMPLATE_CTA') {
        handleStartBuilding();
      } else if (event.data?.type === 'MYSTERYHUB_TEMPLATE_LOADED') {
        setIsIframeLoaded(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedTemplatePreview]);

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
    const layout = (t.layoutType || t.category || '').toLowerCase();
    switch (layout) {
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
      case 'education':
        return <GraduationCap className="w-3.5 h-3.5" />;
      case 'church':
        return <Church className="w-3.5 h-3.5" />;
      case 'fashion':
        return <Shirt className="w-3.5 h-3.5" />;
      case 'services':
        return <Briefcase className="w-3.5 h-3.5" />;
      default:
        return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  // Target isolated viewport dimensions
  const targetWidth = deviceView === 'mobile' ? 375 : deviceView === 'tablet' ? 768 : 1280;

  // Compute available canvas width and height
  const availableWidth = canvasDimensions.width || (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const availableHeight = canvasDimensions.height || 600;

  // Margin buffer for comfortable framing
  const marginX = isMobileScreen ? 8 : deviceView === 'desktop' ? 32 : 24;
  const usableWidth = Math.max(280, availableWidth - marginX);

  // Scaling factor: 1.0 on large screens, scaled down cleanly on smaller physical screens
  const scale = Math.min(1, usableWidth / targetWidth);
  const isScaled = scale < 0.99;
  const scalePercent = Math.round(scale * 100);

  // Frame container dimensions
  const frameRenderedWidth = targetWidth * scale;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-3 md:p-5 bg-black/95 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden">
      {/* Dynamic Ambient Background Glow customized to template colors */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20 blur-[140px] transition-colors duration-500"
        style={{
          background: `radial-gradient(circle at 50% 25%, ${palette.primary}, ${palette.secondary}, transparent 75%)`,
        }}
      />

      {/* Main Modal Container: Full Screen on Mobile, Windowed on Desktop */}
      <div className="relative w-full h-[100dvh] sm:h-[95vh] sm:max-w-7xl bg-[#0a0f14] border-0 sm:border border-slate-800 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 z-10">
        {/* =========================================================
            TOP CONTROL BAR: Header, Device Switcher, CTAs
            ========================================================= */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-[#080d12] border-b border-slate-800/90 flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-20">
          {/* Template Identity */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span
              className="w-3 h-3 rounded-full shrink-0 shadow-sm"
              style={{ backgroundColor: palette.secondary }}
            />
            <div className="leading-tight min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-extrabold text-xs sm:text-sm text-white truncate max-w-[120px] sm:max-w-xs">
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

          {/* Device Responsive Switcher (Mobile: 375px | Tablet: 768px | Desktop: 1280px) */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-900/95 p-1 rounded-xl border border-slate-800 shrink-0 shadow-inner">
            <button
              type="button"
              onClick={() => setDeviceView('desktop')}
              className={`px-2 py-1.5 sm:px-3 sm:py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceView === 'desktop'
                  ? 'bg-[#00c365] text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Desktop View (1280px)"
              aria-label="Desktop View"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Desktop (1280px)</span>
              <span className="md:hidden text-[10px] font-bold">Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceView('tablet')}
              className={`px-2 py-1.5 sm:px-3 sm:py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceView === 'tablet'
                  ? 'bg-[#00c365] text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Tablet View (768px)"
              aria-label="Tablet View"
            >
              <Tablet className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Tablet (768px)</span>
              <span className="md:hidden text-[10px] font-bold">Tablet</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceView('mobile')}
              className={`px-2 py-1.5 sm:px-3 sm:py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceView === 'mobile'
                  ? 'bg-[#00c365] text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Mobile View (375px)"
              aria-label="Mobile View"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Mobile (375px)</span>
              <span className="md:hidden text-[10px] font-bold">Mobile</span>
            </button>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleStartBuilding}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs transition-all shadow-[0_0_15px_rgba(0,195,101,0.35)] active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Use This Template</span>
              <span className="sm:hidden text-[11px]">Use</span>
            </button>

            <button
              type="button"
              onClick={closeTemplatePreview}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Preview"
              aria-label="Close Preview"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Viewport Sub-bar with Scale & Resolution Indicator */}
        <div className="px-3 sm:px-5 py-1 bg-[#06090d] border-b border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 select-none">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">
              {deviceView === 'desktop'
                ? 'Desktop Preview • 1280px'
                : deviceView === 'tablet'
                ? 'Tablet Preview • 768px'
                : 'Mobile Preview • 375px'}
            </span>
            {isScaled && (
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[9px] font-mono text-[#00c365]">
                Fit Scale: {scalePercent}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIframeKey((k) => k + 1)}
              className="hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              title="Reload preview frame"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Reload</span>
            </button>
            <span className="hidden sm:inline text-slate-500">
              Isolated Responsive Viewport
            </span>
          </div>
        </div>

        {/* =========================================================
            DYNAMIC CANVAS CONTAINER: Isolated Scaled iframe Viewport
            ========================================================= */}
        <div
          ref={canvasRef}
          className="flex-1 bg-[#05080c] p-1 sm:p-4 overflow-hidden flex flex-col items-center justify-center relative"
        >
          {/* Framed Device Mockup Container */}
          <div
            className="flex flex-col rounded-xl sm:rounded-2xl border border-slate-800 shadow-2xl overflow-hidden bg-[#0d1319] transition-all duration-300 relative"
            style={{
              width: `${frameRenderedWidth}px`,
              maxWidth: '100%',
              height: deviceView === 'mobile' && !isScaled && availableHeight > 740 ? '700px' : '100%',
              maxHeight: '100%',
            }}
          >
            {/* Adaptive Browser URL Bar */}
            <div
              className="border-b px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between text-xs shrink-0 select-none z-10"
              style={{
                backgroundColor: isDarkBackground ? '#0d1319' : '#f8fafc',
                borderColor: isDarkBackground ? '#1e293b' : '#e2e8f0',
                color: isDarkBackground ? '#94a3b8' : '#475569',
              }}
            >
              {/* Traffic Lights */}
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
            </div>

            {/* ISOLATED IFRAME VIEWPORT WRAPPER */}
            <div className="flex-1 w-full relative overflow-hidden bg-white">
              <div
                style={{
                  width: `${targetWidth}px`,
                  height: `${100 / scale}%`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              >
                <iframe
                  key={`${t.id}-${deviceView}-${iframeKey}`}
                  src={`/?isolated_template_preview=${encodeURIComponent(t.id)}`}
                  title={`${t.title} ${deviceView} preview`}
                  className="w-full h-full border-0 block bg-white"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
