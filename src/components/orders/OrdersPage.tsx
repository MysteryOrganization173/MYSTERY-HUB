import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getAccountOrdersOnServer } from '../../services/apiClient';
import { OrderRecord } from '../../types';
import { PendingPaymentBanner } from '../checkout/PendingPaymentBanner';
import { CustomerOrderCard } from './CustomerOrderCard';
import { TrackOrderPanel } from './TrackOrderPanel';
import {
  CustomerOrderFilter,
  ORDER_FILTERS,
  accountOrderRecord,
  classifyTrackInput,
  customerOrderStatus,
  mergeCustomerOrders,
  orderMatchesFilter,
  orderMatchesQuery,
} from '../../utils/customerOrderPresentation';
import { RefreshCw, Search, X } from 'lucide-react';

/** The account orders API returns at most this many recent orders and has no paging yet. */
const ACCOUNT_ORDER_LIMIT = 50;
const VIEW_KEY = 'mh_orders_view';

function readView(key: string): { query: string; filter: CustomerOrderFilter } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (saved && typeof saved.query === 'string' && ORDER_FILTERS.some(f => f.id === saved.filter)) return { query: saved.query.slice(0, 80), filter: saved.filter };
  } catch { /* Storage can be unavailable; the view simply starts fresh. */ }
  return { query: '', filter: 'all' };
}

export const OrdersPage: React.FC = () => {
  const { user, sessionToken } = useApp();
  // Remount before rendering another account: old rows and late requests cannot cross sessions.
  return <OrdersHistory key={`${user?.id || 'guest'}:${sessionToken || ''}`} />;
};

