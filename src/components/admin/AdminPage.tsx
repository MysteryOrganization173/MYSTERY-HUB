import {decodeAdminHash} from '../../utils/adminNavigation';
import {AdminCommercialSection} from './sections/AdminCommercialSection';
import {AdminFinanceSection} from './sections/AdminFinanceSection';
import { AdminWebsiteBuilderSection } from './sections/AdminWebsiteBuilderSection';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import type { AdminOrderView } from '../../utils/adminOrderView';
import { useApp } from '../../context/AppContext';
import { AdminLoginCard } from './AdminLoginCard';
import { AdminOverviewSection } from './sections/AdminOverviewSection';
import { AdminOrdersSection } from './sections/AdminOrdersSection';
import { AdminMarketplaceSection } from './sections/AdminMarketplaceSection';
import { AdminWaitlistSection } from './sections/AdminWaitlistSection';
import { AdminCustomersSection } from './sections/AdminCustomersSection';
import { AdminSystemSection } from './sections/AdminSystemSection';
import { AdminMysteryEarnSection } from './sections/AdminMysteryEarnSection';
import { AdminNotificationsSection } from './sections/AdminNotificationsSection';
import { BrandLogo } from '../common/BrandLogo';
import { useAdminSignals } from './adminSignals';
import {
  LayoutDashboard,
  ShoppingBag,
  Store,
  ClipboardList,
  Users,
  Server,
  LogOut,
  ArrowLeft,
  AlertOctagon,
  Wallet,
  Gift,
  Tags,
  Globe,
  Menu,
  X,
  Shield,
  Bell,
} from 'lucide-react';

export type AdminTab = 'commercial' | 'finance' | 'overview' | 'orders' | 'marketplace' | 'waitlist' | 'customers' | 'system' | 'earn' | 'websites' | 'notifications';

/**
 * Every admin area, grouped by the job the founder is doing. One definition drives the
 * desktop sidebar, the phone menu and the phone quick bar so no area can drift out of
 * the navigation or get a different visual treatment again.
 */
const ADMIN_AREAS: Record<AdminTab, { label: string; short: string; group: string; icon: React.ComponentType<{ className?: string }> }> = {
  overview: { label: 'Overview', short: 'Overview', group: 'Operate', icon: LayoutDashboard },
  orders: { label: 'Orders & delivery', short: 'Orders', group: 'Operate', icon: ShoppingBag },
  customers: { label: 'Customers & security', short: 'Customers', group: 'Operate', icon: Users },
  marketplace: { label: 'Marketplace', short: 'Marketplace', group: 'Sell', icon: Store },
  websites: { label: 'Website Builder & Ultra', short: 'Websites', group: 'Sell', icon: Globe },
  commercial: { label: 'Commercial Pricing', short: 'Pricing', group: 'Sell', icon: Tags },
  finance: { label: 'Finance', short: 'Finance', group: 'Money', icon: Wallet },
  earn: { label: 'Mystery Earn', short: 'Earn', group: 'Money', icon: Gift },
  notifications: { label: 'Notifications', short: 'Alerts', group: 'Platform', icon: Bell },
  waitlist: { label: 'Launch requests', short: 'Waitlist', group: 'Platform', icon: ClipboardList },
  system: { label: 'System Health', short: 'System', group: 'Platform', icon: Server },
};
const GROUPS = ['Operate', 'Sell', 'Money', 'Platform'];
const QUICK: AdminTab[] = ['overview', 'orders', 'customers', 'finance'];

/** Admin location lives in the URL hash (#orders/needs_attention) so Android back works and alerts can deep link. */
function readHash(): { tab: AdminTab; param: string } {
  if (typeof window === 'undefined') return { tab: 'overview', param: '' };
  const [rawTab = '', ...rest] = decodeAdminHash(window.location.hash);
  const tab = (Object.keys(ADMIN_AREAS) as AdminTab[]).includes(rawTab as AdminTab) ? rawTab as AdminTab : 'overview';
  return { tab, param: rest.join('/') };
}

