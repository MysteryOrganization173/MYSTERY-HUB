import { WalletPaymentChoice } from '../finance/WalletPaymentChoice';
import { walletCheckout } from '../../services/financeApi';
import { getStoredReferralCode, getOrGenerateVisitorKey } from '../../utils/referralCapture';
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { NetworkId } from '../../types';
import { GHANA_NETWORKS, detectGhanaNetwork } from '../../data/bundles';
import { usePaystack } from '../../hooks/usePaystack';
import { BUSINESS_CONFIG } from '../../config/business';
import { lookupOrderOnServer, cancelPaymentOnServer } from '../../services/apiClient';
import { smoothScrollToElement } from '../../utils/scroll';
import { getInstantBundlePresentation } from '../../utils/instantBundleUtils';
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
  Phone as PhoneIcon,
} from 'lucide-react';

export const CheckoutModal: React.FC = () => {
  const {
    isCheckoutOpen,
    closeCheckout,
    checkoutBundle,
    checkoutInitialPhone,
    createOrder,
    showToast,
    user,
    openOrderStatus,
    openDataPage,
    sessionToken,
    setActivePage,
  } = useApp();
  const { initializeServerPayment, isInitializing, loadingPhase, isConfigured } = usePaystack();

  const [phone, setPhone] = useState('');
  const [paymentMethod,setPaymentMethod]=useState<'paystack'|'wallet'>('paystack');
  const [walletBusy,setWalletBusy]=useState(false);
  const walletRequest=useRef<{fingerprint:string;id:string}|null>(null);
  const [detectedNet, setDetectedNet] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isSlowPreparation, setIsSlowPreparation] = useState(false);
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
    if (checkoutBundle) {
      setPaymentMethod('paystack');
      walletRequest.current=null;
      const initial = checkoutInitialPhone !== undefined ? checkoutInitialPhone : (user?.phone || '');
      setPhone(initial);
      setPhoneError('');
      setServerError('');
      setActiveMtnConflict(null);
      setPreflightIssue(null);
    }
  }, [checkoutBundle, checkoutInitialPhone, user?.phone]);

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
  const faceValue = checkoutBundle.faceValueGhc ?? checkoutBundle.priceGhc;
  const serviceFee =
    checkoutBundle.serviceFeeGhc ??
    (isAirtime
      ? 0
      : isInstantBundle
      ? Number((Math.ceil((Math.round(faceValue * 100) + 10) / 0.98) / 100 - faceValue).toFixed(2))
      : 0);
  const totalAmount =
    isAirtime || isInstantBundle
      ? Number((faceValue + serviceFee).toFixed(2))
      : checkoutBundle.priceGhc;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const clean = val.replace(/[^\d\s]/g, '');
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
        openOrderStatus({
          id: res.order.public_reference,
          publicReference: res.order.public_reference,
          serverReference: res.order.public_reference,
          serverStatus: res.order.status,
          serviceType: res.order.service_type,
          statusMessage:
            res.order.status === 'refund_pending' || res.order.status === 'refunded'
              ? 'Delivery could not be completed. Your payment is being reviewed for refund.'
              : undefined,
          bundle: {
            id: 'mtn-active',
            network: res.order.network,
            dataAmount: res.order.bundle_size_snapshot,
            dataBytesValue: 1024,
            validity: 'Direct Credit',
            validityCategory: 'Monthly',
            priceGhc: res.order.amount_ghc,
          },
          recipientPhone: res.order.recipient_phone,
          network: res.order.network,
          paymentMethod: 'paystack',
          amountGhc: res.order.amount_ghc,
          status: res.order.status === 'delivered' ? 'delivered' : 'processing',
          createdAt: res.order.created_at,
          updatedAt: res.order.created_at,
        });
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
      status: 'processing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

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

    initializeServerPayment({
      productId: checkoutBundle.id,
      recipientPhone: phone.trim(),
      customerEmail: user?.email || undefined,
      customerName: user?.name || undefined,
      serviceType: isInstantBundle ? 'instant_bundle' : isAirtime ? 'airtime' : 'data',
      network: checkoutBundle.network,
      amount: faceValue,
      onPaymentReceived: (orderRef, reference) => {
        const orderToCreate = {
          ...checkoutBundle,
          priceGhc: totalAmount,
          faceValueGhc: faceValue,
          serviceFeeGhc: serviceFee,
          serviceType: isInstantBundle
            ? ('instant_bundle' as const)
            : isAirtime
            ? ('airtime' as const)
            : ('data' as const),
        };
        const newOrder = createOrder(orderToCreate, phone.trim(), 'paystack', reference, orderRef);
        closeCheckout();
        showToast(`Payment received! Order #${orderRef}. Verifying payment...`, 'success');
        openOrderStatus(newOrder);
      },
      onCancel: (orderRef) => {
        showToast('Payment window closed.', 'info');
        if (orderRef) {
          cancelPaymentOnServer(orderRef).catch((err) => {
            console.warn('Failed to cancel order on server:', err);
          });
        }
      },
      onError: (err) => {
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
              'Need data right now?\nInstant Bundles do not require this MTN verification step and are delivered immediately after successful payment.',
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

        setServerError(err.message || 'Payment initiation failed. Please try again.');
        showToast(err.message || 'Payment initiation failed', 'warning');
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(paymentMethod!=='wallet'){submitPayment();return;}
    if(walletBusy||!sessionToken)return;
    setWalletBusy(true);setServerError('');
    try {
      const body={productId:checkoutBundle.id,recipientPhone:phone.trim(),customerEmail:user?.email,customerName:user?.name,serviceType:isAirtime?'airtime':'data',network:checkoutBundle.network,amount:faceValue,referralCode:getStoredReferralCode(),visitorKey:getOrGenerateVisitorKey()};
      const fingerprint=JSON.stringify(body);if(walletRequest.current?.fingerprint!==fingerprint)walletRequest.current={fingerprint,id:crypto.randomUUID()};
      const result=await walletCheckout(sessionToken,'payments/initialize',{...body,requestId:walletRequest.current!.id});
      createOrder({...checkoutBundle,priceGhc:result.amountPesewas/100},phone.trim(),'wallet',result.reference,result.orderRef);
      closeCheckout();setActivePage('orders');showToast('Wallet payment confirmed. Check My Orders for fulfilment status.','success');
    }catch(error){setServerError((error as Error).message);}finally{setWalletBusy(false);}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-[calc(100vw-1rem)] sm:max-w-lg bg-[#0f151b] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 max-h-[94dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 border-b border-slate-800 bg-[#0c1116] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365] shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0 truncate">
              <h3 className="font-semibold text-sm sm:text-base text-white truncate">
                {isInstantBundle && instantInfo
                  ? `${currentNetwork.name} ${instantInfo.categoryLabel} ⚡`
                  : isAirtime
                  ? `${currentNetwork.name} Airtime Top-Up`
                  : 'Data Bundle Checkout'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {paymentMethod==='wallet'?'Direct SIM delivery · Mystery Wallet':isInstantBundle
                  ? 'Direct automated instant delivery via Paystack'
                  : 'Direct SIM delivery via Paystack'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeCheckout}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Close checkout"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 flex-1 overscroll-contain">
          {!isInstantBundle&&<WalletPaymentChoice amountMinor={Math.round(totalAmount*100)} value={paymentMethod} onChange={setPaymentMethod}/>}
          {walletBusy&&<p role="status" className="text-sm text-[#00c365]">Confirming Wallet payment…</p>}
          {/* 1. Bundle / Airtime Summary Card */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm"
                style={{
                  backgroundColor:
                    checkoutBundle.network === 'mtn'
                      ? '#FFCC00'
                      : checkoutBundle.network === 'telecel'
                      ? '#E60000'
                      : '#004B93',
                  color: checkoutBundle.network === 'mtn' ? '#000' : '#fff',
                }}
              >
                {checkoutBundle.network === 'mtn' ? 'MTN' : checkoutBundle.network === 'telecel' ? 'Telecel' : 'AT'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-bold text-white text-sm sm:text-base truncate">
                    {isInstantBundle && instantInfo
                      ? `${instantInfo.formattedAmount} ${instantInfo.categoryLabel}`
                      : isAirtime
                      ? `GH₵${faceValue.toFixed(2)} Airtime Top-Up`
                      : `${checkoutBundle.dataAmount} Data Bundle`}
                  </h4>
                  {isInstantBundle ? (
                    <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded font-bold shrink-0">
                      ⚡ Instant
                    </span>
                  ) : isAirtime ? (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold shrink-0">
                      ⚡ Instant
                    </span>
                  ) : checkoutBundle.network === 'airteltigo' ? (
                    <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded font-bold shrink-0">
                      ⚡ Instant
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium shrink-0">
                      Direct SIM
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {currentNetwork.name} ·{' '}
                  {isInstantBundle && instantInfo
                    ? instantInfo.restrictionNote || 'Instant automated direct delivery to your line'
                    : isAirtime
                    ? 'Direct automated airtime recharge'
                    : checkoutBundle.network === 'airteltigo'
                    ? 'Instant direct delivery to your AT number'
                    : checkoutBundle.description || 'Fast automated delivery'}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] text-slate-400 font-medium">{isAirtime ? 'Total' : 'Price'}</div>
              <div className="text-base sm:text-lg font-bold text-[#00c365] tabular-nums">
                GH₵{totalAmount.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Instant Bundle Safety & Restriction Notice */}
          {isInstantBundle && instantInfo && instantInfo.restrictionNote && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
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
              className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/35 text-left space-y-2.5 animate-in fade-in"
            >
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-amber-200">
                    An MTN bundle is already being processed for this number.
                  </h4>
                  <p className="text-[11px] sm:text-xs text-amber-300/90 mt-0.5 leading-relaxed">
                    Please wait for your current order to be completed before buying another MTN bundle for this number.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                {activeMtnConflict.orderRef && (
                  <button
                    type="button"
                    onClick={() => handleTrackCurrentOrder(activeMtnConflict.orderRef!)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 text-amber-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Track current order</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveMtnConflict(null)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
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
              className="p-3.5 sm:p-4 rounded-xl bg-slate-900/95 border border-slate-700/80 text-left space-y-3 animate-in fade-in"
            >
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 shrink-0 mt-0.5">
                  <Info className="w-4 h-4" />
                </div>
                <div className="space-y-2 min-w-0 flex-1">
                  <h4 className="font-semibold text-xs sm:text-sm text-white">
                    {preflightIssue.title}
                  </h4>
                  <div className="text-[11px] sm:text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {preflightIssue.message}
                  </div>

                  {preflightIssue.conversionNote && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs space-y-1 mt-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-300">
                        <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                        <span>Need data right now?</span>
                      </div>
                      <p className="text-[11px] text-amber-200/90 leading-relaxed">
                        Instant Bundles do not require this MTN verification step and are delivered immediately after successful payment.
                      </p>
                    </div>
                  )}

                  {preflightIssue.supportingNote && (
                    <p className="text-[10px] sm:text-[11px] text-slate-400 pt-1 leading-relaxed border-t border-slate-800/80">
                      {preflightIssue.supportingNote}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Primary Actions */}
                <div className="flex items-center gap-2 flex-wrap">
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
                    className="px-3 py-2 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <span>Try Another Number</span>
                  </button>

                  {preflightIssue.canViewInstant && (
                    <button
                      type="button"
                      onClick={handleViewInstantBundles}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5 fill-black text-black" />
                      <span>View Instant Bundles</span>
                    </button>
                  )}

                  {preflightIssue.code === 'SUPPLIER_WALLET_LOW' && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreflightIssue(null);
                        submitPayment();
                      }}
                      className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold border border-amber-500/30 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>Try Again</span>
                    </button>
                  )}
                </div>

                {/* Secondary Support Action */}
                <div className="flex items-center gap-2 justify-end shrink-0">
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
                    className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer py-1 px-1.5"
                  >
                    <MessageSquare className="w-3 h-3 text-emerald-400" />
                    <span>Report Issue</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreflightIssue(null)}
                    className="px-2 py-1 rounded text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Server Error Callout */}
          {serverError && (
            <div
              ref={serverErrorRef}
              className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold text-rose-200">Payment Error: </span>
                {serverError}
              </div>
              <button
                type="button"
                onClick={() => setServerError('')}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Network Mismatch Warning Banner */}
          {detectedNet && checkoutBundle.network && detectedNet !== checkoutBundle.network && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-[11px] leading-relaxed">
                Number prefix indicates <strong>{GHANA_NETWORKS[detectedNet as keyof typeof GHANA_NETWORKS]?.name || detectedNet.toUpperCase()}</strong>, while this checkout is for <strong>{currentNetwork.name}</strong>. If this number was ported via MNP, you can proceed safely.
              </span>
            </div>
          )}

          {/* 2. Recipient Phone Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="checkout-phone" className="text-xs font-semibold text-slate-200">
                Recipient Phone Number (Ghana)
              </label>
              {detectedNet && (
                <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Detected: {GHANA_NETWORKS[detectedNet as keyof typeof GHANA_NETWORKS]?.name || detectedNet.toUpperCase()}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                ref={phoneInputRef}
                id="checkout-phone"
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="e.g. 024 XXX XXXX"
                required
                className="w-full bg-[#0a0e12] border border-slate-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base tracking-wide focus:outline-none focus:border-[#00c365] focus:ring-1 focus:ring-[#00c365] transition-colors"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded">
                +233
              </div>
            </div>

            {phoneError ? (
              <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{phoneError}</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-400">
                Please double-check the recipient number. Data is credited directly after payment authorization.
              </p>
            )}
          </div>

          {/* 3. Network Notice (if required) */}
          {checkoutBundle.network === 'mtn' && !activeMtnConflict && (
            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                MTN orders are queued and processed automatically. Please allow processing to complete before placing another order for this number.
              </span>
            </div>
          )}

          {/* 4. Price / Total Summary Breakdown */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#090d10] border border-slate-800/80 space-y-1.5 text-xs">
            {isInstantBundle ? (
              <>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Bundle Price</span>
                  <span className="text-white tabular-nums font-medium">GH₵{faceValue.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <div className="flex items-center gap-1">
                    <span>Payment processing</span>
                    <span className="text-[10px] text-slate-500">(gateway + dispatch)</span>
                  </div>
                  <span className="text-slate-300 tabular-nums font-medium">GH₵{serviceFee.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm font-bold text-white">
                  <span>Total Amount</span>
                  <span className="text-[#00c365] text-base tabular-nums font-black">
                    GH₵{totalAmount.toFixed(2)}
                  </span>
                </div>
              </>
            ) : isAirtime ? (
              <>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Airtime Value (Face Value)</span>
                  <span className="text-white tabular-nums font-medium">GH₵{faceValue.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Service Fee (0%)</span>
                  <span className="text-slate-300 tabular-nums font-medium">GH₵{serviceFee.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm font-bold text-white">
                  <span>Total Amount</span>
                  <span className="text-[#00c365] text-base tabular-nums font-black">
                    GH₵{totalAmount.toFixed(2)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Data Subtotal</span>
                  <span className="text-white tabular-nums font-medium">GH₵{checkoutBundle.priceGhc.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Service & Delivery Fee</span>
                  <span className="text-emerald-400 font-medium">FREE</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm font-bold text-white">
                  <span>Total Amount</span>
                  <span className="text-[#00c365] text-base tabular-nums font-black">
                    GH₵{checkoutBundle.priceGhc.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* 5. Simple Security Line */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{paymentMethod==='wallet'?'Wallet payment verified by Mystery Hub.':'Secure checkout powered by Paystack.'}</span>
          </div>

          {/* 6. Proceed to Secure Payment CTA */}
          <button
            type="submit"
            disabled={walletBusy || isInitializing}
            className="w-full py-3.5 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-sm tracking-wide transition-all shadow-[0_0_20px_rgba(0,195,101,0.3)] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
          >
            {isInitializing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                {loadingPhase === 'opening'
                  ? 'Opening Paystack...'
                  : isSlowPreparation
                  ? 'Still preparing your checkout...'
                  : 'Preparing secure checkout...'}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {paymentMethod==='wallet'?'Pay with Mystery Wallet':'Proceed to Secure Payment'}
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>

          {/* 7. WhatsApp Help */}
          <div className="text-center pt-0.5">
            <a
              href={BUSINESS_CONFIG.getCheckoutSupportWhatsAppUrl(isAirtime ? `GH₵${faceValue.toFixed(2)} Airtime` : checkoutBundle.dataAmount, currentNetwork.name)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#00c365]" />
              <span>Need help? Contact us on WhatsApp</span>
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};
