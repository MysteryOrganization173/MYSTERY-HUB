import React, { useEffect, useState, useCallback } from 'react';
import { AdminEarnPulse } from './AdminEarnPulse';
import { AdminOverviewMetrics, getAdminSystemOnServer } from '../../../services/apiClient';
import { loadAdminOverview } from '../adminSignals';
import { marketplaceControlRequest } from '../../../services/marketplaceControls';
import { financeRequest } from '../../../services/financeApi';
import {
  AdminPageHeader, AdminStat, AdminPanel, AdminError, AdminLoading, StatusPill, Freshness, RefreshButton, SectionHeading,
  DefinitionList, AdminButton, ghsMajor, type AdminTone,
} from '../ui/AdminUi';
import { AlertTriangle, CheckCircle2, ChevronRight, Truck, Wallet, MessageSquare, PackageSearch, ClipboardList, CreditCard } from 'lucide-react';

type OverviewTab = 'orders' | 'marketplace' | 'waitlist' | 'customers' | 'system' | 'earn' | 'finance';
interface AdminOverviewSectionProps {
  sessionToken: string;
  onNavigateTab: (tab: OverviewTab, param?: string) => void;
  onRefreshed?: () => void;
}

interface SystemSnapshot { paystack?: { status: string; mode: string }; database?: { status: string }; successBizHub?: { lowBalanceThresholdGhc?: number }; fulfilmentPipeline?: { status: string; autoDispatch: boolean; uncertainSubmissionCount: number } }
interface AttentionItem { id: string; tone: AdminTone; icon: React.ReactNode; title: string; detail: string; action: string; open: () => void }

/**
 * Command centre: answers "what needs me now?" first, then today's numbers, then health,
 * then longer-range money context. Every figure is server-derived; labels say exactly
 * what each number counts because several share a name but not a meaning.
 */
