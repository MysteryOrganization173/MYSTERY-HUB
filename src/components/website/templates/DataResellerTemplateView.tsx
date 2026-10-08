import { websiteActionText, resolveResellerTheme } from '../../../utils/websiteBrand';
import { SafeImage } from '../SafeImage.js';
import React, { useState, useEffect, useMemo } from 'react';
import { WebsiteTemplate, TemplateItem } from '../../../types';
import {
  Smartphone,
  Zap,
  CheckCircle2,
  Clock,
  Phone,
  MessageSquare,
  ArrowRight,
  Sparkles,
  Layers,
  HelpCircle,
  ShoppingBag,
  ExternalLink,
  Wifi,
} from 'lucide-react';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../../utils/cloudinary';
import { DATA_RESELLER_STARTER_HERO_IMAGE } from '../../../data/templates';

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
  managedCheckout?: React.ReactNode;
  managedAvailability?: 'loading' | 'available' | 'empty' | 'error';
}

export interface ResellerPackage {
  id: string;
  name: string;
  price: string;
  network: 'mtn' | 'telecel' | 'at';
  tag?: string;
  desc?: string;
}

/**
 * Resolves the Data Reseller hero image.
 * Protects custom images while smoothly migrating old placeholders or missing URLs
 * to the official starter artwork.
 */
export function resolveDataResellerHeroImage(heroImage?: string): string {
  if (
    !heroImage ||
    heroImage.trim() === '' ||
    heroImage.includes('photo-1556742049-0a67e5572293') ||
    heroImage.includes('Neon_Data_Bundles_in_Accra')
  ) {
    return DATA_RESELLER_STARTER_HERO_IMAGE;
  }
  return heroImage;
}

