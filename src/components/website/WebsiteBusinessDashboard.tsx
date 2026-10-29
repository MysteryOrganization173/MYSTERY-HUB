import './websiteBuilder.css';
import {WebsiteBundlePricing} from './WebsiteBundlePricing';
import {customerActivityLabel,activityDigest,isOwnerActivity} from '../../utils/customerActivity';
import {ownerAttention,ownerSuggestions,resellerCatalogueSummary,resellerLaunchSteps,resellerStoreStatus,type OwnerAttentionAction,type ResellerCatalogueSummary} from '../../utils/websiteOwnerAttention';
import {websiteItemVocabulary} from '../../config/websiteStarters';
import {OWNER_ORDER_FILTERS,STORE_EARNING_DEFINITIONS,ownerOrderCounts,ownerOrderView,type OwnerOrder} from '../../utils/websiteOwnerOrders';
import React,{useEffect,useRef,useState} from 'react';
import type { WebsiteSiteRecord } from '../../types';
import { websiteBusinessRequest } from '../../services/websiteBusinessApi';
import { BUSINESS_CONFIG } from '../../config/business';
import { websiteDeletionSupportUrl } from '../../utils/websiteSupport';
import { formatGhs, parseGhs, percentMinor } from '../../../shared/money';

const button='min-h-11 px-4 py-2 rounded-lg border border-slate-700 text-sm disabled:opacity-50';
const field='w-full min-h-11 rounded-lg p-3 bg-slate-900 border border-slate-700';
/** Tabs from before V5.1. "Website" repeated the website card's actions, so links to it open the Overview. */
export const dashboardTabFor=(tab?:string)=>tab==='Website'?'Overview':tab;
/** What the Business Workspace shows around this dashboard: its navigation, badges and the Overview shortcuts. */
export interface BusinessDashboardSummary {tabs:string[];loaded:boolean;error:string;busy:boolean;range:string;ordersNeedingCheck:number;paidOrders:number|null;views:number|null;availableMinor:number|null;sellable:number|null;storeLabel:string}
/**
 * Business Workspace V1: the workspace owns navigation (sidebar, phone menu, addresses); this component owns the
 * business records for the area it is given and reports a small summary back. One /business request serves every area.
 */
