/**
 * Admin order case model.
 * Translates the stored payment status, fulfilment status, supplier facts and customer
 * resolution of one order into the operator's real-world question: "where does this
 * customer stand, and what can I do next?". Read-only presentation; it never decides
 * eligibility for a server action (the server re-checks every action).
 */
import type { AdminTone } from '../components/admin/ui/AdminUi';

export interface AdminOrderCaseInput {
  status: string;
  payment_status: string;
  service_type?: string | null;
  supplier_order_id?: string | null;
  supplier_response?: string | null;
  failure_reason?: string | null;
  manual_review?: boolean;
  delivered_at?: string | null;
  paid_at?: string | null;
  submitted_at?: string | null;
  created_at?: string;
  marketplace_status?: string | null;
  resolution?: { stage?: string; outcome?: string; refundId?: string; manual?: { outcome?: string } | null; updatedAt?: string } | null;
}

export type OrderCaseKey =
  | 'awaiting_payment' | 'payment_not_completed'
  | 'paid_not_dispatched' | 'queued_for_supplier' | 'supplier_uncertain'
  | 'with_supplier' | 'delivered'
  | 'failed_refund_pending' | 'failed_remedy_open' | 'refund_recorded' | 'refund_unverified'
  | 'resolved_refunded' | 'resolved_manual_fulfilment' | 'resolved_compensated'
  | 'marketplace_in_progress';

export interface OrderCase {
  key: OrderCaseKey;
  label: string;
  tone: AdminTone;
  /** One sentence describing the real-world situation. */
  explanation: string;
  /** What the operator can do with the tools that exist today. */
  nextStep: string;
  /** True when the case sits in the Needs Attention queue (mirrors the server filter). */
  needsAttention: boolean;
  /** Manual-review flag is shown separately because it can accompany any state. */
  flagged: boolean;
}

const failedStates = ['failed', 'cancelled', 'expired'];

export function parseSupplierStatus(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const value = parsed?.data?.status ?? parsed?.status;
    return typeof value === 'string' && value.length <= 40 ? value.toLowerCase() : null;
  } catch { return null; }
}

/** Mirrors the server's needs_attention SQL in OrdersStore.searchOrdersAdmin. */
export function isNeedsAttention(order: AdminOrderCaseInput): boolean {
  if (order.resolution?.stage === 'resolved') return false;
  if (order.manual_review) return true;
  if (order.failure_reason === 'supplier_submission_uncertain' && ['paid', 'queued', 'submitted', 'processing'].includes(order.status)) return true;
  if (order.status === 'refund_pending') return true;
  return order.payment_status === 'success' && ['failed', 'cancelled', 'expired', 'refunded'].includes(order.status);
}

export function describeOrderCase(order: AdminOrderCaseInput): OrderCase {
  const flagged = Boolean(order.manual_review);
  const needsAttention = isNeedsAttention(order);
  const make = (key: OrderCaseKey, label: string, tone: AdminTone, explanation: string, nextStep: string): OrderCase => ({ key, label, tone, explanation, nextStep, needsAttention, flagged });
  const resolution = order.resolution;
  const paid = order.payment_status === 'success';

  if (resolution?.stage === 'resolved') {
    if (resolution.outcome === 'manual_fulfillment') return make('resolved_manual_fulfilment', 'Resolved · fulfilled outside Mystery Hub', 'info', 'An operator recorded that the customer received the service through another legitimate channel, with evidence.', 'No action needed. The original payment and supplier facts are kept unchanged for audit.');
    if (resolution.outcome === 'external_compensation') return make('resolved_compensated', 'Resolved · compensated externally', 'info', 'An operator recorded an external remedy (for example a MoMo transfer) with its reference.', 'No action needed. This is operator-attested, not a verified provider refund.');
    if(!['paystack_refund','wallet_refund'].includes(resolution.outcome||''))return make('failed_remedy_open','Resolution needs review','warning','The recorded resolution does not identify a verified refund or documented remedy.','Review the resolution evidence before describing this order as refunded.');
    return make('resolved_refunded', 'Resolved · customer refunded', 'success', resolution.outcome === 'wallet_refund' ? 'The original Mystery Wallet purchase was refunded through the ledger.' : 'Paystack confirmed the customer refund for this exact payment.', 'No action needed.');
  }

  if (!paid) {
    if (order.payment_status === 'pending') return make('awaiting_payment', 'Payment not confirmed', 'neutral', 'The customer started checkout, but no successful payment has been verified.', 'Nothing to fulfil. If the customer says they paid, search the Paystack reference before acting.');
    return make('payment_not_completed', 'Payment not completed', 'neutral', `Payment is recorded as "${order.payment_status}". No successful payment has been verified for this order.`, 'If the customer reports a debit, verify the provider reference before deciding what happened.');
  }

  if (order.status === 'delivered' || order.delivered_at) return make('delivered', 'Delivered', 'success', 'The supplier (or the marketplace fulfilment flow) confirmed delivery.', flagged ? 'It is still flagged for review. Read the note, then clear the flag if nothing is outstanding.' : 'No action needed.');

  if (resolution?.stage === 'refund_pending') return make('refund_recorded', 'Customer refund recorded · awaiting verification', 'warning', 'A Paystack refund ID is linked but Paystack has not confirmed it as processed.', 'Use "Verify External Paystack Refund" again once Paystack shows it processed.');

  if (order.status === 'refunded') return make('refund_unverified', 'Marked refunded · customer refund unverified', 'warning', 'The order is in a refunded state, but no verified customer refund or documented remedy is linked to it.', 'Open Customer resolution and record the verified refund or the remedy that actually happened.');

  if (order.status === 'refund_pending') return make('failed_refund_pending', 'Failed · customer remedy open', 'danger', 'The supplier did not deliver. The customer paid and has not yet been refunded or otherwise remedied.', 'Refund the original payment method (or record the legitimate remedy) in Customer resolution.');

  if (failedStates.includes(order.status)) return make('failed_remedy_open', 'Failed after payment · remedy open', 'danger', 'The customer paid but the order ended without delivery. A supplier refund only credits Mystery Hub, not the customer.', 'Record the customer remedy in Customer resolution.');

  if (order.failure_reason === 'supplier_submission_uncertain') return make('supplier_uncertain', 'Supplier acceptance uncertain', 'danger', 'The request to the supplier timed out. The supplier may or may not have accepted it, so a retry could deliver twice.', 'Do not resubmit. Check the supplier dashboard or refresh supplier status, and record what you find.');

  if (order.service_type === 'marketplace') return make('marketplace_in_progress', `Marketplace · ${(order.marketplace_status || order.status).replace(/_/g, ' ')}`, 'info', 'Paid marketplace order fulfilled by Mystery Hub (pickup, delivery or activation).', 'Move it through the fulfilment steps as the customer receives it.');

  if (order.status === 'paid') return make('paid_not_dispatched', 'Paid · not dispatched to supplier', flagged ? 'warning' : 'info', 'Payment is confirmed but the order has not been sent to the supplier yet.', flagged ? 'It is flagged. Check whether it was fulfilled another way before anything is dispatched.' : 'Automatic dispatch normally picks this up within moments.');

  if (order.status === 'queued') {
    if (!order.supplier_order_id) return make('queued_for_supplier', 'Paid · held before supplier', flagged ? 'warning' : 'info', 'Payment is confirmed. The order is held in the queue and has no supplier reference yet (for example while auto-dispatch is off or another MTN order for the same number is active).', flagged ? 'It is flagged. If you fulfilled it outside the system, add a note. Closing it as fulfilled needs a new server action that is not built yet.' : 'Check System Health for dispatch status.');
    return make('with_supplier', 'With supplier · awaiting delivery', 'info', 'The supplier holds this order and Mystery Hub is waiting for delivery confirmation.', 'Refresh supplier status if it has been waiting unusually long.');
  }

  return make('with_supplier', 'With supplier · awaiting delivery', 'info', 'The supplier accepted the order. Delivery confirmation has not arrived yet.', 'Refresh supplier status if it has been waiting unusually long.');
}