export const DataResellerTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick, managedCheckout, managedAvailability }) => {
  const [selectedNetwork, setSelectedNetwork] = useState<'mtn' | 'telecel' | 'at'>('mtn');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [orderNotice, setOrderNotice] = useState<string | null>(null);


  const businessName = template.demoBusinessName || 'QuickByte Data';
  const tagline = template.demoHeroTagline || 'Affordable data. Simple delivery.';
  const aboutText = managedCheckout ? managedAvailability === 'available' ? "Choose your bundle, enter the recipient, and pay securely. Mystery Hub manages delivery and order tracking." : "Check bundle availability below. You can still track an existing order or contact the business." :
    template.demoSubtext || (template.siteContent ? '' :
    'Buy MTN, Telecel and AirtelTigo bundles from one simple storefront. Choose your package, enter the recipient number and place your order through WhatsApp.');
  const location = template.siteContent ? template.location || '' : template.location || 'Sample store location';
  const contact = template.siteContent ? template.siteContent.phone || '' : template.hoursOrContact || '+233 24 555 7788';
  const whatsapp = template.siteContent ? template.siteContent.whatsapp || template.siteContent.phone || '' : template.hoursOrContact || contact;

  const p = resolveResellerTheme(template.colorScheme || {
    primary: '#0f172a',
    secondary: '#2563eb',
    background: '#0a0f1d',
    surface: '#111a2e',
    text: '#f8fafc',
    mutedText: '#94a3b8',
    accent: '#2563eb',
    border: '#1e293b',
  });

  const heroImageSrc = resolveDataResellerHeroImage(template.heroImage);
  const optimizedHeroSrc = getCloudinaryUrl(heroImageSrc, { format: 'auto', quality: 'auto', width: 1200 });
  const heroSrcSet = getCloudinarySrcSet(heroImageSrc, [360, 430, 640, 768, 1024, 1280, 1600], {
    format: 'auto',
    quality: 'auto',
  });

  // Helper to categorize item network
  const detectNetworkFromCategory = (cat?: string): 'mtn' | 'telecel' | 'at' => {
    if (!cat) return 'mtn';
    const c = cat.toLowerCase().trim();
    if (c.includes('telecel') || c.includes('vodafone')) return 'telecel';
    if (c.includes('at') || c.includes('airtel') || c.includes('tigo')) return 'at';
    return 'mtn';
  };

  // Convert template.items to typed ResellerPackage records
  const allPackages = useMemo<ResellerPackage[]>(() => {
    if (template.siteContent && template.items?.length === 0) return [];
    if (!template.items || template.items.length === 0) {
      // Sensible sample demonstration packages
      return [
        { id: 'sample-mtn-1', name: '1GB Non-Expiry', price: '12.00', network: 'mtn', tag: 'Standard' },
        { id: 'sample-mtn-2', name: '2.5GB Non-Expiry', price: '25.00', network: 'mtn', tag: 'Popular' },
        { id: 'sample-mtn-3', name: '5GB Non-Expiry', price: '48.00', network: 'mtn', tag: 'Best Value' },
        { id: 'sample-mtn-4', name: '10GB Non-Expiry', price: '90.00', network: 'mtn', tag: 'Hot' },
        { id: 'sample-tel-1', name: '1GB Telecel Bundle', price: '11.00', network: 'telecel', tag: 'Standard' },
        { id: 'sample-tel-2', name: '2.5GB Telecel Bundle', price: '23.00', network: 'telecel', tag: 'Popular' },
        { id: 'sample-tel-3', name: '5GB Telecel Bundle', price: '45.00', network: 'telecel', tag: 'Best Value' },
        { id: 'sample-at-1', name: '1GB AT Big Time', price: '10.00', network: 'at', tag: 'Standard' },
        { id: 'sample-at-2', name: '2.5GB AT Big Time', price: '22.00', network: 'at', tag: 'Popular' },
        { id: 'sample-at-3', name: '5GB AT Big Time', price: '42.00', network: 'at', tag: 'Best Value' },
      ];
    }

    return template.items.map((item, idx) => {
      const priceClean = (item.price || '').replace(/[^0-9.]/g, '') || (template.siteContent ? '' : '15.00');
      return {
        id: item.id || `item-${idx}`,
        name: item.name,
        price: priceClean,
        network: detectNetworkFromCategory(item.category),
        tag: item.tag,
        desc: item.desc,
      };
    });
  }, [template.items]);

  // Packages strictly for the selected network
  const currentNetworkPackages = useMemo(() => {
    return allPackages.filter((pkg) => pkg.network === selectedNetwork);
  }, [allPackages, selectedNetwork]);

  // Active selected package state (strictly resets on network switch)
  const [selectedPackage, setSelectedPackage] = useState<ResellerPackage | null>(null);

  useEffect(() => {
    if (currentNetworkPackages.length > 0) {
      setSelectedPackage((prev) => {
        if (prev && currentNetworkPackages.some((p) => p.id === prev.id)) {
          return prev;
        }
        return currentNetworkPackages[0];
      });
    } else {
      setSelectedPackage(null);
    }
  }, [selectedNetwork, currentNetworkPackages]);

  const cleanWhatsappNumber = whatsapp.replace(/\D/g, '').replace(/^0/, '233');

  const handleOrderViaWhatsapp = () => {
    if (onCtaClick) {
      onCtaClick();
      return;
    }

    if (!selectedPackage) {
      setOrderNotice('Please select an available package first.');
      return;
    }

    if (!cleanWhatsappNumber) {
      setOrderNotice('Contact WhatsApp number not configured yet.');
      return;
    }

    const netName =
      selectedNetwork === 'mtn' ? 'MTN' : selectedNetwork === 'telecel' ? 'Telecel' : 'AirtelTigo (AT)';
    const phoneDetail = recipientPhone.trim()
      ? `Recipient Number: ${recipientPhone.trim()}`
      : 'Recipient Number: (my line)';

    const text = `Hello ${businessName},\n\nI want to order:\nNetwork: ${netName}\nPackage: ${selectedPackage.name}\nPrice: GH₵ ${selectedPackage.price}\n${phoneDetail}\n\nPlease share your MoMo payment details.`;

    const url = `https://wa.me/${cleanWhatsappNumber}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleChatWhatsapp = () => {
    if (onCtaClick) {
      onCtaClick();
      return;
    }
    if (!cleanWhatsappNumber) {
      setOrderNotice('Contact WhatsApp number not configured yet.');
      return;
    }
    const text = `Hello ${businessName}, I would like to inquire about your data packages.`;
    const url = `https://wa.me/${cleanWhatsappNumber}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const scrollToCatalog = () => {
    const el = document.getElementById('bundle-catalog');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Restrained network accent color
  const activeNetworkColor =
    selectedNetwork === 'mtn'
      ? '#FFCC00'
      : selectedNetwork === 'telecel'
      ? '#E60000'
      : '#004B93';

  return (
    <div
      className="reseller-storefront min-h-full font-sans antialiased  flex flex-col selection:bg-[var(--website-accent)] selection:text-[var(--website-on-accent)]"
      style={{ backgroundColor: p.background, color:p.text, '--website-accent':p.accent, '--website-on-accent':websiteActionText(p.accent), '--website-focus':p.focus, '--website-placeholder':p.mutedText } as React.CSSProperties}
    >
      <style>{`.reseller-storefront button,.reseller-storefront a {min-height:44px;} .reseller-storefront button:focus-visible,.reseller-storefront a:focus-visible,.reseller-storefront input:focus-visible {outline:2px solid var(--website-focus);outline-offset:3px;} .reseller-storefront input::placeholder {color:var(--website-placeholder);opacity:1;}`}</style>
      {/* =========================================================
          1. BRANDED HEADER & NAVIGATION
          ========================================================= */}
      <header
        className="px-4 sm:px-8 py-3.5 border-b flex items-center justify-between sticky top-0 z-30 backdrop-blur-md transition-colors"
        style={{ backgroundColor: p.surface, borderColor: p.border, color:p.surfaceText }}
      >
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-md shrink-0 "
            style={{ backgroundColor: p.accent, color:websiteActionText(p.accent), borderColor:p.border }}
          >
            {template.siteContent?.logoUrl ? <SafeImage src={template.siteContent.logoUrl} alt={`${template.demoBusinessName} logo`} className="w-9 h-9 shrink-0 rounded-lg" style={{objectFit:'contain'}} /> : <Smartphone className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight leading-none" style={{ color: p.surfaceText }}>
                {businessName}
              </h1>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{backgroundColor:p.accent}} />
            </div>
            <p className="text-[10px] sm:text-xs font-medium" style={{ color: p.surfaceMutedText }}>
              Data Bundle Store
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {whatsapp && (
            <button
              type="button"
              data-website-event="whatsapp_click"
                  onClick={handleChatWhatsapp}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 bg-[#25D366] hover:bg-[#22c35e] text-black"
            >
              <MessageSquare className="w-3.5 h-3.5 fill-black" />
              <span className="hidden sm:inline">WhatsApp Support</span>
              <span className="sm:hidden">WhatsApp</span>
            </button>
          )}
        </div>
      </header>

      {/* =========================================================
          2. DATA RESELLER HERO WITH BLENDED STARTER ARTWORK
          ========================================================= */}
      <section className="px-4 sm:px-8 py-4 sm:py-8 max-w-6xl mx-auto w-full">
        <div
          className="relative rounded-2xl sm:rounded-3xl border overflow-hidden p-5 sm:p-8 lg:p-10 shadow-2xl transition-all"
          style={{
            backgroundColor: p.surface,
            borderColor: `${p.accent}25`,
          }}
        >
          {/* Integrated Background Artwork Layer (Right on Desktop, Right/Lower on Mobile) */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
            {/* Ambient Accent Glow */}
            <div
              className="absolute -top-12 -right-12 w-72 sm:w-96 h-72 sm:h-96 rounded-full blur-[100px] opacity-35"
              style={{ backgroundColor: p.accent }}
            />

            {/* Artwork Image */}
            <div className="absolute right-0 bottom-0 top-0 w-full sm:w-3/5 lg:w-1/2 flex items-end justify-end">
              <SafeImage
                src={optimizedHeroSrc}
                srcSet={heroSrcSet || undefined}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 600px"
                alt={businessName}
                className="w-full h-full object-cover object-right-bottom sm:object-right opacity-45 sm:opacity-55 transition-opacity"
                loading="eager"
                fetchPriority="high"
                width={1200}
                height={750}
              />
            </div>

            {/* Continuous Text Protection Dark Gradient: Left strong protection, Center medium fade, Right light overlay */}
            <div
              className="hidden sm:block absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(to right, ${p.surface} 0%, ${p.surface} 45%, ${p.surface}e6 65%, ${p.surface}4d 85%, transparent 100%)`,
              }}
            />
            {/* Mobile Gradient: strong at top/left, soft fade to right/bottom allowing artwork recognition */}
            <div
              className="sm:hidden absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(to bottom, ${p.surface} 0%, ${p.surface}f2 55%, ${p.surface}b3 100%)`,
              }}
            />
          </div>

          {/* Content Layer (Left-aligned, crisp, high-contrast, fully protected) */}
          <div style={{backgroundColor:p.surface, color:p.surfaceText}} className="relative z-10 max-w-xl text-left space-y-4 sm:space-y-5 rounded-xl p-3">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border"
              style={{
                backgroundColor: p.surface,
                borderColor: p.border,
                color: p.surfaceText,
              }}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>MTN · Telecel · AirtelTigo</span>
            </div>

            <h2
              className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15]"
              style={{ color: p.surfaceText }}
            >
              {tagline}
            </h2>

            <p className="text-xs sm:text-sm leading-relaxed max-w-lg" style={{ color: p.surfaceMutedText }}>
              {aboutText}
            </p>

            {/* Compact Trust / Support Row */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 py-2.5 border-y max-w-lg" style={{ borderColor: `${p.border}80` }}>
              <div className="space-y-0.5">
                <div className="text-xs font-bold  flex items-center gap-1">
                  <Wifi className="w-3 h-3" style={{color:p.surfaceAccentText}} />
                  <span>Multiple Networks</span>
                </div>
                <div className="text-[10px]" style={{ color: p.surfaceMutedText }}>
                  MTN · Telecel · AT
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-xs font-bold  flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3" style={{color:p.surfaceAccentText}} />
                  <span>Simple Ordering</span>
                </div>
                <div className="text-[10px]" style={{ color: p.surfaceMutedText }}>
                  {managedCheckout?'Select & Pay':'Select & WhatsApp'}
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-xs font-bold  flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" style={{color:p.surfaceAccentText}} />
                  <span>{managedCheckout?"Managed checkout":"Direct Chat"}</span>
                </div>
                <div className="text-[10px]" style={{ color: p.surfaceMutedText }}>
                  {managedCheckout?'Managed delivery':'Prompt WhatsApp'}
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                data-website-primary-cta="true"
                onClick={scrollToCatalog}
                className="px-5 py-3 border rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 cursor-pointer active:scale-95 "
                style={{ backgroundColor: p.accent, color:websiteActionText(p.accent), borderColor:p.border }}
              >
                <span>{managedCheckout && managedAvailability !== 'available' ? managedAvailability === 'loading' ? 'Check Availability' : 'View Availability' : 'Buy Data'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {whatsapp && (
                <button
                  type="button"
                  data-website-event="whatsapp_click"
                  onClick={handleChatWhatsapp}
                  className="px-5 py-3 rounded-xl font-semibold text-xs transition-colors flex items-center gap-2 border cursor-pointer hover:bg-white/5"
                  style={{
                    backgroundColor: p.surface,
                    borderColor: p.border,
                    color: p.surfaceText,
                  }}
                >
                  <MessageSquare className="w-4 h-4 text-[#25D366]" />
                  <span>Chat on WhatsApp</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          3. INTERACTIVE BUNDLE CATALOG
          ========================================================= */}
      <main id="bundle-catalog" className="px-4 sm:px-8 py-6 max-w-6xl mx-auto w-full space-y-8 flex-1 scroll-mt-20">
        {managedCheckout || <>
        {/* Network Selection Bar */}
        <div
          className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg"
          style={{ backgroundColor: p.surface, borderColor: p.border, color:p.surfaceText }}
        >
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedNetwork('mtn')}
              aria-pressed={selectedNetwork === 'mtn'}
              style={selectedNetwork === 'mtn' ? undefined : {backgroundColor:p.surface,color:p.surfaceText,borderColor:p.border}}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                selectedNetwork === 'mtn'
                  ? 'bg-[#FFCC00] text-black shadow-[0_0_18px_rgba(255,204,0,0.35)] border border-[#FFCC00] font-extrabold scale-[1.02]'
                  : 'border'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${selectedNetwork === 'mtn' ? 'bg-black/80' : 'bg-[#FFCC00]'}`} />
              <span>MTN</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedNetwork('telecel')}
              aria-pressed={selectedNetwork === 'telecel'}
              style={selectedNetwork === 'telecel' ? undefined : {backgroundColor:p.surface,color:p.surfaceText,borderColor:p.border}}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                selectedNetwork === 'telecel'
                  ? 'bg-[#E60000] text-white shadow-[0_0_18px_rgba(230,0,0,0.35)] border border-[#E60000] font-extrabold scale-[1.02]'
                  : 'border'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white" />
              <span>Telecel</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedNetwork('at')}
              aria-pressed={selectedNetwork === 'at'}
              style={selectedNetwork === 'at' ? undefined : {backgroundColor:p.surface,color:p.surfaceText,borderColor:p.border}}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                selectedNetwork === 'at'
                  ? 'bg-[#004B93] text-white shadow-[0_0_18px_rgba(2,132,199,0.35)] border border-[#38bdf8] font-extrabold scale-[1.02]'
                  : 'border'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white" />
              <span>AirtelTigo (AT)</span>
            </button>
          </div>

          <div className="text-xs px-2 flex items-center justify-between sm:justify-end gap-2" style={{ color: p.surfaceMutedText }}>
            <span>
              {currentNetworkPackages.length} package{currentNetworkPackages.length === 1 ? '' : 's'} available
            </span>
          </div>
        </div>

        {/* Packages Grid */}
        {currentNetworkPackages.length === 0 ? (
          <div
            className="p-10 text-center rounded-3xl border space-y-3"
            style={{ backgroundColor: p.surface, borderColor: p.border, color:p.surfaceText }}
          >
            <HelpCircle className="w-10 h-10 mx-auto " />
            <div className="space-y-1">
              <h4 className="font-bold  text-sm">
                No {selectedNetwork.toUpperCase()} packages currently listed
              </h4>
              <p className="text-xs ">
                The business owner has not added bundles for {selectedNetwork.toUpperCase()} yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {currentNetworkPackages.map((pkg) => {
              const isSelected = selectedPackage?.id === pkg.id;
              return (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`p-3.5 sm:p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-3 relative group ${
                    isSelected
                      ? 'shadow-xl -translate-y-1 bg-slate-900/90 ring-2'
                      : 'hover:border-slate-600 bg-opacity-80'
                  }`}
                  style={{
                    backgroundColor: p.surface,
                    borderColor: isSelected ? activeNetworkColor : p.border,
                    // @ts-expect-error inline custom property for ring
                    '--tw-ring-color': isSelected ? activeNetworkColor : 'transparent',
                  }}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span style={{color:p.surfaceText}} className="text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {pkg.tag || 'Standard'}
                      </span>
                      {isSelected && (
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                          style={{
                            backgroundColor: activeNetworkColor,
                            color: selectedNetwork === 'mtn' ? '#000000' : '#ffffff',
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                    <h4 className="font-extrabold text-sm sm:text-base tracking-tight leading-snug" style={{ color: p.surfaceText }}>
                      {pkg.name}
                    </h4>
                    {pkg.desc && (
                      <p className="text-[11px] line-clamp-2" style={{ color: p.surfaceMutedText }}>
                        {pkg.desc}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t" style={{ borderColor: `${p.border}80` }}>
                    <div className="text-[10px] uppercase font-bold tracking-wider" style={{ color: p.surfaceMutedText }}>
                      Price
                    </div>
                    <div className="font-black text-base sm:text-lg" style={{ color: p.surfaceAccentText }}>
                      GH₵ {pkg.price}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Order Formulation Card */}
        {selectedPackage && (
          <div
            className="p-5 sm:p-7 rounded-2xl sm:rounded-3xl border shadow-2xl space-y-5 max-w-lg mx-auto backdrop-blur-sm"
            style={{ backgroundColor: p.surface, borderColor: p.border, color:p.surfaceText }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: p.border }}>
              <div>
                <span className="text-xs uppercase tracking-wider font-bold" style={{ color: p.surfaceMutedText }}>
                  Selected Bundle
                </span>
                <h3 className="font-extrabold text-base sm:text-lg" style={{ color: p.surfaceText }}>
                  {selectedNetwork.toUpperCase()} · {selectedPackage.name}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase tracking-wider font-bold" style={{ color: p.surfaceMutedText }}>
                  Price
                </span>
                <div className="font-black text-xl sm:text-2xl" style={{ color: p.surfaceAccentText }}>
                  GH₵ {selectedPackage.price}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold ">
                Recipient Ghana Phone Number (Optional)
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4  absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="e.g. 024 123 4567"
                  className="w-full  border rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--website-focus)]"
                  style={{ borderColor: p.border, backgroundColor:p.background, color:p.text }}
                />
              </div>
              <p className="text-[11px]" style={{ color: p.surfaceMutedText }}>
                Leave empty if purchasing for the phone you are ordering with.
              </p>
            </div>

            {orderNotice && (
              <p style={{color:p.surfaceText,borderColor:p.border}} className="text-xs border p-2.5 rounded-xl">
                {orderNotice}
              </p>
            )}

            <button
              type="button"
              onClick={handleOrderViaWhatsapp}
              className="w-full py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer active:scale-[0.99] bg-[#25D366] hover:bg-[#22c35e] text-black"
            >
              <MessageSquare className="w-4 h-4 fill-black" />
              <span>Order via WhatsApp · GH₵ {selectedPackage.price}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-[11px] text-center" style={{ color: p.surfaceMutedText }}>
              Connects directly to WhatsApp with your chosen package pre-filled.
            </p>
          </div>
        )}

        {/* 3 Step Process Guide */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div
            className="p-5 rounded-2xl border text-left space-y-2"
            style={{ backgroundColor: p.surface, borderColor: p.border, color:p.surfaceText }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
              style={{ backgroundColor: p.surface, color: p.surfaceAccentText }}
            >
              1
            </div>
            <h4 className="font-bold text-sm ">Choose Network & Package</h4>
            <p className="text-xs  leading-relaxed">
              Select your network (MTN, Telecel, or AT) and tap your preferred data bundle.
            </p>
          </div>

          <div
            className="p-5 rounded-2xl border text-left space-y-2"
            style={{ backgroundColor: p.surface, borderColor: p.border, color:p.surfaceText }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
              style={{ backgroundColor: p.surface, color: p.surfaceAccentText }}
            >
              2
            </div>
            <h4 className="font-bold text-sm ">Send WhatsApp Order</h4>
            <p className="text-xs  leading-relaxed">
              Tap Order to open WhatsApp with your chosen bundle and line pre-filled.
            </p>
          </div>

          <div
            className="p-5 rounded-2xl border text-left space-y-2"
            style={{ backgroundColor: p.surface, borderColor: p.border, color:p.surfaceText }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
              style={{ backgroundColor: p.surface, color: p.surfaceAccentText }}
            >
              3
            </div>
            <h4 className="font-bold text-sm ">Direct Line Delivery</h4>
            <p className="text-xs  leading-relaxed">
              Complete payment on WhatsApp and receive data credited directly to your SIM.
            </p>
          </div>
        </div>
        </>}
      </main>

      {/* =========================================================
          4. FOOTER & BUSINESS DETAILS
          ========================================================= */}
      <footer
        className="mt-12 border-t py-8 px-4 sm:px-8 text-xs space-y-4"
        style={{ backgroundColor: p.surface, borderColor: p.border, color:p.surfaceText }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <div className="font-bold  text-sm">{businessName}</div>
            <div className="text-[11px]" style={{ color: p.surfaceMutedText }}>
              {location}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            {contact && (
              <a href={`tel:${contact}`} className="flex items-center gap-1.5  transition-colors">
                <Phone className="w-3.5 h-3.5" />
                <span>{contact}</span>
              </a>
            )}
            {whatsapp && (
              <button
                type="button"
                data-website-event="whatsapp_click"
                  onClick={handleChatWhatsapp}
                className="flex items-center gap-1.5  transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                <span>WhatsApp</span>
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
