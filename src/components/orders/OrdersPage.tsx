import './orders.css';
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getAccountOrdersOnServer } from '../../services/apiClient';
import { OrderRecord } from '../../types';
import { PendingPaymentBanner } from '../checkout/PendingPaymentBanner';
import { CustomerOrderCard } from './CustomerOrderCard';
import { TrackOrderPanel } from './TrackOrderPanel';
import { ReceiptArt } from './OrdersArt';
import {
  CustomerOrderFilter,
  CustomerOrderGroup,
  CustomerOrderStatus,
  ORDER_FILTERS,
  accountOrderRecord,
  classifyTrackInput,
  customerOrderStatus,
  mergeCustomerOrders,
  orderMatchesFilter,
  orderMatchesQuery,
  visibleDeviceOrders,
} from '../../utils/customerOrderPresentation';
import { AlertTriangle, RefreshCw, Search, Smartphone, X, Wifi } from 'lucide-react';
import { SeasonalOrders } from '../../seasonal/Seasonal';
import { useSeason } from '../../seasonal/SeasonProvider';
import { ordersSeasonAttributes } from '../../seasonal/ordersSeason';

/** The account orders API returns at most this many recent orders and has no paging yet. */
const ACCOUNT_ORDER_LIMIT = 50;
const VIEW_KEY = 'mh_orders_view';

/** With no search or filter, the list reads in the order a customer cares about: problems, then what is moving. */
const SECTIONS: { id: string; title: string; groups: CustomerOrderGroup[] }[] = [
  { id: 'attention', title: 'Needs attention', groups: ['attention'] },
  { id: 'active', title: 'In progress', groups: ['awaiting_payment', 'in_progress'] },
  { id: 'refund', title: 'Refund under review', groups: ['refund_pending'] },
  { id: 'earlier', title: 'Earlier orders', groups: ['delivered', 'refunded', 'resolved', 'cancelled'] },
];

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

type Row = { order: OrderRecord; status: CustomerOrderStatus };