export interface OrderTimelineStep { label: string; at: string | null | undefined; state: 'done' | 'current' | 'pending' | 'failed' }
export function orderTimeline(order: AdminOrderCaseInput & { updated_at?: string }): OrderTimelineStep[] {
  const kase = describeOrderCase(order);
  const paid = order.payment_status === 'success';
  const failed = ['failed_refund_pending', 'failed_remedy_open', 'refund_unverified', 'refund_recorded', 'supplier_uncertain'].includes(kase.key);
  const delivered = kase.key === 'delivered';
  const resolved = kase.key.startsWith('resolved_');
  const dispatched = Boolean(order.supplier_order_id || order.submitted_at);
  const steps: OrderTimelineStep[] = [
    { label: 'Order created', at: order.created_at, state: 'done' },
    { label: paid ? 'Payment confirmed' : 'Payment', at: order.paid_at, state: paid ? 'done' : 'current' },
  ];
  if (order.service_type !== 'marketplace') steps.push({ label: dispatched ? 'Sent to supplier' : 'Not sent to supplier', at: order.submitted_at, state: dispatched ? 'done' : paid && !resolved && !delivered ? 'current' : 'pending' });
  steps.push({ label: delivered ? 'Delivered' : failed ? 'Not delivered' : 'Delivery', at: order.delivered_at, state: delivered ? 'done' : failed ? 'failed' : dispatched && paid && !resolved ? 'current' : 'pending' });
  if (failed || resolved) steps.push({ label: resolved ? kase.label.replace('Resolved · ', 'Resolved: ') : 'Customer remedy', at: resolved ? order.resolution?.updatedAt ?? null : null, state: resolved ? 'done' : 'current' });
  return steps;
}

/** Operator lenses over the existing server filters (no new query semantics). */
export const ORDER_LENSES = [
  { id: 'active', label: 'Active orders', params: {} },
  { id: 'needs_attention', label: 'Needs attention', params: { status: 'needs_attention' } },
  { id: 'awaiting_payment', label: 'Payment not confirmed', params: { paymentStatus: 'pending', status: 'all' } },
  { id: 'paid', label: 'Paid · not dispatched', params: { status: 'paid' } },
  { id: 'queued', label: 'Held before supplier', params: { status: 'queued' } },
  { id: 'processing', label: 'With supplier', params: { status: 'processing' } },
  { id: 'delivered', label: 'Delivered', params: { status: 'delivered' } },
  { id: 'refund_pending', label: 'Failed · refund pending', params: { status: 'refund_pending' } },
  { id: 'failed', label: 'Failed', params: { status: 'failed' } },
  { id: 'refunded', label: 'Refunded', params: { status: 'refunded' } },
  { id: 'abandoned', label: 'Abandoned checkouts', params: { status: 'abandoned' } },
] as const;
export type OrderLensId = typeof ORDER_LENSES[number]['id'];
