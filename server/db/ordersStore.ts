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
            paid_at, submitted_at, delivered_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
            $27, $28, $29, $30, $31, $32
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
          paid_at, submitted_at, delivered_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
          $27, $28, $29, $30, $31, $32
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
   * Find orders belonging to a specific authenticated user
   */
  static async findOrdersByUserId(userId: string): Promise<OrderRecord[]> {
    if (!userId) return [];
    const pool = getPool();
    if (pool) {
      const query = `
        SELECT * FROM orders 
        WHERE user_id = $1 
        ORDER BY created_at DESC;
      `;
      const res = await pool.query(query, [userId]);
      return res.rows as OrderRecord[];
    }

    const results: OrderRecord[] = [];
    for (const ord of devMemoryStore.values()) {
      if (ord.user_id === userId && !results.some((r) => r.id === ord.id)) {
        results.push(ord);
      }
    }
    return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
  static async findOrder(ref: string): Promise<OrderRecord | null> {
    if (!ref) return null;

    const pool = getPool();
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

    const pool = getPool();
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

    const pool = getPool();
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
    const pool = getPool();

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

    const pool = getPool();
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

    const pool = getPool();
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
    const pool = getPool();

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

    const pool = getPool();
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

      if (params.status) {
        conditions.push(`status = $${valIdx}`);
        values.push(params.status);
        valIdx++;
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

    if (params.status) {
      all = all.filter((o) => o.status === params.status);
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
          COUNT(*) as total_orders,
          COALESCE(SUM(CASE WHEN payment_status = 'success' THEN amount ELSE 0 END), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN supplier_cost_minor IS NOT NULL THEN supplier_cost_minor ELSE 0 END), 0) as total_cost,
          COUNT(CASE WHEN manual_review = TRUE THEN 1 END) as manual_reviews,
          
          -- Today
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as today_orders,
          COALESCE(SUM(CASE WHEN created_at >= $1 AND payment_status = 'success' THEN amount ELSE 0 END), 0) as today_revenue,
          COUNT(CASE WHEN created_at >= $1 AND status = 'delivered' THEN 1 END) as today_delivered,
          COUNT(CASE WHEN created_at >= $1 AND status IN ('processing', 'submitted', 'queued') THEN 1 END) as today_processing,
          COUNT(CASE WHEN created_at >= $1 AND status IN ('failed', 'refund_pending', 'refunded') THEN 1 END) as today_attention,

          -- Last 7 Days
          COUNT(CASE WHEN created_at >= $2 THEN 1 END) as last7_orders,
          COALESCE(SUM(CASE WHEN created_at >= $2 AND payment_status = 'success' THEN amount ELSE 0 END), 0) as last7_revenue,
          COUNT(CASE WHEN created_at >= $2 AND (service_type = 'data' OR service_type IS NULL) THEN 1 END) as last7_data,
          COUNT(CASE WHEN created_at >= $2 AND service_type = 'airtime' THEN 1 END) as last7_airtime
        FROM orders;
      `, [startOfToday, sevenDaysAgo]);

      const row = res.rows[0] || {};
      const totalRev = parseInt(row.total_revenue || '0', 10);
      const totalCost = parseInt(row.total_cost || '0', 10);
      const todayRev = parseInt(row.today_revenue || '0', 10);
      const last7Rev = parseInt(row.last7_revenue || '0', 10);

      const marginGhc = totalCost > 0 ? Number(((totalRev - totalCost) / 100).toFixed(2)) : null;

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

    const todayOrders = all.filter((o) => new Date(o.created_at) >= new Date(startOfToday));
    const last7Orders = all.filter((o) => new Date(o.created_at) >= new Date(sevenDaysAgo));

    const todayRevMinor = todayOrders.filter((o) => o.payment_status === 'success').reduce((sum, o) => sum + o.amount, 0);
    const last7RevMinor = last7Orders.filter((o) => o.payment_status === 'success').reduce((sum, o) => sum + o.amount, 0);
    const totalRevMinor = all.filter((o) => o.payment_status === 'success').reduce((sum, o) => sum + o.amount, 0);
    const totalCostMinor = all.reduce((sum, o) => sum + (o.supplier_cost_minor || 0), 0);

    return {
      today: {
        ordersCount: todayOrders.length,
        revenueMinor: todayRevMinor,
        revenueGhc: Number((todayRevMinor / 100).toFixed(2)),
        deliveredCount: todayOrders.filter((o) => o.status === 'delivered').length,
        processingCount: todayOrders.filter((o) => ['processing', 'submitted', 'queued'].includes(o.status)).length,
        attentionCount: todayOrders.filter((o) => ['failed', 'refund_pending', 'refunded'].includes(o.status)).length,
      },
      last7Days: {
        ordersCount: last7Orders.length,
        revenueMinor: last7RevMinor,
        revenueGhc: Number((last7RevMinor / 100).toFixed(2)),
        dataOrdersCount: last7Orders.filter((o) => (o.service_type || 'data') === 'data').length,
        airtimeOrdersCount: last7Orders.filter((o) => o.service_type === 'airtime').length,
      },
      allTime: {
        ordersCount: all.length,
        revenueMinor: totalRevMinor,
        revenueGhc: Number((totalRevMinor / 100).toFixed(2)),
        supplierCostMinor: totalCostMinor,
        supplierCostGhc: Number((totalCostMinor / 100).toFixed(2)),
        estimatedGrossMarginGhc: totalCostMinor > 0 ? Number(((totalRevMinor - totalCostMinor) / 100).toFixed(2)) : null,
        manualReviewPendingCount: all.filter((o) => Boolean(o.manual_review)).length,
      },
    };
  }
}
