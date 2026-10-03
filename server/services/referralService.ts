/**
 * Mystery Earn V1 Referral Service
 * Orchestrates Visitor Capture, Lifetime Attribution Binding, Reward Rule Resolution,
 * Delivery Ledger Processing, and Audit Logging.
 */

import { ReferralStore } from '../db/referralStore.js';
import { OrdersStore } from '../db/ordersStore.js';
import { AdminAuditStore } from '../db/adminAuditStore.js';
import { MarketplaceStore } from '../db/marketplaceStore.js';
import { OrderRecord } from '../types/orders.js';
import {
  ReferralProfileRecord,
  ReferralAttributionRecord,
  ReferralRewardRuleRecord,
  RewardLedgerRecord,
} from '../types/referral.js';

export interface ReferralResolutionResult {
  referrerUserId: string | null;
  attributionId: string | null;
  referralCode: string | null;
}

export class ReferralService {
  /**
   * Capture and validate a referral code from a visitor (guest or authenticated)
   */
  static async captureVisitorReferral(params: {
    code: string;
    captureId?: string;
    visitorKey?: string | null;
    landingPath?: string | null;
    userAgent?: string | null;
    currentUserId?: string | null;
  }): Promise<{
    valid: boolean;
    clickRecorded: boolean;
    attributionRecorded: boolean;
    code?: string;
    referrerUserId?: string;
    reason?: string;
  }> {
    if (!params.code || typeof params.code !== 'string') {
      return { valid: false, clickRecorded: false, attributionRecorded: false, reason: 'invalid_code' };
    }

    const cleanCode = params.code.trim().toUpperCase();
    const profile = await ReferralStore.findProfileByCode(cleanCode);

    if (!profile || !profile.is_enabled) {
      return { valid: false, clickRecorded: false, attributionRecorded: false, reason: 'code_not_found' };
    }

    // Protect against self-referral
    if (params.currentUserId && params.currentUserId === profile.user_id) {
      return { valid: false, clickRecorded: false, attributionRecorded: false, reason: 'self_referral' };
    }

    let clickRecorded = false;
    let attributionRecorded = false;
    // Analytics and lifetime attribution have independent outcomes.
    try {
      await ReferralStore.recordClick({
        profileId: profile.id,
        referrerUserId: profile.user_id,
        referralCode: profile.referral_code,
        visitorKey: params.visitorKey,
        landingPath: params.landingPath,
        userAgentSafe: params.userAgent,
        captureId: params.captureId,
      });
      clickRecorded = true;
    } catch {
      console.warn('[ReferralService] Click persistence failed; capture may be retried.');
    }

    // If authenticated user, bind lifetime attribution (first-touch wins)
    if (params.currentUserId) {
      try {
        const bindRes = await ReferralStore.bindAttributionToUser({
          referredUserId: params.currentUserId,
          referrerUserId: profile.user_id,
          sourceCode: profile.referral_code,
          visitorKey: params.visitorKey,
          landingPath: params.landingPath,
        });

        attributionRecorded = Boolean(bindRes.attribution);
        if (bindRes.isNew && bindRes.attribution) {
          await AdminAuditStore.record({
            adminUserId: bindRes.attribution.referrer_user_id,
            action: 'referral_bound',
            entityType: 'referral_attribution',
            entityId: bindRes.attribution.id,
            metadata: {
              referrer_user_id: bindRes.attribution.referrer_user_id,
              referred_user_id: params.currentUserId,
              source_code: bindRes.attribution.source_code,
            },
          });
        }
      } catch {
        console.warn('[ReferralService] User attribution persistence failed.');
      }
    } else if (params.visitorKey) {
      // Guest visitor attribution
      try {
        await ReferralStore.createGuestAttribution({
          referrerUserId: profile.user_id,
          visitorKey: params.visitorKey,
          sourceCode: profile.referral_code,
          landingPath: params.landingPath,
        });
        attributionRecorded = true;
      } catch {
        console.warn('[ReferralService] Guest attribution persistence failed.');
      }
    }

    return {
      valid: true,
      clickRecorded,
      attributionRecorded,
      ...(!clickRecorded ? { reason: 'click_not_recorded' } : {}),
      code: profile.referral_code,
      referrerUserId: profile.user_id,
    };
  }

