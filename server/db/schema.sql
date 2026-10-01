-- Mystery Hub Production PostgreSQL Schema
-- Compatible with Supabase, Cloud SQL, Neon, or Render PostgreSQL

-- 1. USERS TABLE
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique 
ON users (LOWER(email)) WHERE email IS NOT NULL AND email != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique 
ON users (phone) WHERE phone IS NOT NULL AND phone != '';

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- 2. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- 3. ORDERS TABLE
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
  amount INTEGER NOT NULL, -- Stored in pesewas (1 GHS = 100 Pesewas)
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

ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_type VARCHAR(32) DEFAULT 'data';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS face_value_minor INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_fee_minor INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_cost_minor INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_offer_ref VARCHAR(128);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_last_checked_at VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS manual_review BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_note TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_public_ref ON orders (public_reference);
CREATE INDEX IF NOT EXISTS idx_orders_payment_ref ON orders (payment_reference);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_supplier_order_id ON orders (supplier_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_manual_review ON orders (manual_review) WHERE manual_review = TRUE;

-- 4. WAITLIST TABLE
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_unique_entry 
ON waitlist (service_key, contact_normalized);

CREATE INDEX IF NOT EXISTS idx_waitlist_service_key ON waitlist (service_key);
CREATE INDEX IF NOT EXISTS idx_waitlist_user_id ON waitlist (user_id);

-- 5. SUPPLIER WEBHOOK IDEMPOTENCY TABLE
CREATE TABLE IF NOT EXISTS supplier_webhook_events (
  event_id VARCHAR(128) PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  payload TEXT,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_webhook_events_time ON supplier_webhook_events (processed_at DESC);

-- 6. ADMIN AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id VARCHAR(64) PRIMARY KEY,
  admin_user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  metadata_safe_json TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_entity ON admin_audit_log (entity_type, entity_id);

-- 7. MARKETPLACE PRODUCTS TABLE (V1 Sourcing Marketplace)
CREATE TABLE IF NOT EXISTS marketplace_products (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(128) UNIQUE NOT NULL,
  name VARCHAR(256) NOT NULL,
  category VARCHAR(64) NOT NULL,
  tagline VARCHAR(256),
  description TEXT,
  price_type VARCHAR(32) NOT NULL DEFAULT 'quote', -- 'fixed' | 'starting_at' | 'quote'
  price_minor INTEGER, -- integer pesewas (100 pesewas = 1 GHS)
  availability VARCHAR(32) NOT NULL DEFAULT 'available', -- 'available' | 'check_availability' | 'limited' | 'coming_soon'
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_slug ON marketplace_products (slug);
CREATE INDEX IF NOT EXISTS idx_marketplace_category ON marketplace_products (category);
CREATE INDEX IF NOT EXISTS idx_marketplace_published ON marketplace_products (published, archived, sort_order, created_at DESC);

-- Active MTN recipient lock index (enforces at most one active MTN order per recipient)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_active_mtn_recipient 
ON orders (recipient_phone) 
WHERE network = 'mtn' AND status IN ('paid', 'queued', 'submitted', 'processing', 'refund_pending');
