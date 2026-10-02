import React, { useState, useEffect, useRef } from 'react';
import { WebsiteSiteRecord, SiteContent, SiteSettings, WebsiteTemplate } from '../../../types';
import { updateWebsiteOnServer, publishWebsiteOnServer, unpublishWebsiteOnServer } from '../../../services/apiClient';
import { getTemplateById, mergeSiteWithTemplate, renderTemplateLayout } from '../../../utils/templateRendererUtils';
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
  Plus,
  Trash2,
  Edit2,
  Layers,
} from 'lucide-react';

interface WebsiteEditorProps {
  site: WebsiteSiteRecord;
  sessionToken: string;
  onClose: () => void;
  onSiteUpdated: (updatedSite: WebsiteSiteRecord) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const WebsiteEditor: React.FC<WebsiteEditorProps> = ({
  site: initialSite,
  sessionToken,
  onClose,
  onSiteUpdated,
  showToast,
}) => {
  const [currentSite, setCurrentSite] = useState<WebsiteSiteRecord>(initialSite);

  // Form State
  const [siteName, setSiteName] = useState(initialSite.name);
  const [content, setContent] = useState<SiteContent>(initialSite.content_json);
  const [settings, setSettings] = useState<SiteSettings>(initialSite.settings_json);

  // Status & Dirty Tracking
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatusText, setSaveStatusText] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [isPublishing, setIsPublishing] = useState(false);

  // View Mode: 'edit' or 'preview' (on mobile)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  // Device View in Preview: 'desktop' | 'tablet' | 'mobile'
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Preview container dimension tracking for responsive zoom scaling
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  // Base Template
  const baseTemplate = getTemplateById(currentSite.template_id);
  const isDataReseller = currentSite.template_id === 'tmpl-data-reseller';

  // Active accordion section
  const [activeSection, setActiveSection] = useState<
    'business' | 'contact' | 'branding' | 'bundles' | 'cta' | 'social'
  >('business');

  // Bundle editing state (for Data Reseller)
  const [bundleFilter, setBundleFilter] = useState<'all' | 'mtn' | 'telecel' | 'at'>('all');
  const [isEditingBundle, setIsEditingBundle] = useState(false);
  const [bundleFormId, setBundleFormId] = useState<string | null>(null);
  const [bundleFormNetwork, setBundleFormNetwork] = useState<'mtn' | 'telecel' | 'at'>('mtn');
  const [bundleFormName, setBundleFormName] = useState('');
  const [bundleFormPrice, setBundleFormPrice] = useState('');
  const [bundleFormTag, setBundleFormTag] = useState('');

