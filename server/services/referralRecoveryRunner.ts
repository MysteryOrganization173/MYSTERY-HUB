import crypto from 'node:crypto';
import type { Pool } from 'pg';
import { planReferralRecovery, type ReferralRecoverySnapshot } from './referralRecovery.js';

/** CLI-only maintenance; dry-run uses a read-only consistent PostgreSQL snapshot. */
export async function reconcileReferralHistory(pool: Pick<Pool, 'connect'>, apply = false) {
  const client = await pool.connect();
  try {
    await client.query(apply ? 'BEGIN;' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;');
    if (apply) {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('referral-attribution-graph', 0));");
      // Keeps the plan and writes together; live ledger creation takes its write lock before checking.
      await client.query('LOCK TABLE referral_attributions, reward_ledger IN SHARE ROW EXCLUSIVE MODE;');
      // Prevent qualifying order/payment/reversal state or evidence changing during apply.
      await client.query('LOCK TABLE orders, users, referral_profiles, admin_audit_log IN SHARE MODE;');
    }
    const users = await client.query('SELECT id FROM users;');
    const profiles = await client.query('SELECT * FROM referral_profiles;');
    const attributions = await client.query('SELECT * FROM referral_attributions;');
    const orders = await client.query(`SELECT id, user_id, referrer_user_id, referral_attribution_id,
      referral_code, status, payment_status, marketplace_status, service_type, currency, amount,
      created_at, paid_at, delivered_at, product_id FROM orders;`);
    const ledger = await client.query('SELECT * FROM reward_ledger;');
    const audits = await client.query(`SELECT * FROM admin_audit_log
      WHERE action IN ('referral_bound', 'reward_approved', 'reward_reversed');`);
    const clicks = await client.query('SELECT COUNT(*) AS count FROM referral_clicks;');
    const snapshot: ReferralRecoverySnapshot = {
      users: users.rows, profiles: profiles.rows, attributions: attributions.rows,
      orders: orders.rows, ledger: ledger.rows, audits: audits.rows, storedClickCount: Number(clicks.rows[0]?.count || 0),
    };
    const plan = planReferralRecovery(snapshot);
    const applied = { attributions: 0, rewards: 0 };
    if (apply) {
      for (const repair of plan.attributionRepairs) {
        const id = `refatt_recovery_${crypto.createHash('sha256').update(repair.referredUserId).digest('hex').slice(0, 32)}`;
        const result = await client.query(`
          INSERT INTO referral_attributions (id, referrer_user_id, referred_user_id, source_code,
            first_seen_at, bound_at, status, level1_referrer_user_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $5, 'locked', $2, $5, NOW())
          ON CONFLICT (referred_user_id) DO NOTHING RETURNING id;
        `, [id, repair.referrerUserId, repair.referredUserId, repair.sourceCode, repair.evidenceAt]);
        applied.attributions += result.rowCount || 0;
        if (result.rowCount) await client.query(`
          INSERT INTO admin_audit_log (id, admin_user_id, action, entity_type, entity_id, metadata_safe_json)
          VALUES ($1, $2, 'referral_history_reconciled', 'referral_attribution', $3, $4);
        `, [`aud_recovery_${crypto.randomUUID()}`, repair.referrerUserId, id, JSON.stringify({ evidence_ids: repair.evidenceIds })]);
      }
      for (const repair of plan.rewardRepairs) {
        const result = await client.query(`
          INSERT INTO reward_ledger (id, referrer_user_id, referred_user_id, referral_attribution_id,
            order_id, service_type, amount_minor, currency, status, reason, idempotency_key, approved_at, metadata_json)
          SELECT $1, $2, $3, (SELECT id FROM referral_attributions WHERE referred_user_id = $3),
            $4, $5, $6, 'GHS', 'approved', 'Historical approval restored from persisted audit evidence', $7, $8, $9
          WHERE NOT EXISTS (SELECT 1 FROM reward_ledger WHERE order_id = $4)
          ON CONFLICT DO NOTHING RETURNING id;
        `, [repair.ledgerId, repair.referrerUserId, repair.referredUserId, repair.orderId,
          repair.serviceType, repair.amountMinor, `historical_reward:${repair.orderId}`, repair.approvedAt,
          JSON.stringify({ historical_approval_audit_id: repair.auditId, historical_amount_minor: repair.amountMinor })]);
        applied.rewards += result.rowCount || 0;
        if (result.rowCount) await client.query(`
          INSERT INTO admin_audit_log (id, admin_user_id, action, entity_type, entity_id, metadata_safe_json)
          VALUES ($1, $2, 'reward_history_reconciled', 'reward_ledger', $3, $4);
        `, [`aud_recovery_${crypto.randomUUID()}`, repair.referrerUserId, repair.ledgerId,
          JSON.stringify({ order_id: repair.orderId, approval_audit_id: repair.auditId, amount_minor: repair.amountMinor })]);
      }
    }
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    return { mode: apply ? 'apply' : 'dry-run', ...plan, applied };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
