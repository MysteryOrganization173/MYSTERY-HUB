import React, { useEffect, useRef, useState } from 'react';
import './christmas.css';
import { MessageCircle, Share2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';
import type { SeasonStatus } from '../../../shared/seasonal';
import { Bell, Celebrate, Gift, GiftTag, Hat, Ornament, Star, StringLights, Twinkle } from './art';
import { CONFIRMED_LINE, GREETING, HERO_LINE, PAGE_LINE, SHARE_TEXT, isChristmasTime, seasonCountdown, type SeasonPage } from './copy';

/**
 * The Christmas experience pack: one lazily loaded chunk with its artwork and its scoped stylesheet. Normal visitors
 * never download it. Each slot is a composition made for one place in the site, not a banner repeated everywhere.
 */

export type ChristmasSlot =
  | 'header' | 'nav-home' | 'home-hero-scene' | 'home-hero-greeting' | 'home-hero-card' | 'home-share'
  | 'footer' | 'page' | 'celebrate' | 'auth' | 'creative-stage';

export interface ChristmasSlotProps { slot: ChristmasSlot; page?: SeasonPage; status: SeasonStatus }

const SITE_URL = `https://${BUSINESS_CONFIG.domain}/`;

// The festive serif (Fraunces italic, also used by Creative Studio) is requested only when the pack loads.
const SERIF_HREF = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,600&display=swap';
if (typeof document !== 'undefined' && !document.querySelector(`link[href="${SERIF_HREF}"]`)) {
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = SERIF_HREF; document.head.appendChild(link);
}

/** The header's hanging lights: a fine strand under the bar, behind everything you can tap. */
const HeaderLights = () => <StringLights className="xmas-header-lights" count={22} sag={7} swags={6} />;

/** A hat on the Home tab's icon that wobbles each time the tab is pressed. */
function NavHomeHat() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const tab = ref.current?.closest('a'); if (!tab) return;
    const wobble = () => { const el = ref.current; if (!el) return; el.removeAttribute('data-nudge'); void el.getBoundingClientRect(); el.setAttribute('data-nudge', ''); };
    const end = () => ref.current?.removeAttribute('data-nudge');
    // Keyboard users activating the tab see the same wobble as a tap.
    const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') wobble(); };
    const el = ref.current;
    tab.addEventListener('pointerdown', wobble); tab.addEventListener('keydown', key); el?.addEventListener('animationend', end);
    return () => { tab.removeEventListener('pointerdown', wobble); tab.removeEventListener('keydown', key); el?.removeEventListener('animationend', end); };
  }, []);
  return <Hat ref={ref} className="xmas-nav-hat" />;
}

/** The homepage hero becomes a Christmas evening: lights strung across the sky and ornaments hanging over the city. */
const HeroScene = () => (
  <div className="xmas-hero-scene" aria-hidden="true">
    <div className="xmas-hero-hang">
      <Ornament tone="gold" size={30} drop={34} className="xmas-hang-1" />
      <Ornament tone="berry" size={40} drop={66} className="xmas-hang-2" delay={120} />
      <Ornament tone="pine" size={28} drop={22} className="xmas-hang-3" delay={240} />
      <Ornament tone="cream" size={26} drop={92} className="xmas-hang-4" delay={360} />
    </div>
    <Star size={34} className="xmas-hero-star" />
    <Twinkle className="xmas-tw xmas-tw-1" size={10} /><Twinkle className="xmas-tw xmas-tw-2" size={7} /><Twinkle className="xmas-tw xmas-tw-3" size={12} /><Twinkle className="xmas-tw xmas-tw-4" size={8} />
  </div>
);

const HeroGreeting = ({ status }: { status: SeasonStatus }) => (
  <div className="xmas-hero-greeting">
    <p className="xmas-greeting-chip"><Star size={14} glow={false} />{GREETING[status.phase]}</p>
  </div>
);

