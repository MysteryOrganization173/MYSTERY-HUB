/**
 * Display estimate of the Instant Bundle checkout fee for an amount the catalogue has not priced,
 * such as a Flexi amount the customer typed. It mirrors the server's default gross-up (2% gateway
 * rate plus a GH₵0.10 processing margin); the server recalculates the real total when payment starts.
 */
export function estimateInstantCheckoutFeeGhc(faceValueGhc: number): number {
  const face = Math.round(faceValueGhc * 100);
  return Number((Math.ceil((face + 10) / 0.98) / 100 - faceValueGhc).toFixed(2));
}
