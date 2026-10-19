import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';
import { Wifi, ArrowRight, Globe, Check } from 'lucide-react';

// Existing approved Accra artwork; keep text independent of image availability.
const HERO_ARTWORK = 'https://res.cloudinary.com/da6oeat7m/image/upload/v1790778037/ChatGPT_Image_Sep_30_2026_02_14_20_PM_baowst.png';

// Phones get an art-directed cut of the same artwork: its right-hand 60% (the skyline,
// Independence Arch, globe and Wi-Fi arcs) in a wide band, instead of a slice of the
// full-width image. Pixel values are against the 1672 × 941 original.
const PHONE_REGION = { x: 669, y: 130, width: 1003, height: 643 };

// Only services that are live today.
const LIVE_NOW = ['Data & airtime', 'Free business website', 'Order tracking'];

export const Hero: React.FC = () => {
  const { setActivePage } = useApp();
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <section className={`home-hero${imageFailed ? ' home-hero-no-art' : ''}`} aria-labelledby="home-headline">
      <div className="home-hero-art" aria-hidden="true">
        {!imageFailed && <picture>
          {/* One request either way: the browser picks a single source before fetching. */}
          <source media="(max-width: 767px)" sizes="100vw"
            srcSet={getCloudinarySrcSet(HERO_ARTWORK, [480, 720, 1000], { region: PHONE_REGION })} />
          <img
            src={getCloudinaryUrl(HERO_ARTWORK, { width: 1280 })}
            srcSet={getCloudinarySrcSet(HERO_ARTWORK, [640, 960, 1280, 1600])}
            sizes="100vw" alt="" fetchPriority="high" loading="eager" decoding="async"
            onError={() => setImageFailed(true)}
          />
        </picture>}
      </div>
      <div className="home-container home-hero-content">
        <div className="home-hero-copy">
          <p className="home-eyebrow"><span className="home-status-dot" />Digital services for everyday life in Ghana</p>
          <h1 id="home-headline">Everything digital.<br /><span>One trusted place.</span></h1>
          <p className="home-hero-description">Buy data and airtime, build a free website for your business, and follow every order from payment to delivery.</p>
          <div className="home-hero-actions">
            <a href="/website-builder" onClick={(e) => { e.preventDefault(); setActivePage('website'); }} className="mh-button">
              <Globe className="w-4 h-4" /><span>Create a Free Website</span><ArrowRight className="w-4 h-4" />
            </a>
            <a href="/data" onClick={(e) => { e.preventDefault(); setActivePage('data'); }} className="mh-button-secondary">
              <Wifi className="w-4 h-4 text-[#00c365]" /><span>Buy Data</span>
            </a>
          </div>
          <ul className="home-hero-live" aria-label="Available now">
            {LIVE_NOW.map(item => <li key={item}><Check className="w-3.5 h-3.5" aria-hidden="true" />{item}</li>)}
          </ul>
        </div>
        <div className="home-hero-caption" aria-hidden="true"><span>Made for everyday life.</span><span>And your next big idea.</span></div>
      </div>
    </section>
  );
};
