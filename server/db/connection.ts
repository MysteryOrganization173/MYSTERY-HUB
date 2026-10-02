/**
 * Shared PostgreSQL Connection Pool & Initialization
 * Ensures Orders, Auth, Waitlist, and Admin use ONE single database connection pool.
 */

import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  if (pool) return pool;

  if (process.env.DATABASE_URL) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      pool.on('error', (err) => {
        console.error('Unexpected error on idle PostgreSQL client:', err);
      });

      console.log('PostgreSQL database pool initialized.');
    } catch (err) {
      console.warn('Failed to initialize PostgreSQL pool, using development store fallback:', err);
      pool = null;
    }
  }

  return pool;
}

export function isDbConnected(): boolean {
  return pool !== null;
}

/**
 * Initializes all database tables and non-destructive migrations
 */
export async function initDatabase(): Promise<void> {
  const db = getPool();
  if (!db) {
    console.log('[DB] Running with in-memory persistence store fallback (DATABASE_URL not configured).');
    return;
  }

  const client = await db.connect();
  try {
    console.log('[DB] Initializing PostgreSQL schema & migrations...');

    // 1. BASE TABLES (Critical)
    const baseTables = [
      {
        name: 'users',
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(128) NOT NULL,
            email VARCHAR(128),
            phone VARCHAR(32),
            password_hash VARCHAR(256) NOT NULL,
            role VARCHAR(32) NOT NULL DEFAULT 'customer',
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            last_login_at TIMESTAMP WITH TIME ZONE
          );
        `,
      },
      {
        name: 'sessions',
        sql: `
          CREATE TABLE IF NOT EXISTS sessions (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(128) UNIQUE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );
        `,
      },
      {
        name: 'orders',
        sql: `
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
            supplier_cost_minor INTEGER,
            supplier_offer_ref VARCHAR(128),
            supplier_last_checked_at VARCHAR(64),
            failure_reason TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            paid_at TIMESTAMP WITH TIME ZONE,
            submitted_at TIMESTAMP WITH TIME ZONE,
            delivered_at TIMESTAMP WITH TIME ZONE
          );
        `,
      },
      {
        name: 'waitlist',
        sql: `
          CREATE TABLE IF NOT EXISTS waitlist (
            id VARCHAR(64) PRIMARY KEY,
            service_key VARCHAR(64) NOT NULL,
            service_title VARCHAR(128) NOT NULL,
            channel VARCHAR(32) NOT NULL,
            contact VARCHAR(128) NOT NULL,
            contact_normalized VARCHAR(128) NOT NULL,
            user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            source_page VARCHAR(64),
            admin_note TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            contacted_at TIMESTAMP WITH TIME ZONE
          );
        `,
      },
      {
        name: 'supplier_webhook_events',
        sql: `
          CREATE TABLE IF NOT EXISTS supplier_webhook_events (
            event_id VARCHAR(128) PRIMARY KEY,
            event_type VARCHAR(64) NOT NULL,
            payload TEXT,
            processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );
        `,
      },
      {
        name: 'admin_audit_log',
        sql: `
          CREATE TABLE IF NOT EXISTS admin_audit_log (
            id VARCHAR(64) PRIMARY KEY,
            admin_user_id VARCHAR(64) NOT NULL REFERENCES users(id),
            action VARCHAR(64) NOT NULL,
            entity_type VARCHAR(64) NOT NULL,
            entity_id VARCHAR(64) NOT NULL,
            metadata_safe_json TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );
        `,
      },
      {
        name: 'marketplace_products',
        sql: `
          CREATE TABLE IF NOT EXISTS marketplace_products (
            id VARCHAR(64) PRIMARY KEY,
            slug VARCHAR(128) UNIQUE NOT NULL,
            name VARCHAR(256) NOT NULL,
            category VARCHAR(64) NOT NULL,
            tagline VARCHAR(256),
            description TEXT,
            price_type VARCHAR(32) NOT NULL DEFAULT 'quote',
            price_minor INTEGER,
            availability VARCHAR(32) NOT NULL DEFAULT 'available',
            availability_label VARCHAR(64),
            badge VARCHAR(64),
            image_url TEXT,
            image_alt VARCHAR(256),
            gallery_urls TEXT,
            highlights TEXT,
            specs TEXT,
            featured BOOLEAN NOT NULL DEFAULT FALSE,
            published BOOLEAN NOT NULL DEFAULT FALSE,
            archived BOOLEAN NOT NULL DEFAULT FALSE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );
        `,
      },
      {
        name: 'website_sites',
        sql: `
          CREATE TABLE IF NOT EXISTS website_sites (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            template_id VARCHAR(64) NOT NULL,
            name VARCHAR(128) NOT NULL,
            slug VARCHAR(64) UNIQUE NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'draft',
            content_json JSONB NOT NULL,
            settings_json JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            published_at TIMESTAMP WITH TIME ZONE
          );
        `,
      },
    ];

    for (const table of baseTables) {
      try {
        await client.query(table.sql);
      } catch (err) {
        console.error(`[DB] CRITICAL: Failed creating base table "${table.name}":`, err);
        throw new Error(`Database base table creation failed for "${table.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 2. REQUIRED COLUMN MIGRATIONS ON ORDERS (Critical - executed independently)
    const orderMigrations = [
      {
        name: 'orders.user_id',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;`,
      },
      {
        name: 'orders.service_type',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_type VARCHAR(32) DEFAULT 'data';`,
      },
      {
        name: 'orders.face_value_minor',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS face_value_minor INTEGER;`,
      },
      {
        name: 'orders.service_fee_minor',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_fee_minor INTEGER;`,
      },
      {
        name: 'orders.supplier_cost_minor',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_cost_minor INTEGER;`,
      },
      {
        name: 'orders.supplier_offer_ref',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_offer_ref VARCHAR(128);`,
      },
      {
        name: 'orders.supplier_last_checked_at',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_last_checked_at VARCHAR(64);`,
      },
      {
        name: 'orders.manual_review',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS manual_review BOOLEAN DEFAULT FALSE;`,
      },
      {
        name: 'orders.admin_note',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_note TEXT;`,
      },
      {
        name: 'orders.payment_closed_at',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_closed_at TIMESTAMP WITH TIME ZONE;`,
      },
    ];

    for (const mig of orderMigrations) {
      try {
        await client.query(mig.sql);
      } catch (err) {
        console.error(`[DB] CRITICAL: Column migration failed for "${mig.name}":`, err);
        throw new Error(`Database column migration failed for "${mig.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 3. INDEX CREATION (Non-critical failures logged as warnings)
    const indexStatements = [
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (LOWER(email)) WHERE email IS NOT NULL AND email != '';`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users (phone) WHERE phone IS NOT NULL AND phone != '';`,
      `CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash);`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_public_ref ON orders (public_reference);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_payment_ref ON orders (payment_reference);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_supplier_order_id ON orders (supplier_order_id);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_manual_review ON orders (manual_review) WHERE manual_review = TRUE;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_unique_entry ON waitlist (service_key, contact_normalized);`,
      `CREATE INDEX IF NOT EXISTS idx_waitlist_service_key ON waitlist (service_key);`,
      `CREATE INDEX IF NOT EXISTS idx_waitlist_user_id ON waitlist (user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_supplier_webhook_events_time ON supplier_webhook_events (processed_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log (created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_admin_audit_entity ON admin_audit_log (entity_type, entity_id);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_active_mtn_recipient ON orders (recipient_phone) WHERE network = 'mtn' AND status IN ('paid', 'queued', 'submitted', 'processing', 'refund_pending');`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_slug ON marketplace_products (slug);`,
      `CREATE INDEX IF NOT EXISTS idx_marketplace_category ON marketplace_products (category);`,
      `CREATE INDEX IF NOT EXISTS idx_marketplace_published ON marketplace_products (published, archived, sort_order, created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_website_sites_user_id ON website_sites (user_id);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_website_sites_slug ON website_sites (slug);`,
      `CREATE INDEX IF NOT EXISTS idx_website_sites_status ON website_sites (status);`,
    ];

    for (const idxSql of indexStatements) {
      try {
        await client.query(idxSql);
      } catch (err) {
        console.warn(`[DB] Warning: Index creation statement failed (continuing):`, err);
      }
    }

    console.log('[DB] PostgreSQL schema & migrations initialized successfully.');
  } catch (err) {
    console.error('[DB] FATAL: Error initializing PostgreSQL schema or migrations:', err);
    throw err;
  } finally {
    client.release();
  }
}