const OrdersHistory: React.FC = () => {
  const { orders: localOrders, openOrderStatus, activeOrder, setActivePage, openAuth, user, sessionToken } = useApp();
  const viewKey = `${VIEW_KEY}:${user?.id || 'guest'}`;
  const [searchQuery, setSearchQuery] = useState(() => readView(viewKey).query);
  const [filter, setFilter] = useState<CustomerOrderFilter>(() => readView(viewKey).filter);
  const [serverOrders, setServerOrders] = useState<OrderRecord[]>([]);
  const [accountLoading, setAccountLoading] = useState(false), [accountLoaded, setAccountLoaded] = useState(false), [accountError, setAccountError] = useState(''), [refresh, setRefresh] = useState(0);
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackPrefill, setTrackPrefill] = useState<string | undefined>();
  const [now] = useState(() => new Date());

  // Fetch account-linked orders when authenticated
  useEffect(() => {
    if (!user || !sessionToken) {
      setServerOrders([]);
      setAccountLoading(false);
      setAccountLoaded(false);
      setAccountError('');
      return;
    }

    let isMounted = true;
    setAccountLoading(true); setAccountError('');
    getAccountOrdersOnServer(sessionToken, ACCOUNT_ORDER_LIMIT)
      .then((res) => {
        if (isMounted && res.success && Array.isArray(res.orders)) {
          setServerOrders(res.orders.map(accountOrderRecord));
          setAccountLoaded(true);
        }
      })
      .catch(() => { if (isMounted) setAccountError('We couldn’t load your account orders.'); })
      .finally(() => { if (isMounted) setAccountLoading(false); });

    return () => {
      isMounted = false;
    };
    // Keyed on the account id so a refreshed profile object does not refetch the list.
  }, [user?.id, sessionToken, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // The receipt already checks the server while open; carry what it learned back to this list
  // so a card never contradicts the receipt the customer just saw. No extra requests are made.
  useEffect(() => {
    const ref = activeOrder?.publicReference;
    if (!ref) return;
    setServerOrders((prev) => {
      const index = prev.findIndex((o) => o.publicReference === ref);
      const current = prev[index];
      if (index < 0 || (current.status === activeOrder.status && current.serverStatus === activeOrder.serverStatus && current.manualReview === activeOrder.manualReview)) return prev;
      const next = [...prev];
      next[index] = { ...current, status: activeOrder.status, serverStatus: activeOrder.serverStatus, manualReview: activeOrder.manualReview, statusMessage: activeOrder.statusMessage };
      return next;
    });
  }, [activeOrder]);

  useEffect(() => {
    try { sessionStorage.setItem(viewKey, JSON.stringify({ query: searchQuery, filter })); } catch { /* ignore */ }
  }, [searchQuery, filter, viewKey]);

  // Combine server orders with local orders without duplicates
  const allOrders = React.useMemo(() => mergeCustomerOrders(serverOrders, localOrders).map((order) => ({ order, status: customerOrderStatus(order) })), [serverOrders, localOrders]);
  const groupCounts = React.useMemo(() => {
    const counts = new Map<CustomerOrderFilter, number>();
    for (const f of ORDER_FILTERS) counts.set(f.id, allOrders.filter(({ status }) => orderMatchesFilter(status.group, f.id)).length);
    return counts;
  }, [allOrders]);
  const availableFilters = ORDER_FILTERS.filter((f) => f.id === 'all' || (groupCounts.get(f.id) || 0) > 0);
  const showFilters = allOrders.length >= 4 && availableFilters.length > 2;
  const activeFilter = showFilters && availableFilters.some((f) => f.id === filter) ? filter : 'all';

  const visibleOrders = allOrders.filter(({ order, status }) => orderMatchesFilter(status.group, activeFilter) && orderMatchesQuery(order, searchQuery));
  const query = searchQuery.trim();
  const hasOrders = allOrders.length > 0;
  const reachedLimit = serverOrders.length >= ACCOUNT_ORDER_LIMIT;
  const awaitingAccount = accountLoading || (Boolean(user) && !accountLoaded && !accountError);
  const filterLabel = ORDER_FILTERS.find((f) => f.id === activeFilter)!.label;

  const openTracking = (prefill?: string) => {
    setTrackPrefill(prefill);
    setTrackOpen(true);
    requestAnimationFrame(() => document.getElementById('mh-track-order')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  // A guest with nothing saved here most likely came to track an order.
  const trackExpanded = trackOpen || (!user && !hasOrders);

  return (
    <div className="py-6 sm:py-10 text-slate-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-4 sm:space-y-5">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">My Orders</h1>
            <p className="text-sm text-slate-400 mt-1">Find a purchase or check its delivery.</p>
          </div>
          <button
            type="button"
            onClick={() => setActivePage('data')}
            className="shrink-0 min-h-11 px-3.5 rounded-xl border border-[#00c365]/40 text-[#44df95] hover:bg-[#00c365]/10 text-sm font-semibold transition-colors cursor-pointer"
          >
            Buy data
          </button>
        </header>

        <PendingPaymentBanner />

        <div id="mh-track-order" className="scroll-mt-20">
          <TrackOrderPanel open={trackExpanded} onOpenChange={setTrackOpen} prefill={trackPrefill} />
        </div>

        <section aria-labelledby="mh-orders-heading" aria-busy={accountLoading} className="space-y-3">
          <h2 id="mh-orders-heading" className="sr-only">{user ? 'Your account and device orders' : 'Orders saved on this device'}</h2>

          {accountError && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-2.5">
              <p className="text-xs text-amber-100 leading-relaxed">{accountError}{hasOrders ? ' Orders saved on this device are still shown.' : ''}</p>
              <button type="button" onClick={() => setRefresh((x) => x + 1)} disabled={accountLoading} className="shrink-0 min-h-11 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-sm font-semibold cursor-pointer disabled:opacity-70">
                Try again
              </button>
            </div>
          )}

          {hasOrders && (
            <>
              <div className="relative">
                <Search aria-hidden="true" className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  aria-label="Search my orders"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search my orders"
                  enterKeyHint="search"
                  className="mh-field pl-10 pr-11 text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#00c365] [&::-webkit-search-cancel-button]:hidden"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute right-0 top-0 h-full min-w-11 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {showFilters && (
                <div role="group" aria-label="Filter orders by status" className="mh-tabbar -mx-4 px-4 sm:mx-0 sm:px-0 py-0">
                  {availableFilters.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={activeFilter === f.id}
                      onClick={() => setFilter(f.id)}
                      className={`px-3.5 rounded-full border text-sm font-semibold transition-colors cursor-pointer ${activeFilter === f.id ? 'bg-[#00c365] border-[#00c365] text-[#05140c]' : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'}`}
                    >
                      {f.label}{f.id !== 'all' && <span className={activeFilter === f.id ? 'text-[#05140c]/70' : 'text-slate-500'}> {groupCounts.get(f.id)}</span>}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 text-xs text-slate-400 min-h-6">
                <p aria-live="polite">
                  {query || activeFilter !== 'all'
                    ? `${visibleOrders.length} of ${allOrders.length} ${allOrders.length === 1 ? 'order' : 'orders'}`
                    : `${allOrders.length} ${allOrders.length === 1 ? 'order' : 'orders'}`}
                  {accountLoading && <span> · Updating…</span>}
                </p>
                {user && (
                  <button type="button" onClick={() => setRefresh((x) => x + 1)} disabled={accountLoading} className="min-h-11 -my-2.5 px-2 inline-flex items-center gap-1.5 text-slate-400 hover:text-white cursor-pointer disabled:opacity-60">
                    <RefreshCw aria-hidden="true" className={`w-3.5 h-3.5 ${accountLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                )}
              </div>
            </>
          )}

          {visibleOrders.length > 0 ? (
            <ul className="space-y-2.5">
              {visibleOrders.map(({ order, status }) => (
                <li key={order.id}>
                  <CustomerOrderCard order={order} status={status} now={now} onOpen={() => openOrderStatus(order)} />
                </li>
              ))}
            </ul>
          ) : hasOrders ? (
            <div className="text-center py-10 px-4 rounded-2xl border border-slate-800 bg-[#0f151b] space-y-3">
              <p className="text-base font-bold text-white">{query ? 'No orders match your search' : `No ${filterLabel.toLowerCase()} orders`}</p>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                {query ? 'This search only covers the orders listed here.' : 'Try another status.'}
                {query && classifyTrackInput(query).kind === 'reference' ? ' If you have an order reference, you can track it directly.' : ''}
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {query && classifyTrackInput(query).kind === 'reference' && (
                  <button type="button" onClick={() => openTracking(query)} className="mh-button">Track this reference</button>
                )}
                <button type="button" onClick={() => { setSearchQuery(''); setFilter('all'); }} className="mh-button-secondary">Show all orders</button>
              </div>
            </div>
          ) : awaitingAccount ? (
            <ul aria-hidden="true" className="space-y-2.5">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-[92px] rounded-2xl border border-slate-800 bg-[#0f151b] motion-safe:animate-pulse" />
              ))}
            </ul>
          ) : (
            <div className="text-center py-10 px-4 rounded-2xl border border-slate-800 bg-[#0f151b] space-y-3">
              <p className="text-base font-bold text-white">{user ? (accountError ? 'Your orders couldn’t load' : 'No orders yet') : 'No orders on this device yet'}</p>
              <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                {user
                  ? accountError ? 'Try again in a moment, or track an order with its reference.' : 'Data, airtime and other purchases linked to your account will appear here.'
                  : 'Orders you buy on this device appear here. Sign in to see orders linked to your account.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {!user && <button type="button" onClick={() => openAuth('login')} className="mh-button-secondary">Sign in</button>}
                <button type="button" onClick={() => setActivePage('data')} className="mh-button">Buy data</button>
              </div>
            </div>
          )}

          {hasOrders && (reachedLimit || !user) && (
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              {reachedLimit
                ? `Showing your ${ACCOUNT_ORDER_LIMIT} most recent account orders. To check an older order, track it with its reference.`
                : <>These orders are saved on this device. <button type="button" onClick={() => openAuth('login')} className="text-[#44df95] hover:underline font-semibold cursor-pointer">Sign in</button> to see orders linked to your account.</>}
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