  /**
   * Resolves the authoritative referrer for an upcoming order.
   * Prioritizes lifetime bound referrer for authenticated accounts (Refer once. Earn when they return).
   */
  static async resolveReferralContextForOrder(params: {
    userId?: string | null;
    visitorKey?: string | null;
    explicitCode?: string | null;
  }): Promise<ReferralResolutionResult> {
    // 1. Authenticated User: Check lifetime attribution first
    if (params.userId) {
      const lifetimeAttribution = await ReferralStore.findAttributionByReferredUserId(params.userId);
      if (lifetimeAttribution) {
        // Enforce no self-referral
        if (lifetimeAttribution.referrer_user_id !== params.userId) {
          return {
            referrerUserId: lifetimeAttribution.referrer_user_id,
            attributionId: lifetimeAttribution.id,
            referralCode: lifetimeAttribution.source_code,
          };
        }
      }

      // If no lifetime attribution yet, but explicit code was provided, attempt binding now
      if (params.explicitCode) {
        const profile = await ReferralStore.findProfileByCode(params.explicitCode);
        if (profile && profile.user_id !== params.userId && profile.is_enabled) {
          const bound = await ReferralStore.bindAttributionToUser({
            referredUserId: params.userId,
            referrerUserId: profile.user_id,
            sourceCode: profile.referral_code,
            visitorKey: params.visitorKey,
          });

          if (bound.attribution) {
            return {
              referrerUserId: bound.attribution.referrer_user_id,
              attributionId: bound.attribution.id,
              referralCode: bound.attribution.source_code,
            };
          }
        }
      }
    }

    // Preserve a captured visitor's first touch before considering a later code.
    if (params.visitorKey) {
      const guest = await ReferralStore.findAttributionByVisitorKey(params.visitorKey);
      if (guest && guest.referrer_user_id !== params.userId) {
        if (params.userId) {
          const bound = await ReferralStore.bindAttributionToUser({
            referredUserId: params.userId, referrerUserId: guest.referrer_user_id,
            sourceCode: guest.source_code, visitorKey: params.visitorKey,
          });
          if (bound.attribution && bound.attribution.referrer_user_id !== params.userId) {
            return { referrerUserId: bound.attribution.referrer_user_id,
              attributionId: bound.attribution.id, referralCode: bound.attribution.source_code };
          }
        } else {
          return { referrerUserId: guest.referrer_user_id, attributionId: guest.id, referralCode: guest.source_code };
        }
      }
    }
    // Uncaptured visitors may provide an explicit code at checkout.
    if (params.explicitCode) {
      const profile = await ReferralStore.findProfileByCode(params.explicitCode);
      if (profile && profile.is_enabled && profile.user_id !== params.userId) {
        let attributionId: string | null = null;
        if (params.visitorKey) {
          const guestAttr = await ReferralStore.findAttributionByVisitorKey(params.visitorKey);
          if (guestAttr && guestAttr.referrer_user_id === profile.user_id) {
            attributionId = guestAttr.id;
          }
        }
        return {
          referrerUserId: profile.user_id,
          attributionId,
          referralCode: profile.referral_code,
        };
      }
    }

    return {
      referrerUserId: null,
      attributionId: null,
      referralCode: null,
    };
  }

