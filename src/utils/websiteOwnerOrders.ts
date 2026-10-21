import { dataOrderPresentation } from './dataPurchasePresentation.js';
import { formatGhs, parseGhs } from '../../shared/money.js';

/**
 * Owner-side order and pricing presentation for Data stores. Display only: every figure comes from a server
 * field (`/business` orders, `/bundles` products). Payment and delivery are shown as two separate facts.
 */
export interface OwnerOrder { id: string; reference: string; createdAt: string; network: string; bundle: string; recipient: string; retailMinor: number; earningMinor: number; earningState: string; status: string; manualReview: boolean; paid: boolean; snapshot?: any }
export type OwnerOrderGroup = 'check' | 'sending' | 'delivered' | 'failed' | 'unpaid';
export const OWNER_ORDER_FILTERS: [OwnerOrderGroup | 'all', string][] = [['all', 'All'], ['check', 'Needs check'], ['sending', 'Sending'], ['delivered', 'Delivered'], ['failed', 'Failed or refunded'], ['unpaid', 'Not paid']];

export function ownerOrderView(order: OwnerOrder) {
  const p = dataOrderPresentation(order.status, order.manualReview);
  const unpaid = !order.paid && !p.paymentConfirmed;
  const payment = unpaid ? (['cancelled', 'expired'].includes(order.status) ? 'Payment not completed' : 'Awaiting payment') : 'Payment received';
  const group: OwnerOrderGroup = order.manualReview ? 'check'
    : unpaid ? 'unpaid'
    : p.delivered ? 'delivered'
    : ['failed', 'refund_pending', 'refunded'].includes(order.status) ? 'failed'
    : 'sending';
  return { payment, delivery: unpaid ? 'Not sent' : p.label, group, paid: !unpaid };
}

export function ownerOrderCounts(orders: OwnerOrder[]) {
  const counts: Record<OwnerOrderGroup, number> = { check: 0, sending: 0, delivered: 0, failed: 0, unpaid: 0 };
  for (const o of orders) counts[ownerOrderView(o).group]++;
  return counts;
}

/** Plain definitions shown next to each earnings figure. Wording to be confirmed against ledger rules (Codex handoff). */
export const STORE_EARNING_DEFINITIONS: [key: 'availableMinor' | 'pendingMinor' | 'reservedMinor' | 'withdrawnMinor', label: string, meaning: string][] = [
  ['availableMinor', 'Available', 'Confirmed earnings you can request to withdraw.'],
  ['pendingMinor', 'Pending', 'From paid orders, not released to Available yet.'],
  ['reservedMinor', 'Reserved', 'Held for withdrawal requests that are being reviewed.'],
  ['withdrawnMinor', 'Withdrawn', 'Already paid out to you.'],
];

export interface PricingChangeInput { id: string; networkName: string; dataAmount: string; before: { price: string; enabled: boolean }; after: { price: string; enabled: boolean } }
const money = (price: string) => price ? formatGhs(parseGhs(price)) : 'No price';
/** "MTN 5GB: GH₵22.00 → GH₵23.99 · switched on", one line per bundle the save will change. */
export function pricingReviewLines(changes: PricingChangeInput[]): string[] {
  return changes.map(c => {
    const parts: string[] = [];
    if (c.before.price !== c.after.price) parts.push(`${money(c.before.price)} → ${money(c.after.price)}`);
    if (c.before.enabled !== c.after.enabled) parts.push(c.after.enabled ? 'switched on' : 'switched off');
    return `${c.networkName} ${c.dataAmount}: ${parts.join(' · ')}`;
  });
}
