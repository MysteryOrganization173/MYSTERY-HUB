import {VisualContextPanel} from './VisualContextPanel';
import {WebsiteEditorToolbar} from './WebsiteEditorToolbar';
import {visualTargets, applyVisualValue} from '../../../utils/websiteVisualEditing';
import { WebsitePreviewFrame } from '../WebsitePreviewFrame';
import { WebsiteImageLibrary, WebsiteImageField } from './WebsiteImageField';
import { trackWebsiteEvent } from '../../../utils/websiteAnalytics';
import React, { useState, useEffect, useRef } from 'react';
import { WebsiteSiteRecord, SiteContent, SiteSettings, WebsiteTemplate } from '../../../types';
import { updateWebsiteOnServer, publishWebsiteOnServer, unpublishWebsiteOnServer } from '../../../services/apiClient';
import { getTemplateById, mergeSiteWithTemplate, renderTemplateLayout } from '../../../utils/templateRendererUtils';
import { useApp } from '../../../context/AppContext';
import { WebsiteSectionsControl } from './WebsiteSectionsControl';
import { SafeImage } from '../SafeImage';
import {
  ArrowLeft,
  Save,
  Globe,
  Eye,
  Check,
  ExternalLink,
  Copy,
  Sparkles,
  Smartphone,
  Tablet,
  Monitor,
  AlertCircle,
  Building,
  Phone,
  Palette,
  MousePointerClick,
  Share2,
  CheckCircle2,
  RefreshCw,
  Layers,
  X,
  ImageIcon,
} from 'lucide-react';

interface WebsiteEditorProps {
  site: WebsiteSiteRecord;
  sessionToken: string;
  onClose: () => void;
  onOpenPricing?: () => void;
  onSiteUpdated: (updatedSite: WebsiteSiteRecord) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const WebsiteEditor: React.FC<WebsiteEditorProps> = ({
  site: initialSite,
  sessionToken,
  onClose,
  onOpenPricing,
  onSiteUpdated,
  showToast,
}) => {
  const { openMysteryAi } = useApp();
  const [mediaOpen, setMediaOpen] = useState(false);
  const [currentSite, setCurrentSite] = useState<WebsiteSiteRecord>(initialSite);
  const workspaceRef = useRef<HTMLDivElement>(null);
  // This fullscreen workspace must not leave the underlying app's navigation or
  // floating launcher in the keyboard/touch path. Restore pre-existing state on exit.
  useEffect(() => {
    const workspace=workspaceRef.current;if(!workspace)return;
    const changed=new Map<HTMLElement,boolean>();
    let branch:HTMLElement=workspace;
    while(branch.parentElement){
      for(const sibling of Array.from(branch.parentElement.children)) {
        if(sibling!==branch && sibling instanceof HTMLElement && !['SCRIPT','STYLE','LINK'].includes(sibling.tagName)) {
          changed.set(sibling,sibling.inert);sibling.inert=true;
        }
      }
      branch=branch.parentElement;if(branch===document.body)break;
    }
    return ()=>{for(const [element,inert]of changed)element.inert=inert;};
  },[]);

  useEffect(() => { trackWebsiteEvent('website_editor_opened', { siteId:initialSite.id, templateId:initialSite.template_id, source:'editor' }, sessionToken); }, [initialSite.id, sessionToken]);

  // Form State
  const [siteName, setSiteName] = useState(initialSite.name);
  const [content, setContent] = useState<SiteContent>(initialSite.content_json);
  const [settings, setSettings] = useState<SiteSettings>(initialSite.settings_json);

  const draftRef = useRef({name:siteName,content,settings});
  draftRef.current = {name:siteName,content,settings};
  const serverSiteRef = useRef(currentSite);
  const editVersion = useRef(0), savedVersion = useRef(0);
  const publicationJob = useRef(false);
  const savingJob = useRef<Promise<WebsiteSiteRecord | null> | null>(null);
  const failedSaveVersion = useRef<number | null>(null);

  // Status & Dirty Tracking
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatusText, setSaveStatusText] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [isPublishing, setIsPublishing] = useState(false);

