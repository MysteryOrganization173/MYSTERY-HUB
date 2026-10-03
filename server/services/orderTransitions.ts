import type { OrderStatus } from '../types/orders.js';

const progress: OrderStatus[] = ['pending_payment', 'paid', 'queued', 'submitted', 'processing', 'delivered'];
const stopped: OrderStatus[] = ['failed', 'refund_pending', 'refunded', 'cancelled', 'expired'];

/** Automatic supplier updates cannot reverse delivery or resurrect closed orders. */
export function canAdvanceOrderStatus(from: OrderStatus, to: OrderStatus, explicitReversal = false): boolean {
  if (from === to) return false;
  if (!progress.includes(to) && !stopped.includes(to)) return false;
  if (from === 'delivered') {
    return explicitReversal && ['refund_pending', 'refunded', 'cancelled', 'failed'].includes(to);
  }
  if (from === 'refunded') return false;
  if (stopped.includes(from)) return from === 'refund_pending' && to === 'refunded';
  if (stopped.includes(to)) return true;
  return progress.indexOf(to) > progress.indexOf(from);
}
