import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AdminOrdersResponse,
  getAdminOrdersOnServer,
  refreshAdminOrderOnServer,
  updateAdminOrderReviewOnServer,
  closeAdminTestOrderOnServer,
} from '../../../services/apiClient';
import { AdminOrderDetails } from '../../../../server/types/orders';
import {
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  Check,
  Flag,
  FileText,
  Radio,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';

interface AdminOrdersSectionProps {
  sessionToken: string;
}

export const AdminOrdersSection: React.FC<AdminOrdersSectionProps> = ({ sessionToken }) => {
  // Query & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('');
  const [networkFilter, setNetworkFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('');
  const [manualReviewFilter, setManualReviewFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Data State
  const [ordersData, setOrdersData] = useState<AdminOrdersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Order for Drawer & Stable Ref to prevent race conditions on close
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetails | null>(null);
  const selectedOrderRef = useRef<AdminOrderDetails | null>(null);
  const [isRefreshingSupplier, setIsRefreshingSupplier] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Administrative Resolution State
  const [showCloseTestConfirm, setShowCloseTestConfirm] = useState(false);
  const [confirmPaidCheckbox, setConfirmPaidCheckbox] = useState(false);
  const [closeTestReason, setCloseTestReason] = useState('');
  const [isClosingTest, setIsClosingTest] = useState(false);
  const [closeTestError, setCloseTestError] = useState<string | null>(null);

  // Dedicated Drawer Close Handler
  const closeOrderDrawer = useCallback(() => {
    selectedOrderRef.current = null;
    setSelectedOrder(null);
    setActionSuccessMessage(null);
    setShowTechnicalDetails(false);
    setCopiedKey(null);
    setShowCloseTestConfirm(false);
    setConfirmPaidCheckbox(false);
    setCloseTestReason('');
    setIsClosingTest(false);
    setCloseTestError(null);
  }, []);

  // Dedicated Drawer Open Handler
  const openOrderDrawer = useCallback((order: AdminOrderDetails) => {
    selectedOrderRef.current = order;
    setSelectedOrder(order);
    setActionSuccessMessage(null);
    setShowTechnicalDetails(false);
    setCopiedKey(null);
    setAdminNoteInput(order.admin_note || '');
    setShowCloseTestConfirm(false);
    setConfirmPaidCheckbox(false);
    setCloseTestReason('');
    setIsClosingTest(false);
    setCloseTestError(null);
  }, []);

  const fetchOrders = useCallback(async () => {
    setIsSearching(true);
    setError(null);

    try {
      const res = await getAdminOrdersOnServer(sessionToken, {
        q: searchTerm.trim() || undefined,
        serviceType: serviceTypeFilter || undefined,
        network: networkFilter || undefined,
        status: statusFilter || undefined,
        paymentStatus: paymentStatusFilter || undefined,
        manualReview: manualReviewFilter === 'true' ? true : manualReviewFilter === 'false' ? false : undefined,
        page: currentPage,
        limit: pageSize,
      });

      if (res.success) {
        setOrdersData(res);
        // Only update selectedOrder if drawer is currently open and reference matches
        if (selectedOrderRef.current) {
          const currentRef = selectedOrderRef.current.public_reference;
          const updated = res.orders.find((o) => o.public_reference === currentRef);
          if (updated && selectedOrderRef.current) {
            selectedOrderRef.current = updated;
            setSelectedOrder(updated);
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve orders.');
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, [
    sessionToken,
    searchTerm,
    serviceTypeFilter,
    networkFilter,
    statusFilter,
    paymentStatusFilter,
    manualReviewFilter,
    currentPage,
  ]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Escape key listener to close order details drawer
  useEffect(() => {
    if (!selectedOrder) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeOrderDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrder, closeOrderDrawer]);

  // Handle Copy to Clipboard
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Handle Supplier Status Refresh
  const handleRefreshSupplierStatus = async (reference: string) => {
    setIsRefreshingSupplier(true);
    setActionSuccessMessage(null);

    try {
      const res = await refreshAdminOrderOnServer(sessionToken, reference);
      if (res.success && res.order) {
        setSelectedOrder(res.order);
        setActionSuccessMessage(res.message || 'Supplier status successfully updated.');
        // Refresh full table
        fetchOrders();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to refresh supplier status.');
    } finally {
      setIsRefreshingSupplier(false);
    }
  };

  // Handle Manual Review Toggle
  const handleToggleManualReview = async (order: AdminOrderDetails) => {
    try {
      const newFlag = !order.manual_review;
      const res = await updateAdminOrderReviewOnServer(sessionToken, order.public_reference, {
        manualReview: newFlag,
      });
      if (res.success && res.order) {
        setSelectedOrder(res.order);
        setActionSuccessMessage(newFlag ? 'Flagged for manual review.' : 'Manual review flag resolved.');
        fetchOrders();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update review flag.');
    }
  };

  // Handle Admin Note Save
  const handleSaveAdminNote = async (order: AdminOrderDetails) => {
    setIsSavingNote(true);
    setActionSuccessMessage(null);
    try {
      const res = await updateAdminOrderReviewOnServer(sessionToken, order.public_reference, {
        adminNote: adminNoteInput.trim() || null,
      });
      if (res.success && res.order) {
        setSelectedOrder(res.order);
        setActionSuccessMessage('Admin operational note saved.');
        fetchOrders();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save admin note.');
    } finally {
      setIsSavingNote(false);
    }
  };

  // Handle Controlled Close As Pre-launch Test Order
  const handleCloseTestOrder = async () => {
    if (!selectedOrder) return;
    setIsClosingTest(true);
    setCloseTestError(null);
    setActionSuccessMessage(null);

    try {
      const res = await closeAdminTestOrderOnServer(sessionToken, selectedOrder.public_reference, {
        confirmPaidTestOrder: confirmPaidCheckbox,
        reason: closeTestReason.trim() || undefined,
      });

      if (res.success && res.order) {
        selectedOrderRef.current = res.order;
        setSelectedOrder(res.order);
        setActionSuccessMessage(res.message || 'Test order closed. It will no longer block new MTN orders.');
        setShowCloseTestConfirm(false);
        setConfirmPaidCheckbox(false);
        setCloseTestReason('');
        // Refresh full table
        fetchOrders();
      }
    } catch (err: unknown) {
      setCloseTestError(err instanceof Error ? err.message : 'Failed to close test order.');
    } finally {
      setIsClosingTest(false);
    }
  };

  // Helper for Status Badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Delivered</span>
          </span>
        );
      case 'processing':
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <Clock className="w-2.5 h-2.5 animate-spin" />
            <span>{status === 'submitted' ? 'Submitted' : 'Processing'}</span>
          </span>
        );
      case 'refund_pending':
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-2.5 h-2.5" />
            <span>{status === 'refund_pending' ? 'Refund Attention' : 'Failed'}</span>
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <span>Refunded</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
            <span>{status}</span>
          </span>
        );
    }
  };

  const getPaymentBadge = (paymentStatus: string) => {
    if (paymentStatus === 'success') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#00c365]/10 text-[#00c365]">
          Paid
        </span>
      );
    }
    if (paymentStatus === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400">
          Payment Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400">
        {paymentStatus}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Order Management</h2>
          <p className="text-xs text-slate-400">
            Search, filter, inspect supplier dispatch, and flag orders for manual review.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#00c365]" />
            <span>Filters</span>
          </button>

          <button
            onClick={() => fetchOrders()}
            disabled={isSearching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin text-[#00c365]' : ''}`} />
            <span>{isSearching ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-3">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by MH reference, recipient phone, email, or Paystack ref..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-[#00c365] focus:outline-none text-xs sm:text-sm text-white placeholder:text-slate-500 font-mono transition-colors"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Dropdowns (Desktop always visible, Mobile toggleable) */}
        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs ${showMobileFilters ? 'block' : 'hidden md:grid'}`}>
          {/* Service Type */}
          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1">Service Type</label>
            <select
              value={serviceTypeFilter}
              onChange={(e) => {
                setServiceTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:border-[#00c365] focus:outline-none"
            >
              <option value="">All Services</option>
              <option value="data">Data Bundles</option>
              <option value="instant_bundle">Instant Bundles</option>
              <option value="airtime">Airtime Top-up</option>
            </select>
          </div>

          {/* Network */}
          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1">Network</label>
            <select
              value={networkFilter}
              onChange={(e) => {
                setNetworkFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:border-[#00c365] focus:outline-none"
            >
              <option value="">All Networks</option>
              <option value="mtn">MTN</option>
              <option value="telecel">Telecel</option>
              <option value="airteltigo">AirtelTigo (AT)</option>
            </select>
          </div>

          {/* Order Status */}
          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1">Fulfilment Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:border-[#00c365] focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="delivered">Delivered</option>
              <option value="processing">Processing</option>
              <option value="submitted">Submitted</option>
              <option value="queued">Queued</option>
              <option value="refund_pending">Refund Attention</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Payment Status */}
          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1">Payment Status</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:border-[#00c365] focus:outline-none"
            >
              <option value="">All Payments</option>
              <option value="success">Paid (Success)</option>
              <option value="pending">Pending</option>
              <option value="failed">Payment Failed</option>
            </select>
          </div>

          {/* Manual Review Flag */}
          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1">Manual Review</label>
            <select
              value={manualReviewFilter}
              onChange={(e) => {
                setManualReviewFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:border-[#00c365] focus:outline-none"
            >
              <option value="">All Orders</option>
              <option value="true">Flagged for Review</option>
              <option value="false">Unflagged Only</option>
            </select>
          </div>
        </div>

        {/* Active Filter Badges */}
        {(serviceTypeFilter || networkFilter || statusFilter || paymentStatusFilter || manualReviewFilter) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-500">Active filters:</span>
            {serviceTypeFilter && (
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 flex items-center gap-1">
                Type: {serviceTypeFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setServiceTypeFilter('')} />
              </span>
            )}
            {networkFilter && (
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 flex items-center gap-1">
                Network: {networkFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setNetworkFilter('')} />
              </span>
            )}
            {statusFilter && (
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 flex items-center gap-1">
                Status: {statusFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setStatusFilter('')} />
              </span>
            )}
            {paymentStatusFilter && (
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 flex items-center gap-1">
                Payment: {paymentStatusFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setPaymentStatusFilter('')} />
              </span>
            )}
            {manualReviewFilter && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 flex items-center gap-1">
                Manual Review: Flagged
                <X className="w-3 h-3 cursor-pointer" onClick={() => setManualReviewFilter('')} />
              </span>
            )}
            <button
              onClick={() => {
                setServiceTypeFilter('');
                setNetworkFilter('');
                setStatusFilter('');
                setPaymentStatusFilter('');
                setManualReviewFilter('');
                setCurrentPage(1);
              }}
              className="text-[#00c365] hover:underline ml-1 cursor-pointer"
            >
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* Orders List / Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400">
          <RefreshCw className="w-6 h-6 text-[#00c365] animate-spin mb-2" />
          <p className="text-xs">Loading orders...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      ) : !ordersData || ordersData.orders.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#0f171d] border border-slate-800/90 text-center space-y-2">
          <Filter className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">No Orders Found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No customer orders matched your search or active filter criteria. Try clearing your filters or searching a different term.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View (md and up) */}
          <div className="hidden md:block overflow-x-auto rounded-2xl bg-[#0f171d] border border-slate-800/90">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold">
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Service & Network</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Supplier Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ordersData.orders.map((order) => {
                  const isAirtime = order.service_type === 'airtime' || order.product_name_snapshot.toLowerCase().includes('airtime');
                  const amountGhc = (order.amount / 100).toFixed(2);
                  const isFlagged = Boolean(order.manual_review);

                  return (
                    <tr
                      key={order.id}
                      onClick={() => openOrderDrawer(order)}
                      className="hover:bg-slate-900/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-white flex items-center gap-1.5">
                        {isFlagged && (
                          <span title="Flagged for manual review">
                            <Flag className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                          </span>
                        )}
                        <span>{order.public_reference}</span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <span>{isAirtime ? 'Airtime Top-Up' : order.product_name_snapshot}</span>
                          {order.service_type === 'instant_bundle' && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1 rounded">
                              Instant
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 uppercase font-mono">{order.network}</div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-300">
                        {order.recipient_phone}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        GH₵ {amountGhc}
                      </td>

                      <td className="py-3 px-4">
                        {getStatusBadge(order.status)}
                      </td>

                      <td className="py-3 px-4">
                        {getPaymentBadge(order.payment_status)}
                      </td>

                      <td className="py-3 px-4">
                        {order.supplier_order_id ? (
                          <span className="font-mono text-[11px] text-slate-300" title={`Supplier ID: ${order.supplier_order_id}`}>
                            {order.supplier_order_id.slice(0, 14)}...
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Not dispatched</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className="block text-[10px] text-slate-500">
                          {new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openOrderDrawer(order);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="View order details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (Hidden on md, visible on phones 360-412px) */}
          <div className="md:hidden space-y-3">
            {ordersData.orders.map((order) => {
              const isAirtime = order.service_type === 'airtime' || order.product_name_snapshot.toLowerCase().includes('airtime');
              const amountGhc = (order.amount / 100).toFixed(2);
              const isFlagged = Boolean(order.manual_review);

              return (
                <div
                  key={order.id}
                  onClick={() => openOrderDrawer(order)}
                  className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90 active:bg-slate-900 transition-colors space-y-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-mono font-bold text-white text-xs">
                      {isFlagged && <Flag className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
                      <span>{order.public_reference}</span>
                    </div>
                    <div className="font-mono font-extrabold text-sm text-[#00c365]">
                      GH₵ {amountGhc}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <div>
                      <span className="font-medium text-white">{isAirtime ? 'Airtime' : order.product_name_snapshot}</span>
                      <span className="text-slate-500 font-mono uppercase ml-1.5">({order.network})</span>
                    </div>
                    <span className="font-mono text-slate-400 text-[11px]">{order.recipient_phone}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(order.status)}
                      {getPaymentBadge(order.payment_status)}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {ordersData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-2 pt-2 text-xs text-slate-400">
              <span>
                Page <strong className="text-white">{ordersData.pagination.page}</strong> of{' '}
                <strong className="text-white">{ordersData.pagination.totalPages}</strong> ({ordersData.pagination.total} orders)
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-30 text-white cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(ordersData.pagination.totalPages, p + 1))}
                  disabled={currentPage >= ordersData.pagination.totalPages}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-30 text-white cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order Details Drawer / Modal */}
      {selectedOrder && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            closeOrderDrawer();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#0f171d] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white font-mono">
                    {selectedOrder.public_reference}
                  </h3>
                  {selectedOrder.manual_review && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Manual Review Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Internal ID: {selectedOrder.id}
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeOrderDrawer();
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
              {/* Action Success Alert */}
              {actionSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-400">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{actionSuccessMessage}</span>
                </div>
              )}

              {/* Status Alert if Needs Attention */}
              {(selectedOrder.status === 'refund_pending' || selectedOrder.status === 'failed') && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1 text-amber-300">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Manual Operational Attention Required</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    This order encountered a supplier delivery exception. Check internal failure reason below. Note: Live Paystack refunds or supplier re-orders must be handled directly through verified dashboards.
                  </p>
                </div>
              )}

              {/* Core Order Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div>
                  <span className="text-[11px] text-slate-500 block">Service & Network</span>
                  <span className="font-bold text-white">{selectedOrder.product_name_snapshot}</span>
                  <span className="block text-slate-400 uppercase font-mono">{selectedOrder.network}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block">Recipient Phone</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-white">
                    <span>{selectedOrder.recipient_phone}</span>
                    <button
                      onClick={() => handleCopy(selectedOrder.recipient_phone, 'phone')}
                      className="text-slate-500 hover:text-white"
                      title="Copy phone"
                    >
                      {copiedKey === 'phone' ? <Check className="w-3 h-3 text-[#00c365]" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block">Amount Paid</span>
                  <span className="font-mono font-bold text-base text-[#00c365]">
                    GH₵ {(selectedOrder.amount / 100).toFixed(2)}
                  </span>
                  {selectedOrder.service_fee_ghc !== undefined && selectedOrder.service_fee_ghc > 0 && (
                    <span className="block text-[10px] text-slate-500">
                      (Fee: GH₵ {selectedOrder.service_fee_ghc.toFixed(2)})
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block">Fulfilment Status</span>
                  <div className="pt-0.5">{getStatusBadge(selectedOrder.status)}</div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block">Payment Status</span>
                  <div className="pt-0.5">{getPaymentBadge(selectedOrder.payment_status)}</div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block">Payment Reference</span>
                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-300 truncate">
                    <span className="truncate">{selectedOrder.payment_reference || 'N/A'}</span>
                    {selectedOrder.payment_reference && (
                      <button
                        onClick={() => handleCopy(selectedOrder.payment_reference!, 'pay_ref')}
                        className="text-slate-500 hover:text-white shrink-0"
                      >
                        {copiedKey === 'pay_ref' ? <Check className="w-3 h-3 text-[#00c365]" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Customer Details */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                <h4 className="text-xs font-bold text-slate-300">Customer Identification</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Name</span>
                    <span className="text-white">{selectedOrder.customer_name || 'Guest Checkout'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Email</span>
                    <span className="text-white font-mono">{selectedOrder.customer_email || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Customer Phone</span>
                    <span className="text-white font-mono">{selectedOrder.customer_phone || selectedOrder.recipient_phone}</span>
                  </div>
                </div>
              </div>

              {/* Supplier Integration Diagnostics */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-sky-400" />
                    <span>Supplier Dispatch Details (Success Biz Hub)</span>
                  </h4>
                  {selectedOrder.supplier_order_id && (
                    <button
                      onClick={() => handleRefreshSupplierStatus(selectedOrder.public_reference)}
                      disabled={isRefreshingSupplier}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-semibold text-[11px] border border-sky-500/30 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isRefreshingSupplier ? 'animate-spin' : ''}`} />
                      <span>{isRefreshingSupplier ? 'Checking Supplier...' : 'Refresh Status'}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Supplier Order ID</span>
                    <span className="font-mono text-white font-bold">
                      {selectedOrder.supplier_order_id || 'Not Dispatched'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block">Recorded Wholesale Cost</span>
                    <span className="font-mono text-white">
                      {selectedOrder.supplier_cost_minor !== null
                        ? `GH₵ ${(selectedOrder.supplier_cost_minor / 100).toFixed(2)}`
                        : 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block">Package Offer Code</span>
                    <span className="font-mono text-slate-300">
                      {selectedOrder.supplier_offer_ref || 'Standard Catalog'}
                    </span>
                  </div>
                </div>

                {selectedOrder.failure_reason && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-[11px] text-red-300 font-mono">
                    <strong className="block text-red-400 font-sans">Failure / Rejection Reason:</strong>
                    {selectedOrder.failure_reason}
                  </div>
                )}
              </div>

              {/* Internal Admin Note & Manual Review Controls */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Operational Notes & Review State</span>
                  </h4>
                  <button
                    onClick={() => handleToggleManualReview(selectedOrder)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      selectedOrder.manual_review
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                        : 'bg-slate-800 text-slate-300 border border-slate-700 hover:text-white'
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{selectedOrder.manual_review ? 'Resolve Review Flag' : 'Flag for Manual Review'}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <textarea
                    value={adminNoteInput}
                    onChange={(e) => setAdminNoteInput(e.target.value)}
                    placeholder="Add operational notes (e.g. 'Verified with customer on WhatsApp', 'Customer requested change of network')..."
                    rows={2}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-[#00c365] focus:outline-none text-xs text-slate-200 placeholder:text-slate-600 transition-colors"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleSaveAdminNote(selectedOrder)}
                      disabled={isSavingNote}
                      className="px-3 py-1.5 rounded-lg bg-[#00c365] hover:bg-[#00e575] text-black text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSavingNote ? 'Saving...' : 'Save Note'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Collapsible Technical Supplier Response */}
              {selectedOrder.supplier_response && (
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                    className="w-full p-3 bg-slate-900/90 text-left text-xs text-slate-400 hover:text-white flex items-center justify-between font-mono cursor-pointer"
                  >
                    <span>Technical Supplier Response</span>
                    <span>{showTechnicalDetails ? '▲ Hide' : '▼ Expand'}</span>
                  </button>
                  {showTechnicalDetails && (
                    <div className="p-3 bg-black/80 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-48">
                      <pre>{selectedOrder.supplier_response}</pre>
                    </div>
                  )}
                </div>
              )}

              {/* Administrative Resolution Section */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    <span>Administrative Resolution</span>
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">Restricted Controls</span>
                </div>

                {/* Case C: Delivered -> No destructive action */}
                {(selectedOrder.status === 'delivered' || selectedOrder.delivered_at) && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2 text-[11px] text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>This order has been verified as delivered to the customer. No administrative intervention permitted.</span>
                  </div>
                )}

                {/* Case D: Already terminal failed/refunded -> Informational */}
                {(selectedOrder.status === 'failed' || selectedOrder.status === 'refunded') && (
                  <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center gap-2 text-[11px] text-slate-400">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Order is in terminal status ({selectedOrder.status}). It does not block MTN duplicate protection.</span>
                  </div>
                )}

                {/* Case A: supplier_order_id exists -> Show Refresh Supplier Status */}
                {selectedOrder.supplier_order_id && selectedOrder.status !== 'delivered' && selectedOrder.status !== 'failed' && selectedOrder.status !== 'refunded' && (
                  <div className="p-3.5 rounded-lg bg-sky-500/10 border border-sky-500/25 space-y-2">
                    <p className="text-[11px] text-sky-200 leading-relaxed">
                      This order was dispatched to Success Biz Hub (ID: <span className="font-mono font-bold text-white">{selectedOrder.supplier_order_id}</span>). Use supplier refresh to synchronize the live delivery state.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRefreshSupplierStatus(selectedOrder.public_reference)}
                      disabled={isRefreshingSupplier}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSupplier ? 'animate-spin' : ''}`} />
                      <span>{isRefreshingSupplier ? 'Checking Supplier...' : 'Refresh Supplier Status'}</span>
                    </button>
                  </div>
                )}

                {/* Case B: No supplier_order_id AND non-terminal -> Can close as Pre-launch Test */}
                {!selectedOrder.supplier_order_id && selectedOrder.status !== 'delivered' && selectedOrder.status !== 'failed' && selectedOrder.status !== 'refunded' && (
                  <div className="space-y-3">
                    {!showCloseTestConfirm ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                        <div>
                          <div className="font-bold text-amber-300 text-xs">Stale Test Order Resolution</div>
                          <p className="text-[11px] text-slate-400">
                            Terminalize this pre-launch test order so it no longer blocks MTN duplicate protection.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCloseTestConfirm(true);
                            setCloseTestError(null);
                            setConfirmPaidCheckbox(false);
                            setCloseTestReason('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-colors cursor-pointer shrink-0"
                        >
                          Close as Pre-launch Test
                        </button>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-[#141b22] border border-amber-500/40 space-y-3 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-amber-400 text-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Confirm Pre-Launch Test Resolution</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCloseTestConfirm(false);
                              setCloseTestError(null);
                            }}
                            className="text-slate-400 hover:text-white text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>

                        {/* Paid Warning & Mandatory Checkbox */}
                        {(selectedOrder.payment_status === 'success' || Boolean(selectedOrder.paid_at)) && (
                          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 space-y-2">
                            <p className="text-[11px] text-red-300 leading-relaxed font-medium">
                              This order has a successful payment record but no supplier order ID. Only close it if you have confirmed it was a test/pre-launch transaction. This does not refund the payment.
                            </p>
                            <label className="flex items-start gap-2 text-[11px] text-slate-200 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={confirmPaidCheckbox}
                                onChange={(e) => setConfirmPaidCheckbox(e.target.checked)}
                                className="mt-0.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-400 cursor-pointer"
                              />
                              <span className="leading-snug">
                                I confirm this is a pre-launch/test order and no customer refund is being performed by this action.
                              </span>
                            </label>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className="block text-[11px] text-slate-400">
                            Reason for closure (recorded in audit log):
                          </label>
                          <input
                            type="text"
                            value={closeTestReason}
                            onChange={(e) => setCloseTestReason(e.target.value)}
                            placeholder="e.g. Pre-launch developer test order"
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
                          />
                        </div>

                        {closeTestError && (
                          <div className="text-[11px] text-red-400 font-medium p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                            {closeTestError}
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setShowCloseTestConfirm(false);
                              setCloseTestError(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleCloseTestOrder}
                            disabled={
                              isClosingTest ||
                              ((selectedOrder.payment_status === 'success' || Boolean(selectedOrder.paid_at)) &&
                                !confirmPaidCheckbox)
                            }
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                          >
                            {isClosingTest ? 'Terminalizing...' : 'Confirm & Terminalize Order'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleCopy(selectedOrder.public_reference, 'pub_ref_btn')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
              >
                {copiedKey === 'pub_ref_btn' ? <Check className="w-3.5 h-3.5 text-[#00c365]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Reference</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeOrderDrawer();
                }}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