const OrdersHistory: React.FC = () => {
  const { orders: localOrders, openOrderStatus, activeOrder, setActivePage, openAuth, user, sessionToken } = useApp();
  const season = useSeason();
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

  // The receipt already checks the server while open; carry what it learned back to this list so a card never
  // contradicts the receipt the customer just saw. Status fields only: a public lookup arrives masked, so the owner's
  // recipient, amounts and other details here are never overwritten. No extra requests are made.
  useEffect(() => {
    const ref = activeOrder?.publicReference;
    if (!ref) return;
    setServerOrders((prev) => {
      const index = prev.findIndex((o) => o.publicReference === ref);
      const current = prev[index];
      if (index < 0) return prev;
      const same = current.status === activeOrder.status && current.serverStatus === activeOrder.serverStatus && current.manualReview === activeOrder.manualReview
        && current.customerResolution === activeOrder.customerResolution && current.paymentBasis === activeOrder.paymentBasis
        && (current.marketplaceStatus ?? null) === (activeOrder.marketplaceStatus ?? null);
      if (same) return prev;
      const next = [...prev];
      next[index] = {
        ...current,
        status: activeOrder.status,
        serverStatus: activeOrder.serverStatus,
        manualReview: activeOrder.manualReview,
        statusMessage: activeOrder.statusMessage,
        customerResolution: activeOrder.customerResolution,
        paymentBasis: activeOrder.paymentBasis,
        marketplaceStatus: activeOrder.marketplaceStatus,
      };
      return next;
    });
  }, [activeOrder]);

  useEffect(() => {
    try { sessionStorage.setItem(viewKey, JSON.stringify({ query: searchQuery, filter })); } catch { /* ignore */ }
  }, [searchQuery, filter, viewKey]);

  // Combine server orders with the device orders this viewer may see, without duplicates.
  const deviceOrders = React.useMemo(() => visibleDeviceOrders(localOrders, user?.id), [localOrders, user?.id]);
  const allOrders: Row[] = React.useMemo(() => mergeCustomerOrders(serverOrders, deviceOrders).map((order) => ({ order, status: customerOrderStatus(order) })), [serverOrders, deviceOrders]);
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
  const narrowed = Boolean(query) || activeFilter !== 'all';

  // Sections only when the whole list is shown and more than one kind of order is in it.
  const sections = narrowed ? [] : SECTIONS.map((s) => ({ ...s, rows: visibleOrders.filter(({ status }) => s.groups.includes(status.group)) })).filter((s) => s.rows.length > 0);
  const sectioned = sections.length > 1;
  const inProgress = groupCounts.get('active') || 0, attention = groupCounts.get('attention') || 0;

  const openTracking = (prefill?: string) => {
    setTrackPrefill(prefill);
    setTrackOpen(true);
    requestAnimationFrame(() => document.getElementById('mh-track-order')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  // A guest with nothing saved here most likely came to track an order: tracking is the page's main action.
  const trackPrimary = !user && !hasOrders;
  const open = (order: OrderRecord) => { if (order.serviceType === 'results_checker') window.location.assign(`/results-checkers?order=${encodeURIComponent(order.publicReference || order.id)}`); else openOrderStatus(order); };
  const list = (rows: Row[]) => (
    <ul className="mh-or-list">
      {rows.map(({ order, status }, i) => (
        <li key={order.id} style={{ '--i': i } as React.CSSProperties}>
          <CustomerOrderCard order={order} status={status} now={now} onOpen={() => open(order)} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mh-or py-5 sm:py-9 text-slate-100" {...ordersSeasonAttributes(season)}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-4 sm:space-y-5">
        {/* Recovery first: a payment that may have gone through is never pushed below artwork or history. */}
        <PendingPaymentBanner />

        <header className="mh-or-hero mh-or-in">
          <div className="mh-or-hero-copy">
            <SeasonalOrders part="line" />
            <h1 className="mh-or-title">My Orders</h1>
            <p className="mh-or-lede">
              {user ? 'Purchases from your account and this device, with their latest status.'
                : hasOrders ? 'Purchases made on this device, and any order you track with its reference.'
                : 'Check payment and delivery for any order with its reference.'}
            </p>
          </div>
          <div className="mh-or-hero-side">
            <SeasonalOrders part="art" fallback={<span className="mh-or-art" aria-hidden="true"><ReceiptArt /></span>} />
            <button type="button" onClick={() => setActivePage('data')} className="mh-or-buy">
              <Wifi aria-hidden="true" className="w-4 h-4" />Buy data
            </button>
          </div>
        </header>

        <div id="mh-track-order" className="scroll-mt-20 mh-or-in" style={{ '--i': 1 } as React.CSSProperties}>
          <TrackOrderPanel primary={trackPrimary} open={trackOpen} onOpenChange={setTrackOpen} prefill={trackPrefill} />
        </div>

        <section aria-labelledby="mh-orders-heading" aria-busy={accountLoading} className="space-y-3 mh-or-in" style={{ '--i': 2 } as React.CSSProperties}>
          <h2 id="mh-orders-heading" className="sr-only">{user ? 'Your account and device orders' : 'Orders saved on this device'}</h2>

          {accountError && hasOrders && (
            <div role="alert" className="mh-or-alert" data-kind="warn">
              <AlertTriangle aria-hidden="true" />
              <p>{accountLoaded ? 'We couldn’t refresh your account orders. The list shows what loaded earlier.' : accountError}{!accountLoaded && hasOrders ? ' Orders saved on this device are still shown.' : ''}</p>
              <button type="button" onClick={() => setRefresh((x) => x + 1)} disabled={accountLoading}>
                Try again
              </button>
            </div>
          )}

          {!user && hasOrders && (
            <div className="mh-or-device">
              <Smartphone aria-hidden="true" />
              <p>These orders are saved on this device. <button type="button" onClick={() => openAuth('login')}>Sign in</button> to see orders linked to your account.</p>
            </div>
          )}

          {hasOrders && (
            <>
              <div className="mh-or-search">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search my orders"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by product, number or reference"
                  enterKeyHint="search"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className="mh-or-search-clear">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {showFilters && (
                <div role="group" aria-label="Filter orders by status" className="mh-or-filters">
                  {availableFilters.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={activeFilter === f.id}
                      onClick={() => setFilter(f.id)}
                      className="mh-or-filter"
                      {...(f.groups.length ? { 'data-group': f.groups[0] } : {})}
                    >
                      {f.label}{f.id !== 'all' && <b>{groupCounts.get(f.id)}</b>}
                    </button>
                  ))}
                </div>
              )}

              <div className="mh-or-summary">
                <p aria-live="polite">
                  {narrowed
                    ? <><strong>{visibleOrders.length}</strong> of {allOrders.length} {allOrders.length === 1 ? 'order' : 'orders'}</>
                    : <><strong>{allOrders.length}</strong> {allOrders.length === 1 ? 'order' : 'orders'}{inProgress > 0 && <> · {inProgress} in progress</>}{attention > 0 && <> · {attention} {attention === 1 ? 'needs' : 'need'} attention</>}</>}
                  {accountLoading && <span> · Updating…</span>}
                </p>
                {user && (
                  <button type="button" onClick={() => setRefresh((x) => x + 1)} disabled={accountLoading} aria-busy={accountLoading} className="mh-or-refresh">
                    <RefreshCw aria-hidden="true" />
                    Refresh
                  </button>
                )}
              </div>
            </>
          )}

          {visibleOrders.length > 0 ? (
            sectioned ? (
              <div className="space-y-4">
                {sections.map((s) => (
                  <section key={s.id} className="mh-or-section" aria-labelledby={`mh-or-${s.id}`}>
                    <div className="mh-or-section-head"><h3 id={`mh-or-${s.id}`}>{s.title}</h3><span>{s.rows.length}</span></div>
                    {list(s.rows)}
                  </section>
                ))}
              </div>
            ) : list(visibleOrders)
          ) : hasOrders ? (
            <div className="mh-or-empty">
              <h3>{query ? 'No orders match your search' : `No ${filterLabel.toLowerCase()} orders`}</h3>
              <p>
                {query ? 'This search only covers the orders listed here.' : 'Try another status.'}
                {query && classifyTrackInput(query).kind === 'reference' ? ' If you have an order reference, you can track it directly.' : ''}
              </p>
              <div className="mh-or-empty-actions">
                {query && classifyTrackInput(query).kind === 'reference' && (
                  <button type="button" onClick={() => openTracking(query)} className="mh-button">Track this reference</button>
                )}
                <button type="button" onClick={() => { setSearchQuery(''); setFilter('all'); }} className="mh-button-secondary">Show all orders</button>
              </div>
            </div>
          ) : awaitingAccount ? (
            <ul aria-hidden="true" className="mh-or-list">
              {[0, 1, 2].map((i) => <li key={i} className="mh-or-skeleton" />)}
            </ul>
          ) : user ? (
            <div className="mh-or-empty">
              <ReceiptArt className="mh-or-empty-art" />
              <h3 role={accountError ? 'alert' : undefined}>{accountError ? 'Your orders couldn’t load' : 'No orders yet'}</h3>
              <p>
                {accountError ? 'This doesn’t mean you have no orders. Try again in a moment, or track an order with its reference.' : 'Data, airtime and other purchases linked to your account will appear here.'}
              </p>
              <div className="mh-or-empty-actions">
                {accountError
                  ? <button type="button" onClick={() => setRefresh((x) => x + 1)} disabled={accountLoading} className="mh-button">Try again</button>
                  : <button type="button" onClick={() => setActivePage('data')} className="mh-button">Buy data</button>}
              </div>
            </div>
          ) : (
            <div className="mh-or-device">
              <Smartphone aria-hidden="true" />
              <p>Orders you buy on this device will appear here. <button type="button" onClick={() => openAuth('login')}>Sign in</button> to see orders linked to your account.</p>
            </div>
          )}

          {hasOrders && reachedLimit && (
            <p className="mh-or-foot">
              Showing your {ACCOUNT_ORDER_LIMIT} most recent account orders. To check an older order, track it with its reference.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
