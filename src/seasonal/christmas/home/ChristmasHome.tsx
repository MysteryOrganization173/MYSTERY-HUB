import React, { useEffect, useRef, useState } from 'react';
import './christmasHome.css';
import '../kit/kit.css';
import { ArrowRight, ArrowUpRight, Check, FileQuestion, Lock, MessageCircle, PackageSearch, ReceiptText, ShieldCheck, ShoppingBag, Zap } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { BUSINESS_CONFIG } from '../../../config/business';
import type { GreetingsEntry, SeasonPhase, SeasonStatus } from '../../../../shared/seasonal';
import { useSeason } from '../../SeasonProvider';
import { isChristmasTime, seasonCountdown } from '../copy';
import { loadSeasonalSerif } from '../font';
import { HeroScene } from './heroArt';
import { AfaArt, AirtimeArt, Bow, DataArt, EarnArt, EnvelopeBack, EnvelopeFront, FlapInside, FlapOutside, HangingTag, MarketArt, ParcelStack, Peg, TwineBow, WebArt } from './homeArt';
import { markSeen, prefersReducedMotion, press, pressEnd, seenThisVisit, swing, useMedia, useReveal } from '../kit/motion';
import { WelcomeCard } from '../kit/WelcomeCard';
// Real business logic, shared with the ordinary homepage: catalogue, offers, checkout, templates, Marketplace, FAQs.
import { directCampaign, directCatalogConfirmed, useDirectCatalog } from '../../../hooks/useDirectCatalog';
import { useWelcomeOffer } from '../../../hooks/useWelcomeOffer';
import { CompactBundleRow } from '../../../components/data/CompactBundleRow';
import { GHANA_NETWORKS } from '../../../data/bundles';
import type { MarketplaceProduct, NetworkId } from '../../../types';
import { getInstantBundlesOnServer, getPublicMarketplaceProducts } from '../../../services/apiClient';
import { InstallAppPromo } from '../../../components/pwa/InstallAppPromo';
import { BrandMark } from '../../../components/common/BrandLogo';
import { orderedWebsiteTemplates, isReadyDesign } from '../../../data/templates';
import { TemplateCardPreview } from '../../../components/website/TemplateCardPreview';
import { marketplaceControlRequest, type ManagedCategory } from '../../../services/marketplaceControls';
import { ProductPhoto } from '../../../components/marketplace/MarketplaceMedia';
import { PATH_LABELS, categoryIconKey, marketplaceHref, openMarketplaceAt, productPath, productPriceText } from '../../../utils/marketplaceBrowse';
import { creativeWorkById } from '../../../data/creativeStudioWork';
import { getCloudinaryUrl } from '../../../utils/cloudinary';
import { DIGITAL_SERVICES } from '../../../data/services';
import { openServicesAt, serviceSlug, servicesHref } from '../../../utils/serviceDirectory';
import { FaqAccordion } from '../../../components/common/FaqAccordion';
import { HOME_FAQS } from '../../../data/helpFaqs';

/**
 * The Christmas homepage for signed-out visitors: "The Gift of Connection — Christmas After Dark".
 *
 * Shown only while a season is on (see SeasonalHome); the ordinary homepage is untouched and returns the moment the
 * season ends. Every section keeps the ordinary homepage's facts and actions (live bundles and prices, checkout,
 * template previews, Marketplace items, planned services, FAQs) and changes only how they are composed.
 *
 * Motion follows the kit's rules (kit/motion.ts): one owner per moving element, entrances once per visit, nothing
 * ever left hidden.
 */

const plain = (e: React.MouseEvent) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

/** Words that change with the calendar. Greetings only: no offers, prices or promises. */
function heroWords(phase: SeasonPhase): { kicker: string; greeting: string } {
  switch (phase) {
    case 'christmas-day': return { kicker: '25 December · Christmas Day', greeting: 'Merry Christmas, Ghana!' };
    case 'boxing-day': return { kicker: '26 December · Boxing Day', greeting: 'Happy Boxing Day, Ghana.' };
    case 'year-end': return { kicker: 'Season’s greetings', greeting: 'Season’s greetings, Ghana.' };
    case 'new-years-eve': return { kicker: '31 December · New Year’s Eve', greeting: 'Happy New Year’s Eve, Ghana.' };
    case 'new-years-day': return { kicker: '1 January · New Year’s Day', greeting: 'Happy New Year, Ghana!' };
    case 'new-year': return { kicker: 'Season’s greetings', greeting: 'Happy New Year, Ghana.' };
    default: return { kicker: 'Season’s greetings', greeting: 'Merry Christmas, Ghana.' };
  }
}

