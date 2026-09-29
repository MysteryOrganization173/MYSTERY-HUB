import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';
import { X, Lock, Phone, Mail, User as UserIcon, ArrowRight, ShieldCheck } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuth, authMode, openAuth, loginUser, showToast } = useApp();

  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState(''); // phone or email
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const isSignup = authMode === 'signup';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password || (isSignup && !name)) {
      showToast('Please complete all required fields.', 'warning');
      return;
    }

    setIsLoading(true);

    // Frontend simulation prepared for future backend endpoint (e.g. /api/auth/login)
    setTimeout(() => {
      setIsLoading(false);
      loginUser({
        name: isSignup ? name : identifier.includes('@') ? identifier.split('@')[0] : 'Kofi Mensah',
        email: identifier.includes('@') ? identifier : `${identifier.replace(/\D/g, '')}@mysteryhub.gh`,
        phone: identifier.includes('@') ? '024 123 4567' : identifier,
      });
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0f151b] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0c1116]">
          <BrandLogo size="sm" />
          <button
            onClick={closeAuth}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              {isSignup ? 'Create your Mystery Hub account' : 'Welcome back'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isSignup
                ? 'Join thousands of Ghanaians accessing cheap data and launching business websites.'
                : 'Log in to track orders, save bundles, and manage your websites.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Full Name / Business Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kofi Mensah or Akwaaba Kitchen"
                    required
                    className="w-full bg-[#0a0e12] border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c365]"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Phone Number (Ghana) or Email
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="024 123 4567 or email@domain.com"
                  required
                  className="w-full bg-[#0a0e12] border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c365]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                {!isSignup && (
                  <button
                    type="button"
                    onClick={() => showToast('Password reset link will be sent to your number/email in production.', 'info')}
                    className="text-[11px] text-[#00c365] hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-[#0a0e12] border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c365]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-[#00c365] focus:ring-0"
                />
                <span>Remember this device</span>
              </label>

              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Protected</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-sm tracking-wide transition-all shadow-[0_0_15px_rgba(0,195,101,0.25)] flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {isSignup ? 'Create Account' : 'Sign In to Hub'}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          {/* Toggle between Login and Signup */}
          <div className="text-center pt-2 text-xs text-slate-400 border-t border-slate-800">
            {isSignup ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => openAuth('login')}
                  className="text-[#00c365] font-semibold hover:underline"
                >
                  Log in here
                </button>
              </p>
            ) : (
              <p>
                Don&apos;t have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => openAuth('signup')}
                  className="text-[#00c365] font-semibold hover:underline"
                >
                  Create one now
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
