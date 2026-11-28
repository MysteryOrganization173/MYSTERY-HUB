import { useEffect, useSyncExternalStore } from 'react';
import { useApp } from '../context/AppContext';
import { commercialRequest } from '../services/commercialApi';
import type { DataBundle } from '../types';
import { createWelcomeOfferCache } from '../utils/welcomeOfferCache';
import { directCatalogConfirmed } from './useDirectCatalog';

const cache = createWelcomeOfferCache((id, token, signal) => commercialRequest('commercial/quote/' + encodeURIComponent(id), token, undefined, signal));

/** Homepage, Data page and their notice consume this same confirmed server eligibility. */
export function useWelcomeOffer(bundles: DataBundle[]) { return useWelcomeOfferState(bundles).offer; }

/** The offer, plus whether the server has answered for this identity yet (so a page can stop holding room for it). */
export function useWelcomeOfferState(bundles: DataBundle[]) {
  const { user, sessionToken, orders, activeOrder, isCheckoutOpen, isStatusModalOpen } = useApp();
  const productIds = [...bundles].sort((a, b) => (a.id === 'mtn-1gb' ? -1 : b.id === 'mtn-1gb' ? 1 : b.priceGhc - a.priceGhc)).slice(0, 2).map(bundle => bundle.id);
  const orderState = orders.map(order => `${order.id}:${order.status}:${order.serverStatus}`).join('|');
  // 3.7.3: asked once the server's own catalogue is on the page. Asking with the bundled prices first meant a second
  // read moments later (the prices are part of the key), and the notice vanished and came back, moving the page twice.
  const catalogConfirmed = directCatalogConfirmed();
  // Exclude polling timestamps: only real order/payment transitions invalidate the read.
  const key = JSON.stringify([catalogConfirmed, sessionToken, user?.id, user?.phone, user?.status, user?.mustChangePassword, bundles.map(bundle => [bundle.id, bundle.priceGhc]), isCheckoutOpen, isStatusModalOpen, orderState, activeOrder?.id, activeOrder?.status, activeOrder?.serverStatus]);
  const context = { key, token: sessionToken, productIds: !catalogConfirmed || (sessionToken && (!user || user.mustChangePassword)) ? [] : productIds };
  const offer = useSyncExternalStore(cache.subscribe, () => cache.read(key), () => null);
  const settled = useSyncExternalStore(cache.subscribe, () => cache.settled(key), () => false);
  useEffect(() => {
    void cache.refresh(context);
    const refresh = () => { void cache.refresh(context, true); };
    // 3.7.3: the periodic re-read waits while the page is in the background. Returning reads again at once, as before:
    // a desktop sends focus (and visibilitychange together, which share one re-read); a phone may send only
    // visibilitychange.
    const periodic = () => { if (document.visibilityState !== 'hidden') void cache.refresh(context); };
    let lastReturn = 0;
    const onReturn = () => {
      if (document.visibilityState === 'hidden' || Date.now() - lastReturn < 1000) return;
      lastReturn = Date.now(); refresh();
    };
    const timer = window.setInterval(periodic, 30_000);
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onReturn); document.removeEventListener('visibilitychange', onReturn); };
  }, [key]);
  return { offer, settled };
}