  // Mark dirty on any edit
  const markDirty = () => {
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
  }, [previewDevice, activeTab]);

  // Explicit Save Handler
  const handleSaveDraft = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveStatusText('saving');

    try {
      const res = await updateWebsiteOnServer(sessionToken, currentSite.id, {
        name: siteName,
        content,
        settings,
      });

      if (res.success && res.site) {
        setCurrentSite(res.site);
        onSiteUpdated(res.site);
        setIsDirty(false);
        setSaveStatusText('saved');
        showToast('Changes saved successfully.', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save changes.', 'warning');
      setSaveStatusText('unsaved');
    } finally {
      setIsSaving(false);
    }
  };

  // Debounced Autosave (2.5 seconds of inactivity)
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      handleSaveDraft();
    }, 2500);
    return () => clearTimeout(timer);
  }, [isDirty, siteName, content, settings]);

  // Publish / Unpublish Handlers
  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      // Save current changes first if dirty
      if (isDirty) {
        await updateWebsiteOnServer(sessionToken, currentSite.id, {
          name: siteName,
          content,
          settings,
        });
      }

      const res = await publishWebsiteOnServer(sessionToken, currentSite.id);
      if (res.success && res.site) {
        setCurrentSite(res.site);
        onSiteUpdated(res.site);
        setIsDirty(false);
        setSaveStatusText('saved');
        showToast(`Your website is now LIVE at /sites/${res.site.slug}!`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to publish website.', 'warning');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setIsPublishing(true);
    try {
      const res = await unpublishWebsiteOnServer(sessionToken, currentSite.id);
      if (res.success && res.site) {
        setCurrentSite(res.site);
        onSiteUpdated(res.site);
        showToast('Website unpublished (reverted to draft).', 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to unpublish website.', 'warning');
    } finally {
      setIsPublishing(false);
    }
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
  const targetWidth = previewDevice === 'mobile' ? 375 : previewDevice === 'tablet' ? 768 : 1280;
  const availableWidth = canvasDimensions.width || 800;
  const availableHeight = canvasDimensions.height || 600;
  const paddingX = previewDevice === 'desktop' ? 32 : 16;
  const usableWidth = Math.max(280, availableWidth - paddingX);
  const scale = Math.min(1, usableWidth / targetWidth);

  return (
    <div className="fixed inset-0 z-50 bg-[#080d11] text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* =========================================================
          TOP ACTION BAR
          ========================================================= */}
      <header className="h-14 sm:h-16 px-4 sm:px-6 bg-[#0a1117] border-b border-slate-800 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (isDirty) {
                if (window.confirm('You have unsaved changes. Exit anyway?')) {
                  onClose();
                }
              } else {
                onClose();
              }
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm sm:text-base text-white truncate max-w-[140px] sm:max-w-xs">
                {content.businessName || siteName}
              </h2>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  currentSite.status === 'published'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}
              >
                {currentSite.status === 'published' ? 'Live' : 'Draft'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="truncate">{baseTemplate.title}</span>
              <span className="text-slate-600">·</span>
              {saveStatusText === 'saving' && (
                <span className="text-amber-400 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Saving...</span>
                </span>
              )}
              {saveStatusText === 'saved' && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Saved</span>
                </span>
              )}
              {saveStatusText === 'unsaved' && (
                <span className="text-amber-300">Unsaved changes</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Mobile Tab Switcher */}
          <div className="lg:hidden flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                activeTab === 'edit' ? 'bg-[#00c365] text-black font-bold' : 'text-slate-400'
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                activeTab === 'preview' ? 'bg-[#00c365] text-black font-bold' : 'text-slate-400'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Preview</span>
            </button>
          </div>

          {/* Save Draft Button */}
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-colors items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>

          {/* Publish / Unpublish */}
          {currentSite.status === 'published' ? (
            <>
              <a
                href={`/sites/${currentSite.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold border border-slate-700 transition-colors items-center gap-1.5"
              >
                <span>View Live</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                type="button"
                onClick={handleCopyLink}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Copy Live Website URL"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copy Link</span>
              </button>

              <button
                type="button"
                onClick={handleUnpublish}
                disabled={isPublishing}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-rose-300 text-xs font-semibold border border-rose-900/40 transition-colors cursor-pointer"
              >
                Unpublish
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing}
              className="px-4 py-1.5 sm:py-2 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,195,101,0.35)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Publish</span>
            </button>
          )}
        </div>
      </header>

      {/* =========================================================
          WORKSPACE: LEFT EDITOR / RIGHT LIVE PREVIEW
          ========================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: EDITING CONTROLS */}
        <div
          className={`w-full lg:w-[460px] xl:w-[490px] border-r border-slate-800 bg-[#0a1117] flex flex-col shrink-0 overflow-hidden ${
            activeTab === 'edit' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Navigation Category Tabs */}
          <div className="p-3 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 bg-[#070c10]">
            <button
              type="button"
              onClick={() => setActiveSection('business')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'business'
                  ? 'bg-[#00c365] text-black font-bold'
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
                  ? 'bg-[#00c365] text-black font-bold'
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
                  ? 'bg-[#00c365] text-black font-bold'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Branding</span>
            </button>

            {isDataReseller && (
              <button
                type="button"
                onClick={() => setActiveSection('bundles')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeSection === 'bundles'
                    ? 'bg-[#00c365] text-black font-bold'
                    : 'text-slate-400 hover:text-white bg-slate-900/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Bundles</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveSection('cta')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'cta'
                  ? 'bg-[#00c365] text-black font-bold'
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
                  ? 'bg-[#00c365] text-black font-bold'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Social</span>
            </button>
          </div>

          {/* Form Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* 1. BUSINESS SECTION */}
            {activeSection === 'business' && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <h3 className="font-bold text-sm text-white">Business Details</h3>
                  <p className="text-xs text-slate-400">
                    The core identity shown across your hero and navigation.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300">Business Name</label>
                  <input
                    type="text"
                    value={content.businessName}
                    maxLength={100}
                    onChange={(e) => {
                      setContent({ ...content, businessName: e.target.value });
                      markDirty();
                    }}
                    placeholder={isDataReseller ? 'e.g. Ghana Data Express' : 'e.g. Accra Fresh Buka'}
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300">Hero Tagline</label>
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
                        : 'e.g. Authentic Ghanaian Flavours with Contemporary Craft'
                    }
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300">About / Short Description</label>
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
                        ? 'e.g. Buy MTN, Telecel and AirtelTigo bundles from one simple storefront. Choose your package, enter the recipient number and place your order through WhatsApp.'
                        : 'Describe your story, specialities, or mission...'
                    }
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365] leading-relaxed resize-none"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300">Location & Operating Hours</label>
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
                </div>
              </div>
            )}

            {/* 2. CONTACT SECTION */}
            {activeSection === 'contact' && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <h3 className="font-bold text-sm text-white">Contact Channels</h3>
                  <p className="text-xs text-slate-400">
                    How customers reach your business directly from your website.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300">WhatsApp Number</label>
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
                  <p className="text-[11px] text-slate-400">
                    Used for one-tap WhatsApp customer order routing.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300">Phone Call Number</label>
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
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300">Customer Email</label>
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
                </div>
              </div>
            )}

            {/* 3. BRANDING SECTION */}
            {activeSection === 'branding' && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <h3 className="font-bold text-sm text-white">Visual Branding</h3>
                  <p className="text-xs text-slate-400">
                    Colors and imagery matching your brand identity.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-slate-300">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.primaryColor}
                        onChange={(e) => {
                          setSettings({ ...settings, primaryColor: e.target.value });
                          markDirty();
                        }}
                        className="w-9 h-9 rounded-lg border border-slate-700 bg-transparent cursor-pointer p-0"
                      />
                      <input
                        type="text"
                        value={settings.primaryColor}
                        onChange={(e) => {
                          setSettings({ ...settings, primaryColor: e.target.value });
                          markDirty();
                        }}
                        className="w-full bg-[#111922] border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-slate-300">Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.accentColor}
                        onChange={(e) => {
                          setSettings({ ...settings, accentColor: e.target.value });
                          markDirty();
                        }}
                        className="w-9 h-9 rounded-lg border border-slate-700 bg-transparent cursor-pointer p-0"
                      />
                      <input
                        type="text"
                        value={settings.accentColor}
                        onChange={(e) => {
                          setSettings({ ...settings, accentColor: e.target.value });
                          markDirty();
                        }}
                        className="w-full bg-[#111922] border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300">Hero Banner Image URL</label>
                  <input
                    type="url"
                    value={content.heroImage}
                    maxLength={500}
                    onChange={(e) => {
                      setContent({ ...content, heroImage: e.target.value });
                      markDirty();
                    }}
                    placeholder="https://..."
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#00c365]"
                  />
                  {content.heroImage && (
                    <div className="relative h-28 rounded-xl overflow-hidden border border-slate-800 mt-2">
                      <img
                        src={content.heroImage}
                        alt="Hero preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300">Brand Logo URL (Optional)</label>
                  <input
                    type="url"
                    value={content.logoUrl || ''}
                    maxLength={500}
                    onChange={(e) => {
                      setContent({ ...content, logoUrl: e.target.value });
                      markDirty();
                    }}
                    placeholder="https://..."
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#00c365]"
                  />
                </div>
              </div>
            )}

            {/* BUNDLES SECTION (FOR DATA RESELLER STOREFRONT) */}
            {isDataReseller && activeSection === 'bundles' && (
              <div className="space-y-5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-white">Products / Bundles</h3>
                    <p className="text-xs text-slate-400">
                      Manage telecom packages and custom reseller prices.
                    </p>
                  </div>
                  {!isEditingBundle && (
                    <button
                      type="button"
                      onClick={() => {
                        setBundleFormId(null);
                        setBundleFormNetwork('mtn');
                        setBundleFormName('');
                        setBundleFormPrice('');
                        setBundleFormTag('Standard');
                        setIsEditingBundle(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Bundle</span>
                    </button>
                  )}
                </div>

                {/* Add / Edit Form Card */}
                {isEditingBundle && (
                  <div className="p-4 rounded-2xl bg-[#0d141b] border border-slate-700/80 space-y-3.5 shadow-xl text-left">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <h4 className="font-bold text-xs text-white">
                        {bundleFormId ? 'Edit Data Bundle' : 'Add New Data Bundle'}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setIsEditingBundle(false)}
                        className="text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Telecom Network</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setBundleFormNetwork('mtn')}
                          className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            bundleFormNetwork === 'mtn'
                              ? 'bg-[#FFCC00] text-black border-[#FFCC00]'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          MTN
                        </button>
                        <button
                          type="button"
                          onClick={() => setBundleFormNetwork('telecel')}
                          className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            bundleFormNetwork === 'telecel'
                              ? 'bg-[#E60000] text-white border-[#E60000]'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          Telecel
                        </button>
                        <button
                          type="button"
                          onClick={() => setBundleFormNetwork('at')}
                          className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            bundleFormNetwork === 'at'
                              ? 'bg-[#002B49] text-white border-blue-400'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          AT
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Package Name / Size</label>
                      <input
                        type="text"
                        value={bundleFormName}
                        onChange={(e) => setBundleFormName(e.target.value)}
                        placeholder="e.g. 5GB Non-Expiry Bundle"
                        className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00c365]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300">Price (GH₵)</label>
                        <input
                          type="text"
                          value={bundleFormPrice}
                          onChange={(e) => setBundleFormPrice(e.target.value)}
                          placeholder="e.g. 48.00"
                          className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00c365]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300">Tag / Badge</label>
                        <input
                          type="text"
                          value={bundleFormTag}
                          onChange={(e) => setBundleFormTag(e.target.value)}
                          placeholder="e.g. Popular, Hot"
                          className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00c365]"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!bundleFormName.trim()) {
                          showToast('Please enter a package name.', 'warning');
                          return;
                        }
                        const netLabel =
                          bundleFormNetwork === 'mtn' ? 'MTN' : bundleFormNetwork === 'telecel' ? 'Telecel' : 'AT';
                        const currentItems = Array.isArray(content.items) ? [...content.items] : [];

                        if (bundleFormId) {
                          const updated = currentItems.map((item) => {
                            if (item.id === bundleFormId) {
                              return {
                                ...item,
                                name: bundleFormName.trim(),
                                price: bundleFormPrice.trim() || '20.00',
                                category: netLabel,
                                tag: bundleFormTag.trim() || undefined,
                              };
                            }
                            return item;
                          });
                          setContent({ ...content, items: updated });
                        } else {
                          const newItem = {
                            id: `ds-${bundleFormNetwork}-${Date.now().toString(36)}`,
                            name: bundleFormName.trim(),
                            price: bundleFormPrice.trim() || '20.00',
                            category: netLabel,
                            tag: bundleFormTag.trim() || undefined,
                          };
                          setContent({ ...content, items: [...currentItems, newItem] });
                        }
                        markDirty();
                        setIsEditingBundle(false);
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                    >
                      {bundleFormId ? 'Update Package' : 'Save Package'}
                    </button>
                  </div>
                )}

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {(['all', 'mtn', 'telecel', 'at'] as const).map((net) => (
                    <button
                      key={net}
                      type="button"
                      onClick={() => setBundleFilter(net)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase transition-all cursor-pointer ${
                        bundleFilter === net
                          ? 'bg-slate-700 text-white font-bold'
                          : 'bg-slate-900/60 text-slate-400 hover:text-white'
                      }`}
                    >
                      {net === 'all' ? 'All Networks' : net.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Package List */}
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {(content.items || [])
                    .filter((item) => {
                      if (bundleFilter === 'all') return true;
                      const cat = (item.category || '').toLowerCase();
                      if (bundleFilter === 'mtn') return cat.includes('mtn');
                      if (bundleFilter === 'telecel') return cat.includes('telecel') || cat.includes('vodafone');
                      if (bundleFilter === 'at') return cat.includes('at') || cat.includes('airtel');
                      return true;
                    })
                    .map((item, idx) => {
                      const net = (item.category || 'MTN').toUpperCase();
                      const netColor =
                        net.includes('TELECEL')
                          ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                          : net.includes('AT') || net.includes('AIRTEL')
                          ? 'text-sky-400 bg-sky-500/10 border-sky-500/30'
                          : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

                      return (
                        <div
                          key={item.id || idx}
                          className="p-3 rounded-xl bg-[#0e1620] border border-slate-800 flex items-center justify-between gap-3 text-left"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${netColor}`}>
                                {net}
                              </span>
                              <span className="font-bold text-xs text-white truncate">{item.name}</span>
                              {item.tag && (
                                <span className="text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                                  {item.tag}
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-emerald-400">
                              GH₵ {item.price || '0.00'}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setBundleFormId(item.id || `item-${idx}`);
                                const cat = (item.category || '').toLowerCase();
                                if (cat.includes('telecel')) setBundleFormNetwork('telecel');
                                else if (cat.includes('at')) setBundleFormNetwork('at');
                                else setBundleFormNetwork('mtn');
                                setBundleFormName(item.name);
                                setBundleFormPrice(item.price || '');
                                setBundleFormTag(item.tag || '');
                                setIsEditingBundle(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit Bundle"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const remaining = (content.items || []).filter((_, i) => i !== idx);
                                setContent({ ...content, items: remaining });
                                markDirty();
                              }}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Delete Bundle"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {(!content.items || content.items.length === 0) && (
                    <div className="p-6 text-center text-xs text-slate-400 rounded-xl bg-slate-900/40 border border-slate-800">
                      No bundles configured yet. Click "Add Bundle" above.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. CALL TO ACTION SECTION */}
            {activeSection === 'cta' && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <h3 className="font-bold text-sm text-white">Call to Action</h3>
                  <p className="text-xs text-slate-400">
                    The primary button customers click to buy, book, or inquire.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300">Button Label</label>
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
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300">Button Action / WhatsApp Target</label>
                  <input
                    type="text"
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
                    Leave blank to automatically route to your WhatsApp number.
                  </p>
                </div>
              </div>
            )}

            {/* 5. SOCIAL MEDIA SECTION */}
            {activeSection === 'social' && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <h3 className="font-bold text-sm text-white">Social Media Profiles</h3>
                  <p className="text-xs text-slate-400">
                    Optional links displayed on your published website footer.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300">Instagram Handle / URL</label>
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
                    placeholder="e.g. @accrabuka or https://instagram.com/..."
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300">Facebook Page URL</label>
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
                    placeholder="e.g. https://facebook.com/accrabuka"
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300">TikTok Handle</label>
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
                    placeholder="e.g. @accrabuka"
                    className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE RESPONSIVE PREVIEW */}
        <div
          className={`flex-1 flex flex-col bg-[#05080b] overflow-hidden ${
            activeTab === 'preview' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Preview Viewport Toolbar */}
          <div className="px-4 py-2 bg-[#090e13] border-b border-slate-800 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  previewDevice === 'desktop'
                    ? 'bg-[#00c365] text-black font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Desktop View (1280px)"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('tablet')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  previewDevice === 'tablet'
                    ? 'bg-[#00c365] text-black font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Tablet View (768px)"
              >
                <Tablet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tablet</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  previewDevice === 'mobile'
                    ? 'bg-[#00c365] text-black font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Mobile View (375px)"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mobile</span>
              </button>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Live Reactive Preview</span>
            </div>
          </div>

          {/* Interactive Scaled Canvas Container */}
          <div
            ref={canvasRef}
            className="flex-1 w-full p-2 sm:p-4 lg:p-6 overflow-hidden flex items-center justify-center relative bg-[#040608]"
          >
            <div
              className="rounded-2xl border border-slate-800 shadow-2xl overflow-hidden bg-white relative transition-all duration-300"
              style={{
                width: `${targetWidth}px`,
                maxWidth: '100%',
                height: '100%',
                maxHeight: '100%',
                transform: scale < 0.99 ? `scale(${scale})` : undefined,
                transformOrigin: 'top center',
              }}
            >
              {/* Fake Browser URL Bar */}
              <div className="bg-[#0f1722] border-b border-slate-800 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-400 select-none">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500/80" />
                  <span className="w-2 h-2 rounded-full bg-amber-500/80" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
                </div>
                <div className="bg-black/60 px-3 py-0.5 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-300 truncate max-w-[200px] sm:max-w-xs">
                  https://mysteryhub.gh/sites/{currentSite.slug}
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold">
                  {previewDevice === 'mobile' ? '375px' : previewDevice === 'tablet' ? '768px' : '1280px'}
                </div>
              </div>

              {/* Rendered Live Website Canvas */}
              <div className="h-[calc(100%-32px)] overflow-y-auto w-full bg-white text-slate-900 scrollbar-thin">
                {renderTemplateLayout(previewTemplate, {
                  isMobileView: previewDevice === 'mobile',
                })}

                {/* Free Tier Attribution Badge */}
                <div className="py-3 px-4 bg-[#090d11] border-t border-slate-800 text-center text-xs text-slate-400 select-none">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-[#00c365]" />
                    <span>Powered by</span>
                    <span className="font-bold text-[#00c365]">Mystery Hub</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
