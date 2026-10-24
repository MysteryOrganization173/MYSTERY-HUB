import type { AuthenticatedCustomerOrderDetails } from '../../server/types/orders';
import type { OrderRecord } from '../types';
import { afaStatusLabel } from '../../shared/afa';
import { GHANA_NETWORKS } from '../data/bundles';
import { dataOrderPresentation, dataRecipientDisplay } from './dataPurchasePresentation';
import { getInstantBundlePresentation } from './instantBundleUtils';

/**
 * Presentation only for the customer Orders list. Every group is derived from the server's
 * authoritative fields (status, manual_review, customer_resolution, payment_basis and the
 * Marketplace stage) in the same precedence the receipt helpers use. Nothing here confirms a
 * payment, a delivery or a refund that the server has not reported.
 */
export type CustomerOrderGroup =
  | 'awaiting_payment' // pending_payment, or a device record the server has not confirmed yet
  | 'in_progress'      // paid / queued / submitted / processing, or a Marketplace fulfilment stage
  | 'delivered'        // delivered (AFA: registered, Marketplace: completed)
  | 'attention'        // manual review, resolution review, failed
  | 'refund_pending'   // refund pending, or refunded without a verified customer refund
  | 'refunded'         // customer_resolution refund_confirmed only
  | 'resolved'         // support recorded manual fulfilment or an external remedy
  | 'cancelled';       // payment cancelled or expired, or a cancelled Marketplace order

export type CustomerOrderFilter = 'all' | 'active' | 'delivered' | 'attention' | 'refunds' | 'cancelled';

export interface CustomerOrderStatus { group: CustomerOrderGroup; label: string }

type StatusInput = Pick<OrderRecord, 'serviceType' | 'serverStatus' | 'status' | 'manualReview' | 'customerResolution' | 'paymentBasis' | 'marketplaceStatus'>;

const FINAL_RESOLUTIONS = ['refund_confirmed', 'manual_fulfillment', 'external_compensation'];
const MARKETPLACE_STAGE_LABELS: Record<string, string> = {
  awaiting_fulfilment: 'Being prepared',
  ready_for_pickup: 'Ready for pickup',
  out_for_delivery: 'Out for delivery',
};

/** Raw server status; a device record without one falls back to its last known local stage. */
function effectiveStatus(order: StatusInput): string {
  if (order.serverStatus) return order.serverStatus;
  return ({ delivered: 'delivered', processing: 'processing', placed: 'queued', verifying: 'pending_payment', failed: 'failed' } as Record<string, string>)[order.status] || 'pending_payment';
}

export function customerOrderStatus(order: StatusInput): CustomerOrderStatus {
  const status = effectiveStatus(order);
  const resolution = order.customerResolution;
  const isAfa = order.serviceType === 'afa';
  // AFA without a resolution flags review only in the stages afaStatusLabel does.
  const review = Boolean(order.manualReview) && !FINAL_RESOLUTIONS.includes(resolution || '')
    && (!isAfa || Boolean(resolution) || ['paid', 'queued', 'submitted', 'processing', 'failed'].includes(status));

  // Assisted orders (complimentary or payment recorded by support) follow their own receipt wording.
  if (order.paymentBasis) {
    const view = dataOrderPresentation(status, order.manualReview, resolution, order.paymentBasis);
    if (view.delivered) return { group: 'delivered', label: view.label };
    if (order.manualReview || ['failed', 'refund_pending'].includes(status)) return { group: 'attention', label: 'Support review' };
    return { group: 'in_progress', label: view.label };
  }

  // Resolutions and manual review use the shared receipt labels; AFA keeps its own wording
  // only while no resolution applies, exactly as the receipt does.
  const label = resolution || !isAfa
    ? dataOrderPresentation(status, order.manualReview, resolution).label
    : afaStatusLabel(status, order.manualReview);

  if (resolution === 'refund_confirmed') return { group: 'refunded', label };
  if (resolution === 'manual_fulfillment' || resolution === 'external_compensation') return { group: 'resolved', label };
  if (review) return { group: 'attention', label };
  if (resolution === 'review') return { group: 'attention', label };
  if (resolution === 'refund_pending') return { group: 'refund_pending', label };

  if (order.serviceType === 'marketplace' && order.marketplaceStatus) {
    const stage = order.marketplaceStatus;
    if (stage === 'refund_pending') return { group: 'refund_pending', label: 'Refund pending' };
    if (stage === 'refunded') return { group: 'refund_pending', label: 'Refund review' };
    if (stage === 'cancelled') return { group: 'cancelled', label: 'Cancelled' };
    if (stage === 'completed') return { group: 'delivered', label: 'Completed' };
    if (MARKETPLACE_STAGE_LABELS[stage]) return { group: 'in_progress', label: MARKETPLACE_STAGE_LABELS[stage] };
  }

  switch (status) {
    case 'delivered': return { group: 'delivered', label };
    case 'paid': case 'queued': case 'submitted': case 'processing': return { group: 'in_progress', label };
    case 'failed': return { group: 'attention', label };
    // Without a verified customer resolution a refunded status is not shown as money returned.
    case 'refund_pending': return { group: 'refund_pending', label: 'Refund pending' };
    case 'refunded': return { group: 'refund_pending', label: 'Refund review' };
    case 'cancelled': case 'expired': return { group: 'cancelled', label };
    default: return { group: 'awaiting_payment', label };
  }
}

