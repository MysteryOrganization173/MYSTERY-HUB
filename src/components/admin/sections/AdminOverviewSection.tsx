import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AdminAttentionOrders } from './AdminAttentionOrders';
import { createAdminRequestScope } from '../../../utils/adminRequestScope';
import { AdminBusinessSummary, ReportOrdersSheet } from './AdminBusinessSummary';
import { AdminRecentOrders } from './AdminRecentOrders';
import { AdminEarnPulse } from './AdminEarnPulse';
import { AdminOverviewMetrics, getAdminSystemOnServer } from '../../../services/apiClient';
import { loadAdminOverview } from '../adminSignals';
import { marketplaceControlRequest } from '../../../services/marketplaceControls';
import { financeRequest } from '../../../services/financeApi';
import { operationsRequest } from '../../../services/adminOperationsApi';
import type { AdminFinancialReport, ReportMetric } from '../../../../shared/adminOperations';
import {
  AdminPageHeader, AdminPanel, AdminError, AdminLoading, StatusPill, Freshness, RefreshButton,
  ghs, ghsMajor, type AdminTone,
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

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const toneIcon: Record<AdminTone, string> = { danger: 'bg-rose-500/12 text-rose-300', warning: 'bg-amber-500/12 text-amber-300', info: 'bg-sky-500/12 text-sky-300', neutral: 'bg-slate-800 text-slate-400', success: 'bg-emerald-500/12 text-emerald-300', accent: 'bg-[#00c365]/12 text-[#00c365]' };

/** One "Today" figure. Each states which population it counts, because created, paid and delivered dates differ. */
function TodayFigure({ label, value, detail, tone = 'neutral', action, onOpen, children }: { label: string; value: React.ReactNode; detail: React.ReactNode; tone?: AdminTone; action: string; onOpen: () => void; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onOpen} className="group flex min-w-0 flex-col gap-1 px-4 py-4 text-left transition-colors hover:bg-slate-900/60 focus-visible:bg-slate-900/60 sm:px-5 sm:py-5">
      <span className="text-[13px] font-medium text-slate-400">{label}</span>
      <span className={`text-[1.7rem] font-bold leading-tight tabular-nums tracking-tight sm:text-[2.1rem] ${tone === 'warning' ? 'text-amber-200' : tone === 'danger' ? 'text-rose-200' : 'text-white'}`}>{value}</span>
      {children}
      <span className="text-xs leading-relaxed text-slate-500">{detail}</span>
      <span className="mt-auto inline-flex items-center gap-0.5 pt-1 text-xs font-semibold text-[#00c365] opacity-90 group-hover:opacity-100">{action}<ChevronRight className="h-3.5 w-3.5" aria-hidden /></span>
    </button>
  );
}

/**
 * Admin Command Centre. Reading order follows the founder's day: what happened today, what needs
 * action now, the latest orders, service health, then business performance for any period.
 * Every figure is server-derived; the frontend only formats and labels it.
 */
