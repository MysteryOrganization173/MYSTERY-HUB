import React from 'react';
import { AlertTriangle, ArrowRight, Check, MessageCircle, RefreshCw, RotateCcw, Smartphone, Sparkles, Wifi } from 'lucide-react';
import type { AuthenticatedCustomerOrderDetails } from '../../../../server/types/orders';
import type { MarketplaceProduct, NetworkId } from '../../../types';
import { GREETINGS_COMING_SOON, type GreetingsEntry, type SeasonPhase, type SeasonStatus } from '../../../../shared/seasonal';
import { formatGhs } from '../../../../shared/money';
import { BUSINESS_CONFIG } from '../../../config/business';
import { memberOrderLabel, memberOrderNext, memberOrderSelection, memberOrderSteps, memberOrderTone, memberReorder } from '../../../utils/memberHomePresentation';
import { NETWORKS, orderTitle, websiteCard, type MemberHomeViewProps } from '../../../components/home/MemberHomeView';
import { ProductPhoto } from '../../../components/marketplace/MarketplaceMedia';
import { categoryIconKey } from '../../../utils/marketplaceBrowse';
import { isChristmasTime, seasonCountdown } from '../copy';
import { AfaArt, EarnArt, MarketArt } from '../home/homeArt';
import { press, pressEnd } from '../kit/motion';
import { GreetingsPreview } from '../kit/GreetingsPreview';
import { MemberGift, MemberLights, ServicesMark, SiteFrame, type GiftLook } from './memberArt';

/**
 * The signed-in Christmas homepage: the customer's own headquarters, dressed for the season.
 *
 * It presents exactly the data and actions the ordinary member homepage receives (MemberHomeViewProps, read once for
 * this account by MemberDashboard). Order truth outranks the season: an order that needs the customer or is still
 * moving comes first on phones, a problem is never dressed in celebration, progress lights only what the server has
 * confirmed, and nothing here can start a payment. The only extra input is `market`: featured products from the public
 * Marketplace catalogue, used as pictures on the Marketplace shortcut.
 */

export type ChristmasMemberViewProps = MemberHomeViewProps & {
  status: SeasonStatus;
  /** The first-purchase welcome invitation (only for a customer without orders; the card decides eligibility). */
  welcome?: React.ReactNode;
  /** Featured public Marketplace products to picture on its shortcut; `fresh` when they arrived during this visit. */
  market?: { items: MarketplaceProduct[]; fresh: boolean };
  /** Mystery Greetings as the server reports it (useSeason().greetings): the same entry the guest homepage reads. */
  greetings?: GreetingsEntry;
  rootRef?: React.Ref<HTMLDivElement>;
};

/** One line under the name, for each day of the season. */
export const MEMBER_LINE: Record<SeasonPhase, string> = {
  before: 'Your digital world, wrapped for the season.',
  'christmas-season': 'Your digital world, wrapped for the season.',
  'christmas-day': 'Merry Christmas! Today is for the people you love.',
  'boxing-day': 'Happy Boxing Day. Rest, visit and keep in touch.',
  'year-end': 'Wrapping up the year together.',
  'new-years-eve': 'Tonight we welcome 2027 together.',
  'new-years-day': 'Happy New Year! A bright start to 2027.',
  'new-year': 'Your digital world, ready for the new year.',
  after: 'Your digital world, ready for the new year.',
};

/** The sign-off at the foot of the page, by name. */
export function memberSignoff(phase: SeasonPhase, name: string): string {
  switch (phase) {
    case 'christmas-day': return `Merry Christmas, ${name}.`;
    case 'boxing-day': return `Happy Boxing Day, ${name}.`;
    case 'new-years-eve': return `See you in 2027, ${name}.`;
    case 'new-years-day': return `Happy New Year, ${name}!`;
    case 'year-end': case 'new-year': case 'after': return `Wishing you a happy New Year, ${name}.`;
    default: return `Wishing you a wonderful Christmas, ${name}.`;
  }
}

/** When an order was placed, in the customer's own time: "Today, 10:42", "Yesterday, 18:05" or "8 Dec". */
export function orderWhen(iso: string | null | undefined, now: Date = new Date()): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(d)) / 86_400_000);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const network = (id: string | null | undefined) => NETWORKS.find(n => n.id === id);
const giftLook = (status: SeasonStatus): GiftLook => status.phase === 'christmas-day' ? 'christmas-day' : isChristmasTime(status) ? 'christmas' : 'new-year';
/** A press on the gift plays once; a tap while it is still playing is ignored rather than restarting it. */
const giftPress = (e: React.PointerEvent<HTMLElement>) => { if (!e.currentTarget.hasAttribute('data-press')) press(e); };

