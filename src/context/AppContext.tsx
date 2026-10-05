import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { MarketplaceOverlay, MarketplaceOverlayKind, transitionMarketplaceOverlay, closeMarketplaceOverlayState } from '../utils/marketplaceOverlay';
import {
  ActivePage,
  DataBundle,
  OrderRecord,
  PaymentMethod,
  WebsiteTemplate,
  MarketplaceProduct,
  NetworkId,
  WebsiteSiteRecord,
  SafeEditorAiContext,
} from '../types';
import { DATA_BUNDLES } from '../data/bundles';
import { SafeUserProfile } from '../../server/types/auth';
import { getMeOnServer, logoutOnServer } from '../services/apiClient';
import { readAuthBootstrap } from '../utils/authStorage';
import { initReferralCapture, observeReferralNavigation } from '../utils/referralCapture';
import {
  ROUTE_PATH_MAP,
  getPageFromPath,
  normalizePathname,
} from '../utils/routing';

export { ROUTE_PATH_MAP, getPageFromPath, normalizePathname };

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

interface AppContextType {
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;
  dataProductMode: 'data' | 'instant' | 'airtime';
  setDataProductMode: (mode: 'data' | 'instant' | 'airtime') => void;
  dataNetwork: NetworkId | 'all';
  setDataNetwork: (net: NetworkId | 'all') => void;
  openDataPage: (mode?: 'data' | 'instant' | 'airtime', network?: NetworkId | 'all') => void;
  checkoutBundle: DataBundle | null;
  checkoutInitialPhone?: string;
  openCheckout: (bundle: DataBundle, options?: { recipientPhone?: string }) => void;
  closeCheckout: () => void;
  isCheckoutOpen: boolean;
  orders: OrderRecord[];
  activeOrder: OrderRecord | null;
  openOrderStatus: (order: OrderRecord) => void;
  closeOrderStatus: () => void;
  isStatusModalOpen: boolean;
  createOrder: (
    bundle: DataBundle,
    phone: string,
    method?: PaymentMethod,
    paymentReference?: string,
    publicReference?: string
  ) => OrderRecord;
  updateOrderStatus: (
    orderId: string,
    status: OrderRecord['status'],
    extra?: { serverStatus?: string; statusMessage?: string; manualReview?: boolean }
  ) => void;
  isAuthModalOpen: boolean;
  authMode: 'login' | 'signup';
  authContextMessage: string | null;
  openAuth: (
    mode?: 'login' | 'signup',
    contextMessage?: string,
    onSuccess?: () => void
  ) => void;
  closeAuth: () => void;
  user: SafeUserProfile | null;
  sessionToken: string | null;
  isAuthChecking: boolean;
  loginUser: (profile: SafeUserProfile, token: string, rememberMe?: boolean) => void;
  logoutUser: () => void;
  isAccountOpen: boolean;
  openAccount: () => void;
  closeAccount: () => void;
  updateUserProfile: (profile: SafeUserProfile) => void;
  replaceAuthSession: (profile: SafeUserProfile, token: string) => void;
  activeEditorSite: WebsiteSiteRecord | null;
  openWebsiteEditor: (site: WebsiteSiteRecord) => void;
  closeWebsiteEditor: () => void;
  selectedTemplatePreview: WebsiteTemplate | null;
  openTemplatePreview: (template: WebsiteTemplate) => void;
  closeTemplatePreview: () => void;
  marketplaceOverlay: MarketplaceOverlay;
  openMarketplaceOverlay: (kind: MarketplaceOverlayKind, product: MarketplaceProduct, variantId?: string) => void;
  closeMarketplaceOverlay: () => void;
  dismissMarketplaceOverlay: () => void;
  marketplaceInquiryProduct: MarketplaceProduct | null;
  openMarketplaceInquiry: (product: MarketplaceProduct) => void;
  closeMarketplaceInquiry: () => void;
  waitlistInfo: { isOpen: boolean; serviceTitle: string };
  openWaitlist: (title: string) => void;
  closeWaitlist: () => void;
  isMysteryAiOpen: boolean;
  mysteryAiInitialPrompt: string | null;
  openMysteryAi: (initialPrompt?: string) => void;
  closeMysteryAi: () => void;
  editorAiContext: SafeEditorAiContext | null;
  setEditorAiContext: (ctx: SafeEditorAiContext | null) => void;
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize route from current browser URL
  const [activePage, setActivePageState] = useState<ActivePage>(() => {
    if (typeof window !== 'undefined') {
      return getPageFromPath(window.location.pathname);
    }
    return 'home';
  });

