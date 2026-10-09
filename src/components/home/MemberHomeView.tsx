import React from 'react';
import {Wifi,Smartphone,Globe,Gift,Clock,ArrowUpRight,ShoppingBag,ShieldCheck,Grid2X2} from 'lucide-react';
import type {AuthenticatedCustomerOrderDetails} from '../../../server/types/orders';
import {memberOrderSelection,memberOrderLabel} from '../../utils/memberHomePresentation';
import {formatGhs} from '../../../shared/money';

export interface MemberHomeViewProps {
  name:string; greeting:string; orders:AuthenticatedCustomerOrderDetails[]; loading:boolean; error:boolean;
  assistant:()=>void; wallet:React.ReactNode; retry:()=>void; track:(order:AuthenticatedCustomerOrderDetails)=>void;
  actions:{data:()=>void;airtime:()=>void;website:()=>void;earn:()=>void;orders:()=>void;marketplace:()=>void;afa:()=>void;services:()=>void};
}
export function MemberHomeView({name,greeting,orders,loading,error,wallet,retry,track,actions,assistant}:MemberHomeViewProps) {
  const {latest,recent,prioritizesActive}=memberOrderSelection(orders);
  const shortcuts=[['Buy Data',Wifi,actions.data],['Airtime',Smartphone,actions.airtime],['Website Builder',Globe,actions.website],['Mystery Earn',Gift,actions.earn],['My Orders',Clock,actions.orders],['Marketplace',ShoppingBag,actions.marketplace]] as const;
  const orderTitle=(o:AuthenticatedCustomerOrderDetails)=>o.product_name_snapshot||o.bundle_size_snapshot||'Your order';
  const badge=(o:AuthenticatedCustomerOrderDetails)=><span className={`text-xs font-semibold ${o.manual_review||['failed','refund_pending'].includes(o.status)?'text-amber-300':o.status==='delivered'?'text-emerald-300':'text-sky-300'}`}>{memberOrderLabel(o)}</span>;
  return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 pb-24 md:pb-10 space-y-7">
    <section aria-label="Your account overview" className="rounded-3xl border border-slate-700/80 bg-[#101a20] overflow-hidden">
      <div className="px-5 pt-5 sm:px-7 sm:pt-7 flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs text-emerald-300 font-semibold uppercase tracking-widest">Your Mystery Hub</p><h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight break-words">{greeting}, {name}</h1><p className="mt-1 text-sm text-slate-300">What would you like to do today?</p></div></div>
      <div className="grid md:grid-cols-2 px-5 py-5 sm:px-7 sm:py-6 gap-5 md:gap-8">
        {wallet}
        <section aria-label="Latest order" className="border-t md:border-t-0 md:border-l border-slate-700/80 pt-4 md:pt-0 md:pl-8 min-w-0"><h2 className="text-sm text-slate-300">{prioritizesActive?'Order to follow':'Latest order'}</h2>
          {loading?<p role="status" className="mt-3 text-sm text-slate-400">Loading your orders…</p>:error?<div className="mt-3 space-y-2"><p role="alert" className="text-sm text-amber-300">Your orders are unavailable right now.</p><button className="mh-button-secondary" onClick={retry}>Try again</button></div>:latest?<div className="mt-2 space-y-1"><div className="flex flex-wrap justify-between items-center gap-2"><h3 className="text-base font-semibold break-words">{orderTitle(latest)}</h3>{badge(latest)}</div><p className="text-xs text-slate-300 break-all">{latest.recipient_phone} · {latest.public_reference}</p><div className="flex items-center justify-between gap-3 pt-2"><p className="font-semibold tabular-nums">{formatGhs(latest.amount)}</p><button className="mh-button-secondary" onClick={()=>track(latest)}>Track Order</button></div></div>:<div className="mt-2"><p className="font-medium">Your first order starts here.</p><p className="mt-1 text-sm text-slate-300">Choose a service below. Track its progress here.</p><button className="min-h-11 text-sm font-semibold text-emerald-300" onClick={actions.data}>Buy Data →</button></div>}
        </section>
      </div>
    </section>
    <section aria-labelledby="member-services"><h2 id="member-services" className="font-semibold text-lg mb-3">Quick Services</h2><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">{shortcuts.map(([title,Icon,action])=><button key={title} onClick={action} className="min-h-24 rounded-2xl border border-slate-800 bg-[#11181f] hover:border-emerald-400/60 p-3 text-left flex flex-col justify-between gap-3 transition-colors"><Icon className="size-5 text-emerald-300" aria-hidden="true"/><span className="text-sm font-semibold">{title}</span></button>)}</div></section>
    <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
      <section aria-labelledby="member-recent"><div className="flex items-center justify-between gap-3 mb-2"><h2 id="member-recent" className="text-lg font-semibold">Recent activity</h2><button onClick={actions.orders} className="min-h-11 text-sm text-emerald-300">View all orders</button></div>
        {loading?<p role="status" className="text-sm text-slate-400 py-5">Loading recent activity…</p>:error?<p className="text-sm text-slate-300 py-5">Try again above, or <button className="text-emerald-300 underline min-h-11" onClick={actions.orders}>open My Orders</button>.</p>:recent.length?<ul className="divide-y divide-slate-800">{recent.map(o=><li key={o.public_reference}><button onClick={()=>track(o)} className="w-full min-h-20 py-3 text-left flex gap-3 items-center justify-between"><div className="min-w-0"><p className="font-semibold text-sm break-words">{orderTitle(o)}</p><p className="text-xs text-slate-400 mt-1 break-all">{o.public_reference}</p></div><div className="text-right shrink-0 max-w-[55%]"><p className="text-sm tabular-nums">{formatGhs(o.amount)}</p>{badge(o)}</div><ArrowUpRight className="size-4 shrink-0 text-slate-400" aria-hidden="true"/></button></li>)}</ul>:<div className="rounded-2xl border border-dashed border-slate-700 p-5 text-sm"><Clock className="size-5 text-slate-400 mb-3" aria-hidden="true"/><p className="font-medium">{latest?'You’re all caught up.':'A fresh start.'}</p><p className="mt-1 text-slate-300">{latest?'Other recent orders will appear here.':'Your account activity will appear after your first purchase.'}</p></div>}
      </section>
      <section aria-label="Build and earn" className="rounded-2xl bg-[#121c24] border border-slate-800 divide-y divide-slate-700/70">
        <button onClick={actions.website} className="w-full text-left p-5 flex items-start gap-3"><Globe className="size-5 text-sky-300 shrink-0 mt-1" aria-hidden="true"/><div><h2 className="font-semibold">Your business, online</h2><p className="text-sm text-slate-300 mt-1">Create a free website or return to your dashboard.</p><span className="text-sm text-emerald-300 block mt-3">Open Website Builder →</span></div></button>
        <button onClick={actions.earn} className="w-full text-left p-5 flex items-start gap-3"><Gift className="size-5 text-amber-300 shrink-0 mt-1" aria-hidden="true"/><div><h2 className="font-semibold">Your referrals & rewards</h2><p className="text-sm text-slate-300 mt-1">Find your referral link and check eligible rewards.</p><span className="text-sm text-emerald-300 block mt-3">Open Mystery Earn →</span></div></button>
      </section>
    </div>
    <button className="mh-button-secondary" onClick={assistant}>Ask Mystery AI</button>
    <nav aria-label="More services" className="flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-800 pt-3 text-sm text-slate-300"><button className="min-h-11 flex items-center gap-2" onClick={actions.afa}><ShieldCheck className="size-4"/>AFA · Check availability</button><button className="min-h-11 flex items-center gap-2" onClick={actions.services}><Grid2X2 className="size-4"/>More services · Coming soon</button></nav>
  </div>;
}