export const ORDER_FILTERS: { id: CustomerOrderFilter; label: string; groups: CustomerOrderGroup[] }[] = [
  { id: 'all', label: 'All', groups: [] },
  { id: 'active', label: 'In progress', groups: ['awaiting_payment', 'in_progress'] },
  { id: 'delivered', label: 'Delivered', groups: ['delivered'] },
  { id: 'attention', label: 'Needs attention', groups: ['attention'] },
  { id: 'refunds', label: 'Refunds', groups: ['refund_pending', 'refunded'] },
  { id: 'cancelled', label: 'Not completed', groups: ['cancelled'] },
];

export function orderMatchesFilter(group: CustomerOrderGroup, filter: CustomerOrderFilter): boolean {
  return filter === 'all' || ORDER_FILTERS.find(f => f.id === filter)!.groups.includes(group);
}

export function isMarketplaceOrder(order: OrderRecord): boolean {
  return order.serviceType === 'marketplace' || Boolean(order.bundle.id?.startsWith('marketplace-'));
}

/** What was bought, without network or reference; the card shows those separately. */
export function customerOrderTitle(order: OrderRecord): string {
  if (order.serviceType === 'afa') return 'MTN AFA Registration';
  if (isMarketplaceOrder(order)) return order.bundle.description || order.bundle.dataAmount || 'Marketplace item';
  const instant = order.serviceType === 'instant_bundle' || order.bundle.id?.startsWith('instant-') || Boolean(order.bundle.packageId);
  if (instant) {
    const info = getInstantBundlePresentation({ category: order.bundle.category, name: order.bundle.description || order.bundle.dataAmount, dataAmount: order.bundle.dataAmount, isFlexi: order.bundle.isFlexi });
    return `${info.formattedAmount} ${info.categoryLabel}`;
  }
  if (order.serviceType === 'airtime' || order.bundle.id?.startsWith('airtime-')) return /airtime/i.test(order.bundle.dataAmount) ? order.bundle.dataAmount : `${order.bundle.dataAmount} Airtime`;
  return /data/i.test(order.bundle.dataAmount) ? order.bundle.dataAmount : `${order.bundle.dataAmount} Data`;
}

const NETWORK_NAMES: Record<string, string> = { mtn: 'MTN', telecel: 'Telecel', airteltigo: 'AirtelTigo' };
export function customerOrderNetwork(order: OrderRecord): string {
  return isMarketplaceOrder(order) ? 'Marketplace' : NETWORK_NAMES[order.network] || GHANA_NETWORKS[order.network]?.name || order.network.toUpperCase();
}

/** Card-length wording for the one receipt label that does not fit a 360px row. */
export function shortStatusLabel(label: string): string {
  return label === 'Awaiting payment confirmation' ? 'Confirming payment' : label;
}

