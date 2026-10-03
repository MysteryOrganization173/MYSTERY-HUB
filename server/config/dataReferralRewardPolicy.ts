import type { ReferralRewardRuleRecord } from '../types/referral.js';

// Explicit operator configuration, never a fulfilment fallback or automatic startup seed.
export const STANDARD_DATA_REFERRAL_POLICY: Array<Partial<ReferralRewardRuleRecord> & Pick<ReferralRewardRuleRecord, 'service_type'>> = [
  { id: 'standard_data_acquisition_v1', service_type: 'data', purchase_stage: 'acquisition',
    network: null, product_key: null, reward_type: 'fixed_minor', reward_minor: 50, reward_percent_bps: null, enabled: true },
  { id: 'standard_data_recurring_v1', service_type: 'data', purchase_stage: 'recurring',
    network: null, product_key: null, reward_type: 'fixed_minor', reward_minor: 10, reward_percent_bps: null, enabled: true },
];
