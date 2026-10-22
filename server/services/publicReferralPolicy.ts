import { FinanceStore } from '../db/financeStore.js';
import { ReferralStore } from '../db/referralStore.js';
import { isActiveReferralRule, publicReferralRule } from './referralRulePolicy.js';
import type { PublicDataReferralPolicy } from '../../shared/publicReferralPolicy.js';
import type { ReferralRewardRuleRecord } from '../types/referral.js';

/** Read the same economics:data record as economicsPolicy; never seed or save it.
 * Only allowlisted disclosure fields leave this boundary, not the private policy.
 * A matching active rule remains necessary. Specific rules gate eligible networks/
 * products but do not override stage_margin_percent rates in computeEconomicReward.
 */
export function describePublicDataPolicy(config: unknown, rules: ReferralRewardRuleRecord[], at: string): PublicDataReferralPolicy {
  const result: PublicDataReferralPolicy = { service: 'data', journey: 'direct', status: 'unconfigured',
    basis: null, acquisitionBps: null, recurringBps: null, eligibleStages: [] };
  if (!config || typeof config !== 'object') return result;
  const policy = config as Record<string, unknown>;
  if (policy.enabled === false) return { ...result, status: 'disabled' };
  if (policy.enabled !== true) return result;
  if (policy.mode !== 'stage_margin_percent') return { ...result, status: 'unsupported' };
  const validBps = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 10_000;
  if (!validBps(policy.acquisitionBps) || !validBps(policy.recurringBps)) return { ...result, status: 'unavailable' };
  const eligibleStages = (['acquisition', 'recurring'] as const).filter(stage => rules.some(rule =>
    (rule.service_type === 'data' || rule.service_type === 'all') && isActiveReferralRule(rule, at)
    && ((rule.purchase_stage || 'any') === 'any' || rule.purchase_stage === stage)));
  if (!eligibleStages.length) return { ...result, status: 'ineligible' };
  return { ...result, status: 'active', basis: 'eligible_margin', acquisitionBps: policy.acquisitionBps,
    recurringBps: policy.recurringBps, eligibleStages };
}

export async function getPublicReferralRules() {
  const at = new Date().toISOString();
  const rules = await ReferralStore.getAllRules();
  let dataPolicy: PublicDataReferralPolicy;
  try { dataPolicy = describePublicDataPolicy(await FinanceStore.readConfig('economics:data'), rules, at); }
  catch { dataPolicy = { service: 'data', journey: 'direct', status: 'unavailable', basis: null,
    acquisitionBps: null, recurringBps: null, eligibleStages: [] }; }
  return { success: true, rules: rules.filter(rule => isActiveReferralRule(rule, at)).map(publicReferralRule), dataPolicy };
}