export function WebsiteBusinessDashboard({site,token,onEdit,settings,tab:requestedTab,onTabChange,onPricingDirty,onPublish,onShare,onCopyLink,onSummary,refreshRef,overviewHub}:{site:WebsiteSiteRecord;token:string;onEdit:()=>void;/** Site-level management (design, deletion), shown directly in the Settings tab. */settings:(policy:{withdrawalMinimumMinor?:number})=>React.ReactNode;tab:string;onTabChange:(tab:string)=>void;onPricingDirty?:(dirty:boolean)=>void;onPublish?:()=>void;onShare?:()=>void;onCopyLink?:()=>void;onSummary?:(summary:BusinessDashboardSummary)=>void;refreshRef?:React.MutableRefObject<(()=>void)|null>;/** Phone shortcuts into the other areas, placed after what needs attention. */overviewHub?:(summary:BusinessDashboardSummary)=>React.ReactNode}) {
  const reseller=site.template_id==='tmpl-data-reseller';
  const tab=dashboardTabFor(requestedTab)||'Overview';
  const [range,setRange]=useState('30'),[offset,setOffset]=useState(0),[data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  // Each area opens on its first page of records.
  useEffect(()=>{setOffset(0);},[tab]);
  const [searchInput,setSearchInput]=useState(''),[lastFour,setLastFour]=useState('');
  const identity = useRef('');
  identity.current = `${site.id}:${site.template_id}:${site.updated_at}:${token}:${range}:${offset}:${lastFour}`;
  const [withdrawal,setWithdrawal]=useState({amount:'',phone:'',network:'mtn',recipientName:''});
  const [orderFilter,setOrderFilter]=useState('all');
  useEffect(()=>{setSearchInput('');setLastFour('');setOffset(0);setOrderFilter('all');},[site.id,token]);
  const [confirmed,setConfirmed]=useState(false),[requestId,setRequestId]=useState(()=>crypto.randomUUID());
  const refresh=async()=>{const expected=identity.current;const next=await websiteBusinessRequest(`websites/${site.id}/business?range=${range}&offset=${offset}&lastFour=${encodeURIComponent(lastFour)}`,token);if(identity.current===expected)setData(next);};
  useEffect(()=>{let live=true;setData(null);setError('');void refresh().catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[site.id,site.template_id,site.updated_at,token,range,offset,lastFour]);
  // Read-only: what customers can buy right now, from the owner's existing bundle catalogue (server eligibility and checkout switch).
  const [catalogue,setCatalogue]=useState<ResellerCatalogueSummary|null>(null),[catalogueTick,setCatalogueTick]=useState(0);
  useEffect(()=>{if(!reseller){setCatalogue(null);return;}let live=true;void websiteBusinessRequest(`websites/${site.id}/bundles`,token).then((r:any)=>{if(live)setCatalogue(resellerCatalogueSummary(r));}).catch(()=>{if(live)setCatalogue(null);});return()=>{live=false;};},[site.id,reseller,token,site.updated_at,tab==='Overview',catalogueTick]);
  const sellable=catalogue?.sellable??null;
  const action=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');setNotice('');try{await work();await refresh();}catch(e:any){setError(e.message);}finally{setBusy(false);}};
  const tabs=['Overview',...(reseller||data?.capabilities?.hasStoreHistory||data?.capabilities?.hasStoreFundsOrWithdrawals||data?.earnings?.lifetimeMinor?['Orders',...(reseller?['Bundles & Pricing']:[]),'Store Earnings']:[]),'Analytics','Settings'];
  const a=data?.analytics,e=data?.earnings;
  // A Data store reads left to right as a funnel: people who visited, started checkout, paid and received their data.
  const summaryMetrics = reseller ? {Visitors:a?.uniqueVisitors,'Checkout starts':a?.checkoutStarts,'Paid orders':a?.paidOrders,'Delivered orders':a?.deliveredOrders,Sales:formatGhs(a?.salesMinor||0),'Store Earnings available':formatGhs(e?.availableMinor||0)} : {Views:a?.views,Visitors:a?.uniqueVisitors,'Contact / WhatsApp actions':(a?.whatsappClicks||0)+(a?.callClicks||0)+(a?.emailClicks||0)};
  const navigate=(name:string)=>{name=dashboardTabFor(name)!;if(name!==tab)setOffset(0);onTabChange(name);};
  const orders:OwnerOrder[]=data?.orders||[],orderCounts=ownerOrderCounts(orders);
  const attention=data?ownerAttention({ordersNeedingCheck:orders.filter(o=>o.manualReview||['failed','refund_pending'].includes(o.status)).length,reseller,published:site.status==='published',content:site.content_json as any,sellableBundles:sellable,reconciliationRequired:!!e?.reconciliationRequired,views:a?.views??null}):[];
  // One store status answers "can customers buy right now?"; the launch steps show only while the owner has setup left.
  const status=reseller&&data?resellerStoreStatus({published:site.status==='published',catalogue}):null;
  const launch=status&&(status.state==='needs-bundles'||status.state==='needs-publish')?resellerLaunchSteps({sellableBundles:sellable,published:site.status==='published'}):null;
  // The store status already covers bundles, publishing and sharing.
  const attentionShown=status?attention.filter(item=>!['bundles','publish','share'].includes(item.id)):attention;
  const vocabulary=websiteItemVocabulary(site.template_id);
  const suggestions=data?ownerSuggestions({reseller,hasItems:!reseller&&site.template_id!=='tmpl-start-blank',itemWord:vocabulary.many,content:site.content_json as any}):[];
  const checkCount=orders.filter(o=>o.manualReview||['failed','refund_pending'].includes(o.status)).length;
  const summary:BusinessDashboardSummary={tabs,loaded:!!data,error,busy,range,ordersNeedingCheck:checkCount,paidOrders:a?.paidOrders??null,views:a?.views??null,availableMinor:e?Number(e.availableMinor||0):null,sellable,storeLabel:status?.label||''};
  const summaryKey=JSON.stringify(summary);
  useEffect(()=>{onSummary?.(summary);},[summaryKey]);
  if(refreshRef)refreshRef.current=()=>void action(async()=>{});
  const act=(action:OwnerAttentionAction)=>{if(action==='edit')onEdit();else if(action==='pricing')navigate('Bundles & Pricing');else if(action==='earnings')navigate('Store Earnings');else if(action==='orders'){setOrderFilter(orderCounts.check?'check':'failed');navigate('Orders');}else if(action==='publish')(onPublish||onEdit)();else if(action==='support')window.open(BUSINESS_CONFIG.contact.supportWhatsAppUrl,'_blank','noopener,noreferrer');else onShare?.();};
  return <section id="website-business-dashboard" aria-label="Business records" data-area={tab} className="min-w-0 space-y-5 text-left">
    {reseller&&<div hidden={tab!=='Bundles & Pricing'}><WebsiteBundlePricing key={site.id} siteId={site.id} token={token} published={site.status==='published'} onDirty={onPricingDirty} onSaved={()=>setCatalogueTick(n=>n+1)}/></div>}
    {/* Settings needs no business data: design and deletion work even while the overview is loading. */}
    {tab==='Settings'&&settings({withdrawalMinimumMinor:data?.policy?.withdrawalMinimumMinor})}
    {/* A failed load shows no figures at all, never zeros that look like real business results. */}
    {error&&tab!=='Settings'&&<div role="alert" className="bw-error" data-load-error><strong>{/fetch|network|unexpected response/i.test(error)?'We couldn’t reach Mystery Hub':'Your business records didn’t load'}</strong><p>{/fetch|network/i.test(error)?'Check your connection, then try again. Nothing has changed on your website or store.':error}</p><button className={button} disabled={busy} onClick={()=>void action(async()=>{})}>{busy?'Trying…':'Try again'}</button></div>}{notice&&<p role="status" className="text-emerald-300">{notice}</p>}
    {!data&&!error&&tab!=='Settings'&&tab!=='Bundles & Pricing'&&<div role="status" className="bw-loading" data-loading><span/><span/><span/><span className="sr-only">Loading your business records…</span></div>}
    {data&&<>
      {/* Display-only scope labels from the B1 capability flags; no balance or order logic here. */}
      {tab==='Orders'&&!reseller&&<p className="text-sm text-slate-300 rounded-xl border border-slate-800 bg-slate-900/60 p-3">These orders are from when this website was a Data store. Your current design does not sell data, and these records are kept for your history.</p>}
      {tab==='Store Earnings'&&<p className="text-sm text-slate-300 rounded-xl border border-slate-800 bg-slate-900/60 p-3">Store Earnings cover your whole Mystery Hub account, not only this website.{!reseller?' Your current design does not sell data.':''}</p>}
      {['Overview','Analytics'].includes(tab)&&<>
        {tab==='Overview'&&status&&<div className="website-store-status" data-store-status={status.state} data-tone={status.tone} aria-labelledby="website-store-status-title">
          <p className="website-store-status-label"><span aria-hidden="true"/>{status.label}</p>
          <h3 id="website-store-status-title">{status.title}</h3>{!launch&&<p>{status.detail}</p>}
          {launch?<ol aria-label="Launch your data store" className="website-launch-steps">{launch.map((step,index)=>{const next=launch.find(s=>!s.done&&s.ready)?.id===step.id;return <li key={step.id} data-done={step.done?'yes':'no'} data-next={next?'yes':'no'}><span aria-hidden="true">{step.done?'✓':index+1}</span><div className="min-w-0"><strong>{step.title}{step.done&&<span className="sr-only"> (done)</span>}</strong><p>{step.detail}</p></div>{next&&(step.id!=='share'||onShare)&&<button type="button" onClick={()=>act(step.action)}>{step.label}</button>}</li>;})}</ol>
          :status.action&&(status.action.action!=='share'||onShare)&&<div className="website-store-status-actions"><button type="button" onClick={()=>act(status.action!.action)}>{status.action.label}</button>{status.state==='open'&&onCopyLink&&<button type="button" data-quiet onClick={onCopyLink}>Copy link</button>}</div>}
        </div>}
        {tab==='Overview'&&reseller&&e&&(e.availableMinor>0||e.pendingMinor>0||e.reservedMinor>0)&&<button type="button" className="website-money" data-money-strip onClick={()=>navigate('Store Earnings')}><span><small>Available</small><strong>{formatGhs(e.availableMinor)}</strong></span><span><small>Pending</small><strong>{formatGhs(e.pendingMinor)}</strong></span><span className="website-money-link">Store Earnings<span aria-hidden="true"> ›</span></span></button>}
        {tab==='Overview'&&(attentionShown.length>0||!reseller)&&<div className="website-attention" aria-labelledby="website-attention-title"><h3 id="website-attention-title" className="font-semibold">{attentionShown.length?'Needs your attention':'Everything looks good'}</h3>{attentionShown.length?<ul>{attentionShown.filter(item=>item.action!=='share'||onShare).map(item=><li key={item.id} data-tone={item.tone}><span aria-hidden="true"/><div className="min-w-0"><strong>{item.title}</strong><p>{item.detail}</p></div><button type="button" onClick={()=>act(item.action)}>{item.label}</button></li>)}</ul>:<p className="text-sm text-slate-400">{site.status==='published'?'Your website is live and ready for customers. Keep sharing your link to bring in visitors.':'Publish your website when it looks right.'}</p>}</div>}
        {tab==='Overview'&&overviewHub?.(summary)}
        <div role="group" aria-label="Analytics period" className="website-period">{['1','7','30','90','all'].map(r=><button key={r} type="button" aria-pressed={range===r} onClick={()=>setRange(r)}>{r==='all'?'All time':r==='1'?'Last 24 hours':`${r} days`}</button>)}</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Object.entries(tab==='Overview'?summaryMetrics:{Views:a.views,'Unique visitors':a.uniqueVisitors,'WhatsApp clicks':a.whatsappClicks,'Contact clicks':a.callClicks+a.emailClicks,'Main button clicks':a.primaryCtaClicks,...(reseller?{'Checkout starts':a.checkoutStarts,'Paid orders':a.paidOrders,'Delivered orders':a.deliveredOrders,'Sales':formatGhs(a.salesMinor),'Available earnings':formatGhs(e.availableMinor),'Pending earnings':formatGhs(e.pendingMinor),'Orders / checkout starts':a.conversion===null?'—':`${a.conversion.toFixed(1)}%`}:{})}).map(([label,value])=><div key={label} className="border-b border-slate-800 py-3 min-w-0"><p className="text-xs text-slate-400">{label}</p><strong className="block mt-1 text-xl break-words">{String(value)}</strong></div>)}</div>
        {tab==='Analytics'&&<p className="text-xs text-slate-400">Visitors are anonymous browser identities. Repeat views in the same session are deduplicated for 24 hours. Sales and delivery come from verified order records. Conversion compares paid orders with observed checkout starts; missing analytics may affect this ratio.</p>}
        {tab==='Analytics'&&<div className="space-y-2"><h3 className="font-semibold">Daily observed views (UTC)</h3>{a.trend.length?a.trend.map((day:any)=><div key={day.day} className="flex items-center gap-3 text-sm"><span>{day.day}</span><progress max={Math.max(1,...a.trend.map((x:any)=>x.views))} value={day.views} className="min-w-0 flex-1"/><span>{day.views}</span></div>):<p className="text-slate-400">No visits yet in this period. Share your published website to reach customers.</p>}</div>}
      </>}
      {['Overview','Analytics'].includes(tab)&&(()=>{
        // The owner's own editor visits stay in the full history, never in the Overview's customer activity.
        const recent=[...a.activity.filter((x:any)=>tab!=='Overview'||!isOwnerActivity(x.event)).map((x:any)=>({label:customerActivityLabel(x.event),at:x.createdAt})),...data.activity.map((x:any)=>({label:`${customerActivityLabel(x.kind)} · ${customerActivityLabel(x.state)}`,at:x.createdAt}))].sort((x,y)=>y.at.localeCompare(x.at)).slice(0,20);
        // Overview: a short digest. Back-to-back repeats (e.g. many page views) collapse into one row with a count.
        const rows=tab==='Overview'?activityDigest(recent).slice(0,5):recent.map(x=>({...x,count:1}));
        return <div className="space-y-3"><div className="flex items-baseline justify-between gap-3"><h3 className="font-semibold">{tab==='Overview'?'Customer activity':'All activity'}</h3>{tab==='Overview'&&recent.length>rows.length&&<button type="button" className="text-sm text-[#44df95] underline underline-offset-2" onClick={()=>navigate('Analytics')}>See all activity</button>}</div>{rows.map((x,index)=><p key={index} className="border-b border-slate-800 py-2"><span className="block capitalize">{x.label}{x.count>1&&<span className="normal-case text-slate-400"> ×{x.count}</span>}</span><time className="text-xs text-slate-400">{x.count>1?'Latest ':''}{new Date(x.at).toLocaleString()}</time></p>)}{!recent.length&&<p className="text-sm text-slate-400">{site.status==='published'?'No customer activity yet. Share your link on WhatsApp status or with your customers, and visits, messages'+(reseller?' and sales':'')+' will show here.':'Publish and share your website to start seeing customer activity.'}</p>}</div>;
      })()}
      {/* Optional polish comes after the business picture, with quiet buttons so it never competes with the store's next step. */}
      {tab==='Overview'&&suggestions.length>0&&<div className="website-attention" data-suggestions aria-labelledby="website-suggestions-title"><h3 id="website-suggestions-title" className="font-semibold">Ways to make it better</h3><ul>{suggestions.map(item=><li key={item.id} data-tone="info"><span aria-hidden="true"/><div className="min-w-0"><strong>{item.title}</strong><p>{item.detail}</p></div><button type="button" onClick={()=>act(item.action)}>{item.label}</button></li>)}</ul></div>}
      {tab==='Orders'&&<div className="space-y-4" data-orders>
        {/* Status first (what most owners look for), then the private search, then the records. */}
        {orders.length>0&&<div role="group" aria-label="Show orders" className="website-period" data-order-filters>{OWNER_ORDER_FILTERS.filter(([id])=>id==='all'||orderCounts[id as keyof typeof orderCounts]).map(([id,label])=><button key={id} type="button" aria-pressed={orderFilter===id} onClick={()=>setOrderFilter(id)}>{label}{id!=='all'&&<span className="text-slate-400"> {orderCounts[id as keyof typeof orderCounts]}</span>}</button>)}</div>}
        <form className="bw-order-search" onSubmit={event=>{event.preventDefault();if(searchInput&&!/^\d{4}$/.test(searchInput))return;setOffset(0);setOrderFilter('all');setLastFour(searchInput);}}>
          <label htmlFor="bw-order-search">Find a customer’s order<small>Type the last 4 digits of the number the data was sent to.</small></label>
          <div><input id="bw-order-search" aria-label="Last four recipient digits" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="e.g. 4567" value={searchInput} onChange={event=>setSearchInput(event.target.value.replace(/\D/g,''))} className={field}/><button className={button} disabled={!searchInput&&!lastFour}>Search orders</button>{lastFour&&<button type="button" className={button} onClick={()=>{setSearchInput('');setLastFour('');setOffset(0);}}>Clear search</button>}</div>
        </form>
        {lastFour&&<p role="status" className="text-sm text-slate-300">Orders sent to numbers ending in <strong>{lastFour}</strong>.</p>}
        {orders.length>0&&<p className="text-xs text-slate-400" data-order-range>Newest first · orders {offset+1}–{offset+orders.length}{orderFilter!=='all'?` · showing ${OWNER_ORDER_FILTERS.find(([id])=>id===orderFilter)?.[1].toLowerCase()} only`:''}</p>}
        {orders.length?orders.filter(o=>orderFilter==='all'||ownerOrderView(o).group===orderFilter).map(o=>{const view=ownerOrderView(o);return <details key={o.id} className="bw-order" data-order-group={view.group}><summary><span className="bw-order-main"><strong>{o.network.toUpperCase()} {o.bundle}</strong><span className="text-slate-300"> to {o.recipient}</span><span className="block text-sm text-slate-400">{formatGhs(o.retailMinor)}{view.paid&&view.group!=='failed'&&o.earningMinor>0&&<> · <span className="text-emerald-300">you earn {formatGhs(o.earningMinor)}</span></>} · {new Date(o.createdAt).toLocaleString()}</span></span><span className="website-order-facts"><span data-paid={view.paid?'yes':'no'}>{view.payment}</span><span data-group={view.group}>{view.delivery}</span></span></summary><div className="bw-order-detail"><p className="break-all text-xs">Reference {o.reference}</p><p className="text-sm">Your earning: {formatGhs(o.earningMinor)} · {customerActivityLabel(o.earningState)}</p><p className="text-xs text-slate-400">Wholesale {formatGhs(o.snapshot.wholesaleMinor)} · Processing reserve {formatGhs(o.snapshot.reserveMinor)}</p>{o.manualReview&&<p className="text-amber-300">Mystery Hub is reviewing delivery. Do not submit another purchase for this order.</p>}</div></details>;}):<div className="bw-empty"><strong>{lastFour?'No orders match those last four digits.':offset?'No older orders.':'No orders yet'}</strong>{!lastFour&&!offset&&<p>{site.status==='published'?'Your first sale will appear here. Share your store link to start.':'Your first sale will appear here. Publish your store and share its link to start.'}</p>}</div>}
        {orders.length>0&&!orders.some(o=>orderFilter==='all'||ownerOrderView(o).group===orderFilter)&&<p className="text-sm text-slate-400">No orders like this on this page.</p>}
        <p className="text-xs text-slate-400">Recipient numbers are partly hidden. Payment and delivery come from Mystery Hub's order records.</p>
        {(offset>0||orders.length>=25)&&<div className="flex gap-2" data-order-pages><button className={button} disabled={!offset||busy} onClick={()=>setOffset(Math.max(0,offset-25))}>Newer orders</button><button className={button} disabled={orders.length<25||busy} onClick={()=>setOffset(offset+25)}>Older orders</button></div>}
      </div>}
      {tab==='Store Earnings'&&(()=>{
        // Every figure is a server field; the fee preview uses the same percentage rounding the server applies to the request.
        const minimum=Number(data.policy.withdrawalMinimumMinor||0),feeBps=Number(data.policy.withdrawalFeeBps||0),available=Number(e.availableMinor||0),pending=Number(e.pendingMinor||0);
        const canWithdraw=available>=minimum&&available>0;
        let requested:number|null=null;try{requested=withdrawal.amount.trim()?parseGhs(withdrawal.amount):null;}catch{requested=null;}
        let fee:number|null=null;try{fee=requested!==null&&requested>0?percentMinor(requested,feeBps):null;}catch{fee=null;}
        const edit=(patch:Partial<typeof withdrawal>)=>{setWithdrawal({...withdrawal,...patch});setRequestId(crypto.randomUUID());setConfirmed(false);};
        return <div className="space-y-5">
        <div className="website-earnings-summary" data-earnings-summary data-can-withdraw={canWithdraw&&!e.reconciliationRequired?'yes':'no'}>
          <p>Available</p><strong>{formatGhs(available)}</strong>
          <p className="website-earnings-note">{e.reconciliationRequired?'Our team needs to review your Store Earnings before you can withdraw.':canWithdraw?`You can request up to ${formatGhs(available)}. Mystery Hub reviews each request and pays it to your Mobile Money by hand, so it is not instant.`:`Withdrawals start at ${formatGhs(minimum)}.${available>0?` You need ${formatGhs(minimum-available)} more available.`:''}${pending>0?` ${formatGhs(pending)} is pending and becomes available when those orders are delivered.`:''}`}</p>
        </div>
        {!e.reconciliationRequired&&!canWithdraw&&available>0&&<p className="text-sm text-slate-400">Closing your store with less than the minimum? <a href={websiteDeletionSupportUrl(BUSINESS_CONFIG.contact.supportWhatsAppUrl,{name:site.content_json?.businessName||site.name,publicAddress:`${window.location.host}/sites/${site.slug}`},[{code:'earnings_available',amountMinor:available,message:''}],minimum)} target="_blank" rel="noopener noreferrer" className="underline text-slate-200">Contact support</a>. Funds remain in Store Earnings; deletion never forfeits or transfers them.</p>}
        {!e.reconciliationRequired&&canWithdraw&&<form className="max-w-xl space-y-3" data-withdrawal-form onSubmit={event=>{event.preventDefault();void action(async()=>{await websiteBusinessRequest(`websites/${site.id}/store-withdrawals`,token,{confirmed,requestId,amountMinor:parseGhs(withdrawal.amount),phone:withdrawal.phone,network:withdrawal.network,recipientName:withdrawal.recipientName});setRequestId(crypto.randomUUID());setConfirmed(false);setNotice('Withdrawal requested. Our team will review it.');});}}><h3 className="font-bold">Request Mobile Money withdrawal</h3><p className="text-xs text-slate-400">Minimum {formatGhs(minimum)} · {(feeBps/100).toFixed(2)}% processing fee deducted from the requested amount.</p>
          <label className="block text-sm">Requested amount (GH₵)<span className="flex gap-2 mt-1"><input required maxLength={20} className={field} value={withdrawal.amount} inputMode="decimal" enterKeyHint="next" onChange={event=>edit({amount:event.target.value})}/><button type="button" className={`${button} shrink-0`} onClick={()=>edit({amount:(available/100).toFixed(2)})}>Use all</button></span></label>
          {fee!==null&&requested!==null&&fee<requested&&<p className="text-sm" data-withdrawal-net>Fee {formatGhs(fee)} · <strong>you receive {formatGhs(requested-fee)}</strong></p>}
          <label className="block text-sm">MoMo number<input required maxLength={20} className={`${field} mt-1`} value={withdrawal.phone} inputMode="tel" autoComplete="tel" onChange={event=>edit({phone:event.target.value})}/></label>
          <label className="block text-sm">Recipient name<input required maxLength={128} className={`${field} mt-1`} value={withdrawal.recipientName} autoComplete="name" onChange={event=>edit({recipientName:event.target.value})}/></label>
          <label className="block text-sm">MoMo provider<select className={`${field} mt-1`} value={withdrawal.network} onChange={event=>edit({network:event.target.value})}>{([['mtn','MTN MoMo'],['telecel','Telecel Cash'],['airteltigo','AirtelTigo Money']] as const).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label className="flex gap-2 min-h-11 items-center text-sm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>I confirm the destination and processing fee.</label><button className={`${button} bg-emerald-500 text-black font-bold`} disabled={busy||!confirmed||e.reconciliationRequired}>Request withdrawal</button></form>}
        <ol className="website-earnings-flow" aria-label="How Store Earnings move">
          <li><strong>Pending</strong><span>A customer paid. Your earning waits until their data is delivered.</span></li>
          <li><strong>Available</strong><span>Delivered. You can withdraw it once you reach the minimum.</span></li>
          <li><strong>Withdrawn</strong><span>Reviewed by Mystery Hub and paid to your MoMo. If an order fails or is refunded, its earning is cancelled.</span></li>
        </ol>
        <dl className="website-earnings" data-earnings>{STORE_EARNING_DEFINITIONS.filter(([key])=>key!=='availableMinor').map(([key,label,meaning])=><div key={key} data-key={key}><dt>{label}</dt><dd><strong>{formatGhs(Number(e[key]||0))}</strong><span>{meaning}</span></dd></div>)}<div><dt>Lifetime</dt><dd><strong>{formatGhs(Number(e.lifetimeMinor||0))}</strong><span>Historical earnings released, including amounts later withdrawn or reversed. This is not your balance.</span></dd></div></dl>
        <p className="text-sm text-slate-400">Store Earnings stay separate from Mystery Wallet and referral rewards. Sales are what customers paid; only your earnings can be withdrawn.</p>
        <h3 className="font-bold">Withdrawal history</h3>{data.withdrawals.length?data.withdrawals.map((w:any)=><article key={w.id} className="border-b border-slate-800 py-3 text-sm"><strong>{formatGhs(w.amount_minor)} · {customerActivityLabel(w.state)}</strong><p>Fee {formatGhs(w.payload.feeMinor)} · Net {formatGhs(w.payload.netMinor)} · {String(w.payload.network||'').toUpperCase()} {w.payload.maskedPhone}</p><p className="text-slate-400 text-xs">{new Date(w.created_at).toLocaleString()}{w.payload.paidAt?` · Paid ${new Date(w.payload.paidAt).toLocaleString()}`:''}</p>{w.payload.rejectionReason&&<p>{w.payload.rejectionReason}</p>}</article>):<p className="text-slate-400">No withdrawal requests.</p>}
        <h3 className="font-bold">Earnings history</h3>{data.ledger.length?data.ledger.map((entry:any)=><p key={entry.id} className="text-sm border-b border-slate-800 py-2">{entry.description} · {entry.delta_minor<0?'−':'+'}{formatGhs(Math.abs(entry.delta_minor))}<time className="block text-xs text-slate-400">{new Date(entry.created_at).toLocaleString()}</time></p>):<p className="text-slate-400">No earnings recorded yet. They appear here once a customer’s order is delivered.</p>}
        </div>;})()}
    </>}
  </section>;
}
