import React from 'react';
import {Wifi,Smartphone,Globe,Gift,ArrowRight,ArrowUpRight,ShoppingBag,ShieldCheck,Grid2X2,MessageCircle,Sparkles,AlertTriangle,Check,RotateCcw} from 'lucide-react';
import type {AuthenticatedCustomerOrderDetails} from '../../../server/types/orders';
import type {NetworkId} from '../../types';
import {memberOrderSelection,memberOrderLabel,memberOrderTone,memberOrderSteps,memberOrderNext,memberReorder} from '../../utils/memberHomePresentation';
import {formatGhs} from '../../../shared/money';
import {BUSINESS_CONFIG} from '../../config/business';

/** What the account's existing Website Builder record says, when it has loaded. */
export type MemberWebsiteSummary={state:'none'}|{state:'draft'|'published';name:string;slug:string};

export interface MemberHomeViewProps {
  name:string; greeting:string; orders:AuthenticatedCustomerOrderDetails[]; loading:boolean; error:boolean;
  assistant:()=>void; wallet:React.ReactNode; retry:()=>void; track:(order:AuthenticatedCustomerOrderDetails)=>void;
  actions:{data:(network?:NetworkId)=>void;airtime:(network?:NetworkId)=>void;website:()=>void;earn:()=>void;orders:()=>void;marketplace:()=>void;afa:()=>void;services:()=>void};
  /** Omitted while loading or when it could not be read; the Website card then stays generic. */
  website?:MemberWebsiteSummary;
  /** Reserved slot under the first actions for one compact, dismissible prompt (for example a future app-install card). */
  promotion?:React.ReactNode;
}

const NETWORKS:{id:NetworkId;label:string;color:string}[]=[{id:'mtn',label:'MTN',color:'#ffcc00'},{id:'telecel',label:'Telecel',color:'#e4002b'},{id:'airteltigo',label:'AirtelTigo',color:'#3d8bff'}];
const orderTitle=(o:AuthenticatedCustomerOrderDetails)=>o.product_name_snapshot||o.bundle_size_snapshot||'Your order';