  const [dataProductMode, setDataProductMode] = useState<'data' | 'instant' | 'airtime'>('data');
  const [dataNetwork, setDataNetwork] = useState<NetworkId | 'all'>('mtn');

  const openDataPage = (
    mode: 'data' | 'instant' | 'airtime' = 'data',
    network?: NetworkId | 'all'
  ) => {
    setDataProductMode(mode);
    if (network) {
      setDataNetwork(network);
    }
    setActivePage('data');
  };

  const [checkoutBundle, setCheckoutBundle] = useState<DataBundle | null>(null);
  const [checkoutInitialPhone, setCheckoutInitialPhone] = useState<string | undefined>(undefined);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Production customer orders (starts empty - no fake demo orders)
  const [orders, setOrders] = useState<OrderRecord[]>(() => {
    try {
      const saved = localStorage.getItem('mystery_hub_orders');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  const [activeOrder, setActiveOrder] = useState<OrderRecord | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountOpen, setAccountOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authBootstrap] = useState(readAuthBootstrap);
  const [sessionToken, setSessionToken] = useState<string | null>(authBootstrap.token);
  const [user, setUser] = useState<SafeUserProfile | null>(authBootstrap.user);
  // A known cached identity renders immediately while /me validates in the background.
  const [isAuthChecking, setIsAuthChecking] = useState(Boolean(authBootstrap.token && !authBootstrap.user));

  // Recheck on refresh, focus and periodically so remote resets/revocations clear stale profiles.
  useEffect(() => {
    if (!sessionToken) { setIsAuthChecking(false); return; }
    let active = true;
    const refresh = async () => {
      try {
        const result = await getMeOnServer(sessionToken);
        if (active) updateUserProfile(result.user);
      } catch (error) {
        if (active && [401, 403].includes((error as { status?: number }).status ?? 0)) clearLocalAuth();
      } finally { if (active) setIsAuthChecking(false); }
    };
    const invalid = (event: Event) => { if ((event as CustomEvent).detail?.token === sessionToken) clearLocalAuth(); };
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('mystery-auth-refresh', refresh);
    window.addEventListener('mystery-auth-invalid', invalid);
    const storageChanged = (event: StorageEvent) => { if (event.key === 'mystery_hub_session_token') { clearLocalAuth(); } };
    window.addEventListener('storage', storageChanged);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('mystery-auth-refresh', refresh); window.removeEventListener('mystery-auth-invalid', invalid); window.removeEventListener('storage', storageChanged); };
  }, [sessionToken]);

  // Initialize and capture referral URL context across any landing route
  useEffect(() => {
    return observeReferralNavigation(() => { void initReferralCapture(sessionToken); });
  }, [sessionToken]);

  const [selectedTemplatePreview, setSelectedTemplatePreview] = useState<WebsiteTemplate | null>(null);
  const [marketplaceOverlay, setMarketplaceOverlay] = useState<MarketplaceOverlay>({kind:'none'});
  const marketplaceInquiryProduct = marketplaceOverlay.kind === 'inquiry' ? marketplaceOverlay.product : null;
  const openMarketplaceOverlay = useCallback((kind:MarketplaceOverlayKind, product:MarketplaceProduct, variantId?:string) => setMarketplaceOverlay(previous => transitionMarketplaceOverlay(previous,kind,product,variantId)),[]);
  const closeMarketplaceOverlay = useCallback(() => setMarketplaceOverlay(closeMarketplaceOverlayState),[]);
  const dismissMarketplaceOverlay = useCallback(() => setMarketplaceOverlay({kind:'none'}),[]);
  const [waitlistInfo, setWaitlistInfo] = useState<{ isOpen: boolean; serviceTitle: string }>({
    isOpen: false,
    serviceTitle: '',
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Browser History and Popstate synchronization for back/forward buttons
  useEffect(() => {
    // If the browser visibly landed on /index.html (e.g. from an old server redirect or direct link),
    // normalize the address bar to '/' cleanly without a full page reload
    if (typeof window !== 'undefined' && normalizePathname(window.location.pathname) === '/index.html') {
      window.history.replaceState({ page: 'home' }, '', '/');
    }

    const handlePopState = () => {
      const page = getPageFromPath(window.location.pathname);
      setActivePageState(page);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('mystery_hub_orders', JSON.stringify(orders));
    } catch {
      // ignore
    }
  }, [orders]);

  const setActivePage = (page: ActivePage, pushHistory = true) => {
    setActivePageState(page);

    if (pushHistory && typeof window !== 'undefined') {
      const targetPath = ROUTE_PATH_MAP[page] || '/';
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ page }, '', targetPath);
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const openCheckout = (bundle: DataBundle, options?: { recipientPhone?: string }) => {
    setCheckoutBundle(bundle);
    setCheckoutInitialPhone(options?.recipientPhone);
    setIsCheckoutOpen(true);
  };

  const closeCheckout = () => {
    setIsCheckoutOpen(false);
    setCheckoutInitialPhone(undefined);
  };

  const openOrderStatus = (order: OrderRecord) => {
    setActiveOrder(order);
    setIsStatusModalOpen(true);
  };

  const closeOrderStatus = () => {
    setIsStatusModalOpen(false);
  };

  const createOrder = (
    bundle: DataBundle,
    phone: string,
    method: PaymentMethod = 'paystack',
    paymentReference?: string,
    publicReference?: string
  ): OrderRecord => {
    const randomId = 'MH' + Math.floor(100000 + Math.random() * 900000);
    // Real backend public order reference (e.g. MH-20260930-592025)
    const realPublicRef =
      publicReference ||
      (paymentReference && paymentReference.startsWith('MH-') ? paymentReference : undefined);

    const newOrder: OrderRecord = {
      id: randomId,
      publicReference: realPublicRef,
      serverReference: realPublicRef,
      serviceType:
        bundle.serviceType ||
        (bundle.id.startsWith('instant-') ? 'instant_bundle' : bundle.id.startsWith('airtime-') ? 'airtime' : 'data'),
      bundle,
      recipientPhone: phone,
      network: bundle.network,
      paymentMethod: method,
      amountGhc: bundle.priceGhc,
      faceValueGhc: bundle.faceValueGhc,
      serviceFeeGhc: bundle.serviceFeeGhc,
      status: paymentReference ? 'verifying' : 'placed',
      paymentReference,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setOrders((prev) => [newOrder, ...prev]);
    setActiveOrder(newOrder);
    setIsCheckoutOpen(false);
    setIsStatusModalOpen(true);

    return newOrder;
  };

  const updateOrderStatus = (
    orderId: string,
    status: OrderRecord['status'],
    extra?: { serverStatus?: string; statusMessage?: string; manualReview?: boolean }
  ) => {
    // AFA orders opened from the server may not be in the legacy local order list.
    if (activeOrder?.serviceType === 'afa' && (activeOrder.id === orderId || activeOrder.publicReference === orderId)) {
      setActiveOrder({...activeOrder,status,manualReview:extra?.manualReview ?? activeOrder.manualReview,serverStatus:extra?.serverStatus || activeOrder.serverStatus,statusMessage:extra?.statusMessage,updatedAt:new Date().toISOString()});
    }
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id === orderId || (order.publicReference && order.publicReference === orderId)) {
          const updated: OrderRecord = {
            ...order,
            status,
            serverStatus: extra?.serverStatus || order.serverStatus,
            statusMessage: extra?.statusMessage !== undefined ? extra.statusMessage : order.statusMessage,
            manualReview: extra?.manualReview ?? order.manualReview,
            updatedAt: new Date().toISOString(),
          };
          if (activeOrder?.id === order.id || (activeOrder?.publicReference && activeOrder.publicReference === orderId)) {
            setActiveOrder(updated);
          }
          return updated;
        }
        return order;
      })
    );
  };

