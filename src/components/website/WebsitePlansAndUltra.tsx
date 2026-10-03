import { API_BASE_URL } from '../../services/apiClient.js';
import React, { useState, useEffect } from 'react';
import { ULTRA_SERVICE, type UltraEnquiryInput } from '../../config/websiteBuilder.js';
import { BUSINESS_CONFIG } from '../../config/business';
import {
  Sparkles,
  Check,
  ArrowRight,
  X,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Send,
  Building,
  Layers,
  Globe,
  Smartphone,
  ExternalLink,
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

  // Progressive disclosure for mobile pricing cards
  const [expandedFeatures, setExpandedFeatures] = useState<{ [planKey: string]: boolean }>({
    free: false,
    plus: false,
    pro: false,
  });

  const toggleFeatures = (planKey: string) => {
    setExpandedFeatures((prev) => ({
      ...prev,
      [planKey]: !prev[planKey],
    }));
  };

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
      <section className="relative rounded-3xl bg-gradient-to-b from-[#0a1310] via-[#080d11] to-[#070b0e] border border-slate-800/90 p-5 sm:p-8 lg:p-10 overflow-hidden shadow-2xl space-y-6 sm:space-y-8 text-white text-left">
        {/* Subtle Architectural Blueprint Grid */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none select-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #00c365 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden="true"
        />

        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#00c365]/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Section Header */}
        <div className="relative z-10 space-y-2 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/35 text-xs font-bold text-[#00c365] uppercase tracking-wider">
            <span>Website Studio Plans</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Start at GH₵0 today with standard publishing, or upgrade as your business scales.
          </p>
        </div>

        {/* =========================================================
            COMMERCIAL PRICING GRID (COMPACT & ARTWORK-PREPARED)
            ========================================================= */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-stretch">
          {/* PLAN 1: FREE */}
          <article className="relative rounded-2xl sm:rounded-3xl bg-[#0b1218]/95 border border-slate-800/90 p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all shadow-sm overflow-hidden">
            {/* Future Artwork Composition Zone (Prepared for tier visual) */}
            <div className="absolute top-0 right-0 w-36 sm:w-44 h-36 sm:h-44 pointer-events-none select-none overflow-hidden opacity-25 sm:opacity-35" aria-hidden="true">
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#0b1218]/80 to-[#0b1218]" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b1218] to-transparent" />
              <div className="w-full h-full border border-dashed border-slate-700/50 rounded-full scale-125 -translate-y-6 translate-x-8" />
            </div>

            <div className="relative z-10 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">FREE</h3>
                  <p className="text-xs text-slate-400 font-medium">Start building for free.</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#00c365] border border-emerald-500/25">
                  Live Today
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-white font-mono">GH₵0</span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Essential tools to create and publish a live business website with zero upfront cost.
              </p>

              {/* Core Features Strip */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs text-slate-200">
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
                  <span>Core business sections &amp; WhatsApp</span>
                </div>

                {/* Progressive Disclosure for Extra Features */}
                {expandedFeatures.free && (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Essential branding &amp; contact setup</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Mystery Hub hosted publishing</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Mystery Hub attribution</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleFeatures('free')}
                  className="pt-1 text-[11px] font-semibold text-[#00c365] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{expandedFeatures.free ? 'Show fewer features' : 'View all features'}</span>
                  {expandedFeatures.free ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="relative z-10 pt-2">
              <button
                type="button"
                onClick={onStartBlank}
                className="w-full py-3 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,195,101,0.2)] active:scale-98 cursor-pointer"
              >
                <span>Start Free</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </article>

          {/* PLAN 2: PLUS (HERO / RECOMMENDED PLAN) */}
          <article className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#0e1d17] via-[#0b1411] to-[#09100d] border-2 border-[#00c365] p-5 sm:p-6 flex flex-col justify-between space-y-4 shadow-[0_0_28px_rgba(0,195,101,0.16)] ring-1 ring-[#00c365]/30 overflow-hidden">
            {/* Future Artwork Composition Zone (Prepared for tier visual) */}
            <div className="absolute top-0 right-0 w-36 sm:w-44 h-36 sm:h-44 pointer-events-none select-none overflow-hidden opacity-30 sm:opacity-40" aria-hidden="true">
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#0e1d17]/85 to-[#0e1d17]" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#09100d] to-transparent" />
              <div className="w-full h-full border border-dashed border-[#00c365]/40 rounded-full scale-125 -translate-y-6 translate-x-8" />
            </div>

            {/* Most Popular Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#00c365] text-black text-[10px] font-black uppercase tracking-wider shadow-md z-20">
              Most Popular
            </div>

            <div className="relative z-10 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">PLUS</h3>
                  <p className="text-xs text-emerald-400 font-medium">Best for growing businesses.</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Coming Soon
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-white font-mono">GH₵49</span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed">
                Enhanced creative freedom, AI assistance, and independent brand identity for established shops.
              </p>

              {/* Core Features Strip */}
              <div className="pt-2 border-t border-[#00c365]/25 space-y-2 text-xs text-slate-100">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Everything in Free</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Handcrafted premium designs</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Mystery AI copywriting &amp; editing</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Custom domain connection</span>
                </div>

                {/* Progressive Disclosure for Extra Features */}
                {expandedFeatures.plus && (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-slate-200">
                      <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Extended typography &amp; branding control</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Expanded website project limits</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleFeatures('plus')}
                  className="pt-1 text-[11px] font-semibold text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{expandedFeatures.plus ? 'Show fewer features' : 'View all features'}</span>
                  {expandedFeatures.plus ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="relative z-10 pt-2">
              <button
                type="button"
                onClick={onStartBlank}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-[#00c365]/50 hover:border-[#00c365] text-[#00c365] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer shadow-sm"
              >
                <span>Start Free (Upgrade Later)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </article>

          {/* PLAN 3: PRO (SERIOUS BUSINESSES & TEAMS) */}
          <article className="relative rounded-2xl sm:rounded-3xl bg-[#0b1016]/95 border border-slate-800/90 p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all shadow-sm overflow-hidden">
            {/* Future Artwork Composition Zone (Prepared for tier visual) */}
            <div className="absolute top-0 right-0 w-36 sm:w-44 h-36 sm:h-44 pointer-events-none select-none overflow-hidden opacity-25 sm:opacity-35" aria-hidden="true">
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#0b1016]/85 to-[#0b1016]" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b1016] to-transparent" />
              <div className="w-full h-full border border-dashed border-slate-700/50 rounded-full scale-125 -translate-y-6 translate-x-8" />
            </div>

            <div className="relative z-10 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">PRO</h3>
                  <p className="text-xs text-slate-400 font-medium">For serious businesses and teams.</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Coming Soon
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-white font-mono">GH₵199</span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Complete commercial power, advanced integrations, high-volume catalogs, and priority support.
              </p>

              {/* Core Features Strip */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs text-slate-200">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Everything in Plus</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Advanced commerce &amp; custom forms</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Third-party business integrations</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Priority account &amp; technical support</span>
                </div>

                {/* Progressive Disclosure for Extra Features */}
                {expandedFeatures.pro && (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Higher storage &amp; asset capacity</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>High-capacity Mystery AI tools</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleFeatures('pro')}
                  className="pt-1 text-[11px] font-semibold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <span>{expandedFeatures.pro ? 'Show fewer features' : 'View all features'}</span>
                  {expandedFeatures.pro ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="relative z-10 pt-2">
              <a
                href={BUSINESS_CONFIG.getGeneralWhatsAppUrl('Hello Mystery Hub, I am inquiring about the Pro Website Studio plan for my business/team.')}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer shadow-sm"
              >
                <span>Inquire for Teams</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </article>
        </div>

        {/* Availability Footnote */}
        <p className="text-center text-[11px] sm:text-xs text-slate-500 max-w-xl mx-auto pt-1">
          Websites created on the Free tier remain completely free forever. Plus and Pro tiers are launching soon with standard billing.
        </p>
      </section>

      {/* =========================================================
          ULTRA — SEPARATE DISTINCT SERVICE BLOCK (RICH VISUALS)
          ========================================================= */}
      <section className="rounded-3xl bg-gradient-to-r from-[#0c1813] via-[#091216] to-[#0d161d] border border-slate-700/80 p-5 sm:p-8 lg:p-10 shadow-2xl relative overflow-hidden text-left">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00c365]/10 rounded-full blur-[110px] pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center relative z-10">
          {/* Left Column: Scope, Pricing, Features, CTA */}
          <div className="lg:col-span-7 space-y-3.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/40 text-xs font-bold text-[#00c365]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Done-For-You Agency Service</span>
            </div>

            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                Need something beyond the builder?
              </p>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                GO ULTRA
              </h3>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                From GH₵{(ULTRA_SERVICE.startingMinor / 100).toLocaleString()}
              </span>
              <span className="text-xs text-slate-400">· Professional build service</span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              Custom design, additional pages, advanced sections, integrations, domain setup, mobile optimization and dedicated launch support. Final pricing depends on project scope.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Bespoke custom design</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Multi-page architecture</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>Domain & DNS setup</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00c365] shrink-0" />
                <span>WhatsApp MoMo integration</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenUltraModal}
                className="px-6 py-3.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,195,101,0.3)] active:scale-[0.98] inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Request an Ultra Build</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Column: Layered Custom-Build Preview Canvas */}
          <div className="lg:col-span-5 relative flex items-center justify-center pt-2 lg:pt-0">
            <div className="w-full max-w-sm rounded-2xl bg-[#070d12] border border-slate-700/80 p-3.5 shadow-xl relative overflow-hidden group">
              {/* Top Window Dots */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 text-[9px] text-slate-400">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500/80" />
                  <span className="w-2 h-2 rounded-full bg-amber-500/80" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
                </div>
                <span className="font-mono text-emerald-400 text-[10px]">ultra-custom.gh</span>
              </div>

              {/* Wireframe Mock Site Elements */}
              <div className="pt-3 space-y-2.5">
                <div className="p-2.5 rounded-xl bg-[#0e171f] border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white">Custom Brand Layout</span>
                    <span className="text-[9px] font-mono text-[#00c365] bg-[#00c365]/10 px-1.5 py-0.5 rounded">Tailored</span>
                  </div>
                  <div className="w-3/4 h-2 rounded bg-slate-700" />
                  <div className="w-1/2 h-1.5 rounded bg-slate-800" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-[#0e171f] border border-slate-800 space-y-1">
                    <span className="text-[9px] font-bold text-slate-300">Catalog & Orders</span>
                    <div className="w-12 h-1 rounded bg-slate-700" />
                  </div>
                  <div className="p-2 rounded-lg bg-[#0e171f] border border-slate-800 space-y-1">
                    <span className="text-[9px] font-bold text-slate-300">Direct WhatsApp</span>
                    <div className="w-14 h-1 rounded bg-emerald-500/40" />
                  </div>
                </div>

                {/* Service Tag Strip */}
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[10px] text-emerald-300">
                  <span className="font-semibold">Dedicated Lead Developer</span>
                  <span className="font-mono font-bold">1-on-1 Scoped</span>
                </div>
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
    </div>
  );
}
