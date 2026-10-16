/** No order or financial backfill. Private immutable quote/authorization evidence. */
export const ADMIN_ASSISTED_SCHEMA=`
CREATE TABLE IF NOT EXISTS admin_assisted_quotes (
 id VARCHAR(64) PRIMARY KEY, actor_id VARCHAR(64) NOT NULL REFERENCES users(id),
 snapshot JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admin_assisted_orders (
 order_id VARCHAR(64) PRIMARY KEY REFERENCES orders(id), quote_id VARCHAR(64) NOT NULL UNIQUE REFERENCES admin_assisted_quotes(id),
 actor_id VARCHAR(64) NOT NULL REFERENCES users(id), source VARCHAR(32) NOT NULL CHECK(source IN ('complimentary','admin_external')),
 request_id VARCHAR(80) NOT NULL UNIQUE, input_hash VARCHAR(64) NOT NULL, snapshot JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_assisted_quotes_actor ON admin_assisted_quotes(actor_id,created_at DESC);
DO $$ DECLARE t text; r text; BEGIN
 FOREACH t IN ARRAY ARRAY['admin_assisted_quotes','admin_assisted_orders'] LOOP
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
`;
