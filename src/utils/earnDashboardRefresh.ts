/** One request at a time; failed refreshes preserve each last successful dataset. */
export function createEarnDashboardRefresh<S, L>(options: {
  loadSummary: () => Promise<{ success: boolean; summary: S }>;
  loadLedger: () => Promise<{ success: boolean; ledger: L }>;
  onSummary: (summary: S) => void;
  onLedger: (ledger: L) => void;
  onState: (state: { refreshing: boolean; error: string | null }) => void;
  window: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  document: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;
}) {
  let disposed = false;
  let pending: Promise<void> | null = null;
  const refresh = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    if (pending) return pending;
    options.onState({ refreshing: true, error: null });
    pending = Promise.allSettled([options.loadSummary(), options.loadLedger()]).then(([summary, ledger]) => {
      if (disposed) return;
      const summaryOk = summary.status === 'fulfilled' && summary.value.success;
      const ledgerOk = ledger.status === 'fulfilled' && ledger.value.success;
      if (summaryOk && summary.status === 'fulfilled') options.onSummary(summary.value.summary);
      if (ledgerOk && ledger.status === 'fulfilled') options.onLedger(ledger.value.ledger);
      options.onState({ refreshing: false, error: summaryOk && ledgerOk ? null : 'Unable to refresh all metrics. Showing last available values; please retry.' });
    }).finally(() => { pending = null; });
    return pending;
  };
  const focus = () => { if (!options.document.hidden) void refresh(); };
  options.window.addEventListener('focus', focus);
  options.document.addEventListener('visibilitychange', focus);
  return {
    refresh,
    dispose: () => {
      disposed = true;
      options.window.removeEventListener('focus', focus);
      options.document.removeEventListener('visibilitychange', focus);
    },
  };
}
