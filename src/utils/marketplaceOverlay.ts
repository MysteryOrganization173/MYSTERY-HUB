import type { MarketplaceProduct } from '../types';
export type MarketplaceOverlayKind = 'detail' | 'checkout' | 'inquiry' | 'share';
export type MarketplaceOverlay = { kind: 'none' } | {
  kind: MarketplaceOverlayKind; product: MarketplaceProduct; variantId?: string; returnToDetail: boolean;
};
export function transitionMarketplaceOverlay(previous: MarketplaceOverlay, kind: MarketplaceOverlayKind, product: MarketplaceProduct, variantId?: string): MarketplaceOverlay {
  const sameProduct = previous.kind !== 'none' && previous.product.id === product.id;
  return { kind, product, variantId: variantId ?? (sameProduct ? previous.variantId : undefined),
    returnToDetail: kind !== 'detail' && sameProduct && (previous.kind === 'detail' || previous.returnToDetail) };
}
export function closeMarketplaceOverlayState(previous: MarketplaceOverlay): MarketplaceOverlay {
  return previous.kind !== 'none' && previous.returnToDetail
    ? { ...previous, kind: 'detail', returnToDetail: false } : { kind: 'none' };
}
