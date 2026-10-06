import { COMMERCIAL_SCHEMA } from './commercialSchema.js';
import { WEBSITE_BUSINESS_SCHEMA } from './websiteBusinessSchema.js';
import { WEBSITE_FREE_SCHEMA } from './websiteFreeSchema.js';
import { FINANCE_SCHEMA } from './financeSchema.js';
import { AFA_SCHEMA } from './afaSchema.js';
import { MARKETPLACE_FLEXIBILITY_SCHEMA } from './marketplaceFlexibilitySchema.js';
import { ULTRA_ENQUIRY_SCHEMA } from './websiteUltraSchema.js';
/**
 * Shared PostgreSQL Connection Pool & Initialization
 * Ensures Orders, Auth, Waitlist, and Admin use ONE single database connection pool.
 */

import pg from 'pg';
import { assertSafeTestDatabase } from '../utils/environment.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let connectionFailed = false;

export function getPool(): pg.Pool | null {
  // Check before cached-pool reuse and outside the development fallback catch.
  assertSafeTestDatabase();
  if (connectionFailed) return null;
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
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        console.error('[DB] FATAL: Failed to initialize PostgreSQL pool in production.');
        throw err;
      }
      console.warn('Failed to initialize PostgreSQL pool, using development store fallback:', err);
      pool = null;
    }
  }

  return pool;
}

export function isDbConnected(): boolean {
  return pool !== null && !connectionFailed;
}

/**
 * Initializes all database tables and non-destructive migrations
 */
