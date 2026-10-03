import { API_BASE_URL } from '../../services/apiClient.js';
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
  ChevronDown,
  ChevronUp,
  Send,
} from 'lucide-react';

const FREE_TIER_ARTWORK =
  'https://res.cloudinary.com/da6oeat7m/image/upload/v1791055733/ChatGPT_Image_Oct_3_2026_06_52_28_PM-1_exdift.png';
const PLUS_TIER_ARTWORK =
  'https://res.cloudinary.com/da6oeat7m/image/upload/v1791055761/ChatGPT_Image_Oct_3_2026_06_52_48_PM-3_pznnrh.png';
const PRO_TIER_ARTWORK =
  'https://res.cloudinary.com/da6oeat7m/image/upload/v1791055780/ChatGPT_Image_Oct_3_2026_06_52_40_PM-2_fpgsbq.png';
const ULTRA_TIER_ARTWORK =
  'https://res.cloudinary.com/da6oeat7m/image/upload/v1791055793/ChatGPT_Image_Oct_3_2026_06_52_54_PM-4_glzvrg.png';

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

  // Transformed Cloudinary URLs and responsive srcSets for pricing card artwork
  const freeArtworkUrl = getCloudinaryUrl(FREE_TIER_ARTWORK, { format: 'auto', quality: 'auto', width: 800 });
  const freeArtworkSrcSet = getCloudinarySrcSet(FREE_TIER_ARTWORK, [360, 600, 800]);

  const plusArtworkUrl = getCloudinaryUrl(PLUS_TIER_ARTWORK, { format: 'auto', quality: 'auto', width: 900 });
  const plusArtworkSrcSet = getCloudinarySrcSet(PLUS_TIER_ARTWORK, [360, 600, 900]);

  const proArtworkUrl = getCloudinaryUrl(PRO_TIER_ARTWORK, { format: 'auto', quality: 'auto', width: 900 });
  const proArtworkSrcSet = getCloudinarySrcSet(PRO_TIER_ARTWORK, [360, 600, 900]);

  const ultraArtworkUrl = getCloudinaryUrl(ULTRA_TIER_ARTWORK, { format: 'auto', quality: 'auto', width: 1200 });
  const ultraArtworkSrcSet = getCloudinarySrcSet(ULTRA_TIER_ARTWORK, [480, 800, 1200]);

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
            Create and publish your business website for free today, or explore upcoming premium capabilities as you grow.
          </p>
        </div>

        {/* =========================================================
            COMMERCIAL PRICING GRID (TRUTHFUL & ARTWORK-PREPARED)
            ========================================================= */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-stretch">
          {/* PLAN 1: FREE */}
          <article className="relative rounded-2xl sm:rounded-3xl bg-[#0b1218]/95 border border-slate-800/90 p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all shadow-sm overflow-hidden">
            {/* Integrated Background-Right Artwork (Free Tier) — Clearly visible yet restrained */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none select-none rounded-2xl sm:rounded-3xl" aria-hidden="true">
              <div className="absolute right-0 bottom-0 top-0 w-3/4 sm:w-2/3 flex items-end justify-end overflow-hidden">
                <SafeImage
                  src={freeArtworkUrl}
                  srcSet={freeArtworkSrcSet || undefined}
                  sizes="(max-width: 640px) 240px, 320px"
                  alt=""
                  className="w-full h-full object-cover sm:object-contain object-right-bottom opacity-48 sm:opacity-52 transition-opacity"
                  loading="lazy"
                />
              </div>
              {/* Continuous text-protection gradient: Left (strong dark), Center (medium fade), Right (light overlay) */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#0b1218] from-30% via-[#0b1218]/85 via-65% to-[#0b1218]/20 pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0b1218]/90 via-[#0b1218]/50 to-transparent pointer-events-none" />
            </div>

            <div className="relative z-10 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">FREE</h3>
                  <p className="text-xs text-slate-400 font-medium">Start building for free.</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#00c365] border border-emerald-500/25 shrink-0">
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
                  <span>Standard Ghana-focused templates</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Core business sections</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>WhatsApp &amp; contact integration</span>
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
                      <span>Clean responsive mobile view</span>
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

          {/* PLAN 2: PLUS (HERO TIER — FUTURE PREMIUM BUILDER) */}
          <article className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#0e1d17] via-[#0b1411] to-[#09100d] border-2 border-[#00c365] p-5 sm:p-6 flex flex-col justify-between space-y-4 shadow-[0_0_30px_rgba(0,195,101,0.18)] ring-1 ring-[#00c365]/35 overflow-visible">
            {/* Integrated Background-Right Artwork (Plus Tier) — Vibrant, multi-device creative cluster */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none select-none rounded-2xl sm:rounded-3xl" aria-hidden="true">
              <div className="absolute right-0 bottom-0 top-0 w-3/4 sm:w-2/3 flex items-end justify-end overflow-hidden">
                <SafeImage
                  src={plusArtworkUrl}
                  srcSet={plusArtworkSrcSet || undefined}
                  sizes="(max-width: 640px) 260px, 340px"
                  alt=""
                  className="w-full h-full object-cover sm:object-contain object-right-bottom opacity-55 sm:opacity-65 transition-opacity"
                  loading="lazy"
                />
              </div>
              {/* Continuous text-protection gradient: strong emerald-dark on left, subtle light overlay on artwork right */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#0e1d17] from-30% via-[#0b1411]/85 via-65% to-[#09100d]/15 pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#09100d]/90 via-[#09100d]/50 to-transparent pointer-events-none" />
            </div>

            {/* Most Popular Badge — Classic overlapping badge (half inside / half above the card edge) */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <span className="inline-flex items-center px-3.5 py-1 rounded-full bg-[#00c365] text-black text-[10px] font-black uppercase tracking-wider shadow-md border border-[#00e575]">
                Most Popular
              </span>
            </div>

            <div className="relative z-10 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">PLUS</h3>
                  <p className="text-xs text-emerald-400 font-medium">For growing businesses that want more control over their brand and website.</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 shrink-0">
                  Coming Soon
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-white font-mono">GH₵49</span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed">
                Enhanced creative freedom, AI editing tools, and custom branding for growing Ghanaian businesses.
              </p>

              {/* Core Features Strip */}
              <div className="pt-2 border-t border-[#00c365]/25 space-y-2 text-xs text-slate-100">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Premium website designs</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Expanded branding &amp; design controls</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Custom domain connection</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Mystery AI editing tools</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Expanded project capacity</span>
                </div>

                {/* Progressive Disclosure for Extra Features */}
                {expandedFeatures.plus && (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-slate-200">
                      <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Extended typography &amp; styling</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Priority CDN asset hosting</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleFeatures('plus')}
                  className="pt-1 text-[11px] font-semibold text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{expandedFeatures.plus ? 'Hide features' : 'View all features'}</span>
                  {expandedFeatures.plus ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </article>

          {/* PLAN 3: PRO (SERIOUS BUSINESSES & TEAMS) */}
          <article className="relative rounded-2xl sm:rounded-3xl bg-[#0b1016]/95 border border-slate-800/90 p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all shadow-sm overflow-hidden">
            {/* Integrated Background-Right Artwork (Pro Tier) — Serious commercial analytics & operations UI */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none select-none rounded-2xl sm:rounded-3xl" aria-hidden="true">
              <div className="absolute right-0 bottom-0 top-0 w-3/4 sm:w-2/3 flex items-end justify-end overflow-hidden">
                <SafeImage
                  src={proArtworkUrl}
                  srcSet={proArtworkSrcSet || undefined}
                  sizes="(max-width: 640px) 260px, 340px"
                  alt=""
                  className="w-full h-full object-cover sm:object-contain object-right-bottom opacity-52 sm:opacity-58 transition-opacity"
                  loading="lazy"
                />
              </div>
              {/* Slate/corporate continuous text-protection gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#0b1016] from-30% via-[#0b1016]/85 via-65% to-[#0b1016]/15 pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0b1016]/90 via-[#0b1016]/50 to-transparent pointer-events-none" />
            </div>

            <div className="relative z-10 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">PRO</h3>
                  <p className="text-xs text-slate-400 font-medium">For serious businesses and teams.</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
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
                  <span>Advanced commerce &amp; business tools</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Custom forms &amp; advanced workflows</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Third-party business integrations</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Higher-capacity catalogs and assets</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>Priority technical &amp; account support</span>
                </div>

                {/* Progressive Disclosure for Extra Features */}
                {expandedFeatures.pro && (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Team collaboration capabilities</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-[#00c365] shrink-0" />
                      <span>Dedicated infrastructure scaling</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleFeatures('pro')}
                  className="pt-1 text-[11px] font-semibold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <span>{expandedFeatures.pro ? 'Hide features' : 'View all features'}</span>
                  {expandedFeatures.pro ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </article>
        </div>

        {/* Availability Footnote */}
        <p className="text-center text-[11px] sm:text-xs text-slate-500 max-w-xl mx-auto pt-1">
          Free stays free. Plus and Pro are coming soon.
        </p>
      </section>

      {/* =========================================================
          ULTRA — SEPARATE DISTINCT SERVICE BLOCK (RICH VISUALS)
          ========================================================= */}
      <section className="rounded-3xl bg-gradient-to-r from-[#0c1813] via-[#091216] to-[#0d161d] border border-slate-700/80 p-5 sm:p-7 lg:p-8 shadow-2xl relative overflow-hidden text-left">
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
