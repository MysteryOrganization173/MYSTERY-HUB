import { API_BASE_URL } from '../../services/apiClient.js';
import {useDialogFocus} from '../../hooks/useDialogFocus';
import React, { useState, useEffect } from 'react';
import { ULTRA_SERVICE, type UltraEnquiryInput } from '../../config/websiteBuilder.js';
import { SafeImage } from './SafeImage.js';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary.js';
import {
  Check,
  ArrowRight,
  X,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Send,
} from 'lucide-react';

const ULTRA_TIER_ARTWORK =
  'https://res.cloudinary.com/da6oeat7m/image/upload/v1791055793/ChatGPT_Image_Oct_3_2026_06_52_54_PM-4_glzvrg.png';

const FREE_FEATURES = [
  'One live business website',
  'Every design in the gallery',
  'Your logo, colours, photos and contact details',
  'WhatsApp and call buttons',
  'Your own address on mysterybundlehub.com',
  'Data Business stores with managed checkout',
  'Publish and update whenever you like',
];
// Proposed prices for plans that do not exist yet; listed so owners know what is coming, never sold.
const PLANNED_PLANS = [
  { name: 'Plus', price: 'GH₵49', line: 'For growing businesses that want more control over their brand.', items: ['More design and branding controls', 'Premium designs', 'Connect your own domain'] },
  { name: 'Pro', price: 'GH₵199', line: 'For established businesses and teams.', items: ['Advanced business tools', 'Bigger catalogues', 'Priority support'] },
];

const initialForm: UltraEnquiryInput = {
  businessName: '',
  businessType: '',
  contactName: '',
  phone: '',
  email: '',
  existingDomain: 'no',
  estimatedPages: 1,
  featuresRequirements: '',
  preferredStyle: '',
  referenceWebsite: '',
  projectNotes: '',
};

