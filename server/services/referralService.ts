/**
 * Mystery Earn V1 Referral Service
 * Orchestrates Visitor Capture, Lifetime Attribution Binding, Reward Rule Resolution,
 * Delivery Ledger Processing, and Audit Logging.
 */

import { ReferralStore } from '../db/referralStore.js';
import { AdminAuditStore } from '../db/adminAuditStore.js';
import { MarketplaceStore } from '../db/marketplaceStore.js';
import { OrderRecord } from '../types/orders.js';
import {
  ReferralProfileRecord,
  ReferralAttributionRecord,
  ReferralRewardRuleRecord,
  RewardLedgerRecord,
  RewardServiceType,
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
    visitorKey?: string | null;
    landingPath?: string | null;
    userAgent?: string | null;
    currentUserId?: string | null;
  }): Promise<{
    valid: boolean;
    code?: string;
    referrerUserId?: string;
    reason?: string;
  }> {
    if (!params.code || typeof params.code !== 'string') {
      return { valid: false, reason: 'invalid_code' };
    }

    const cleanCode = params.code.trim().toUpperCase();
    const profile = await ReferralStore.findProfileByCode(cleanCode);

    if (!profile || !profile.is_enabled) {
      return { valid: false, reason: 'code_not_found' };
    }

    // Protect against self-referral
    if (params.currentUserId && params.currentUserId === profile.user_id) {
      return { valid: false, reason: 'self_referral' };
    }

    // Record Click Analytics safely
    try {
      await ReferralStore.recordClick({
        profileId: profile.id,
        referrerUserId: profile.user_id,
        referralCode: profile.referral_code,
        visitorKey: params.visitorKey,
        landingPath: params.landingPath,
        userAgentSafe: params.userAgent,
      });
    } catch (err) {
      console.warn('[ReferralService] Failed to record click:', err);
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

        if (bindRes.isNew && bindRes.attribution) {
          await AdminAuditStore.record({
            adminUserId: profile.user_id,
            action: 'referral_bound',
            entityType: 'referral_attribution',
            entityId: bindRes.attribution.id,
            metadata: {
              referrer_user_id: profile.user_id,
              referred_user_id: params.currentUserId,
              source_code: profile.referral_code,
            },
          });
        }
      } catch (err) {
        console.warn('[ReferralService] Failed to bind user attribution:', err);
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
      } catch (err) {
        console.warn('[ReferralService] Failed to create guest attribution:', err);
      }
    }

    return {
      valid: true,
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

    // 2. Guest User: Check explicit code first, then visitor key
    if (params.explicitCode) {
      const profile = await ReferralStore.findProfileByCode(params.explicitCode);
      if (profile && profile.is_enabled) {
        let attributionId: string | null = null;
        if (params.visitorKey) {
          const guestAttr = await ReferralStore.findAttributionByVisitorKey(params.visitorKey);
          if (guestAttr) {
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

    // Check visitor key attribution
    if (params.visitorKey) {
      const guestAttr = await ReferralStore.findAttributionByVisitorKey(params.visitorKey);
      if (guestAttr) {
        return {
          referrerUserId: guestAttr.referrer_user_id,
          attributionId: guestAttr.id,
          referralCode: guestAttr.source_code,
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
  static async processOrderReward(order: OrderRecord): Promise<RewardLedgerRecord | null> {
    // 1. Order must be terminal delivered/completed and paid
    const isTerminalDelivered = order.status === 'delivered' || order.marketplace_status === 'completed';
    if (!isTerminalDelivered || (order.payment_status !== 'success' && !order.paid_at)) {
      return null;
    }

    // 2. Resolve referrer
    let referrerUserId = order.referrer_user_id || null;
    let attributionId = order.referral_attribution_id || null;

    // If order record did not store referrer directly, check lifetime user attribution
    if (!referrerUserId && order.user_id) {
      const lifetime = await ReferralStore.findAttributionByReferredUserId(order.user_id);
      if (lifetime) {
        referrerUserId = lifetime.referrer_user_id;
        attributionId = lifetime.id;
      }
    }

    if (!referrerUserId) {
      return null;
    }

    // 3. Prevent self-rewards
    if (order.user_id && order.user_id === referrerUserId) {
      return null;
    }

    // Special handling for Marketplace products
    if (order.service_type === 'marketplace') {
      let rewardMinor = 0;
      let marketplaceProductId: string | null = order.product_id || null;

      // First check product-level referral reward configured on product
      if (order.product_id) {
        const product = await MarketplaceStore.getProductById(order.product_id);
        if (product && typeof product.referral_reward_minor === 'number' && product.referral_reward_minor > 0) {
          rewardMinor = Math.floor(product.referral_reward_minor);
        }
      }

      // Fallback: check matching global reward rule
      if (rewardMinor <= 0) {
        const rule = await ReferralStore.findMatchingRule('marketplace', order.network, order.product_id);
        if (rule && rule.enabled) {
          if (rule.reward_type === 'fixed_minor' && rule.reward_minor != null) {
            rewardMinor = Math.max(0, Math.floor(rule.reward_minor));
          } else if (rule.reward_type === 'percent_bps' && rule.reward_percent_bps != null) {
            rewardMinor = Math.max(0, Math.round((order.amount * rule.reward_percent_bps) / 10000));
          }
        }
      }

      if (rewardMinor <= 0) {
        return null;
      }

      const idempotencyKey = `marketplace_reward:${order.id}:${rewardMinor}`;
      const nowIso = new Date().toISOString();

      const result = await ReferralStore.createLedgerEntry({
        referrer_user_id: referrerUserId,
        referred_user_id: order.user_id || null,
        referral_attribution_id: attributionId,
        order_id: order.id,
        marketplace_product_id: marketplaceProductId,
        service_type: 'marketplace',
        reward_rule_id: null,
        amount_minor: rewardMinor,
        currency: 'GHS',
        status: 'approved',
        reason: `Reward for completed Marketplace order ${order.public_reference} (${order.product_name_snapshot})`,
        idempotency_key: idempotencyKey,
        reversal_of_id: null,
        approved_at: nowIso,
        rejected_at: null,
        reversed_at: null,
        metadata_json: {
          order_amount_minor: order.amount,
          product_id: order.product_id,
          reward_minor: rewardMinor,
        },
      });

      if (!result.alreadyExisted) {
        await AdminAuditStore.record({
          adminUserId: referrerUserId,
          action: 'reward_approved',
          entityType: 'reward_ledger',
          entityId: result.record.id,
          metadata: {
            order_id: order.id,
            amount_minor: rewardMinor,
            service_type: 'marketplace',
            referrer_user_id: referrerUserId,
          },
        });
      }

      return result.record;
    }

    const serviceType: RewardServiceType =
      order.service_type === 'airtime'
        ? 'airtime'
        : order.service_type === 'instant_bundle'
        ? 'instant_bundle'
        : 'data';

    // 4. Find matching reward rule
    const rule = await ReferralStore.findMatchingRule(serviceType, order.network, order.product_id);
    if (!rule || !rule.enabled) {
      return null;
    }

    // 5. Calculate reward amount in integer pesewas
    let rewardMinor = 0;
    if (rule.reward_type === 'fixed_minor' && rule.reward_minor != null) {
      rewardMinor = Math.max(0, Math.floor(rule.reward_minor));
    } else if (rule.reward_type === 'percent_bps' && rule.reward_percent_bps != null) {
      rewardMinor = Math.max(0, Math.round((order.amount * rule.reward_percent_bps) / 10000));
    }

    if (rewardMinor <= 0) {
      return null;
    }

    // 6. Idempotently record immutable reward in ledger
    const idempotencyKey = `order_reward:${order.id}:${rule.id}`;
    const nowIso = new Date().toISOString();

    const result = await ReferralStore.createLedgerEntry({
      referrer_user_id: referrerUserId,
      referred_user_id: order.user_id || null,
      referral_attribution_id: attributionId,
      order_id: order.id,
      marketplace_product_id: null,
      service_type: serviceType,
      reward_rule_id: rule.id,
      amount_minor: rewardMinor,
      currency: 'GHS',
      status: 'approved',
      reason: `Reward for delivered ${serviceType} order ${order.public_reference} (${order.network.toUpperCase()} ${order.bundle_size_snapshot || ''})`,
      idempotency_key: idempotencyKey,
      reversal_of_id: null,
      approved_at: nowIso,
      rejected_at: null,
      reversed_at: null,
      metadata_json: {
        order_amount_minor: order.amount,
        product_id: order.product_id,
        rule_type: rule.reward_type,
        rule_value: rule.reward_type === 'fixed_minor' ? rule.reward_minor : rule.reward_percent_bps,
      },
    });

    if (!result.alreadyExisted) {
      await AdminAuditStore.record({
        adminUserId: referrerUserId,
        action: 'reward_approved',
        entityType: 'reward_ledger',
        entityId: result.record.id,
        metadata: {
          order_id: order.id,
          amount_minor: rewardMinor,
          service_type: serviceType,
          referrer_user_id: referrerUserId,
        },
      });
    }

    return result.record;
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
