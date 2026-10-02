/**
 * Mystery Earn V1 Types & Core Domain Models
 * Strict typing for Referral Engine, Attribution, and Immutable Reward Ledger.
 */

export type RewardLedgerStatus = 'pending' | 'approved' | 'rejected' | 'reversed';

export type RewardServiceType =
  | 'data'
  | 'airtime'
  | 'instant_bundle'
  | 'marketplace'
  | 'website_builder'
  | 'manual_adjustment';

export type RewardCalculationType = 'fixed_minor' | 'percent_bps';

export interface ReferralProfileRecord {
  id: string;
  user_id: string;
  referral_code: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReferralAttributionRecord {
  id: string;
  referrer_user_id: string;
  referred_user_id: string | null;
  visitor_key: string | null;
  source_code: string;
  first_landing_path: string | null;
  first_seen_at: string;
  bound_at: string | null;
  status: 'active' | 'locked' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface ReferralClickRecord {
  id: string;
  referral_profile_id: string;
  referrer_user_id: string;
  referral_code: string;
  visitor_key: string | null;
  landing_path: string | null;
  user_agent_safe: string | null;
  created_at: string;
}

export interface ReferralRewardRuleRecord {
  id: string;
  service_type: RewardServiceType | 'all';
  product_key: string | null;
  network: string | null;
  reward_type: RewardCalculationType;
  reward_minor: number | null; // stored in pesewas
  reward_percent_bps: number | null; // basis points (100 = 1%)
  enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RewardLedgerRecord {
  id: string;
  referrer_user_id: string;
  referred_user_id: string | null;
  referral_attribution_id: string | null;
  order_id: string | null;
  marketplace_product_id: string | null;
  service_type: RewardServiceType;
  reward_rule_id: string | null;
  amount_minor: number; // integer pesewas
  currency: 'GHS';
  status: RewardLedgerStatus;
  reason: string;
  idempotency_key: string;
  reversal_of_id: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  reversed_at: string | null;
  metadata_json: Record<string, unknown> | null;
}

export interface SafeRewardLedgerItem {
  id: string;
  service_type: RewardServiceType;
  amount_minor: number;
  amount_ghc: number;
  currency: 'GHS';
  status: RewardLedgerStatus;
  reason: string;
  created_at: string;
  approved_at: string | null;
  reversed_at: string | null;
}

export interface ReferralSummary {
  code: string;
  shareUrl: string;
  isEnabled: boolean;
  clicksCount: number;
  referredCustomersCount: number;
  pendingRewardsMinor: number;
  pendingRewardsGhc: number;
  approvedRewardsMinor: number;
  approvedRewardsGhc: number;
  totalRewardsMinor: number;
  totalRewardsGhc: number;
}
