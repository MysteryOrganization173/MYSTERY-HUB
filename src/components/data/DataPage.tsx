import { DataNetworkSelector } from './DataNetworkSelector';
import {useDirectCatalog} from '../../hooks/useDirectCatalog';
import {WelcomeOfferNotice} from './WelcomeOfferNotice';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DATA_BUNDLES, GHANA_NETWORKS, detectGhanaNetwork } from '../../data/bundles';
import { NetworkId, DataBundle } from '../../types';
import { BundleCard } from './BundleCard';
import { CompactBundleRow } from './CompactBundleRow';
import { InstantBundlesCatalog } from './InstantBundlesCatalog';
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
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Phone,
  CheckCircle2,
  Check,
  AlertTriangle,
} from 'lucide-react';

export const DataPage: React.FC = () => {
  const DATA_BUNDLES=useDirectCatalog();
  const {
    openCheckout,
    showToast,
    openWaitlist,
    dataProductMode,
    setDataProductMode,
    dataNetwork: activeNetwork,
    setDataNetwork: setActiveNetwork,
    setActivePage,
  } = useApp();

  const [sizeFilter, setSizeFilter] = useState<'all' | 'small' | 'medium' | 'large'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickBuyPhone, setQuickBuyPhone] = useState('');

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
  const airtimeSectionRef = useRef<HTMLFormElement>(null);

  // Automatically scroll to instant bundles section when instant mode is selected
  useEffect(() => {
    if (dataProductMode === 'instant') {
      const timer = setTimeout(() => {
        if (bundlesSectionRef.current) {
          smoothScrollToElement(bundlesSectionRef.current, { block: 'start' });
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [dataProductMode]);

  // Airtime top-up state
  const [airtimeNet, setAirtimeNet] = useState<NetworkId>('mtn');
  const [airtimePhone, setAirtimePhone] = useState('');
  const [airtimeAmount, setAirtimeAmount] = useState('10');
  const [customAmount, setCustomAmount] = useState('');
  const [isCustomAirtime, setIsCustomAirtime] = useState(false);

  // Auto-detect network from phone
  const detectedAirtimeNet = useMemo(() => {
    return detectGhanaNetwork(airtimePhone);
  }, [airtimePhone]);

  // Current numeric airtime face value
  const airtimeFaceValueNum = useMemo(() => {
    if (isCustomAirtime) {
      const parsed = parseFloat(customAmount);
      return !isNaN(parsed) && parsed > 0 ? parsed : 0;
    }
    const parsed = parseFloat(airtimeAmount);
    return !isNaN(parsed) && parsed > 0 ? parsed : 10;
  }, [isCustomAirtime, customAmount, airtimeAmount]);

  // Display the existing zero-fee Airtime quote; the server remains authoritative.
  const airtimeCalculation = useMemo(() => {
    const faceValue = airtimeFaceValueNum;
    const serviceFee = 0;
    const total = Number((Math.round((faceValue + serviceFee) * 100) / 100).toFixed(2));
    return {
      faceValue,
      serviceFee,
      total,
      feePercent: 0,
    };
  }, [airtimeFaceValueNum]);

  // Network mismatch check
  const isNetworkMismatch = Boolean(
    detectedAirtimeNet && detectedAirtimeNet !== airtimeNet
  );

  // FAQ accordion state
  const [openFaqId, setOpenFaqId] = useState<string | null>('faq-validity');
  const [selectedFaqCategory, setSelectedFaqCategory] = useState<
    'all' | 'validity' | 'delivery' | 'balance' | 'support'
  >('all');

  const faqs = useMemo(
    () => [
      {
        id: 'faq-validity',
        category: 'validity' as const,
        question: 'Do Mystery Hub data bundles expire?',
        answer: (
          <div className="space-y-2 text-slate-300 text-xs leading-relaxed">
            <p>
              Bundle validity depends on the recipient network you choose:
            </p>
            <ul className="space-y-1.5 pl-1">
              <li className="flex items-start gap-2">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FFCC00]/10 text-[#FFCC00] border border-[#FFCC00]/20 shrink-0">MTN</span>
                <span><strong>Package validity:</strong> Check the validity shown for your selected MTN bundle. Network terms apply.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">AirtelTigo</span>
                <span><strong>Package validity:</strong> Check your selected AirtelTigo bundle for its validity and delivery details.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600/10 text-red-500 border border-red-600/20 shrink-0">Telecel</span>
                <span><strong>Standard Validity:</strong> Telecel packages follow official network terms as specified on the package tag.</span>
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'faq-delivery',
        category: 'delivery' as const,
        question: 'How long does delivery take?',
        answer: (
          <div className="space-y-2 text-slate-300 text-xs leading-relaxed">
            <p>
              Mystery Hub submits eligible orders after payment is verified:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-[#090d10] border border-slate-800">
                <div className="text-[#00c365] font-bold flex items-center gap-1 text-xs mb-1">
                  <span>⚡ AirtelTigo (AT)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Orders are normally delivered automatically. Network conditions can cause delays; track progress in Orders.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#090d10] border border-slate-800">
                <div className="text-amber-400 font-bold flex items-center gap-1 text-xs mb-1">
                  <Clock className="w-3 h-3" />
                  <span>MTN Ghana</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  MTN processing can take longer. Wait for the current order on a number to finish before buying another.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#090d10] border border-slate-800">
                <div className="text-red-400 font-bold flex items-center gap-1 text-xs mb-1">
                  <Zap className="w-3 h-3" />
                  <span>Telecel Ghana</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Delivery starts after payment is confirmed. Track progress in Orders.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'faq-balance',
        category: 'balance' as const,
        question: 'How do I check my remaining data balance on my phone?',
        answer: (
          <div className="space-y-2 text-slate-300 text-xs leading-relaxed">
            <p>
              Use these official USSD shortcodes on your phone to check your data balance anytime:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-[#090d10] border border-slate-800">
                <div className="text-amber-400 font-bold text-xs mb-0.5">MTN Ghana</div>
                <div className="font-mono text-white text-xs font-semibold">Dial *138# or *310#</div>
                <p className="text-[10px] text-slate-500 mt-1">Or check MyMTN App</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#090d10] border border-slate-800">
                <div className="text-red-400 font-bold text-xs mb-0.5">AirtelTigo (AT)</div>
                <div className="font-mono text-white text-xs font-semibold">Dial *124# or *138#</div>
                <p className="text-[10px] text-slate-500 mt-1">Checks iShare & core balance</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#090d10] border border-slate-800">
                <div className="text-red-500 font-bold text-xs mb-0.5">Telecel Ghana</div>
                <div className="font-mono text-white text-xs font-semibold">Dial *126# or *110#</div>
                <p className="text-[10px] text-slate-500 mt-1">Telecel data balance</p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'faq-support',
        category: 'support' as const,
        question: 'What if I enter the wrong phone number or my order is delayed?',
        answer: (
          <div className="space-y-2 text-slate-300 text-xs leading-relaxed">
            <p>
              Check the recipient number carefully before paying. If you need help:
            </p>
            <ul className="space-y-1.5 pl-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00c365] shrink-0 mt-0.5" />
                <span><strong>Track your order:</strong> Open Orders and enter your order reference or recipient number to check delivery status.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00c365] shrink-0 mt-0.5" />
                <span><strong>Check the number:</strong> We check the number format and selected network, but this cannot confirm who owns the number. Review it before paying.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00c365] shrink-0 mt-0.5" />
                <span><strong>Contact support:</strong> If your order is delayed or you entered the wrong number, send your order reference to our WhatsApp team. Delivered bundles may not be recoverable.</span>
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'faq-security',
        category: 'support' as const,
        question: 'Is paying with Mobile Money safe on Mystery Hub?',
        answer: (
          <p className="text-slate-300 text-xs leading-relaxed">
            Payments are processed securely by Paystack. You authenticate directly on your mobile phone via your network operator's official Mobile Money USSD prompt (MTN MoMo, Telecel Cash, AT Money). Mystery Hub never asks for, views, or stores your secret MoMo PIN.
          </p>
        ),
      },
    ],
    []
  );

  const filteredFaqs = useMemo(() => {
    if (selectedFaqCategory === 'all') return faqs;
    return faqs.filter((f) => f.category === selectedFaqCategory);
  }, [selectedFaqCategory, faqs]);

  // Airtime selection with smooth scroll to airtime widget
  const handleSelectAirtime = () => {
    setDataProductMode('airtime');
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
  }, [activeNetwork, sizeFilter, searchQuery, DATA_BUNDLES]);

  const handleAirtimeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const faceValue = airtimeFaceValueNum;
    if (isNaN(faceValue) || faceValue < 1) {
      showToast('Minimum airtime top-up is GH₵1.00', 'warning');
      return;
    }
    if (faceValue > 1000) {
      showToast('Maximum single airtime purchase is GH₵1,000.00', 'warning');
      return;
    }
    const cleanDigits = airtimePhone.replace(/\D/g, '');
    if (cleanDigits.length < 10) {
      showToast('Please enter a valid 10-digit Ghana phone number', 'warning');
      return;
    }

    if (isNetworkMismatch && detectedAirtimeNet) {
      showToast(
        `Warning: Recipient number prefix looks like ${GHANA_NETWORKS[detectedAirtimeNet].name}, but ${GHANA_NETWORKS[airtimeNet].name} is selected. Please verify before proceeding.`,
        'warning'
      );
    }

    const { total, serviceFee } = airtimeCalculation;

    const syntheticBundle: DataBundle = {
      id: `airtime-${airtimeNet}-${faceValue}`,
      network: airtimeNet,
      serviceType: 'airtime',
      dataAmount: `GH₵${faceValue.toFixed(2)} Airtime`,
      dataBytesValue: 0,
      validity: 'Direct Credit',
      validityCategory: 'Daily',
      priceGhc: total,
      faceValueGhc: faceValue,
      serviceFeeGhc: serviceFee,
      description: `Direct airtime recharge on ${GHANA_NETWORKS[airtimeNet].name}`,
    };

    openCheckout(syntheticBundle);
  };

  const mtnNotice = serviceNotices.mtn;
  const atNotice = serviceNotices.airteltigo;

  return (
    <div className="py-4 sm:py-8 text-slate-100">
      <WelcomeOfferNotice/>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        <header className="rounded-2xl border border-slate-800 bg-gradient-to-br from-[#101f19] to-[#0b1117] px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-xs font-semibold text-[#44df95] mb-1">Data & Airtime</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stay connected.</h1>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">Choose your network and bundle. Check the recipient and total before paying.</p>
        </header>

        {/* Network Selection Banner */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Choose a service
            </h2>
            {/* 4 Product Mode Navigation Tabs / Discovery Shortcuts */}
            <div role="group" aria-label="Choose a service" className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 max-w-full sm:flex-wrap">
              <button
                type="button"
                aria-label="Data Bundles"
                aria-pressed={dataProductMode === 'data'}
                onClick={() => {
                  setDataProductMode('data');
                  setTimeout(() => {
                    smoothScrollToElement(bundlesSectionRef.current, { block: 'start' });
                  }, 50);
                }}
                className={`min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  dataProductMode === 'data'
                    ? 'bg-[#00c365] text-black shadow-md'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <span className="sm:hidden">Data</span><span className="hidden sm:inline">Data Bundles</span>
              </button>
              <button
                type="button"
                aria-label="Instant Bundles"
                aria-pressed={dataProductMode === 'instant'}
                onClick={() => {
                  setDataProductMode('instant');
                  setTimeout(() => {
                    smoothScrollToElement(bundlesSectionRef.current, { block: 'start' });
                  }, 50);
                }}
                className={`min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 shrink-0 ${
                  dataProductMode === 'instant'
                    ? 'bg-amber-400 text-black shadow-md'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Instant<span className="hidden sm:inline"> Bundles</span></span>
              </button>
              <button
                type="button"
                aria-pressed={dataProductMode === 'airtime'}
                onClick={handleSelectAirtime}
                className={`min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  dataProductMode === 'airtime'
                    ? 'bg-[#00c365] text-black shadow-md'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                Airtime
              </button>
              <button
                type="button"
                aria-label="AFA Registration"
                onClick={() => setActivePage('afa')}
                className="min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center gap-1 border border-slate-700/60 hover:border-[#00c365]/40"
                title="Register your MTN number for eligible AFA offers"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>AFA<span className="hidden sm:inline"> Registration</span></span>
              </button>
            </div>
          </div>

          {/* One network selector, backed by the existing AppContext state. */}
          {dataProductMode === 'data' && <DataNetworkSelector value={activeNetwork} onChange={setActiveNetwork} />}
        </div>

        {/* Dynamic Mode: Instant Bundles vs Airtime vs Standard Data */}
        {dataProductMode === 'instant' ? (
          <div id="instant-bundles-section" ref={bundlesSectionRef} className="scroll-mt-6">
            <InstantBundlesCatalog
              quickBuyPhone={quickBuyPhone}
              onQuickBuyPhoneChange={setQuickBuyPhone}
              onSwitchToData={() => setDataProductMode('data')}
              activeNetwork={activeNetwork}
              onSelectNetwork={(net) => setActiveNetwork(net)}
            />
          </div>
        ) : dataProductMode === 'airtime' ? (
          /* Airtime Direct Top-Up Widget */
          <form
            ref={airtimeSectionRef}
            onSubmit={handleAirtimeSubmit}
            className="max-w-xl mx-auto rounded-2xl bg-[#0f151b] border border-slate-700/80 p-5 sm:p-8 space-y-6 shadow-xl"
          >
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00c365]/10 border border-[#00c365]/25 text-[#00c365] text-xs font-semibold">
                <Zap className="w-3.5 h-3.5" />
                <span>Airtime Top-Up</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Recharge Any Ghana Network
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Choose a network and amount, enter the recipient number, then check the total before paying.
              </p>
            </div>

            <div className="space-y-4">
              {/* 1. Select Network */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200 block">
                  1. Select Network
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAirtimeNet('mtn')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      airtimeNet === 'mtn'
                        ? 'border-[#FFCC00] bg-[#FFCC00]/15 text-[#FFCC00] shadow-[0_0_15px_rgba(255,204,0,0.15)] ring-1 ring-[#FFCC00]/40'
                        : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <span className="text-sm font-black">MTN</span>
                    <span className="text-[10px] font-normal opacity-80">MoMo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAirtimeNet('airteltigo')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      airtimeNet === 'airteltigo'
                        ? 'border-[#004B93] bg-[#004B93]/25 text-sky-400 shadow-[0_0_15px_rgba(0,75,147,0.25)] ring-1 ring-sky-500/40'
                        : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <span className="text-sm font-black">AirtelTigo</span>
                    <span className="text-[10px] font-normal opacity-80">AT Money</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAirtimeNet('telecel')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      airtimeNet === 'telecel'
                        ? 'border-[#E60000] bg-[#E60000]/15 text-red-400 shadow-[0_0_15px_rgba(230,0,0,0.15)] ring-1 ring-red-500/40'
                        : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <span className="text-sm font-black">Telecel</span>
                    <span className="text-[10px] font-normal opacity-80">Telecel Cash</span>
                  </button>
                </div>
              </div>

              {/* 2. Recipient Phone */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200">
                    2. Recipient Phone Number
                  </label>
                  {detectedAirtimeNet && (
                    <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Detected: {GHANA_NETWORKS[detectedAirtimeNet].name}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="tel"
                    value={airtimePhone}
                    onChange={(e) => setAirtimePhone(e.target.value.replace(/[^\d\s]/g, ''))}
                    placeholder="e.g. 024 XXX XXXX"
                    required
                    className="w-full bg-[#0a0e12] border border-slate-700 rounded-xl px-4 py-3 text-base text-white focus:outline-none focus:border-[#00c365] focus:ring-1 focus:ring-[#00c365]"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded">
                    +233
                  </div>
                </div>

                {isNetworkMismatch && detectedAirtimeNet && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Number prefix indicates <strong>{GHANA_NETWORKS[detectedAirtimeNet].name}</strong>, but you currently selected <strong>{GHANA_NETWORKS[airtimeNet].name}</strong>. Please ensure the network selection is correct before payment.
                    </span>
                  </div>
                )}
              </div>

              {/* 3. Airtime Amount */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200">
                    3. Airtime Amount
                  </label>
                  <span className="text-[11px] text-slate-400">Min GH₵1.00</span>
                </div>

                {/* Quick Amount Buttons */}
                <div className="grid grid-cols-5 gap-1.5">
                  {['5', '10', '20', '50', '100'].map((amt) => {
                    const isSelected = !isCustomAirtime && airtimeAmount === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setIsCustomAirtime(false);
                          setAirtimeAmount(amt);
                        }}
                        className={`py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#00c365] bg-[#00c365] text-black shadow-sm font-black'
                            : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        GH₵{amt}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Amount Toggle & Input */}
                <div className="pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCustomAirtime(!isCustomAirtime)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isCustomAirtime
                          ? 'border-[#00c365] text-[#00c365] bg-[#00c365]/10'
                          : 'border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {isCustomAirtime ? '✓ Custom Amount Active' : '+ Enter Custom Amount'}
                    </button>
                  </div>

                  {isCustomAirtime && (
                    <div className="mt-2 relative animate-in fade-in duration-150">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                        GH₵
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        step="0.5"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="Enter amount e.g. 15, 35, 75"
                        autoFocus
                        className="w-full bg-[#0a0e12] border border-slate-700 rounded-xl pl-12 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c365]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Live Transparent Price & Fee Breakdown */}
              <div className="p-3.5 rounded-xl bg-[#090d10] border border-slate-800/80 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Airtime to Your Number</span>
                  <span className="text-white tabular-nums font-semibold">
                    GH₵{airtimeCalculation.faceValue.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Service Fee ({airtimeCalculation.feePercent}%)</span>
                  <span className="text-slate-300 tabular-nums font-medium">
                    GH₵{airtimeCalculation.serviceFee.toFixed(2)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm font-bold text-white">
                  <span>Total Payable</span>
                  <span className="text-[#00c365] text-base tabular-nums font-black">
                    GH₵{airtimeCalculation.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Submit Action */}
              <button
                type="submit"
                className="w-full py-3.5 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-sm tracking-wide transition-all shadow-[0_0_20px_rgba(0,195,101,0.3)] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="hidden xs:inline">Buy GH₵{airtimeCalculation.faceValue.toFixed(2)} Airtime · Pay GH₵{airtimeCalculation.total.toFixed(2)}</span>
                <span className="xs:hidden">Pay GH₵{airtimeCalculation.total.toFixed(2)} for Airtime</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 text-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Track delivery in Orders. Pay through Paystack.</span>
              </div>
            </div>
          </form>
        ) : (
          /* Data Bundles View */
          <div ref={bundlesSectionRef} className="space-y-5" id="data-bundles-section">
            {/* Filter Bar & View Mode Toggle */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 rounded-2xl bg-[#0e141a] border border-slate-800">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {/* Size Tier Filter Buttons */}
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none min-w-0 max-w-full">
                  <button
                    type="button"
                    onClick={() => setSizeFilter('all')}
                    className={`min-h-11 px-2.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      sizeFilter === 'all'
                        ? 'bg-[#00c365] text-black shadow-sm font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Sizes
                  </button>
                  <button
                    type="button"
                    onClick={() => setSizeFilter('small')}
                    className={`min-h-11 px-2.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      sizeFilter === 'small'
                        ? 'bg-[#00c365] text-black shadow-sm font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    1GB – 5GB
                  </button>
                  <button
                    type="button"
                    onClick={() => setSizeFilter('medium')}
                    className={`min-h-11 px-2.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      sizeFilter === 'medium'
                        ? 'bg-[#00c365] text-black shadow-sm font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    6GB – 20GB
                  </button>
                  <button
                    type="button"
                    onClick={() => setSizeFilter('large')}
                    className={`min-h-11 px-2.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      sizeFilter === 'large'
                        ? 'bg-[#00c365] text-black shadow-sm font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    25GB+
                  </button>
                </div>
              </div>

              {/* Search Bar & View Mode Switcher */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-48 min-w-[150px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search data bundles by size, price or network"
                    placeholder="Search size..."
                    className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl pl-8 pr-3 min-h-11 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                  />
                </div>

                {/* View Mode Toggle: Cards vs Compact */}
                <div className="flex items-center bg-[#090d10] p-1 rounded-xl border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSetViewMode('compact')}
                    aria-pressed={viewMode==='compact'}
                    aria-label="Compact bundle view"
                    title="Compact View (fast browsing)"
                    className={`min-w-11 min-h-11 p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
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
                    aria-pressed={viewMode==='cards'}
                    aria-label="Bundle card view"
                    title="Card View (detailed cards)"
                    className={`min-w-11 min-h-11 p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
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
              <>
                {viewMode === 'compact' ? (
                  /* Compact View - Whole row is actionable, no separate selection */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {filteredBundles.map((bundle) => (
                      <CompactBundleRow
                        key={bundle.id}
                        bundle={bundle}
                        onBuy={(b) => openCheckout(b)}
                      />
                    ))}
                  </div>
                ) : (
                  /* Card View - Quick buy with shared recipient number input */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
                    {filteredBundles.map((bundle) => (
                      <BundleCard
                        key={bundle.id}
                        bundle={bundle}
                        recipientPhone={quickBuyPhone}
                        onPhoneChange={setQuickBuyPhone}
                        onBuy={(b, opts) => openCheckout(b, opts)}
                      />
                    ))}
                  </div>
                )}

                {/* Elevated Section-Level Trust Signal (replaces repeated copy inside every card) */}
                <div className="flex items-center justify-center gap-2 pt-3 pb-1 text-xs text-slate-400 text-center">
                  <ShieldCheck className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>
                    Track delivery in Orders · Payments handled by Paystack
                  </span>
                </div>
              </>
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
                  className="min-h-11 px-4 py-2 rounded-lg bg-[#00c365] text-black font-semibold text-xs cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            )}
            {/* MTN Network Service Notice (Tasteful, Customer-Friendly, Config-Driven) */}
            {mtnNotice.enabled && (activeNetwork === 'mtn' || activeNetwork === 'all') && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-xs text-slate-200">
                <div className="flex flex-wrap items-center gap-x-2"><strong className="text-amber-200">MTN delivery</strong><span>Most orders arrive within 15–45 minutes.</span></div>
                <details><summary className="cursor-pointer min-h-11 flex items-center text-amber-300">Details</summary><div className="space-y-2 pb-2 text-slate-300"><p>{mtnNotice.message}</p><p>{mtnNotice.duplicatePolicyNote}</p><p>{mtnNotice.trackingNote}</p></div></details>
              </div>
            )}

            {/* AirtelTigo Instant Delivery Highlight Notice */}
            {atNotice.enabled && activeNetwork === 'airteltigo' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#004B93]/20 border border-[#004B93]/40 text-slate-200 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-400/20 text-amber-400 shrink-0 mt-0.5">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 text-left min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm text-white">
                        {atNotice.title}
                      </h4>
                      <span className="text-[11px] font-bold text-amber-400 bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded-full">
                        {atNotice.summary}
                      </span>
                    </div>
                    <p className="text-xs text-sky-100/90 leading-relaxed">
                      {atNotice.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Frequently Asked Questions Section */}
        <div className="pt-10 border-t border-slate-800/80 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00c365]/10 border border-[#00c365]/20 text-[#00c365] text-xs font-semibold mb-2">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Help & Customer Guide</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Frequently Asked Questions
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Everything you need to know about bundle validity, delivery times, balance checks, and support on Mystery Hub.
              </p>
            </div>

            {/* FAQ Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'all', label: 'All Questions' },
                { id: 'validity', label: 'Validity & Expiry' },
                { id: 'delivery', label: 'Delivery' },
                { id: 'balance', label: 'USSD Balance' },
                { id: 'support', label: 'Support & Safety' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={selectedFaqCategory === cat.id}
                  onClick={() => setSelectedFaqCategory(cat.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedFaqCategory === cat.id
                      ? 'bg-[#00c365] text-black shadow-sm'
                      : 'bg-[#0d1217] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accordion List */}
          <div className="space-y-3">
            {filteredFaqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? 'bg-[#0d131a] border-[#00c365]/40 shadow-lg shadow-[#00c365]/5'
                      : 'bg-[#0d1217] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <span className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                      <HelpCircle className={`w-4 h-4 shrink-0 transition-colors ${isOpen ? 'text-[#00c365]' : 'text-slate-500'}`} />
                      {faq.question}
                    </span>
                    <div className={`p-1 rounded-lg shrink-0 transition-colors ${isOpen ? 'bg-[#00c365]/10 text-[#00c365]' : 'text-slate-500'}`}>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 sm:pb-5 pt-0 border-t border-slate-800/60 mt-1">
                      <div className="pt-3">{faq.answer}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Customer Support Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0d131a] via-[#091512] to-[#0d131a] border border-[#00c365]/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left w-full sm:w-auto">
              <div className="w-10 h-10 rounded-xl bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365] shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Still have questions about an order?</h4>
                <p className="text-xs text-slate-400">
                  Track your purchase in Orders, or contact our WhatsApp support team. Mystery AI can help with general service questions.
                </p>
              </div>
            </div>

            <a
              href="https://wa.me/233592066298?text=Hello%20Mystery%20Hub,%20I%20have%20a%20question%20about%20a%20data%20bundle"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00c365] text-black font-bold text-xs hover:bg-[#00b05b] transition-colors cursor-pointer shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>WhatsApp Customer Support</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
