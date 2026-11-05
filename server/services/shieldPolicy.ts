import { normalizeSizeLabel } from '../suppliers/successBizHub/catalogResolver.js';
import { AUTHORITATIVE_PRODUCTS } from '../data/productCatalog.js';
import type { OrderRecord } from '../types/orders.js';
import { canonicalGhanaPhone } from '../utils/phone.js';
import type { ShieldView } from '../../shared/mysteryShield.js';

export const SHIELD_DELAY_MS = 32_400_000;
const exactExpressProducts = new Set(Object.values(AUTHORITATIVE_PRODUCTS)
  .filter(product => product.network === 'mtn').map(product => product.id));

export interface ShieldPolicy {
  visible: boolean;
  intake: boolean;
  fulfillment: boolean;
  notifications: boolean;
  startsAt: number;
  endsAt: number;
  offers: ReadonlySet<string>;
  perClaimMinor: number;
  dailyMinor: number;
  totalMinor: number;
}

export function shieldPolicy(env = process.env): ShieldPolicy {
  const time = (value: string | undefined) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return NaN;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return NaN;
    return new Date(parsed).toISOString() === value.replace(/(?<!\.\d{3})Z$/, '.000Z') ? parsed : NaN;
  };
  const money = (value: string | undefined) => value && /^[1-9]\d{0,7}$/.test(value) ? Number(value) : 0;
  return {
    visible: env.MYSTERY_SHIELD_VISIBLE === 'true',
    intake: env.MYSTERY_SHIELD_INTAKE === 'true',
    fulfillment: env.MYSTERY_SHIELD_FULFILLMENT === 'true',
    notifications: env.MYSTERY_SHIELD_NOTIFICATIONS === 'true',
    startsAt: time(env.MYSTERY_SHIELD_STARTS_AT),
    endsAt: env.MYSTERY_SHIELD_ENDS_AT === undefined ? Infinity : time(env.MYSTERY_SHIELD_ENDS_AT),
    offers: new Set((env.MYSTERY_SHIELD_EXPRESS_OFFERS ?? '').split(',').map(value => value.trim())
      .filter(value => /^[a-zA-Z0-9_-]{1,100}$/.test(value)).slice(0, 20)),
    perClaimMinor: money(env.MYSTERY_SHIELD_PER_CLAIM_MINOR),
    dailyMinor: money(env.MYSTERY_SHIELD_DAILY_MINOR),
    totalMinor: money(env.MYSTERY_SHIELD_TOTAL_MINOR),
  };
}

export function validShieldBudget(policy: ShieldPolicy): boolean {
  const { perClaimMinor, dailyMinor, totalMinor } = policy;
  return [perClaimMinor, dailyMinor, totalMinor].every(value => Number.isSafeInteger(value) && value > 0)
    && perClaimMinor <= dailyMinor && dailyMinor <= totalMinor;
}

export interface OriginalStatusEvidence {
  supplierId: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  observedAt: number;
}

/** Match explicit evidence from a fresh raw GET. The general supplier mapper tolerates unknown states. */
export function parseOriginalStatus(value: unknown, order: OrderRecord, observedAt: number): OriginalStatusEvidence | null {
  if (!value || typeof value !== 'object') return null;
  const { success, status, data } = value as { success?: unknown; status?: unknown; data?: Record<string, unknown> };
  if (success !== true || (status !== undefined && status !== 'success') || !data || typeof data !== 'object') return null;
  if (!order.supplier_order_id || data.publicId !== order.supplier_order_id || typeof data.network !== 'string' || data.network.trim().toLowerCase() !== 'mtn') return null;
  const originalRecipient = canonicalGhanaPhone(order.recipient_phone);
  if (!originalRecipient || typeof data.beneficiaryMsisdn !== 'string'
      || canonicalGhanaPhone(data.beneficiaryMsisdn) !== originalRecipient) return null;
  if (typeof data.sizeLabel !== 'string'
      || normalizeSizeLabel(data.sizeLabel) !== normalizeSizeLabel(order.bundle_size_snapshot)) return null;
  const state = data.status;
  if (state !== 'pending' && state !== 'processing' && state !== 'processed' && state !== 'failed') return null;
  return { supplierId: order.supplier_order_id, status: state, observedAt };
}

/** eligible is internal eligibility. The service also requires ready intake and budget. */
export function screenShieldOrder(order: OrderRecord, policy: ShieldPolicy, now: number,
  fixture: boolean): ShieldView | null {
  if (!policy.visible || !(now >= policy.startsAt && now < policy.endsAt)) return { state: 'unavailable' };
  if (fixture || !order.user_id || order.network !== 'mtn' || order.service_type !== 'data'
      || !exactExpressProducts.has(order.product_id) || order.store_context || order.marketplace_context
      || order.supplier_provider !== 'success_biz_hub') return { state: 'not_covered' };
  if (order.delivered_at || order.status === 'delivered' || order.resolution_json?.outcome === 'manual_fulfillment') {
    return { state: 'completed' };
  }
  if (order.archived_at || order.resolution_json || ['failed', 'cancelled', 'expired', 'refund_pending', 'refunded'].includes(order.status)
      || order.payment_status !== 'success' || !['paystack', 'wallet'].includes(order.payment_provider)
      || order.currency !== 'GHS' || !Number.isSafeInteger(order.amount) || order.amount <= 0
      || !order.payment_reference) return { state: 'excluded' };
  if (order.manual_review || order.failure_reason) return { state: 'review' };
  const paidAt = order.paid_at ? new Date(order.paid_at).getTime() : NaN;
  const createdAt = new Date(order.created_at).getTime();
  if (!Number.isFinite(createdAt) || !(paidAt >= createdAt && paidAt <= now)
      || !canonicalGhanaPhone(order.recipient_phone)) return { state: 'unverifiable' };
  if (createdAt < policy.startsAt) return { state: 'not_covered' };
  if (!order.supplier_offer_ref || !policy.offers.has(order.supplier_offer_ref)) return { state: 'unverifiable' };
  const eligibleAt = paidAt + SHIELD_DELAY_MS;
  if (now < eligibleAt) return { state: 'waiting', eligibleAt: new Date(eligibleAt).toISOString() };
  if (!['submitted', 'processing'].includes(order.status) || !order.supplier_order_id) return { state: 'unverifiable' };
  return null;
}

export function evaluateShield(order: OrderRecord, policy: ShieldPolicy, now: number,
  fixture: boolean, evidence?: OriginalStatusEvidence | null): ShieldView {
  const screened = screenShieldOrder(order, policy, now, fixture);
  if (screened) return screened;
  if (!evidence || evidence.supplierId !== order.supplier_order_id
      || !(evidence.observedAt <= now && evidence.observedAt >= now - 30_000)) return { state: 'unverifiable' };
  if (evidence.status === 'processed') return { state: 'completed' };
  if (evidence.status === 'failed') return { state: 'excluded' };
  if (evidence.status !== 'pending' && evidence.status !== 'processing') return { state: 'unverifiable' };
  return { state: 'eligible' };
}
