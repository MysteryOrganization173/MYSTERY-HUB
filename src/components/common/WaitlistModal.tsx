import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Bell, CheckCircle2, ArrowRight } from 'lucide-react';

export const WaitlistModal: React.FC = () => {
  const { waitlistInfo, closeWaitlist, showToast } = useApp();
  const [contact, setContact] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!waitlistInfo.isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim()) return;

    setIsSubmitted(true);
    showToast(`You're registered for ${waitlistInfo.serviceTitle} launch updates!`, 'success');

    setTimeout(() => {
      setIsSubmitted(false);
      setContact('');
      closeWaitlist();
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0f151b] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0c1116]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#00c365]" />
            <span className="text-xs font-semibold text-slate-300">Early Access Notification</span>
          </div>
          <button
            onClick={closeWaitlist}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {isSubmitted ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#00c365]/20 text-[#00c365] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-lg text-white">You&apos;re On The VIP List!</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                We will notify you via {channel} as soon as{' '}
                <span className="text-white font-medium">{waitlistInfo.serviceTitle}</span> goes live in Ghana.
              </p>
            </div>
          ) : (
            <>
              <div>
                <span className="text-[11px] font-semibold text-[#00c365] uppercase tracking-wider">
                  Coming Soon
                </span>
                <h3 className="text-xl font-bold text-white tracking-tight mt-1">
                  Get notified when {waitlistInfo.serviceTitle} launches
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  We are finalizing the direct integrations with Ghanaian providers. Be the first to try it with early-bird discounts and zero transaction fees.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Preferred Alert Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setChannel('whatsapp')}
                      className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors ${
                        channel === 'whatsapp'
                          ? 'border-[#00c365] bg-[#00c365]/10 text-white'
                          : 'border-slate-800 bg-slate-900 text-slate-400'
                      }`}
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setChannel('sms')}
                      className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors ${
                        channel === 'sms'
                          ? 'border-[#00c365] bg-[#00c365]/10 text-white'
                          : 'border-slate-800 bg-slate-900 text-slate-400'
                      }`}
                    >
                      SMS
                    </button>
                    <button
                      type="button"
                      onClick={() => setChannel('email')}
                      className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors ${
                        channel === 'email'
                          ? 'border-[#00c365] bg-[#00c365]/10 text-white'
                          : 'border-slate-800 bg-slate-900 text-slate-400'
                      }`}
                    >
                      Email
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {channel === 'email' ? 'Email Address' : 'Ghana Phone Number'}
                  </label>
                  <input
                    type={channel === 'email' ? 'email' : 'tel'}
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder={channel === 'email' ? 'you@domain.com' : '024 123 4567'}
                    required
                    className="w-full bg-[#0a0e12] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,195,101,0.25)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Notify Me at Launch</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
