import { useDialogFocus } from '../../hooks/useDialogFocus';
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Bell, CheckCircle2, ArrowRight, AlertCircle } from 'lucide-react';
import { joinWaitlistOnServer } from '../../services/apiClient';

export const WaitlistModal: React.FC = () => {
  const { waitlistInfo, closeWaitlist, showToast, sessionToken } = useApp();
  const [contact, setContact] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dialogRef = useDialogFocus(waitlistInfo.isOpen, () => { if (!isSubmitting) closeWaitlist(); });

  useEffect(() => {
    setIsSubmitted(false);
    setAlreadyJoined(false);
    setContact('');
    setErrorMessage(null);
  }, [waitlistInfo.isOpen, waitlistInfo.serviceTitle]);

  if (!waitlistInfo.isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim()) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    const serviceKey = waitlistInfo.serviceTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    try {
      const res = await joinWaitlistOnServer(
        {
          serviceKey: serviceKey || 'general_waitlist',
          serviceTitle: waitlistInfo.serviceTitle,
          channel,
          contact: contact.trim(),
          sourcePage: typeof window !== 'undefined' ? window.location.pathname : undefined,
        },
        sessionToken
      );

      setAlreadyJoined(res.alreadyJoined);
      setIsSubmitted(true);
      showToast(
        res.alreadyJoined
          ? `You're already on the launch list for ${waitlistInfo.serviceTitle}!`
          : `You're registered for ${waitlistInfo.serviceTitle} launch updates!`,
        'success'
      );


    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join waitlist. Please try again.';
      setErrorMessage(msg);
      showToast(msg, 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Service launch updates" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-[calc(100vw-1rem)] sm:max-w-md max-h-[90dvh] overflow-y-auto bg-[#0f151b] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0c1116]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#00c365]" />
            <span className="text-xs font-semibold text-slate-300">Coming soon · Get updates</span>
          </div>
          <button
            aria-label="Close launch updates" disabled={isSubmitting} onClick={closeWaitlist}
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
              <h4 className="font-bold text-lg text-white">
                {alreadyJoined ? 'Already on the list' : "You're on the launch list"}
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                {alreadyJoined
                  ? `Your contact is already confirmed. We will notify you via ${channel} as soon as `
                  : `We will notify you via ${channel} as soon as `}
                <span className="text-white font-medium">{waitlistInfo.serviceTitle}</span> goes live in Ghana.
              </p>
              <button type="button" onClick={closeWaitlist} className="mh-button w-full">Done</button>
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
                  This service is being prepared. Join the launch list for availability updates.
                </p>
              </div>

              {errorMessage && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <p className="leading-snug">{errorMessage}</p>
                </div>
              )}

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
                    placeholder={channel === 'email' ? 'you@domain.com' : 'e.g. 024 XXX XXXX'}
                    required
                    className="w-full bg-[#0a0e12] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,195,101,0.25)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Registering...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span>Notify Me at Launch</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
