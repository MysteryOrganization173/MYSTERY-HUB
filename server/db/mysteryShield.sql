-- Install only after separate approval. This file is intentionally absent from application startup.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE SCHEMA IF NOT EXISTS mysteryhub_shield;
CREATE TABLE IF NOT EXISTS mysteryhub_shield.control (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  paused BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO mysteryhub_shield.control (id) VALUES (TRUE) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS mysteryhub_shield.claims (
  id UUID PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL UNIQUE REFERENCES public.orders(id),
  state TEXT NOT NULL CHECK (state IN ('reserved','submitted','uncertain','delivered','failed')),
  reserved_minor INTEGER NOT NULL CHECK (reserved_minor > 0),
  package_id VARCHAR(100) NOT NULL,
  supplier_id VARCHAR(100) UNIQUE,
  confirmed_charge_minor INTEGER CHECK (confirmed_charge_minor BETWEEN 0 AND reserved_minor),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  submitted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  submission_started_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS shield_claims_recent ON mysteryhub_shield.claims (created_at DESC);
ALTER TABLE mysteryhub_shield.control ENABLE ROW LEVEL SECURITY;
ALTER TABLE mysteryhub_shield.claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA mysteryhub_shield FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA mysteryhub_shield FROM PUBLIC;
DO $$
DECLARE api_role TEXT;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA mysteryhub_shield FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA mysteryhub_shield FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
COMMIT;
