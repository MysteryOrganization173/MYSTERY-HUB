import React, { useEffect, useState, useCallback } from 'react';
import { AdminEarnPulse } from './AdminEarnPulse';
import {
  AdminOverviewMetrics,
  getAdminOverviewOnServer,
} from '../../../services/apiClient';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  ClipboardList,
  Wallet,
  ArrowUpRight,
  RefreshCw,
  Radio,
  Zap,
} from 'lucide-react';

interface AdminOverviewSectionProps {
  sessionToken: string;
  onNavigateTab: (tab: 'orders' | 'marketplace' | 'waitlist' | 'customers' | 'system' | 'earn') => void;
}

export const AdminOverviewSection: React.FC<AdminOverviewSectionProps> = ({
  sessionToken,
  onNavigateTab,
}) => {
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchOverview = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await getAdminOverviewOnServer(sessionToken);
      if (res.success && res.metrics) {
        setMetrics(res.metrics);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch overview metrics.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <RefreshCw className="w-8 h-8 text-[#00c365] animate-spin mb-3" />
        <p className="text-sm font-medium">Loading real-time launch metrics...</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-center max-w-xl mx-auto my-8">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-red-400 mb-1">Failed to Load Overview Metrics</h3>
        <p className="text-xs text-slate-400 mb-4">{error || 'Unknown server response'}</p>
        <button
          onClick={() => fetchOverview(true)}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { today, last7Days, allTime, supplier } = metrics;

  return (
    <div className="space-y-6">
      <AdminEarnPulse sessionToken={sessionToken} onOpen={() => onNavigateTab('earn')} />
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Launch Overview</h2>
          <p className="text-xs text-slate-400">
            Real server-derived metrics for today and all-time operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOverview(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00c365]' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
          </button>
        </div>
      </div>

      {/* Supplier Low Balance Alert Banner */}
      {supplier.isLowBalance && supplier.balanceGhc !== null && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <h4 className="text-xs font-bold text-amber-300">Supplier Wallet Low Balance Warning</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Current Success Biz Hub wallet balance is <strong className="text-amber-400 font-mono">GH₵ {supplier.balanceGhc.toFixed(2)}</strong>, which is below the operational safety threshold (GH₵ 100). Please top up the supplier account to prevent data delivery disruptions.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('system')}
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            View System
          </button>
        </div>
      )}

      {/* Today's Operational Metrics Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#00c365]" />
            <span>Today&apos;s Activity</span>
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">Server Time (GMT)</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Today Paid Revenue */}
          <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Today&apos;s Revenue</span>
              <TrendingUp className="w-4 h-4 text-[#00c365]" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white font-mono">
              GH₵ {today.revenueGhc.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500">
              From <strong className="text-slate-300">{today.ordersCount}</strong> paid orders today
            </div>
          </div>

          {/* Today Delivered */}
          <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Delivered</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">
              {today.deliveredCount}
            </div>
            <div className="text-[11px] text-slate-500">
              Successfully fulfilled today
            </div>
          </div>

          {/* Today In Progress */}
          <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Processing / Queued</span>
              <RefreshCw className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-sky-400 font-mono">
              {today.processingCount}
            </div>
            <div className="text-[11px] text-slate-500">
              Active in supplier pipeline
            </div>
          </div>

          {/* Attention / Failed */}
          <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Needs Attention</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className={`text-xl sm:text-2xl font-extrabold font-mono ${today.attentionCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {today.attentionCount}
            </div>
            <div className="text-[11px] text-slate-500">
              Failed or refund pending
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day & Business Pulse Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 7 Days Performance */}
        <div className="p-5 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Last 7 Days Activity</span>
            </h4>
            <span className="text-xs font-bold text-[#00c365] font-mono">
              GH₵ {last7Days.revenueGhc.toFixed(2)}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Total Orders (7d)</span>
              <span className="font-bold text-white font-mono">{last7Days.ordersCount}</span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Data Bundle Orders</span>
              <span className="font-bold text-sky-400 font-mono">{last7Days.dataOrdersCount}</span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Airtime Orders</span>
              <span className="font-bold text-amber-400 font-mono">{last7Days.airtimeOrdersCount}</span>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('orders')}
            className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>View All Orders</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Business & Growth */}
        <div className="p-5 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#00c365]" />
              <span>Community & Accounts</span>
            </h4>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Registered Customer Accounts</span>
              <span className="font-bold text-white font-mono">{allTime.totalCustomers}</span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Total Waitlist Registrations</span>
              <span className="font-bold text-[#00c365] font-mono">{allTime.totalWaitlist}</span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Pending Waitlist Action</span>
              <span className="font-bold text-amber-400 font-mono">{allTime.pendingWaitlist}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onNavigateTab('customers')}
              className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-[#00c365]" />
              <span>Customers</span>
            </button>
            <button
              onClick={() => onNavigateTab('waitlist')}
              className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
              <span>Waitlist</span>
            </button>
          </div>
        </div>

        {/* Supplier Wallet & Fulfilment */}
        <div className="p-5 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-sky-400" />
              <span>Supplier & Fulfilment</span>
            </h4>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              supplier.status === 'connected'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : supplier.status === 'unconfigured'
                ? 'bg-slate-800 text-slate-400'
                : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}>
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              <span>{supplier.status === 'connected' ? 'Connected' : supplier.status === 'unconfigured' ? 'Not Configured' : 'Error'}</span>
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Supplier Wallet Balance</span>
              <span className="font-bold text-white font-mono">
                {supplier.balanceGhc !== null ? `GH₵ ${supplier.balanceGhc.toFixed(2)}` : 'Unavailable'}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Auto-Fulfilment Dispatch</span>
              <span className={`font-bold ${supplier.fulfilmentEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                {supplier.fulfilmentEnabled ? 'Enabled (Active)' : 'Disabled'}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Manual Review Queue</span>
              <span className={`font-bold font-mono ${allTime.manualReviewPendingCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {allTime.manualReviewPendingCount} orders
              </span>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('system')}
            className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>System Health Diagnostics</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* All-Time Performance & Margins Summary */}
      <div className="p-5 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-[#00c365]" />
            <span>All-Time Financial & Volume Summary</span>
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">Server-Derived Authoritative Totals</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/60 space-y-1">
            <span className="text-[11px] text-slate-400">Total Paid Orders</span>
            <p className="text-lg font-bold text-white font-mono">{allTime.ordersCount}</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/60 space-y-1">
            <span className="text-[11px] text-slate-400">Gross Revenue Collected</span>
            <p className="text-lg font-bold text-[#00c365] font-mono">GH₵ {allTime.revenueGhc.toFixed(2)}</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/60 space-y-1">
            <span className="text-[11px] text-slate-400">Recorded Supplier Cost</span>
            <p className="text-lg font-bold text-slate-300 font-mono">
              {allTime.supplierCostGhc > 0 ? `GH₵ ${allTime.supplierCostGhc.toFixed(2)}` : 'GH₵ 0.00'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/60 space-y-1">
            <span className="text-[11px] text-slate-400">Estimated Gross Margin</span>
            <p className="text-lg font-bold text-emerald-400 font-mono">
              {allTime.estimatedGrossMarginGhc !== null
                ? `GH₵ ${allTime.estimatedGrossMarginGhc.toFixed(2)}`
                : 'Pending Complete Cost Data'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
