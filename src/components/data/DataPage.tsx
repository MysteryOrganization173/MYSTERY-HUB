import { DataNetworkSelector, DATA_NETWORK_CHOICES } from './DataNetworkSelector';
import { BUSINESS_CONFIG } from '../../config/business';
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
import { DataBundleTile, TILE_NETWORK_COLOR } from './DataBundleTile';
import { DataStoreHero } from './DataStoreHero';
import './dataStore.css';
import { PendingPaymentBanner } from '../checkout/PendingPaymentBanner';
import { InstantBundlesCatalog } from './InstantBundlesCatalog';
import { smoothScrollToElement, revealPressedChip, revealFocusedChip } from '../../utils/scroll';
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
  Wifi,
  BadgeCheck,
  UserRound,
} from 'lucide-react';
import { useSeason } from '../../seasonal/SeasonProvider';
import { dataStoreSeasonAttributes } from '../../seasonal/Seasonal';

/** Brings a section into view only when it is not already; the sticky header covers the top 5rem on phones. */
const revealSection = (element: HTMLElement | null) => {
  if (!element) return;
  const top = element.getBoundingClientRect().top;
  if (top < 80 || top > window.innerHeight * 0.6) smoothScrollToElement(element, { block: 'start' });
};

const shortNetworkName = (id: NetworkId) => DATA_NETWORK_CHOICES.find(choice => choice.id === id)?.name || id;

const NETWORK_ORDER: NetworkId[] = ['mtn', 'airteltigo', 'telecel'];
const MODE_INDEX = { data: 0, instant: 1, airtime: 2 } as const;
/** Catalogue views already shown in this visit: returning to the page does not replay their entrance. */
const seenCatalogViews = new Set<string>();