/** Account orders show the buyer's own number; anything else stays masked. */
export function customerOrderRecipient(order: OrderRecord): string {
  if (isMarketplaceOrder(order) || !order.recipientPhone) return '';
  // Non-Data numbers are shown as received (lookups arrive masked); this only groups digits.
  return order.serviceType === 'data' ? dataRecipientDisplay(order.recipientPhone, order.buyerRecipientVisible) : dataRecipientDisplay(order.recipientPhone, true);
}

/** "Today, 14:05", "Yesterday, 09:12", "24 Oct, 14:05" or "24 Oct 2025" for older years. */
export function orderDateLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  if (date.getFullYear() !== now.getFullYear()) return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}

/** Filters orders already on this page; it never queries the server. */
export function orderMatchesQuery(order: OrderRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/[\s-]/g, '');
  if (/^\+?\d{3,}$/.test(digits)) {
    const wanted = digits.replace(/^\+?233/, '0');
    if (order.recipientPhone.replace(/\D/g, '').includes(wanted)) return true;
  }
  const haystack = [customerOrderTitle(order), customerOrderNetwork(order), order.publicReference || order.id, customerOrderStatus(order).label].join(' ').toLowerCase();
  return q.split(/\s+/).every(word => haystack.includes(word));
}

/** Account-linked rows, newest first, with device-saved orders added once by reference. */
export function mergeCustomerOrders(serverOrders: OrderRecord[], localOrders: OrderRecord[]): OrderRecord[] {
  const combined = [...serverOrders];
  for (const localOrd of localOrders) {
    const ref = localOrd.publicReference || localOrd.id;
    if (!combined.some((s) => s.publicReference === ref || s.id === ref || s.id === localOrd.id)) combined.push(localOrd);
  }
  return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Authenticated account history only. Reference lookups use orderRecordFromLookup and stay masked. */
export function accountOrderRecord(o: AuthenticatedCustomerOrderDetails): OrderRecord {
  return {
    id: o.public_reference,
    publicReference: o.public_reference,
    serverReference: o.public_reference,
    serverStatus: o.status,
    customerResolution: o.customer_resolution,
    paymentBasis: o.payment_basis,
    manualReview: o.manual_review,
    commercialPricing: o.commercial_pricing,
    marketplaceStatus: o.marketplace_status,
    serviceType: o.service_type || (o.product_name_snapshot?.toLowerCase().includes('airtime') ? 'airtime' : 'data'),
    bundle: {
      id: 'server-bundle-' + o.public_reference,
      network: o.network,
      dataAmount: o.bundle_size_snapshot || o.product_name_snapshot || 'Data Order',
      dataBytesValue: 0,
      validity: 'Standard',
      validityCategory: 'Daily',
      priceGhc: o.amount_ghc,
      description: o.product_name_snapshot,
    },
    recipientPhone: o.recipient_phone,
    buyerRecipientVisible: true,
    journey: 'account',
    network: o.network,
    paymentMethod: 'paystack',
    amountGhc: o.amount_ghc,
    status: o.status === 'delivered' ? 'delivered'
      : o.status === 'processing' || o.status === 'submitted' ? 'processing'
      : o.status === 'paid' || o.status === 'queued' ? 'placed'
      : o.status === 'failed' || o.status === 'refund_pending' || o.status === 'refunded' ? 'failed'
      : 'verifying',
    paymentReference: o.public_reference,
    deliveredAt: o.delivered_at,
    createdAt: o.created_at,
    updatedAt: o.created_at,
  };
}

export type TrackInput = { kind: 'empty' | 'phone' | 'invalid' } | { kind: 'reference'; reference: string };

/** Public tracking accepts an order reference only; a phone number never lists purchases. */
export function classifyTrackInput(raw: string): TrackInput {
  const value = raw.trim().replace(/^#/, '');
  if (!value) return { kind: 'empty' };
  if (!/[a-z]/i.test(value) && /^\+?\d{9,13}$/.test(value.replace(/[\s()-]/g, ''))) return { kind: 'phone' };
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value)) return { kind: 'invalid' };
  return { kind: 'reference', reference: value };
}
