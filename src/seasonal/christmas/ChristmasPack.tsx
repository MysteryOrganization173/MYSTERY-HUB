import React from 'react';
import './christmas.css';
import type { SeasonStatus } from '../../../shared/seasonal';
import { useApp } from '../../context/AppContext';
import { Bell, Celebrate, Gift, GiftTag, InviteBanner, Ornament, Star, StringLights, Twinkle } from './art';
import { CONFIRMED_LINE, PAGE_LINE, isChristmasTime, type SeasonPage } from './copy';
import { loadSeasonalSerif } from './font';

/**
 * The Christmas experience pack: one lazily loaded chunk with its artwork and its scoped stylesheet. Normal visitors
 * never download it. Each slot is a composition made for one place in the site, not a banner repeated everywhere.
 */

export type ChristmasSlot = 'header' | 'footer' | 'page' | 'celebrate' | 'auth' | 'creative-stage';

export interface ChristmasSlotProps { slot: ChristmasSlot; page?: SeasonPage; status: SeasonStatus }


loadSeasonalSerif();

/** The header's hanging lights: a fine strand under the bar, behind everything you can tap. */
const HeaderLights = () => <StringLights className="xmas-header-lights" count={22} sag={7} swags={6} />;

function FooterGreeting({ status }: { status: SeasonStatus }) {
  const christmas = isChristmasTime(status);
  return (
    <div className="xmas-footer">
      <StringLights className="xmas-footer-lights" count={18} sag={16} swags={3} />
      <div className="xmas-footer-row">
        <Bell size={30} />
        <p><em>{christmas ? 'Wishing you a wonderful Christmas.' : 'Wishing you a happy New Year.'}</em><span>With love from Mystery Hub, Ghana.</span></p>
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

/**
 * The sign-up / sign-in sheet as a seasonal invitation: an illustrated header band and one quiet line above the
 * sheet's own title. The form, its rules and its wording are the sheet's own; this is decoration only.
 */
function AuthInvitation({ status }: { status: SeasonStatus }) {
  const { authMode } = useApp();
  const christmas = isChristmasTime(status);
  return (
    <div className="xmas-invite" aria-hidden="true">
      <InviteBanner newYear={!christmas} />
      <p className="xmas-invite-line"><span lang="ak">Afehyia pa</span> · {authMode === 'signup' ? 'Your next chapter starts here' : christmas ? 'Merry Christmas, welcome back' : 'Happy New Year, welcome back'}</p>
    </div>
  );
}

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
    case 'footer': return <FooterGreeting status={status} />;
    case 'page': return page ? <PageAccent page={page} status={status} /> : null;
    case 'celebrate': return <Celebration status={status} />;
    case 'auth': return <AuthInvitation status={status} />;
    case 'creative-stage': return <CreativeStage />;
    default: return null;
  }
}
