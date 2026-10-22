/** Public disclosure only. Monetary rewards are always calculated on the server. */
export interface PublicDataReferralPolicy {
  service: 'data';
  journey: 'direct';
  status: 'active' | 'disabled' | 'unconfigured' | 'unsupported' | 'ineligible' | 'unavailable';
  basis: 'eligible_margin' | null;
  acquisitionBps: number | null;
  recurringBps: number | null;
  eligibleStages: Array<'acquisition' | 'recurring'>;
}
