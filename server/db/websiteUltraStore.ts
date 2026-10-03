import { randomUUID } from 'node:crypto';
import { getPool } from './connection.js';
import { validateUltraEnquiry } from '../services/websiteValidation.js';
import type { UltraEnquiryInput } from '../../src/config/websiteBuilder.js';
export interface UltraEnquiryRecord { id: string; reference: string; user_id: string | null; brief: UltraEnquiryInput; status: 'new'; created_at: string; }
const dev = new Map<string, UltraEnquiryRecord>();
export class WebsiteUltraStore {
  static clearDevStore() { dev.clear(); }
  static async create(value: unknown, userId?: string): Promise<UltraEnquiryRecord> {
    const brief = validateUltraEnquiry(value);
    const record: UltraEnquiryRecord = { id: randomUUID(), reference: `MH-ULTRA-${randomUUID().slice(0, 8).toUpperCase()}`, user_id: userId || null, brief, status: 'new', created_at: new Date().toISOString() };
    const pool = getPool();
    if (pool) await pool.query('INSERT INTO website_ultra_enquiries (id, reference, user_id, brief, status, created_at) VALUES ($1,$2,$3,$4,$5,$6)', [record.id, record.reference, record.user_id, JSON.stringify(brief), record.status, record.created_at]);
    else { if (process.env.NODE_ENV === 'production') throw new Error('Persistent enquiry storage unavailable.'); dev.set(record.id, structuredClone(record)); }
    return record;
  }
  static async list(limit: number, offset: number) {
    const pool = getPool();
    if (!pool) return { enquiries: [...dev.values()].sort((a,b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)).slice(offset, offset + limit), total: dev.size };
    const rows = await pool.query('SELECT id, reference, user_id, brief, status, created_at FROM website_ultra_enquiries ORDER BY created_at DESC, id LIMIT $1 OFFSET $2', [limit, offset]);
    const count = await pool.query('SELECT COUNT(*) FROM website_ultra_enquiries');
    return { enquiries: rows.rows, total: Number(count.rows[0].count) };
  }
}