export const AdminPage: React.FC = () => {
  const { user, sessionToken, logoutUser, setActivePage } = useApp();
  const [location, setLocation] = useState(readHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signalRefresh, setSignalRefresh] = useState(0);
  const activeTab = location.tab;

  useEffect(() => {
    const sync = () => { setLocation(readHash()); setMenuOpen(false); };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const navigate = useCallback((tab: AdminTab, param = '') => {
    const hash = `#${tab}${param ? `/${encodeURIComponent(param).replace(/%2F/g, '/')}` : ''}`;
    if (window.location.hash !== hash) window.location.hash = hash; // pushes history so Android back returns to the previous area
    setLocation({ tab, param });
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, []);

  // 1. Unauthenticated -> Show Admin Login Form
  if (!user || !sessionToken) {
    return <AdminLoginCard />;
  }

  // 2. Authenticated but Not Admin -> Show Access Denied
  if (user.role !== 'admin') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="w-full max-w-md bg-[#0f171d] border border-red-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <AlertOctagon className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Access Denied</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This operational portal is restricted to authorized Mystery Hub staff and administrators. Your current account ({user.email || user.phone || user.name}) does not have staff privileges.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => setActivePage('home')}
              className="w-full py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs transition-colors cursor-pointer"
            >
              Return to Customer Storefront
            </button>
            <button
              onClick={logoutUser}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated Admin -> Full Operational Workspace
  return <AdminWorkspace
    key={sessionToken}
    token={sessionToken}
    adminId={user.id}
    adminLabel={user.email || user.name}
    activeTab={activeTab}
    param={location.param}
    navigate={navigate}
    menuOpen={menuOpen}
    setMenuOpen={setMenuOpen}
    signalRefresh={signalRefresh}
    onSignalsChanged={() => setSignalRefresh(n => n + 1)}
    onStorefront={() => setActivePage('home')}
    onSignOut={logoutUser}
  />;
};

function AdminWorkspace({ token, adminId, adminLabel, activeTab, param, navigate, menuOpen, setMenuOpen, signalRefresh, onSignalsChanged, onStorefront, onSignOut }: {
  token: string; adminId: string; adminLabel: string; activeTab: AdminTab; param: string; navigate: (tab: AdminTab, param?: string) => void;
  menuOpen: boolean; setMenuOpen: (open: boolean) => void; signalRefresh: number; onSignalsChanged: () => void; onStorefront: () => void; onSignOut: () => void;
}) {
  // Memory only: preserve the operator's place without persisting customer searches to storage.
  // The workspace is keyed by session so another staff session cannot inherit these queries.
  const orderViews = useRef(new Map<string, AdminOrderView>());
  const rememberOrders = useCallback((view: AdminOrderView) => {
    if (!orderViews.current.has(param) && orderViews.current.size >= 20) orderViews.current.delete(orderViews.current.keys().next().value!);
    orderViews.current.set(param, view);
  }, [param]);
  const signals = useAdminSignals(token, signalRefresh);
  const badges: Partial<Record<AdminTab, { count: number | null; tone: 'warning' | 'danger' | 'info'; label: string }>> = {
    orders: signals.ordersAttention ? { count: signals.ordersAttention, tone: 'warning', label: `${signals.ordersAttention} orders need attention` } : undefined,
    marketplace: signals.newInquiries ? { count: signals.newInquiries, tone: 'info', label: `${signals.newInquiries} new inquiries` } : undefined,
    finance: signals.pendingWithdrawals ? { count: signals.pendingWithdrawals, tone: 'warning', label: `${signals.pendingWithdrawals} withdrawal requests waiting` } : undefined,
    system: signals.supplierAlert ? { count: null, tone: 'danger', label: 'Supplier needs attention' } : undefined,
  };
  // Areas reached through "More" on phones still surface their alerts on that button.
  const moreBadges = (Object.keys(badges) as AdminTab[]).filter(tab => !QUICK.includes(tab) && badges[tab]).map(tab => badges[tab]!);

  const navItem = (tab: AdminTab, compact = false) => {
    const item = ADMIN_AREAS[tab];
    const Icon = item.icon;
    const active = activeTab === tab;
    const badge = badges[tab];
    return (
      <button key={tab} type="button" onClick={() => navigate(tab)} aria-current={active ? 'page' : undefined}
        className={`group relative flex w-full min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors ${active ? 'bg-[#00c365]/12 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}`}>
        {active && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-[#00c365]" aria-hidden />}
        <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-[#00c365]' : 'text-slate-500 group-hover:text-slate-300'}`} />
        <span className="flex-1 truncate">{compact ? item.short : item.label}</span>
        {badge && (badge.count != null
          ? <span aria-label={badge.label} className={`min-w-6 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums ${badge.tone === 'warning' ? 'bg-amber-400/20 text-amber-200' : badge.tone === 'danger' ? 'bg-rose-400/20 text-rose-200' : 'bg-sky-400/20 text-sky-200'}`}>{badge.count}</span>
          : <span aria-label={badge.label} className="h-2 w-2 rounded-full bg-rose-400" />)}
      </button>
    );
  };

  const navGroups = (
    <nav aria-label="Admin area" className="space-y-5">
      {GROUPS.map(group => (
        <div key={group} className="space-y-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{group}</p>
          {(Object.keys(ADMIN_AREAS) as AdminTab[]).filter(tab => ADMIN_AREAS[tab].group === group).map(tab => navItem(tab))}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="admin-v2 min-h-screen bg-[#070b0e] text-slate-100 flex flex-col font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0a1015]/95 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open admin menu" aria-expanded={menuOpen} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 text-slate-200 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <span className="hidden sm:inline-flex"><BrandLogo size="sm" /></span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white sm:hidden"><Shield className="h-4 w-4 text-[#00c365]" />Hub Admin</span>
            <span className="hidden items-center gap-1.5 rounded-full border border-[#00c365]/30 bg-[#00c365]/10 px-2.5 py-0.5 text-xs font-semibold text-[#00c365] sm:inline-flex">
              <Shield className="h-3 w-3" />Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[16rem] truncate text-xs text-slate-400 md:inline" title={adminLabel}>{adminLabel}</span>
            <button type="button" onClick={onStorefront} title="Return to customer store" aria-label="Return to customer store" className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-800 px-3 text-sm text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4 text-[#00c365]" /><span className="hidden sm:inline">Storefront</span>
            </button>
            <button type="button" onClick={onSignOut} title="Sign out of admin session" aria-label="Sign out" className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-rose-500/30 px-3 text-sm text-rose-300 hover:bg-rose-500/10">
              <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-6 px-4 pb-24 pt-5 sm:px-6 lg:pb-10">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-[76px] space-y-4">
            {navGroups}
            <p className="px-3 text-xs leading-relaxed text-slate-500">Every action is re-checked and audited by the server. Hidden buttons are not a permission boundary.</p>
          </div>
        </aside>

        {/* Phone/tablet menu sheet */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
            <button type="button" aria-label="Close admin menu" className="absolute inset-0 bg-black/70" onClick={() => setMenuOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col overflow-y-auto border-r border-slate-800 bg-[#0a1015] p-4">
              <div className="mb-4 flex items-center justify-between">
                <BrandLogo size="sm" />
                <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close admin menu" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800"><X className="h-5 w-5" /></button>
              </div>
              {navGroups}
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">
          {activeTab==='commercial'&&<AdminCommercialSection token={token}/>}
          {activeTab==='finance'&&<AdminFinanceSection sessionToken={token} initialView={param} onOpenCustomer={id=>navigate('customers',id)} onChanged={onSignalsChanged}/>}
          {activeTab === 'earn' && <AdminMysteryEarnSection sessionToken={token} initialReferrerId={param||null} onOpenCustomer={id => navigate('customers', id)} />}
          {activeTab === 'overview' && (
            <AdminOverviewSection
              sessionToken={token}
              onNavigateTab={(tab,filter) => navigate(tab, filter||'')}
              onRefreshed={onSignalsChanged}
            />
          )}
          {activeTab === 'orders' && (
            <AdminOrdersSection key={param} sessionToken={token} initialStatusFilter={param.startsWith('ref/')?'':param.replace(/\/today$/,'')} initialReference={param.startsWith('ref/')?param.slice(4):undefined} initialCreatedToday={!param.startsWith('ref/')&&param.endsWith('/today')} initialView={orderViews.current.get(param)} onViewChange={rememberOrders} onChanged={onSignalsChanged} />
          )}
          {activeTab === 'marketplace' && (
            <AdminMarketplaceSection sessionToken={token} initialView={param} onChanged={onSignalsChanged} />
          )}
          {activeTab === 'notifications' && <AdminNotificationsSection sessionToken={token} initialView={param} onNavigate={view => navigate('notifications', view)} />}
          {activeTab === 'waitlist' && (
            <AdminWaitlistSection sessionToken={token} />
          )}
          {activeTab === 'customers' && (
            <AdminCustomersSection
              sessionToken={token}
              currentAdminId={adminId}
              initialUserId={param||null}
              onOpenEarn={id => navigate('earn', id)}
            />
          )}
          {activeTab === 'websites' && <AdminWebsiteBuilderSection sessionToken={token} initialView={param} />}
          {activeTab === 'system' && (
            <AdminSystemSection sessionToken={token} />
          )}
        </main>
      </div>

      {/* Phone quick bar: the four areas the founder opens most, plus the full menu */}
      <nav aria-label="Quick admin navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-[#0a1015]/97 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {QUICK.map(tab => {
            const item = ADMIN_AREAS[tab]; const Icon = item.icon; const active = activeTab === tab; const badge = badges[tab];
            return (
              <button key={tab} type="button" onClick={() => navigate(tab)} aria-current={active ? 'page' : undefined} className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? 'text-[#00c365]' : 'text-slate-400'}`}>
                <Icon className="h-5 w-5" />
                {item.short}
                {badge && <span aria-label={badge.label} className={`absolute right-[22%] top-2 ${badge.count != null ? 'min-w-4 rounded-full px-1 text-[10px] leading-4 text-black' : 'h-2 w-2 rounded-full'} ${badge.tone === 'warning' ? 'bg-amber-300' : badge.tone === 'danger' ? 'bg-rose-400' : 'bg-sky-300'}`}>{badge.count ?? ''}</span>}
              </button>
            );
          })}
          <button type="button" onClick={() => setMenuOpen(true)} aria-label={moreBadges.length ? `More areas: ${moreBadges.map(b => b.label).join(', ')}` : 'More areas'} className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${QUICK.includes(activeTab) ? 'text-slate-400' : 'text-[#00c365]'}`}>
            <Menu className="h-5 w-5" />More
            {moreBadges.length > 0 && <span aria-hidden className={`absolute right-[26%] top-2.5 h-2 w-2 rounded-full ${moreBadges.some(b => b.tone === 'danger') ? 'bg-rose-400' : moreBadges.some(b => b.tone === 'warning') ? 'bg-amber-300' : 'bg-sky-300'}`} />}
          </button>
        </div>
      </nav>
    </div>
  );
}
