-- Mystery Hub Production PostgreSQL Schema
-- Compatible with Supabase, Cloud SQL, Neon, or Render PostgreSQL

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
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_orders_public_ref ON orders (public_reference);
CREATE INDEX IF NOT EXISTS idx_orders_payment_ref ON orders (payment_reference);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
