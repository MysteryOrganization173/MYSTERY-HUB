/**
 * Mystery Earn V1 Referral Store
 * Production storage for Referral Profiles, Attribution Links, Clicks, Reward Rules, and Immutable Reward Ledger.
 * Supports PostgreSQL with in-memory persistence fallback for dev/test suites.
 */

import crypto from 'crypto';
import { getPool } from './connection.js';
import {
  ReferralProfileRecord,
  ReferralAttributionRecord,
  ReferralClickRecord,
  ReferralRewardRuleRecord,
  RewardLedgerRecord,
  RewardServiceType,
  ReferralSummary,
} from '../types/referral.js';
import { buildReferralUrl } from '../utils/referralUrl.js';

// In-Memory Dev/Test Stores
const devReferralProfiles = new Map<string, ReferralProfileRecord>();
const devReferralAttributions = new Map<string, ReferralAttributionRecord>();
const devReferralClicks: ReferralClickRecord[] = [];
const devRewardRules = new Map<string, ReferralRewardRuleRecord>();
const devRewardLedger = new Map<string, RewardLedgerRecord>();

// Ambiguity-free alphanumeric alphabet for clean readable referral codes
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateRandomCode(): string {
  const bytes = crypto.randomBytes(6);
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `MH-${result}`;
}

export class ReferralStore {
  static _clearDevStore(): void {
    devReferralProfiles.clear();
    devReferralAttributions.clear();
    devReferralClicks.length = 0;
    devRewardRules.clear();
    devRewardLedger.clear();
  }

  // =========================================================================
  // 1. REFERRAL PROFILES
  // =========================================================================