export async function initDatabase(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';

  const db = getPool();
  if (!db) {
    if (isProduction) {
      throw new Error('[DB] FATAL: DATABASE_URL is completely missing in production!');
    }
    console.log('[DB] Running with in-memory persistence store fallback (DATABASE_URL not configured).');
    return;
  }

  let client;
  try {
    client = await db.connect();
  } catch (err) {
    if (isProduction) {
      console.error('[DB] FATAL: Failed to connect to PostgreSQL database in production environment.');
      throw err;
    }
    console.warn('[DB] Failed to connect to PostgreSQL database. Falling back to in-memory persistence:', err);
    connectionFailed = true;
    pool = null;
    return;
  }

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
        name: 'marketplace_inquiries',
        sql: `
          CREATE TABLE IF NOT EXISTS marketplace_inquiries (
            id VARCHAR(64) PRIMARY KEY,
            product_id VARCHAR(64) REFERENCES marketplace_products(id) ON DELETE CASCADE,
            product_name VARCHAR(255) NOT NULL,
            customer_name VARCHAR(128),
            customer_phone VARCHAR(64),
            customer_email VARCHAR(128),
            inquiry_type VARCHAR(64) NOT NULL DEFAULT 'general',
            message TEXT,
            budget VARCHAR(128),
            status VARCHAR(32) NOT NULL DEFAULT 'new',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
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
      {
        name: 'referral_profiles',
        sql: `
          CREATE TABLE IF NOT EXISTS referral_profiles (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            referral_code VARCHAR(32) UNIQUE NOT NULL,
            is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );
        `,
      },
      {
        name: 'referral_attributions',
        sql: `
          CREATE TABLE IF NOT EXISTS referral_attributions (
            id VARCHAR(64) PRIMARY KEY,
            referrer_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            referred_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
            visitor_key VARCHAR(128),
            source_code VARCHAR(32) NOT NULL,
            first_landing_path VARCHAR(256),
            first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            bound_at TIMESTAMP WITH TIME ZONE,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );
        `,
      },
      {
        name: 'referral_clicks',
        sql: `
          CREATE TABLE IF NOT EXISTS referral_clicks (
            id VARCHAR(64) PRIMARY KEY,
            referral_profile_id VARCHAR(64) NOT NULL REFERENCES referral_profiles(id) ON DELETE CASCADE,
            referrer_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            referral_code VARCHAR(32) NOT NULL,
            visitor_key VARCHAR(128),
            landing_path VARCHAR(256),
            user_agent_safe VARCHAR(128),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );
        `,
      },
      {
        name: 'referral_reward_rules',
        sql: `
          CREATE TABLE IF NOT EXISTS referral_reward_rules (
            id VARCHAR(64) PRIMARY KEY,
            service_type VARCHAR(32) NOT NULL,
            product_key VARCHAR(64),
            network VARCHAR(32),
            reward_type VARCHAR(32) NOT NULL DEFAULT 'fixed_minor',
            reward_minor INTEGER,
            reward_percent_bps INTEGER,
            enabled BOOLEAN NOT NULL DEFAULT FALSE,
            starts_at TIMESTAMP WITH TIME ZONE,
            ends_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );
        `,
      },
      {
        name: 'reward_ledger',
        sql: `
          CREATE TABLE IF NOT EXISTS reward_ledger (
            id VARCHAR(64) PRIMARY KEY,
            referrer_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            referred_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
            referral_attribution_id VARCHAR(64) REFERENCES referral_attributions(id) ON DELETE SET NULL,
            order_id VARCHAR(64) REFERENCES orders(id) ON DELETE SET NULL,
            marketplace_product_id VARCHAR(64) REFERENCES marketplace_products(id) ON DELETE SET NULL,
            service_type VARCHAR(32) NOT NULL,
            reward_rule_id VARCHAR(64) REFERENCES referral_reward_rules(id) ON DELETE SET NULL,
            amount_minor INTEGER NOT NULL,
            currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            reason TEXT NOT NULL,
            idempotency_key VARCHAR(128) UNIQUE NOT NULL,
            reversal_of_id VARCHAR(64) REFERENCES reward_ledger(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            approved_at TIMESTAMP WITH TIME ZONE,
            rejected_at TIMESTAMP WITH TIME ZONE,
            reversed_at TIMESTAMP WITH TIME ZONE,
            metadata_json JSONB
          );
        `,
      },
    ];

    baseTables.push({ name: 'referral_profile_suspensions', sql: `CREATE TABLE IF NOT EXISTS referral_profile_suspensions (
      id VARCHAR(64) PRIMARY KEY, profile_id VARCHAR(64) NOT NULL REFERENCES referral_profiles(id),
      starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ends_at TIMESTAMPTZ,
      CHECK (ends_at IS NULL OR ends_at >= starts_at));` });
    baseTables.push({ name: 'referral_reward_suppressions', sql: `CREATE TABLE IF NOT EXISTS referral_reward_suppressions (
      referrer_user_id VARCHAR(64) NOT NULL REFERENCES users(id), order_id VARCHAR(64) NOT NULL REFERENCES orders(id),
      reason VARCHAR(32) NOT NULL DEFAULT 'profile_suspended', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (referrer_user_id, order_id));` });
    baseTables.push({ name: 'website_free_media_analytics', sql: WEBSITE_FREE_SCHEMA });
    baseTables.push({ name: 'website_ultra_enquiries', sql: ULTRA_ENQUIRY_SCHEMA });
    for (const table of baseTables) {
      try {
        await client.query(table.sql);
      } catch (err) {
        console.error(`[DB] CRITICAL: Failed creating base table "${table.name}":`, err);
        throw new Error(`Database base table creation failed for "${table.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 2. REQUIRED COLUMN MIGRATIONS ON ORDERS & PRODUCTS (Critical - executed independently)
    const orderMigrations = [
      { name: 'users.must_change_password', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;` },
      { name: 'users.password_changed_at', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NULL;` },
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
      {
        name: 'referral_clicks.capture_key',
        sql: `ALTER TABLE referral_clicks ADD COLUMN IF NOT EXISTS capture_key VARCHAR(64);`,
      },
      {
        name: 'orders.referrer_user_id',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS referrer_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;`,
      },
      {
        name: 'orders.referral_attribution_id',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_attribution_id VARCHAR(64) REFERENCES referral_attributions(id) ON DELETE SET NULL;`,
      },
      {
        name: 'orders.referral_code',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_code VARCHAR(32);`,
      },
      {
        name: 'marketplace_products.referral_reward_minor',
        sql: `ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS referral_reward_minor INTEGER;`,
      },
      {
        name: 'referral_attributions.level1_referrer_user_id',
        sql: `ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS level1_referrer_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;`,
      },
      {
        name: 'referral_attributions.level2_referrer_user_id',
        sql: `ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS level2_referrer_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;`,
      },
      {
        name: 'referral_attributions.level3_referrer_user_id',
        sql: `ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS level3_referrer_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;`,
      },
      {
        name: 'referral_reward_rules.purchase_stage',
        sql: `ALTER TABLE referral_reward_rules ADD COLUMN IF NOT EXISTS purchase_stage VARCHAR(16) NOT NULL DEFAULT 'any' CHECK (purchase_stage IN ('any', 'acquisition', 'recurring'));`,
      },
      {
        name: 'reward_ledger.reward_stage',
        sql: `ALTER TABLE reward_ledger ADD COLUMN IF NOT EXISTS reward_stage VARCHAR(16) NOT NULL DEFAULT 'standard' CHECK (reward_stage IN ('standard', 'acquisition', 'recurring'));`,
      },
      {
        name: 'reward_ledger.reward_relationship_key',
        sql: `ALTER TABLE reward_ledger ADD COLUMN IF NOT EXISTS reward_relationship_key VARCHAR(256);`,
      },
      {
        name: 'referral_reward_rules.level2_reward_minor',
        sql: `ALTER TABLE referral_reward_rules ADD COLUMN IF NOT EXISTS level2_reward_minor INTEGER;`,
      },
      {
        name: 'referral_reward_rules.level2_percent_bps',
        sql: `ALTER TABLE referral_reward_rules ADD COLUMN IF NOT EXISTS level2_percent_bps INTEGER;`,
      },
      {
        name: 'referral_reward_rules.level3_reward_minor',
        sql: `ALTER TABLE referral_reward_rules ADD COLUMN IF NOT EXISTS level3_reward_minor INTEGER;`,
      },
      {
        name: 'referral_reward_rules.level3_percent_bps',
        sql: `ALTER TABLE referral_reward_rules ADD COLUMN IF NOT EXISTS level3_percent_bps INTEGER;`,
      },
      {
        name: 'reward_ledger.network_level',
        sql: `ALTER TABLE reward_ledger ADD COLUMN IF NOT EXISTS network_level INTEGER NOT NULL DEFAULT 1;`,
      },
      {
        name: 'marketplace_products.purchase_enabled',
        sql: `ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS purchase_enabled BOOLEAN DEFAULT TRUE;`,
      },
      {
        name: 'marketplace_products.fulfilment_mode',
        sql: `ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS fulfilment_mode VARCHAR(32) DEFAULT 'both';`,
      },
      {
        name: 'marketplace_products.pickup_locations',
        sql: `ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS pickup_locations TEXT;`,
      },
      {
        name: 'marketplace_products.delivery_available',
        sql: `ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS delivery_available BOOLEAN DEFAULT TRUE;`,
      },
      {
        name: 'marketplace_products.delivery_note',
        sql: `ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS delivery_note TEXT;`,
      },
      {
        name: 'marketplace_products.purchase_note',
        sql: `ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS purchase_note TEXT;`,
      },
      {
        name: 'marketplace_products.payment_required_before_delivery',
        sql: `ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS payment_required_before_delivery BOOLEAN DEFAULT TRUE;`,
      },
      {
        name: 'marketplace_products.variants',
        sql: `ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS variants TEXT;`,
      },
      {
        name: 'orders.product_slug',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_slug VARCHAR(128);`,
      },
      {
        name: 'orders.variant_id',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS variant_id VARCHAR(64);`,
      },
      {
        name: 'orders.variant_snapshot',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS variant_snapshot VARCHAR(256);`,
      },
      {
        name: 'orders.fulfilment_method',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfilment_method VARCHAR(32);`,
      },
      {
        name: 'orders.pickup_location_id',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_location_id VARCHAR(64);`,
      },
      {
        name: 'orders.pickup_location_snapshot',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_location_snapshot TEXT;`,
      },
      {
        name: 'orders.delivery_city',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_city VARCHAR(128);`,
      },
      {
        name: 'orders.delivery_area',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_area VARCHAR(128);`,
      },
      {
        name: 'orders.delivery_landmark',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_landmark TEXT;`,
      },
      {
        name: 'orders.delivery_note',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_note TEXT;`,
      },
      {
        name: 'orders.marketplace_status',
        sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS marketplace_status VARCHAR(32);`,
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

    await client.query(MARKETPLACE_FLEXIBILITY_SCHEMA);
    await client.query(AFA_SCHEMA);
    await client.query(FINANCE_SCHEMA);
    await client.query(WEBSITE_BUSINESS_SCHEMA);
    await client.query(COMMERCIAL_SCHEMA);

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
      `CREATE INDEX IF NOT EXISTS idx_orders_referrer_user_id ON orders (referrer_user_id);`,
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
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_profiles_user_id ON referral_profiles (user_id);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_profiles_code ON referral_profiles (UPPER(referral_code));`,
      `CREATE INDEX IF NOT EXISTS idx_referral_attributions_referrer ON referral_attributions (referrer_user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_referral_attributions_level2 ON referral_attributions (level2_referrer_user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_referral_attributions_level3 ON referral_attributions (level3_referrer_user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_referral_attributions_visitor ON referral_attributions (visitor_key);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_attributions_referred_unique ON referral_attributions (referred_user_id) WHERE referred_user_id IS NOT NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_referral_clicks_referrer ON referral_clicks (referrer_user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_referral_clicks_created ON referral_clicks (created_at DESC);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_clicks_capture_key ON referral_clicks (capture_key);`,
      `CREATE INDEX IF NOT EXISTS idx_referral_clicks_visitor ON referral_clicks (referral_profile_id, visitor_key, created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_reward_rules_service ON referral_reward_rules (service_type, enabled);`,
      `CREATE INDEX IF NOT EXISTS idx_reward_ledger_referrer ON reward_ledger (referrer_user_id, status);`,
      `CREATE INDEX IF NOT EXISTS idx_reward_ledger_order ON reward_ledger (order_id);`,
      `CREATE INDEX IF NOT EXISTS idx_reward_ledger_network_level ON reward_ledger (network_level);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_ledger_idempotency ON reward_ledger (idempotency_key);`,
      `CREATE INDEX IF NOT EXISTS idx_reward_ledger_created ON reward_ledger (created_at DESC);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_acquisition_relationship ON reward_ledger (reward_relationship_key, service_type) WHERE reward_stage = 'acquisition' AND network_level = 1 AND reward_relationship_key IS NOT NULL;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_suspension_open ON referral_profile_suspensions(profile_id) WHERE ends_at IS NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_referral_suspension_history ON referral_profile_suspensions(profile_id, starts_at, ends_at);`,
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
