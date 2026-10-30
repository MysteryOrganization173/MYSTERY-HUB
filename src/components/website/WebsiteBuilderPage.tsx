import { WebsiteSettingsControls } from './WebsiteSettingsControls';
import { useOwnerWebsites } from '../../hooks/useOwnerWebsites';
import { trackWebsiteEvent } from '../../utils/websiteAnalytics';
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { TEMPLATE_CATEGORIES, WEBSITE_TEMPLATES, orderedWebsiteTemplates, findTemplateByLink, templateDesignLabel, readyDesignCount, isReadyDesign } from '../../data/templates';
import { TemplateCategory, WebsiteSiteRecord } from '../../types';
import { TemplateCardPreview } from './TemplateCardPreview';
import { WebsiteStartSheet, createWebsiteFromDetails } from './WebsiteStartSheet';
import { SafeImage } from './SafeImage';
import { takeWebsiteStartIntent } from '../../utils/websiteStartIntent';
import { WebsitePlansAndUltra } from './WebsitePlansAndUltra';
import './websiteBuilder.css';
import { WEBSITE_LIVE_LABELS, websiteLiveState } from '../../utils/websiteReadiness';
import { websiteEditorPath } from '../../utils/routing';
import {
  Globe,
  ArrowRight,
  Search,
  Compass,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  LayoutDashboard,
  PenLine,
} from 'lucide-react';

