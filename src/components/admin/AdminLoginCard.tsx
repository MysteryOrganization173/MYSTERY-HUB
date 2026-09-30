import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';
import { Shield, Lock, Phone, Mail, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { loginOnServer } from '../../services/apiClient';

export const AdminLoginCard: React.FC = () => {
  const { loginUser, setActivePage, showToast } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim()) {
      setErrorMessage('Please enter your staff email or phone number.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await loginOnServer({
        identifier: identifier.trim(),
        password,
        rememberMe,
      });

      if (response && response.user && response.token) {
        loginUser(response.user, response.token, rememberMe);

        if (response.user.role === 'admin') {
          showToast(`Welcome back, Admin ${response.user.name.split(' ')[0]}!`, 'success');
        } else {
          showToast('Signed in successfully. Note: Staff privileges are required for the Admin dashboard.', 'info');
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[#0f171d] border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#00c365]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative text-center space-y-3 pb-6 border-b border-slate-800/80">
          <div className="flex justify-center">
            <BrandLogo size="md" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-[#00c365]">
            <Shield className="w-3.5 h-3.5 text-[#00c365]" />
            <span>Mystery Hub Staff & Operations Portal</span>
          </div>
          <p className="text-xs text-slate-400">
            Sign in with authorized administrator credentials to manage orders, customer accounts, waitlists, and system operations.
          </p>
        </div>

        {errorMessage && (
          <div className="mt-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Staff Email or Ghana Phone
            </label>
            <div className="relative">
              <input
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="admin@mysterybundlehub.com or 0592066298"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-[#00c365] focus:outline-none text-sm text-white placeholder:text-slate-600 font-mono transition-colors"
                autoComplete="username"
                disabled={isLoading}
              />
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                {identifier.includes('@') ? (
                  <Mail className="w-4 h-4" />
                ) : (
                  <Phone className="w-4 h-4" />
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Admin Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-[#00c365] focus:outline-none text-sm text-white placeholder:text-slate-600 transition-colors"
                autoComplete="current-password"
                disabled={isLoading}
              />
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-[#00c365] focus:ring-0 focus:ring-offset-0"
              />
              <span>Keep me signed in</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] disabled:bg-slate-800 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#00c365]/20 hover:shadow-[#00c365]/30 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <span>Sign In to Admin Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <button
            onClick={() => setActivePage('home')}
            className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            ← Return to Customer Storefront
          </button>
        </div>
      </div>
    </div>
  );
};
