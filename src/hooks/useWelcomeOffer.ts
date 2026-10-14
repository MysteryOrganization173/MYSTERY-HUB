import { useEffect, useSyncExternalStore } from 'react';
import { useApp } from '../context/AppContext';
import { commercialRequest } from '../services/commercialApi';
import type { DataBundle } from '../types';
import { createWelcomeOfferCache } from '../utils/welcomeOfferCache';

const cache = createWelcomeOfferCache((id, token, signal) => commercialRequest('commercial/quote/' + encodeURIComponent(id), token, undefined, signal));

/** Homepage, Data page and their notice consume this same confirmed server eligibility. */
export function useWelcomeOffer(bundles: DataBundle[]) {
  const { user, sessionToken, orders, activeOrder, isCheckoutOpen, isStatusModalOpen } = useApp();
  const productIds = [...bundles].sort((a, b) => (a.id === 'mtn-1gb' ? -1 : b.id === 'mtn-1gb' ? 1 : b.priceGhc - a.priceGhc)).slice(0, 2).map(bundle => bundle.id);
  const orderState = orders.map(order => `${order.id}:${order.status}:${order.serverStatus}`).join('|');
  // Exclude polling timestamps: only real order/payment transitions invalidate the read.
  const key = JSON.stringify([sessionToken, user?.id, user?.phone, user?.status, user?.mustChangePassword, bundles.map(bundle => [bundle.id, bundle.priceGhc]), isCheckoutOpen, isStatusModalOpen, orderState, activeOrder?.id, activeOrder?.status, activeOrder?.serverStatus]);
  const context = { key, token: sessionToken, productIds: sessionToken && (!user || user.mustChangePassword) ? [] : productIds };
  const offer = useSyncExternalStore(cache.subscribe, () => cache.read(key), () => null);
  useEffect(() => {
    void cache.refresh(context);
    const refresh = () => { void cache.refresh(context, true); };
    const periodic = () => { void cache.refresh(context); };
    const timer = window.setInterval(periodic, 30_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [key]);
  return offer;
}
