/** Existing duplicate phones remain untouched; only unambiguous identities are backfilled. */
export const COMMERCIAL_SCHEMA = `
CREATE OR REPLACE FUNCTION mystery_canonical_phone(value TEXT) RETURNS TEXT AS $$
 SELECT CASE WHEN regexp_replace(value,'[[:space:]()-]','','g') ~ '^([+]?233|0)?[235][0-9]{8}$'
 THEN '+233' || right(regexp_replace(value,'[[:space:]()-]','','g'),9) ELSE NULL END
$$ LANGUAGE SQL IMMUTABLE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_identity_key VARCHAR(32);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_identity_unique ON users(phone_identity_key) WHERE phone_identity_key IS NOT NULL;
UPDATE users u SET phone_identity_key=mystery_canonical_phone(u.phone)
 WHERE u.phone_identity_key IS NULL AND mystery_canonical_phone(u.phone) IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM users other WHERE other.id<>u.id AND mystery_canonical_phone(other.phone)=mystery_canonical_phone(u.phone));
CREATE OR REPLACE FUNCTION mystery_phone_identity_guard() RETURNS TRIGGER AS $$
DECLARE canonical TEXT;
BEGIN
 IF TG_OP='UPDATE' AND NEW.phone IS NOT DISTINCT FROM OLD.phone THEN RETURN NEW; END IF;
 canonical := mystery_canonical_phone(NEW.phone);
 IF NEW.phone IS NOT NULL AND canonical IS NULL THEN RAISE EXCEPTION 'Invalid account phone' USING ERRCODE='23514'; END IF;
 IF canonical IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('phone:' || canonical,0));
  IF EXISTS(SELECT 1 FROM users WHERE id<>NEW.id AND mystery_canonical_phone(phone)=canonical) THEN
   RAISE EXCEPTION 'Account identifier conflict' USING ERRCODE='23505',CONSTRAINT='users_phone_identity_unique';
  END IF;
 END IF;
 NEW.phone := canonical; NEW.phone_identity_key := canonical; RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS users_phone_identity_guard ON users;
CREATE TRIGGER users_phone_identity_guard BEFORE INSERT OR UPDATE OF phone ON users FOR EACH ROW EXECUTE FUNCTION mystery_phone_identity_guard();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commercial_context JSONB;
CREATE INDEX IF NOT EXISTS orders_direct_buyer ON orders(user_id,created_at) WHERE store_context IS NULL;
CREATE OR REPLACE FUNCTION mystery_commercial_snapshot_guard() RETURNS TRIGGER AS $$
BEGIN
 IF OLD.commercial_context IS DISTINCT FROM NEW.commercial_context THEN RAISE EXCEPTION 'Commercial snapshot is immutable'; END IF;
 RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS orders_commercial_snapshot_guard ON orders;
CREATE TRIGGER orders_commercial_snapshot_guard BEFORE UPDATE OF commercial_context ON orders FOR EACH ROW EXECUTE FUNCTION mystery_commercial_snapshot_guard();
CREATE UNIQUE INDEX IF NOT EXISTS finance_one_active_welcome ON finance_operations(user_id) WHERE kind='welcome' AND state IN ('reserved','redeemed');
ALTER TABLE finance_operations DROP CONSTRAINT IF EXISTS finance_operations_kind_check;
ALTER TABLE finance_operations ADD CONSTRAINT finance_operations_kind_check CHECK(kind IN ('topup','withdrawal','transfer','purchase','achievement','adjustment','reversal','refund','review','store_checkout','store_sale','direct_checkout','welcome'));
`;
