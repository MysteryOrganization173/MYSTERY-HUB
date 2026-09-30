/**
 * Admin Audit Log Store
 * Records administrative actions with safe sanitization (no passwords, session tokens, or keys).
 */

import { getPool } from './connection.js';

export interface AuditLogRecord {
  id: string;
  admin_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata_safe_json: string | null;
  created_at: string;
}

const devAuditStore: AuditLogRecord[] = [];

export class AdminAuditStore {
  /**
   * Log an administrative mutation safely
   */
  static async record(params: {
    adminUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<AuditLogRecord> {
    const id = `aud_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
    const nowIso = new Date().toISOString();

    // Sanitize metadata to never include secrets/passwords
    let safeJson: string | null = null;
    if (params.metadata) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(params.metadata)) {
        if (
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('key')
        ) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = value;
        }
      }
      safeJson = JSON.stringify(sanitized);
    }

    const record: AuditLogRecord = {
      id,
      admin_user_id: params.adminUserId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      metadata_safe_json: safeJson,
      created_at: nowIso,
    };

    const pool = getPool();
    if (pool) {
      try {
        const query = `
          INSERT INTO admin_audit_log (id, admin_user_id, action, entity_type, entity_id, metadata_safe_json, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *;
        `;
        const res = await pool.query(query, [
          record.id,
          record.admin_user_id,
          record.action,
          record.entity_type,
          record.entity_id,
          record.metadata_safe_json,
          record.created_at,
        ]);
        return res.rows[0] as AuditLogRecord;
      } catch (err) {
        console.warn('[Admin Audit] Failed to record in PostgreSQL:', err);
      }
    }

    devAuditStore.unshift(record);
    if (devAuditStore.length > 200) {
      devAuditStore.pop();
    }
    return record;
  }

  /**
   * Find recent audit logs
   */
  static async findRecent(limit = 50): Promise<AuditLogRecord[]> {
    const pool = getPool();
    if (pool) {
      try {
        const res = await pool.query(
          `SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT $1;`,
          [limit]
        );
        return res.rows as AuditLogRecord[];
      } catch (err) {
        console.warn('[Admin Audit] Failed to query PostgreSQL:', err);
      }
    }

    return devAuditStore.slice(0, limit);
  }

  static _clearDevStore(): void {
    devAuditStore.length = 0;
  }
}