  const [authContextMessage, setAuthContextMessage] = useState<string | null>(null);
  const [pendingAuthAction, setPendingAuthAction] = useState<(() => void) | null>(null);
  const [activeEditorSite, setActiveEditorSite] = useState<WebsiteSiteRecord | null>(null);
  const [editorAiContext, setEditorAiContext] = useState<SafeEditorAiContext | null>(null);

  const [isMysteryAiOpen, setIsMysteryAiOpen] = useState(false);
  const [mysteryAiInitialPrompt, setMysteryAiInitialPrompt] = useState<string | null>(null);

  const openMysteryAi = (initialPrompt?: string) => {
    if (initialPrompt) {
      setMysteryAiInitialPrompt(initialPrompt);
    }
    setIsMysteryAiOpen(true);
  };

  const closeMysteryAi = () => {
    setIsMysteryAiOpen(false);
    setMysteryAiInitialPrompt(null);
  };

  const openWebsiteEditor = (site: WebsiteSiteRecord) => {
    setActiveEditorSite(site);
  };

  const closeWebsiteEditor = () => {
    setActiveEditorSite(null);
    setEditorAiContext(null);
  };

  const openAuth = (
    mode: 'login' | 'signup' = 'login',
    contextMessage?: string,
    onSuccess?: () => void
  ) => {
    setAuthMode(mode);
    setAuthContextMessage(contextMessage || null);
    setPendingAuthAction(onSuccess ? () => onSuccess : null);
    setIsAuthModalOpen(true);
  };