/** The real day, from today's Accra date, with the serif line of the season. */
function HeroCard({ status }: { status: SeasonStatus }) {
  const { big, small } = seasonCountdown(status);
  return (
    <aside className="xmas-hero-card" aria-label="Season">
      <Gift size={46} className="xmas-hero-card-gift" />
      <p className="xmas-hero-card-count"><strong>{big}</strong><span>{small}</span></p>
      <p className="xmas-hero-card-line">{HERO_LINE[status.phase]}</p>
    </aside>
  );
}

/** "Share the Christmas joy": a real share (WhatsApp, the phone's share sheet or a copied link), never a promotion. */
function ShareBand({ status }: { status: SeasonStatus }) {
  const { showToast } = useApp();
  const christmas = isChristmasTime(status);
  const text = christmas ? SHARE_TEXT.christmas : SHARE_TEXT.newYear;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${text} ${SITE_URL}`)}`;
  const [canShare] = useState(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  const share = async () => {
    try {
      if (canShare) { await navigator.share({ title: 'Mystery Hub', text, url: SITE_URL }); return; }
      await navigator.clipboard.writeText(`${text} ${SITE_URL}`);
      showToast('Link copied. Paste it anywhere to share.', 'success', 'xmas-share');
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') showToast('Could not share from this browser. Use WhatsApp instead.', 'info', 'xmas-share');
    }
  };
  return (
    <section className="home-container xmas-share-wrap" aria-labelledby="xmas-share-title">
      <div className="xmas-share">
        <div className="xmas-share-copy">
          <p className="xmas-kicker"><Star size={14} glow={false} />{christmas ? 'Share the Christmas joy' : 'Share the New Year joy'}</p>
          <h2 id="xmas-share-title">The season feels <em>better together.</em></h2>
          <p>Send a festive hello to the people who keep you connected, with a link to Mystery Hub. No codes, no catch: just a friendly share.</p>
          <div className="xmas-share-actions">
            <a className="mh-button" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-4 h-4" aria-hidden />Share on WhatsApp<span className="sr-only"> (opens WhatsApp)</span></a>
            <button type="button" className="mh-button-secondary" onClick={share}><Share2 className="w-4 h-4" aria-hidden />{canShare ? 'Share another way' : 'Copy the link'}</button>
          </div>
        </div>
        <div className="xmas-share-art" aria-hidden="true">
          <span className="xmas-share-glow" />
          <Ornament tone="gold" size={30} drop={46} className="xmas-share-orn-1" />
          <Ornament tone="berry" size={36} drop={20} className="xmas-share-orn-2" delay={150} />
          <Gift size={124} className="xmas-share-gift-1" />
          <Gift size={78} tone="cream" className="xmas-share-gift-2" />
          <Gift size={58} tone="pine" className="xmas-share-gift-3" />
          <Star size={26} className="xmas-share-star" />
          <Twinkle className="xmas-tw xmas-tw-5" size={9} /><Twinkle className="xmas-tw xmas-tw-6" size={12} />
        </div>
      </div>
    </section>
  );
}

function FooterGreeting({ status }: { status: SeasonStatus }) {
  const christmas = isChristmasTime(status);
  return (
    <div className="xmas-footer">
      <StringLights className="xmas-footer-lights" count={18} sag={16} swags={3} />
      <div className="xmas-footer-row">
        <Bell size={30} />
        <p><em>{christmas ? 'Wishing you a wonderful Christmas.' : 'Wishing you a happy New Year.'}</em><span>From all of us at Mystery Hub, Accra.</span></p>
        <Bell size={30} className="xmas-bell-flip" />
      </div>
    </div>
  );
}

/** Each page's own composition: different artwork and words for different jobs, in a row that never covers the title. */
const PAGE_ART: Record<SeasonPage, (christmas: boolean) => React.ReactNode> = {
  data: () => <><Ornament tone="pine" size={22} drop={10} /><Twinkle size={9} className="xmas-tw-inline" /><Ornament tone="gold" size={26} drop={24} delay={120} /></>,
  marketplace: c => <><GiftTag text={c ? 'Merry Christmas' : 'Happy 2027'} /><Gift size={40} tone="pine" className="xmas-page-gift" /></>,
  creative: () => <><Ornament tone="gold" size={22} drop={12} /><Ornament tone="berry" size={28} drop={26} delay={120} /><Star size={22} /></>,
  website: () => <><Gift size={42} tone="cream" className="xmas-page-gift" /><Ornament tone="berry" size={24} drop={18} /></>,
  services: () => <><Star size={26} /><Twinkle size={10} className="xmas-tw-inline" /><Twinkle size={7} className="xmas-tw-inline" /><Star size={18} glow={false} /></>,
  afa: () => <Bell size={30} />,
  checkers: () => <><Twinkle size={9} className="xmas-tw-inline" /><Star size={20} glow={false} /></>,
  help: () => <><Star size={28} /><Bell size={26} /></>,
  about: () => <><Ornament tone="pine" size={24} drop={14} /><Ornament tone="gold" size={30} drop={30} delay={100} /><Ornament tone="berry" size={24} drop={18} delay={200} /></>,
  orders: () => <Gift size={44} className="xmas-page-gift" />,
  app: () => <><Ornament tone="gold" size={26} drop={20} /><Star size={20} glow={false} /></>,
  earn: c => <><Gift size={40} tone="pine" className="xmas-page-gift" /><GiftTag text={c ? 'For a friend' : 'Happy 2027'} /></>,
  wallet: () => <Star size={22} />,
};

function PageAccent({ page, status }: { page: SeasonPage; status: SeasonStatus }) {
  const christmas = isChristmasTime(status);
  return (
    <div className={`xmas-page xmas-page-${page}`}>
      <p className="xmas-kicker"><Star size={13} glow={false} />{christmas ? PAGE_LINE[page].christmas : PAGE_LINE[page].newYear}</p>
      <div className="xmas-page-art" aria-hidden="true">{PAGE_ART[page](christmas)}</div>
    </div>
  );
}

/** Shown only beside a genuinely confirmed outcome. The caller decides when; this never claims a state. */
function Celebration({ status }: { status: SeasonStatus }) {
  return (
    <div className="xmas-confirmed" aria-hidden="true">
      <Celebrate />
      <span className="xmas-confirmed-line"><Star size={16} glow={false} />{isChristmasTime(status) ? CONFIRMED_LINE.christmas : CONFIRMED_LINE.newYear}</span>
    </div>
  );
}

/** An ornament hanging into the sign-in sheet, with a quiet greeting. */
const AuthOrnament = ({ status }: { status: SeasonStatus }) => (
  <div className="xmas-auth" aria-hidden="true">
    <Ornament tone="berry" size={26} drop={18} />
    <Ornament tone="gold" size={20} drop={34} delay={140} />
    <span className="xmas-auth-greeting">{isChristmasTime(status) ? 'Merry Christmas' : 'Happy New Year'}</span>
  </div>
);

/** Creative Studio keeps its own identity: one gold ornament and a star hang over its showroom stage. */
const CreativeStage = () => (
  <span className="xmas-creative-stage" aria-hidden="true">
    <Ornament tone="gold" size={30} drop={40} />
    <Ornament tone="berry" size={22} drop={18} delay={160} />
  </span>
);

export default function ChristmasPack({ slot, page, status }: ChristmasSlotProps) {
  switch (slot) {
    case 'header': return <HeaderLights />;
    case 'nav-home': return <NavHomeHat />;
    case 'home-hero-scene': return <HeroScene />;
    case 'home-hero-greeting': return <HeroGreeting status={status} />;
    case 'home-hero-card': return <HeroCard status={status} />;
    case 'home-share': return <ShareBand status={status} />;
    case 'footer': return <FooterGreeting status={status} />;
    case 'page': return page ? <PageAccent page={page} status={status} /> : null;
    case 'celebrate': return <Celebration status={status} />;
    case 'auth': return <AuthOrnament status={status} />;
    case 'creative-stage': return <CreativeStage />;
    default: return null;
  }
}
