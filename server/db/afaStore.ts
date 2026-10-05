import { randomUUID } from 'node:crypto';
import { getPool } from './connection.js';
import { OrdersStore } from './ordersStore.js';
import type { OrderRecord } from '../types/orders.js';
import type { AfaPayload } from '../../shared/afa.js';
import { encryptAfaPayload, decryptAfaPayload } from '../services/afaEncryption.js';

interface AfaRecord {
  id: string; order_id: string; phone: string; masked_id_number: string; encrypted_payload: string | null;
  operational_details: { name: string; region: string; location: string; occupation?: string };
  purchase_blocked: boolean; supplier_public_id: string | null; supplier_status: string | null;
  submission_attempted_at: string | null; submitted_at: string | null; registered_at: string | null;
  last_checked_at?: string | null;
  sensitive_payload_purged_at: string | null; created_at: string; updated_at: string;
}
const memory = new Map<string, AfaRecord>();
const locks = new Map<string, Promise<void>>();
export class AfaDuplicateError extends Error { constructor() { super('This number already has an active or completed AFA registration through Mystery Hub. Contact support if you need help.'); } }
export class AfaStore {
  static clearTestStore() { if (process.env.NODE_ENV !== 'test') throw new Error('Test only'); memory.clear(); locks.clear(); }
  static async create(order: OrderRecord, payload: AfaPayload): Promise<void> {
    const record: AfaRecord = { id: randomUUID(), order_id: order.id, phone: order.recipient_phone,
      masked_id_number: `GHA-******${payload.idNumber.slice(10)}`, encrypted_payload: encryptAfaPayload(order.id, payload),
      operational_details: { name: payload.name, region: payload.region, location: payload.location, ...(payload.occupation ? { occupation: payload.occupation } : {}) },
      purchase_blocked: true, supplier_public_id: null, supplier_status: null, submission_attempted_at: null, submitted_at: null, registered_at: null,
      sensitive_payload_purged_at: null, created_at: order.created_at, updated_at: order.created_at };
    const pool = getPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('afa_' || $1))", [record.phone]);
        // Also clean terminal payloads after a crash between order transition and purge.
        await client.query(`UPDATE afa_registrations a SET purchase_blocked=FALSE, encrypted_payload=NULL,
          sensitive_payload_purged_at=COALESCE(a.sensitive_payload_purged_at,NOW()), updated_at=NOW()
          FROM orders o WHERE a.order_id=o.id AND a.phone=$1 AND o.status IN ('failed','refunded','cancelled','expired')`, [record.phone]);
        const duplicate = await client.query('SELECT order_id FROM afa_registrations WHERE phone=$1 AND purchase_blocked=TRUE LIMIT 1', [record.phone]);
        if (duplicate.rows.length) throw new AfaDuplicateError();
        await OrdersStore.createOrder(order, client);
        await client.query(`INSERT INTO afa_registrations(id,order_id,phone,masked_id_number,encrypted_payload,operational_details,created_at,updated_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$7)`, [record.id,order.id,record.phone,record.masked_id_number,record.encrypted_payload,JSON.stringify(record.operational_details),record.created_at]);
        await client.query('COMMIT');
      } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
      return;
    }
    while (locks.has(record.phone)) await locks.get(record.phone);
    let release!: () => void; locks.set(record.phone, new Promise<void>(resolve => { release = resolve; }));
    try {
      for (const previous of memory.values()) {
        if (previous.phone !== record.phone) continue;
        const previousOrder = await OrdersStore.findOrder(previous.order_id);
        if (previousOrder && ['failed','refunded','cancelled','expired'].includes(previousOrder.status)) await this.purge(previous.order_id, true);
        if (previous.purchase_blocked) throw new AfaDuplicateError();
      }
      await OrdersStore.createOrder(order); memory.set(order.id, record);
    } finally { locks.delete(record.phone); release(); }
  }
  static async find(orderId: string): Promise<AfaRecord | null> {
    const pool = getPool();
    return pool ? (await pool.query('SELECT * FROM afa_registrations WHERE order_id=$1', [orderId])).rows[0] || null : memory.get(orderId) || null;
  }
  static async operationalDetails(orderId: string) {
    const record = await this.find(orderId);
    if (!record) return null;
    return { name:record.operational_details.name, region:record.operational_details.region, location:record.operational_details.location, occupation:record.operational_details.occupation, maskedIdNumber: record.masked_id_number, supplierStatus: record.supplier_status,
      supplierPublicId: record.supplier_public_id, submittedAt: record.submitted_at, registeredAt: record.registered_at,
      createdAt: record.created_at, sensitivePayloadPurgedAt: record.sensitive_payload_purged_at };
  }
  static async payload(orderId: string): Promise<AfaPayload> {
    const record = await this.find(orderId);
    if (!record?.encrypted_payload) throw new Error('AFA payload unavailable.');
    return decryptAfaPayload(orderId, record.encrypted_payload);
  }
  /** Durable latch: even admin attempts must never blindly repeat non-idempotent POST /afa. */
  static async claimSubmission(orderId: string): Promise<boolean> {
    const pool = getPool();
    if (pool) return Boolean((await pool.query(`UPDATE afa_registrations a SET submission_attempted_at=NOW(),updated_at=NOW()
      FROM orders o WHERE a.order_id=$1 AND o.id=a.order_id AND o.payment_status='success' AND o.status='queued'
      AND a.submission_attempted_at IS NULL AND a.supplier_public_id IS NULL AND a.encrypted_payload IS NOT NULL RETURNING a.id`, [orderId])).rows[0]);
    const order = await OrdersStore.findOrder(orderId);
    if (order?.payment_status !== 'success' || order.status !== 'queued') return false;
    const record = memory.get(orderId);
    if (!record || record.submission_attempted_at || record.supplier_public_id || !record.encrypted_payload) return false;
    record.submission_attempted_at = new Date().toISOString(); return true;
  }
  static async supplierState(orderId: string, publicId: string, status: string) {
    const pool = getPool(), now = new Date().toISOString();
    if (pool) await pool.query(`UPDATE afa_registrations SET supplier_public_id=$2,supplier_status=$3,submitted_at=COALESCE(submitted_at,NOW()),
      registered_at=CASE WHEN $3='registered' THEN COALESCE(registered_at,NOW()) ELSE registered_at END,updated_at=NOW() WHERE order_id=$1`, [orderId,publicId,status]);
    else { const record = memory.get(orderId); if (record) Object.assign(record, {supplier_public_id:publicId,supplier_status:status,submitted_at:record.submitted_at || now,registered_at:status==='registered' ? record.registered_at || now : record.registered_at,updated_at:now}); }
  }
  static async claimRefresh(orderId: string): Promise<boolean> {
    const pool = getPool(), now = new Date().toISOString();
    if (pool) return Boolean((await pool.query(`UPDATE afa_registrations SET last_checked_at=NOW()
      WHERE order_id=$1 AND (last_checked_at IS NULL OR last_checked_at < NOW()-INTERVAL '30 seconds') RETURNING id`, [orderId])).rows[0]);
    const record = memory.get(orderId);
    if (!record || (record.last_checked_at && Date.now()-Date.parse(record.last_checked_at) < 30_000)) return false;
    record.last_checked_at = now; return true;
  }
  static async purge(orderId: string, releasePhone = false) {
    const pool = getPool(), now = new Date().toISOString();
    if (pool) await pool.query(`UPDATE afa_registrations SET encrypted_payload=NULL,purchase_blocked=CASE WHEN $2 THEN FALSE ELSE purchase_blocked END,
      sensitive_payload_purged_at=COALESCE(sensitive_payload_purged_at,NOW()),updated_at=NOW() WHERE order_id=$1`, [orderId,releasePhone]);
    else { const record = memory.get(orderId); if (record) { record.encrypted_payload=null; record.sensitive_payload_purged_at ||= now; if (releasePhone) record.purchase_blocked=false; record.updated_at=now; } }
  }
  static async onOrderTerminal(order: OrderRecord) {
    if (order.service_type !== 'afa') return;
    if (order.status === 'delivered') await this.purge(order.id);
    if (['failed','refunded','cancelled','expired'].includes(order.status)) await this.purge(order.id, true);
  }
  /** Repeatable cleanup also covers a process crash after a terminal order write. */
  static async reconcileTerminalPayloads() {
    const pool = getPool();
    if (pool) await pool.query(`UPDATE afa_registrations a SET encrypted_payload=NULL,
      purchase_blocked=CASE WHEN o.status='delivered' THEN a.purchase_blocked ELSE FALSE END,
      sensitive_payload_purged_at=COALESCE(a.sensitive_payload_purged_at,NOW()),updated_at=NOW()
      FROM orders o WHERE o.id=a.order_id AND a.encrypted_payload IS NOT NULL
      AND o.status IN ('delivered','failed','refunded','cancelled','expired')`);
    else for (const record of memory.values()) { const order=await OrdersStore.findOrder(record.order_id); if(order) await this.onOrderTerminal(order); }
  }
}
