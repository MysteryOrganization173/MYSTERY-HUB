import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPool } from './connection.js';
import { AdminAuditStore } from './adminAuditStore.js';
import type { OrderRecord } from '../types/orders.js';
import type { ShieldAdminView, ShieldState, ShieldView } from '../../shared/mysteryShield.js';
import { evaluateShield, validShieldBudget, type OriginalStatusEvidence, type ShieldPolicy } from '../services/shieldPolicy.js';

const claims = 'mysteryhub_shield.claims';
const control = 'mysteryhub_shield.control';
type ClaimState = 'reserved' | 'submitted' | 'uncertain' | 'delivered' | 'failed';
export interface ShieldClaim {
  id: string;
  order_id: string;
  state: ClaimState;
  reserved_minor: number;
  package_id: string;
  supplier_id: string | null;
}
type ShieldOrder = OrderRecord & { shield_fixture: boolean };
export interface ShieldQuote {
  packageId: string;
  network: 'mtn';
  sizeMB: 400;
  costMinor: number;
  expiresAt: number;
}

export function validShieldQuote(quote: ShieldQuote | null, policy: ShieldPolicy, now: number): quote is ShieldQuote {
  return !!quote && quote.network === 'mtn' && quote.sizeMB === 400
    && /^[a-zA-Z0-9_-]{1,100}$/.test(quote.packageId)
    && validShieldBudget(policy) && Number.isSafeInteger(quote.costMinor)
    && quote.costMinor > 0 && quote.costMinor <= policy.perClaimMinor
    && Number.isFinite(quote.expiresAt) && quote.expiresAt > now;
}

export const claimView = (claim: ShieldClaim): ShieldView => ({
  // A worker may have stopped after the durable latch and before obtaining a reply.
  state: claim.state === 'reserved' ? 'uncertain' : claim.state,
});

