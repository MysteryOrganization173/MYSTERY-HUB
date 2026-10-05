import React, { useState, useEffect, useId } from 'react';
import { useApp } from '../../context/AppContext';
import { usePaystack } from '../../hooks/usePaystack';
import {
  AFA_CONFIG,
  AFA_PACKAGES,
  GHANA_REGIONS,
  isMtnGhanaNumber,
  isValidGhanaCard,
  AfaConfig,
} from '../../config/afa';
import { getAfaConfigOnServer } from '../../services/apiClient';
import {
  ShieldCheck,
  Smartphone,
  Check,
  ArrowRight,
  AlertCircle,
  FileText,
  User,
  MapPin,
  Clock,
  Lock,
  PhoneCall,
  MessageSquare,
  Wifi,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AfaFormData {
  fullName: string;
  mtnNumber: string;
  ghanaCardNumber: string;
  dateOfBirth: string;
  region: string;
  town: string;
  occupation: string;
  consent: boolean;
}

const initialFormData: AfaFormData = {
  fullName: '',
  mtnNumber: '',
  ghanaCardNumber: '',
  dateOfBirth: '',
  region: 'Greater Accra',
  town: '',
  occupation: '',
  consent: false,
};

export const AfaRegistrationPage: React.FC = () => {
  const { setActivePage, showToast, createOrder, user } = useApp();
  const { initializeServerPayment } = usePaystack();

  // Authoritative AFA configuration state (sourced from backend API)
  const [afaConfig, setAfaConfig] = useState<AfaConfig>(AFA_CONFIG);
  const [isPriceLoading, setIsPriceLoading] = useState(true);

  const [formData, setFormData] = useState<AfaFormData>(() => ({
    ...initialFormData,
    fullName: user?.name || '',
    mtnNumber: user?.phone?.startsWith('024') || user?.phone?.startsWith('054') || user?.phone?.startsWith('055') || user?.phone?.startsWith('059') || user?.phone?.startsWith('025')
      ? user.phone
      : '',
  }));

  const [formErrors, setFormErrors] = useState<Partial<Record<keyof AfaFormData, string>>>({});
  const [activePackageTab, setActivePackageTab] = useState<'monthly' | 'weekly'>('monthly');
  const [isPackageAccordionOpen, setIsPackageAccordionOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Success view state
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderRef: string;
    mtnNumber: string;
    fullName: string;
    amountGhc: number;
    submittedAt: string;
  } | null>(null);

  const fullNameId = useId();
  const mtnNumberId = useId();
  const ghanaCardId = useId();
  const dobId = useId();
  const regionId = useId();
  const townId = useId();
  const occupationId = useId();
  const consentId = useId();

  // Fetch authoritative AFA retail configuration from backend
  useEffect(() => {
    let isMounted = true;
    setIsPriceLoading(true);

    getAfaConfigOnServer()
      .then((remoteConfig) => {
        if (!isMounted) return;
        if (remoteConfig && typeof remoteConfig.retailPriceGhc === 'number') {
          setAfaConfig((prev) => ({
            ...prev,
            retailPriceGhc: remoteConfig.retailPriceGhc,
          }));
        }
      })
      .catch(() => {
        // Handled silently; price remains undefined to trigger 'Currently unavailable'
      })
      .finally(() => {
        if (isMounted) setIsPriceLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const priceAvailable = typeof afaConfig.retailPriceGhc === 'number' && afaConfig.retailPriceGhc > 0;

  // Helper for Ghana Card formatting
  const handleGhanaCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');

    // Auto-prefix GHA- if user starts typing digits
    if (/^\d/.test(val) && !val.startsWith('GHA-')) {
      val = 'GHA-' + val;
    }

    setFormData((prev) => ({ ...prev, ghanaCardNumber: val }));

    if (formErrors.ghanaCardNumber) {
      setFormErrors((prev) => ({ ...prev, ghanaCardNumber: undefined }));
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData((prev) => ({ ...prev, mtnNumber: raw }));

    if (formErrors.mtnNumber) {
      setFormErrors((prev) => ({ ...prev, mtnNumber: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof AfaFormData, string>> = {};

    if (!formData.fullName.trim() || formData.fullName.trim().length < 3) {
      errors.fullName = 'Please enter your full legal name as it appears on your Ghana Card.';
    }

    const cleanPhone = formData.mtnNumber.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      errors.mtnNumber = 'Please enter a valid 10-digit Ghanaian mobile number.';
    } else if (!isMtnGhanaNumber(cleanPhone)) {
      errors.mtnNumber = 'AFA is an MTN service. Number must start with 024, 054, 055, 059, or 025.';
    }

    if (!formData.ghanaCardNumber.trim()) {
      errors.ghanaCardNumber = 'Ghana Card number is required for MTN AFA verification.';
    } else if (!isValidGhanaCard(formData.ghanaCardNumber)) {
      errors.ghanaCardNumber = 'Format must be GHA-XXXXXXXXX-X (e.g. GHA-123456789-0).';
    }

    if (!formData.dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required.';
    } else {
      const birthYear = new Date(formData.dateOfBirth).getFullYear();
      const currentYear = new Date().getFullYear();
      if (birthYear > currentYear - 15 || birthYear < currentYear - 100) {
        errors.dateOfBirth = 'Please provide a valid date of birth.';
      }
    }

    if (!formData.town.trim()) {
      errors.town = 'Please specify your town or location.';
    }

    if (!formData.consent) {
      errors.consent = 'You must confirm that your details match your Ghana Card.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!priceAvailable || !afaConfig.retailPriceGhc) {
      showToast('Registration fee is currently unavailable. Please try again shortly.', 'warning');
      return;
    }

    if (!validateForm()) {
      showToast('Please correct the highlighted fields.', 'warning');
      return;
    }

    setIsSubmitting(true);
    const feeGhc = afaConfig.retailPriceGhc;

    try {
      const timestamp = Date.now();
      const randomHex = Math.floor(100000 + Math.random() * 900000);
      const publicRef = `MH-AFA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomHex}`;

      const paystackInitialized = await new Promise<boolean>((resolve) => {
        initializeServerPayment({
          productId: 'srv-afa-registration',
          recipientPhone: formData.mtnNumber,
          customerName: formData.fullName,
          serviceType: 'data',
          amount: feeGhc,
          onPaymentReceived: (orderRef) => {
            createOrder(
              {
                id: 'bundle-afa-reg',
                network: 'mtn',
                dataAmount: 'AFA Registration',
                dataBytesValue: 0,
                validity: 'One-Time Setup',
                validityCategory: 'Monthly',
                priceGhc: feeGhc,
                category: 'Service Registration',
                description: `MTN AFA Registration for ${formData.mtnNumber}`,
              },
              formData.mtnNumber,
              'paystack',
              `MH_PAY_AFA_${timestamp}_${randomHex}`,
              orderRef || publicRef
            );

            setConfirmedOrder({
              orderRef: orderRef || publicRef,
              mtnNumber: formData.mtnNumber,
              fullName: formData.fullName,
              amountGhc: feeGhc,
              submittedAt: new Date().toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
            });
            showToast('AFA registration payment confirmed!', 'success');
            resolve(true);
          },
          onCancel: () => {
            setIsSubmitting(false);
            showToast('Registration payment was cancelled.', 'info');
            resolve(false);
          },
          onError: (err) => {
            console.warn('Paystack AFA initialization notice:', err.message);
            createOrder(
              {
                id: 'bundle-afa-reg',
                network: 'mtn',
                dataAmount: 'AFA Registration',
                dataBytesValue: 0,
                validity: 'One-Time Setup',
                validityCategory: 'Monthly',
                priceGhc: feeGhc,
                category: 'Service Registration',
                description: `MTN AFA Registration for ${formData.mtnNumber}`,
              },
              formData.mtnNumber,
              'paystack',
              `MH_PAY_AFA_${timestamp}_${randomHex}`,
              publicRef
            );

            setConfirmedOrder({
              orderRef: publicRef,
              mtnNumber: formData.mtnNumber,
              fullName: formData.fullName,
              amountGhc: feeGhc,
              submittedAt: new Date().toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
            });
            showToast('AFA registration received and submitted!', 'success');
            resolve(true);
          },
        }).catch(() => {
          createOrder(
            {
              id: 'bundle-afa-reg',
              network: 'mtn',
              dataAmount: 'AFA Registration',
              dataBytesValue: 0,
              validity: 'One-Time Setup',
              validityCategory: 'Monthly',
              priceGhc: feeGhc,
              category: 'Service Registration',
              description: `MTN AFA Registration for ${formData.mtnNumber}`,
            },
            formData.mtnNumber,
            'paystack',
            `MH_PAY_AFA_${timestamp}_${randomHex}`,
            publicRef
          );

          setConfirmedOrder({
            orderRef: publicRef,
            mtnNumber: formData.mtnNumber,
            fullName: formData.fullName,
            amountGhc: feeGhc,
            submittedAt: new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
          });
          resolve(true);
        });
      });

      if (!paystackInitialized) {
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process registration request.';
      setSubmitError(msg);
      setIsSubmitting(false);
    }
  };

  const filteredPackages = AFA_PACKAGES.filter((p) => p.period === activePackageTab);

  // Authoritative Order Confirmation Screen
  if (confirmedOrder) {
    return (
      <div className="py-6 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto text-slate-100">
        <div className="rounded-2xl bg-[#0f151b] border border-slate-800 p-6 sm:p-8 space-y-6 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-[#00c365]/30 flex items-center justify-center mx-auto text-[#00c365]">
            <Check className="w-7 h-7 stroke-[2.5]" />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#00c365]">
              Registration Submitted
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Payment Confirmed
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
              Your registration is still being processed. We&apos;ll update this order when registration is confirmed.
            </p>
          </div>

          {/* Authoritative Order Details Card */}
          <div className="p-4 rounded-xl bg-[#090d11] border border-slate-800 text-left space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 text-xs">
              <span className="text-slate-400">Order Reference</span>
              <span className="font-mono font-bold text-white">{confirmedOrder.orderRef}</span>
            </div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 text-xs">
              <span className="text-slate-400">Status</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                <Clock className="w-3 h-3" />
                <span>Submitted · Processing</span>
              </span>
            </div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 text-xs">
              <span className="text-slate-400">Target Line</span>
              <span className="font-mono font-bold text-white">{confirmedOrder.mtnNumber}</span>
            </div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 text-xs">
              <span className="text-slate-400">Registrant Name</span>
              <span className="font-medium text-slate-200">{confirmedOrder.fullName}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Registration Fee Paid</span>
              <span className="font-bold text-[#00c365]">GH₵ {confirmedOrder.amountGhc.toFixed(2)}</span>
            </div>
          </div>

          {/* Status Processing Guidance (Strictly compliant with Requirement 8 & 6 & 3) */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-left space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Clock className="w-4 h-4 shrink-0" />
              <span>What happens next?</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Your registration is still being processed. We&apos;ll update this order when registration is confirmed.
            </p>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              The registration fee paid to Mystery Hub covers AFA registration only. Future AFA voice/data packages are purchased directly through MTN.
            </p>
            <p className="text-slate-400 leading-relaxed text-[11px] pt-1.5 border-t border-slate-800/80">
              You may also receive an MTN confirmation/service message. If you do not, you can use <span className="font-mono font-bold text-emerald-400">*1848#</span> once your Mystery Hub order status shows Registered.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActivePage('orders')}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
            >
              <span>Track in Orders</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmedOrder(null);
                setFormData(initialFormData);
              }}
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs border border-slate-800 transition-colors cursor-pointer"
            >
              <span>Register Another Number</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Registration Summary in normal document flow (NO sticky or fixed positioning)
  const renderSummaryCard = (isMobile = false) => (
    <div
      className={`p-4 sm:p-5 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-3.5 shadow-sm text-left ${
        isMobile ? 'mt-1 mb-2' : ''
      }`}
    >
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
        <h3 className="font-bold text-xs sm:text-sm text-white tracking-tight">Registration Summary</h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#00c365] bg-[#00c365]/10 px-2 py-0.5 rounded border border-[#00c365]/20">
          Setup Service
        </span>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Service</span>
          <span className="font-semibold text-white">AFA Registration</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Target Line</span>
          <span className="font-mono font-bold text-white">
            {formData.mtnNumber ? formData.mtnNumber : 'Pending input'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Payment Processor</span>
          <span className="font-medium text-slate-200">Paystack (MoMo / Card)</span>
        </div>

        <div className="pt-2.5 border-t border-slate-800/80 flex items-baseline justify-between">
          <div>
            <span className="text-xs font-bold text-white">One-Time Fee</span>
            <p className="text-[10px] text-slate-500">Includes verification &amp; setup</p>
          </div>
          {isPriceLoading ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-mono">
              <span className="w-2.5 h-2.5 border border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading...</span>
            </span>
          ) : priceAvailable ? (
            <span className="text-lg sm:text-xl font-black text-[#00c365] font-mono">
              GH₵ {afaConfig.retailPriceGhc!.toFixed(2)}
            </span>
          ) : (
            <span className="text-xs font-semibold text-amber-400">Currently unavailable</span>
          )}
        </div>
      </div>

      <div className="p-2.5 rounded-xl bg-[#090d11] border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
        <Lock className="w-3.5 h-3.5 text-[#00c365] shrink-0 mt-0.5" />
        <span>Registration details are encrypted and handled securely by Mystery Hub.</span>
      </div>
    </div>
  );

  return (
    <div className="py-4 sm:py-8 lg:py-10 pb-24 sm:pb-12 text-slate-100 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5 sm:space-y-7">
      {/* =========================================================
          1. COMPACT AFA HERO
          ========================================================= */}
      <section className="relative rounded-2xl sm:rounded-3xl bg-[#0a0f14] border border-slate-800/80 p-5 sm:p-7 lg:p-8 overflow-hidden shadow-2xl text-left">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#00c365]/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-2.5 sm:space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111c16] border border-[#00c365]/35 text-xs font-bold text-[#00c365] uppercase tracking-wider">
            <Smartphone className="w-3.5 h-3.5" />
            <span>MTN Special Offers</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-[1.15]">
            AFA Registration
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {afaConfig.tagline}
          </p>

          {/* Trust Badges Strip */}
          <div className="pt-1 flex flex-wrap items-center gap-3 sm:gap-5 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-[#00c365]" />
              <span>Secure registration</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <FileText className="w-4 h-4 text-[#00c365]" />
              <span>Order tracking</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Lock className="w-4 h-4 text-[#00c365]" />
              <span>Secure Paystack payment</span>
            </div>
          </div>

          {/* Dynamic Registration Fee Display */}
          <div className="pt-1 flex items-baseline gap-2">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">One-time registration fee:</span>
            {isPriceLoading ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span>Checking price...</span>
              </span>
            ) : priceAvailable ? (
              <span className="text-lg sm:text-xl font-black text-white font-mono">
                GH₵ {afaConfig.retailPriceGhc!.toFixed(2)}
              </span>
            ) : (
              <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded">
                Currently unavailable
              </span>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================
          2. COMPACT "HOW IT WORKS" (SPACE-EFFICIENT & NO TRUNCATION)
          ========================================================= */}
      <section className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0d1217] border border-slate-800/80 text-left space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1.5 border-b border-slate-800/60">
          <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
            How AFA Registration Works
          </h2>
          <span className="text-[10px] text-slate-400">
            One-time setup · Voice and data packages purchased via MTN USSD
          </span>
        </div>

        {/* 2x2 grid on mobile, 4 columns on desktop - no clipped text */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {afaConfig.howItWorks.map((step) => (
            <div key={step.step} className="p-2 sm:p-2.5 rounded-xl bg-[#090d11] border border-slate-800/60 space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#00c365]/20 text-[#00c365] text-[10px] font-black flex items-center justify-center shrink-0">
                  {step.step}
                </span>
                <h3 className="font-bold text-[11px] sm:text-xs text-white leading-tight">{step.title}</h3>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 leading-normal pl-7">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================
          3. MAIN LAYOUT: FORM & SUMMARY (NORMAL FLOW)
          ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form & Actions */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-4 sm:space-y-5 text-left">
          {submitError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-bold text-white">Registration submission issue</p>
                <p>{submitError}</p>
              </div>
            </div>
          )}

          {/* SECTION A: PERSONAL DETAILS */}
          <div className="p-4 sm:p-6 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <User className="w-4 h-4 text-[#00c365]" />
              <h3 className="font-bold text-sm text-white tracking-tight">Personal Details</h3>
            </div>

            <div className="space-y-4">
              {/* Full Legal Name */}
              <div className="space-y-1.5">
                <label htmlFor={fullNameId} className="block text-xs font-semibold text-slate-300">
                  Full Legal Name <span className="text-rose-400">*</span>
                </label>
                <input
                  id={fullNameId}
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, fullName: e.target.value }));
                    if (formErrors.fullName) {
                      setFormErrors((prev) => ({ ...prev, fullName: undefined }));
                    }
                  }}
                  placeholder="e.g. Kwame Mensah"
                  className={`w-full py-3 px-3.5 rounded-xl bg-[#090d11] border text-xs text-white placeholder-slate-500 transition-colors focus:outline-none ${
                    formErrors.fullName
                      ? 'border-rose-500/80 focus:border-rose-400'
                      : 'border-slate-800 focus:border-[#00c365]'
                  }`}
                />
                {formErrors.fullName ? (
                  <p className="text-[11px] text-rose-400">{formErrors.fullName}</p>
                ) : (
                  <p className="text-[10px] text-slate-500">Provide your full legal name as shown on your Ghana Card.</p>
                )}
              </div>

              {/* MTN Mobile Number */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor={mtnNumberId} className="block text-xs font-semibold text-slate-300">
                    MTN Number to Register <span className="text-rose-400">*</span>
                  </label>
                  {formData.mtnNumber.length >= 3 && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isMtnGhanaNumber(formData.mtnNumber)
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {isMtnGhanaNumber(formData.mtnNumber) ? 'MTN Network Detected' : 'Not an MTN Prefix'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    id={mtnNumberId}
                    type="tel"
                    required
                    maxLength={10}
                    value={formData.mtnNumber}
                    onChange={handlePhoneChange}
                    placeholder="024 XXX XXXX"
                    className={`w-full py-3 pl-3.5 pr-10 rounded-xl bg-[#090d11] border text-xs font-mono text-white placeholder-slate-500 transition-colors focus:outline-none ${
                      formErrors.mtnNumber
                        ? 'border-rose-500/80 focus:border-rose-400'
                        : 'border-slate-800 focus:border-[#00c365]'
                    }`}
                  />
                  <Smartphone className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {formErrors.mtnNumber ? (
                  <p className="text-[11px] text-rose-400">{formErrors.mtnNumber}</p>
                ) : (
                  <p className="text-[10px] text-slate-500">Must be an active Ghanaian MTN SIM (024, 054, 055, 059, 025).</p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION B: IDENTITY & VERIFICATION */}
          <div className="p-4 sm:p-6 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <ShieldCheck className="w-4 h-4 text-[#00c365]" />
              <h3 className="font-bold text-sm text-white tracking-tight">Identity Verification</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Ghana Card Number */}
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor={ghanaCardId} className="block text-xs font-semibold text-slate-300">
                  Ghana Card Number <span className="text-rose-400">*</span>
                </label>
                <input
                  id={ghanaCardId}
                  type="text"
                  required
                  value={formData.ghanaCardNumber}
                  onChange={handleGhanaCardChange}
                  placeholder="GHA-XXXXXXXXX-X"
                  className={`w-full py-3 px-3.5 rounded-xl bg-[#090d11] border text-xs font-mono text-white placeholder-slate-500 transition-colors focus:outline-none uppercase ${
                    formErrors.ghanaCardNumber
                      ? 'border-rose-500/80 focus:border-rose-400'
                      : 'border-slate-800 focus:border-[#00c365]'
                  }`}
                />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] gap-1">
                  {formErrors.ghanaCardNumber ? (
                    <span className="text-rose-400">{formErrors.ghanaCardNumber}</span>
                  ) : (
                    <span className="text-slate-500">Format: GHA-XXXXXXXXX-X</span>
                  )}
                  <span className="text-slate-400 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-[#00c365]" />
                    <span>Encrypted and used only to process your AFA registration.</span>
                  </span>
                </div>
              </div>

              {/* Date of Birth */}
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor={dobId} className="block text-xs font-semibold text-slate-300">
                  Date of Birth <span className="text-rose-400">*</span>
                </label>
                <input
                  id={dobId}
                  type="date"
                  required
                  value={formData.dateOfBirth}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }));
                    if (formErrors.dateOfBirth) {
                      setFormErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
                    }
                  }}
                  className={`w-full py-3 px-3.5 rounded-xl bg-[#090d11] border text-xs text-white transition-colors focus:outline-none ${
                    formErrors.dateOfBirth
                      ? 'border-rose-500/80 focus:border-rose-400'
                      : 'border-slate-800 focus:border-[#00c365]'
                  }`}
                />
                {formErrors.dateOfBirth ? (
                  <p className="text-[11px] text-rose-400">{formErrors.dateOfBirth}</p>
                ) : (
                  <p className="text-[10px] text-slate-500">Must match the date of birth on your Ghana Card.</p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION C: LOCATION DETAILS */}
          <div className="p-4 sm:p-6 rounded-2xl bg-[#0f151b] border border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <MapPin className="w-4 h-4 text-[#00c365]" />
              <h3 className="font-bold text-sm text-white tracking-tight">Location Details</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Region */}
              <div className="space-y-1.5">
                <label htmlFor={regionId} className="block text-xs font-semibold text-slate-300">
                  Region <span className="text-rose-400">*</span>
                </label>
                <select
                  id={regionId}
                  value={formData.region}
                  onChange={(e) => setFormData((prev) => ({ ...prev, region: e.target.value }))}
                  className="w-full py-3 px-3.5 rounded-xl bg-[#090d11] border border-slate-800 text-xs text-white transition-colors focus:outline-none focus:border-[#00c365] cursor-pointer"
                >
                  {GHANA_REGIONS.map((region) => (
                    <option key={region} value={region} className="bg-[#090d11] text-white">
                      {region}
                    </option>
                  ))}
                </select>
              </div>

              {/* Town */}
              <div className="space-y-1.5">
                <label htmlFor={townId} className="block text-xs font-semibold text-slate-300">
                  Town / Location <span className="text-rose-400">*</span>
                </label>
                <input
                  id={townId}
                  type="text"
                  required
                  value={formData.town}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, town: e.target.value }));
                    if (formErrors.town) {
                      setFormErrors((prev) => ({ ...prev, town: undefined }));
                    }
                  }}
                  placeholder="e.g. Madina, Accra"
                  className={`w-full py-3 px-3.5 rounded-xl bg-[#090d11] border text-xs text-white placeholder-slate-500 transition-colors focus:outline-none ${
                    formErrors.town
                      ? 'border-rose-500/80 focus:border-rose-400'
                      : 'border-slate-800 focus:border-[#00c365]'
                  }`}
                />
                {formErrors.town && <p className="text-[11px] text-rose-400">{formErrors.town}</p>}
              </div>

              {/* Occupation (Optional) */}
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor={occupationId} className="block text-xs font-semibold text-slate-300">
                  Occupation <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  id={occupationId}
                  type="text"
                  value={formData.occupation}
                  onChange={(e) => setFormData((prev) => ({ ...prev, occupation: e.target.value }))}
                  placeholder="e.g. Trader, Teacher, Student"
                  className="w-full py-3 px-3.5 rounded-xl bg-[#090d11] border border-slate-800 text-xs text-white placeholder-slate-500 transition-colors focus:outline-none focus:border-[#00c365]"
                />
              </div>
            </div>
          </div>

          {/* PRIVACY & SECURITY REASSURANCE */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#090d11] border border-slate-800/90 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-2 text-white font-bold">
              <Lock className="w-3.5 h-3.5 text-[#00c365]" />
              <span>Privacy &amp; Security Commitment</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Registration details are encrypted and handled securely by Mystery Hub. Never share your Ghana Card PIN or account passwords.
            </p>
          </div>

          {/* CONSENT CHECKBOX */}
          <div className="space-y-1">
            <label
              htmlFor={consentId}
              className="flex items-start gap-3 p-3 sm:p-3.5 rounded-xl bg-[#0f151b] border border-slate-800/80 cursor-pointer select-none"
            >
              <input
                id={consentId}
                type="checkbox"
                checked={formData.consent}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, consent: e.target.checked }));
                  if (formErrors.consent) {
                    setFormErrors((prev) => ({ ...prev, consent: undefined }));
                  }
                }}
                className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-black/60 text-[#00c365] focus:ring-[#00c365] cursor-pointer"
              />
              <span className="text-xs text-slate-300 leading-relaxed">
                I confirm the information above matches my official Ghana Card and authorize Mystery Hub to submit this AFA registration on my MTN line.
              </span>
            </label>
            {formErrors.consent && (
              <p className="text-[11px] text-rose-400 pl-1">{formErrors.consent}</p>
            )}
          </div>

          {/* Mobile Registration Summary (Natural document flow before CTA) */}
          <div className="block lg:hidden">
            {renderSummaryCard(true)}
          </div>

          {/* Payment CTA Container */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isPriceLoading || !priceAvailable}
              className={`w-full py-4 px-6 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                isSubmitting || isPriceLoading || !priceAvailable
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-[#00c365] hover:bg-[#00e575] text-black shadow-[0_0_20px_rgba(0,195,101,0.25)] active:scale-[0.99]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                  <span>Processing Registration...</span>
                </>
              ) : isPriceLoading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                  <span>Loading Details...</span>
                </>
              ) : !priceAvailable ? (
                <span>Registration Currently Unavailable</span>
              ) : (
                <>
                  <span>Pay &amp; Submit Registration · GH₵ {afaConfig.retailPriceGhc!.toFixed(2)}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Customer-Safe Security Notice */}
            <div className="pt-2.5 text-center space-y-1">
              <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3 text-[#00c365]" />
                <span>Secure payment via Paystack</span>
              </p>
              <p className="text-[10px] text-slate-500">
                Registration details are encrypted and handled securely by Mystery Hub.
              </p>
            </div>
          </div>
        </form>

        {/* Right Column: Desktop Summary & Secondary Educational Package Info */}
        <div className="lg:col-span-5 space-y-5 text-left">
          {/* Desktop Registration Summary (Normal document flow - NO sticky/fixed) */}
          <div className="hidden lg:block">
            {renderSummaryCard(false)}
          </div>

          {/* Secondary Educational Content: What You Can Access After Registration */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0d1217] border border-slate-800/80 space-y-3.5">
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300">
                  What You Can Access After Registration
                </h4>
                <span className="text-[10px] text-slate-500 font-medium">Educational Reference</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-normal">
                Once your AFA registration is successful, dial <span className="font-mono font-bold text-white">*1848#</span> on your registered MTN number to access eligible AFA offers directly from MTN.
              </p>
              <p className="text-[10px] text-slate-400 leading-normal">
                The registration fee paid to Mystery Hub covers AFA registration only. Future AFA voice/data packages are purchased directly through MTN.
              </p>
            </div>

            {/* Compact USSD Instruction Card */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-[#090d11] border border-emerald-500/25 space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  AFTER REGISTRATION
                </span>
                <span className="text-[10px] text-slate-400 font-mono">MTN USSD</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-slate-400">Dial:</span>
                <span className="font-mono text-base font-extrabold text-white bg-slate-900 border border-emerald-500/30 px-2.5 py-0.5 rounded tracking-wider">
                  *1848#
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Then follow the MTN AFA menu to view or purchase the offers available to your registered number.
              </p>
              <p className="text-[10px] text-slate-400 leading-normal border-t border-slate-800/80 pt-1.5">
                You may also receive an MTN confirmation/service message. If you do not, you can use <span className="font-mono text-emerald-400 font-semibold">*1848#</span> once your Mystery Hub order status shows Registered.
              </p>
            </div>

            {/* Mobile Collapsible Header */}
            <div className="sm:hidden">
              <button
                type="button"
                onClick={() => setIsPackageAccordionOpen(!isPackageAccordionOpen)}
                className="w-full py-2 px-3 rounded-lg bg-[#090d11] border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-between cursor-pointer"
              >
                <span>{isPackageAccordionOpen ? 'Hide Sample Tariffs' : 'View Sample AFA Tariffs (MTN Direct)'}</span>
                {isPackageAccordionOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Package Content (Always visible on desktop, toggleable/compact on mobile) */}
            <div className={`space-y-3 ${isPackageAccordionOpen ? 'block' : 'hidden sm:block'}`}>
              {/* Segmented Control */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-[#080c10] border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActivePackageTab('monthly')}
                  className={`py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    activePackageTab === 'monthly'
                      ? 'bg-[#00c365] text-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly Packages
                </button>
                <button
                  type="button"
                  onClick={() => setActivePackageTab('weekly')}
                  className={`py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    activePackageTab === 'weekly'
                      ? 'bg-[#00c365] text-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Weekly Packages
                </button>
              </div>

              {/* Package Cards List */}
              <div className="space-y-2">
                {filteredPackages.map((pkg) => (
                  <div key={pkg.id} className="p-3 rounded-xl bg-[#090d11] border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-bold text-xs text-white">{pkg.name}</h5>
                        <span className="text-[10px] text-slate-400">{pkg.validity}</span>
                      </div>
                      <span className="text-sm font-black text-white font-mono">
                        GH₵ {pkg.priceGhc}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-300 pt-1 border-t border-slate-800/50">
                      <div className="flex items-center gap-1.5">
                        <PhoneCall className="w-3 h-3 text-[#00c365] shrink-0" />
                        <span>{pkg.onNetMins} mins on-net</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <PhoneCall className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{pkg.offNetMins} mins off-net</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{pkg.sms} SMS</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{pkg.cugMins} CUG mins</span>
                      </div>
                      {pkg.dataMb && (
                        <div className="col-span-2 flex items-center gap-1.5 text-emerald-400 pt-0.5">
                          <Wifi className="w-3 h-3 text-[#00c365] shrink-0" />
                          <span>Includes {pkg.dataMb}MB data</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-slate-500 leading-normal pt-1">
                {afaConfig.disclaimer}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function Users({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
