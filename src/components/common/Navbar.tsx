import React, { useState, useEffect, useRef } from 'react';
import { useOverlayLock } from '../../utils/overlayStack';
import { ShareAppButton } from '../app/ShareAppButton';
import { useApp, ROUTE_PATH_MAP } from '../../context/AppContext';
import { BrandLogo } from './BrandLogo';
import { Seasonal, SeasonalShell } from '../../seasonal/Seasonal';
import { ownerHasWebsite } from '../../hooks/useOwnerWebsites';
import { WEBSITE_DESIGNS_PATH } from '../../utils/businessWorkspace';
import { ActivePage } from '../../types';
import { openMarketplaceAt } from '../../utils/marketplaceBrowse';
import { openServicesAt } from '../../utils/serviceDirectory';
import { formatGhanaPhone } from '../../utils/checkoutRecovery';
import { openNotificationSettings } from '../pwa/NotificationsEntry';
import { openNotificationCenter, useNotificationCenterOpen } from '../notifications/NotificationCenter';
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
  Wifi,
  Gift,
  Wallet,
  MessageCircle,
  Briefcase,
  ReceiptText,
  LayoutGrid,
  Info,
  CircleHelp,
  Bell,
  type LucideIcon,
} from 'lucide-react';

/** One entry in the phone and tablet menu. `wide` entries repeat a bottom-nav page, so they appear only from 768px, where the bottom nav is hidden. */
interface MenuEntry { key: string; label: string; Icon: LucideIcon; onSelect: () => void; current?: boolean; wide?: boolean; className?: string; href?: string }

