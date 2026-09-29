import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from './BrandLogo';
import { ActivePage } from '../../types';
import { Search, ShoppingBag, User, LogOut, Menu, X } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { activePage, setActivePage, openAuth, user, logoutUser, orders, openOrderStatus } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const navLinks: { id: ActivePage; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'data', label: 'Data' },
    { id: 'website', label: 'Website Builder' },
    { id: 'services', label: 'More Services' },
    { id: 'about', label: 'About' },
  ];

  const handleNavClick = (pageId: ActivePage) => {
    setActivePage(pageId);
    setMobileMenuOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    if (q.includes('data') || q.includes('mtn') || q.includes('telecel') || q.includes('bundle') || q.includes('airteltigo')) {
      setActivePage('data');
    } else if (q.includes('web') || q.includes('site') || q.includes('build') || q.includes('template')) {
      setActivePage('website');
    } else {
      setActivePage('services');
    }
    setSearchOpen(false);
    setSearchQuery('');
  };

  const recentOrder = orders[0];

  return (
    <header className="sticky top-0 z-40 bg-[#0a0e11]/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => handleNavClick('home')}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365] rounded-lg transition-transform active:scale-95"
          aria-label="Mystery Hub Homepage"
        >
          <BrandLogo size="md" />
        </button>

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          {navLinks.map((link) => {
            const isActive = activePage === link.id;
            return (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                className={`transition-colors py-1 relative whitespace-nowrap ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00c365] rounded-full shadow-[0_0_8px_rgba(0,195,101,0.6)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions & Auth */}
        <div className="flex items-center gap-3">
          {/* Quick Search Toggle */}
          <div className="relative">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search data, websites, services..."
                  autoFocus
                  className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5 w-48 sm:w-64 focus:outline-none focus:border-[#00c365]"
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="ml-1 text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
                title="Search Mystery Hub"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Orders Check */}
          {orders.length > 0 && (
            <button
              onClick={() => recentOrder && openOrderStatus(recentOrder)}
              className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
              title="Recent Orders"
              aria-label="Recent Orders"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#00c365] rounded-full ring-2 ring-[#0a0e11]" />
            </button>
          )}

          {/* Auth Controls */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-200">
                <div className="w-5 h-5 rounded-full bg-[#00c365]/20 text-[#00c365] flex items-center justify-center font-bold text-[10px]">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline font-medium truncate max-w-[100px]">{user.name.split(' ')[0]}</span>
              </div>
              <button
                onClick={logoutUser}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded-lg transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuth('login')}
                className="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
              >
                Login
              </button>
              <button
                onClick={() => openAuth('signup')}
                className="px-4 py-2 text-xs font-semibold text-black bg-[#00c365] hover:bg-[#00e575] rounded-lg transition-all shadow-[0_0_15px_rgba(0,195,101,0.25)] active:scale-95 whitespace-nowrap"
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0c1116] border-b border-slate-800 px-4 pt-3 pb-5 space-y-2">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => handleNavClick(link.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activePage === link.id
                  ? 'bg-[#00c365]/10 text-[#00c365] font-semibold'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {link.label}
            </button>
          ))}

          {!user && (
            <div className="pt-2 border-t border-slate-800 flex gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuth('login');
                }}
                className="flex-1 py-2 text-center text-xs font-medium text-slate-300 bg-slate-900 rounded-lg"
              >
                Login
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuth('signup');
                }}
                className="flex-1 py-2 text-center text-xs font-semibold text-black bg-[#00c365] rounded-lg"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
