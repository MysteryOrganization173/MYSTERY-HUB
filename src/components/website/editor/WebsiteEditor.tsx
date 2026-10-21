import {VisualContextPanel} from './VisualContextPanel';
import {WebsiteEditorToolbar} from './WebsiteEditorToolbar';
import {visualTargets, applyVisualValue} from '../../../utils/websiteVisualEditing';
import { WebsitePreviewFrame } from '../WebsitePreviewFrame';
import { WebsiteImageLibrary, WebsiteImageField } from './WebsiteImageField';
import { trackWebsiteEvent } from '../../../utils/websiteAnalytics';
import React, { useState, useEffect, useRef } from 'react';
import { WebsiteSiteRecord, SiteContent, SiteSettings, WebsiteTemplate } from '../../../types';
import { updateWebsiteOnServer, unpublishWebsiteOnServer, getWebsiteByIdOnServer, WebsiteSaveConflict } from '../../../services/apiClient';
import { WebsiteConflictSheet, WebsiteRecoveryBanner, readDraftRecovery, writeDraftRecovery, clearDraftRecovery, type DraftRecovery } from './WebsiteDraftSafety';
import { getTemplateById, mergeSiteWithTemplate, renderTemplateLayout } from '../../../utils/templateRendererUtils';
import { useApp } from '../../../context/AppContext';
import { WebsiteSectionsControl } from './WebsiteSectionsControl';
import { SafeImage } from '../SafeImage';
import { WebsiteItemPanel } from './WebsiteItemPanel';
import { WebsiteFeaturedBundlesControl, WebsiteGalleryControl, WebsiteHoursControl, WebsiteImageDetails, WebsitePageSectionsControl, WebsitePaletteControl, WebsitePoliciesControl } from './WebsiteV5Controls';
import { applyUndo, pushUndo, undoDiff, undoLabel, type UndoDraft, type UndoEntry } from '../../../utils/websiteUndo';
import { WEBSITE_SECTION_REGISTRY } from '../../../config/websiteContentV5';
import { websitePublishChanges } from '../../../utils/websitePublishChanges';
import { withV5Clears } from '../../../utils/websiteDraftRecovery';
import { WebsiteItemsList } from './WebsiteItemsList';
import { WebsitePublishSheet } from './WebsitePublishSheet';
import { WebsiteLayoutControl, WebsiteHistoryControl } from './WebsiteLayoutAndHistory';
import { publishWebsiteB1, reviewWebsiteExamples, setWebsiteLayout, restoreWebsiteDraft, discardWebsiteCheckpoint, WebsiteB1Error } from '../../../services/websiteB1Api';
import { websiteItemVocabulary, websiteStarterWording } from '../../../config/websiteStarters';
import { websiteTemplateItemFields } from '../../../config/websiteBuilder';
import { websiteLayoutMode, type WebsiteLayoutMode } from '../../../utils/websiteLayout';
import type { TemplateItem } from '../../../types';
import { DATA_RESELLER_STARTER_HERO_IMAGE, resolveDataResellerHeroImage, showsLegacyDataResellerArtwork } from '../../../utils/dataResellerArtwork';
import {
  ArrowLeft,
  Save,
  Globe,
  Eye,
  Check,
  ExternalLink,
  Copy,
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
  UtensilsCrossed,
  History,
  Clock,
} from 'lucide-react';

