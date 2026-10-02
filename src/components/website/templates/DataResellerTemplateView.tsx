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

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
}

export interface ResellerPackage {
  id: string;
  name: string;
  price: string;
  network: 'mtn' | 'telecel' | 'at';
  tag?: string;
  desc?: string;
}

export const DataResellerTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick }) => {
  const [selectedNetwork, setSelectedNetwork] = useState<'mtn' | 'telecel' | 'at'>('mtn');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [orderNotice, setOrderNotice] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const businessName = template.demoBusinessName || 'Ghana Data Express';
  const tagline = template.demoHeroTagline || 'Affordable Data Bundles, Straight to Your Line';
  const aboutText =
    template.demoSubtext ||
    'Buy MTN, Telecel and AirtelTigo bundles from one simple storefront. Choose your package, enter the recipient number and place your order through WhatsApp.';
  const location = template.location || 'Accra, Ghana · Available Daily for Direct WhatsApp Orders';
  const contact = template.hoursOrContact || '+233 24 555 7788';
  const whatsapp = template.hoursOrContact || contact;

  const p = template.colorScheme || {
    primary: '#09151f',
    secondary: '#00c365',
    background: '#070c10',
    surface: '#0f1722',
    text: '#f8fafc',
    mutedText: '#94a3b8',
    accent: '#00c365',
    border: '#1e293b',
  };

  const heroImageSrc =
    template.heroImage ||
    'https://images.unsplash.com/photo-1556742049-0a67e5572293?auto=format&fit=crop&w=1200&q=80';

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
      const priceClean = (item.price || '').replace(/[^0-9.]/g, '') || '15.00';
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

  const cleanWhatsappNumber = whatsapp.replace(/\D/g, '');

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

    const text = `Hello ${businessName},\n\nI want to order:\nNetwork: ${netName}\nPackage: ${selectedPackage.name}\nPrice: GH₵ ${selectedPackage.price}\n${phoneDetail}\n\nPlease share your payment instructions.`;

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

  return (
    <div
      className="min-h-full font-sans antialiased text-slate-100 flex flex-col selection:bg-[#00c365] selection:text-black"
      style={{ backgroundColor: p.background }}
    >
      {/* =========================================================
          1. BRANDED HEADER & NAVIGATION
          ========================================================= */}
      <header
        className="px-4 sm:px-8 py-3.5 border-b flex items-center justify-between sticky top-0 z-30 backdrop-blur-md transition-colors"
        style={{ backgroundColor: `${p.surface}f2`, borderColor: p.border }}
      >
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-md shrink-0"
            style={{ backgroundColor: p.accent, color: '#000000' }}
          >
            <Smartphone className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight leading-none" style={{ color: p.text }}>
                {businessName}
              </h1>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[10px] sm:text-xs font-medium" style={{ color: p.mutedText }}>
              Direct SIM Top-Up Storefront
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {whatsapp && (
            <button
              type="button"
              onClick={handleChatWhatsapp}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
              style={{ backgroundColor: p.accent, color: '#000000' }}
            >
              <MessageSquare className="w-3.5 h-3.5 fill-black" />
              <span className="hidden sm:inline">WhatsApp Support</span>
              <span className="sm:hidden">WhatsApp</span>
            </button>
          )}
        </div>
      </header>

      {/* =========================================================
          2. DATA RESELLER HERO WITH REAL HERO IMAGE ASSET
          ========================================================= */}
      <section className="px-4 sm:px-8 py-8 sm:py-14 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Natural Market Copy */}
          <div className="lg:col-span-7 text-left space-y-5">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border"
              style={{
                backgroundColor: `${p.accent}15`,
                borderColor: `${p.accent}35`,
                color: p.accent,
              }}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Quick SIM Top-Up · Instant Delivery</span>
            </div>

            <h2
              className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15]"
              style={{ color: p.text }}
            >
              {tagline}
            </h2>

            <p className="text-xs sm:text-sm leading-relaxed max-w-xl" style={{ color: p.mutedText }}>
              {aboutText}
            </p>

            {/* Compact Trust / Support Row */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 py-2 border-y" style={{ borderColor: `${p.border}80` }}>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span>Multiple Networks</span>
                </div>
                <div className="text-[10px]" style={{ color: p.mutedText }}>
                  MTN · Telecel · AT
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3 text-emerald-400" />
                  <span>Simple Ordering</span>
                </div>
                <div className="text-[10px]" style={{ color: p.mutedText }}>
                  Select & WhatsApp
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-emerald-400" />
                  <span>WhatsApp Support</span>
                </div>
                <div className="text-[10px]" style={{ color: p.mutedText }}>
                  Direct Merchant Chat
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={scrollToCatalog}
                className="px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 cursor-pointer active:scale-95"
                style={{ backgroundColor: p.accent, color: '#000000' }}
              >
                <span>Buy Data</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {whatsapp && (
                <button
                  type="button"
                  onClick={handleChatWhatsapp}
                  className="px-5 py-3 rounded-xl font-semibold text-xs transition-colors flex items-center gap-2 border cursor-pointer hover:bg-white/5"
                  style={{
                    backgroundColor: `${p.surface}b3`,
                    borderColor: p.border,
                    color: p.text,
                  }}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat on WhatsApp</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Hero Image Asset */}
          <div className="lg:col-span-5 relative">
            <div
              className="rounded-3xl border overflow-hidden p-2 sm:p-2.5 backdrop-blur-md relative shadow-2xl transition-all"
              style={{ backgroundColor: `${p.surface}b3`, borderColor: p.border }}
            >
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/3] bg-black/60">
                {!imageError ? (
                  <img
                    src={heroImageSrc}
                    alt={businessName}
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover object-center transition-transform duration-500 hover:scale-105"
                    loading="eager"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-2 bg-gradient-to-br from-slate-900 to-black">
                    <Smartphone className="w-12 h-12 text-emerald-400" />
                    <p className="text-xs text-slate-300 font-semibold">{businessName} Storefront</p>
                  </div>
                )}

                {/* Subtle gradient overlay to enhance text overlay readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Overlay Badge */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Instant SIM Dispatches</span>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-mono text-emerald-300">
                    MTN · Telecel · AT
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          3. INTERACTIVE BUNDLE CATALOG
          ========================================================= */}
      <main id="bundle-catalog" className="px-4 sm:px-8 py-6 max-w-6xl mx-auto w-full space-y-8 flex-1 scroll-mt-20">
        {/* Network Selection Bar */}
        <div
          className="p-3 sm:p-4 rounded-3xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg"
          style={{ backgroundColor: p.surface, borderColor: p.border }}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedNetwork('mtn')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                selectedNetwork === 'mtn'
                  ? 'bg-[#FFCC00] text-black shadow-md font-extrabold'
                  : 'bg-black/30 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFCC00] border border-black/40" />
              <span>MTN</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedNetwork('telecel')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                selectedNetwork === 'telecel'
                  ? 'bg-[#E60000] text-white shadow-md font-extrabold'
                  : 'bg-black/30 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#E60000]" />
              <span>Telecel</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedNetwork('at')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                selectedNetwork === 'at'
                  ? 'bg-[#002B49] text-white border border-blue-400/50 shadow-md font-extrabold'
                  : 'bg-black/30 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>AirtelTigo (AT)</span>
            </button>
          </div>

          <div className="text-xs px-2 flex items-center justify-between sm:justify-end gap-2" style={{ color: p.mutedText }}>
            <span>
              {currentNetworkPackages.length} package{currentNetworkPackages.length === 1 ? '' : 's'} available
            </span>
          </div>
        </div>

        {/* Packages Grid */}
        {currentNetworkPackages.length === 0 ? (
          <div
            className="p-10 text-center rounded-3xl border space-y-3"
            style={{ backgroundColor: p.surface, borderColor: p.border }}
          >
            <HelpCircle className="w-10 h-10 mx-auto text-slate-500" />
            <div className="space-y-1">
              <h4 className="font-bold text-white text-sm">
                No {selectedNetwork.toUpperCase()} packages currently listed
              </h4>
              <p className="text-xs text-slate-400">
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
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-3 relative group ${
                    isSelected
                      ? 'ring-2 shadow-xl -translate-y-1'
                      : 'hover:border-slate-600 bg-opacity-80'
                  }`}
                  style={{
                    backgroundColor: p.surface,
                    borderColor: isSelected ? p.accent : p.border,
                    // @ts-expect-error inline custom property
                    '--tw-ring-color': p.accent,
                  }}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-slate-200">
                        {pkg.tag || 'Available'}
                      </span>
                      {isSelected && (
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: p.accent, color: '#000000' }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                        </div>
                      )}
                    </div>
                    <h4 className="font-extrabold text-sm sm:text-base tracking-tight" style={{ color: p.text }}>
                      {pkg.name}
                    </h4>
                    {pkg.desc && (
                      <p className="text-[11px] line-clamp-2" style={{ color: p.mutedText }}>
                        {pkg.desc}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t" style={{ borderColor: `${p.border}80` }}>
                    <div className="text-[10px] uppercase font-bold tracking-wider" style={{ color: p.mutedText }}>
                      Price
                    </div>
                    <div className="font-black text-base sm:text-lg" style={{ color: p.accent }}>
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
            className="p-5 sm:p-7 rounded-3xl border shadow-2xl space-y-5 max-w-lg mx-auto backdrop-blur-sm"
            style={{ backgroundColor: p.surface, borderColor: p.border }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: p.border }}>
              <div>
                <span className="text-xs uppercase tracking-wider font-bold" style={{ color: p.mutedText }}>
                  Selected Bundle
                </span>
                <h3 className="font-extrabold text-base sm:text-lg" style={{ color: p.text }}>
                  {selectedNetwork.toUpperCase()} · {selectedPackage.name}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase tracking-wider font-bold" style={{ color: p.mutedText }}>
                  Price
                </span>
                <div className="font-black text-xl sm:text-2xl" style={{ color: p.accent }}>
                  GH₵ {selectedPackage.price}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-slate-300">
                Recipient Ghana Phone Number (Optional)
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="e.g. 024 123 4567"
                  className="w-full bg-black/40 border rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-400"
                  style={{ borderColor: p.border }}
                />
              </div>
              <p className="text-[11px]" style={{ color: p.mutedText }}>
                Leave empty if purchasing for the device you order from.
              </p>
            </div>

            {orderNotice && (
              <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                {orderNotice}
              </p>
            )}

            <button
              type="button"
              onClick={handleOrderViaWhatsapp}
              className="w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer active:scale-[0.99]"
              style={{ backgroundColor: p.accent, color: '#000000' }}
            >
              <MessageSquare className="w-4 h-4 fill-black" />
              <span>Order via WhatsApp · GH₵ {selectedPackage.price}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-[11px] text-center" style={{ color: p.mutedText }}>
              Connects directly to WhatsApp with your chosen package pre-filled.
            </p>
          </div>
        )}

        {/* 3 Step Process Guide */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div
            className="p-5 rounded-2xl border text-left space-y-2"
            style={{ backgroundColor: p.surface, borderColor: p.border }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
              style={{ backgroundColor: `${p.accent}25`, color: p.accent }}
            >
              1
            </div>
            <h4 className="font-bold text-sm text-white">Choose Network & Package</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Select your network (MTN, Telecel, or AT) and tap your preferred data bundle.
            </p>
          </div>

          <div
            className="p-5 rounded-2xl border text-left space-y-2"
            style={{ backgroundColor: p.surface, borderColor: p.border }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
              style={{ backgroundColor: `${p.accent}25`, color: p.accent }}
            >
              2
            </div>
            <h4 className="font-bold text-sm text-white">Send WhatsApp Order</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tap Order to open WhatsApp with your chosen bundle and line pre-filled.
            </p>
          </div>

          <div
            className="p-5 rounded-2xl border text-left space-y-2"
            style={{ backgroundColor: p.surface, borderColor: p.border }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
              style={{ backgroundColor: `${p.accent}25`, color: p.accent }}
            >
              3
            </div>
            <h4 className="font-bold text-sm text-white">Direct Line Delivery</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Complete payment on WhatsApp and receive data credited directly to your SIM.
            </p>
          </div>
        </div>
      </main>

      {/* =========================================================
          4. FOOTER & BUSINESS DETAILS
          ========================================================= */}
      <footer
        className="mt-12 border-t py-8 px-4 sm:px-8 text-xs text-slate-400 space-y-4"
        style={{ backgroundColor: p.surface, borderColor: p.border }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <div className="font-bold text-white text-sm">{businessName}</div>
            <div className="text-[11px]" style={{ color: p.mutedText }}>
              {location}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            {contact && (
              <a href={`tel:${contact}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Phone className="w-3.5 h-3.5" />
                <span>{contact}</span>
              </a>
            )}
            {whatsapp && (
              <button
                type="button"
                onClick={handleChatWhatsapp}
                className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>WhatsApp</span>
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
