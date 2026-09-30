/**
 * Waitlist Data Store
 * Persists and deduplicates early-access registrations in PostgreSQL with in-memory fallback.
 */

import { getPool } from './connection.js';
import { WaitlistRecord, WaitlistChannel } from '../types/auth.js';
import { canonicalGhanaPhone, isValidGhanaPhoneNumber } from '../utils/phone.js';
import { normalizeEmail } from '../utils/authValidation.js';

const devWaitlistStore = new Map<string, WaitlistRecord>();

export interface AddWaitlistParams {
  serviceKey: string;
  serviceTitle: string;
  channel: WaitlistChannel;
  contact: string;
  sourcePage?: string | null;
  userId?: string | null;
}

export class WaitlistStore {
  /**
   * Normalize contact according to chosen channel
   */
  static normalizeContact(channel: WaitlistChannel, contact: string): string | null {
    if (channel === 'email') {
      return normalizeEmail(contact);
    }
    // whatsapp or sms
    if (isValidGhanaPhoneNumber(contact)) {
      return canonicalGhanaPhone(contact);
    }
    return null;
  }

  /**
   * Add entry to waitlist with intelligent deduplication
   */
  static async addToWaitlist(
    params: AddWaitlistParams
  ): Promise<{ record: WaitlistRecord; alreadyJoined: boolean }> {
    const serviceKey = params.serviceKey.trim().toLowerCase();
    const serviceTitle = params.serviceTitle.trim();
    const channel = params.channel;
    const contactRaw = params.contact.trim();

    const contactNormalized = this.normalizeContact(channel, contactRaw);
    if (!contactNormalized) {
      throw new Error(`Invalid ${channel} contact details provided.`);
    }

    const uniqueKey = `${serviceKey}:${contactNormalized}`;
    const pool = getPool();

    if (pool) {
      // Check existing entry
      const existingQuery = `
        SELECT * FROM waitlist 
        WHERE service_key = $1 AND contact_normalized = $2 
        LIMIT 1;
      `;
      const existingRes = await pool.query(existingQuery, [serviceKey, contactNormalized]);
      if (existingRes.rows.length > 0) {
        return {
          record: existingRes.rows[0] as WaitlistRecord,
          alreadyJoined: true,
        };
      }

      // Insert new entry
      const nowIso = new Date().toISOString();
      const id = `wtl_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;

      const insertQuery = `
        INSERT INTO waitlist (
          id, service_key, service_title, channel, contact, contact_normalized,
          user_id, status, source_page, admin_note, created_at, updated_at, contacted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *;
      `;
      const insertRes = await pool.query(insertQuery, [
        id,
        serviceKey,
        serviceTitle,
        channel,
        contactRaw,
        contactNormalized,
        params.userId || null,
        'pending',
        params.sourcePage || null,
        null,
        nowIso,
        nowIso,
        null,
      ]);

      return {
        record: insertRes.rows[0] as WaitlistRecord,
        alreadyJoined: false,
      };
    }

    // In-memory fallback
    const existing = devWaitlistStore.get(uniqueKey);
    if (existing) {
      return { record: existing, alreadyJoined: true };
    }

    const nowIso = new Date().toISOString();
    const id = `wtl_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
    const record: WaitlistRecord = {
      id,
      service_key: serviceKey,
      service_title: serviceTitle,
      channel,
      contact: contactRaw,
      contact_normalized: contactNormalized,
      user_id: params.userId || null,
      status: 'pending',
      source_page: params.sourcePage || null,
      admin_note: null,
      created_at: nowIso,
      updated_at: nowIso,
      contacted_at: null,
    };

    devWaitlistStore.set(uniqueKey, record);
    return { record, alreadyJoined: false };
  }

  /**
   * Find entries for a user (if linked)
   */
  static async findUserWaitlists(userId: string): Promise<WaitlistRecord[]> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query(
        `SELECT * FROM waitlist WHERE user_id = $1 ORDER BY created_at DESC;`,
        [userId]
      );
      return res.rows as WaitlistRecord[];
    }

    const results: WaitlistRecord[] = [];
    for (const w of devWaitlistStore.values()) {
      if (w.user_id === userId) results.push(w);
    }
    return results;
  }

