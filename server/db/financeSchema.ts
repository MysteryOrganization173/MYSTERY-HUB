/** Additive only. Existing rewards are neither rewritten nor seeded with money. */
export const FINANCE_SCHEMA = `
CREATE TABLE IF NOT EXISTS finance_accounts (
 user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id),
 wallet_minor BIGINT NOT NULL DEFAULT 0 CHECK(wallet_minor >= 0 AND wallet_minor <= 100000000),
 restricted BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS finance_operations (
 id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64) NOT NULL REFERENCES users(id),
 kind VARCHAR(32) NOT NULL CHECK(kind IN ('topup','withdrawal','transfer','purchase','achievement','adjustment','reversal','refund','review')),
 idempotency_key VARCHAR(128) NOT NULL, state VARCHAR(32) NOT NULL,
 amount_minor BIGINT NOT NULL CHECK(amount_minor >= 0 AND amount_minor <= 100000000),
 payload JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(user_id,idempotency_key), UNIQUE(id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS finance_topup_reference ON finance_operations((payload->>'reference')) WHERE kind='topup';
CREATE UNIQUE INDEX IF NOT EXISTS finance_purchase_order ON finance_operations((payload->>'orderId')) WHERE kind='purchase';
CREATE INDEX IF NOT EXISTS finance_operations_user_time ON finance_operations(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS finance_withdrawal_queue ON finance_operations(state,created_at) WHERE kind='withdrawal';
CREATE TABLE IF NOT EXISTS finance_ledger (
 id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64) NOT NULL REFERENCES users(id),
 operation_id VARCHAR(64) NOT NULL REFERENCES finance_operations(id),
 bucket VARCHAR(8) NOT NULL CHECK(bucket IN ('wallet','earn')), delta_minor BIGINT NOT NULL CHECK(delta_minor <> 0),
 balance_after_minor BIGINT, description VARCHAR(128) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(operation_id,bucket), FOREIGN KEY(operation_id,user_id) REFERENCES finance_operations(id,user_id),
 CHECK((bucket='wallet' AND balance_after_minor IS NOT NULL AND balance_after_minor BETWEEN 0 AND 100000000)
       OR (bucket='earn' AND balance_after_minor IS NULL))
);
CREATE INDEX IF NOT EXISTS finance_ledger_user_time ON finance_ledger(user_id,created_at DESC);
CREATE OR REPLACE FUNCTION finance_ledger_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Financial ledger entries are immutable; append a compensating entry'; END;
$$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='finance_ledger_immutable' AND tgrelid='finance_ledger'::regclass) THEN
  CREATE TRIGGER finance_ledger_immutable BEFORE UPDATE OR DELETE ON finance_ledger FOR EACH ROW EXECUTE FUNCTION finance_ledger_immutable();
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS finance_config (
 id VARCHAR(64) PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
