/**
 * Mystery Earn V1 Referral Store
 * Production storage for Referral Profiles, Attribution Links, Clicks, Reward Rules, and Immutable Reward Ledger.
 * Supports PostgreSQL with in-memory persistence fallback for dev/test suites.
 */

import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { getPool } from './connection.js';
import { AdminAuditStore } from './adminAuditStore.js';
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
import { compareReferralRules, isActiveReferralRule } from '../services/referralRulePolicy.js';
import type { PurchaseStage } from '../types/referral.js';

// In-Memory Dev/Test Stores
const devReferralProfiles = new Map<string, ReferralProfileRecord>();
const devReferralAttributions = new Map<string, ReferralAttributionRecord>();
const devReferralClicks: ReferralClickRecord[] = [];
const devCaptureKeys = new Map<string, ReferralClickRecord>();
const devRewardRules = new Map<string, ReferralRewardRuleRecord>();
const devRewardLedger = new Map<string, RewardLedgerRecord>();
const devRewardLocks = new Map<string, Promise<void>>();
const devSuspensions: Array<{ profile_id: string; starts_at: string; ends_at: string | null }> = [];
const devSuppressedRewards = new Set<string>();

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
  static adminDevSnapshot() { return { profiles: [...devReferralProfiles.values()], attributions: [...devReferralAttributions.values()],
    clicks: [...devReferralClicks], ledger: [...devRewardLedger.values()] }; }
  static async profileAcceptsReferrals(userId: string, client?: PoolClient): Promise<boolean> {
    const db = client || getPool();
    const profile = db ? (await db.query<ReferralProfileRecord>(`SELECT * FROM referral_profiles WHERE user_id = $1 ${client ? 'FOR SHARE' : ''};`, [userId])).rows[0]
      : await this.findProfileByUserId(userId);
    // Existing legacy orders/attributions may predate profile creation.
    return !profile || profile.is_enabled;
  }
  static async rewardAllowed(userId: string, deliveredAt: string, client?: PoolClient, orderId?: string): Promise<boolean> {
    const enabled = await this.profileAcceptsReferrals(userId, client);
    const db = client || getPool();
    if (db) {
      const blocked = !enabled || (await db.query<{ blocked: boolean }>(`SELECT EXISTS (SELECT 1 FROM referral_profile_suspensions s
      JOIN referral_profiles p ON p.id = s.profile_id WHERE p.user_id = $1 AND s.starts_at <= $2::timestamptz
      AND (s.ends_at IS NULL OR s.ends_at > $2::timestamptz)) OR EXISTS
      (SELECT 1 FROM referral_reward_suppressions WHERE referrer_user_id = $1 AND order_id = $3) AS blocked;`, [userId, deliveredAt, orderId || null])).rows[0]?.blocked;
      if (blocked && orderId) await db.query(`INSERT INTO referral_reward_suppressions(referrer_user_id,order_id) VALUES ($1,$2) ON CONFLICT DO NOTHING;`, [userId,orderId]);
      return !blocked;
    }
    const profile = await this.findProfileByUserId(userId);
    const key = `${userId}:${orderId}`;
    const blocked = !enabled || devSuppressedRewards.has(key) || devSuspensions.some(s => s.profile_id === profile?.id && Date.parse(s.starts_at) <= Date.parse(deliveredAt)
      && (!s.ends_at || Date.parse(s.ends_at) > Date.parse(deliveredAt)));
    if (blocked && orderId) devSuppressedRewards.add(key);
    return !blocked;
  }
  static async setProfileEnabled(userId: string, enabled: boolean, adminId?: string): Promise<{ profile: ReferralProfileRecord; changed: boolean }> {
    const pool = getPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const profile = (await client.query<ReferralProfileRecord>('SELECT * FROM referral_profiles WHERE user_id = $1 FOR UPDATE;', [userId])).rows[0];
        if (!profile) throw new Error('Referral profile not found.');
        const changed = profile.is_enabled !== enabled;
        if (changed) {
          if (!enabled) await client.query(`INSERT INTO referral_profile_suspensions(id, profile_id, starts_at) VALUES ($1, $2, NOW());`, [`susp_${crypto.randomUUID()}`, profile.id]);
          else {
            // Preserve a legacy disabled profile's known interval if no history exists yet.
            await client.query(`INSERT INTO referral_profile_suspensions(id, profile_id, starts_at, ends_at)
              SELECT $1, $2, $3::timestamptz, NOW() WHERE NOT EXISTS (SELECT 1 FROM referral_profile_suspensions WHERE profile_id = $2 AND ends_at IS NULL);`,
              [`susp_${crypto.randomUUID()}`, profile.id, profile.updated_at]);
            await client.query('UPDATE referral_profile_suspensions SET ends_at = NOW() WHERE profile_id = $1 AND ends_at IS NULL;', [profile.id]);
          }
          const updated = await client.query<ReferralProfileRecord>('UPDATE referral_profiles SET is_enabled = $2, updated_at = NOW() WHERE id = $1 RETURNING *;', [profile.id, enabled]);
          if (adminId) await AdminAuditStore.record({ adminUserId: adminId, action: enabled ? 'referral_profile_resumed' : 'referral_profile_suspended',
            entityType: 'referral_profile', entityId: profile.id, metadata: { user_id: userId, enabled } }, client);
          await client.query('COMMIT'); return { profile: updated.rows[0], changed };
        }
        await client.query('COMMIT'); return { profile, changed };
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
    return this.withRewardTransaction(`profile:${userId}`, `profile:${userId}`, async () => {
      const profile = [...devReferralProfiles.values()].find(p => p.user_id === userId);
      if (!profile) throw new Error('Referral profile not found.');
      const changed = profile.is_enabled !== enabled; const now = new Date().toISOString();
      if (changed) {
        if (!enabled) devSuspensions.push({ profile_id: profile.id, starts_at: now, ends_at: null });
        else { const open = devSuspensions.find(s => s.profile_id === profile.id && !s.ends_at);
          if (open) open.ends_at = now; else devSuspensions.push({ profile_id: profile.id, starts_at: profile.updated_at, ends_at: now }); }
        profile.is_enabled = enabled; profile.updated_at = now;
        if (adminId) await AdminAuditStore.record({ adminUserId: adminId, action: enabled ? 'referral_profile_resumed' : 'referral_profile_suspended',
          entityType: 'referral_profile', entityId: profile.id, metadata: { user_id: userId, enabled } });
      }
      return { profile: { ...profile }, changed };
    }, userId);
  }
  static _clearDevStore(): void {
    devReferralProfiles.clear();
    devReferralAttributions.clear();
    devReferralClicks.length = 0;
    devCaptureKeys.clear();
    devRewardRules.clear();
    devRewardLedger.clear();
    devSuspensions.length = 0;
    devSuppressedRewards.clear();
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
    captureId?: string;
  }): Promise<ReferralClickRecord> {
    const id = `refclk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const captureKey = params.captureId ? crypto.createHash('sha256')
      .update(`${params.profileId}:${params.visitorKey || ''}:${params.captureId}`).digest('hex') : null;

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
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0));',
          [`referral-click:${params.profileId}:${params.visitorKey || captureKey || 'anonymous'}`]);
        if (!await this.profileAcceptsReferrals(params.referrerUserId, client)) throw new Error('Referral profile is suspended.');
        // Retries share a persisted capture key; rapid repeated visitor events are coalesced.
        const previous = await client.query<ReferralClickRecord>(`
          SELECT * FROM referral_clicks WHERE referral_profile_id = $1
            AND (($2::text IS NOT NULL AND capture_key = $2)
              OR ($3::text IS NOT NULL AND visitor_key = $3 AND created_at > NOW() - INTERVAL '60 seconds'))
          ORDER BY created_at DESC LIMIT 1;
        `, [params.profileId, captureKey, params.visitorKey || null]);
        if (previous.rows[0]) { await client.query('COMMIT'); return previous.rows[0]; }
        const inserted = await client.query<ReferralClickRecord>(
          `
          INSERT INTO referral_clicks (id, referral_profile_id, referrer_user_id, referral_code, visitor_key, landing_path, user_agent_safe, created_at, capture_key)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *;
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
            captureKey,
          ]
        );
        if (!inserted.rows[0]) throw new Error('Referral click persistence was not confirmed.');
        await client.query('COMMIT');
        return inserted.rows[0];
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    } else {
      if (!await this.profileAcceptsReferrals(params.referrerUserId)) throw new Error('Referral profile is suspended.');
      const prior = (captureKey && devCaptureKeys.get(captureKey)) || devReferralClicks.find(c =>
        params.visitorKey && c.referral_profile_id === params.profileId && c.visitor_key === params.visitorKey
        && Date.now() - new Date(c.created_at).getTime() < 60_000);
      if (prior) return prior;
      devReferralClicks.unshift(record);
      if (captureKey) devCaptureKeys.set(captureKey, record);
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

  static async countUniqueVisitorsByReferrer(referrerUserId: string, client?: PoolClient): Promise<number> {
    const pool = client || getPool();
    if (pool) {
      const result = await pool.query<{ count: string }>(`
        SELECT COUNT(DISTINCT visitor_key) AS count FROM referral_clicks
        WHERE referrer_user_id = $1 AND visitor_key IS NOT NULL AND BTRIM(visitor_key) <> ''
          AND LEFT(visitor_key, 13) <> 'vk_transient_';
      `, [referrerUserId]);
      return Number(result.rows[0]?.count || 0);
    }
    return new Set(devReferralClicks.filter(c => c.referrer_user_id === referrerUserId
      && c.visitor_key?.trim() && !c.visitor_key.startsWith('vk_transient_')).map(c => c.visitor_key)).size;
  }

  // =========================================================================
  // 3. REFERRAL ATTRIBUTIONS (FIRST-TOUCH LIFETIME BINDING)
  // =========================================================================

  /**
   * Find existing attribution for a registered user
   */
  static async findAttributionByReferredUserId(
    referredUserId: string,
    client?: PoolClient
  ): Promise<ReferralAttributionRecord | null> {
    const pool = client || getPool();
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
    visitorKey: string,
    client?: PoolClient
  ): Promise<ReferralAttributionRecord | null> {
    const pool = client || getPool();
    if (pool) {
      const res = await pool.query<ReferralAttributionRecord>(
        `SELECT * FROM referral_attributions WHERE visitor_key = $1 ORDER BY first_seen_at ASC, id ASC LIMIT 1;`,
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
  }, client?: PoolClient): Promise<ReferralAttributionRecord> {
    const db = getPool();
    if (db && !client) {
      const connection = await db.connect();
      try {
        await connection.query('BEGIN');
        await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0));', [`referral-visitor:${params.visitorKey}`]);
        const result = await this.createGuestAttribution(params, connection);
        await connection.query('COMMIT'); return result;
      } catch (error) { await connection.query('ROLLBACK'); throw error; }
      finally { connection.release(); }
    }
    const existing = await this.findAttributionByVisitorKey(params.visitorKey, client);
    if (existing) {
      return existing;
    }
    if (!await this.profileAcceptsReferrals(params.referrerUserId, client)) throw new Error('Referral profile is suspended.');

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

    const pool = client || getPool();
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
   * Checks if candidateReferrerUserId has targetReferredUserId anywhere in its ancestral upline.
   * Prevents circular attribution loops (e.g. A -> B -> A or A -> B -> C -> A).
   */
  static async isDescendantOrCycle(
    candidateReferrerUserId: string,
    targetReferredUserId: string,
    client?: PoolClient
  ): Promise<boolean> {
    let currentId: string | null = candidateReferrerUserId;
    const visited = new Set<string>();
    let hops = 0;

    while (currentId && hops < 10) {
      if (currentId === targetReferredUserId) {
        return true;
      }
      if (visited.has(currentId)) {
        // Cycle detected
        return true;
      }
      visited.add(currentId);

      const uplineAttr = await this.findAttributionByReferredUserId(currentId, client);
      currentId = uplineAttr?.referrer_user_id || uplineAttr?.level1_referrer_user_id || null;
      hops++;
    }

    // A truncated chain cannot safely be certified acyclic.
    return Boolean(currentId);
  }

  /**
   * Permanently binds an authenticated user to a referrer.
   * FIRST VALID REFERRER WINS:
   * If user already has a bound referrer, the existing binding is returned and CANNOT be hijacked.
   * Self-referrals (referredUserId === referrerUserId) are rejected.
   * Circular referrals (e.g. A -> B -> A) are rejected.
   */
  static async bindAttributionToUser(params: {
    referredUserId: string;
    referrerUserId: string;
    sourceCode: string;
    visitorKey?: string | null;
    landingPath?: string | null;
  }, client?: PoolClient): Promise<{ attribution: ReferralAttributionRecord | null; isNew: boolean; error?: string }> {
    const db = getPool();
    if (db && !client) {
      const connection = await db.connect();
      try {
        await connection.query('BEGIN');
        await connection.query("SELECT pg_advisory_xact_lock(hashtextextended('referral-attribution-graph', 0));");
        if (params.visitorKey) await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0));', [`referral-visitor:${params.visitorKey}`]);
        const result = await this.bindAttributionToUser(params, connection);
        await connection.query('COMMIT'); return result;
      } catch (error) { await connection.query('ROLLBACK'); throw error; }
      finally { connection.release(); }
    }
    const original = await this.findAttributionByReferredUserId(params.referredUserId, client);
    if (original) return { attribution: original, isNew: false };
    const guest = params.visitorKey ? await this.findAttributionByVisitorKey(params.visitorKey, client) : null;
    if (guest && !guest.referred_user_id) {
      params = { ...params, referrerUserId: guest.referrer_user_id, sourceCode: guest.source_code };
    }
    if (!await this.profileAcceptsReferrals(params.referrerUserId, client)) return { attribution: null, isNew: false, error: 'Referral profile is suspended.' };
    // 1. Enforce No Self-Referrals
    if (params.referredUserId === params.referrerUserId) {
      return { attribution: null, isNew: false, error: 'Self-referral is not allowed.' };
    }

    // 2. Enforce No Circular Referral Loops
    const isCycle = await this.isDescendantOrCycle(params.referrerUserId, params.referredUserId, client);
    if (isCycle) {
      return { attribution: null, isNew: false, error: 'Circular referral chain is not allowed.' };
    }

    // 3. Check if user already has an established lifetime attribution
    const existingForUser = await this.findAttributionByReferredUserId(params.referredUserId, client);
    if (existingForUser) {
      return { attribution: existingForUser, isNew: false };
    }

    const nowIso = new Date().toISOString();

    // 4. Derive Maximum 3-Level Network Lineage
    const level1UserId = params.referrerUserId;
    let level2UserId: string | null = null;
    let level3UserId: string | null = null;

    try {
      const level1Attr = await this.findAttributionByReferredUserId(level1UserId, client);
      if (level1Attr && level1Attr.referrer_user_id && level1Attr.referrer_user_id !== params.referredUserId) {
        level2UserId = level1Attr.referrer_user_id;
        const level2Attr = await this.findAttributionByReferredUserId(level2UserId, client);
        if (
          level2Attr &&
          level2Attr.referrer_user_id &&
          level2Attr.referrer_user_id !== params.referredUserId &&
          level2Attr.referrer_user_id !== level1UserId
        ) {
          level3UserId = level2Attr.referrer_user_id;
        }
      }
    } catch (err) {
      console.warn('[ReferralStore] Error resolving 3-level lineage:', err);
    }

    // 5. If visitorKey was provided, check if a guest record exists to upgrade
    if (params.visitorKey) {
      const guestAttribution = await this.findAttributionByVisitorKey(params.visitorKey, client);
      if (guestAttribution && !guestAttribution.referred_user_id) {
        // Enforce no self-referral or circular referral on upgrade
        if (guestAttribution.referrer_user_id === params.referredUserId) {
          return { attribution: null, isNew: false, error: 'Self-referral is not allowed.' };
        }

        const pool = client || getPool();
        if (pool) {
          const res = await pool.query<ReferralAttributionRecord>(
            `
            UPDATE referral_attributions
            SET referred_user_id = $1, bound_at = $2, status = 'locked',
                level1_referrer_user_id = $3, level2_referrer_user_id = $4, level3_referrer_user_id = $5,
                updated_at = $2
            WHERE id = $6 AND referred_user_id IS NULL
            RETURNING *;
            `,
            [params.referredUserId, nowIso, level1UserId, level2UserId, level3UserId, guestAttribution.id]
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
            level1_referrer_user_id: level1UserId,
            level2_referrer_user_id: level2UserId,
            level3_referrer_user_id: level3UserId,
            updated_at: nowIso,
          };
          devReferralAttributions.set(updated.id, updated);
          return { attribution: { ...updated }, isNew: true };
        }
      }
    }

    // 6. Create fresh permanent locked attribution with 3-level lineage
    const id = `refatt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const newRecord: ReferralAttributionRecord = {
      id,
      referrer_user_id: level1UserId,
      referred_user_id: params.referredUserId,
      visitor_key: params.visitorKey || null,
      source_code: params.sourceCode.toUpperCase(),
      first_landing_path: params.landingPath || '/',
      first_seen_at: nowIso,
      bound_at: nowIso,
      status: 'locked',
      level1_referrer_user_id: level1UserId,
      level2_referrer_user_id: level2UserId,
      level3_referrer_user_id: level3UserId,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const pool = client || getPool();
    if (pool) {
      try {
        const res = await pool.query<ReferralAttributionRecord>(
          `
          INSERT INTO referral_attributions (
            id, referrer_user_id, referred_user_id, visitor_key, source_code,
            first_landing_path, first_seen_at, bound_at, status,
            level1_referrer_user_id, level2_referrer_user_id, level3_referrer_user_id,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
            newRecord.level1_referrer_user_id,
            newRecord.level2_referrer_user_id,
            newRecord.level3_referrer_user_id,
            newRecord.created_at,
            newRecord.updated_at,
          ]
        );
        return { attribution: res.rows[0], isNew: true };
      } catch (err: any) {
        if (client) throw err;
        // In case of conflict, retrieve the winning original attribution
        const winner = await this.findAttributionByReferredUserId(params.referredUserId);
        return { attribution: winner, isNew: false };
      }
    }

    devReferralAttributions.set(newRecord.id, newRecord);
    return { attribution: { ...newRecord }, isNew: true };
  }

  /**
   * Computes accurate network member counts across 3 levels (real numbers only).
   */
  static async countNetworkMembers(
    referrerUserId: string
  ): Promise<{ level1: number; level2: number; level3: number; total: number }> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query<{
        level1_count: string;
        level2_count: string;
        level3_count: string;
      }>(
        `
        SELECT
          (SELECT COUNT(DISTINCT referred_user_id) FROM referral_attributions WHERE (level1_referrer_user_id = $1 OR (level1_referrer_user_id IS NULL AND referrer_user_id = $1)) AND referred_user_id IS NOT NULL) as level1_count,
          (SELECT COUNT(DISTINCT referred_user_id) FROM referral_attributions WHERE level2_referrer_user_id = $1 AND referred_user_id IS NOT NULL) as level2_count,
          (SELECT COUNT(DISTINCT referred_user_id) FROM referral_attributions WHERE level3_referrer_user_id = $1 AND referred_user_id IS NOT NULL) as level3_count;
        `,
        [referrerUserId]
      );
      const row = res.rows[0];
      const level1 = parseInt(row?.level1_count || '0', 10);
      const level2 = parseInt(row?.level2_count || '0', 10);
      const level3 = parseInt(row?.level3_count || '0', 10);
      return { level1, level2, level3, total: level1 + level2 + level3 };
    }

    const l1Set = new Set<string>();
    const l2Set = new Set<string>();
    const l3Set = new Set<string>();

    for (const attr of devReferralAttributions.values()) {
      if (!attr.referred_user_id) continue;
      if (
        attr.level1_referrer_user_id === referrerUserId ||
        (!attr.level1_referrer_user_id && attr.referrer_user_id === referrerUserId)
      ) {
        l1Set.add(attr.referred_user_id);
      }
      if (attr.level2_referrer_user_id === referrerUserId) {
        l2Set.add(attr.referred_user_id);
      }
      if (attr.level3_referrer_user_id === referrerUserId) {
        l3Set.add(attr.referred_user_id);
      }
    }

    const level1 = l1Set.size;
    const level2 = l2Set.size;
    const level3 = l3Set.size;
    return { level1, level2, level3, total: level1 + level2 + level3 };
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
    productKey?: string | null,
    purchaseStage: PurchaseStage = 'any',
    client?: PoolClient,
    at = new Date().toISOString()
  ): Promise<ReferralRewardRuleRecord | null> {
    const pool = client || getPool();
    const nowIso = at;

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
          AND purchase_stage IN ('any', $5)
        ORDER BY
          CASE WHEN product_key IS NOT NULL AND product_key != '' THEN 1 ELSE 2 END,
          CASE WHEN network IS NOT NULL AND network != '' THEN 1 ELSE 2 END,
          CASE WHEN service_type = $1 THEN 1 ELSE 2 END,
          CASE WHEN purchase_stage = 'any' THEN 2 ELSE 1 END,
          created_at DESC, id ASC
        LIMIT 1;
        `,
        [serviceType, network || '', productKey || '', nowIso, purchaseStage]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0];
    }

    const activeRules = Array.from(devRewardRules.values()).filter((r) => {
      if (!isActiveReferralRule(r, nowIso)) return false;
      if (r.service_type !== 'all' && r.service_type !== serviceType) return false;
      if (r.network && r.network.toLowerCase() !== (network || '').toLowerCase()) return false;
      if (r.product_key && r.product_key !== productKey) return false;
      if ((r.purchase_stage || 'any') !== 'any' && r.purchase_stage !== purchaseStage) return false;
      if (r.starts_at && new Date(r.starts_at) > new Date(nowIso)) return false;
      if (r.ends_at && new Date(r.ends_at) < new Date(nowIso)) return false;
      return true;
    });

    if (activeRules.length === 0) return null;
    // Prefer most specific rule
    activeRules.sort((a, b) => compareReferralRules(a, b, serviceType));

    return { ...activeRules[0] };
  }

  static async getAllRules(client?: PoolClient): Promise<ReferralRewardRuleRecord[]> {
    const pool = client || getPool();
    if (pool) {
      const res = await pool.query<ReferralRewardRuleRecord>(
        `SELECT * FROM referral_reward_rules ORDER BY created_at DESC;`
      );
      return res.rows;
    }
    return Array.from(devRewardRules.values());
  }

  static async createOrUpdateRule(
    rule: Partial<ReferralRewardRuleRecord> & { service_type: RewardServiceType | 'all' }, client?: PoolClient
  ): Promise<ReferralRewardRuleRecord> {
    const id = rule.id || `rewrule_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const record: ReferralRewardRuleRecord = {
      id,
      service_type: rule.service_type,
      purchase_stage: rule.purchase_stage || 'any',
      level2_reward_minor: rule.level2_reward_minor,
      level2_percent_bps: rule.level2_percent_bps,
      level3_reward_minor: rule.level3_reward_minor,
      level3_percent_bps: rule.level3_percent_bps,
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

    const pool = client || getPool();
    if (pool) {
      const res = await pool.query<ReferralRewardRuleRecord>(
        `
        INSERT INTO referral_reward_rules (id, service_type, product_key, network, reward_type, reward_minor, reward_percent_bps, enabled, starts_at, ends_at, created_at, updated_at, purchase_stage)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          service_type = EXCLUDED.service_type,
          purchase_stage = EXCLUDED.purchase_stage,
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
          record.purchase_stage,
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
    entry: Omit<RewardLedgerRecord, 'id' | 'created_at'>,
    transactionClient?: PoolClient
  ): Promise<{ record: RewardLedgerRecord; alreadyExisted: boolean }> {
    const pool = getPool();
    const id = `rew_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const record: RewardLedgerRecord = {
      ...entry,
      reward_stage: entry.reward_stage || 'standard',
      reward_relationship_key: entry.reward_relationship_key || null,
      id,
      created_at: nowIso,
    };

    if (pool) {
      // Check existing by idempotency_key
      const client = transactionClient || await pool.connect();
      try {
        if (!transactionClient) {
          await client.query('BEGIN');
          await client.query('LOCK TABLE reward_ledger IN ROW EXCLUSIVE MODE;');
          await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0));',
            [`referral-reward:${entry.order_id || entry.idempotency_key}`]);
        }
        const checkRes = await client.query<RewardLedgerRecord>(
          `SELECT * FROM reward_ledger WHERE idempotency_key = $1
            OR (order_id = $2 AND service_type = $3 AND network_level = $4 AND reversal_of_id IS NULL)
            LIMIT 1;`,
          [entry.idempotency_key, entry.order_id, entry.service_type, entry.network_level || 1]
        );
        if (checkRes.rows.length > 0) {
          if (!transactionClient) await client.query('COMMIT');
          return { record: checkRes.rows[0], alreadyExisted: true };
        }

        const res = await client.query<RewardLedgerRecord>(
          `
          INSERT INTO reward_ledger (
            id, referrer_user_id, referred_user_id, referral_attribution_id,
            order_id, marketplace_product_id, service_type, reward_rule_id,
            amount_minor, currency, status, reason, idempotency_key, reversal_of_id,
            created_at, approved_at, rejected_at, reversed_at, metadata_json, reward_stage, reward_relationship_key
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19, $20, $21
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
            record.reward_stage,
            record.reward_relationship_key,
          ]
        );
        if (!transactionClient) await client.query('COMMIT');
        return { record: res.rows[0], alreadyExisted: false };
      } catch (error) { if (!transactionClient) await client.query('ROLLBACK'); throw error; }
      finally { if (!transactionClient) client.release(); }
    }

    // In-memory check
    for (const item of devRewardLedger.values()) {
      if (item.idempotency_key === entry.idempotency_key || (entry.order_id && item.order_id === entry.order_id
        && item.service_type === entry.service_type && (item.network_level || 1) === (entry.network_level || 1)
        && !item.reversal_of_id)) {
        return { record: { ...item }, alreadyExisted: true };
      }
    }

    devRewardLedger.set(record.id, record);
    return { record: { ...record }, alreadyExisted: false };
  }

  static async findLedgerById(id: string, client?: PoolClient): Promise<RewardLedgerRecord | null> {
    const pool = client || getPool();
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

  static async findLedgerByOrderId(orderId: string, client?: PoolClient): Promise<RewardLedgerRecord[]> {
    const pool = client || getPool();
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
    reason: string,
    transactionClient?: PoolClient
  ): Promise<RewardLedgerRecord | null> {
    const existing = await this.findLedgerById(ledgerId,transactionClient);
    if (!existing) return null;
    if (existing.status === 'reversed') return existing;

    const nowIso = new Date().toISOString();
    const pool = transactionClient || getPool();

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
    devRewardLedger.set(existing.id, existing);
    return { ...existing };
  }

  /**
   * Computes accurate financial summary for an authenticated user
   */
  static async getReferralSummary(userId: string): Promise<ReferralSummary> {
    const profile = await this.getOrCreateProfile(userId);
    const clicksCount = await this.countClicksByReferrer(userId);
    const uniqueVisitorsCount = await this.countUniqueVisitorsByReferrer(userId);
    const referredCustomersCount = await this.countReferredCustomers(userId);
    const networkCounts = await this.countNetworkMembers(userId);

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
      rawClicksCount: clicksCount,
      uniqueVisitorsCount,
      referredCustomersCount,
      networkLevel1Count: networkCounts.level1,
      networkLevel2Count: networkCounts.level2,
      networkLevel3Count: networkCounts.level3,
      networkTotalCount: networkCounts.total,
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
      reward_stage: r.reward_stage || 'standard',
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
  static async withRewardTransaction<T>(relationshipKey: string, orderId: string,
    work: (client?: PoolClient) => Promise<T>, profileUserId?: string): Promise<T> {
    const pool = getPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('LOCK TABLE reward_ledger IN ROW EXCLUSIVE MODE;');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0));', [`referral-stage:${relationshipKey}`]);
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0));', [`referral-reward:${orderId}`]);
        const result = await work(client);
        await client.query('COMMIT'); return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    }
    const releases: Array<() => void> = [];
    try {
      for (const key of [...(profileUserId ? [`profile:${profileUserId}`] : []), `stage:${relationshipKey}`, `order:${orderId}`]) {
        const previous = devRewardLocks.get(key) || Promise.resolve();
        let release!: () => void;
        const pending = new Promise<void>(resolve => { release = resolve; });
        const tail = previous.then(() => pending);
        devRewardLocks.set(key, tail);
        await previous;
        releases.push(() => { release(); if (devRewardLocks.get(key) === tail) devRewardLocks.delete(key); });
      }
      return await work();
    } finally { for (const release of releases.reverse()) release(); }
  }

  static async findAttributionById(id: string, client?: PoolClient): Promise<ReferralAttributionRecord | null> {
    const pool = client || getPool();
    if (pool) return (await pool.query<ReferralAttributionRecord>('SELECT * FROM referral_attributions WHERE id = $1;', [id])).rows[0] || null;
    return devReferralAttributions.get(id) || null;
  }

  static async hasRewardedPurchase(params: { referrerId: string; userId?: string | null; attributionId?: string | null;
    service: RewardServiceType; relationshipKey: string; orderId: string }, client?: PoolClient): Promise<boolean> {
    const pool = client || getPool();
    if (pool) {
      const result = await pool.query<{ present: boolean }>(`
        SELECT EXISTS (SELECT 1 FROM reward_ledger WHERE referrer_user_id = $1 AND service_type = $2
          AND network_level = 1 AND order_id IS NOT NULL AND order_id <> $6
          AND status IN ('approved', 'reversed') AND reversal_of_id IS NULL
          AND reward_stage IN ('standard', 'acquisition')
          AND (reward_relationship_key = $3 OR referred_user_id = $4 OR referral_attribution_id = $5)) AS present;
      `, [params.referrerId, params.service, params.relationshipKey, params.userId || null, params.attributionId || null, params.orderId]);
      return result.rows[0]?.present || false;
    }
    return [...devRewardLedger.values()].some(entry => entry.referrer_user_id === params.referrerId
      && entry.service_type === params.service && (entry.network_level || 1) === 1 && entry.order_id && entry.order_id !== params.orderId
      && ['approved', 'reversed'].includes(entry.status) && !entry.reversal_of_id
      && (entry.reward_stage || 'standard') !== 'recurring'
      && (entry.reward_relationship_key === params.relationshipKey || (params.userId && entry.referred_user_id === params.userId)
        || (params.attributionId && entry.referral_attribution_id === params.attributionId)));
  }

}
