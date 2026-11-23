import { sharedMerchantCheckoutAvailable } from '../../shared/paymentAvailability.js';
import { getAuthoritativeProduct } from '../data/productCatalog.js';
import type { OrderRecord } from '../types/orders.js';

export function isMainTelecomOrder(order: OrderRecord): boolean {
  return order.store_context == null && order.marketplace_context == null && sharedMerchantCheckoutAvailable(order.service_type);
}

// Older server-created Data attempts can still have a saved checkout. Store attempts have their own reference namespace.
export function isDirectDataCheckout(order: OrderRecord): boolean {
  if (order.service_type == null) return isSharedMerchantOrder({ ...order, service_type: 'data' });
  return order.service_type === 'data' && isMainTelecomOrder(order) &&
    order.payment_provider === 'paystack' && !order.payment_reference.startsWith('MH_STORE_');
}

export function isSharedMerchantOrder(order: OrderRecord): boolean {
  if (!isMainTelecomOrder(order) || order.payment_provider !== 'paystack') return false;
  const network = order.network;
  if (network !== 'mtn' && network !== 'telecel' && network !== 'airteltigo') return false;
  let prefix: string;
  switch (order.service_type) {
    case 'data': {
      const product = getAuthoritativeProduct(order.product_id);
      if (product?.id !== order.product_id || product.network !== network) return false;
      prefix = 'MH_PAY_';
      break;
    }
    case 'instant_bundle':
      if (!order.product_id.startsWith('instant-') || order.product_id.length <= 'instant-'.length) return false;
      prefix = 'MH_PAY_INSTANT_';
      break;
    case 'airtime':
      if (!order.product_id.startsWith(`airtime-${network}-`) || !order.face_value_minor) return false;
      prefix = 'MH_PAY_AIRTIME_';
      break;
    default:
      return false;
  }
  return new RegExp(`^${prefix}${network.toUpperCase()}_\\d+_\\d{6}$`).test(order.payment_reference);
}
