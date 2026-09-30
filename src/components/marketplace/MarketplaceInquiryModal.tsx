import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import {
  X,
  MessageSquare,
  Phone,
  Mail,
  Send,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

export const MarketplaceInquiryModal: React.FC = () => {
  const { marketplaceInquiryProduct, closeMarketplaceInquiry, showToast } = useApp();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!marketplaceInquiryProduct) return null;

  const product = marketplaceInquiryProduct;

  const handleWhatsAppDirect = (e: React.FormEvent) => {
    e.preventDefault();

    const inquiryDetails = [
      notes ? `Requirements: ${notes}` : null,
      budget ? `Target Budget: GH₵ ${budget}` : null,
      name ? `From: ${name}` : null,
      phone ? `Phone: ${phone}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const whatsappUrl = BUSINESS_CONFIG.getMarketplaceInquiryWhatsAppUrl(
      product.name,
      inquiryDetails || undefined
    );

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    setIsSubmitted(true);
    showToast(`WhatsApp inquiry prepared for ${product.name}!`, 'success');

    setTimeout(() => {
      setIsSubmitted(false);
      setName('');
      setPhone('');
      setBudget('');
      setNotes('');
      closeMarketplaceInquiry();
    }, 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={closeMarketplaceInquiry}
    >
      <div
        className="relative w-full max-w-lg bg-[#0e141a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketplace-inquiry-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#090d11] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00c365]/15 border border-[#00c365]/30 flex items-center justify-center text-[#00c365]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                Sourcing & Availability
              </span>
              <h3 id="marketplace-inquiry-title" className="text-sm sm:text-base font-bold text-white">
                Product Inquiry
              </h3>
            </div>
          </div>
          <button
            onClick={closeMarketplaceInquiry}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close inquiry modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Product Summary Card */}
          <div className="p-4 rounded-xl bg-[#121921] border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-semibold text-[#00c365] bg-[#00c365]/10 px-2 py-0.5 rounded border border-[#00c365]/20 inline-block mb-1">
                {product.categoryLabel}
              </span>
              <h4 className="font-bold text-base text-white">{product.name}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{product.tagline}</p>
            </div>
            <div className="sm:text-right shrink-0">
              <span className="text-xs text-slate-400 block font-medium">Estimated Pricing</span>
              <span className="text-sm sm:text-base font-bold text-emerald-400 tabular-nums">
                {product.priceDisplay}
              </span>
            </div>
          </div>

          {/* Sourcing Transparency Note */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#00c365] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              We source genuine hardware and software through authorized Ghana distributors. Sourcing inquiries carry zero obligation or upfront fee.
            </p>
          </div>

          {isSubmitted ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#00c365]/20 text-[#00c365] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-lg text-white">Inquiry Dispatched!</h4>
              <p className="text-xs text-slate-300 max-w-xs mx-auto">
                WhatsApp has been launched with your inquiry details. Our Accra sourcing desk will confirm current availability and pricing promptly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleWhatsAppDirect} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-200 block">
                    Your Name / Organization <span className="text-slate-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kwame Asante"
                    className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365] text-xs sm:text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-200 block">
                    WhatsApp or Phone <span className="text-slate-500">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 059 206 6298"
                    className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365] text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-200 block">
                  Target Budget / Quantity <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. GH₵ 7,000 max, or 2 units"
                  className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365] text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-200 block">
                  Specific Specifications or Questions <span className="text-slate-500">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Looking for 16GB RAM model, needed for delivery in East Legon"
                  className="w-full bg-[#090d10] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365] text-xs sm:text-sm resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,195,101,0.25)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Send Inquiry via WhatsApp (+233 59 206 6298)</span>
                </button>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <a
                    href={BUSINESS_CONFIG.contact.phoneLink}
                    className="py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    <span>Call: 0592066298</span>
                  </a>
                  <a
                    href={`mailto:${BUSINESS_CONFIG.contact.supportEmail}?subject=${encodeURIComponent(
                      `Inquiry regarding ${product.name}`
                    )}`}
                    className="py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5 text-sky-400" />
                    <span>Email Us</span>
                  </a>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
