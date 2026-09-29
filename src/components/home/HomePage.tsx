import React from 'react';
import { Hero } from './Hero';
import { QuickServicesBar } from './QuickServicesBar';
import { HomeFeaturedData } from './HomeFeaturedData';
import { HomeWebsiteSection } from './HomeWebsiteSection';
import { WhyMysteryHub } from './WhyMysteryHub';
import { HomeComingSoonSection } from './HomeComingSoonSection';

export const HomePage: React.FC = () => {
  return (
    <div className="space-y-0">
      <Hero />
      <QuickServicesBar />
      <HomeFeaturedData />
      <HomeWebsiteSection />
      <WhyMysteryHub />
      <HomeComingSoonSection />
    </div>
  );
};
