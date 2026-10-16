import { DataNetworkSelector, DATA_NETWORK_CHOICES } from './DataNetworkSelector';
import { Money } from '../purchase/Money';
import { useTapFeedback } from '../../hooks/useTapFeedback';
import { formatGhanaPhone, isCompleteGhanaPhone } from '../../utils/checkoutRecovery';
import {useDirectCatalog} from '../../hooks/useDirectCatalog';
import {WelcomeOfferNotice} from './WelcomeOfferNotice';
import {useWelcomeOffer} from '../../hooks/useWelcomeOffer';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DATA_BUNDLES, GHANA_NETWORKS, detectGhanaNetwork } from '../../data/bundles';
import { NetworkId, DataBundle } from '../../types';
import { CompactBundleRow } from './CompactBundleRow';
import { PendingPaymentBanner } from '../checkout/PendingPaymentBanner';
import { InstantBundlesCatalog } from './InstantBundlesCatalog';
import { smoothScrollToElement } from '../../utils/scroll';
import { serviceNotices } from '../../config/serviceNotices';
import {
  Smartphone,
  Search,
  Zap,
  ShieldCheck,
  Clock,
  ArrowRight,
  X,
  ChevronDown,
  MessageSquare,
  Phone,
  CheckCircle2,
  Check,
  AlertTriangle,
} from 'lucide-react';

const shortNetworkName = (id: NetworkId) => DATA_NETWORK_CHOICES.find(choice => choice.id === id)?.name || id;

