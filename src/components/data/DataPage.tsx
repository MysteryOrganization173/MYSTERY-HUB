import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DATA_BUNDLES, GHANA_NETWORKS } from '../../data/bundles';
import { NetworkId, DataBundle } from '../../types';
import { BundleCard } from './BundleCard';
import { CompactBundleRow } from './CompactBundleRow';
import { smoothScrollToElement } from '../../utils/scroll';
import { serviceNotices } from '../../config/serviceNotices';
import {
  Wifi,
  Smartphone,
  Search,
  Zap,
  ShieldCheck,
  Clock,
  HelpCircle,
  ArrowRight,
  LayoutGrid,
  List,
  AlertCircle,
  Info,
} from 'lucide-react';

export const DataPage: React.FC = () => {
  const { openCheckout, showToast, openWaitlist } = useApp();

  const [activeNetwork, setActiveNetwork] = useState<NetworkId | 'all'>('mtn');
  const [sizeFilter, setSizeFilter] = useState<'all' | 'small' | 'medium' | 'large'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAirtimeMode, setIsAirtimeMode] = useState(false);
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);

  // View mode: 'cards' or 'compact'
  // Mobile defaults to compact view, desktop defaults to card view. Stored in localStorage.
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mysteryhub_bundle_view_mode');
      if (saved === 'cards' || saved === 'compact') return saved;
      return window.innerWidth < 768 ? 'compact' : 'cards';
    }
    return 'compact';
  });

  const handleSetViewMode = (mode: 'cards' | 'compact') => {
    setViewMode(mode);
    try {
      localStorage.setItem('mysteryhub_bundle_view_mode', mode);
    } catch {
      // Ignore localStorage write failures in private/restricted browsing
    }
  };

  // Scroll target refs
  const bundlesSectionRef = useRef<HTMLDivElement>(null);
  const airtimeSectionRef = useRef<HTMLDivElement>(null);

  // Airtime top-up state
  const [airtimeNet, setAirtimeNet] = useState<NetworkId>('mtn');
  const [airtimePhone, setAirtimePhone] = useState('');
  const [airtimeAmount, setAirtimeAmount] = useState('10');

  // Network selection with smooth scroll to results
  const handleSelectNetwork = (net: NetworkId) => {
    setIsAirtimeMode(false);
    setActiveNetwork(net);
    // Smooth scroll to bundle results section
    setTimeout(() => {
      smoothScrollToElement(bundlesSectionRef.current, { block: 'start' });
    }, 50);
  };

  // Airtime selection with smooth scroll to airtime widget
  const handleSelectAirtime = () => {
    setIsAirtimeMode(true);
    setTimeout(() => {
      smoothScrollToElement(airtimeSectionRef.current, { block: 'start' });
    }, 50);
  };

  // Filtered bundles
  const filteredBundles = useMemo(() => {
    return DATA_BUNDLES.filter((bundle) => {
      // Network match
      if (activeNetwork !== 'all' && bundle.network !== activeNetwork) return false;

      // Size tier match
      if (sizeFilter !== 'all') {
        const mb = bundle.dataBytesValue;
        if (sizeFilter === 'small' && mb > 5120) return false; // up to 5GB
        if (sizeFilter === 'medium' && (mb <= 5120 || mb > 20480)) return false; // 6GB - 20GB
        if (sizeFilter === 'large' && mb <= 20480) return false; // 25GB+
      }

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAmount = bundle.dataAmount.toLowerCase().includes(q);
        const matchPrice = bundle.priceGhc.toString().includes(q);
        const matchNet = bundle.network.toLowerCase().includes(q);
        if (!matchAmount && !matchPrice && !matchNet) return false;
      }
      return true;
    });
  }, [activeNetwork, sizeFilter, searchQuery]);

  const handleAirtimeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(airtimeAmount);
    if (isNaN(amt) || amt < 1) {
      showToast('Minimum airtime top-up is GH₵1.00', 'warning');
      return;
    }
    if (airtimePhone.replace(/\D/g, '').length < 10) {
      showToast('Please enter a valid Ghana phone number', 'warning');
      return;
    }

    const syntheticBundle: DataBundle = {
      id: `airtime-${airtimeNet}-${amt}`,
      network: airtimeNet,
      dataAmount: `GH₵${amt.toFixed(2)} Airtime`,
      dataBytesValue: 0,
      validity: 'Direct Credit',
      validityCategory: 'Daily',
      priceGhc: amt,
      description: `Direct airtime recharge on ${GHANA_NETWORKS[airtimeNet].name}`,
    };

    openCheckout(syntheticBundle);
  };

  const mtnNotice = serviceNotices.mtn;

  return (
    <div className="min-h-screen py-6 sm:py-10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
        {/* Page Hero Section */}
        <div className="relative rounded-3xl bg-gradient-to-br from-[#0e161c] via-[#091014] to-[#060a0d] border border-slate-800/80 p-5 sm:p-10 overflow-hidden shadow-2xl">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#00c365]/10 rounded-full blur-[90px] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center relative z-10">
            <div className="lg:col-span-7 space-y-4 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141d24] border border-slate-700/80 text-xs font-semibold text-[#00c365]">
                <Wifi className="w-3.5 h-3.5" />
                <span>Data & Airtime</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Stay Connected <br />
                <span className="text-[#00c365]">Always</span>
              </h1>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg">
                Get the best data bundles and airtime for all networks in Ghana. Fast, secure, and affordable with direct delivery to your SIM.
              </p>

              <div className="pt-1 flex flex-wrap gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-[#00c365]" />
                  <span>Direct SIM Credit</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#00c365]" />
                  <span>MoMo Protected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#00c365]" />
                  <span>Automated Gateway Dispatch</span>
                </div>
              </div>
            </div>

            {/* Visual Phone Mockup Card */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="w-full max-w-xs rounded-2xl bg-[#121921] border border-slate-700/80 p-4 shadow-xl">
                <div className="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-800">
                  <span className="font-semibold text-white">Popular Bundle</span>
                  <span className="text-[#00c365] font-medium">In Stock</span>
                </div>
                <div className="py-4 text-center space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-[#FFCC00] text-black font-extrabold text-sm flex items-center justify-center mx-auto shadow-md">
                    MTN
                  </div>
                  <div className="text-2xl font-bold text-white">1GB</div>
                  <div className="text-xs text-slate-400">MTN Express · Direct SIM Credit</div>
                  <div className="text-xl font-extrabold text-[#00c365]">GH₵4.99</div>
                  <button
                    onClick={() => openCheckout(DATA_BUNDLES[0])}
                    className="w-full py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Network Selection Banner */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Choose a Network
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAirtimeMode(false);
                  setTimeout(() => {
                    smoothScrollToElement(bundlesSectionRef.current, { block: 'start' });
                  }, 50);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  !isAirtimeMode ? 'bg-[#00c365] text-black' : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Data Bundles
              </button>
              <button
                type="button"
                onClick={handleSelectAirtime}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isAirtimeMode ? 'bg-[#00c365] text-black' : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Airtime Top-Up
              </button>
            </div>
          </div>

          {/* Network Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* MTN */}
            <button
              type="button"
              onClick={() => handleSelectNetwork('mtn')}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                !isAirtimeMode && activeNetwork === 'mtn'
                  ? 'border-[#FFCC00] bg-[#FFCC00]/10 shadow-[0_0_20px_rgba(255,204,0,0.15)] ring-1 ring-[#FFCC00]/40'
                  : 'border-slate-800 bg-[#0f151b] hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#FFCC00] text-black font-extrabold text-xs flex items-center justify-center shadow-sm">
                  MTN
                </div>
                {!isAirtimeMode && activeNetwork === 'mtn' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FFCC00]" />
                )}
              </div>
              <div className="mt-3">
                <div className="font-bold text-sm text-white">MTN Ghana</div>
                <div className="text-[11px] text-slate-400">MTN Express</div>
              </div>
            </button>

            {/* Telecel */}
            <button
              type="button"
              onClick={() => handleSelectNetwork('telecel')}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                !isAirtimeMode && activeNetwork === 'telecel'
                  ? 'border-[#E60000] bg-[#E60000]/10 shadow-[0_0_20px_rgba(230,0,0,0.15)] ring-1 ring-[#E60000]/40'
                  : 'border-slate-800 bg-[#0f151b] hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#E60000] text-white font-bold text-sm flex items-center justify-center shadow-sm">
                  t
                </div>
                {!isAirtimeMode && activeNetwork === 'telecel' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-[#E60000]" />
                )}
              </div>
              <div className="mt-3">
                <div className="font-bold text-sm text-white">Telecel Ghana</div>
                <div className="text-[11px] text-slate-400">Telecel Cash</div>
              </div>
            </button>

            {/* AirtelTigo */}
            <button
              type="button"
              onClick={() => handleSelectNetwork('airteltigo')}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                !isAirtimeMode && activeNetwork === 'airteltigo'
                  ? 'border-[#004B93] bg-[#004B93]/20 shadow-[0_0_20px_rgba(0,75,147,0.25)] ring-1 ring-[#004B93]/60'
                  : 'border-slate-800 bg-[#0f151b] hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#004B93] text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  AT
                </div>
                {!isAirtimeMode && activeNetwork === 'airteltigo' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                )}
              </div>
              <div className="mt-3">
                <div className="font-bold text-sm text-white">AirtelTigo (AT)</div>
                <div className="text-[11px] text-slate-400">AT iShare</div>
              </div>
            </button>

            {/* Airtime Tab */}
            <button
              type="button"
              onClick={handleSelectAirtime}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                isAirtimeMode
                  ? 'border-[#00c365] bg-[#00c365]/10 shadow-[0_0_20px_rgba(0,195,101,0.15)] ring-1 ring-[#00c365]/40'
                  : 'border-slate-800 bg-[#0f151b] hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#00c365]/20 text-[#00c365] flex items-center justify-center shadow-sm">
                  <Smartphone className="w-5 h-5" />
                </div>
                {isAirtimeMode && <div className="w-2.5 h-2.5 rounded-full bg-[#00c365]" />}
              </div>
              <div className="mt-3">
                <div className="font-bold text-sm text-white">Airtime Top-Up</div>
                <div className="text-[11px] text-slate-400">Custom Amount</div>
              </div>
            </button>
          </div>
        </div>

        {/* Dynamic Mode: Airtime vs Data Bundles */}
        {isAirtimeMode ? (
          /* Airtime Direct Top-Up Widget */
          <div
            ref={airtimeSectionRef}
            className="max-w-xl mx-auto rounded-2xl bg-[#0f151b] border border-slate-700/80 p-5 sm:p-8 space-y-6"
          >
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-1">
                <span>Beta Preview · In Testing</span>
              </div>
              <h3 className="text-xl font-bold text-white">Airtime Top-Up</h3>
              <p className="text-xs text-slate-400">
                Direct telecom gateway routing for airtime top-up is currently in final testing. Live checkout is paused until full fulfillment is enabled.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#0a0e12] border border-amber-500/20 text-xs text-slate-300 space-y-1">
              <span className="font-semibold text-amber-400">Notice for Customers:</span>
              <p>
                To protect customer funds, we only accept payments when automated fulfillment is 100% active. Join the waitlist to receive a WhatsApp notification when Airtime is live.
              </p>
            </div>

            <div className="space-y-4">
              {/* Select Network */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Select Network</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAirtimeNet('mtn')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      airtimeNet === 'mtn'
                        ? 'border-[#FFCC00] bg-[#FFCC00]/10 text-[#FFCC00]'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    MTN
                  </button>
                  <button
                    type="button"
                    onClick={() => setAirtimeNet('telecel')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      airtimeNet === 'telecel'
                        ? 'border-[#E60000] bg-[#E60000]/10 text-red-400'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    Telecel
                  </button>
                  <button
                    type="button"
                    onClick={() => setAirtimeNet('airteltigo')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      airtimeNet === 'airteltigo'
                        ? 'border-[#004B93] bg-[#004B93]/20 text-sky-400'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    AirtelTigo
                  </button>
                </div>
              </div>

              {/* Recipient Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Recipient Phone Number</label>
                <input
                  type="tel"
                  value={airtimePhone}
                  onChange={(e) => setAirtimePhone(e.target.value)}
                  placeholder="e.g. 024 123 4567"
                  className="w-full bg-[#0a0e12] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c365]"
                />
              </div>

              <button
                type="button"
                onClick={() => openWaitlist(`Airtime Top-Up (${airtimeNet.toUpperCase()})`)}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-[#00c365] hover:from-emerald-400 hover:to-[#00e575] text-black font-bold text-sm tracking-wide transition-all shadow-[0_0_15px_rgba(0,195,101,0.25)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Notify Me When Airtime is Live (Free)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Data Bundles View */
          <div ref={bundlesSectionRef} className="space-y-5">
            {/* MTN Network Service Notice (Tasteful, Customer-Friendly, Config-Driven) */}
            {mtnNotice.enabled && (activeNetwork === 'mtn' || activeNetwork === 'all') && (
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-slate-200 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 text-left min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm text-amber-200">
                        {mtnNotice.title}
                      </h4>
                      <span className="text-[11px] font-medium text-amber-300/80 bg-amber-500/20 px-2 py-0.5 rounded-full">
                        {mtnNotice.summary}
                      </span>
                    </div>
                    <p className="text-xs text-amber-100/80 leading-relaxed">
                      {mtnNotice.message}
                    </p>
                    <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-[11px] text-amber-300/90 font-medium">
                      <span>• {mtnNotice.duplicatePolicyNote}</span>
                      <span>• {mtnNotice.trackingNote}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Bar & View Mode Toggle */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[#0e141a] border border-slate-800">
              {/* Size Tier Filter Buttons */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSizeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    sizeFilter === 'all'
                      ? 'bg-[#00c365] text-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Packages
                </button>
                <button
                  type="button"
                  onClick={() => setSizeFilter('small')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    sizeFilter === 'small'
                      ? 'bg-[#00c365] text-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1GB – 5GB
                </button>
                <button
                  type="button"
                  onClick={() => setSizeFilter('medium')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    sizeFilter === 'medium'
                      ? 'bg-[#00c365] text-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  6GB – 20GB
                </button>
                <button
                  type="button"
                  onClick={() => setSizeFilter('large')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    sizeFilter === 'large'
                      ? 'bg-[#00c365] text-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  25GB+
                </button>
              </div>

              {/* Search Bar & View Mode Switcher */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-48 min-w-[150px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search size..."
                    className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                  />
                </div>

                {/* View Mode Toggle: Cards vs Compact */}
                <div className="flex items-center bg-[#090d10] p-1 rounded-xl border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSetViewMode('compact')}
                    title="Compact View (fast browsing)"
                    className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                      viewMode === 'compact'
                        ? 'bg-[#00c365] text-black font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <List className="w-4 h-4" />
                    <span className="hidden md:inline text-[11px]">Compact</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetViewMode('cards')}
                    title="Card View (detailed cards)"
                    className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                      viewMode === 'cards'
                        ? 'bg-[#00c365] text-black font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span className="hidden md:inline text-[11px]">Cards</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bundles Content: Compact View vs Card View */}
            {filteredBundles.length > 0 ? (
              viewMode === 'compact' ? (
                /* Compact View */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {filteredBundles.map((bundle) => (
                    <CompactBundleRow
                      key={bundle.id}
                      bundle={bundle}
                      isSelected={selectedBundleId === bundle.id}
                      onSelect={(b) => setSelectedBundleId(b.id)}
                      onBuy={(b) => openCheckout(b)}
                    />
                  ))}
                </div>
              ) : (
                /* Card View */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {filteredBundles.map((bundle) => (
                    <BundleCard
                      key={bundle.id}
                      bundle={bundle}
                      onBuy={(b) => openCheckout(b)}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-16 bg-[#0f151b] rounded-2xl border border-slate-800 space-y-3">
                <HelpCircle className="w-10 h-10 text-slate-500 mx-auto" />
                <h3 className="font-bold text-white text-base">No bundles match your filter</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Try clearing your search query or selecting All Packages.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveNetwork('all');
                    setSizeFilter('all');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#00c365] text-black font-semibold text-xs cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* FAQs & Trust Information */}
        <div className="pt-8 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-[#0d1217] border border-slate-800 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#00c365]/10 flex items-center justify-center text-[#00c365]">
              <Zap className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-sm text-white">How fast is delivery?</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Data is credited directly upon Mobile Money authorization. You receive an SMS confirmation directly from your telecom provider.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0d1217] border border-slate-800 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#00c365]/10 flex items-center justify-center text-[#00c365]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-sm text-white">Is Mobile Money payment secure?</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Yes. All transactions require your official telecom PIN prompt on your phone. Mystery Hub never sees or stores your secret PIN or credentials.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0d1217] border border-slate-800 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#00c365]/10 flex items-center justify-center text-[#00c365]">
              <HelpCircle className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-sm text-white">What if I enter the wrong number?</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Our system validates Ghanaian network prefixes before submission. If an issue occurs, reach out directly to our WhatsApp helpdesk with your Order ID.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
