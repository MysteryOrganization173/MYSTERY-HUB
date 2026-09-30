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
  CreditCard,
  Building2,
  Check,
  ArrowRight,
  MessageSquare,
  AlertCircle,
  Lock,
  AlertTriangle,
  Info,
} from 'lucide-react';

export const CheckoutModal: React.FC = () => {
  const {
    isCheckoutOpen,
    closeCheckout,
    checkoutBundle,
    createOrder,
    showToast,
    user,
    openOrderStatus,
  } = useApp();
  const { initializeServerPayment, isInitializing, isConfigured } = usePaystack();

  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'card' | 'bank'>('momo');
  const [detectedNet, setDetectedNet] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState('');
  const [serverError, setServerError] = useState('');
  const [activeMtnConflict, setActiveMtnConflict] = useState<{
    orderRef?: string;
    status?: string;
  } | null>(null);

  const conflictRef = useRef<HTMLDivElement>(null);
  const serverErrorRef = useRef<HTMLDivElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkoutBundle) {
      setPhone((prev) => prev || user?.phone || '');
      setPhoneError('');
      setServerError('');
      setActiveMtnConflict(null);
    }
  }, [checkoutBundle, user?.phone]);

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
          paymentMethod: 'momo',
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
      paymentMethod: 'momo',
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
      customerEmail: user?.email,
      customerName: user?.name,
      serviceType: isAirtime ? 'airtime' : 'data',
      network: checkoutBundle.network,
      amount: faceValue,
      onPaymentReceived: (orderRef, reference) => {
        const orderToCreate = {
          ...checkoutBundle,
          priceGhc: totalAmount,
          faceValueGhc: faceValue,
          serviceFeeGhc: serviceFee,
          serviceType: isAirtime ? ('airtime' as const) : ('data' as const),
        };
        const newOrder = createOrder(orderToCreate, phone.trim(), paymentMethod, reference, orderRef);
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
      <div className="relative w-full max-w-xl bg-[#0f151b] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 max-h-[94dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-[#0c1116] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365] shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0 truncate">
              <h3 className="font-semibold text-sm sm:text-base text-white truncate">
                {isAirtime ? `${currentNetwork.name} Airtime Top-Up` : 'Data Bundle Checkout'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {isAirtime ? 'Direct SIM recharge via Ghana Mobile Money' : 'Direct SIM delivery via Ghana Mobile Money'}
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
        <form onSubmit={handleSubmit} className="overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 flex-1 overscroll-contain">
          {/* Bundle / Airtime Summary Card */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm"
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
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-white text-sm sm:text-base truncate">
                    {isAirtime ? `GH₵${faceValue.toFixed(2)} Airtime Top-Up` : `${checkoutBundle.dataAmount} Data Bundle`}
                  </h4>
                  {isAirtime ? (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-bold shrink-0">
                      ⚡ Instant Recharge
                    </span>
                  ) : checkoutBundle.network === 'airteltigo' ? (
                    <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded font-bold shrink-0">
                      ⚡ Instant Delivery
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-medium shrink-0">
                      Direct SIM Credit
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                  {currentNetwork.name} · {isAirtime ? 'Direct automated airtime recharge' : (checkoutBundle.network === 'airteltigo' ? 'Instant direct delivery to your AT number.' : (checkoutBundle.description || 'Fast automated network dispatch'))}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[11px] text-slate-400 font-medium">{isAirtime ? 'Total' : 'Price'}</div>
              <div className="text-base sm:text-lg font-bold text-[#00c365] tabular-nums">
                GH₵{totalAmount.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Active MTN Duplicate Order Conflict Banner (Smooth-scrolled into view) */}
          {activeMtnConflict && (
            <div
              ref={conflictRef}
              className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/35 text-left space-y-3 animate-in fade-in"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-amber-200">
                    An MTN bundle is already being processed for this number.
                  </h4>
                  <p className="text-xs text-amber-300/90 mt-1 leading-relaxed">
                    Please wait for your current order to be completed before buying another MTN bundle for this number.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {activeMtnConflict.orderRef && (
                  <button
                    type="button"
                    onClick={() => handleTrackCurrentOrder(activeMtnConflict.orderRef!)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 text-amber-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Track current order</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveMtnConflict(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Server Error Callout (Smooth-scrolled into view) */}
          {serverError && (
            <div
              ref={serverErrorRef}
              className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in"
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

          {/* Recipient Phone Input */}
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
                className="w-full bg-[#0a0e12] border border-slate-700 rounded-xl px-4 py-3 text-white text-base tracking-wide focus:outline-none focus:border-[#00c365] focus:ring-1 focus:ring-[#00c365]"
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
                Double-check the recipient number carefully. Data is credited directly following Mobile Money authorization.
              </p>
            )}
          </div>

          {/* MTN Reassurance Notice in Checkout */}
          {checkoutBundle.network === 'mtn' && !activeMtnConflict && (
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                MTN orders are queued and processed automatically. Please allow processing to complete before placing another order for this number.
              </span>
            </div>
          )}

          {/* Payment Method Selector (Compact 3-column Tiles) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-200 block">
              Choose Payment Method
            </label>

            <div className="grid grid-cols-3 gap-2">
              {/* MoMo Tile */}
              <button
                type="button"
                onClick={() => setPaymentMethod('momo')}
                className={`p-2.5 sm:p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'momo'
                    ? 'border-[#00c365] bg-[#00c365]/10 text-white shadow-sm ring-1 ring-[#00c365]/40'
                    : 'border-slate-800 bg-[#090d10] text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <Smartphone className="w-4 h-4 text-[#00c365]" />
                  {paymentMethod === 'momo' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00c365]" />
                  )}
                </div>
                <span className="text-xs font-bold leading-none">Mobile Money</span>
              </button>

              {/* Card Tile */}
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-2.5 sm:p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'card'
                    ? 'border-[#00c365] bg-[#00c365]/10 text-white shadow-sm ring-1 ring-[#00c365]/40'
                    : 'border-slate-800 bg-[#090d10] text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <CreditCard className="w-4 h-4 text-sky-400" />
                  {paymentMethod === 'card' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00c365]" />
                  )}
                </div>
                <span className="text-xs font-bold leading-none">Card</span>
              </button>

              {/* Bank / QR Tile */}
              <button
                type="button"
                onClick={() => setPaymentMethod('bank')}
                className={`p-2.5 sm:p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'bank'
                    ? 'border-[#00c365] bg-[#00c365]/10 text-white shadow-sm ring-1 ring-[#00c365]/40'
                    : 'border-slate-800 bg-[#090d10] text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  {paymentMethod === 'bank' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00c365]" />
                  )}
                </div>
                <span className="text-xs font-bold leading-none">Bank / QR</span>
              </button>
            </div>

            {/* Contextual description below tiles */}
            <div className="text-[11px] text-slate-400 px-1 pt-0.5">
              {paymentMethod === 'momo' && (
                <span>Official USSD prompt sent to your MTN MoMo, Telecel Cash, or AT Money wallet.</span>
              )}
              {paymentMethod === 'card' && (
                <span>Pay securely with Visa, Mastercard, or Verve via Paystack 256-bit encryption.</span>
              )}
              {paymentMethod === 'bank' && (
                <span>Scan GhanaQR or pay directly from your Ghana bank app.</span>
              )}
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="p-3.5 rounded-xl bg-[#090d10] border border-slate-800/80 space-y-2 text-xs">
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

          {/* Security Note & Paystack Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>256-bit encrypted checkout. Zero hidden fees.</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Lock className="w-3 h-3 text-[#00c365]" />
              <span>{isConfigured ? 'Secured by Paystack' : 'Paystack Ready (Test Sandbox)'}</span>
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isInitializing}
            className="w-full py-3.5 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-sm tracking-wide transition-all shadow-[0_0_20px_rgba(0,195,101,0.3)] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
          >
            {isInitializing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Connecting to Paystack...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Pay GH₵{totalAmount.toFixed(2)} with Paystack
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>

          {/* WhatsApp Inquiries */}
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
