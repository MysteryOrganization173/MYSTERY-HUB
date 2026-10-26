/** Archival is reversible; deletion history has no cascading reference to the removed fixture. */
export const ORDER_MANAGEMENT_SCHEMA=`
ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS orders_unarchived_time ON orders(created_at DESC) WHERE archived_at IS NULL;
CREATE TABLE IF NOT EXISTS order_test_fixtures (
 order_id VARCHAR(64) PRIMARY KEY REFERENCES orders(id), provenance VARCHAR(160) NOT NULL CHECK(provenance='synthetic_no_gateway'),
 registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS order_management_events (
 id UUID PRIMARY KEY, order_id VARCHAR(64) NOT NULL, actor_id VARCHAR(64) NOT NULL REFERENCES users(id),
 request_id VARCHAR(64) NOT NULL UNIQUE, input_hash VARCHAR(64) NOT NULL,
 action VARCHAR(20) NOT NULL CHECK(action IN ('archive','restore','delete_test')), reason VARCHAR(500) NOT NULL,
 result JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION order_management_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Order management evidence is append-only'; END; $$;
DO $$ DECLARE t text;r text; BEGIN
 IF NOT EXISTS(SELECT FROM pg_trigger WHERE tgrelid='order_management_events'::regclass AND tgname='order_management_immutable') THEN
 CREATE TRIGGER order_management_immutable BEFORE UPDATE OR DELETE ON order_management_events FOR EACH ROW EXECUTE FUNCTION order_management_immutable(); END IF;
 FOREACH t IN ARRAY ARRAY['order_test_fixtures','order_management_events'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
 IF EXISTS(SELECT FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON %I FROM %I',t,r); END IF;
 END LOOP; END LOOP;
END $$;
REVOKE ALL ON FUNCTION order_management_immutable() FROM PUBLIC;
`;
