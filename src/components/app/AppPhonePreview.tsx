import React, { useState } from 'react';
import { ArrowRight, Check, Clock, Gift, Globe, Home, Wifi } from 'lucide-react';
import { BrandMark } from '../common/BrandLogo';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';

// The homepage's approved Accra artwork and the same phone cut (Hero.tsx), so a visitor who has opened Home already
// has these exact files cached, and the phone shows what the app really opens to.
const HERO_ARTWORK = 'https://res.cloudinary.com/da6oeat7m/image/upload/v1790778037/ChatGPT_Image_Sep_30_2026_02_14_20_PM_baowst.png';
const PHONE_REGION = { x: 669, y: 0, width: 1003, height: 941 };

/**
 * A phone showing Mystery Hub's real start screen as a signed-out visitor sees it: the same headline, actions,
 * "available now" list and tab bar. No balances, orders, names or numbers, so nothing in it can be mistaken for an
 * account. Decorative: the page states everything in it as text.
 */
export const AppPhonePreview: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [artFailed, setArtFailed] = useState(false);
  return <div className={`mh-applp-phone ${className}`} aria-hidden="true">
    <div className="mh-applp-phone-screen">
      <div className="mh-applp-phone-notch" />
      <div className="mh-applp-phone-bar">
        <span className="mh-applp-phone-brand"><BrandMark size="sm" ariaHidden /><b>Mystery <i>Hub</i></b></span>
        <span className="mh-applp-phone-signup">Sign Up</span>
      </div>
      <div className={`mh-applp-phone-hero${artFailed ? ' is-plain' : ''}`}>
        {!artFailed && <img
          src={getCloudinaryUrl(HERO_ARTWORK, { width: 480, region: PHONE_REGION })}
          srcSet={getCloudinarySrcSet(HERO_ARTWORK, [480, 720], { region: PHONE_REGION })}
          sizes="(min-width: 1024px) 320px, 260px" alt="" loading="lazy" decoding="async" onError={() => setArtFailed(true)}
        />}
        <div className="mh-applp-phone-copy">
          <p><span />Digital services for everyday life in Ghana</p>
          <strong>Everything digital.<br /><em>One trusted place.</em></strong>
          <span className="mh-applp-phone-cta"><Globe />Create a Free Website<ArrowRight /></span>
          <span className="mh-applp-phone-cta is-secondary"><Wifi />Buy Data</span>
        </div>
      </div>
      <ul className="mh-applp-phone-live">
        {['Data & airtime', 'Free business website', 'Order tracking'].map(item => <li key={item}><Check />{item}</li>)}
      </ul>
      <div className="mh-applp-phone-tabs">
        {[[Home, 'Home'], [Wifi, 'Data'], [Globe, 'Website'], [Gift, 'Earn'], [Clock, 'Orders']].map(([Icon, label], index) => {
          const TabIcon = Icon as typeof Home;
          return <span key={label as string} className={index === 0 ? 'is-active' : ''}><TabIcon />{label as string}</span>;
        })}
      </div>
    </div>
  </div>;
};
