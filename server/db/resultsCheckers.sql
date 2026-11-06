-- Results Checkers V1 storage. Install only with founder approval, as part of activation.
-- This file is intentionally absent from application startup: until it is applied, the service stays unavailable.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS public.results_checker_purchases (
  order_id VARCHAR(64) PRIMARY KEY REFERENCES public.orders(id),
  product_key VARCHAR(16) NOT NULL CHECK (product_key IN ('bece','wassce')),
  qty INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 5),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor > 0),
  supplier_type_id VARCHAR(128) NOT NULL,
  quoted_cost_minor INTEGER NOT NULL CHECK (quoted_cost_minor >= 0),
  -- Set once, atomically, before the supplier is called. A set value is never cleared: it stops a second purchase.
  submission_attempted_at TIMESTAMPTZ,
  supplier_purchase_id VARCHAR(100),
  -- AES-256-GCM envelope, bound to the order id. Never returned in lists, logs or analytics.
  encrypted_pins TEXT,
  pin_count INTEGER NOT NULL DEFAULT 0 CHECK (pin_count >= 0),
  pins_stored_at TIMESTAMPTZ,
  first_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Not unique: the supplier's reply format is undocumented, and a repeated id must never block saving paid-for PINs.
CREATE INDEX IF NOT EXISTS results_checker_supplier_purchase ON public.results_checker_purchases (supplier_purchase_id) WHERE supplier_purchase_id IS NOT NULL;
ALTER TABLE public.results_checker_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_checker_purchases FROM PUBLIC;
DO $$
DECLARE api_role TEXT;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON public.results_checker_purchases FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
COMMIT;
