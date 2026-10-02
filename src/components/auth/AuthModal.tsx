import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';
import { X, Lock, Phone, User as UserIcon, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { registerOnServer, loginOnServer } from '../../services/apiClient';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuth,
    authMode,
    openAuth,
    loginUser,
    showToast,
    authContextMessage,
  } = useApp();

  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState(''); // phone or email
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const isSignup = authMode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim() || !password || (isSignup && !name.trim())) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      if (isSignup) {
        const res = await registerOnServer({
          name: name.trim(),
          identifier: identifier.trim(),
          password,
          rememberMe,
        });

        setName('');
        setIdentifier('');
        setPassword('');
        loginUser(res.user, res.token, rememberMe);
      } else {
        const res = await loginOnServer({
          identifier: identifier.trim(),
          password,
          rememberMe,
        });

        setName('');
        setIdentifier('');
        setPassword('');
        loginUser(res.user, res.token, rememberMe);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      setErrorMessage(msg);
      showToast(msg, 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-[calc(100vw-1rem)] sm:max-w-md bg-[#0f151b] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
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

            {isSignup && (
              <div className="flex flex-wrap gap-1.5 pt-2.5">
                <span className="px-2 py-0.5 rounded-md bg-[#00c365]/10 border border-[#00c365]/20 text-[#00c365] text-[11px] font-medium">
                  ✓ Track orders across devices
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#00c365]/10 border border-[#00c365]/20 text-[#00c365] text-[11px] font-medium">
                  ✓ Website Builder identity
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#00c365]/10 border border-[#00c365]/20 text-[#00c365] text-[11px] font-medium">
                  ✓ Mystery Earn active rewards
                </span>
              </div>
            )}

            {authContextMessage && (
              <div className="mt-3 p-3 rounded-xl bg-[#00c365]/10 border border-[#00c365]/30 text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                <ShieldCheck className="w-4 h-4 text-[#00c365] shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">{authContextMessage}</p>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="leading-snug">{errorMessage}</p>
            </div>
          )}

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
                    placeholder="e.g. Kwame Asante or Akwaaba Ventures"
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
                  onClick={() => {
                    setErrorMessage(null);
                    openAuth('login');
                  }}
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
                  onClick={() => {
                    setErrorMessage(null);
                    openAuth('signup');
                  }}
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
