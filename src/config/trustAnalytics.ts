export interface TrustIndicator { value: string; label: string; detail: string }
export interface ApprovedTrustStatistic extends TrustIndicator {
  status: 'draft' | 'verified';
  evidence: string;
  approvedBy: string;
  verifiedOn: string;
}
// Manually reviewed, public-safe evidence is required before publishing a performance claim.
// Keep empty until the founder approves actual source data; samples never enter this list.
export const APPROVED_TRUST_STATISTICS: readonly ApprovedTrustStatistic[] = [];
export const SAMPLE_TRUST_STATISTICS: readonly TrustIndicator[] = [
  { value: '12K+', label: 'Orders Delivered', detail: 'Sample design figure' },
  { value: '99.9%', label: 'Payment Reliability', detail: 'Sample design figure' },
  { value: '5K+', label: 'Active Customers', detail: 'Sample design figure' },
  { value: '24/7', label: 'Platform Access', detail: 'Sample design figure' },
];
export const SERVICE_TRUST_INDICATORS: readonly TrustIndicator[] = [
  { value: 'Paystack', label: 'Payment Checkout', detail: 'Review your total before paying.' },
  { value: 'Reference', label: 'Order Tracking', detail: 'Follow the status of your purchase.' },
  { value: 'MoMo', label: 'Mobile Money Support', detail: 'Use the options shown at checkout.' },
  { value: 'Ghana', label: 'Everyday Digital Services', detail: 'Data, websites and more in one place.' },
];
export function publishedTrustIndicators(approved: readonly ApprovedTrustStatistic[] = APPROVED_TRUST_STATISTICS): readonly TrustIndicator[] {
  const verified = approved.filter(item => item.status === 'verified' && item.evidence.trim() && item.approvedBy.trim() && /^\d{4}-\d{2}-\d{2}$/.test(item.verifiedOn) && Number.isFinite(Date.parse(item.verifiedOn)));
  // Numerical positions contain approved statistics only; capabilities have a separate layout.
  return verified.slice(0, 4);
}
