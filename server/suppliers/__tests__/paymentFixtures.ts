import crypto from 'node:crypto';
import { OrdersStore } from '../../db/ordersStore.js';
import type { OrderRecord } from '../../types/orders.js';

export function paymentOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  const now = new Date().toISOString();
  return {
    id: `ord_${crypto.randomUUID()}`, public_reference: `MH-${crypto.randomUUID()}`,
    user_id: null, customer_name: null, customer_email: 'buyer@example.test',
    customer_phone: '+233241234567', recipient_phone: '+233241234567', network: 'mtn',
    service_type: 'data', product_id: 'mtn-1gb', product_name_snapshot: 'MTN 1GB', bundle_size_snapshot: '1GB',
    amount: 500, currency: 'GHS', status: 'pending_payment', payment_provider: 'paystack',
    payment_reference: `MH_PAY_MTN_1790000000000_${crypto.randomInt(100000, 1000000)}`, payment_status: 'pending',
    supplier_provider: 'success_biz_hub', supplier_order_id: null, supplier_response: null,
    supplier_cost_minor: null, supplier_offer_ref: null, supplier_last_checked_at: null,
    failure_reason: null, created_at: now, updated_at: now, paid_at: null, submitted_at: null,
    delivered_at: null, ...overrides,
  };
}

/** A record left by a storefront that used the shared merchant before checkout was disconnected. */
export function historicalStoreOrder(siteId: string, overrides: Partial<OrderRecord> = {}): OrderRecord {
  return paymentOrder({
    payment_reference: `MH_STORE_${crypto.randomUUID()}`, supplier_cost_minor: 200, supplier_offer_ref: 'fixture',
    store_context: {channel:'website_store',siteId,ownerId:'owner',productId:'mtn-1gb',retailMinor:500,wholesaleMinor:300,reserveMinor:25,earningMinor:175,supplierCostMinor:200,currency:'GHS',policyVersion:'fixture',wholesaleVersion:'fixture',priceVersion:'fixture'},
    ...overrides,
  });
}

export async function seedHistoricalStoreOrder(siteId: string, overrides?: Partial<OrderRecord>) {
  const order=historicalStoreOrder(siteId,overrides);
  await OrdersStore.createOrder(order);
  return order;
}

export function storeVerificationMetadata(order: OrderRecord) {
  return {purpose:'website_store_order',store_id:order.store_context!.siteId,order_id:order.id,product_id:order.product_id};
}