async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  if (!pool) throw new Error('Shield storage unavailable');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '4s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const ownedOrderSql = `SELECT o.*, EXISTS (
  SELECT 1 FROM public.order_test_fixtures f WHERE f.order_id = o.id
) AS shield_fixture FROM public.orders o WHERE o.public_reference = $1 AND o.user_id = $2`;
const liabilitySql = `SELECT COALESCE(SUM(reserved_minor), 0) AS total,
  COALESCE(SUM(reserved_minor) FILTER (WHERE created_at >=
    date_trunc('day', clock_timestamp() AT TIME ZONE 'Africa/Accra') AT TIME ZONE 'Africa/Accra'), 0) AS today, COALESCE(SUM(confirmed_charge_minor), 0) AS confirmed
  FROM ${claims}`;

export class ShieldStore {
  static async ready() {
    const result = await getPool()?.query<{ ready: boolean }>(
      'SELECT to_regclass($1) IS NOT NULL AND to_regclass($2) IS NOT NULL AS ready', [claims, control]);
    return result?.rows[0]?.ready === true;
  }

  static async ownedOrder(reference: string, userId: string): Promise<ShieldOrder | null> {
    const result = await getPool()?.query<ShieldOrder>(ownedOrderSql, [reference, userId]);
    return result?.rows[0] ?? null;
  }

  static async existing(orderId: string) {
    const result = await getPool()?.query<ShieldClaim>(`SELECT * FROM ${claims} WHERE order_id = $1`, [orderId]);
    return result?.rows[0] ?? null;
  }

  static async claimability(policy: ShieldPolicy, quote: ShieldQuote): Promise<ShieldView> {
    const result = await getPool()?.query(
      `SELECT control.paused, liability.* FROM ${control} control CROSS JOIN (${liabilitySql}) liability WHERE control.id`);
    const row = result?.rows[0];
    if (!row || row.paused) return { state: 'unavailable' };
    if (Number(row.total) + quote.costMinor > policy.totalMinor
        || Number(row.today) + quote.costMinor > policy.dailyMinor) return { state: 'budget_exhausted' };
    return { state: 'eligible' };
  }

  /** Serialize all reservations under the control row, including claims for different orders. */
  static async reserve(reference: string, userId: string, policy: ShieldPolicy, evidence: OriginalStatusEvidence,
    quote: ShieldQuote, expectedOrder: OrderRecord): Promise<{ view: ShieldView; claim?: ShieldClaim }> {
    return transaction(async client => {
      const setting = (await client.query(`SELECT paused FROM ${control} WHERE id FOR UPDATE`)).rows[0];
      const order = (await client.query<ShieldOrder>(ownedOrderSql + ' FOR UPDATE OF o', [reference, userId])).rows[0];
      if (!order) return { view: { state: 'not_covered' } };
      const existing = (await client.query<ShieldClaim>(`SELECT * FROM ${claims} WHERE order_id = $1`, [order.id])).rows[0];
      if (existing) return { view: claimView(existing) };
      if (!setting || setting.paused || !policy.intake || !policy.fulfillment) return { view: { state: 'unavailable' } };
      if (order.id !== expectedOrder.id || order.recipient_phone !== expectedOrder.recipient_phone
          || order.supplier_offer_ref !== expectedOrder.supplier_offer_ref) return { view: { state: 'unverifiable' } };
      const now = Date.now();
      const view = evaluateShield(order, policy, now, order.shield_fixture, evidence);
      if (view.state !== 'eligible') return { view };
      if (!validShieldQuote(quote, policy, now)) return { view: { state: 'unavailable' } };
      const liability = (await client.query(liabilitySql)).rows[0];
      if (Number(liability.total) + quote.costMinor > policy.totalMinor
          || Number(liability.today) + quote.costMinor > policy.dailyMinor) {
        return { view: { state: 'budget_exhausted' } };
      }
      // Commit both the liability and the one-time submission latch before any network call.
      const result = await client.query<ShieldClaim>(`INSERT INTO ${claims}
        (id, order_id, state, reserved_minor, package_id, submission_started_at)
        VALUES ($1, $2, 'reserved', $3, $4, clock_timestamp()) RETURNING *`,
        [randomUUID(), order.id, quote.costMinor, quote.packageId]);
      return { view: { state: 'reserved' }, claim: result.rows[0] };
    });
  }

  static async recordSubmission(claim: ShieldClaim, state: 'submitted' | 'uncertain' | 'failed', supplierId: string | null) {
    await getPool()?.query(`UPDATE ${claims} SET state = $2, supplier_id = $3,
      submitted_at = CASE WHEN $2 = 'submitted' THEN clock_timestamp() END,
      resolved_at = CASE WHEN $2 = 'failed' THEN clock_timestamp() END, updated_at = clock_timestamp()
      WHERE id = $1 AND state = 'reserved' AND submission_started_at IS NOT NULL`, [claim.id, state, supplierId]);
  }

  static async recordOutcome(claim: ShieldClaim, state: 'delivered' | 'failed', charge: number | null) {
    await getPool()?.query(`UPDATE ${claims} SET state = $3, confirmed_charge_minor = $4, resolved_at = clock_timestamp(), updated_at = clock_timestamp()
      WHERE id = $1 AND supplier_id = $2 AND state IN ('submitted','uncertain')`,
      [claim.id, claim.supplier_id, state, charge]);
  }

  static async admin(policy: ShieldPolicy): Promise<ShieldAdminView> {
    const view: ShieldAdminView = {
      visible: policy.visible, intakeRequested: policy.intake, fulfillmentRequested: policy.fulfillment,
      notificationsRequested: policy.notifications, storageReady: await this.ready(), paused: true,
      startsAt: Number.isFinite(policy.startsAt) ? new Date(policy.startsAt).toISOString() : null,
      endsAt: Number.isFinite(policy.endsAt) ? new Date(policy.endsAt).toISOString() : null,
      totalLimitMinor: policy.totalMinor || null, dailyLimitMinor: policy.dailyMinor || null,
      perClaimLimitMinor: policy.perClaimMinor || null, reservedMinor: 0, reservedTodayMinor: 0, confirmedSpendMinor: 0,
      claims: [], counts: {},
    };
    if (!view.storageReady) return view;
    return transaction(async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const setting = (await client.query(`SELECT paused FROM ${control} WHERE id`)).rows[0];
      view.paused = setting?.paused !== false;
      const totals = (await client.query(liabilitySql)).rows[0];
      view.reservedMinor = Number(totals.total);
      view.reservedTodayMinor = Number(totals.today);
      view.confirmedSpendMinor = Number(totals.confirmed);
      const counts = await client.query(`SELECT state, COUNT(*)::int AS count FROM ${claims} GROUP BY state`);
      for (const row of counts.rows) {
        const state: ShieldState = row.state === 'reserved' ? 'uncertain' : row.state;
        view.counts[state] = (view.counts[state] ?? 0) + row.count;
      }
      view.claims = (await client.query(`SELECT o.public_reference AS reference,
        CASE WHEN c.state = 'reserved' THEN 'uncertain' ELSE c.state END AS state,
        c.reserved_minor AS "reservedMinor", c.created_at AS "createdAt"
        FROM ${claims} c JOIN public.orders o ON o.id = c.order_id ORDER BY c.created_at DESC LIMIT 50`)).rows;
      return view;
    });
  }

  static async pause(actor: string) {
    return transaction(async client => {
      const updated = await client.query(`UPDATE ${control} SET paused = TRUE WHERE id AND NOT paused RETURNING id`);
      if (updated.rowCount) await AdminAuditStore.record({
        adminUserId: actor, action: 'shield_paused', entityType: 'mystery_shield', entityId: 'programme',
      }, client);
    });
  }
}
