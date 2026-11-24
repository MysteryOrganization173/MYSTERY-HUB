export function sharedMerchantCheckoutAvailable(service: unknown): boolean {
  return service === 'data' || service === 'instant_bundle' || service === 'airtime';
}

export const PAYMENT_UNAVAILABLE = {
  success: false,
  code: 'PAYMENT_UNAVAILABLE',
  error: 'Online payment is currently unavailable for this service.',
} as const;
