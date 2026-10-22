import React, { useEffect, useRef, useState } from 'react';
import { getAdminOrdersOnServer, type AdminOrdersResponse } from '../../../services/apiClient';
import { describeOrderCase } from '../../../utils/adminOrderCase';
import { orderEventAge } from '../../../utils/adminOrderView';
import { createAdminRequestScope } from '../../../utils/adminRequestScope';
import { AdminButton, AdminError, Freshness, StatusPill } from '../ui/AdminUi';

/** Small passive sample of the existing server queue, not a second incident classifier. */
export function AdminAttentionOrders({ token, revision, onOpen, onOpenAll }: { token: string; revision: number; onOpen: (reference: string) => void; onOpenAll: () => void }) {
  const [data, setData] = useState<AdminOrdersResponse | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [retry, setRetry] = useState(0);
  const scope = useRef(createAdminRequestScope()).current;
  scope.setContext(token);
  useEffect(() => {
    const current = scope.begin('queue');
    setBusy(true); setError(null);
    getAdminOrdersOnServer(token, { status: 'needs_attention', page: 1, limit: 5 })
      .then(result => { if (!result.success) throw new Error('Attention orders were not returned.'); if (current()) { setData(result); setAt(Date.now()); } })
      .catch(err => { if (current()) setError(err instanceof Error ? err.message : 'The attention queue could not load.'); })
      .finally(() => { if (current()) setBusy(false); });
    return () => scope.invalidate('queue');
  }, [token, revision, retry, scope]);
  return <div className="mt-4 border-t border-slate-800 pt-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-white">Orders to investigate</h3><Freshness at={at} /></div>
    {busy && <p role="status" className="mb-2 text-xs text-slate-400">Refreshing attention orders…</p>}
    {error && <AdminError title={data ? 'Queue refresh failed · last loaded records' : 'Attention queue unavailable'} message={error} onRetry={() => setRetry(n => n + 1)} />}
    {data && !data.orders.length && <p className="text-sm text-slate-400">No actionable orders in the last successful queue check. Normal processing and unpaid attempts are not automatically incidents.</p>}
    {!!data?.orders.length && <ul className="divide-y divide-slate-800/70">{data.orders.map(order => {
      const kase = describeOrderCase(order);
      return <li key={order.id}><button type="button" onClick={() => onOpen(order.public_reference)} className="w-full space-y-2 rounded-xl px-1 py-3 text-left hover:bg-slate-800/40 focus-visible:bg-slate-800/40">
        <span className="block break-all font-mono text-sm font-semibold text-white">{order.public_reference}</span>
        <span className="block text-xs text-slate-300">{order.product_name_snapshot} · {order.service_type || 'data'}{order.service_type !== 'marketplace' && ` · ${order.network.toUpperCase()}`}</span>
        <StatusPill tone={kase.tone} title={kase.label}>{kase.label}</StatusPill>
        <span className="block text-xs text-slate-400">Payment: {order.payment_status === 'success' ? 'verified' : order.payment_status === 'recorded' ? 'operator recorded' : order.payment_status === 'not_required' ? 'not required' : 'not confirmed'} · Supplier: {order.supplier_order_id || 'no identifier recorded'}</span>
        <span className="block text-xs leading-relaxed text-slate-300">{kase.explanation}</span>
        <span className="block text-xs leading-relaxed text-slate-400">Next: {kase.nextStep}</span>
        <span className="block text-xs text-slate-500">Order updated: {orderEventAge(order.updated_at)} · Open order →</span>
      </button></li>;
    })}</ul>}
    <AdminButton variant="ghost" className="mt-2" onClick={onOpenAll}>Open full attention queue{data ? ` (${data.pagination.total})` : ''}</AdminButton>
  </div>;
}
