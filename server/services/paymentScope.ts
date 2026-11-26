import { sharedMerchantCheckoutAvailable } from '../../shared/paymentAvailability.js';
import { getAuthoritativeProduct } from '../data/productCatalog.js';
import { MAX_MONEY_MINOR } from '../../shared/money.js';
import type { FinanceOperation } from '../db/financeStore.js';
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


/** This approval switch is independent of the main shared-merchant service allowlist. */
export function managedDataStoreCheckoutEnabled(): boolean {
  return process.env.MANAGED_DATA_STOREFRONT_CHECKOUT_ENABLED === 'true' &&
    (process.env.NODE_ENV !== 'production' || process.env.PAYSTACK_SECRET_KEY?.trim().startsWith('sk_live_') === true);
}

export function isManagedDataStoreOrder(order: OrderRecord): boolean {
  const store = order.store_context;
  if (!store || store.channel !== 'website_store' || !store.siteId || !store.ownerId ||
      order.marketplace_context != null || order.service_type !== 'data' || order.payment_provider !== 'paystack' ||
      !/^MH_STORE_[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(order.payment_reference)) return false;
  const product = getAuthoritativeProduct(order.product_id);
  if (!product?.isActive || product.id !== order.product_id || product.network !== order.network ||
      product.dataAmount !== order.bundle_size_snapshot || store.productId !== product.id ||
      order.supplier_provider !== 'success_biz_hub' || !order.supplier_offer_ref ||
      !store.policyVersion || !store.wholesaleVersion || !store.priceVersion) return false;
  return order.currency === 'GHS' && store.currency === order.currency &&
    [store.retailMinor, store.wholesaleMinor, store.reserveMinor, store.earningMinor, store.supplierCostMinor]
      .every(amount => Number.isSafeInteger(amount) && amount >= 0 && amount <= MAX_MONEY_MINOR) &&
    order.amount === store.retailMinor && order.supplier_cost_minor === store.supplierCostMinor &&
    store.supplierCostMinor > 0 && store.wholesaleMinor >= store.supplierCostMinor &&
    store.retailMinor === store.wholesaleMinor + store.reserveMinor + store.earningMinor;
}


/** Match local idempotency state to the exact order and the reseller whose ledger owns it. */
export function managedStoreIntentMatches(order: OrderRecord, intent: Pick<FinanceOperation,'kind'|'user_id'|'amount_minor'|'payload'>): boolean {
  const data = intent.payload;
  return intent.kind === 'store_checkout' && intent.user_id === order.store_context?.ownerId &&
    intent.amount_minor === order.amount && data.managedPaymentVersion === 1 &&
    data.reference === order.payment_reference && data.orderId === order.id &&
    data.publicRef === order.public_reference && data.siteId === order.store_context?.siteId &&
    data.productId === order.product_id && data.email === order.customer_email &&
    data.recipient === order.recipient_phone && data.customerId === order.user_id;
}