/** The tile under the pointer catches a soft light (mouse only; touch has no hover). At most once per frame. */
let pointerFrame = 0;
const followPointer = (e: React.PointerEvent<HTMLElement>) => {
  if (e.pointerType !== 'mouse' || pointerFrame) return;
  const tile = (e.target as HTMLElement).closest<HTMLElement>('.mh-ds-tile');
  if (!tile) return;
  const { clientX, clientY } = e;
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0;
    const box = tile.getBoundingClientRect();
    tile.style.setProperty('--mx', `${clientX - box.left}px`);
    tile.style.setProperty('--my', `${clientY - box.top}px`);
  });
};

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
    user,
  } = useApp();
  const season = useSeason();

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
        revealSection(bundlesSectionRef.current);
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
  // A number typed for one account never carries over to the next: signing out or switching account clears it.
  // (Finishing the sign-in check, or a guest signing in, is the same person, so their typing is kept.)
  const accountId = user?.id || null;
  const previousAccount = useRef(accountId);
  useEffect(() => {
    if (previousAccount.current && previousAccount.current !== accountId) { setAirtimePhone(''); setAirtimeErrors({}); }
    previousAccount.current = accountId;
  }, [accountId]);
  const accountPhone = user?.phone && isCompleteGhanaPhone(user.phone) ? formatGhanaPhone(user.phone) : '';

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
                <p className="text-[10px] text-slate-400 mt-1">Or check MyMTN App</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#090d10] border border-slate-800">
                <div className="text-red-400 font-bold text-xs mb-0.5">AirtelTigo (AT)</div>
                <div className="font-mono text-white text-xs font-semibold">Dial *124# or *138#</div>
                <p className="text-[10px] text-slate-400 mt-1">Checks iShare & core balance</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#090d10] border border-slate-800">
                <div className="text-red-500 font-bold text-xs mb-0.5">Telecel Ghana</div>
                <div className="font-mono text-white text-xs font-semibold">Dial *126# or *110#</div>
                <p className="text-[10px] text-slate-400 mt-1">Telecel data balance</p>
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
      revealSection(airtimeSectionRef.current);
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

  // How many bundles each network holds (the whole catalogue on the page), shown on the network selector.
  const networkCounts = useMemo(() => {
    const counts: Partial<Record<NetworkId | 'all', number>> = { all: DATA_BUNDLES.length };
    for (const bundle of DATA_BUNDLES) counts[bundle.network] = (counts[bundle.network] || 0) + 1;
    return counts;
  }, [DATA_BUNDLES]);

  // All networks: one titled group per network, so a long mixed list stays easy to scan. One network: one grid.
  const bundleGroups = useMemo(() => activeNetwork === 'all'
    ? NETWORK_ORDER.map(network => ({ network, bundles: filteredBundles.filter(bundle => bundle.network === network) })).filter(group => group.bundles.length)
    : [{ network: activeNetwork, bundles: filteredBundles }], [activeNetwork, filteredBundles]);

  const catalogView = `${activeNetwork}|${sizeFilter}`;
  const [settledViews] = useState(() => new Set(seenCatalogViews));
  useEffect(() => { seenCatalogViews.add(catalogView); }, [catalogView]);

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
  const modeButton = 'mh-ds-mode';

  return (
    <div className="mh-ds py-4 sm:py-8 text-slate-100" {...dataStoreSeasonAttributes(season)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
        <PendingPaymentBanner />
        {/* 3.6.2: inside the page margins, after payment recovery and before the title panel. */}
        {dataProductMode==='data'&&<div className="mh-ds-offer"><WelcomeOfferNotice offer={welcomeOffer}/></div>}

        <DataStoreHero mode={dataProductMode} />

        <div className="space-y-2.5 sm:space-y-3">
          {/* 4 Product Mode Navigation Tabs / Discovery Shortcuts: one sliding indicator carries the active service. */}
          <div onFocus={revealFocusedChip} className="mh-chip-scroll items-center gap-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            <div role="group" aria-label="Choose a service" className="mh-ds-modes" style={{ '--mode': MODE_INDEX[dataProductMode] } as React.CSSProperties}>
              <span className="mh-ds-modes-thumb" aria-hidden="true" />
              <button
                type="button"
                aria-label="Data Bundles"
                aria-pressed={dataProductMode === 'data'}
                onClick={() => {
                  setDataProductMode('data');
                  setTimeout(() => revealSection(bundlesSectionRef.current), 50);
                }}
                className={modeButton}
              >
                <span><Wifi aria-hidden="true" />Data</span>
                <small>Bundles</small>
              </button>
              <button
                type="button"
                aria-label="Instant Bundles"
                aria-pressed={dataProductMode === 'instant'}
                onClick={() => {
                  setDataProductMode('instant');
                  setTimeout(() => revealSection(bundlesSectionRef.current), 50);
                }}
                className={modeButton}
              >
                <span><Zap aria-hidden="true" className={dataProductMode === 'instant' ? 'fill-current' : 'text-amber-300'} />Instant</span>
                <small>Network packages</small>
              </button>
              <button
                type="button"
                aria-label="Airtime"
                aria-pressed={dataProductMode === 'airtime'}
                onClick={handleSelectAirtime}
                className={modeButton}
              >
                <span><Smartphone aria-hidden="true" />Airtime</span>
                <small>MTN, AT and Telecel</small>
              </button>
            </div>
            <button
              type="button"
              aria-label="AFA Registration"
              onClick={() => setActivePage('afa')}
              className="mh-ds-afa"
              title="Register your MTN number for eligible AFA offers"
            >
              <BadgeCheck aria-hidden="true" />
              <span>AFA<span className="hidden sm:inline"> Registration</span></span>
            </button>
          </div>

          {/* One network selector, backed by the existing AppContext state. */}
          {dataProductMode === 'data' && <DataNetworkSelector value={activeNetwork} onChange={setActiveNetwork} counts={networkCounts} />}
        </div>

        {/* Dynamic Mode: Instant Bundles vs Airtime vs Standard Data */}
        {dataProductMode === 'instant' ? (
          <div id="instant-bundles-section" ref={bundlesSectionRef} className="scroll-mt-24">
            <div className="mh-ds-swap">
              <InstantBundlesCatalog
                onSwitchToData={() => setDataProductMode('data')}
                activeNetwork={activeNetwork}
                onSelectNetwork={(net) => setActiveNetwork(net)}
              />
            </div>
          </div>
        ) : dataProductMode === 'airtime' ? (
          /* Airtime: number first, then network and amount, with the total always visible. */
          <form
            ref={airtimeSectionRef}
            onSubmit={handleAirtimeSubmit}
            noValidate
            aria-labelledby="airtime-title"
            className="mh-ds-panel mh-ds-swap max-w-xl p-4 sm:p-6 space-y-5 scroll-mt-24"
          >
            <div>
              <h2 id="airtime-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">Airtime top-up</h2>
              <p className="text-sm text-slate-400 mt-1">Airtime goes straight to the number. No service fee.</p>
            </div>

            {/* Recipient */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="airtime-phone" className="text-sm font-semibold text-slate-200 block">Recipient number</label>
                {/* Signed in: one tap fills the account's own number. Never filled without asking. */}
                {accountPhone && formatGhanaPhone(airtimePhone) !== accountPhone && (
                  <button type="button" className="mh-ds-use-mine" onClick={() => { setAirtimePhone(accountPhone); setAirtimeErrors(prev => ({ ...prev, phone: undefined })); document.getElementById('airtime-phone')?.focus(); }}>
                    <UserRound className="w-3.5 h-3.5" aria-hidden="true" />Use my number
                  </button>
                )}
              </div>
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
                  ) : <p className="text-slate-400">Check the number carefully. Airtime cannot be moved once sent.</p>}
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
                      style={selected ? { backgroundColor: choice.color, color: choice.ink, borderColor: choice.color, boxShadow: `0 10px 22px -14px ${choice.color}` } : { backgroundColor: '#0c1318', color: '#dce4ee', borderColor: '#2b3a46' }}>
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
                      className="mh-ds-amount">
                      <span className="text-xs font-semibold opacity-70 mr-0.5">GH₵</span>{amt}
                    </button>
                  );
                })}
                <button type="button" aria-pressed={isCustomAirtime} onClick={() => { setIsCustomAirtime(true); setAirtimeErrors(prev => ({ ...prev, amount: undefined })); }}
                  className="mh-ds-amount text-sm">
                  Other amount
                </button>
              </div>
              {isCustomAirtime && (
                <div className="relative mh-ds-swap">
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
            <div className="mh-ds-total p-3.5 flex items-end justify-between gap-3">
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
          <div ref={bundlesSectionRef} className="space-y-3 sm:space-y-4 scroll-mt-24" id="data-bundles-section">
            {/* Filter Bar: size chips, with search one tap away */}
            <div className="flex items-center gap-2">
              {searchOpen ? (
                <div className="mh-ds-search relative flex-1 min-w-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchQuery}
                    autoFocus
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search data bundles by size, price or network"
                    placeholder="Search size or price, e.g. 10GB"
                  />
                </div>
              ) : (
                <div ref={revealPressedChip} onFocus={revealFocusedChip} role="group" aria-label="Filter by bundle size" className="mh-chip-scroll items-center gap-1.5 min-w-0 flex-1 -ml-4 pl-4 sm:ml-0 sm:pl-0">
                  {([
                    ['all', 'All', 'All sizes'],
                    ['small', '1–5GB', '1GB to 5GB'],
                    ['medium', '6–20GB', '6GB to 20GB'],
                    ['large', '25GB+', '25GB and more'],
                  ] as const).map(([id, label, name]) => (
                    <button
                      key={id}
                      type="button"
                      aria-label={name}
                      aria-pressed={sizeFilter === id}
                      onClick={() => setSizeFilter(id)}
                      className="mh-ds-chip"
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
                className="mh-ds-icon-btn"
              >
                {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

            {/* MTN Network Service Notice (Tasteful, Customer-Friendly, Config-Driven) */}
            {mtnNotice.enabled && (activeNetwork === 'mtn' || activeNetwork === 'all') && (
              <div className="mh-ds-notice rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 text-xs text-slate-300">
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
              <p className="mh-ds-notice rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3.5 py-2.5 text-xs text-sky-100/90 leading-relaxed">
                <strong className="text-white font-semibold">{atNotice.title}</strong> · {atNotice.message}
              </p>
            )}

            {/* Bundles: tiles grouped by network; the whole tile opens checkout */}
            {filteredBundles.length > 0 ? (
              <>
                <p className="mh-ds-count-line" aria-live="polite">
                  <span><strong>{filteredBundles.length} {filteredBundles.length === 1 ? 'bundle' : 'bundles'}</strong>
                  {activeNetwork !== 'all' ? ` · ${GHANA_NETWORKS[activeNetwork].name}` : ' · all networks'}</span>
                  <span>Tap a bundle to review it</span>
                </p>
                <div key={catalogView} onPointerMove={followPointer} className={settledViews.has(catalogView) ? 'mh-ds-catalog is-settled' : 'mh-ds-catalog'}>
                  {bundleGroups.map(group => (
                    <section key={group.network} className="mh-ds-group" aria-label={activeNetwork === 'all' ? `${GHANA_NETWORKS[group.network].name} bundles` : undefined}>
                      {activeNetwork === 'all' && (
                        <h2 className="mh-ds-group-head" style={{ '--net': TILE_NETWORK_COLOR[group.network] } as React.CSSProperties}>
                          <span className="mh-ds-group-mark" aria-hidden="true" />{GHANA_NETWORKS[group.network].name}<span>{group.bundles.length}</span>
                        </h2>
                      )}
                      <div className="mh-ds-grid">
                        {group.bundles.map((bundle, index) => (
                          <DataBundleTile
                            key={bundle.id}
                            bundle={bundle}
                            index={index}
                            directWelcomeOffer={welcomeOffer}
                            onBuy={(b) => openCheckout(b)}
                          />
                        ))}
                      </div>
                    </section>
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
              <div className="mh-ds-empty space-y-3">
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
        <section aria-labelledby="data-faq" className="mh-ds-faq pt-8 border-t border-slate-800/80 space-y-4">
          <div>
            <h2 id="data-faq" className="text-lg sm:text-xl font-bold text-white tracking-tight">Questions before you buy</h2>
            <p className="text-sm text-slate-400 mt-1">Validity, delivery, balance codes and what to do if something goes wrong.</p>
          </div>
          <div className="mh-ds-panel divide-y divide-slate-800/80">
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
          <div className="mh-ds-panel p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left w-full sm:w-auto">
              <div className="w-10 h-10 rounded-xl bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365] shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Still have questions about an order?</h3>
                <p className="text-xs text-slate-400">
                  Track your purchase in Orders, or contact our WhatsApp support team. Mystery AI can help with general service questions.
                </p>
              </div>
            </div>

            <a
              href={BUSINESS_CONFIG.getGeneralWhatsAppUrl('Hello Mystery Hub, I have a question about a data bundle')}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 min-h-11 rounded-xl bg-[#00c365] text-black font-bold text-xs hover:bg-[#00b05b] transition-colors cursor-pointer shrink-0"
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
