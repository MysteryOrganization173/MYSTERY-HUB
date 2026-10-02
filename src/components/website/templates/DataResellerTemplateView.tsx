import React, { useState } from 'react';
import { WebsiteTemplate, TemplateItem } from '../../../types';
import {
  Smartphone,
  Zap,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Phone,
  MessageSquare,
  ArrowRight,
  Sparkles,
  MapPin,
  ExternalLink,
} from 'lucide-react';

interface TemplateViewProps {
  template: WebsiteTemplate;
  onCtaClick?: () => void;
}

export const DataResellerTemplateView: React.FC<TemplateViewProps> = ({ template, onCtaClick }) => {
  const [selectedNetwork, setSelectedNetwork] = useState<'mtn' | 'telecel' | 'at'>('mtn');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [orderNotice, setOrderNotice] = useState<string | null>(null);

  const businessName = template.demoBusinessName || 'Ghana Data Express';
  const tagline = template.demoHeroTagline || 'Genuine Non-Expiry Data Bundles for All Ghana Networks';
  const aboutText =
    template.demoSubtext ||
    'Instant mobile data top-ups at unbeatable wholesale rates. No expiry on MTN & AT bundles. Fast delivery via Mobile Money.';
  const location = template.location || 'Accra, Ghana · Available Daily 7:00 AM - 10:00 PM';
  const phone = template.hoursOrContact || '+233 24 000 0000';
  const whatsapp = template.hoursOrContact || phone;

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

  // Default packages if not overridden by custom items
  const defaultPackages: Record<'mtn' | 'telecel' | 'at', Array<{ id: string; name: string; price: string; tag?: string }>> = {
    mtn: [
      { id: 'mtn-1', name: '1GB Non-Expiry', price: '12.00', tag: 'Standard' },
      { id: 'mtn-2', name: '2.5GB Non-Expiry', price: '25.00', tag: 'Popular' },
      { id: 'mtn-3', name: '5GB Non-Expiry', price: '48.00', tag: 'Best Value' },
      { id: 'mtn-4', name: '10GB Non-Expiry', price: '90.00', tag: 'Hot' },
      { id: 'mtn-5', name: '20GB Non-Expiry', price: '175.00', tag: 'Heavy User' },
      { id: 'mtn-6', name: '50GB Non-Expiry', price: '420.00', tag: 'Wholesale' },
    ],
    telecel: [
      { id: 'tel-1', name: '1.5GB Monthly', price: '14.00', tag: 'Monthly' },
      { id: 'tel-2', name: '3GB Monthly', price: '27.00', tag: 'Popular' },
      { id: 'tel-3', name: '6GB Monthly', price: '52.00', tag: 'Best Value' },
      { id: 'tel-4', name: '12GB Monthly', price: '98.00', tag: 'Hot' },
      { id: 'tel-5', name: '25GB Monthly', price: '190.00', tag: 'Pro' },
    ],
    at: [
      { id: 'at-1', name: '1GB Non-Expiry', price: '10.00', tag: 'Standard' },
      { id: 'at-2', name: '3GB Non-Expiry', price: '26.00', tag: 'Popular' },
      { id: 'at-3', name: '7GB Non-Expiry', price: '55.00', tag: 'Best Value' },
      { id: 'at-4', name: '15GB Non-Expiry', price: '105.00', tag: 'Hot' },
      { id: 'at-5', name: '30GB Non-Expiry', price: '200.00', tag: 'Heavy' },
    ],
  };

  // If custom items exist, use them; otherwise use default network packages
  const customItems = template.items && template.items.length > 0 ? template.items : null;
  const currentPackages = customItems
    ? customItems.map((item) => ({
        id: item.id || item.name,
        name: item.name,
        price: (item.price || '').replace(/[^0-9.]/g, '') || '25.00',
        tag: item.tag || 'Available',
      }))
    : defaultPackages[selectedNetwork];

  const [selectedPackage, setSelectedPackage] = useState<{ id: string; name: string; price: string }>(
    currentPackages[0]
  );

  const cleanWhatsappNumber = whatsapp.replace(/\D/g, '');

  const handleOrderViaWhatsapp = () => {
    if (onCtaClick) {
      onCtaClick();
      return;
    }

    if (!cleanWhatsappNumber) {
      setOrderNotice('Contact WhatsApp number not configured yet.');
      return;
    }

    const netName = selectedNetwork === 'mtn' ? 'MTN' : selectedNetwork === 'telecel' ? 'Telecel' : 'AirtelTigo (AT)';
    const phoneDetail = recipientPhone.trim() ? `for recipient phone: ${recipientPhone.trim()}` : 'for my line';
    const text = `Hello ${businessName}, I would like to order ${netName} ${selectedPackage.name} (GH₵ ${selectedPackage.price}) ${phoneDetail}. Please share your MoMo payment details.`;

    const url = `https://wa.me/${cleanWhatsappNumber}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="min-h-full font-sans antialiased text-slate-100 flex flex-col selection:bg-[#00c365] selection:text-black"
      style={{ backgroundColor: p.background }}
    >
      {/* Top Notification Strip */}
      <div
        className="px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2 select-none"
        style={{ backgroundColor: p.primary, color: p.text }}
      >
        <Zap className="w-3.5 h-3.5 fill-current text-amber-400" />
        <span>Ghana Instant Telecom Storefront · Genuine Non-Expiry Bundles Available Daily</span>
      </div>

      {/* Branded Header */}
      <header
        className="px-4 sm:px-8 py-4 border-b flex items-center justify-between sticky top-0 z-30 backdrop-blur-md"
        style={{ backgroundColor: `${p.surface}ee`, borderColor: p.border }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-black font-black text-sm shadow-md"
            style={{ backgroundColor: p.accent }}
          >
            <Smartphone className="w-4 h-4 text-black" />
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg tracking-tight" style={{ color: p.text }}>
              {businessName}
            </h1>
            <p className="text-[10px] sm:text-xs" style={{ color: p.mutedText }}>
              Verified Data Storefront
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {whatsapp && (
            <a
              href={`https://wa.me/${cleanWhatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              style={{ backgroundColor: p.accent, color: '#000000' }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp Order</span>
              <span className="sm:hidden">Order</span>
            </a>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 sm:px-8 py-10 sm:py-16 max-w-5xl mx-auto text-center space-y-6">
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border"
          style={{
            backgroundColor: `${p.accent}15`,
            borderColor: `${p.accent}40`,
            color: p.accent,
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Affordable Ghana Data · Direct SIM Top-Up</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-black tracking-tight max-w-3xl mx-auto leading-tight" style={{ color: p.text }}>
          {tagline}
        </h2>

        <p className="text-sm sm:text-base max-w-2xl mx-auto leading-relaxed" style={{ color: p.mutedText }}>
          {aboutText}
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold" style={{ color: p.mutedText }}>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Non-Expiry Validity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>100% Genuine Telecom Bundles</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Dispatched Fast via MoMo</span>
          </div>
        </div>
      </section>

      {/* Interactive Bundle Storefront Section */}
      <main className="px-4 sm:px-8 py-6 max-w-5xl mx-auto w-full space-y-8 flex-1">
        {/* Network Selector Tabs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2 rounded-2xl border" style={{ backgroundColor: p.surface, borderColor: p.border }}>
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSelectedNetwork('mtn')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                selectedNetwork === 'mtn' ? 'bg-[#FFCC00] text-black shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFCC00] border border-black/30" />
              <span>MTN Express</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedNetwork('telecel')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                selectedNetwork === 'telecel' ? 'bg-[#E60000] text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#E60000]" />
              <span>Telecel</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedNetwork('at')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                selectedNetwork === 'at' ? 'bg-[#002B49] text-white border border-blue-400/40 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>AirtelTigo (AT)</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 px-3">
            <span>Select package below to order</span>
          </div>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {currentPackages.map((pkg) => {
            const isSelected = selectedPackage.id === pkg.id;
            return (
              <div
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg)}
                className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? 'ring-2 shadow-lg -translate-y-0.5'
                    : 'hover:border-slate-600'
                }`}
                style={{
                  backgroundColor: p.surface,
                  borderColor: isSelected ? p.accent : p.border,
                  // @ts-expect-error inline style ring color
                  '--tw-ring-color': p.accent,
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                      {pkg.tag || 'Standard'}
                    </span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                  <h4 className="font-extrabold text-sm sm:text-base mt-2" style={{ color: p.text }}>
                    {pkg.name}
                  </h4>
                </div>

                <div className="pt-2 border-t" style={{ borderColor: `${p.border}80` }}>
                  <div className="text-[10px]" style={{ color: p.mutedText }}>Price</div>
                  <div className="font-black text-base sm:text-lg" style={{ color: p.accent }}>
                    GH₵ {pkg.price}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Formulation Card */}
        <div
          className="p-5 sm:p-7 rounded-3xl border shadow-xl space-y-4 max-w-xl mx-auto"
          style={{ backgroundColor: p.surface, borderColor: p.border }}
        >
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: p.border }}>
            <div>
              <span className="text-xs uppercase tracking-wider font-bold" style={{ color: p.mutedText }}>
                Selected Package
              </span>
              <h3 className="font-bold text-base sm:text-lg" style={{ color: p.text }}>
                {selectedNetwork.toUpperCase()} · {selectedPackage.name}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs" style={{ color: p.mutedText }}>Total</span>
              <div className="font-black text-xl" style={{ color: p.accent }}>
                GH₵ {selectedPackage.price}
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold" style={{ color: p.text }}>
              Recipient Ghana Phone Number
            </label>
            <div className="relative">
              <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="e.g. 024 123 4567"
                className="w-full bg-black/40 border rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-1"
                style={{ borderColor: p.border }}
              />
            </div>
          </div>

          {orderNotice && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
              {orderNotice}
            </p>
          )}

          <button
            type="button"
            onClick={handleOrderViaWhatsapp}
            className="w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-[0.99]"
            style={{ backgroundColor: p.accent, color: '#000000' }}
          >
            <MessageSquare className="w-4 h-4 fill-black" />
            <span>Order via WhatsApp · GH₵ {selectedPackage.price}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-[11px] text-center" style={{ color: p.mutedText }}>
            Dispatches directly via Mobile Money. No login required to purchase.
          </p>
        </div>

        {/* 3 Simple Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          <div className="p-4 rounded-2xl border text-left space-y-2" style={{ backgroundColor: p.surface, borderColor: p.border }}>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
              1
            </div>
            <h4 className="font-bold text-sm text-white">Choose Your Package</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Select your network and data amount from 1GB to 50GB.
            </p>
          </div>

          <div className="p-4 rounded-2xl border text-left space-y-2" style={{ backgroundColor: p.surface, borderColor: p.border }}>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
              2
            </div>
            <h4 className="font-bold text-sm text-white">Send MoMo Payment</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Send Mobile Money directly to our verified merchant or agent number on WhatsApp.
            </p>
          </div>

          <div className="p-4 rounded-2xl border text-left space-y-2" style={{ backgroundColor: p.surface, borderColor: p.border }}>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
              3
            </div>
            <h4 className="font-bold text-sm text-white">Direct Line Credit</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your bundle credits directly to the recipient phone line.
            </p>
          </div>
        </div>
      </main>

      {/* Footer & Business Details */}
      <footer className="mt-12 border-t py-8 px-4 sm:px-8 text-xs text-slate-400 space-y-4" style={{ backgroundColor: p.surface, borderColor: p.border }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <div className="font-bold text-white text-sm">{businessName}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{location}</div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            {phone && (
              <a href={`tel:${phone}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Phone className="w-3.5 h-3.5" />
                <span>{phone}</span>
              </a>
            )}
            {whatsapp && (
              <a
                href={`https://wa.me/${cleanWhatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
