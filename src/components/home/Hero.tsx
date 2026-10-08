import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';
import { Wifi, ArrowRight, Globe, CheckCircle } from 'lucide-react';

// Existing approved Accra artwork; keep text independent of image availability.
const HERO_ARTWORK = 'https://res.cloudinary.com/da6oeat7m/image/upload/v1790778037/ChatGPT_Image_Sep_30_2026_02_14_20_PM_baowst.png';

export const Hero: React.FC = () => {
  const { setActivePage } = useApp();
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <section className="home-hero" aria-labelledby="home-headline">
      <div className="home-hero-art" aria-hidden="true">
        {!imageFailed && <img
          src={getCloudinaryUrl(HERO_ARTWORK, { width: 1280 })}
          srcSet={getCloudinarySrcSet(HERO_ARTWORK, [640, 960, 1280, 1600])}
          sizes="100vw" alt="" fetchPriority="high" loading="eager" decoding="async"
          onError={() => setImageFailed(true)}
        />}
      </div>
      <div className="home-container home-hero-content">
        <div className="home-hero-copy">
          <p className="home-eyebrow"><span className="home-status-dot" />Digital services for everyday life in Ghana</p>
          <h1 id="home-headline">Everything digital.<br /><span>One trusted place.</span></h1>
          <p className="home-hero-description">Buy data and airtime, create a free business website, and track your orders. Share your referral link to earn from qualifying purchases.</p>
          <div className="home-hero-actions">
            <a href="/website-builder" onClick={(e) => { e.preventDefault(); setActivePage('website'); }} className="mh-button">
              <Globe className="w-4 h-4" /><span>Create a Free Website</span><ArrowRight className="w-4 h-4" />
            </a>
            <a href="/data" onClick={(e) => { e.preventDefault(); setActivePage('data'); }} className="mh-button-secondary">
              <Wifi className="w-4 h-4 text-[#00c365]" /><span>Buy Data</span>
            </a>
          </div>
          <p className="home-hero-note"><CheckCircle className="w-4 h-4" />Pick a design. Make it yours. Publish free. No coding needed.</p>
        </div>
        <div className="home-hero-caption" aria-hidden="true"><span>Made for everyday life.</span><span>And your next big idea.</span></div>
      </div>
    </section>
  );
};
