import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { GHANA_NETWORKS, detectGhanaNetwork } from '../../data/bundles';
import { usePaystack } from '../../hooks/usePaystack';
import { BUSINESS_CONFIG } from '../../config/business';
import { lookupOrderOnServer } from '../../services/apiClient';
import { smoothScrollToElement } from '../../utils/scroll';
import {
  X,
  ShieldCheck,
  Smartphone,
  Check,
  ArrowRight,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  Info,
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
  } = useApp();
  const { initializeServerPayment, isInitializing, loadingPhase, isConfigured } = usePaystack();

  const [phone, setPhone] = useState('');
  const [detectedNet, setDetectedNet] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isSlowPreparation, setIsSlowPreparation] = useState(false);
  const [activeMtnConflict, setActiveMtnConflict] = useState<{
    orderRef?: string;
    status?: string;
  } | null>(null);

  const conflictRef = useRef<HTMLDivElement>(null);
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
      const initial = checkoutInitialPhone !== undefined ? checkoutInitialPhone : (user?.phone || '');
      setPhone(initial);
      setPhoneError('');
      setServerError('');
      setActiveMtnConflict(null);
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
  const faceValue = checkoutBundle.faceValueGhc ?? checkoutBundle.priceGhc;
  const serviceFee = checkoutBundle.serviceFeeGhc ?? (isAirtime ? Number((faceValue * 0.02).toFixed(2)) : 0);
  const totalAmount = isAirtime ? Number((faceValue + serviceFee).toFixed(2)) : checkoutBundle.priceGhc;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const clean = val.replace(/[^\d\s]/g, '');
    setPhone(clean);
    if (activeMtnConflict) setActiveMtnConflict(null);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      onCancel: () => {
        showToast('Payment window closed.', 'info');
      },
      onError: (err) => {
        if (err.code === 'ACTIVE_MTN_ORDER_EXISTS') {
          setActiveMtnConflict({
            orderRef: err.existingOrderReference,
            status: err.existingOrderStatus,
          });
          return;
        }
        setServerError(err.message || 'Payment initiation failed. Please try again.');
        showToast(err.message || 'Payment initiation failed', 'warning');
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0f151b] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 max-h-[94dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 border-b border-slate-800 bg-[#0c1116] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365] shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0 truncate">
              <h3 className="font-semibold text-sm sm:text-base text-white truncate">
                {isInstantBundle
                  ? `${currentNetwork.name} Instant Bundle ⚡`
                  : isAirtime
                  ? `${currentNetwork.name} Airtime Top-Up`
                  : 'Data Bundle Checkout'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {isInstantBundle
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
                    {isInstantBundle
                      ? `${checkoutBundle.dataAmount} Instant Bundle`
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
                  {isInstantBundle
                    ? 'Instant automated direct delivery to your line'
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
            {isAirtime ? (
              <>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Airtime Value (Face Value)</span>
                  <span className="text-white tabular-nums font-medium">GH₵{faceValue.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Service Fee (2%)</span>
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
            <span>Secure checkout powered by Paystack.</span>
          </div>

          {/* 6. Proceed to Secure Payment CTA */}
          <button
            type="submit"
            disabled={isInitializing}
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
                Proceed to Secure Payment
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