  /**
   * Find a user's permanent referral profile by user ID
   */
  static async findProfileByUserId(userId: string): Promise<ReferralProfileRecord | null> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query<ReferralProfileRecord>(
        `SELECT * FROM referral_profiles WHERE user_id = $1 LIMIT 1;`,
        [userId]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0];
    }

    for (const prof of devReferralProfiles.values()) {
      if (prof.user_id === userId) {
        return { ...prof };
      }
    }
    return null;
  }

  /**
   * Find referral profile by code (case-insensitive)
   */
  static async findProfileByCode(code: string): Promise<ReferralProfileRecord | null> {
    const cleanCode = code.trim().toUpperCase();
    const pool = getPool();
    if (pool) {
      const res = await pool.query<ReferralProfileRecord>(
        `SELECT * FROM referral_profiles WHERE UPPER(referral_code) = $1 LIMIT 1;`,
        [cleanCode]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0];
    }

    for (const prof of devReferralProfiles.values()) {
      if (prof.referral_code.toUpperCase() === cleanCode) {
        return { ...prof };
      }
    }
    return null;
  }

  /**
   * Get or create a permanent referral profile for an authenticated user.
   * Ensures one code per account, never regenerating every login.
   */
  static async getOrCreateProfile(userId: string): Promise<ReferralProfileRecord> {
    const existing = await this.findProfileByUserId(userId);
    if (existing) {
      return existing;
    }

    const pool = getPool();
    const nowIso = new Date().toISOString();

    // Generate collision-resistant unique code
    let uniqueCode = generateRandomCode();
    let attempts = 0;
    while (attempts < 10) {
      const clash = await this.findProfileByCode(uniqueCode);
      if (!clash) break;
      uniqueCode = generateRandomCode();
      attempts++;
    }

    const id = `refprof_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const newProfile: ReferralProfileRecord = {
      id,
      user_id: userId,
      referral_code: uniqueCode,
      is_enabled: true,
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (pool) {
      const res = await pool.query<ReferralProfileRecord>(
        `
        INSERT INTO referral_profiles (id, user_id, referral_code, is_enabled, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
        RETURNING *;
        `,
        [
          newProfile.id,
          newProfile.user_id,
          newProfile.referral_code,
          newProfile.is_enabled,
          newProfile.created_at,
          newProfile.updated_at,
        ]
      );
      return res.rows[0];
    }

    devReferralProfiles.set(newProfile.id, newProfile);
    return { ...newProfile };
  }

  // =========================================================================
  // 2. REFERRAL CLICKS & ANALYTICS
  // =========================================================================

  /**
   * Record a referral click event (sanitized, non-invasive)
   */
  static async recordClick(params: {
    profileId: string;
    referrerUserId: string;
    referralCode: string;
    visitorKey?: string | null;
    landingPath?: string | null;
    userAgentSafe?: string | null;
  }): Promise<ReferralClickRecord> {
    const id = `refclk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const record: ReferralClickRecord = {
      id,
      referral_profile_id: params.profileId,
      referrer_user_id: params.referrerUserId,
      referral_code: params.referralCode.toUpperCase(),
      visitor_key: params.visitorKey || null,
      landing_path: (params.landingPath || '/').slice(0, 255),
      user_agent_safe: params.userAgentSafe ? params.userAgentSafe.slice(0, 128) : null,
      created_at: nowIso,
    };

    const pool = getPool();
    if (pool) {
      await pool.query(
        `
        INSERT INTO referral_clicks (id, referral_profile_id, referrer_user_id, referral_code, visitor_key, landing_path, user_agent_safe, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `,
        [
          record.id,
          record.referral_profile_id,
          record.referrer_user_id,
          record.referral_code,
          record.visitor_key,
          record.landing_path,
          record.user_agent_safe,
          record.created_at,
        ]
      );
    } else {
      devReferralClicks.unshift(record);
      if (devReferralClicks.length > 5000) {
        devReferralClicks.pop();
      }
    }

    return record;
  }

  static async countClicksByReferrer(referrerUserId: string): Promise<number> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM referral_clicks WHERE referrer_user_id = $1;`,
        [referrerUserId]
      );
      return parseInt(res.rows[0]?.count || '0', 10);
    }

    return devReferralClicks.filter((c) => c.referrer_user_id === referrerUserId).length;
  }

  // =========================================================================
  // 3. REFERRAL ATTRIBUTIONS (FIRST-TOUCH LIFETIME BINDING)
  // =========================================================================

  /**
   * Find existing attribution for a registered user
   */
  static async findAttributionByReferredUserId(
    referredUserId: string
  ): Promise<ReferralAttributionRecord | null> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query<ReferralAttributionRecord>(
        `SELECT * FROM referral_attributions WHERE referred_user_id = $1 LIMIT 1;`,
        [referredUserId]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0];
    }

    for (const attr of devReferralAttributions.values()) {
      if (attr.referred_user_id === referredUserId) {
        return { ...attr };
      }
    }
    return null;
  }

  /**
   * Find guest attribution by anonymous visitor key
   */
  static async findAttributionByVisitorKey(
    visitorKey: string
  ): Promise<ReferralAttributionRecord | null> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query<ReferralAttributionRecord>(
        `SELECT * FROM referral_attributions WHERE visitor_key = $1 ORDER BY first_seen_at DESC LIMIT 1;`,
        [visitorKey]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0];
    }

    for (const attr of devReferralAttributions.values()) {
      if (attr.visitor_key === visitorKey) {
        return { ...attr };
      }
    }
    return null;
  }

  /**
   * Create or preserve guest referral attribution.
   * If visitor_key already has an active attribution, it is preserved (first-touch).
   */
  static async createGuestAttribution(params: {
    referrerUserId: string;
    visitorKey: string;
    sourceCode: string;
    landingPath?: string | null;
  }): Promise<ReferralAttributionRecord> {
    const existing = await this.findAttributionByVisitorKey(params.visitorKey);
    if (existing) {
      return existing;
    }

    const id = `refatt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const record: ReferralAttributionRecord = {
      id,
      referrer_user_id: params.referrerUserId,
      referred_user_id: null,
      visitor_key: params.visitorKey,
      source_code: params.sourceCode.toUpperCase(),
      first_landing_path: params.landingPath || '/',
      first_seen_at: nowIso,
      bound_at: null,
      status: 'active',
      created_at: nowIso,
      updated_at: nowIso,
    };

    const pool = getPool();
    if (pool) {
      const res = await pool.query<ReferralAttributionRecord>(
        `
        INSERT INTO referral_attributions (id, referrer_user_id, referred_user_id, visitor_key, source_code, first_landing_path, first_seen_at, bound_at, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
        `,
        [
          record.id,
          record.referrer_user_id,
          record.referred_user_id,
          record.visitor_key,
          record.source_code,
          record.first_landing_path,
          record.first_seen_at,
          record.bound_at,
          record.status,
          record.created_at,
          record.updated_at,
        ]
      );
      return res.rows[0];
    }

    devReferralAttributions.set(record.id, record);
    return { ...record };
  }

  /**
   * Permanently binds an authenticated user to a referrer.
   * FIRST VALID REFERRER WINS:
   * If user already has a bound referrer, the existing binding is returned and CANNOT be hijacked.
   * Self-referrals (referredUserId === referrerUserId) are rejected.
   */
  static async bindAttributionToUser(params: {
    referredUserId: string;
    referrerUserId: string;
    sourceCode: string;
    visitorKey?: string | null;
    landingPath?: string | null;
  }): Promise<{ attribution: ReferralAttributionRecord | null; isNew: boolean; error?: string }> {
    // 1. Enforce No Self-Referrals
    if (params.referredUserId === params.referrerUserId) {
      return { attribution: null, isNew: false, error: 'Self-referral is not allowed.' };
    }

    // 2. Check if user already has an established lifetime attribution
    const existingForUser = await this.findAttributionByReferredUserId(params.referredUserId);
    if (existingForUser) {
      return { attribution: existingForUser, isNew: false };
    }

    const nowIso = new Date().toISOString();

    // 3. If visitorKey was provided, check if a guest record exists to upgrade
    if (params.visitorKey) {
      const guestAttribution = await this.findAttributionByVisitorKey(params.visitorKey);
      if (guestAttribution && !guestAttribution.referred_user_id) {
        // Enforce no self-referral on upgrade
        if (guestAttribution.referrer_user_id === params.referredUserId) {
          return { attribution: null, isNew: false, error: 'Self-referral is not allowed.' };
        }

        const pool = getPool();
        if (pool) {
          const res = await pool.query<ReferralAttributionRecord>(
            `
            UPDATE referral_attributions
            SET referred_user_id = $1, bound_at = $2, status = 'locked', updated_at = $2
            WHERE id = $3 AND referred_user_id IS NULL
            RETURNING *;
            `,
            [params.referredUserId, nowIso, guestAttribution.id]
          );
          if (res.rows.length > 0) {
            return { attribution: res.rows[0], isNew: true };
          }
        } else {
          const updated: ReferralAttributionRecord = {
            ...guestAttribution,
            referred_user_id: params.referredUserId,
            bound_at: nowIso,
            status: 'locked',
            updated_at: nowIso,
          };
          devReferralAttributions.set(updated.id, updated);
          return { attribution: { ...updated }, isNew: true };
        }
      }
    }

    // 4. Create fresh permanent locked attribution
    const id = `refatt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const newRecord: ReferralAttributionRecord = {
      id,
      referrer_user_id: params.referrerUserId,
      referred_user_id: params.referredUserId,
      visitor_key: params.visitorKey || null,
      source_code: params.sourceCode.toUpperCase(),
      first_landing_path: params.landingPath || '/',
      first_seen_at: nowIso,
      bound_at: nowIso,
      status: 'locked',
      created_at: nowIso,
      updated_at: nowIso,
    };

    const pool = getPool();
    if (pool) {
      try {
        const res = await pool.query<ReferralAttributionRecord>(
          `
          INSERT INTO referral_attributions (id, referrer_user_id, referred_user_id, visitor_key, source_code, first_landing_path, first_seen_at, bound_at, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (referred_user_id) DO UPDATE SET updated_at = NOW()
          RETURNING *;
          `,
          [
            newRecord.id,
            newRecord.referrer_user_id,
            newRecord.referred_user_id,
            newRecord.visitor_key,
            newRecord.source_code,
            newRecord.first_landing_path,
            newRecord.first_seen_at,
            newRecord.bound_at,
            newRecord.status,
            newRecord.created_at,
            newRecord.updated_at,
          ]
        );
        return { attribution: res.rows[0], isNew: true };
      } catch (err: any) {
        // In case of conflict, retrieve the winning original attribution
        const winner = await this.findAttributionByReferredUserId(params.referredUserId);
        return { attribution: winner, isNew: false };
      }
    }

    devReferralAttributions.set(newRecord.id, newRecord);
    return { attribution: { ...newRecord }, isNew: true };
  }

  static async countReferredCustomers(referrerUserId: string): Promise<number> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query<{ count: string }>(
        `
        SELECT COUNT(DISTINCT referred_user_id) as count
        FROM referral_attributions
        WHERE referrer_user_id = $1 AND referred_user_id IS NOT NULL;
        `,
        [referrerUserId]
      );
      return parseInt(res.rows[0]?.count || '0', 10);
    }

    const userIds = new Set<string>();
    for (const attr of devReferralAttributions.values()) {
      if (attr.referrer_user_id === referrerUserId && attr.referred_user_id) {
        userIds.add(attr.referred_user_id);
      }
    }
    return userIds.size;
  }

  // =========================================================================
  // 4. REWARD RULES
  // =========================================================================

  /**
   * Find matching active reward rule for a given service type, network, and product
   */
  static async findMatchingRule(
    serviceType: RewardServiceType,
    network?: string | null,
    productKey?: string | null
  ): Promise<ReferralRewardRuleRecord | null> {
    const pool = getPool();
    const nowIso = new Date().toISOString();

    if (pool) {
      const res = await pool.query<ReferralRewardRuleRecord>(
        `
        SELECT * FROM referral_reward_rules
        WHERE enabled = TRUE
          AND (service_type = $1 OR service_type = 'all')
          AND (network IS NULL OR network = '' OR LOWER(network) = LOWER($2))
          AND (product_key IS NULL OR product_key = '' OR product_key = $3)
          AND (starts_at IS NULL OR starts_at <= $4)
          AND (ends_at IS NULL OR ends_at >= $4)
        ORDER BY
          CASE WHEN product_key IS NOT NULL AND product_key != '' THEN 1 ELSE 2 END,
          CASE WHEN network IS NOT NULL AND network != '' THEN 1 ELSE 2 END,
          created_at DESC
        LIMIT 1;
        `,
        [serviceType, network || '', productKey || '', nowIso]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0];
    }

    const activeRules = Array.from(devRewardRules.values()).filter((r) => {
      if (!r.enabled) return false;
      if (r.service_type !== 'all' && r.service_type !== serviceType) return false;
      if (r.network && network && r.network.toLowerCase() !== network.toLowerCase()) return false;
      if (r.product_key && productKey && r.product_key !== productKey) return false;
      if (r.starts_at && new Date(r.starts_at) > new Date(nowIso)) return false;
      if (r.ends_at && new Date(r.ends_at) < new Date(nowIso)) return false;
      return true;
    });

    if (activeRules.length === 0) return null;
    // Prefer most specific rule
    activeRules.sort((a, b) => {
      const aScore = (a.product_key ? 2 : 0) + (a.network ? 1 : 0);
      const bScore = (b.product_key ? 2 : 0) + (b.network ? 1 : 0);
      return bScore - aScore;
    });

    return { ...activeRules[0] };
  }

  static async getAllRules(): Promise<ReferralRewardRuleRecord[]> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query<ReferralRewardRuleRecord>(
        `SELECT * FROM referral_reward_rules ORDER BY created_at DESC;`
      );
      return res.rows;
    }
    return Array.from(devRewardRules.values());
  }

  static async createOrUpdateRule(
    rule: Partial<ReferralRewardRuleRecord> & { service_type: RewardServiceType | 'all' }
  ): Promise<ReferralRewardRuleRecord> {
    const id = rule.id || `rewrule_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const record: ReferralRewardRuleRecord = {
      id,
      service_type: rule.service_type,
      product_key: rule.product_key || null,
      network: rule.network || null,
      reward_type: rule.reward_type || 'fixed_minor',
      reward_minor: rule.reward_minor != null ? rule.reward_minor : null,
      reward_percent_bps: rule.reward_percent_bps != null ? rule.reward_percent_bps : null,
      enabled: rule.enabled !== undefined ? rule.enabled : false,
      starts_at: rule.starts_at || null,
      ends_at: rule.ends_at || null,
      created_at: rule.created_at || nowIso,
      updated_at: nowIso,
    };

    const pool = getPool();
    if (pool) {
      const res = await pool.query<ReferralRewardRuleRecord>(
        `
        INSERT INTO referral_reward_rules (id, service_type, product_key, network, reward_type, reward_minor, reward_percent_bps, enabled, starts_at, ends_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          service_type = EXCLUDED.service_type,
          product_key = EXCLUDED.product_key,
          network = EXCLUDED.network,
          reward_type = EXCLUDED.reward_type,
          reward_minor = EXCLUDED.reward_minor,
          reward_percent_bps = EXCLUDED.reward_percent_bps,
          enabled = EXCLUDED.enabled,
          starts_at = EXCLUDED.starts_at,
          ends_at = EXCLUDED.ends_at,
          updated_at = NOW()
        RETURNING *;
        `,
        [
          record.id,
          record.service_type,
          record.product_key,
          record.network,
          record.reward_type,
          record.reward_minor,
          record.reward_percent_bps,
          record.enabled,
          record.starts_at,
          record.ends_at,
          record.created_at,
          record.updated_at,
        ]
      );
      return res.rows[0];
    }

    devRewardRules.set(record.id, record);
    return { ...record };
  }

  // =========================================================================
  // 5. REWARD LEDGER (IMMUTABLE ACCOUNTING)
  // =========================================================================

  /**
   * Records a reward ledger entry idempotently.
   * Prevents duplicate rewards for the same order/event.
   */
  static async createLedgerEntry(
    entry: Omit<RewardLedgerRecord, 'id' | 'created_at'>
  ): Promise<{ record: RewardLedgerRecord; alreadyExisted: boolean }> {
    const pool = getPool();
    const id = `rew_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const record: RewardLedgerRecord = {
      ...entry,
      id,
      created_at: nowIso,
    };

    if (pool) {
      // Check existing by idempotency_key
      const checkRes = await pool.query<RewardLedgerRecord>(
        `SELECT * FROM reward_ledger WHERE idempotency_key = $1 LIMIT 1;`,
        [entry.idempotency_key]
      );
      if (checkRes.rows.length > 0) {
        return { record: checkRes.rows[0], alreadyExisted: true };
      }

      const res = await pool.query<RewardLedgerRecord>(
        `
        INSERT INTO reward_ledger (
          id, referrer_user_id, referred_user_id, referral_attribution_id,
          order_id, marketplace_product_id, service_type, reward_rule_id,
          amount_minor, currency, status, reason, idempotency_key, reversal_of_id,
          created_at, approved_at, rejected_at, reversed_at, metadata_json
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19
        ) RETURNING *;
        `,
        [
          record.id,
          record.referrer_user_id,
          record.referred_user_id,
          record.referral_attribution_id,
          record.order_id,
          record.marketplace_product_id,
          record.service_type,
          record.reward_rule_id,
          record.amount_minor,
          record.currency,
          record.status,
          record.reason,
          record.idempotency_key,
          record.reversal_of_id,
          record.created_at,
          record.approved_at,
          record.rejected_at,
          record.reversed_at,
          record.metadata_json ? JSON.stringify(record.metadata_json) : null,
        ]
      );
      return { record: res.rows[0], alreadyExisted: false };
    }

    // In-memory check
    for (const item of devRewardLedger.values()) {
      if (item.idempotency_key === entry.idempotency_key) {
        return { record: { ...item }, alreadyExisted: true };
      }
    }

    devRewardLedger.set(record.id, record);
    return { record: { ...record }, alreadyExisted: false };
  }

  static async findLedgerById(id: string): Promise<RewardLedgerRecord | null> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query<RewardLedgerRecord>(
        `SELECT * FROM reward_ledger WHERE id = $1 LIMIT 1;`,
        [id]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0];
    }

    const item = devRewardLedger.get(id);
    return item ? { ...item } : null;
  }

  static async findLedgerByOrderId(orderId: string): Promise<RewardLedgerRecord[]> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query<RewardLedgerRecord>(
        `SELECT * FROM reward_ledger WHERE order_id = $1 ORDER BY created_at ASC;`,
        [orderId]
      );
      return res.rows;
    }

    return Array.from(devRewardLedger.values()).filter((l) => l.order_id === orderId);
  }

  static async findLedgerByReferrer(
    referrerUserId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ records: RewardLedgerRecord[]; total: number }> {
    const limit = Math.min(Math.max(1, options.limit || 20), 100);
    const offset = Math.max(0, options.offset || 0);

    const pool = getPool();
    if (pool) {
      const totalRes = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM reward_ledger WHERE referrer_user_id = $1;`,
        [referrerUserId]
      );
      const total = parseInt(totalRes.rows[0]?.count || '0', 10);

      const res = await pool.query<RewardLedgerRecord>(
        `
        SELECT * FROM reward_ledger
        WHERE referrer_user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3;
        `,
        [referrerUserId, limit, offset]
      );
      return { records: res.rows, total };
    }

    const all = Array.from(devRewardLedger.values())
      .filter((l) => l.referrer_user_id === referrerUserId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      records: all.slice(offset, offset + limit).map((r) => ({ ...r })),
      total: all.length,
    };
  }

  /**
   * Reverses an existing approved or pending reward entry.
   * Never physically deletes history; updates status and sets reversed_at.
   */
  static async reverseLedgerEntry(
    ledgerId: string,
    reason: string
  ): Promise<RewardLedgerRecord | null> {
    const existing = await this.findLedgerById(ledgerId);
    if (!existing) return null;
    if (existing.status === 'reversed') return existing;

    const nowIso = new Date().toISOString();
    const pool = getPool();

    if (pool) {
      const res = await pool.query<RewardLedgerRecord>(
        `
        UPDATE reward_ledger
        SET status = 'reversed', reversed_at = $1, reason = $2
        WHERE id = $3
        RETURNING *;
        `,
        [nowIso, `${existing.reason} (Reversed: ${reason})`, ledgerId]
      );
      return res.rows[0] || null;
    }

    existing.status = 'reversed';
    existing.reversed_at = nowIso;
    existing.reason = `${existing.reason} (Reversed: ${reason})`;
    return { ...existing };
  }

  /**
   * Computes accurate financial summary for an authenticated user
   */
  static async getReferralSummary(userId: string): Promise<ReferralSummary> {
    const profile = await this.getOrCreateProfile(userId);
    const clicksCount = await this.countClicksByReferrer(userId);
    const referredCustomersCount = await this.countReferredCustomers(userId);

    const pool = getPool();
    let pendingMinor = 0;
    let approvedMinor = 0;

    if (pool) {
      const res = await pool.query<{ status: string; total_minor: string }>(
        `
        SELECT status, COALESCE(SUM(amount_minor), 0) as total_minor
        FROM reward_ledger
        WHERE referrer_user_id = $1
        GROUP BY status;
        `,
        [userId]
      );

      for (const row of res.rows) {
        if (row.status === 'pending') {
          pendingMinor = parseInt(row.total_minor || '0', 10);
        } else if (row.status === 'approved') {
          approvedMinor = parseInt(row.total_minor || '0', 10);
        }
      }
    } else {
      for (const item of devRewardLedger.values()) {
        if (item.referrer_user_id === userId) {
          if (item.status === 'pending') {
            pendingMinor += item.amount_minor;
          } else if (item.status === 'approved') {
            approvedMinor += item.amount_minor;
          }
        }
      }
    }

    const shareUrl = buildReferralUrl('/', profile.referral_code);

    return {
      code: profile.referral_code,
      shareUrl,
      isEnabled: profile.is_enabled,
      clicksCount,
      referredCustomersCount,
      pendingRewardsMinor: pendingMinor,
      pendingRewardsGhc: Number((pendingMinor / 100).toFixed(2)),
      approvedRewardsMinor: approvedMinor,
      approvedRewardsGhc: Number((approvedMinor / 100).toFixed(2)),
      totalRewardsMinor: approvedMinor,
      totalRewardsGhc: Number((approvedMinor / 100).toFixed(2)),
    };
  }

  static async getLedgerForUser(
    referrerUserId: string,
    limit = 50
  ): Promise<import('../types/referral.js').SafeRewardLedgerItem[]> {
    const { records } = await this.findLedgerByReferrer(referrerUserId, { limit });
    return records.map((r) => ({
      id: r.id,
      service_type: r.service_type,
      amount_minor: r.amount_minor,
      amount_ghc: Number((r.amount_minor / 100).toFixed(2)),
      currency: r.currency,
      status: r.status,
      reason: r.reason,
      created_at: r.created_at,
      approved_at: r.approved_at,
      reversed_at: r.reversed_at,
    }));
  }
}
