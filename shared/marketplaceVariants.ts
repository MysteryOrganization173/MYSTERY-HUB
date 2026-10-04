import { MARKETPLACE_LIMITS } from './marketplaceLimits.js';
export interface PurchasableOption { id: string; name: string; priceMinor: number; active?: boolean; }
export function purchasableOptions<T extends PurchasableOption>(options: T[] = []): T[] {
  return options.filter(v => typeof v.id === 'string' && !!v.id.trim() && v.id.length <= MARKETPLACE_LIMITS.variantId && typeof v.name === 'string' && !!v.name.trim() && v.active !== false && Number.isSafeInteger(v.priceMinor) && v.priceMinor > 0 && v.priceMinor <= 2147483647);
}
export function marketplaceOptionPrice(base: number | null, options: PurchasableOption[] = []): number | null {
  const valid = purchasableOptions(options);
  return valid.length ? Math.min(...valid.map(v => v.priceMinor)) : options.length ? null : base;
}
export function initialMarketplaceOption(options: PurchasableOption[], requested?: string): string | undefined {
  const valid = purchasableOptions(options);
  if (requested) return valid.some(v => v.id === requested) ? requested : undefined;
  return valid.length === 1 ? valid[0].id : undefined;
}
