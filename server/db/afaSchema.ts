export const AFA_SCHEMA = `
CREATE TABLE IF NOT EXISTS afa_registrations (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  phone VARCHAR(32) NOT NULL,
  masked_id_number VARCHAR(32) NOT NULL,
  encrypted_payload TEXT,
  operational_details JSONB NOT NULL,
  purchase_blocked BOOLEAN NOT NULL DEFAULT TRUE,
  supplier_public_id VARCHAR(64),
  supplier_status VARCHAR(64),
  submission_attempted_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ,
  sensitive_payload_purged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_afa_active_phone ON afa_registrations(phone) WHERE purchase_blocked = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_afa_supplier_public_id ON afa_registrations(supplier_public_id) WHERE supplier_public_id IS NOT NULL;
`;
