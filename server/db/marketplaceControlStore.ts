import { MARKETPLACE_LIMITS } from '../../shared/marketplaceLimits.js';
import { randomUUID } from 'node:crypto';
import { getPool } from './connection.js';
import { AdminAuditStore } from './adminAuditStore.js';
import { CATEGORY_LABELS } from '../types/marketplace.js';
import {saveLead} from '../services/leadWorkflow.js';
import {leadFilter} from './leadOperationsStore.js';

export class MarketplaceInputError extends Error { constructor(message: string, public status = 400) { super(message); } }
export interface MarketplaceCategoryRecord { slug: string; label: string; active: boolean; sort_order: number; created_at: string; updated_at: string; }
export interface MarketplaceInquiryRecord {
  id: string; product_id?: string | null; product_name: string; customer_name?: string | null;
  customer_phone?: string | null; customer_email?: string | null; inquiry_type: string;
  message?: string | null; budget?: string | null; status: string; admin_note?: string | null;
  created_at: string; updated_at: string; contacted_at?: string | null;workflow_version?:number;follow_up_on?:string|null;lead_updated_by?:string|null;
}
const categories = new Map<string, MarketplaceCategoryRecord>();
const inquiries = new Map<string, MarketplaceInquiryRecord>();
function seedMemory() {
  if (categories.size) return;
  Object.entries(CATEGORY_LABELS).filter(([s]) => s !== 'all').forEach(([slug, label], i) => categories.set(slug, {
    slug, label, active: true, sort_order: i, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }));
}
export function plainText(value: unknown, label: string, limit: number, required = false): string {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > limit || /[<>\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value) || (required && !value.trim())) throw new MarketplaceInputError(`${label} must be plain text, up to ${limit} characters.`);
  return value.trim();
}
function orderPosition(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 1000000) throw new MarketplaceInputError('Sort position must be an integer from 0 to 1000000.');
  return Number(value);
}
export class MarketplaceControlStore {
  static async getCategories(activeOnly = false): Promise<MarketplaceCategoryRecord[]> {
    const pool = getPool();
    if (pool) return (await pool.query(`SELECT * FROM marketplace_categories ${activeOnly ? 'WHERE active = true' : ''} ORDER BY sort_order, label, slug`)).rows;
    seedMemory(); return [...categories.values()].filter(c => !activeOnly || c.active).sort((a,b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
  }
  static async saveCategory(input: Record<string, unknown>, adminId: string, existingSlug?: string) {
    const slug = existingSlug || plainText(input.slug, 'Slug', 64, true);
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(slug) || slug === 'all') throw new MarketplaceInputError('Use a stable category slug with lowercase letters, numbers and underscores.');
    const all = await this.getCategories(); const existing = all.find(c => c.slug === slug);
    if (!existingSlug && existing) throw new MarketplaceInputError('Category slug already exists.', 409);
    if (existingSlug && !existing) throw new MarketplaceInputError('Category not found.', 404);
    if (input.active !== undefined && typeof input.active !== 'boolean') throw new MarketplaceInputError('Active must be boolean.');
    const record: MarketplaceCategoryRecord = { slug,
      label: input.label !== undefined || !existing ? plainText(input.label, 'Label', 100, true) : existing.label,
      active: input.active === undefined ? existing?.active ?? true : input.active as boolean,
      sort_order: input.sortOrder === undefined ? existing?.sort_order ?? all.length : orderPosition(input.sortOrder),
      created_at: existing?.created_at || new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    const pool = getPool();
    if (pool) {
      if (existing) await pool.query('UPDATE marketplace_categories SET label=$2, active=$3, sort_order=$4, updated_at=$5 WHERE slug=$1', [slug, record.label, record.active, record.sort_order, record.updated_at]);
      else {
        try { await pool.query('INSERT INTO marketplace_categories (slug,label,active,sort_order,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6)', [slug,record.label,record.active,record.sort_order,record.created_at,record.updated_at]); }
        catch (e) { if ((e as {code?:string}).code === '23505') throw new MarketplaceInputError('Category slug already exists.',409); throw e; }
      }
    } else categories.set(slug, record);
    await AdminAuditStore.record({ adminUserId: adminId, action: existing ? 'marketplace_category_updated' : 'marketplace_category_created', entityType: 'marketplace_category', entityId: slug, metadata: { active: record.active, sortOrder: record.sort_order } });
    return record;
  }
  static async createInquiry(input: { productId?: string; productName: string; customerName?: string; customerPhone?: string; customerEmail?: string; inquiryType?: string; message?: string; budget?: string }) {
    const now = new Date().toISOString();
    const record: MarketplaceInquiryRecord = { id: `inq_${randomUUID()}`, product_id: input.productId || null,
      product_name: plainText(input.productName, 'Product name',MARKETPLACE_LIMITS.inquiryProductName,true), customer_name: plainText(input.customerName,'Customer name',128),
      customer_phone: plainText(input.customerPhone,'Phone',32), customer_email: plainText(input.customerEmail,'Email',128),
      inquiry_type: plainText(input.inquiryType || 'general','Inquiry type',64,true), message: plainText(input.message,'Message',2000),
      budget: plainText(input.budget,'Budget',128), status:'new',admin_note:null,created_at:now,updated_at:now,contacted_at:null };
    const pool = getPool();
    if (pool) await pool.query('INSERT INTO marketplace_inquiries (id,product_id,product_name,customer_name,customer_phone,customer_email,inquiry_type,message,budget,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[record.id,record.product_id,record.product_name,record.customer_name,record.customer_phone,record.customer_email,record.inquiry_type,record.message,record.budget,record.status,now,now]);
    else inquiries.set(record.id,record);
    return {id:record.id,createdAt:now};
  }
  static async listInquiries(filters: { status?: string; productId?: string; search?: string; page?: number; pageSize?: number;followUp?:string;inquiryId?:string } = {}) {
    const followUp=leadFilter('marketplace',filters.followUp||'');
    if (filters.status && !['new','contacted','resolved','closed'].includes(filters.status)) throw new MarketplaceInputError('Invalid inquiry status.');
    const page = filters.page ?? 1; const pageSize = filters.pageSize ?? 20;
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new MarketplaceInputError('Invalid pagination.');
    const pool = getPool(); let rows: MarketplaceInquiryRecord[]; let total: number;
    if (pool) {
      const values: unknown[] = []; const clauses: string[] = [followUp];
      if(filters.inquiryId){values.push(filters.inquiryId);clauses.push(`id=$${values.length}`);}
      if (filters.status) { values.push(filters.status); clauses.push(`status=$${values.length}`); }
      if (filters.productId) { values.push(filters.productId); clauses.push(`product_id=$${values.length}`); }
      if (filters.search) { values.push(`%${filters.search.slice(0,200).replace(/[\\%_]/g,'\\$&')}%`); clauses.push(`(product_name ILIKE $${values.length} OR customer_name ILIKE $${values.length} OR customer_phone ILIKE $${values.length} OR customer_email ILIKE $${values.length} OR message ILIKE $${values.length})`); }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      total = Number((await pool.query(`SELECT COUNT(*) AS total FROM marketplace_inquiries ${where}`,values)).rows[0].total);
      rows = (await pool.query(`SELECT * FROM marketplace_inquiries ${where} ORDER BY created_at DESC,id LIMIT $${values.length+1} OFFSET $${values.length+2}`, [...values,pageSize,(page-1)*pageSize])).rows;
    } else {
      rows = [...inquiries.values()].filter(r => (!filters.status || r.status === filters.status) && (!filters.productId || r.product_id === filters.productId) && (!filters.search || [r.product_name,r.customer_name,r.customer_phone,r.customer_email,r.message].join(' ').toLowerCase().includes(filters.search.toLowerCase()))).sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
      const {followUpState}=await import('../../shared/leadOperations.js');rows=rows.filter(r=>(!filters.inquiryId||r.id===filters.inquiryId)&&(!filters.followUp||(['due','overdue'].includes(filters.followUp)?followUpState(r.follow_up_on||null,r.status)===filters.followUp:filters.followUp==='recent'?Boolean(r.workflow_version&&Date.parse(r.updated_at)>=Date.now()-7*86400000):r.status===filters.followUp)));
      total = rows.length; rows = rows.slice((page-1)*pageSize,page*pageSize);
    }
    return { inquiries: rows, total, page, pageSize };
  }
  static async updateInquiry(id: string, input: Record<string, unknown>, adminId: string) {
    return saveLead('marketplace',id,input,adminId,{read:()=>structuredClone(inquiries.get(id)),write:row=>inquiries.set(id,row)});
  }
  static resetMemory() { categories.clear(); inquiries.clear(); }
}
