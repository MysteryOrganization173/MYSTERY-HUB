import {useDialogFocus} from '../../hooks/useDialogFocus';
import { WebsiteSettingsControls } from './WebsiteSettingsControls';
import type { WebsiteSiteRecord } from '../../types';
import { trackWebsiteEvent } from '../../utils/websiteAnalytics';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { WebsiteStartSheet } from './WebsiteStartSheet';
import { websiteStarter } from '../../config/websiteStarters';
import { mergeSiteWithTemplate } from '../../utils/templateRendererUtils';
import type { SiteContent } from '../../types';
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
// V7.2.1: closing a design link keeps the gallery (the bare /website-builder opens an owner's My Business).
import { WEBSITE_DESIGNS_PATH } from '../../utils/businessWorkspace';

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
  const [previewName,setPreviewName]=useState('');
  const [starting,setStarting]=useState(false);
  const [noteOpen,setNoteOpen]=useState(false);
  // Gallery previews show the real starter a new owner receives, not the demonstration business.
  // Managed Data stores keep their existing catalogue preview (real bundles, no starter items).
  const starterTemplate = useMemo(() => {
    const t = selectedTemplatePreview;
    if (!t || t.siteContent || t.id === 'tmpl-data-reseller') return null;
    const starter = websiteStarter(t.id, previewName.trim() || 'Your business');
    return mergeSiteWithTemplate(t, starter.content as SiteContent, starter.settings);
  }, [selectedTemplatePreview, previewName]);
  const shownTemplate = selectedTemplatePreview?.siteContent ? selectedTemplatePreview : starterTemplate;
  const shownRef = useRef(shownTemplate); shownRef.current = shownTemplate;
  // Data Store keeps its labelled example catalogue in the gallery, so only the typed name is sent to the frame.
  const dataDemo = !!selectedTemplatePreview && !selectedTemplatePreview.siteContent && selectedTemplatePreview.id === 'tmpl-data-reseller';
  const namedPreview = !!starterTemplate || dataDemo;
  const nameRef = useRef(''); nameRef.current = dataDemo ? previewName.trim() : '';
  const sendPreviewName = () => { if (nameRef.current || dataDemo) iframeRef.current?.contentWindow?.postMessage({type:'MYSTERYHUB_PREVIEW_NAME',name:nameRef.current},window.location.origin); };
  useEffect(() => { if (dataDemo) sendPreviewName(); }, [dataDemo, previewName]);
  useEffect(() => { setPreviewName(''); setStarting(false); }, [selectedTemplatePreview?.id]);
  useEffect(() => {
    if (starterTemplate) iframeRef.current?.contentWindow?.postMessage({type:'MYSTERYHUB_PREVIEW_CONTENT',template:starterTemplate},window.location.origin);
  }, [starterTemplate]);

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

  // V5.1: the open preview is its own history entry, so a phone's Back button closes the preview and
  // returns to the gallery instead of leaving the Website Builder. The URL stays shareable.
  useEffect(() => {
    if (!selectedTemplatePreview) return;
    try {
      const url = selectedTemplatePreview.siteContent ? window.location.href : `/website-builder?template=${encodeURIComponent(selectedTemplatePreview.id)}&preview=1`;
      if (window.history.state?.mhPreview) window.history.replaceState({ ...window.history.state, templatePreview: selectedTemplatePreview.id }, '', url);
      // Where the preview was opened from, so an editor started here returns there (Builder V6).
      else window.history.pushState({ mhPreview: true, templatePreview: selectedTemplatePreview.id, mhPreviewFrom: window.location.pathname }, '', url);
    } catch {
      // Non-invasive URL update
    }
  }, [selectedTemplatePreview?.id, selectedTemplatePreview?.siteContent]);
  const cleanUrl = () => {
    try {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.has('template') || currentUrl.pathname.includes('/template')) window.history.replaceState(null, '', WEBSITE_DESIGNS_PATH);
    } catch {
      // ignore
    }
  };

  // Browser Back: leaving the preview's history entry closes it.
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.mhPreview) return;
      closeTemplatePreview(); cleanUrl();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [closeTemplatePreview]);

  // Close preview and reset URL to /website-builder
  const handleClose = useCallback(() => {
    closeTemplatePreview();
    // Step back over the preview's own history entry, so Back later does not reopen it.
    if (window.history.state?.mhPreview) window.history.back();
    else cleanUrl();
  }, [closeTemplatePreview]);

  // While the preview is open the gallery underneath stops painting its live thumbnails: they are
  // full websites with sticky bars and blurred headers, and nothing of them may show around the preview.
  useEffect(() => {
    if (!selectedTemplatePreview) return;
    document.documentElement.classList.add('mh-preview-open');
    return () => document.documentElement.classList.remove('mh-preview-open');
  }, [!!selectedTemplatePreview]);

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
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      if (selectedTemplatePreview && event.data?.type === 'MYSTERYHUB_TEMPLATE_LOADED' && event.data.templateId === selectedTemplatePreview.id && shownRef.current) {
        iframeRef.current?.contentWindow?.postMessage({type:'MYSTERYHUB_PREVIEW_CONTENT',template:shownRef.current,siteId:selectedTemplatePreview.previewSiteId},window.location.origin);
      }
      if (selectedTemplatePreview && event.data?.type === 'MYSTERYHUB_TEMPLATE_LOADED' && event.data.templateId === selectedTemplatePreview.id && nameRef.current) sendPreviewName();
      if (event.data?.type === 'MYSTERYHUB_PREVIEW_CLOSE') handleClose();
      if (event.data?.type === 'MYSTERYHUB_TEMPLATE_CTA') {
        if (selectedTemplatePreview?.siteContent) showToast('Preview only. Open your published website to contact the business.', 'info');
        else void handleStartBuilding();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedTemplatePreview]);

  const startSheet = starting && selectedTemplatePreview ? <WebsiteStartSheet templateId={selectedTemplatePreview.id} initialName={previewName.trim()} onClose={()=>setStarting(false)} onCreated={(site,alreadyExists,requested)=>{setStarting(false);
    // An owner who already has a website on another design is offered the change, never switched silently.
    if(alreadyExists&&site.template_id!==requested){setChangeSite(site);setChangeTarget(requested);return;}
    // Builder V6: the editor's address takes the preview's history entry (Back returns to the gallery).
    openWebsiteEditor(site,{created:!alreadyExists});showToast(alreadyExists?'Opening your existing website.':'Your website is ready. Tap anything to change it.',alreadyExists?'info':'success');}}/> : null;
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
    if (t.siteContent) { handleClose(); return; }
    // An owner who already has a website changes design instead of creating a second one.
    if (user && sessionToken) {
      try {
        const {getMyWebsitesOnServer} = await import('../../services/apiClient');
        const mine = (await getMyWebsitesOnServer(sessionToken)).sites || [];
        if (mine[0]) {
          if (mine[0].template_id !== t.id) { handleClose(); setChangeSite(mine[0]); setChangeTarget(t.id); }
          else { openWebsiteEditor(mine[0]); showToast('Opening your website.', 'info'); }
          return;
        }
      } catch { /* Fall through: the server still refuses a second website. */ }
    }
    setStarting(true);
  };

  // Direct share action with native navigator.share or clipboard fallback
  const handleShare = async () => {
    if (t.siteContent) return; // Private drafts never receive a shareable content URL.
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
      case 'nightkitchen':
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
      case 'boutique':
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

  // V7.4: on a phone the preview IS the phone. The website renders at the screen's real width (no
  // scaled 375px mock-up, no simulated browser), so what the owner sees is what their customers get.
  const phone = isMobileScreen;
  const availableWidth = canvasDimensions.width || (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const availableHeight = canvasDimensions.height || 600;
  const targetWidth = phone ? Math.max(280, Math.round(availableWidth)) : deviceView === 'mobile' ? 375 : deviceView === 'tablet' ? 768 : 1280;

  // Margin buffer for comfortable framing (desktop and tablet keep a framed device).
  const marginX = phone ? 0 : deviceView === 'desktop' ? 32 : 24;
  const usableWidth = Math.max(280, availableWidth - marginX);

  // Scaling factor: 1.0 on large screens, scaled down cleanly on smaller physical screens
  const scale = phone ? 1 : Math.min(1, usableWidth / targetWidth);
  const frameRenderedWidth = targetWidth * scale;
  const previewNote = t.siteContent ? 'Your website preview · Saved content. Preview actions do not place orders or bookings.' : dataDemo ? 'This is how your store starts. Bundles and prices here are examples: after creating it, you choose your bundles and set your own prices.' : starterTemplate ? `This is exactly how your website starts.${starterTemplate.items?.length ? ' Items marked Example are there for you to edit, keep or remove.' : ''}` : 'Design preview · Sample content and interactions. Reservations and purchases are not submitted.';
  const shortNote = t.siteContent ? 'Your saved website' : dataDemo ? 'Example bundles and prices' : starterTemplate ? 'Example content' : 'Sample content';

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Website template preview" className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-3 md:p-5 bg-[#05080c] animate-in fade-in duration-200 overflow-hidden overscroll-contain" data-template-preview data-preview-phone={phone ? '' : undefined}>
      {/* Dynamic Ambient Background Glow customized to template colors */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20 blur-[140px] transition-colors duration-500 hidden sm:block"
        style={{
          background: `radial-gradient(circle at 50% 25%, ${palette.primary}, ${palette.secondary}, transparent 75%)`,
        }}
      />

      {/* Main Modal Container: Full Screen on Mobile, Windowed on Desktop */}
      {/* Fills the fixed overlay exactly (not 100dvh, which can differ from it while Android's address bar moves). */}
      <div className="relative w-full h-full sm:h-[95vh] sm:max-w-7xl bg-[#0a0f14] border-0 sm:border border-slate-800 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 z-10">

        {startSheet}
        <p className="hidden sm:block px-4 py-1.5 text-xs text-slate-300 bg-slate-900">{previewNote}</p>
        {/* =========================================================
            TOP CONTROL BAR
            - Phone: one slim row [ Back ] Name · what you are seeing (tap for more) [ Share ]
              The full explanation opens on demand, so the website keeps the screen.
            - Desktop: LEFT (Identity) | CENTER (Viewport) | RIGHT (Share, Use, Close)
            ========================================================= */}
        <div className="tpv-bar px-2 sm:px-5 py-1.5 sm:py-2.5 bg-[#080d12] border-b border-slate-800/90 flex items-center justify-between gap-2 shrink-0 z-20">

          {/* MOBILE TOOLBAR (< sm) */}
          <div className="flex sm:hidden items-center justify-between w-full gap-1.5">
            <button
              type="button"
              onClick={handleClose}
              className="tpv-icon flex items-center gap-0.5 text-slate-200 pl-1.5 pr-2.5 rounded-xl bg-slate-800/70 active:scale-95 text-sm font-semibold shrink-0 cursor-pointer"
              aria-label="Back to designs"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              <span>Back</span>
            </button>

            <div className="min-w-0 flex-1 px-1 leading-tight">
              <h2 data-autofocus tabIndex={-1} className="font-bold text-[13px] text-white truncate outline-none">{t.title}</h2>
              <button type="button" onClick={() => setNoteOpen(open => !open)} aria-expanded={noteOpen} aria-controls="tpv-note" className="tpv-note-toggle text-[11px] text-slate-400 truncate max-w-full text-left">
                {shortNote} · <span className="underline underline-offset-2">{noteOpen ? 'Hide' : 'About'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={!!t.siteContent}
                onClick={handleShare}
                className="tpv-icon grid place-items-center text-slate-300 hover:text-white rounded-xl bg-slate-800/80 active:scale-95 border border-slate-700/60 cursor-pointer disabled:opacity-40"
                title="Share this design"
                aria-label="Share this design"
              >
                {copiedLink ? <Check className="w-4 h-4 text-[#00c365]" /> : <Share2 className="w-4 h-4" />}
              </button>

              {/* With the name bar below, its button is the one way to use the design; otherwise it lives here. */}
              {!namedPreview && <button
                type="button"
                onClick={handleStartBuilding}
                className="tpv-icon px-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-sm active:scale-95 flex items-center gap-1 cursor-pointer shadow-sm"
              >
                <span>{t.siteContent ? 'Done' : 'Use'}</span>
              </button>}
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
                <h3 data-autofocus tabIndex={-1} className="font-extrabold text-xs sm:text-sm text-white truncate max-w-xs outline-none">
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
                disabled={!!t.siteContent}
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
                <span>{t.siteContent ? 'Done' : 'Use Template'}</span>
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
        {noteOpen && <p id="tpv-note" className="sm:hidden px-3 py-2 text-xs leading-relaxed text-slate-200 bg-slate-900 border-b border-slate-800">{previewNote}</p>}

        {/* =========================================================
            DYNAMIC CANVAS CONTAINER: Isolated Scaled iframe Viewport
            ========================================================= */}
        <div
          ref={canvasRef}
          className="flex-1 min-h-0 bg-[#05080c] p-0 sm:p-4 overflow-hidden flex flex-col items-center justify-center relative"
        >
          {/* Framed Device Mockup Container (a phone shows the website edge to edge, without a frame) */}
          <div
            className={`flex flex-col overflow-hidden bg-[#0d1319] transition-all duration-300 relative ${phone ? '' : 'rounded-2xl border border-slate-800 shadow-2xl'}`}
            style={{
              width: phone ? '100%' : `${frameRenderedWidth}px`,
              maxWidth: '100%',
              height: !phone && deviceView === 'mobile' && scale >= 0.99 && availableHeight > 740 ? '700px' : '100%',
              maxHeight: '100%',
            }}
          >
            {/* Clean Realistic Browser Chrome (desktop and tablet views only) */}
            {!phone && <div
              className="border-b px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs shrink-0 select-none z-10"
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
                  {t.siteContent ? 'Preview' : '/sites/'}
                </span>
                <span
                  className="truncate font-semibold"
                  style={{ color: isDarkBackground ? '#f8fafc' : '#0f172a' }}
                >
                  {t.siteContent ? t.demoBusinessName : namedPreview ? (previewName.trim() || 'your-business').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,24) || 'your-business' : siteSlug}
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
            </div>}

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
                  src={`/?isolated_template_preview=${encodeURIComponent(t.id)}${shownTemplate ? '&owner_preview=1' : ''}`}
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
        {namedPreview ? <form className="website-preview-namebar" onSubmit={event=>{event.preventDefault();void handleStartBuilding();}}>
          <label className="sr-only" htmlFor="website-preview-name">Your business name</label>
          <input id="website-preview-name" value={previewName} maxLength={100} onChange={event=>setPreviewName(event.target.value.replace(/[<>]/g,''))} placeholder="Type your business name to see it" autoComplete="organization" enterKeyHint="go"/>
          <button type="submit">Use this design<ArrowRight className="w-4 h-4" aria-hidden="true"/></button>
        </form> :
        <div className="hidden sm:flex px-3 sm:px-5 py-2 bg-[#06090d] border-t border-slate-800/80 flex-col sm:flex-row items-center justify-between gap-1.5 text-xs text-slate-400 shrink-0 select-none">
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
                  const el = document.getElementById('plans-pricing');
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
        </div>}
      </div>
    </div>
  );
};
