import type { PoolClient } from 'pg';
import { getPool } from '../db/connection.js';
import { ReferralStore } from '../db/referralStore.js';
import { AdminAuditStore } from '../db/adminAuditStore.js';
import { STANDARD_DATA_REFERRAL_POLICY } from '../config/dataReferralRewardPolicy.js';
import { validateReferralRule, publicReferralRule } from './referralRulePolicy.js';
import { EarnInputError } from './adminEarnQuery.js';
import type { ReferralRewardRuleRecord } from '../types/referral.js';

export function describeAdminRule(rule: ReferralRewardRuleRecord, rules: ReferralRewardRuleRecord[], now = Date.now()) {
  const effectiveStatus = !rule.enabled ? 'Disabled' : rule.starts_at && Date.parse(String(rule.starts_at)) > now ? 'Scheduled'
    : rule.ends_at && Date.parse(String(rule.ends_at)) < now ? 'Expired' : 'Active';
  const warnings: string[] = [];
  if (rule.reward_type === 'fixed_minor') warnings.push('Fixed rewards above an order charge are blocked, never reduced automatically.');
  if (rules.some(other => other.id !== rule.id && other.enabled && rule.enabled && other.service_type === rule.service_type
    && (other.network || null) === (rule.network || null) && (other.product_key || null) === (rule.product_key || null)
    && (other.purchase_stage || 'any') === (rule.purchase_stage || 'any')
    && (!other.ends_at || !rule.starts_at || new Date(other.ends_at) >= new Date(rule.starts_at))
    && (!rule.ends_at || !other.starts_at || new Date(rule.ends_at) >= new Date(other.starts_at)))) warnings.push('Overlapping equivalent rule: newest creation time wins, then rule ID.');
  return { ...publicReferralRule(rule), created_at: rule.created_at, effectiveStatus, warnings };
}
export async function recommendedPolicyStatus() {
  const rules = await ReferralStore.getAllRules();
  return STANDARD_DATA_REFERRAL_POLICY.map(recommended => {
    const existing = rules.find(rule => rule.id === recommended.id);
    const differs = existing && ['service_type','purchase_stage','network','product_key','reward_type','reward_minor','reward_percent_bps','starts_at','ends_at'].some(key =>
      (existing[key as keyof typeof existing] ?? null) !== (recommended[key as keyof typeof recommended] ?? null));
    return { recommended: publicReferralRule(recommended as ReferralRewardRuleRecord), existing: existing ? describeAdminRule(existing,rules) : null,
      status: !existing ? 'missing' : differs ? 'differs' : existing.enabled ? 'enabled' : 'disabled' };
  });
}
export async function saveAdminRewardRule(adminId: string, input: Record<string, unknown>) {
  const work = async (client?: PoolClient) => {
    const rules = await ReferralStore.getAllRules(client); const existing = rules.find(rule => rule.id === input.id);
    const normalized = validateReferralRule(input,existing);
    if (normalized.enabled && input.confirmEnable !== true) throw new EarnInputError('Confirm the enabled money-impacting rule before saving.');
    const saved = await ReferralStore.createOrUpdateRule(normalized,client);
    const actions = [existing ? 'referral_rule_changed' : 'referral_rule_created'];
    if (saved.enabled && !existing?.enabled) actions.push('referral_rule_enabled');
    if (!saved.enabled && existing?.enabled) actions.push('referral_rule_disabled');
    for (const action of actions) await AdminAuditStore.record({adminUserId:adminId,action,entityType:'referral_reward_rule',entityId:saved.id,
      metadata:{ service_type:saved.service_type,purchase_stage:saved.purchase_stage,enabled:saved.enabled,reward_type:saved.reward_type,
        reward_minor:saved.reward_minor,reward_percent_bps:saved.reward_percent_bps }},client);
    return {rule:describeAdminRule(saved,[...rules.filter(r=>r.id!==saved.id),saved]),warnings:describeAdminRule(saved,rules).warnings};
  };
  const db = getPool(); if (!db) return work(); const client = await db.connect();
  try { await client.query('BEGIN'); await client.query("SELECT pg_advisory_xact_lock(hashtextextended('admin-referral-rule-config',0));");
    const result = await work(client); await client.query('COMMIT'); return result;
  } catch(error) { await client.query('ROLLBACK'); throw error; } finally {client.release();}
}
