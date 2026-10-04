/**
 * Authentication and Session Data Store
 * Manages PostgreSQL queries for users and sessions with in-memory fallback.
 */

import { getPool } from './connection.js';
import type { PoolClient } from 'pg';
import { UserRecord, SessionRecord, UserRole, UserStatus } from '../types/auth.js';
import { hashSessionToken } from '../utils/crypto.js';
import { getGhanaPhoneLookupVariants } from '../utils/phone.js';

// In-memory fallback stores
const devUsersStore = new Map<string, UserRecord>();
const devSessionsStore = new Map<string, SessionRecord>();
const accountLocks = new Map<string, Promise<void>>();

export class AuthStore {
  /** Serialize account security mutations; SQL mutations and audits commit together. */
  static async withLockedUser<T>(id: string, action: (user: UserRecord | null, client?: PoolClient) => Promise<T>): Promise<T> {
    const pool = getPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE;', [id]);
        const value = await action(result.rows[0] ?? null, client);
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    }
    const previous = accountLocks.get(id) ?? Promise.resolve();
    let release!: () => void;
    const lock = new Promise<void>(resolve => { release = resolve; });
    const queued = previous.then(() => lock);
    accountLocks.set(id, queued);
    await previous;
    try { return await action(devUsersStore.get(id) ?? null); }
    finally { release(); if (accountLocks.get(id) === queued) accountLocks.delete(id); }
  }

  static async saveAccount(user: UserRecord, client?: PoolClient): Promise<UserRecord> {
    user.updated_at = new Date().toISOString();
    if (client) {
      const result = await client.query(`UPDATE users SET name=$2, email=$3, phone=$4,
        password_hash=$5, must_change_password=$6, password_changed_at=$7, updated_at=$8
        WHERE id=$1 RETURNING *;`, [user.id, user.name, user.email, user.phone,
        user.password_hash, user.must_change_password, user.password_changed_at, user.updated_at]);
      return result.rows[0];
    }
    // Match authoritative database uniqueness in the development fallback.
    for (const other of devUsersStore.values()) {
      if (other.id === user.id) continue;
      for (const field of ['email', 'phone'] as const) {
        if (user[field] && other[field] === user[field]) {
          throw Object.assign(new Error('Identifier conflict'), { code: '23505', constraint: `idx_users_${field}_unique` });
        }
      }
    }
    devUsersStore.set(user.id, user);
    return user;
  }
  static adminDevUsers() { return [...devUsersStore.values()]; }
  /**
   * Create a new user record
   */
  static async createUser(params: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    passwordHash: string;
    role?: UserRole;
    status?: UserStatus;
  }): Promise<UserRecord> {
    const nowIso = new Date().toISOString();
    const record: UserRecord = {
      id: params.id,
      name: params.name.trim(),
      email: params.email ? params.email.trim().toLowerCase() : null,
      phone: params.phone ? params.phone.trim() : null,
      password_hash: params.passwordHash,
      role: params.role || 'customer',
      status: params.status || 'active',
      created_at: nowIso,
      updated_at: nowIso,
      last_login_at: null,
      must_change_password: false,
      password_changed_at: null,
    };

    const pool = getPool();
    if (pool) {
      const query = `
        INSERT INTO users (id, name, email, phone, password_hash, role, status, created_at, updated_at, last_login_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `;
      const res = await pool.query(query, [
        record.id,
        record.name,
        record.email,
        record.phone,
        record.password_hash,
        record.role,
        record.status,
        record.created_at,
        record.updated_at,
        record.last_login_at,
      ]);
      return res.rows[0] as UserRecord;
    }

    devUsersStore.set(record.id, record);
    return record;
  }

  /**
   * Find user by ID
   */
  static async findUserById(id: string): Promise<UserRecord | null> {
    const pool = getPool();
    if (pool) {
      const query = `SELECT * FROM users WHERE id = $1 LIMIT 1;`;
      const res = await pool.query(query, [id]);
      if (res.rows.length > 0) return res.rows[0] as UserRecord;
      return null;
    }

    return devUsersStore.get(id) || null;
  }

  /**
   * Find user by normalized email or Ghana phone
   */
  static async findUserByIdentifier(identifier: string): Promise<UserRecord | null> {
    const clean = identifier.trim();
    const pool = getPool();

    if (clean.includes('@')) {
      const emailLower = clean.toLowerCase();
      if (pool) {
        const query = `SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1;`;
        const res = await pool.query(query, [emailLower]);
        if (res.rows.length > 0) return res.rows[0] as UserRecord;
        return null;
      }

      for (const u of devUsersStore.values()) {
        if (u.email && u.email.toLowerCase() === emailLower) {
          return u;
        }
      }
      return null;
    }

    // Phone lookup: check all phone variants (059..., 23359..., +23359...)
    const phoneVariants = getGhanaPhoneLookupVariants(clean);
    if (phoneVariants.length === 0) return null;

    if (pool) {
      const query = `SELECT * FROM users WHERE phone = ANY($1) LIMIT 1;`;
      const res = await pool.query(query, [phoneVariants]);
      if (res.rows.length > 0) return res.rows[0] as UserRecord;
      return null;
    }

    for (const u of devUsersStore.values()) {
      if (u.phone && phoneVariants.includes(u.phone)) {
        return u;
      }
    }
    return null;
  }

  /**
   * Update user last login timestamp
   */
  static async updateUserLastLogin(userId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    const pool = getPool();
    if (pool) {
      await pool.query(`UPDATE users SET last_login_at = $1, updated_at = $1 WHERE id = $2;`, [
        nowIso,
        userId,
      ]);
      return;
    }

    const u = devUsersStore.get(userId);
    if (u) {
      u.last_login_at = nowIso;
      u.updated_at = nowIso;
    }
  }

  /**
   * Create a new session with hashed token and expiration
   * Normal session: 24 hours (86400s)
   * Remember Me: 30 days (2592000s)
   */
  static async createSession(
    userId: string,
    rawToken: string,
    rememberMe = false,
    client?: PoolClient
  ): Promise<SessionRecord> {
    const tokenHash = hashSessionToken(rawToken);
    const now = Date.now();
    const durationMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const expiresIso = new Date(now + durationMs).toISOString();
    const nowIso = new Date(now).toISOString();

    const session: SessionRecord = {
      id: `ses_${now}_${Math.floor(100000 + Math.random() * 900000)}`,
      user_id: userId,
      token_hash: tokenHash,
      created_at: nowIso,
      expires_at: expiresIso,
      last_seen_at: nowIso,
    };

    const pool = client || getPool();
    if (pool) {
      const query = `
        INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const res = await pool.query(query, [
        session.id,
        session.user_id,
        session.token_hash,
        session.created_at,
        session.expires_at,
        session.last_seen_at,
      ]);
      return res.rows[0] as SessionRecord;
    }

    devSessionsStore.set(tokenHash, session);
    return session;
  }

  /**
   * Resolve session by raw token, verifying active expiration and joining user record
   */
  static async findSessionByToken(
    rawToken: string
  ): Promise<{ session: SessionRecord; user: UserRecord } | null> {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const tokenHash = hashSessionToken(rawToken);
    const nowIso = new Date().toISOString();

    const pool = getPool();
    if (pool) {
      const query = `
        SELECT s.*, 
               u.id as u_id, u.name as u_name, u.email as u_email, u.phone as u_phone,
               u.password_hash as u_password_hash, u.role as u_role, u.status as u_status,
               u.created_at as u_created_at, u.updated_at as u_updated_at, u.last_login_at as u_last_login_at,
               u.must_change_password as u_must_change_password, u.password_changed_at as u_password_changed_at
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token_hash = $1 AND s.expires_at > $2
        LIMIT 1;
      `;
      const res = await pool.query(query, [tokenHash, nowIso]);
      if (res.rows.length === 0) return null;

      const row = res.rows[0];
      const session: SessionRecord = {
        id: row.id,
        user_id: row.user_id,
        token_hash: row.token_hash,
        created_at: row.created_at,
        expires_at: row.expires_at,
        last_seen_at: row.last_seen_at,
      };

      const user: UserRecord = {
        id: row.u_id,
        name: row.u_name,
        email: row.u_email,
        phone: row.u_phone,
        password_hash: row.u_password_hash,
        role: row.u_role,
        status: row.u_status,
        created_at: row.u_created_at,
        updated_at: row.u_updated_at,
        last_login_at: row.u_last_login_at,
        must_change_password: row.u_must_change_password === true,
        password_changed_at: row.u_password_changed_at,
      };

      return { session, user };
    }

    const session = devSessionsStore.get(tokenHash);
    if (!session) return null;

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      devSessionsStore.delete(tokenHash);
      return null;
    }

    const user = devUsersStore.get(session.user_id);
    if (!user) return null;

    return { session, user };
  }

  /**
   * Touch session to update last_seen_at
   */
  static async touchSession(rawToken: string): Promise<void> {
    const tokenHash = hashSessionToken(rawToken);
    const nowIso = new Date().toISOString();

    const pool = getPool();
    if (pool) {
      await pool.query(`UPDATE sessions SET last_seen_at = $1 WHERE token_hash = $2;`, [
        nowIso,
        tokenHash,
      ]);
      return;
    }

    const s = devSessionsStore.get(tokenHash);
    if (s) {
      s.last_seen_at = nowIso;
    }
  }

  /**
   * Revoke single session (e.g. user logout)
   */
  static async revokeSession(rawToken: string): Promise<boolean> {
    const tokenHash = hashSessionToken(rawToken);
    const pool = getPool();
    if (pool) {
      const res = await pool.query(`DELETE FROM sessions WHERE token_hash = $1;`, [tokenHash]);
      return (res.rowCount ?? 0) > 0;
    }

    return devSessionsStore.delete(tokenHash);
  }

  /**
   * Revoke all sessions for a user (e.g. security reset or password change)
   */
  static async revokeAllUserSessions(userId: string, client?: PoolClient): Promise<void> {
    const pool = client || getPool();
    if (pool) {
      await pool.query(`DELETE FROM sessions WHERE user_id = $1;`, [userId]);
      return;
    }

    for (const [hash, ses] of devSessionsStore.entries()) {
      if (ses.user_id === userId) {
        devSessionsStore.delete(hash);
      }
    }
  }

  /**
   * Admin: Search, filter, and paginate registered accounts
   */
  static async searchUsersAdmin(params: {
    q?: string;
    role?: UserRole;
    status?: UserStatus;
    page?: number;
    limit?: number;
  }): Promise<{ users: UserRecord[]; total: number; totalPages: number; page: number; limit: number }> {
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
        conditions.push(`(name ILIKE $${valIdx} OR email ILIKE $${valIdx} OR phone ILIKE $${valIdx})`);
        values.push(cleanQ);
        valIdx++;
      }

      if (params.role) {
        conditions.push(`role = $${valIdx}`);
        values.push(params.role);
        valIdx++;
      }

      if (params.status) {
        conditions.push(`status = $${valIdx}`);
        values.push(params.status);
        valIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await pool.query(`SELECT COUNT(*) as total FROM users ${whereClause};`, values);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const query = `
        SELECT * FROM users
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${valIdx} OFFSET $${valIdx + 1};
      `;
      values.push(limit, offset);

      const res = await pool.query(query, values);
      const users = res.rows as UserRecord[];
      const totalPages = Math.ceil(total / limit) || 1;

      return { users, total, totalPages, page, limit };
    }

    // In-memory fallback
    let all = Array.from(devUsersStore.values());

    if (params.q && params.q.trim()) {
      const qLower = params.q.trim().toLowerCase();
      all = all.filter(
        (u) =>
          u.name.toLowerCase().includes(qLower) ||
          (u.email && u.email.toLowerCase().includes(qLower)) ||
          (u.phone && u.phone.includes(qLower))
      );
    }

    if (params.role) {
      all = all.filter((u) => u.role === params.role);
    }

    if (params.status) {
      all = all.filter((u) => u.status === params.status);
    }

    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = all.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const users = all.slice(offset, offset + limit);

    return { users, total, totalPages, page, limit };
  }

  /**
   * Admin: Update user status (active <-> disabled)
   */
  static async updateUserStatus(userId: string, status: UserStatus): Promise<UserRecord | null> {
    const nowIso = new Date().toISOString();
    const pool = getPool();

    if (pool) {
      const query = `
        UPDATE users
        SET status = $1, updated_at = $2
        WHERE id = $3
        RETURNING *;
      `;
      const res = await pool.query(query, [status, nowIso, userId]);
      if (res.rows.length === 0) return null;
      return res.rows[0] as UserRecord;
    }

    const u = devUsersStore.get(userId);
    if (!u) return null;
    u.status = status;
    u.updated_at = nowIso;
    return u;
  }

  /**
   * Admin: Total count of customers
   */
  static async countCustomers(): Promise<number> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query(`SELECT COUNT(*) as total FROM users WHERE role = 'customer';`);
      return parseInt(res.rows[0]?.total || '0', 10);
    }

    let count = 0;
    for (const u of devUsersStore.values()) {
      if (u.role === 'customer') count++;
    }
    return count;
  }

  /**
   * Test helper to clear memory state
   */
  static _clearDevStore(): void {
    devUsersStore.clear();
    devSessionsStore.clear();
  }
}
