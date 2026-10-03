import React, { createContext, useContext, useState, useEffect } from 'react';
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
    extra?: { serverStatus?: string; statusMessage?: string }
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
  activeEditorSite: WebsiteSiteRecord | null;
  openWebsiteEditor: (site: WebsiteSiteRecord) => void;
  closeWebsiteEditor: () => void;
  selectedTemplatePreview: WebsiteTemplate | null;
  openTemplatePreview: (template: WebsiteTemplate) => void;
  closeTemplatePreview: () => void;
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
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('mystery_hub_session_token') || sessionStorage.getItem('mystery_hub_session_token');
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<SafeUserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('mystery_hub_user') || sessionStorage.getItem('mystery_hub_user');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return null;
  });

  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem('mystery_hub_session_token') || sessionStorage.getItem('mystery_hub_session_token'));
    } catch {
      return false;
    }
  });

  // Verify server-side session token on startup
  useEffect(() => {
    const token = localStorage.getItem('mystery_hub_session_token') || sessionStorage.getItem('mystery_hub_session_token');
    if (!token) {
      setIsAuthChecking(false);
      return;
    }

    let isMounted = true;
    getMeOnServer(token)
      .then((res) => {
        if (isMounted && res.success && res.user) {
          setUser(res.user);
          try {
            if (localStorage.getItem('mystery_hub_session_token')) {
              localStorage.setItem('mystery_hub_user', JSON.stringify(res.user));
            } else if (sessionStorage.getItem('mystery_hub_session_token')) {
              sessionStorage.setItem('mystery_hub_user', JSON.stringify(res.user));
            }
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setUser(null);
          setSessionToken(null);
          try {
            localStorage.removeItem('mystery_hub_session_token');
            localStorage.removeItem('mystery_hub_user');
            sessionStorage.removeItem('mystery_hub_session_token');
            sessionStorage.removeItem('mystery_hub_user');
          } catch {
            // ignore
          }
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsAuthChecking(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize and capture referral URL context across any landing route
  useEffect(() => {
    return observeReferralNavigation(() => { void initReferralCapture(sessionToken); });
  }, [sessionToken]);

  const [selectedTemplatePreview, setSelectedTemplatePreview] = useState<WebsiteTemplate | null>(null);
  const [marketplaceInquiryProduct, setMarketplaceInquiryProduct] = useState<MarketplaceProduct | null>(null);
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
    extra?: { serverStatus?: string; statusMessage?: string }
  ) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id === orderId || (order.publicReference && order.publicReference === orderId)) {
          const updated: OrderRecord = {
            ...order,
            status,
            serverStatus: extra?.serverStatus || order.serverStatus,
            statusMessage: extra?.statusMessage !== undefined ? extra.statusMessage : order.statusMessage,
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

    if (pendingAuthAction) {
      const action = pendingAuthAction;
      setPendingAuthAction(null);
      setTimeout(() => {
        action();
      }, 100);
    }
  };

  const logoutUser = () => {
    const token = sessionToken || localStorage.getItem('mystery_hub_session_token') || sessionStorage.getItem('mystery_hub_session_token');
    logoutOnServer(token);
    setUser(null);
    setSessionToken(null);
    try {
      localStorage.removeItem('mystery_hub_user');
      localStorage.removeItem('mystery_hub_session_token');
      sessionStorage.removeItem('mystery_hub_user');
      sessionStorage.removeItem('mystery_hub_session_token');
    } catch {
      // ignore
    }
    showToast('You have been logged out.', 'info');
  };

  const openTemplatePreview = (template: WebsiteTemplate) => {
    setSelectedTemplatePreview(template);
  };

  const closeTemplatePreview = () => {
    setSelectedTemplatePreview(null);
  };

  const openMarketplaceInquiry = (product: MarketplaceProduct) => {
    setMarketplaceInquiryProduct(product);
  };

  const closeMarketplaceInquiry = () => {
    setMarketplaceInquiryProduct(null);
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
        activeEditorSite,
        openWebsiteEditor,
        closeWebsiteEditor,
        selectedTemplatePreview,
        openTemplatePreview,
        closeTemplatePreview,
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
