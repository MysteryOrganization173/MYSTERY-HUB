import type { ReferralRewardRuleRecord, PurchaseStage } from '../types/referral.js';

export class ReferralRuleValidationError extends Error {}
const stages: PurchaseStage[] = ['any', 'acquisition', 'recurring'];
const services = ['all', 'data', 'airtime', 'afa', 'instant_bundle', 'marketplace', 'website_builder', 'manual_adjustment'];

/** Normalizes only supported admin fields; preserves dormant multi-level values on updates. */
export function validateReferralRule(input: Record<string, unknown>, existing?: ReferralRewardRuleRecord) {
  const fail = (message: string): never => { throw new ReferralRuleValidationError(message); };
  const value: Record<string, unknown> = { ...existing, ...input };
  if (!services.includes(value.service_type as string)) fail('Invalid service_type.');
  const stage = value.purchase_stage ?? 'any';
  if (!stages.includes(stage as PurchaseStage)) fail('Invalid purchase_stage.');
  const type = value.reward_type ?? 'fixed_minor';
  if (type !== 'fixed_minor' && type !== 'percent_bps') fail('Invalid reward_type.');
  const minor = value.reward_minor ?? null;
  const percent = value.reward_percent_bps ?? null;
  if (type === 'fixed_minor') {
    if (!Number.isSafeInteger(minor) || Number(minor) < 0 || Number(minor) > 2_147_483_647) fail('reward_minor must be a nonnegative integer in pesewas.');
    if (percent !== null) fail('Fixed rewards cannot also specify reward_percent_bps.');
  } else {
    if (!Number.isSafeInteger(percent) || Number(percent) < 0 || Number(percent) > 10_000) fail('reward_percent_bps must be an integer from 0 to 10000.');
    if (minor !== null) fail('Percentage rewards cannot also specify reward_minor.');
  }
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') fail('enabled must be boolean.');
  const optionalText = (name: string, max: number): string | null => {
    const item = value[name];
    if (item == null || item === '') return null;
    if (typeof item !== 'string' || item.length > max || !item.trim()) fail(`Invalid ${name}.`);
    return (item as string).trim();
  };
  const network = optionalText('network', 32)?.toLowerCase() || null;
  if (network && !['mtn', 'telecel', 'airteltigo'].includes(network)) fail('Invalid network.');
  const date = (name: string): string | null => {
    const stored = value[name];
    const item = stored instanceof Date && !(name in input) ? stored.toISOString() : stored;
    if (item == null || item === '') return null;
    if (typeof item !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(item)
      || !Number.isFinite(Date.parse(item))) fail(`${name} must be a valid ISO timestamp with timezone.`);
    const clock = (item as string).slice(11, 19).split(':').map(Number);
    if (clock[0] > 23 || clock[1] > 59 || clock[2] > 59) fail(`Invalid time in ${name}.`);
    const calendar = (item as string).slice(0, 10);
    const normalizedCalendar = new Date(`${calendar}T00:00:00Z`).toISOString().slice(0, 10);
    if (calendar !== normalizedCalendar) fail(`Invalid calendar date in ${name}.`);
    return new Date(item as string).toISOString();
  };
  const starts = date('starts_at'); const ends = date('ends_at');
  if (starts && ends && starts >= ends) fail('ends_at must be after starts_at.');
  if (input.id !== undefined && (typeof input.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(input.id))) fail('Invalid rule id.');
  // Multi-level payouts remain dormant: this API does not configure or activate them.
  for (const name of ['level2_reward_minor', 'level2_percent_bps', 'level3_reward_minor', 'level3_percent_bps']) {
    if (name in input) fail('Multi-level reward configuration is outside this policy.');
  }
  return {
    ...existing,
    ...(input.id ? { id: input.id as string } : {}),
    service_type: value.service_type as ReferralRewardRuleRecord['service_type'],
    purchase_stage: stage as PurchaseStage, reward_type: type,
    reward_minor: minor as number | null, reward_percent_bps: percent as number | null,
    enabled: value.enabled ?? false, network, product_key: optionalText('product_key', 128),
    starts_at: starts, ends_at: ends,
  } as Partial<ReferralRewardRuleRecord> & Pick<ReferralRewardRuleRecord, 'service_type'>;
}

export function isActiveReferralRule(rule: ReferralRewardRuleRecord, at = new Date().toISOString()) {
  return rule.enabled && (!rule.starts_at || new Date(rule.starts_at).getTime() <= Date.parse(at))
    && (!rule.ends_at || new Date(rule.ends_at).getTime() >= Date.parse(at));
}

export function compareReferralRules(a: ReferralRewardRuleRecord, b: ReferralRewardRuleRecord, service: string) {
  const rank = (rule: ReferralRewardRuleRecord) => [Boolean(rule.product_key), Boolean(rule.network),
    rule.service_type === service, (rule.purchase_stage || 'any') !== 'any'];
  const left = rank(a); const right = rank(b);
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return Number(right[i]) - Number(left[i]);
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || a.id.localeCompare(b.id);
}

export function publicReferralRule(rule: ReferralRewardRuleRecord) {
  return { id: rule.id, service_type: rule.service_type, network: rule.network, product_key: rule.product_key,
    purchase_stage: rule.purchase_stage || 'any', reward_type: rule.reward_type, reward_minor: rule.reward_minor,
    reward_percent_bps: rule.reward_percent_bps, enabled: rule.enabled, starts_at: rule.starts_at, ends_at: rule.ends_at };
}
