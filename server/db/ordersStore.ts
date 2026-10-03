/**
 * Database Orders Store
 * Production-ready PostgreSQL database abstraction with safe fallback
 * for local development environments.
 */

import { getPool, initDatabase } from './connection.js';
import { OrderRecord, OrderStatus } from '../types/orders.js';
import {
  getGhanaPhoneLookupVariants,
  canonicalGhanaPhone,
  areGhanaPhonesEqual,
} from '../utils/phone.js';
import { PaystackServerService } from '../services/paystackService.js';
import { FulfilmentService } from '../services/fulfilmentService.js';
import { ReferralService } from '../services/referralService.js';
import type { PoolClient } from 'pg';
import { validateOrderPayment } from '../services/paymentValidation.js';
import { canAdvanceOrderStatus } from '../services/orderTransitions.js';

// In-memory fallback repository for development when DATABASE_URL is omitted
const devMemoryStore = new Map<string, OrderRecord>();
const devWebhookEventsStore = new Set<string>();

// In-memory mutex mechanism for serializing concurrent order creations per recipient
const inMemoryLocks = new Map<string, Promise<void>>();

async function acquireLock(key: string): Promise<() => void> {
  while (inMemoryLocks.has(key)) {
    await inMemoryLocks.get(key);
  }
  let resolveCurrent: () => void = () => {};
  const currentPromise = new Promise<void>((resolve) => {
    resolveCurrent = resolve;
  });
  inMemoryLocks.set(key, currentPromise);

  return () => {
    inMemoryLocks.delete(key);
    resolveCurrent();
  };
}

export class OrdersStore {
  /**
   * Initializes database table if PostgreSQL is configured
   */
  static async initDb(): Promise<void> {
    await initDatabase();
  }

  /**
   * Find any existing active/blocking order for an MTN recipient
   * Blocking statuses: paid, queued, submitted, processing, refund_pending
   */
  static async findActiveMtnOrder(recipientPhone: string): Promise<OrderRecord | null> {
    const variants = getGhanaPhoneLookupVariants(recipientPhone);
    if (variants.length === 0) return null;

    const pool = getPool();
    if (pool) {
      const query = `
        SELECT * FROM orders
        WHERE network = 'mtn'
          AND recipient_phone = ANY($1)
          AND status IN ('paid', 'queued', 'submitted', 'processing', 'refund_pending')
        ORDER BY created_at DESC
        LIMIT 1;
      `;
      const result = await pool.query(query, [variants]);
      if (result.rows.length > 0) {
        return result.rows[0] as OrderRecord;
      }
      return null;
    } else {
      const blockingStatuses = ['paid', 'queued', 'submitted', 'processing', 'refund_pending'];
      for (const order of devMemoryStore.values()) {
        if (
          order.network.toLowerCase() === 'mtn' &&
          blockingStatuses.includes(order.status) &&
          variants.some((v) => areGhanaPhonesEqual(order.recipient_phone, v))
        ) {
          return order;
        }
      }
      return null;
    }
  }

