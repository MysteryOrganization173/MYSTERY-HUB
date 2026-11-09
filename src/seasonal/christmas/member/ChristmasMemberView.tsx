import React from 'react';
import { AlertTriangle, ArrowRight, ArrowUpRight, Check, Grid2X2, Lock, MessageCircle, RotateCcw, Smartphone, Sparkles, Wifi } from 'lucide-react';
import type { AuthenticatedCustomerOrderDetails } from '../../../../server/types/orders';
import type { NetworkId } from '../../../types';
import type { SeasonStatus } from '../../../../shared/seasonal';
import { formatGhs } from '../../../../shared/money';
import { BUSINESS_CONFIG } from '../../../config/business';
import { memberOrderLabel, memberOrderNext, memberOrderSelection, memberOrderSteps, memberOrderTone, memberReorder } from '../../../utils/memberHomePresentation';
import { NETWORKS, orderTitle, websiteCard, type MemberHomeViewProps } from '../../../components/home/MemberHomeView';
import { isChristmasTime, seasonCountdown } from '../copy';
import { AfaArt, EarnArt, MarketArt, WebArt } from '../home/homeArt';
import { press, pressEnd } from '../kit/motion';
import { MemberGift, MiniEnvelope } from './memberArt';

/**
 * The signed-in Christmas homepage: the customer's own control centre, dressed for the season.
 *
 * It is a presentation of exactly the data and actions the ordinary member homepage receives (MemberHomeViewProps,
 * read once for this account by MemberDashboard). Order truth outranks the season: an order that needs the customer
 * or is still moving leads the page, a problem is never dressed in celebration, progress lights only what the
 * server has confirmed, and nothing here can start a payment.
 */

export type ChristmasMemberViewProps = MemberHomeViewProps & {
  status: SeasonStatus;
  /** The first-purchase welcome invitation (only for a customer without orders; the card decides eligibility). */
  welcome?: React.ReactNode;
  rootRef?: React.Ref<HTMLDivElement>;
};