function OrderSpotlight({order,track,reorder}:{order:AuthenticatedCustomerOrderDetails;track:()=>void;reorder:(mode:'data'|'airtime',network:NetworkId)=>void}) {
  const tone=memberOrderTone(order),steps=memberOrderSteps(order),again=memberReorder(order);
  const heading=tone==='attention'?'Needs attention':tone==='active'?'Order to follow':'Latest order';
  return <section aria-labelledby="member-order-heading" className={`member-order member-order-${tone}`}>
    <div className="member-order-head">
      <h2 id="member-order-heading">{tone==='attention'&&<AlertTriangle className="size-4" aria-hidden="true"/>}{heading}</h2>
      <span className="member-order-status">{tone==='active'&&<span className="member-live-dot" aria-hidden="true"/>}{tone==='done'&&<Check className="size-3.5" aria-hidden="true"/>}{memberOrderLabel(order)}</span>
    </div>
    <div className="member-order-body">
      <div className="min-w-0"><h3>{orderTitle(order)}</h3><p className="member-order-meta">{order.recipient_phone} · {order.public_reference}</p></div>
      <p className="member-order-amount">{formatGhs(order.amount)}</p>
    </div>
    {steps&&<ol className="member-steps" aria-label="Order progress">{steps.map(step=><li key={step.label} className={step.done?'is-done':''}><span aria-hidden="true"/>{step.label}<span className="sr-only">{step.done?': complete':': not yet'}</span></li>)}</ol>}
    {tone!=='done'&&<p className="member-order-next">{memberOrderNext(order)}</p>}
    <div className="member-order-actions">
      {again&&<button className="mh-button" onClick={()=>reorder(again.mode,again.network)}><RotateCcw className="size-4" aria-hidden="true"/>Buy again</button>}
      <button className={again||tone==='attention'?'mh-button-secondary':'mh-button'} onClick={track}>Track Order</button>
      {tone==='attention'&&<a className="member-text-link" href={BUSINESS_CONFIG.contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" aria-hidden="true"/>WhatsApp support</a>}
    </div>
  </section>;
}

function FirstPurchase({data,airtime}:{data:(network?:NetworkId)=>void;airtime:()=>void}) {
  return <section aria-labelledby="member-order-heading" className="member-order member-first">
    <div className="member-order-head"><h2 id="member-order-heading"><Sparkles className="size-4" aria-hidden="true"/>Start here</h2></div>
    <p className="member-first-title">Your first order starts here.</p>
    <p className="member-order-next">Choose a network to see its bundles. After you pay, you can follow the order right here.</p>
    <div className="member-network-picks">{NETWORKS.map(n=><button key={n.id} onClick={()=>data(n.id)} style={{'--network':n.color} as React.CSSProperties}><span aria-hidden="true"/>{n.label}<span className="sr-only"> data bundles</span></button>)}</div>
    <button className="member-text-link" onClick={airtime}>Or top up airtime<ArrowRight className="size-4" aria-hidden="true"/></button>
  </section>;
}

function websiteCard(website:MemberWebsiteSummary|undefined) {
  if(website?.state==='published')return {title:'Your website is live',desc:website.name,tag:'Live',label:`Manage your website, ${website.name}`};
  if(website?.state==='draft')return {title:'Finish your website',desc:`${website.name} · not published yet`,tag:'Draft',label:`Continue your website, ${website.name}`};
  if(website?.state==='none')return {title:'Create a free website',desc:'Show your business or sell data online',tag:'Free plan',label:undefined};
  return {title:'Website Builder',desc:'Create or manage your free website',tag:'Free plan',label:undefined};
}

export function MemberHomeView({name,greeting,orders,loading,error,wallet,retry,track,actions,assistant,website,promotion}:MemberHomeViewProps) {
  const {latest,recent,prioritizesActive}=memberOrderSelection(orders);
  const tone=!loading&&!error&&latest?memberOrderTone(latest):null;
  // A purchase that needs the customer, or is still moving, comes before new buying.
  const urgent=tone==='attention'||tone==='active';
  const subline=tone==='attention'?'One of your orders needs attention.':tone==='active'?(prioritizesActive?'You have an order in progress.':'Your latest order is in progress.'):!loading&&!error&&!latest?'Welcome to Mystery Hub. Let’s get you connected.':'What would you like to do today?';
  const reorder=(mode:'data'|'airtime',network:NetworkId)=>mode==='airtime'?actions.airtime(network):actions.data(network);
  const site=websiteCard(website);
  const spotlight=loading?<section aria-label="Latest order" className="member-order member-order-loading"><p role="status">Loading your orders…</p><span className="member-skeleton" aria-hidden="true"/><span className="member-skeleton is-short" aria-hidden="true"/></section>
    :error?<section aria-label="Latest order" className="member-order"><p role="alert" className="member-order-error">Your orders are unavailable right now.</p><div className="member-order-actions"><button className="mh-button-secondary" onClick={retry}>Try again</button><button className="member-text-link" onClick={actions.orders}>Open My Orders<ArrowRight className="size-4" aria-hidden="true"/></button></div></section>
    :latest?<OrderSpotlight order={latest} track={()=>track(latest)} reorder={reorder}/>
    :<FirstPurchase data={actions.data} airtime={()=>actions.airtime()}/>;
  const services=[
    {id:'website',title:site.title,desc:site.desc,tag:site.tag,label:site.label,Icon:Globe,action:actions.website},
    {id:'earn',title:'Mystery Earn',desc:'Share your link. Earn when friends’ purchases qualify.',Icon:Gift,action:actions.earn},
    {id:'marketplace',title:'Marketplace',desc:'Laptops and tech, by enquiry',Icon:ShoppingBag,action:actions.marketplace},
    {id:'afa',title:'AFA Registration',desc:'Check availability',Icon:ShieldCheck,action:actions.afa},
    {id:'services',title:'All services',desc:'Including what’s coming soon',Icon:Grid2X2,action:actions.services},
  ];
  return <div className="member-home">
    <div className="member-home-inner">
      <header aria-label="Your account overview" className="member-home-top">
        <div className="member-greeting"><p>{greeting},</p><h1>{name}</h1><p className="member-sub">{subline}</p></div>
        <div className="member-wallet-slot">{wallet}</div>
      </header>
      <div className={`member-home-primary${urgent?' is-urgent':''}`}>
        <section aria-label="Buy now" className="member-buy">
          <button className="member-buy-tile member-buy-data" onClick={()=>actions.data()}>
            <span className="member-buy-icon"><Wifi className="size-5" aria-hidden="true"/></span>
            <span className="member-buy-text"><strong>Buy Data</strong><span>MTN, Telecel & AirtelTigo</span></span>
            <ArrowRight className="member-buy-arrow size-5" aria-hidden="true"/>
          </button>
          <button className="member-buy-tile member-buy-airtime" onClick={()=>actions.airtime()}>
            <span className="member-buy-icon"><Smartphone className="size-5" aria-hidden="true"/></span>
            <span className="member-buy-text"><strong>Airtime</strong><span>Top up any Ghana number</span></span>
            <ArrowRight className="member-buy-arrow size-5" aria-hidden="true"/>
          </button>
        </section>
        {spotlight}
      </div>
      {promotion&&<div className="member-home-slot">{promotion}</div>}
      <section aria-labelledby="member-services" className="member-services">
        <h2 id="member-services">More from Mystery Hub</h2>
        <div className="member-service-grid">{services.map(({id,title,desc,tag,label,Icon,action})=><button key={id} onClick={action} aria-label={label} className={`member-service member-service-${id}`}>
          <span className="member-service-icon"><Icon className="size-5" aria-hidden="true"/></span>
          <span className="member-service-text"><span className="member-service-title">{title}{tag&&<span className="member-service-tag">{tag}</span>}</span><span className="member-service-desc">{desc}</span></span>
          <ArrowRight className="member-service-arrow size-4" aria-hidden="true"/>
        </button>)}</div>
      </section>
      <div className="member-lower">
        <section aria-labelledby="member-recent" className="member-recent"><div className="member-section-head"><h2 id="member-recent">Recent activity</h2><button onClick={actions.orders} className="member-text-link">View all orders</button></div>
          {loading?<p role="status" className="member-muted">Loading recent activity…</p>:error?<p className="member-muted">Try again above, or <button className="member-inline-link" onClick={actions.orders}>open My Orders</button>.</p>:recent.length?<ul>{recent.map(o=><li key={o.public_reference}><button onClick={()=>track(o)}><span className="min-w-0"><span className="member-recent-title">{orderTitle(o)}</span><span className="member-recent-ref">{o.public_reference}</span></span><span className="member-recent-end"><span className="tabular-nums">{formatGhs(o.amount)}</span><span className={`member-recent-status is-${memberOrderTone(o)}`}>{memberOrderLabel(o)}</span></span><ArrowUpRight className="size-4 shrink-0 text-slate-400" aria-hidden="true"/></button></li>)}</ul>:<p className="member-muted">{latest?'You’re all caught up. Other recent orders will appear here.':'Your account activity will appear after your first purchase.'}</p>}
        </section>
        <section aria-labelledby="member-help" className="member-help"><h2 id="member-help">Need a hand?</h2><p>Ask about bundles, orders or your website. For a problem with a paid order, message support with your reference.</p>
          <div className="member-help-actions"><button className="mh-button-secondary" onClick={assistant}><Sparkles className="size-4 text-emerald-300" aria-hidden="true"/>Ask Mystery AI</button><a className="member-text-link" href={BUSINESS_CONFIG.contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" aria-hidden="true"/>WhatsApp support</a></div>
        </section>
      </div>
    </div>
  </div>;
}