export const WebsiteBuilderPage: React.FC = () => {
  const {
    openTemplatePreview,
    showToast,
    user,
    sessionToken,
    openAuth,
    isAuthModalOpen,
    openWebsiteEditor,
    setActivePage,
  } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  // Business Workspace V1: this page is for discovering designs and starting a website. Running an existing website
  // (orders, prices, earnings, analytics, settings) happens in My Business (/my-business).
  const { sites: mySites, setSites: setMySites, loading: isLoadingSites, error: siteFetchError, reload: reloadSites } = useOwnerWebsites(sessionToken);
  const [changeTarget,setChangeTarget]=useState('');
  const [startTemplate,setStartTemplate]=useState('');
  // Builder V6: the editor is its own page (/website-builder/edit/:siteId); this page only opens it.
  const editSite=(site:WebsiteSiteRecord)=>openWebsiteEditor(site);
  // A new website goes straight into its editor. An owner who already has a website on another design is offered
  // the design switch (preview first), never switched silently and never given a second website.
  const handleStarted = (site: WebsiteSiteRecord, alreadyExists: boolean, requested: string) => {
    setStartTemplate(''); setMySites([site]);
    if (alreadyExists && site.template_id !== requested) { setChangeTarget(requested); return; }
    openWebsiteEditor(site);
    showToast(alreadyExists ? 'Opening your existing website.' : 'Your website is ready. Tap anything to change it.', alreadyExists ? 'info' : 'success');
  };
  // A design chosen before signing up or logging in is resumed once the account exists, even after a reload.
  const resuming = useRef(false);
  useEffect(() => {
    if (!user || !sessionToken || isAuthModalOpen || resuming.current) return;
    const intent = takeWebsiteStartIntent();
    if (!intent) return;
    resuming.current = true;
    createWebsiteFromDetails(sessionToken, intent.templateId, intent)
      .then(res => handleStarted(res.site, res.alreadyExists, intent.templateId))
      .catch((e: any) => showToast(e?.message || 'We could not create your website. Please try again.', 'warning'))
      .finally(() => { resuming.current = false; });
  }, [user?.id, sessionToken, isAuthModalOpen]);
  // After deletion the owner lands on the gallery to start again: new design, new name, new address.
  const handleWebsiteDeleted = (siteId: string) => {
    setMySites(prev => prev.filter(site => site.id !== siteId));
    setChangeTarget('');
    showToast('Website deleted. Choose a design to start a new website.', 'success');
    requestAnimationFrame(() => { const gallery = document.getElementById('templates-showcase'); if (gallery) gallery.scrollIntoView({ block: 'start' }); else window.scrollTo({ top: 0 }); });
    reloadSites();
  };

  useEffect(() => { trackWebsiteEvent('website_builder_viewed', {source:'builder'}, sessionToken || undefined); }, [sessionToken]);

  // Deep-link template preview support (e.g. /website-builder?template=tmpl-data-reseller)
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
        const found = findTemplateByLink(targetId);
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

  // Real gallery designs, one per industry, for the visitor showcase strip. V5.2: an industry with several designs
  // (Night Kitchen and Classic Kitchen are both restaurants) appears once, as its lead design; every design stays in
  // the full gallery below. A tile always opens the preview of the design it shows.
  const showcaseTemplates = orderedWebsiteTemplates().filter(t => isReadyDesign(t) && t.heroImage)
    .filter((t, i, all) => all.findIndex(other => other.categoryLabel === t.categoryLabel) === i).slice(0, 6);

  const isFiltering = selectedCategory !== 'all' || searchQuery.trim().length > 0;
  const displayedTemplates = isFiltering || showAllTemplates ? filteredTemplates : filteredTemplates.slice(0, 6);

  const handleCreateSite = async (templateId: string, _templateName?: string) => {
    if(activeSite && activeSite.template_id!==templateId){setChangeTarget(templateId);return;}
    if(activeSite){editSite(activeSite);return;}
    setStartTemplate(templateId);
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

  const liveState = activeSite ? websiteLiveState(activeSite) : 'not-published';
  const displaySiteName =
    activeSite?.content_json?.businessName || activeSite?.name || 'My Business Website';

  return (
    <div className="py-6 sm:py-10 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">

        {startTemplate&&<WebsiteStartSheet templateId={startTemplate} onClose={()=>setStartTemplate('')} onCreated={(site,alreadyExists,requested)=>handleStarted(site,alreadyExists,requested)}/>}
        {activeSite&&sessionToken&&changeTarget&&<WebsiteSettingsControls site={activeSite} token={sessionToken} requestedTemplateId={changeTarget} selectionOnly onClosed={()=>setChangeTarget('')} onDeleted={handleWebsiteDeleted} onUpdated={updated=>{setMySites([updated]);setChangeTarget('');openWebsiteEditor(updated);}}/>}
        {/* =========================================================
            LOADING / ERROR STATE FOR AUTHENTICATED USERS
            ========================================================= */}
        {user && isLoadingSites && !activeSite && (
          <div className="p-8 rounded-3xl bg-[#0d141b] border border-slate-800 text-center space-y-3 animate-pulse">
            <RefreshCw className="w-6 h-6 text-[#00c365] animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-300">Loading your website…</p>
          </div>
        )}

        {user && !isLoadingSites && siteFetchError && !activeSite && (
          <div role="alert" className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3 text-left text-xs">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-300">We couldn’t check your website</span>
              <p>{/fetch|network/i.test(siteFetchError) ? 'Check your connection, then try again.' : siteFetchError}</p>
              <button type="button" className="min-h-11 font-semibold text-amber-200 underline underline-offset-4" onClick={reloadSites}>Try again</button>
            </div>
          </div>
        )}

        {/* =========================================================
            1. AUTHENTICATED USER'S "MY WEBSITE" MANAGEMENT DASHBOARD
               (PRIORITIZED FOR LOGGED-IN USERS WITH AN ACTIVE WEBSITE)
            ========================================================= */}
        {user && activeSite ? (
          <section id="website-owner-card" data-website-owner-card aria-labelledby="website-owner-name" className="website-owner-card website-owner-banner scroll-mt-24 text-left">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${liveState==='not-published'?'bg-amber-500/15 text-amber-200':'bg-emerald-500/15 text-emerald-300'}`}><span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${liveState==='not-published'?'bg-amber-300':'bg-emerald-400'}`}/>{WEBSITE_LIVE_LABELS[liveState].short}</span>
              <span className="text-slate-400">{templateDesignLabel(activeBaseTemplate)} · Free plan</span>
            </div>
            <h1 id="website-owner-name" tabIndex={-1} className="mt-3 text-2xl sm:text-3xl font-bold break-words outline-none">{displaySiteName}</h1>
            <p className="mt-1 text-sm text-slate-400 max-w-xl">{activeSite.template_id==='tmpl-data-reseller'?'Change your store’s look and wording in the editor. Orders, bundle prices and Store Earnings are in My Business.':'Change your website in the editor. Visitors, sharing and settings are in My Business.'} Other designs are below; switching always shows a preview first.</p>
            <div className="website-owner-actions mt-4">
              <a className="website-owner-primary inline-flex items-center justify-center gap-2" href={websiteEditorPath(activeSite.id)} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.button!==0)return;event.preventDefault();editSite(activeSite);}}><PenLine className="w-4 h-4" aria-hidden="true"/>Continue editing</a>
              <a className="website-owner-secondary" href="/my-business" onClick={event=>{event.preventDefault();setActivePage('business');}}><LayoutDashboard className="w-4 h-4" aria-hidden="true"/>My Business</a>
            </div>
          </section>
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
              <div className="lg:col-span-7 space-y-5 text-left">
                <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/30 text-xs font-semibold text-[#4ade80]">
                  <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                  Website Builder · Free plan
                </p>
                <h1 className="text-[34px] sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.05]">
                  Your business,<br />online today.
                </h1>
                <p className="text-slate-300 text-base leading-relaxed max-w-md">
                  Choose a design made for your kind of business, add your details and photos, and publish for free. No coding.
                </p>
                <ol className="website-hero-steps" aria-label="How it works">
                  <li><span>1</span>Choose a design</li>
                  <li><span>2</span>Add your details</li>
                  <li><span>3</span>Publish free</li>
                </ol>
                <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button type="button" onClick={handlePrimaryHeroAction} className="website-hero-primary">
                    Choose a free design
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={scrollToPlans} className="website-hero-secondary">
                    See plans
                  </button>
                </div>
                <p className="text-sm text-slate-400">
                  Prefer we build it for you? <button type="button" className="text-[#4ade80] font-semibold underline-offset-4 hover:underline min-h-11" onClick={() => document.getElementById('ultra')?.scrollIntoView({ behavior: 'smooth' })}>See Ultra, our done-for-you service</button>
                </p>
              </div>

              <div className="hidden lg:block lg:col-span-5 pointer-events-none min-h-[380px]" aria-hidden="true" />
            </div>
          </div>
        )}

        {/* =========================================================
            3. MADE FOR: real designs from the gallery (visitors only)
            ========================================================= */}
        {(!user || !activeSite) && (
          <section aria-labelledby="website-made-for" className="text-left">
            <h2 id="website-made-for" className="text-sm font-bold text-slate-300">Made for businesses like yours <span className="font-normal text-slate-500">· tap to preview</span></h2>
            <ul className="website-made-for">
              {showcaseTemplates.map(t => (
                <li key={t.id}>
                  <button type="button" aria-label={`Preview ${t.title}, a ${t.categoryLabel} design`} onClick={() => openTemplatePreview(t)}>
                    {t.heroImage && <SafeImage src={t.heroImage} alt="" loading="lazy" className="website-made-for-photo" />}
                    <span>{t.categoryLabel}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* =========================================================
            4. TEMPLATES SHOWCASE / DESIGN DISCOVERY SECTION
               (REFRAMED AS "EXPLORE OTHER DESIGNS" FOR WEBSITE OWNERS)
            ========================================================= */}
        <div id="templates-showcase" className="space-y-6 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00c365] uppercase tracking-wider mb-1">
                <Compass className="w-3.5 h-3.5" />
                <span>{activeSite ? 'Other designs' : 'Designs'}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {activeSite ? 'Explore other designs' : isFiltering ? 'Matching designs' : 'Choose your design'}
              </h2>
              <p className="text-sm text-slate-400 mt-1 max-w-xl">
                {activeSite
                  ? 'Switching keeps your business details. You will see exactly what stays and what resets before anything changes.'
                  : `${readyDesignCount()} designs, all included in Free. Preview any of them on phone and desktop before you start.`}
              </p>
            </div>

            {/* Search Input Bar */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search designs, e.g. data, salon"
                aria-label="Search designs"
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
              Showing <strong>{readyDesignCount(displayedTemplates)}</strong> of{' '}
              <strong>{readyDesignCount(filteredTemplates)}</strong> design{readyDesignCount(filteredTemplates) === 1 ? '' : 's'}
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
                  <span>{showAllTemplates ? 'Show fewer' : `View all ${readyDesignCount(filteredTemplates)}`}</span>
                  {showAllTemplates ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          {/* Templates Cards Grid */}
          {filteredTemplates.length === 0 ? (
            <div className="p-12 text-center bg-[#0d1217] rounded-3xl border border-slate-800 space-y-3">
              <p className="text-slate-400 text-sm">No designs match that search.</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
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
                <span>{showAllTemplates ? 'Show fewer designs' : `View all ${readyDesignCount(filteredTemplates)} designs`}</span>
                {showAllTemplates ? <ChevronUp className="w-4 h-4 text-[#00c365]" /> : <ChevronDown className="w-4 h-4 text-[#00c365]" />}
              </button>
            </div>
          )}
        </div>
        {/* =========================================================
            5. PLANS / PRICING & ULTRA PREMIER SERVICE
            ========================================================= */}
        <details id="plans" open={!activeSite} className="scroll-mt-20"><summary className="min-h-11 cursor-pointer text-sm text-slate-400">Plans and Ultra, our done-for-you service</summary>
          <WebsitePlansAndUltra
            sessionToken={sessionToken || undefined}
            // "Start free" leads to the designed templates: owners begin from a finished design, not a blank page.
            onStartBlank={scrollToTemplates}
          />
        </details>

      </div>
    </div>
  );
};