  const closeAuth = () => {
    setIsAuthModalOpen(false);
    setAuthContextMessage(null);
    setPendingAuthAction(null);
  };

  const loginUser = (profile: SafeUserProfile, token: string, rememberMe = false) => {
    setUser(profile);
    setSessionToken(token);
    try {
      if (rememberMe) {
        localStorage.setItem('mystery_hub_user', JSON.stringify(profile));
        localStorage.setItem('mystery_hub_session_token', token);
        sessionStorage.removeItem('mystery_hub_user');
        sessionStorage.removeItem('mystery_hub_session_token');
      } else {
        sessionStorage.setItem('mystery_hub_user', JSON.stringify(profile));
        sessionStorage.setItem('mystery_hub_session_token', token);
        localStorage.removeItem('mystery_hub_user');
        localStorage.removeItem('mystery_hub_session_token');
      }
    } catch {
      // ignore
    }
    setIsAuthModalOpen(false);
    setAuthContextMessage(null);
    showToast(`Welcome back, ${profile.name.split(' ')[0]}!`, 'success');

    if (pendingAuthAction && !profile.mustChangePassword) {
      const action = pendingAuthAction;
      setPendingAuthAction(null);
      setTimeout(() => {
        action();
      }, 100);
    }
  };

  const updateUserProfile = (profile: SafeUserProfile) => {
    setUser(profile);
    try {
      const storage = localStorage.getItem('mystery_hub_session_token') ? localStorage : sessionStorage;
      storage.setItem('mystery_hub_user', JSON.stringify(profile));
    } catch { /* Browser storage may be unavailable. */ }
  };
  const replaceAuthSession = (profile: SafeUserProfile, token: string) => {
    const rememberMe = Boolean(localStorage.getItem('mystery_hub_session_token'));
    setPendingAuthAction(null);
    loginUser(profile, token, rememberMe);
  };
  const clearLocalAuth = () => {
    setUser(null); setSessionToken(null); setAccountOpen(false); setPendingAuthAction(null); setIsCheckoutOpen(false);
    try { for (const storage of [localStorage, sessionStorage]) { storage.removeItem('mystery_hub_user'); storage.removeItem('mystery_hub_session_token'); } } catch { /* Ignore unavailable storage. */ }
  };
  const logoutUser = () => {
    void logoutOnServer(sessionToken);
    clearLocalAuth();
    showToast('You have been logged out.', 'info');
  };
  const openAccount = () => { if (user) setAccountOpen(true); else openAuth('login'); };
  const closeAccount = () => setAccountOpen(false);

  const openTemplatePreview = (template: WebsiteTemplate) => {
    setSelectedTemplatePreview(template);
  };

  const closeTemplatePreview = () => {
    setSelectedTemplatePreview(null);
  };

  const openMarketplaceInquiry = (product: MarketplaceProduct) => {
    openMarketplaceOverlay('inquiry',product);
  };

  const closeMarketplaceInquiry = () => {
    closeMarketplaceOverlay();
  };

  const openWaitlist = (title: string) => {
    setWaitlistInfo({ isOpen: true, serviceTitle: title });
  };

  const closeWaitlist = () => {
    setWaitlistInfo({ isOpen: false, serviceTitle: '' });
  };

  return (
    <AppContext.Provider
      value={{
        activePage,
        setActivePage,
        dataProductMode,
        setDataProductMode,
        dataNetwork,
        setDataNetwork,
        openDataPage,
        checkoutBundle,
        checkoutInitialPhone,
        openCheckout,
        closeCheckout,
        isCheckoutOpen,
        orders,
        activeOrder,
        openOrderStatus,
        closeOrderStatus,
        isStatusModalOpen,
        createOrder,
        updateOrderStatus,
        isAuthModalOpen,
        authMode,
        authContextMessage,
        openAuth,
        closeAuth,
        user,
        sessionToken,
        isAuthChecking,
        loginUser,
        logoutUser,
        isAccountOpen, openAccount, closeAccount, updateUserProfile, replaceAuthSession,
        activeEditorSite,
        openWebsiteEditor,
        closeWebsiteEditor,
        selectedTemplatePreview,
        openTemplatePreview,
        closeTemplatePreview,
        marketplaceOverlay, openMarketplaceOverlay, closeMarketplaceOverlay, dismissMarketplaceOverlay,
        marketplaceInquiryProduct,
        openMarketplaceInquiry,
        closeMarketplaceInquiry,
        waitlistInfo,
        openWaitlist,
        closeWaitlist,
        isMysteryAiOpen,
        mysteryAiInitialPrompt,
        openMysteryAi,
        closeMysteryAi,
        editorAiContext,
        setEditorAiContext,
        toasts,
        showToast,
        removeToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
