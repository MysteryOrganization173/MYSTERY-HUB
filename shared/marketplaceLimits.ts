// Existing PostgreSQL widths: keep memory, API and browser boundaries aligned.
export const MARKETPLACE_LIMITS = {
  productName: 256, inquiryProductName: 255, availabilityLabel: 64, badge: 64,
  deliveryArea: 128, pickupId: 64, variantId: 64,
  orderProductName: 128, orderOptionLabel: 64,
} as const;
export function truncateMarketplaceText(value: string, limit: number): string {
  return value.slice(0, limit).replace(/[\uD800-\uDBFF]$/, '');
}
export function duplicateMarketplaceName(name: string): string {
  const prefix = 'Copy of ';
  return prefix + truncateMarketplaceText(name, MARKETPLACE_LIMITS.productName - prefix.length).trimEnd();
}