export const DataPage: React.FC = () => {
  const DATA_BUNDLES=useDirectCatalog();
  const welcomeOffer=useWelcomeOffer(DATA_BUNDLES);
  const {
    openCheckout,
    dataProductMode,
    setDataProductMode,
    dataNetwork: activeNetwork,
    setDataNetwork: setActiveNetwork,
    setActivePage,
  } = useApp();

  const [sizeFilter, setSizeFilter] = useState<'all' | 'small' | 'medium' | 'large'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

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
  const [airtimeErrors, setAirtimeErrors] = useState<{ phone?: string; amount?: string }>({});
  const airtimeTap = useTapFeedback();

  // Auto-detect network from phone
  const detectedAirtimeNet = useMemo(() => {
    return detectGhanaNetwork(airtimePhone);
  }, [airtimePhone]);

  // Current numeric airtime face value
  const airtimeFaceValueNum = useMemo(() => {
    if (isCustomAirtime) {
      const parsed = parseFloat(customAmount);
      return !isNaN(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : 0;
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

  // Network mismatch check, once the number is complete (number portability means it is only a hint).
  const isNetworkMismatch = Boolean(
    isCompleteGhanaPhone(airtimePhone) && detectedAirtimeNet && detectedAirtimeNet !== airtimeNet
  );

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
    const errors: { phone?: string; amount?: string } = {};
    if (isNaN(faceValue) || faceValue < 1) errors.amount = 'Minimum airtime is GH₵1.00.';
    else if (faceValue > 1000) errors.amount = 'Maximum airtime in one purchase is GH₵1,000.00.';
    if (!isCompleteGhanaPhone(airtimePhone)) errors.phone = 'Enter a 10-digit Ghana number, e.g. 024 123 4567.';
    setAirtimeErrors(errors);
    if (errors.phone || errors.amount) {
      document.getElementById(errors.phone ? 'airtime-phone' : isCustomAirtime ? 'airtime-custom' : 'airtime-amounts')?.focus();
      return;
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

    airtimeTap[1]();
    openCheckout(syntheticBundle, { recipientPhone: formatGhanaPhone(airtimePhone) });
  };

  const mtnNotice = serviceNotices.mtn;
  const atNotice = serviceNotices.airteltigo;

  return (
    <div className="py-4 sm:py-8 text-slate-100">
      {dataProductMode==='data'&&<WelcomeOfferNotice offer={welcomeOffer}/>}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        <PendingPaymentBanner />

        <header className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-[#44df95] mb-1">Data & Airtime</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stay connected.</h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">Pick a bundle, enter the number and pay with Mobile Money. You check the total before paying.</p>
          </div>

          {/* 4 Product Mode Navigation Tabs / Discovery Shortcuts */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <div role="group" aria-label="Choose a service" className="inline-flex shrink-0 rounded-2xl bg-[#0c1217] border border-slate-800 p-1 gap-1">
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
                className={`min-h-11 px-4 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  dataProductMode === 'data' ? 'bg-[#00c365] text-[#03160c]' : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                Data<span className="hidden sm:inline"> Bundles</span>
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
                className={`min-h-11 px-4 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${
                  dataProductMode === 'instant' ? 'bg-amber-400 text-black' : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Zap className={`w-3.5 h-3.5 ${dataProductMode === 'instant' ? 'fill-current' : 'text-amber-400'}`} />
                Instant
              </button>
              <button
                type="button"
                aria-pressed={dataProductMode === 'airtime'}
                onClick={handleSelectAirtime}
                className={`min-h-11 px-4 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  dataProductMode === 'airtime' ? 'bg-[#00c365] text-[#03160c]' : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                Airtime
              </button>
            </div>
            <button
              type="button"
              aria-label="AFA Registration"
              onClick={() => setActivePage('afa')}
              className="min-h-11 px-3.5 rounded-xl text-sm font-semibold whitespace-nowrap cursor-pointer shrink-0 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-600 inline-flex items-center gap-1.5"
              title="Register your MTN number for eligible AFA offers"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>AFA<span className="hidden sm:inline"> Registration</span></span>
            </button>
          </div>

          {/* One network selector, backed by the existing AppContext state. */}
          {dataProductMode === 'data' && <DataNetworkSelector value={activeNetwork} onChange={setActiveNetwork} />}
        </header>

        {/* Dynamic Mode: Instant Bundles vs Airtime vs Standard Data */}
        {dataProductMode === 'instant' ? (
          <div id="instant-bundles-section" ref={bundlesSectionRef} className="scroll-mt-6">
            <InstantBundlesCatalog
              onSwitchToData={() => setDataProductMode('data')}
              activeNetwork={activeNetwork}
              onSelectNetwork={(net) => setActiveNetwork(net)}
            />
          </div>
        ) : dataProductMode === 'airtime' ? (
          /* Airtime: number first, then network and amount, with the total always visible. */
          <form
            ref={airtimeSectionRef}
            onSubmit={handleAirtimeSubmit}
            noValidate
            aria-labelledby="airtime-title"
            className="max-w-xl rounded-2xl bg-[#0e141a] border border-slate-800 p-4 sm:p-6 space-y-5 scroll-mt-24"
          >
            <div>
              <h2 id="airtime-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">Airtime top-up</h2>
              <p className="text-sm text-slate-400 mt-1">Airtime goes straight to the number. No service fee.</p>
            </div>

            {/* Recipient */}
            <div className="space-y-1.5">
              <label htmlFor="airtime-phone" className="text-sm font-semibold text-slate-200 block">Recipient number</label>
              <input
                id="airtime-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={airtimePhone}
                aria-invalid={Boolean(airtimeErrors.phone)}
                aria-describedby="airtime-phone-note"
                onChange={(e) => { setAirtimePhone(formatGhanaPhone(e.target.value.replace(/[^\d\s+]/g, ''))); setAirtimeErrors(prev => ({ ...prev, phone: undefined })); }}
                placeholder="024 123 4567"
                className={`w-full min-h-12 bg-[#090d11] border rounded-xl px-4 text-lg text-white tabular-nums tracking-wide placeholder-slate-600 focus:outline-none ${airtimeErrors.phone ? 'border-rose-500/80' : 'border-slate-700 focus:border-[#00c365]'}`}
              />
              <div id="airtime-phone-note" className="min-h-5 text-xs" aria-live="polite">
                {airtimeErrors.phone ? <p className="text-rose-300">{airtimeErrors.phone}</p>
                  : isNetworkMismatch && detectedAirtimeNet ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span>This looks like a {shortNetworkName(detectedAirtimeNet)} number.</span>
                      <button type="button" onClick={() => setAirtimeNet(detectedAirtimeNet)} className="font-semibold underline underline-offset-2 cursor-pointer min-h-8">
                        Switch to {shortNetworkName(detectedAirtimeNet)}
                      </button>
                    </div>
                  ) : detectedAirtimeNet && isCompleteGhanaPhone(airtimePhone) ? (
                    <p className="text-slate-400 flex items-center gap-1"><Check className="w-3.5 h-3.5 text-[#44df95]" />{shortNetworkName(detectedAirtimeNet)} number</p>
                  ) : <p className="text-slate-500">Check the number carefully. Airtime cannot be moved once sent.</p>}
              </div>
            </div>

            {/* Network */}
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-semibold text-slate-200 mb-1.5">Network</legend>
              <div className="grid grid-cols-3 gap-2">
                {DATA_NETWORK_CHOICES.filter(choice => choice.id !== 'all').map(choice => {
                  const selected = airtimeNet === choice.id;
                  return (
                    <button key={choice.id} type="button" aria-pressed={selected} aria-label={choice.name}
                      onClick={() => setAirtimeNet(choice.id as NetworkId)}
                      className="mh-press min-h-12 rounded-xl border text-sm font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      style={selected ? { backgroundColor: choice.color, color: choice.ink, borderColor: choice.color } : { backgroundColor: '#101820', color: '#dce4ee', borderColor: '#334155' }}>
                      {choice.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Amount */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-slate-200 mb-1.5">Amount</legend>
              <div id="airtime-amounts" tabIndex={-1} role="group" aria-label="Airtime amounts" className="grid grid-cols-3 gap-2 focus:outline-none">
                {['5', '10', '20', '50', '100'].map((amt) => {
                  const isSelected = !isCustomAirtime && airtimeAmount === amt;
                  return (
                    <button key={amt} type="button" aria-pressed={isSelected}
                      onClick={() => { setIsCustomAirtime(false); setAirtimeAmount(amt); setAirtimeErrors(prev => ({ ...prev, amount: undefined })); }}
                      className={`mh-press min-h-12 rounded-xl border text-base font-bold tabular-nums cursor-pointer ${isSelected ? 'border-white bg-white text-[#0b1015]' : 'border-slate-700 bg-[#090d11] text-slate-200 hover:border-slate-500'}`}>
                      <span className="text-xs font-semibold opacity-70 mr-0.5">GH₵</span>{amt}
                    </button>
                  );
                })}
                <button type="button" aria-pressed={isCustomAirtime} onClick={() => { setIsCustomAirtime(true); setAirtimeErrors(prev => ({ ...prev, amount: undefined })); }}
                  className={`mh-press min-h-12 rounded-xl border text-sm font-bold cursor-pointer ${isCustomAirtime ? 'border-white bg-white text-[#0b1015]' : 'border-slate-700 bg-[#090d11] text-slate-200 hover:border-slate-500'}`}>
                  Other amount
                </button>
              </div>
              {isCustomAirtime && (
                <div className="relative">
                  <span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">GH₵</span>
                  <input id="airtime-custom" type="text" inputMode="decimal" autoComplete="off" autoFocus
                    aria-label="Airtime amount in cedis" aria-invalid={Boolean(airtimeErrors.amount)}
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 7)); setAirtimeErrors(prev => ({ ...prev, amount: undefined })); }}
                    placeholder="1 – 1,000"
                    className={`w-full min-h-12 bg-[#090d11] border rounded-xl pl-14 pr-4 text-lg font-bold text-white tabular-nums placeholder-slate-600 focus:outline-none ${airtimeErrors.amount ? 'border-rose-500/80' : 'border-slate-700 focus:border-[#00c365]'}`} />
                </div>
              )}
              {airtimeErrors.amount && <p role="alert" className="text-xs text-rose-300">{airtimeErrors.amount}</p>}
            </fieldset>

            {/* Total (the server confirms it when payment starts) */}
            <div className="rounded-xl bg-[#090d11] border border-slate-800 p-3.5 flex items-end justify-between gap-3">
              <div className="text-xs text-slate-400 space-y-0.5">
                <p>{shortNetworkName(airtimeNet)} airtime <span className="text-slate-200 tabular-nums">GH₵{airtimeCalculation.faceValue.toFixed(2)}</span></p>
                <p>Service fee ({airtimeCalculation.feePercent}%) <span className="text-slate-200 tabular-nums">GH₵{airtimeCalculation.serviceFee.toFixed(2)}</span></p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-400 mb-1">You pay</p>
                <Money ghc={airtimeCalculation.total} size="lg" className="text-[#44df95]" />
              </div>
            </div>

            <button type="submit" data-tapped={airtimeTap[0]}
              className="mh-buy w-full min-h-12 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e070] text-[#03160c] font-bold text-base flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Continue · GH₵{airtimeCalculation.total.toFixed(2)}
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
            <p className="flex items-center justify-center gap-2 text-xs text-slate-400 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-[#44df95]" />
              <span>You review the number and total before paying. Track delivery in Orders.</span>
            </p>
          </form>
        ) : (
          /* Data Bundles View */
          <div ref={bundlesSectionRef} className="space-y-4 scroll-mt-24" id="data-bundles-section">
            {/* Filter Bar: size chips, with search one tap away */}
            <div className="flex items-center gap-2">
              {searchOpen ? (
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchQuery}
                    autoFocus
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search data bundles by size, price or network"
                    placeholder="Search size or price, e.g. 10GB"
                    className="w-full bg-[#0c1217] border border-slate-700 rounded-xl pl-10 pr-3 min-h-11 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
                  />
                </div>
              ) : (
                <div role="group" aria-label="Filter by bundle size" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1 -ml-4 pl-4 sm:ml-0 sm:pl-0">
                  {([
                    ['all', 'All sizes'],
                    ['small', '1GB – 5GB'],
                    ['medium', '6GB – 20GB'],
                    ['large', '25GB+'],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={sizeFilter === id}
                      onClick={() => setSizeFilter(id)}
                      className={`min-h-10 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 border ${
                        sizeFilter === id
                          ? 'bg-white text-[#0b1015] border-white'
                          : 'border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  if (searchOpen) setSearchQuery('');
                  setSearchOpen(!searchOpen);
                }}
                aria-label={searchOpen ? 'Close search' : 'Search bundles'}
                aria-expanded={searchOpen}
                className="min-w-11 min-h-11 shrink-0 flex items-center justify-center rounded-xl border border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer"
              >
                {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

            {/* MTN Network Service Notice (Tasteful, Customer-Friendly, Config-Driven) */}
            {mtnNotice.enabled && (activeNetwork === 'mtn' || activeNetwork === 'all') && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 text-xs text-slate-300">
                <details>
                  <summary className="cursor-pointer min-h-11 flex flex-wrap items-center gap-x-2 py-2 list-none [&::-webkit-details-marker]:hidden">
                    <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <strong className="text-amber-100 font-semibold">MTN delivery</strong>
                    <span>Most orders arrive within 15–45 minutes.</span>
                    <span className="text-amber-300 underline underline-offset-2">Details</span>
                  </summary>
                  <div className="space-y-2 pb-3 text-slate-300 leading-relaxed"><p>{mtnNotice.message}</p><p>{mtnNotice.duplicatePolicyNote}</p><p>{mtnNotice.trackingNote}</p></div>
                </details>
              </div>
            )}

            {/* AirtelTigo Instant Delivery Highlight Notice */}
            {atNotice.enabled && activeNetwork === 'airteltigo' && (
              <p className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3.5 py-2.5 text-xs text-sky-100/90 leading-relaxed">
                <strong className="text-white font-semibold">{atNotice.title}</strong> · {atNotice.message}
              </p>
            )}

            {/* Bundles: one list; the whole row opens checkout */}
            {filteredBundles.length > 0 ? (
              <>
                <p className="text-xs text-slate-500" aria-live="polite">
                  {filteredBundles.length} {filteredBundles.length === 1 ? 'bundle' : 'bundles'}
                  {activeNetwork !== 'all' ? ` · ${GHANA_NETWORKS[activeNetwork].name}` : ' · all networks'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {filteredBundles.map((bundle) => (
                    <CompactBundleRow
                      key={bundle.id}
                      bundle={bundle}
                      directWelcomeOffer={welcomeOffer}
                      onBuy={(b) => openCheckout(b)}
                    />
                  ))}
                </div>

                {/* Elevated Section-Level Trust Signal (replaces repeated copy inside every card) */}
                <div className="flex items-center justify-center gap-2 pt-2 pb-1 text-xs text-slate-400 text-center">
                  <ShieldCheck className="w-4 h-4 text-[#00c365] shrink-0" />
                  <span>
                    Track delivery in Orders · Payments handled by Paystack
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center py-14 px-4 bg-[#0f151b] rounded-2xl border border-slate-800 space-y-3">
                <Search className="w-8 h-8 text-slate-500 mx-auto" />
                <h3 className="font-bold text-white text-base">No bundles match</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                  Try another size or clear your search to see every bundle.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveNetwork('all');
                    setSizeFilter('all');
                    setSearchQuery('');
                    setSearchOpen(false);
                  }}
                  className="mh-button"
                >
                  Show all bundles
                </button>
              </div>
            )}
          </div>
        )}

        {/* Questions: plain disclosures, one open at a time is up to the customer. */}
        <section aria-labelledby="data-faq" className="pt-8 border-t border-slate-800/80 space-y-4">
          <div>
            <h2 id="data-faq" className="text-lg sm:text-xl font-bold text-white tracking-tight">Questions before you buy</h2>
            <p className="text-sm text-slate-400 mt-1">Validity, delivery, balance codes and what to do if something goes wrong.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-[#0d1217] divide-y divide-slate-800/80">
            {faqs.map((faq, index) => (
              <details key={faq.id} open={index === 0} className="group/faq">
                <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer min-h-12 px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4 text-sm sm:text-base font-semibold text-white hover:text-[#bff5da]">
                  {faq.question}
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-open/faq:rotate-180 motion-reduce:transition-none" />
                </summary>
                <div className="px-4 sm:px-5 pb-4">{faq.answer}</div>
              </details>
            ))}
          </div>

          {/* Customer Support Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0d1217] border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
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
        </section>
      </div>
    </div>
  );
};
