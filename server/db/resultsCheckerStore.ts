import { getPool } from './connection.js';
import { OrdersStore } from './ordersStore.js';
import { encryptPins, decryptPins } from '../services/resultsCheckerEncryption.js';
import type { OrderRecord } from '../types/orders.js';
import type { CheckerPin, CheckerProductKey } from '../../shared/resultsCheckers.js';

export interface CheckerPurchaseRecord {
  order_id: string; product_key: CheckerProductKey; qty: number; unit_price_minor: number; supplier_type_id: string; quoted_cost_minor: number;
  submission_attempted_at: string | null; supplier_purchase_id: string | null; encrypted_pins: string | null; pin_count: number;
  pins_stored_at: string | null; first_viewed_at: string | null; created_at: string; updated_at: string;
}
type NewPurchase = Pick<CheckerPurchaseRecord, 'product_key' | 'qty' | 'unit_price_minor' | 'supplier_type_id' | 'quoted_cost_minor'>;

const memory = new Map<string, CheckerPurchaseRecord>();

export class ResultsCheckerStore {
  static clearTestStore() { if (process.env.NODE_ENV !== 'test') throw new Error('Test only'); memory.clear(); }

  /** The table is installed separately (server/db/resultsCheckers.sql). Without it the service stays unavailable. */
  static async ready(): Promise<boolean> {
    const pool = getPool();
    if (!pool) return process.env.NODE_ENV !== 'production';
    return (await pool.query<{ ready: boolean }>("SELECT to_regclass('public.results_checker_purchases') IS NOT NULL AS ready")).rows[0]?.ready === true;
  }

  /** The order and its purchase row are created together, or not at all. */
  static async create(order: OrderRecord, purchase: NewPurchase): Promise<void> {
    const pool = getPool();
    if (!pool) {
      await OrdersStore.createOrder(order);
      memory.set(order.id, { ...purchase, order_id: order.id, submission_attempted_at: null, supplier_purchase_id: null, encrypted_pins: null, pin_count: 0, pins_stored_at: null, first_viewed_at: null, created_at: order.created_at, updated_at: order.created_at });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await OrdersStore.createOrder(order, client);
      await client.query('INSERT INTO results_checker_purchases(order_id,product_key,qty,unit_price_minor,supplier_type_id,quoted_cost_minor,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$7)',
        [order.id, purchase.product_key, purchase.qty, purchase.unit_price_minor, purchase.supplier_type_id, purchase.quoted_cost_minor, order.created_at]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  }

  static async find(orderId: string): Promise<CheckerPurchaseRecord | null> {
    const pool = getPool();
    if (!pool) { const row = memory.get(orderId); return row ? { ...row } : null; }
    return (await pool.query('SELECT * FROM results_checker_purchases WHERE order_id=$1', [orderId])).rows[0] || null;
  }

  /** Exactly one caller wins, across every worker, and it can only ever be won once for an order. */
  static async claimSubmission(orderId: string): Promise<boolean> {
    const pool = getPool();
    if (!pool) {
      const row = memory.get(orderId);
      if (!row || row.submission_attempted_at) return false;
      row.submission_attempted_at = new Date().toISOString(); return true;
    }
    return ((await pool.query('UPDATE results_checker_purchases SET submission_attempted_at=NOW(),updated_at=NOW() WHERE order_id=$1 AND submission_attempted_at IS NULL', [orderId])).rowCount || 0) === 1;
  }

  /** Stored before the order may become delivered. A repeat can add PINs but never lose or replace ones already held. */
  static async savePins(orderId: string, purchaseId: string | null, pins: readonly CheckerPin[]): Promise<void> {
    const envelope = encryptPins(orderId, pins);
    const pool = getPool();
    if (!pool) {
      const row = memory.get(orderId);
      if (!row) throw new Error('Results checker purchase not found.');
      if (row.pin_count > pins.length) return;
      Object.assign(row, { supplier_purchase_id: row.supplier_purchase_id || purchaseId, encrypted_pins: envelope, pin_count: pins.length, pins_stored_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      return;
    }
    await pool.query(`UPDATE results_checker_purchases SET supplier_purchase_id=COALESCE(supplier_purchase_id,$2),encrypted_pins=$3,pin_count=$4,pins_stored_at=NOW(),updated_at=NOW() WHERE order_id=$1 AND pin_count<=$4`, [orderId, purchaseId, envelope, pins.length]);
  }

  static async savePurchaseId(orderId: string, purchaseId: string): Promise<void> {
    const pool = getPool();
    if (!pool) { const row = memory.get(orderId); if (row && !row.supplier_purchase_id) row.supplier_purchase_id = purchaseId; return; }
    await pool.query('UPDATE results_checker_purchases SET supplier_purchase_id=COALESCE(supplier_purchase_id,$2),updated_at=NOW() WHERE order_id=$1', [orderId, purchaseId]);
  }

  static pins(record: CheckerPurchaseRecord): CheckerPin[] { return record.encrypted_pins ? decryptPins(record.order_id, record.encrypted_pins) : []; }

  static async markViewed(orderId: string): Promise<void> {
    const pool = getPool();
    if (!pool) { const row = memory.get(orderId); if (row && !row.first_viewed_at) row.first_viewed_at = new Date().toISOString(); return; }
    await pool.query('UPDATE results_checker_purchases SET first_viewed_at=COALESCE(first_viewed_at,NOW()) WHERE order_id=$1', [orderId]);
  }

  /** For Admin: facts about the purchase, never the PINs. */
  static async operationalDetails(orderId: string) {
    const row = await this.find(orderId);
    if (!row) return null;
    return { product: row.product_key, qty: row.qty, supplierPurchaseId: row.supplier_purchase_id, quotedCostMinor: row.quoted_cost_minor, submissionAttemptedAt: row.submission_attempted_at, pinsExpected: row.qty, pinsStored: row.pin_count, pinsStoredAt: row.pins_stored_at, customerViewedAt: row.first_viewed_at };
  }
}
