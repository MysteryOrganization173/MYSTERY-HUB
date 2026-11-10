import React, {useCallback, useEffect, useRef, useState} from 'react';
import {commercialRequest} from '../../../services/commercialApi';
import {AdminPanel, AdminButton, StatusPill} from '../ui/AdminUi';
import {isSupplierRoutingOverview, type SupplierRoutingOverview} from '../../../../shared/supplierRouting';

const names = {data: 'Standard Data', airtime: 'Airtime', instant_bundle: 'Instant Bundles'};
/** Configuration only. This does not request supplier health, change routes or activate providers. */
export function AdminSupplierRouting({token}: {token: string}) {
  const [data, setData] = useState<{token: string; value: SupplierRoutingOverview} | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const generation = useRef(0), controller = useRef<AbortController | null>(null), busy = useRef(false);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const id = ++generation.current, request = new AbortController(); controller.current = request;
    const timer = setTimeout(() => request.abort(), 10_000);
    setLoading(true); setError(''); setData(null);
    try {
      const value = await commercialRequest('admin/commercial/supplier-routing', token, undefined, request.signal);
      if (!isSupplierRoutingOverview(value)) throw Error('Invalid routing overview');
      if (id === generation.current && !request.signal.aborted) setData({token, value});
    } catch { if (id === generation.current) setError('Supplier routing could not be loaded. Refresh to try again.'); }
    finally { clearTimeout(timer); if (id === generation.current) {busy.current = false; setLoading(false);} }
  }, [token]);
  useEffect(() => {
    generation.current++; controller.current?.abort(); busy.current = false; setData(null); void refresh();
    return () => {generation.current++; controller.current?.abort(); busy.current = false;};
  }, [refresh]);
  const snapshot = data?.token === token ? data.value : null;
  return <AdminPanel title="Supplier Routing" description="Effective server configuration · Read only" actions={<AdminButton disabled={loading} onClick={() => void refresh()}>{loading ? 'Loading…' : 'Refresh routing'}</AdminButton>}>
    <div className="min-w-0 space-y-4">
      <p className="text-sm text-slate-300">Success Biz Hub remains the configured supplier for existing telecom routes. TELCOGH is inactive. This overview is configuration, not proof of supplier availability; use Service readiness for current checks.</p>
      {loading && <p role="status">Loading supplier routes…</p>}
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {snapshot && <>
        <div className="grid gap-3 lg:grid-cols-2">{snapshot.providers.map(provider => <section key={provider.id} className="min-w-0 space-y-2 rounded-xl border border-slate-800 p-3">
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{provider.name}</h3><StatusPill tone={provider.acceptsNewOrders ? 'success' : 'warning'}>{provider.acceptsNewOrders ? 'Configured route' : 'Inactive / unavailable'}</StatusPill></div>
          <p className="break-words text-xs text-slate-400">{provider.id}</p>
          <p className="text-sm">Implemented: {provider.implementedServices.map(s => names[s]).join(', ') || 'None'}<br/>Planned: {provider.plannedServices.map(s => names[s]).join(', ') || 'None'}<br/>Networks: {provider.networks.join(', ').toUpperCase() || 'Not qualified'}</p>
          <p className="text-sm text-slate-400">Configured: {provider.configured ? 'Yes' : 'No'} · Qualified adapter: {provider.qualified ? 'Yes' : 'No'}</p>
          <p className="text-sm text-amber-200">{provider.restriction}</p>
        </section>)}</div>
        <ul className="grid gap-2 text-sm sm:grid-cols-3" aria-label="Effective telecom routes">{snapshot.routes.map(route => <li key={`${route.service}:${route.network}`} className="min-w-0 rounded-lg bg-slate-950 p-3"><span className="block font-medium">{names[route.service]} · {route.network.toUpperCase()}</span><span className="text-slate-400">{snapshot.providers.find(p => p.id === route.providerId)?.name || 'Unknown supplier'}</span></li>)}</ul>
        <p className="text-xs text-slate-400">Existing orders retain their original supplier. No automatic failover. AFA, Results Checkers and Marketplace retain their separate workflows. Draft routing and supplier activation are not available in this release.</p>
      </>}
    </div>
  </AdminPanel>;
}
