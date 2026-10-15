import {useDialogFocus} from '../../hooks/useDialogFocus';
import {useVisualViewport} from '../../hooks/useVisualViewport';
import {useInstantQuote} from '../../hooks/useInstantQuote';
import {commercialRequest} from '../../services/commercialApi';
import { WalletPaymentChoice } from '../finance/WalletPaymentChoice';
import { dataValidityLabel } from '../../utils/dataPurchasePresentation';
import { walletCheckout } from '../../services/financeApi';
import { getStoredReferralCode, getOrGenerateVisitorKey } from '../../utils/referralCapture';
import {
  formatGhanaPhone,
  ghanaPhoneDigits,
  isCompleteGhanaPhone,
  isConnectivityError,
  savePendingCheckout,
  clearPendingCheckout,
  orderRecordFromLookup,
  readPendingCheckout,
} from '../../utils/checkoutRecovery';
import { dataOrderPresentation } from '../../utils/dataPurchasePresentation';
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { NetworkId } from '../../types';
import { GHANA_NETWORKS, detectGhanaNetwork } from '../../data/bundles';
import { usePaystack } from '../../hooks/usePaystack';
import { BUSINESS_CONFIG } from '../../config/business';
import { checkPendingPayment, lookupOrderOnServer, cancelPaymentOnServer } from '../../services/apiClient';
import { smoothScrollToElement } from '../../utils/scroll';
import { getInstantBundlePresentation } from '../../utils/instantBundleUtils';
import { NetworkBrandBadge } from '../common/NetworkBrandBadge';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Check,
  ArrowRight,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  Info,
  Zap,
  RefreshCw,
  Phone as PhoneIcon,
} from 'lucide-react';