  /**
   * Atomically checks for an existing active MTN order and inserts the new order
   * within a database transaction with advisory lock (or serialized in-memory lock)
   */
  static async createOrderWithMtnDuplicateCheck(
    order: OrderRecord
  ): Promise<{ success: true; order: OrderRecord } | { success: false; existingOrder: OrderRecord }> {
    if (order.network.toLowerCase() !== 'mtn') {
      const created = await this.createOrder(order);
      return { success: true, order: created };
    }

    const normPhone = canonicalGhanaPhone(order.recipient_phone) || order.recipient_phone;
    const variants = getGhanaPhoneLookupVariants(order.recipient_phone);
    const pool = getPool();

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Advisory transaction-level lock on hash of normalized phone
        // Automatically released at COMMIT or ROLLBACK
        await client.query(`SELECT pg_advisory_xact_lock(hashtext('mtn_' || $1))`, [normPhone]);

        // Check for active blocking MTN order
        const checkQuery = `
          SELECT * FROM orders
          WHERE network = 'mtn'
            AND recipient_phone = ANY($1)
            AND status IN ('paid', 'queued', 'submitted', 'processing', 'refund_pending')
          ORDER BY created_at DESC
          LIMIT 1;
        `;
        const checkRes = await client.query(checkQuery, [variants]);
        if (checkRes.rows.length > 0) {
          await client.query('ROLLBACK');
          return { success: false, existingOrder: checkRes.rows[0] as OrderRecord };
        }

        // Insert new order
        const insertQuery = `
          INSERT INTO orders (
            id, user_id, service_type, face_value_minor, service_fee_minor,
            public_reference, customer_name, customer_email, customer_phone,
            recipient_phone, network, product_id, product_name_snapshot,
            bundle_size_snapshot, amount, currency, status, payment_provider,
            payment_reference, payment_status, supplier_provider, supplier_order_id,
            supplier_response, supplier_cost_minor, supplier_offer_ref,
            supplier_last_checked_at, failure_reason, created_at, updated_at,
            paid_at, submitted_at, delivered_at, referrer_user_id, referral_attribution_id, referral_code
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
            $27, $28, $29, $30, $31, $32, $33, $34, $35
          ) RETURNING *;
        `;
        const values = [
          order.id,
          order.user_id ?? null,
          order.service_type || 'data',
          order.face_value_minor ?? null,
          order.service_fee_minor ?? null,
          order.public_reference,
          order.customer_name,
          order.customer_email,
          order.customer_phone,
          order.recipient_phone,
          order.network,
          order.product_id,
          order.product_name_snapshot,
          order.bundle_size_snapshot,
          order.amount,
          order.currency,
          order.status,
          order.payment_provider,
          order.payment_reference,
          order.payment_status,
          order.supplier_provider,
          order.supplier_order_id,
          order.supplier_response,
          order.supplier_cost_minor ?? null,
          order.supplier_offer_ref ?? null,
          order.supplier_last_checked_at ?? null,
          order.failure_reason,
          order.created_at,
          order.updated_at,
          order.paid_at,
          order.submitted_at,
          order.delivered_at,
          order.referrer_user_id ?? null,
          order.referral_attribution_id ?? null,
          order.referral_code ?? null,
        ];
        await client.query(insertQuery, values);
        await client.query('COMMIT');
        return { success: true, order };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const release = await acquireLock(`mtn:${normPhone}`);
      try {
        const existing = await this.findActiveMtnOrder(order.recipient_phone);
        if (existing) {
          return { success: false, existingOrder: existing };
        }
        await this.createOrder(order);
        return { success: true, order };
      } finally {
        release();
      }
    }
  }

  /**
   * Resets dev memory store (used for test isolation)
   */
  static clearDevStore(): void {
    devMemoryStore.clear();
    devWebhookEventsStore.clear();
  }

  /**
   * Delete order by id (internal / administrative cleanup use only)
   */
  static async deleteOrder(orderId: string): Promise<boolean> {
    const existing = await this.findOrder(orderId);
    if (!existing) return false;

    const pool = getPool();
    if (pool) {
      await pool.query('DELETE FROM orders WHERE id = $1', [existing.id]);
    } else {
      devMemoryStore.delete(existing.id);
      devMemoryStore.delete(`payref:${existing.payment_reference}`);
      devMemoryStore.delete(`pubref:${existing.public_reference}`);
    }
    return true;
  }

  /**
   * Find orders by an array of public references or IDs
   */
  static async findOrdersByReferences(references: string[]): Promise<OrderRecord[]> {
    if (!references || references.length === 0) return [];
    const pool = getPool();
    if (pool) {
      const query = `
        SELECT * FROM orders
        WHERE public_reference = ANY($1) OR id = ANY($1)
        ORDER BY created_at ASC;
      `;
      const result = await pool.query(query, [references]);
      return result.rows as OrderRecord[];
    } else {
      const matched: OrderRecord[] = [];
      for (const ref of references) {
        const ord = await this.findOrder(ref);
        if (ord && !matched.some((m) => m.id === ord.id)) {
          matched.push(ord);
        }
      }
      return matched;
    }
  }

  /**
   * Find candidate blocking orders for administrative cleanup discovery
   */
  static async findCandidateBlockingOrders(): Promise<OrderRecord[]> {
    const pool = getPool();
    if (pool) {
      const query = `
        SELECT * FROM orders
        WHERE status IN ('paid', 'queued', 'submitted', 'processing', 'refund_pending')
        ORDER BY created_at ASC;
      `;
      const result = await pool.query(query);
      return result.rows as OrderRecord[];
    } else {
      const blocking = ['paid', 'queued', 'submitted', 'processing', 'refund_pending'];
      const unique = Array.from(devMemoryStore.values()).filter(
        (o, idx, arr) => arr.findIndex((x) => x.id === o.id) === idx
      );
      return unique.filter((o) => blocking.includes(o.status));
    }
  }

  /**
   * Create a new pending order atomically
   */
  static async createOrder(order: OrderRecord): Promise<OrderRecord> {
    const pool = getPool();
    if (pool) {
      const query = `
        INSERT INTO orders (
          id, user_id, service_type, face_value_minor, service_fee_minor,
          public_reference, customer_name, customer_email, customer_phone,
          recipient_phone, network, product_id, product_name_snapshot,
          bundle_size_snapshot, amount, currency, status, payment_provider,
          payment_reference, payment_status, supplier_provider, supplier_order_id,
          supplier_response, supplier_cost_minor, supplier_offer_ref,
          supplier_last_checked_at, failure_reason, created_at, updated_at,
          paid_at, submitted_at, delivered_at, referrer_user_id, referral_attribution_id, referral_code,
          product_slug, variant_id, variant_snapshot, fulfilment_method, pickup_location_id,
          pickup_location_snapshot, delivery_city, delivery_area, delivery_landmark, delivery_note, marketplace_status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
          $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38,
          $39, $40, $41, $42, $43, $44, $45, $46
        ) RETURNING *;
      `;
      const values = [
        order.id,
        order.user_id ?? null,
        order.service_type || 'data',
        order.face_value_minor ?? null,
        order.service_fee_minor ?? null,
        order.public_reference,
        order.customer_name,
        order.customer_email,
        order.customer_phone,
        order.recipient_phone,
        order.network,
        order.product_id,
        order.product_name_snapshot,
        order.bundle_size_snapshot,
        order.amount,
        order.currency,
        order.status,
        order.payment_provider,
        order.payment_reference,
        order.payment_status,
        order.supplier_provider,
        order.supplier_order_id,
        order.supplier_response,
        order.supplier_cost_minor ?? null,
        order.supplier_offer_ref ?? null,
        order.supplier_last_checked_at ?? null,
        order.failure_reason,
        order.created_at,
        order.updated_at,
        order.paid_at,
        order.submitted_at,
        order.delivered_at,
        order.referrer_user_id ?? null,
        order.referral_attribution_id ?? null,
        order.referral_code ?? null,
        order.product_slug ?? null,
        order.variant_id ?? null,
        order.variant_snapshot ?? null,
        order.fulfilment_method ?? null,
        order.pickup_location_id ?? null,
        order.pickup_location_snapshot ?? null,
        order.delivery_city ?? null,
        order.delivery_area ?? null,
        order.delivery_landmark ?? null,
        order.delivery_note ?? null,
        order.marketplace_status ?? null,
      ];
      await pool.query(query, values);
      return order;
    } else {
      devMemoryStore.set(order.id, order);
      devMemoryStore.set(`payref:${order.payment_reference}`, order);
      devMemoryStore.set(`pubref:${order.public_reference}`, order);
      return order;
    }
  }

  /**
   * Admin: Update Marketplace Fulfilment Status safely
   */
  static async updateMarketplaceStatus(
    orderId: string,
    mktStatus: 'pending_payment' | 'paid' | 'awaiting_fulfilment' | 'ready_for_pickup' | 'out_for_delivery' | 'completed' | 'cancelled' | 'refund_pending' | 'refunded',
    adminNote?: string
  ): Promise<OrderRecord | null> {
    const existing = await this.findOrder(orderId);
    if (!existing) return null;

    const stages = ['pending_payment', 'paid', 'awaiting_fulfilment', 'ready_for_pickup', 'out_for_delivery', 'completed'];
    const currentStage = stages.indexOf(existing.marketplace_status || 'pending_payment');
    const nextStage = stages.indexOf(mktStatus);
    const explicitReversal = ['cancelled', 'refund_pending', 'refunded'].includes(mktStatus);
    if (!explicitReversal && (currentStage < 0 || nextStage < currentStage)) return existing;
    if (existing.status === 'refunded' || (existing.status === 'delivered' && !explicitReversal)) return existing;

    const nowIso = new Date().toISOString();
    let globalStatus: OrderStatus = existing.status;

    if (mktStatus === 'completed') {
      globalStatus = 'delivered';
    } else if (mktStatus === 'refunded') {
      globalStatus = 'refunded';
    } else if (mktStatus === 'cancelled') {
      globalStatus = 'cancelled';
    } else if (mktStatus === 'awaiting_fulfilment' || mktStatus === 'ready_for_pickup' || mktStatus === 'out_for_delivery') {
      globalStatus = 'processing';
    }

    const updated: OrderRecord = {
      ...existing,
      status: globalStatus,
      marketplace_status: mktStatus,
      admin_note: adminNote !== undefined ? adminNote : existing.admin_note,
      updated_at: nowIso,
      delivered_at: mktStatus === 'completed' ? (existing.delivered_at || nowIso) : existing.delivered_at,
    };

    const pool = getPool();
    if (pool) {
      const query = `
        UPDATE orders
        SET status = $1, marketplace_status = $2, admin_note = $3, updated_at = $4, delivered_at = $5
        WHERE id = $6 AND status = $7 AND marketplace_status IS NOT DISTINCT FROM $8
        RETURNING *;
      `;
      const result = await pool.query<OrderRecord>(query, [
        updated.status,
        updated.marketplace_status,
        updated.admin_note,
        updated.updated_at,
        updated.delivered_at,
        existing.id,
        existing.status,
        existing.marketplace_status || null,
      ]);
      if (!result.rows[0]) return this.updateMarketplaceStatus(orderId, mktStatus, adminNote);
    } else {
      const current = devMemoryStore.get(existing.id);
      if (current?.status !== existing.status || current?.marketplace_status !== existing.marketplace_status) {
        return this.updateMarketplaceStatus(orderId, mktStatus, adminNote);
      }
      devMemoryStore.set(existing.id, updated);
      devMemoryStore.set(`payref:${existing.payment_reference}`, updated);
      devMemoryStore.set(`pubref:${existing.public_reference}`, updated);
    }

    // Trigger reward ledger when order is marked completed
    if (mktStatus === 'completed' && existing.marketplace_status !== 'completed') {
      try {
        await ReferralService.processOrderReward(updated);
      } catch (err) {
        console.warn('[OrdersStore] Failed to process marketplace referral reward:', err);
      }
    } else if (
      existing.marketplace_status === 'completed' &&
      (mktStatus === 'refunded' || mktStatus === 'cancelled')
    ) {
      try {
        await ReferralService.reverseOrderRewards(
          existing.id,
          adminNote || `Marketplace order transitioned to ${mktStatus}`
        );
      } catch (err) {
        console.warn('[OrdersStore] Failed to reverse marketplace referral reward:', err);
      }
    }

    return updated;
  }

  /**
   * Find orders belonging to a specific authenticated user
   * Excludes cancelled/expired unpaid payment attempts so customer history stays clean
   */
  static async findOrdersByUserId(userId: string, limit?: number): Promise<OrderRecord[]> {
    if (!userId) return [];
    const pool = getPool();
    const hasLimit = typeof limit === 'number' && limit > 0;
    if (pool) {
      const query = `
        SELECT * FROM orders 
        WHERE user_id = $1 AND status NOT IN ('cancelled', 'expired', 'pending_payment')
        ORDER BY created_at DESC
        ${hasLimit ? 'LIMIT $2' : ''};
      `;
      const params = hasLimit ? [userId, limit] : [userId];
      const res = await pool.query(query, params);
      return res.rows as OrderRecord[];
    }

    const results: OrderRecord[] = [];
    for (const ord of devMemoryStore.values()) {
      if (
        ord.user_id === userId &&
        ord.status !== 'cancelled' &&
        ord.status !== 'expired' &&
        ord.status !== 'pending_payment' &&
        !results.some((r) => r.id === ord.id)
      ) {
        results.push(ord);
      }
    }
    const sorted = results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (hasLimit) {
      return sorted.slice(0, limit);
    }
    return sorted;
  }

  /**
   * Safe, authoritative cancellation of an order payment attempt
   * Cannot cancel orders that are already paid, delivered, or processing
   */
  static async cancelOrder(
    ref: string,
    failureReason: string = 'customer_closed_checkout'
  ): Promise<{ order: OrderRecord | null; cancelled: boolean; alreadyPaid: boolean }> {
    const existing = await this.findOrder(ref);
    if (!existing) {
      return { order: null, cancelled: false, alreadyPaid: false };
    }

    if (
      existing.payment_status === 'success' ||
      ['paid', 'queued', 'submitted', 'processing', 'delivered', 'refund_pending', 'refunded'].includes(existing.status)
    ) {
      return { order: existing, cancelled: false, alreadyPaid: true };
    }

    const nowIso = new Date().toISOString();
    const updated: OrderRecord = {
      ...existing,
      status: 'cancelled',
      payment_status: 'cancelled',
      failure_reason: failureReason,
      payment_closed_at: nowIso,
      updated_at: nowIso,
    };

    const pool = getPool();
    if (pool) {
      const query = `
        UPDATE orders
        SET status = $1, payment_status = $2, failure_reason = $3, payment_closed_at = $4, updated_at = $5
        WHERE id = $6;
      `;
      await pool.query(query, [
        updated.status,
        updated.payment_status,
        updated.failure_reason,
        updated.payment_closed_at,
        updated.updated_at,
        existing.id,
      ]);
    } else {
      devMemoryStore.set(existing.id, updated);
      devMemoryStore.set(`payref:${existing.payment_reference}`, updated);
      devMemoryStore.set(`pubref:${existing.public_reference}`, updated);
    }

    return { order: updated, cancelled: true, alreadyPaid: false };
  }

  /**
   * Safe expiration of an unresolved order payment attempt
   */
  static async expireOrder(
    ref: string,
    failureReason: string = 'payment_expired'
  ): Promise<{ order: OrderRecord | null; expired: boolean; alreadyPaid: boolean }> {
    const existing = await this.findOrder(ref);
    if (!existing) {
      return { order: null, expired: false, alreadyPaid: false };
    }

    if (
      existing.payment_status === 'success' ||
      ['paid', 'queued', 'submitted', 'processing', 'delivered', 'refund_pending', 'refunded'].includes(existing.status)
    ) {
      return { order: existing, expired: false, alreadyPaid: true };
    }

    const nowIso = new Date().toISOString();
    const updated: OrderRecord = {
      ...existing,
      status: 'expired',
      payment_status: 'expired',
      failure_reason: failureReason,
      payment_closed_at: nowIso,
      updated_at: nowIso,
    };

    const pool = getPool();
    if (pool) {
      const query = `
        UPDATE orders
        SET status = $1, payment_status = $2, failure_reason = $3, payment_closed_at = $4, updated_at = $5
        WHERE id = $6;
      `;
      await pool.query(query, [
        updated.status,
        updated.payment_status,
        updated.failure_reason,
        updated.payment_closed_at,
        updated.updated_at,
        existing.id,
      ]);
    } else {
      devMemoryStore.set(existing.id, updated);
      devMemoryStore.set(`payref:${existing.payment_reference}`, updated);
      devMemoryStore.set(`pubref:${existing.public_reference}`, updated);
    }

    return { order: updated, expired: true, alreadyPaid: false };
  }

  private static isReconcilingStalePending = false;

  /**
   * Server-side reconciliation of stale pending_payment orders
   * Checks Paystack status before marking cancelled or expired.
   * Never mutates destructively if Paystack status is unknown/network error.
   */
  static async reconcileStalePendingPayments(
    expiryMinutes: number = parseInt(process.env.PAYMENT_PENDING_EXPIRY_MINUTES || '30', 10),
    limit: number = 20
  ): Promise<{
    scanned: number;
    verifiedPaidCount: number;
    cancelledCount: number;
    expiredCount: number;
    unresolvedCount: number;
  }> {
    if (this.isReconcilingStalePending) {
      return { scanned: 0, verifiedPaidCount: 0, cancelledCount: 0, expiredCount: 0, unresolvedCount: 0 };
    }

    this.isReconcilingStalePending = true;
    let scanned = 0;
    let verifiedPaidCount = 0;
    let cancelledCount = 0;
    let expiredCount = 0;
    let unresolvedCount = 0;

    try {
      const now = new Date();
      const cutoffIso = new Date(now.getTime() - expiryMinutes * 60 * 1000).toISOString();
      const pool = getPool();
      let candidates: OrderRecord[] = [];

      if (pool) {
        const query = `
          SELECT * FROM orders
          WHERE status = 'pending_payment'
            AND payment_status = 'pending'
            AND paid_at IS NULL
            AND supplier_order_id IS NULL
            AND created_at <= $1
          ORDER BY created_at ASC
          LIMIT $2;
        `;
        const res = await pool.query(query, [cutoffIso, limit]);
        candidates = res.rows as OrderRecord[];
      } else {
        const cutoffTime = new Date(cutoffIso).getTime();
        const all = Array.from(devMemoryStore.values()).filter(
          (o, idx, arr) => arr.findIndex((x) => x.id === o.id) === idx
        );
        candidates = all
          .filter(
            (o) =>
              o.status === 'pending_payment' &&
              o.payment_status === 'pending' &&
              !o.paid_at &&
              !o.supplier_order_id &&
              new Date(o.created_at).getTime() <= cutoffTime
          )
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .slice(0, limit);
      }

      scanned = candidates.length;

      for (const order of candidates) {
        try {
          const txRes = await PaystackServerService.verifyTransaction(order.payment_reference);

          if (txRes.status === 'success') {
            const validationError = validateOrderPayment(order, txRes);
            if (validationError) {
              console.warn(`[Stale Reconciler] Rejected payment for ${order.public_reference}: ${validationError}`);
              unresolvedCount++;
              continue;
            }
            await FulfilmentService.processPaidOrder(
              order.payment_reference,
              txRes.paidAt || new Date().toISOString(),
              'Auto reconciler paid verification'
            );
            verifiedPaidCount++;
          } else if (txRes.status === 'abandoned' || txRes.status === 'failed') {
            await this.cancelOrder(order.id, 'paystack_abandoned_reconciled');
            cancelledCount++;
          } else if (txRes.status === 'pending') {
            await this.expireOrder(order.id, 'stale_pending_payment_expired');
            expiredCount++;
          } else {
            unresolvedCount++;
          }
        } catch (err) {
          console.warn(`[Stale Reconciler] Error reconciling order ${order.public_reference}:`, err);
          unresolvedCount++;
        }
      }
    } finally {
      this.isReconcilingStalePending = false;
    }

    return { scanned, verifiedPaidCount, cancelledCount, expiredCount, unresolvedCount };
  }

  /**
   * Get active supplier orders (submitted or processing) that require supplier reconciliation
   */
  static async getActiveSupplierOrders(limit: number = 50): Promise<OrderRecord[]> {
    const pool = getPool();
    if (pool) {
      const query = `
        SELECT * FROM orders
        WHERE (status IN ('submitted', 'processing') OR (status = 'queued' AND failure_reason = 'supplier_submission_uncertain'))
          AND supplier_order_id IS NOT NULL
          AND service_type IN ('data', 'airtime', 'instant_bundle')
        ORDER BY created_at DESC
        LIMIT $1;
      `;
      const res = await pool.query(query, [limit]);
      return res.rows as OrderRecord[];
    } else {
      const all = Array.from(devMemoryStore.values()).filter(
        (o, idx, arr) => arr.findIndex((x) => x.id === o.id) === idx
      );
      return all
        .filter(
          (o) =>
            (o.status === 'submitted' || o.status === 'processing' ||
              (o.status === 'queued' && o.failure_reason === 'supplier_submission_uncertain')) &&
            Boolean(o.supplier_order_id) &&
            ['data', 'airtime', 'instant_bundle'].includes(o.service_type || '')
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);
    }
  }

  /**
   * Admin: Safely purge unpaid test/abandoned payment attempts
   * Only deletes records where payment_status != 'success', paid_at IS NULL,
   * supplier_order_id IS NULL, submitted_at IS NULL, delivered_at IS NULL.
   */
  static async purgeUnpaidTestAttempts(): Promise<number> {
    const pool = getPool();
    if (pool) {
      const query = `
        DELETE FROM orders
        WHERE payment_status != 'success'
          AND paid_at IS NULL
          AND supplier_order_id IS NULL
          AND submitted_at IS NULL
          AND delivered_at IS NULL;
      `;
      const res = await pool.query(query);
      return res.rowCount || 0;
    } else {
      let count = 0;
      for (const [id, ord] of Array.from(devMemoryStore.entries())) {
        if (
          ord.payment_status !== 'success' &&
          !ord.paid_at &&
          !ord.supplier_order_id &&
          !ord.submitted_at &&
          !ord.delivered_at
        ) {
          devMemoryStore.delete(id);
          devMemoryStore.delete(`payref:${ord.payment_reference}`);
          devMemoryStore.delete(`pubref:${ord.public_reference}`);
          count++;
        }
      }
      return count;
    }
  }

  /**
   * Batch calculate order count and total paid pesewas for a list of user IDs
   * Eliminates N+1 database queries on admin user listing
   */
  static async getUserOrderAggregates(
    userIds: string[]
  ): Promise<Map<string, { orderCount: number; totalSpentMinor: number }>> {
    const map = new Map<string, { orderCount: number; totalSpentMinor: number }>();
    if (!userIds || userIds.length === 0) return map;

    for (const uid of userIds) {
      map.set(uid, { orderCount: 0, totalSpentMinor: 0 });
    }

    const pool = getPool();
    if (pool) {
      const query = `
        SELECT user_id, 
               COUNT(*)::int as order_count,
               COALESCE(SUM(CASE WHEN payment_status = 'success' THEN amount ELSE 0 END), 0)::bigint as total_spent_minor
        FROM orders
        WHERE user_id = ANY($1::text[])
        GROUP BY user_id;
      `;
      const res = await pool.query(query, [userIds]);
      for (const row of res.rows) {
        map.set(row.user_id, {
          orderCount: Number(row.order_count) || 0,
          totalSpentMinor: Number(row.total_spent_minor) || 0,
        });
      }
      return map;
    }

    // In-memory fallback
    const seenOrderIds = new Set<string>();
    for (const ord of devMemoryStore.values()) {
      if (ord.id && seenOrderIds.has(ord.id)) continue;
      if (ord.id) seenOrderIds.add(ord.id);

      if (ord.user_id && map.has(ord.user_id)) {
        const entry = map.get(ord.user_id)!;
        entry.orderCount += 1;
        if (ord.payment_status === 'success') {
          entry.totalSpentMinor += ord.amount;
        }
      }
    }

    return map;
  }

  /**
   * Find order by public_reference or payment_reference or id
   */
  static async findOrder(ref: string, client?: PoolClient): Promise<OrderRecord | null> {
    if (!ref) return null;

    const pool = client || getPool();
    if (pool) {
      const query = `
        SELECT * FROM orders
        WHERE public_reference = $1 OR payment_reference = $1 OR id = $1
        LIMIT 1 ${client ? 'FOR UPDATE' : ''};
      `;
      const result = await pool.query(query, [ref]);
      if (result.rows.length > 0) {
        return result.rows[0] as OrderRecord;
      }
      return null;
    } else {
      if (devMemoryStore.has(ref)) return devMemoryStore.get(ref)!;
      if (devMemoryStore.has(`payref:${ref}`)) return devMemoryStore.get(`payref:${ref}`)!;
      if (devMemoryStore.has(`pubref:${ref}`)) return devMemoryStore.get(`pubref:${ref}`)!;
      return null;
    }
  }

  /**
   * Find order by supplier_order_id
   */
  static async findOrderBySupplierOrderId(supplierOrderId: string, client?: PoolClient): Promise<OrderRecord | null> {
    if (!supplierOrderId) return null;

    const pool = client || getPool();
    if (pool) {
      const query = `
        SELECT * FROM orders
        WHERE supplier_order_id = $1
        LIMIT 1 ${client ? 'FOR UPDATE' : ''};
      `;
      const result = await pool.query(query, [supplierOrderId]);
      if (result.rows.length > 0) {
        return result.rows[0] as OrderRecord;
      }
      return null;
    } else {
      for (const order of devMemoryStore.values()) {
        if (order.supplier_order_id === supplierOrderId) {
          return order;
        }
      }
      return null;
    }
  }

  /**
   * Find active telecom supplier orders requiring status reconciliation
   * Excludes terminal statuses and Marketplace / manual orders
   */
  static async findActiveSupplierOrders(limit = 30): Promise<OrderRecord[]> {
    const pool = getPool();
    if (pool) {
      const query = `
        SELECT * FROM orders
        WHERE status IN ('submitted', 'processing')
          AND supplier_order_id IS NOT NULL
          AND (service_type IS NULL OR service_type IN ('data', 'airtime', 'instant_bundle'))
        ORDER BY supplier_last_checked_at ASC NULLS FIRST, created_at ASC
        LIMIT $1;
      `;
      const result = await pool.query(query, [limit]);
      return result.rows as OrderRecord[];
    } else {
      const active: OrderRecord[] = [];
      for (const order of devMemoryStore.values()) {
        if (
          order.supplier_order_id &&
          (order.status === 'submitted' || order.status === 'processing') &&
          (!order.service_type || ['data', 'airtime', 'instant_bundle'].includes(order.service_type))
        ) {
          active.push(order);
        }
      }
      active.sort((a, b) => {
        const tA = a.supplier_last_checked_at ? new Date(a.supplier_last_checked_at).getTime() : 0;
        const tB = b.supplier_last_checked_at ? new Date(b.supplier_last_checked_at).getTime() : 0;
        return tA - tB;
      });
      return active.slice(0, limit);
    }
  }

  /**
   * Idempotent transition to 'paid' status
   * Ensures duplicate webhooks/callbacks do NOT execute twice or overwrite
   */
  static async markOrderPaid(
    paymentReference: string,
    paidAtIso: string,
    supplierQueueNotice?: string
  ): Promise<{ order: OrderRecord | null; alreadyPaid: boolean }> {
    const pool = getPool();
    if (pool) {
      // The predicate is evaluated by PostgreSQL while locking the current row.
      // A duplicate confirmation cannot reset queued/submitted/terminal state.
      const result = await pool.query<OrderRecord>(`
        UPDATE orders SET status = CASE WHEN status = 'pending_payment' THEN 'paid' ELSE status END,
          manual_review = CASE WHEN status IN ('cancelled', 'expired') THEN TRUE ELSE manual_review END,
          payment_status = 'success',
          paid_at = $2, updated_at = $3, supplier_response = COALESCE($4, supplier_response)
        WHERE payment_reference = $1 AND status IN ('pending_payment', 'cancelled', 'expired')
          AND payment_status IN ('pending', 'cancelled', 'expired')
        RETURNING *;
      `, [paymentReference, paidAtIso, new Date().toISOString(), supplierQueueNotice || null]);
      if (result.rows[0]) return { order: result.rows[0], alreadyPaid: false };
      const current = await this.findOrder(paymentReference);
      return { order: current, alreadyPaid: current?.payment_status === 'success' };
    }
    const release = await acquireLock(`payment:${paymentReference}`);
    try {
      const existing = await this.findOrder(paymentReference);
      if (!existing) return { order: null, alreadyPaid: false };
      if (!['pending_payment', 'cancelled', 'expired'].includes(existing.status)
        || !['pending', 'cancelled', 'expired'].includes(existing.payment_status)) {
        return { order: existing, alreadyPaid: existing.payment_status === 'success' };
      }
      const updatedOrder: OrderRecord = {
        ...existing, status: existing.status === 'pending_payment' ? 'paid' : existing.status,
        manual_review: existing.status === 'pending_payment' ? existing.manual_review : true,
        payment_status: 'success', paid_at: paidAtIso,
        updated_at: new Date().toISOString(), supplier_response: supplierQueueNotice || existing.supplier_response,
      };
      devMemoryStore.set(existing.id, updatedOrder);
      devMemoryStore.set(`payref:${existing.payment_reference}`, updatedOrder);
      devMemoryStore.set(`pubref:${existing.public_reference}`, updatedOrder);
      return { order: updatedOrder, alreadyPaid: false };
    } finally {
      release();
    }
  }

  /**
   * Atomically claim order for supplier dispatch
   * Transitions 'paid' -> 'queued' ONLY.
   * If already claimed or not in 'paid' status, returns null.
   * Protects against concurrent Paystack webhook and verify requests.
   */
  static async claimOrderForSupplierDispatch(orderId: string): Promise<OrderRecord | null> {
    const nowIso = new Date().toISOString();
    const pool = getPool();

    if (pool) {
      const query = `
        UPDATE orders
        SET status = 'queued', updated_at = $1
        WHERE id = $2 AND status = 'paid' AND payment_status = 'success'
        RETURNING *;
      `;
      const result = await pool.query(query, [nowIso, orderId]);
      if (result.rows.length > 0) {
        return result.rows[0] as OrderRecord;
      }
      return null;
    } else {
      const release = await acquireLock(`claim:${orderId}`);
      try {
        const existing = await this.findOrder(orderId);
        if (!existing || existing.status !== 'paid' || existing.payment_status !== 'success') {
          return null;
        }
        const updated: OrderRecord = {
          ...existing,
          status: 'queued',
          updated_at: nowIso,
        };
        devMemoryStore.set(existing.id, updated);
        devMemoryStore.set(`payref:${existing.payment_reference}`, updated);
        devMemoryStore.set(`pubref:${existing.public_reference}`, updated);
        return updated;
      } finally {
        release();
      }
    }
  }

  /**
   * Save successful supplier submission
   */
  static async saveSupplierSubmission(
    orderId: string,
    supplierOrderId: string,
    supplierCostMinor: number | null,
    supplierOfferRef: string,
    submittedStatus: OrderStatus,
    rawSupplierResponse?: unknown
  ): Promise<OrderRecord | null> {
    const existing = await this.findOrder(orderId);
    if (!existing) return null;

    const nowIso = new Date().toISOString();
    const updated: OrderRecord = {
      ...existing,
      status: submittedStatus,
      supplier_provider: 'success_biz_hub',
      supplier_order_id: supplierOrderId,
      supplier_cost_minor: supplierCostMinor,
      supplier_offer_ref: supplierOfferRef,
      supplier_response: rawSupplierResponse ? JSON.stringify(rawSupplierResponse) : existing.supplier_response,
      submitted_at: nowIso,
      updated_at: nowIso,
      supplier_last_checked_at: nowIso,
      failure_reason: null,
    };

    if (!canAdvanceOrderStatus(existing.status, submittedStatus)) return existing;

    const pool = getPool();
    if (pool) {
      const query = `
        UPDATE orders
        SET status = $1, supplier_provider = $2, supplier_order_id = $3,
            supplier_cost_minor = $4, supplier_offer_ref = $5, supplier_response = $6,
            submitted_at = $7, updated_at = $8, supplier_last_checked_at = $9, failure_reason = NULL
        WHERE id = $10 AND status = $11
        RETURNING *;
      `;
      const result = await pool.query<OrderRecord>(query, [
        updated.status,
        updated.supplier_provider,
        updated.supplier_order_id,
        updated.supplier_cost_minor,
        updated.supplier_offer_ref,
        updated.supplier_response,
        updated.submitted_at,
        updated.updated_at,
        updated.supplier_last_checked_at,
        existing.id,
        existing.status,
      ]);
      if (!result.rows[0]) return this.saveSupplierSubmission(orderId, supplierOrderId, supplierCostMinor, supplierOfferRef, submittedStatus, rawSupplierResponse);
    } else {
      if (devMemoryStore.get(existing.id)?.status !== existing.status) {
        return this.saveSupplierSubmission(orderId, supplierOrderId, supplierCostMinor, supplierOfferRef, submittedStatus, rawSupplierResponse);
      }
      devMemoryStore.set(existing.id, updated);
      devMemoryStore.set(`payref:${existing.payment_reference}`, updated);
      devMemoryStore.set(`pubref:${existing.public_reference}`, updated);
    }

    // Mystery Earn: Trigger reward ledger generation on delivery
    if (updated.status === 'delivered') {
      try {
        await ReferralService.processOrderReward(updated);
      } catch (err) {
        console.warn('[OrdersStore] Failed to process referral reward on submission delivery:', err);
      }
    }

    return updated;
  }

  /**
   * Save uncertain supplier submission (e.g. network timeout where order may have reached supplier)
   * Does NOT mark failed or delivered. Retains queued/submitted for reconciliation.
   */
  static async saveSupplierUncertainSubmission(
    orderId: string,
    uncertaintyReason: string,
    rawErrorDetails?: unknown
  ): Promise<OrderRecord | null> {
    const existing = await this.findOrder(orderId);
    if (!existing) return null;
    if (!['paid', 'queued', 'submitted', 'processing'].includes(existing.status)) return existing;

    const nowIso = new Date().toISOString();
    const updated: OrderRecord = {
      ...existing,
      supplier_provider: 'success_biz_hub',
      failure_reason: 'supplier_submission_uncertain',
      manual_review: true,
      supplier_response: JSON.stringify({
        reason: uncertaintyReason,
        // Never persist an arbitrary provider error containing credentials/request details.
        isTimeout: true,
        timestamp: nowIso,
      }),
      updated_at: nowIso,
    };

    const pool = getPool();
    if (pool) {
      const query = `
        UPDATE orders
        SET supplier_provider = $1, failure_reason = $2, supplier_response = $3, updated_at = $4, manual_review = TRUE
        WHERE id = $5 AND status = $6
        RETURNING *;
      `;
      const result = await pool.query<OrderRecord>(query, [
        updated.supplier_provider,
        updated.failure_reason,
        updated.supplier_response,
        updated.updated_at,
        existing.id,
        existing.status,
      ]);
      if (!result.rows[0]) return this.saveSupplierUncertainSubmission(orderId, uncertaintyReason);
    } else {
      if (devMemoryStore.get(existing.id)?.status !== existing.status) return this.saveSupplierUncertainSubmission(orderId, uncertaintyReason);
      devMemoryStore.set(existing.id, updated);
      devMemoryStore.set(`payref:${existing.payment_reference}`, updated);
      devMemoryStore.set(`pubref:${existing.public_reference}`, updated);
    }

    return updated;
  }

  /**
   * Record and deduplicate supplier webhook event
   * Returns true if event is recorded for the first time, false if duplicate.
   */
  static async recordSupplierWebhookEvent(
    eventId: string,
    eventType: string,
    payload?: unknown,
    client?: PoolClient
  ): Promise<boolean> {
    if (!eventId) return true; // Can't deduplicate without ID

    const nowIso = new Date().toISOString();
    const pool = client || getPool();

    if (pool) {
      try {
        const query = `
          INSERT INTO supplier_webhook_events (event_id, event_type, payload, processed_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (event_id) DO NOTHING
          RETURNING event_id;
        `;
        const payloadStr = payload ? JSON.stringify(payload) : null;
        const result = await pool.query(query, [eventId, eventType, payloadStr, nowIso]);
        return result.rows.length > 0;
      } catch {
        throw new Error('Failed to persist supplier webhook completion.');
      }
    } else {
      if (devWebhookEventsStore.has(eventId)) {
        return false; // Duplicate
      }
      devWebhookEventsStore.add(eventId);
      return true;
    }
  }

  /** Atomically apply a supplier event and mark it complete, using the existing event table. */
  static async processSupplierWebhookEvent(
    eventId: string,
    eventType: string,
    payload: unknown,
    updates: Array<{ supplierOrderId: string; status: OrderStatus; failureReason?: string; response: string }>
  ): Promise<boolean> {
    const pool = getPool();
    const client = pool ? await pool.connect() : undefined;
    const release = client ? undefined : await acquireLock(`webhook:${eventId}`);
    const afterCommit: Array<() => Promise<void>> = [];
    try {
      if (client) {
        await client.query('BEGIN');
        // Serializes the same event across processes; order locks also protect different events.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0));', [`supplier-event:${eventId}`]);
        const existing = await client.query('SELECT event_id FROM supplier_webhook_events WHERE event_id = $1;', [eventId]);
        if (existing.rows.length) {
          await client.query('COMMIT');
          return false;
        }
      } else if (devWebhookEventsStore.has(eventId)) {
        return false;
      }

      // Stable lock order avoids deadlocks between grouped events with overlapping orders.
      for (const update of [...updates].sort((a, b) => a.supplierOrderId.localeCompare(b.supplierOrderId))) {
        const order = await this.findOrderBySupplierOrderId(update.supplierOrderId, client);
        // The webhook may precede persistence of the supplier ID. Let the provider retry.
        if (!order) throw new Error('Supplier webhook order is not yet available.');
        const updated = await this.updateOrderStatus(order.id, update.status, update.failureReason,
          update.supplierOrderId, update.response, { client, afterCommit });
        if (!updated) throw new Error('Supplier webhook order update failed.');
      }
      await this.recordSupplierWebhookEvent(eventId, eventType, payload, client);
      if (client) await client.query('COMMIT');
    } catch (err) {
      if (client) await client.query('ROLLBACK');
      // Memory fallback can retain completed items; monotonic transitions make retries safe.
      // Run effects for those items even when a later item failed.
      if (!client) for (const effect of afterCommit) await effect();
      throw err;
    } finally {
      client?.release();
      release?.();
    }
    for (const effect of afterCommit) await effect();
    return true;
  }

  static async getUncertainSupplierSubmissionCount(): Promise<number> {
    const pool = getPool();
    if (pool) {
      const result = await pool.query<{ count: string }>(`
        SELECT COUNT(*) AS count FROM orders WHERE failure_reason = 'supplier_submission_uncertain'
          AND status IN ('paid', 'queued', 'submitted', 'processing');
      `);
      return Number(result.rows[0]?.count || 0);
    }
    return new Set([...devMemoryStore.values()].filter(o => o.failure_reason === 'supplier_submission_uncertain'
      && ['paid', 'queued', 'submitted', 'processing'].includes(o.status)).map(o => o.id)).size;
  }

  /** Update order status with an atomic compare-and-set and forward transition guard. */
  static async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    failureReason?: string,
    supplierOrderId?: string,
    supplierResponse?: string,
    options: { client?: PoolClient; explicitReversal?: boolean; afterCommit?: Array<() => Promise<void>> } = {}
  ): Promise<OrderRecord | null> {
    const existing = await this.findOrder(orderId, options.client);
    if (!existing) return null;
    const sameStateMetadataChange = existing.status === status && (
      (failureReason !== undefined && failureReason !== existing.failure_reason) ||
      (supplierOrderId !== undefined && supplierOrderId !== existing.supplier_order_id) ||
      (supplierResponse !== undefined && supplierResponse !== existing.supplier_response)
    );
    if (!sameStateMetadataChange && !canAdvanceOrderStatus(existing.status, status, options.explicitReversal)) return existing;

    const nowIso = new Date().toISOString();
    const updated: OrderRecord = {
      ...existing,
      status,
      failure_reason: failureReason !== undefined ? failureReason : existing.failure_reason,
      supplier_order_id: supplierOrderId || existing.supplier_order_id,
      supplier_response: supplierResponse !== undefined ? supplierResponse : existing.supplier_response,
      delivered_at: status === 'delivered' ? (existing.delivered_at || nowIso) : existing.delivered_at,
      updated_at: nowIso,
      supplier_last_checked_at: nowIso,
    };

    const pool = options.client || getPool();
    if (pool) {
      const query = `
        UPDATE orders
        SET status = $1, failure_reason = $2, supplier_order_id = $3,
            supplier_response = $4, delivered_at = $5, updated_at = $6,
            supplier_last_checked_at = $7
        WHERE id = $8 AND status = $9
        RETURNING *;
      `;
      const result = await pool.query<OrderRecord>(query, [
        updated.status,
        updated.failure_reason,
        updated.supplier_order_id,
        updated.supplier_response,
        updated.delivered_at,
        updated.updated_at,
        updated.supplier_last_checked_at,
        existing.id,
        existing.status,
      ]);
      if (!result.rows[0]) return this.updateOrderStatus(orderId, status, failureReason, supplierOrderId, supplierResponse, options);
    } else {
      if (devMemoryStore.get(existing.id)?.status !== existing.status) {
        return this.updateOrderStatus(orderId, status, failureReason, supplierOrderId, supplierResponse, options);
      }
      devMemoryStore.set(existing.id, updated);
      devMemoryStore.set(`payref:${existing.payment_reference}`, updated);
      devMemoryStore.set(`pubref:${existing.public_reference}`, updated);
    }

    const rewardEffect = async () => {
      // Preserve existing reward effects, but execute webhook effects only after commit.
      if (updated.status === 'delivered' && existing.status !== 'delivered') {
        try {
          await ReferralService.processOrderReward(updated);
        } catch (err) {
          console.warn('[OrdersStore] Failed to process referral reward on status delivery:', err);
        }
      } else if (
        existing.status === 'delivered' &&
        ['failed', 'refund_pending', 'refunded', 'cancelled'].includes(status)
      ) {
        try {
          await ReferralService.reverseOrderRewards(
            orderId,
            failureReason || 'Order status transitioned from delivered to non-delivered'
          );
        } catch (err) {
          console.warn('[OrdersStore] Failed to reverse referral reward:', err);
        }
      }
    };
    if (options.afterCommit) options.afterCommit.push(rewardEffect);
    else await rewardEffect();

    return updated;
  }

  /**
   * Admin: Terminalize a pre-launch/test order safely
   * Sets status to 'failed', records the administrative failure reason,
   * updates updated_at, and preserves all accounting and transaction data.
   */
  static async closeAsTestOrder(
    orderId: string,
    failureReason: string
  ): Promise<OrderRecord | null> {
    const existing = await this.findOrder(orderId);
    if (!existing) return null;

    const nowIso = new Date().toISOString();
    const updated: OrderRecord = {
      ...existing,
      status: 'failed',
      failure_reason: failureReason,
      updated_at: nowIso,
    };

    const pool = getPool();
    if (pool) {
      const query = `
        UPDATE orders
        SET status = $1, failure_reason = $2, updated_at = $3
        WHERE id = $4;
      `;
      await pool.query(query, [
        updated.status,
        updated.failure_reason,
        updated.updated_at,
        existing.id,
      ]);
    } else {
      devMemoryStore.set(existing.id, updated);
      devMemoryStore.set(`payref:${existing.payment_reference}`, updated);
      devMemoryStore.set(`pubref:${existing.public_reference}`, updated);
    }

    return updated;
  }

  /**
   * Admin: Update manual review flag and internal admin note
   */
  static async updateOrderReview(
    orderId: string,
    manualReview?: boolean,
    adminNote?: string | null
  ): Promise<OrderRecord | null> {
    const existing = await this.findOrder(orderId);
    if (!existing) return null;

    const nowIso = new Date().toISOString();
    const updated: OrderRecord = {
      ...existing,
      manual_review: manualReview !== undefined ? manualReview : Boolean(existing.manual_review),
      admin_note: adminNote !== undefined ? adminNote : existing.admin_note,
      updated_at: nowIso,
    };

    const pool = getPool();
    if (pool) {
      const query = `
        UPDATE orders
        SET manual_review = $1, admin_note = $2, updated_at = $3
        WHERE id = $4;
      `;
      await pool.query(query, [
        updated.manual_review,
        updated.admin_note,
        updated.updated_at,
        existing.id,
      ]);
    } else {
      devMemoryStore.set(existing.id, updated);
      devMemoryStore.set(`payref:${existing.payment_reference}`, updated);
      devMemoryStore.set(`pubref:${existing.public_reference}`, updated);
    }

    return updated;
  }

  /**
   * Admin: Search, filter, and paginate orders
   */
  static async searchOrdersAdmin(params: {
    q?: string;
    serviceType?: string;
    network?: string;
    status?: string;
    paymentStatus?: string;
    manualReview?: boolean;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{ orders: OrderRecord[]; total: number; totalPages: number; page: number; limit: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 25));
    const offset = (page - 1) * limit;

    const pool = getPool();
    if (pool) {
      const conditions: string[] = [];
      const values: unknown[] = [];
      let valIdx = 1;

      if (params.q && params.q.trim()) {
        const cleanQ = `%${params.q.trim()}%`;
        conditions.push(`(
          public_reference ILIKE $${valIdx} OR 
          recipient_phone ILIKE $${valIdx} OR 
          customer_phone ILIKE $${valIdx} OR 
          customer_email ILIKE $${valIdx} OR 
          payment_reference ILIKE $${valIdx} OR
          supplier_order_id ILIKE $${valIdx} OR
          customer_name ILIKE $${valIdx}
        )`);
        values.push(cleanQ);
        valIdx++;
      }

      if (params.serviceType) {
        conditions.push(`service_type = $${valIdx}`);
        values.push(params.serviceType);
        valIdx++;
      }

      if (params.network) {
        conditions.push(`network = $${valIdx}`);
        values.push(params.network.toLowerCase());
        valIdx++;
      }

      if (params.status === 'needs_attention') {
        conditions.push(`(manual_review = TRUE OR (failure_reason = 'supplier_submission_uncertain' AND status IN ('paid', 'queued', 'submitted', 'processing')) OR status = 'refund_pending' OR (payment_status = 'success' AND status = 'failed')) AND (failure_reason IS NULL OR (LOWER(failure_reason) NOT LIKE 'prelaunch%' AND LOWER(failure_reason) NOT LIKE 'pre-launch%'))`);
      } else if (params.status === 'abandoned') {
        conditions.push(`status IN ('cancelled', 'expired')`);
      } else if (params.status === 'all') {
        // No status filter
      } else if (params.status && params.status !== 'operational') {
        conditions.push(`status = $${valIdx}`);
        values.push(params.status);
        valIdx++;
      } else {
        // Default 'operational' view: exclude cancelled, expired, and initialization failures
        conditions.push(`status NOT IN ('cancelled', 'expired') AND (failure_reason IS NULL OR failure_reason NOT LIKE 'paystack_initialization_%')`);
      }

      if (params.paymentStatus) {
        conditions.push(`payment_status = $${valIdx}`);
        values.push(params.paymentStatus);
        valIdx++;
      }

      if (params.manualReview !== undefined) {
        conditions.push(`manual_review = $${valIdx}`);
        values.push(params.manualReview);
        valIdx++;
      }

      if (params.dateFrom) {
        conditions.push(`created_at >= $${valIdx}`);
        values.push(params.dateFrom);
        valIdx++;
      }

      if (params.dateTo) {
        conditions.push(`created_at <= $${valIdx}`);
        values.push(params.dateTo);
        valIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await pool.query(`SELECT COUNT(*) as total FROM orders ${whereClause};`, values);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const query = `
        SELECT * FROM orders 
        ${whereClause} 
        ORDER BY created_at DESC 
        LIMIT $${valIdx} OFFSET $${valIdx + 1};
      `;
      values.push(limit, offset);

      const res = await pool.query(query, values);
      const orders = res.rows as OrderRecord[];
      const totalPages = Math.ceil(total / limit) || 1;

      return { orders, total, totalPages, page, limit };
    }

    // In-memory fallback
    let all = Array.from(devMemoryStore.values()).filter((ord, idx, arr) => arr.findIndex((x) => x.id === ord.id) === idx);

    if (params.q && params.q.trim()) {
      const qLower = params.q.trim().toLowerCase();
      all = all.filter(
        (o) =>
          o.public_reference.toLowerCase().includes(qLower) ||
          o.recipient_phone.toLowerCase().includes(qLower) ||
          o.customer_phone.toLowerCase().includes(qLower) ||
          o.customer_email.toLowerCase().includes(qLower) ||
          o.payment_reference.toLowerCase().includes(qLower) ||
          (o.supplier_order_id && o.supplier_order_id.toLowerCase().includes(qLower)) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(qLower))
      );
    }

    if (params.serviceType) {
      all = all.filter((o) => (o.service_type || 'data') === params.serviceType);
    }

    if (params.network) {
      all = all.filter((o) => o.network.toLowerCase() === params.network!.toLowerCase());
    }

    if (params.status === 'needs_attention') {
      all = all.filter(
        (o) =>
          (Boolean(o.manual_review) ||
            (o.failure_reason === 'supplier_submission_uncertain' && ['paid', 'queued', 'submitted', 'processing'].includes(o.status)) ||
            o.status === 'refund_pending' ||
            (o.payment_status === 'success' && o.status === 'failed')) &&
          (!o.failure_reason || (!o.failure_reason.toLowerCase().startsWith('prelaunch') && !o.failure_reason.toLowerCase().startsWith('pre-launch')))
      );
    } else if (params.status === 'abandoned') {
      all = all.filter((o) => o.status === 'cancelled' || o.status === 'expired');
    } else if (params.status === 'all') {
      // Keep all
    } else if (params.status && params.status !== 'operational') {
      all = all.filter((o) => o.status === params.status);
    } else {
      // Default 'operational' view: exclude cancelled, expired, and initialization failures
      all = all.filter(
        (o) =>
          o.status !== 'cancelled' &&
          o.status !== 'expired' &&
          (!o.failure_reason || !o.failure_reason.startsWith('paystack_initialization_'))
      );
    }

    if (params.paymentStatus) {
      all = all.filter((o) => o.payment_status === params.paymentStatus);
    }

    if (params.manualReview !== undefined) {
      all = all.filter((o) => Boolean(o.manual_review) === params.manualReview);
    }

    if (params.dateFrom) {
      all = all.filter((o) => new Date(o.created_at) >= new Date(params.dateFrom!));
    }

    if (params.dateTo) {
      all = all.filter((o) => new Date(o.created_at) <= new Date(params.dateTo!));
    }

    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = all.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const orders = all.slice(offset, offset + limit);

    return { orders, total, totalPages, page, limit };
  }

  /**
   * Admin: Compute launch overview metrics
   */
  static async getOverviewMetrics(): Promise<{
    today: {
      ordersCount: number;
      revenueMinor: number;
      revenueGhc: number;
      deliveredCount: number;
      processingCount: number;
      attentionCount: number;
    };
    last7Days: {
      ordersCount: number;
      revenueMinor: number;
      revenueGhc: number;
      dataOrdersCount: number;
      airtimeOrdersCount: number;
    };
    allTime: {
      ordersCount: number;
      revenueMinor: number;
      revenueGhc: number;
      supplierCostMinor: number;
      supplierCostGhc: number;
      estimatedGrossMarginGhc: number | null;
      manualReviewPendingCount: number;
    };
  }> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const pool = getPool();
    if (pool) {
      const res = await pool.query(`
        SELECT 
          COUNT(CASE WHEN payment_status = 'success' THEN 1 END) as total_orders,
          COALESCE(SUM(CASE WHEN payment_status = 'success' THEN amount ELSE 0 END), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN payment_status = 'success' AND (supplier_order_id IS NOT NULL OR submitted_at IS NOT NULL OR status IN ('submitted', 'processing', 'delivered', 'refund_pending', 'refunded')) THEN supplier_cost_minor ELSE 0 END), 0) as total_cost,
          COUNT(CASE WHEN (manual_review = TRUE OR (failure_reason = 'supplier_submission_uncertain' AND status IN ('paid', 'queued', 'submitted', 'processing')) OR status = 'refund_pending' OR (payment_status = 'success' AND status = 'failed')) AND (failure_reason IS NULL OR (LOWER(failure_reason) NOT LIKE 'prelaunch%' AND LOWER(failure_reason) NOT LIKE 'pre-launch%')) THEN 1 END) as manual_reviews,
          
          -- Today
          COUNT(CASE WHEN created_at >= $1 AND payment_status = 'success' THEN 1 END) as today_orders,
          COALESCE(SUM(CASE WHEN created_at >= $1 AND payment_status = 'success' THEN amount ELSE 0 END), 0) as today_revenue,
          COUNT(CASE WHEN created_at >= $1 AND status = 'delivered' THEN 1 END) as today_delivered,
          COUNT(CASE WHEN created_at >= $1 AND status IN ('processing', 'submitted', 'queued') THEN 1 END) as today_processing,
          COUNT(CASE WHEN created_at >= $1 AND (manual_review = TRUE OR (failure_reason = 'supplier_submission_uncertain' AND status IN ('paid', 'queued', 'submitted', 'processing')) OR status = 'refund_pending' OR (payment_status = 'success' AND status = 'failed')) AND (failure_reason IS NULL OR (LOWER(failure_reason) NOT LIKE 'prelaunch%' AND LOWER(failure_reason) NOT LIKE 'pre-launch%')) THEN 1 END) as today_attention,

          -- Last 7 Days
          COUNT(CASE WHEN created_at >= $2 AND payment_status = 'success' THEN 1 END) as last7_orders,
          COALESCE(SUM(CASE WHEN created_at >= $2 AND payment_status = 'success' THEN amount ELSE 0 END), 0) as last7_revenue,
          COUNT(CASE WHEN created_at >= $2 AND payment_status = 'success' AND (service_type = 'data' OR service_type IS NULL) THEN 1 END) as last7_data,
          COUNT(CASE WHEN created_at >= $2 AND payment_status = 'success' AND service_type = 'airtime' THEN 1 END) as last7_airtime
        FROM orders;
      `, [startOfToday, sevenDaysAgo]);

      const row = res.rows[0] || {};
      const totalRev = parseInt(row.total_revenue || '0', 10);
      const totalCost = parseInt(row.total_cost || '0', 10);
      const todayRev = parseInt(row.today_revenue || '0', 10);
      const last7Rev = parseInt(row.last7_revenue || '0', 10);

      const marginGhc = totalRev > 0 ? Number(((totalRev - totalCost) / 100).toFixed(2)) : null;

      return {
        today: {
          ordersCount: parseInt(row.today_orders || '0', 10),
          revenueMinor: todayRev,
          revenueGhc: Number((todayRev / 100).toFixed(2)),
          deliveredCount: parseInt(row.today_delivered || '0', 10),
          processingCount: parseInt(row.today_processing || '0', 10),
          attentionCount: parseInt(row.today_attention || '0', 10),
        },
        last7Days: {
          ordersCount: parseInt(row.last7_orders || '0', 10),
          revenueMinor: last7Rev,
          revenueGhc: Number((last7Rev / 100).toFixed(2)),
          dataOrdersCount: parseInt(row.last7_data || '0', 10),
          airtimeOrdersCount: parseInt(row.last7_airtime || '0', 10),
        },
        allTime: {
          ordersCount: parseInt(row.total_orders || '0', 10),
          revenueMinor: totalRev,
          revenueGhc: Number((totalRev / 100).toFixed(2)),
          supplierCostMinor: totalCost,
          supplierCostGhc: Number((totalCost / 100).toFixed(2)),
          estimatedGrossMarginGhc: marginGhc,
          manualReviewPendingCount: parseInt(row.manual_reviews || '0', 10),
        },
      };
    }

    // In-memory fallback calculation
    const all = Array.from(devMemoryStore.values()).filter((ord, idx, arr) => arr.findIndex((x) => x.id === ord.id) === idx);
    const paidAll = all.filter((o) => o.payment_status === 'success');

    const todayPaid = paidAll.filter((o) => new Date(o.created_at) >= new Date(startOfToday));
    const last7Paid = paidAll.filter((o) => new Date(o.created_at) >= new Date(sevenDaysAgo));

    const todayRevMinor = todayPaid.reduce((sum, o) => sum + o.amount, 0);
    const last7RevMinor = last7Paid.reduce((sum, o) => sum + o.amount, 0);
    const totalRevMinor = paidAll.reduce((sum, o) => sum + o.amount, 0);
    const totalCostMinor = paidAll
      .filter((o) => o.supplier_order_id || o.submitted_at || ['submitted', 'processing', 'delivered', 'refund_pending', 'refunded'].includes(o.status))
      .reduce((sum, o) => sum + (o.supplier_cost_minor || 0), 0);

    const isActionableAttention = (o: OrderRecord) =>
      (Boolean(o.manual_review) ||
        (o.failure_reason === 'supplier_submission_uncertain' && ['paid', 'queued', 'submitted', 'processing'].includes(o.status)) ||
        o.status === 'refund_pending' ||
        (o.payment_status === 'success' && o.status === 'failed')) &&
      (!o.failure_reason || (!o.failure_reason.toLowerCase().startsWith('prelaunch') && !o.failure_reason.toLowerCase().startsWith('pre-launch')));

    return {
      today: {
        ordersCount: todayPaid.length,
        revenueMinor: todayRevMinor,
        revenueGhc: Number((todayRevMinor / 100).toFixed(2)),
        deliveredCount: all.filter((o) => new Date(o.created_at) >= new Date(startOfToday) && o.status === 'delivered').length,
        processingCount: all.filter((o) => new Date(o.created_at) >= new Date(startOfToday) && ['processing', 'submitted', 'queued'].includes(o.status)).length,
        attentionCount: all.filter((o) => new Date(o.created_at) >= new Date(startOfToday) && isActionableAttention(o)).length,
      },
      last7Days: {
        ordersCount: last7Paid.length,
        revenueMinor: last7RevMinor,
        revenueGhc: Number((last7RevMinor / 100).toFixed(2)),
        dataOrdersCount: last7Paid.filter((o) => (o.service_type || 'data') === 'data').length,
        airtimeOrdersCount: last7Paid.filter((o) => o.service_type === 'airtime').length,
      },
      allTime: {
        ordersCount: paidAll.length,
        revenueMinor: totalRevMinor,
        revenueGhc: Number((totalRevMinor / 100).toFixed(2)),
        supplierCostMinor: totalCostMinor,
        supplierCostGhc: Number((totalCostMinor / 100).toFixed(2)),
        estimatedGrossMarginGhc: totalRevMinor > 0 ? Number(((totalRevMinor - totalCostMinor) / 100).toFixed(2)) : null,
        manualReviewPendingCount: all.filter(isActionableAttention).length,
      },
    };
  }
}
