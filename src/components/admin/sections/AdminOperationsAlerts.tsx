import { leadAlertLabel, leadDestination } from '../../../../shared/leadOperations';
import type { PaidOrderAlert } from '../../../../shared/adminAlerts';
import type { useLeadAlerts } from '../leadAlerts';
import type { AdminSignals } from '../adminSignals';
import { AdminButton, Freshness, StatusPill } from '../ui/AdminUi';

export type AlertState = ReturnType<typeof useLeadAlerts>;
type AlertTab = 'orders' | 'marketplace' | 'websites' | 'system';
const orderLabels: Record<PaidOrderAlert['reason'], string> = {
  supplier_uncertain: 'Supplier acceptance uncertain',
  refund_exception: 'Customer refund or remedy needs review',
  fulfilment_failed: 'Fulfilment failed after payment',
  flagged: 'Flagged for staff review',
};

export function AdminOperationsAlerts({ alerts, supplier, navigate }: {
  alerts: AlertState;
  supplier?: Pick<AdminSignals, 'supplierAlert' | 'supplierUnavailable' | 'supplierCheckedAt'>;
  navigate: (tab: AlertTab, param?: string) => void;
}) {
  if (alerts.denied) return <p role="alert" className="text-sm text-amber-200">Staff access could not be verified. Sign in again to review alerts.</p>;
  const orders = [...(alerts.orders?.orders ?? [])].sort((a, b) => Number(a.reason === 'flagged') - Number(b.reason === 'flagged'));
  const sources = ['ultra', 'marketplace'] as const;
  const openLead = (source: typeof sources[number], reference: string) => {
    const { tab, param } = leadDestination(source, reference);
    navigate(tab, param);
  };

  return <div className="min-w-0 space-y-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-slate-400">{alerts.loading ? 'Checking alerts…' : 'Order and enquiry checks update once a minute while Admin is visible.'}</p>
      <AdminButton disabled={alerts.refreshing} onClick={alerts.refresh}>{alerts.refreshing ? 'Refreshing alerts…' : 'Refresh alerts'}</AdminButton>
    </div>
    <section aria-label="Paid orders">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-white">Paid orders needing attention{alerts.orders ? ` · ${alerts.orders.total}` : ''}</h3>
        <Freshness at={alerts.orders?.checkedAt} prefix="Checked" />
      </div>
      {alerts.orderError && <p role="status" className="mt-1 text-xs text-amber-200">{alerts.orderError} {alerts.orders ? 'Showing the last successful check.' : 'Use Refresh alerts to retry.'}</p>}
      {alerts.orders && !orders.length && !alerts.orderError && <p className="mt-1 text-slate-400">No paid orders in the attention queue at the last check.</p>}
      {!!orders.length && <ul className="mt-2 divide-y divide-slate-800">{orders.map(order => <li key={order.reference}>
        <button type="button" className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-lg py-2 text-left hover:bg-slate-800/50 focus-visible:bg-slate-800/50" onClick={() => navigate('orders', `ref/${order.reference}`)}>
          <span className="min-w-0">
            <span className="block text-slate-200">{orderLabels[order.reason]}</span>
            <span className="block break-all font-mono text-xs text-slate-400">{order.reference}</span>
            {order.reason === 'supplier_uncertain' && <span className="block text-xs text-slate-400">Check supplier acceptance before taking action. Do not resubmit.</span>}
          </span>
          <StatusPill tone={order.reason === 'flagged' ? 'warning' : 'danger'}>{order.reason === 'flagged' ? 'Action required' : 'Critical'}</StatusPill>
        </button>
      </li>)}</ul>}
      {alerts.orders && alerts.orders.total > orders.length && <p className="text-xs text-slate-400">Showing {orders.length} paid cases, with critical cases first.</p>}
      <AdminButton variant="ghost" onClick={() => navigate('orders', 'needs_attention')}>Open full attention queue</AdminButton>
    </section>
    <section aria-label="Business enquiries" className="border-t border-slate-800 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-white">New enquiries</h3>
        <Freshness at={alerts.data?.checkedAt} prefix="Checked" />
      </div>
      {alerts.error && <p role="status" className="mt-1 text-xs text-amber-200">{alerts.error} {alerts.data ? 'Showing the last successful check.' : 'Use Refresh alerts to retry.'}</p>}
      {alerts.data && sources.map(source => {
        const summary = alerts.data![source];
        return <div key={source} className="mt-2">
          <div className="flex flex-wrap items-center gap-x-3">
            <AdminButton variant="ghost" onClick={() => openLead(source, 'new')}>{source === 'ultra' ? 'Ultra' : 'Marketplace and Creative Studio'} · {summary.new} new</AdminButton>
            {summary.overdue > 0 && <AdminButton variant="ghost" onClick={() => openLead(source, 'overdue')}>{summary.overdue} overdue</AdminButton>}
          </div>
          <ul className="divide-y divide-slate-800">{summary.latestNew.map(row => <li key={row.id}>
            <button type="button" className="block min-h-11 w-full rounded-lg py-2 text-left hover:bg-slate-800/50 focus-visible:bg-slate-800/50" onClick={() => openLead(source, row.reference)}>
              <span className="block text-slate-200">{leadAlertLabel(source, row)}</span>
              <span className="block break-all font-mono text-xs text-slate-400">{row.reference}</span>
            </button>
          </li>)}</ul>
        </div>;
      })}
    </section>
    {supplier && <section aria-label="Supplier health" className="border-t border-slate-800 pt-4">
      <h3 className="font-semibold text-white">Supplier health</h3>
      <p className="mt-1 text-xs text-slate-400">{supplier.supplierUnavailable ? 'The latest supplier overview check was unavailable.' : supplier.supplierAlert ? 'The last overview check flagged the supplier wallet or connection.' : 'Open System Health to check the wallet, connection and effective dispatch.'}</p>
      <Freshness at={supplier.supplierCheckedAt} prefix="Last overview check" />
      <div><AdminButton variant="ghost" onClick={() => navigate('system')}>Open System Health</AdminButton></div>
    </section>}
  </div>;
}
