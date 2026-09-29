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
import { HomePage } from './components/home/HomePage';
import { DataPage } from './components/data/DataPage';
import { WebsiteBuilderPage } from './components/website/WebsiteBuilderPage';
import { MoreServicesPage } from './components/services/MoreServicesPage';
import { AboutPage } from './components/about/AboutPage';
import { OrdersPage } from './components/orders/OrdersPage';
import { CheckoutModal } from './components/checkout/CheckoutModal';
import { OrderStatusModal } from './components/checkout/OrderStatusModal';
import { TemplatePreviewModal } from './components/website/TemplatePreviewModal';
import { WaitlistModal } from './components/common/WaitlistModal';
import { AuthModal } from './components/auth/AuthModal';
import { MysteryAiAssistant } from './components/ai/MysteryAiAssistant';

const AppContent: React.FC = () => {
  const { activePage } = useApp();

  return (
    <div className="min-h-screen bg-[#0b0f12] text-slate-100 flex flex-col font-sans selection:bg-[#00c365] selection:text-black">
      {/* 3-zone Header Contract */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 pb-16 md:pb-0">
        {activePage === 'home' && <HomePage />}
        {activePage === 'data' && <DataPage />}
        {activePage === 'website' && <WebsiteBuilderPage />}
        {activePage === 'services' && <MoreServicesPage />}
        {activePage === 'about' && <AboutPage />}
        {activePage === 'orders' && <OrdersPage />}
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
      <ToastContainer />
      <MysteryAiAssistant />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
