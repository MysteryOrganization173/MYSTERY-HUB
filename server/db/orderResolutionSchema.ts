/** Additive repeatable operations schema; no production backfill or financial changes. */
export const ORDER_RESOLUTION_SCHEMA = `
ALTER TABLE orders ADD COLUMN IF NOT EXISTS resolution_json JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_customer_refund_id ON orders ((resolution_json->>'refundId')) WHERE resolution_json->>'refundId' IS NOT NULL;
CREATE TABLE IF NOT EXISTS order_resolution_events (
 id VARCHAR(64) PRIMARY KEY, order_id VARCHAR(64) NOT NULL REFERENCES orders(id),
 request_id VARCHAR(64) NOT NULL, input_hash VARCHAR(64) NOT NULL, action VARCHAR(40) NOT NULL,
 actor_id VARCHAR(64) NOT NULL REFERENCES users(id), result JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(order_id,request_id)
);
CREATE INDEX IF NOT EXISTS idx_order_resolution_events_history ON order_resolution_events(order_id,created_at DESC);
ALTER TABLE order_resolution_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON order_resolution_events FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON order_resolution_events FROM anon'; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE 'REVOKE ALL ON order_resolution_events FROM authenticated'; END IF;
END $$;
`;
