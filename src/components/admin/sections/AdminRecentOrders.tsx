import React, { useEffect, useRef, useState } from 'react';
import { getAdminOrdersOnServer } from '../../../services/apiClient';
import type { AdminOrderDetails } from '../../../../server/types/orders';
import { describeOrderCase } from '../../../utils/adminOrderCase';
import { afaStatusLabel } from '../../../../shared/afa';
import { AdminPanel, AdminButton, AdminError, StatusPill, ghs } from '../ui/AdminUi';
import { ChevronRight, Flag } from 'lucide-react';

type Scope = 'paid' | 'all';
const LIMIT = 8;

const productLabel = (order: AdminOrderDetails) =>
  order.service_type === 'airtime' ? `${order.network.toUpperCase()} Airtime` : order.product_name_snapshot;
const serviceLabel = (order: AdminOrderDetails) =>
  order.service_type === 'marketplace' ? 'Marketplace'
    : `${order.network.toUpperCase()}${order.service_type === 'instant_bundle' ? ' · Instant' : order.service_type === 'afa' ? ' · AFA' : ''}`;

/** "4 min ago" for today, otherwise a short Ghana-time date. */
function createdLabel(iso: string) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const sameDay = new Date(time).toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' }) === new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });
  return new Date(time).toLocaleString('en-GH', { timeZone: 'Africa/Accra', ...(sameDay ? {} : { month: 'short', day: 'numeric' }), hour: '2-digit', minute: '2-digit' });
}

/**
 * The newest orders, read through the existing passive admin order search. No customer contact
 * details are shown here; the order drawer in Orders & delivery holds those for the operator.
 */
export function AdminRecentOrders({ token, revision = 0, onOpenOrder, onOpenAll }: { token: string; revision?: number; onOpenOrder: (reference: string) => void; onOpenAll: () => void }) {
  const [scope, setScope] = useState<Scope>('paid');
  const [orders, setOrders] = useState<AdminOrderDetails[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const ticket = useRef(0);

  useEffect(() => {
    const current = ++ticket.current;
    setError(null);
    getAdminOrdersOnServer(token, { ...(scope === 'paid' ? { paymentStatus: 'success', status: 'all' } : {}), page: 1, limit: LIMIT })
      .then(res => { if (current === ticket.current) setOrders(res.orders); })
      .catch(err => { if (current === ticket.current) { setOrders(null); setError(err instanceof Error ? err.message : 'Latest orders could not load.'); } });
  }, [token, scope, revision, retry]);

  const scopeButton = (id: Scope, label: string) => (
    <button type="button" role="radio" aria-checked={scope === id} onClick={() => { if (scope === id) return; setOrders(null); setScope(id); }}
      className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors ${scope === id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
      {label}
    </button>
  );

  return (
    <AdminPanel
      title="Latest orders"
      description={scope === 'paid' ? 'Newest confirmed payments, any status.' : 'Every order attempt except abandoned checkouts.'}
      actions={<div role="radiogroup" aria-label="Which orders to show" className="flex rounded-xl border border-slate-800 bg-slate-950/60 p-0.5">{scopeButton('paid', 'Paid')}{scopeButton('all', 'All attempts')}</div>}
      className="flex flex-col"
    >
      {error ? <AdminError title="Latest orders could not load" message={error} onRetry={() => setRetry(n => n + 1)} />
        : !orders ? (
          <ul aria-busy="true" aria-label="Loading latest orders" className="space-y-1">
            {Array.from({ length: 5 }, (_, i) => <li key={i} className="h-14 animate-pulse rounded-xl bg-slate-800/40 motion-reduce:animate-none" />)}
          </ul>
        ) : orders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-400">{scope === 'paid' ? 'No paid orders yet.' : 'No orders yet.'}</p>
        ) : (
          <ul className="-mx-2 divide-y divide-slate-800/70">
            {orders.map(order => {
              const kase = describeOrderCase(order);
              const label = order.service_type === 'afa' && !kase.key.startsWith('resolved_') ? `AFA · ${afaStatusLabel(order.status, order.manual_review)}` : kase.label;
              return (
                <li key={order.id}>
                  <button type="button" onClick={() => onOpenOrder(order.public_reference)} aria-label={`Open order ${order.public_reference}`}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-xl px-2 py-2.5 text-left hover:bg-slate-800/40 focus-visible:bg-slate-800/40 sm:grid-cols-[minmax(0,1fr)_auto_5.5rem_1rem]">
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                        {order.manual_review && <Flag className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Flagged for review" />}
                        <span className="truncate">{productLabel(order)}</span>
                        <span className="shrink-0 text-xs font-normal text-slate-500">{serviceLabel(order)}</span>
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                        <span className="shrink-0 font-mono">{order.public_reference}</span>
                        <span aria-hidden>·</span>
                        <span className="truncate whitespace-nowrap">{createdLabel(order.created_at)}</span>
                      </span>
                    </span>
                    <span className="order-3 col-span-2 min-w-0 sm:order-none sm:col-span-1 sm:max-w-[14rem] sm:justify-self-end"><StatusPill tone={kase.tone} title={label}>{label}</StatusPill></span>
                    <span className="text-right text-sm font-semibold tabular-nums text-white">{ghs(order.amount)}</span>
                    <ChevronRight className="hidden h-4 w-4 text-slate-500 sm:block" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      <div className="mt-auto pt-3">
        <AdminButton variant="ghost" className="-ml-2" onClick={onOpenAll}>All orders<ChevronRight className="h-4 w-4" aria-hidden /></AdminButton>
      </div>
    </AdminPanel>
  );
}
