import React, { useState, useEffect, useCallback } from 'react';
import {
  AdminWaitlistResponse,
  getAdminWaitlistOnServer,
  updateAdminWaitlistOnServer,
  downloadAdminWaitlistCsvOnServer,
} from '../../../services/apiClient';
import { WaitlistRecord, WaitlistStatus } from '../../../../server/types/auth';
import {
  Search,
  RefreshCw,
  Download,
  Phone,
  MessageSquare,
  Mail,
  CheckCircle2,
  Clock,
  UserX,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';

interface AdminWaitlistSectionProps {
  sessionToken: string;
}

export const AdminWaitlistSection: React.FC<AdminWaitlistSectionProps> = ({ sessionToken }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceKeyFilter, setServiceKeyFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const [waitlistData, setWaitlistData] = useState<AdminWaitlistResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit Note Modal / State
  const [editingEntry, setEditingEntry] = useState<WaitlistRecord | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editStatusText, setEditStatusText] = useState<WaitlistStatus>('pending');
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const fetchWaitlist = useCallback(async () => {
    setIsSearching(true);
    setError(null);

    try {
      const res = await getAdminWaitlistOnServer(sessionToken, {
        q: searchTerm.trim() || undefined,
        serviceKey: serviceKeyFilter || undefined,
        channel: channelFilter || undefined,
        status: statusFilter || undefined,
        page: currentPage,
        limit: pageSize,
      });

      if (res.success) {
        setWaitlistData(res);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve waitlist entries.');
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, [sessionToken, searchTerm, serviceKeyFilter, channelFilter, statusFilter, currentPage]);

  useEffect(() => {
    fetchWaitlist();
  }, [fetchWaitlist]);

  // Handle Quick Status Change
  const handleStatusChange = async (id: string, newStatus: WaitlistStatus) => {
    try {
      const res = await updateAdminWaitlistOnServer(sessionToken, id, { status: newStatus });
      if (res.success) {
        setSuccessMessage(`Updated entry status to ${newStatus}.`);
        fetchWaitlist();
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  // Handle Save Note
  const handleSaveNoteAndStatus = async () => {
    if (!editingEntry) return;
    setIsSavingUpdate(true);
    try {
      const res = await updateAdminWaitlistOnServer(sessionToken, editingEntry.id, {
        status: editStatusText,
        adminNote: editNoteText.trim() || undefined,
      });
      if (res.success) {
        setSuccessMessage('Waitlist entry details updated.');
        setEditingEntry(null);
        fetchWaitlist();
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save waitlist update.');
    } finally {
      setIsSavingUpdate(false);
    }
  };

  // Handle CSV Export
  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const blob = await downloadAdminWaitlistCsvOnServer(sessionToken, {
        q: searchTerm.trim() || undefined,
        serviceKey: serviceKeyFilter || undefined,
        channel: channelFilter || undefined,
        status: statusFilter || undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mystery_hub_waitlist_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to download CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageSquare className="w-3.5 h-3.5 text-[#00c365]" />;
      case 'sms':
        return <Radio className="w-3.5 h-3.5 text-sky-400" />;
      case 'phone_call':
        return <Phone className="w-3.5 h-3.5 text-amber-400" />;
      case 'email':
        return <Mail className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Radio className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-2.5 h-2.5" />
            <span>Pending</span>
          </span>
        );
      case 'contacted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Contacted</span>
          </span>
        );
      case 'notified':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Notified</span>
          </span>
        );
      case 'unsubscribed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
            <UserX className="w-2.5 h-2.5" />
            <span>Unsubscribed</span>
          </span>
        );
      default:
        return <span className="text-slate-400 text-xs">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Waitlist Intelligence</h2>
          <p className="text-xs text-slate-400">
            Manage interest in upcoming utilities, filter demand by service, and export leads.
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
            onClick={handleExportCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00c365]/10 hover:bg-[#00c365]/20 text-[#00c365] border border-[#00c365]/30 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Generating CSV...' : 'Export Filtered CSV'}</span>
          </button>

          <button
            onClick={() => fetchWaitlist()}
            disabled={isSearching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin text-[#00c365]' : ''}`} />
            <span>{isSearching ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Aggregate Service Breakdown Cards */}
      {waitlistData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Total Registrations</span>
            <div className="text-2xl font-extrabold text-white font-mono">{waitlistData.stats.totalAll}</div>
            <div className="text-[11px] text-[#00c365]">Persisted across all utilities</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Pending Action</span>
            <div className="text-2xl font-extrabold text-amber-400 font-mono">{waitlistData.stats.totalPending}</div>
            <div className="text-[11px] text-slate-500">Awaiting contact or notification</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-2 col-span-2 sm:col-span-2">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-1">
              <span className="font-semibold text-slate-300">Top Service Demand</span>
              <span className="text-[11px]">Subscribers</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(waitlistData.stats.serviceCounts).length === 0 ? (
                <span className="text-slate-500 text-xs">No entries recorded yet</span>
              ) : (
                Object.entries(waitlistData.stats.serviceCounts).map(([service, count]) => (
                  <button
                    key={service}
                    onClick={() => {
                      setServiceKeyFilter(serviceKeyFilter === service ? '' : service);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                      serviceKeyFilter === service
                        ? 'bg-[#00c365] text-black font-bold'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>{service}</span>
                    <span className="px-1.5 py-0.2 rounded bg-black/20 text-[10px]">{count}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
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
            placeholder="Search by contact phone/email or service title..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-[#00c365] focus:outline-none text-xs sm:text-sm text-white placeholder:text-slate-500 font-mono transition-colors"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs ${showMobileFilters ? 'block' : 'hidden md:grid'}`}>
          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1">Service Key</label>
            <input
              type="text"
              value={serviceKeyFilter}
              onChange={(e) => {
                setServiceKeyFilter(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="e.g. ecg-tokens, waec-checker..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:border-[#00c365] focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1">Channel Preference</label>
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:border-[#00c365] focus:outline-none"
            >
              <option value="">All Channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="phone_call">Phone Call</option>
              <option value="email">Email</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1">Contact Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:border-[#00c365] focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="contacted">Contacted</option>
              <option value="notified">Notified</option>
              <option value="unsubscribed">Unsubscribed</option>
            </select>
          </div>
        </div>

        {(searchTerm || serviceKeyFilter || channelFilter || statusFilter) && (
          <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
            <span>Filters active.</span>
            <button
              onClick={() => {
                setSearchTerm('');
                setServiceKeyFilter('');
                setChannelFilter('');
                setStatusFilter('');
                setCurrentPage(1);
              }}
              className="text-[#00c365] hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Waitlist Data Listing */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[250px] text-slate-400">
          <RefreshCw className="w-6 h-6 text-[#00c365] animate-spin mb-2" />
          <p className="text-xs">Loading waitlist registrations...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      ) : !waitlistData || waitlistData.entries.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#0f171d] border border-slate-800/90 text-center space-y-2">
          <Clock className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">No Waitlist Registrations</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No submissions matched your search criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-2xl bg-[#0f171d] border border-slate-800/90">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold">
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4">Admin Note</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {waitlistData.entries.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-900/80 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-white">{w.service_title}</span>
                      <span className="block text-[10px] text-slate-500 font-mono">{w.service_key}</span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 capitalize font-medium text-slate-300">
                        {getChannelIcon(w.channel)}
                        <span>{w.channel.replace('_', ' ')}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-200">
                      {w.contact}
                    </td>

                    <td className="py-3 px-4">
                      {getStatusBadge(w.status)}
                    </td>

                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(w.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>

                    <td className="py-3 px-4 max-w-xs truncate text-slate-400 text-[11px]">
                      {w.admin_note ? (
                        <span className="text-slate-300 italic truncate block">&quot;{w.admin_note}&quot;</span>
                      ) : (
                        <span className="text-slate-600">None</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {w.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(w.id, 'contacted')}
                            className="px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-bold cursor-pointer"
                            title="Mark as contacted"
                          >
                            Contacted
                          </button>
                        )}
                        {w.status === 'contacted' && (
                          <button
                            onClick={() => handleStatusChange(w.id, 'notified')}
                            className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold cursor-pointer"
                            title="Mark as notified (launched)"
                          >
                            Notified
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingEntry(w);
                            setEditNoteText(w.admin_note || '');
                            setEditStatusText(w.status);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                          title="Edit note & status"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {waitlistData.entries.map((w) => (
              <div
                key={w.id}
                className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-xs">{w.service_title}</h4>
                    <span className="text-[10px] text-slate-500 font-mono">{w.service_key}</span>
                  </div>
                  {getStatusBadge(w.status)}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-mono text-white font-bold">
                    {getChannelIcon(w.channel)}
                    <span>{w.contact}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(w.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {w.admin_note && (
                  <div className="p-2 rounded-lg bg-slate-900 text-[11px] text-slate-300 italic border border-slate-800">
                    &quot;{w.admin_note}&quot;
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <div className="flex items-center gap-1.5">
                    {w.status !== 'contacted' && (
                      <button
                        onClick={() => handleStatusChange(w.id, 'contacted')}
                        className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30 text-xs font-semibold cursor-pointer"
                      >
                        Mark Contacted
                      </button>
                    )}
                    {w.status !== 'notified' && (
                      <button
                        onClick={() => handleStatusChange(w.id, 'notified')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold cursor-pointer"
                      >
                        Mark Notified
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setEditingEntry(w);
                      setEditNoteText(w.admin_note || '');
                      setEditStatusText(w.status);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {waitlistData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-2 pt-2 text-xs text-slate-400">
              <span>
                Page <strong className="text-white">{waitlistData.pagination.page}</strong> of{' '}
                <strong className="text-white">{waitlistData.pagination.totalPages}</strong> ({waitlistData.pagination.total} entries)
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
                  onClick={() => setCurrentPage((p) => Math.min(waitlistData.pagination.totalPages, p + 1))}
                  disabled={currentPage >= waitlistData.pagination.totalPages}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-30 text-white cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Entry Note Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#0f171d] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Edit Waitlist Record</h3>
                <p className="text-xs text-slate-400 font-mono">{editingEntry.contact} ({editingEntry.service_title})</p>
              </div>
              <button
                onClick={() => setEditingEntry(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Status</label>
                <select
                  value={editStatusText}
                  onChange={(e) => setEditStatusText(e.target.value as WaitlistStatus)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:border-[#00c365] focus:outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="contacted">Contacted</option>
                  <option value="notified">Notified (Service Launched)</option>
                  <option value="unsubscribed">Unsubscribed</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Internal Note</label>
                <textarea
                  value={editNoteText}
                  onChange={(e) => setEditNoteText(e.target.value)}
                  placeholder="e.g. Sent early beta link on WhatsApp, customer requested bulk business rate..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:border-[#00c365] focus:outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setEditingEntry(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNoteAndStatus}
                disabled={isSavingUpdate}
                className="px-4 py-1.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSavingUpdate ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