export function WebsitePlansAndUltra({
  sessionToken,
  onStartBlank,
}: {
  sessionToken?: string;
  onStartBlank: () => void;
}) {
  const [isUltraModalOpen, setIsUltraModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<UltraEnquiryInput>(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ reference: string; whatsappUrl: string } | null>(null);

  const ultraArtworkUrl = getCloudinaryUrl(ULTRA_TIER_ARTWORK, { format: 'auto', quality: 'auto', width: 1200 });
  const ultraArtworkSrcSet = getCloudinarySrcSet(ULTRA_TIER_ARTWORK, [480, 800, 1200]);

  const dialogRef=useDialogFocus(isUltraModalOpen,()=>{if(!busy)setIsUltraModalOpen(false);});
  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isUltraModalOpen && !busy) {
        setIsUltraModalOpen(false);
      }
    };
    if (isUltraModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUltraModalOpen, busy]);

  const handleOpenUltraModal = () => {
    setError('');
    setSaved(null);
    setModalStep(1);
    setIsUltraModalOpen(true);
  };

  const handleCloseUltraModal = () => {
    if (busy) return;
    setIsUltraModalOpen(false);
  };

  const validateStep1 = () => {
    if (!form.businessName.trim()) {
      setError('Please provide your business name.');
      return false;
    }
    if (!form.businessType.trim()) {
      setError('Please specify your business type (e.g. Restaurant, Telecom, Pharmacy).');
      return false;
    }
    if (!form.contactName.trim()) {
      setError('Please provide your contact name.');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep2 = () => {
    if (!form.featuresRequirements.trim()) {
      setError('Please briefly describe the features or sections you need.');
      return false;
    }
    if (form.estimatedPages < 1) {
      setError('Please specify at least 1 estimated page.');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep3 = () => {
    if (!form.phone.trim()) {
      setError('Please provide your WhatsApp or phone number so we can reach you.');
      return false;
    }
    setError('');
    return true;
  };

  const handleNextStep = () => {
    if (modalStep === 1) {
      if (validateStep1()) setModalStep(2);
    } else if (modalStep === 2) {
      if (validateStep2()) setModalStep(3);
    }
  };

  const handlePrevStep = () => {
    setError('');
    if (modalStep === 3) setModalStep(2);
    else if (modalStep === 2) setModalStep(1);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;
    if (busy) return;
    setBusy(true);
    setError('');
    setSaved(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/websites/ultra/enquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not save your enquiry.');
      }
      setSaved(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="plans-pricing" className="space-y-8 sm:space-y-12 scroll-mt-20">
      {/* =========================================================
          PLANS STUDIO AMBIENT ENVIRONMENT WRAPPER
          ========================================================= */}
      <section aria-labelledby="plans-heading" className="website-plans text-left">
        <div className="website-plans-head">
          <p className="website-plans-eyebrow">Plans</p>
          <h2 id="plans-heading">Start free today</h2>
          <p>Free is live today and includes every design. Plus and Pro are planned; their prices are proposals and nothing is charged for them.</p>
        </div>
        <div className="website-plans-grid">
          <article className="website-plan website-plan-live">
            <div className="website-plan-top"><h3>Free</h3><span className="website-plan-badge website-plan-badge-live">Live today</span></div>
            <p className="website-plan-price"><strong>GH₵0</strong><span>/ month</span></p>
            <p className="website-plan-line">Everything you need to publish one business website.</p>
            <ul className="website-plan-list">
              {FREE_FEATURES.map(item => <li key={item}><Check className="w-4 h-4" aria-hidden="true" />{item}</li>)}
            </ul>
            <button type="button" onClick={onStartBlank} className="website-plan-cta">Choose a free design<ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
          </article>
          {PLANNED_PLANS.map(plan => (
            <article key={plan.name} className="website-plan">
              <div className="website-plan-top"><h3>{plan.name}</h3><span className="website-plan-badge">Planned</span></div>
              <p className="website-plan-price"><strong>{plan.price}</strong><span>/ month · proposed</span></p>
              <p className="website-plan-line">{plan.line}</p>
              <p className="website-plan-subhead">What we plan to include</p>
              <ul className="website-plan-list website-plan-list-planned">
                {plan.items.map(item => <li key={item}><span aria-hidden="true" />{item}</li>)}
              </ul>
              <p className="website-plan-note">Not available yet. Your Free website keeps working as it is.</p>
            </article>
          ))}
        </div>
      </section>

      {/* =========================================================
          ULTRA — SEPARATE DISTINCT SERVICE BLOCK (RICH VISUALS)
          ========================================================= */}
      <section id="ultra" aria-label="Ultra done-for-you website service" className="scroll-mt-24 rounded-3xl bg-gradient-to-r from-[#0c1813] via-[#091216] to-[#0d161d] border border-slate-700/80 p-5 sm:p-7 lg:p-8 shadow-2xl relative overflow-hidden text-left">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00c365]/10 rounded-full blur-[110px] pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8 items-center relative z-10">
          {/* Left Column: Scope, Pricing, Features, CTA */}
          <div className="lg:col-span-7 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/40 text-xs font-bold text-[#00c365] uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>DONE-FOR-YOU WEBSITE SERVICE</span>
            </div>

            <div className="space-y-0.5">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                Need a website built for you?
              </p>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                GO ULTRA
              </h3>
            </div>

            {/* Resolved Price Layout */}
            <div className="space-y-0.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">From</span>
                <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                  GH₵{(ULTRA_SERVICE.startingMinor / 100).toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-emerald-400 font-semibold">
                Professional website build
              </p>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              Work directly with the Mystery Hub team to create a website built around your business, brand and requirements. We handle the design, page setup, mobile optimization, domain connection and agreed integrations, then help you launch.
            </p>

            <p className="text-[11px] text-slate-400 font-medium">
              Final pricing depends on project scope.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Built by our team</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Tailored to your brand</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Multi-page design</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Domain setup</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Scoped integrations</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Launch support</span>
              </div>
            </div>

            <div className="pt-1.5">
              <button
                type="button"
                onClick={handleOpenUltraModal}
                className="px-6 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,195,101,0.25)] active:scale-[0.98] inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Request an Ultra Build</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Column: Seamlessly Blended Bespoke Studio Artwork */}
          <div className="lg:col-span-5 relative flex items-center justify-center pt-4 lg:pt-0">
            {/* Luminous ambient backlight glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 via-[#00c365]/10 to-transparent rounded-3xl blur-2xl opacity-70 pointer-events-none" />

            {/* Seamless blended container (no detached browser frame, no harsh borders) */}
            <div className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl">
              <SafeImage
                src={ultraArtworkUrl}
                srcSet={ultraArtworkSrcSet || undefined}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 520px"
                alt="Mystery Hub Ultra Bespoke Website Studio"
                className="w-full aspect-[4/3] object-cover sm:object-contain object-center lg:object-right transition-transform duration-700 hover:scale-[1.02]"
                loading="lazy"
              />

              {/* Soft left-edge gradient dissolving artwork naturally into the copy on desktop */}
              <div className="hidden lg:block absolute inset-y-0 left-0 w-24 xl:w-32 bg-gradient-to-r from-[#091216] via-[#091216]/60 to-transparent pointer-events-none" />

              {/* Soft perimeter vignette for unified background integration */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d161d]/85 via-transparent to-[#0d161d]/30 pointer-events-none" />

              {/* Clean integrated studio status badge (mobile-safe layout) */}
              <div className="absolute bottom-2.5 sm:bottom-3 inset-x-2.5 sm:inset-x-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 sm:gap-2 pointer-events-none">
                <div className="min-w-0 flex-1 sm:flex-initial px-2.5 sm:px-3 py-1 rounded-full bg-[#0c1813]/90 backdrop-blur-md border border-[#00c365]/20 text-[9px] sm:text-[10px] font-medium text-slate-200 shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00c365] shrink-0 animate-pulse" />
                  <span className="truncate">Handcrafted by Mystery Hub Engineers</span>
                </div>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-[#00c365]/20 text-[#00c365] border border-[#00c365]/30 shrink-0 backdrop-blur-md whitespace-nowrap">
                  1-on-1 Scoped
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          ULTRA ENQUIRY STEP-BASED MODAL
          ========================================================= */}
      {isUltraModalOpen && (
        <div
          ref={dialogRef} tabIndex={-1} role="dialog"
          aria-modal="true"
          aria-labelledby="ultra-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-[#0b1219] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-left"
          >
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#00c365] uppercase">
                    Ultra Build Service
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-xs text-slate-400">From GH₵{(ULTRA_SERVICE.startingMinor / 100).toLocaleString()}</span>
                </div>
                <h3 id="ultra-modal-title" className="text-base sm:text-lg font-extrabold text-white">
                  {saved ? 'Enquiry Received' : `Step ${modalStep} of 3: ${
                    modalStep === 1 ? 'Your Business' : modalStep === 2 ? 'What You Need' : 'Contact & Submit'
                  }`}
                </h3>
              </div>

              <button
                type="button"
                onClick={handleCloseUltraModal}
                disabled={busy}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close Ultra modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Progress Bar */}
            {!saved && (
              <div className="grid grid-cols-3 gap-1 px-5 sm:px-6 pt-3 shrink-0">
                <div className={`h-1.5 rounded-full transition-all ${modalStep >= 1 ? 'bg-[#00c365]' : 'bg-slate-800'}`} />
                <div className={`h-1.5 rounded-full transition-all ${modalStep >= 2 ? 'bg-[#00c365]' : 'bg-slate-800'}`} />
                <div className={`h-1.5 rounded-full transition-all ${modalStep >= 3 ? 'bg-[#00c365]' : 'bg-slate-800'}`} />
              </div>
            )}

            {/* Modal Body (Internally scrollable for mobile viewports) */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {saved ? (
                /* Success State */
                <div className="py-6 text-center space-y-5">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-[#00c365] mx-auto shadow-md">
                    <Check className="w-8 h-8 stroke-[2.5]" />
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-xl font-black text-white">Enquiry Saved Successfully</h4>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                      Reference: <strong className="font-mono text-[#00c365]">{saved.reference}</strong>
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Our build team has received your project details. Click below to continue directly on WhatsApp with our lead developer.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <a
                      href={saved.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                      <MessageSquare className="w-4 h-4 fill-black" />
                      <span>Continue on WhatsApp</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCloseUltraModal}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* Multi-step Form */
                <form id="ultra-enquiry-form" onSubmit={submit} className="space-y-4">
                  {/* STEP 1: Your Business */}
                  {modalStep === 1 && (
                    <div className="space-y-3.5 animate-in fade-in duration-150">
                      <div className="text-xs text-slate-400">
                        Tell us about the business or organization you want built.
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300">
                          Business Name <span className="text-[#00c365]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={150}
                          placeholder="e.g. Accra Artisan Kitchen or Berekum Logistics"
                          value={form.businessName}
                          onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                          className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300">
                          Business Type / Industry <span className="text-[#00c365]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={100}
                          placeholder="e.g. Restaurant, Telecom, Law Firm, Salon, Boutique"
                          value={form.businessType}
                          onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                          className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300">
                          Contact Person Name <span className="text-[#00c365]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={100}
                          placeholder="e.g. Kofi Mensah or Nana Yaa"
                          value={form.contactName}
                          onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                          className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                        />
                      </div>
                    </div>
                  )}

                  {/* STEP 2: What You Need */}
                  {modalStep === 2 && (
                    <div className="space-y-3.5 animate-in fade-in duration-150">
                      <div className="text-xs text-slate-400">
                        Specify pages, style preferences, and key capabilities.
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-300">
                            Do you have an existing domain?
                          </label>
                          <select
                            value={form.existingDomain}
                            onChange={(e) => setForm({ ...form, existingDomain: e.target.value as 'yes' | 'no' })}
                            className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                          >
                            <option value="no">No, I need a new domain</option>
                            <option value="yes">Yes, I already own a domain</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-300">
                            Estimated Pages <span className="text-[#00c365]">*</span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            required
                            value={form.estimatedPages}
                            onChange={(e) => setForm({ ...form, estimatedPages: Number(e.target.value) || 1 })}
                            className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300">
                          Features & Requirements <span className="text-[#00c365]">*</span>
                        </label>
                        <textarea
                          required
                          rows={3}
                          maxLength={2000}
                          placeholder="e.g. WhatsApp ordering menu, table reservations, staff portfolio, price catalog, location map"
                          value={form.featuresRequirements}
                          onChange={(e) => setForm({ ...form, featuresRequirements: e.target.value })}
                          className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-300">
                            Preferred Style
                          </label>
                          <input
                            type="text"
                            maxLength={300}
                            placeholder="e.g. Clean minimal, dark luxury, vibrant"
                            value={form.preferredStyle}
                            onChange={(e) => setForm({ ...form, preferredStyle: e.target.value })}
                            className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-300">
                            Reference Website (Optional)
                          </label>
                          <input
                            type="url"
                            maxLength={500}
                            placeholder="https://example.com"
                            value={form.referenceWebsite || ''}
                            onChange={(e) => setForm({ ...form, referenceWebsite: e.target.value })}
                            className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Contact & Submit */}
                  {modalStep === 3 && (
                    <div className="space-y-3.5 animate-in fade-in duration-150">
                      <div className="text-xs text-slate-400">
                        How should our lead build engineer reach you?
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300">
                          WhatsApp / Phone Number <span className="text-[#00c365]">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          maxLength={30}
                          placeholder="e.g. +233 24 123 4567"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300">
                          Email Address (Optional)
                        </label>
                        <input
                          type="email"
                          maxLength={150}
                          placeholder="e.g. kofi@business.gh"
                          value={form.email || ''}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300">
                          Project Notes or Deadlines (Optional)
                        </label>
                        <textarea
                          rows={2}
                          maxLength={2000}
                          placeholder="Any target launch date, existing branding guidelines, or specific questions..."
                          value={form.projectNotes}
                          onChange={(e) => setForm({ ...form, projectNotes: e.target.value })}
                          className="w-full bg-[#111922] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00c365]"
                        />
                      </div>
                    </div>
                  )}

                  {error && (
                    <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                      {error}
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* Modal Footer Controls */}
            {!saved && (
              <div className="px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3 shrink-0">
                {modalStep > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={busy}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCloseUltraModal}
                    disabled={busy}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}

                {modalStep < 3 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-5 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    form="ultra-enquiry-form"
                    disabled={busy}
                    className="px-6 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{busy ? 'Saving Enquiry…' : 'Submit Enquiry'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
