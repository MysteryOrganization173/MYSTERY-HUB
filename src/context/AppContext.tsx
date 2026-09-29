import React, { createContext, useContext, useState, useEffect } from 'react';
import { ActivePage, DataBundle, OrderRecord, WebsiteTemplate } from '../types';
import { DATA_BUNDLES } from '../data/bundles';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

interface UserProfile {
  name: string;
  phone: string;
  email: string;
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
  createOrder: (bundle: DataBundle, phone: string, method: 'momo' | 'card' | 'bank') => OrderRecord;
  updateOrderStatus: (orderId: string, status: OrderRecord['status']) => void;
  isAuthModalOpen: boolean;
  authMode: 'login' | 'signup';
  openAuth: (mode?: 'login' | 'signup') => void;
  closeAuth: () => void;
  user: UserProfile | null;
  loginUser: (profile: UserProfile) => void;
  logoutUser: () => void;
  selectedTemplatePreview: WebsiteTemplate | null;
  openTemplatePreview: (template: WebsiteTemplate) => void;
  closeTemplatePreview: () => void;
  waitlistInfo: { isOpen: boolean; serviceTitle: string };
  openWaitlist: (title: string) => void;
  closeWaitlist: () => void;
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Initial realistic demo order history for Ghana
const INITIAL_DEMO_ORDERS: OrderRecord[] = [
  {
    id: 'MH849201',
    bundle: DATA_BUNDLES[0], // MTN 1GB
    recipientPhone: '024 456 7890',
    network: 'mtn',
    paymentMethod: 'momo',
    amountGhc: 4.99,
    status: 'delivered',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2 + 15000).toISOString(),
  },
  {
    id: 'MH849182',
    bundle: DATA_BUNDLES[2], // MTN 5GB
    recipientPhone: '055 123 9988',
    network: 'mtn',
    paymentMethod: 'momo',
    amountGhc: 24.99,
    status: 'delivered',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 + 20000).toISOString(),
  },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePage, setActivePageState] = useState<ActivePage>('home');
  const [checkoutBundle, setCheckoutBundle] = useState<DataBundle | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orders, setOrders] = useState<OrderRecord[]>(() => {
    try {
      const saved = localStorage.getItem('mystery_hub_orders');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_DEMO_ORDERS;
  });

  const [activeOrder, setActiveOrder] = useState<OrderRecord | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('mystery_hub_user');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return null;
  });

  const [selectedTemplatePreview, setSelectedTemplatePreview] = useState<WebsiteTemplate | null>(null);
  const [waitlistInfo, setWaitlistInfo] = useState<{ isOpen: boolean; serviceTitle: string }>({
    isOpen: false,
    serviceTitle: '',
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem('mystery_hub_orders', JSON.stringify(orders));
    } catch {
      // ignore
    }
  }, [orders]);

  const setActivePage = (page: ActivePage) => {
    setActivePageState(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const createOrder = (bundle: DataBundle, phone: string, method: 'momo' | 'card' | 'bank'): OrderRecord => {
    const randomId = 'MH' + Math.floor(100000 + Math.random() * 900000);
    const newOrder: OrderRecord = {
      id: randomId,
      bundle,
      recipientPhone: phone,
      network: bundle.network,
      paymentMethod: method,
      amountGhc: bundle.priceGhc,
      status: 'placed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setOrders((prev) => [newOrder, ...prev]);
    setActiveOrder(newOrder);
    setIsCheckoutOpen(false);
    setIsStatusModalOpen(true);

    // Simulate realistic asynchronous transaction progress:
    // Placed -> Processing (after 1.5s) -> Delivered (after 4s)
    setTimeout(() => {
      updateOrderStatus(newOrder.id, 'processing');
    }, 1800);

    setTimeout(() => {
      updateOrderStatus(newOrder.id, 'delivered');
      showToast(`Data bundle delivered successfully to ${phone}!`, 'success');
    }, 5500);

    return newOrder;
  };

  const updateOrderStatus = (orderId: string, status: OrderRecord['status']) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id === orderId) {
          const updated = { ...order, status, updatedAt: new Date().toISOString() };
          if (activeOrder?.id === orderId) {
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

  const loginUser = (profile: UserProfile) => {
    setUser(profile);
    try {
      localStorage.setItem('mystery_hub_user', JSON.stringify(profile));
    } catch {
      // ignore
    }
    setIsAuthModalOpen(false);
    showToast(`Welcome back, ${profile.name.split(' ')[0]}!`, 'success');
  };

  const logoutUser = () => {
    setUser(null);
    try {
      localStorage.removeItem('mystery_hub_user');
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
        loginUser,
        logoutUser,
        selectedTemplatePreview,
        openTemplatePreview,
        closeTemplatePreview,
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