export const AdminOverviewSection: React.FC<AdminOverviewSectionProps> = ({ sessionToken, onNavigateTab, onRefreshed }) => {
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [system, setSystem] = useState<SystemSnapshot | null>(null);
  const [todayReport, setTodayReport] = useState<AdminFinancialReport | null>(null);
  const [marketplace, setMarketplace] = useState<{ newInquiries?: number; needsReview?: number; drafts?: number } | null>(null);
  const [withdrawals, setWithdrawals] = useState<{ waiting: number; reviewNeeded: number } | null>(null);
  const [sideErrors, setSideErrors] = useState<string[]>([]);
  const [todayMetric, setTodayMetric] = useState<ReportMetric | null>(null);
  const scope = useRef(createAdminRequestScope()).current;
  scope.setContext(sessionToken);
  useEffect(() => () => scope.invalidate(), [scope, sessionToken]);

  const fetchOverview = useCallback(async (force = false) => {
    const current = scope.begin('overview');
    if (force) { setIsRefreshing(true); setRevision(n => n + 1); } else setIsLoading(true);
    setError(null);
    const errors: string[] = [];
    const results = await Promise.allSettled([
      loadAdminOverview(sessionToken, force),
      getAdminSystemOnServer(sessionToken),
      operationsRequest<{ report: AdminFinancialReport }>(sessionToken, 'report?period=today'),
      marketplaceControlRequest('metrics', sessionToken),
      financeRequest<Array<{ state: string; restricted?: boolean; earn?: { reconciliationRequired?: boolean } }>>(sessionToken, '/withdrawals?offset=0', undefined, true)
    ]);
    if (!current()) return;
    const [overview, health, report, market, payout] = results;
    if (overview.status === 'fulfilled') { setMetrics(overview.value.metrics); setLoadedAt(overview.value.at); }
    else setError(overview.reason instanceof Error ? overview.reason.message : 'Overview could not refresh.');
    if (health.status === 'fulfilled') setSystem((health.value.system?.components as unknown as SystemSnapshot) || null); else errors.push('System health');
    if (report.status === 'fulfilled') setTodayReport(report.value.report); else errors.push("Today's deliveries");
    if (market.status === 'fulfilled') setMarketplace(market.value.metrics || null); else errors.push('Marketplace');
    if (payout.status === 'fulfilled') { const rows = payout.value; setWithdrawals({ waiting: rows.filter(r => ['pending_review', 'approved'].includes(r.state)).length, reviewNeeded: rows.filter(r => ['pending_review', 'approved'].includes(r.state) && (r.restricted || r.earn?.reconciliationRequired)).length }); } else errors.push('Withdrawals');
    setSideErrors(errors);
    setIsLoading(false);
    setIsRefreshing(false);
    if (force) onRefreshed?.();
  }, [sessionToken, onRefreshed]);

  useEffect(() => { void fetchOverview(); }, [sessionToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayLabel = new Date().toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Accra' });
  if (isLoading) return <AdminLoading label="Loading today's operations…" />;
  if (!metrics) return <div className="space-y-4"><AdminPageHeader eyebrow={todayLabel} title="Overview" /><AdminError title="Overview could not load" message={error || 'Unknown server response'} onRetry={() => void fetchOverview(true)} /></div>;

  const { today, allTime, supplier } = metrics;
  const threshold = system?.successBizHub?.lowBalanceThresholdGhc;
  const uncertain = system?.fulfilmentPipeline?.uncertainSubmissionCount || 0;
  const attention: AttentionItem[] = [];
  if (supplier.isLowBalance && supplier.balanceGhc !== null) attention.push({ id: 'supplier-low', tone: 'danger', icon: <Wallet className="h-[18px] w-[18px]" />, title: `Supplier wallet is low: ${ghsMajor(supplier.balanceGhc)}`, detail: `Below the ${threshold != null ? ghsMajor(threshold) : 'configured'} threshold. Top up Success Biz Hub so data and airtime keep delivering. Checked when this page loaded; there is no push alert yet.`, action: 'System Health', open: () => onNavigateTab('system') });
  if (supplier.status === 'error') attention.push({ id: 'supplier-error', tone: 'danger', icon: <Truck className="h-[18px] w-[18px]" />, title: 'Supplier balance check failed', detail: 'Mystery Hub could not reach Success Biz Hub just now. Deliveries may be affected.', action: 'System Health', open: () => onNavigateTab('system') });
  if (supplier.status === 'connected' && !supplier.fulfilmentEnabled) attention.push({ id: 'dispatch-off', tone: 'warning', icon: <Truck className="h-[18px] w-[18px]" />, title: 'Automatic supplier dispatch is off', detail: 'Paid data and airtime orders wait in the queue until dispatch is enabled.', action: 'System Health', open: () => onNavigateTab('system') });
  if (uncertain > 0) attention.push({ id: 'uncertain', tone: 'danger', icon: <AlertTriangle className="h-[18px] w-[18px]" />, title: `${plural(uncertain, 'supplier submission')} uncertain`, detail: 'The supplier may or may not have accepted these. Never resubmit; reconcile them first.', action: 'Review orders', open: () => onNavigateTab('orders', 'needs_attention') });
  if (allTime.manualReviewPendingCount > 0) attention.push({ id: 'orders', tone: 'warning', icon: <PackageSearch className="h-[18px] w-[18px]" />, title: `${plural(allTime.manualReviewPendingCount, 'order')} need${allTime.manualReviewPendingCount === 1 ? 's' : ''} attention`, detail: `All dates: flagged orders, failed paid orders and open refunds.${allTime.unresolvedPaidCount ? ` ${plural(allTime.unresolvedPaidCount, 'paid customer')} without a recorded remedy.` : ''}`, action: 'Needs Attention', open: () => onNavigateTab('orders', 'needs_attention') });
  if (withdrawals?.waiting) attention.push({ id: 'withdrawals', tone: 'warning', icon: <CreditCard className="h-[18px] w-[18px]" />, title: `${plural(withdrawals.waiting, 'withdrawal request')} waiting`, detail: `From the first 50 requests. Approving records your decision; you still send the MoMo payout and mark it paid.${withdrawals.reviewNeeded ? ` ${withdrawals.reviewNeeded} need reconciliation first.` : ''}`, action: 'Requests', open: () => onNavigateTab('finance', 'requests') });
  if (marketplace?.newInquiries) attention.push({ id: 'inquiries', tone: 'info', icon: <MessageSquare className="h-[18px] w-[18px]" />, title: `${marketplace.newInquiries} new marketplace inquir${marketplace.newInquiries === 1 ? 'y' : 'ies'}`, detail: 'Customers are waiting for a reply about a product.', action: 'Inquiries', open: () => onNavigateTab('marketplace', 'inquiries') });
  if (allTime.pendingWaitlist > 0) attention.push({ id: 'waitlist', tone: 'neutral', icon: <ClipboardList className="h-[18px] w-[18px]" />, title: `${plural(allTime.pendingWaitlist, 'launch request')} pending`, detail: 'People asked to be told when a service launches.', action: 'Launch requests', open: () => onNavigateTab('waitlist') });
  const urgent = attention.filter(item => item.tone === 'danger').length;

  const paystackLive = system?.paystack?.mode?.startsWith('Live');
  const paystackTone: AdminTone = !system?.paystack ? 'neutral' : system.paystack.status !== 'configured' ? 'danger' : paystackLive ? 'success' : 'warning';
  const supplierTone: AdminTone = supplier.status === 'connected' ? supplier.isLowBalance ? 'danger' : 'success' : supplier.status === 'error' ? 'danger' : 'neutral';

  const attentionPanel = (
    <AdminPanel
      title={<span className="flex items-center gap-2">Needs attention{attention.length > 0 && <span className={`rounded-full px-2 text-xs font-semibold tabular-nums ${urgent ? 'bg-rose-400/20 text-rose-200' : 'bg-amber-400/20 text-amber-200'}`}>{attention.length}</span>}</span>}
      tone={urgent ? 'danger' : 'neutral'}
    >
      <div aria-live="polite">
        {attention.length ? (
          <ul className="-mx-2 space-y-0.5">
            {attention.map(item => (
              <li key={item.id}>
                <button type="button" onClick={item.open} className="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-800/40 focus-visible:bg-slate-800/40">
                  <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneIcon[item.tone]}`} aria-hidden>{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">{item.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{item.detail}</span>
                    <span className="mt-1 inline-flex items-center gap-0.5 text-xs font-semibold text-[#00c365]">{item.action}<ChevronRight className="h-3.5 w-3.5" aria-hidden /></span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-start gap-3 text-sm text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            {sideErrors.length ? 'No issues in the checks that completed. Some checks are unavailable.' : 'Nothing needs action in the loaded records. Each area keeps its full queue.'}
          </p>
        )}
        {sideErrors.length > 0 && <p className="mt-3 text-xs text-amber-300">Could not check: {sideErrors.join(', ')}. Any previous values for those checks may be out of date; they may still need attention.</p>}
      </div>
      <AdminAttentionOrders token={sessionToken} revision={revision} onOpen={reference => onNavigateTab('orders', `ref/${reference}`)} onOpenAll={() => onNavigateTab('orders', 'needs_attention')} />
    </AdminPanel>
  );

  const healthPanel = (
    <AdminPanel title="Payments and supplier" actions={<button type="button" onClick={() => onNavigateTab('system')} className="inline-flex min-h-9 items-center text-xs font-semibold text-[#00c365]">System Health</button>}>
      <dl className="-my-1 divide-y divide-slate-800/80 text-sm">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-slate-400">Paystack</dt>
          <dd><StatusPill tone={paystackTone} title="Shows whether keys are configured and which mode they use. Each order shows its own verified payment.">{!system?.paystack ? 'Unknown' : system.paystack.status !== 'configured' ? 'Not configured' : paystackLive ? 'Live keys' : 'Test mode'}</StatusPill></dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-slate-400">Automatic dispatch</dt>
          <dd><StatusPill tone={supplier.fulfilmentEnabled ? system?.fulfilmentPipeline && !system.fulfilmentPipeline.autoDispatch ? 'warning' : 'success' : 'warning'}>{supplier.fulfilmentEnabled ? system?.fulfilmentPipeline && !system.fulfilmentPipeline.autoDispatch ? 'Held: test mode' : 'On' : 'Off'}</StatusPill></dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="min-w-0 text-slate-400">Supplier wallet{threshold != null && <span className="block text-xs text-slate-500">Alert below {ghsMajor(threshold)}</span>}</dt>
          <dd className="flex shrink-0 flex-col items-end gap-1">
            <span className={`font-semibold tabular-nums ${supplierTone === 'danger' ? 'text-rose-200' : 'text-white'}`}>{supplier.balanceGhc !== null ? ghsMajor(supplier.balanceGhc) : 'Unavailable'}</span>
            <StatusPill tone={supplierTone}>{supplier.status === 'connected' ? supplier.isLowBalance ? 'Low balance' : 'Connected' : supplier.status === 'error' ? 'Unreachable' : 'Not configured'}</StatusPill>
          </dd>
        </div>
      </dl>
    </AdminPanel>
  );

  return (
    <div className="space-y-6">
      {error && <AdminError title="Overview refresh failed · showing last loaded figures" message={error} onRetry={() => void fetchOverview(true)} />}
      <AdminPageHeader
        eyebrow={todayLabel}
        title="Overview"
        description="Today's orders, what needs you, and how the business is doing."
        actions={<><Freshness at={loadedAt} /><RefreshButton onClick={() => void fetchOverview(true)} busy={isRefreshing} /></>}
      />

      {/* 1. Today: orders first, each figure naming its own population. */}
      <section aria-labelledby="today-heading" className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d151b]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-slate-800/80 px-4 py-3 sm:px-5">
          <h2 id="today-heading" className="text-base font-semibold text-white">Today</h2>
          <p className="text-xs text-slate-500">Since midnight, Ghana time (GMT)</p>
        </div>
        <div className="grid grid-cols-2 divide-slate-800/80 lg:grid-cols-4 [&>*]:border-slate-800/80 [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b lg:[&>*]:border-b-0 lg:[&>*:not(:last-child)]:border-r">
          <TodayFigure label="Paid orders" value={today.ordersCount.toLocaleString()} action="All orders created today" onOpen={() => onNavigateTab('orders', 'active/today')}
            detail={`Created today. Across all payment types: ${today.deliveredCount} delivered · ${today.processingCount} with supplier.`} />
          <TodayFigure label="Delivered today" value={todayReport ? todayReport.completedCount.toLocaleString() : '—'} action="Supporting orders" onOpen={() => todayReport ? setTodayMetric('completed_sales') : onNavigateTab('orders', 'delivered')}
            detail={todayReport ? `${ghs(todayReport.completedSalesMinor)} completed sales, by delivery time. Includes earlier orders.` : 'Delivery report unavailable right now.'} />
          <TodayFigure label="Paystack receipts" value={todayReport ? ghs(todayReport.externalReceiptsMinor) : '—'} action={todayReport ? 'Supporting orders' : 'Open Finance'} onOpen={() => todayReport ? setTodayMetric('external_receipts') : onNavigateTab('finance')}
            detail={todayReport ? 'Verified payments today, by payment time. Before refunds; not profit.' : 'Payment report unavailable right now.'} />
          <TodayFigure label="Needs attention" value={allTime.manualReviewPendingCount.toLocaleString()} tone={allTime.manualReviewPendingCount ? 'warning' : 'neutral'} action="Open queue" onOpen={() => onNavigateTab('orders', 'needs_attention')}
            detail={`Open cases from all dates. ${today.attentionCount} from today's orders.`} />
        </div>
      </section>

      {/* 2. Work: the attention queue beside the latest orders and service health; phones read attention first. */}
      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)] xl:items-start">
        <div className="order-1 xl:col-start-2 xl:row-start-1">{attentionPanel}</div>
        <div className="contents xl:col-start-1 xl:row-start-1 xl:block xl:space-y-6">
          <div className="order-2">
            <AdminRecentOrders token={sessionToken} revision={revision} onOpenOrder={reference => onNavigateTab('orders', `ref/${reference}`)} onOpenAll={() => onNavigateTab('orders')} />
          </div>
          <div className="order-3">{healthPanel}</div>
        </div>
      </div>

      {/* 3. Business performance: compact, any period, full V3 breakdown on demand. */}
      <AdminBusinessSummary token={sessionToken} revision={revision} onOpenOrder={reference => onNavigateTab('orders', `ref/${reference}`)} onOpenFinance={() => onNavigateTab('finance')} />

      <AdminEarnPulse sessionToken={sessionToken} onOpen={() => onNavigateTab('earn')} />

      {todayMetric && todayReport && (
        <ReportOrdersSheet token={sessionToken} metric={todayMetric} query="period=today" cutoff={todayReport.period.to} periodLabel="Today" onClose={() => setTodayMetric(null)} onOpenOrder={reference => onNavigateTab('orders', `ref/${reference}`)} />
      )}
    </div>
  );
};
