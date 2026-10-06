import {useDialogFocus} from '../../hooks/useDialogFocus';
import { WebsiteSettingsControls } from './WebsiteSettingsControls';
import type { WebsiteSiteRecord } from '../../types';
import { trackWebsiteEvent } from '../../utils/websiteAnalytics';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { createWebsiteOnServer } from '../../services/apiClient';
import {
  X,
  Monitor,
  Smartphone,
  Tablet,
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
  Share2,
  Check,
  RotateCcw,
  ChevronLeft,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const TemplatePreviewModal: React.FC = () => {
  const {
    selectedTemplatePreview,
    closeTemplatePreview,
    showToast,
    user,
    sessionToken,
    openAuth,
    openWebsiteEditor,
  } = useApp();
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [iframeKey, setIframeKey] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [changeSite,setChangeSite]=useState<WebsiteSiteRecord|null>(null);
  const [changeTarget,setChangeTarget]=useState('');

  const canvasRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(()=>{if(selectedTemplatePreview)trackWebsiteEvent('website_template_previewed',{templateId:selectedTemplatePreview.id,source:'builder'},sessionToken || undefined);},[selectedTemplatePreview?.id]);

  // Sync mobile screen detection
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 640;
      setIsMobileScreen(mobile);
      if (mobile && deviceView === 'desktop') {
        setDeviceView('mobile');
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update browser URL state for stable sharing and reload persistence
  useEffect(() => {
    if (!selectedTemplatePreview) return;
    try {
      const currentUrl = new URL(window.location.href);
      const targetQuery = selectedTemplatePreview.id;
      if (currentUrl.searchParams.get('template') !== targetQuery) {
        const newUrl = `/website-builder?template=${encodeURIComponent(targetQuery)}&preview=1`;
        window.history.replaceState({ templatePreview: targetQuery }, '', newUrl);
      }
    } catch {
      // Non-invasive URL update
    }
  }, [selectedTemplatePreview]);

  // Handle browser Back button (popstate)
  useEffect(() => {
    const handlePopState = () => {
      try {
        const currentUrl = new URL(window.location.href);
        if (!currentUrl.searchParams.has('template') && !currentUrl.pathname.includes('/template')) {
          closeTemplatePreview();
        }
      } catch {
        // fallback
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [closeTemplatePreview]);

  // Close preview and reset URL to /website-builder
  const handleClose = useCallback(() => {
    closeTemplatePreview();
    try {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.has('template') || currentUrl.pathname.includes('/template')) {
        window.history.replaceState(null, '', '/website-builder');
      }
    } catch {
      // ignore
    }
  }, [closeTemplatePreview]);

  const dialogRef=useDialogFocus(!!selectedTemplatePreview,handleClose);

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
      if (event.origin === window.location.origin && event.source === iframeRef.current?.contentWindow && event.data?.type === 'MYSTERYHUB_TEMPLATE_CTA') {
        handleStartBuilding();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedTemplatePreview]);

  if(changeSite&&sessionToken)return <WebsiteSettingsControls site={changeSite} token={sessionToken} requestedTemplateId={changeTarget} selectionOnly onClosed={()=>setChangeSite(null)} onDeleted={()=>setChangeSite(null)} onUpdated={updated=>{setChangeSite(null);openWebsiteEditor(updated);}}/>;
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

  const handleStartBuilding = async () => {
    handleClose();

    const doCreate = async (token: string) => {
      trackWebsiteEvent('website_build_started',{templateId:t.id,source:'builder'},token);
      try {
        const res = await createWebsiteOnServer(token, {
          templateId: t.id,
          name: t.demoBusinessName,
        });
        if (res.success && res.site) {
          if(res.alreadyExists&&res.site.template_id!==t.id){setChangeSite(res.site);setChangeTarget(t.id);closeTemplatePreview();return;}
          openWebsiteEditor(res.site);
          if (res.alreadyExists) {
            showToast('Opening your active website project.', 'info');
          } else {
            showToast(`Website project created from "${t.title}"!`, 'success');
          }
        }
      } catch (err: any) {
        showToast(err.message || 'Failed to initialize website project.', 'warning');
      }
    };

    if (user && sessionToken) {
      await doCreate(sessionToken);
    } else {
      openAuth(
        'signup',
        'Create your free Mystery Hub account to save and publish your website.',
        () => {
          const freshToken =
            localStorage.getItem('mystery_hub_session_token') ||
            sessionStorage.getItem('mystery_hub_session_token');
          if (freshToken) {
            doCreate(freshToken);
          }
        }
      );
    }
  };

  // Direct share action with native navigator.share or clipboard fallback
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/website-builder?template=${encodeURIComponent(t.id)}&preview=1`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${t.title} · Website Template Preview`,
          text: `Preview the ${t.title} website template on Mystery Hub (${t.demoBusinessName}):`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard if aborted or cancelled
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      showToast('Template preview link copied to clipboard!', 'success');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast('Failed to copy link. Please copy URL from browser address bar.', 'warning');
    }
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
        return <ShieldCheck className="w-3.5 h-3.5" />;
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
  const frameRenderedWidth = targetWidth * scale;

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Website template preview" className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-3 md:p-5 bg-black/95 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden">
      {/* Dynamic Ambient Background Glow customized to template colors */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20 blur-[140px] transition-colors duration-500"
        style={{
          background: `radial-gradient(circle at 50% 25%, ${palette.primary}, ${palette.secondary}, transparent 75%)`,
        }}
      />

      {/* Main Modal Container: Full Screen on Mobile, Windowed on Desktop */}
      <div className="relative w-full h-[100dvh] sm:h-[95vh] sm:max-w-7xl bg-[#0a0f14] border-0 sm:border border-slate-800 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 z-10">
        
        <p className="px-4 py-2 text-xs text-slate-300 bg-slate-900">Design preview · Sample content and interactions. Reservations and purchases are not submitted.</p>
        {/* =========================================================
            TOP CONTROL BAR: Clean, Aggressively Simplified
            - Mobile: [ Back ]  Template Name  [ Share ] [ Use ]
            - Desktop: LEFT (Identity) | CENTER (Viewport) | RIGHT (Share, Use, Close)
            ========================================================= */}
        <div className="px-3 sm:px-5 py-2 sm:py-2.5 bg-[#080d12] border-b border-slate-800/90 flex items-center justify-between gap-2 shrink-0 z-20">
          
          {/* MOBILE TOOLBAR (< sm) */}
          <div className="flex sm:hidden items-center justify-between w-full gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center gap-1 text-slate-300 hover:text-white px-2 py-1.5 rounded-lg bg-slate-800/60 active:scale-95 text-xs font-semibold shrink-0 cursor-pointer"
              aria-label="Back to Website Builder"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="min-w-0 flex-1 text-center px-1">
              <h3 className="font-bold text-xs text-white truncate">{t.title}</h3>
              <p className="text-[10px] text-slate-400 truncate">{t.categoryLabel}</p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleShare}
                className="p-2 text-slate-300 hover:text-white rounded-lg bg-slate-800/80 active:scale-95 border border-slate-700/60 cursor-pointer"
                title="Share Template"
                aria-label="Share Template"
              >
                {copiedLink ? <Check className="w-4 h-4 text-[#00c365]" /> : <Share2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={handleStartBuilding}
                className="px-3 py-1.5 rounded-lg bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-xs uppercase tracking-wider active:scale-95 flex items-center gap-1 cursor-pointer shadow-sm"
              >
                <span>Use</span>
              </button>
            </div>
          </div>

          {/* DESKTOP / TABLET TOOLBAR (sm+) */}
          <div className="hidden sm:flex items-center justify-between w-full gap-4">
            {/* LEFT: Template Identity */}
            <div className="flex items-center gap-3 min-w-0 max-w-sm">
              <span
                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: palette.secondary }}
              />
              <div className="leading-tight min-w-0 text-left">
                <h3 className="font-extrabold text-xs sm:text-sm text-white truncate max-w-xs">
                  {t.title}
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  {t.categoryLabel} · {t.industry}
                </p>
              </div>
            </div>

            {/* CENTER: Responsive Viewport Switcher */}
            <div className="flex items-center gap-1 bg-slate-900/95 p-1 rounded-xl border border-slate-800 shrink-0 shadow-inner">
              <button
                type="button"
                onClick={() => setDeviceView('desktop')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  deviceView === 'desktop'
                    ? 'bg-[#00c365] text-black font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                aria-label="Desktop Preview"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop</span>
              </button>

              <button
                type="button"
                onClick={() => setDeviceView('tablet')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  deviceView === 'tablet'
                    ? 'bg-[#00c365] text-black font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                aria-label="Tablet Preview"
              >
                <Tablet className="w-3.5 h-3.5" />
                <span>Tablet</span>
              </button>

              <button
                type="button"
                onClick={() => setDeviceView('mobile')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  deviceView === 'mobile'
                    ? 'bg-[#00c365] text-black font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                aria-label="Mobile Preview"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile</span>
              </button>
            </div>

            {/* RIGHT: Share, Use Template, Close */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleShare}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Share Template"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-[#00c365]" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Share'}</span>
              </button>

              <button
                type="button"
                onClick={handleStartBuilding}
                className="px-4 py-1.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,195,101,0.25)] active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Use Template</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close Preview"
                aria-label="Close Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
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
              height: deviceView === 'mobile' && scale >= 0.99 && availableHeight > 740 ? '700px' : '100%',
              maxHeight: '100%',
            }}
          >
            {/* Clean Realistic Browser Chrome */}
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
                  /sites/
                </span>
                <span
                  className="truncate font-semibold"
                  style={{ color: isDarkBackground ? '#f8fafc' : '#0f172a' }}
                >
                  {siteSlug}
                </span>
              </div>

              {/* Industry Icon & Reload */}
              <div className="flex items-center gap-2 text-[10px] shrink-0 font-medium">
                <button
                  type="button"
                  onClick={() => setIframeKey((k) => k + 1)}
                  className="hover:text-white flex items-center transition-colors cursor-pointer p-0.5"
                  title="Reload preview frame"
                  aria-label="Reload preview frame"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400 hover:text-white" />
                </button>
                <span style={{ color: palette.secondary }} className="hidden sm:inline">
                  {getIndustryIcon()}
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
                  ref={iframeRef}
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

        {/* =========================================================
            BOTTOM SALES FUNNEL STRIP
            - Subtly guides visitor to compare plans or explore Ultra
            - Does not overlay customer template body
            ========================================================= */}
        <div className="px-3 sm:px-5 py-2 bg-[#06090d] border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-xs text-slate-400 shrink-0 select-none">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs">
            <span className="text-slate-300 font-medium">Ready to launch your website in Ghana?</span>
            <span className="hidden md:inline text-slate-600">·</span>
            <span className="hidden md:inline text-slate-400">Launch free or upgrade as you scale.</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] sm:text-xs">
            <button
              type="button"
              onClick={() => {
                handleClose();
                setTimeout(() => {
                  const el = document.getElementById('plans');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }, 150);
              }}
              className="text-[#00c365] hover:underline font-semibold cursor-pointer"
            >
              Compare Studio Plans (From GH₵0)
            </button>
            <span className="text-slate-600">·</span>
            <button
              type="button"
              onClick={() => {
                handleClose();
                setTimeout(() => {
                  const el = document.getElementById('ultra-service');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }, 150);
              }}
              className="text-slate-300 hover:text-white cursor-pointer"
            >
              Need custom build? Explore Ultra
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
