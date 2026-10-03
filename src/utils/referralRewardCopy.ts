import type { PublicRewardRule } from '../services/apiClient';

export function describeReferralReward(rule: PublicRewardRule): string {
  const amount = rule.reward_type === 'fixed_minor'
    ? `GH₵${((rule.reward_minor || 0) / 100).toFixed(2)}`
    : `${((rule.reward_percent_bps || 0) / 100).toFixed(1)}% of the order total`;
  const service = ({ data: 'Data', airtime: 'Airtime', instant_bundle: 'Instant Bundle', marketplace: 'Marketplace',
    website_builder: 'Website Builder', all: '' } as Record<string, string>)[rule.service_type] ?? rule.service_type;
  const purchase = `${service ? `${service} ` : ''}purchase`;
  if (rule.purchase_stage === 'acquisition') return `${amount} on a referred customer's first qualifying ${purchase}`;
  if (rule.purchase_stage === 'recurring') return `${amount} on future qualifying ${purchase}s`;
  return `${amount} per qualifying ${purchase}`;
}
