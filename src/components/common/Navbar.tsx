import React, { useState, useEffect, useRef } from 'react';
import { useApp, ROUTE_PATH_MAP } from '../../context/AppContext';
import { BrandLogo } from './BrandLogo';
import { ActivePage } from '../../types';
import {
  Search,
  ShoppingBag,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Home,
  Globe,
  Sparkles,
  Clock,
  ExternalLink,
  Gift,
  Wallet,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { activePage, setActivePage, openAuth, user, logoutUser, openAccount } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const navLinks: { id: ActivePage; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'data', label: 'Data' },
    { id: 'website', label: 'Website Builder' },
    { id: 'marketplace', label: 'Marketplace' },
    { id: 'services', label: 'More Services' },
    { id: 'about', label: 'About' },
  ];

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountDropdownOpen(false);
        setMobileMenuOpen(false);
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleNavClick = (pageId: ActivePage) => {
    setActivePage(pageId);
    setMobileMenuOpen(false);
    setAccountDropdownOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    if (q.includes('wallet') || q.includes('top up')) {
      setActivePage('wallet');
    } else if (q.includes('earn') || q.includes('referral') || q.includes('reward') || q.includes('affiliate') || q.includes('share')) {
      setActivePage('earn');
    } else if (q.includes('data') || q.includes('mtn') || q.includes('telecel') || q.includes('bundle') || q.includes('airteltigo')) {
      setActivePage('data');
    } else if (q.includes('web') || q.includes('site') || q.includes('build') || q.includes('template')) {
      setActivePage('website');
    } else if (q.includes('market') || q.includes('laptop') || q.includes('tech') || q.includes('tool') || q.includes('mic') || q.includes('phone') || q.includes('charger')) {
      setActivePage('marketplace');
    } else {
      setActivePage('services');
    }
    setSearchOpen(false);
    setSearchQuery('');
  };

  const userFirstName = user?.name ? user.name.split(' ')[0] : 'Member';
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'M';
  const userSubtext = user?.email || user?.phone || '';

  return (
    <header className="sticky top-0 z-40 bg-[#0a0e11]/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleNavClick('home');
          }}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365] rounded-lg transition-transform active:scale-95 inline-flex items-center"
          aria-label="Mystery Hub Homepage"
        >
          <BrandLogo size="md" priority="high" />
        </a>

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav className="hidden xl:flex items-center gap-5 text-sm font-medium text-slate-300">
          {navLinks.map((link) => {
            const isActive = activePage === link.id;
            return (
              <a
                key={link.id}
                href={ROUTE_PATH_MAP[link.id]}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.id);
                }}
                aria-current={isActive?'page':undefined}
                className={`transition-colors min-h-11 flex items-center relative whitespace-nowrap cursor-pointer ${
                  isActive ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00c365] rounded-full shadow-[0_0_8px_rgba(0,195,101,0.6)]" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Actions & Auth */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Quick Search Toggle */}
          <div className="relative">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-2.5 py-1.5 w-28 xs:w-40 sm:w-64 max-w-[calc(100vw-120px)] focus:outline-none focus:border-[#00c365]"
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="ml-1 text-slate-400 hover:text-white p-1 cursor-pointer"
                  aria-label="Close search"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                title="Search Mystery Hub"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>

          {user&&<button onClick={()=>handleNavClick('wallet')} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800" aria-label="Mystery Wallet" title="Mystery Wallet"><Wallet className="w-4 h-4"/></button>}
          {/* Mystery Earn Shortcut */}
          <button
            onClick={() => handleNavClick('earn')}
            className="relative p-1.5 sm:p-2 text-slate-400 hover:text-[#00c365] hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
            title="Mystery Earn"
            aria-label="Mystery Earn"
          >
            <Gift className="w-4 h-4 text-[#00c365]" />
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2" aria-hidden="true">

              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00c365]" />
            </span>
          </button>

          {/* Auth Controls */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-slate-200 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#00c365]"
                aria-haspopup="true"
                aria-expanded={accountDropdownOpen}
              >
                <div className="w-5 h-5 rounded-full bg-[#00c365]/20 text-[#00c365] flex items-center justify-center font-bold text-[10px]">
                  {userInitial}
                </div>
                <span className="hidden sm:inline font-medium truncate max-w-[110px]">{userFirstName}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${accountDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Account Dropdown Menu */}
              {accountDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#0f151b] border border-slate-700/80 shadow-2xl py-2 z-50 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150">
                  {/* User Profile Header */}
                  <div className="px-3.5 py-2.5 border-b border-slate-800 space-y-0.5">
                    <p className="font-bold text-white text-xs truncate">{user.name}</p>
                    {userSubtext && <p className="text-[11px] text-slate-400 truncate">{userSubtext}</p>}
                  </div>

                  {/* Navigation Shortcuts */}
                  <div className="py-1">
                    <button
                      onClick={() => handleNavClick('home')}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-800/80 hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Home className="w-3.5 h-3.5 text-[#00c365]" />
                      <span>My Home</span>
                    </button>

                    <button
                      onClick={() => handleNavClick('orders')}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-800/80 hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      <span>My Orders</span>
                    </button>

                    <button
                      onClick={() => handleNavClick('website')}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-800/80 hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5 text-purple-400" />
                      <span>Website Builder</span>
                    </button>

                    <button
                      onClick={() => handleNavClick('marketplace')}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-800/80 hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                      <span>Marketplace</span>
                    </button>

                    <button
                      onClick={() => handleNavClick('earn')}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-800/80 hover:text-white flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Gift className="w-3.5 h-3.5 text-[#00c365]" />
                        <span>Mystery Earn</span>
                      </div>
                      <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 bg-[#00c365]/10 text-[#00c365] rounded border border-[#00c365]/20">
                        LIVE
                      </span>
                    </button>
                  </div>

                  <button onClick={() => { setAccountDropdownOpen(false); openAccount(); }} className="w-full min-h-11 text-left px-3.5 py-2 hover:bg-slate-800 flex items-center gap-2"><UserIcon className="w-4 h-4" />My Account</button>
                  {/* Sign Out */}
                  <div className="pt-1 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setAccountDropdownOpen(false);
                        logoutUser();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => openAuth('login')}
                className="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Login
              </button>
              <button
                onClick={() => openAuth('signup')}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-black bg-[#00c365] hover:bg-[#00e575] rounded-xl transition-all shadow-[0_0_15px_rgba(0,195,101,0.25)] active:scale-95 whitespace-nowrap cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-[#0c1116] border-b border-slate-800 px-4 pt-3 pb-5 space-y-3">
          {user && (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#00c365]/20 text-[#00c365] flex items-center justify-center font-bold text-xs shrink-0">
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-white truncate">{user.name}</p>
                  {userSubtext && <p className="text-[11px] text-slate-400 truncate">{userSubtext}</p>}
                </div>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logoutUser();
                }}
                className="px-2.5 py-1 text-[11px] text-rose-400 border border-rose-500/30 bg-rose-500/10 rounded-lg shrink-0 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          )}

          <div className="space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.id}
                href={ROUTE_PATH_MAP[link.id]}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.id);
                }}
                className={`block w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  activePage === link.id
                    ? 'bg-[#00c365]/10 text-[#00c365] font-semibold'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                {link.label}
              </a>
            ))}

            <a
              href={ROUTE_PATH_MAP['earn']}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('earn');
              }}
              className={`flex items-center justify-between w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                activePage === 'earn'
                  ? 'bg-[#00c365]/10 text-[#00c365] font-semibold'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <span>Mystery Earn</span>
              <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 bg-[#00c365]/10 text-[#00c365] rounded border border-[#00c365]/20">
                LIVE
              </span>
            </a>
          </div>

          {!user && (
            <div className="pt-2 border-t border-slate-800 flex gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuth('login');
                }}
                className="flex-1 py-2 text-center text-xs font-medium text-slate-300 bg-slate-900 rounded-xl cursor-pointer"
              >
                Login
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuth('signup');
                }}
                className="flex-1 py-2 text-center text-xs font-semibold text-black bg-[#00c365] rounded-xl cursor-pointer"
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
