/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { MobileNav } from './components/common/MobileNav';
import { Footer } from './components/common/Footer';
import { ToastContainer } from './components/common/Toast';
import { SEOHead } from './components/common/SEOHead';
import { HomePage } from './components/home/HomePage';
import { CheckoutModal } from './components/checkout/CheckoutModal';
import { OrderStatusModal } from './components/checkout/OrderStatusModal';
import { WaitlistModal } from './components/common/WaitlistModal';
import { AccountControls } from './components/auth/AccountControls';
import { AuthModal } from './components/auth/AuthModal';
import { MarketplaceInquiryModal } from './components/marketplace/MarketplaceInquiryModal';
import { lazyPage } from './utils/lazyPage';
import { AppLaunchLayer } from './components/pwa/AppLaunchLayer';
import {GrowthTracker} from './components/common/GrowthTracker';

// Home is the start URL and ships with the app. Every other page downloads when it is first opened (and is
// warmed during idle time, see utils/lazyPage), so a phone on a slow network starts with far less JavaScript.
const DataPage = lazyPage(() => import('./components/data/DataPage'), 'DataPage', { warm: true });
const WebsiteBuilderPage = lazyPage(() => import('./components/website/WebsiteBuilderPage'), 'WebsiteBuilderPage');
const BusinessWorkspacePage = lazyPage(() => import('./components/website/BusinessWorkspacePage'), 'BusinessWorkspacePage');
const MoreServicesPage = lazyPage(() => import('./components/services/MoreServicesPage'), 'MoreServicesPage');
const AfaRegistrationPage = lazyPage(() => import('./components/services/AfaRegistrationPage'), 'AfaRegistrationPage');
const MarketplacePage = lazyPage(() => import('./components/marketplace/MarketplacePage'), 'MarketplacePage');
const HelpPage = lazyPage(() => import('./components/help/HelpPage'), 'HelpPage');
const AboutPage = lazyPage(() => import('./components/about/AboutPage'), 'AboutPage');
const OrdersPage = lazyPage(() => import('./components/orders/OrdersPage'), 'OrdersPage', { warm: true });
const MysteryEarnPage = lazyPage(() => import('./components/earn/MysteryEarnPage'), 'MysteryEarnPage');
const WalletPage = lazyPage(() => import('./components/finance/FinancialPanel'), 'WalletPage');
const AppLandingPage = lazyPage(() => import('./components/app/AppLandingPage'), 'AppLandingPage');
const AdminPage = lazyPage(() => import('./components/admin/AdminPage'), 'AdminPage');
// Overlays carrying the website templates and the assistant load the first time they are needed, then stay mounted.
const TemplatePreviewModal = lazyPage(() => import('./components/website/TemplatePreviewModal'), 'TemplatePreviewModal', { fallback: null });
const MysteryAiAssistant = lazyPage(() => import('./components/ai/MysteryAiAssistant'), 'MysteryAiAssistant', { fallback: null });
// main.tsx serves these two surfaces before the app loads; the fallbacks below no longer pull them into it.
const IsolatedTemplatePreview = lazyPage(() => import('./components/website/IsolatedTemplatePreview'), 'IsolatedTemplatePreview', { fallback: null });
const PublicPublishedSite = lazyPage(() => import('./components/website/PublicPublishedSite'), 'PublicPublishedSite', { fallback: null });

/** True from the first time `condition` holds. */
function useOnceTrue(condition: boolean) {
  const [reached, setReached] = useState(condition);
  if (condition && !reached) setReached(true);
  return reached || condition;
}

const AppContent: React.FC = () => {
  const { activePage, selectedTemplatePreview, isMysteryAiOpen, activeEditorSite } = useApp();
  const templatePreviewNeeded = useOnceTrue(Boolean(selectedTemplatePreview));
  const assistantNeeded = useOnceTrue(isMysteryAiOpen || Boolean(activeEditorSite));

  // Isolated Admin Experience
  if (activePage === 'admin') {
    return (
      <>
        <SEOHead />
        <AdminPage />
        <AccountControls />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="mh-app min-h-screen bg-[#0b0f12] text-slate-100 flex flex-col font-sans selection:bg-[#00c365] selection:text-black">
      <SEOHead />
      {/* 3-zone Header Contract */}
      <GrowthTracker />
      <a href="#main-content" className="fixed -top-20 left-4 focus:top-3 z-[120] mh-button">Skip to content</a>
      <Navbar />

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0">
        {activePage === 'home' && <HomePage />}
        {activePage === 'data' && <DataPage />}
        {activePage === 'website' && <WebsiteBuilderPage />}
        {activePage === 'business' && <BusinessWorkspacePage />}
        {activePage === 'marketplace' && <MarketplacePage />}
        {activePage === 'services' && <MoreServicesPage />}
        {activePage === 'afa' && <AfaRegistrationPage />}
        {activePage === 'about' && <AboutPage />}
        {activePage === 'help' && <HelpPage />}
        {activePage === 'orders' && <OrdersPage />}
        {activePage === 'earn' && <MysteryEarnPage />}
        {activePage === 'wallet' && <WalletPage />}
        {activePage === 'app' && <AppLandingPage />}
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile Sticky Bottom Nav (<15% viewport height cap) */}
      <MobileNav />

      {/* Global Interactive Overlays */}
      <CheckoutModal />
      <OrderStatusModal />
      {templatePreviewNeeded && <TemplatePreviewModal />}
      <WaitlistModal />
      <AuthModal />
      <AccountControls />
      <MarketplaceInquiryModal />
      <ToastContainer />
      {assistantNeeded && <MysteryAiAssistant />}
      <AppLaunchLayer />
    </div>
  );
};

export default function App() {
  // Check if running inside an isolated preview iframe
  const searchParams = new URLSearchParams(window.location.search);
  const isolatedTemplateId =
    searchParams.get('isolated_template_preview') ||
    searchParams.get('preview_template_id');

  if (isolatedTemplateId) {
    return <IsolatedTemplatePreview templateId={isolatedTemplateId} />;
  }

  // Check if viewing a public published website (/sites/:slug)
  const pathname = window.location.pathname;
  const siteSlugMatch = pathname.match(/^\/sites\/([^/?#]+)/);
  if (siteSlugMatch && siteSlugMatch[1]) {
    return <PublicPublishedSite slug={siteSlugMatch[1]} />;
  }

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
