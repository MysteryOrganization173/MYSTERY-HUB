/**
 * Controlled Order Status Types & Core Server Domain Model
 */

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'queued'
  | 'submitted'
  | 'processing'
  | 'delivered'
  | 'failed'
  | 'refund_pending'
  | 'refunded'
  | 'cancelled'
  | 'expired';

export interface OrderRecord {
  id: string;
  user_id?: string | null;
  public_reference: string;
  customer_name: string | null;
  customer_email: string;
  customer_phone: string;
  recipient_phone: string;
  network: 'mtn' | 'telecel' | 'airteltigo';
  service_type?: 'data' | 'airtime' | 'instant_bundle';
  product_id: string;
  product_name_snapshot: string;
  bundle_size_snapshot: string;
  amount: number; // Stored safely in pesewas (customer total e.g. 1020 for GH₵10.20)
  face_value_minor?: number | null; // Airtime face value in pesewas (e.g. 1000 for GH₵10.00)
  service_fee_minor?: number | null; // Service fee in pesewas (e.g. 20 for GH₵0.20)
  currency: 'GHS';
  status: OrderStatus;
  payment_provider: 'paystack';
  payment_reference: string;
  payment_status: 'pending' | 'success' | 'failed' | 'cancelled' | 'expired';
  supplier_provider: string | null;
  supplier_order_id: string | null;
  supplier_response: string | null;
  supplier_cost_minor: number | null;
  supplier_offer_ref: string | null;
  supplier_last_checked_at: string | null;
  failure_reason: string | null;
  manual_review?: boolean;
  admin_note?: string | null;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  paid_at: string | null;
  submitted_at: string | null;
  delivered_at: string | null;
  payment_closed_at?: string | null;
  referrer_user_id?: string | null;
  referral_attribution_id?: string | null;
  referral_code?: string | null;
}

export type SafePublicOrderDetails = Pick<
  OrderRecord,
  | 'public_reference'
  | 'recipient_phone'
  | 'network'
  | 'product_name_snapshot'
  | 'bundle_size_snapshot'
  | 'amount'
  | 'currency'
  | 'status'
  | 'created_at'
  | 'paid_at'
  | 'delivered_at'
> & {
  amount_ghc: number;
  service_type?: 'data' | 'airtime' | 'instant_bundle';
  face_value_ghc?: number;
  service_fee_ghc?: number;
};

export interface AdminOrderDetails extends SafePublicOrderDetails {
  id: string;
  user_id?: string | null;
  customer_name: string | null;
  customer_email: string;
  customer_phone: string;
  payment_provider: string;
  payment_reference: string;
  payment_status: string;
  supplier_provider: string | null;
  supplier_order_id: string | null;
  supplier_response: string | null;
  supplier_cost_minor: number | null;
  supplier_cost_ghc?: number;
  supplier_offer_ref: string | null;
  supplier_last_checked_at: string | null;
  failure_reason: string | null;
  manual_review: boolean;
  admin_note: string | null;
  updated_at: string;
  submitted_at: string | null;
  payment_closed_at?: string | null;
}

export function toAdminOrderDetails(order: OrderRecord): AdminOrderDetails {
  const safe = toSafePublicOrder(order);
  return {
    ...safe,
    id: order.id,
    user_id: order.user_id || null,
    customer_name: order.customer_name || null,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    payment_provider: order.payment_provider,
    payment_reference: order.payment_reference,
    payment_status: order.payment_status,
    supplier_provider: order.supplier_provider || null,
    supplier_order_id: order.supplier_order_id || null,
    supplier_response: order.supplier_response || null,
    supplier_cost_minor: order.supplier_cost_minor != null ? order.supplier_cost_minor : null,
    supplier_cost_ghc: order.supplier_cost_minor != null ? Number((order.supplier_cost_minor / 100).toFixed(2)) : undefined,
    supplier_offer_ref: order.supplier_offer_ref || null,
    supplier_last_checked_at: order.supplier_last_checked_at || null,
    failure_reason: order.failure_reason || null,
    manual_review: Boolean(order.manual_review),
    admin_note: order.admin_note || null,
    updated_at: order.updated_at,
    submitted_at: order.submitted_at || null,
    payment_closed_at: order.payment_closed_at || null,
  };
}

export function toSafePublicOrder(order: OrderRecord): SafePublicOrderDetails {
  const isAirtime = order.service_type === 'airtime' || order.product_id.startsWith('airtime-');
  const serviceType = isAirtime ? 'airtime' : 'data';

  return {
    public_reference: order.public_reference,
    recipient_phone: order.recipient_phone,
    network: order.network,
    service_type: serviceType,
    product_name_snapshot: order.product_name_snapshot,
    bundle_size_snapshot: order.bundle_size_snapshot,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    created_at: order.created_at,
    paid_at: order.paid_at,
    delivered_at: order.delivered_at,
    amount_ghc: Number((order.amount / 100).toFixed(2)),
    face_value_ghc: order.face_value_minor != null ? Number((order.face_value_minor / 100).toFixed(2)) : undefined,
    service_fee_ghc: order.service_fee_minor != null ? Number((order.service_fee_minor / 100).toFixed(2)) : undefined,
  };
}
