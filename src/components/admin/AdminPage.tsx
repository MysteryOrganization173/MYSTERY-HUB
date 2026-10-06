import {AdminCommercialSection} from './sections/AdminCommercialSection';
import {AdminFinanceSection} from './sections/AdminFinanceSection';
import { AdminWebsiteBuilderSection } from './sections/AdminWebsiteBuilderSection';
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AdminLoginCard } from './AdminLoginCard';
import { AdminOverviewSection } from './sections/AdminOverviewSection';
import { AdminOrdersSection } from './sections/AdminOrdersSection';
import { AdminMarketplaceSection } from './sections/AdminMarketplaceSection';
import { AdminWaitlistSection } from './sections/AdminWaitlistSection';
import { AdminCustomersSection } from './sections/AdminCustomersSection';
import { AdminSystemSection } from './sections/AdminSystemSection';
import { AdminMysteryEarnSection } from './sections/AdminMysteryEarnSection';
import { BrandLogo } from '../common/BrandLogo';
import {
  LayoutDashboard,
  ShoppingBag,
  Store,
  ClipboardList,
  Users,
  Server,
  LogOut,
  ArrowLeft,
  Shield,
  AlertOctagon,
  Radio,
} from 'lucide-react';

export type AdminTab = 'commercial' | 'finance' | 'overview' | 'orders' | 'marketplace' | 'waitlist' | 'customers' | 'system' | 'earn' | 'websites';

export const AdminPage: React.FC = () => {
  const { user, sessionToken, logoutUser, setActivePage } = useApp();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [earnUserId, setEarnUserId] = useState<string | null>(null);
  const [customerUserId, setCustomerUserId] = useState<string | null>(null);

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

  // 3. Authenticated Admin -> Full Operational Dashboard
  return (
    <div className="min-h-screen bg-[#070b0e] text-slate-100 flex flex-col font-sans">
      {/* Top Operational Bar */}
      <header className="sticky top-0 z-40 bg-[#0b1116]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand & Badge */}
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#00c365]/10 border border-[#00c365]/30 text-[11px] font-bold text-[#00c365]">
              <Shield className="w-3 h-3" />
              <span>Admin workspace</span>
            </div>
          </div>

          {/* Quick Ops Info & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono">{user.email || user.name}</span>
            </div>

            <button
              onClick={() => setActivePage('home')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Return to customer store"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#00c365]" />
              <span className="hidden sm:inline">Storefront</span>
            </button>

            <button
              onClick={logoutUser}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-colors cursor-pointer"
              title="Sign out of admin session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Workspace Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Desktop Sidebar Navigation (lg:col-span-3) */}
          <aside className="hidden lg:block lg:col-span-3 space-y-4">
            <div className="p-3 bg-[#0f171d] border border-slate-800/90 rounded-2xl space-y-1">
              <button onClick={() => { setEarnUserId(null); setActiveTab('earn'); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${activeTab === 'earn' ? 'bg-[#00c365] text-black' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}><Users className="w-4 h-4" /><span>Mystery Earn</span></button>
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-[#00c365] text-black shadow-lg shadow-[#00c365]/20 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Overview</span>
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'orders'
                    ? 'bg-[#00c365] text-black shadow-lg shadow-[#00c365]/20 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span>Orders</span>
              </button>

              <button onClick={()=>setActiveTab('commercial')} className="w-full rounded-xl px-3 py-3 text-left text-xs font-semibold text-[#00c365]">Commercial Pricing</button>
              <button onClick={()=>setActiveTab('finance')} className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#00c365]">Financial Control Room</button>
              <button onClick={()=>setActiveTab('websites')} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${activeTab==='websites'?'bg-[#00c365] text-black':'text-slate-400 hover:bg-slate-900'}`}><Store className="w-4 h-4" /><span>Website Builder</span></button>

              <button
                onClick={() => setActiveTab('marketplace')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'marketplace'
                    ? 'bg-[#00c365] text-black shadow-lg shadow-[#00c365]/20 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Store className="w-4 h-4 shrink-0" />
                <span>Marketplace</span>
              </button>

              <button
                onClick={() => setActiveTab('waitlist')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'waitlist'
                    ? 'bg-[#00c365] text-black shadow-lg shadow-[#00c365]/20 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <ClipboardList className="w-4 h-4 shrink-0" />
                <span>Waitlist</span>
              </button>

              <button
                onClick={() => setActiveTab('customers')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'customers'
                    ? 'bg-[#00c365] text-black shadow-lg shadow-[#00c365]/20 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Customers</span>
              </button>

              <button
                onClick={() => setActiveTab('system')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'system'
                    ? 'bg-[#00c365] text-black shadow-lg shadow-[#00c365]/20 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Server className="w-4 h-4 shrink-0" />
                <span>System Health</span>
              </button>
            </div>

            {/* Quick Operational Status Box */}
            <div className="p-4 rounded-2xl bg-[#0f171d] border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                <Radio className="w-3.5 h-3.5 text-[#00c365] animate-pulse" />
                <span>System & integrations</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Check connection and provider status in System. This workspace does not imply that every integration is available.
              </p>
            </div>
          </aside>

          <label className="lg:hidden col-span-1 block space-y-2 text-sm text-slate-300">Admin area<select aria-label="Admin area" className="mh-field" value={activeTab} onChange={e=>{setActiveTab(e.target.value as AdminTab);setEarnUserId(null);setCustomerUserId(null);}}>{Object.entries({overview:'Overview',orders:'Orders & delivery',customers:'Customers & security',finance:'Wallet & withdrawals',earn:'Mystery Earn',commercial:'Pricing & Welcome Offer',marketplace:'Marketplace',websites:'Websites & reseller stores',waitlist:'Launch requests',system:'System & integrations'}).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>

          {/* Active Tab Workspace (lg:col-span-9) */}
          <main className="col-span-1 lg:col-span-9 min-w-0">
            {activeTab==='commercial'&&<AdminCommercialSection token={sessionToken}/>}
            {activeTab==='finance'&&<AdminFinanceSection sessionToken={sessionToken}/>}
            {activeTab === 'earn' && <AdminMysteryEarnSection sessionToken={sessionToken} initialReferrerId={earnUserId} onOpenCustomer={id => { setCustomerUserId(id); setActiveTab('customers'); }} />}
            {activeTab === 'overview' && (
              <AdminOverviewSection
                sessionToken={sessionToken}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}
            {activeTab === 'orders' && (
              <AdminOrdersSection sessionToken={sessionToken} />
            )}
            {activeTab === 'marketplace' && (
              <AdminMarketplaceSection sessionToken={sessionToken} />
            )}
            {activeTab === 'waitlist' && (
              <AdminWaitlistSection sessionToken={sessionToken} />
            )}
            {activeTab === 'customers' && (
              <AdminCustomersSection
                sessionToken={sessionToken}
                currentAdminId={user.id}
                initialUserId={customerUserId}
                onOpenEarn={id => { setEarnUserId(id); setActiveTab('earn'); }}
              />
            )}
            {activeTab === 'websites' && <AdminWebsiteBuilderSection sessionToken={sessionToken} />}
            {activeTab === 'system' && (
              <AdminSystemSection sessionToken={sessionToken} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
