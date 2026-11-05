import type { OrderRecord } from '../../types/orders.js';
import type { ShieldPolicy } from '../../services/shieldPolicy.js';

export function shieldFixture(now: number, patch: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'shield-fixture', user_id: 'shield-customer', public_reference: 'MH-SHIELD-FIXTURE',
    customer_name: null, customer_email: 'shield@example.test', customer_phone: '+233240000001',
    recipient_phone: '+233240000001', network: 'mtn', service_type: 'data',
    product_id: 'mtn-1gb', product_name_snapshot: 'MTN 1GB', bundle_size_snapshot: '1GB',
    amount: 549, currency: 'GHS', status: 'processing', payment_provider: 'paystack',
    payment_reference: 'PAY-SHIELD-FIXTURE', payment_status: 'success',
    supplier_provider: 'success_biz_hub', supplier_order_id: 'original-fixture',
    supplier_response: null, supplier_cost_minor: null, supplier_offer_ref: 'synthetic-express',
    supplier_last_checked_at: null, failure_reason: null,
    created_at: new Date(now - 36_000_000).toISOString(),
    paid_at: new Date(now - 32_400_000).toISOString(),
    updated_at: new Date(now - 32_400_000).toISOString(),
    submitted_at: new Date(now - 32_400_000).toISOString(), delivered_at: null,
    ...patch,
  };
}

export function shieldTestPolicy(now: number): ShieldPolicy {
  return {
    visible: true, intake: true, fulfillment: true, notifications: false,
    startsAt: now - 86_400_000, endsAt: Infinity, offers: new Set(['synthetic-express']),
    perClaimMinor: 400, dailyMinor: 900, totalMinor: 900,
  };
}
