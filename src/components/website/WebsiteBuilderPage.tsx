import { WebsiteBusinessDashboard } from './WebsiteBusinessDashboard';
import { WebsiteSettingsControls } from './WebsiteSettingsControls';
import { trackWebsiteEvent } from '../../utils/websiteAnalytics';
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { TEMPLATE_CATEGORIES, WEBSITE_TEMPLATES, orderedWebsiteTemplates } from '../../data/templates';
import { TemplateCategory, WebsiteSiteRecord, WebsiteTemplate } from '../../types';
import { TemplateCardPreview } from './TemplateCardPreview';
import { WebsiteStartSheet } from './WebsiteStartSheet';
import { SafeImage } from './SafeImage';
import { websiteItemVocabulary } from '../../config/websiteStarters';
import { WebsiteEditor } from './editor/WebsiteEditor';
import { WebsitePlansAndUltra } from './WebsitePlansAndUltra';
import './websiteBuilder.css';
import { mergeSiteWithTemplate } from '../../utils/templateRendererUtils';
import {
  getMyWebsitesOnServer,
  createWebsiteOnServer,
  publishWebsiteOnServer,
  unpublishWebsiteOnServer,
} from '../../services/apiClient';
import {
  Globe,
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
  Share2,
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
  const [startTemplate,setStartTemplate]=useState('');
  // The dashboard's Publish opens the editor's publish checklist, never a blind publish.
  const [editorPublish,setEditorPublish]=useState(false);
  const [pricingDirty,setPricingDirty]=useState(false);
  const confirmPricingLeave=()=>!pricingDirty||window.confirm('You have unsaved bundle prices. Leave without saving them?');
  const editSite=(site:WebsiteSiteRecord,publish=false)=>{if(confirmPricingLeave()){setPricingDirty(false);setEditorPublish(publish);openWebsiteEditor(site);}};
  const [dashboardTab, setDashboardTab] = useState('Overview');
  // Leaving the fullscreen editor returns the owner to their website card (or the pricing area they
  // asked for), never to wherever the collapsed page happened to leave the window scrolled.
  const exitTarget = useRef<string>('website-owner-card');
  const wasEditing = useRef(false);
  const openPricing = () => { setDashboardTab('Bundles & Pricing'); exitTarget.current = 'website-business-dashboard'; closeWebsiteEditor(); };
  useEffect(() => {
    if (activeEditorSite) { wasEditing.current = true; return; }
    if (!wasEditing.current) return;
    wasEditing.current = false;
    const id = exitTarget.current; exitTarget.current = 'website-owner-card';
    requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (id === 'website-owner-card' || !target) window.scrollTo({ top: 0 });
      else target.scrollIntoView({ block: 'start' });
      (target?.querySelector('h1,h2') as HTMLElement | null)?.focus({ preventScroll: true });
    });
  }, [activeEditorSite]);
  const updateSite = (updated: WebsiteSiteRecord) => {
    setMySites(prev => prev.map(site => site.id === updated.id ? updated : site));
    if (activeEditorSite?.id === updated.id && activeEditorSite.template_id !== updated.template_id) openWebsiteEditor(updated);
  };

  // A switch started in the global template preview must also update the owner dashboard.
  // A website created from the template preview joins the dashboard too.
  useEffect(()=>{if(activeEditorSite)setMySites(prev=>prev.some(site=>site.id===activeEditorSite.id)?prev.map(site=>site.id===activeEditorSite.id?activeEditorSite:site):[activeEditorSite,...prev]);},[activeEditorSite]);

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

  // Real gallery designs, one per industry, for the visitor showcase strip.
  const showcaseTemplates = orderedWebsiteTemplates().filter(t => t.id !== 'tmpl-start-blank' && t.heroImage).slice(0, 6);

  const isFiltering = selectedCategory !== 'all' || searchQuery.trim().length > 0;
  const displayedTemplates = isFiltering || showAllTemplates ? filteredTemplates : filteredTemplates.slice(0, 6);

  const handleCreateSite = async (templateId: string, _templateName?: string) => {
    if(activeSite && activeSite.template_id!==templateId){if(!confirmPricingLeave())return;setChangeTarget(templateId);return;}
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

  const handleTogglePublish = async (site: WebsiteSiteRecord) => {
    if (!sessionToken) return;
    setActionLoadingSiteId(site.id);
    try {
      if (site.status === 'published') {
        const res = await unpublishWebsiteOnServer(sessionToken, site.id, site.updated_at);
        if (res.success && res.site) {
          setMySites((prev) => prev.map((s) => (s.id === res.site.id ? res.site : s)));
          showToast('Your website is now a draft and is no longer public.', 'info');
        }
      } else {
        const res = await publishWebsiteOnServer(sessionToken, site.id, site.updated_at);
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

  // Phones open the native share sheet (WhatsApp, SMS…); elsewhere the link is copied.
  const handleShare = async (slug: string) => {
    const url = `${window.location.origin}/sites/${slug}`;
    if (navigator.share) {
      try { await navigator.share({ title: displaySiteName, url }); return; }
      catch (error: any) { if (error?.name === 'AbortError') return; }
    }
    handleCopyLink(slug);
  };

  const handlePreviewCurrentSite = () => {
    if (activeMergedTemplate) {
      openTemplatePreview({...activeMergedTemplate,previewSiteId:activeSite!.id});
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
        openPublish={editorPublish}
        onClose={()=>{setEditorPublish(false);closeWebsiteEditor();}}
        onSiteUpdated={updateSite}
        showToast={showToast}
      />
    );
  }

  const isPublished = activeSite?.status === 'published';
  // Publishing stamps published_at; any later draft save moves updated_at past it.
  const draftAhead = !!activeSite?.published_at && Date.parse(activeSite.updated_at) - Date.parse(activeSite.published_at) > 1000;
  const exampleCount = (activeSite?.content_json?.items || []).filter(item => item.isExample).length;
  const itemWord = websiteItemVocabulary(activeSite?.template_id || '');
  const displaySiteName =
    activeSite?.content_json?.businessName || activeSite?.name || 'My Business Website';
  const publicSiteUrl = activeSite
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/sites/${activeSite.slug}`
    : '';

  return (
    <div className="py-6 sm:py-10 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">

        {startTemplate&&<WebsiteStartSheet templateId={startTemplate} onClose={()=>setStartTemplate('')} onCreated={(site,alreadyExists)=>{const requested=startTemplate;setStartTemplate('');setMySites([site]);if(alreadyExists&&site.template_id!==requested){setChangeTarget(requested);return;}setEditorPublish(false);openWebsiteEditor(site);showToast(alreadyExists?'Opening your existing website.':'Your website is ready. Tap anything to change it.',alreadyExists?'info':'success');}}/>}
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
            <section id="website-owner-card" data-website-owner-card aria-labelledby="website-owner-name" className="website-owner-card scroll-mt-24 text-left">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${isPublished?'bg-emerald-500/15 text-emerald-300':'bg-amber-500/15 text-amber-200'}`}><span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${isPublished?'bg-emerald-400':'bg-amber-300'}`}/>{isPublished?'Live':'Draft · not public yet'}</span>
                {isPublished&&draftAhead&&<span className="inline-flex items-center rounded-full px-2.5 py-1 font-semibold bg-sky-500/15 text-sky-200">Draft has unpublished changes</span>}
                <span className="text-slate-400">{activeBaseTemplate?.title} · Free plan</span>
              </div>
              <h1 id="website-owner-name" tabIndex={-1} className="mt-3 text-2xl sm:text-3xl font-bold break-words outline-none">{displaySiteName}</h1>
              <div className="website-owner-address mt-3">
                <Globe className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true"/>
                <span className="min-w-0 truncate" title={publicSiteUrl}>{publicSiteUrl.replace(/^https?:\/\//,'')}</span>
                {isPublished&&<button type="button" className="website-owner-icon" aria-label="Copy website link" onClick={()=>handleCopyLink(activeSite.slug)}><Copy className="w-4 h-4"/></button>}
              </div>
              {!isPublished&&<p className="mt-2 text-xs text-slate-400">Publish when you are ready. This address starts working once your website is live.</p>}
              {isPublished&&activeSite.published_at&&<p className="mt-2 text-xs text-slate-400">Last published {new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(activeSite.published_at))}.{draftAhead?' Your newer edits are saved as a draft until you update the live site.':''}</p>}
              {exampleCount>0&&<button type="button" className="website-owner-review" onClick={()=>editSite(activeSite,true)}><span aria-hidden="true">{exampleCount}</span><span><strong>{exampleCount} example {exampleCount===1?itemWord.singular.toLowerCase():itemWord.many} to review</strong><small>Keep the ones that fit your business and remove the rest before publishing.</small></span></button>}
              <div className="website-owner-actions mt-4">
                <button className="website-owner-primary" onClick={()=>editSite(activeSite)}>Edit website</button>
                {isPublished?<a className="website-owner-secondary" href={`/sites/${encodeURIComponent(activeSite.slug)}`} target="_blank" rel="noopener noreferrer"><Eye className="w-4 h-4" aria-hidden="true"/>View site</a>:<button className="website-owner-secondary" onClick={handlePreviewCurrentSite}><Eye className="w-4 h-4" aria-hidden="true"/>Preview</button>}
                {isPublished&&!draftAhead?<button className="website-owner-secondary" onClick={()=>void handleShare(activeSite.slug)}><Share2 className="w-4 h-4" aria-hidden="true"/>Share</button>:<button className="website-owner-secondary" onClick={()=>editSite(activeSite,true)}><Globe className="w-4 h-4" aria-hidden="true"/>{isPublished?'Update live site':'Publish'}</button>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                {activeSite.template_id==='tmpl-data-reseller'&&<><button className="min-h-11 text-emerald-300" onClick={()=>setDashboardTab('Orders')}>Manage orders</button><button className="min-h-11 text-emerald-300" onClick={()=>setDashboardTab('Bundles & Pricing')}>Bundles &amp; pricing</button></>}
                {isPublished&&<button disabled={actionLoadingSiteId===activeSite.id} className="min-h-11 text-slate-400 hover:text-slate-200 disabled:opacity-50 sm:ml-auto" onClick={()=>void handleTogglePublish(activeSite)}>{actionLoadingSiteId===activeSite.id?'Updating…':'Unpublish'}</button>}
              </div>
            </section>
            <WebsiteBusinessDashboard site={activeSite} token={sessionToken!} requestedTab={dashboardTab} onTabChange={setDashboardTab} onEdit={()=>editSite(activeSite)} onPricingDirty={setPricingDirty} onPreview={handlePreviewCurrentSite} onPublish={()=>editSite(activeSite,true)} onShare={isPublished?()=>void handleShare(activeSite.slug):undefined} onSettings={()=>{setShowSettingsDrawer(true);requestAnimationFrame(()=>document.getElementById('website-settings')?.scrollIntoView({block:'start'}));}}/>
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
                  <button type="button" aria-label={`Preview the ${t.categoryLabel} design`} onClick={() => openTemplatePreview(t)}>
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
                  : `${WEBSITE_TEMPLATES.filter(t => t.id !== 'tmpl-start-blank').length} designs, all included in Free. Preview any of them on phone and desktop before you start.`}
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
              Showing <strong>{displayedTemplates.length}</strong> of{' '}
              <strong>{filteredTemplates.length}</strong> design{filteredTemplates.length === 1 ? '' : 's'}
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
                  <span>{showAllTemplates ? 'Show fewer' : `View all ${filteredTemplates.length}`}</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                <span>{showAllTemplates ? 'Show fewer designs' : `View all ${filteredTemplates.length} designs`}</span>
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
