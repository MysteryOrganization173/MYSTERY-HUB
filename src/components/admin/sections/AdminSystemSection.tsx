import React, { useState, useEffect, useCallback } from 'react';
import {
  AdminSystemStatus,
  getAdminSystemOnServer,
  API_BASE_URL,
} from '../../../services/apiClient';
import {
  Server,
  Database,
  CreditCard,
  Radio,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Activity,
  History,
} from 'lucide-react';

interface AdminSystemSectionProps {
  sessionToken: string;
}

interface AuditLogEntry {
  id: string;
  admin_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata_safe_json: string;
  created_at: string;
}

export const AdminSystemSection: React.FC<AdminSystemSectionProps> = ({ sessionToken }) => {
  const [systemData, setSystemData] = useState<AdminSystemStatus | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemAndAudit = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch system status
      const sysRes = await getAdminSystemOnServer(sessionToken);
      if (sysRes.success && sysRes.system) {
        setSystemData(sysRes.system);
      }

      // 2. Fetch audit logs
      try {
        const auditRes = await fetch(`${API_BASE_URL}/api/admin/audit-logs`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const auditJson = await auditRes.json();
        if (auditJson.success && Array.isArray(auditJson.logs)) {
          setAuditLogs(auditJson.logs);
        }
      } catch {
        // Audit logs optional fallback
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve system status.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchSystemAndAudit();
  }, [fetchSystemAndAudit]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400">
        <RefreshCw className="w-6 h-6 text-[#00c365] animate-spin mb-2" />
        <p className="text-xs">Running system diagnostics...</p>
      </div>
    );
  }

  if (error || !systemData) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-center max-w-xl mx-auto my-8">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-red-400 mb-1">System Diagnostics Failed</h3>
        <p className="text-xs text-slate-400 mb-4">{error || 'Unable to communicate with system diagnostic service'}</p>
        <button
          onClick={() => fetchSystemAndAudit(true)}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  const { components, environment, nodeVersion, uptimeSeconds } = systemData;
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">System & Integrations</h2>
          <p className="text-xs text-slate-400">
            Read-only health diagnostics, telecom supplier status, and operational audit trail.
          </p>
        </div>

        <button
          onClick={() => fetchSystemAndAudit(true)}
          disabled={isRefreshing}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00c365]' : ''}`} />
          <span>{isRefreshing ? 'Testing Connections...' : 'Refresh Status'}</span>
        </button>
      </div>

      {/* Host Environment Summary */}
      <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/90 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#00c365]" />
          <span className="text-slate-400">Environment:</span>
          <span className="font-mono font-bold text-white uppercase">{environment}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Node Runtime:</span>
          <span className="font-mono text-slate-300">{nodeVersion}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Process Uptime:</span>
          <span className="font-mono font-bold text-[#00c365]">{hours}h {minutes}m</span>
        </div>
      </div>

      {/* Component Diagnostics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* API Server */}
        <div className="p-5 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[#00c365]" />
              <h4 className="text-xs font-bold text-white">Express API Server</h4>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Online
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Handles rate limiting, Scrypt auth, Paystack webhooks, and core routes.
          </p>
          <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 font-mono">
            Status: {components.apiServer.status}
          </div>
        </div>

        {/* PostgreSQL Database */}
        <div className="p-5 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-400" />
              <h4 className="text-xs font-bold text-white">Database Store</h4>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              components.database.status === 'connected'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}>
              {components.database.status === 'connected' ? 'PostgreSQL Pool' : 'Dev Memory Store'}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            {components.database.type}
          </p>
          <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500">
            Unified pool for Orders, Users, Sessions, Waitlist, and Audit Logs.
          </div>
        </div>

        {/* Paystack Payment Gateway */}
        <div className="p-5 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white">Paystack Gateway</h4>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              components.paystack.status === 'configured'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}>
              {components.paystack.status === 'configured' ? 'Configured' : 'Missing Key'}
            </span>
          </div>
          <div className="text-xs space-y-1">
            <div className="text-slate-300 font-mono">{components.paystack.mode}</div>
            <div className="text-slate-500 text-[11px]">Currency: {components.paystack.currency}</div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500">
            HMAC SHA-512 webhook signature verification active.
          </div>
        </div>

        {/* Success Biz Hub (Supplier) */}
        <div className="p-5 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-400" />
              <h4 className="text-xs font-bold text-white">Success Biz Hub (API v2)</h4>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              components.successBizHub.status === 'connected'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : components.successBizHub.status === 'error'
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {components.successBizHub.status === 'connected' ? 'Connected' : components.successBizHub.status === 'error' ? 'Error' : 'Unconfigured'}
            </span>
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Wallet Balance:</span>
              <span className="font-mono font-bold text-white">
                {components.successBizHub.walletBalanceGhc !== null
                  ? `GH₵ ${components.successBizHub.walletBalanceGhc.toFixed(2)}`
                  : 'N/A'}
              </span>
            </div>

            {components.successBizHub.isLowBalance && (
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-300 text-[11px] font-medium border border-amber-500/25">
                Balance is below warning threshold (GH₵ {components.successBizHub.lowBalanceThresholdGhc}). Top up advised.
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500">
            Beneficiary check and atomic lock protection active.
          </div>
        </div>

        {/* Gemini AI Assistant */}
        <div className="p-5 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold text-white">Mystery AI Assistant</h4>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              components.geminiAi.status === 'configured'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {components.geminiAi.status === 'configured' ? 'Configured' : 'Missing Key'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Grounded dynamic store catalog and Ghana telecom customer service.
          </p>
          <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 font-mono">
            {components.geminiAi.model}
          </div>
        </div>

        {/* Fulfilment Pipeline */}
        <div className="p-5 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white">Fulfilment Pipeline</h4>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              components.fulfilmentPipeline.status === 'enabled'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}>
              {components.fulfilmentPipeline.status === 'enabled' ? 'Auto-Dispatch Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Safety kill-switch prevents live dispatches when Paystack is in test mode.
          </p>
          <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500">
            Kill-switch configured via SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED.
          </div>
        </div>
      </div>

      {/* Administrative Mutation Audit Trail */}
      <div className="p-5 rounded-2xl bg-[#0f171d] border border-slate-800/90 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#00c365]" />
            <h3 className="text-xs font-bold text-white">Administrative Audit Trail</h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Recent 50 Mutations</span>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            No administrative mutations recorded yet. Actions like status changes and review notes are logged here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800/80 text-[11px]">
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Target Entity</th>
                  <th className="py-2 px-3">Safe Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40">
                    <td className="py-2 px-3 text-slate-400">
                      {new Date(log.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-[#00c365] font-bold">{log.action}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-300">
                      <span className="text-slate-500">{log.entity_type}:</span> {log.entity_id}
                    </td>
                    <td className="py-2 px-3 text-slate-400 max-w-xs truncate text-[10px]">
                      {log.metadata_safe_json}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
