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
import { SafeImage } from './SafeImage';
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
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layout,
  Search,
  ExternalLink,
  Copy,
  Edit3,
  Compass,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sliders,
  AlertCircle,
  Clock,
  Settings,
  Lock,
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
  const [dashboardTab, setDashboardTab] = useState('Overview');
  const openPricing = () => { setDashboardTab('Bundles & Pricing'); closeWebsiteEditor(); requestAnimationFrame(() => document.getElementById('website-business-dashboard')?.scrollIntoView({block:'start'})); };
  const updateSite = (updated: WebsiteSiteRecord) => {
    setMySites(prev => prev.map(site => site.id === updated.id ? updated : site));
    if (activeEditorSite?.id === updated.id && activeEditorSite.template_id !== updated.template_id) openWebsiteEditor(updated);
  };

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
    if(activeSite && activeSite.template_id!==templateId){setChangeTarget(templateId);return;}
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
        showToast(err.message || 'Failed to create website project.', 'warning');
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
          showToast('Website unpublished (reverted to draft mode).', 'info');
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
  const displayTagline =
    activeSite?.content_json?.tagline || activeBaseTemplate?.demoHeroTagline || 'Welcome to our official website';
  const displayHeroImage =
    activeSite?.content_json?.heroImage || activeBaseTemplate?.heroImage || '';
  const displayUpdatedDate = activeSite
    ? new Date(activeSite.updated_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';
  const publicSiteUrl = activeSite
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/sites/${activeSite.slug}`
    : '';

  return (
    <div className="py-6 sm:py-10 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {activeSite&&sessionToken&&<WebsiteBusinessDashboard site={activeSite} token={sessionToken} requestedTab={dashboardTab} onTabChange={setDashboardTab} onEdit={()=>openWebsiteEditor(activeSite)} onSettings={()=>{setShowSettingsDrawer(true);requestAnimationFrame(()=>document.getElementById('website-settings')?.scrollIntoView({block:'start'}));}}/>}
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
          <div className="space-y-6">
            {/* Top Identity & Overview Bar */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#0e161f] to-[#0a1016] border border-slate-800/90 shadow-2xl space-y-6 text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[#00c365]/5 rounded-full blur-[90px] pointer-events-none" />

              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/30 text-xs font-bold text-[#00c365] uppercase tracking-wider">
                      <Globe className="w-3.5 h-3.5 text-[#00c365]" />
                      <span>My Website</span>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/80">
                      <ShieldCheck className="w-3 h-3 text-[#00c365]" />
                      <span>Free Plan</span>
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        isPublished
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isPublished ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                        }`}
                      />
                      <span>{isPublished ? 'Live' : 'Draft'}</span>
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight break-words">
                    {displaySiteName}
                  </h1>

                  <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap pt-0.5">
                    <span>
                      Template:{' '}
                      <strong className="text-slate-200 font-semibold">
                        {activeBaseTemplate?.title || 'Custom Layout'}
                      </strong>
                    </span>
                    <span className="text-slate-700">·</span>
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>Updated {displayUpdatedDate}</span>
                    </span>
                  </div>
                </div>

                {/* Primary CTA (Desktop & Mobile Top Anchor) */}
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => openWebsiteEditor(activeSite)}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,195,101,0.35)] flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Edit3 className="w-4 h-4 stroke-[2.5]" />
                    <span>Edit Website</span>
                  </button>
                </div>
              </div>

              {/* 2-Column Responsive Dashboard Body */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* 1. LEFT COLUMN: VISUAL WEBSITE PREVIEW CARD */}
                <div className="lg:col-span-6 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span className="font-semibold text-slate-300">Site Preview</span>
                    <button
                      type="button"
                      onClick={handlePreviewCurrentSite}
                      className="text-[#00c365] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Full Preview</span>
                    </button>
                  </div>

                  {/* Browser Mock Card */}
                  <div
                    onClick={handlePreviewCurrentSite}
                    className="group relative rounded-2xl bg-[#090d12] border border-slate-800 hover:border-[#00c365]/50 overflow-hidden shadow-lg transition-all cursor-pointer"
                  >
                    {/* Browser Chrome Header */}
                    <div className="px-3 py-2 bg-[#0c1117] border-b border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 select-none">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500/80" />
                        <span className="w-2 h-2 rounded-full bg-amber-500/80" />
                        <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
                      </div>

                      <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#121921] border border-slate-800 text-[10px] font-mono text-slate-300 truncate max-w-[200px] sm:max-w-[240px]">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isPublished ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                        />
                        <span className="truncate">/sites/{activeSite.slug}</span>
                      </div>

                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          isPublished
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {isPublished ? 'Live' : 'Draft'}
                      </span>
                    </div>

                    {/* Miniature Website Canvas Viewport */}
                    <div className="relative h-44 sm:h-52 w-full overflow-hidden flex flex-col justify-between text-left select-none bg-[#091017]">
                      {displayHeroImage ? (
                        <SafeImage
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80"
                          src={displayHeroImage}
                          alt={displaySiteName}
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#0c1c24] via-[#091016] to-[#04080b]" />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-[#080d12] via-[#080d12]/60 to-black/40" />

                      {/* Mini Navbar */}
                      <div className="relative z-10 px-3 py-2 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-xs">
                        <span className="font-extrabold text-[11px] text-white tracking-tight truncate max-w-[140px]">
                          {displaySiteName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-[#00c365] text-black shadow-xs">
                          {activeSite.content_json?.ctaLabel || 'Contact'}
                        </span>
                      </div>

                      {/* Mini Hero Content */}
                      <div className="relative z-10 p-3.5 space-y-1">
                        <h4 className="font-extrabold text-xs sm:text-sm text-white line-clamp-1 leading-snug drop-shadow-md">
                          {displayTagline}
                        </h4>
                        <p className="text-[10px] text-slate-300 line-clamp-2 drop-shadow-xs max-w-xs">
                          {activeSite.content_json?.aboutText ||
                            activeBaseTemplate?.demoSubtext ||
                            'Ghanaian enterprise powered by Mystery Hub.'}
                        </p>
                      </div>

                      {/* Hover / Tap Action Overlay */}
                      <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1.5 text-center p-4">
                        <div className="w-10 h-10 rounded-full bg-[#00c365] text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Eye className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <span className="font-extrabold text-xs text-white tracking-wide">
                          Preview Website
                        </span>
                        <span className="text-[10px] text-slate-300">
                          Click to test layout and interactions
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footnote helper */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5 px-1">
                    <span>
                      {isPublished ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Live & accessible to anyone
                        </span>
                      ) : (
                        <span className="text-amber-400/90 font-medium">
                          Draft mode — only you can view this website
                        </span>
                      )}
                    </span>

                    {isPublished && (
                      <a
                        href={`/sites/${activeSite.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-300 hover:text-white inline-flex items-center gap-1 transition-colors"
                      >
                        <span>Open live tab</span>
                        <ExternalLink className="w-3 h-3 text-[#00c365]" />
                      </a>
                    )}
                  </div>
                </div>

                {/* 2. RIGHT COLUMN: STATUS, PUBLIC URL & QUICK ACTION CONTROLS */}
                <div className="lg:col-span-6 space-y-4">
                  {/* Status & Public URL Card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#090e13] border border-slate-800/90 space-y-3.5 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isPublished ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                          }`}
                        />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                          {isPublished ? 'Website Status: Live' : 'Website Status: Draft'}
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-500 font-mono">
                        ID: {activeSite.id.slice(0, 12)}
                      </span>
                    </div>

                    {isPublished ? (
                      <div className="space-y-2.5 pt-1">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Your website is publicly available on the internet at its live URL.
                        </p>

                        <div className="p-2.5 rounded-xl bg-[#06090c] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-xs font-mono text-emerald-400 truncate break-all">
                            {publicSiteUrl}
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyLink(activeSite.slug)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Copy live link"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy Link</span>
                            </button>

                            <a
                              href={`/sites/${activeSite.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 transition-colors flex items-center gap-1"
                            >
                              <span>Open Site</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Your website is currently in private draft mode. Only you can view and edit it.
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Publish whenever you&apos;re ready to activate your live link at{' '}
                          <code className="text-slate-300 font-mono">/sites/{activeSite.slug}</code>.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Suite */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#090e13] border border-slate-800/90 space-y-3 text-left">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Quick Actions
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Secondary: Preview */}
                      <button
                        type="button"
                        onClick={handlePreviewCurrentSite}
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>Preview</span>
                      </button>

                      {/* Secondary: Publish / Unpublish */}
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(activeSite)}
                        disabled={actionLoadingSiteId === activeSite.id}
                        className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm active:scale-98 ${
                          isPublished
                            ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                            : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {actionLoadingSiteId === activeSite.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Globe className="w-3.5 h-3.5" />
                        )}
                        <span>{isPublished ? 'Unpublish' : 'Publish Site'}</span>
                      </button>

                      {/* Secondary: Copy Link */}
                      <button
                        type="button"
                        onClick={() => handleCopyLink(activeSite.slug)}
                        disabled={!isPublished}
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-sm active:scale-98"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy Link</span>
                      </button>
                    </div>

                    {/* Primary Button Anchor in Suite for Mobile Convenience */}
                    <button
                      type="button"
                      onClick={() => openWebsiteEditor(activeSite)}
                      className="w-full py-3 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 mt-1"
                    >
                      <Edit3 className="w-4 h-4 stroke-[2.5]" />
                      <span>Open Website Editor</span>
                    </button>
                  </div>

                  {/* Free Plan Summary Strip */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-[#080d12] border border-slate-800/80 flex items-start gap-3 text-left">
                    <div className="w-7 h-7 rounded-lg bg-[#00c365]/10 border border-[#00c365]/20 flex items-center justify-center text-[#00c365] shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">Free Plan Active</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400">1 Website Project</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Includes 1 website project, Mystery Hub hosted publishing at /sites/{activeSite.slug}, core visual editor, and mobile responsive layout.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Collapsible Website Settings & Project Info Strip */}
              <div id="website-settings" className="pt-2 border-t border-slate-800/80 scroll-mt-24">
                <button
                  type="button"
                  onClick={() => setShowSettingsDrawer((prev) => !prev)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors py-1 cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                    <span>Website Settings & Project Details</span>
                  </span>
                  {showSettingsDrawer ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showSettingsDrawer && (
                  <div className="mt-3 p-4 rounded-2xl bg-[#070b0f] border border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs animate-in fade-in">
                    <div className="space-y-1">
                      <span className="text-slate-500 block">Assigned Template</span>
                      <p className="text-white font-semibold">
                        {activeBaseTemplate?.title || 'Custom Layout'}
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Change your layout while keeping your site address, business details and media library.</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-500 block">Project Identification</span>
                      <p className="text-white font-mono text-[11px] truncate">
                        {activeSite.id}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Published route: <code className="text-slate-300 font-mono">/sites/{activeSite.slug}</code>
                      </p>
                    </div>

                    <WebsiteSettingsControls site={activeSite} token={sessionToken!} onUpdated={updated=>{updateSite(updated);setDashboardTab('Overview');showToast('Your design has been changed.','success');}} onDeleted={()=>{setMySites([]);showToast('Website deleted. You can create a new Free website.','success');}} />

                  </div>
                )}
              </div>
            </div>
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
                  <span>Mystery Hub Website Studio</span>
                </div>

                {/* Headline */}
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
                  Build a Professional Website for Free
                </h1>

                {/* Subheadline */}
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg">
                  Launch a polished business website without coding. Choose a design, customize your brand, and publish at GH₵0.
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
                    <span>START BUILDING FREE</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={scrollToPlans}
                    className="px-6 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider border border-slate-700/80 transition-colors flex items-center justify-center gap-2 backdrop-blur-sm cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-[#00c365]" />
                    <span>EXPLORE PLANS</span>
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
                Every template is styled with authentic color schemes, typography, and sections crafted for Ghanaian commerce.
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-[#0f151b] border border-slate-800/80 space-y-2.5 text-left">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm sm:text-base text-white">Direct WhatsApp Ordering</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Route orders and inquiries straight to your WhatsApp line with one tap, including pre-filled customer details.
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-[#0f151b] border border-slate-800/80 space-y-2.5 text-left">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Layout className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm sm:text-base text-white">13+ Handcrafted Designs</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                From data resellers and tech agencies to salons, food bukas, and churches — ready to launch in minutes.
              </p>
            </div>
          </div>
        )}

        {/* =========================================================
            4. PLANS / PRICING & ULTRA PREMIER SERVICE
            ========================================================= */}
        <div id="plans" className="scroll-mt-20">
          <WebsitePlansAndUltra
            sessionToken={sessionToken || undefined}
            onStartBlank={() => handleCreateSite('tmpl-start-blank', 'My Business')}
          />
        </div>

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
                  ? 'Preview design layouts and sections. Change your template from Website Settings.'
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
