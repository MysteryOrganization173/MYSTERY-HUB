import React, { useEffect, useRef, useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { ArchivedOrderPage, OrderRecordClient } from '../../../services/orderRecordKeeping';
import { RECORD_KEEPING_UNAVAILABLE } from '../../../services/orderRecordKeeping';
import { AdminButton, AdminEmpty, AdminError, AdminLoading, AdminNotice, AdminSheet, adminField, ghs } from '../ui/AdminUi';

const PAGE_SIZE = 20;

/** Archived records, searchable and paged by the server. Opening one shows the normal order drawer. */
export function AdminArchivedOrders({ token, client, onOpen }: { token: string; client: OrderRecordClient; onOpen: (reference: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AdminButton onClick={() => setOpen(true)}><Archive className="h-4 w-4" /><span className="hidden sm:inline">Archived records</span><span className="sm:hidden">Archived</span></AdminButton>
      {open && <ArchivedSheet token={token} client={client} onClose={() => setOpen(false)} onOpen={reference => { setOpen(false); onOpen(reference); }} />}
    </>
  );
}

function ArchivedSheet({ token, client, onClose, onOpen }: { token: string; client: OrderRecordClient; onClose: () => void; onOpen: (reference: string) => void }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ArchivedOrderPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const live = useRef(0);

  useEffect(() => { const timer = setTimeout(() => { if (search.trim() !== query) { setQuery(search.trim()); setPage(1); } }, 300); return () => clearTimeout(timer); }, [search, query]);
  useEffect(() => {
    if (!client.available) return;
    const id = ++live.current;
    setLoading(true); setError(null);
    client.listArchived(token, { q: query || undefined, page, limit: PAGE_SIZE })
      .then(result => { if (id === live.current) setData(result); })
      .catch(err => { if (id === live.current) setError(err instanceof Error ? err.message : 'Archived records could not be loaded.'); })
      .finally(() => { if (id === live.current) setLoading(false); });
    return () => { live.current++; };
  }, [client, token, query, page, attempt]);

  return (
    <AdminSheet wide title="Archived records" subtitle="Orders taken out of the working lists. Nothing about them was changed." onClose={onClose}>
      {!client.available ? <AdminNotice tone="info" title="Waiting for the server">{RECORD_KEEPING_UNAVAILABLE}</AdminNotice> : (
        <div className="space-y-3">
          <label className="relative block">
            <span className="sr-only">Search archived records</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="MH reference, phone or email" className={`${adminField} pl-10`} />
          </label>
          {error ? <AdminError message={error} onRetry={() => setAttempt(n => n + 1)} />
            : !data && loading ? <AdminLoading label="Loading archived records…" />
            : data && data.items.length === 0 ? <AdminEmpty title={query ? 'No archived record matches' : 'No archived records'}>{query ? 'Check the reference or try a phone number.' : 'Orders you archive will appear here.'}</AdminEmpty>
            : data && (
              <>
                <p role="status" className="text-xs text-slate-400">{data.total} archived {data.total === 1 ? 'record' : 'records'}{loading ? ' · updating…' : ''}</p>
                <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-800">
                  {data.items.map(item => (
                    <li key={item.reference}>
                      <button type="button" onClick={() => onOpen(item.reference)} className="flex min-h-14 w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <span className="min-w-0">
                          <span className="block font-mono text-sm text-white">{item.reference}</span>
                          <span className="block truncate text-xs text-slate-400">{item.product}{item.customer ? ` · ${item.customer}` : ''} · {item.status.replace(/_/g, ' ')}</span>
                        </span>
                        <span className="shrink-0 text-xs text-slate-400 sm:text-right">
                          <span className="block text-sm text-slate-200">{ghs(item.amountMinor)}</span>
                          Archived {new Date(item.archivedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {data.totalPages > 1 && (
                  <div className="flex items-center justify-between gap-2">
                    <AdminButton disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" />Previous</AdminButton>
                    <span className="text-xs text-slate-400">Page {data.page} of {data.totalPages}</span>
                    <AdminButton disabled={page >= data.totalPages || loading} onClick={() => setPage(p => p + 1)}>Next<ChevronRight className="h-4 w-4" /></AdminButton>
                  </div>
                )}
              </>
            )}
        </div>
      )}
    </AdminSheet>
  );
}
