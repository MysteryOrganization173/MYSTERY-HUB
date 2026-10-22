import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createAdminRequestScope } from '../../../utils/adminRequestScope';
import {
  AdminSystemStatus,
  getAdminSystemOnServer,
  API_BASE_URL,
} from '../../../services/apiClient';
import { Server, Database, CreditCard, Radio, Sparkles, Zap, IdCard, History } from 'lucide-react';
import { AdminError, AdminLoading, AdminNotice, AdminPageHeader, AdminPanel, Freshness, RefreshButton, StatusPill, type AdminTone } from '../ui/AdminUi';

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

interface HealthRow {
  key: string;
  icon: React.ReactNode;
  name: string;
  tone: AdminTone;
  verdict: string;
  /** What the server actually checked to produce the verdict. */
  checked: string;
  /** What the verdict does not prove. */
  limits?: string;
  detail?: React.ReactNode;
}

const humanAction = (action: string) => action.replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase());

export const AdminSystemSection: React.FC<AdminSystemSectionProps> = ({ sessionToken }) => {
  const [systemData, setSystemData] = useState<AdminSystemStatus | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditError, setAuditError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const scope = useRef(createAdminRequestScope()).current;
  scope.setContext(sessionToken);
  useEffect(() => () => scope.invalidate(), [scope, sessionToken]);

  const fetchSystemAndAudit = useCallback(async (isRefresh = false) => {
    const current = scope.begin('health');
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const sysRes = await getAdminSystemOnServer(sessionToken);
      if (!current()) return;
      if (sysRes.success && sysRes.system) {
        setSystemData(sysRes.system);
        setCheckedAt(Date.now());
      }

      try {
        const auditRes = await fetch(`${API_BASE_URL}/api/admin/audit-logs`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const auditJson = await auditRes.json();
        if (!current()) return;
        if (auditRes.ok && auditJson.success && Array.isArray(auditJson.logs)) {
          setAuditLogs(auditJson.logs);
          setAuditError(false);
        } else setAuditError(true);
      } catch {
        if (current()) setAuditError(true);
      }
    } catch (err: unknown) {
      if (current()) setError(err instanceof Error ? err.message : 'Failed to retrieve system status.');
    } finally {
      if (current()) { setIsLoading(false); setIsRefreshing(false); }
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchSystemAndAudit();
  }, [fetchSystemAndAudit]);

  if (isLoading) return <div className="space-y-5"><AdminPageHeader title="System Health" /><AdminLoading label="Checking services…" /></div>;
  if (!systemData) return <div className="space-y-5"><AdminPageHeader title="System Health" /><AdminError title="System diagnostics failed" message={error || 'Unable to communicate with the system diagnostic service.'} onRetry={() => fetchSystemAndAudit(true)} /></div>;

  const { components, environment, nodeVersion, uptimeSeconds } = systemData;
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const supplier = components.successBizHub;
  const pipeline = components.fulfilmentPipeline;
  const uncertain = pipeline.uncertainSubmissionCount || 0;
  const liveMode = /live/i.test(components.paystack.mode);

  const rows: HealthRow[] = [
    {
      key: 'api', icon: <Server className="h-4 w-4" />, name: 'API server', tone: 'success', verdict: 'Responding',
      checked: 'This page loaded its status from the API just now.',
      detail: <span className="font-mono">{environment} · Node {nodeVersion} · up {hours}h {minutes}m</span>,
    },
    {
      key: 'db', icon: <Database className="h-4 w-4" />, name: 'Database', tone: components.database.status === 'connected' ? 'success' : 'warning',
      verdict: components.database.status === 'connected' ? 'PostgreSQL connected' : 'Temporary memory store',
      checked: `Reported store: ${components.database.type}.`,
      limits: components.database.status === 'connected' ? undefined : 'A memory store loses every order and account when the server restarts. Production must never run like this.',
    },
    {
      key: 'paystack', icon: <CreditCard className="h-4 w-4" />, name: 'Paystack', tone: components.paystack.status !== 'configured' ? 'danger' : liveMode ? 'success' : 'warning',
      verdict: components.paystack.status !== 'configured' ? 'Secret key missing' : liveMode ? 'Live key configured' : 'Test key configured',
      checked: `A ${components.paystack.mode} secret key is present (${components.paystack.currency}).`,
      limits: 'It does not prove Paystack is accepting payments right now. Payment success is confirmed per order by Paystack verification.',
    },
    {
      key: 'supplier', icon: <Radio className="h-4 w-4" />, name: 'Data supplier (Success Biz Hub)',
      tone: supplier.status === 'error' ? 'danger' : supplier.status !== 'connected' ? 'neutral' : supplier.isLowBalance ? 'warning' : 'success',
      verdict: supplier.status === 'error' ? 'Supplier API error' : supplier.status !== 'connected' ? 'Not configured' : supplier.isLowBalance ? 'Connected · wallet low' : 'Connected',
      checked: supplier.status === 'connected' ? 'The supplier balance endpoint answered this check.' : 'The supplier balance endpoint did not answer successfully.',
      limits: 'A successful balance check does not mean every order was delivered. Delivery is confirmed per order from supplier status.',
      detail: <>Wallet {supplier.walletBalanceGhc !== null ? <strong className="text-white">GH₵{supplier.walletBalanceGhc.toFixed(2)}</strong> : 'not available'} · warning below GH₵{supplier.lowBalanceThresholdGhc}</>,
    },
    {
      key: 'dispatch', icon: <Zap className="h-4 w-4" />, name: 'Automatic dispatch', tone: uncertain ? 'danger' : pipeline.status === 'enabled' ? 'success' : 'warning',
      verdict: uncertain ? `${uncertain} uncertain submission${uncertain === 1 ? '' : 's'}` : pipeline.status === 'enabled' ? 'Enabled' : 'Off · paid orders are held',
      checked: 'Server dispatch switch and the count of orders whose supplier acceptance is unknown.',
      limits: pipeline.status === 'enabled' ? undefined : 'While dispatch is off, paid Data and Airtime orders wait in the queue. Dispatch is also held whenever Paystack uses a test key.',
      detail: uncertain ? 'Check Orders → Needs attention before taking any purchase action. Never resubmit an uncertain order.' : undefined,
    },
    {
      key: 'ai', icon: <Sparkles className="h-4 w-4" />, name: 'Mystery AI', tone: components.geminiAi.status === 'configured' ? 'success' : 'neutral',
      verdict: components.geminiAi.status === 'configured' ? 'Key configured' : 'Not configured',
      checked: `Model setting: ${components.geminiAi.model}.`,
      limits: 'A configured key does not prove the AI provider is reachable. Product import shows its own error if a request fails.',
    },
  ];
  if (components.afa) rows.push({
    key: 'afa', icon: <IdCard className="h-4 w-4" />, name: 'AFA registration', tone: components.afa.available ? 'success' : 'warning',
    verdict: components.afa.status.replaceAll('_', ' ').replace(/^./, l => l.toUpperCase()), checked: components.afa.message,
  });
  const problems = rows.filter(row => row.tone === 'danger' || row.tone === 'warning');

  return (
    <div className="space-y-5">
      {error && <AdminError title="Health refresh failed · showing last checked state" message={error} onRetry={() => fetchSystemAndAudit(true)} />}
      <AdminPageHeader title="System Health" description="What the server checked just now, what each check proves, and the admin audit trail." actions={<><Freshness at={checkedAt} prefix="Checked" /><RefreshButton busy={isRefreshing} onClick={() => fetchSystemAndAudit(true)} label="Check again" /></>} />

      {problems.length
        ? <AdminNotice tone={problems.some(row => row.tone === 'danger') ? 'danger' : 'warning'} title={`${problems.length} item${problems.length === 1 ? '' : 's'} to look at`}>{problems.map(row => `${row.name}: ${row.verdict}`).join(' · ')}</AdminNotice>
        : <AdminNotice tone="success" title="Every check passed">These are configuration and connectivity checks. They do not replace checking individual orders.</AdminNotice>}

      <AdminPanel title="Services">
        <ul className="divide-y divide-slate-800">
          {rows.map(row => (
            <li key={row.key} className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[14rem_1fr] sm:gap-6">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-slate-300">{row.icon}</span>
                <div className="min-w-0"><p className="text-sm font-semibold text-white">{row.name}</p><StatusPill tone={row.tone}>{row.verdict}</StatusPill></div>
              </div>
              <div className="min-w-0 space-y-1 text-sm text-slate-300">
                {row.detail && <p className="break-words">{row.detail}</p>}
                <p className="text-xs text-slate-400"><span className="text-slate-500">Checked:</span> {row.checked}</p>
                {row.limits && <p className="text-xs text-slate-500">{row.limits}</p>}
              </div>
            </li>
          ))}
        </ul>
      </AdminPanel>

      <AdminPanel title={<span className="inline-flex items-center gap-2"><History className="h-4 w-4 text-[#00c365]" />Administrative Audit Trail</span>} description="The 50 most recent admin actions. Operational evidence is private staff information. Do not paste passwords, keys or tokens into notes.">
        {auditError && <p className="mb-3 text-xs text-amber-300">The audit trail could not be loaded. Check again to retry.</p>}
        {!auditError && auditLogs.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">No administrative actions recorded yet. Status changes, review notes and finance actions are logged here.</p>
        ) : (
          <ol className="space-y-2">
            {auditLogs.map(log => (
              <li key={log.id} className="min-w-0 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-[#7dffbf]">{humanAction(log.action)}</span>
                  <time className="text-slate-500" dateTime={log.created_at}>{new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
                </div>
                <p className="mt-1 break-all text-slate-300"><span className="text-slate-500">{log.entity_type}:</span> {log.entity_id}</p>
                {log.metadata_safe_json && log.metadata_safe_json !== '{}' && <details className="mt-1"><summary className="cursor-pointer text-slate-500">Details</summary><pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] text-slate-400">{log.metadata_safe_json}</pre></details>}
              </li>
            ))}
          </ol>
        )}
      </AdminPanel>
    </div>
  );
};
