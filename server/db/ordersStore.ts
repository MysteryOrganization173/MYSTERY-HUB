/**
 * Database Orders Store
 * Production-ready PostgreSQL database abstraction with safe fallback
 * for local development environments.
 */

import pg from 'pg';
import { OrderRecord, OrderStatus } from '../types/orders.js';
import {
  getGhanaPhoneLookupVariants,
  canonicalGhanaPhone,
  areGhanaPhonesEqual,
} from '../utils/phone.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    });
    console.log('PostgreSQL database pool initialized.');
  } catch (err) {
    console.warn('Failed to initialize PostgreSQL pool, using development store fallback:', err);
    pool = null;
  }
}

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
    if (!pool) return;
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id VARCHAR(64) PRIMARY KEY,
          public_reference VARCHAR(64) UNIQUE NOT NULL,
          customer_name VARCHAR(128),
          customer_email VARCHAR(128) NOT NULL,
          customer_phone VARCHAR(32) NOT NULL,
          recipient_phone VARCHAR(32) NOT NULL,
          network VARCHAR(32) NOT NULL,
          product_id VARCHAR(64) NOT NULL,
          product_name_snapshot VARCHAR(128) NOT NULL,
          bundle_size_snapshot VARCHAR(64) NOT NULL,
          amount INTEGER NOT NULL,
          currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
          status VARCHAR(32) NOT NULL DEFAULT 'pending_payment',
          payment_provider VARCHAR(32) NOT NULL DEFAULT 'paystack',
          payment_reference VARCHAR(128) UNIQUE NOT NULL,
          payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
          supplier_provider VARCHAR(64),
          supplier_order_id VARCHAR(128),
          supplier_response TEXT,
          supplier_cost_minor INTEGER,
          supplier_offer_ref VARCHAR(128),
          supplier_last_checked_at VARCHAR(64),
          failure_reason TEXT,
          created_at VARCHAR(64) NOT NULL,
          updated_at VARCHAR(64) NOT NULL,
          paid_at VARCHAR(64),
          submitted_at VARCHAR(64),
          delivered_at VARCHAR(64)
        );

        -- Safe non-destructive column additions
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_cost_minor INTEGER;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_offer_ref VARCHAR(128);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_last_checked_at VARCHAR(64);

        -- Supplier webhook idempotency table
        CREATE TABLE IF NOT EXISTS supplier_webhook_events (
          event_id VARCHAR(128) PRIMARY KEY,
          event_type VARCHAR(64) NOT NULL,
          payload TEXT,
          processed_at VARCHAR(64) NOT NULL
        );

        -- Active MTN recipient lock index (enforces at most one active MTN order per recipient at DB level)
        CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_active_mtn_recipient 
        ON orders (recipient_phone) 
        WHERE network = 'mtn' AND status IN ('paid', 'queued', 'submitted', 'processing', 'refund_pending');
      `);
    } catch (err) {
      console.warn('Error running initDb table check:', err);
    } finally {
      client.release();
    }
  }

  /**
   * Find any existing active/blocking order for an MTN recipient
   * Blocking statuses: paid, queued, submitted, processing, refund_pending
   */
  static async findActiveMtnOrder(recipientPhone: string): Promise<OrderRecord | null> {
    const variants = getGhanaPhoneLookupVariants(recipientPhone);
    if (variants.length === 0) return null;

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
            id, public_reference, customer_name, customer_email, customer_phone,
            recipient_phone, network, product_id, product_name_snapshot,
            bundle_size_snapshot, amount, currency, status, payment_provider,
            payment_reference, payment_status, supplier_provider, supplier_order_id,
            supplier_response, supplier_cost_minor, supplier_offer_ref,
            supplier_last_checked_at, failure_reason, created_at, updated_at,
            paid_at, submitted_at, delivered_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
          ) RETURNING *;
        `;
        const values = [
          order.id,
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
   * Create a new pending order atomically
   */
  static async createOrder(order: OrderRecord): Promise<OrderRecord> {
    if (pool) {
      const query = `
        INSERT INTO orders (
          id, public_reference, customer_name, customer_email, customer_phone,
          recipient_phone, network, product_id, product_name_snapshot,
          bundle_size_snapshot, amount, currency, status, payment_provider,
          payment_reference, payment_status, supplier_provider, supplier_order_id,
          supplier_response, supplier_cost_minor, supplier_offer_ref,
          supplier_last_checked_at, failure_reason, created_at, updated_at,
          paid_at, submitted_at, delivered_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
        ) RETURNING *;
      `;
      const values = [
        order.id,
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
   * Find order by public_reference or payment_reference or id
   */
  static async findOrder(ref: string): Promise<OrderRecord | null> {
    if (!ref) return null;

    if (pool) {
      const query = `
        SELECT * FROM orders
        WHERE public_reference = $1 OR payment_reference = $1 OR id = $1
        LIMIT 1;
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
  static async findOrderBySupplierOrderId(supplierOrderId: string): Promise<OrderRecord | null> {
    if (!supplierOrderId) return null;

    if (pool) {
      const query = `
        SELECT * FROM orders
        WHERE supplier_order_id = $1
        LIMIT 1;
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
   * Idempotent transition to 'paid' status
   * Ensures duplicate webhooks/callbacks do NOT execute twice or overwrite
   */
  static async markOrderPaid(
    paymentReference: string,
    paidAtIso: string,
    supplierQueueNotice?: string
  ): Promise<{ order: OrderRecord | null; alreadyPaid: boolean }> {
    const existing = await this.findOrder(paymentReference);
    if (!existing) {
      return { order: null, alreadyPaid: false };
    }

    if (existing.status !== 'pending_payment' && existing.payment_status === 'success') {
      return { order: existing, alreadyPaid: true };
    }

    const updatedStatus: OrderStatus = 'paid';
    const updatedOrder: OrderRecord = {
      ...existing,
      status: updatedStatus,
      payment_status: 'success',
      paid_at: paidAtIso,
      updated_at: new Date().toISOString(),
      supplier_response: supplierQueueNotice || existing.supplier_response,
    };

    if (pool) {
      const query = `
        UPDATE orders
        SET status = $1, payment_status = $2, paid_at = $3, updated_at = $4, supplier_response = $5
        WHERE id = $6;
      `;
      await pool.query(query, [
        updatedOrder.status,
        updatedOrder.payment_status,
        updatedOrder.paid_at,
        updatedOrder.updated_at,
        updatedOrder.supplier_response,
        existing.id,
      ]);
    } else {
      devMemoryStore.set(existing.id, updatedOrder);
      devMemoryStore.set(`payref:${existing.payment_reference}`, updatedOrder);
      devMemoryStore.set(`pubref:${existing.public_reference}`, updatedOrder);
    }

    return { order: updatedOrder, alreadyPaid: false };
  }

  /**
   * Atomically claim order for supplier dispatch
   * Transitions 'paid' -> 'queued' ONLY.
   * If already claimed or not in 'paid' status, returns null.
   * Protects against concurrent Paystack webhook and verify requests.
   */
  static async claimOrderForSupplierDispatch(orderId: string): Promise<OrderRecord | null> {
    const nowIso = new Date().toISOString();

    if (pool) {
      const query = `
        UPDATE orders
        SET status = 'queued', updated_at = $1
        WHERE id = $2 AND status = 'paid'
        RETURNING *;
      `;
      const result = await pool.query(query, [nowIso, orderId]);
      if (result.rows.length > 0) {
        return result.rows[0] as OrderRecord;
      }
      return null;
    } else {
      const existing = await this.findOrder(orderId);
      if (!existing || existing.status !== 'paid') {
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
    }
  }

  /**
   * Save successful supplier submission
   */
  static async saveSupplierSubmission(
    orderId: string,
    supplierOrderId: string,
    supplierCostMinor: number,
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

    if (pool) {
      const query = `
        UPDATE orders
        SET status = $1, supplier_provider = $2, supplier_order_id = $3,
            supplier_cost_minor = $4, supplier_offer_ref = $5, supplier_response = $6,
            submitted_at = $7, updated_at = $8, supplier_last_checked_at = $9, failure_reason = NULL
        WHERE id = $10;
      `;
      await pool.query(query, [
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
      ]);
    } else {
      devMemoryStore.set(existing.id, updated);
      devMemoryStore.set(`payref:${existing.payment_reference}`, updated);
      devMemoryStore.set(`pubref:${existing.public_reference}`, updated);
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

    const nowIso = new Date().toISOString();
    const updated: OrderRecord = {
      ...existing,
      supplier_provider: 'success_biz_hub',
      failure_reason: 'supplier_submission_uncertain',
      supplier_response: JSON.stringify({
        reason: uncertaintyReason,
        error: rawErrorDetails,
        timestamp: nowIso,
      }),
      updated_at: nowIso,
    };

    if (pool) {
      const query = `
        UPDATE orders
        SET supplier_provider = $1, failure_reason = $2, supplier_response = $3, updated_at = $4
        WHERE id = $5;
      `;
      await pool.query(query, [
        updated.supplier_provider,
        updated.failure_reason,
        updated.supplier_response,
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
   * Record and deduplicate supplier webhook event
   * Returns true if event is recorded for the first time, false if duplicate.
   */
  static async recordSupplierWebhookEvent(
    eventId: string,
    eventType: string,
    payload?: unknown
  ): Promise<boolean> {
    if (!eventId) return true; // Can't deduplicate without ID

    const nowIso = new Date().toISOString();

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
      } catch (err) {
        console.warn('Error recording supplier webhook event:', err);
        return false;
      }
    } else {
      if (devWebhookEventsStore.has(eventId)) {
        return false; // Duplicate
      }
      devWebhookEventsStore.add(eventId);
      return true;
    }
  }

  /**
   * Update arbitrary order status or failure reason safely
   */
  static async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    failureReason?: string,
    supplierOrderId?: string,
    supplierResponse?: string
  ): Promise<OrderRecord | null> {
    const existing = await this.findOrder(orderId);
    if (!existing) return null;

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

    if (pool) {
      const query = `
        UPDATE orders
        SET status = $1, failure_reason = $2, supplier_order_id = $3,
            supplier_response = $4, delivered_at = $5, updated_at = $6,
            supplier_last_checked_at = $7
        WHERE id = $8;
      `;
      await pool.query(query, [
        updated.status,
        updated.failure_reason,
        updated.supplier_order_id,
        updated.supplier_response,
        updated.delivered_at,
        updated.updated_at,
        updated.supplier_last_checked_at,
        existing.id,
      ]);
    } else {
      devMemoryStore.set(existing.id, updated);
      devMemoryStore.set(`payref:${existing.payment_reference}`, updated);
      devMemoryStore.set(`pubref:${existing.public_reference}`, updated);
    }

    return updated;
  }
}
