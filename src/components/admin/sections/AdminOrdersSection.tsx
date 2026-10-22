import { AdminOrderResolution } from './AdminOrderResolution';
import { AdminOrderRecovery } from './AdminOrderRecovery';
import { AdminAssistedOrders,AdminAssistedEvidence } from './AdminAssistedOrders';
import { afaStatusLabel } from '../../../../shared/afa';
import { FULFILMENT_LABELS, FulfilmentMode } from '../../../../shared/marketplacePolicy';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AdminOrdersResponse,
  getAdminOrdersOnServer,
  getAdminOrderOnServer,
  refreshAdminOrderOnServer,
  updateAdminOrderReviewOnServer,
  updateAdminOrderStatusOnServer,
  closeAdminTestOrderOnServer,
} from '../../../services/apiClient';
import { AdminOrderDetails } from '../../../../server/types/orders';
import { describeOrderCase, orderTimeline, parseSupplierStatus, ORDER_LENSES, type OrderLensId } from '../../../utils/adminOrderCase';
import {
  AdminPageHeader, AdminPanel, AdminLoading, AdminError, AdminEmpty, AdminNotice, AdminButton, AdminSheet, StatusPill, RefreshButton, Freshness,
  DefinitionList, ConfirmAction, adminField, adminLabel, ghs,
} from '../ui/AdminUi';
import { Search, SlidersHorizontal, Copy, Check, Flag, ChevronLeft, ChevronRight, X, RefreshCw, MessageCircle, Circle, CheckCircle2, XCircle } from 'lucide-react';
import { whatsappLink } from '../../../../shared/marketplacePolicy';
import { createAdminRequestScope } from '../../../utils/adminRequestScope';
import { adminOrderSearchParams, type AdminOrderView } from '../../../utils/adminOrderView';

interface AdminOrdersSectionProps {
  sessionToken: string;
  initialStatusFilter?: string;
  /** Opens one order directly (deep link from an alert or another section). */
  initialReference?: string;
  /** Opens with the created-date filter set to today in Ghana time (from the Overview "Today" figures). */
  initialCreatedToday?: boolean;
  onChanged?: () => void;
  initialView?: AdminOrderView;
  onViewChange?: (view: AdminOrderView) => void;
}

const lensFromFilter = (filter: string): OrderLensId => (ORDER_LENSES.some(l => l.id === filter) ? filter as OrderLensId : filter ? 'active' : 'active');

const ghanaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });

export const AdminOrdersSection: React.FC<AdminOrdersSectionProps> = ({ sessionToken, initialStatusFilter = '', initialReference, initialCreatedToday = false, onChanged, initialView, onViewChange }) => {
  // Query & filter state. A lens maps to the existing server filters; nothing new is queried.
  const [searchTerm, setSearchTerm] = useState(initialView?.search ?? initialReference ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(initialView?.search ?? initialReference ?? '');
  const [lens, setLens] = useState<OrderLensId>(initialView?.lens ?? (initialReference ? 'active' : lensFromFilter(initialStatusFilter)));
  const [serviceTypeFilter, setServiceTypeFilter] = useState(initialView?.service || '');
  const [networkFilter, setNetworkFilter] = useState(initialView?.network || '');
  const [manualReviewFilter, setManualReviewFilter] = useState(initialView?.review || '');
  const [dateFrom, setDateFrom] = useState(initialView?.from ?? (initialCreatedToday ? ghanaToday() : ''));
  const [dateTo, setDateTo] = useState(initialView?.to ?? (initialCreatedToday ? ghanaToday() : ''));
  const [currentPage, setCurrentPage] = useState(initialView?.page || 1);
  const [showFilters, setShowFilters] = useState(initialView?.filtersOpen || false);
  const pageSize = 20;
  const requests = useRef(createAdminRequestScope()).current;
  requests.setContext(sessionToken);
  useEffect(() => () => requests.invalidate(), [requests, sessionToken]);
  const actionPending = useRef(false);
  const [isActing, setIsActing] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Data state
  const [ordersData, setOrdersData] = useState<AdminOrdersResponse | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected order (stable ref prevents stale list refreshes overwriting a newer detail)
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetails | null>(null);
  const selectedOrderRef = useRef<AdminOrderDetails | null>(null);
  const refreshList = useRef<() => Promise<void>>(async () => {});
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isRefreshingSupplier, setIsRefreshingSupplier] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Test-order closure (kept for genuine pre-launch tests only)
  const [showCloseTestConfirm, setShowCloseTestConfirm] = useState(false);
  const [confirmPaidCheckbox, setConfirmPaidCheckbox] = useState(false);
  const [closeTestReason, setCloseTestReason] = useState('');
  const [isClosingTest, setIsClosingTest] = useState(false);
  const [closeTestError, setCloseTestError] = useState<string | null>(null);

  useEffect(() => { const timer = setTimeout(() => { if (searchTerm.trim() !== debouncedSearch) { setDebouncedSearch(searchTerm.trim()); setCurrentPage(1); } }, 300); return () => clearTimeout(timer); }, [searchTerm, debouncedSearch]);
  useEffect(() => { onViewChange?.({ search: searchTerm, lens, service: serviceTypeFilter, network: networkFilter, review: manualReviewFilter, from: dateFrom, to: dateTo, page: currentPage, filtersOpen: showFilters }); }, [searchTerm, lens, serviceTypeFilter, networkFilter, manualReviewFilter, dateFrom, dateTo, currentPage, showFilters, onViewChange]);

  const setSelected = (order: AdminOrderDetails | null) => { selectedOrderRef.current = order; setSelectedOrder(order); };

  const closeOrderDrawer = useCallback(() => {
    if (actionPending.current) return;
    requests.invalidate('detail'); requests.invalidate('copy');
    setSelected(null);
    setIsLoadingDetail(false);
    setActionSuccessMessage(null); setActionError(null); setDetailError(null); setCopiedKey(null);
    setShowCloseTestConfirm(false); setConfirmPaidCheckbox(false); setCloseTestReason(''); setIsClosingTest(false); setCloseTestError(null);
  }, [requests]);

  const loadOrderDetails = useCallback(async (reference: string) => {
    const current = requests.begin('detail');
    setIsLoadingDetail(true); setDetailError(null);
    try {
      const res = await getAdminOrderOnServer(sessionToken, reference);
      if (!res.success || !res.order) throw new Error('Full order details were not returned.');
      if (current()) {
        const previous = selectedOrderRef.current;
        // Deep links have no list row to initialise notes. Preserve a typed note,
        // but refresh untouched text when the authoritative record changes.
        setAdminNoteInput(note => !previous || note === (previous.admin_note || '') ? res.order.admin_note || '' : note);
        setSelected(res.order);
        if (previous && previous.updated_at !== res.order.updated_at) { void refreshList.current(); onChanged?.(); }
      }
    } catch (err) {
      if (current()) setDetailError(err instanceof Error ? err.message : 'Full order details could not be refreshed.');
    } finally { if (current()) setIsLoadingDetail(false); }
  }, [sessionToken, requests, onChanged]);

  const openOrderDrawer = useCallback((order: AdminOrderDetails) => {
    if (actionPending.current) return;
    requests.invalidate('copy');
    setSelected(order);
    setActionSuccessMessage(null); setActionError(null); setDetailError(null); setCopiedKey(null);
    setAdminNoteInput(order.admin_note || '');
    setShowCloseTestConfirm(false); setConfirmPaidCheckbox(false); setCloseTestReason(''); setIsClosingTest(false); setCloseTestError(null);
    // The list projection omits operational extras (for example AFA registration details); load the full record.
    void loadOrderDetails(order.public_reference);
  }, [requests, loadOrderDetails]);

  const lensParams = adminOrderSearchParams(lens, debouncedSearch);
  const fetchOrders = useCallback(async () => {
    const current = requests.begin('list');
    setIsSearching(true);
    setError(null);
    try {
      const res = await getAdminOrdersOnServer(sessionToken, {
        q: debouncedSearch || undefined,
        serviceType: serviceTypeFilter || undefined,
        network: networkFilter || undefined,
        ...lensParams,
        manualReview: manualReviewFilter === 'true' ? true : manualReviewFilter === 'false' ? false : undefined,
        dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00Z`).toISOString() : undefined,
        dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999Z`).toISOString() : undefined,
        page: currentPage,
        limit: pageSize,
      });
      if (!res.success) throw new Error('Orders were not returned.');
      if (current()) {
        if (res.pagination.page > res.pagination.totalPages) { setCurrentPage(res.pagination.totalPages); return; }
        setOrdersData(res);
        setLoadedAt(Date.now());
      }
    } catch (err: unknown) {
      if(current())setError(err instanceof Error ? err.message : 'Failed to retrieve orders.');
    } finally {
      if(current()){setIsLoading(false);setIsSearching(false);}
    }
  }, [sessionToken, debouncedSearch, serviceTypeFilter, networkFilter, lens, manualReviewFilter, dateFrom, dateTo, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps
  refreshList.current = fetchOrders;

  useEffect(() => { void fetchOrders(); }, [fetchOrders]);

  // One passive detail request per link. Closing invalidates it, including before it arrives.
  const deepLinked = useRef('');
  useEffect(() => {
    const link = `${sessionToken}:${initialReference || ''}`;
    if (!initialReference || deepLinked.current === link) return;
    deepLinked.current = link;
    void loadOrderDetails(initialReference);
  }, [initialReference, sessionToken, loadOrderDetails]);

  const afterAction = () => { void fetchOrders(); onChanged?.(); };
  const beginAction = () => {
    if (actionPending.current) return null;
    actionPending.current = true; setIsActing(true);
    requests.invalidate('detail');
    setIsLoadingDetail(false);
    return requests.begin('action');
  };
  const finishAction = (current: () => boolean) => { if (current()) { actionPending.current = false; setIsActing(false); } };

  const handleCopy = async (text: string, key: string) => {
    const current = requests.begin('copy');
    try { await navigator.clipboard.writeText(text); if (current()) { setCopiedKey(key); setTimeout(() => { if (current()) setCopiedKey(null); }, 2000); } } catch { if (current()) setActionError('Copy is unavailable here. Select the text and copy it manually.'); }
  };

  const handleRefreshSupplierStatus = async (reference: string) => {
    const current = beginAction(); if (!current) return;
    setIsRefreshingSupplier(true); setActionSuccessMessage(null); setActionError(null);
    try {
      const res = await refreshAdminOrderOnServer(sessionToken, reference);
      if (current() && res.success && res.order && selectedOrderRef.current?.public_reference === res.order.public_reference) {
        setSelected(res.order);
        setActionSuccessMessage(res.message || 'Supplier status checked.');
        afterAction();
      }
    } catch (err: unknown) {
      if (current()) setActionError(err instanceof Error ? err.message : 'Failed to refresh supplier status.');
    } finally { if (current()) setIsRefreshingSupplier(false); finishAction(current); }
  };

  const handleToggleManualReview = async (order: AdminOrderDetails) => {
    const current = beginAction(); if (!current) return;
    setActionSuccessMessage(null); setActionError(null);
    try {
      const newFlag = !order.manual_review;
      const res = await updateAdminOrderReviewOnServer(sessionToken, order.public_reference, { manualReview: newFlag });
      if (current() && res.success && res.order && selectedOrderRef.current?.public_reference === res.order.public_reference) {
        setSelected({ ...selectedOrderRef.current, ...res.order });
        setActionSuccessMessage(newFlag ? 'Flagged for manual review.' : 'Review flag removed; customer refund resolution is unchanged.');
        afterAction();
      }
    } catch (err: unknown) {
      if (current()) setActionError(err instanceof Error ? err.message : 'Failed to update review flag.');
    } finally { finishAction(current); }
  };

  const handleSaveAdminNote = async (order: AdminOrderDetails) => {
    const current = beginAction(); if (!current) return;
    setIsSavingNote(true); setActionSuccessMessage(null); setActionError(null);
    try {
      const res = await updateAdminOrderReviewOnServer(sessionToken, order.public_reference, { adminNote: adminNoteInput.trim() || null });
      if (current() && res.success && res.order && selectedOrderRef.current?.public_reference === res.order.public_reference) {
        setSelected({ ...selectedOrderRef.current, ...res.order });
        setActionSuccessMessage('Internal note saved.');
        afterAction();
      }
    } catch (err: unknown) {
      if (current()) setActionError(err instanceof Error ? err.message : 'Failed to save admin note.');
    } finally { if (current()) setIsSavingNote(false); finishAction(current); }
  };

  const handleCloseTestOrder = async () => {
    if (!selectedOrder) return;
    const current = beginAction(); if (!current) return;
    setIsClosingTest(true); setCloseTestError(null); setActionSuccessMessage(null);
    try {
      const res = await closeAdminTestOrderOnServer(sessionToken, selectedOrder.public_reference, { confirmPaidTestOrder: confirmPaidCheckbox, reason: closeTestReason.trim() || undefined });
      if (current() && res.success && res.order) {
        setSelected(res.order);
        setActionSuccessMessage(res.message || 'Test order closed. It will no longer block new MTN orders.');
        setShowCloseTestConfirm(false); setConfirmPaidCheckbox(false); setCloseTestReason('');
        afterAction();
      }
    } catch (err: unknown) {
      if (current()) setCloseTestError(err instanceof Error ? err.message : 'Failed to close test order.');
    } finally { if (current()) setIsClosingTest(false); finishAction(current); }
  };

  const handleUpdateOrderStatus = async (order: AdminOrderDetails, newStatus: string) => {
    const current = beginAction(); if (!current) return;
    setIsUpdatingStatus(true); setActionSuccessMessage(null); setActionError(null);
    try {
      const res = await updateAdminOrderStatusOnServer(sessionToken, order.public_reference, { marketplaceStatus: newStatus, adminNote: adminNoteInput.trim() || undefined });
      if (current() && res.success && res.order) {
        setSelected({ ...selectedOrderRef.current, ...res.order });
        setActionSuccessMessage(`Fulfilment step updated to "${(res.order.marketplace_status || res.order.status).replace(/_/g, ' ')}".`);
        afterAction();
      }
    } catch (err) {
      if (current()) setActionError(err instanceof Error ? err.message : 'Failed to update the fulfilment step.');
    } finally { if (current()) setIsUpdatingStatus(false); finishAction(current); }
  };

  const activeFilterCount = [serviceTypeFilter, networkFilter, manualReviewFilter, dateFrom, dateTo].filter(Boolean).length;
  const clearFilters = () => { setServiceTypeFilter(''); setNetworkFilter(''); setManualReviewFilter(''); setDateFrom(''); setDateTo(''); setCurrentPage(1); };
  const productLabel = (order: AdminOrderDetails) => order.service_type === 'airtime' ? `${order.network.toUpperCase()} Airtime` : order.product_name_snapshot;

  const caseLabel = (order: AdminOrderDetails) => {
    const kase = describeOrderCase(order);
    if (order.service_type === 'afa' && !kase.key.startsWith('resolved_')) return <StatusPill tone={kase.tone}>{`AFA · ${afaStatusLabel(order.status, order.manual_review)}`}</StatusPill>;
    return <StatusPill tone={kase.tone}>{kase.label}</StatusPill>;
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Orders & delivery"
        description="Find any order, see exactly where the customer stands, and act on what needs attention."
        actions={<><AdminAssistedOrders token={sessionToken} onCreated={order=>{setSelected(order);afterAction();}}/><Freshness at={loadedAt} /><RefreshButton onClick={() => void fetchOrders()} busy={isSearching} /></>}
      />

      {/* Lenses: one tap to the situation the founder is asking about */}
      <div role="tablist" aria-label="Order situation" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {ORDER_LENSES.map(item => (
          <button key={item.id} type="button" role="tab" aria-selected={lens === item.id} onClick={() => { setLens(item.id); setCurrentPage(1);if(initialReference){setSearchTerm('');setDebouncedSearch('');} }}
            className={`min-h-11 shrink-0 rounded-xl border px-3.5 text-sm font-semibold ${lens === item.id ? item.id === 'needs_attention' ? 'border-amber-400/60 bg-amber-400/10 text-amber-100' : 'border-[#00c365]/50 bg-[#00c365]/12 text-white' : 'border-slate-800 bg-[#0d151b] text-slate-400 hover:text-white'}`}>
            {item.label}
          </button>
        ))}
      </div>

      {/* Search & filters */}
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-[#0d151b] p-3 sm:p-4">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search orders</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="MH reference, phone, email, Paystack or supplier ref" className={`${adminField} pl-10`} />
          </label>
          <AdminButton onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} aria-controls="order-filters">
            <SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Filters</span>{activeFilterCount > 0 && <span className="rounded-full bg-[#00c365] px-1.5 text-xs text-black">{activeFilterCount}</span>}
          </AdminButton>
        </div>
        {showFilters && (
          <div id="order-filters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className={adminLabel}><span>Service</span>
              <select className={adminField} value={serviceTypeFilter} onChange={e => { setServiceTypeFilter(e.target.value); setCurrentPage(1); }}>
                <option value="">All services</option><option value="data">Data bundles</option><option value="instant_bundle">Instant bundles</option><option value="airtime">Airtime</option><option value="afa">AFA Registration</option><option value="marketplace">Marketplace</option>
              </select></label>
            <label className={adminLabel}><span>Network</span>
              <select className={adminField} value={networkFilter} onChange={e => { setNetworkFilter(e.target.value); setCurrentPage(1); }}>
                <option value="">All networks</option><option value="mtn">MTN</option><option value="telecel">Telecel</option><option value="airteltigo">AirtelTigo</option>
              </select></label>
            <label className={adminLabel}><span>Review flag</span>
              <select className={adminField} value={manualReviewFilter} onChange={e => { setManualReviewFilter(e.target.value); setCurrentPage(1); }}>
                <option value="">Any</option><option value="true">Flagged for review</option><option value="false">Not flagged</option>
              </select></label>
            <label className={adminLabel}><span>Created from</span><input type="date" className={adminField} value={dateFrom} onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }} /></label>
            <label className={adminLabel}><span>Created to</span><input type="date" className={adminField} value={dateTo} onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }} /></label>
            {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="justify-self-start text-sm font-semibold text-[#00c365]">Clear filters</button>}
          </div>
        )}
        {(dateFrom || dateTo) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 pl-3 pr-1">
              {dateFrom && dateFrom === dateTo && dateFrom === ghanaToday() ? 'Created today' : `Created ${dateFrom || '…'} to ${dateTo || '…'}`}
              <button type="button" aria-label="Clear created date filter" onClick={() => { setDateFrom(''); setDateTo(''); setCurrentPage(1); }} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-3.5 w-3.5" /></button>
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300" aria-label="Active order filters">
          {serviceTypeFilter && <span>Service: {serviceTypeFilter}</span>}
          {networkFilter && <span>Network: {networkFilter}</span>}
          {manualReviewFilter && <span>Review: {manualReviewFilter === 'true' ? 'flagged' : 'not flagged'}</span>}
          {(searchTerm || activeFilterCount > 0 || lens !== 'active') && <AdminButton variant="ghost" onClick={() => { clearFilters(); setSearchTerm(''); setDebouncedSearch(''); setLens('active'); }}>Reset view</AdminButton>}
        </div>
        {lens === 'needs_attention' && <p className="text-xs text-slate-400">Needs Attention covers all dates: flagged orders, uncertain supplier submissions, refunds in progress and paid orders that failed without a recorded customer remedy. Resolved cases leave this list but stay searchable.</p>}
        {lens === 'active' && <p className="text-xs text-slate-500">{debouncedSearch ? 'Searching all order states, including cancelled and expired attempts. Any additional filters still apply.' : 'Active orders hide abandoned checkouts. Searching here includes all order states.'}</p>}
      </div>

      {/* Results */}
      {!selectedOrder && isLoadingDetail && <p role="status" className="text-sm text-slate-400">Opening order details… <button type="button" className="min-h-11 px-2 text-[#00c365]" onClick={closeOrderDrawer}>Cancel opening</button></p>}
      {!selectedOrder && detailError && initialReference && <AdminError title="Order details could not load" message={detailError} onRetry={() => void loadOrderDetails(initialReference)} />}
      {error && <AdminError title={ordersData ? 'Refresh failed · showing last loaded orders' : 'Orders could not load'} message={error} onRetry={() => void fetchOrders()} />}
      {isSearching && !isLoading && <p role="status" className="text-sm text-slate-400">Updating results… Previous results remain visible until the request completes.</p>}
      {isLoading ? <AdminLoading label="Loading orders…" /> : !ordersData || ordersData.orders.length === 0 ? (
        <AdminEmpty title={error ? 'Current orders unavailable' : lens === 'needs_attention' ? 'No orders need attention' : 'No orders found'}>
          {error ? 'The current results could not be verified. Try refreshing again.' : lens === 'needs_attention' ? 'No actionable orders match these filters in the last successful check. Normal processing is not a failure.' : 'Nothing matches this search and filter. Try another lens or clear the filters.'}
        </AdminEmpty>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">{ordersData.pagination.total.toLocaleString()} order{ordersData.pagination.total === 1 ? '' : 's'}</p>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-800 bg-[#0d151b] md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Where it stands</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {ordersData.orders.map(order => (
                  <tr key={order.id} className="cursor-pointer hover:bg-slate-900/70" onClick={() => openOrderDrawer(order)}>
                    <td className="px-4 py-3">
                      <button type="button" onClick={e => { e.stopPropagation(); openOrderDrawer(order); }} className="flex items-center gap-1.5 font-mono text-[13px] font-semibold text-white hover:text-[#00c365]">
                        {order.manual_review && <Flag className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Flagged for review" />}
                        {order.public_reference}
                      </button>
                      <span className="block font-mono text-xs text-slate-500">{order.recipient_phone}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-slate-100">{productLabel(order)}</span>
                      <span className="block text-xs uppercase text-slate-500">{order.service_type === 'marketplace' ? 'Marketplace' : order.network}{order.service_type === 'instant_bundle' ? ' · Instant' : ''}</span>
                    </td>
                    <td className="px-4 py-3">{caseLabel(order)}{lens === 'needs_attention' && <p className="mt-2 max-w-xs text-xs text-slate-400">{describeOrderCase(order).explanation}</p>}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">{ghs(order.amount)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}<span className="block">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone cards */}
          <ul className="space-y-2 md:hidden">
            {ordersData.orders.map(order => (
              <li key={order.id}>
                <button type="button" onClick={() => openOrderDrawer(order)} className="w-full space-y-2 rounded-2xl border border-slate-800 bg-[#0d151b] p-4 text-left active:bg-slate-900">
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 font-mono text-[13px] font-semibold text-white">
                      {order.manual_review && <Flag className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Flagged for review" />}
                      <span className="truncate">{order.public_reference}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-white">{ghs(order.amount)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2 text-sm text-slate-300">
                    <span className="truncate">{productLabel(order)} <span className="text-xs uppercase text-slate-500">{order.service_type === 'marketplace' ? '' : order.network}</span></span>
                    <span className="shrink-0 text-xs text-slate-500">{new Date(order.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  <span className="block">{caseLabel(order)}</span>
                  {lens === 'needs_attention' && <span className="block text-xs leading-relaxed text-slate-400">{describeOrderCase(order).explanation}</span>}
                </button>
              </li>
            ))}
          </ul>

          {ordersData.pagination.totalPages > 1 && (
            <nav aria-label="Order pages" className="flex items-center justify-between gap-3 text-sm text-slate-400">
              <span>Page {ordersData.pagination.page} of {ordersData.pagination.totalPages}</span>
              <span className="flex gap-2">
                <AdminButton aria-label="Previous page" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={isSearching || currentPage <= 1}><ChevronLeft className="h-4 w-4" /></AdminButton>
                <AdminButton aria-label="Next page" onClick={() => setCurrentPage(p => Math.min(ordersData.pagination.totalPages, p + 1))} disabled={isSearching || currentPage >= ordersData.pagination.totalPages}><ChevronRight className="h-4 w-4" /></AdminButton>
              </span>
            </nav>
          )}
        </div>
      )}

      {selectedOrder && (
        <OrderDetailSheet
          key={selectedOrder.id}
          order={selectedOrder}
          token={sessionToken}
          onClose={closeOrderDrawer}
          detailError={detailError}
          loadingDetail={isLoadingDetail}
          acting={isActing}
          onReload={() => void loadOrderDetails(selectedOrder.public_reference)}
          message={actionSuccessMessage}
          actionError={actionError}
          copiedKey={copiedKey}
          onCopy={handleCopy}
          note={adminNoteInput}
          setNote={setAdminNoteInput}
          savingNote={isSavingNote}
          onSaveNote={() => void handleSaveAdminNote(selectedOrder)}
          onToggleFlag={() => void handleToggleManualReview(selectedOrder)}
          refreshingSupplier={isRefreshingSupplier}
          onRefreshSupplier={() => void handleRefreshSupplierStatus(selectedOrder.public_reference)}
          updatingStatus={isUpdatingStatus}
          onMarketplaceStep={step => void handleUpdateOrderStatus(selectedOrder, step)}
          onResolutionUpdated={updated => { if (selectedOrderRef.current?.id === updated.id) { requests.invalidate('detail'); setIsLoadingDetail(false); setSelected({ ...selectedOrderRef.current, ...updated }); afterAction(); } }}
          testClosure={{ show: showCloseTestConfirm, setShow: v => { setShowCloseTestConfirm(v); setCloseTestError(null); setConfirmPaidCheckbox(false); setCloseTestReason(''); }, confirmPaid: confirmPaidCheckbox, setConfirmPaid: setConfirmPaidCheckbox, reason: closeTestReason, setReason: setCloseTestReason, busy: isClosingTest, error: closeTestError, run: () => void handleCloseTestOrder() }}
        />
      )}
    </div>
  );
};

function OrderDetailSheet({ order, token, onClose, detailError, loadingDetail, acting, onReload, message, actionError, copiedKey, onCopy, note, setNote, savingNote, onSaveNote, onToggleFlag, refreshingSupplier, onRefreshSupplier, updatingStatus, onMarketplaceStep, onResolutionUpdated, testClosure }: {
  order: AdminOrderDetails; token: string; onClose: () => void; detailError: string | null; message: string | null; actionError: string | null;
  loadingDetail: boolean; acting: boolean; onReload: () => void;
  copiedKey: string | null; onCopy: (text: string, key: string) => void; note: string; setNote: (v: string) => void; savingNote: boolean; onSaveNote: () => void; onToggleFlag: () => void;
  refreshingSupplier: boolean; onRefreshSupplier: () => void; updatingStatus: boolean; onMarketplaceStep: (step: string) => void; onResolutionUpdated: (order: AdminOrderDetails) => void;
  testClosure: { show: boolean; setShow: (v: boolean) => void; confirmPaid: boolean; setConfirmPaid: (v: boolean) => void; reason: string; setReason: (v: string) => void; busy: boolean; error: string | null; run: () => void };
}) {
  const kase = describeOrderCase(order);
  const timeline = orderTimeline(order);
  const supplierStatus = parseSupplierStatus(order.supplier_response);
  const paid = order.payment_status === 'success' || Boolean(order.paid_at);
  const isMarketplace = order.service_type === 'marketplace';
  const digital = ['digital_delivery', 'manual_activation'].includes(order.fulfilment_method || '');
  const customerWhatsapp = whatsappLink(order.customer_phone);
  const [showRaw, setShowRaw] = useState(false);
  const [confirmStep, setConfirmStep] = useState<string | null>(null);
  const copyButton = (text: string, key: string, label: string) => (
    <button type="button" onClick={() => onCopy(text, key)} aria-label={label} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white">
      {copiedKey === key ? <Check className="h-4 w-4 text-[#00c365]" /> : <Copy className="h-4 w-4" />}
    </button>
  );
  const resolutionEligible = paid && ['failed', 'refund_pending', 'refunded', 'cancelled', 'expired'].includes(order.status);
  const paidButHeld = order.payment_status === 'success' && ['paid', 'queued'].includes(order.status) && !order.supplier_order_id && !isMarketplace && order.resolution?.stage !== 'resolved';

  return (
    <AdminSheet wide onClose={onClose} busy={acting}
      title={<span className="font-mono">{order.public_reference}</span>}
      subtitle={<span>{order.service_type === 'airtime' ? `${order.network.toUpperCase()} Airtime` : order.product_name_snapshot} · {ghs(order.amount)}</span>}
      footer={<div className="flex items-center justify-between gap-2"><AdminButton onClick={() => onCopy(order.public_reference, 'ref-footer')}>{copiedKey === 'ref-footer' ? <Check className="h-4 w-4 text-[#00c365]" /> : <Copy className="h-4 w-4" />}Copy reference</AdminButton><AdminButton variant="primary" disabled={acting} onClick={onClose}>Done</AdminButton></div>}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span role="status" className="text-xs text-slate-400">{acting ? 'Updating this order… Keep this window open.' : loadingDetail ? 'Loading current order details…' : detailError ? 'Details could not be refreshed. Actions are paused.' : 'Latest order details loaded.'}</span>
        <AdminButton onClick={onReload} busy={loadingDetail} disabled={acting}>Refresh details</AdminButton>
      </div>
      {detailError && <AdminNotice tone="warning" title="Showing the last loaded copy">{detailError} Refresh details before using an order action.</AdminNotice>}
      <fieldset disabled={acting || loadingDetail || Boolean(detailError)} className="min-w-0 space-y-4 border-0 p-0 text-sm">
        {/* Where this customer stands */}
        <div className={`space-y-2 rounded-2xl border p-4 ${kase.tone === 'danger' ? 'border-rose-500/40 bg-rose-500/5' : kase.tone === 'warning' ? 'border-amber-500/40 bg-amber-500/5' : kase.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/40'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={kase.tone}>{kase.label}</StatusPill>
            {kase.flagged && <StatusPill tone="warning">Flagged for review</StatusPill>}
            {kase.needsAttention && !kase.flagged && <StatusPill tone="warning">In Needs Attention</StatusPill>}
          </div>
          <p className="text-slate-200">{kase.explanation}</p>
          <p className="text-slate-400"><span className="font-semibold text-slate-300">Next: </span>{kase.nextStep}</p>
        </div>

        {message && <AdminNotice tone="success">{message}</AdminNotice>}
        {actionError && <AdminNotice tone="danger">{actionError}</AdminNotice>}

        {/* Timeline */}
        <ol className="flex flex-col gap-0 rounded-2xl border border-slate-800 p-4 sm:flex-row sm:gap-2">
          {timeline.map((step, index) => (
            <li key={index} className="flex flex-1 gap-3 sm:flex-col sm:gap-1.5">
              <span className="flex flex-col items-center sm:flex-row">
                {step.state === 'done' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : step.state === 'failed' ? <XCircle className="h-5 w-5 text-rose-400" /> : <Circle className={`h-5 w-5 ${step.state === 'current' ? 'text-amber-300' : 'text-slate-600'}`} />}
                {index < timeline.length - 1 && <span className="my-1 h-5 w-px bg-slate-700 sm:mx-1 sm:my-0 sm:h-px sm:w-full" />}
              </span>
              <span className="pb-2 sm:pb-0">
                <span className={`block text-sm ${step.state === 'pending' ? 'text-slate-500' : 'text-slate-200'}`}>{step.label}</span>
                {step.at && <span className="block text-xs text-slate-500">{new Date(step.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
              </span>
            </li>
          ))}
        </ol>

        {/* Paid but never sent to the supplier: explain the real limits honestly */}
        {paidButHeld && (
          <AdminNotice tone="info" title="Fulfilled this order outside Mystery Hub?">
            <p>Supplier acceptance is not recorded. Inspect recovery eligibility or reconcile the supplier outcome before another dispatch. A documented customer remedy can close a failed case through Customer resolution; clearing a flag or closing a test order is not a remedy.</p>
            <p className="mt-1">An active or uncertain supplier outcome cannot be replaced with a manual remedy. Save the evidence and keep the order flagged while it is reconciled.</p>
          </AdminNotice>
        )}

        {/* Payment and customer */}
        <AdminPanel title="Payment and customer">
          <DefinitionList items={[
            ['Payment', <StatusPill key="p" tone={order.payment_status === 'success' ? 'success' : order.payment_status === 'pending' ? 'warning' : 'neutral'}>{order.payment_status === 'success' ? 'Verified paid' : order.payment_status === 'pending' ? 'Not confirmed' : order.payment_status==='not_required'?'No customer payment':order.payment_status==='recorded'?'External collection recorded':order.payment_status}</StatusPill>],
            ['Amount', <span key="a">{ghs(order.amount)}{order.service_fee_ghc ? <span className="text-slate-500"> · fee GH₵{order.service_fee_ghc.toFixed(2)}</span> : null}</span>],
            ['Payment basis', order.payment_provider === 'wallet' ? 'Mystery Wallet' : order.payment_provider==='complimentary'?'Complimentary · no customer payment':order.payment_provider==='admin_external'?'External collection · operator attested':'Paystack'],
            ['Payment reference', <span key="r" className="inline-flex items-center gap-1 font-mono text-xs">{order.payment_reference || '—'}{order.payment_reference && copyButton(order.payment_reference, 'pay', 'Copy payment reference')}</span>],
            ['Recipient', <span key="rc" className="inline-flex items-center gap-1 font-mono">{order.recipient_phone}{copyButton(order.recipient_phone, 'phone', 'Copy recipient phone')}</span>],
            ['Customer', order.customer_name || 'Guest checkout'],
            ['Email', order.customer_email || '—'],
            ['Customer phone', order.customer_phone || order.recipient_phone],
          ]} />
          {customerWhatsapp && <a href={customerWhatsapp} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-100 hover:border-[#00c365]"><MessageCircle className="h-4 w-4 text-[#00c365]" />Message customer on WhatsApp</a>}
        </AdminPanel>

        {order.service_type === 'afa' && (
          <AdminPanel title="AFA registration" tone="warning">
            {order.afa_registration ? <DefinitionList items={[
              ['Legal name', order.afa_registration.name], ['Ghana Card', order.afa_registration.maskedIdNumber], ['Region / location', `${order.afa_registration.region} / ${order.afa_registration.location}`],
              ['Occupation', order.afa_registration.occupation || 'Not supplied'], ['Supplier ID', order.afa_registration.supplierPublicId || 'Awaiting acknowledgement'], ['Supplier status', order.afa_registration.supplierStatus || 'Not submitted'],
              ['Identity payload', order.afa_registration.sensitivePayloadPurgedAt ? 'Purged' : 'Encrypted, retained for fulfilment'],
            ]} /> : <p className="text-slate-400">Registration details are loading or unavailable.</p>}
            <p className="mt-2 text-xs text-slate-400">Uncertain submissions without a supplier ID require support reconciliation. Never resubmit blindly.</p>
          </AdminPanel>
        )}

        {/* Fulfilment */}
        {isMarketplace ? (
          <AdminPanel title="Marketplace fulfilment" actions={<StatusPill tone="accent" dot={false}>{FULFILMENT_LABELS[(order.fulfilment_method || 'pickup') as FulfilmentMode]}</StatusPill>}>
            <DefinitionList items={[
              ['Product', order.product_name_snapshot],
              ...(order.variant_snapshot ? [['Option', order.variant_snapshot] as [string, string]] : []),
              ...(order.fulfilment_method === 'pickup' ? [['Pickup location', order.pickup_location_snapshot || 'Not recorded on this order'] as [string, string]] : []),
              ...(order.fulfilment_method === 'delivery' ? [['Delivery address', [order.delivery_city, order.delivery_area].filter(Boolean).join(', ') || 'Not recorded'] as [string, string]] : []),
              ...(order.delivery_landmark ? [['Landmark', order.delivery_landmark] as [string, string]] : []),
              ...(order.delivery_note ? [['Customer note', order.delivery_note] as [string, string]] : []),
            ]} />
            {order.marketplace_context && (
              <div className="mt-3 space-y-1 rounded-xl border border-slate-800 p-3 text-xs text-slate-300">
                <p className="font-semibold text-slate-200">Captured at purchase</p>
                <p>Product type: {String(order.marketplace_context.productKind || '—')}</p>
                {Boolean(order.marketplace_context.identifierValue) && <p>{String(order.marketplace_context.identifierLabel)}: {String(order.marketplace_context.identifierValue)}</p>}
                {Boolean(order.marketplace_context.fulfilmentNote) && <p>{String(order.marketplace_context.fulfilmentNote)}</p>}
                {Boolean(order.marketplace_context.purchaseNote) && <p>{String(order.marketplace_context.purchaseNote)}</p>}
              </div>
            )}
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-slate-200">Fulfilment step</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'awaiting_fulfilment', label: digital ? 'Awaiting Fulfilment' : 'Awaiting Dispatch' },
                  { id: 'processing', label: 'Processing' },
                  { id: 'ready_for_pickup', label: 'Ready for Pickup' },
                  { id: 'out_for_delivery', label: 'Out for Delivery' },
                  { id: 'completed', label: 'Completed / Delivered' },
                  ...(order.payment_status === 'success' ? [] : [{ id: 'refunded', label: 'Refunded' }]),
                  { id: 'cancelled', label: 'Cancelled' },
                ].filter(step => !digital || !['ready_for_pickup', 'out_for_delivery'].includes(step.id))
                  .filter(step => order.fulfilment_method !== 'delivery' || step.id !== 'ready_for_pickup')
                  .filter(step => order.fulfilment_method !== 'pickup' || step.id !== 'out_for_delivery')
                  .map(step => {
                    const current = order.marketplace_status === step.id || order.status === step.id;
                    return <button key={step.id} type="button" disabled={updatingStatus || current} aria-pressed={current} onClick={() => setConfirmStep(step.id)} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${current ? 'border-[#00c365] bg-[#00c365] text-black' : 'border-slate-700 text-slate-200 hover:border-slate-500'} disabled:cursor-default`}>{step.label}</button>;
                  })}
              </div>
              <p className="text-xs text-slate-500">Cancelling a paid order does not refund the customer. Paid refunds go through Customer resolution.</p>
            </div>
          </AdminPanel>
        ) : (
          <AdminPanel title="Supplier" description="Success Biz Hub" actions={(order.supplier_order_id || order.service_type === 'afa') && <AdminButton onClick={onRefreshSupplier} busy={refreshingSupplier} disabled={order.status === 'delivered' || order.resolution?.stage === 'resolved'}><RefreshCw className="h-4 w-4" />Check supplier now</AdminButton>}>
            <DefinitionList items={[
              ['Supplier order ID', order.supplier_order_id ? <span key="s" className="inline-flex items-center gap-1 font-mono text-xs">{order.supplier_order_id}{copyButton(order.supplier_order_id, 'sup', 'Copy supplier order ID')}</span> : 'No supplier identifier recorded'],
              ['Last supplier status', supplierStatus || (order.supplier_response ? 'Unreadable response' : 'No response recorded')],
              ['Last checked', order.supplier_last_checked_at ? new Date(order.supplier_last_checked_at).toLocaleString() : 'Not recorded'],
              ['Recorded supplier cost', order.supplier_cost_minor != null ? ghs(order.supplier_cost_minor) : 'Not recorded'],
              ['Package code', order.supplier_offer_ref || 'Standard catalogue'],
            ]} />
            {order.failure_reason && <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-200"><span className="font-semibold">Failure reason: </span><span className="font-mono">{order.failure_reason}</span></p>}
            <p className="mt-3 text-xs text-slate-500">A successful supplier API response is not proof the customer received the bundle. Delivery is confirmed only when the supplier reports it delivered.</p>
            {order.supplier_response && (
              <div className="mt-3">
                <button type="button" onClick={() => setShowRaw(!showRaw)} aria-expanded={showRaw} className="min-h-11 text-sm font-semibold text-slate-300 hover:text-white">{showRaw ? 'Hide' : 'Show'} raw supplier response</button>
                {showRaw && <pre className="max-h-48 overflow-auto rounded-xl bg-black/70 p-3 font-mono text-xs text-emerald-300">{order.supplier_response}</pre>}
              </div>
            )}
          </AdminPanel>
        )}

        {['complimentary','admin_external'].includes(order.payment_provider)&&<AdminAssistedEvidence id={order.id} token={token}/>}
        {/* Customer resolution (existing audited workflow) */}
        {(resolutionEligible || order.resolution) && (
          <AdminPanel title="Customer resolution" description="Refunds and documented remedies for paid orders that were not delivered.">
            <AdminOrderResolution key={order.id} order={order} token={token} onUpdated={onResolutionUpdated} />
          </AdminPanel>
        )}

        {/* Notes and review flag */}
        {!isMarketplace&&paid&&order.status!=='delivered'&&order.resolution?.stage!=='resolved'&&<AdminOrderRecovery order={order} token={token} onUpdated={onResolutionUpdated}/>}
        <AdminPanel title="Internal note and review flag" actions={<AdminButton onClick={onToggleFlag} className={order.manual_review ? 'border-amber-500/50 text-amber-200' : ''}><Flag className="h-4 w-4" />{order.manual_review ? 'Clear review flag' : 'Flag for review'}</AdminButton>}>
          <label className={adminLabel}>
            <span>Internal note (never shown to the customer)</span>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="What happened, what you checked and what you told the customer" className={`${adminField} min-h-24`} />
          </label>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{order.manual_review ? 'Clearing the flag only removes it from review. It does not refund or resolve the customer case.' : 'Flag an order to keep it in Needs Attention while you investigate.'}</p>
            <AdminButton variant="primary" onClick={onSaveNote} busy={savingNote} disabled={(order.admin_note || '') === note.trim()}>Save note</AdminButton>
          </div>
        </AdminPanel>

        {/* Genuine pre-launch test orders only */}
        {!order.supplier_order_id && !['delivered', 'failed', 'refunded'].includes(order.status) && order.resolution?.stage !== 'resolved' && (
          <details className="rounded-2xl border border-slate-800 p-4" open={testClosure.show}>
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-300" onClick={e => { e.preventDefault(); testClosure.setShow(!testClosure.show); }}>Pre-launch test order tools</summary>
            <div className="space-y-3 pt-2">
              <AdminNotice tone="warning" title="Only for genuine test orders">
                This marks the order <strong>failed</strong> with a test-order reason so it stops blocking MTN duplicate protection. Never use it for a real customer, including one you fulfilled outside the system: it would record a false failure and does not refund anyone.
              </AdminNotice>
              {paid && (
                <label className="flex items-start gap-3 text-sm text-slate-200">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-amber-400" checked={testClosure.confirmPaid} onChange={e => testClosure.setConfirmPaid(e.target.checked)} />
                  <span>I confirm this is a pre-launch/test order and no customer refund is being performed by this action.</span>
                </label>
              )}
              <label className={adminLabel}><span>Reason (recorded in the audit log)</span><input value={testClosure.reason} onChange={e => testClosure.setReason(e.target.value)} placeholder="e.g. Pre-launch developer test order" className={adminField} /></label>
              {testClosure.error && <p role="alert" className="text-sm text-rose-300">{testClosure.error}</p>}
              <div className="flex justify-end gap-2">
                <AdminButton onClick={() => testClosure.setShow(false)} disabled={testClosure.busy}><X className="h-4 w-4" />Cancel</AdminButton>
                <AdminButton variant="danger" busy={testClosure.busy} disabled={paid && !testClosure.confirmPaid} onClick={testClosure.run}>Close as test order</AdminButton>
              </div>
            </div>
          </details>
        )}
      </fieldset>
      {confirmStep && <ConfirmAction
        title="Confirm Marketplace fulfilment step"
        summary={<span>{order.public_reference}: record <strong>{confirmStep.replace(/_/g, ' ')}</strong>.</span>}
        warning={confirmStep === 'cancelled' || confirmStep === 'refunded' ? 'This records the fulfilment state. It does not refund or verify a customer payment. Paid customer remedies require Customer resolution.' : 'Record only what actually happened. This updates the customer-visible fulfilment step; it does not submit another supplier order.'}
        acknowledgement="I checked this order and the recorded fulfilment step is accurate."
        confirmLabel="Record fulfilment step"
        busy={updatingStatus}
        error={null}
        onClose={() => setConfirmStep(null)}
        onConfirm={() => { const step = confirmStep; setConfirmStep(null); onMarketplaceStep(step); }}
      />}
    </AdminSheet>
  );
}