function OrderSpotlight({ order, track, reorder }: { order: AuthenticatedCustomerOrderDetails; track: () => void; reorder: (mode: 'data' | 'airtime', network: NetworkId) => void }) {
  const tone = memberOrderTone(order), steps = memberOrderSteps(order), again = memberReorder(order), net = network(order.network), when = orderWhen(order.created_at);
  const heading = tone === 'attention' ? 'Needs attention' : tone === 'active' ? 'Order to follow' : 'Latest order';
  return (
    <section aria-labelledby="xm-order-heading" className={`xm-order is-${tone}`}>
      <div className="xm-order-head">
        <h2 id="xm-order-heading">{tone === 'attention' && <AlertTriangle className="size-4" aria-hidden="true" />}{heading}</h2>
        <span className="xm-order-status">{tone === 'active' && <span className="xm-live-dot" aria-hidden="true" />}{tone === 'done' && <Check className="size-3.5" aria-hidden="true" />}{memberOrderLabel(order)}</span>
      </div>
      <div className="xm-order-body">
        <div className="min-w-0">
          <h3>{orderTitle(order)}</h3>
          <p className="xm-order-meta">{net && <i className="xm-net-dot" style={{ '--network': net.color } as React.CSSProperties} aria-hidden="true" />}{net && <span className="sr-only">{net.label} · </span>}{order.recipient_phone} · {order.public_reference}</p>
        </div>
        <p className="xm-order-amount">{formatGhs(order.amount)}{when && <time dateTime={order.created_at}>{when}</time>}</p>
      </div>
      {steps && <ol className="xm-steps" aria-label="Order progress">{steps.map(step => <li key={step.label} className={step.done ? 'is-done' : ''}><span aria-hidden="true" />{step.label}<span className="sr-only">{step.done ? ': complete' : ': not yet'}</span></li>)}</ol>}
      {tone !== 'done' && <p className="xm-order-next">{memberOrderNext(order)}</p>}
      <div className="xm-order-actions">
        {again && <button className="mh-button" onClick={() => reorder(again.mode, again.network)}><RotateCcw className="size-4" aria-hidden="true" />Buy again</button>}
        <button className={again || tone === 'attention' ? 'mh-button-secondary' : 'mh-button'} onClick={track}>Track Order</button>
        {tone === 'attention' && <a className="xm-support" href={BUSINESS_CONFIG.contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" aria-hidden="true" />WhatsApp support</a>}
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

const SITE_ACTION = { none: 'Start building', draft: 'Continue editing', published: 'Manage website', unknown: 'Open Website Builder' } as const;

export function ChristmasMemberView({ name, greeting, orders, loading, error, wallet, retry, track, actions, assistant, website, promotion, status, welcome, market, greetings = GREETINGS_COMING_SOON, rootRef }: ChristmasMemberViewProps) {
  const christmas = isChristmasTime(status);
  const { big, small } = seasonCountdown(status);
  const { latest, recent, prioritizesActive } = memberOrderSelection(orders);
  const tone = !loading && !error && latest ? memberOrderTone(latest) : null;
  // A purchase that needs the customer, or is still moving, comes before new buying (exactly as the ordinary view).
  const urgent = tone === 'attention' || tone === 'active';
  const subline = tone === 'attention' ? 'One of your orders needs attention.' : tone === 'active' ? (prioritizesActive ? 'You have an order in progress.' : 'Your latest order is in progress.') : !loading && !error && !latest ? 'Welcome to Mystery Hub. Let’s get you connected.' : 'What would you like to do today?';
  const reorder = (mode: 'data' | 'airtime', network: NetworkId) => mode === 'airtime' ? actions.airtime(network) : actions.data(network);
  const site = websiteCard(website), siteState = website?.state ?? 'unknown';
  const firstPurchase = !loading && !error && !latest;
  const photos = market?.items || [];
  const spotlight = loading
    ? <section aria-label="Latest order" className="xm-order is-loading"><p role="status">Loading your orders…</p><span className="xm-skeleton" aria-hidden="true" /><span className="xm-skeleton is-short" aria-hidden="true" /></section>
    : error
      ? <section aria-label="Latest order" className="xm-order is-error"><p role="alert" className="xm-order-error"><RefreshCw className="size-4" aria-hidden="true" />Your orders are unavailable right now.</p><div className="xm-order-actions"><button className="mh-button-secondary" onClick={retry}>Try again</button><button className="xm-text-link" onClick={actions.orders}>Open My Orders<ArrowRight className="size-4" aria-hidden="true" /></button></div></section>
      : latest
        ? <OrderSpotlight order={latest} track={() => track(latest)} reorder={reorder} />
        : <FirstPurchase data={actions.data} airtime={() => actions.airtime()} />;

  return (
    <div ref={rootRef} className="xm-home" data-phase={status.phase}>
      <div className="xm-inner">
        <div className={`xm-dash${urgent ? ' is-urgent' : ''}`}>
          {/* Welcome: the customer's own name, the real time of day and the real state of their orders. */}
          <header aria-label="Your account overview" className="xm-welcome" data-xh-reveal="welcome">
            <MemberLights newYear={!christmas} />
            <div className="xm-welcome-text">
              <p className="xm-welcome-kicker"><span lang="ak">Afehyia pa</span>{' '}<span>{greeting},</span></p>
              <h1 className="xm-welcome-name">{name}</h1>
              <p className="xm-welcome-sub">{subline}</p>
              {/* When an order needs the customer, that sentence is the last word here: no seasonal line after it. */}
              {tone !== 'attention' && <p className="xm-welcome-season">{MEMBER_LINE[status.phase]}</p>}
            </div>
            <div className="xm-welcome-gift">
              <span className="xm-gift" onPointerDown={giftPress} onAnimationEnd={pressEnd} aria-hidden="true">
                <MemberGift look={giftLook(status)} />
                <span className="xm-gift-tag">For {name}</span>
              </span>
              <p className="xm-daycount"><b>{big}</b> {small}</p>
            </div>
          </header>

          {/* The Wallet and the two everyday purchases, as one deck. */}
          <div className="xm-deck">
            <div className="xm-wallet-slot">{wallet}</div>
            <section aria-label="Buy now" className="xm-buy" data-xh-reveal="buy">
              <button className="xm-buy-tile is-data" onClick={() => actions.data()} onPointerDown={press} onAnimationEnd={pressEnd}>
                <span className="xm-buy-sheen" aria-hidden="true" />
                <span className="xm-buy-icon"><Wifi className="size-5" aria-hidden="true" /></span>
                <span className="xm-buy-text"><strong>Buy Data</strong><span>MTN, Telecel & AirtelTigo</span></span>
                <ArrowRight className="xm-buy-arrow size-5" aria-hidden="true" />
              </button>
              <button className="xm-buy-tile is-airtime" onClick={() => actions.airtime()} onPointerDown={press} onAnimationEnd={pressEnd}>
                <span className="xm-buy-icon"><Smartphone className="size-5" aria-hidden="true" /></span>
                <span className="xm-buy-text"><strong>Airtime</strong><span>Top up any Ghana number</span></span>
                <ArrowRight className="xm-buy-arrow size-5" aria-hidden="true" />
              </button>
            </section>
          </div>

          <div className="xm-spot">{spotlight}</div>

          {/* Beside the order: the other recent orders on a receipt, or the first-purchase invitation for a new account. */}
          <div className="xm-side">
            {firstPurchase
              ? welcome
              : <section aria-labelledby="xm-recent" className="xm-recent">
                  <div className="xm-receipt">
                    <div className="xm-section-head"><h2 id="xm-recent">Recent activity</h2><button onClick={actions.orders} className="xm-receipt-link">View all orders</button></div>
                    {loading ? <p role="status" className="xm-receipt-muted">Loading recent activity…</p>
                      : error ? <p className="xm-receipt-muted">Try again above, or <button className="xm-inline-link" onClick={actions.orders}>open My Orders</button>.</p>
                        : recent.length ? <ul>{recent.map(o => { const net = network(o.network), when = orderWhen(o.created_at); return (
                            <li key={o.public_reference}><button onClick={() => track(o)}>
                              <span className="xm-rc-dot" style={net ? { '--network': net.color } as React.CSSProperties : undefined} aria-hidden="true" />
                              <span className="xm-rc-main"><span className="xm-rc-title">{orderTitle(o)}</span><span className="xm-rc-ref">{o.public_reference}{when && <> · <time dateTime={o.created_at}>{when}</time></>}</span></span>
                              <span className="xm-rc-end"><span className="xm-rc-amount">{formatGhs(o.amount)}</span><span className={`xm-rc-status is-${memberOrderTone(o)}`}>{memberOrderLabel(o)}</span></span>
                            </button></li>); })}</ul>
                          : <p className="xm-receipt-muted">You’re all caught up. Other recent orders will appear here.</p>}
                  </div>
                </section>}
          </div>
        </div>

        {promotion && <div className="xm-slot">{promotion}</div>}

        <section aria-labelledby="xm-more" className="xm-more">
          <h2 id="xm-more" className="xm-section-title">More from Mystery Hub</h2>
          <div className="xm-more-grid" data-xh-reveal="more">
            <button onClick={actions.website} onPointerDown={press} onAnimationEnd={pressEnd} aria-label={site.label} className={`xm-tile xm-tile-website is-${siteState}`} style={{ '--i': 0 } as React.CSSProperties}>
              <span className="xm-tile-art" aria-hidden="true"><SiteFrame state={siteState} /></span>
              <span className="xm-tile-text">
                <span className="xm-tile-title">{site.title}{site.tag && <span className="xm-tile-tag">{site.tag}</span>}</span>
                <span className="xm-tile-desc">{site.desc}</span>
                {website?.state === 'published' && <span className="xm-site-address">/sites/{website.slug}</span>}
                <span className="xm-tile-action">{SITE_ACTION[siteState]}<ArrowRight className="size-4" aria-hidden="true" /></span>
              </span>
            </button>
            <button onClick={actions.earn} onPointerDown={press} onAnimationEnd={pressEnd} className="xm-tile xm-tile-earn" style={{ '--i': 1 } as React.CSSProperties}>
              <span className="xm-tile-art" aria-hidden="true"><EarnArt /></span>
              <span className="xm-tile-text"><span className="xm-tile-title">Mystery Earn</span><span className="xm-tile-desc">Share your link. Earn when friends’ purchases qualify.</span></span>
              <ArrowRight className="xm-tile-arrow size-4" aria-hidden="true" />
            </button>
            <button onClick={actions.marketplace} onPointerDown={press} onAnimationEnd={pressEnd} className="xm-tile xm-tile-market" style={{ '--i': 2 } as React.CSSProperties}>
              <span className={`xm-tile-art${photos.length ? ' has-photos' : ''}`} aria-hidden="true">
                {photos.length
                  ? <span className={`xm-photos${market?.fresh ? ' is-fresh' : ''}`}>{photos.map((p, i) => <span key={p.id} className="xm-photo" style={{ '--i': i } as React.CSSProperties}><ProductPhoto src={p.imageUrl} alt="" iconKey={categoryIconKey(p.category, p.categoryLabel)} framing={p.imageFraming} widths={[160, 240]} sizes="72px" /></span>)}</span>
                  : <MarketArt />}
              </span>
              <span className="xm-tile-text"><span className="xm-tile-title">Marketplace</span><span className="xm-tile-desc">Laptops and tech, by enquiry</span></span>
              <ArrowRight className="xm-tile-arrow size-4" aria-hidden="true" />
            </button>
            <button onClick={actions.afa} onPointerDown={press} onAnimationEnd={pressEnd} className="xm-tile xm-tile-afa" style={{ '--i': 3 } as React.CSSProperties}>
              <span className="xm-tile-art" aria-hidden="true"><AfaArt /></span>
              <span className="xm-tile-text"><span className="xm-tile-title">AFA Registration</span><span className="xm-tile-desc">Check availability</span></span>
              <ArrowRight className="xm-tile-arrow size-4" aria-hidden="true" />
            </button>
            <button onClick={actions.services} onPointerDown={press} onAnimationEnd={pressEnd} className="xm-tile xm-tile-services" style={{ '--i': 4 } as React.CSSProperties}>
              <span className="xm-tile-art" aria-hidden="true"><ServicesMark /></span>
              <span className="xm-tile-text"><span className="xm-tile-title">All services</span><span className="xm-tile-desc">Including what’s coming soon</span></span>
              <ArrowRight className="xm-tile-arrow size-4" aria-hidden="true" />
            </button>
          </div>
        </section>

        <div className="xm-lower">
          <section aria-labelledby="xm-help" className="xm-help">
            <div className="xm-help-text">
              <h2 id="xm-help">Need a hand?</h2>
              <p>Ask about bundles, orders or your website. For a problem with a paid order, message support with your reference.</p>
            </div>
            <div className="xm-help-actions">
              <button className="xm-help-ai" onClick={assistant}><Sparkles className="size-4" aria-hidden="true" />Ask Mystery AI</button>
              <a className="xm-help-wa" href={BUSINESS_CONFIG.contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" aria-hidden="true" />WhatsApp support</a>
            </div>
          </section>
          <GreetingsPreview newYear={!christmas} headingId="xm-greet-title" entry={greetings} />
        </div>
      </div>

      <section className="xm-signoff" aria-label="Season’s greetings">
        <div className="xm-signoff-lights" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i} />)}</div>
        <p className="xm-signoff-line">{memberSignoff(status.phase, name)}</p>
        <p className="xm-signoff-from">With love from Mystery Hub, Ghana.</p>
      </section>
    </div>
  );
}
