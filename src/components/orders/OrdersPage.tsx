import { dataOrderPresentation, dataRecipientDisplay } from '../../utils/dataPurchasePresentation';
import { canonicalGhanaPhone } from '../../../server/utils/phone';
import type { SafePublicOrderDetails } from '../../../server/types/orders';
import { BUSINESS_CONFIG } from '../../config/business';
import { afaStatusLabel } from '../../../shared/afa';
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { GHANA_NETWORKS } from '../../data/bundles';
import { lookupOrderOnServer, getAccountOrdersOnServer } from '../../services/apiClient';
import { getInstantBundlePresentation } from '../../utils/instantBundleUtils';
import { OrderRecord } from '../../types';
import { NetworkBrandBadge } from '../common/NetworkBrandBadge';
import { Clock, Search, ArrowRight, CheckCircle2, RefreshCw, AlertTriangle, Smartphone, ShieldCheck, ShoppingBag, X } from 'lucide-react';

type AccountSearch = { phone?: string; reference?: string };
function customerOrderView(o: SafePublicOrderDetails, owned: boolean): OrderRecord {
  const isDelivered=o.status==='delivered',isProcessing=o.status==='processing'||o.status==='submitted';
  const isPlaced=o.status==='paid'||o.status==='queued',isFailed=['failed','refund_pending','refunded'].includes(o.status);
  return {
              id: o.public_reference,
              publicReference: o.public_reference,
              serverReference: o.public_reference,
              serverStatus: o.status,
              manualReview: o.manual_review,
              commercialPricing: o.commercial_pricing,
              serviceType: o.service_type || (o.product_name_snapshot?.toLowerCase().includes('airtime') ? 'airtime' : 'data'),
              bundle: {
                id: 'server-bundle-' + o.public_reference,
                network: o.network,
                dataAmount: o.bundle_size_snapshot || o.product_name_snapshot || 'Data Order',
                dataBytesValue: 0,
                validity: 'Standard',
                validityCategory: 'Daily',
                priceGhc: o.amount_ghc,
                description: o.product_name_snapshot,
              },
              recipientPhone: o.recipient_phone,
              buyerRecipientVisible: owned,
              network: o.network,
              paymentMethod: 'paystack',
              amountGhc: o.amount_ghc,
              status: isDelivered ? 'delivered' : isProcessing ? 'processing' : isPlaced ? 'placed' : isFailed ? 'failed' : 'verifying',
              paymentReference: o.public_reference,
              createdAt: o.created_at,
              updatedAt: o.created_at,
            };
}

