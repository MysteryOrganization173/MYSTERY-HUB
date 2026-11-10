import { useEffect, useState } from 'react';
import { getPublicMarketplaceProducts } from '../../../services/apiClient';
import type { MarketplaceProduct } from '../../../types';

/**
 * Up to three featured products with photos, from the public Marketplace catalogue (the same list the guest homepage
 * shows), so the Marketplace shortcut can show real products. Public catalogue only, no account data. It is read once
 * per visit, after the page has settled, and remembered, so Back to the homepage shows it at once without a second
 * request or a second fade. If it cannot load, the shortcut keeps its illustration.
 */
let cache: MarketplaceProduct[] | null = null;

export function useMarketPreview(delayMs = 1200): { items: MarketplaceProduct[]; fresh: boolean } {
  const [state, setState] = useState(() => ({ items: cache || [], fresh: false }));
  useEffect(() => {
    if (cache) return;
    let on = true;
    const timer = window.setTimeout(() => {
      getPublicMarketplaceProducts({ featured: true })
        .then(res => {
          if (!res.success) return;
          cache = (res.products || []).filter(p => p.imageUrl).slice(0, 3);
          if (on) setState({ items: cache, fresh: true });
        })
        .catch(() => undefined);
    }, delayMs);
    return () => { on = false; window.clearTimeout(timer); };
  }, [delayMs]);
  return state;
}
