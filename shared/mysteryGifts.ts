/**
 * Mystery Gifts V1 (3.7.2): the public face of a data bundle attached to a Mystery Greeting.
 *
 * Status: CONTRACT PROPOSAL, DORMANT. No greeting can carry a gift today: there is no association between a greeting
 * and an order, no attach endpoint and no gift field in PublicGreeting. This module only fixes, ahead of the 3.5
 * backend work, what a recipient may ever learn about an attached gift and how that is derived from the existing
 * order model. Nothing imports it in production code. See docs/mystery-gifts-3-7-2.md (Codex handoff).
 *
 * The rules it encodes:
 * - The recipient sees what was gifted (network and allowance) and a calm delivery status. Never an amount, a
 *   reference, a phone number, an email, a date, a supplier or anything about refunds. Shared links get forwarded.
 * - The status is derived from the fields the existing public order projection already carries
 *   (server/types/orders.ts toSafePublicOrder: status, manual_review, customer_resolution), in the same precedence as
 *   the receipt (src/utils/dataPurchasePresentation.ts). It is a projection, not a second order-state engine.
 * - "delivered" only when the order model itself confirms delivery. A confirmed payment is never shown as delivery.
 * - No confirmed payment, no gift: an unpaid, cancelled or expired attempt is never shown to the recipient.
 */

export const GIFT_SCHEMA_VERSION = 1;
export const GIFT_NETWORKS = ['mtn', 'telecel', 'airteltigo'] as const;
export type GiftNetwork = typeof GIFT_NETWORKS[number];

/**
 * - pending: payment confirmed, delivery still in progress (paid, queued, submitted, processing).
 * - delivered: the order model confirms delivery (delivered, or support recorded the service as completed).
 * - review: payment confirmed, the outcome is being checked (manual review, resolution review, a paid failure).
 * - undeliverable: the order model has concluded the bundle will not arrive this way (refund pending or confirmed,
 *   an external remedy, or a refunded order).
 * - status_unavailable: the gift is attached (it was paid when attached) but its order could not be read just now.
 */
export const GIFT_STATUSES = ['pending', 'delivered', 'review', 'undeliverable', 'status_unavailable'] as const;
export type GiftStatus = typeof GIFT_STATUSES[number];

/** The only gift fields a public greeting response may ever carry. */
export interface PublicGreetingGift {
  schemaVersion: 1;
  kind: 'data';
  network: GiftNetwork;
  /** The bundle's size as the catalogue names it, e.g. "5GB" or "500MB". */
  allowance: string;
  status: GiftStatus;
}
export const PUBLIC_GIFT_KEYS = ['schemaVersion', 'kind', 'network', 'allowance', 'status'] as const;

/** The same values as server/types/orderResolution.ts CustomerResolution (a test pins that they stay equal). */
export type GiftCustomerResolution = 'review' | 'refund_pending' | 'refund_confirmed' | 'manual_fulfillment' | 'external_compensation';

/** What the mapping reads: a subset of the existing public order projection (toSafePublicOrder). */
export interface GiftOrderFacts {
  service_type: string;
  status: string;
  manual_review: boolean;
  customer_resolution?: GiftCustomerResolution;
  payment_basis?: 'complimentary' | 'operator_recorded';
  network: string;
  bundle_size_snapshot: string;
}

const FINAL = new Set<GiftCustomerResolution>(['refund_confirmed', 'manual_fulfillment', 'external_compensation']);
const IN_PROGRESS = new Set(['paid', 'queued', 'submitted', 'processing']);
/** Statuses the receipt treats as a confirmed payment (dataOrderPresentation paymentConfirmed), plus any resolution. */
const PAID = new Set([...IN_PROGRESS, 'delivered', 'refund_pending', 'refunded']);
/** Allowances exactly as the Data catalogue writes them (server/data/productCatalog.ts dataAmount). */
export const GIFT_ALLOWANCE = /^(?:[1-9]\d{0,3}(?:\.\d{1,2})?)(?:GB|MB)$/;

/**
 * The recipient-facing status of an attached gift, or null when nothing should be shown (no confirmed payment, or
 * not an ordinary paid Data order). A confirmed payment is exactly what the receipt calls one. Precedence then follows
 * dataOrderPresentation: a final resolution, then manual review, then the resolution in progress, then the status.
 */
export function giftStatus(order: Pick<GiftOrderFacts, 'service_type' | 'status' | 'manual_review' | 'customer_resolution' | 'payment_basis'>): GiftStatus | null {
  // V1 gifts are ordinary customer-paid Data orders only. Complimentary or operator-recorded orders are not gifts.
  if (order.service_type !== 'data' || order.payment_basis) return null;
  const resolution = order.customer_resolution;
  // Unpaid, cancelled, expired or an unpaid failure: never shown, even if support is looking at it.
  if (!resolution && !PAID.has(order.status)) return null;
  if (resolution && FINAL.has(resolution)) return resolution === 'manual_fulfillment' ? 'delivered' : 'undeliverable';
  if (order.manual_review) return 'review';
  if (resolution === 'review') return 'review';
  if (resolution === 'refund_pending') return 'undeliverable';
  if (order.status === 'delivered') return 'delivered';
  if (IN_PROGRESS.has(order.status)) return 'pending';
  if (order.status === 'refund_pending' || order.status === 'refunded') return 'undeliverable';
  // Anything else carries a resolution the projection did not classify; stay calm rather than claim an outcome.
  return 'review';
}

/** The minimized public gift for an order, or null. Reads only the facts above; everything else is left behind. */
export function publicGift(order: GiftOrderFacts): PublicGreetingGift | null {
  const status = giftStatus(order);
  const network = GIFT_NETWORKS.find(n => n === order.network);
  if (!status || !network || !GIFT_ALLOWANCE.test(order.bundle_size_snapshot)) return null;
  return { schemaVersion: GIFT_SCHEMA_VERSION, kind: 'data', network, allowance: order.bundle_size_snapshot, status };
}

/**
 * The gift when its order cannot be read right now. Only for an association that the server recorded after a
 * confirmed payment, using the network and allowance it kept at that moment.
 */
export function unavailableGift(network: string, allowance: string): PublicGreetingGift | null {
  const known = GIFT_NETWORKS.find(n => n === network);
  if (!known || !GIFT_ALLOWANCE.test(allowance)) return null;
  return { schemaVersion: GIFT_SCHEMA_VERSION, kind: 'data', network: known, allowance, status: 'status_unavailable' };
}

/** Strict browser-side reader: anything unexpected (an extra field included) means no gift is shown. */
export function readPublicGift(value: unknown): PublicGreetingGift | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !(PUBLIC_GIFT_KEYS as readonly string[]).includes(k))) return null;
  if (v.schemaVersion !== GIFT_SCHEMA_VERSION || v.kind !== 'data') return null;
  if (typeof v.network !== 'string' || !(GIFT_NETWORKS as readonly string[]).includes(v.network)) return null;
  if (typeof v.allowance !== 'string' || !GIFT_ALLOWANCE.test(v.allowance)) return null;
  if (typeof v.status !== 'string' || !(GIFT_STATUSES as readonly string[]).includes(v.status)) return null;
  return { schemaVersion: 1, kind: 'data', network: v.network as GiftNetwork, allowance: v.allowance, status: v.status as GiftStatus };
}
