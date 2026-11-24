import type { OrderRecord } from '../types';
import { customerOrderStatus, effectiveStatus, isMarketplaceOrder, type CustomerOrderGroup } from './customerOrderPresentation';
import { dataOrderPresentation } from './dataPurchasePresentation';

/**
 * Mystery Hub 3.6.2 · what the customer's receipt says about one order.
 *
 * Presentation only, and built on the two existing helpers, never beside them: the status group and its short label
 * come from `customerOrderStatus` (the same answer the Orders list card shows), and the payment, delivery and
 * resolution wording comes from `dataOrderPresentation`. This file only chooses the service-appropriate words (airtime
 * is not a bundle, an AFA registration is not a delivery, a Marketplace item is not on a network), the honest label
 * for the amount, and the stages of the journey. Every stage is complete only when the server has reported it:
 * nothing here advances with time, guesses a percentage or treats a payment popup as a payment.
 */

export type ReceiptService = 'data' | 'airtime' | 'instant' | 'afa' | 'marketplace' | 'results_checker';
/** pending: payment not confirmed · progress · success · attention: support must look · refund · resolved · closed: payment not completed */
export type ReceiptTone = 'pending' | 'progress' | 'success' | 'attention' | 'refund' | 'resolved' | 'closed';
export type ReceiptStepState = 'done' | 'current' | 'halted' | 'upcoming';
export interface ReceiptStep { key: string; label: string; detail: string; state: ReceiptStepState }

export interface OrderReceiptView {
  service: ReceiptService;
  group: CustomerOrderGroup;
  tone: ReceiptTone;
  /** The short status, identical to the Orders card. */
  label: string;
  title: string;
  next: string;
  /** 'delivery': payment → fulfilment → done. 'resolution': payment → support review → outcome. 'closed': no journey. */
  journeyKind: 'delivery' | 'resolution' | 'closed';
  steps: ReceiptStep[];
  amountLabel: string;
  amountNote: string;
  /** One line about the payment itself, from server state only. */
  paymentLine: string;
  /** Whether a payment the customer made is confirmed by the server (assisted orders never claim one). */
  paymentConfirmed: boolean;
  /** True when the server has never answered for this record (an old device record): nothing here is confirmed. */
  unchecked: boolean;
  /** The word for the finished stage, and whether its date may be shown. */
  doneWord: 'Delivered' | 'Registered' | 'Completed' | 'Ready';
  showDoneDate: boolean;
  /** Delivery by the original supplier, as the server reported it (never a manual or external remedy). */
  supplierDelivered: boolean;
  /** Festive decoration is allowed only while things are going well: in progress or delivered. */
  festive: boolean;
  /** The in-progress caution, in this service's words. */
  notYetDone: string;
}

const TONE: Record<CustomerOrderGroup, ReceiptTone> = {
  awaiting_payment: 'pending', in_progress: 'progress', delivered: 'success', attention: 'attention',
  refund_pending: 'refund', refunded: 'resolved', resolved: 'resolved', cancelled: 'closed',
};

export function receiptService(order: Pick<OrderRecord, 'serviceType' | 'bundle'>): ReceiptService {
  const id = order.bundle?.id || '';
  if (order.serviceType === 'afa') return 'afa';
  if (order.serviceType === 'results_checker') return 'results_checker';
  if (isMarketplaceOrder(order as OrderRecord)) return 'marketplace';
  if (order.serviceType === 'instant_bundle' || id.startsWith('instant-') || Boolean(order.bundle?.packageId)) return 'instant';
  if (order.serviceType === 'airtime' || id.startsWith('airtime-')) return 'airtime';
  return 'data';
}

/** Marketplace stages as the server records them; a paid order keeps `pending_payment` or `paid` until Admin moves it. */
const MARKETPLACE_NEXT: Record<string, string> = {
  pending_payment: 'Your payment is confirmed. Follow this order for updates on preparation, pickup or delivery.',
  paid: 'Your payment is confirmed. Follow this order for updates on preparation, pickup or delivery.',
  awaiting_fulfilment: 'Your item is being prepared. Follow this order for updates.',
  ready_for_pickup: 'Your item is ready for pickup. Keep your order reference with you.',
  out_for_delivery: 'Your item is out for delivery. Keep your order reference with you.',
};
const MARKETPLACE_STAGE: Record<string, string> = { awaiting_fulfilment: 'Being prepared', ready_for_pickup: 'Ready for pickup', out_for_delivery: 'Out for delivery' };

/** Stage names per service: what "fulfilment" and "done" mean for this purchase. */
const STAGES: Record<ReceiptService, { middle: string; done: OrderReceiptView['doneWord']; after: string; notYet: string }> = {
  data: { middle: 'With the network', done: 'Delivered', after: 'Timing depends on the network', notYet: 'Payment confirmation does not mean it has been delivered.' },
  airtime: { middle: 'With the network', done: 'Delivered', after: 'Timing depends on the network', notYet: 'Payment confirmation does not mean it has been delivered.' },
  instant: { middle: 'With the network', done: 'Delivered', after: 'Timing depends on the network', notYet: 'Payment confirmation does not mean it has been delivered.' },
  afa: { middle: 'Registration', done: 'Registered', after: 'After registration', notYet: 'Payment confirmation does not mean the registration is complete.' },
  marketplace: { middle: 'Preparing', done: 'Completed', after: 'After pickup or delivery', notYet: 'Payment confirmation does not mean your item is ready.' },
  results_checker: { middle: 'Processing', done: 'Ready', after: 'After processing', notYet: 'Payment confirmation does not mean your checker purchase is ready.' },
};

