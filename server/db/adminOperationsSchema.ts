/** Private, additive, append-only operational decisions. No financial ledger migration. */
export const ADMIN_OPERATIONS_SCHEMA=`
CREATE TABLE IF NOT EXISTS admin_guest_buyer_evidence (
 order_id VARCHAR(64) PRIMARY KEY REFERENCES orders(id), buyer_key VARCHAR(100) NOT NULL,
 payer_name VARCHAR(100) NOT NULL, payer_phone VARCHAR(20) NOT NULL, account_id VARCHAR(64) REFERENCES users(id),
 evidence VARCHAR(1000) NOT NULL, actor_id VARCHAR(64) NOT NULL REFERENCES users(id),
 request_id VARCHAR(80) NOT NULL UNIQUE, input_hash VARCHAR(64) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admin_giveaway_rounds (
 id VARCHAR(64) PRIMARY KEY, request_id VARCHAR(80) NOT NULL UNIQUE, input_hash VARCHAR(64) NOT NULL,
 actor_id VARCHAR(64) NOT NULL REFERENCES users(id), period JSONB NOT NULL, cutoff TIMESTAMPTZ NOT NULL,
 snapshot JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admin_giveaway_awards (
 id VARCHAR(64) PRIMARY KEY, round_id VARCHAR(64) NOT NULL REFERENCES admin_giveaway_rounds(id),
 winner_key VARCHAR(100) NOT NULL, prize VARCHAR(160) NOT NULL, reference VARCHAR(160) NOT NULL,
 note VARCHAR(1000) NOT NULL, actor_id VARCHAR(64) NOT NULL REFERENCES users(id), request_id VARCHAR(80) NOT NULL UNIQUE,
 input_hash VARCHAR(64) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(round_id,winner_key)
);
CREATE INDEX IF NOT EXISTS admin_giveaway_rounds_time ON admin_giveaway_rounds(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_guest_buyer_key ON admin_guest_buyer_evidence(buyer_key);
CREATE OR REPLACE FUNCTION admin_operations_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Operational evidence and giveaway history are append-only'; END;
$$;
DO $$ DECLARE t text; r text; BEGIN
 FOREACH t IN ARRAY ARRAY['admin_guest_buyer_evidence','admin_giveaway_rounds','admin_giveaway_awards'] LOOP
  IF NOT EXISTS(SELECT FROM pg_trigger WHERE tgrelid=to_regclass(t) AND tgname='admin_operations_immutable') THEN
   EXECUTE format('CREATE TRIGGER admin_operations_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION admin_operations_immutable()',t);
  END IF;
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON %I FROM %I',t,r); END IF;
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION admin_operations_immutable() FROM PUBLIC;
`;
