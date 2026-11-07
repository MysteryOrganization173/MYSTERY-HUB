import React, { useCallback, useEffect, useRef, useState } from 'react';
import { commercialRequest } from '../../../services/commercialApi';
import { AdminPanel, StatusPill, AdminButton } from '../ui/AdminUi';
import { formatGhs } from '../../../../shared/money';
import { isCommercialReadiness, type CommercialReadiness } from '../../../../shared/serviceReadiness';

const flag = (value: boolean | null) => value === null ? 'Unverified' : value ? 'Yes' : 'No';
const stateLabel = { checks_passed: 'Supplier checks passed', disabled: 'Disabled', unavailable: 'Unavailable', unverified: 'Unverified' };
const cash = (value: number | null) => value === null ? 'Unverified' : formatGhs(value);

/** Readiness is independent of pricing reads. No polling, activation toggles or financial actions. */
export function AdminServiceReadiness({ token }: { token: string }) {
  const [data, setData] = useState<{ token: string; snapshot: CommercialReadiness } | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const request = useRef(0), controller = useRef<AbortController | null>(null), busy = useRef(false);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true; const generation = ++request.current, abort = new AbortController(); controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 35_000);
    setLoading(true); setError('');
    try {
      const snapshot = await commercialRequest('admin/commercial/readiness', token, undefined, abort.signal);
      if (!isCommercialReadiness(snapshot)) throw Error('Invalid readiness response');
      if (request.current === generation && !abort.signal.aborted) setData({ token, snapshot });
    } catch { if (request.current === generation) { setData(null); setError('Readiness could not be loaded. Wait a moment, then refresh. No service settings were changed.'); } }
    finally { clearTimeout(timer); if (request.current === generation) { busy.current = false; setLoading(false); } }
  }, [token]);
  useEffect(() => { request.current++; controller.current?.abort(); busy.current = false; setData(null); void refresh(); return () => { request.current++; controller.current?.abort(); busy.current = false; }; }, [refresh]);
  const snapshot = data?.token === token ? data.snapshot : null;
  const [clock, setClock] = useState(Date.now());
  // One local expiry update, not polling or another supplier request.
  useEffect(() => { setClock(Date.now()); if (!snapshot) return; const timer = setTimeout(() => setClock(Date.now()), Math.max(0, Date.parse(snapshot.expiresAt) - Date.now()) + 20); return () => clearTimeout(timer); }, [snapshot]);
  const stale = snapshot && clock >= Date.parse(snapshot.expiresAt);
  return <AdminPanel title="Service readiness & commercial operations" description="Admin V6 · Configuration, permission and catalogue evidence. This does not activate services." actions={<AdminButton onClick={() => void refresh()} disabled={loading}>{loading ? 'Checking…' : 'Refresh readiness'}</AdminButton>}>
    <div className="space-y-4">
      <p className="text-sm text-slate-400">On-demand supplier GET checks; shared for one minute to limit traffic. Wallet connectivity is separate. Recipient eligibility, wallet balance, payment verification and stock are still checked by each purchase flow. These checks do not prove a completed purchase.</p>
      <a className="inline-flex min-h-11 items-center text-sm text-emerald-300 underline focus-visible:outline-2" href="#commercial-pricing-controls">Open existing pricing & wholesale controls</a>
      {loading && <p role="status" className="text-sm text-slate-300">Checking authoritative read-only evidence…</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-900 p-3 text-sm text-rose-200">{error}</p>}
      {snapshot && <>
        <p className="text-xs text-slate-400 break-words">Snapshot started {new Date(snapshot.observedAt).toLocaleString()} · Valid until {new Date(snapshot.expiresAt).toLocaleTimeString()} · Account fingerprint {snapshot.accountFingerprint || 'unverified'}</p>
        <p className="text-xs text-slate-400">Live payment configuration present: {flag(snapshot.livePaymentConfigured)}. This is a configuration check, not payment-provider connectivity.</p>
        {stale && <p role="status" className="text-sm text-amber-200">Evidence is stale. Refresh before making an operational decision.</p>}
        <div className="grid gap-4 xl:grid-cols-2">
          {snapshot.services.map(service => <section key={service.id} aria-label={service.name} className="min-w-0 space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-white">{service.name}</h3><StatusPill tone={stale ? 'warning' : service.state === 'checks_passed' ? 'success' : service.state === 'unavailable' ? 'danger' : 'warning'}>{stale ? 'Stale evidence' : stateLabel[service.state]}</StatusPill></div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {([['Supplier configured', flag(service.supplierConfigured)], ['Key permission', flag(service.keyPermission)], ['Service key granted', flag(service.keyGranted)], ['Supplier available', flag(service.available)], ['Discovery product count', service.reportedProducts ?? 'Unverified'], ['Catalogue entries', service.catalogue.count ?? (service.catalogue.state === 'not_applicable' ? 'Not applicable' : 'Unverified')]] as const).map(([label, value]) => <div key={label}><dt className="text-xs text-slate-400">{label}</dt><dd className="break-words text-slate-200">{value}</dd></div>)}
            </dl>
            <p className="text-sm text-slate-300">{service.pricing}</p>
            {service.blockers.length > 0 && <ul className="list-disc space-y-1 pl-4 text-sm text-amber-200">{service.blockers.map((blocker, i) => <li key={i}>{blocker}</li>)}</ul>}
            {service.checkers?.map(checker => <div key={checker.name} className="space-y-1 rounded-lg border border-slate-700 p-3 text-sm"><h4 className="font-semibold">{checker.name}</h4><p>Mapping: {checker.mapping.replaceAll('_', ' ')} · Stock: {checker.stock ?? 'Unverified'}</p><p>Retail {cash(checker.retailMinor)} · Supplier {cash(checker.costMinor)} · Gross spread {cash(checker.grossSpreadMinor)}</p><p className="text-xs text-slate-400">Before payment fees, rewards and other expenses; not net profit.</p></div>)}
            <details className="text-sm"><summary className="min-h-11 cursor-pointer py-2 text-emerald-300">Catalogue evidence ({service.catalogue.state.replaceAll('_', ' ')})</summary>
              {service.catalogue.products.length ? <ul className="space-y-2">{service.catalogue.products.map((product, i) => <li key={i} className="break-words rounded-lg border border-slate-800 p-2"><span className="block text-slate-200">{product.name}</span><span className="block text-xs text-slate-400">ID/offer: {product.id} · Cost {cash(product.costMinor)}{product.stock !== null ? ` · Stock ${product.stock}` : ''}</span></li>)}</ul> : <p className="text-slate-400">No catalogue records verified for this service. AFA has no documented cost catalogue.</p>}
              {service.catalogue.count !== null && service.catalogue.count > service.catalogue.products.length && <p className="text-xs text-slate-400">Showing the first {service.catalogue.products.length} of {service.catalogue.count} entries.</p>}
            </details>
          </section>)}
        </div>
      </>}
    </div>
  </AdminPanel>;
}
