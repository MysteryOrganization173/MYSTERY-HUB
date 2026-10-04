/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { MobileNav } from './components/common/MobileNav';
import { Footer } from './components/common/Footer';
import { ToastContainer } from './components/common/Toast';
import { SEOHead } from './components/common/SEOHead';
import { HomePage } from './components/home/HomePage';
import { DataPage } from './components/data/DataPage';
import { WebsiteBuilderPage } from './components/website/WebsiteBuilderPage';
import { MoreServicesPage } from './components/services/MoreServicesPage';
import { MarketplacePage } from './components/marketplace/MarketplacePage';
import { AboutPage } from './components/about/AboutPage';
import { OrdersPage } from './components/orders/OrdersPage';
import { MysteryEarnPage } from './components/earn/MysteryEarnPage';
import { CheckoutModal } from './components/checkout/CheckoutModal';
import { OrderStatusModal } from './components/checkout/OrderStatusModal';
import { TemplatePreviewModal } from './components/website/TemplatePreviewModal';
import { WaitlistModal } from './components/common/WaitlistModal';
import { AccountControls } from './components/auth/AccountControls';
import { AuthModal } from './components/auth/AuthModal';
import { MarketplaceInquiryModal } from './components/marketplace/MarketplaceInquiryModal';
import { MysteryAiAssistant } from './components/ai/MysteryAiAssistant';
import { IsolatedTemplatePreview } from './components/website/IsolatedTemplatePreview';
import { PublicPublishedSite } from './components/website/PublicPublishedSite';
import { AdminPage } from './components/admin/AdminPage';

const AppContent: React.FC = () => {
  const { activePage } = useApp();

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
    <div className="min-h-screen bg-[#0b0f12] text-slate-100 flex flex-col font-sans selection:bg-[#00c365] selection:text-black">
      <SEOHead />
      {/* 3-zone Header Contract */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1">
        {activePage === 'home' && <HomePage />}
        {activePage === 'data' && <DataPage />}
        {activePage === 'website' && <WebsiteBuilderPage />}
        {activePage === 'marketplace' && <MarketplacePage />}
        {activePage === 'services' && <MoreServicesPage />}
        {activePage === 'about' && <AboutPage />}
        {activePage === 'orders' && <OrdersPage />}
        {activePage === 'earn' && <MysteryEarnPage />}
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile Sticky Bottom Nav (<15% viewport height cap) */}
      <MobileNav />

      {/* Global Interactive Overlays */}
      <CheckoutModal />
      <OrderStatusModal />
      <TemplatePreviewModal />
      <WaitlistModal />
      <AuthModal />
      <AccountControls />
      <MarketplaceInquiryModal />
      <ToastContainer />
      <MysteryAiAssistant />
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
