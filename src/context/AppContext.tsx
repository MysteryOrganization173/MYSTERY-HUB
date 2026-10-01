import React, { createContext, useContext, useState, useEffect } from 'react';
import { ActivePage, DataBundle, OrderRecord, WebsiteTemplate, MarketplaceProduct } from '../types';
import { DATA_BUNDLES } from '../data/bundles';
import { SafeUserProfile } from '../../server/types/auth';
import { getMeOnServer, logoutOnServer } from '../services/apiClient';
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
  checkoutBundle: DataBundle | null;
  openCheckout: (bundle: DataBundle) => void;
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
    method: 'momo' | 'card' | 'bank',
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
  openAuth: (mode?: 'login' | 'signup') => void;
  closeAuth: () => void;
  user: SafeUserProfile | null;
  sessionToken: string | null;
  loginUser: (profile: SafeUserProfile, token: string, rememberMe?: boolean) => void;
  logoutUser: () => void;
  selectedTemplatePreview: WebsiteTemplate | null;
  openTemplatePreview: (template: WebsiteTemplate) => void;
  closeTemplatePreview: () => void;
  marketplaceInquiryProduct: MarketplaceProduct | null;
  openMarketplaceInquiry: (product: MarketplaceProduct) => void;
  closeMarketplaceInquiry: () => void;
  waitlistInfo: { isOpen: boolean; serviceTitle: string };
  openWaitlist: (title: string) => void;
  closeWaitlist: () => void;
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

  const [checkoutBundle, setCheckoutBundle] = useState<DataBundle | null>(null);
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

  // Verify server-side session token on startup
  useEffect(() => {
    const token = localStorage.getItem('mystery_hub_session_token') || sessionStorage.getItem('mystery_hub_session_token');
    if (!token) return;

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
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

  const openCheckout = (bundle: DataBundle) => {
    setCheckoutBundle(bundle);
    setIsCheckoutOpen(true);
  };

  const closeCheckout = () => {
    setIsCheckoutOpen(false);
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
    method: 'momo' | 'card' | 'bank',
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
      bundle,
      recipientPhone: phone,
      network: bundle.network,
      paymentMethod: method,
      amountGhc: bundle.priceGhc,
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

  const openAuth = (mode: 'login' | 'signup' = 'login') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuth = () => {
    setIsAuthModalOpen(false);
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
    showToast(`Welcome back, ${profile.name.split(' ')[0]}!`, 'success');
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
        checkoutBundle,
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
        openAuth,
        closeAuth,
        user,
        sessionToken,
        loginUser,
        logoutUser,
        selectedTemplatePreview,
        openTemplatePreview,
        closeTemplatePreview,
        marketplaceInquiryProduct,
        openMarketplaceInquiry,
        closeMarketplaceInquiry,
        waitlistInfo,
        openWaitlist,
        closeWaitlist,
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
