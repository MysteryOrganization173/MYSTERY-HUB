import { useEffect, useState } from 'react';
import { getAdminOverviewOnServer, type AdminOverviewMetrics } from '../../services/apiClient';
import { marketplaceControlRequest } from '../../services/marketplaceControls';
import { financeRequest } from '../../services/financeApi';

/**
 * Shared, short-lived cache for the admin overview so the navigation badges and the
 * Overview page reuse one request (the endpoint reconciles supplier orders and queries
 * the supplier balance, so it should not be called twice for one screen).
 */
const OVERVIEW_TTL_MS = 60_000;
let cached: { token: string; at: number; metrics: AdminOverviewMetrics } | null = null;
let inflight: { token: string; promise: Promise<{ metrics: AdminOverviewMetrics; at: number }> } | null = null;
const listeners = new Set<() => void>();

export function loadAdminOverview(token: string, force = false): Promise<{ metrics: AdminOverviewMetrics; at: number }> {
  if (!force && cached && cached.token === token && Date.now() - cached.at < OVERVIEW_TTL_MS) return Promise.resolve({ metrics: cached.metrics, at: cached.at });
  if (!force && inflight && inflight.token === token) return inflight.promise;
  const promise = getAdminOverviewOnServer(token).then(result => {
    if (!result.success || !result.metrics) throw new Error('Overview metrics were not returned.');
    cached = { token, at: Date.now(), metrics: result.metrics };
    listeners.forEach(listener => listener());
    return { metrics: result.metrics, at: cached.at };
  }).finally(() => { if (inflight?.promise === promise) inflight = null; });
  inflight = { token, promise };
  return promise;
}

export interface AdminSignals {
  ordersAttention: number | null;
  supplierAlert: boolean;
  newInquiries: number | null;
  productsNeedingReview: number | null;
  pendingWithdrawals: number | null;
  pendingWaitlist: number | null;
}
const empty: AdminSignals = { ordersAttention: null, supplierAlert: false, newInquiries: null, productsNeedingReview: null, pendingWithdrawals: null, pendingWaitlist: null };

export function signalsFromOverview(metrics: AdminOverviewMetrics | null | undefined) {
  if (!metrics) return {};
  return {
    ordersAttention: metrics.allTime.manualReviewPendingCount,
    supplierAlert: metrics.supplier.isLowBalance || metrics.supplier.status === 'error' || (metrics.supplier.status === 'connected' && !metrics.supplier.fulfilmentEnabled),
    pendingWaitlist: metrics.allTime.pendingWaitlist,
  };
}

/** Navigation badges. Every count is server-derived; a failed source simply shows no badge. */
export function useAdminSignals(token: string, refreshKey = 0): AdminSignals {
  const [signals, setSignals] = useState<AdminSignals>(empty);
  useEffect(() => {
    let active = true;
    const fromCache = () => { if (active && cached?.token === token) setSignals(current => ({ ...current, ...signalsFromOverview(cached!.metrics) })); };
    listeners.add(fromCache);
    loadAdminOverview(token).then(fromCache).catch(() => {});
    marketplaceControlRequest('metrics', token).then(data => { if (active) setSignals(current => ({ ...current, newInquiries: data.metrics?.newInquiries ?? null, productsNeedingReview: data.metrics?.needsReview ?? null })); }).catch(() => {});
    financeRequest<Array<{ state: string }>>(token, '/withdrawals?offset=0', undefined, true).then(rows => { if (active && Array.isArray(rows)) setSignals(current => ({ ...current, pendingWithdrawals: rows.filter(row => ['pending_review', 'approved'].includes(row.state)).length })); }).catch(() => {});
    return () => { active = false; listeners.delete(fromCache); };
  }, [token, refreshKey]);
  return signals;
}
