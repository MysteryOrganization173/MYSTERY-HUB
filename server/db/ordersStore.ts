/**
 * Database Orders Store
 * Production-ready PostgreSQL database abstraction with safe fallback
 * for local development environments.
 */

import pg from 'pg';
import { OrderRecord, OrderStatus } from '../types/orders.js';

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
          failure_reason TEXT,
          created_at VARCHAR(64) NOT NULL,
          updated_at VARCHAR(64) NOT NULL,
          paid_at VARCHAR(64),
          submitted_at VARCHAR(64),
          delivered_at VARCHAR(64)
        );
      `);
    } catch (err) {
      console.warn('Error running initDb table check:', err);
    } finally {
      client.release();
    }
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
          supplier_response, failure_reason, created_at, updated_at,
          paid_at, submitted_at, delivered_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
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
   * Update arbitrary order status or failure reason safely
   */
  static async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    failureReason?: string,
    supplierOrderId?: string
  ): Promise<OrderRecord | null> {
    const existing = await this.findOrder(orderId);
    if (!existing) return null;

    const updated: OrderRecord = {
      ...existing,
      status,
      failure_reason: failureReason || existing.failure_reason,
      supplier_order_id: supplierOrderId || existing.supplier_order_id,
      updated_at: new Date().toISOString(),
    };

    if (pool) {
      const query = `
        UPDATE orders
        SET status = $1, failure_reason = $2, supplier_order_id = $3, updated_at = $4
        WHERE id = $5;
      `;
      await pool.query(query, [
        updated.status,
        updated.failure_reason,
        updated.supplier_order_id,
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
}
