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
  | 'refunded';

export interface OrderRecord {
  id: string;
  public_reference: string;
  customer_name: string | null;
  customer_email: string;
  customer_phone: string;
  recipient_phone: string;
  network: 'mtn' | 'telecel' | 'airteltigo';
  product_id: string;
  product_name_snapshot: string;
  bundle_size_snapshot: string;
  amount: number; // Stored safely in pesewas (e.g. 499 for GH₵4.99)
  currency: 'GHS';
  status: OrderStatus;
  payment_provider: 'paystack';
  payment_reference: string;
  payment_status: 'pending' | 'success' | 'failed';
  supplier_provider: string | null;
  supplier_order_id: string | null;
  supplier_response: string | null;
  failure_reason: string | null;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  paid_at: string | null;
  submitted_at: string | null;
  delivered_at: string | null;
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
};

export function toSafePublicOrder(order: OrderRecord): SafePublicOrderDetails {
  return {
    public_reference: order.public_reference,
    recipient_phone: order.recipient_phone,
    network: order.network,
    product_name_snapshot: order.product_name_snapshot,
    bundle_size_snapshot: order.bundle_size_snapshot,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    created_at: order.created_at,
    paid_at: order.paid_at,
    delivered_at: order.delivered_at,
    amount_ghc: Number((order.amount / 100).toFixed(2)),
  };
}
