import { WalletPaymentChoice } from '../finance/WalletPaymentChoice';
import { walletCheckout } from '../../services/financeApi';
import { getStoredReferralCode,getOrGenerateVisitorKey } from '../../utils/referralCapture';
import React, { useState, useEffect, useId } from 'react';
import { useApp } from '../../context/AppContext';
import {
  AFA_CONFIG,
  AFA_PACKAGES,
} from '../../config/afa';
import { getAfaConfig, initializeAfaPayment, type AfaConfig } from '../../services/afaApi';
import { verifyPaymentOnServer } from '../../services/apiClient';
import { GHANA_REGIONS, validateAfaPayload, afaStatusLabel, normalizeGhanaCard } from '../../../shared/afa';
import { validateAndNormalizeGhanaPhone } from '../../../server/utils/phone';
import type { SafePublicOrderDetails } from '../../../server/types/orders';
import { formatGhanaPhone } from '../../utils/checkoutRecovery';
import { formatGhanaCardInput, afaJourney } from '../../utils/afaForm';
import { afaHighlights, afaPackagePrices, afaPackageCell } from '../../utils/afaPresentation';
import { smoothScrollToElement } from '../../utils/scroll';
import { Money } from '../purchase/Money';
import { useTapFeedback } from '../../hooks/useTapFeedback';
import {
  Check,
  ArrowRight,
  AlertCircle,
  Lock,
  Copy,
  RefreshCw,
  Info,
  Users,
  Phone,
  PhoneOutgoing,
  Wifi,
  ChevronDown,
} from 'lucide-react';

const HIGHLIGHT_ICONS = { cug: Users, onNet: Phone, offNet: PhoneOutgoing, data: Wifi } as const;
const highlights = afaHighlights(AFA_PACKAGES);
const prices = afaPackagePrices(AFA_PACKAGES);

interface AfaFormData {
  fullName: string;
  mtnNumber: string;
  ghanaCardNumber: string;
  dateOfBirth: string;
  region: string;
  town: string;
  occupation: string;
  consent: boolean;
  customerEmail: string;
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
  customerEmail: '',
};

const inputClass = (invalid?: boolean) =>
  `w-full min-h-12 px-3.5 rounded-xl bg-[#090d11] border text-base text-white placeholder-slate-600 transition-colors focus:outline-none ${
    invalid ? 'border-rose-500/80 focus:border-rose-400' : 'border-slate-700 focus:border-[#00c365]'}`;

/** Label, input and one line underneath that is either the hint or the error. */
function Field({ id, label, optional, hint, error, children }: {
  id: string; label: string; optional?: boolean; hint?: React.ReactNode; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-200">
        {label}{optional && <span className="font-normal text-slate-400"> (optional)</span>}
      </label>
      {children}
      {error ? <p id={`${id}-note`} className="text-sm text-rose-300 flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</p>
        : hint ? <p id={`${id}-note`} className="text-xs text-slate-400 leading-relaxed">{hint}</p> : null}
    </div>
  );
}

