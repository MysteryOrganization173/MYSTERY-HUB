import { FinanceError } from '../db/financeStore.js';
import { compareReferralRules, isActiveReferralRule } from './referralRulePolicy.js';
import type { ReferralRewardRuleRecord } from '../types/referral.js';

// Admin read only. Deadlines do not retry or cancel financial/supplier writes.
export class AdminReadFailure extends FinanceError {
  constructor(public dependency: string, public reason: 'timeout' | 'invalid' | 'unavailable') {
    super('Commercial service unavailable.', 503);
  }
}
export async function adminRead<T>(dependency: string, read: () => Promise<T>, timeoutMs = 5000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([Promise.resolve().then(read), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new AdminReadFailure(dependency, 'timeout')), timeoutMs);
    })]);
  } catch (error) {
    throw error instanceof AdminReadFailure ? error : new AdminReadFailure(dependency, 'unavailable');
  } finally { clearTimeout(timer!); }
}
export function validateAdminConfig(prices: any, offer: any, store: any, economy: any) {
  const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
  const minor = (v: any) => Number.isSafeInteger(v) && v >= 0;
  const bps = (v: any) => minor(v) && v < 10000;
  const fail = (dependency: string): never => { throw new AdminReadFailure(dependency, 'invalid'); };
  if (!object(prices.products) || typeof prices.version !== 'string' || typeof prices.reserveConfigured !== 'boolean'
    || !bps(prices.reserveBps) || !minor(prices.reserveFixedMinor)) fail('direct_pricing');
  for (const p of Object.values(prices.products) as any[]) {
    if (!object(p) || !minor(p.retailMinor) || p.retailMinor === 0 || typeof p.enabled !== 'boolean'
      || (p.recommendedMinor != null && !minor(p.recommendedMinor))) fail('direct_pricing');
  }
  if (typeof offer.enabled !== 'boolean' || !minor(offer.discountMinor) || !Array.isArray(offer.services)
    || typeof offer.version !== 'string') fail('welcome_offer');
  if (!object(store.wholesale) || !object(store.policy)) fail('reseller_config');
  for (const value of Object.values(store.policy)) if (typeof value === 'number' && !minor(value)) fail('reseller_config');
  for (const p of Object.values(store.wholesale) as any[]) if (!object(p) || !minor(p.wholesaleMinor)) fail('reseller_config');
  if (economy && (!object(economy) || typeof economy.enabled !== 'boolean'
    || (economy.mode != null && !['fixed', 'margin_percent', 'stage_margin_percent'].includes(economy.mode)))) fail('referral_economics');
}
export function adminMatchingRule(rules: ReferralRewardRuleRecord[], network: string, product: string, stage: 'acquisition' | 'recurring', at: string) {
  return rules.filter(r => isActiveReferralRule(r, at) && ['all', 'data'].includes(r.service_type)
    && (!r.network || r.network.toLowerCase() === network.toLowerCase()) && (!r.product_key || r.product_key === product)
    && ((r.purchase_stage || 'any') === 'any' || r.purchase_stage === stage))
    .sort((a, b) => compareReferralRules(a, b, 'data'))[0] ?? null;
}
export async function adminSupplierCosts<T>(products: T[], resolve: (product: T) => Promise<any>, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  const result: { minor: number | null; state: 'known' | 'unknown' | 'unavailable' }[] = new Array(products.length);
  let next = 0, stopped = false;
  await Promise.all(Array.from({ length: Math.min(4, products.length) }, async () => {
    for (;;) {
      const index = next++; if (index >= products.length) return;
      try {
        if (stopped || Date.now() >= deadline) throw new AdminReadFailure('supplier_cost', 'timeout');
        const response = await adminRead('supplier_cost', () => resolve(products[index]), Math.max(1, deadline - Date.now()));
        const value = response?.resolved?.supplierCostMinor;
        const known = Number.isSafeInteger(value) && value >= 0;
        result[index] = { minor: known ? value : null, state: known ? 'known' : 'unknown' };
      } catch (error) { if (error instanceof AdminReadFailure && error.reason === 'timeout') stopped = true; result[index] = { minor: null, state: 'unavailable' }; }
    }
  }));
  return result;
}
