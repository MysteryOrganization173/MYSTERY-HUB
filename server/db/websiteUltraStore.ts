import { randomUUID } from 'node:crypto';
import { getPool } from './connection.js';
import { validateUltraEnquiry } from '../services/websiteValidation.js';
import type { UltraEnquiryInput } from '../../src/config/websiteBuilder.js';
import {saveLead} from '../services/leadWorkflow.js';
import {leadFilter} from './leadOperationsStore.js';
export interface UltraEnquiryRecord { id: string; reference: string; user_id: string | null; brief: UltraEnquiryInput; status: 'new'; created_at: string; lead_status?:string;lead_note?:string;lead_outcome?:string|null;follow_up_on?:string|null;workflow_version?:number;lead_updated_at?:string|null;lead_updated_by?:string|null; }
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
  static async findByReference(reference: string): Promise<UltraEnquiryRecord | null> {
    const pool = getPool();
    if (!pool) {
      if (process.env.NODE_ENV === 'production') throw new Error('Persistent enquiry storage unavailable.');
      return structuredClone([...dev.values()].find(record => record.reference === reference) || null);
    }
    return (await pool.query('SELECT * FROM website_ultra_enquiries WHERE reference=$1', [reference])).rows[0] || null;
  }
  static async updateWorkflow(reference:string,input:unknown,adminId:string){const old=await this.findByReference(reference);if(!old)return null;return saveLead('ultra',old.id,input,adminId,{read:()=>structuredClone(dev.get(old.id)),write:row=>dev.set(old.id,row)});}
  static async list(limit: number, offset: number, search = '',filter='') {
    const predicate=leadFilter('ultra',filter);
    const pool = getPool();
    if (!pool) {
      if (process.env.NODE_ENV === 'production') throw new Error('Persistent enquiry storage unavailable.');
      const filtered = [...dev.values()].filter(record => [record.reference, record.brief.businessName, record.brief.businessType, record.brief.contactName, record.brief.email, record.brief.phone].some(value => (value || '').toLowerCase().includes(search.toLowerCase()))).sort((a,b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
      const {followUpState}=await import('../../shared/leadOperations.js');
      const matched=filtered.filter(r=>filter==='due'||filter==='overdue'?followUpState(r.follow_up_on||null,r.lead_status||'new')===filter:filter==='recent'?Boolean(r.lead_updated_at&&new Date(r.lead_updated_at).getTime()>=Date.now()-7*86400000):!filter||(r.lead_status||'new')===filter);
      return { enquiries: structuredClone(matched.slice(offset, offset + limit)), total: matched.length };
    }
    // Treat customer/operator search as literal text, including LIKE wildcard characters.
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    const where = `WHERE (${predicate}) AND (reference ILIKE $1 OR brief->>'businessName' ILIKE $1 OR brief->>'businessType' ILIKE $1 OR brief->>'contactName' ILIKE $1 OR brief->>'email' ILIKE $1 OR brief->>'phone' ILIKE $1)`;
    const rows = await pool.query(`SELECT * FROM website_ultra_enquiries ${where} ORDER BY created_at DESC, id LIMIT $2 OFFSET $3`, [pattern, limit, offset]);
    const count = await pool.query(`SELECT COUNT(*) FROM website_ultra_enquiries ${where}`, [pattern]);
    return { enquiries: rows.rows, total: Number(count.rows[0].count) };
  }
}
