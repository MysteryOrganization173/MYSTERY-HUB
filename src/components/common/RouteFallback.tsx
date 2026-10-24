import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

/** Holds the page's space while its code arrives. The indicator waits a moment, so fast loads never flash it. */
export const RouteFallback: React.FC = () => (
  <div className="mh-route-fallback" role="status" aria-live="polite">
    <span className="mh-route-fallback-indicator"><span aria-hidden="true" />Loading…</span>
  </div>
);

/** A download failure asks for a connection check; a fault inside the page says so instead of blaming the network. */
export const RouteLoadError: React.FC<{ reason?: 'download' | 'page' }> = ({ reason = 'download' }) => {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const page = reason === 'page' && !offline;
  return (
    <div className="mh-route-fallback" role="alert">
      <div className="max-w-sm text-center px-4">
        {page ? <AlertTriangle className="size-6 mx-auto text-amber-300" aria-hidden="true" /> : <WifiOff className="size-6 mx-auto text-slate-400" aria-hidden="true" />}
        <h2 className="mt-3 text-lg font-semibold text-white">{offline ? 'You are offline' : page ? 'Something went wrong on this page' : 'This page did not load'}</h2>
        <p className="mt-1 text-sm text-slate-300">{offline ? 'Check your mobile data or Wi-Fi, then try again.' : page ? 'Please try again. The rest of Mystery Hub still works.' : 'Your connection may be slow. Nothing was charged or changed.'}</p>
        <button type="button" className="mh-button mt-4" onClick={() => window.location.reload()}>
          <RefreshCw className="size-4" aria-hidden="true" />Try again
        </button>
      </div>
    </div>
  );
};
