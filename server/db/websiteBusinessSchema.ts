/** Additive business accounting. Existing orders keep a NULL store context. */
export const WEBSITE_BUSINESS_SCHEMA = `
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_context JSONB;
CREATE INDEX IF NOT EXISTS orders_store_site ON orders((store_context->>'siteId'),created_at DESC) WHERE store_context IS NOT NULL;
ALTER TABLE finance_operations DROP CONSTRAINT IF EXISTS finance_operations_kind_check;
ALTER TABLE finance_operations ADD CONSTRAINT finance_operations_kind_check CHECK(kind IN ('topup','withdrawal','transfer','purchase','achievement','adjustment','reversal','refund','review','store_checkout','store_sale','direct_checkout','welcome'));
ALTER TABLE finance_ledger DROP CONSTRAINT IF EXISTS finance_ledger_bucket_check;
ALTER TABLE finance_ledger ADD CONSTRAINT finance_ledger_bucket_check CHECK(bucket IN ('wallet','earn','store'));
ALTER TABLE finance_ledger DROP CONSTRAINT IF EXISTS finance_ledger_check;
ALTER TABLE finance_ledger ADD CONSTRAINT finance_ledger_check CHECK((bucket='wallet' AND balance_after_minor IS NOT NULL AND balance_after_minor BETWEEN 0 AND 100000000) OR (bucket IN ('earn','store') AND balance_after_minor IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS finance_store_sale_order ON finance_operations((payload->>'orderId')) WHERE kind='store_sale';
CREATE OR REPLACE FUNCTION store_snapshot_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF OLD.store_context IS DISTINCT FROM NEW.store_context THEN RAISE EXCEPTION 'Store economic snapshots are immutable'; END IF; RETURN NEW; END;
$$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='store_snapshot_immutable' AND tgrelid='orders'::regclass) THEN
  CREATE TRIGGER store_snapshot_immutable BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION store_snapshot_immutable();
 END IF;
END $$;
`;
