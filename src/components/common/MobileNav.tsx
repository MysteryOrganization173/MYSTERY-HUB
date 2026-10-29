import React from 'react';
import { useApp, ROUTE_PATH_MAP } from '../../context/AppContext';
import { ActivePage } from '../../types';
import { Home, Wifi, Globe, Gift, ReceiptText } from 'lucide-react';

/**
 * Phone tab bar (<768px): five fixed destinations with labels. The selected tab carries aria-current and a quiet
 * green indicator behind its icon. Styling lives in index.css (.mh-bottom-nav-*), so it stays pure CSS.
 */
export const MobileNav: React.FC = () => {
  const { activePage, setActivePage, activeEditorSite, isMysteryAiOpen, isCheckoutOpen, isStatusModalOpen, isAuthModalOpen, selectedTemplatePreview, marketplaceInquiryProduct, waitlistInfo, isAccountOpen } = useApp();

  const navItems: { id: ActivePage; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'data', label: 'Data', icon: Wifi },
    { id: 'website', label: 'Website', icon: Globe },
    { id: 'earn', label: 'Earn', icon: Gift },
    { id: 'orders', label: 'Orders', icon: ReceiptText },
  ];

  // Never cover an editor, payment, dialog or sheet: those surfaces own the bottom of the screen.
  if (activeEditorSite || isMysteryAiOpen || isCheckoutOpen || isStatusModalOpen || isAuthModalOpen || selectedTemplatePreview || marketplaceInquiryProduct || waitlistInfo.isOpen || isAccountOpen) return null;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="mh-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom,0px)] max-w-full overflow-hidden"
    >
      <div className="mh-bottom-nav-row grid grid-cols-5 max-w-md mx-auto w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          // My Business belongs to the Website tab: it is where an owner runs the website they built.
          const isActive = activePage === item.id || (item.id === 'website' && activePage === 'business');
          return (
            <a
              key={item.id}
              href={ROUTE_PATH_MAP[item.id]}
              aria-current={isActive ? 'page' : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                setActivePage(item.id);
              }}
              className="mh-bottom-nav-item"
            >
              <span className="mh-bottom-nav-indicator" aria-hidden="true">
                <Icon className="mh-bottom-nav-icon" strokeWidth={isActive ? 2.25 : 1.85} aria-hidden />
              </span>
              <span className="mh-bottom-nav-label">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
};