function Section({ step, title, intro, children }: { step: number; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl bg-[#0e141a] border border-slate-800 p-4 sm:p-6 space-y-4">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3" aria-hidden="true">
        <span className="w-7 h-7 rounded-full bg-[#00c365]/15 text-[#44df95] text-sm font-bold flex items-center justify-center shrink-0">{step}</span>
        <div>
          <p className="font-bold text-base text-white leading-7">{title}</p>
          {intro && <p className="text-sm text-slate-400 leading-relaxed">{intro}</p>}
        </div>
      </div>
      {children}
    </fieldset>
  );
}

export const AfaRegistrationPage: React.FC = () => {
  const { setActivePage, showToast, user, sessionToken, openAuth, openAccount } = useApp();
  const [config, setConfig] = useState<AfaConfig | null>(null);
  const afaConfig = { ...AFA_CONFIG, ...config };
  const [isPriceLoading, setIsPriceLoading] = useState(true);
  const [formData, setFormData] = useState<AfaFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof AfaFormData, string>>>({});
  const [activePackageTab, setActivePackageTab] = useState<'monthly' | 'weekly'>('monthly');
  // Phones keep the comparison folded so the form stays close; from lg it sits open beside the form.
  const [packagesOpen, setPackagesOpen] = useState(false);
  const packagesRef = React.useRef<HTMLElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<SafePublicOrderDetails | null>(null);
  const [copied, setCopied] = useState(false);
  const [tapped, confirmTap] = useTapFeedback();
  // Focus moves to the first error only after a submit, never while the customer is typing.
  const isSubmitAttempt = React.useRef(false);
  const fullNameId = useId(), mtnNumberId = useId(), ghanaCardId = useId(), dobId = useId();
  const regionId = useId(), townId = useId(), occupationId = useId(), consentId = useId(), emailId = useId();
  const fieldIds = { fullName: fullNameId, mtnNumber: mtnNumberId, ghanaCardNumber: ghanaCardId,
    dateOfBirth: dobId, region: regionId, town: townId, occupation: occupationId, consent: consentId, customerEmail: emailId };
  const canonicalFields: Record<string, keyof AfaFormData> = {name:'fullName', phone:'mtnNumber', idNumber:'ghanaCardNumber', location:'town',
    dateOfBirth:'dateOfBirth', region:'region', occupation:'occupation', consent:'consent', customerEmail:'customerEmail'};
  useEffect(() => {
    let active = true;
    getAfaConfig().then(value => { if (active) setConfig(value); })
      .catch(() => { if (active) setSubmitError('AFA registration is temporarily unavailable.'); })
      .finally(() => { if (active) setIsPriceLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    // Identity stays in form memory and is cleared on account change, including logout.
    setFormData({ ...initialFormData, fullName:user?.name || '', mtnNumber:user?.phone ? formatGhanaPhone(user.phone) : '', customerEmail:user?.email || '' });
    setFormErrors({});
  }, [user?.id]);
  useEffect(() => {
    const first = Object.keys(formErrors).find(key => formErrors[key as keyof AfaFormData]) as keyof AfaFormData | undefined;
    if (first && isSubmitAttempt.current) document.getElementById(fieldIds[first])?.focus();
    isSubmitAttempt.current = false;
  }, [formErrors]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (!reference) return;
    let active = true;
    setIsSubmitting(true);
    setIsVerifying(true);
    verifyPaymentOnServer(reference).then(result => {
      if (!active) return;
      if (result.order?.service_type === 'afa') setConfirmedOrder(result.order);
      else setSubmitError('Payment has not been confirmed. Check My Orders before trying again.');
    }).catch(() => { if (active) setSubmitError('Payment confirmation is pending. Check My Orders before trying again.'); })
      .finally(() => { if (active) { setIsSubmitting(false); setIsVerifying(false); } });
    return () => { active = false; };
  }, []);
  const priceAvailable = config?.available === true && config.retailPriceGhc !== null && config.retailPriceGhc > 0;
  const update = <K extends keyof AfaFormData>(field: K, value: AfaFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };
  const handleGhanaCardChange = (e: React.ChangeEvent<HTMLInputElement>) => update('ghanaCardNumber', formatGhanaCardInput(e.target.value));
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => update('mtnNumber', formatGhanaPhone(e.target.value.replace(/[^\d\s+]/g, '')));
  // Field-level feedback on leaving a field, using the same shared rules the submit uses.
  const checkOnBlur = (field: keyof AfaFormData) => {
    const value = String(formData[field] || '').trim();
    if (!value) return;
    let message: string | undefined;
    if (field === 'ghanaCardNumber') {
      try { normalizeGhanaCard(value); } catch (err) { message = (err as Error).message; }
    } else if (field === 'mtnNumber') {
      if (!validateAndNormalizeGhanaPhone(value).isValid) message = 'Enter a valid Ghana mobile number.';
    } else if (field === 'customerEmail') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = 'Enter a valid receipt email.';
    }
    if (message) setFormErrors(prev => ({ ...prev, [field]: message }));
  };
  const [paymentMethod,setPaymentMethod]=React.useState<'paystack'|'wallet'>('paystack');
  const requestKey=React.useRef<string>('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitError(null); setFormErrors({});
    if (!user || !sessionToken) { openAuth('login', 'Sign in to register your MTN number for AFA.', () => document.getElementById(fullNameId)?.focus()); return; }
    if (user.mustChangePassword) { openAccount(); return; }
    if (!priceAvailable) { showToast('Registration is currently unavailable.', 'warning'); return; }
    try {
      const payload = validateAfaPayload({ name:formData.fullName, phone:formData.mtnNumber, idNumber:formData.ghanaCardNumber,
        dateOfBirth:formData.dateOfBirth, region:formData.region, location:formData.town, occupation:formData.occupation });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail.trim()) || formData.customerEmail.trim().length > 254)
        throw Object.assign(new Error('Enter a valid receipt email.'), {field:'customerEmail'});
      if (!formData.consent) throw Object.assign(new Error('Please authorize submission of your registration details.'), {field:'consent'});
      setIsSubmitting(true);
      confirmTap();
      if(paymentMethod==='wallet') {
        requestKey.current ||= crypto.randomUUID();
        await walletCheckout(sessionToken,'afa/payments/initialize',{...payload,consent:true,customerEmail:formData.customerEmail,requestId:requestKey.current,referralCode:getStoredReferralCode(),visitorKey:getOrGenerateVisitorKey()});
        window.location.assign('/orders');return;
      }
      const result = await initializeAfaPayment(payload, formData.consent, formData.customerEmail, sessionToken);
      if (!result.authorizationUrl) throw new Error('Payment link unavailable. Check My Orders before trying again.');
      const url = new URL(result.authorizationUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.paystack.com') throw new Error('Payment link unavailable. Contact support.');
      window.location.assign(url.href);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start AFA registration.';
      const field = canonicalFields[(err as {field?:string}).field || ''];
      isSubmitAttempt.current = true;
      if (field) setFormErrors({ [field]:message });
      else setSubmitError(/failed to fetch|network|load failed/i.test(message)
        ? 'We couldn’t reach Mystery Hub, so no payment was started. Check your connection and try again.' : message);
      setIsSubmitting(false);
    }
  };

  const goToForm = () => {
    smoothScrollToElement(formRef.current, { block: 'start' });
    // Focus without a second jump; the scroll above already brought the form into view.
    document.getElementById(fullNameId)?.focus({ preventScroll: true });
  };
  // Guests sign in before typing anything: the form is cleared whenever the account changes, so details typed as a
  // guest would be lost at the sign-in that payment needs.
  const startRegistration = () => {
    if (!user) { openAuth('login', 'Sign in to register your MTN line for AFA.', goToForm); return; }
    goToForm();
  };
  const showPackages = () => {
    setPackagesOpen(true);
    requestAnimationFrame(() => smoothScrollToElement(packagesRef.current, { block: 'start' }));
  };

  const filteredPackages = AFA_PACKAGES.filter((p) => p.period === activePackageTab);
  const fee = priceAvailable ? afaConfig.retailPriceGhc! : null;
  const feeText = fee !== null ? `GH₵${fee.toFixed(2)}` : '';

  // Authoritative order confirmation, from the server's verification of the returning payment.
  if (confirmedOrder) {
    const journey = afaJourney(confirmedOrder.status, confirmedOrder.manual_review);
    const label = afaStatusLabel(confirmedOrder.status, confirmedOrder.manual_review);
    const steps = ['Payment confirmed', 'Submitted for registration', 'Registered'];
    const copyReference = () => {
      navigator.clipboard?.writeText(confirmedOrder.public_reference).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
    };
    return (
      <div className="py-6 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto text-slate-100">
        <div className="rounded-3xl bg-[#0e141a] border border-slate-800 p-5 sm:p-8 space-y-6">
          <div className="space-y-2 text-center">
            <span className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center border ${journey.stopped
              ? 'bg-amber-400/10 border-amber-400/30 text-amber-300' : journey.registered
              ? 'bg-[#00c365]/15 border-[#00c365]/40 text-[#44df95]' : 'bg-sky-400/10 border-sky-400/30 text-sky-300'}`}>
              {journey.stopped ? <AlertCircle className="w-7 h-7" /> : journey.registered ? <Check className="w-7 h-7 stroke-[2.5]" /> : <RefreshCw className="w-6 h-6" />}
            </span>
            <p className={`text-xs font-bold uppercase tracking-wider ${journey.stopped ? 'text-amber-300' : 'text-[#44df95]'}`}>{label}</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {confirmedOrder.status === 'delivered' ? 'Registered' : journey.stopped ? 'Your registration needs attention' : 'Payment received'}
            </h1>
            <p className="text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
              {confirmedOrder.status === 'delivered' ? 'Your AFA registration is confirmed.' : journey.stopped
                ? 'Our team will follow this order up. Keep your reference if you contact support.'
                : 'Payment and registration are separate stages. Follow this order for updates.'}
            </p>
          </div>

          <ol className="space-y-0" aria-label="Registration progress">
            {steps.map((step, index) => {
              const done = journey.reached > index;
              const stoppedHere = journey.stopped && journey.reached === index + 1 && !journey.registered;
              return (
                <li key={step} className="flex gap-3">
                  <span className="flex flex-col items-center">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs font-bold ${stoppedHere
                      ? 'border-amber-400 bg-amber-400/15 text-amber-300' : done ? 'border-[#00c365] bg-[#00c365] text-[#03160c]' : 'border-slate-600 text-slate-500'}`}>
                      {stoppedHere ? '!' : done ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : index + 1}
                    </span>
                    {index < steps.length - 1 && <span className={`w-px flex-1 min-h-5 ${done ? 'bg-[#00c365]/60' : 'bg-slate-700'}`} />}
                  </span>
                  <span className={`pb-4 text-sm ${done ? 'text-white font-semibold' : 'text-slate-400'}`}>{step}</span>
                </li>
              );
            })}
          </ol>

          <dl className="rounded-2xl bg-[#090d11] border border-slate-800 p-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Reference</dt>
              <dd className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono font-semibold text-white break-all">{confirmedOrder.public_reference}</span>
                <button type="button" onClick={copyReference} aria-label="Copy reference" className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white cursor-pointer">
                  {copied ? <Check className="w-4 h-4 text-[#44df95]" /> : <Copy className="w-4 h-4" />}
                </button>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-400">MTN line</dt><dd className="font-mono font-semibold text-white">{confirmedOrder.recipient_phone}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-400">Registration fee paid</dt><dd><Money ghc={confirmedOrder.amount_ghc} size="sm" className="text-white" /></dd></div>
          </dl>

          <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
            <p className="text-slate-400">The registration fee paid to Mystery Hub covers AFA registration only. Future AFA voice/data packages are purchased directly through MTN.</p>
            {confirmedOrder.status === 'delivered' && <p className="rounded-xl border border-[#00c365]/30 bg-[#00c365]/[0.07] p-3 text-slate-200">Dial <span className="font-mono font-bold text-[#44df95]">*1848#</span> on your registered MTN number for AFA access.</p>}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button type="button" onClick={() => setActivePage('orders')} className="mh-buy flex-1 min-h-12 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e070] text-[#03160c] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer">
              Track in Orders<ArrowRight className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => { setConfirmedOrder(null); setFormData(initialFormData); }}
              className="min-h-12 px-4 rounded-xl bg-[#1a232b] hover:bg-[#222d36] text-slate-200 font-semibold text-sm border border-slate-700 cursor-pointer">
              Register another number
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="py-16 px-4 max-w-md mx-auto text-center space-y-3" role="status" aria-live="polite">
        <span className="mx-auto w-12 h-12 rounded-full border-2 border-[#00c365] border-t-transparent animate-spin motion-reduce:animate-none block" aria-hidden="true" />
        <h1 className="text-xl font-bold text-white">Checking your payment</h1>
        <p className="text-sm text-slate-400">We are confirming the payment with Paystack. Please keep this page open.</p>
      </div>
    );
  }

  const feeBlock = (
    isPriceLoading ? (
      <span className="inline-flex items-center gap-2 text-sm text-slate-400" role="status">
        <span className="w-4 h-4 border-2 border-[#00c365] border-t-transparent rounded-full animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Checking the fee…
      </span>
    ) : fee !== null ? <Money ghc={fee} size="xl" className="text-white" />
      : <span className="inline-flex text-sm font-semibold text-amber-200 bg-amber-400/10 border border-amber-400/30 px-3 py-1.5 rounded-lg">Registration is currently unavailable</span>
  );

  const summary = (
    <section aria-label="Registration summary" className="rounded-2xl bg-[#0e141a] border border-slate-800 p-4 sm:p-5 space-y-3">
      <dl className="space-y-2.5 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-slate-400">Service</dt><dd className="font-semibold text-white">AFA registration</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-400">MTN line</dt>
          <dd className="font-semibold text-white tabular-nums">{formData.mtnNumber || <span className="font-normal text-slate-400">Not entered yet</span>}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-400">Pay with</dt><dd className="text-slate-200">{paymentMethod==='wallet'?'Mystery Wallet':'Mobile Money or card (Paystack)'}</dd></div>
        <div className="flex items-end justify-between gap-3 border-t border-slate-800 pt-3">
          <dt><span className="block font-semibold text-white">One-time fee</span><span className="block text-xs text-slate-400">Charged once by Mystery Hub</span></dt>
          <dd>{fee !== null ? <Money ghc={fee} size="lg" className="text-[#44df95]" /> : <span className="text-sm text-amber-200">{isPriceLoading ? 'Checking…' : 'Unavailable'}</span>}</dd>
        </div>
      </dl>
    </section>
  );

  // Says where the next tap goes: sign-in, the Wallet debit, or Paystack's page. Registration itself follows payment.
  const submitLabel = !user ? 'Sign in to continue' : paymentMethod === 'wallet' ? `Pay ${feeText} from Mystery Wallet` : `Continue to Paystack · ${feeText}`;

  return (
    <div className="py-5 sm:py-10 pb-24 sm:pb-12 text-slate-100 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
      {/* Hero: why people register first (benefits of MTN's AFA packages), then the one-time fee and how to start.
          Phones see what AFA is, what it offers, what registration costs and the start button on the first screen. */}
      <section aria-labelledby="afa-title" className="rounded-3xl border border-slate-800 bg-[#0a0f14] p-4 sm:p-7 lg:p-8">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.35fr_1fr] lg:gap-8 lg:items-stretch">
          <div className="space-y-3 sm:space-y-4 min-w-0">
            <div className="space-y-1.5 sm:space-y-2">
              <p className="text-xs font-semibold text-[#44df95]">MTN AFA registration</p>
              <h1 id="afa-title" className="text-[1.6rem] leading-[1.12] sm:text-4xl font-extrabold text-white tracking-tight">More ways to stay connected</h1>
              <p className="text-[15px] sm:text-base text-slate-300 leading-relaxed max-w-xl">{afaConfig.tagline}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400"><span className="sm:hidden">Up to, on a monthly AFA package from MTN</span><span className="hidden sm:inline">What a monthly AFA package from MTN can include</span></p>
              {/* Phones: one compact strip of four figures. From sm: tiles with an icon and a line of detail each. */}
              <ul className="grid grid-cols-4 sm:grid-cols-2 lg:grid-cols-4 rounded-2xl border border-slate-800 bg-[#0e141a] divide-x divide-slate-800 sm:divide-x-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:gap-2" aria-label="AFA package highlights">
                {highlights.map(item => {
                  const Icon = HIGHLIGHT_ICONS[item.key];
                  return (
                    <li key={item.key} className="min-w-0 px-1 py-2.5 text-center sm:text-left sm:rounded-2xl sm:border sm:border-slate-800 sm:bg-[#0e141a] sm:p-3.5">
                      <span className="flex items-center justify-center sm:justify-start gap-1.5">
                        <Icon aria-hidden="true" className="hidden sm:block w-4 h-4 text-[#44df95] shrink-0" />
                        <span className="text-base min-[360px]:text-lg sm:text-2xl font-extrabold text-white tabular-nums leading-none whitespace-nowrap">{item.key !== 'data' && <span className="hidden sm:inline text-xs font-semibold text-slate-400 mr-1">Up to</span>}{item.value}</span>
                      </span>
                      <span className="block mt-1 sm:mt-1.5 text-[11px] sm:text-[13px] font-semibold text-slate-300 sm:text-slate-200 leading-tight"><span className="sm:hidden">{item.short}</span><span className="hidden sm:inline">{item.label}</span></span>
                      <span className="hidden sm:block mt-0.5 text-xs text-slate-400 leading-snug">{item.detail}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="sm:hidden">CUG minutes are for calls within your AFA group. </span>
                <span className="hidden sm:inline">Bought separately from MTN after you register{prices.monthly !== null && <>: monthly packages from <span className="text-slate-200 font-semibold tabular-nums">GH₵{prices.monthly}</span></>}
                {prices.weekly !== null && <>, weekly from <span className="text-slate-200 font-semibold tabular-nums">GH₵{prices.weekly}</span></>}.</span>{' '}
                <button type="button" onClick={showPackages} className="text-[#44df95] font-semibold underline underline-offset-2 cursor-pointer mh-compact-control">Compare packages</button>
              </p>
            </div>
          </div>

          {/* The fee, what it covers, and the start button. */}
          <div className="rounded-2xl border border-[#00c365]/25 bg-[#0e141a] p-3.5 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 lg:block">
              <div className="lg:mb-2">
                <p className="text-sm font-semibold text-white"><span className="sm:hidden">Registration fee</span><span className="hidden sm:inline">One-time registration fee</span></p>
                <p className="text-xs text-slate-400"><span className="sm:hidden">One-time, paid to Mystery Hub</span><span className="hidden sm:inline">Paid once to Mystery Hub</span></p>
              </div>
              {feeBlock}
            </div>
            <p className="sm:hidden -mt-1 text-xs text-slate-400 leading-relaxed">Packages are not included: you buy them from MTN{prices.monthly !== null && <>, from <span className="text-slate-200 font-semibold tabular-nums">GH₵{prices.monthly}</span> a month</>}.</p>
            <ul className="hidden sm:block space-y-1.5 text-xs text-slate-300 leading-relaxed">
              <li className="flex gap-2"><Check aria-hidden="true" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#44df95]" />Covers registering your MTN line for AFA only</li>
              <li className="flex gap-2"><Info aria-hidden="true" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />AFA packages are not included; you buy them from MTN</li>
              <li className="hidden sm:flex gap-2"><Lock aria-hidden="true" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />Your Ghana Card details are encrypted</li>
            </ul>
            {(isPriceLoading || priceAvailable) && (
              <button type="button" onClick={startRegistration}
                className="mh-buy mt-auto w-full min-h-12 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e070] text-[#03160c] font-bold text-base flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {user ? 'Start registration' : 'Sign in to start'}<ArrowRight className="w-4 h-4" />
              </button>
            )}
            <p className="text-[11px] text-slate-400 text-center -mt-1">{user ? 'You check your details and the fee before paying.' : 'Sign in first, so your details stay with your account.'}</p>
          </div>
        </div>

        <ol className="mt-4 sm:mt-6 grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2 sm:gap-3" aria-label="How AFA registration works">
          {afaConfig.howItWorks.map((step) => (
            <li key={step.step} className="flex gap-2 sm:rounded-xl sm:border sm:border-slate-800/80 sm:bg-[#0e141a]/80 sm:p-3">
              <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00c365]/15 text-[11px] font-bold text-[#44df95]">{step.step}</span>
              <span className="min-w-0">
                <span className="block text-xs sm:text-sm font-semibold text-white leading-5">{step.title}</span>
                <span className="hidden sm:block text-xs text-slate-400 leading-relaxed mt-0.5">{step.desc}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form ref={formRef} aria-label="AFA registration" noValidate onSubmit={handleSubmit} className="lg:col-span-7 space-y-4 text-left scroll-mt-24">
          {!user && (
            <div className="rounded-2xl border border-slate-700 bg-[#0e141a] p-3.5 flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-slate-300 min-w-0 flex-1 basis-56">Registration needs a Mystery Hub account. Sign in first so nothing you type is lost.</p>
              <button type="button" onClick={startRegistration} className="mh-button-secondary">Sign in</button>
            </div>
          )}
          {submitError && (
            <div role="alert" className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-300" />
              <div>
                <p className="font-semibold text-white">We couldn’t start your registration</p>
                <p className="mt-0.5">{submitError}</p>
              </div>
            </div>
          )}

          <Section step={1} title="Your MTN line" intro="The line that will be registered, and your name as it appears on your Ghana Card.">
            <Field id={fullNameId} label="Full legal name" hint="Exactly as shown on your Ghana Card." error={formErrors.fullName}>
              <input id={fullNameId} maxLength={128} autoComplete="name" autoCapitalize="words" aria-invalid={Boolean(formErrors.fullName)}
                aria-describedby={`${fullNameId}-note`} type="text" required value={formData.fullName}
                onChange={(e) => update('fullName', e.target.value)} placeholder="e.g. Kwame Mensah" className={inputClass(Boolean(formErrors.fullName))} />
            </Field>
            <Field id={mtnNumberId} label="MTN number to register" hint="An MTN line. Number portability means the prefix alone cannot confirm the network." error={formErrors.mtnNumber}>
              <input id={mtnNumberId} aria-invalid={Boolean(formErrors.mtnNumber)} aria-describedby={`${mtnNumberId}-note`}
                type="tel" inputMode="tel" autoComplete="tel-national" required maxLength={32} value={formData.mtnNumber}
                onChange={handlePhoneChange} onBlur={() => checkOnBlur('mtnNumber')} placeholder="024 123 4567"
                className={`${inputClass(Boolean(formErrors.mtnNumber))} tabular-nums tracking-wide`} />
            </Field>
          </Section>

          <Section step={2} title="Ghana Card" intro="Needed to submit the registration. Encrypted and used only to process your AFA registration.">
            <Field id={ghanaCardId} label="Ghana Card number" hint="Type the digits; we add GHA and the dashes." error={formErrors.ghanaCardNumber}>
              <input id={ghanaCardId} autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={32}
                aria-invalid={Boolean(formErrors.ghanaCardNumber)} aria-describedby={`${ghanaCardId}-note`}
                type="text" inputMode="text" required value={formData.ghanaCardNumber}
                onChange={handleGhanaCardChange} onBlur={() => checkOnBlur('ghanaCardNumber')} placeholder="GHA-123456789-0"
                className={`${inputClass(Boolean(formErrors.ghanaCardNumber))} font-mono uppercase tracking-wide`} />
            </Field>
            <Field id={dobId} label="Date of birth" hint="Must match your Ghana Card." error={formErrors.dateOfBirth}>
              <input id={dobId} autoComplete="off" max={new Date().toISOString().slice(0,10)} aria-invalid={Boolean(formErrors.dateOfBirth)}
                aria-describedby={`${dobId}-note`} type="date" required value={formData.dateOfBirth}
                onChange={(e) => update('dateOfBirth', e.target.value)} className={`${inputClass(Boolean(formErrors.dateOfBirth))} [color-scheme:dark]`} />
            </Field>
          </Section>

          <Section step={3} title="Where you live">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id={regionId} label="Region" error={formErrors.region}>
                <select id={regionId} value={formData.region} aria-invalid={Boolean(formErrors.region)} onChange={(e) => update('region', e.target.value)}
                  className={`${inputClass(Boolean(formErrors.region))} cursor-pointer`}>
                  {GHANA_REGIONS.map((region) => <option key={region} value={region} className="bg-[#090d11] text-white">{region}</option>)}
                </select>
              </Field>
              <Field id={townId} label="Town or area" error={formErrors.town}>
                <input id={townId} maxLength={128} autoComplete="address-level2" aria-invalid={Boolean(formErrors.town)} type="text" required
                  value={formData.town} onChange={(e) => update('town', e.target.value)} placeholder="e.g. Madina" className={inputClass(Boolean(formErrors.town))} />
              </Field>
              <div className="sm:col-span-2">
                <Field id={occupationId} label="Occupation" optional error={formErrors.occupation}>
                  <input id={occupationId} maxLength={128} aria-invalid={Boolean(formErrors.occupation)} type="text" value={formData.occupation}
                    onChange={(e) => update('occupation', e.target.value)} placeholder="e.g. Trader, Teacher, Student" className={inputClass(Boolean(formErrors.occupation))} />
                </Field>
              </div>
            </div>
          </Section>

          <Section step={4} title="Receipt and payment">
            <Field id={emailId} label="Receipt email" hint="We send the order reference and updates here." error={formErrors.customerEmail}>
              <input id={emailId} type="email" inputMode="email" required maxLength={254} autoComplete="email" value={formData.customerEmail}
                aria-invalid={Boolean(formErrors.customerEmail)} aria-describedby={`${emailId}-note`}
                onChange={e => update('customerEmail', e.target.value)} onBlur={() => checkOnBlur('customerEmail')} placeholder="you@example.com"
                className={inputClass(Boolean(formErrors.customerEmail))} />
            </Field>
            <WalletPaymentChoice amountMinor={config?.retailPriceMinor || 0} value={paymentMethod} onChange={setPaymentMethod}/>
            <div className="rounded-xl bg-[#090d11] border border-slate-800 p-3.5 text-xs text-slate-400 leading-relaxed space-y-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-white"><Lock className="w-4 h-4 text-[#44df95]" />How your details are protected</p>
              <p>Your registration details are encrypted and shared with our registration provider. Sensitive identity details are deleted after confirmed completion or safe closure. Unresolved cases remain encrypted while we resolve them. Never provide a PIN, password, card photo or selfie.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={consentId} className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none ${formErrors.consent ? 'border-rose-500/70 bg-rose-500/5' : 'border-slate-700 bg-[#090d11]'}`}>
                <input id={consentId} type="checkbox" checked={formData.consent} aria-invalid={Boolean(formErrors.consent)}
                  onChange={(e) => update('consent', e.target.checked)}
                  className="mt-0.5 w-5 h-5 shrink-0 rounded border-slate-600 bg-black/60 accent-[#00c365] cursor-pointer" />
                <span className="text-sm text-slate-200 leading-relaxed">
                  I confirm these details match my Ghana Card and authorize Mystery Hub to submit this AFA registration on my MTN line.
                </span>
              </label>
              {formErrors.consent && <p className="text-sm text-rose-300 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{formErrors.consent}</p>}
            </div>
          </Section>

          <div className="lg:hidden">{summary}</div>

          <div className="space-y-2.5">
            <button type="submit" data-tapped={tapped} disabled={isSubmitting || isPriceLoading || !priceAvailable} aria-busy={isSubmitting}
              className="mh-buy w-full min-h-14 px-5 rounded-xl font-bold text-base flex items-center justify-center gap-2 cursor-pointer bg-[#00c365] hover:bg-[#00e070] text-[#03160c] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              {isSubmitting ? (
                <><span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none" aria-hidden="true" />{paymentMethod === 'wallet' ? 'Confirming wallet payment…' : 'Opening secure payment…'}</>
              ) : isPriceLoading ? 'Checking the fee…'
                : !priceAvailable ? 'Registration currently unavailable'
                : <>{submitLabel}<ArrowRight className="w-4 h-4" /></>}
            </button>
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              {paymentMethod === 'wallet' ? 'Paid from your Mystery Wallet balance.' : 'You approve the payment on Paystack. Registration starts only after the payment is confirmed.'}
            </p>
          </div>
        </form>

        <aside className="lg:col-span-5 space-y-5 text-left order-first lg:order-none">
          <div className="hidden lg:block">{summary}</div>

          {/* MTN AFA packages: information only. They are bought from MTN, not from Mystery Hub. */}
          <section ref={packagesRef} id="afa-packages" aria-labelledby="afa-packages-title" className="scroll-mt-24 rounded-2xl border border-slate-800 bg-[#0b1015] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="afa-packages-title" className="text-base font-bold text-white">MTN AFA packages, after you register</h2>
              <span className="hidden lg:inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                <Info className="w-3 h-3" />Bought on MTN, not here
              </span>
            </div>
            <button type="button" aria-expanded={packagesOpen} aria-controls="afa-packages-body" onClick={() => setPackagesOpen(open => !open)}
              className="lg:hidden mt-2 w-full min-h-11 -mb-1 flex items-center justify-between gap-3 text-left text-sm text-slate-300 cursor-pointer">
              <span>Compare weekly and monthly packages. <span className="text-slate-400">Bought on MTN, not here.</span></span>
              <ChevronDown aria-hidden="true" className={`w-4 h-4 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${packagesOpen ? 'rotate-180' : ''}`} />
            </button>
            <div id="afa-packages-body" className={`${packagesOpen ? 'block' : 'hidden'} lg:block mt-4 space-y-4`}>
              <p className="text-sm text-slate-400 leading-relaxed">Examples of what registered lines can buy from MTN. Your order shows how to reach the MTN AFA menu once it is Registered.</p>
              <div role="group" aria-label="Package period" className="grid grid-cols-2 p-1 rounded-xl bg-[#080c10] border border-slate-800">
                {(['monthly', 'weekly'] as const).map(period => (
                  <button key={period} type="button" aria-pressed={activePackageTab === period} onClick={() => setActivePackageTab(period)}
                    className={`min-h-10 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${activePackageTab === period ? 'bg-slate-200 text-[#0b1015]' : 'text-slate-400 hover:text-white'}`}>
                    {period === 'monthly' ? 'Monthly' : 'Weekly'}
                  </button>
                ))}
              </div>
              <table className="w-full text-sm border-separate border-spacing-0">
                <caption className="sr-only">{activePackageTab === 'monthly' ? 'Monthly' : 'Weekly'} MTN AFA package examples</caption>
                <thead>
                  <tr>
                    <th scope="col" className="sr-only">Includes</th>
                    {filteredPackages.map(pkg => (
                      <th key={pkg.id} scope="col" className="pb-3 text-left align-bottom font-normal pl-3 first-of-type:pl-0">
                        <span className="block text-xs font-semibold text-slate-400">{pkg.hasData ? 'With data' : 'Calls and SMS'}</span>
                        <span className="block text-2xl font-extrabold text-white tabular-nums leading-tight"><span className="text-sm font-semibold text-slate-400 mr-0.5">GH₵</span>{pkg.priceGhc}</span>
                        <span className="block text-xs text-slate-400">on MTN · {pkg.validity}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {([
                    ['MTN minutes', 'onNetMins'],
                    ['Other-network minutes', 'offNetMins'],
                    ['CUG minutes', 'cugMins'],
                    ['SMS', 'sms'],
                    ['Data', 'dataMb'],
                  ] as const).map(([label, key]) => (
                    <tr key={key}>
                      <th scope="row" className="py-2 pr-2 text-left text-xs font-medium text-slate-400 border-t border-slate-800/80 w-[38%]">{label}</th>
                      {filteredPackages.map(pkg => {
                        const value = afaPackageCell(pkg, key);
                        return (
                          <td key={pkg.id} className="py-2 pl-3 border-t border-slate-800/80 font-semibold tabular-nums text-white">
                            {value ?? <span className="font-normal text-slate-400">None</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 leading-relaxed">CUG minutes are for calls within your AFA group. Where SMS shows Included, MTN's AFA menu shows the current amount.</p>
              <p className="text-xs text-slate-400 leading-relaxed">{afaConfig.disclaimer}</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