function OrderSpotlight({ order, track, reorder }: { order: AuthenticatedCustomerOrderDetails; track: () => void; reorder: (mode: 'data' | 'airtime', network: NetworkId) => void }) {
  const tone = memberOrderTone(order), steps = memberOrderSteps(order), again = memberReorder(order);
  const heading = tone === 'attention' ? 'Needs attention' : tone === 'active' ? 'Order to follow' : 'Latest order';
  return (
    <section aria-labelledby="xm-order-heading" className={`xm-order is-${tone}`}>
      <div className="xm-order-head">
        <h2 id="xm-order-heading">{tone === 'attention' && <AlertTriangle className="size-4" aria-hidden="true" />}{heading}</h2>
        <span className="xm-order-status">{tone === 'active' && <span className="xm-live-dot" aria-hidden="true" />}{tone === 'done' && <Check className="size-3.5" aria-hidden="true" />}{memberOrderLabel(order)}</span>
      </div>
      <div className="xm-order-body">
        <div className="min-w-0"><h3>{orderTitle(order)}</h3><p className="xm-order-meta">{order.recipient_phone} · {order.public_reference}</p></div>
        <p className="xm-order-amount">{formatGhs(order.amount)}</p>
      </div>
      {steps && <ol className="xm-steps" aria-label="Order progress">{steps.map(step => <li key={step.label} className={step.done ? 'is-done' : ''}><span aria-hidden="true" />{step.label}<span className="sr-only">{step.done ? ': complete' : ': not yet'}</span></li>)}</ol>}
      {tone !== 'done' && <p className="xm-order-next">{memberOrderNext(order)}</p>}
      <div className="xm-order-actions">
        {again && <button className="mh-button" onClick={() => reorder(again.mode, again.network)}><RotateCcw className="size-4" aria-hidden="true" />Buy again</button>}
        <button className={again || tone === 'attention' ? 'mh-button-secondary' : 'mh-button'} onClick={track}>Track Order</button>
        {tone === 'attention' && <a className="xm-text-link" href={BUSINESS_CONFIG.contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" aria-hidden="true" />WhatsApp support</a>}
      </div>
    </section>
  );
}

function FirstPurchase({ data, airtime }: { data: (network?: NetworkId) => void; airtime: () => void }) {
  return (
    <section aria-labelledby="xm-order-heading" className="xm-order is-first">
      <div className="xm-order-head"><h2 id="xm-order-heading"><Sparkles className="size-4" aria-hidden="true" />Start here</h2></div>
      <p className="xm-first-title">Your first order starts here.</p>
      <p className="xm-order-next">Choose a network to see its bundles. After you pay, you can follow the order right here.</p>
      <div className="xm-networks">{NETWORKS.map(n => <button key={n.id} onClick={() => data(n.id)} style={{ '--network': n.color } as React.CSSProperties}><span aria-hidden="true" />{n.label}<span className="sr-only"> data bundles</span></button>)}</div>
      <button className="xm-text-link" onClick={airtime}>Or top up airtime<ArrowRight className="size-4" aria-hidden="true" /></button>
    </section>
  );
}

export function ChristmasMemberView({ name, greeting, orders, loading, error, wallet, retry, track, actions, assistant, website, promotion, status, welcome, rootRef }: ChristmasMemberViewProps) {
  const christmas = isChristmasTime(status);
  const { big, small } = seasonCountdown(status);
  const { latest, recent, prioritizesActive } = memberOrderSelection(orders);
  const tone = !loading && !error && latest ? memberOrderTone(latest) : null;
  // A purchase that needs the customer, or is still moving, comes before new buying (exactly as the ordinary view).
  const urgent = tone === 'attention' || tone === 'active';
  const subline = tone === 'attention' ? 'One of your orders needs attention.' : tone === 'active' ? (prioritizesActive ? 'You have an order in progress.' : 'Your latest order is in progress.') : !loading && !error && !latest ? 'Welcome to Mystery Hub. Let’s get you connected.' : 'What would you like to do today?';
  const reorder = (mode: 'data' | 'airtime', network: NetworkId) => mode === 'airtime' ? actions.airtime(network) : actions.data(network);
  const site = websiteCard(website);
  const spotlight = loading
    ? <section aria-label="Latest order" className="xm-order is-loading"><p role="status">Loading your orders…</p><span className="xm-skeleton" aria-hidden="true" /><span className="xm-skeleton is-short" aria-hidden="true" /></section>
    : error
      ? <section aria-label="Latest order" className="xm-order is-error"><p role="alert" className="xm-order-error">Your orders are unavailable right now.</p><div className="xm-order-actions"><button className="mh-button-secondary" onClick={retry}>Try again</button><button className="xm-text-link" onClick={actions.orders}>Open My Orders<ArrowRight className="size-4" aria-hidden="true" /></button></div></section>
      : latest
        ? <OrderSpotlight order={latest} track={() => track(latest)} reorder={reorder} />
        : <FirstPurchase data={actions.data} airtime={() => actions.airtime()} />;

  return (
    <div ref={rootRef} className="xm-home" data-phase={status.phase}>
      <div className="xm-inner">
        <div className="xm-top">
          {/* Welcome: the customer's own name, the real time of day and the real state of their orders. */}
          <header aria-label="Your account overview" className="xm-welcome" data-xh-reveal="welcome">
            <div className="xm-welcome-text">
              <p className="xm-welcome-kicker"><span lang="ak">Afehyia pa</span>{' '}<span>{greeting},</span></p>
              <h1 className="xm-welcome-name">{name}</h1>
              <p className="xm-welcome-sub">{subline}</p>
              {/* When an order needs the customer, that sentence is the last word here: no seasonal line after it. */}
              {tone !== 'attention' && <p className="xm-welcome-season">{christmas ? 'Your digital world, wrapped for the season.' : 'Your digital world, ready for the new year.'}</p>}
            </div>
            <div className="xm-welcome-gift">
              <span className="xm-gift" onPointerDown={press} onAnimationEnd={pressEnd} aria-hidden="true"><MemberGift /></span>
              <p className="xm-daycount"><b>{big}</b> {small}</p>
            </div>
          </header>
          <div className="xm-wallet-slot">{wallet}</div>
        </div>

        <div className={`xm-primary${urgent ? ' is-urgent' : ''}`}>
          <section aria-label="Buy now" className="xm-buy" data-xh-reveal="buy">
            <button className="xm-buy-tile is-data" onClick={() => actions.data()}>
              <span className="xm-buy-sheen" aria-hidden="true" />
              <span className="xm-buy-icon"><Wifi className="size-5" aria-hidden="true" /></span>
              <span className="xm-buy-text"><strong>Buy Data</strong><span>MTN, Telecel & AirtelTigo</span></span>
              <ArrowRight className="xm-buy-arrow size-5" aria-hidden="true" />
            </button>
            <button className="xm-buy-tile is-airtime" onClick={() => actions.airtime()}>
              <span className="xm-buy-icon"><Smartphone className="size-5" aria-hidden="true" /></span>
              <span className="xm-buy-text"><strong>Airtime</strong><span>Top up any Ghana number</span></span>
              <ArrowRight className="xm-buy-arrow size-5" aria-hidden="true" />
            </button>
          </section>
          {spotlight}
          {/* The first-purchase welcome invitation (renders nothing unless the server says it is waiting on this account). */}
          {welcome && <div className="xm-primary-welcome">{welcome}</div>}
        </div>

        {promotion && <div className="xm-slot">{promotion}</div>}

        <section aria-labelledby="xm-more" className="xm-more">
          <h2 id="xm-more" className="xm-section-title">More from Mystery Hub</h2>
          <div className="xm-more-grid" data-xh-reveal="more">
            <button onClick={actions.website} aria-label={site.label} className={`xm-tile xm-tile-website is-${website?.state ?? 'unknown'}`} style={{ '--i': 0 } as React.CSSProperties}>
              <span className="xm-tile-art" aria-hidden="true"><WebArt /></span>
              <span className="xm-tile-text"><span className="xm-tile-title">{site.title}{site.tag && <span className="xm-tile-tag">{site.tag}</span>}</span><span className="xm-tile-desc">{site.desc}</span></span>
              <ArrowRight className="xm-tile-arrow size-4" aria-hidden="true" />
            </button>
            <button onClick={actions.earn} className="xm-tile xm-tile-earn" style={{ '--i': 1 } as React.CSSProperties}>
              <span className="xm-tile-art" aria-hidden="true"><EarnArt /></span>
              <span className="xm-tile-text"><span className="xm-tile-title">Mystery Earn</span><span className="xm-tile-desc">Share your link. Earn when friends’ purchases qualify.</span></span>
              <ArrowRight className="xm-tile-arrow size-4" aria-hidden="true" />
            </button>
            <button onClick={actions.marketplace} className="xm-tile xm-tile-market" style={{ '--i': 2 } as React.CSSProperties}>
              <span className="xm-tile-art" aria-hidden="true"><MarketArt /></span>
              <span className="xm-tile-text"><span className="xm-tile-title">Marketplace</span><span className="xm-tile-desc">Laptops and tech, by enquiry</span></span>
              <ArrowRight className="xm-tile-arrow size-4" aria-hidden="true" />
            </button>
            <button onClick={actions.afa} className="xm-tile xm-tile-afa" style={{ '--i': 3 } as React.CSSProperties}>
              <span className="xm-tile-art" aria-hidden="true"><AfaArt /></span>
              <span className="xm-tile-text"><span className="xm-tile-title">AFA Registration</span><span className="xm-tile-desc">Check availability</span></span>
              <ArrowRight className="xm-tile-arrow size-4" aria-hidden="true" />
            </button>
            <button onClick={actions.services} className="xm-tile xm-tile-services" style={{ '--i': 4 } as React.CSSProperties}>
              <span className="xm-tile-icon" aria-hidden="true"><Grid2X2 className="size-5" /></span>
              <span className="xm-tile-text"><span className="xm-tile-title">All services</span><span className="xm-tile-desc">Including what’s coming soon</span></span>
              <ArrowRight className="xm-tile-arrow size-4" aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* A preview of a feature that is not open yet: no button pretends to create a greeting. */}
        <section aria-labelledby="xm-greet-title" className="xm-greet">
          <div className="xm-greet-text">
            <p className="xm-greet-badge">Coming soon</p>
            <h2 id="xm-greet-title">Mystery Greetings</h2>
            <p>Wrap a personal {christmas ? 'Christmas' : 'New Year'} greeting as a digital gift and send the link to someone you love.</p>
            <p className="xm-greet-note"><Lock className="size-3.5" aria-hidden="true" />Not open yet. We’ll show it here when it is ready.</p>
          </div>
          <MiniEnvelope />
        </section>

        <div className="xm-lower">
          <section aria-labelledby="xm-recent" className="xm-recent">
            <div className="xm-section-head"><h2 id="xm-recent" className="xm-section-title">Recent activity</h2><button onClick={actions.orders} className="xm-text-link">View all orders</button></div>
            {loading ? <p role="status" className="xm-muted">Loading recent activity…</p>
              : error ? <p className="xm-muted">Try again above, or <button className="xm-inline-link" onClick={actions.orders}>open My Orders</button>.</p>
                : recent.length ? <ul>{recent.map(o => <li key={o.public_reference}><button onClick={() => track(o)}><span className="min-w-0"><span className="xm-recent-title">{orderTitle(o)}</span><span className="xm-recent-ref">{o.public_reference}</span></span><span className="xm-recent-end"><span className="tabular-nums">{formatGhs(o.amount)}</span><span className={`xm-recent-status is-${memberOrderTone(o)}`}>{memberOrderLabel(o)}</span></span><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" /></button></li>)}</ul>
                  : <p className="xm-muted">{latest ? 'You’re all caught up. Other recent orders will appear here.' : 'Your account activity will appear after your first purchase.'}</p>}
          </section>
          <section aria-labelledby="xm-help" className="xm-help">
            <h2 id="xm-help">Need a hand?</h2>
            <p>Ask about bundles, orders or your website. For a problem with a paid order, message support with your reference.</p>
            <div className="xm-help-actions">
              <button className="xm-help-ai" onClick={assistant}><Sparkles className="size-4" aria-hidden="true" />Ask Mystery AI</button>
              <a className="xm-help-wa" href={BUSINESS_CONFIG.contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" aria-hidden="true" />WhatsApp support</a>
            </div>
          </section>
        </div>
      </div>

      <section className="xm-signoff" aria-label="Season’s greetings">
        <div className="xm-signoff-lights" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i} />)}</div>
        <p className="xm-signoff-line">{christmas ? `Wishing you a wonderful Christmas, ${name}.` : `Wishing you a happy New Year, ${name}.`}</p>
        <p className="xm-signoff-from">With love from Mystery Hub, Ghana.</p>
      </section>
    </div>
  );
}