interface WebsiteEditorProps {
  site: WebsiteSiteRecord;
  sessionToken: string;
  onClose: () => void;
  onOpenPricing?: () => void;
  onSiteUpdated: (updatedSite: WebsiteSiteRecord) => void;
  /** Open the publish checklist straight away (the dashboard's Publish button). */
  openPublish?: boolean;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const WebsiteEditor: React.FC<WebsiteEditorProps> = ({
  site: initialSite,
  sessionToken,
  onClose,
  onOpenPricing,
  onSiteUpdated,
  openPublish = false,
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
  const [saveStatusText, setSaveStatusText] = useState<'saved' | 'saving' | 'unsaved' | 'failed' | 'offline'>('saved');
  const [conflict, setConflict] = useState<WebsiteSiteRecord | null>(null);
  const [recovery, setRecovery] = useState<DraftRecovery | null>(() => readDraftRecovery(initialSite));
  const [isPublishing, setIsPublishing] = useState(false);

  // View Mode: 'edit' or 'preview' (on mobile)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [allSettings, setAllSettings] = useState(false);
  const [visualSelection, setVisualSelection] = useState<string|null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  // A tap on content that has no tap-to-edit field explains where to change it.
  const [settingsNotice, setSettingsNotice] = useState<false|'settings'|'pricing'>(false);
  // Rendered targets in reading order, reported by the draft frame, for Previous/Next.
  const [targetOrder, setTargetOrder] = useState<string[]>([]);
  const [canvasHintSeen, setCanvasHintSeen] = useState(false);
  const [previewHintSeen, setPreviewHintSeen] = useState(false);
  const clearSelection = () => {setVisualSelection(null);setSettingsNotice(false);setFocusRequest(n=>n+1);};
  const selectTarget = (id:string|null, hint?:'settings'|'pricing') => {setAllSettings(false);setVisualSelection(id);setSettingsNotice(!id && hint ? (hint==='pricing' && isDataReseller ? 'pricing' : 'settings') : false);if(id || hint)setCanvasHintSeen(true);};
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
    'business' | 'contact' | 'items' | 'hours' | 'branding' | 'media' | 'sections' | 'bundles' | 'cta' | 'social' | 'history'
  >('business');
  const [publishOpen, setPublishOpen] = useState(openPublish);
  // B1 server actions (review, layout, restore) run against the saved draft; the editor waits for them.
  const [serverBusy, setServerBusy] = useState(false);
  const word = websiteItemVocabulary(currentSite.template_id);
  const itemFields = websiteTemplateItemFields(currentSite.template_id);
  const layoutMode: WebsiteLayoutMode = websiteLayoutMode(currentSite.template_id, content);

  // Template identity changes must discard old template-specific controls and draft state.
  useEffect(() => {
    setCurrentSite(initialSite); setSiteName(initialSite.name);
    setContent(initialSite.content_json); setSettings(initialSite.settings_json);
    serverSiteRef.current = initialSite;
    editVersion.current = 0; savedVersion.current = 0; failedSaveVersion.current = null;
    setIsDirty(false); setSaveStatusText('saved'); setActiveSection('business');
    setVisualSelection(null);setSettingsNotice(false);setTargetOrder([]);setAllSettings(false);setActiveTab('edit');setFocusRequest(0);
  }, [initialSite.id, initialSite.template_id]);

  // Undo: every edit is diffed against the last draft the owner saw; server adoption is never an edit.
  const undoStack = useRef<UndoEntry[]>([]), [undoTop, setUndoTop] = useState<UndoEntry | null>(null);
  const historyBase = useRef<UndoDraft>({content: initialSite.content_json as any, settings: initialSite.settings_json as any});
  const historySeen = useRef(0), undoing = useRef(false);
  useEffect(() => {
    const now = {content: content as any, settings: settings as any};
    if (editVersion.current !== historySeen.current && !undoing.current) {
      undoStack.current = pushUndo(undoStack.current, undoDiff(historyBase.current, now), Date.now());
      setUndoTop(undoStack.current[undoStack.current.length - 1] || null);
    }
    undoing.current = false; historySeen.current = editVersion.current; historyBase.current = now;
  }, [content, settings]);
  useEffect(() => { undoStack.current = []; setUndoTop(null); historyBase.current = {content: initialSite.content_json as any, settings: initialSite.settings_json as any}; historySeen.current = 0; }, [initialSite.id, initialSite.template_id]);

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
        const res=await updateWebsiteOnServer(sessionToken,currentSite.id,{...snapshot,content:withV5Clears(serverSiteRef.current.content_json,snapshot.content),expectedUpdatedAt:serverSiteRef.current.updated_at});
        failedSaveVersion.current=null;
        serverSiteRef.current=res.site;setCurrentSite(res.site);onSiteUpdated(res.site);savedVersion.current=version;
        const unchanged=editVersion.current===version;
        setIsDirty(!unchanged);setSaveStatusText(unchanged?'saved':'unsaved');
        if(unchanged){setSiteName(res.site.name);setContent(res.site.content_json);setSettings(res.site.settings_json);}
        return res.site;
      } catch(err:any) {
        failedSaveVersion.current=version;
        if(err instanceof WebsiteSaveConflict){
          // Someone saved this website elsewhere. Nothing is overwritten until the owner chooses.
          try{const latest=(await getWebsiteByIdOnServer(sessionToken,currentSite.id)).site;setConflict(latest);}catch{showToast(err.message,'warning');}
          setSaveStatusText('failed');return null;
        }
        const offline=typeof navigator!=='undefined' && navigator.onLine===false || err instanceof TypeError;
        setSaveStatusText(offline?'offline':'failed');
        if(!offline)showToast(err.message || 'Failed to save changes.','warning');
        return null;
      }
      finally {setIsSaving(false);savingJob.current=null;}
    })();
    savingJob.current=job;return job;
  };

  // Unsaved edits are also kept on this device, so a lost connection or a closed tab never loses them.
  useEffect(() => {
    if (isDirty) writeDraftRecovery(currentSite.id, {templateId:currentSite.template_id,base: serverSiteRef.current.updated_at, name: siteName, content, settings});
    else if (saveStatusText === 'saved' && !recovery) clearDraftRecovery(currentSite.id,currentSite.template_id);
  }, [isDirty, siteName, content, settings, saveStatusText, recovery]);
  const retryRef = useRef(() => {});
  retryRef.current = () => { if (failedSaveVersion.current !== null && !conflict) { failedSaveVersion.current = null; void handleSaveDraft(); } };
  useEffect(() => {
    const online = () => retryRef.current();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, []);

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
  const handlePublish = async (): Promise<boolean> => {
    if(publicationJob.current)return false;
    publicationJob.current=true;setIsPublishing(true);
    try {
      if(savingJob.current && !(await savingJob.current))throw new Error('Save failed. Publishing was stopped.');
      if(editVersion.current!==savedVersion.current && !(await handleSaveDraft()))throw new Error('Save failed. Publishing was stopped.');
      if(editVersion.current!==savedVersion.current)throw new Error('Your draft changed during saving. Save it before publishing.');
      const version=savedVersion.current;
      // The B1 publisher returns the example-review gate as structured detail, not a bare failure.
      const res=await publishWebsiteB1(sessionToken,currentSite.id,serverSiteRef.current.updated_at);
      if(!res.success || !res.site)throw new Error('Publication was not confirmed. Check your website before retrying.');
      serverSiteRef.current=res.site;setCurrentSite(res.site);onSiteUpdated(res.site);
      const unchanged=editVersion.current===version;setIsDirty(!unchanged);setSaveStatusText(unchanged?'saved':'unsaved');
      return true;
    } catch(err:any){
      if(err instanceof WebsiteB1Error && err.code==='EXAMPLE_REVIEW_REQUIRED'){setPublishOpen(true);showToast('Keep or remove the example items first. Your live website has not changed.','info');}
      else showToast(err.message || 'Failed to publish website.','warning');
      return false;
    }
    finally{publicationJob.current=false;setIsPublishing(false);}
  };

  // Adopt a server-returned draft. Local edits made while the request ran are never overwritten.
  const adoptServerSite = (site: WebsiteSiteRecord, version: number) => {
    serverSiteRef.current=site;setCurrentSite(site);onSiteUpdated(site);
    if(editVersion.current!==version)return false;
    draftRef.current={name:site.name,content:site.content_json,settings:site.settings_json};
    setSiteName(site.name);setContent(site.content_json);setSettings(site.settings_json);
    savedVersion.current=version;setIsDirty(false);setSaveStatusText('saved');
    return true;
  };
  // B1 actions are checked against the saved revision, so pending edits are saved first.
  const withSavedDraft = async <T,>(work: (revision: string, version: number) => Promise<T>): Promise<T> => {
    if(publicationJob.current)throw new Error('Wait for publishing to finish.');
    setServerBusy(true);
    try {
      if(savingJob.current)await savingJob.current;
      if(editVersion.current!==savedVersion.current && !(await handleSaveDraft()))throw new Error('Your latest changes could not be saved. Try again.');
      return await work(serverSiteRef.current.updated_at, editVersion.current);
    } finally {setServerBusy(false);}
  };
  const reviewItems = async (ids: string[], action: 'confirm' | 'remove') => {
    try {
      await withSavedDraft(async (revision, version) => {
        const {site} = await reviewWebsiteExamples(sessionToken, currentSite.id, revision, ids, action);
        if(!adoptServerSite(site, version)){
          // Edits arrived meanwhile: apply only the review decision to the local draft.
          const items=(draftRef.current.content.items||[]).flatMap(item=>!item.id||!ids.includes(item.id)?[item]:action==='remove'?[]:[{...item,isExample:false}]);
          const next={...draftRef.current.content,items};draftRef.current={...draftRef.current,content:next};setContent(next);
        }
      });
      if(action==='remove' && visualSelection && ids.includes(visualSelection.slice(5)))setVisualSelection(null);
      showToast(action==='confirm' ? (ids.length===1?'Kept. It will appear on your website.':'Kept.') : 'Removed.', 'success');
      return true;
    } catch(err:any){showToast(err.message || 'That did not work. Try again.','warning');return false;}
  };
  const changeLayout = (mode: WebsiteLayoutMode) => withSavedDraft(async (revision, version) => {
    const {site} = await setWebsiteLayout(sessionToken, currentSite.id, revision, mode);
    adoptServerSite(site, version);
    showToast(mode==='sections'?'Custom sections are on. Your designed layout is kept.':'Your page is back to the designed layout.','success');
  });

  // Menu dishes, services, rooms and products: edited in place, saved through the normal draft.
  const items = content.items || [];
  const selectedItemId = visualSelection?.startsWith('item:') ? visualSelection.slice(5) : null;
  const selectedItemIndex = selectedItemId ? items.findIndex(item => item.id === selectedItemId) : -1;
  const updateItems = (next: TemplateItem[]) => {
    const draft=draftRef.current, nextContent={...draft.content,items:next};
    draftRef.current={...draft,content:nextContent};setContent(nextContent);markDirty();
  };
  const updateItem = (id: string, patch: Partial<TemplateItem>) => updateItems((draftRef.current.content.items||[]).map(item=>item.id===id?{...item,...patch}:item));
  const addItem = () => {
    const current=draftRef.current.content.items||[];
    if(current.length>=50){showToast(`You can add up to 50 ${word.many}.`,'info');return;}
    const id=`item-${crypto.randomUUID()}`;
    updateItems([...current,{id,name:`New ${word.singular.toLowerCase()}`}]);
    setAllSettings(false);setActiveTab('edit');setVisualSelection(`item:${id}`);
  };
  const removeItem = (id: string) => {
    const item=items.find(item=>item.id===id);
    if(item?.isExample){void reviewItems([id],'remove');return;}
    if(!window.confirm(`Remove "${item?.name || word.singular}" from your website?`))return;
    updateItems((draftRef.current.content.items||[]).filter(item=>item.id!==id));setVisualSelection(null);
  };
  const openItem = (id: string) => {setPublishOpen(false);setAllSettings(false);setActiveTab('edit');setVisualSelection(`item:${id}`);setCanvasHintSeen(true);};
  const stepItem = (delta: number) => {
    if(selectedItemIndex<0 || !items.length)return;
    const next=items[(selectedItemIndex+delta+items.length)%items.length];
    if(next?.id)setVisualSelection(`item:${next.id}`);
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

  const changeContent = (patch: Partial<SiteContent>) => {
    const next={...draftRef.current.content,...patch} as SiteContent;
    for(const key of Object.keys(patch) as (keyof SiteContent)[]) if(patch[key]===undefined) delete next[key];
    draftRef.current={...draftRef.current,content:next};setContent(next);markDirty();
  };
  const handleUndo = () => {
    if (isPublishing || serverBusy) return;
    const result = applyUndo(undoStack.current, {content: draftRef.current.content as any, settings: draftRef.current.settings as any});
    undoStack.current = result.stack; setUndoTop(result.stack[result.stack.length - 1] || null);
    if (!result.entry) return;
    undoing.current = true;
    const next = {...draftRef.current, content: result.draft.content as SiteContent, settings: result.draft.settings as SiteSettings};
    draftRef.current = next; setContent(next.content); setSettings(next.settings); markDirty();
    showToast(`Undone: ${undoLabel(result.entry)}.`, 'info');
  };
  const undoRef = useRef(handleUndo); undoRef.current = handleUndo;
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z' || target?.closest('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault(); undoRef.current();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

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
  // Phones always edit at phone size: tapping text on a page shrunk to a third of the screen is not
  // usable. Tablet and Desktop sizes are previews there.
  const isPhone = typeof window !== 'undefined' && window.innerWidth < 640;
  const canvasDevice = isPhone && activeTab === 'edit' ? 'mobile' : previewDevice;
  // On a phone the phone-size canvas is the screen itself, rendered 1:1 rather than a 375px page
  // shrunk to fit a 360px screen.
  const targetWidth = canvasDevice === 'mobile' ? (isPhone && canvasDimensions.width ? Math.max(320, Math.round(canvasDimensions.width)) : 375) : canvasDevice === 'tablet' ? 768 : 1280;
  const paddingX = isPhone ? 0 :
    previewDevice === 'desktop' || previewDevice === 'tablet' ? (isMobileScreen ? 8 : 16) : 16;
  const usableWidth = Math.max(240, availableWidth - paddingX);

  const isWidePreviewOnSmallScreen = false; // Scale a fixed iframe viewport; never shrink its media-query width.
  const effectiveCanvasWidth = targetWidth;
  const scale = isWidePreviewOnSmallScreen ? 1 : Math.min(1, usableWidth / targetWidth);

  const targets = visualTargets(previewTemplate);
  const selected = targets.find(t=>t.id===visualSelection);
  const contextualTargets = visualSelection==='branding' ? targets.filter(t=>t.source.kind==='settings') : selected ? [selected,...(selected.destinationId ? targets.filter(t=>t.id===selected.destinationId) : [])] : [];
  // The design's suggested headline and description stay marked until the owner changes them.
  const starterWording = content.starterVersion ? websiteStarterWording(currentSite.template_id) : undefined;
  const suggestedFields = starterWording && layoutMode==='template' ? (['tagline','aboutText'] as const).filter(field=>content[field]===starterWording[field]).map(field=>`content:${field}`) : [];
  const publishSuggestions = [
    ...suggestedFields.map(id=>({label:id==='content:tagline'?'your headline':'your description',target:id})),
    ...(layoutMode==='template' && !isDataReseller && content.heroImage && content.heroImage===baseTemplate.heroImage?[{label:'the main photo',target:'content:heroImage'}]:[]),
  ];
  const cardButton = targets.find(t=>t.source.kind==='copy' && t.id.endsWith('.itemButton'));
  const editVisualValue = (id:string,value:string) => {
    if(isPublishing)return;
    const draft=draftRef.current;
    const next=applyVisualValue(draft.content,draft.settings,mergeSiteWithTemplate(baseTemplate,draft.content,draft.settings),id,value);
    if(!next)return;
    draftRef.current={...draft,...next};setContent(next.content);setSettings(next.settings);markDirty();
  };
  type Area = [typeof activeSection, string, typeof Building];
  const settingsAreas: Area[] = [['business','Business',Building],['contact','Contact',Phone],...(isDataReseller||currentSite.template_id==='tmpl-start-blank'?[]:[['items',word.plural,UtensilsCrossed] as Area,['hours','Hours & policies',Clock] as Area]),['branding','Colors',Palette],['media','Images',ImageIcon],...(isDataReseller?[['bundles','Bundles & pricing',Layers] as Area]:[]),['sections','Layout',Layers],['cta','Main button',MousePointerClick],['social','Social links',Share2],['history','History',History]];
  const openSettings=(section?: typeof activeSection)=>{setAllSettings(true);setVisualSelection(null);setSettingsNotice(false);if(section)setActiveSection(section);};
  const locked = isPublishing || serverBusy;
  // Previous/Next walk the page in reading order; fall back to the schema order before the frame reports.
  const stepIds = (targetOrder.length ? targetOrder : targets.map(t=>t.id)).filter(id=>targets.some(t=>t.id===id && t.source.kind!=='settings'));
  const stepIndex = selected ? stepIds.indexOf(selected.id) : -1;
  const step = (delta:number) => {if(stepIndex<0 || !stepIds.length)return;setVisualSelection(stepIds[(stepIndex+delta+stepIds.length)%stepIds.length]);};
  // Phones and tablets show the panel as a bottom sheet over roughly half of the canvas.
  const sheetReserve = typeof window!=='undefined' && window.innerWidth<1024 ? 0.5 : 0;

  return (
    <div ref={workspaceRef} role="dialog" aria-modal="true" aria-label="Website editor" className="visual-workspace fixed inset-0 z-[80] text-slate-100 flex flex-col font-sans overflow-hidden">
      {conflict && <WebsiteConflictSheet mine={{name: siteName, content, settings}} theirs={conflict} templateId={currentSite.template_id} word={word.singular.toLowerCase()}
        onKeepMine={()=>{serverSiteRef.current=conflict;setCurrentSite(conflict);setConflict(null);failedSaveVersion.current=null;void handleSaveDraft();}}
        onUseTheirs={()=>{const site=conflict;setConflict(null);failedSaveVersion.current=null;serverSiteRef.current=site;setCurrentSite(site);onSiteUpdated(site);draftRef.current={name:site.name,content:site.content_json,settings:site.settings_json};setSiteName(site.name);setContent(site.content_json);setSettings(site.settings_json);editVersion.current++;savedVersion.current=editVersion.current;historySeen.current=editVersion.current;setIsDirty(false);setSaveStatusText('saved');clearDraftRecovery(site.id,site.template_id);}}/>}
      {recovery && <WebsiteRecoveryBanner recovery={recovery} changedSince={recovery.base!==currentSite.updated_at}
        onRestore={()=>{const r=recovery;setRecovery(null);draftRef.current={name:r.name,content:r.content,settings:r.settings};setSiteName(r.name);setContent(r.content);setSettings(r.settings);markDirty();showToast('Your unsaved changes are back. Saving now.','success');}}
        onDiscard={()=>{setRecovery(null);clearDraftRecovery(currentSite.id,currentSite.template_id);}}/>}
      {publishOpen && <WebsitePublishSheet content={content} published={currentSite.status==='published'} publishedAt={currentSite.published_at} publicUrl={`${window.location.origin}/sites/${currentSite.slug}`} word={word} managed={isDataReseller}
        onReview={reviewItems} onEditItem={openItem} onPublish={handlePublish} onClose={()=>setPublishOpen(false)}
        suggestions={publishSuggestions} changes={websitePublishChanges(currentSite.published_snapshot_json, {templateId: currentSite.template_id, content, settings}, word.singular.toLowerCase())}
        onEditField={target=>{setPublishOpen(false);setActiveTab('edit');if(target==='name')selectTarget('content:businessName');else if(target==='contact')openSettings('contact');else selectTarget(target);}}/>}
      {mediaOpen && <WebsiteImageLibrary siteId={currentSite.id} token={sessionToken} onClose={()=>setMediaOpen(false)} onChoose={url=>{setContent({...content,heroImage:url});markDirty();setMediaOpen(false);}} />}
      <WebsiteEditorToolbar name={content.businessName || siteName} mode={activeTab} device={previewDevice} status={saveStatusText} published={currentSite.status==='published'} saving={isSaving} publishing={isPublishing}
        onExit={()=>{if(!isDirty || window.confirm('You have unsaved changes. Exit anyway?'))onClose();}} onMode={changeMode} onDevice={device=>{setPreviewDevice(device);if(isPhone && device!=='mobile')changeMode('preview');}} onSave={()=>void handleSaveDraft()} onPublish={()=>{setVisualSelection(null);setPublishOpen(true);}} onUnpublish={()=>void handleUnpublish()} onSettings={()=>openSettings()} onBrand={()=>selectTarget('branding')} onCopy={handleCopyLink} onFullPreview={()=>setIsPrivateFullPreviewOpen(true)} settingsOpen={allSettings} colorsOpen={activeTab==='edit' && visualSelection==='branding'} liveUrl={`/sites/${currentSite.slug}`} undoLabel={undoTop ? undoLabel(undoTop) : ''} onUndo={handleUndo} liveBehind={currentSite.status==='published' && websitePublishChanges(currentSite.published_snapshot_json, {templateId: currentSite.template_id, content: currentSite.content_json, settings: currentSite.settings_json}).length>0}/>
      {/* =========================================================
          WORKSPACE: LEFT EDITOR / RIGHT LIVE PREVIEW
          ========================================================= */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Existing structured controls remain available without a competing draft store. */}
        {allSettings && <div inert={locked} className="visual-all-settings">
          <div className="visual-settings-head">
            <button type="button" className="visual-settings-back" onClick={()=>setAllSettings(false)}><ArrowLeft size={18}/>Back to canvas</button>
            <h3>All settings</h3>
          </div>
          {/* One section row at every width, styled like the canvas tools rather than a native picker. */}
          <div role="tablist" aria-label="Editing area" className="visual-settings-tabs">
            {settingsAreas.map(([id,label,Icon])=><button key={id} type="button" role="tab" aria-selected={activeSection===id} onClick={()=>setActiveSection(id)}><Icon size={16} aria-hidden="true"/>{label}</button>)}
          </div>

          {/* Form Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
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
                    placeholder={isDataReseller ? 'e.g. Ama Data Hub' : 'e.g. Gold Coast Kitchen'}
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
                        ? 'e.g. MTN, Telecel and AirtelTigo bundles at fair prices. Choose a bundle, pay securely on this page and track your order. Message us on WhatsApp if you need help.'
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

            {activeSection === 'hours' && <div className="space-y-8">
              <p className="text-xs text-slate-400">These describe your business, not the design, so they stay when you switch designs. {['nightkitchen'].includes(baseTemplate.layoutType || '') ? 'Your design shows your hours and an “Open now” badge.' : ['boutique'].includes(baseTemplate.layoutType || '') ? 'Your design shows your delivery, payment and returns notes.' : 'The Night Kitchen and Boutique designs show them; this design keeps them safely for later.'}</p>
              <WebsiteHoursControl hours={content.hours} onChange={hours=>changeContent({hours:hours||undefined})}/>
              <WebsitePoliciesControl policies={content.policies} onChange={policies=>changeContent({policies})}/>
            </div>}

            {activeSection === 'media' && <section className="space-y-5">
              <div><h3 className="text-lg font-semibold">Images &amp; Media</h3><p className="text-sm text-slate-400 mt-2">Upload once, reuse across your website. Choose your cover image and logo here.</p></div>
              <WebsiteImageField label="Cover image" value={content.heroImage} siteId={currentSite.id} token={sessionToken} onChange={url=>{setContent({...content,heroImage:isDataReseller&&!url?DATA_RESELLER_STARTER_HERO_IMAGE:url});markDirty();}} />
              {!isDataReseller && content.heroImage && <details className="rounded-xl border border-slate-800 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-200 min-h-8">Cover photo focus and description</summary>
                <div className="mt-3"><WebsiteImageDetails src={content.heroImage} focal={content.imageMeta?.heroImage} alt={content.imageMeta?.heroImage?.alt} onChange={patch=>changeContent({imageMeta:{...(content.imageMeta||{}),heroImage:{...(content.imageMeta?.heroImage||{}),...(patch.x!==undefined?{x:patch.x,y:patch.y}:{}),...(patch.alt!==undefined?{alt:patch.alt||undefined}:{})}}})}/></div>
              </details>}
              <WebsiteImageField label="Business logo" value={content.logoUrl||''} siteId={currentSite.id} token={sessionToken} onChange={url=>{setContent({...content,logoUrl:url});markDirty();}} />
              {content.logoUrl && <div className="visual-field"><div className="visual-field-label"><label htmlFor="logo-alt">Logo description (optional)</label></div><input id="logo-alt" className="visual-input" maxLength={150} value={content.imageMeta?.logoUrl?.alt || ''} placeholder={`${content.businessName || 'Business'} logo`} onChange={e=>changeContent({imageMeta:{...(content.imageMeta||{}),logoUrl:{alt:e.target.value.replace(/[<>]/g,'')||undefined}}})}/></div>}
              {!isDataReseller && currentSite.template_id!=='tmpl-start-blank' && <WebsiteGalleryControl gallery={content.gallery} siteId={currentSite.id} token={sessionToken} onChange={gallery=>changeContent({gallery})}/>}
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

                <WebsitePaletteControl settings={settings} onApply={palette=>{const next={...draftRef.current.settings,backgroundColor:palette.backgroundColor,primaryColor:palette.primaryColor,accentColor:palette.accentColor};draftRef.current={...draftRef.current,settings:next};setSettings(next);markDirty();}}/>

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
                          setContent({ ...content, heroImage: isDataReseller ? DATA_RESELLER_STARTER_HERO_IMAGE : '' });
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
                    {content.heroImage || isDataReseller ? (
                      <SafeImage
                        src={isDataReseller ? resolveDataResellerHeroImage(content.heroImage, true) : content.heroImage}
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

                  {isDataReseller && showsLegacyDataResellerArtwork(content.heroImage) && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300 space-y-2">
                      <p>Your store shows the original Data store banner. It stays unless you change it. A plain starter image without any brand name is also available.</p>
                      <button type="button" className="min-h-11 px-3 rounded-xl border border-emerald-500/40 text-emerald-300" onClick={() => { setContent({ ...content, heroImage: DATA_RESELLER_STARTER_HERO_IMAGE }); markDirty(); }}>Use the neutral starter image</button>
                    </div>
                  )}
                  <WebsiteImageField label="Hero / Cover Image" value={content.heroImage} siteId={currentSite.id} token={sessionToken} onChange={url=>{setContent({...content,heroImage:isDataReseller&&!url?DATA_RESELLER_STARTER_HERO_IMAGE:url});markDirty();}} />
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
            {activeSection === 'sections' && layoutMode==='template' && WEBSITE_SECTION_REGISTRY[baseTemplate.layoutType || ''] && <div className="mb-6"><WebsitePageSectionsControl layout={baseTemplate.layoutType!} value={content.sections} onChange={sections=>changeContent({sections})}/></div>}
            {activeSection === 'sections' && (
              <WebsiteLayoutControl mode={layoutMode} templateTitle={baseTemplate.title} startBlank={currentSite.template_id==='tmpl-start-blank'} plural={word.plural} onSwitch={changeLayout} onOpenHistory={()=>setActiveSection('history')}>
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
              </WebsiteLayoutControl>
            )}

            {activeSection === 'items' && !isDataReseller && <WebsiteItemsList items={items} word={word} sectionsMode={layoutMode==='sections'} onOpen={openItem} onAdd={addItem}/>}

            {activeSection === 'history' && <WebsiteHistoryControl siteId={currentSite.id} token={sessionToken} revision={currentSite.updated_at}
              onRestore={checkpoint=>withSavedDraft(async(revision,version)=>{const {site}=await restoreWebsiteDraft(sessionToken,currentSite.id,revision,checkpoint.id);adoptServerSite(site,version);showToast('Earlier version restored to your draft.','success');})}
              onDiscard={checkpoint=>withSavedDraft(async revision=>{await discardWebsiteCheckpoint(sessionToken,currentSite.id,revision,checkpoint.id);showToast('Saved version removed.','success');})}/>}

            {/* Managed bundle prices are authoritative business settings, not template content. */}
            {isDataReseller && activeSection === 'bundles' && <div className="space-y-4">
              <h3 className="font-bold text-white">Your bundles & pricing</h3>
              <p className="text-sm text-slate-400">Choose which bundles appear on your store and set your selling prices. Your work here will be saved before opening pricing.</p>
              <button type="button" className="min-h-11 px-4 py-3 rounded-xl bg-emerald-500 text-black font-bold" disabled={isSaving||isPublishing} onClick={async()=>{if(isDirty && !(await handleSaveDraft()))return;(onOpenPricing||onClose)();}}>Open Bundles &amp; Pricing</button>
              <WebsiteFeaturedBundlesControl siteId={currentSite.id} token={sessionToken} value={content.pinnedBundles} onChange={next=>changeContent({pinnedBundles:next.length?next:undefined})} />
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
          {activeTab==='edit' && !canvasHintSeen && !visualSelection && !allSettings && <div className="visual-canvas-hint" role="note"><span>{isDataReseller||layoutMode==='sections'?'Tap a heading, photo or contact detail to change it':`Tap any heading, photo or ${word.singular.toLowerCase()} to change it`}</span><button type="button" aria-label="Dismiss tip" onClick={()=>setCanvasHintSeen(true)}><X size={15}/></button></div>}
          {activeTab==='preview' && !previewHintSeen && <div className="visual-canvas-hint is-preview" role="note"><Eye size={15}/><span>{canvasDevice==='mobile'?'Preview of your draft':`${canvasDevice==='tablet'?'Tablet':'Desktop'} preview, scaled to fit`} · payments are off</span><button type="button" aria-label="Dismiss preview note" onClick={()=>setPreviewHintSeen(true)}><X size={15}/></button></div>}
          <div ref={canvasRef} className="visual-canvas-viewport">
            <div style={{width:effectiveCanvasWidth, flexShrink:0, height:scale<1 ? 'calc(100% / '+scale+')' : '100%', transform:scale<1 ? 'scale('+scale+')' : undefined, transformOrigin:'top center'}} className="visual-canvas-page">
              <WebsitePreviewFrame template={previewTemplate} siteId={currentSite.id} viewportWidth={targetWidth} editMode={activeTab==='edit' && !isPublishing} selectedTarget={visualSelection} onSelect={selectTarget} onOrder={setTargetOrder} focusRequest={focusRequest} reserveBottom={contextualTargets.length>0 || settingsNotice ? sheetReserve : 0}/>
            </div>
          </div>
        </div>
        {activeTab==='edit' && selectedItemIndex>=0 && <WebsiteItemPanel item={items[selectedItemIndex]} index={selectedItemIndex} total={items.length} word={word} fields={itemFields} layout={baseTemplate.layoutType || ''} pinnedCount={items.filter(i=>i.pinned).length} siteId={currentSite.id} token={sessionToken} busy={locked} cardButton={cardButton && {value:cardButton.value,max:cardButton.maxLength,onChange:value=>editVisualValue(cardButton.id,value)}}
          onChange={patch=>updateItem(items[selectedItemIndex].id!,patch)} onKeep={()=>void reviewItems([items[selectedItemIndex].id!],'confirm')} onRemove={()=>removeItem(items[selectedItemIndex].id!)} onAdd={addItem} onPrevious={()=>stepItem(-1)} onNext={()=>stepItem(1)} onDone={clearSelection}/>}
        {activeTab==='edit' && contextualTargets.length>0 && !selectedItemId && <div className="contents" inert={locked}><VisualContextPanel title={visualSelection==='branding'?'Website colors':selected!.label} targets={contextualTargets} siteId={currentSite.id} token={sessionToken} onChange={editVisualValue} onDone={clearSelection} onAllSettings={()=>openSettings()} position={stepIndex>=0?{index:stepIndex,total:stepIds.length}:undefined} onPrevious={()=>step(-1)} onNext={()=>step(1)} suggested={!!selected && suggestedFields.includes(selected.id)}/></div>}
        {activeTab==='edit' && settingsNotice==="settings" && !contextualTargets.length && <VisualContextPanel notice title="Change this in All Settings" targets={[]} siteId={currentSite.id} token={sessionToken} onChange={editVisualValue} onDone={clearSelection} onAllSettings={()=>openSettings()}/>}
        {activeTab==='edit' && settingsNotice==="pricing" && !contextualTargets.length && <VisualContextPanel notice title="Bundles come from Bundles & Pricing" noticeText="The bundles and prices on your store are the ones you enable in Bundles & Pricing, so customers only see bundles you can sell. Headings above the bundles can be tapped and edited here." noticeAction="Open Bundles & Pricing" targets={[]} siteId={currentSite.id} token={sessionToken} onChange={editVisualValue} onDone={clearSelection} onAllSettings={()=>openSettings('bundles')}/>}
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
                  <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[#00c365]" />
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