/** Marks an element while it is on screen, so its few idle loops (desktop only, see CSS) stop once it scrolls away. */
function useOnScreen(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) el.setAttribute('data-xh-visible', ''); else el.removeAttribute('data-xh-visible'); });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero({ status }: { status: SeasonStatus }) {
  const { setActivePage } = useApp();
  const ref = useRef<HTMLElement>(null);
  useOnScreen(ref);
  // Phones get the compact composition (smaller gift, services gathered close), so the greeting, the explanation
  // and both actions sit in the first screen with the scene.
  const compact = useMedia('(max-width: 599px)');
  // The entrance plays once per visit: once it has played, coming back to the homepage shows the scene settled.
  const [settled] = useState(() => seenThisVisit('hero') || prefersReducedMotion());
  useEffect(() => {
    if (settled) return;
    const timer = window.setTimeout(() => markSeen('hero'), 2800);
    return () => window.clearTimeout(timer);
  }, [settled]);
  const words = heroWords(status.phase);
  const { big, small } = seasonCountdown(status);
  const go = (page: 'website' | 'data') => (e: React.MouseEvent) => { if (!plain(e)) return; e.preventDefault(); setActivePage(page); };
  return (
    <section ref={ref} className="xh-hero" data-phase={status.phase} data-xh-settled={settled ? '' : undefined} aria-labelledby="xh-hero-title">
      <div className="xh-hero-atmos" aria-hidden="true" />
      <div className="xh-wrap xh-hero-grid">
        <div className="xh-hero-greet">
          <p className="xh-hero-kicker"><span lang="ak">Afehyia pa</span><i aria-hidden="true" />{words.kicker}</p>
          <p className="xh-hero-greeting">{words.greeting}</p>
        </div>
        <div className="xh-hero-stage">
          <HeroScene phase={status.phase} countBig={big} countSmall={small} layout={compact ? 'compact' : 'wide'} />
          <p className="sr-only">{big} {small}.</p>
        </div>
        <div className="xh-hero-main">
          <h1 id="xh-hero-title" className="xh-hero-title">Everything digital.<br /><span>One trusted place.</span></h1>
          <p className="xh-hero-lede">Buy data and airtime, build a free website for your business, and follow every order from payment to delivery.</p>
          <div className="xh-hero-actions">
            <a href="/website-builder" onClick={go('website')} className="mh-button xh-btn-primary">Create a Free Website<ArrowRight className="w-4 h-4" aria-hidden /></a>
            <a href="/data" onClick={go('data')} className="mh-button-secondary xh-btn-quiet">Buy Data</a>
          </div>
          <ul className="xh-hero-live" aria-label="Available now">
            {['Data & airtime', 'Free business website', 'Order tracking'].map(item => <li key={item}><Check className="w-3.5 h-3.5" aria-hidden="true" />{item}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Services, gift-wrapped ───────────────────────── */

type Wrap = 'pine' | 'berry' | 'cream' | 'gold' | 'midnight' | 'kraft';
/** How each gift is tied. Deliberately different: a ribbon only where it reads as packaging, never as a sticker. */
type Tie = 'satin-gold' | 'satin-ivory' | 'tag' | 'none' | 'pinstripe' | 'twine';
interface GiftService { id: string; title: string; desc: string; tag: string; tone: 'live' | 'free' | 'neutral'; wrap: Wrap; tie: Tie; art: React.ReactNode; action: () => void }

function Tied({ tie }: { tie: Tie }) {
  switch (tie) {
    case 'satin-gold': return <><span className="xh-band is-gold" aria-hidden="true" /><span className="xh-gift-bow" aria-hidden="true"><Bow tone="gold" /></span></>;
    case 'satin-ivory': return <span className="xh-band is-ivory" aria-hidden="true"><span className="xh-band-knot" /></span>;
    case 'tag': return <span className="xh-gift-hang" aria-hidden="true"><HangingTag /></span>;
    case 'pinstripe': return <span className="xh-pinstripe" aria-hidden="true" />;
    case 'twine': return <><span className="xh-twine" aria-hidden="true" /><span className="xh-gift-twinebow" aria-hidden="true"><TwineBow /></span></>;
    default: return null;
  }
}

function Services({ christmas }: { christmas: boolean }) {
  const { setActivePage, openDataPage } = useApp();
  // The same six destinations, labels and availability as the ordinary homepage (QuickServicesBar).
  const services: GiftService[] = [
    { id: 'data', title: 'Data Bundles', desc: 'MTN, Telecel & AirtelTigo', tag: 'Available', tone: 'live', wrap: 'pine', tie: 'satin-gold', art: <DataArt />, action: () => openDataPage('data') },
    { id: 'airtime', title: 'Airtime Top-Up', desc: 'Top up any Ghana number', tag: 'Available', tone: 'live', wrap: 'berry', tie: 'satin-ivory', art: <AirtimeArt />, action: () => openDataPage('airtime') },
    { id: 'website', title: 'Website Builder', desc: 'A website for your business', tag: 'Free plan', tone: 'free', wrap: 'cream', tie: 'tag', art: <WebArt />, action: () => setActivePage('website') },
    { id: 'earn', title: 'Mystery Earn', desc: 'Refer friends & earn', tag: 'Available', tone: 'live', wrap: 'gold', tie: 'none', art: <EarnArt />, action: () => setActivePage('earn') },
    { id: 'afa', title: 'AFA Registration', desc: 'MTN AFA bundles', tag: 'Check Status', tone: 'neutral', wrap: 'midnight', tie: 'pinstripe', art: <AfaArt />, action: () => setActivePage('afa') },
    { id: 'marketplace', title: 'Marketplace', desc: 'Tech, by enquiry', tag: 'Enquiry', tone: 'neutral', wrap: 'kraft', tie: 'twine', art: <MarketArt />, action: () => setActivePage('marketplace') },
  ];
  return (
    <section className="xh-sec xh-services" aria-labelledby="xh-services-title">
      <div className="xh-wrap">
        <div className="xh-head">
          <div>
            <p className="xh-kicker">Everything, wrapped in one place</p>
            <h2 id="xh-services-title">What would you like to do <em>{christmas ? 'this Christmas' : 'this season'}</em>?</h2>
          </div>
          <button type="button" onClick={() => setActivePage('services')} className="xh-link">All Services<ArrowRight className="w-4 h-4" aria-hidden /></button>
        </div>
        <ul className="xh-gifts" data-xh-reveal="gifts">
          {services.map((s, i) => (
            <li key={s.id} style={{ '--i': i } as React.CSSProperties}>
              <button type="button" className={`xh-gift xh-wrap-${s.wrap} xh-gift-${s.id} xh-tie-${s.tie}`} onClick={s.action} onPointerDown={press} onKeyDown={press} onAnimationEnd={pressEnd}>
                <span className="xh-gift-paper" aria-hidden="true" />
                <Tied tie={s.tie} />
                <span className="xh-gift-art" aria-hidden="true">{s.art}</span>
                <span className="xh-gift-text">
                  <span className="xh-gift-title">{s.title}</span>
                  <span className="xh-gift-desc">{s.desc}</span>
                  <span className={`xh-gift-tag xh-tag-${s.tone}`}>{s.tag}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ───────────────────────── Featured data: the velvet tray, the welcome invitation and the receipt ───────────────────────── */

const NETWORKS: { id: NetworkId; label: string }[] = [{ id: 'mtn', label: 'MTN' }, { id: 'airteltigo', label: 'AirtelTigo' }, { id: 'telecel', label: 'Telecel' }];
// The same buying facts as the ordinary homepage: no delivery promise, timing depends on the network.
const STEPS = [
  { icon: ReceiptText, title: 'Check the total and number', desc: 'Checkout shows the bundle price, any fee and the recipient before you pay.' },
  { icon: ShieldCheck, title: 'Pay with MoMo through Paystack', desc: 'Payments are handled by Paystack. Never share your MoMo PIN with anyone, including support.' },
  { icon: PackageSearch, title: 'Track your order', desc: 'Follow it from confirmed payment to delivery. Timing depends on the network.' },
];

function FeaturedData() {
  const bundles = useDirectCatalog();
  const welcomeOffer = useWelcomeOffer(bundles);
  const { openCheckout, openDataPage, setActivePage, openAuth } = useApp();
  const [network, setNetwork] = useState<NetworkId>('mtn');
  const [instantAvailable, setInstantAvailable] = useState(false);
  useEffect(() => {
    let on = true;
    getInstantBundlesOnServer().then(res => { if (on && res.success && res.available && res.products.length > 0) setInstantAvailable(true); }).catch(() => undefined);
    return () => { on = false; };
  }, []);
  const popular = bundles.filter(b => b.network === network && b.isPopular).slice(0, 4);
  const index = NETWORKS.findIndex(n => n.id === network);
  // Only while the server applies a campaign: its name and the largest saving it actually gives (never typed in).
  const campaign = directCampaign();
  return (
    <section className="xh-sec xh-data" aria-labelledby="xh-data-title">
      <div className="xh-wrap">
        <div className="xh-head">
          <div>
            <p className="xh-kicker">{campaign ? <>{campaign.title}{campaign.maxSavingPercent ? <> · Up to {campaign.maxSavingPercent}% off selected digital services</> : null}</> : 'Data bundles'}</p>
            <h2 id="xh-data-title">Stay close <em>all season</em></h2>
            <p className="xh-head-lede">Pick a bundle. You confirm the recipient number and total before you pay.</p>
          </div>
        </div>
        <div className="xh-data-layout">
          <div className="xh-data-welcome">
            <WelcomeCard offer={welcomeOffer} bundles={bundles} catalogConfirmed={directCatalogConfirmed()} onCreateAccount={() => openAuth('signup')} headingId="xh-welcome-title" />
          </div>
          <div className="xh-tray">
            <div className="xh-net" role="group" aria-label="Choose network" style={{ '--xh-i': index, '--net': GHANA_NETWORKS[network].brandColor } as React.CSSProperties}>
              <span className="xh-net-ribbon" aria-hidden="true" />
              {NETWORKS.map(({ id, label }) => (
                <button key={id} type="button" aria-pressed={network === id} onClick={() => setNetwork(id)} style={{ '--network-color': GHANA_NETWORKS[id].brandColor } as React.CSSProperties}>
                  <span className="xh-net-dot" style={{ backgroundColor: GHANA_NETWORKS[id].brandColor }} aria-hidden="true" />{label}
                </button>
              ))}
            </div>
            <div className="xh-bundles" key={network}>
              {popular.map(b => <CompactBundleRow key={b.id} bundle={b} directWelcomeOffer={welcomeOffer} onBuy={bundle => openCheckout(bundle)} />)}
              {popular.length === 0 && <p className="xh-empty" role="status">No popular bundles to show for this network. Browse all bundles to check availability.</p>}
            </div>
            <div className="xh-tray-foot">
              <button type="button" onClick={() => openDataPage('data', network)} className="xh-link">View all {GHANA_NETWORKS[network].name} bundles<ArrowRight className="w-4 h-4" aria-hidden /></button>
              {instantAvailable && <button type="button" onClick={() => openDataPage('instant')} className="xh-instant"><Zap className="w-3.5 h-3.5" aria-hidden="true" />Browse Instant Bundles</button>}
            </div>
          </div>
          <aside className="xh-receipt" aria-labelledby="xh-receipt-title">
            <p className="xh-receipt-brand" aria-hidden="true">Mystery Hub · receipt</p>
            <h3 id="xh-receipt-title">How buying works</h3>
            <ol>
              {STEPS.map(({ icon: Icon, title, desc }, i) => (
                <li key={title}><span className="xh-receipt-n" aria-hidden="true">{i + 1}</span><div><strong><Icon className="w-4 h-4" aria-hidden="true" />{title}</strong><p>{desc}</p></div></li>
              ))}
            </ol>
            <button type="button" onClick={() => setActivePage('orders')} className="xh-receipt-link">Track an existing order<ArrowRight className="w-4 h-4" aria-hidden /></button>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Mystery Greetings: a preview, not a product yet ───────────────────────── */

/**
 * Mystery Greetings is being built separately (creation, links and the recipient screen). Until it is live this
 * section only previews it and offers no button that pretends to create one. `createHref` is the integration point:
 * pass the real creator route once it exists and the call to action appears.
 *
 * The sample envelope is a real toggle with two states, closed and open. It opens by itself once, the first time it
 * comes into view this visit; after that a tap (or Enter/Space) opens or closes it. CSS transitions carry it between
 * the states, so a quick second tap reverses the movement from where it is instead of restarting it, and the letter
 * is clipped at the envelope's bottom edge, so it can never appear below it.
 */
/**
 * Mystery Greetings on the guest homepage: its own interactive sample envelope, with the same entry the member homepage
 * reads (the server's answer). Not open: "Coming soon" and no create action. Open: one link to the shared creator.
 */
function Greetings({ christmas, entry }: { christmas: boolean; entry: GreetingsEntry }) {
  const createHref = entry.state === 'open' ? entry.createHref : null;
  const shareText = `${christmas ? 'Merry Christmas!' : 'Happy New Year!'} I use Mystery Hub for data, airtime and more. Have a look:`;
  const share = `https://wa.me/?text=${encodeURIComponent(`${shareText} https://${BUSINESS_CONFIG.domain}/`)}`;
  const envelope = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(() => seenThisVisit('envelope') || prefersReducedMotion());
  const autoOpened = useRef(open);
  useEffect(() => {
    const el = envelope.current;
    if (autoOpened.current || !el) return;
    if (typeof IntersectionObserver === 'undefined') { autoOpened.current = true; setOpen(true); return; }
    let timer = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect(); autoOpened.current = true;
      timer = window.setTimeout(() => { setOpen(true); markSeen('envelope'); }, 450);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); window.clearTimeout(timer); };
  }, []);
  const toggle = () => { autoOpened.current = true; markSeen('envelope'); setOpen(value => !value); };
  return (
    <section className="xh-sec xh-greet" aria-labelledby="xh-greet-title">
      <div className="xh-wrap xh-greet-grid">
        <div className="xh-greet-copy">
          <p className="xh-kicker xh-kicker-soft">{!createHref && <span className="xh-soon-badge">Coming soon</span>}Mystery Greetings</p>
          <h2 id="xh-greet-title">A {christmas ? 'Christmas' : 'New Year'} surprise, <em>wrapped by you.</em></h2>
          <p>Write a personal greeting, wrap it as a digital gift and send the link to someone you love. They tap to open it and read your words.</p>
          {!createHref && <p className="xh-greet-note"><Lock className="w-4 h-4" aria-hidden="true" />Not open yet. We’ll show it here when it is ready.</p>}
          <div className="xh-greet-actions">
            {createHref && <a className="mh-button xh-btn-primary" href={createHref}>Create a greeting<ArrowRight className="w-4 h-4" aria-hidden /></a>}
            <a className="xh-link" href={share} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-4 h-4" aria-hidden />Share the Mystery Hub website on WhatsApp<span className="sr-only"> (opens WhatsApp)</span></a>
          </div>
        </div>
        <div className="xh-env-wrap">
          <button ref={envelope} type="button" className="xh-env" data-state={open ? 'open' : 'closed'} aria-pressed={open} onClick={toggle}
            aria-label={open ? 'Sample greeting card: tuck it back into the envelope' : 'Sample greeting card: open the envelope'}>
            <EnvelopeBack />
            <span className="xh-env-letterbox" aria-hidden="true">
              <span className="xh-letter">
                <span className="xh-letter-sample">Sample greeting</span>
                <span className="xh-letter-to">Dear Ama,</span>
                <span className="xh-letter-body">{christmas ? 'Merry Christmas! Wishing you joy, rest and good company this season.' : 'Happy New Year! Wishing you joy and good things all year.'}</span>
                <span className="xh-letter-from">— Kojo</span>
              </span>
            </span>
            <EnvelopeFront />
            <span className="xh-env-flap" aria-hidden="true"><FlapOutside /><FlapInside /></span>
          </button>
          <p className="xh-env-hint" aria-hidden="true">{open ? 'Tap to tuck it back in' : 'Tap to open'}</p>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Install (only where installing works) ───────────────────────── */

function Install({ status }: { status: SeasonStatus }) {
  const day = new Date(status.date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const christmas = isChristmasTime(status);
  return (
    <section className="xh-install" aria-label="Mystery Hub app">
      <div className="xh-wrap">
        <div className="xh-install-card">
          <div className="xh-phone" aria-hidden="true">
            <div className="xh-phone-screen">
              <p className="xh-phone-time">{day}</p>
              <p className="xh-phone-greet">{christmas ? 'Merry Christmas' : 'Happy New Year'}</p>
              <div className="xh-phone-apps">{Array.from({ length: 5 }, (_, i) => <i key={i} />)}<b><BrandMark size="sm" ariaHidden /></b></div>
            </div>
          </div>
          <div className="xh-install-body"><InstallAppPromo /></div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Website Builder ───────────────────────── */

function Website() {
  const { setActivePage, openTemplatePreview } = useApp();
  // Real templates and the real renderer, never a fabricated screenshot.
  const designs = orderedWebsiteTemplates().filter(isReadyDesign);
  const first = designs.find(t => t.id === 'tmpl-data-reseller') || designs[0];
  const choices = first ? [first, ...designs.filter(t => t.id !== first.id).slice(0, 4)] : [];
  const [selectedId, setSelectedId] = useState(first?.id);
  const selected = choices.find(t => t.id === selectedId) || first;
  const name = (t: typeof first) => t ? (t.demoBusinessName || t.title) : '';
  return (
    <section className="xh-sec xh-web" aria-labelledby="xh-web-title">
      <div className="xh-wrap xh-web-grid">
        <div className="xh-web-copy">
          <p className="xh-kicker">Website Builder · Free plan</p>
          <h2 id="xh-web-title">Your business deserves <em>a place online.</em></h2>
          <p>Pick one of {designs.length} ready-made designs, add your business details and photos, then publish. No coding needed.</p>
          <ol className="xh-steps"><li><span>1</span>Choose your design</li><li><span>2</span>Add your details</li><li><span>3</span>Publish for free</li></ol>
          <div className="xh-web-actions">
            <a href="/website-builder" onClick={e => { if (!plain(e)) return; e.preventDefault(); setActivePage('website'); }} className="mh-button xh-btn-primary">Browse Templates<ArrowRight className="w-4 h-4" aria-hidden /></a>
            <p className="xh-note"><Check className="w-4 h-4" aria-hidden />Works on phones, tablets and desktop</p>
          </div>
          {choices.length > 1 && (
            <div className="xh-chips">
              <p id="xh-chips-title">Try a design here</p>
              <ul aria-labelledby="xh-chips-title">{choices.map(t => (
                <li key={t.id}><button type="button" aria-pressed={t.id === selected?.id} onClick={() => setSelectedId(t.id)}>{t.id === selected?.id && <Check className="w-3.5 h-3.5" aria-hidden />}{name(t)}</button></li>
              ))}</ul>
            </div>
          )}
        </div>
        {selected && (
          <div className="xh-browser" data-xh-reveal="browser">
            <div className="xh-browser-bar" aria-hidden="true"><i /><i /><i /><span className="xh-browser-url"><Lock className="w-3 h-3" />Design preview · {name(selected)}</span></div>
            <div className="xh-browser-body"><TemplateCardPreview key={selected.id} template={selected} onPreview={() => openTemplatePreview(selected)} /></div>
            <p className="xh-browser-note">Sample design and content. Your website uses your own business details.</p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── Marketplace ───────────────────────── */

const CATEGORIES = [
  { slug: 'laptops_computers', title: 'Laptops & Workstations', desc: 'Tools for study and work' },
  { slug: 'creator_tools', title: 'Creator & Media Tools', desc: 'Audio, video and creative gear' },
  { slug: 'ai_productivity', title: 'AI & Productivity Tools', desc: 'Software for everyday tasks' },
  { slug: 'business_essentials', title: 'Business Hardware', desc: 'Retail and POS equipment' },
];

function Marketplace({ christmas }: { christmas: boolean }) {
  const { setActivePage, openMarketplaceInquiry } = useApp();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [active, setActive] = useState<ManagedCategory[] | null>(null);
  useEffect(() => { let on = true; marketplaceControlRequest('categories').then(d => { if (on) setActive(d.categories || []); }).catch(() => undefined); return () => { on = false; }; }, []);
  useEffect(() => {
    let on = true;
    getPublicMarketplaceProducts({ featured: true }).then(res => { if (on && res.success) setProducts((res.products || []).slice(0, 4)); }).catch(() => undefined);
    return () => { on = false; };
  }, []);
  // Retired categories are hidden, exactly as on the ordinary homepage; if the list cannot load, all stay.
  const shortcuts = active ? CATEGORIES.filter(c => active.some(a => a.slug === c.slug && a.active !== false)) : CATEGORIES;
  const go = (e: React.MouseEvent, params: { category?: string; product?: string }) => { if (!plain(e)) return; e.preventDefault(); openMarketplaceAt(setActivePage, params); };
  return (
    <section className="xh-sec xh-market" aria-labelledby="xh-market-title">
      <div className="xh-wrap">
        <div className="xh-market-head">
          <p className="xh-kicker">Tech & digital Marketplace</p>
          <h2 id="xh-market-title">Find your next <em>work companion.</em></h2>
          <div className="xh-market-art" data-xh-reveal="parcels" onPointerDown={press} onAnimationEnd={pressEnd} aria-hidden="true"><ParcelStack label={christmas ? 'Merry Christmas' : 'Happy New Year'} /></div>
          <p className="xh-market-text">Browse technology and digital tools. Buy online where an item says so, or send an enquiry to confirm price, availability and delivery.</p>
          <a href="/marketplace" onClick={e => { if (!plain(e)) return; e.preventDefault(); setActivePage('marketplace'); }} className="mh-button-secondary xh-btn-quiet xh-market-cta">Browse Marketplace<ArrowRight className="w-4 h-4" aria-hidden /></a>
        </div>
        {shortcuts.length > 0 && (
          <ul className="xh-tags" aria-label="Marketplace categories">
            {shortcuts.map(c => <li key={c.slug}><a href={marketplaceHref({ category: c.slug })} onClick={e => go(e, { category: c.slug })}><i aria-hidden="true" /><strong>{c.title}</strong><span>{c.desc}</span></a></li>)}
          </ul>
        )}
        {products.length > 0 && (
          <div className="xh-products">{products.map(p => (
            <article key={p.id} className="xh-product">
              <a href={marketplaceHref({ product: p.slug || p.id })} onClick={e => go(e, { product: p.slug || p.id })} className="xh-product-image" aria-label={`View ${p.name}`}><ProductPhoto src={p.imageUrl} alt={p.imageAlt || p.name} iconKey={categoryIconKey(p.category, p.categoryLabel)} framing={p.imageFraming} widths={[320, 480]} sizes="(min-width: 1024px) 25vw, 50vw" /></a>
              <div><p className="xh-product-cat">{p.categoryLabel}</p><h3><a href={marketplaceHref({ product: p.slug || p.id })} onClick={e => go(e, { product: p.slug || p.id })}>{p.name}</a></h3><strong>{productPriceText(p)}</strong><span className={`xh-product-path xh-path-${productPath(p)}`}>{PATH_LABELS[productPath(p)]}</span></div>
              {productPath(p) === 'buy'
                ? <a href={marketplaceHref({ product: p.slug || p.id })} onClick={e => go(e, { product: p.slug || p.id })} className="mh-button xh-btn-primary"><ShoppingBag className="w-4 h-4" aria-hidden />View &amp; Buy</a>
                : <button type="button" onClick={() => openMarketplaceInquiry(p)} className="mh-button-secondary xh-btn-quiet"><FileQuestion className="w-4 h-4" aria-hidden />Ask About This Item</button>}
            </article>
          ))}</div>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── Creative Studio: real designs pegged on a twine ───────────────────────── */

const STUDIO_CARDS = ['ht-flyer', 'ih-social-a', 'lz-social'].map(creativeWorkById);

function Creative({ christmas }: { christmas: boolean }) {
  const { setActivePage } = useApp();
  // The hanging design swings on its peg; its arrival is on the list item, the swing on the card inside, so a tap can
  // never restart the arrival (which is what made a pressed design vanish and reappear).
  const sway = (e: React.PointerEvent<HTMLElement>) => swing(e.currentTarget, 6.5, 1300);
  return (
    <section className="xh-sec xh-creative" aria-labelledby="xh-creative-title">
      <div className="xh-wrap xh-creative-grid">
        <div className="xh-creative-copy">
          <p className="xh-kicker">Mystery Creative Studio</p>
          <h2 id="xh-creative-title">Flyers and designs for <em>{christmas ? 'your Christmas plans.' : 'the year ahead.'}</em></h2>
          <p>Church programmes, end-of-year parties, shop promotions: our studio team designs them for you. Each package shows what’s included before you send a request.</p>
          <a href="/creative-studio" onClick={e => { if (!plain(e)) return; e.preventDefault(); setActivePage('creative'); }} className="mh-button-secondary xh-btn-quiet">See design packages<ArrowRight className="w-4 h-4" aria-hidden /></a>
        </div>
        <figure className="xh-line" data-xh-reveal="line">
          <span className="xh-line-twine" aria-hidden="true" />
          <ul>
            {STUDIO_CARDS.map((work, i) => (
              <li key={work.id} style={{ '--i': i } as React.CSSProperties}>
                <span className="xh-card" onPointerDown={sway}>
                  <Peg />
                  <img src={getCloudinaryUrl(work.src, { width: 360, height: 450, crop: 'fill' })} alt={work.alt} width={180} height={225} loading="lazy" decoding="async" />
                </span>
              </li>
            ))}
          </ul>
          <figcaption>Studio Concepts: sample designs for fictional brands.</figcaption>
        </figure>
      </div>
    </section>
  );
}

/* ───────────────────────── Coming soon: a short, honest teaser ───────────────────────── */

function ComingSoon() {
  const { setActivePage } = useApp();
  const future = DIGITAL_SERVICES.filter(s => s.status === 'coming_soon');
  const shown = future.slice(0, 3), more = future.length - shown.length;
  const open = (e: React.MouseEvent, service = '') => { if (!plain(e)) return; e.preventDefault(); openServicesAt(setActivePage, { service }); };
  if (!future.length) return null;
  return (
    <section className="xh-sec xh-soon" aria-labelledby="xh-soon-title">
      <div className="xh-wrap">
        <div className="xh-soon-strip">
          <div className="xh-soon-intro">
            <p className="xh-soon-badge">Coming soon · Not available yet</p>
            <h2 id="xh-soon-title" className="xh-soon-title">Still wrapped: <em>more services on the way</em></h2>
          </div>
          <ul className="xh-sealed">
            {shown.map(svc => <li key={svc.id}><a href={servicesHref({ service: serviceSlug(svc) })} onClick={e => open(e, serviceSlug(svc))} aria-label={`Preview ${svc.title} — Coming Soon`}><span className="xh-seal" aria-hidden="true" />{svc.title}</a></li>)}
            {more > 0 && <li><a href="/services" onClick={e => open(e)} className="xh-sealed-more">+{more} more</a></li>}
          </ul>
          <a href="/services" onClick={e => open(e)} className="xh-link xh-soon-link">See What’s Coming<ArrowRight className="w-4 h-4" aria-hidden /></a>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Help and FAQs ───────────────────────── */

function Help() {
  const { setActivePage } = useApp();
  return (
    <section className="xh-sec xh-help" aria-labelledby="xh-help-title">
      <div className="xh-wrap xh-help-grid">
        <div className="xh-letter-card">
          <p className="xh-kicker xh-kicker-ink">Help when you need it</p>
          <h2 id="xh-help-title">Need help with an order?</h2>
          <p>Keep your order reference handy. You can check its status any time, or message our support team on WhatsApp.</p>
          <div className="xh-letter-actions">
            <button type="button" onClick={() => setActivePage('orders')} className="mh-button xh-btn-primary">Track an Order<ArrowRight className="w-4 h-4" aria-hidden /></button>
            <a href={BUSINESS_CONFIG.contact.supportWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="xh-btn-ink"><MessageCircle className="w-4 h-4" aria-hidden />WhatsApp Support<span className="sr-only"> (opens WhatsApp)</span></a>
          </div>
          <p className="xh-letter-safety"><ShieldCheck className="w-4 h-4" aria-hidden="true" />Mystery Hub and its support team will never ask for your MoMo PIN.</p>
        </div>
        <div className="xh-faq">
          <div className="xh-head xh-head-tight">
            <div>
              <p className="xh-kicker">A little clarity goes a long way</p>
              <h2>Questions? <em>We’ve got answers.</em></h2>
            </div>
            <a href="/help" onClick={e => { if (!plain(e)) return; e.preventDefault(); setActivePage('help'); }} className="xh-link">View All FAQs<ArrowUpRight className="w-4 h-4" aria-hidden /></a>
          </div>
          <FaqAccordion questions={HOME_FAQS} />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Sign-off into the footer ───────────────────────── */

function SignOff({ christmas }: { christmas: boolean }) {
  return (
    <section className="xh-signoff" aria-label="Season’s greetings">
      <div className="xh-signoff-lights" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}</div>
      <p className="xh-signoff-line">{christmas ? 'Wishing you a wonderful Christmas.' : 'Wishing you a happy New Year.'}</p>
      <p className="xh-signoff-from">With love from Mystery Hub, Ghana. <span lang="ak">Afehyia pa!</span></p>
    </section>
  );
}

/** The whole page. `status` decides the greetings; nothing here reads or changes prices, orders or accounts. */
export function ChristmasHome({ status }: { status: SeasonStatus }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(loadSeasonalSerif, []);
  useReveal(root, 'guest');
  const { greetings } = useSeason();
  const christmas = isChristmasTime(status);
  return (
    <div ref={root} className="xh-home" data-phase={status.phase}>
      <Hero status={status} />
      <Services christmas={christmas} />
      <FeaturedData />
      <Greetings christmas={christmas} entry={greetings} />
      <Install status={status} />
      <Website />
      <Marketplace christmas={christmas} />
      <Creative christmas={christmas} />
      <ComingSoon />
      <Help />
      <SignOff christmas={christmas} />
    </div>
  );
}

export default ChristmasHome;
