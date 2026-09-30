import React, { useState, useEffect, useCallback } from 'react';
import {
  AdminUsersResponse,
  AdminCustomerProfile,
  getAdminUsersOnServer,
  getAdminUserDetailsOnServer,
  updateAdminUserStatusOnServer,
} from '../../../services/apiClient';
import { SafeUserProfile, UserStatus, WaitlistRecord } from '../../../../server/types/auth';
import { AdminOrderDetails } from '../../../../server/types/orders';
import {
  Search,
  Users,
  Shield,
  UserCheck,
  UserX,
  RefreshCw,
  ShoppingBag,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Mail,
  Phone,
  Calendar,
  Clock,
  Eye,
} from 'lucide-react';

interface AdminCustomersSectionProps {
  sessionToken: string;
  currentAdminId: string;
}

export const AdminCustomersSection: React.FC<AdminCustomersSectionProps> = ({
  sessionToken,
  currentAdminId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [usersData, setUsersData] = useState<AdminUsersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Customer Details Drawer
  const [selectedUser, setSelectedUser] = useState<AdminCustomerProfile | null>(null);
  const [userOrders, setUserOrders] = useState<AdminOrderDetails[]>([]);
  const [userWaitlists, setUserWaitlists] = useState<WaitlistRecord[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Status Change Confirmation Dialog
  const [statusTargetUser, setStatusTargetUser] = useState<{ id: string; name: string; currentStatus: UserStatus } | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsSearching(true);
    setError(null);

    try {
      const res = await getAdminUsersOnServer(sessionToken, {
        q: searchTerm.trim() || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page: currentPage,
        limit: pageSize,
      });

      if (res.success) {
        setUsersData(res);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve registered customer accounts.');
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, [sessionToken, searchTerm, roleFilter, statusFilter, currentPage]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Open User Drawer & Fetch Details
  const openUserDetails = async (user: AdminCustomerProfile) => {
    setSelectedUser(user);
    setIsLoadingDetails(true);
    try {
      const res = await getAdminUserDetailsOnServer(sessionToken, user.id);
      if (res.success) {
        setUserOrders(res.orders || []);
        setUserWaitlists(res.waitlist || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load full customer history.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Confirm Status Toggle
  const handleConfirmStatusToggle = async () => {
    if (!statusTargetUser) return;
    const newStatus: UserStatus = statusTargetUser.currentStatus === 'active' ? 'disabled' : 'active';
    setIsTogglingStatus(true);
    try {
      const res = await updateAdminUserStatusOnServer(sessionToken, statusTargetUser.id, newStatus);
      if (res.success) {
        setSuccessMessage(`User account for ${statusTargetUser.name} has been ${newStatus === 'disabled' ? 'disabled' : 'activated'}.`);
        setStatusTargetUser(null);
        fetchUsers();
        if (selectedUser && selectedUser.id === statusTargetUser.id) {
          setSelectedUser((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update user status.');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Customer Accounts</h2>
          <p className="text-xs text-slate-400">
            Real registered customer profiles, lifetime purchase volume, and account access management.
          </p>
        </div>

        <button
          onClick={() => fetchUsers()}
          disabled={isSearching}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin text-[#00c365]' : ''}`} />
          <span>{isSearching ? 'Updating...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs">
          <UserCheck className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-3">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by customer name, email address, or phone number..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-[#00c365] focus:outline-none text-xs sm:text-sm text-white placeholder:text-slate-500 font-mono transition-colors"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1">Account Role</label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:border-[#00c365] focus:outline-none"
            >
              <option value="">All Roles</option>
              <option value="customer">Customer</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1">Account Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:border-[#00c365] focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customers List / Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[250px] text-slate-400">
          <RefreshCw className="w-6 h-6 text-[#00c365] animate-spin mb-2" />
          <p className="text-xs">Loading customer accounts...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      ) : !usersData || usersData.users.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#0f171d] border border-slate-800/90 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">No Registered Customers Found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No customer accounts matched your search criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-2xl bg-[#0f171d] border border-slate-800/90">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold">
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Orders</th>
                  <th className="py-3 px-4 text-right">Lifetime Spent</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4 text-center">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {usersData.users.map((u) => {
                  const isSelf = u.id === currentAdminId;
                  const isActive = u.status === 'active';

                  return (
                    <tr
                      key={u.id}
                      onClick={() => openUserDetails(u)}
                      className="hover:bg-slate-900/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {isSelf && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#00c365]/20 text-[#00c365]">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">ID: {u.id.slice(0, 12)}...</div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                        {u.phone && <div>{u.phone}</div>}
                        {u.email && <div className="text-slate-400">{u.email}</div>}
                        {!u.phone && !u.email && <span className="text-slate-600">None</span>}
                      </td>

                      <td className="py-3 px-4">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                            <Shield className="w-2.5 h-2.5" />
                            <span>Staff Admin</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                            <span>Customer</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                            <span>Disabled</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {u.orderCount}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-[#00c365]">
                        GH₵ {u.totalSpentGhc.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
                          : 'Never'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openUserDetails(u);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="View customer profile and orders"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {!isSelf && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setStatusTargetUser({
                                  id: u.id,
                                  name: u.name,
                                  currentStatus: u.status,
                                });
                              }}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isActive
                                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                              title={isActive ? 'Disable user access' : 'Enable user access'}
                            >
                              {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {usersData.users.map((u) => {
              const isSelf = u.id === currentAdminId;
              const isActive = u.status === 'active';

              return (
                <div
                  key={u.id}
                  onClick={() => openUserDetails(u)}
                  className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90 active:bg-slate-900 transition-colors space-y-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                        <span>{u.name}</span>
                        {isSelf && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#00c365]/20 text-[#00c365]">
                            You
                          </span>
                        )}
                      </h4>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {u.phone || u.email || 'No identifier'}
                      </span>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-xs font-bold text-[#00c365]">
                        GH₵ {u.totalSpentGhc.toFixed(2)}
                      </span>
                      <span className="block text-[10px] text-slate-500">{u.orderCount} orders</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                    <div className="flex items-center gap-1.5">
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                          Disabled
                        </span>
                      )}
                      <span className="text-slate-500 capitalize text-[11px]">{u.role}</span>
                    </div>

                    {!isSelf && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusTargetUser({
                            id: u.id,
                            name: u.name,
                            currentStatus: u.status,
                          });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          isActive
                            ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {isActive ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {usersData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-2 pt-2 text-xs text-slate-400">
              <span>
                Page <strong className="text-white">{usersData.pagination.page}</strong> of{' '}
                <strong className="text-white">{usersData.pagination.totalPages}</strong> ({usersData.pagination.total} accounts)
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
                  onClick={() => setCurrentPage((p) => Math.min(usersData.pagination.totalPages, p + 1))}
                  disabled={currentPage >= usersData.pagination.totalPages}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-30 text-white cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Customer Details Drawer / Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0f171d] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="space-y-0.5">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>{selectedUser.name}</span>
                  {selectedUser.status === 'active' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                      Disabled
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">User ID: {selectedUser.id}</p>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
              {/* Profile Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div>
                  <span className="text-[11px] text-slate-500 block">Email Address</span>
                  <span className="font-mono text-white truncate block">{selectedUser.email || 'None'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Ghana Phone</span>
                  <span className="font-mono text-white block">{selectedUser.phone || 'None'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Role</span>
                  <span className="font-semibold text-white capitalize">{selectedUser.role}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Joined</span>
                  <span className="font-mono text-slate-300">
                    {new Date(selectedUser.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Order History */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#00c365]" />
                    <span>Order History ({userOrders.length})</span>
                  </h4>
                </div>

                {isLoadingDetails ? (
                  <div className="p-4 text-center text-slate-500 text-xs">Loading customer orders...</div>
                ) : userOrders.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/40 text-center text-slate-500 text-xs border border-slate-800/60">
                    No orders linked to this customer account.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {userOrders.map((o) => (
                      <div
                        key={o.id}
                        className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-white">{o.public_reference}</span>
                          <span className="text-slate-400 block text-[11px]">{o.product_name_snapshot} ({o.recipient_phone})</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-[#00c365]">GH₵ {(o.amount / 100).toFixed(2)}</span>
                          <span className="block text-[10px] text-slate-400 capitalize">{o.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Waitlist Registrations */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
                  <span>Waitlist Memberships ({userWaitlists.length})</span>
                </h4>

                {userWaitlists.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/40 text-center text-slate-500 text-xs border border-slate-800/60">
                    No waitlist registrations for this customer.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userWaitlists.map((w) => (
                      <div
                        key={w.id}
                        className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-white">{w.service_title}</span>
                          <span className="text-slate-400 block text-[11px]">Via {w.channel} ({w.contact})</span>
                        </div>
                        <span className="text-xs font-mono text-amber-400 capitalize">{w.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-end">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Disabling/Enabling User */}
      {statusTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#0f171d] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${statusTargetUser.currentStatus === 'active' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {statusTargetUser.currentStatus === 'active' ? 'Disable Customer Account?' : 'Enable Customer Account?'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">{statusTargetUser.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {statusTargetUser.currentStatus === 'active'
                ? 'Disabling this account will immediately revoke all active authenticated sessions and prevent the customer from logging in or placing new orders until re-enabled.'
                : 'Enabling this account will restore normal customer login access and order placement capabilities.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setStatusTargetUser(null)}
                disabled={isTogglingStatus}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusToggle}
                disabled={isTogglingStatus}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  statusTargetUser.currentStatus === 'active'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-[#00c365] hover:bg-[#00e575] text-black'
                }`}
              >
                {isTogglingStatus ? 'Updating...' : statusTargetUser.currentStatus === 'active' ? 'Disable Account' : 'Enable Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