export const CheckoutModal: React.FC = () => {
  const {
    isCheckoutOpen,
    closeCheckout,
    checkoutBundle,
    checkoutInitialPhone,
    createOrder,
    user,
    openOrderStatus,
    openDataPage,
    sessionToken,
  } = useApp();
  const { initializeServerPayment, isInitializing, loadingPhase, resetInitialization } = usePaystack();

  useEffect(()=>{if(!isCheckoutOpen)resetInitialization();},[isCheckoutOpen,resetInitialization]);
  const [phone, setPhone] = useState('');
  const [receiptEmail,setReceiptEmail]=useState('');
  const [editingReceipt,setEditingReceipt]=useState(false);
  const [commercial,setCommercial]=useState<any>(null);
  const [quoteError,setQuoteError]=useState('');
  const [quoteRefresh,setQuoteRefresh]=useState(0);
  const directRequest=useRef(crypto.randomUUID());
  useEffect(()=>{if(!isCheckoutOpen||!checkoutBundle||checkoutBundle.serviceType&&checkoutBundle.serviceType!=='data'||checkoutBundle.id.startsWith('instant-')||checkoutBundle.id.startsWith('airtime-')){setCommercial(null);return;}let active=true;setCommercial(null);setQuoteError('');commercialRequest('commercial/quote/'+encodeURIComponent(checkoutBundle.id),sessionToken).then(r=>{if(active)setCommercial(r);}).catch(e=>{if(active)setQuoteError(e.message);});return()=>{active=false;};},[isCheckoutOpen,checkoutBundle?.id,sessionToken,quoteRefresh,user?.phone]);
  const instantProduct = isCheckoutOpen && (checkoutBundle?.serviceType==='instant_bundle' || checkoutBundle?.id.startsWith('instant-')) ? checkoutBundle.id : undefined;
  const instantAmount = checkoutBundle?.faceValueGhc ?? checkoutBundle?.priceGhc ?? 0;
  const instantPricing = useInstantQuote(instantProduct,instantAmount,quoteRefresh);
  const activeCheckout=useRef({bundle:checkoutBundle,open:isCheckoutOpen,sessionToken,epoch:0});
  const previous=activeCheckout.current;
  if(previous.bundle!==checkoutBundle||previous.open!==isCheckoutOpen||previous.sessionToken!==sessionToken)
    activeCheckout.current={bundle:checkoutBundle,open:isCheckoutOpen,sessionToken,epoch:previous.epoch+1};
  const attemptEpoch=activeCheckout.current.epoch;
  useEffect(()=>()=>{activeCheckout.current.open=false;activeCheckout.current.epoch++;},[]);
  const [uncertainAttempt,setUncertainAttempt]=useState(false);
  const [retryAllowed,setRetryAllowed]=useState(false);
  const submissionPending = useRef(false);
  const [paymentMethod,setPaymentMethod]=useState<'paystack'|'wallet'>('paystack');
  const [walletBusy,setWalletBusy]=useState(false);
  const walletRequest=useRef<{fingerprint:string;id:string}|null>(null);
  const [detectedNet, setDetectedNet] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isSlowPreparation, setIsSlowPreparation] = useState(false);
  // The order reference the server created for this attempt; recovery checks use it, never a guess.
  const [attemptRef, setAttemptRef] = useState<string | null>(null);
  const [paymentClosed, setPaymentClosed] = useState(false);
  const [recovery, setRecovery] = useState<{ checking: boolean; message: string }>({ checking: false, message: '' });
  const [activeMtnConflict, setActiveMtnConflict] = useState<{
    orderRef?: string;
    status?: string;
  } | null>(null);
  const [preflightIssue, setPreflightIssue] = useState<{
    code: string;
    title: string;
    message: string;
    conversionNote?: string;
    supportingNote?: string;
    networkName?: string;
    canViewInstant?: boolean;
  } | null>(null);

  const conflictRef = useRef<HTMLDivElement>(null);
  const preflightRef = useRef<HTMLDivElement>(null);
  const serverErrorRef = useRef<HTMLDivElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isInitializing) {
      setIsSlowPreparation(false);
      return;
    }
    const timer = setTimeout(() => {
      setIsSlowPreparation(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, [isInitializing]);

  useEffect(() => {
    if (isCheckoutOpen && checkoutBundle) {
      setReceiptEmail(user?.email||'');
      setEditingReceipt(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user?.email || ''));
      directRequest.current=crypto.randomUUID();
      setPaymentMethod('paystack');
      walletRequest.current=null;
      const initial = checkoutInitialPhone !== undefined ? checkoutInitialPhone : (user?.phone || '');
      setPhone(formatGhanaPhone(initial));
      setPhoneError('');
      setServerError('');
      setActiveMtnConflict(null);
      setPreflightIssue(null);
      setAttemptRef(null);
      setUncertainAttempt(false);setRetryAllowed(false);
      setPaymentClosed(false);
      setRecovery({ checking: false, message: '' });
    }
  }, [isCheckoutOpen,checkoutBundle, checkoutInitialPhone, user?.phone]);

  useEffect(() => {
    const net = detectGhanaNetwork(phone);
    setDetectedNet(net);
    if (phone.replace(/\D/g, '').length >= 10) {
      setPhoneError('');
    }
  }, [phone]);

  // Smoothly scroll the MTN active conflict into view as soon as it appears
  useEffect(() => {
    if (activeMtnConflict && conflictRef.current) {
      smoothScrollToElement(conflictRef.current, { block: 'center' });
    }
  }, [activeMtnConflict]);

  // Smoothly scroll preflight issue into view
  useEffect(() => {
    if (preflightIssue && preflightRef.current) {
      smoothScrollToElement(preflightRef.current, { block: 'center' });
    }
  }, [preflightIssue]);

  // Smoothly scroll server error message into view
  useEffect(() => {
    if (serverError && serverErrorRef.current) {
      smoothScrollToElement(serverErrorRef.current, { block: 'center' });
    }
  }, [serverError]);

  const dialogRef = useDialogFocus(isCheckoutOpen, () => { if (!isInitializing && !walletBusy) closeCheckout(); });
  const viewport = useVisualViewport(isCheckoutOpen);
  if (!isCheckoutOpen || !checkoutBundle) return null;

  const currentNetwork = GHANA_NETWORKS[checkoutBundle.network];
  const isAirtime = checkoutBundle.serviceType === 'airtime' || checkoutBundle.id.startsWith('airtime-');
  const isInstantBundle =
    checkoutBundle.serviceType === 'instant_bundle' || checkoutBundle.id.startsWith('instant-');
  const instantInfo = isInstantBundle
    ? getInstantBundlePresentation({
        category: checkoutBundle.category,
        name: checkoutBundle.description || checkoutBundle.dataAmount,
        dataAmount: checkoutBundle.dataAmount,
        isFlexi: checkoutBundle.isFlexi,
      })
    : null;
  const isRegularData = !isAirtime && !isInstantBundle;
  const faceValue = checkoutBundle.faceValueGhc ?? checkoutBundle.priceGhc;
  const serviceFee = isInstantBundle ? (instantPricing.quote?.feeMinor ?? 0)/100 : checkoutBundle.serviceFeeGhc ?? 0;
  const totalAmount = isInstantBundle ? (instantPricing.quote?.totalMinor ?? 0)/100
    : isAirtime ? Number((faceValue+serviceFee).toFixed(2))
    : commercial?.totalMinor/100 || checkoutBundle.priceGhc;
  const currentAttempt = () => activeCheckout.current.epoch===attemptEpoch && activeCheckout.current.open && activeCheckout.current.bundle===checkoutBundle && activeCheckout.current.sessionToken===sessionToken;
  const paymentHeld = uncertainAttempt || !!attemptRef && !retryAllowed;

  const productLabel = isInstantBundle && instantInfo
    ? `${instantInfo.formattedAmount} ${instantInfo.categoryLabel}`
    : isAirtime
    ? `GH₵${faceValue.toFixed(2)} Airtime Top-Up`
    : `${checkoutBundle.dataAmount} Data Bundle`;
  const validity = isRegularData ? dataValidityLabel(checkoutBundle.validity) : '';
  const phoneComplete = isCompleteGhanaPhone(phone);
  const networkMismatch = Boolean(phoneComplete && detectedNet && detectedNet !== checkoutBundle.network);
  const busy = walletBusy || isInitializing;
  // Paystack's window is open: the customer approves on their phone or in the window.
  const awaitingPayment = isInitializing && loadingPhase === 'opening';

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const clean = formatGhanaPhone(val.replace(/[^\d\s+]/g, ''));
    setPhone(clean);
    if (activeMtnConflict) setActiveMtnConflict(null);
    if (preflightIssue) setPreflightIssue(null);
    if (phoneError) setPhoneError('');
    if (serverError) setServerError('');
  };

  const handleTrackCurrentOrder = async (orderRef: string) => {
    closeCheckout();
    try {
      const res = await lookupOrderOnServer(orderRef);
      if (res.success && res.order) {
        openOrderStatus(orderRecordFromLookup(res.order));
        return;
      }
    } catch {
      // fallback
    }

    openOrderStatus({
      id: orderRef,
      publicReference: orderRef,
      serverReference: orderRef,
      bundle: {
        id: 'mtn-active',
        network: 'mtn',
        dataAmount: 'MTN Data',
        dataBytesValue: 1024,
        validity: 'Direct Credit',
        validityCategory: 'Monthly',
        priceGhc: 0,
      },
      recipientPhone: phone.trim(),
      network: 'mtn',
      paymentMethod: 'paystack',
      amountGhc: 0,
      status: 'verifying',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const orderToCreate = () => ({
    ...checkoutBundle,
    priceGhc: totalAmount,
    faceValueGhc: faceValue,
    serviceFeeGhc: serviceFee,
    serviceType: isInstantBundle
      ? ('instant_bundle' as const)
      : isAirtime
      ? ('airtime' as const)
      : ('data' as const),
  });

  const submitPayment = () => {
    const rawDigits = phone.replace(/\D/g, '');

    if (rawDigits.length < 10) {
      setPhoneError('Please enter a valid 10-digit Ghana phone number (e.g. 024 123 4567)');
      if (phoneInputRef.current) {
        smoothScrollToElement(phoneInputRef.current, { block: 'center' });
        phoneInputRef.current.focus();
      }
      return;
    }

    setActiveMtnConflict(null);
    setServerError('');
    setPaymentClosed(false);
    setRecovery({ checking: false, message: '' });

    if(isRegularData&&!commercial){setServerError('Refresh the current price before paying.');return;}
    if(isInstantBundle&&(!instantPricing.quote||instantPricing.quote.expiresAt<=Date.now())){setServerError('Refresh the exact price before paying.');return;}
    return initializeServerPayment({
      isActive:currentAttempt,
      instantQuote:isInstantBundle?instantPricing.quote!:undefined,
      commercial:isRegularData?{requestId:directRequest.current,expectedTotalMinor:commercial.totalMinor,expectedRegularMinor:commercial.regularMinor,pricingRevision:commercial.pricingRevision,promotionRevision:commercial.promotionRevision}:undefined,
      productId: checkoutBundle.id,
      recipientPhone: phone.trim(),
      customerEmail: receiptEmail || user?.email || undefined,
      customerName: user?.name || undefined,
      serviceType: isInstantBundle ? 'instant_bundle' : isAirtime ? 'airtime' : 'data',
      network: checkoutBundle.network,
      amount: faceValue,
      onOrderCreated: (orderRef) => {
        // Kept on this device so a customer who leaves for the MoMo prompt can check it later.
        if(currentAttempt()){setAttemptRef(orderRef);setRetryAllowed(false);setPaymentClosed(true);}
        if(currentAttempt()||!readPendingCheckout())savePendingCheckout({ orderRef, label: `${currentNetwork.name} ${productLabel}`, network: checkoutBundle.network, startedAt: new Date().toISOString() });
      },
      onPaymentReceived: (orderRef, reference) => {
        if(!currentAttempt())return;
        clearPendingCheckout(orderRef);
        const newOrder = createOrder(orderToCreate(), phone.trim(), 'paystack', reference, orderRef);
        closeCheckout();
        openOrderStatus(newOrder);
      },
      onCancel: (orderRef) => {
        // No toast: the sheet itself explains what happened and how to check.
        setPaymentClosed(true);
        if (orderRef) {
          cancelPaymentOnServer(orderRef).then(result=>{
            if(!currentAttempt())return;
            setRetryAllowed(result.cancelled);
            if(result.alreadyPaid&&result.order){clearPendingCheckout(orderRef);closeCheckout();openOrderStatus(orderRecordFromLookup(result.order));}
          }).catch(()=>{if(currentAttempt())setRecovery({checking:false,message:'Payment status is uncertain. Keep this reference and check again before paying.'});});
        }
      },
      onError: (err) => {
        if(!currentAttempt())return;
        if(err.code==='INITIALIZATION_UNCERTAIN'||isConnectivityError(err)){setUncertainAttempt(true);setPaymentClosed(true);}
        if(err.code==='INSTANT_QUOTE_CHANGED'){setQuoteRefresh(x=>x+1);setServerError('Price changed. Review the refreshed total, then choose Pay again.');return;}
        if (err.code === 'ACTIVE_MTN_ORDER_EXISTS' || err.code === 'ACTIVE_MTN_ORDER') {
          setActiveMtnConflict({
            orderRef: err.existingOrderReference,
            status: err.existingOrderStatus,
          });
          return;
        }

        const networkName = currentNetwork.name;
        const isMtn = checkoutBundle.network === 'mtn' || detectedNet === 'mtn';

        if (err.code === 'BENEFICIARY_NOT_ELIGIBLE') {
          setPreflightIssue({
            code: 'BENEFICIARY_NOT_ELIGIBLE',
            title: isMtn ? "This MTN number isn't verified yet" : `This ${networkName} number isn't verified yet`,
            message: isMtn
              ? "We've submitted this number for MTN verification.\nNo payment has been taken.\n\nVerification may take some time. You can try again later, use another MTN number, or choose an Instant Bundle instead."
              : `We've submitted this number for verification.\nNo payment has been taken.\n\nVerification may take some time. You can try again later, use another ${networkName} number, or choose an Instant Bundle instead.`,
            conversionNote:
              'Need data right now?\nInstant Bundles do not require this MTN verification step. Check each package’s delivery details and restrictions before paying.',
            supportingNote:
              'Mystery Hub checks eligibility before payment so you are not charged for an order that cannot be processed.',
            networkName,
            canViewInstant: !isInstantBundle,
          });
          return;
        }

        if (err.code === 'SUPPLIER_WALLET_LOW') {
          setPreflightIssue({
            code: 'SUPPLIER_WALLET_LOW',
            title: 'Service temporarily unavailable',
            message:
              "We can't complete this purchase right now.\nNo payment has been taken.\n\nPlease try again shortly or report the issue so our team can check it.",
            supportingNote:
              'Mystery Hub pre-checks telecom channels before payment so you are never charged for an unfulfillable request.',
            networkName,
            canViewInstant: !isInstantBundle,
          });
          return;
        }

        if (
          err.code === 'SERVICE_TEMPORARILY_UNAVAILABLE' ||
          err.code === 'PACKAGE_UNAVAILABLE'
        ) {
          setPreflightIssue({
            code: err.code,
            title:
              err.code === 'PACKAGE_UNAVAILABLE'
                ? 'Package temporarily unavailable'
                : 'Service temporarily unavailable',
            message:
              "We can't complete this purchase right now.\nNo payment has been taken.\n\nPlease try again shortly or choose another package.",
            supportingNote:
              'Mystery Hub pre-checks telecom channels before payment so you are never charged for an unfulfillable request.',
            networkName,
            canViewInstant: !isInstantBundle,
          });
          return;
        }

        if (isConnectivityError(err)) {
          setServerError('Payment setup could not be confirmed. Check your saved order or contact support before trying again; do not pay twice.');
          return;
        }

        setServerError(err.message || 'Payment initiation failed. Please try again.');
      },
    });
  };

  // Customer-initiated check after the payment window closed. Server status decides; nothing is retried.
  const checkPaymentStatus = async () => {
    if (!attemptRef || recovery.checking) return;
    setRecovery({ checking: true, message: '' });
    try {
      const res = await checkPendingPayment(attemptRef);
      if(!currentAttempt())return;
      if(res.success&&res.order&&['cancelled','expired'].includes(res.order.status)&&!res.order.manual_review){setRetryAllowed(true);setUncertainAttempt(false);}
      const view = dataOrderPresentation(res.order?.status, res.order?.manual_review, res.order?.customer_resolution);
      if (res.success && res.order && view.paymentConfirmed) {
        clearPendingCheckout(attemptRef);
        closeCheckout();
        openOrderStatus({ ...orderRecordFromLookup(res.order), recipientPhone: phone.trim(), buyerRecipientVisible: true });
        return;
      }
      setRecovery({ checking: false, message: 'No payment has been confirmed for this order yet. If you approved the prompt, it can take a minute to arrive. Check again before paying a second time.' });
    } catch (error) {
      if(!currentAttempt())return;
      setRecovery({ checking: false, message: (error as {status?:number}).status===404 ? 'This reference could not be found. If you approved a payment, keep your payment proof and contact support before buying again.' : 'We couldn’t reach Mystery Hub to check. Your reference is saved on this device; check again when you are back online.' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionPending.current || isInitializing || walletBusy || paymentHeld) return;
    if (!isCompleteGhanaPhone(phone)) {
      setPhoneError(ghanaPhoneDigits(phone).length ? 'Enter all 10 digits of the Ghana number, like 024 123 4567.' : 'Enter the recipient’s Ghana phone number before paying.');
      phoneInputRef.current?.focus(); return;
    }
    if(isRegularData&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiptEmail.trim())){setServerError('Enter a valid receipt email before paying.');return;}
    if(paymentMethod!=='wallet'){submissionPending.current=true;try{await submitPayment();}finally{submissionPending.current=false;}return;}
    if(walletBusy||!sessionToken)return;
    if(isRegularData&&!commercial){setServerError('Refresh the current price before paying.');return;}
    submissionPending.current=true;setWalletBusy(true);setServerError('');
    try {
      const body={productId:checkoutBundle.id,recipientPhone:phone.trim(),customerEmail:receiptEmail||user?.email,customerName:user?.name,serviceType:isAirtime?'airtime':'data',network:checkoutBundle.network,amount:faceValue,referralCode:getStoredReferralCode(),visitorKey:getOrGenerateVisitorKey()};
      const fingerprint=JSON.stringify(body);if(walletRequest.current?.fingerprint!==fingerprint)walletRequest.current={fingerprint,id:crypto.randomUUID()};
      const result=await walletCheckout(sessionToken,'payments/initialize',{...body,requestId:walletRequest.current!.id,...(isRegularData&&commercial?{expectedTotalMinor:commercial.totalMinor,expectedRegularMinor:commercial.regularMinor,pricingRevision:commercial.pricingRevision,promotionRevision:commercial.promotionRevision}:{})});
      if(!currentAttempt())return;
      const newOrder=createOrder({...checkoutBundle,priceGhc:result.amountPesewas/100},phone.trim(),'wallet',result.reference,result.orderRef);
      closeCheckout();openOrderStatus(newOrder);
    }catch(error){setServerError(isConnectivityError(error as Error)?'We couldn’t reach Mystery Hub to confirm this Wallet payment. Check Track Order before trying again; repeating with the same details reuses this request.':(error as Error).message);}finally{submissionPending.current=false;setWalletBusy(false);}
  };

  const handleViewInstantBundles = () => {
    const failedNet = checkoutBundle?.network || detectedNet || 'mtn';

    // 1. Cleanly close checkout and clear any pending preflight or error state
    setPreflightIssue(null);
    setServerError('');
    setActiveMtnConflict(null);
    closeCheckout();

    // 2. Set intelligent Instant Bundle network filter:
    // If the failed number/network was MTN, prefer MTN Instant Bundles; otherwise All Networks
    const targetNetwork: NetworkId | 'all' = failedNet === 'mtn' ? 'mtn' : 'all';

    // 3. Switch to instant mode & navigate to DataPage
    openDataPage('instant', targetNetwork);

    // 4. Scroll smoothly to Instant Bundles catalogue
    setTimeout(() => {
      const instantSection = document.getElementById('instant-bundles-section');
      if (instantSection) {
        smoothScrollToElement(instantSection, { block: 'start' });
      } else {
        window.scrollTo({ top: 350, behavior: 'smooth' });
      }
    }, 120);
  };

  const detectedName = detectedNet ? GHANA_NETWORKS[detectedNet as keyof typeof GHANA_NETWORKS]?.name || detectedNet.toUpperCase() : '';

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Review your purchase"
      style={{ top: viewport.top, height: viewport.height || undefined }}
      className="mh-sheet-backdrop fixed inset-x-0 top-0 h-dvh z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm"
    >
      <div className="mh-sheet relative w-full max-w-[calc(100vw-1rem)] mx-auto sm:max-w-md bg-[#0f151b] border border-slate-700/70 border-b-0 sm:border-b rounded-t-[1.5rem] sm:rounded-[1.5rem] shadow-2xl overflow-hidden text-slate-100 max-h-[calc(100%-0.75rem)] sm:max-h-[92dvh] flex flex-col">
        {/* Header */}
        <div className="relative flex items-center justify-between gap-3 px-4 sm:px-5 pt-3 pb-2 shrink-0">
          <span aria-hidden="true" className="sm:hidden absolute left-1/2 top-1.5 -translate-x-1/2 h-1 w-10 rounded-full bg-slate-700" />
          <div className="min-w-0 pt-1">
            <h3 className="font-semibold text-base text-white truncate">
              {awaitingPayment ? 'Complete your payment' : paymentClosed&&!busy ? 'Check your payment' : 'Review your purchase'}
            </h3>
          </div>
          <button
            type="button"
            onClick={closeCheckout}
            disabled={walletBusy}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0 disabled:opacity-40"
            aria-label="Close checkout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form id="checkout-form" onSubmit={handleSubmit} noValidate className="overflow-y-auto px-4 sm:px-5 pb-4 space-y-4 flex-1 overscroll-contain">
          {walletBusy&&<p role="status" className="text-sm text-[#00c365]">Placing your order…</p>}
          {/* 1. Bundle / Airtime Summary Card */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <NetworkBrandBadge network={checkoutBundle.network} size="lg" />
              <div className="min-w-0">
                <h4 className="font-bold text-white text-base leading-tight">
                  {isRegularData ? <>{checkoutBundle.dataAmount} Data Bundle</> : productLabel}
                  {isInstantBundle && <Zap aria-hidden="true" className="inline w-3.5 h-3.5 ml-1 text-amber-400 fill-amber-400 align-[-2px]" />}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {currentNetwork.name}
                  {validity ? ` · ${validity}` : isInstantBundle && instantInfo?.restrictionNote ? ` · ${instantInfo.restrictionNote}` : isAirtime ? ' · Airtime credit' : ''}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold text-white tabular-nums">GH₵{faceValue.toFixed(2)}</div>
              {!awaitingPayment && !busy && !paymentClosed && (
                <button type="button" onClick={closeCheckout} className="mh-compact-control text-xs text-[#44df95] hover:text-white min-h-8 px-1 cursor-pointer">Change</button>
              )}
            </div>
          </div>

          {/* Payment window open: tell the customer exactly what to do and what not to do. */}
          {awaitingPayment && (
            <div role="status" className="rounded-2xl border border-[#00c365]/30 bg-[#00c365]/[0.07] p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00c365]/15 text-[#44df95]">
                  <Smartphone className="w-5 h-5" />
                  <span aria-hidden="true" className="absolute inset-0 rounded-full border-2 border-[#00c365]/40 motion-safe:animate-ping" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-white">Finish in the Paystack window</p>
                  <p className="text-sm text-slate-300 leading-relaxed">For Mobile Money, approve the prompt on your phone with your PIN. Keep this page open until payment is confirmed.</p>
                </div>
              </div>
              <ul className="text-xs text-slate-400 space-y-1.5 pl-1">
                <li className="flex gap-2"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />Never share your MoMo PIN with anyone, including support.</li>
                {attemptRef && <li className="flex gap-2"><Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" /><span>Order reference <span className="font-mono text-slate-200 break-all">{attemptRef}</span></span></li>}
              </ul>
            </div>
          )}

          {/* Payment window closed: the customer may still have approved MoMo, so offer a server check. */}
          {paymentClosed && !busy && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4 space-y-3" aria-live="polite">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-white">Check this payment before trying again</p>
                  <p className="text-sm text-slate-300 leading-relaxed">Closing the window does not cancel a MoMo approval. Check the order before paying again. If its status is uncertain, keep your payment proof and contact support.</p>
                  {attemptRef && <p className="text-xs text-slate-400">Reference <span className="font-mono text-slate-200 break-all">{attemptRef}</span></p>}
                </div>
              </div>
              {recovery.message && <p role="status" className="text-xs text-amber-100/90 leading-relaxed border-t border-amber-500/20 pt-2.5">{recovery.message}</p>}
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
                {attemptRef && (
                  <button type="button" onClick={checkPaymentStatus} disabled={recovery.checking} aria-busy={recovery.checking} className="mh-button-secondary w-full text-sm">
                    <RefreshCw className={`w-4 h-4 ${recovery.checking ? 'animate-spin' : ''}`} />
                    {recovery.checking ? 'Checking…' : 'Check payment status'}
                  </button>
                )}
                <button type="button" onClick={() => setPaymentClosed(false)} className="mh-button-secondary w-full text-sm">Edit details</button>
              </div>
            </div>
          )}

          {/* Instant Bundle Safety & Restriction Notice */}
          {!awaitingPayment && isInstantBundle && instantInfo && instantInfo.restrictionNote && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                instantInfo.isMidnight
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : instantInfo.isVideo
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200'
                  : instantInfo.isIdd
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300'
              }`}
            >
              {instantInfo.isMidnight ? (
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              ) : instantInfo.isIdd ? (
                <PhoneIcon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5 text-left">
                <div className="font-bold flex items-center gap-1">
                  {instantInfo.badgeEmoji && <span>{instantInfo.badgeEmoji}</span>}
                  <span>{instantInfo.categoryLabel} Notice</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {instantInfo.isMidnight
                    ? 'Midnight-only data. This bundle is valid exclusively during network midnight hours and is not intended for regular daytime browsing.'
                    : instantInfo.isVideo
                    ? 'Video bundle. Intended for supported video and media streaming usage.'
                    : instantInfo.isIdd
                    ? 'International calls package. Direct voice call minutes to supported overseas destinations.'
                    : instantInfo.restrictionNote}
                </p>
              </div>
            </div>
          )}

          {/* Active MTN Duplicate Order Conflict Banner */}
          {activeMtnConflict && (
            <div
              ref={conflictRef}
              role="alert"
              className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/35 text-left space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-amber-100">
                    An MTN bundle is already being processed for this number.
                  </h4>
                  <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                    Please wait for your current order to be completed before buying another MTN bundle for this number. No payment has been taken for this one.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeMtnConflict.orderRef && (
                  <button
                    type="button"
                    onClick={() => handleTrackCurrentOrder(activeMtnConflict.orderRef!)}
                    className="min-h-11 px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Track current order</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveMtnConflict(null)}
                  className="min-h-11 px-3 rounded-xl text-slate-300 hover:text-white text-sm transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Calm Preflight Issue Callout (Informational, No Payment Taken) */}
          {preflightIssue && (
            <div
              ref={preflightRef}
              role="alert"
              className="p-4 rounded-2xl bg-slate-900/95 border border-slate-700/80 text-left space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-2 min-w-0 flex-1">
                  <h4 className="font-semibold text-sm text-white">
                    {preflightIssue.title}
                  </h4>
                  <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {preflightIssue.message}
                  </div>

                  {preflightIssue.conversionNote && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs space-y-1 mt-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-300">
                        <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                        <span>Need data right now?</span>
                      </div>
                      <p className="text-[11px] text-amber-200/90 leading-relaxed">
                        Instant Bundles do not require this MTN verification step. Check each package’s delivery details and restrictions before paying.
                      </p>
                    </div>
                  )}

                  {preflightIssue.supportingNote && (
                    <p className="text-[11px] text-slate-400 pt-1 leading-relaxed">
                      {preflightIssue.supportingNote}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreflightIssue(null);
                    if (phoneInputRef.current) {
                      smoothScrollToElement(phoneInputRef.current, { block: 'center' });
                      phoneInputRef.current.focus();
                      phoneInputRef.current.select();
                    }
                  }}
                  className="min-h-11 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  Try Another Number
                </button>

                {preflightIssue.canViewInstant && (
                  <button
                    type="button"
                    onClick={handleViewInstantBundles}
                    className="min-h-11 px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-black text-black" />
                    <span>View Instant Bundles</span>
                  </button>
                )}

                {preflightIssue.code === 'SUPPLIER_WALLET_LOW' && (
                  <button
                    type="button"
                    onClick={(event) => {
                      setPreflightIssue(null);
                      (event.currentTarget.form)?.requestSubmit();
                    }}
                    className="min-h-11 px-3.5 rounded-xl border border-amber-500/30 text-amber-200 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Try Again
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-2">
                <a
                  href={`${BUSINESS_CONFIG.contact.supportWhatsAppUrl}?text=${encodeURIComponent(
                    `Hello Mystery Hub Support, I am ordering ${checkoutBundle.network.toUpperCase()} bundle (${
                      checkoutBundle.dataAmount || 'Airtime'
                    }) for ${phone.trim()}, but preflight verification indicates: ${preflightIssue.title} (Code: ${
                      preflightIssue.code
                    }). Please assist me.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-11 text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Report Issue</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreflightIssue(null)}
                  className="min-h-11 px-2 text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Server Error Callout */}
          {serverError && (
            <div
              ref={serverErrorRef}
              role="alert"
              className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-100 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="leading-relaxed">{serverError}</p>
                {<p className="text-xs text-rose-200/70">If payment was deducted, check Track Order before retrying. You can edit the recipient or contact support.</p>}
                {(commercial||isInstantBundle)&&/price|pricing|quote|welcome offer|promotion/i.test(serverError)&&<button type="button" disabled={walletBusy||isInitializing} onClick={()=>setQuoteRefresh(x=>x+1)} className="rounded-lg border border-slate-600 px-3 min-h-11 text-emerald-400">Refresh price</button>}
              </div>
              <button
                type="button"
                onClick={() => setServerError('')}
                aria-label="Dismiss payment error"
                className="min-w-11 min-h-11 -mt-2 -mr-2 flex items-center justify-center text-rose-200/70 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!awaitingPayment && <>
          {/* 2. Recipient Phone Input */}
          <div className="space-y-2">
            <label htmlFor="checkout-phone" className="block text-sm font-semibold text-slate-100">
              {isAirtime ? 'Send airtime to' : 'Send data to'}
            </label>
            <div className="relative">
              <PhoneIcon aria-hidden="true" className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={phoneInputRef}
                id="checkout-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                enterKeyHint="go"
                disabled={walletBusy||isInitializing}
                aria-invalid={Boolean(phoneError)}
                aria-describedby="checkout-phone-help"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="024 123 4567"
                required
                className={`w-full bg-[#0a0e12] border rounded-2xl pl-10 pr-24 min-h-14 text-white text-lg font-semibold tracking-wide tabular-nums placeholder:font-normal placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-colors ${phoneError ? 'border-rose-500/70 focus:ring-rose-500/40' : networkMismatch ? 'border-amber-500/60 focus:ring-amber-500/30' : 'border-slate-700 focus:border-[#00c365] focus:ring-[#00c365]/30'}`}
              />
              {phoneComplete && detectedNet && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs font-semibold ${networkMismatch ? 'text-amber-300' : 'text-emerald-400'}`}>
                  {networkMismatch ? <AlertTriangle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  {detectedNet === 'airteltigo' ? 'AT' : detectedName.replace(' Ghana', '')}
                </span>
              )}
            </div>

            {phoneError ? (
              <p id="checkout-phone-help" role="alert" className="text-xs text-rose-300 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{phoneError}</span>
              </p>
            ) : networkMismatch ? (
              <p id="checkout-phone-help" className="text-xs text-amber-200/90 leading-relaxed">
                This number usually belongs to <strong>{detectedName}</strong>, but this is a <strong>{currentNetwork.name}</strong> {isAirtime ? 'top-up' : 'bundle'}. Continue only if the number was moved to {currentNetwork.name}.
              </p>
            ) : (
              <p id="checkout-phone-help" className="text-xs text-slate-400">
                Check this number before paying. Data sent to a wrong number may not be recoverable.
              </p>
            )}
          </div>

          {!isInstantBundle&&<fieldset disabled={walletBusy||isInitializing}><WalletPaymentChoice amountMinor={Math.round(totalAmount*100)} value={paymentMethod} onChange={setPaymentMethod}/></fieldset>}

          {isRegularData&&<div className="text-xs text-slate-400">
            {editingReceipt ? <label className="block text-sm font-semibold text-slate-100">Receipt email<span className="block text-xs font-normal text-slate-400 mt-0.5">Paystack sends your payment receipt here.</span><input type="email" inputMode="email" autoComplete="email" value={receiptEmail} onChange={e=>setReceiptEmail(e.target.value)} maxLength={128} placeholder="you@example.com" className="w-full mt-2 min-h-12 px-3.5 rounded-xl bg-[#0a0e12] border border-slate-700 text-base font-normal text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00c365]" disabled={walletBusy||isInitializing} required/></label> : <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 px-3"><span className="min-w-0 break-all">Receipt to <span className="text-slate-200">{receiptEmail}</span></span><button type="button" disabled={walletBusy||isInitializing} onClick={()=>setEditingReceipt(true)} className="shrink-0 min-h-11 px-1 text-emerald-400 font-semibold">Change</button></div>}
            {commercial?.offer.state==='phone_required'&&<p className="mt-2">Add your phone in Account to check your Welcome Offer.</p>}
            {!commercial&&<div role="status" className="mt-2 flex flex-wrap items-center gap-2">{quoteError?<span className="text-amber-300">{quoteError}</span>:<span className="inline-flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 animate-spin" />Loading current price…</span>}{quoteError&&<button type="button" onClick={()=>setQuoteRefresh(x=>x+1)} className="rounded-lg border border-slate-600 px-3 min-h-11 text-emerald-400">Retry</button>}</div>}
          </div>}

          {/* 3. Network Notice (if required) */}
          {checkoutBundle.network === 'mtn' && !activeMtnConflict && (
            <p className="text-xs text-slate-400 flex items-start gap-2 leading-relaxed">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>MTN orders are queued and processed automatically. Please allow processing to complete before placing another order for this number.</span>
            </p>
          )}

          {/* 4. Price / Total Summary Breakdown */}
          <section aria-labelledby="checkout-confirm" className="rounded-2xl border border-slate-800 bg-[#0a0f14] p-4 space-y-2.5 text-sm">
            <h4 id="checkout-confirm" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Confirm your order</h4>
            {isInstantBundle&&!instantPricing.quote&&<div role="status" className="text-amber-200 text-xs">{instantPricing.error||'Loading exact price…'}{instantPricing.error&&<button type="button" onClick={()=>setQuoteRefresh(x=>x+1)} className="ml-2 underline min-h-11">Refresh price</button>}</div>}
            {isInstantBundle&&checkoutBundle.isFlexi&&<p className="text-xs text-slate-400">Flexi value: GH₵{faceValue.toFixed(2)}. Bundle price and checkout fee below form your exact total.</p>}
            <dl className="space-y-2">
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Recipient</dt><dd className="font-semibold text-white tabular-nums text-right min-w-0 break-all">{phoneComplete ? phone : <span className="font-normal text-slate-500">Not entered yet</span>}</dd></div>
              {isInstantBundle || isAirtime ? <>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">{isAirtime ? 'Airtime value' : 'Bundle Price'}</dt><dd className="text-white tabular-nums">{isInstantBundle&&!instantPricing.quote?'—':`GH₵${(isInstantBundle?instantPricing.quote!.productRetailMinor/100:faceValue).toFixed(2)}`}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">{isAirtime ? 'Service Fee (0%)' : 'Checkout fee'}</dt><dd className="text-slate-300 tabular-nums">{isInstantBundle&&!instantPricing.quote?'—':`GH₵${serviceFee.toFixed(2)}`}</dd></div>
              </> : <>
                {commercial?.discountMinor>0&&<><div className="flex justify-between gap-3"><dt className="text-slate-400">Regular price</dt><dd className="tabular-nums text-slate-300">GH₵{(commercial.regularMinor/100).toFixed(2)}</dd></div><div className="flex justify-between gap-3 text-emerald-400"><dt>Welcome Offer</dt><dd className="tabular-nums">−GH₵{(commercial.discountMinor/100).toFixed(2)}</dd></div></>}
              </>}
              <div className="flex items-baseline justify-between gap-3 border-t border-slate-800 pt-2.5">
                <dt className="font-semibold text-white">Total</dt>
                <dd className="text-[#00c365] text-xl tabular-nums font-extrabold">{isInstantBundle&&!instantPricing.quote?'—':`GH₵${totalAmount.toFixed(2)}`}</dd>
              </div>
            </dl>
            {isRegularData && <p className="text-xs text-slate-400">No hidden Mystery Hub checkout fee.</p>}
            <p className="text-xs text-slate-400 leading-relaxed">Delivered orders sent to the wrong number may not be reversible. Keep your reference to Track Order.</p>
          </section>
          </>}
        </form>

        {/* 6. Proceed to Secure Payment CTA, pinned above the keyboard */}
        <div className="shrink-0 border-t border-slate-800 bg-[#0c1116] px-4 sm:px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
          {awaitingPayment ? (
            <div role="status" className="flex items-center justify-center gap-2 min-h-12 text-sm text-slate-300">
              <span className="w-4 h-4 border-2 border-[#00c365] border-t-transparent rounded-full animate-spin" />
              Waiting for payment confirmation…
            </div>
          ) : (
          <button
            type="submit"
            form="checkout-form"
            disabled={walletBusy || isInitializing || paymentHeld || isRegularData && !commercial || isInstantBundle && !instantPricing.quote}
            aria-busy={walletBusy||isInitializing}
            className="w-full min-h-12 px-4 rounded-2xl bg-[#00c365] hover:bg-[#16d577] text-[#03160c] font-bold text-base transition-colors active:translate-y-px flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {walletBusy || isInitializing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                {walletBusy ? 'Placing your order…' : isSlowPreparation
                  ? 'Still preparing your checkout...'
                  : 'Preparing checkout…'}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {paymentHeld?'Check this payment first':isInstantBundle&&!instantPricing.quote?'Waiting for exact price…':`Pay GH₵${totalAmount.toFixed(2)}`}
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
          )}
          {isInitializing && !awaitingPayment && <p role="status" className="text-xs text-center text-slate-400">{isSlowPreparation ? 'Your connection seems slow. Please wait and avoid starting another payment.' : 'Your checkout is being prepared. Please wait and avoid starting another payment.'}</p>}
          <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              {paymentMethod==='wallet'?'Pay from your Mystery Wallet.':'Secure checkout powered by Paystack.'}
            </span>
            {/* 7. WhatsApp Help */}
            <a
              href={BUSINESS_CONFIG.getCheckoutSupportWhatsAppUrl(isAirtime ? `GH₵${faceValue.toFixed(2)} Airtime` : checkoutBundle.dataAmount, currentNetwork.name)}
              target="_blank"
              rel="noreferrer"
              aria-label="Need help? Contact us on WhatsApp"
              className="inline-flex items-center gap-1 min-h-8 text-slate-400 hover:text-white transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#00c365]" />
              <span>Help</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
