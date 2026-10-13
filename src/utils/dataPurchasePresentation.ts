import { serviceNotices } from '../config/serviceNotices';
import type { NetworkId } from '../types';

export function dataDeliveryNote(network: NetworkId): string {
  const notice = serviceNotices[network];
  return notice.enabled ? notice.summary.replace('⚡ ', '') : 'Delivery status is available in Track Order.';
}

export function maskDataRecipient(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (phone.includes('*') || phone.includes('•') || digits.length < 7) return phone;
  return `${digits.slice(0, 3)} ••• ${digits.slice(-4)}`;
}

/** Only buyer-entered or authenticated account orders opt in; public tracking stays masked. */
export function dataRecipientDisplay(phone: string, buyerVisible = false): string {
  if (!buyerVisible) return maskDataRecipient(phone);
  const digits = phone.replace(/\D/g, '');
  if (phone.includes('*') || phone.includes('•') || digits.length !== 10) return phone;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

// Presentation only: a popup callback or local order never confirms payment.
export function dataOrderPresentation(status?: string, manualReview = false, customerResolution?:'review'|'refund_pending'|'refund_confirmed') {
  const paymentConfirmed = Boolean(customerResolution) || ['paid', 'queued', 'submitted', 'processing', 'delivered', 'refund_pending', 'refunded'].includes(status || '');
  const delivered = status === 'delivered';
  const processing = ['submitted', 'processing'].includes(status || '');
  let title = paymentConfirmed ? 'Payment confirmed' : 'Confirming your payment';
  let label = paymentConfirmed ? 'Awaiting delivery' : 'Awaiting payment confirmation';
  let next = 'We are checking the payment status. Keep your order reference; check Track Order before trying another payment.';
  if (status === 'paid' || status === 'queued') { label = 'Queued for delivery'; next = 'Your payment is confirmed. Follow this order while delivery is queued; network delays can occur.'; }
  if (processing) { label = 'Processing'; next = 'The network is processing your bundle. You can leave this page and return to Track Order with your reference.'; }
  if (delivered) { title = 'Your data has been delivered'; label = 'Delivered'; next = 'Delivery is confirmed. Check the recipient’s data balance on their network.'; }
  if (status === 'refund_pending') { title = 'Refund under review'; label = 'Refund pending'; next = 'Delivery could not be completed. Contact support with this reference for the refund review; do not repeat this order.'; }
  if (status === 'refunded') { title = 'Refund confirmation pending'; label = 'Refund review'; next = 'Customer refund completion has not been verified here. Contact support with your order reference.'; }
  if (status === 'failed') { title = 'This order needs attention'; label = 'Delivery issue'; next = 'Contact support with your order reference before placing the same order again.'; }
  if (status === 'cancelled' || status === 'expired') { title = 'Payment was not completed'; label = status === 'expired' ? 'Payment expired' : 'Payment cancelled'; next = 'Check your payment history first. If money was deducted, contact support with this reference before paying again.'; }
  if(customerResolution==='review'){title='Payment received · Resolution under review';label='Resolution review';next='Your payment was received, but delivery or customer refund needs confirmation. Contact support with this reference; do not repeat the order.';}
  if(customerResolution==='refund_pending'){title='Customer refund awaiting verification';label='Refund pending';next='A customer refund is being reconciled. Completion is not confirmed yet; contact support with your reference.';}
  if(customerResolution==='refund_confirmed'){title='Refund verified';label='Refunded';next='Your full refund has been verified. If you paid through Paystack, your bank or MoMo provider may take time to show the funds. Contact support with your reference if you need help.';}
  if (manualReview && customerResolution!=='refund_confirmed') { title = 'Your order needs support review'; label = 'Manual review'; next = 'Support needs to check this order. Keep your reference and avoid placing the same order again.'; }
  return { paymentConfirmed, delivered, processing, title, label, next };
}

/** Display only an actual validity; legacy delivery/routing labels are not durations. */
export function dataValidityLabel(validity?: string): string {
  const value = validity?.trim() || '';
  return /^direct (?:sim(?: credit)?|credit)$/i.test(value) ? '' : value;
}
