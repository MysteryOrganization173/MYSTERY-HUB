/** Synthetic read-only API fixture. No customer information, supplier traffic or pricing writes. */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminCommercialSection } from '../../../../src/components/admin/sections/AdminCommercialSection';
(window as any).__readiness = { requests: 0, fail: false, stale: false, hold: false, pending: [], count: 2 };
function Fixture() {
  const [token, setToken] = useState('synthetic-admin');
  (window as any).__readinessSession = setToken;
  return <main className="mx-auto max-w-7xl p-3 text-slate-200"><p className="mb-3 text-xs text-slate-400">Synthetic operational review — no production data</p><AdminCommercialSection token={token} /></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
