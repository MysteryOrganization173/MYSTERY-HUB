/**
 * Duplicate Active Order Protection Service
 *
 * Business Rule:
 * MTN does not permit another bundle order for the same recipient phone number
 * while a previous MTN order is still unresolved/processing.
 * Mystery Hub prevents customers from paying for a second MTN order that the supplier
 * is expected to reject.
 *
 * Applies strictly to MTN (not Telecel or AirtelTigo).
 */

import { OrderRecord, OrderStatus } from '../types/orders.js';
import { areGhanaPhonesEqual } from '../utils/phone.js';

export const ACTIVE_MTN_ORDER_CODE = 'ACTIVE_MTN_ORDER_EXISTS';

export const ACTIVE_MTN_ORDER_MESSAGE =
  'You already have an MTN bundle being processed for this number. Please wait for it to be completed before placing another order.';

// Authoritative blocking statuses for MTN
export const MTN_BLOCKING_STATUSES: readonly OrderStatus[] = [
  'paid',
  'queued',
  'submitted',
  'processing',
  'refund_pending',
];

// Authoritative terminal (non-blocking) statuses for MTN
export const MTN_TERMINAL_STATUSES: readonly OrderStatus[] = [
  'delivered',
  'failed',
  'refunded',
];

// Maximum lifetime for an uncompleted pending_payment attempt before it is considered expired
export const PENDING_PAYMENT_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Determines if a given order record is currently blocking new MTN orders for that recipient
 */
export function isMtnOrderBlocking(order: OrderRecord, nowMs = Date.now()): boolean {
  if (order.network.toLowerCase() !== 'mtn') {
    return false;
  }

  // 1. Authoritative active fulfillment statuses
  if (MTN_BLOCKING_STATUSES.includes(order.status)) {
    return true;
  }

  // 2. Terminal statuses never block
  if (MTN_TERMINAL_STATUSES.includes(order.status)) {
    return false;
  }

  // 3. pending_payment is checked with short expiration so abandoned checkouts never lock a number permanently
  if (order.status === 'pending_payment') {
    const createdAtMs = new Date(order.created_at).getTime();
    if (!isNaN(createdAtMs) && nowMs - createdAtMs < PENDING_PAYMENT_EXPIRY_MS) {
      // Very recent pending_payment: considered active only if within expiration
      return false; // By default, uncompleted checkout intent does not block new attempts unless concurrent
    }
  }

  return false;
}

/**
 * Maps an internal backend order status to a safe customer-facing status string
 */
export function mapToSafeCustomerStatus(status: OrderStatus): string {
  switch (status) {
    case 'paid':
    case 'queued':
      return 'placed';
    case 'submitted':
    case 'processing':
      return 'processing';
    case 'refund_pending':
      return 'refund_pending';
    case 'delivered':
      return 'delivered';
    case 'failed':
      return 'failed';
    case 'refunded':
      return 'refunded';
    case 'pending_payment':
      return 'pending_payment';
    default:
      return status;
  }
}