export const Navbar: React.FC = () => {
  const { activePage, setActivePage, openAuth, openMysteryAi, user, logoutUser, openAccount, sessionToken } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const centerOpen = useNotificationCenterOpen();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);

  // V5.2: the phone menu is a blocking overlay. The page behind it stays still (the menu scrolls by itself), the rest
  // of the app is inert, and the lock is released on close, navigation, Back, or when the window grows to desktop.
  useOverlayLock(mobileMenuOpen, headerRef);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const desktop = window.matchMedia('(min-width: 1280px)');
    const close = () => setMobileMenuOpen(false);
    // Back closes it (above) and returns focus to the button that opened it.
    const onBack = () => menuTrigger.current?.focus();
    const onWidth = () => { if (desktop.matches) close(); };
    desktop.addEventListener('change', onWidth);
    window.addEventListener('popstate', close);
    window.addEventListener('popstate', onBack);
    // Also marked on the root element, for browsers without :has() (the bottom bar steps aside either way).
    document.documentElement.classList.add('mh-menu-open');
    return () => { desktop.removeEventListener('change', onWidth); window.removeEventListener('popstate', close); window.removeEventListener('popstate', onBack); document.documentElement.classList.remove('mh-menu-open'); };
  }, [mobileMenuOpen]);
  // The account dropdown belongs to the desktop header only; below 1280px its trigger is hidden, so it closes too.
  useEffect(() => {
    if (!accountDropdownOpen) return;
    const desktop = window.matchMedia('(min-width: 1280px)');
    const close = () => setAccountDropdownOpen(false);
    const onWidth = () => { if (!desktop.matches) close(); };
    desktop.addEventListener('change', onWidth);
    window.addEventListener('popstate', close);
    return () => { desktop.removeEventListener('change', onWidth); window.removeEventListener('popstate', close); };
  }, [accountDropdownOpen]);
  // Signing in or out swaps the menu's contents; never leave one open across that change.
  useEffect(() => { setMobileMenuOpen(false); setAccountDropdownOpen(false); }, [user?.id]);

  const navLinks: { id: ActivePage; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'data', label: 'Data' },
    { id: 'website', label: 'Website Builder' },
    { id: 'marketplace', label: 'Marketplace' },
    { id: 'services', label: 'More Services' },
    { id: 'about', label: 'About' },
    { id: 'help', label: 'Help & FAQs' },
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
        setAccountDropdownOpen(open=>{if(open)accountTrigger.current?.focus();return false;});
        setMobileMenuOpen(open => { if (open) menuTrigger.current?.focus(); return false; });
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

  const closeMenus = () => { setMobileMenuOpen(false); setAccountDropdownOpen(false); };
  const handleNavClick = (pageId: ActivePage) => {
    // V7.2.1: an owner's Website is My Business (the Builder redirects too; this skips that step).
    setActivePage(pageId === 'website' && ownerHasWebsite(sessionToken) ? 'business' : pageId);
    setMobileMenuOpen(false);
    setAccountDropdownOpen(false);
  };

  // Beside My Business, the account menu's Website Builder is the design gallery itself, for owners too.
  const openDesigns = () => {
    if (window.location.pathname !== WEBSITE_DESIGNS_PATH) window.history.pushState({ page: 'website' }, '', WEBSITE_DESIGNS_PATH);
    setActivePage('website', false);
    setMobileMenuOpen(false);
    setAccountDropdownOpen(false);
  };
  // My Account is a dialog: focus returns to the visible menu trigger when it closes.
  const showAccount = (trigger: React.RefObject<HTMLButtonElement | null>) => { trigger.current?.focus(); closeMenus(); openAccount(); };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    if (q.includes('faq') || q.includes('help') || q.includes('support')) {
      setActivePage('help');
    } else if (q.includes('wallet') || q.includes('top up')) {
      setActivePage('wallet');
    } else if (q.includes('earn') || q.includes('referral') || q.includes('reward') || q.includes('affiliate') || q.includes('share')) {
      setActivePage('earn');
    } else if (q.includes('data') || q.includes('mtn') || q.includes('telecel') || q.includes('bundle') || q.includes('airteltigo')) {
      setActivePage('data');
    } else if (q.includes('web') || q.includes('site') || q.includes('build') || q.includes('template')) {
      setActivePage('website');
    } else if (q.includes('market') || q.includes('laptop') || q.includes('tech') || q.includes('tool') || q.includes('mic') || q.includes('phone') || q.includes('charger')) {
      // Land on matching products rather than the full feed ("marketplace" itself is just navigation).
      openMarketplaceAt(setActivePage, { q: /market/.test(q) ? '' : searchQuery.trim() });
    } else {
      // Anything else is looked up in the service directory (e.g. "electricity", "dstv").
      openServicesAt(setActivePage, { q: searchQuery.trim() });
    }
    setSearchOpen(false);
    setSearchQuery('');
  };

  const userFirstName = user?.name ? user.name.split(' ')[0] : 'Member';
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'M';
  // The secondary line identifies the account: the phone reads as a local number, otherwise the email.
  const userSubtext = user?.phone ? formatGhanaPhone(user.phone) : user?.email || '';
  const isCurrent = (id: ActivePage) => activePage === id || (id === 'website' && activePage === 'business') || (id === 'marketplace' && activePage === 'creative');

  // Phone and tablet menu. Shortcuts first for members; pages the bottom nav already shows appear only from 768px.
  const shortcuts: MenuEntry[] = user ? [
    { key: 'orders', label: 'My Orders', Icon: ReceiptText, onSelect: () => handleNavClick('orders'), current: activePage === 'orders' },
    { key: 'wallet', label: 'Wallet', Icon: Wallet, onSelect: () => handleNavClick('wallet'), current: activePage === 'wallet' },
    { key: 'business', label: 'My Business', Icon: Briefcase, onSelect: () => handleNavClick('business'), current: activePage === 'business' },
    { key: 'earn', label: 'Earn', Icon: Gift, onSelect: () => handleNavClick('earn'), current: activePage === 'earn' },
  ] : [];
  const explore: MenuEntry[] = [
    { key: 'home', label: 'Home', Icon: Home, onSelect: () => handleNavClick('home'), current: activePage === 'home', wide: true, href: ROUTE_PATH_MAP.home },
    { key: 'data', label: 'Data & Airtime', Icon: Wifi, onSelect: () => handleNavClick('data'), current: activePage === 'data', wide: true, href: ROUTE_PATH_MAP.data },
    user
      ? { key: 'website', label: 'Website Builder', Icon: Globe, onSelect: openDesigns, current: activePage === 'website', href: WEBSITE_DESIGNS_PATH }
      : { key: 'website', label: 'Website Builder', Icon: Globe, onSelect: () => handleNavClick('website'), current: isCurrent('website'), href: ROUTE_PATH_MAP.website },
    { key: 'marketplace', label: 'Marketplace', Icon: ShoppingBag, onSelect: () => handleNavClick('marketplace'), current: isCurrent('marketplace'), href: ROUTE_PATH_MAP.marketplace },
    { key: 'services', label: 'More Services', Icon: LayoutGrid, onSelect: () => handleNavClick('services'), current: activePage === 'services', href: ROUTE_PATH_MAP.services },
    ...(!user ? [
      { key: 'earn', label: 'Mystery Earn', Icon: Gift, onSelect: () => handleNavClick('earn'), current: activePage === 'earn', wide: true, href: ROUTE_PATH_MAP.earn },
      { key: 'orders', label: 'Track an order', Icon: ReceiptText, onSelect: () => handleNavClick('orders'), current: activePage === 'orders', wide: true, href: ROUTE_PATH_MAP.orders },
    ] : []),
    { key: 'about', label: 'About', Icon: Info, onSelect: () => handleNavClick('about'), current: activePage === 'about', href: ROUTE_PATH_MAP.about },
  ];
  const help: MenuEntry[] = [
    ...(user ? [{ key: 'account', label: 'My Account', Icon: UserIcon, onSelect: () => showAccount(menuTrigger) }] : []),
    { key: 'help', label: 'Help & FAQs', Icon: CircleHelp, onSelect: () => handleNavClick('help'), current: activePage === 'help', href: ROUTE_PATH_MAP.help },
    { key: 'ai', label: 'Ask Mystery AI', Icon: MessageCircle, onSelect: () => { setMobileMenuOpen(false); openMysteryAi(); }, className: 'mh-menu-ai' },
    // Visitors manage news for this browser here; members manage notifications in My Account.
    ...(!user ? [{ key: 'notifications', label: 'Notifications', Icon: Bell, onSelect: () => { setMobileMenuOpen(false); openNotificationSettings(); } }] : []),
  ];
  const renderEntry = (entry: MenuEntry) => {
    const { current } = entry;
    const className = `mh-menu-link ${entry.className || ''} flex items-center gap-3 w-full min-h-11 px-3 rounded-xl text-left text-sm font-medium transition-colors cursor-pointer ${
      current ? 'bg-[#00c365]/10 text-[#00c365] font-semibold' : 'text-slate-200 hover:bg-slate-900 hover:text-white'
    }`;
    const body = <><entry.Icon className="w-4 h-4 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{entry.label}</span></>;
    return <li key={entry.key} className={entry.wide ? 'hidden md:block' : undefined}>
      {entry.href
        ? <a href={entry.href} onClick={(e) => { e.preventDefault(); entry.onSelect(); }} aria-current={current ? 'page' : undefined} className={className}>{body}</a>
        : <button type="button" onClick={entry.onSelect} className={className}>{body}</button>}
    </li>;
  };
  const groupHeading = 'px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400';

  return (
    <header ref={headerRef} className="sticky top-0 z-40 bg-[#0a0e11]/90 backdrop-blur-md border-b border-slate-800/80">
      <Seasonal slot="header" />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-1 sm:gap-4">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleNavClick('home');
          }}
          className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365] rounded-lg transition-transform active:scale-95 inline-flex items-center shrink-0"
          aria-label="Mystery Hub Homepage"
        >
          <BrandLogo size="sm" priority="high" wordmarkClassName="max-sm:text-sm whitespace-nowrap sm:!text-lg" />
          <SeasonalShell slot="logo-hat" />
        </a>

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav aria-label="Main" className="hidden xl:flex items-center gap-3 text-xs font-medium text-slate-300">
          {navLinks.map((link) => {
            const current = isCurrent(link.id);
            return (
              <a
                key={link.id}
                href={ROUTE_PATH_MAP[link.id]}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.id);
                }}
                aria-current={current ? 'page' : undefined}
                className={`transition-colors min-h-11 flex items-center relative whitespace-nowrap cursor-pointer ${
                  current ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'
                }`}
              >
                {link.label}
                {current && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00c365] rounded-full shadow-[0_0_8px_rgba(0,195,101,0.6)]" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Actions & Auth */}
        <div className="flex items-center gap-0.5 sm:gap-2">
          {/* Quick Search Toggle */}
          <div className="relative min-w-11">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="fixed left-3 right-3 top-16 mt-2 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-4 p-2 bg-[#0c1116] border border-slate-700 rounded-xl shadow-xl flex items-center sm:w-[min(20rem,calc(100vw-2rem))]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search services..."
                  aria-label="Search services"
                  autoFocus
                  className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-2.5 py-1.5 w-full min-w-0 min-h-11 focus:outline-none focus:border-[#00c365]"
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="ml-1 min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Close search"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => { closeMenus(); setSearchOpen(true); }}
                className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                title="Search Mystery Hub"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Labelled shortcuts from 768px; on phones the menu and bottom nav carry them. */}
          {user&&<button onClick={()=>handleNavClick('wallet')} className="hidden md:flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800" aria-label="Mystery Wallet" title="Mystery Wallet"><Wallet className="w-4 h-4"/></button>}
          <button type="button" onClick={() => openMysteryAi()} className="hidden md:flex min-h-11 min-w-11 items-center justify-center text-slate-300 hover:text-[#00c365] hover:bg-slate-800/60 rounded-lg" aria-label="Open Mystery AI Assistant" title="Ask Mystery AI"><MessageCircle className="w-4 h-4" /></button>
          {/* Mystery Earn Shortcut */}
          <button
            onClick={() => handleNavClick('earn')}
            className="hidden md:flex relative min-w-11 min-h-11 items-center justify-center text-slate-400 hover:text-[#00c365] hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
            title="Mystery Earn"
            aria-label="Mystery Earn"
          >
            <Gift className="w-4 h-4 text-[#00c365]" />
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2" aria-hidden="true">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00c365]" />
            </span>
          </button>

          {/* 3.4.1: the Notification Center, for members at every width. No count: nothing here knows what was read. */}
          {user && <button type="button" onClick={() => { closeMenus(); setSearchOpen(false); openNotificationCenter(); }} aria-haspopup="dialog" aria-expanded={centerOpen}
            className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365]"
            aria-label="Notifications" title="Notifications"><Bell className="w-[18px] h-[18px]" aria-hidden="true" /></button>}

          {/* Desktop account dropdown (from 1280px). Below that, the single menu button carries the account. */}
          {user ? (
            <div className="relative hidden xl:block" ref={dropdownRef}>
              <button
                ref={accountTrigger}
                aria-label="Account navigation" aria-controls="account-navigation"
                onClick={() => {setMobileMenuOpen(false);setAccountDropdownOpen(!accountDropdownOpen);}}
                className="min-h-11 min-w-11 flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-slate-200 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#00c365]"
                aria-expanded={accountDropdownOpen}
              >
                <div className="w-5 h-5 rounded-full bg-[#00c365]/20 text-[#00c365] flex items-center justify-center font-bold text-[10px]" aria-hidden="true">
                  {userInitial}
                </div>
                <span className="font-medium truncate max-w-[110px]">{userFirstName}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${accountDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {/* Account Dropdown Menu: the account itself. Site pages are in the header links beside it. */}
              {accountDropdownOpen && (
                <div id="account-navigation" role="region" aria-label="Account shortcuts" className="absolute right-0 mt-2 w-64 max-h-[calc(100dvh-5rem)] overflow-auto rounded-2xl bg-[#0f151b] border border-slate-700/80 shadow-2xl py-2 z-50 text-sm text-slate-200 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-[#00c365]/20 text-[#00c365] flex items-center justify-center font-bold text-sm shrink-0" aria-hidden="true">{userInitial}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-white text-sm truncate">{user.name}</p>
                      {userSubtext && <p className="text-xs text-slate-400 truncate">{userSubtext}</p>}
                    </div>
                  </div>
                  <ul className="py-1">
                    <li><button onClick={() => handleNavClick('orders')} aria-current={activePage === 'orders' ? 'page' : undefined} className="w-full min-h-11 text-left px-4 flex items-center gap-3 hover:bg-slate-800/80 hover:text-white aria-[current=page]:text-[#00c365]"><ReceiptText className="w-4 h-4 text-sky-400" aria-hidden="true" />My Orders</button></li>
                    <li><button onClick={() => handleNavClick('wallet')} aria-current={activePage === 'wallet' ? 'page' : undefined} className="w-full min-h-11 text-left px-4 flex items-center gap-3 hover:bg-slate-800/80 hover:text-white aria-[current=page]:text-[#00c365]"><Wallet className="w-4 h-4 text-slate-300" aria-hidden="true" />Mystery Wallet</button></li>
                    <li><button onClick={() => handleNavClick('business')} aria-current={activePage === 'business' ? 'page' : undefined} className="w-full min-h-11 text-left px-4 flex items-center gap-3 hover:bg-slate-800/80 hover:text-white aria-[current=page]:text-[#00c365]"><Briefcase className="w-4 h-4 text-emerald-300" aria-hidden="true" />My Business</button></li>
                    {/* The header link takes owners to My Business; this opens the design gallery itself. */}
                    <li><button onClick={openDesigns} className="w-full min-h-11 text-left px-4 flex items-center gap-3 hover:bg-slate-800/80 hover:text-white"><Globe className="w-4 h-4 text-purple-400" aria-hidden="true" />Website Builder</button></li>
                    <li><button onClick={() => handleNavClick('earn')} aria-current={activePage === 'earn' ? 'page' : undefined} className="w-full min-h-11 text-left px-4 flex items-center justify-between gap-3 hover:bg-slate-800/80 hover:text-white aria-[current=page]:text-[#00c365]">
                      <span className="flex items-center gap-3"><Gift className="w-4 h-4 text-[#00c365]" aria-hidden="true" />Mystery Earn</span>
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 bg-[#00c365]/10 text-[#00c365] rounded border border-[#00c365]/20">Live</span>
                    </button></li>
                  </ul>
                  <ul className="py-1 border-t border-slate-800">
                    <li><button onClick={() => showAccount(accountTrigger)} className="w-full min-h-11 text-left px-4 flex items-center gap-3 hover:bg-slate-800"><UserIcon className="w-4 h-4" aria-hidden="true" />My Account</button></li>
                    <li><ShareAppButton onDone={() => setAccountDropdownOpen(false)} className="w-full min-h-11 text-left px-4 flex items-center gap-3 hover:bg-slate-800 cursor-pointer" /></li>
                  </ul>
                  <div className="pt-1 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setAccountDropdownOpen(false);
                        logoutUser();
                      }}
                      className="w-full min-h-11 text-left px-4 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 flex items-center gap-3 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" aria-hidden="true" />
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
                className="mh-login hidden sm:inline-flex min-h-11 items-center px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Login
              </button>
              <button
                onClick={() => openAuth('signup')}
                className="mh-signup min-h-11 px-2 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-black bg-[#00c365] hover:bg-[#00e575] rounded-xl transition-all shadow-[0_0_15px_rgba(0,195,101,0.25)] active:scale-95 whitespace-nowrap cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          )}

          {/* The one menu button below 1280px. For members it carries their initial, so it reads as the account menu. */}
          <button
            ref={menuTrigger}
            onClick={() => {setAccountDropdownOpen(false);setSearchOpen(false);setMobileMenuOpen(!mobileMenuOpen);}}
            aria-expanded={mobileMenuOpen} aria-controls="mobile-menu"
            className={`mh-menu-trigger xl:hidden min-w-11 min-h-11 flex items-center justify-center gap-1.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365] cursor-pointer ${
              user ? 'pl-1.5 pr-2 bg-slate-900/90 border border-slate-800 text-slate-200 hover:border-slate-700' : 'p-2 text-slate-400 hover:text-white'
            }`}
            aria-label={user ? (mobileMenuOpen ? 'Close account menu' : 'Open account menu') : (mobileMenuOpen ? 'Close menu' : 'Open menu')}
          >
            {user && <span className="w-6 h-6 rounded-full bg-[#00c365]/20 text-[#00c365] flex items-center justify-center font-bold text-[11px]" aria-hidden="true">{userInitial}</span>}
            {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Phone and tablet menu: one place for the account and the site. */}
      {mobileMenuOpen && (
        <div className="mh-mobile-menu xl:hidden">
        <nav id="mobile-menu" aria-label={user ? 'Account and site menu' : 'Site menu'} className="mh-mobile-menu-panel bg-[#0c1116] border-b border-slate-800 px-4 pt-3 pb-5">
          <SeasonalShell slot="menu-header" />
          <div className="mx-auto max-w-2xl space-y-4">
            {user && (
              <>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                  <span className="w-10 h-10 rounded-full bg-[#00c365]/20 text-[#00c365] flex items-center justify-center font-bold text-sm shrink-0" aria-hidden="true">{userInitial}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-white truncate">{user.name}</p>
                    {userSubtext && <p className="text-xs text-slate-400 truncate">{userSubtext}</p>}
                  </div>
                </div>
                <ul aria-label="Your account" className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {shortcuts.map(entry => (
                    <li key={entry.key}>
                      <button type="button" onClick={entry.onSelect} aria-current={entry.current ? 'page' : undefined}
                        className={`flex items-center gap-2.5 w-full min-h-12 px-3 rounded-xl border text-left text-sm font-semibold transition-colors cursor-pointer ${entry.current ? 'border-[#00c365]/40 bg-[#00c365]/10 text-[#00c365]' : 'border-slate-800 bg-slate-900/60 text-slate-100 hover:border-slate-700 hover:bg-slate-900'}`}>
                        <entry.Icon className="w-4 h-4 shrink-0" aria-hidden="true" /><span className="truncate">{entry.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <section aria-labelledby="menu-explore">
                <h2 id="menu-explore" className={groupHeading}>Explore</h2>
                <ul className="space-y-0.5">{explore.map(renderEntry)}</ul>
              </section>
              <section aria-labelledby="menu-help">
                <h2 id="menu-help" className={groupHeading}>{user ? 'Account & help' : 'Help'}</h2>
                <ul className="space-y-0.5">
                  {help.map(renderEntry)}
                  <li><ShareAppButton onDone={() => setMobileMenuOpen(false)} className="mh-menu-link flex items-center gap-3 w-full min-h-11 px-3 rounded-xl text-sm font-medium text-slate-200 hover:bg-slate-900 cursor-pointer" /></li>
                  {user && (
                    <li className="pt-1 mt-1 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          logoutUser();
                        }}
                        className="flex items-center gap-3 w-full min-h-11 px-3 rounded-xl text-left text-sm font-medium text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" aria-hidden="true" />Sign Out
                      </button>
                    </li>
                  )}
                </ul>
              </section>
            </div>

            {!user && (
              <div className="mh-menu-auth pt-3 border-t border-slate-800 flex gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAuth('login');
                  }}
                  className="mh-login flex-1 min-h-11 text-center text-sm font-medium text-slate-200 bg-slate-900 rounded-xl cursor-pointer"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAuth('signup');
                  }}
                  className="mh-signup flex-1 min-h-11 text-center text-sm font-semibold text-black bg-[#00c365] rounded-xl cursor-pointer"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </nav>
        <div className="mh-mobile-menu-scrim" aria-hidden="true" onClick={() => { setMobileMenuOpen(false); menuTrigger.current?.focus(); }} />
        </div>
      )}
    </header>
  );
};
