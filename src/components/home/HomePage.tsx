import React from 'react';
import './homepage.css';
import { useApp } from '../../context/AppContext';
import { Hero } from './Hero';
import { QuickServicesBar } from './QuickServicesBar';
import { HomeFeaturedData } from './HomeFeaturedData';
import { HomeWebsiteSection } from './HomeWebsiteSection';
import { HomeMarketplaceSection } from './HomeMarketplaceSection';
import { WhyMysteryHub } from './WhyMysteryHub';
import { HomeFaqPreview } from './HomeFaqPreview';
import { HomeComingSoonSection } from './HomeComingSoonSection';
import { MemberHome } from './MemberHome';
import { InstallAppPromo } from '../pwa/InstallAppPromo';
import { CreativeStudioEntry } from '../creative/CreativeStudioEntry';
import { useSeason } from '../../seasonal/SeasonProvider';
import { SeasonalHome } from '../../seasonal/Seasonal';

export const HomePage: React.FC = () => {
  const { user, isAuthChecking } = useApp();
  // Seasonal Experience: while a season is on for a signed-out visitor, the homepage is the season's own
  // composition (lazy-loaded; the ordinary homepage is its fallback). Off, nothing here changes.
  const season = useSeason();

  if (isAuthChecking) {
    // While a season is on, a returning customer's session check holds the season's quiet placeholder, so the page
    // does not flash the ordinary skeleton between the seasonal header and footer before their homepage appears.
    if (season.shellActive) return <div className="mh-season-home-wait is-member" aria-busy="true"><p className="sr-only" role="status">Loading Mystery Hub…</p></div>;
    return (
      <div className="home-page space-y-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
          <div className="w-full h-[240px] rounded-3xl bg-[#090d11] border border-slate-800/80 animate-pulse flex items-center justify-center">
            <span className="text-xs text-slate-500 font-medium">Loading Mystery Hub...</span>
          </div>
        </div>
        <HomeFeaturedData />
        <HomeWebsiteSection />
        <HomeMarketplaceSection />
      </div>
    );
  }

  if (user) {
    return (
      <MemberHome />
    );
  }

  if (season.active) return <SeasonalHome fallback={<NormalGuestHome />} />;
  return <NormalGuestHome />;
};

/** The ordinary signed-out homepage. It is also the fallback if the seasonal homepage cannot load. */
export function NormalGuestHome() {
  return (
    <div className="home-page space-y-0">
      <Hero />
      <QuickServicesBar />
      <HomeFeaturedData />
      {/* P0-C: install card (renders nothing where installing cannot work). Layout around it belongs to Homepage V3. */}
      <div className="home-container home-install-band empty:hidden"><InstallAppPromo /></div>
      <HomeWebsiteSection />
      <HomeMarketplaceSection />
      <div className="home-container home-creative-entry mt-2 mb-10 sm:mb-14"><CreativeStudioEntry variant="home" /></div>
      <HomeComingSoonSection />
      <div className="home-container home-help">
        <WhyMysteryHub />
        <HomeFaqPreview />
      </div>
    </div>
  );
}