export const AdminOverviewSection: React.FC<AdminOverviewSectionProps> = ({ sessionToken, onNavigateTab, onRefreshed }) => {
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [system, setSystem] = useState<SystemSnapshot | null>(null);
  const [marketplace, setMarketplace] = useState<{ newInquiries?: number; needsReview?: number; drafts?: number } | null>(null);
  const [withdrawals, setWithdrawals] = useState<{ waiting: number; reviewNeeded: number } | null>(null);
  const [sideErrors, setSideErrors] = useState<string[]>([]);

  const fetchOverview = useCallback(async (force = false) => {
    if (force) setIsRefreshing(true); else setIsLoading(true);
    setError(null);
    const errors: string[] = [];
    await Promise.all([
      loadAdminOverview(sessionToken, force).then(result => { setMetrics(result.metrics); setLoadedAt(result.at); }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to fetch overview metrics.')),
      getAdminSystemOnServer(sessionToken).then(data => setSystem((data.system?.components as unknown as SystemSnapshot) || null)).catch(() => errors.push('System health')),
      marketplaceControlRequest('metrics', sessionToken).then(data => setMarketplace(data.metrics || null)).catch(() => errors.push('Marketplace')),
      financeRequest<Array<{ state: string; restricted?: boolean; earn?: { reconciliationRequired?: boolean } }>>(sessionToken, '/withdrawals?offset=0', undefined, true)
        .then(rows => setWithdrawals({ waiting: rows.filter(r => ['pending_review', 'approved'].includes(r.state)).length, reviewNeeded: rows.filter(r => ['pending_review', 'approved'].includes(r.state) && (r.restricted || r.earn?.reconciliationRequired)).length }))
        .catch(() => errors.push('Withdrawals')),
    ]);
    setSideErrors(errors);
    setIsLoading(false);
    setIsRefreshing(false);
    if (force) onRefreshed?.();
  }, [sessionToken, onRefreshed]);

  useEffect(() => { void fetchOverview(); }, [sessionToken]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <AdminLoading label="Loading today's operations…" />;
  if (error || !metrics) return <div className="space-y-4"><AdminPageHeader title="Overview" /><AdminError title="Overview could not load" message={error || 'Unknown server response'} onRetry={() => void fetchOverview(true)} /></div>;

  const { today, last7Days, allTime, supplier } = metrics;
  const threshold = system?.successBizHub?.lowBalanceThresholdGhc;
  const attention: AttentionItem[] = [];
  if (supplier.isLowBalance && supplier.balanceGhc !== null) attention.push({ id: 'supplier-low', tone: 'danger', icon: <Wallet className="h-5 w-5" />, title: `Supplier wallet is low: ${ghsMajor(supplier.balanceGhc)}`, detail: `Below the ${threshold != null ? ghsMajor(threshold) : 'configured'} safety threshold. Top up Success Biz Hub so data and airtime keep delivering. This alert only refreshes when the admin loads; there is no push notification yet.`, action: 'Open System Health', open: () => onNavigateTab('system') });
  if (supplier.status === 'error') attention.push({ id: 'supplier-error', tone: 'danger', icon: <Truck className="h-5 w-5" />, title: 'Supplier balance check failed', detail: 'Mystery Hub could not reach Success Biz Hub just now. Deliveries may be affected.', action: 'Open System Health', open: () => onNavigateTab('system') });
  if (supplier.status === 'connected' && !supplier.fulfilmentEnabled) attention.push({ id: 'dispatch-off', tone: 'warning', icon: <Truck className="h-5 w-5" />, title: 'Automatic supplier dispatch is off', detail: 'Paid data and airtime orders will wait in the queue until dispatch is enabled.', action: 'Open System Health', open: () => onNavigateTab('system') });
  if ((system?.fulfilmentPipeline?.uncertainSubmissionCount || 0) > 0) attention.push({ id: 'uncertain', tone: 'danger', icon: <AlertTriangle className="h-5 w-5" />, title: `${system!.fulfilmentPipeline!.uncertainSubmissionCount} supplier submission${system!.fulfilmentPipeline!.uncertainSubmissionCount === 1 ? '' : 's'} uncertain`, detail: 'The supplier may or may not have accepted these. Never resubmit; reconcile them first.', action: 'Review orders', open: () => onNavigateTab('orders', 'needs_attention') });
  if (allTime.manualReviewPendingCount > 0) attention.push({ id: 'orders', tone: 'warning', icon: <PackageSearch className="h-5 w-5" />, title: `${allTime.manualReviewPendingCount} order${allTime.manualReviewPendingCount === 1 ? '' : 's'} need attention`, detail: `All dates. Includes flagged orders, failed paid orders and open refunds${allTime.unresolvedPaidCount ? `; ${allTime.unresolvedPaidCount} paid customer${allTime.unresolvedPaidCount === 1 ? ' has' : 's have'} no recorded remedy yet` : ''}.`, action: 'Open Needs Attention', open: () => onNavigateTab('orders', 'needs_attention') });
  if (withdrawals?.waiting) attention.push({ id: 'withdrawals', tone: 'warning', icon: <CreditCard className="h-5 w-5" />, title: `${withdrawals.waiting} withdrawal request${withdrawals.waiting === 1 ? '' : 's'} waiting`, detail: `Approving records your decision; you still send the MoMo payout yourself and then mark it paid.${withdrawals.reviewNeeded ? ` ${withdrawals.reviewNeeded} need reconciliation first.` : ''}`, action: 'Open requests', open: () => onNavigateTab('finance', 'requests') });
  if (marketplace?.newInquiries) attention.push({ id: 'inquiries', tone: 'info', icon: <MessageSquare className="h-5 w-5" />, title: `${marketplace.newInquiries} new marketplace inquir${marketplace.newInquiries === 1 ? 'y' : 'ies'}`, detail: 'Customers are waiting for a reply about a product.', action: 'Open inquiries', open: () => onNavigateTab('marketplace', 'inquiries') });
  if (allTime.pendingWaitlist > 0) attention.push({ id: 'waitlist', tone: 'neutral', icon: <ClipboardList className="h-5 w-5" />, title: `${allTime.pendingWaitlist} launch request${allTime.pendingWaitlist === 1 ? '' : 's'} pending`, detail: 'People asked to be told when a service launches.', action: 'Open launch requests', open: () => onNavigateTab('waitlist') });

  const paystackLive = system?.paystack?.mode?.startsWith('Live');
  const recordedMarginGhc = allTime.estimatedGrossMarginGhc;

  return (
    <div className="space-y-7">
      <AdminPageHeader
        eyebrow={new Date().toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long' })}
        title="Overview"
        description="What needs you now, what happened today and whether payments and the supplier are healthy."
        actions={<><Freshness at={loadedAt} /><RefreshButton onClick={() => void fetchOverview(true)} busy={isRefreshing} /></>}
      />

      {/* 1. Attention queue */}
      <section className="space-y-3" aria-labelledby="attention-heading">
        <SectionHeading><span id="attention-heading">Needs your attention</span></SectionHeading>
        {attention.length ? (
          <ul className="space-y-2">
            {attention.map(item => (
              <li key={item.id}>
                <button type="button" onClick={item.open} className={`flex w-full items-start gap-3 rounded-2xl border bg-[#0d151b] p-4 text-left transition-colors hover:border-slate-600 ${item.tone === 'danger' ? 'border-rose-500/40' : item.tone === 'warning' ? 'border-amber-500/35' : 'border-slate-800'}`}>
                  <span className={`mt-0.5 shrink-0 ${item.tone === 'danger' ? 'text-rose-300' : item.tone === 'warning' ? 'text-amber-300' : item.tone === 'info' ? 'text-sky-300' : 'text-slate-400'}`}>{item.icon}</span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-[15px] font-semibold text-white">{item.title}</span>
                    <span className="block text-sm leading-relaxed text-slate-400">{item.detail}</span>
                    <span className="inline-flex items-center gap-1 pt-0.5 text-sm font-semibold text-[#00c365]">{item.action}<ChevronRight className="h-4 w-4" /></span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm text-emerald-200">
            <CheckCircle2 className="h-5 w-5 shrink-0" />Nothing needs action right now. Orders, supplier balance, withdrawals and inquiries are all clear.
          </div>
        )}
        {sideErrors.length > 0 && <p className="text-xs text-amber-300">Could not check: {sideErrors.join(', ')}. Those areas may still need attention.</p>}
      </section>

      {/* 2. Today */}
      <section className="space-y-3" aria-labelledby="today-heading">
        <SectionHeading action={<span className="text-xs text-slate-500">Orders created since midnight, Ghana time (GMT)</span>}><span id="today-heading">Today</span></SectionHeading>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminStat label="Customer payments" value={ghsMajor(today.revenueGhc)} tone="accent" hint={`${today.ordersCount} paid order${today.ordersCount === 1 ? '' : 's'}. Money received, not profit; includes orders later refunded.`} />
          <AdminStat label="Delivered" value={today.deliveredCount} tone="success" hint="Today's orders confirmed delivered." onClick={() => onNavigateTab('orders', 'delivered')} actionLabel="View delivered" />
          <AdminStat label="In progress" value={today.processingCount} tone="info" hint="Queued, submitted or processing with the supplier." onClick={() => onNavigateTab('orders', 'processing')} actionLabel="View with supplier" />
          <AdminStat label="Needs attention" value={today.attentionCount} tone={today.attentionCount ? 'warning' : 'neutral'} hint="Today's orders that are failed, flagged or awaiting a refund." onClick={() => onNavigateTab('orders', 'needs_attention')} actionLabel="Review" />
        </div>
      </section>

      {/* 3. Health */}
      <section className="space-y-3" aria-labelledby="health-heading">
        <SectionHeading action={<button type="button" onClick={() => onNavigateTab('system')} className="text-xs font-semibold text-[#00c365]">System Health</button>}><span id="health-heading">Payments and fulfilment health</span></SectionHeading>
        <div className="grid gap-3 md:grid-cols-3">
          <AdminPanel>
            <div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-400">Supplier wallet</p><StatusPill tone={supplier.status === 'connected' ? supplier.isLowBalance ? 'danger' : 'success' : supplier.status === 'error' ? 'danger' : 'neutral'}>{supplier.status === 'connected' ? supplier.isLowBalance ? 'Low balance' : 'Connected' : supplier.status === 'error' ? 'Unreachable' : 'Not configured'}</StatusPill></div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-white">{supplier.balanceGhc !== null ? ghsMajor(supplier.balanceGhc) : 'Unavailable'}</p>
            <p className="mt-1 text-xs text-slate-500">Success Biz Hub balance, read live when this page loaded.{threshold != null ? ` Alert threshold ${ghsMajor(threshold)}.` : ''}</p>
          </AdminPanel>
          <AdminPanel>
            <div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-400">Automatic dispatch</p><StatusPill tone={supplier.fulfilmentEnabled ? 'success' : 'warning'}>{supplier.fulfilmentEnabled ? 'On' : 'Off'}</StatusPill></div>
            <p className="mt-2 text-sm text-slate-300">{supplier.fulfilmentEnabled ? (system?.fulfilmentPipeline && !system.fulfilmentPipeline.autoDispatch ? 'Enabled, but held because Paystack is in test mode.' : 'Paid data and airtime orders go to the supplier automatically.') : 'Paid orders wait in the queue until dispatch is switched on.'}</p>
          </AdminPanel>
          <AdminPanel>
            <div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-400">Payments (Paystack)</p><StatusPill tone={!system?.paystack ? 'neutral' : system.paystack.status !== 'configured' ? 'danger' : paystackLive ? 'success' : 'warning'}>{!system?.paystack ? 'Unknown' : system.paystack.status !== 'configured' ? 'Not configured' : paystackLive ? 'Live' : 'Test mode'}</StatusPill></div>
            <p className="mt-2 text-sm text-slate-300">{system?.paystack ? 'Shows whether keys are configured and which mode they use. It does not prove a transaction succeeded; each order shows its own verified payment.' : 'System Health could not be read.'}</p>
          </AdminPanel>
        </div>
      </section>

      {/* 4. Last 7 days */}
      <section className="space-y-3" aria-labelledby="week-heading">
        <SectionHeading><span id="week-heading">Last 7 days</span></SectionHeading>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminStat label="Customer payments" value={ghsMajor(last7Days.revenueGhc)} hint="Paid orders created in the last 7 days." />
          <AdminStat label="Paid orders" value={last7Days.ordersCount} hint="All services." onClick={() => onNavigateTab('orders')} actionLabel="View orders" />
          <AdminStat label="Data bundle orders" value={last7Days.dataOrdersCount} hint="Paid, standard data." />
          <AdminStat label="Airtime orders" value={last7Days.airtimeOrdersCount} hint="Paid airtime top-ups." />
        </div>
      </section>

      {/* 5. Money context: all time */}
      <AdminPanel title="All-time order money" description="Paid orders since launch. Wallet balances, Earn liabilities and withdrawals live in the Financial Control Room."
        actions={<AdminButton onClick={() => onNavigateTab('finance')}>Open Finance</AdminButton>}>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <DefinitionList items={[
            ['Paid orders', allTime.ordersCount.toLocaleString()],
            ['Customer payments received', ghsMajor(allTime.revenueGhc)],
            ['Supplier cost recorded', ghsMajor(allTime.supplierCostGhc)],
            [<span key="m">Payments minus recorded cost <span className="text-slate-500">(estimate)</span></span>, recordedMarginGhc !== null ? ghsMajor(recordedMarginGhc) : 'Not enough cost data'],
          ]} />
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm leading-relaxed text-slate-300">
            <p className="font-semibold text-amber-200">Read the estimate carefully</p>
            <p className="mt-1">It is not profit. It still counts payments that were later refunded, and orders with no recorded supplier cost (for example marketplace items) are treated as if they cost nothing. Rewards, fees and wallet liabilities are not deducted.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <AdminStat label="Customer accounts" value={allTime.totalCustomers.toLocaleString()} onClick={() => onNavigateTab('customers')} actionLabel="Customers" />
          <AdminStat label="Launch requests" value={allTime.totalWaitlist.toLocaleString()} hint={`${allTime.pendingWaitlist} pending`} onClick={() => onNavigateTab('waitlist')} actionLabel="Open" />
          <AdminStat label="Products needing review" value={marketplace?.needsReview ?? '—'} hint="Missing information before publishing." onClick={() => onNavigateTab('marketplace')} actionLabel="Marketplace" />
        </div>
      </AdminPanel>

      <AdminEarnPulse sessionToken={sessionToken} onOpen={() => onNavigateTab('earn')} />
    </div>
  );
};
