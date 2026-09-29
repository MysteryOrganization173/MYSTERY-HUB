import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { GHANA_NETWORKS, detectGhanaNetwork } from '../../data/bundles';
import { X, ShieldCheck, Smartphone, CreditCard, Building2, Check, ArrowRight, MessageSquare, AlertCircle } from 'lucide-react';

export const CheckoutModal: React.FC = () => {
  const { isCheckoutOpen, closeCheckout, checkoutBundle, createOrder, showToast } = useApp();

  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'card' | 'bank'>('momo');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detectedNet, setDetectedNet] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    if (checkoutBundle) {
      // Default initial recipient phone if available
      setPhone((prev) => prev || '024 ');
      setPhoneError('');
    }
  }, [checkoutBundle]);

  useEffect(() => {
    const net = detectGhanaNetwork(phone);
    setDetectedNet(net);
    if (phone.replace(/\D/g, '').length >= 10) {
      setPhoneError('');
    }
  }, [phone]);

  if (!isCheckoutOpen || !checkoutBundle) return null;

  const currentNetwork = GHANA_NETWORKS[checkoutBundle.network];

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow numbers, spaces
    const clean = val.replace(/[^\d\s]/g, '');
    setPhone(clean);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawDigits = phone.replace(/\D/g, '');

    if (rawDigits.length < 10) {
      setPhoneError('Please enter a valid 10-digit Ghana phone number (e.g. 024 123 4567)');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      createOrder(checkoutBundle, phone.trim(), paymentMethod);
      showToast('Order received! Processing your bundle delivery...', 'info');
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0f151b] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0c1116]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365]">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white">Data Bundle Checkout</h3>
              <p className="text-xs text-slate-400">Fast SIM delivery via Ghana Mobile Money</p>
            </div>
          </div>
          <button
            onClick={closeCheckout}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close checkout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-6 flex-1">
          {/* Bundle Summary Card */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xs"
                style={{
                  backgroundColor: checkoutBundle.network === 'mtn' ? '#FFCC00' : checkoutBundle.network === 'telecel' ? '#E60000' : '#004B93',
                  color: checkoutBundle.network === 'mtn' ? '#000' : '#fff',
                }}
              >
                {checkoutBundle.network === 'mtn' ? 'MTN' : checkoutBundle.network === 'telecel' ? 'Telecel' : 'AT'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-base">
                    {checkoutBundle.dataAmount} Data Bundle
                  </h4>
                  <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    {checkoutBundle.validity}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {currentNetwork.name} · {checkoutBundle.description || 'Instant automated top-up'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400 font-medium">Price</div>
              <div className="text-lg font-bold text-[#00c365] tabular-nums">
                GH₵{checkoutBundle.priceGhc.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Recipient Phone Input */}
          <div className="space-y-2">
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
                id="checkout-phone"
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="e.g. 024 123 4567"
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
                Double-check the number. Data is delivered automatically within 60 seconds of confirmation.
              </p>
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-slate-200 block">
              Choose Payment Method
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* MoMo Option */}
              <button
                type="button"
                onClick={() => setPaymentMethod('momo')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  paymentMethod === 'momo'
                    ? 'border-[#00c365] bg-[#00c365]/10 text-white shadow-sm'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Smartphone className="w-4 h-4 text-[#00c365]" />
                  {paymentMethod === 'momo' && (
                    <div className="w-2 h-2 rounded-full bg-[#00c365]" />
                  )}
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold">Mobile Money</div>
                  <div className="text-[10px] text-slate-400">MTN, Telecel, AT</div>
                </div>
              </button>

              {/* Card / Paystack Option */}
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  paymentMethod === 'card'
                    ? 'border-[#00c365] bg-[#00c365]/10 text-white shadow-sm'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <CreditCard className="w-4 h-4 text-sky-400" />
                  {paymentMethod === 'card' && (
                    <div className="w-2 h-2 rounded-full bg-[#00c365]" />
                  )}
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold">Card Payment</div>
                  <div className="text-[10px] text-slate-400">Visa / Mastercard</div>
                </div>
              </button>

              {/* Bank Transfer / GhanaQR Option */}
              <button
                type="button"
                onClick={() => setPaymentMethod('bank')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  paymentMethod === 'bank'
                    ? 'border-[#00c365] bg-[#00c365]/10 text-white shadow-sm'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  {paymentMethod === 'bank' && (
                    <div className="w-2 h-2 rounded-full bg-[#00c365]" />
                  )}
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold">Bank / GhanaQR</div>
                  <div className="text-[10px] text-slate-400">Direct Account</div>
                </div>
              </button>
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="p-3.5 rounded-xl bg-[#090d10] border border-slate-800/80 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Data Subtotal</span>
              <span className="text-white tabular-nums">GH₵{checkoutBundle.priceGhc.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Service & Delivery Fee</span>
              <span className="text-emerald-400 font-medium">FREE</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm font-bold text-white">
              <span>Total Amount</span>
              <span className="text-[#00c365] text-base tabular-nums">
                GH₵{checkoutBundle.priceGhc.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Security Note */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>256-bit encrypted checkout. No hidden charges or extra deductions.</span>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-sm tracking-wide transition-all shadow-[0_0_20px_rgba(0,195,101,0.3)] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Connecting to Gateway...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Pay GH₵{checkoutBundle.priceGhc.toFixed(2)} Now
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>

          {/* WhatsApp Inquiries */}
          <div className="text-center pt-1">
            <a
              href={`https://wa.me/233550000000?text=Hi%20Mystery%20Hub,%20I'm%20purchasing%20${encodeURIComponent(checkoutBundle.dataAmount)}%20${encodeURIComponent(currentNetwork.name)}`}
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
