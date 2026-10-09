import { WebsiteBusinessDashboard } from './WebsiteBusinessDashboard';
import { WebsiteSettingsControls } from './WebsiteSettingsControls';
import { trackWebsiteEvent } from '../../utils/websiteAnalytics';
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { TEMPLATE_CATEGORIES, WEBSITE_TEMPLATES, orderedWebsiteTemplates } from '../../data/templates';
import { TemplateCategory, WebsiteSiteRecord, WebsiteTemplate } from '../../types';
import { TemplateCardPreview } from './TemplateCardPreview';
import { WebsiteEditor } from './editor/WebsiteEditor';
import { WebsitePlansAndUltra } from './WebsitePlansAndUltra';
import { mergeSiteWithTemplate } from '../../utils/templateRendererUtils';
import {
  getMyWebsitesOnServer,
  createWebsiteOnServer,
  publishWebsiteOnServer,
  unpublishWebsiteOnServer,
} from '../../services/apiClient';
import {
  Globe,
  Sparkles,
  Smartphone,
  Eye,
  ArrowRight,
  Zap,
  Layout,
  Search,
  Copy,
  Compass,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  Settings,
} from 'lucide-react';

export const WebsiteBuilderPage: React.FC = () => {
  const {
    openTemplatePreview,
    showToast,
    user,
    sessionToken,
    openAuth,
    activeEditorSite,
    openWebsiteEditor,
    closeWebsiteEditor,
  } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [mySites, setMySites] = useState<WebsiteSiteRecord[]>([]);
  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [siteFetchError, setSiteFetchError] = useState<string | null>(null);
  const [actionLoadingSiteId, setActionLoadingSiteId] = useState<string | null>(null);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [changeTarget,setChangeTarget]=useState('');
  const [pricingDirty,setPricingDirty]=useState(false);
  const confirmPricingLeave=()=>!pricingDirty||window.confirm('You have unsaved bundle prices. Leave without saving them?');
  const editSite=(site:WebsiteSiteRecord)=>{if(confirmPricingLeave()){setPricingDirty(false);openWebsiteEditor(site);}};
  const [dashboardTab, setDashboardTab] = useState('Overview');
  const openPricing = () => { setDashboardTab('Bundles & Pricing'); closeWebsiteEditor(); requestAnimationFrame(() => document.getElementById('website-business-dashboard')?.scrollIntoView({block:'start'})); };
  const updateSite = (updated: WebsiteSiteRecord) => {
    setMySites(prev => prev.map(site => site.id === updated.id ? updated : site));
    if (activeEditorSite?.id === updated.id && activeEditorSite.template_id !== updated.template_id) openWebsiteEditor(updated);
  };

  // A switch started in the global template preview must also update the owner dashboard.
  useEffect(()=>{if(activeEditorSite)setMySites(prev=>prev.map(site=>site.id===activeEditorSite.id?activeEditorSite:site));},[activeEditorSite]);

  useEffect(() => { trackWebsiteEvent('website_builder_viewed', {source:'builder'}, sessionToken || undefined); }, [sessionToken]);

  // Load authenticated user's sites
  useEffect(() => {
    if (sessionToken) {
      setIsLoadingSites(true);
      setSiteFetchError(null);
      getMyWebsitesOnServer(sessionToken)
        .then((res) => {
          if (res.success) {
            setMySites(res.sites || []);
          }
        })
        .catch((err: any) => {
          console.warn('[WebsiteBuilder] Failed loading user sites:', err);
          setSiteFetchError(err.message || 'Unable to connect to website services. Please try again.');
        })
        .finally(() => {
          setIsLoadingSites(false);
        });
    } else {
      setMySites([]);
      setSiteFetchError(null);
    }
  }, [sessionToken]);

  // Deep-link template preview support (e.g. /website-builder?template=tmpl-quickbyte-data)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const queryTemplate = url.searchParams.get('template') || url.searchParams.get('t');

      let targetId = queryTemplate;
      if (!targetId) {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (
          pathParts.length >= 3 &&
          (pathParts[0] === 'website-builder' || pathParts[0] === 'website') &&
          (pathParts[1] === 'template' || pathParts[1] === 'templates')
        ) {
          targetId = pathParts[2];
        }
      }

      if (targetId) {
        const cleanId = targetId.toLowerCase().trim();
        const found = WEBSITE_TEMPLATES.find(
          (t) =>
            t.id.toLowerCase() === cleanId ||
            t.id.replace(/^tmpl-/, '').toLowerCase() === cleanId ||
            t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') === cleanId
        );
        if (found) {
          openTemplatePreview(found);
        }
      }
    } catch {
      // Graceful fallback
    }
  }, [openTemplatePreview]);

  const activeSite = mySites.length > 0 ? mySites[0] : null;

  // Base template definition for the user's active site
  const activeBaseTemplate = activeSite
    ? WEBSITE_TEMPLATES.find((t) => t.id === activeSite.template_id) || WEBSITE_TEMPLATES[0]
    : null;

  // Merged template with user's customized content and styling
  const activeMergedTemplate: WebsiteTemplate | null =
    activeSite && activeBaseTemplate
      ? mergeSiteWithTemplate(activeBaseTemplate, activeSite.content_json, activeSite.settings_json)
      : null;

  const filteredTemplates = orderedWebsiteTemplates().filter((t) => {
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.demoBusinessName.toLowerCase().includes(q) ||
      t.industry.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.features.some((f) => f.toLowerCase().includes(q))
    );
  });

  const isFiltering = selectedCategory !== 'all' || searchQuery.trim().length > 0;
  const displayedTemplates = isFiltering || showAllTemplates ? filteredTemplates : filteredTemplates.slice(0, 6);

  const handleCreateSite = async (templateId: string, templateName?: string) => {
    if(activeSite && activeSite.template_id!==templateId){if(!confirmPricingLeave())return;setChangeTarget(templateId);return;}
    const doCreate = async (token: string) => {
      trackWebsiteEvent('website_build_started', {templateId,source:'builder'}, token);
      try {
        const res = await createWebsiteOnServer(token, {
          templateId,
          name: 'My Business',
        });

        if (res.success && res.site) {
          if (res.alreadyExists) {
            showToast('Opening your website.', 'info');
          } else {
            setMySites([res.site]);
            showToast('Your website is ready to personalise.', 'success');
          }
          openWebsiteEditor(res.site);
        }
      } catch (err: any) {
        showToast(err.message || 'We couldn’t create your website. Please try again.', 'warning');
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

  const handlePrimaryHeroAction = () => {
    if (activeSite) {
      openWebsiteEditor(activeSite);
      return;
    }

    if (!user) {
      openAuth(
        'signup',
        'Create your free Mystery Hub account to save and publish your website.',
        () => {
          const el = document.getElementById('templates-showcase');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
      );
      return;
    }

    const el = document.getElementById('templates-showcase');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToPlans = () => {
    const el = document.getElementById('plans');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTemplates = () => {
    const el = document.getElementById('templates-showcase');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTogglePublish = async (site: WebsiteSiteRecord) => {
    if (!sessionToken) return;
    setActionLoadingSiteId(site.id);
    try {
      if (site.status === 'published') {
        const res = await unpublishWebsiteOnServer(sessionToken, site.id);
        if (res.success && res.site) {
          setMySites((prev) => prev.map((s) => (s.id === res.site.id ? res.site : s)));
          showToast('Your website is now a draft and is no longer public.', 'info');
        }
      } else {
        const res = await publishWebsiteOnServer(sessionToken, site.id);
        if (res.success && res.site) {
          setMySites((prev) => prev.map((s) => (s.id === res.site.id ? res.site : s)));
          showToast(`Website published! Live at /sites/${res.site.slug}`, 'success');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Action failed.', 'warning');
    } finally {
      setActionLoadingSiteId(null);
    }
  };

  const handleCopyLink = (slug: string) => {
    const fullUrl = `${window.location.origin}/sites/${slug}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      showToast('Website link copied to clipboard!', 'success');
    });
  };

  const handlePreviewCurrentSite = () => {
    if (activeMergedTemplate) {
      openTemplatePreview(activeMergedTemplate);
    } else if (activeBaseTemplate) {
      openTemplatePreview(activeBaseTemplate);
    }
  };

  // If currently inside the full-screen Website Editor workspace
  if (activeEditorSite && sessionToken) {
    return (
      <WebsiteEditor
        key={`${activeEditorSite.id}:${activeEditorSite.template_id}`}
        site={activeEditorSite}
        onOpenPricing={openPricing}
        sessionToken={sessionToken}
        onClose={closeWebsiteEditor}
        onSiteUpdated={updateSite}
        showToast={showToast}
      />
    );
  }

  const isPublished = activeSite?.status === 'published';
  const displaySiteName =
    activeSite?.content_json?.businessName || activeSite?.name || 'My Business Website';
  const publicSiteUrl = activeSite
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/sites/${activeSite.slug}`
    : '';

  return (
    <div className="py-6 sm:py-10 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">

        {activeSite&&sessionToken&&changeTarget&&<WebsiteSettingsControls site={activeSite} token={sessionToken} requestedTemplateId={changeTarget} selectionOnly onClosed={()=>setChangeTarget('')} onDeleted={()=>setMySites([])} onUpdated={updated=>{setMySites([updated]);setChangeTarget('');openWebsiteEditor(updated);}}/>}
        {/* =========================================================
            LOADING / ERROR STATE FOR AUTHENTICATED USERS
            ========================================================= */}
        {user && isLoadingSites && (
          <div className="p-8 rounded-3xl bg-[#0d141b] border border-slate-800 text-center space-y-3 animate-pulse">
            <RefreshCw className="w-6 h-6 text-[#00c365] animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-300">Loading your website…</p>
          </div>
        )}

        {user && !isLoadingSites && siteFetchError && (
          <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3 text-left text-xs">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-300">Dashboard notice</span>
              <p>{siteFetchError}</p>
            </div>
          </div>
        )}

        {/* =========================================================
            1. AUTHENTICATED USER'S "MY WEBSITE" MANAGEMENT DASHBOARD
               (PRIORITIZED FOR LOGGED-IN USERS WITH AN ACTIVE WEBSITE)
            ========================================================= */}
        {user && !isLoadingSites && activeSite ? (
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-800 bg-[#0b131a] p-4 sm:p-6 space-y-4 text-left">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-slate-400 mb-1">My business website · Free plan</p><h1 className="text-2xl sm:text-3xl font-bold break-words">{displaySiteName}</h1><p className="text-sm text-slate-400 break-all mt-1">{publicSiteUrl}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${isPublished?'bg-emerald-500/15 text-emerald-300':'bg-amber-500/15 text-amber-200'}`}>{isPublished?'Live':'Draft'}</span></div>
              <div className="flex flex-wrap gap-2">
                <button className="min-h-11 rounded-xl px-4 bg-emerald-500 text-black font-bold text-sm" onClick={()=>editSite(activeSite)}>Edit Website</button>
                {isPublished?<a className="min-h-11 inline-flex items-center rounded-xl px-4 border border-slate-700 text-sm" href={`/sites/${encodeURIComponent(activeSite.slug)}`} target="_blank" rel="noopener noreferrer">View Site</a>:<button className="min-h-11 rounded-xl px-4 border border-slate-700 text-sm" onClick={handlePreviewCurrentSite}>Preview</button>}
                {isPublished&&<button className="min-h-11 rounded-xl px-3 border border-slate-700 text-sm" onClick={()=>handleCopyLink(activeSite.slug)}>Copy Link</button>}
                <button disabled={actionLoadingSiteId===activeSite.id} className="min-h-11 rounded-xl px-3 border border-slate-700 text-sm disabled:opacity-50" onClick={()=>void handleTogglePublish(activeSite)}>{actionLoadingSiteId===activeSite.id?'Updating…':isPublished?'Unpublish':'Publish'}</button>
              </div>
              {activeSite.template_id==='tmpl-data-reseller'&&<div className="flex flex-wrap gap-3 text-sm"><button className="min-h-11 text-emerald-300" onClick={()=>setDashboardTab('Orders')}>Manage Orders</button><button className="min-h-11 text-emerald-300" onClick={()=>setDashboardTab('Bundles & Pricing')}>Bundles &amp; Pricing</button></div>}
            </section>
            <WebsiteBusinessDashboard site={activeSite} token={sessionToken!} requestedTab={dashboardTab} onTabChange={setDashboardTab} onEdit={()=>editSite(activeSite)} onPricingDirty={setPricingDirty} onPreview={handlePreviewCurrentSite} onSettings={()=>{setShowSettingsDrawer(true);requestAnimationFrame(()=>document.getElementById('website-settings')?.scrollIntoView({block:'start'}));}}/>
            {showSettingsDrawer&&<section id="website-settings" className="scroll-mt-24 rounded-2xl border border-slate-800 bg-[#0b131a] p-4 text-left space-y-3"><div className="flex items-center justify-between"><h2 className="font-bold">Website settings</h2><button className="min-h-11 px-3 text-sm" onClick={()=>setShowSettingsDrawer(false)}>Close settings</button></div><p className="text-sm text-slate-400">Current design: {activeBaseTemplate?.title}. Your site address stays the same when you change design.</p><WebsiteSettingsControls site={activeSite} token={sessionToken!} onUpdated={updated=>{updateSite(updated);setShowSettingsDrawer(false);openWebsiteEditor(updated);}} onDeleted={()=>{setMySites([]);setShowSettingsDrawer(false);showToast('Website deleted. You can create a new Free website.','success');}}/></section>}
          </div>
        ) : (
          /* =========================================================
             2. HERO SECTION FOR VISITORS & USERS WITHOUT A WEBSITE
             ========================================================= */
          <div className="relative rounded-3xl bg-[#08100d] border border-slate-800/80 p-6 sm:p-12 lg:p-16 overflow-hidden shadow-2xl">
            {/* Backdrop Artwork Layer */}
            <div
              className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0"
              aria-hidden="true"
              role="presentation"
            >
              <picture>
                <source
                  media="(max-width: 767px)"
                  srcSet="https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_800,c_fill,g_east/v1790789160/ChatGPT_Image_Sep_30_2026_05_25_38_PM_bbopws.png 800w"
                  sizes="100vw"
                />
                <source
                  media="(max-width: 1023px)"
                  srcSet="https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_1200,c_fill,g_east/v1790789160/ChatGPT_Image_Sep_30_2026_05_25_38_PM_bbopws.png 1200w"
                  sizes="100vw"
                />
                <img
                  src="https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_1600/v1790789160/ChatGPT_Image_Sep_30_2026_05_25_38_PM_bbopws.png"
                  srcSet="https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_1280/v1790789160/ChatGPT_Image_Sep_30_2026_05_25_38_PM_bbopws.png 1280w,
                          https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_1600/v1790789160/ChatGPT_Image_Sep_30_2026_05_25_38_PM_bbopws.png 1600w"
                  sizes="100vw"
                  alt=""
                  fetchPriority="high"
                  loading="eager"
                  decoding="async"
                  className="w-full h-full object-cover object-[92%_top] sm:object-[88%_center] lg:object-right opacity-80 sm:opacity-85 lg:opacity-90"
                />
              </picture>

              <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#08100d] via-[#08100d]/85 to-transparent from-0% via-42% to-75%" />
              <div className="lg:hidden absolute inset-0 bg-gradient-to-r from-[#08100d]/95 via-[#08100d]/70 to-[#08100d]/25 from-0% via-48% to-100%" />
              <div className="lg:hidden absolute inset-0 bg-gradient-to-b from-[#08100d]/30 via-transparent to-[#08100d] from-0% via-60% to-98%" />
            </div>

            <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00c365]/15 rounded-full blur-[100px] pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
              <div className="lg:col-span-7 space-y-6 text-left">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/30 text-xs font-semibold text-[#00c365]">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Mystery Hub Website Builder</span>
                </div>

                {/* Headline */}
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
                  Build a Professional Website for Free
                </h1>

                {/* Subheadline */}
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg">
                  Pick a design, add your business details and photos, then publish for free. No coding needed.
                </p>

                {/* Supporting Benefits */}
                <div className="grid grid-cols-2 gap-2 max-w-md pt-1 text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[#00c365] font-bold">✓</span>
                    <span>Start free</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#00c365] font-bold">✓</span>
                    <span>No coding required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#00c365] font-bold">✓</span>
                    <span>Mobile responsive</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#00c365] font-bold">✓</span>
                    <span>Built for Ghanaian businesses</span>
                  </div>
                </div>

                {/* CTAs */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePrimaryHeroAction}
                    className="px-6 py-3.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,195,101,0.35)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Create My Free Website</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={scrollToPlans}
                    className="px-6 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700/80 transition-colors flex items-center justify-center gap-2 backdrop-blur-sm cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-[#00c365]" />
                    <span>View Plans</span>
                  </button>
                </div>
              </div>

              <div className="hidden lg:block lg:col-span-5 pointer-events-none min-h-[380px]" aria-hidden="true" />
            </div>
          </div>
        )}

        {/* =========================================================
            3. COMPACT TRUST / VALUE STRIP (For Visitors)
            ========================================================= */}
        {(!user || !activeSite) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="p-5 sm:p-6 rounded-2xl bg-[#0f151b] border border-slate-800/80 space-y-2.5 text-left">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00c365]">
                <Smartphone className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm sm:text-base text-white">Made for Ghanaian Businesses</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose a design for your business, then make it yours with your own colors, photos and contact details.
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-[#0f151b] border border-slate-800/80 space-y-2.5 text-left">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm sm:text-base text-white">Customer Enquiries on WhatsApp</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Let customers contact your business through WhatsApp links on your website.
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-[#0f151b] border border-slate-800/80 space-y-2.5 text-left">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Layout className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm sm:text-base text-white">13+ Handcrafted Designs</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Browse designs for data resellers, agencies, salons, restaurants, churches and more.
              </p>
            </div>
          </div>
        )}

        {/* =========================================================
            4. PLANS / PRICING & ULTRA PREMIER SERVICE
            ========================================================= */}
        <details id="plans" open={!activeSite} className="scroll-mt-20"><summary className="min-h-11 cursor-pointer text-sm text-slate-400">Website plans &amp; services</summary>
          <WebsitePlansAndUltra
            sessionToken={sessionToken || undefined}
            onStartBlank={() => handleCreateSite('tmpl-start-blank', 'My Business')}
          />
        </details>

        {/* =========================================================
            5. TEMPLATES SHOWCASE / DESIGN DISCOVERY SECTION
               (REFRAMED AS "EXPLORE OTHER DESIGNS" FOR WEBSITE OWNERS)
            ========================================================= */}
        <div id="templates-showcase" className="space-y-6 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00c365] uppercase tracking-wider mb-1">
                <Compass className="w-3.5 h-3.5" />
                <span>{activeSite ? 'Explore Other Designs' : 'Handcrafted Website Templates'}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {activeSite
                  ? isFiltering
                    ? 'Matching Design Templates'
                    : 'Explore Design Inspirations'
                  : isFiltering
                  ? 'Matching Industry Templates'
                  : 'Featured Industry Templates'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {activeSite
                  ? 'Choose a design to review what stays and what resets before switching.'
                  : 'Click "Preview" to test on any device or "Use" to create your free website immediately.'}
              </p>
            </div>

            {/* Search Input Bar */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates (e.g. data, restaurant)..."
                className="w-full bg-[#10171f] border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 active:scale-95 ${
                  selectedCategory === cat.id
                    ? 'bg-[#00c365] text-black font-bold shadow-[0_0_12px_rgba(0,195,101,0.35)] scale-[1.02]'
                    : 'bg-[#10171f] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Result Count Indicator & Expand Toggle */}
          <div className="text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>
              Showing <strong>{displayedTemplates.length}</strong> of{' '}
              <strong>{filteredTemplates.length}</strong> template{filteredTemplates.length === 1 ? '' : 's'}
              {searchQuery && ` matching "${searchQuery}"`}
            </span>

            <div className="flex items-center gap-3">
              {selectedCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="text-[#00c365] hover:underline cursor-pointer"
                >
                  Clear category filter
                </button>
              )}

              {!isFiltering && filteredTemplates.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllTemplates((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00c365] hover:text-[#00e575] transition-colors cursor-pointer"
                >
                  <span>{showAllTemplates ? 'Show Top 6 Featured' : `View All ${filteredTemplates.length} Templates`}</span>
                  {showAllTemplates ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          {/* Templates Cards Grid */}
          {filteredTemplates.length === 0 ? (
            <div className="p-12 text-center bg-[#0d1217] rounded-3xl border border-slate-800 space-y-3">
              <p className="text-slate-400 text-sm">No templates matched your search.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {displayedTemplates.map((t) => (
                <TemplateCardPreview
                  key={t.id}
                  template={t}
                  onPreview={() => openTemplatePreview(t)}
                  onUseTemplate={() => handleCreateSite(t.id, t.demoBusinessName)}
                />
              ))}
            </div>
          )}

          {/* Expand/Collapse Footer Action for Featured Templates */}
          {!isFiltering && filteredTemplates.length > 6 && (
            <div className="pt-4 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setShowAllTemplates((prev) => !prev);
                  if (showAllTemplates) {
                    scrollToTemplates();
                  }
                }}
                className="px-6 py-3 rounded-2xl bg-[#0f171e] hover:bg-[#15202a] text-slate-200 border border-slate-700/80 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md hover:border-[#00c365]/40"
              >
                <span>{showAllTemplates ? 'Show Fewer Templates' : `View All ${filteredTemplates.length} Templates`}</span>
                {showAllTemplates ? <ChevronUp className="w-4 h-4 text-[#00c365]" /> : <ChevronDown className="w-4 h-4 text-[#00c365]" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
