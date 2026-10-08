import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast, isCheckoutOpen, isAccountOpen, isAuthModalOpen, isStatusModalOpen, user } = useApp();

  const hideAuthFeedback = isCheckoutOpen || isAccountOpen || isAuthModalOpen || isStatusModalOpen || user?.mustChangePassword;

  if (toasts.length === 0) return null;

  return (
    <>
    {toasts.filter(toast=>toast.key==='auth').map(toast=><div key={toast.id} role="status" aria-live="polite" aria-atomic="true" className={hideAuthFeedback?'sr-only':'fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-4 left-1/2 -translate-x-1/2 z-[110] pointer-events-none flex items-center gap-2 rounded-full border border-slate-700 bg-[#121920] pl-4 pr-1 text-xs text-slate-100 shadow-lg'}><CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true"/>{toast.message}{!hideAuthFeedback&&<button className="pointer-events-auto min-h-11 min-w-11 flex items-center justify-center rounded-full" onClick={()=>removeToast(toast.id)} aria-label="Dismiss account feedback"><X className="size-3.5"/></button>}</div>)}
    <div className="fixed top-20 inset-x-3 sm:left-auto sm:right-4 z-[110] flex flex-col gap-2 sm:max-w-sm pointer-events-none">
      {toasts.filter(toast=>toast.key!=='auth').map((toast) => {
        return (
          <div
            key={toast.id}
            role={toast.type==='warning'?'alert':'status'}
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-[#121920] border border-slate-700/80 shadow-2xl text-white text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {toast.type === 'success' && (
              <CheckCircle2 className="w-5 h-5 text-[#00c365] shrink-0 mt-0.5" />
            )}
            {toast.type === 'info' && (
              <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            )}
            {toast.type === 'warning' && (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium leading-relaxed">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white min-w-11 min-h-11 flex items-center justify-center"
              aria-label="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div></>
  );
};
