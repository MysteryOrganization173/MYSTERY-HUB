import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { DATA_BUNDLES, GHANA_NETWORKS } from '../../data/bundles';
import { NetworkId, BundleValidity, DataBundle } from '../../types';
import { BundleCard } from './BundleCard';
import { Wifi, Smartphone, Search, Zap, ShieldCheck, Clock, HelpCircle, Check, ArrowRight } from 'lucide-react';

export const DataPage: React.FC = () => {
  const { openCheckout, showToast } = useApp();

  const [activeNetwork, setActiveNetwork] = useState<NetworkId | 'all'>('mtn');
  const [activeValidity, setActiveValidity] = useState<BundleValidity | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAirtimeMode, setIsAirtimeMode] = useState(false);

  // Airtime state
  const [airtimeNet, setAirtimeNet] = useState<NetworkId>('mtn');
  const [airtimePhone, setAirtimePhone] = useState('');
  const [airtimeAmount, setAirtimeAmount] = useState('10');

  // Filtered bundles
  const filteredBundles = useMemo(() => {
    return DATA_BUNDLES.filter((bundle) => {
      // Network match
      if (activeNetwork !== 'all' && bundle.network !== activeNetwork) return false;
      // Validity match
      if (activeValidity !== 'all' && bundle.validityCategory !== activeValidity) return false;
      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAmount = bundle.dataAmount.toLowerCase().includes(q);
        const matchValidity = bundle.validity.toLowerCase().includes(q);
        const matchPrice = bundle.priceGhc.toString().includes(q);
        if (!matchAmount && !matchValidity && !matchPrice) return false;
      }
      return true;
    });
  }, [activeNetwork, activeValidity, searchQuery]);

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
      validity: 'Instant Top-Up',
      validityCategory: 'Daily',
      priceGhc: amt,
      description: `Direct airtime recharge on ${GHANA_NETWORKS[airtimeNet].name}`,
    };

    openCheckout(syntheticBundle);
  };

  return (
    <div className="min-h-screen py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Page Hero Section matching reference screenshot */}
        <div className="relative rounded-3xl bg-gradient-to-br from-[#0e161c] via-[#091014] to-[#060a0d] border border-slate-800/80 p-6 sm:p-12 overflow-hidden shadow-2xl">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#00c365]/10 rounded-full blur-[90px] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
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
                Get the best data bundles and airtime for all networks in Ghana. Fast, secure and affordable. Delivered directly to your SIM within seconds.
              </p>

              <div className="pt-2 flex flex-wrap gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-[#00c365]" />
                  <span>Instant Network Dispatch</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#00c365]" />
                  <span>MoMo Verified</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#00c365]" />
                  <span>24/7 Automated</span>
                </div>
              </div>
            </div>

            {/* Visual Phone Mockup Card */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="w-full max-w-xs rounded-2xl bg-[#121921] border border-slate-700/80 p-4 shadow-xl">
                <div className="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-800">
                  <span className="font-semibold text-white">Live Best Seller</span>
                  <span className="text-[#00c365]">In Stock</span>
                </div>
                <div className="py-4 text-center space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-[#FFCC00] text-black font-extrabold text-sm flex items-center justify-center mx-auto shadow-md">
                    MTN
                  </div>
                  <div className="text-2xl font-bold text-white">1GB</div>
                  <div className="text-xs text-slate-400">MTN Data · 7 Days</div>
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
                onClick={() => setIsAirtimeMode(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  !isAirtimeMode ? 'bg-[#00c365] text-black' : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Data Bundles
              </button>
              <button
                onClick={() => setIsAirtimeMode(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isAirtimeMode ? 'bg-[#00c365] text-black' : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Instant Airtime
              </button>
            </div>
          </div>

          {/* Network Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* MTN */}
            <button
              onClick={() => {
                setIsAirtimeMode(false);
                setActiveNetwork('mtn');
              }}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                !isAirtimeMode && activeNetwork === 'mtn'
                  ? 'border-[#FFCC00] bg-[#FFCC00]/10 shadow-[0_0_20px_rgba(255,204,0,0.15)]'
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
                <div className="text-[11px] text-slate-400">Mobile Money</div>
              </div>
            </button>

            {/* Telecel */}
            <button
              onClick={() => {
                setIsAirtimeMode(false);
                setActiveNetwork('telecel');
              }}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                !isAirtimeMode && activeNetwork === 'telecel'
                  ? 'border-[#E60000] bg-[#E60000]/10 shadow-[0_0_20px_rgba(230,0,0,0.15)]'
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
              onClick={() => {
                setIsAirtimeMode(false);
                setActiveNetwork('airteltigo');
              }}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                !isAirtimeMode && activeNetwork === 'airteltigo'
                  ? 'border-[#004B93] bg-[#004B93]/20 shadow-[0_0_20px_rgba(0,75,147,0.25)]'
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
                <div className="text-[11px] text-slate-400">AT Money</div>
              </div>
            </button>

            {/* Airtime Tab */}
            <button
              onClick={() => setIsAirtimeMode(true)}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                isAirtimeMode
                  ? 'border-[#00c365] bg-[#00c365]/10 shadow-[0_0_20px_rgba(0,195,101,0.15)]'
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
                <div className="text-[11px] text-slate-400">Any Amount Instantly</div>
              </div>
            </button>
          </div>
        </div>

        {/* Dynamic Mode: Airtime vs Data Bundles */}
        {isAirtimeMode ? (
          /* Airtime Direct Top-Up Widget */
          <div className="max-w-xl mx-auto rounded-2xl bg-[#0f151b] border border-slate-700/80 p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-white">Instant Airtime Top-Up</h3>
              <p className="text-xs text-slate-400">
                Recharge any MTN, Telecel, or AirtelTigo number in Ghana with zero extra charge.
              </p>
            </div>

            <form onSubmit={handleAirtimeSubmit} className="space-y-4">
              {/* Select Network */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Select Network</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAirtimeNet('mtn')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-colors ${
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
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-colors ${
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
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-colors ${
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
                  required
                  className="w-full bg-[#0a0e12] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c365]"
                />
              </div>

              {/* Airtime Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Amount (GH₵)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    GH₵
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={airtimeAmount}
                    onChange={(e) => setAirtimeAmount(e.target.value)}
                    required
                    className="w-full bg-[#0a0e12] border border-slate-700 rounded-xl pl-12 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                </div>
                {/* Quick amount chips */}
                <div className="flex gap-2 pt-1">
                  {['5', '10', '20', '50', '100'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setAirtimeAmount(chip)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        airtimeAmount === chip
                          ? 'border-[#00c365] bg-[#00c365]/10 text-white font-semibold'
                          : 'border-slate-800 bg-slate-900/60 text-slate-400'
                      }`}
                    >
                      GH₵{chip}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-sm tracking-wide transition-all shadow-[0_0_15px_rgba(0,195,101,0.25)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue to Checkout (GH₵{parseFloat(airtimeAmount || '0').toFixed(2)})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* Data Bundles View */
          <div className="space-y-6">
            {/* Filter Bar & Search */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-3 rounded-2xl bg-[#0e141a] border border-slate-800">
              {/* Validity Segmented Control */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
                <button
                  onClick={() => setActiveValidity('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeValidity === 'all'
                      ? 'bg-[#00c365] text-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Bundles
                </button>
                <button
                  onClick={() => setActiveValidity('Weekly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeValidity === 'Weekly'
                      ? 'bg-[#00c365] text-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  7 Days (Weekly)
                </button>
                <button
                  onClick={() => setActiveValidity('Monthly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeValidity === 'Monthly'
                      ? 'bg-[#00c365] text-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  30 Days (Monthly)
                </button>
                <button
                  onClick={() => setActiveValidity('Non-Expiry')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeValidity === 'Non-Expiry'
                      ? 'bg-[#00c365] text-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  No Expiry (Jumbo)
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search size, e.g. 5GB..."
                  className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                />
              </div>
            </div>

            {/* Bundles Grid */}
            {filteredBundles.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredBundles.map((bundle) => (
                  <BundleCard
                    key={bundle.id}
                    bundle={bundle}
                    onBuy={(b) => openCheckout(b)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-[#0f151b] rounded-2xl border border-slate-800 space-y-3">
                <HelpCircle className="w-10 h-10 text-slate-500 mx-auto" />
                <h3 className="font-bold text-white text-base">No bundles match your filter</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Try adjusting the validity tabs or clearing your search query.
                </p>
                <button
                  onClick={() => {
                    setActiveNetwork('all');
                    setActiveValidity('all');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#00c365] text-black font-semibold text-xs"
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
              Data is credited automatically within 30 to 60 seconds of Mobile Money approval. You receive an SMS confirmation directly from your telecom provider.
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
              Our system validates Ghanaian network prefixes before submission. If an issue occurs, reach out directly to our 24/7 WhatsApp helpdesk with your Order ID.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
