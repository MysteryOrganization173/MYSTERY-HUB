import { API_BASE_URL } from '../../services/apiClient.js';
import React, { useState, useEffect } from 'react';
import { ULTRA_SERVICE, type UltraEnquiryInput } from '../../config/websiteBuilder.js';
import {
  Sparkles,
  Check,
  ArrowRight,
  X,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Send,
  Building,
  Layers,
  HelpCircle,
} from 'lucide-react';

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
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12 sm:space-y-16 text-white text-left">
      {/* =========================================================
          1. SECTION HEADER
          ========================================================= */}
      <div className="space-y-2 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/30 text-xs font-bold text-[#00c365] uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Flexible Plans</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
          Simple, Transparent Pricing
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Build your website for free today, or scale up with upcoming professional capabilities.
        </p>
      </div>

      {/* =========================================================
          2. COMMERCIAL PRICING GRID (FREE / PLUS / PRO)
          ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
        {/* PLAN 1: FREE */}
        <article className="rounded-3xl bg-[#0b1218] border border-slate-800 p-6 sm:p-8 flex flex-col justify-between space-y-6 hover:border-slate-700 transition-all shadow-sm">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-xl text-white tracking-tight">FREE</h3>
              <p className="text-xs text-slate-400 font-medium">Start building for free.</p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-black text-white font-mono">GH₵0</span>
              <span className="text-xs text-slate-400">/ month</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Essential foundation to create and publish a live business website with zero upfront cost.
            </p>

            <div className="pt-2 border-t border-slate-800 space-y-2.5 text-xs text-slate-200">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>1 live business website</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Standard Ghanaian templates</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Core business sections</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Essential branding & details</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Mystery Hub hosted publishing</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Mystery Hub attribution</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onStartBlank}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 shadow-sm"
            >
              <span>Start Free</span>
              <ArrowRight className="w-4 h-4 text-[#00c365]" />
            </button>
          </div>
        </article>

        {/* PLAN 2: PLUS (HERO / RECOMMENDED PLAN) */}
        <article className="rounded-3xl bg-gradient-to-b from-[#0e1d17] via-[#0b1411] to-[#09100d] border-2 border-[#00c365] p-6 sm:p-8 flex flex-col justify-between space-y-6 relative shadow-[0_0_35px_rgba(0,195,101,0.18)] ring-1 ring-[#00c365]/30">
          {/* Most Popular Badge */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-[#00c365] text-black text-[10px] font-black uppercase tracking-wider shadow-md">
            Most Popular
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-xl text-white tracking-tight">PLUS</h3>
                <p className="text-xs text-emerald-400 font-medium">Best for growing businesses.</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Launching soon
              </span>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-black text-white font-mono">GH₵49</span>
              <span className="text-xs text-slate-400">/ month</span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">
              Enhanced creative freedom, AI assistance, and independent brand identity for established shops.
            </p>

            <div className="pt-2 border-t border-[#00c365]/25 space-y-2.5 text-xs text-slate-100">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Everything in Free</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Premium handcrafted designs</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Extended color & typography control</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Mystery AI copywriting & editing</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Custom domain connection</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Expanded website project limits</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled
              className="w-full py-3.5 px-4 rounded-xl bg-[#00c365]/20 border border-[#00c365]/40 text-[#00c365] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed opacity-90"
            >
              <span>Launching Soon</span>
            </button>
          </div>
        </article>

        {/* PLAN 3: PRO (SERIOUS BUSINESSES & TEAMS) */}
        <article className="rounded-3xl bg-[#0b1016] border border-slate-800 p-6 sm:p-8 flex flex-col justify-between space-y-6 hover:border-slate-700 transition-all shadow-sm">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-xl text-white tracking-tight">PRO</h3>
                <p className="text-xs text-slate-400 font-medium">For serious businesses and teams.</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Launching soon
              </span>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-black text-white font-mono">GH₵199</span>
              <span className="text-xs text-slate-400">/ month</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Complete commercial power, advanced integrations, high-volume catalogs, and priority support.
            </p>

            <div className="pt-2 border-t border-slate-800 space-y-2.5 text-xs text-slate-200">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Everything in Plus</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Advanced commerce & custom forms</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Third-party business integrations</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Higher storage & asset capacity</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>Priority account & technical support</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                <span>High-capacity Mystery AI tools</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled
              className="w-full py-3.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
            >
              <span>Launching Soon</span>
            </button>
          </div>
        </article>
      </div>

      {/* Availability Footnote */}
      <p className="text-center text-xs text-slate-500 max-w-xl mx-auto">
        Websites created on the Free tier remain completely free forever. Plus and Pro tiers are launching soon with standard billing.
      </p>

      {/* =========================================================
          3. ULTRA — SEPARATE DISTINCT SERVICE BLOCK
          ========================================================= */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0c1813] via-[#091216] to-[#0d161d] border border-slate-700/80 p-6 sm:p-10 lg:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00c365]/10 rounded-full blur-[110px] pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/40 text-xs font-bold text-[#00c365]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Done-For-You Agency Service</span>
            </div>

            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                Need something beyond the builder?
              </p>
              <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                GO ULTRA
              </h3>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                From GH₵{(ULTRA_SERVICE.startingMinor / 100).toLocaleString()}
              </span>
              <span className="text-xs text-slate-400">· Professional build service</span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              Custom design, additional pages, advanced sections, integrations, domain setup, mobile optimization and dedicated launch support. Final pricing depends on project scope.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Bespoke custom design</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Multi-page build</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Domain & DNS setup</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Mobile performance tuning</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>WhatsApp MoMo integration</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Launch support</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col items-stretch lg:items-end justify-center pt-2 lg:pt-0">
            <button
              type="button"
              onClick={handleOpenUltraModal}
              className="px-6 py-4 rounded-2xl bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(0,195,101,0.35)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer w-full lg:w-auto text-center"
            >
              <span>Request an Ultra Build</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[11px] text-slate-400 mt-2 text-center lg:text-right">
              Direct consultation via WhatsApp
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================
          4. ULTRA ENQUIRY STEP-BASED MODAL
          ========================================================= */}
      {isUltraModalOpen && (
        <div
          role="dialog"
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
    </section>
  );
}