  /**
   * Processes reward ledger creation upon successful order delivery.
   * ONLY executes for delivered telecom orders or confirmed transactions.
   */
  static async processOrderReward(input: OrderRecord): Promise<RewardLedgerRecord | null> {
    // Successful payment is authoritative; a historical paid_at alone is insufficient.
    if (input.status !== 'delivered' || input.payment_status !== 'success' || input.currency !== 'GHS'
      || (input.service_type === 'marketplace' && input.marketplace_status !== 'completed')) return null;
    const lifetime = input.user_id ? await ReferralStore.findAttributionByReferredUserId(input.user_id) : null;
    const linked = input.referral_attribution_id ? await ReferralStore.findAttributionById(input.referral_attribution_id) : null;
    const referrerId = input.referrer_user_id || lifetime?.referrer_user_id || linked?.referrer_user_id;
    if (!referrerId || input.user_id === referrerId
      || (lifetime && lifetime.referrer_user_id !== referrerId)
      || (linked && (linked.referrer_user_id !== referrerId || (linked.referred_user_id && input.user_id && linked.referred_user_id !== input.user_id)))) return null;
    const attribution = lifetime || linked;
    const attributionId = attribution?.id || null;
    const service = input.service_type || 'data';
    // A captured guest upgraded at signup retains the same attribution key.
    const identity = attributionId ? `attribution:${attributionId}` : input.user_id ? `user:${input.user_id}` : null;
    const relationshipKey = identity ? `${referrerId}:${identity}:${service}` : null;
    const audit: { pending: { record: RewardLedgerRecord; rule: ReferralRewardRuleRecord | null } | null } = { pending: null };
    const result = await ReferralStore.withRewardTransaction(relationshipKey || `unidentified:${input.id}`, input.id, async client => {
      const order = client ? await OrdersStore.findOrder(input.id, client) : (await OrdersStore.findOrder(input.id)) || input;
      if (!order || order.status !== 'delivered' || order.payment_status !== 'success'
        || order.currency !== 'GHS' || (service === 'marketplace' && order.marketplace_status !== 'completed')) return null;
      if ((order.referrer_user_id && order.referrer_user_id !== referrerId) || order.user_id === referrerId
        || (order.user_id || null) !== (input.user_id || null) || (order.service_type || 'data') !== service
        || (order.referral_attribution_id || null) !== (input.referral_attribution_id || null)) return null;
      const existing = (await ReferralStore.findLedgerByOrderId(order.id, client)).find(entry => (entry.network_level || 1) === 1 && !entry.reversal_of_id);
      if (existing) return existing; // Never recompute historical, reversed or already awarded entries.

      const prior = relationshipKey && (await ReferralStore.hasRewardedPurchase({ referrerId,
        userId: order.user_id, attributionId, service, relationshipKey, orderId: order.id }, client)
        || await OrdersStore.hasEarlierQualifyingReferralOrder(order, { referrerId, userId: order.user_id,
          attributionId, attributionFirstSeen: attribution?.first_seen_at }, client));
      const purchaseStage = relationshipKey ? (prior ? 'recurring' : 'acquisition') : 'any';
      const at = order.delivered_at || new Date().toISOString();
      let rule: ReferralRewardRuleRecord | null = null;
      let amount = 0;
      // Preserve Marketplace product-level precedence and economics.
      if (service === 'marketplace' && order.product_id) {
        const product = await MarketplaceStore.getProductById(order.product_id);
        if (product?.referral_reward_minor && product.referral_reward_minor > 0) amount = Math.floor(product.referral_reward_minor);
      }
      if (!amount) {
        rule = await ReferralStore.findMatchingRule(service, order.network, order.product_id, purchaseStage, client, at);
        if (!rule) return null;
        if (rule.reward_type === 'fixed_minor' && rule.reward_minor != null) amount = rule.reward_minor;
        else if (rule.reward_type === 'percent_bps' && rule.reward_percent_bps != null) amount = Math.round(order.amount * rule.reward_percent_bps / 10_000);
      }
      if (!Number.isSafeInteger(amount) || amount <= 0) return null;
      if (amount > order.amount) {
        console.warn(`[Referral Reward] Configured reward exceeds the customer charge for ${order.public_reference}; reward not issued.`);
        return null;
      }
      const rewardStage = rule && (rule.purchase_stage || 'any') !== 'any' ? purchaseStage : 'standard';
      const now = new Date().toISOString();
      const saved = await ReferralStore.createLedgerEntry({
        referrer_user_id: referrerId, referred_user_id: order.user_id || null, referral_attribution_id: attributionId,
        order_id: order.id, marketplace_product_id: service === 'marketplace' ? order.product_id : null,
        service_type: service, reward_rule_id: rule?.id || null, network_level: 1,
        reward_stage: rewardStage === 'any' ? 'standard' : rewardStage, reward_relationship_key: relationshipKey,
        amount_minor: amount, currency: 'GHS', status: 'approved',
        reason: `Reward for delivered ${service} order ${order.public_reference} (${rewardStage})`,
        idempotency_key: service === 'marketplace' && !rule ? `marketplace_reward:${order.id}:${amount}` : `order_reward:${order.id}:${rule!.id}`,
        reversal_of_id: null, approved_at: now, rejected_at: null, reversed_at: null,
        metadata_json: { order_amount_minor: order.amount, product_id: order.product_id,
          purchase_stage: purchaseStage, reward_stage: rewardStage, rule_purchase_stage: rule?.purchase_stage || 'any',
          rule_type: rule?.reward_type || 'fixed_minor',
          rule_value: rule ? (rule.reward_type === 'fixed_minor' ? rule.reward_minor : rule.reward_percent_bps) : amount },
      }, client);
      if (!saved.alreadyExisted) audit.pending = { record: saved.record, rule };
      return saved.record;
    });
    // Ledger is committed before best-effort audit recording.
    if (audit.pending) await AdminAuditStore.record({ adminUserId: referrerId, action: 'reward_approved',
      entityType: 'reward_ledger', entityId: audit.pending.record.id,
      metadata: { order_id: input.id, amount_minor: audit.pending.record.amount_minor, service_type: service,
        referrer_user_id: referrerId, reward_stage: audit.pending.record.reward_stage, reward_rule_id: audit.pending.rule?.id || null } });
    return result;
  }

  /**
   * Reverses reward ledger entries associated with a cancelled/refunded order.
   */
  static async reverseOrderRewards(orderId: string, reason: string): Promise<RewardLedgerRecord[]> {
    const records = await ReferralStore.findLedgerByOrderId(orderId);
    const reversed: RewardLedgerRecord[] = [];

    for (const record of records) {
      if (record.status === 'approved' || record.status === 'pending') {
        const updated = await ReferralStore.reverseLedgerEntry(record.id, reason);
        if (updated) {
          reversed.push(updated);
          await AdminAuditStore.record({
            adminUserId: record.referrer_user_id,
            action: 'reward_reversed',
            entityType: 'reward_ledger',
            entityId: updated.id,
            metadata: {
              order_id: orderId,
              amount_minor: record.amount_minor,
              reason,
            },
          });
        }
      }
    }

    return reversed;
  }
}
