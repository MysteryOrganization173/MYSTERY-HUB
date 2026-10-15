/**
 * Typing help for the AFA form. These only shape what the customer sees while typing; the shared
 * validateAfaPayload and the server still decide what is valid. Nothing here stores or logs values.
 */

/** GHA-#########-# as the customer types digits, whether or not they type the GHA prefix. */
export function formatGhanaCardInput(raw: string): string {
  const upper = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const digits = upper.replace(/^GHA/, '').replace(/[^0-9]/g, '').slice(0, 10);
  if (!digits) return 'GHA'.startsWith(upper.slice(0, 3)) ? upper.slice(0, 3) : '';
  return `GHA-${digits.slice(0, 9)}${digits.length > 9 ? `-${digits.slice(9)}` : ''}`;
}

/** Server status to the three customer-facing registration steps. */
export function afaJourney(status?: string, manualReview = false, paymentConfirmed?:boolean) {
  const stopped = manualReview || ['failed', 'refund_pending', 'refunded', 'cancelled', 'expired'].includes(status || '');
  const reached = paymentConfirmed===false ? 0 : status === 'delivered' ? 3
    : ['submitted', 'processing'].includes(status || '') ? 2
    : ['paid', 'queued', 'failed', 'refund_pending', 'refunded'].includes(status || '') || manualReview ? 1
    : 0;
  return { stopped, reached, registered: paymentConfirmed!==false && status === 'delivered' && !manualReview };
}