export function orderReceiptView(order: OrderRecord): OrderReceiptView {
  const service = receiptService(order);
  const status = customerOrderStatus(order);
  const raw = effectiveStatus(order);
  const resolution = order.customerResolution;
  const basis = order.paymentBasis;
  const unchecked = !order.serverStatus;
  // Manual review counts only where the shared card rule counts it (AFA ignores it in some stages), so the title
  // never contradicts the card.
  const review = Boolean(order.manualReview) && (service !== 'afa' || status.group === 'attention');
  const dv = dataOrderPresentation(raw, review, resolution, basis);
  const tone = TONE[status.group];
  const delivered = status.group === 'delivered';
  const stages = STAGES[service];

  // ── Words: the shared receipt wording, with service-specific words where the shared ones would be wrong. ──
  let title = dv.title;
  let next = dv.next;
  const plain = !resolution && !basis;
  if (plain && service === 'afa') {
    if (delivered) { title = 'AFA registration confirmed'; next = 'Your MTN AFA registration is confirmed. MTN packages are purchased separately.'; }
    else if (status.group === 'in_progress') { title = 'Registration in progress'; next = 'Payment and registration are separate stages. Follow this order for registration updates; contact support if it needs attention.'; }
    else if (status.group === 'attention') { title = 'Your registration needs support review'; next = order.statusMessage || 'Registration needs support review. Do not start another registration until support confirms it is safe.'; }
  } else if (plain && service === 'marketplace') {
    const stage = order.marketplaceStatus || '';
    if (status.group === 'in_progress') { title = 'Payment confirmed'; next = MARKETPLACE_NEXT[stage] || MARKETPLACE_NEXT.paid; }
    else if (delivered) { title = 'Order completed'; next = 'This Marketplace order is complete. Contact support with your reference if you need help.'; }
    else if (stage === 'cancelled') { title = 'Order cancelled'; next = dv.paymentConfirmed ? 'This order was cancelled. Contact support with this reference about your payment before buying again.' : dv.next; }
    else if (stage === 'refund_pending') { title = 'Refund under review'; next = 'Contact support with this reference for the refund review; do not repeat this order.'; }
    else if (stage === 'refunded') { title = 'Refund confirmation pending'; next = 'Customer refund completion has not been verified here. Contact support with your order reference.'; }
  } else if (plain && service === 'results_checker') {
    if (delivered) { title = 'Your checker purchase is ready'; next = 'Open your Results Checker receipt for the details of this purchase.'; }
    else if (status.group === 'in_progress') next = 'Your checker purchase is being processed. Open your Results Checker receipt for updates.';
  } else if (plain && service === 'airtime') {
    if (delivered) { title = 'Your airtime has been delivered'; next = 'Delivery is confirmed. Check the recipient’s airtime balance on their network.'; }
    else if (dv.processing) next = 'The network is processing this airtime top-up. You can leave this page and return to Track Order with your reference.';
    else if (status.group === 'in_progress') next = 'Your payment is confirmed. Follow this order while the top-up is queued; network delays can occur.';
  } else if (plain && service === 'instant' && delivered) {
    title = 'Your bundle has been delivered'; next = 'Delivery is confirmed. Check the recipient’s balance on their network.';
  } else if (!plain && delivered && service !== 'data' && basis) {
    // Assisted orders are Data today; any other service keeps neutral delivery words.
    title = service === 'afa' ? 'AFA registration confirmed' : 'Your order has been delivered';
  } else if (resolution === 'review' && service === 'afa') {
    next = 'Your payment was received, but the registration or a customer refund needs confirmation. Contact support with this reference; do not start another registration.';
  }

  // ── Amount: say exactly what is known about the money. ──
  const paymentConfirmed = dv.paymentConfirmed && !unchecked;
  let amountLabel = 'Amount paid', amountNote = '';
  if (basis === 'complimentary') { amountLabel = 'Complimentary'; amountNote = 'No customer payment'; }
  else if (basis === 'operator_recorded') { amountLabel = 'Recorded payment'; amountNote = 'Collected outside Mystery Hub checkout'; }
  else if (unchecked) { amountLabel = 'Order total'; amountNote = 'Not yet checked with Mystery Hub'; }
  else if (!paymentConfirmed) { amountLabel = 'Order total'; amountNote = status.group === 'cancelled' ? 'Payment not completed' : 'Payment not confirmed yet'; }
  else if (resolution === 'refund_confirmed') amountNote = 'Refund verified';
  else if (status.group === 'refund_pending') amountNote = 'Refund not confirmed yet';
  else if (resolution === 'external_compensation') amountNote = 'Remedy recorded by support';

  const paymentLine = basis === 'complimentary' ? 'Complimentary · no payment taken'
    : basis === 'operator_recorded' ? 'Recorded by support · not a Paystack payment'
    : unchecked ? 'Last known on this device'
    : paymentConfirmed ? 'Confirmed by Mystery Hub'
    : status.group === 'cancelled' ? (raw === 'expired' ? 'Expired before confirmation' : 'Not completed')
    : 'Waiting for confirmation';

  // ── Journey ──
  const closed = status.group === 'cancelled' && !(service === 'marketplace' && paymentConfirmed);
  const resolutionPath = !basis && (Boolean(resolution) || ['refund_pending', 'refunded', 'resolved'].includes(status.group));
  const journeyKind: OrderReceiptView['journeyKind'] = closed ? 'closed' : resolutionPath ? 'resolution' : 'delivery';
  let steps: ReceiptStep[] = [];

  if (journeyKind === 'delivery') {
    const halted = status.group === 'attention' || status.group === 'cancelled';
    const paymentLabel = basis === 'complimentary' ? 'Complimentary' : basis === 'operator_recorded' ? 'Payment recorded' : 'Payment';
    const payDone = dv.paymentStageComplete && !unchecked;
    const middleDetail = service === 'marketplace' && MARKETPLACE_STAGE[order.marketplaceStatus || ''] ? MARKETPLACE_STAGE[order.marketplaceStatus || '']
      : service === 'afa' ? (raw === 'submitted' ? 'Submitted for registration' : raw === 'processing' ? 'Being processed' : 'Queued after payment')
      : dv.processing ? (basis ? 'With the supplier' : 'Being processed now') : basis ? 'Queued for the supplier' : 'Queued after payment';
    steps = [
      { key: 'payment', label: paymentLabel, detail: payDone ? paymentLine : 'Waiting for confirmation', state: payDone ? 'done' : 'upcoming' },
      { key: 'fulfilment', label: stages.middle, detail: delivered ? 'Completed' : payDone ? middleDetail : 'After payment', state: delivered ? 'done' : 'upcoming' },
      { key: 'done', label: stages.done, detail: delivered ? 'Confirmed' : stages.after, state: delivered ? 'done' : 'upcoming' },
    ];
    const current = steps.findIndex(s => s.state !== 'done');
    if (current >= 0) steps[current] = { ...steps[current], state: halted ? 'halted' : 'current', detail: halted ? status.label : steps[current].detail };
  } else if (journeyKind === 'resolution') {
    const refundPath = resolution === 'refund_pending' || resolution === 'refund_confirmed' || status.group === 'refund_pending';
    const final = resolution === 'refund_confirmed' || resolution === 'manual_fulfillment' || resolution === 'external_compensation';
    // The refund stage reads "Refund verified" only once it is; until then it is the confirmation still to come.
    const outcome: ReceiptStep = resolution === 'manual_fulfillment' ? { key: 'outcome', label: 'Completed by support', detail: 'Through another channel', state: 'done' }
      : resolution === 'external_compensation' ? { key: 'outcome', label: 'Remedy recorded', detail: 'Not a Paystack refund', state: 'done' }
      : refundPath ? (resolution === 'refund_confirmed' ? { key: 'outcome', label: 'Refund verified', detail: 'Verified', state: 'done' } : { key: 'outcome', label: 'Refund confirmation', detail: 'Not confirmed yet', state: 'upcoming' })
      : { key: 'outcome', label: 'Outcome', detail: 'Support will confirm', state: 'upcoming' };
    steps = [
      { key: 'payment', label: 'Payment received', detail: paymentConfirmed ? 'Confirmed by Mystery Hub' : 'Not confirmed', state: paymentConfirmed ? 'done' : 'upcoming' },
      { key: 'review', label: 'Support review', detail: final ? 'Finished' : status.label, state: final ? 'done' : status.group === 'attention' ? 'halted' : 'current' },
      outcome,
    ];
  }

  return {
    service, group: status.group, tone, label: status.label, title, next, journeyKind, steps,
    amountLabel, amountNote, paymentLine, paymentConfirmed, unchecked,
    doneWord: stages.done, showDoneDate: delivered || resolution === 'manual_fulfillment',
    // Only the server's own `delivered`, never a device record's last known state or an operator remedy.
    supplierDelivered: order.serverStatus === 'delivered' && !resolution && delivered,
    festive: tone === 'progress' || tone === 'success',
    notYetDone: stages.notYet,
  };
}

/** A saving from the order's own commercial snapshot, shown only once a payment is confirmed (never today's prices). */
export function orderSaving(order: Pick<OrderRecord, 'commercialPricing'>, group: CustomerOrderGroup): number {
  const pricing = order.commercialPricing;
  if (!pricing || !['in_progress', 'delivered'].includes(group)) return 0;
  return Math.max(0, (pricing.standardMinor ?? pricing.regularMinor) - pricing.paidMinor) / 100;
}
