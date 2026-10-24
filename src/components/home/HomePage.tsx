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

export const HomePage: React.FC = () => {
  const { user, isAuthChecking } = useApp();

  if (isAuthChecking) {
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

  return (
    <div className="home-page space-y-0">
      <Hero />
      <QuickServicesBar />
      <HomeFeaturedData />
      {/* P0-C: install card (renders nothing where installing cannot work). Layout around it belongs to Homepage V3. */}
      <div className="home-container home-install-band empty:hidden"><InstallAppPromo /></div>
      <HomeWebsiteSection />
      <HomeMarketplaceSection />
      <HomeComingSoonSection />
      <div className="home-container home-help">
        <WhyMysteryHub />
        <HomeFaqPreview />
      </div>
    </div>
  );
};
