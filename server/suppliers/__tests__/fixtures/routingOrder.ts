import {randomUUID} from 'node:crypto';
import type {OrderRecord} from '../../../types/orders.js';
export function routingOrder(extra: Partial<OrderRecord> = {}): OrderRecord {
  const id = randomUUID(), now = new Date().toISOString();
  return {id, user_id: null, public_reference: `SYNTHETIC-${id}`, customer_name: null, customer_email: 'fixture@example.test', customer_phone: '+233271234567', recipient_phone: '+233271234567', network: 'airteltigo', service_type: 'data', product_id: 'at-1gb', product_name_snapshot: 'Synthetic bundle', bundle_size_snapshot: '1GB', amount: 499, currency: 'GHS', status: 'queued', payment_provider: 'paystack', payment_reference: `SYNTHETIC-PAY-${id}`, payment_status: 'success', supplier_provider: 'success_biz_hub', supplier_order_id: null, supplier_response: null, supplier_cost_minor: null, supplier_offer_ref: null, supplier_last_checked_at: null, failure_reason: null, created_at: now, updated_at: now, paid_at: now, submitted_at: null, delivered_at: null, ...extra};
}