export const OrdersPage: React.FC = () => {
  const { openOrderStatus, setActivePage, showToast, user, sessionToken, openAuth } = useApp();
  const identity=user&&sessionToken?`${user.id}|${sessionToken}`:'';
  const activeIdentity=React.useRef(identity);activeIdentity.current=identity;
  const [searchQuery,setSearchQuery]=useState('');
  const [publicMode,setPublicMode]=useState(false),[guestGuidance,setGuestGuidance]=useState(false);
  const [isSearchingServer,setIsSearchingServer]=useState(false);
  const [search,setSearch]=useState<AccountSearch>({}),[pageCursor,setPageCursor]=useState<string|null>(null);
  const [result,setResult]=useState<{identity:string;orders:OrderRecord[];nextCursor:string|null}>({identity:'',orders:[],nextCursor:null});
  const [accountLoading,setAccountLoading]=useState(false),[accountError,setAccountError]=useState(''),[refresh,setRefresh]=useState(0);
  const publicRequest=React.useRef<AbortController|null>(null);
  const previousIdentity=React.useRef(identity);
  const filteredOrders=result.identity===identity&&identity?result.orders:[];
  const nextCursor=result.identity===identity?result.nextCursor:null;
  const searchKey=JSON.stringify(search);

  useEffect(()=>{
    publicRequest.current?.abort();setIsSearchingServer(false);setGuestGuidance(false);
    setSearchQuery('');setPublicMode(false);setSearch({});setPageCursor(null);
  },[identity]);

  useEffect(()=>{
    const switched=previousIdentity.current!==identity;previousIdentity.current=identity;
    if(!identity||!sessionToken){setResult({identity:'',orders:[],nextCursor:null});setAccountLoading(false);setAccountError('');return;}
    const controller=new AbortController(),cursor=switched?null:pageCursor;
    setAccountLoading(true);setAccountError('');
    if(!cursor)setResult({identity,orders:[],nextCursor:null});
    getAccountOrdersOnServer(sessionToken,50,{...(switched?{}:search),cursor,signal:controller.signal})
      .then(response=>{
        if(controller.signal.aborted||activeIdentity.current!==identity)return;
        if(!response.success||!Array.isArray(response.orders))throw Error('Invalid account response');
        const incoming=response.orders.map(o=>customerOrderView(o,true));
        setResult(old=>({identity,orders:cursor&&old.identity===identity?[...new Map([...old.orders,...incoming].map(o=>[o.publicReference||o.id,o])).values()]:incoming,nextCursor:response.nextCursor||null}));
      })
      .catch(()=>{if(!controller.signal.aborted&&activeIdentity.current===identity)setAccountError("We couldn't load your account orders. Try again.");})
      .finally(()=>{if(!controller.signal.aborted&&activeIdentity.current===identity)setAccountLoading(false);});
    return()=>controller.abort();
  },[identity,sessionToken,searchKey,pageCursor,refresh]);

  useEffect(()=>()=>publicRequest.current?.abort(),[]);

  const handleServerLookup=async(event:React.FormEvent)=>{
    event.preventDefault();const query=searchQuery.trim();if(!query)return;
    const phone=query.length<=64?canonicalGhanaPhone(query):null;
    setGuestGuidance(false);
    if(identity&&!publicMode) {
      if(!phone&&!/^[a-zA-Z0-9_-]{1,128}$/.test(query)||!phone&&/^[+0-9 ()-]+$/.test(query)){setAccountError('Enter a Ghana phone number or an order reference.');return;}
      setSearch(phone?{phone}:{reference:query});setPageCursor(null);setRefresh(x=>x+1);return;
    }
    if(phone||/^[+0-9 ()-]+$/.test(query)){setGuestGuidance(true);return;}
    if(!/^[a-zA-Z0-9_-]{1,128}$/.test(query)){showToast('Check your order reference and try again.','warning');return;}
    publicRequest.current?.abort();const controller=new AbortController();publicRequest.current=controller;
    setIsSearchingServer(true);
    try {
      const response=await lookupOrderOnServer(query,controller.signal);
      if(controller.signal.aborted||activeIdentity.current!==identity)return;
      if(response.success&&response.order)openOrderStatus(customerOrderView(response.order,false));
      else showToast("We couldn't find that order. Check the reference and try again.",'warning');
    } catch {if(!controller.signal.aborted&&activeIdentity.current===identity)showToast("We couldn't check this order. Check the reference or try again.",'warning');}
    finally{if(!controller.signal.aborted&&activeIdentity.current===identity)setIsSearchingServer(false);}
  };
  const clearSearch=()=>{setSearchQuery('');setSearch({});setPageCursor(null);setGuestGuidance(false);setRefresh(x=>x+1);};

  return (
    <div className="py-6 sm:py-10 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#112019] border border-[#00c365]/30 text-xs font-semibold text-[#00c365] mb-2">
              {user ? <ShieldCheck className="w-3.5 h-3.5 text-[#00c365]" /> : <Clock className="w-3.5 h-3.5" />}
              <span>{user ? 'Account Orders' : 'Order Tracking'}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              {user ? 'Your Orders' : 'Track an order'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {user
                ? 'Your purchases linked to this Mystery Hub account.'
                : 'Check delivery progress and view your order details.'}
            </p>
          </div>

          <button
            onClick={() => setActivePage('data')}
            className="px-4 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all self-start sm:self-auto cursor-pointer"
          >
            Buy Data
          </button>
        </div>

        {identity&&<button type="button" onClick={()=>{setPublicMode(x=>!x);setSearchQuery('');setGuestGuidance(false);}} className="min-h-11 text-sm text-emerald-300">{publicMode?'Back to your orders':'Track another order by reference'}</button>}
        <label htmlFor="order-search" className="block text-sm font-semibold">{identity&&!publicMode?'Search your orders':'Mystery Hub order reference'}</label>
        <form onSubmit={handleServerLookup} className="flex flex-col min-[390px]:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="order-search"
              maxLength={128}
              aria-label={identity&&!publicMode?"Search your orders by phone or reference":"Mystery Hub order reference"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={identity&&!publicMode?"Recipient phone or order reference":"Enter your order reference"}
              className="w-full bg-[#0e141a] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c365]"
            />
          </div>
          <button
            type="submit"
            disabled={isSearchingServer || !searchQuery.trim()}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors shrink-0 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isSearchingServer ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#00c365]" />
            ) : (
              identity&&!publicMode?'Search your orders':'Track Order'
            )}
          </button>
        </form>
        <p className="text-xs text-slate-400">{identity&&!publicMode?'Search only your account purchases, including older orders.':'Bought with an account? Sign in to see your linked orders.'}</p>

{guestGuidance&&<div role="status" className="mh-surface text-sm space-y-3"><p>To track a guest order, enter your order reference. Sign in to search your account orders.</p><div className="flex flex-wrap gap-3">{!identity&&<button type="button" onClick={()=>openAuth('login','Sign in to search your own orders.')} className="mh-button-primary">Sign In</button>}<a href={BUSINESS_CONFIG.contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="mh-button-secondary">Customer Support</a></div></div>}
        {identity&&(search.phone||search.reference)&&<button type="button" onClick={clearSearch} className="mh-button-secondary">Show all your orders</button>}
<div aria-live="polite">{accountLoading&&<p className="text-sm text-slate-400">Loading your account orders…</p>}{accountError&&<div className="mh-surface text-sm"><p role="alert" className="text-amber-300">{accountError}</p><button className="mh-button-secondary mt-3" onClick={()=>setRefresh(x=>x+1)}>Try again</button></div>}</div>
        {/* Orders List */}
        {filteredOrders.length > 0 ? (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const net = GHANA_NETWORKS[order.network] || GHANA_NETWORKS['mtn'];

              const isAfa = order.serviceType === 'afa';

              const statusBadge = isAfa ? (
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold border px-2.5 py-1 rounded-full ${order.serverStatus === 'delivered' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                  {order.serverStatus === 'delivered' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {afaStatusLabel(order.serverStatus, order.manualReview)}
                </span>
              ) : {
                verifying: (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Verifying
                  </span>
                ),
                delivered: (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    Delivered
                  </span>
                ),
                processing: (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-full animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Processing
                  </span>
                ),
                placed: (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                    <Clock className="w-3 h-3" />
                    Queued
                  </span>
                ),
                failed: (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full">
                    <AlertTriangle className="w-3 h-3" />
                    Failed
                  </span>
                ),
              }[order.status];

              const isInstantBundle =
                order.serviceType === 'instant_bundle' ||
                (order.bundle.id && order.bundle.id.startsWith('instant-')) ||
                (order.bundle.packageId && order.bundle.packageId.length > 0);
              const isAirtime =
                order.serviceType === 'airtime' ||
                (order.bundle.id && order.bundle.id.startsWith('airtime-'));
              const isMarketplace =
                order.serviceType === 'marketplace' ||
                (order.bundle.id && order.bundle.id.startsWith('marketplace-'));
              const instantInfo = isInstantBundle
                ? getInstantBundlePresentation({
                    category: order.bundle.category,
                    name: order.bundle.description || order.bundle.dataAmount,
                    dataAmount: order.bundle.dataAmount,
                    isFlexi: order.bundle.isFlexi,
                  })
                : null;

              return (
                <div
                  key={order.id}
                  role="button" tabIndex={0} aria-label={`Track order ${order.publicReference||order.id}`}
                  onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openOrderStatus(order);}}}
                  onClick={() => openOrderStatus(order)}
                  className="p-4 sm:p-5 rounded-2xl bg-[#0f151b] border border-slate-800 hover:border-[#00c365]/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365]"
                >
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                    {isMarketplace ? (
                      <div className="w-8 h-8 rounded-lg bg-[#00c365]/15 border border-[#00c365]/30 text-[#00c365] flex items-center justify-center shrink-0 shadow-sm">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                    ) : (
                      <NetworkBrandBadge network={order.network} size="md" />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm sm:text-base group-hover:text-[#00c365] transition-colors truncate max-w-[240px] sm:max-w-none">
                          {isAfa
                            ? 'AFA Registration'
                            : isMarketplace
                            ? order.bundle.description || order.bundle.dataAmount || 'Marketplace Item'
                            : isInstantBundle && instantInfo
                            ? `${instantInfo.formattedAmount} ${instantInfo.categoryLabel} ⚡`
                            : isAirtime
                            ? order.bundle.dataAmount
                            : `${order.bundle.dataAmount} Data Bundle`}
                        </span>
                        <span className="font-mono text-[11px] text-slate-300 break-all">
                          #{order.publicReference || order.id}
                        </span>
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-2.5 sm:gap-x-3 gap-y-1">
                        <span>Recipient: {order.serviceType==='data'?dataRecipientDisplay(order.recipientPhone,order.buyerRecipientVisible):order.recipientPhone}</span>
                        <span>·</span>
                        <span>
                          {new Date(order.createdAt).toLocaleDateString()}{' '}
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {instantInfo?.restrictionNote && (
                          <>
                            <span>·</span>
                            <span
                              className={`text-[11px] font-semibold ${
                                instantInfo.isMidnight
                                  ? 'text-amber-400'
                                  : instantInfo.isVideo
                                  ? 'text-indigo-400'
                                  : instantInfo.isIdd
                                  ? 'text-emerald-400'
                                  : 'text-slate-300'
                              }`}
                            >
                              {instantInfo.badgeEmoji ? `${instantInfo.badgeEmoji} ` : ''}
                              {instantInfo.restrictionNote}
                            </span>
                          </>
                        )}
                      </div>
                      {order.serviceType==='data'&&<p className="text-xs text-slate-400 mt-2 leading-relaxed">{dataOrderPresentation(order.serverStatus,order.manualReview).next}</p>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 shrink-0">
                    <div className="text-left sm:text-right">
                      <div className="text-sm sm:text-base font-extrabold text-white tabular-nums">
                        GH₵{order.amountGhc.toFixed(2)}
                      </div>
                      {Boolean(order.commercialPricing?.discountMinor)&&<p className="text-xs text-emerald-300">Welcome saving GH₵{(order.commercialPricing!.discountMinor/100).toFixed(2)} from GH₵{(order.commercialPricing!.regularMinor/100).toFixed(2)}</p>}
                      <div className="mt-1">{order.serviceType==='data'?<span className="text-xs font-semibold text-slate-200">{dataOrderPresentation(order.serverStatus,order.manualReview).label}</span>:statusBadge}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#00c365] group-hover:translate-x-1 transition-all shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : identity&&(search.phone||search.reference)&&!accountLoading&&!accountError ? (
          <div className="text-center py-12 px-4 bg-[#0f151b] rounded-2xl border border-slate-800 space-y-3 max-w-md mx-auto shadow-sm">
            <Search className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-base font-bold text-white">No matching orders</h3>
            <p className="text-xs text-slate-400">
              No orders in your account match this search. Check the reference or phone number.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={clearSearch}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Search</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-14 px-4 bg-[#0f151b] rounded-2xl border border-slate-800 space-y-3.5 max-w-md mx-auto shadow-sm">
            <Smartphone className="w-9 h-9 text-slate-500 mx-auto" />
            <h3 className="text-base sm:text-lg font-bold text-white">{identity?(accountLoading?'Loading your orders':accountError?'Orders unavailable':'No orders to show'):'Your reference keeps tracking simple'}</h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              {identity?(accountLoading?'Your account history is loading.':accountError?'Use Try again to reload your account history.':'Your linked purchases appear here.'):'Enter the reference from your purchase confirmation. Sign in for your account order history.'}
            </p>
            <div className="pt-1">
              <button
                onClick={() => setActivePage('data')}
                className="px-5 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95"
              >
                Browse Data Bundles
              </button>
            </div>
          </div>
        )}
        {identity&&nextCursor&&<button type="button" disabled={accountLoading} onClick={()=>setPageCursor(nextCursor)} className="mh-button-secondary w-full sm:w-auto">{accountLoading?'Loading orders…':'Load more orders'}</button>}
      </div>
    </div>
  );
};
