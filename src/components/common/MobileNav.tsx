import React from 'react';
import { useApp } from '../../context/AppContext';
import { ActivePage } from '../../types';
import { Home, Wifi, Globe, Grid, Clock } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { activePage, setActivePage, orders } = useApp();

  const navItems: { id: ActivePage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'data', label: 'Data', icon: Wifi },
    { id: 'website', label: 'Website', icon: Globe },
    { id: 'services', label: 'Services', icon: Grid },
    { id: 'orders', label: 'Orders', icon: Clock },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c1116]/95 backdrop-blur-lg border-t border-slate-800/90 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] px-2 py-1"
    >
      <div className="grid grid-cols-5 items-center h-14 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 transition-colors relative"
            >
              <div
                className={`p-1 rounded-xl transition-all duration-200 ${
                  isActive ? 'text-[#00c365] scale-110' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] font-medium tracking-tight mt-0.5 ${
                  isActive ? 'text-[#00c365] font-semibold' : 'text-slate-400'
                }`}
              >
                {item.label}
              </span>
              {item.id === 'orders' && orders.length > 0 && !isActive && (
                <span className="absolute top-1 right-3 w-1.5 h-1.5 bg-[#00c365] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