  /**
   * Admin: Search, filter, and paginate waitlist registrations
   */
  static async searchWaitlistAdmin(params: {
    q?: string;
    serviceKey?: string;
    channel?: WaitlistChannel;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ entries: WaitlistRecord[]; total: number; totalPages: number; page: number; limit: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(200, Math.max(1, params.limit || 25));
    const offset = (page - 1) * limit;

    const pool = getPool();
    if (pool) {
      const conditions: string[] = [];
      const values: unknown[] = [];
      let valIdx = 1;

      if (params.q && params.q.trim()) {
        const cleanQ = `%${params.q.trim()}%`;
        conditions.push(`(contact ILIKE $${valIdx} OR service_title ILIKE $${valIdx} OR service_key ILIKE $${valIdx})`);
        values.push(cleanQ);
        valIdx++;
      }

      if (params.serviceKey) {
        conditions.push(`service_key = $${valIdx}`);
        values.push(params.serviceKey);
        valIdx++;
      }

      if (params.channel) {
        conditions.push(`channel = $${valIdx}`);
        values.push(params.channel);
        valIdx++;
      }

      if (params.status) {
        conditions.push(`status = $${valIdx}`);
        values.push(params.status);
        valIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await pool.query(`SELECT COUNT(*) as total FROM waitlist ${whereClause};`, values);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const query = `
        SELECT * FROM waitlist
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${valIdx} OFFSET $${valIdx + 1};
      `;
      values.push(limit, offset);

      const res = await pool.query(query, values);
      const entries = res.rows as WaitlistRecord[];
      const totalPages = Math.ceil(total / limit) || 1;

      return { entries, total, totalPages, page, limit };
    }

    // In-memory fallback
    let all = Array.from(devWaitlistStore.values());

    if (params.q && params.q.trim()) {
      const qLower = params.q.trim().toLowerCase();
      all = all.filter(
        (w) =>
          w.contact.toLowerCase().includes(qLower) ||
          w.service_title.toLowerCase().includes(qLower) ||
          w.service_key.toLowerCase().includes(qLower)
      );
    }

    if (params.serviceKey) {
      all = all.filter((w) => w.service_key === params.serviceKey);
    }

    if (params.channel) {
      all = all.filter((w) => w.channel === params.channel);
    }

    if (params.status) {
      all = all.filter((w) => w.status === params.status);
    }

    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = all.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const entries = all.slice(offset, offset + limit);

    return { entries, total, totalPages, page, limit };
  }

  /**
   * Admin: Update waitlist entry status and/or admin note
   */
  static async updateWaitlistStatus(
    id: string,
    status: string,
    adminNote?: string | null
  ): Promise<WaitlistRecord | null> {
    const nowIso = new Date().toISOString();
    const contactedAt = ['contacted', 'notified'].includes(status) ? nowIso : null;
    const pool = getPool();

    if (pool) {
      const query = `
        UPDATE waitlist
        SET status = $1, 
            admin_note = COALESCE($2, admin_note),
            contacted_at = CASE WHEN $3::timestamp with time zone IS NOT NULL THEN $3::timestamp with time zone ELSE contacted_at END,
            updated_at = $4
        WHERE id = $5
        RETURNING *;
      `;
      const res = await pool.query(query, [status, adminNote !== undefined ? adminNote : null, contactedAt, nowIso, id]);
      if (res.rows.length === 0) return null;
      return res.rows[0] as WaitlistRecord;
    }

    for (const [key, w] of devWaitlistStore.entries()) {
      if (w.id === id) {
        w.status = status as any;
        if (adminNote !== undefined) w.admin_note = adminNote;
        if (contactedAt) w.contacted_at = contactedAt;
        w.updated_at = nowIso;
        devWaitlistStore.set(key, w);
        return w;
      }
    }
    return null;
  }

  /**
   * Admin: Get counts grouped by service and channel
   */
  static async getWaitlistGroupedStats(): Promise<{
    serviceCounts: Record<string, number>;
    channelCounts: Record<string, number>;
    totalPending: number;
    totalAll: number;
  }> {
    const pool = getPool();
    if (pool) {
      const serviceRes = await pool.query(`
        SELECT service_title, COUNT(*) as count 
        FROM waitlist 
        GROUP BY service_title 
        ORDER BY count DESC;
      `);

      const channelRes = await pool.query(`
        SELECT channel, COUNT(*) as count 
        FROM waitlist 
        GROUP BY channel;
      `);

      const totalRes = await pool.query(`
        SELECT 
          COUNT(*) as total_all,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as total_pending
        FROM waitlist;
      `);

      const serviceCounts: Record<string, number> = {};
      for (const row of serviceRes.rows) {
        serviceCounts[row.service_title] = parseInt(row.count, 10);
      }

      const channelCounts: Record<string, number> = {};
      for (const row of channelRes.rows) {
        channelCounts[row.channel] = parseInt(row.count, 10);
      }

      return {
        serviceCounts,
        channelCounts,
        totalPending: parseInt(totalRes.rows[0]?.total_pending || '0', 10),
        totalAll: parseInt(totalRes.rows[0]?.total_all || '0', 10),
      };
    }

    const serviceCounts: Record<string, number> = {};
    const channelCounts: Record<string, number> = {};
    let totalPending = 0;

    for (const w of devWaitlistStore.values()) {
      serviceCounts[w.service_title] = (serviceCounts[w.service_title] || 0) + 1;
      channelCounts[w.channel] = (channelCounts[w.channel] || 0) + 1;
      if (w.status === 'pending') totalPending++;
    }

    return {
      serviceCounts,
      channelCounts,
      totalPending,
      totalAll: devWaitlistStore.size,
    };
  }

  /**
   * Test helper to clear memory store
   */
  static _clearDevStore(): void {
    devWaitlistStore.clear();
  }
}
