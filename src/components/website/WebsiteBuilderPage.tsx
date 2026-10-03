import { WebsitePlansAndUltra } from './WebsitePlansAndUltra.js';
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { TEMPLATE_CATEGORIES, WEBSITE_TEMPLATES, orderedWebsiteTemplates } from '../../data/templates';
import { TemplateCategory, WebsiteTemplate, WebsiteSiteRecord } from '../../types';
import { TemplateCardPreview } from './TemplateCardPreview';
import { WebsiteEditor } from './editor/WebsiteEditor';
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
  Check,
  Search,
  ExternalLink,
  Copy,
  Edit3,
  Compass,
  Layers,
  ChevronDown,
  ChevronUp,
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
  const [actionLoadingSiteId, setActionLoadingSiteId] = useState<string | null>(null);

  // Load authenticated user's sites
  useEffect(() => {
    if (sessionToken) {
      setIsLoadingSites(true);
      getMyWebsitesOnServer(sessionToken)
        .then((res) => {
          if (res.success) {
            setMySites(res.sites);
          }
        })
        .catch((err) => {
          console.warn('[WebsiteBuilder] Failed loading user sites:', err);
        })
        .finally(() => {
          setIsLoadingSites(false);
        });
    } else {
      setMySites([]);
    }
  }, [sessionToken]);

  // Deep-link template preview support (e.g. /website-builder?template=tmpl-quickbyte-data or /website-builder/template/tmpl-buka-bistro)
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
    const doCreate = async (token: string) => {
      try {
        const res = await createWebsiteOnServer(token, {
          templateId,
          name: templateName || 'My Business Website',
        });

        if (res.success && res.site) {
          if (res.alreadyExists) {
            showToast('Opening your active website project.', 'info');
          } else {
            setMySites([res.site]);
            showToast('Free website project initialized! Customise your details.', 'success');
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
    const el = document.getElementById('plans-pricing');
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
          showToast('Website unpublished (reverted to draft).', 'info');
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

  // If currently inside the full-screen Website Editor workspace
  if (activeEditorSite && sessionToken) {
    return (
      <WebsiteEditor
        site={activeEditorSite}
        sessionToken={sessionToken}
        onClose={closeWebsiteEditor}
        onSiteUpdated={(updated) => {
          setMySites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          openWebsiteEditor(updated);
        }}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="py-6 sm:py-10 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {/* =========================================================
            1. AUTHENTICATED USER'S ACTIVE WEBSITE DASHBOARD
               (PRIORITIZED FOR LOGGED-IN USERS WITH A WEBSITE)
            ========================================================= */}
        {user && activeSite ? (
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#0d161d] via-[#101b24] to-[#0a1218] border border-[#00c365]/35 shadow-2xl text-left space-y-5 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-[#00c365] uppercase tracking-wider">
                  <Globe className="w-3.5 h-3.5" />
                  <span>My Active Website Project</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {activeSite.content_json?.businessName || activeSite.name}
                </h2>
                <p className="text-xs text-slate-400">
                  Built with {WEBSITE_TEMPLATES.find((t) => t.id === activeSite.template_id)?.title || 'Custom Template'} · Last updated{' '}
                  {new Date(activeSite.updated_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    activeSite.status === 'published'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {activeSite.status === 'published' ? '● Live' : '● Draft'}
                </span>

                {activeSite.status === 'published' && (
                  <a
                    href={`/sites/${activeSite.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold border border-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    <span>View Live</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Dashboard Action Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => openWebsiteEditor(activeSite)}
                  className="px-5 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,195,101,0.35)] flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Website</span>
                </button>

                <button
                  type="button"
                  onClick={scrollToTemplates}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-slate-400" />
                  <span>Browse Templates</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTogglePublish(activeSite)}
                  disabled={actionLoadingSiteId === activeSite.id}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeSite.status === 'published' ? 'Unpublish' : 'Publish Website'}</span>
                </button>

                {activeSite.status === 'published' && (
                  <button
                    type="button"
                    onClick={() => handleCopyLink(activeSite.slug)}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </button>
                )}
              </div>

              {activeSite.status === 'published' && (
                <div className="text-xs text-slate-400 truncate max-w-sm">
                  Public URL: <strong className="text-slate-200">/sites/{activeSite.slug}</strong>
                </div>
              )}
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
            2. COMPACT TRUST / VALUE STRIP
            ========================================================= */}
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

        {/* =========================================================
            3. PLANS / PRICING & ULTRA PREMIER SERVICE
               (DISCOVERABLE IMMEDIATELY WITHOUT EXCESSIVE SCROLLING)
            ========================================================= */}
        <div id="plans" className="scroll-mt-20">
          <WebsitePlansAndUltra
            sessionToken={sessionToken || undefined}
            onStartBlank={() => handleCreateSite('tmpl-start-blank', 'My Business')}
          />
        </div>

        {/* =========================================================
            4. TEMPLATES SHOWCASE GRID & FILTER SECTION
               (FEATURED FIRST: TOP 6 SHOWN INITIALLY, EXPANDABLE)
            ========================================================= */}
        <div id="templates-showcase" className="space-y-6 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00c365] uppercase tracking-wider mb-1">
                <Compass className="w-3.5 h-3.5" />
                <span>Handcrafted Website Templates</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {isFiltering ? 'Matching Industry Templates' : 'Featured Industry Templates'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Click "Preview" to test on any device or "Use" to create your free website immediately.
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

          {/* Category Filter Pills (Smooth Mobile Horizontal Scroll, Zero Browser Scrollbar) */}
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