  // View Mode: 'edit' or 'preview' (on mobile)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [allSettings, setAllSettings] = useState(false);
  const [visualSelection, setVisualSelection] = useState<string|null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  // A tap on content that has no tap-to-edit field explains where to change it.
  const [settingsNotice, setSettingsNotice] = useState(false);
  // Rendered targets in reading order, reported by the draft frame, for Previous/Next.
  const [targetOrder, setTargetOrder] = useState<string[]>([]);
  const [canvasHintSeen, setCanvasHintSeen] = useState(false);
  const [previewHintSeen, setPreviewHintSeen] = useState(false);
  const clearSelection = () => {setVisualSelection(null);setSettingsNotice(false);setFocusRequest(n=>n+1);};
  const selectTarget = (id:string|null, hint?:'settings') => {setAllSettings(false);setVisualSelection(id);setSettingsNotice(!id && hint==='settings');if(id || hint)setCanvasHintSeen(true);};
  const changeMode = (mode:'edit'|'preview') => {setActiveTab(mode);setVisualSelection(null);setSettingsNotice(false);setAllSettings(false);};

  // Device View in Preview: responsive default based on viewport width
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) return 'mobile';
      if (window.innerWidth < 1024) return 'tablet';
    }
    return 'desktop';
  });

  // First-use guidance card state (persisted per site)
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(`mh_builder_guide_dismissed_${initialSite.id}`);
    } catch {
      return false;
    }
  });

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem(`mh_builder_guide_dismissed_${currentSite.id}`, 'true');
    } catch {}
  };

  // Preview container dimension tracking for responsive zoom scaling
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [isPrivateFullPreviewOpen, setIsPrivateFullPreviewOpen] = useState(false);

  // Base Template
  const baseTemplate = getTemplateById(currentSite.template_id);
  const isDataReseller = currentSite.template_id === 'tmpl-data-reseller';

  // Active editor section
  const [activeSection, setActiveSection] = useState<
    'business' | 'contact' | 'branding' | 'media' | 'sections' | 'bundles' | 'cta' | 'social'
  >('business');

  // Template identity changes must discard old template-specific controls and draft state.
  useEffect(() => {
    setCurrentSite(initialSite); setSiteName(initialSite.name);
    setContent(initialSite.content_json); setSettings(initialSite.settings_json);
    serverSiteRef.current = initialSite;
    editVersion.current = 0; savedVersion.current = 0; failedSaveVersion.current = null;
    setIsDirty(false); setSaveStatusText('saved'); setActiveSection('business');
    setVisualSelection(null);setSettingsNotice(false);setTargetOrder([]);setAllSettings(false);setActiveTab('edit');setFocusRequest(0);
  }, [initialSite.id, initialSite.template_id]);

  // Mark dirty on any edit
  const markDirty = () => {
    editVersion.current++;
    setIsDirty(true);
    setSaveStatusText('unsaved');
  };

  // Warn before closing tab if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Track canvas dimensions for scaling
  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [previewDevice, activeTab, allSettings, visualSelection]);

  // A completed save only acknowledges the snapshot it sent, not edits made during the request.
  const handleSaveDraft = async (): Promise<WebsiteSiteRecord | null> => {
    if (savingJob.current) return savingJob.current;
    const version=editVersion.current, snapshot=draftRef.current;
    setIsSaving(true);setSaveStatusText('saving');
    const job=(async()=>{
      try {
        const res=await updateWebsiteOnServer(sessionToken,currentSite.id,{...snapshot,expectedUpdatedAt:serverSiteRef.current.updated_at});
        failedSaveVersion.current=null;
        serverSiteRef.current=res.site;setCurrentSite(res.site);onSiteUpdated(res.site);savedVersion.current=version;
        const unchanged=editVersion.current===version;
        setIsDirty(!unchanged);setSaveStatusText(unchanged?'saved':'unsaved');
        if(unchanged){setSiteName(res.site.name);setContent(res.site.content_json);setSettings(res.site.settings_json);}
        return res.site;
      } catch(err:any) {failedSaveVersion.current=version;showToast(err.message || 'Failed to save changes.','warning');setSaveStatusText('unsaved');return null;}
      finally {setIsSaving(false);savingJob.current=null;}
    })();
    savingJob.current=job;return job;
  };

  // Debounced Autosave (2.5 seconds of inactivity)
  useEffect(() => {
    // Retry on a new edit or explicit Save, instead of repeating failed requests/toasts.
    if (!isDirty || isSaving || isPublishing || failedSaveVersion.current===editVersion.current) return;
    const timer = setTimeout(() => {
      handleSaveDraft();
    }, 2500);
    return () => clearTimeout(timer);
  }, [isDirty, siteName, content, settings, isSaving, isPublishing]);

  // Publish / Unpublish Handlers
  const handlePublish = async () => {
    if(publicationJob.current)return;
    publicationJob.current=true;setIsPublishing(true);
    try {
      if(savingJob.current && !(await savingJob.current))throw new Error('Save failed. Publishing was stopped.');
      if(editVersion.current!==savedVersion.current && !(await handleSaveDraft()))throw new Error('Save failed. Publishing was stopped.');
      if(editVersion.current!==savedVersion.current)throw new Error('Your draft changed during saving. Save it before publishing.');
      const version=savedVersion.current;
      const res=await publishWebsiteOnServer(sessionToken,currentSite.id,serverSiteRef.current.updated_at);
      if(!res.success || !res.site)throw new Error('Publication was not confirmed. Check your website before retrying.');
      serverSiteRef.current=res.site;setCurrentSite(res.site);onSiteUpdated(res.site);
      const unchanged=editVersion.current===version;setIsDirty(!unchanged);setSaveStatusText(unchanged?'saved':'unsaved');
      showToast('Your saved revision is now live.','success');
    } catch(err:any){showToast(err.message || 'Failed to publish website.','warning');}
    finally{publicationJob.current=false;setIsPublishing(false);}
  };
  const handleUnpublish = async () => {
    if(publicationJob.current)return;
    publicationJob.current=true;setIsPublishing(true);
    try {
      if(savingJob.current && !(await savingJob.current))throw new Error('Save failed. Reload before unpublishing.');
      const res=await unpublishWebsiteOnServer(sessionToken,currentSite.id,serverSiteRef.current.updated_at);
      if(!res.success || !res.site)throw new Error('Unpublication was not confirmed. Check your website before retrying.');
      serverSiteRef.current=res.site;setCurrentSite(res.site);onSiteUpdated(res.site);
      showToast('Your website is no longer public. Your draft is preserved.','info');
    } catch(err:any){showToast(err.message || 'Failed to unpublish website.','warning');}
    finally{publicationJob.current=false;setIsPublishing(false);}
  };

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}/sites/${currentSite.slug}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      showToast('Website link copied to clipboard!', 'success');
    });
  };

  // Live merged preview template
  const previewTemplate: WebsiteTemplate = mergeSiteWithTemplate(baseTemplate, content, settings);

  // Compute live scaling factors for preview canvas
  const availableWidth = canvasDimensions.width || 800;
  const isMobileScreen = availableWidth < 640;
  const isSmallScreen = availableWidth < 768;
  const targetWidth = previewDevice === 'mobile' ? 375 : previewDevice === 'tablet' ? 768 : 1280;
  const paddingX =
    previewDevice === 'desktop' || previewDevice === 'tablet' ? (isMobileScreen ? 8 : 16) : 16;
  const usableWidth = Math.max(240, availableWidth - paddingX);

  const isWidePreviewOnSmallScreen = false; // Scale a fixed iframe viewport; never shrink its media-query width.
  const effectiveCanvasWidth = targetWidth;
  const scale = isWidePreviewOnSmallScreen ? 1 : Math.min(1, usableWidth / targetWidth);

  const targets = visualTargets(previewTemplate);
  const selected = targets.find(t=>t.id===visualSelection);
  const contextualTargets = visualSelection==='branding' ? targets.filter(t=>t.source.kind==='settings') : selected ? [selected,...(selected.destinationId ? targets.filter(t=>t.id===selected.destinationId) : [])] : [];
  const editVisualValue = (id:string,value:string) => {
    if(isPublishing)return;
    const draft=draftRef.current;
    const next=applyVisualValue(draft.content,draft.settings,mergeSiteWithTemplate(baseTemplate,draft.content,draft.settings),id,value);
    if(!next)return;
    draftRef.current={...draft,...next};setContent(next.content);setSettings(next.settings);markDirty();
  };
  const openSettings=()=>{setAllSettings(true);setVisualSelection(null);setSettingsNotice(false);};
  // Previous/Next walk the page in reading order; fall back to the schema order before the frame reports.
  const stepIds = (targetOrder.length ? targetOrder : targets.map(t=>t.id)).filter(id=>targets.some(t=>t.id===id && t.source.kind!=='settings'));
  const stepIndex = selected ? stepIds.indexOf(selected.id) : -1;
  const step = (delta:number) => {if(stepIndex<0 || !stepIds.length)return;setVisualSelection(stepIds[(stepIndex+delta+stepIds.length)%stepIds.length]);};
  // Phones and tablets show the panel as a bottom sheet over roughly half of the canvas.
  const sheetReserve = typeof window!=='undefined' && window.innerWidth<1024 ? 0.5 : 0;

  return (
    <div ref={workspaceRef} role="dialog" aria-modal="true" aria-label="Website editor" className="visual-workspace fixed inset-0 z-[80] text-slate-100 flex flex-col font-sans overflow-hidden">
      {mediaOpen && <WebsiteImageLibrary siteId={currentSite.id} token={sessionToken} onClose={()=>setMediaOpen(false)} onChoose={url=>{setContent({...content,heroImage:url});markDirty();setMediaOpen(false);}} />}
      <WebsiteEditorToolbar name={content.businessName || siteName} mode={activeTab} device={previewDevice} status={saveStatusText} published={currentSite.status==='published'} saving={isSaving} publishing={isPublishing}
        onExit={()=>{if(!isDirty || window.confirm('You have unsaved changes. Exit anyway?'))onClose();}} onMode={changeMode} onDevice={setPreviewDevice} onSave={()=>void handleSaveDraft()} onPublish={()=>void handlePublish()} onUnpublish={()=>void handleUnpublish()} onSettings={openSettings} onBrand={()=>selectTarget('branding')} onCopy={handleCopyLink} onFullPreview={()=>setIsPrivateFullPreviewOpen(true)} settingsOpen={allSettings} colorsOpen={activeTab==='edit' && visualSelection==='branding'} liveUrl={`/sites/${currentSite.slug}`}/>
      {/* =========================================================
          WORKSPACE: LEFT EDITOR / RIGHT LIVE PREVIEW
          ========================================================= */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Existing structured controls remain available without a competing draft store. */}
        {allSettings && <div inert={isPublishing} className="visual-all-settings">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700"><h3 className="font-bold">All Settings</h3><button type="button" className="visual-tool-button" onClick={()=>setAllSettings(false)}>Back to canvas</button></div>
          <label className="lg:hidden p-3 bg-[#070c10] border-b border-slate-800 text-xs text-slate-400">Editing
            <select aria-label="Editing area" value={activeSection} onChange={event=>setActiveSection(event.target.value as typeof activeSection)} className="block mt-1 w-full min-h-11 p-2 rounded-lg bg-slate-900 text-white border border-slate-700">
              {([['business','Business'],['contact','Contact'],['branding','Design'],['media','Images & Media'],['sections','Sections'],...(isDataReseller?[['bundles','Bundles & Pricing']]:[]),['cta','Main button'],['social','Social links']]).map(([id,label])=><option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          {/* Navigation Category Tabs */}
          <div className="hidden lg:flex p-2.5 sm:p-3 border-b border-slate-800/80 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0 bg-[#070c10]">
            <button
              type="button"
              onClick={() => setActiveSection('business')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'business'
                  ? 'bg-[#00c365] text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Business</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('contact')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'contact'
                  ? 'bg-[#00c365] text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Contact</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('branding')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'branding'
                  ? 'bg-[#00c365] text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Branding</span>
            </button>

            <button type="button" onClick={()=>setActiveSection('media')} className={`min-h-11 px-3 rounded-xl text-sm whitespace-nowrap ${activeSection==='media'?'bg-[#00c365] text-black':'bg-slate-900 text-slate-300'}`}><ImageIcon className="inline w-4 h-4 mr-2"/>Images &amp; Media</button>

            <button
              type="button"
              onClick={() => setActiveSection('sections')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'sections'
                  ? 'bg-[#00c365] text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Sections</span>
            </button>

            {isDataReseller && (
              <button
                type="button"
                onClick={() => setActiveSection('bundles')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeSection === 'bundles'
                    ? 'bg-[#00c365] text-black font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white bg-slate-900/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Bundles &amp; Pricing</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveSection('cta')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'cta'
                  ? 'bg-[#00c365] text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>Call To Action</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('social')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'social'
                  ? 'bg-[#00c365] text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Social</span>
            </button>
          </div>

          {/* Form Content Area */}
          <div inert={isPublishing} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* First-Use Onboarding Guidance Card */}
            {showOnboarding && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0c1824] to-[#0d141b] border border-[#00c365]/35 shadow-xl relative animate-in fade-in slide-in-from-top-2 text-left">
                <button
                  type="button"
                  onClick={dismissOnboarding}
                  className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Dismiss guide"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 mb-2 pr-6">
                  <div className="w-6 h-6 rounded-lg bg-[#00c365]/20 text-[#00c365] flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-bold text-sm text-white">Your website is ready to customise</h3>
                </div>

                <ol className="space-y-1.5 text-xs text-slate-300 ml-1 mb-3.5 list-decimal list-inside">
                  <li>Add your business details</li>
                  <li>Update your WhatsApp & contact numbers</li>
                  <li>Adjust branding colours and imagery</li>
                  <li>Preview your website across devices</li>
                  <li>Publish whenever you are ready</li>
                </ol>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      dismissOnboarding();
                      setActiveTab('edit');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs cursor-pointer active:scale-95 transition-all shadow-sm"
                  >
                    Start Editing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dismissOnboarding();
                      openMysteryAi('How do I customise and publish my new website?');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3 h-3 text-[#00c365]" />
                    <span>Ask Mystery AI</span>
                  </button>
                </div>
              </div>
            )}

            {/* 1. BUSINESS SECTION */}
            {activeSection === 'business' && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <h3 className="font-bold text-sm text-white">Business Details</h3>
                  <p className="text-xs text-slate-400">
                    The core identity shown across your hero banner, navigation, and footer.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300 block">Business Name</label>
                  <input
                    type="text"
                    value={content.businessName}
                    maxLength={100}
                    onChange={(e) => {
                      setContent({ ...content, businessName: e.target.value });
                      markDirty();
                    }}
                    placeholder={isDataReseller ? 'e.g. QuickByte Data' : 'e.g. Gold Coast Kitchen'}
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                  <p className="text-[11px] text-slate-500">
                    The official name of your business, store, or enterprise.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300 block">Hero Tagline</label>
                  <input
                    type="text"
                    value={content.tagline}
                    maxLength={150}
                    onChange={(e) => {
                      setContent({ ...content, tagline: e.target.value });
                      markDirty();
                    }}
                    placeholder={
                      isDataReseller
                        ? 'e.g. Affordable Data Bundles, Straight to Your Line'
                        : 'e.g. Discover what makes our business special'
                    }
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                  <p className="text-[11px] text-slate-500">
                    A catchy headline displayed prominently at the top of your homepage.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300 block">
                    About / Short Description
                  </label>
                  <textarea
                    rows={4}
                    value={content.aboutText}
                    maxLength={2000}
                    onChange={(e) => {
                      setContent({ ...content, aboutText: e.target.value });
                      markDirty();
                    }}
                    placeholder={
                      isDataReseller
                        ? 'e.g. Buy MTN, Telecel and AT bundles from one simple storefront. Choose your package, enter recipient phone number, and place your order through WhatsApp.'
                        : 'Describe your story, specialities, offerings, or mission...'
                    }
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365] leading-relaxed resize-none"
                  />
                  <p className="text-[11px] text-slate-500">
                    Tell your visitors what you offer, where you deliver, and why they should choose you.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Location & Operating Hours
                  </label>
                  <input
                    type="text"
                    value={content.location}
                    maxLength={150}
                    onChange={(e) => {
                      setContent({ ...content, location: e.target.value });
                      markDirty();
                    }}
                    placeholder={
                      isDataReseller
                        ? 'e.g. Spintex Road, Accra · Open 24/7 for WhatsApp Orders'
                        : 'e.g. Osu Oxford Street, Accra · Mon - Sun: 10AM - 10PM'
                    }
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                  <p className="text-[11px] text-slate-500">
                    Physical location or delivery regions, plus operating schedule.
                  </p>
                </div>
              </div>
            )}

            {/* 2. CONTACT SECTION */}
            {activeSection === 'contact' && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <h3 className="font-bold text-sm text-white">Contact & Communication</h3>
                  <p className="text-xs text-slate-400">
                    Configure direct customer contact channels for your website.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>WhatsApp Number</span>
                    <span className="text-[10px] text-[#00c365] font-bold">Primary for Orders</span>
                  </label>
                  <input
                    type="tel"
                    value={content.whatsapp}
                    maxLength={30}
                    onChange={(e) => {
                      setContent({ ...content, whatsapp: e.target.value });
                      markDirty();
                    }}
                    placeholder="e.g. +233 24 123 4567"
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Powers direct one-tap customer orders & chat inquiries from your website button.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300 block">Phone Call Number</label>
                  <input
                    type="tel"
                    value={content.phone}
                    maxLength={30}
                    onChange={(e) => {
                      setContent({ ...content, phone: e.target.value });
                      markDirty();
                    }}
                    placeholder="e.g. +233 30 222 8899"
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                  <p className="text-[11px] text-slate-500">
                    Direct phone number for voice customer support calls.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300 block">Customer Email</label>
                  <input
                    type="email"
                    value={content.email}
                    maxLength={100}
                    onChange={(e) => {
                      setContent({ ...content, email: e.target.value });
                      markDirty();
                    }}
                    placeholder="e.g. orders@mybusiness.com"
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                  <p className="text-[11px] text-slate-500">
                    Official email address for customer inquiries and quotes.
                  </p>
                </div>
              </div>
            )}

            {activeSection === 'media' && <section className="space-y-5">
              <div><h3 className="text-lg font-semibold">Images &amp; Media</h3><p className="text-sm text-slate-400 mt-2">Upload once, reuse across your website. Choose your cover image and logo here.</p></div>
              <WebsiteImageField label="Cover image" value={content.heroImage} siteId={currentSite.id} token={sessionToken} onChange={url=>{setContent({...content,heroImage:url});markDirty();}} />
              <WebsiteImageField label="Business logo" value={content.logoUrl||''} siteId={currentSite.id} token={sessionToken} onChange={url=>{setContent({...content,logoUrl:url});markDirty();}} />
              <button type="button" className="mh-button-secondary" onClick={()=>setMediaOpen(true)}>Open media library for cover image</button>
              <p className="text-sm text-slate-400">Images used on a published website are public. Keep identity documents and private photos out of your library.</p>
            </section>}

            {/* 3. BRANDING SECTION */}
            {activeSection === 'branding' && (
              <div className="space-y-5 animate-in fade-in">
                <div>
                  <h3 className="font-bold text-sm text-white">Branding & Imagery</h3>
                  <p className="text-xs text-slate-400">
                    Choose colours and images that feel like your business.
                  </p>
                </div>

                {/* Brand Colors Grid */}
                <div className="p-3.5 rounded-2xl bg-[#090f15] border border-slate-800/80 space-y-3">
                  <span className="text-xs font-bold text-white block">Brand Colors</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 text-left">
                      <label className="text-[11px] font-semibold text-slate-300 block">
                        Primary Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.primaryColor}
                          onChange={(e) => {
                            setSettings({ ...settings, primaryColor: e.target.value });
                            markDirty();
                          }}
                          className="w-8 h-8 rounded-lg border border-slate-700 bg-transparent cursor-pointer p-0 shrink-0"
                        />
                        <input
                          type="text"
                          value={settings.primaryColor}
                          onChange={(e) => {
                            setSettings({ ...settings, primaryColor: e.target.value });
                            markDirty();
                          }}
                          className="w-full bg-[#111922] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#00c365]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[11px] font-semibold text-slate-300 block">
                        Accent Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.accentColor}
                          onChange={(e) => {
                            setSettings({ ...settings, accentColor: e.target.value });
                            markDirty();
                          }}
                          className="w-8 h-8 rounded-lg border border-slate-700 bg-transparent cursor-pointer p-0 shrink-0"
                        />
                        <input
                          type="text"
                          value={settings.accentColor}
                          onChange={(e) => {
                            setSettings({ ...settings, accentColor: e.target.value });
                            markDirty();
                          }}
                          className="w-full bg-[#111922] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#00c365]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hero / Cover Image Asset Container */}
                <div className="p-3.5 rounded-2xl bg-[#090f15] border border-slate-800/80 space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white block">Hero / Cover Image</span>
                    {content.heroImage && (
                      <button
                        type="button"
                        onClick={() => {
                          setContent({ ...content, heroImage: '' });
                          markDirty();
                        }}
                        className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                      >
                        Reset to default
                      </button>
                    )}
                  </div>

                  {/* Image Preview Box */}
                  <div className="relative h-32 rounded-xl overflow-hidden border border-slate-800 bg-[#060a0e] flex items-center justify-center">
                    {content.heroImage ? (
                      <SafeImage
                        src={content.heroImage}
                        alt="Hero banner preview"
                        className="w-full h-full object-cover"
                      />
                    ) : baseTemplate.heroImage ? (
                      <div className="relative w-full h-full">
                        <SafeImage
                          src={baseTemplate.heroImage}
                          alt="Template default banner"
                          className="w-full h-full object-cover opacity-60"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-[11px] text-slate-300 font-semibold bg-black/60 px-2.5 py-1 rounded-full border border-slate-700">
                            Using template default artwork
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-3 text-slate-500 space-y-1">
                        <ImageIcon className="w-6 h-6 mx-auto opacity-50" />
                        <span className="text-xs block">No custom image set</span>
                      </div>
                    )}
                  </div>

                  <WebsiteImageField label="Hero / Cover Image" value={content.heroImage} siteId={currentSite.id} token={sessionToken} onChange={url=>{setContent({...content,heroImage:url});markDirty();}} />
                </div>

                {/* Brand Logo Asset Container */}
                <div className="p-3.5 rounded-2xl bg-[#090f15] border border-slate-800/80 space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white block">Brand Logo (Optional)</span>
                    {content.logoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setContent({ ...content, logoUrl: '' });
                          markDirty();
                        }}
                        className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                      >
                        Clear logo
                      </button>
                    )}
                  </div>

                  {content.logoUrl && (
                    <div className="h-16 rounded-xl border border-slate-800 bg-[#060a0e] flex items-center justify-center p-2">
                      <img
                        src={content.logoUrl}
                        alt="Brand logo"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  <WebsiteImageField label="Brand Logo" value={content.logoUrl || ''} siteId={currentSite.id} token={sessionToken} onChange={url=>{setContent({...content,logoUrl:url});markDirty();}} />
                </div>
              </div>
            )}

            {/* 4. SECTIONS TAB */}
            {activeSection === 'sections' && (
              <div className="animate-in fade-in">
                <WebsiteSectionsControl
                  templateId={currentSite.template_id}
                  siteId={currentSite.id}
                  token={sessionToken}
                  content={content}
                  onChange={(next) => {
                    setContent(next);
                    markDirty();
                  }}
                />
              </div>
            )}

            {/* Managed bundle prices are authoritative business settings, not template content. */}
            {isDataReseller && activeSection === 'bundles' && <div className="space-y-4">
              <h3 className="font-bold text-white">Your bundles & pricing</h3>
              <p className="text-sm text-slate-400">Choose which bundles appear on your store and set your selling prices. Your work here will be saved before opening pricing.</p>
              <button type="button" className="min-h-11 px-4 py-3 rounded-xl bg-emerald-500 text-black font-bold" disabled={isSaving||isPublishing} onClick={async()=>{if(isDirty && !(await handleSaveDraft()))return;(onOpenPricing||onClose)();}}>Open Bundles &amp; Pricing</button>
            </div>}

            {/* 6. CALL TO ACTION SECTION */}
            {activeSection === 'cta' && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <h3 className="font-bold text-sm text-white">Call to Action</h3>
                  <p className="text-xs text-slate-400">
                    The primary button customers click to buy, book, or inquire.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300 block">Button Label</label>
                  <input
                    type="text"
                    value={content.ctaLabel}
                    maxLength={50}
                    onChange={(e) => {
                      setContent({ ...content, ctaLabel: e.target.value });
                      markDirty();
                    }}
                    placeholder={
                      isDataReseller ? 'e.g. Buy Data or Order via WhatsApp' : 'e.g. Order via WhatsApp, Book a Table, Get Quote'
                    }
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                  <p className="text-[11px] text-slate-500">
                    Text displayed on the main action button in your header and hero banner.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300 block">Button Action / WhatsApp Target</label>
                  <input
                    type="text"
                    disabled={isDataReseller}
                    value={content.ctaTarget}
                    maxLength={300}
                    onChange={(e) => {
                      setContent({ ...content, ctaTarget: e.target.value });
                      markDirty();
                    }}
                    placeholder="e.g. +233 24 123 4567 or https://wa.me/..."
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                  <p className="text-[11px] text-slate-400">
                    {isDataReseller ? 'Managed store buttons open the protected bundle catalog. Configure contact details separately.' : 'Leave blank to automatically route to your WhatsApp contact number.'}
                  </p>
                </div>
              </div>
            )}

            {/* 7. SOCIAL MEDIA SECTION */}
            {activeSection === 'social' && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <h3 className="font-bold text-sm text-white">Social Media Profiles</h3>
                  <p className="text-xs text-slate-400">
                    Optional links displayed on your published website footer.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300 block">Instagram Handle / URL</label>
                  <input
                    type="text"
                    value={content.social?.instagram || ''}
                    maxLength={50}
                    onChange={(e) => {
                      setContent({
                        ...content,
                        social: { ...content.social, instagram: e.target.value },
                      });
                      markDirty();
                    }}
                    placeholder="e.g. @mybusiness or https://instagram.com/..."
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300 block">Facebook Page URL</label>
                  <input
                    type="text"
                    value={content.social?.facebook || ''}
                    maxLength={100}
                    onChange={(e) => {
                      setContent({
                        ...content,
                        social: { ...content.social, facebook: e.target.value },
                      });
                      markDirty();
                    }}
                    placeholder="e.g. https://facebook.com/mybusiness"
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300 block">TikTok Handle</label>
                  <input
                    type="text"
                    value={content.social?.tiktok || ''}
                    maxLength={50}
                    onChange={(e) => {
                      setContent({
                        ...content,
                        social: { ...content.social, tiktok: e.target.value },
                      });
                      markDirty();
                    }}
                    placeholder="e.g. @mybusiness"
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>}
        <div className="visual-canvas">
          {activeTab==='edit' && !canvasHintSeen && !visualSelection && !allSettings && <div className="visual-canvas-hint" role="note"><span>Tap a heading, photo or contact detail to change it</span><button type="button" aria-label="Dismiss tip" onClick={()=>setCanvasHintSeen(true)}><X size={15}/></button></div>}
          {activeTab==='preview' && !previewHintSeen && <div className="visual-canvas-hint is-preview" role="note"><Eye size={15}/><span>Preview of your draft · payments are off</span><button type="button" aria-label="Dismiss preview note" onClick={()=>setPreviewHintSeen(true)}><X size={15}/></button></div>}
          <div ref={canvasRef} className="visual-canvas-viewport">
            <div style={{width:effectiveCanvasWidth, flexShrink:0, height:scale<1 ? 'calc(100% / '+scale+')' : '100%', transform:scale<1 ? 'scale('+scale+')' : undefined, transformOrigin:'top center'}} className="visual-canvas-page">
              <WebsitePreviewFrame template={previewTemplate} siteId={currentSite.id} viewportWidth={targetWidth} editMode={activeTab==='edit' && !isPublishing} selectedTarget={visualSelection} onSelect={selectTarget} onOrder={setTargetOrder} focusRequest={focusRequest} reserveBottom={contextualTargets.length>0 || settingsNotice ? sheetReserve : 0}/>
            </div>
          </div>
        </div>
        {activeTab==='edit' && contextualTargets.length>0 && <div className="contents" inert={isPublishing}><VisualContextPanel title={visualSelection==='branding'?'Website colors':selected!.label} targets={contextualTargets} siteId={currentSite.id} token={sessionToken} onChange={editVisualValue} onDone={clearSelection} onAllSettings={openSettings} position={stepIndex>=0?{index:stepIndex,total:stepIds.length}:undefined} onPrevious={()=>step(-1)} onNext={()=>step(1)}/></div>}
        {activeTab==='edit' && settingsNotice && !contextualTargets.length && <VisualContextPanel notice title="Change this in All Settings" targets={[]} siteId={currentSite.id} token={sessionToken} onChange={editVisualValue} onDone={clearSelection} onAllSettings={openSettings}/>}
      </div>

      {/* =========================================================
          PRIVATE FULL PREVIEW OVERLAY
          ========================================================= */}
      {isPrivateFullPreviewOpen && (
        <div className="fixed inset-0 z-[100] bg-[#060a0e] text-slate-100 flex flex-col font-sans overflow-hidden animate-in fade-in duration-200">
          {/* Private Preview Top Bar */}
          <div className="h-14 px-3 sm:px-6 bg-[#0a1117] border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 select-none">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsPrivateFullPreviewOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Exit Preview</span>
              </button>

              <div className="hidden sm:flex items-center gap-2 min-w-0">
                <span className="font-bold text-xs sm:text-sm text-white truncate max-w-[160px]">
                  {content.businessName || siteName}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    currentSite.status === 'published'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  Draft Preview
                </span>
              </div>
            </div>

            {/* Viewport controls */}
            <div className="flex items-center gap-1 bg-[#05090d] border border-slate-800 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  previewDevice === 'desktop'
                    ? 'bg-[#00c365] text-black font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Desktop (1280px)"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('tablet')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  previewDevice === 'tablet'
                    ? 'bg-[#00c365] text-black font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Tablet (768px)"
              >
                <Tablet className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Tablet</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  previewDevice === 'mobile'
                    ? 'bg-[#00c365] text-black font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Mobile (375px)"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Mobile</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {currentSite.status === 'published' && (
                <a
                  href={`/sites/${currentSite.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5 transition-colors"
                >
                  <span>View Live</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Full Preview Body */}
          <div className="flex-1 overflow-auto bg-[#040608] flex justify-center items-start p-0 sm:p-4">
            <div
              className={`w-full bg-white text-slate-900 min-h-full shadow-2xl transition-all ${
                previewDevice === 'mobile'
                  ? 'max-w-[375px] sm:rounded-2xl sm:my-4 sm:border sm:border-slate-700'
                  : previewDevice === 'tablet'
                  ? 'max-w-3xl sm:rounded-2xl sm:my-4 sm:border sm:border-slate-700'
                  : 'max-w-[1280px] sm:rounded-2xl sm:my-4 sm:border sm:border-slate-700'
              }`}
            >
              <div className="h-[75dvh] min-h-[480px]"><WebsitePreviewFrame template={previewTemplate} siteId={currentSite.id} viewportWidth={targetWidth} /></div>
              {/* Free Tier Attribution */}
              <div className="py-4 px-4 bg-[#090d11] border-t border-slate-800 text-center text-xs text-slate-400 select-none">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#00c365]" />
                  <span>Powered by</span>
                  <span className="font-bold text-[#00c365]">Mystery Hub</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
